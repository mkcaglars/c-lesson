using System.Reflection;
using System.Text;
using MiniWinForms;

namespace CLesson.Compiler
{
    /// <summary>Derlenmiş öğrenci programını yükler ve Main metodunu çalıştırır.</summary>
    public static class ProgramRunner
    {
        static bool consoleHooked;

        public static void Run(byte[] assembly, byte[] pdb)
        {
            Ui.Reset();
            HookConsole();
            var asm = pdb != null ? Assembly.Load(assembly, pdb) : Assembly.Load(assembly);
            var entry = asm.EntryPoint ?? throw new InvalidOperationException("Programda Main metodu bulunamadı.");
            Ui.Execute(() =>
            {
                object[] args = entry.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() };
                var result = entry.Invoke(null, args);
                if (result is Task t && t.IsFaulted) throw t.Exception.InnerException ?? t.Exception;
            });
            if (!Ui.Running)
            {
                // Hiç form açılmadıysa (konsol programı) program bitmiştir.
                Console.Out.Flush();
                Ui.Backend.ProgramEnded("Program tamamlandı.");
            }
        }

        public static void Stop()
        {
            Ui.Reset();
        }

        static void HookConsole()
        {
            if (consoleHooked) return;
            consoleHooked = true;
            Console.SetOut(new BackendWriter());
            Console.SetError(new BackendWriter());
        }

        sealed class BackendWriter : TextWriter
        {
            readonly StringBuilder buffer = new();
            public override Encoding Encoding => Encoding.UTF8;

            public override void Write(char value)
            {
                buffer.Append(value);
                if (value == '\n') Flush();
            }

            public override void Write(string value)
            {
                buffer.Append(value);
                Flush();
            }

            public override void Write(char[] chars, int index, int count)
            {
                buffer.Append(chars, index, count);
                Flush();
            }

            public override void Flush()
            {
                if (buffer.Length == 0) return;
                var s = buffer.ToString();
                buffer.Clear();
                Ui.Backend.Output(s);
            }
        }
    }
}
