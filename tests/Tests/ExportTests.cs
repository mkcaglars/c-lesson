using System.IO.Compression;
using System.Xml.Linq;
using CLesson.Compiler;
using Xunit;

namespace Tests
{
    public class ExportTests
    {
        static Dictionary<string, string> Unzip(byte[] bytes)
        {
            using var zip = new ZipArchive(new MemoryStream(bytes));
            return zip.Entries.ToDictionary(e => e.FullName.Substring(e.FullName.IndexOf('/') + 1), e => new StreamReader(e.Open()).ReadToEnd());
        }

        static ProjectInput Project(string target)
        {
            var p = new ProjectInput { Name = "Kütüphane Projesi", Namespace = "KutuphaneProjesi", ExportTarget = target };
            p.Files.Add(new ProjectFile { Name = "Program.cs", Content = "namespace KutuphaneProjesi { static class Program { [System.STAThread] static void Main() { System.Windows.Forms.Application.Run(new Form1()); } } }" });
            p.Files.Add(new ProjectFile { Name = "Form1.cs", Content = "namespace KutuphaneProjesi { public partial class Form1 : Form { public Form1() { InitializeComponent(); } } }" });
            p.Files.Add(new ProjectFile { Name = "Form1.Designer.cs", Content = "namespace KutuphaneProjesi { partial class Form1 { void InitializeComponent() { } } }" });
            p.Files.Add(new ProjectFile { Name = "VeriTabaniIslemleri.cs", Content = "namespace KutuphaneProjesi { class VeriTabaniIslemleri { } }" });
            p.Files.Add(new ProjectFile { Name = "SirketModel.edmx", Content = "<?xml version=\"1.0\"?><edmx:Edmx Version=\"3.0\" xmlns:edmx=\"http://schemas.microsoft.com/ado/2009/11/edmx\" />" });
            p.Files.Add(new ProjectFile { Name = "App.config", Content = "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\n<configuration>\n  <connectionStrings>\n    <add name=\"baglanti\" connectionString=\"Server=localhost;Database=kutuphane;Uid=root;Pwd=1234;\" />\n  </connectionStrings>\n</configuration>\n" });
            p.References.AddRange(new[] { "MySql.Data", "EntityFramework" });
            return p;
        }

        [Fact]
        public void Net48ProjectHasClassicLayout()
        {
            var files = Unzip(CodeTools.ExportZip(Project("net48")));
            Assert.Contains("KutuphaneProjesi.sln", files.Keys);
            Assert.Contains("Properties/AssemblyInfo.cs", files.Keys);
            Assert.Contains("GlobalUsings.cs", files.Keys);
            var csproj = XDocument.Parse(files["KutuphaneProjesi.csproj"]);
            XNamespace ms = "http://schemas.microsoft.com/developer/msbuild/2003";
            Assert.Equal("v4.8", csproj.Descendants(ms + "TargetFrameworkVersion").Single().Value);
            var compiles = csproj.Descendants(ms + "Compile").Select(e => e.Attribute("Include").Value).ToList();
            Assert.Contains("Form1.cs", compiles);
            Assert.Contains("VeriTabaniIslemleri.cs", compiles);
            Assert.Equal("Form", csproj.Descendants(ms + "Compile").Single(e => e.Attribute("Include").Value == "Form1.cs").Element(ms + "SubType").Value);
            Assert.Equal("Form1.cs", csproj.Descendants(ms + "Compile").Single(e => e.Attribute("Include").Value == "Form1.Designer.cs").Element(ms + "DependentUpon").Value);
            var packages = csproj.Descendants(ms + "PackageReference").Select(e => e.Attribute("Include").Value).ToList();
            Assert.Equal(new[] { "MySql.Data", "EntityFramework", "MySql.Data.EntityFramework" }, packages);
            Assert.Single(csproj.Descendants(ms + "EntityDeploy"));
            Assert.Contains(csproj.Descendants(ms + "Reference"), e => e.Attribute("Include").Value == "System.Configuration");
            var config = XDocument.Parse(files["App.config"]);
            Assert.Equal(".NETFramework,Version=v4.8", config.Descendants("supportedRuntime").Single().Attribute("sku").Value);
            Assert.NotNull(config.Descendants("connectionStrings").SingleOrDefault());
            Assert.Contains("SirketModel.edmx", files.Keys);
        }

        [Fact]
        public void Net8IsStillTheDefault()
        {
            var files = Unzip(CodeTools.ExportZip(Project("net8")));
            Assert.Contains("net8.0-windows", files["KutuphaneProjesi.csproj"]);
            Assert.Contains("KutuphaneProjesi.slnx", files.Keys);
        }
    }
}
