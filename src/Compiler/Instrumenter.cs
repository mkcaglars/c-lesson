using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;
using static Microsoft.CodeAnalysis.CSharp.SyntaxFactory;

namespace CLesson.Compiler
{
    /// <summary>
    /// Öğrenci kodunu çalıştırmadan önce yeniden yazar:
    ///  • Her ifadenin önüne Guard.S(dosya, satır) ekler → sonsuz döngü koruması ve hatanın hangi satırda olduğu.
    ///  • Her metodu Guard.Enter/Exit ile sarar → sonsuz özyinelemede tarayıcının çökmesini önler.
    ///  • form.ShowDialog() çağrılarını "await form.ShowDialogAsync()" yapar → WinForms'taki gibi form kapanana kadar bekler.
    /// Satır numaraları korunur (eklenen kod aynı satıra yazılır).
    /// </summary>
    public sealed class Instrumenter : CSharpSyntaxRewriter
    {
        const string GuardType = "global::MiniWinForms.Guard";

        readonly int fileIndex;
        readonly bool guards;
        readonly HashSet<TextSpan> showDialogCalls;
        readonly HashSet<TextSpan> asyncFunctions;

        Instrumenter(int fileIndex, bool guards, HashSet<TextSpan> showDialogCalls, HashSet<TextSpan> asyncFunctions)
        {
            this.fileIndex = fileIndex;
            this.guards = guards;
            this.showDialogCalls = showDialogCalls;
            this.asyncFunctions = asyncFunctions;
        }

        /// <summary>ShowDialog çağrılarını bulur; beklenemeyecek yerdekiler için uyarı döndürür.</summary>
        public static (HashSet<TextSpan> calls, HashSet<TextSpan> functions, List<Diagnostic> warnings) FindShowDialogs(SemanticModel model, SyntaxNode root)
        {
            var calls = new HashSet<TextSpan>();
            var functions = new HashSet<TextSpan>();
            var warnings = new List<Diagnostic>();
            foreach (var inv in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                if (model.GetSymbolInfo(inv).Symbol is not IMethodSymbol m || m.Name != "ShowDialog") continue;
                if (m.ContainingType?.ToDisplayString() != "System.Windows.Forms.Form") continue;
                var fn = inv.Ancestors().FirstOrDefault(a => a is BaseMethodDeclarationSyntax or LocalFunctionStatementSyntax or AnonymousFunctionExpressionSyntax or AccessorDeclarationSyntax);
                bool ok = false;
                if (fn != null && !inv.Ancestors().TakeWhile(a => a != fn).Any(a => a is LockStatementSyntax or QueryExpressionSyntax))
                {
                    IMethodSymbol fs = fn switch
                    {
                        AnonymousFunctionExpressionSyntax lambda => model.GetSymbolInfo(lambda).Symbol as IMethodSymbol,
                        MethodDeclarationSyntax or LocalFunctionStatementSyntax => model.GetDeclaredSymbol(fn) as IMethodSymbol,
                        _ => null,
                    };
                    if (fs != null && fs.Name != "Main" && fs.Parameters.All(p => p.RefKind == RefKind.None) &&
                        (fs.ReturnsVoid || fs.IsAsync))
                        ok = true;
                }
                if (ok)
                {
                    calls.Add(inv.Span);
                    functions.Add(fn.Span);
                }
                else
                {
                    warnings.Add(Diagnostic.Create(ShowDialogWarning, inv.GetLocation()));
                }
            }
            return (calls, functions, warnings);
        }

        static readonly DiagnosticDescriptor ShowDialogWarning = new(
            "DERS002", "ShowDialog beklemez",
            "Bu konumdaki ShowDialog() çağrısı web ortamında formun kapanmasını beklemeden devam eder. Çağrıyı bir olay metodunun (ör. button1_Click) içine taşıyın.",
            "Ders", DiagnosticSeverity.Warning, isEnabledByDefault: true);

        public static SyntaxTree Rewrite(SyntaxTree tree, int fileIndex, bool guards, HashSet<TextSpan> showDialogCalls, HashSet<TextSpan> asyncFunctions)
        {
            var root = tree.GetRoot();
            var rewriter = new Instrumenter(fileIndex, guards, showDialogCalls ?? new(), asyncFunctions ?? new());
            var newRoot = rewriter.Visit(root);
            return tree.WithRootAndOptions(newRoot, tree.Options);
        }

        int LineOf(SyntaxNode n) => n.GetLocation().GetLineSpan().StartLinePosition.Line + 1;

        StatementSyntax GuardStatement(int line) =>
            ParseStatement(GuardType + ".S(" + fileIndex + "," + line + ");");

        SyntaxList<StatementSyntax> InstrumentList(SyntaxList<StatementSyntax> statements)
        {
            if (!guards) return List(statements.Select(s => (StatementSyntax)Visit(s)));
            var result = new List<StatementSyntax>();
            foreach (var st in statements)
            {
                int line = LineOf(st);
                var visited = (StatementSyntax)Visit(st);
                if (st is LocalFunctionStatementSyntax)
                {
                    result.Add(visited);
                    continue;
                }
                result.Add(GuardStatement(line).WithLeadingTrivia(visited.GetLeadingTrivia()));
                result.Add(visited.WithLeadingTrivia(Space));
            }
            return List(result);
        }

        public override SyntaxNode VisitBlock(BlockSyntax node) =>
            node.WithStatements(InstrumentList(node.Statements));

        public override SyntaxNode VisitSwitchSection(SwitchSectionSyntax node) =>
            node.WithLabels(List(node.Labels.Select(l => (SwitchLabelSyntax)Visit(l)))).WithStatements(InstrumentList(node.Statements));

        public override SyntaxNode VisitCompilationUnit(CompilationUnitSyntax node)
        {
            var members = new List<MemberDeclarationSyntax>();
            foreach (var m in node.Members)
            {
                var visited = (MemberDeclarationSyntax)Visit(m);
                if (guards && m is GlobalStatementSyntax gs && gs.Statement is not LocalFunctionStatementSyntax)
                {
                    members.Add(GlobalStatement(GuardStatement(LineOf(m))).WithLeadingTrivia(visited.GetLeadingTrivia()));
                    members.Add(visited.WithLeadingTrivia(Space));
                }
                else members.Add(visited);
            }
            return node.WithUsings(List(node.Usings.Select(u => (UsingDirectiveSyntax)Visit(u))))
                       .WithMembers(List(members));
        }

        StatementSyntax WrapLoopBody(StatementSyntax original, StatementSyntax visited)
        {
            if (!guards) return visited;
            if (visited is BlockSyntax b)
                return b.WithStatements(b.Statements.Insert(0, GuardStatement(LineOf(original)).WithLeadingTrivia(Space)));
            return Block(GuardStatement(LineOf(original)), visited.WithLeadingTrivia(Space)).WithLeadingTrivia(Space);
        }

        public override SyntaxNode VisitWhileStatement(WhileStatementSyntax node)
        {
            var v = (WhileStatementSyntax)base.VisitWhileStatement(node);
            return v.WithStatement(WrapLoopBody(node.Statement, v.Statement));
        }

        public override SyntaxNode VisitDoStatement(DoStatementSyntax node)
        {
            var v = (DoStatementSyntax)base.VisitDoStatement(node);
            return v.WithStatement(WrapLoopBody(node.Statement, v.Statement));
        }

        public override SyntaxNode VisitForStatement(ForStatementSyntax node)
        {
            var v = (ForStatementSyntax)base.VisitForStatement(node);
            return v.WithStatement(WrapLoopBody(node.Statement, v.Statement));
        }

        public override SyntaxNode VisitForEachStatement(ForEachStatementSyntax node)
        {
            var v = (ForEachStatementSyntax)base.VisitForEachStatement(node);
            return v.WithStatement(WrapLoopBody(node.Statement, v.Statement));
        }

        public override SyntaxNode VisitForEachVariableStatement(ForEachVariableStatementSyntax node)
        {
            var v = (ForEachVariableStatementSyntax)base.VisitForEachVariableStatement(node);
            return v.WithStatement(WrapLoopBody(node.Statement, v.Statement));
        }

        // ---------------- ShowDialog → await ShowDialogAsync ----------------

        public override SyntaxNode VisitInvocationExpression(InvocationExpressionSyntax node)
        {
            bool isShowDialog = showDialogCalls.Contains(node.Span);
            var v = (InvocationExpressionSyntax)base.VisitInvocationExpression(node);
            if (!isShowDialog) return v;
            ExpressionSyntax newExpr = v.Expression switch
            {
                MemberAccessExpressionSyntax ma => ma.WithName(IdentifierName("ShowDialogAsync").WithTriviaFrom(ma.Name)),
                IdentifierNameSyntax id => IdentifierName("ShowDialogAsync").WithTriviaFrom(id),
                _ => null,
            };
            if (newExpr == null) return v;
            var call = v.WithExpression(newExpr).WithoutTrivia();
            return ParenthesizedExpression(AwaitExpression(Token(SyntaxKind.AwaitKeyword).WithTrailingTrivia(Space), call))
                .WithTriviaFrom(v);
        }

        bool NeedsAsync(SyntaxNode original, SyntaxTokenList modifiers) =>
            asyncFunctions.Contains(original.Span) && !modifiers.Any(SyntaxKind.AsyncKeyword);

        public override SyntaxNode VisitParenthesizedLambdaExpression(ParenthesizedLambdaExpressionSyntax node)
        {
            bool make = NeedsAsync(node, node.Modifiers);
            var v = (ParenthesizedLambdaExpressionSyntax)base.VisitParenthesizedLambdaExpression(node);
            return make ? v.WithModifiers(v.Modifiers.Add(Token(SyntaxKind.AsyncKeyword).WithTrailingTrivia(Space))) : v;
        }

        public override SyntaxNode VisitSimpleLambdaExpression(SimpleLambdaExpressionSyntax node)
        {
            bool make = NeedsAsync(node, node.Modifiers);
            var v = (SimpleLambdaExpressionSyntax)base.VisitSimpleLambdaExpression(node);
            return make ? v.WithModifiers(v.Modifiers.Add(Token(SyntaxKind.AsyncKeyword).WithTrailingTrivia(Space))) : v;
        }

        public override SyntaxNode VisitAnonymousMethodExpression(AnonymousMethodExpressionSyntax node)
        {
            bool make = NeedsAsync(node, node.Modifiers);
            var v = (AnonymousMethodExpressionSyntax)base.VisitAnonymousMethodExpression(node);
            return make ? v.WithModifiers(v.Modifiers.Add(Token(SyntaxKind.AsyncKeyword).WithTrailingTrivia(Space))) : v;
        }

        static SyntaxTokenList AddAsync(SyntaxTokenList modifiers, ref TypeSyntax returnType)
        {
            if (modifiers.Count > 0)
                return modifiers.Add(Token(SyntaxKind.AsyncKeyword).WithTrailingTrivia(Space));
            var token = Token(SyntaxKind.AsyncKeyword).WithLeadingTrivia(returnType.GetLeadingTrivia()).WithTrailingTrivia(Space);
            returnType = returnType.WithLeadingTrivia();
            return TokenList(token);
        }

        // ---------------- Metotlar: özyineleme koruması ----------------

        BlockSyntax WrapDepth(BlockSyntax body)
        {
            if (!guards || body == null) return body;
            var enter = ParseStatement(GuardType + ".Enter();");
            var exit = ParseStatement(GuardType + ".Exit();");
            var tryStmt = TryStatement(
                Token(SyntaxKind.TryKeyword).WithTrailingTrivia(Space),
                body.WithoutLeadingTrivia(),
                List<CatchClauseSyntax>(),
                FinallyClause(Token(SyntaxKind.FinallyKeyword).WithLeadingTrivia(Space).WithTrailingTrivia(Space), Block(exit)));
            return Block(enter.WithTrailingTrivia(Space), tryStmt).WithTriviaFrom(body);
        }

        BlockSyntax BlockFromArrow(ArrowExpressionClauseSyntax arrow, bool isVoid)
        {
            var expr = arrow.Expression.WithoutTrivia();
            StatementSyntax st;
            if (expr is ThrowExpressionSyntax th) st = ThrowStatement(th.Expression);
            else if (isVoid) st = ExpressionStatement(expr);
            else st = ReturnStatement(Token(SyntaxKind.ReturnKeyword).WithTrailingTrivia(Space), expr, Token(SyntaxKind.SemicolonToken));
            return Block(st).WithLeadingTrivia(Space);
        }

        static bool IsVoidLike(TypeSyntax returnType, SyntaxTokenList modifiers)
        {
            if (returnType is PredefinedTypeSyntax p && p.Keyword.IsKind(SyntaxKind.VoidKeyword)) return true;
            if (!modifiers.Any(SyntaxKind.AsyncKeyword)) return false;
            string t = returnType.ToString();
            return t is "Task" or "ValueTask" or "System.Threading.Tasks.Task" or "System.Threading.Tasks.ValueTask";
        }

        public override SyntaxNode VisitMethodDeclaration(MethodDeclarationSyntax node)
        {
            bool makeAsync = NeedsAsync(node, node.Modifiers);
            var v = (MethodDeclarationSyntax)base.VisitMethodDeclaration(node);
            if (makeAsync)
            {
                var rt = v.ReturnType;
                var mods = AddAsync(v.Modifiers, ref rt);
                v = v.WithModifiers(mods).WithReturnType(rt);
            }
            if (!guards) return v;
            if (v.ExpressionBody != null)
            {
                var body = BlockFromArrow(v.ExpressionBody, IsVoidLike(v.ReturnType, v.Modifiers));
                v = v.WithExpressionBody(null).WithSemicolonToken(default).WithBody(body);
            }
            return v.Body == null ? v : v.WithBody(WrapDepth(v.Body));
        }

        public override SyntaxNode VisitLocalFunctionStatement(LocalFunctionStatementSyntax node)
        {
            bool makeAsync = NeedsAsync(node, node.Modifiers);
            var v = (LocalFunctionStatementSyntax)base.VisitLocalFunctionStatement(node);
            if (makeAsync)
            {
                var rt = v.ReturnType;
                var mods = AddAsync(v.Modifiers, ref rt);
                v = v.WithModifiers(mods).WithReturnType(rt);
            }
            if (!guards) return v;
            if (v.ExpressionBody != null)
            {
                var body = BlockFromArrow(v.ExpressionBody, IsVoidLike(v.ReturnType, v.Modifiers));
                v = v.WithExpressionBody(null).WithSemicolonToken(default).WithBody(body);
            }
            return v.Body == null ? v : v.WithBody(WrapDepth(v.Body));
        }

        public override SyntaxNode VisitConstructorDeclaration(ConstructorDeclarationSyntax node)
        {
            var v = (ConstructorDeclarationSyntax)base.VisitConstructorDeclaration(node);
            if (!guards) return v;
            if (v.ExpressionBody != null)
                v = v.WithExpressionBody(null).WithSemicolonToken(default).WithBody(BlockFromArrow(v.ExpressionBody, true));
            return v.Body == null ? v : v.WithBody(WrapDepth(v.Body));
        }

        public override SyntaxNode VisitOperatorDeclaration(OperatorDeclarationSyntax node)
        {
            var v = (OperatorDeclarationSyntax)base.VisitOperatorDeclaration(node);
            if (!guards) return v;
            if (v.ExpressionBody != null)
                v = v.WithExpressionBody(null).WithSemicolonToken(default).WithBody(BlockFromArrow(v.ExpressionBody, false));
            return v.Body == null ? v : v.WithBody(WrapDepth(v.Body));
        }

        public override SyntaxNode VisitPropertyDeclaration(PropertyDeclarationSyntax node)
        {
            var v = (PropertyDeclarationSyntax)base.VisitPropertyDeclaration(node);
            if (!guards || v.ExpressionBody == null) return v;
            var getter = AccessorDeclaration(SyntaxKind.GetAccessorDeclaration, WrapDepth(BlockFromArrow(v.ExpressionBody, false)));
            return v.WithExpressionBody(null).WithSemicolonToken(default)
                    .WithAccessorList(AccessorList(SingletonList(getter)).WithLeadingTrivia(Space));
        }

        public override SyntaxNode VisitIndexerDeclaration(IndexerDeclarationSyntax node)
        {
            var v = (IndexerDeclarationSyntax)base.VisitIndexerDeclaration(node);
            if (!guards || v.ExpressionBody == null) return v;
            var getter = AccessorDeclaration(SyntaxKind.GetAccessorDeclaration, WrapDepth(BlockFromArrow(v.ExpressionBody, false)));
            return v.WithExpressionBody(null).WithSemicolonToken(default)
                    .WithAccessorList(AccessorList(SingletonList(getter)).WithLeadingTrivia(Space));
        }

        public override SyntaxNode VisitAccessorDeclaration(AccessorDeclarationSyntax node)
        {
            var v = (AccessorDeclarationSyntax)base.VisitAccessorDeclaration(node);
            if (!guards) return v;
            if (v.ExpressionBody != null)
            {
                bool isVoid = !v.IsKind(SyntaxKind.GetAccessorDeclaration);
                v = v.WithExpressionBody(null).WithSemicolonToken(default).WithBody(BlockFromArrow(v.ExpressionBody, isVoid));
            }
            return v.Body == null ? v : v.WithBody(WrapDepth(v.Body));
        }
    }
}
