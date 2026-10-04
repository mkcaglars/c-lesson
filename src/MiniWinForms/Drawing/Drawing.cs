using System.Globalization;

// System.Drawing.Primitives (Color, Point, Size, Rectangle, SystemColors) .NET'in kendisinden gelir.
// Burada yalnızca System.Drawing.Common'da bulunan ve WinForms derslerinde gereken türler var.
namespace System.Drawing
{
    [Flags]
    public enum FontStyle { Regular = 0, Bold = 1, Italic = 2, Underline = 4, Strikeout = 8 }

    public enum GraphicsUnit { World = 0, Display = 1, Pixel = 2, Point = 3, Inch = 4, Document = 5, Millimeter = 6 }

    public enum ContentAlignment
    {
        TopLeft = 1, TopCenter = 2, TopRight = 4,
        MiddleLeft = 16, MiddleCenter = 32, MiddleRight = 64,
        BottomLeft = 256, BottomCenter = 512, BottomRight = 1024,
    }

    public enum StringAlignment { Near = 0, Center = 1, Far = 2 }

    public sealed class FontFamily
    {
        public FontFamily(string name) { Name = name; }
        public string Name { get; }
        public static FontFamily GenericSansSerif => new FontFamily("Segoe UI");
        public static FontFamily GenericSerif => new FontFamily("Times New Roman");
        public static FontFamily GenericMonospace => new FontFamily("Courier New");
        public override string ToString() => "[FontFamily: Name=" + Name + "]";
    }

    public sealed class Font : IDisposable, ICloneable
    {
        public Font(string familyName, float emSize) : this(familyName, emSize, FontStyle.Regular, GraphicsUnit.Point) { }
        public Font(string familyName, float emSize, FontStyle style) : this(familyName, emSize, style, GraphicsUnit.Point) { }
        public Font(string familyName, float emSize, GraphicsUnit unit) : this(familyName, emSize, FontStyle.Regular, unit) { }
        public Font(string familyName, float emSize, FontStyle style, GraphicsUnit unit) : this(familyName, emSize, style, unit, 1) { }
        public Font(string familyName, float emSize, FontStyle style, GraphicsUnit unit, byte gdiCharSet) : this(familyName, emSize, style, unit, gdiCharSet, false) { }
        public Font(string familyName, float emSize, FontStyle style, GraphicsUnit unit, byte gdiCharSet, bool gdiVerticalFont)
        {
            if (emSize <= 0) throw new ArgumentException("Yazı tipi boyutu sıfırdan büyük olmalıdır.", nameof(emSize));
            Name = string.IsNullOrEmpty(familyName) ? "Segoe UI" : familyName;
            Size = emSize;
            Style = style;
            Unit = unit;
            GdiCharSet = gdiCharSet;
        }
        public Font(FontFamily family, float emSize) : this(family.Name, emSize) { }
        public Font(FontFamily family, float emSize, FontStyle style) : this(family.Name, emSize, style) { }
        public Font(FontFamily family, float emSize, FontStyle style, GraphicsUnit unit) : this(family.Name, emSize, style, unit) { }
        public Font(Font prototype, FontStyle newStyle) : this(prototype.Name, prototype.Size, newStyle, prototype.Unit, prototype.GdiCharSet) { }

        public string Name { get; }
        public FontFamily FontFamily => new FontFamily(Name);
        public float Size { get; }
        public FontStyle Style { get; }
        public GraphicsUnit Unit { get; }
        public byte GdiCharSet { get; }
        public bool GdiVerticalFont => false;
        public bool Bold => (Style & FontStyle.Bold) != 0;
        public bool Italic => (Style & FontStyle.Italic) != 0;
        public bool Underline => (Style & FontStyle.Underline) != 0;
        public bool Strikeout => (Style & FontStyle.Strikeout) != 0;
        public float SizeInPoints => Unit switch
        {
            GraphicsUnit.Pixel => Size * 72f / 96f,
            GraphicsUnit.Inch => Size * 72f,
            GraphicsUnit.Millimeter => Size * 72f / 25.4f,
            GraphicsUnit.Document => Size * 72f / 300f,
            _ => Size,
        };
        public int Height => (int)Math.Ceiling(SizeInPoints * 96f / 72f * 1.2f);
        public float GetHeight() => Height;

        /// <summary>CSS'e çevrilmiş hali: "aile|boyutPt|kalın|italik|altıçizili|üstüçizili"</summary>
        internal string Css => Name + "|" + SizeInPoints.ToString("0.##", CultureInfo.InvariantCulture) + "|" +
                               (Bold ? 1 : 0) + "|" + (Italic ? 1 : 0) + "|" + (Underline ? 1 : 0) + "|" + (Strikeout ? 1 : 0);

        public object Clone() => new Font(Name, Size, Style, Unit, GdiCharSet);
        public void Dispose() { }
        public override bool Equals(object obj) => obj is Font f && f.Name == Name && f.Size == Size && f.Style == Style && f.Unit == Unit;
        public override int GetHashCode() => HashCode.Combine(Name, Size, Style, Unit);
        public override string ToString() => "[Font: Name=" + Name + ", Size=" + Size.ToString(CultureInfo.InvariantCulture) + ", Units=" + (int)Unit + ", GdiCharSet=" + GdiCharSet + ", GdiVerticalFont=False]";
    }

    /// <summary>Resim. Web ortamında yalnızca adres (URL) ile yüklenebilir.</summary>
    public class Image : IDisposable, ICloneable
    {
        internal Image(string url, int width, int height)
        {
            Url = url;
            Width = width;
            Height = height;
        }

        internal string Url { get; }
        public int Width { get; }
        public int Height { get; }
        public Size Size => new Size(Width, Height);
        public object Tag { get; set; }

        public static Image FromFile(string filename)
        {
            if (filename != null && (filename.StartsWith("http://") || filename.StartsWith("https://") || filename.StartsWith("data:") || filename.StartsWith("/")))
                return new Bitmap(filename);
            throw new NotSupportedException("Web ortamında bilgisayardaki dosyalar okunamaz. Resim için internet adresi kullanın: pictureBox1.ImageLocation = \"https://...\";");
        }

        public object Clone() => new Image(Url, Width, Height);
        public void Dispose() { }
    }

    public class Bitmap : Image
    {
        public Bitmap(string filename) : base(filename, 0, 0) { }
        public Bitmap(int width, int height) : base("", width, height) { }
    }
}

namespace System.Drawing
{
    /// <summary>Çizim yüzeyi — bu sürümde desteklenmiyor, yalnızca derleme uyumluluğu için var.</summary>
    public sealed class Graphics : IDisposable
    {
        private Graphics() { }
        public void Dispose() { }
    }
}
