using System.ComponentModel;

namespace System.Windows.Forms
{
    /// <summary>Olay temsilcilerini DynamicInvoke kullanmadan çağırır (hatalar sarmalanmadan kullanıcıya ulaşsın diye).</summary>
    internal static class Ev
    {
        public static void Fire(Delegate d, object sender, EventArgs e)
        {
            switch (d)
            {
                case null: return;
                case EventHandler h: h(sender, e); return;
                case MouseEventHandler h: h(sender, (MouseEventArgs)e); return;
                case KeyEventHandler h: h(sender, (KeyEventArgs)e); return;
                case KeyPressEventHandler h: h(sender, (KeyPressEventArgs)e); return;
                case FormClosingEventHandler h: h(sender, (FormClosingEventArgs)e); return;
                case FormClosedEventHandler h: h(sender, (FormClosedEventArgs)e); return;
                case CancelEventHandler h: h(sender, (CancelEventArgs)e); return;
                case ControlEventHandler h: h(sender, (ControlEventArgs)e); return;
                case LayoutEventHandler h: h(sender, (LayoutEventArgs)e); return;
                case PaintEventHandler h: h(sender, (PaintEventArgs)e); return;
                case LinkLabelLinkClickedEventHandler h: h(sender, (LinkLabelLinkClickedEventArgs)e); return;
                case ItemCheckEventHandler h: h(sender, (ItemCheckEventArgs)e); return;
                default: d.DynamicInvoke(sender, e); return;
            }
        }
    }
}
