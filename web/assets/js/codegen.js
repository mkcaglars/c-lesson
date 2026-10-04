// Form tasarımından Visual Studio ile aynı biçimde Form1.Designer.cs kodu üretir.
import { PROPS, CONTROLS, FORM_INFO, COLOR_NAMES, SYSTEM_COLORS, propDefault, codeName, eventTypes } from './catalog.js';

const NEEDS_INIT = new Set(['NumericUpDown', 'TrackBar', 'PictureBox', 'DataGridView']);

export function csString(s) {
  return '"' + String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t') + '"';
}

function csChar(c) {
  if (c === "'") return "'\\''";
  if (c === '\\') return "'\\\\'";
  return `'${c}'`;
}

function csFloat(n) {
  const s = String(Number(n));
  return (s.includes('.') ? s : s) + 'F';
}

/** decimal değeri VS'nin ürettiği "new decimal(new int[] {...})" biçiminde yazar. */
function csDecimal(v) {
  const n = Number(v) || 0;
  const neg = n < 0;
  const abs = Math.abs(n);
  const str = String(abs);
  const scale = str.includes('.') ? str.length - str.indexOf('.') - 1 : 0;
  const mant = Math.round(abs * Math.pow(10, scale));
  let flags = scale << 16;
  if (neg) flags = flags - 2147483648;
  return `new decimal(new int[] {\n            ${mant},\n            0,\n            0,\n            ${flags}})`;
}

export function csColor(v) {
  if (!v) return null;
  if (v.startsWith('SystemColors.')) return 'System.Drawing.' + v;
  if (v.startsWith('#')) {
    const r = parseInt(v.substring(1, 3), 16);
    const g = parseInt(v.substring(3, 5), 16);
    const b = parseInt(v.substring(5, 7), 16);
    return `System.Drawing.Color.FromArgb(((int)(((byte)(${r})))), ((int)(((byte)(${g})))), ((int)(((byte)(${b})))))`;
  }
  if (COLOR_NAMES.includes(v)) return 'System.Drawing.Color.' + v;
  return 'System.Drawing.Color.' + v;
}

function csFont(f) {
  const styles = (f.style || []).filter(Boolean);
  let style;
  if (styles.length === 0) style = 'System.Drawing.FontStyle.Regular';
  else if (styles.length === 1) style = 'System.Drawing.FontStyle.' + styles[0];
  else style = '((System.Drawing.FontStyle)((' + styles.map((s) => 'System.Drawing.FontStyle.' + s).join(' | ') + ')))';
  return `new System.Drawing.Font(${csString(f.name)}, ${csFloat(f.size)}, ${style}, System.Drawing.GraphicsUnit.Point, ((byte)(162)))`;
}

function csAnchor(v) {
  const parts = String(v).split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return 'System.Windows.Forms.AnchorStyles.None';
  if (parts.length === 1) return 'System.Windows.Forms.AnchorStyles.' + parts[0];
  return '((System.Windows.Forms.AnchorStyles)((' + parts.map((p) => 'System.Windows.Forms.AnchorStyles.' + p).join(' | ') + ')))';
}

/** Model değerini C# ifadesine çevirir; varsayılan değerse null döner. */
function valueExpr(prop, value, type) {
  const def = PROPS[prop];
  if (!def) return null;
  const d = propDefault(type, prop);
  switch (def.type) {
    case 'name':
      return null;
    case 'text':
    case 'string':
      if ((value ?? '') === (d ?? '') && prop !== 'Text') return null;
      return csString(value);
    case 'bool':
      if (value === d) return null;
      return value ? 'true' : 'false';
    case 'int':
      if (value == null || value === '' || Number(value) === d) return null;
      return String(parseInt(value, 10));
    case 'decimal':
      if (value == null || Number(value) === d) return null;
      return csDecimal(value);
    case 'percent':
      if (value == null || Number(value) === d) return null;
      return (Number(value) / 100) + 'D';
    case 'enum':
      if (!value || value === d) return null;
      return def.enumType + '.' + value;
    case 'cursor':
      if (!value || value === d) return null;
      return 'System.Windows.Forms.Cursors.' + value;
    case 'color':
      return value ? csColor(value) : null;
    case 'font':
      return value ? csFont(value) : null;
    case 'point':
      return value ? `new System.Drawing.Point(${value[0]}, ${value[1]})` : null;
    case 'size':
      return value ? `new System.Drawing.Size(${value[0]}, ${value[1]})` : null;
    case 'anchor':
      if (!value || value.replace(/\s/g, '') === 'Top,Left') return null;
      return csAnchor(value);
    case 'char':
      return value ? csChar(value[0]) : null;
    case 'controlref':
      return value ? 'this.' + value : null;
    default:
      return null;
  }
}

/** Kontrolün kodda yazılacak satırları (özellik adına göre sıralı). */
function propertyLines(target, type, props, isForm, children) {
  const entries = [];
  const order = isForm ? FORM_INFO.props : (CONTROLS[type]?.props || []);
  const extra = Object.keys(props).filter((k) => !order.includes(k) && k !== 'FormattingEnabled');
  for (const prop of [...order, ...extra]) {
    if (!(prop in props)) continue;
    if (prop === 'Name') continue;
    if (prop === 'Columns') {
      const cols = props.Columns || [];
      if (cols.length) {
        entries.push(['Columns', `${target}.Columns.AddRange(new System.Windows.Forms.DataGridViewColumn[] {\n${cols.map((c) => '            this.' + c.name).join(',\n')}});`]);
      }
      continue;
    }
    if (prop === 'Items') {
      const items = props.Items || [];
      if (items.length) {
        entries.push(['Items', `${target}.Items.AddRange(new object[] {\n${items.map((i) => '            ' + csString(i)).join(',\n')}});`]);
      }
      continue;
    }
    const expr = valueExpr(prop, props[prop], type);
    if (expr == null) continue;
    entries.push([codeName(prop), `${target}.${codeName(prop)} = ${expr};`]);
  }
  if (props.FormattingEnabled) entries.push(['FormattingEnabled', `${target}.FormattingEnabled = true;`]);
  if (isForm) {
    entries.push(['AutoScaleDimensions', `${target}.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);`]);
    entries.push(['AutoScaleMode', `${target}.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;`]);
  }
  if (children.length) {
    entries.push(['Controls', children.map((c) => `${target}.Controls.Add(this.${c.name});`).join('\n')]);
  }
  entries.push(['Name', `${target}.Name = ${csString(props.Name)};`]);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map((e) => e[1]);
}

/** DataGridView sütununun satırları (VS ile aynı sırada). */
function columnLines(col) {
  const t = `this.${col.name}`;
  const p = col.props || {};
  const lines = [];
  if (p.AutoSizeMode && p.AutoSizeMode !== 'NotSet') lines.push(['AutoSizeMode', `${t}.AutoSizeMode = System.Windows.Forms.DataGridViewAutoSizeColumnMode.${p.AutoSizeMode};`]);
  if (p.DataPropertyName) lines.push(['DataPropertyName', `${t}.DataPropertyName = ${csString(p.DataPropertyName)};`]);
  if (p.FillWeight && Number(p.FillWeight) !== 100) lines.push(['FillWeight', `${t}.FillWeight = ${csFloat(p.FillWeight)};`]);
  lines.push(['HeaderText', `${t}.HeaderText = ${csString(p.HeaderText ?? col.name)};`]);
  if (p.Items?.length) lines.push(['Items', `${t}.Items.AddRange(new object[] {\n${p.Items.map((i) => '            ' + csString(i)).join(',\n')}});`]);
  lines.push(['MinimumWidth', `${t}.MinimumWidth = 6;`]);
  lines.push(['Name', `${t}.Name = ${csString(col.name)};`]);
  if (p.ReadOnly) lines.push(['ReadOnly', `${t}.ReadOnly = true;`]);
  if (p.Text) lines.push(['Text', `${t}.Text = ${csString(p.Text)};`]);
  if (p.UseColumnTextForButtonValue) lines.push(['UseColumnTextForButtonValue', `${t}.UseColumnTextForButtonValue = true;`]);
  if (p.Visible === false) lines.push(['Visible', `${t}.Visible = false;`]);
  lines.push(['Width', `${t}.Width = ${Number(p.Width) || 125};`]);
  lines.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return lines.map((l) => l[1]);
}

function columnsOf(control) {
  return control.type === 'DataGridView' ? (control.props?.Columns || []) : [];
}

function eventLines(target, events) {
  const lines = [];
  for (const [evt, handler] of Object.entries(events || {})) {
    if (!handler) continue;
    const [delegate] = eventTypes(evt);
    lines.push(`${target}.${evt} += new ${delegate}(this.${handler});`);
  }
  return lines;
}

/** Ağaçtaki tüm kontrolleri ebeveyn önce gelecek sırada döndürür. */
export function flatten(controls, parent = null, out = []) {
  for (const c of controls || []) {
    out.push({ control: c, parent });
    if (c.controls?.length) flatten(c.controls, c, out);
  }
  return out;
}

function indentBlock(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((l) => (l ? pad + l : l)).join('\n');
}

/**
 * Form tasarımından Designer.cs üretir.
 * @param {string} ns  Ad alanı
 * @param {object} form  Tasarım modeli { name, props, events, controls, components }
 */
export function generateDesigner(ns, form) {
  const all = flatten(form.controls);
  const components = form.components || [];
  const hasComponents = components.length > 0;
  const body = [];

  if (hasComponents) body.push('this.components = new System.ComponentModel.Container();');
  for (const { control } of all) body.push(`this.${control.name} = new System.Windows.Forms.${control.type}();`);
  for (const { control } of all) for (const col of columnsOf(control)) body.push(`this.${col.name} = new System.Windows.Forms.${col.type || 'DataGridViewTextBoxColumn'}();`);
  for (const c of components) body.push(`this.${c.name} = new System.Windows.Forms.${c.type}(this.components);`);

  const containers = all.filter(({ control }) => control.controls?.length);
  for (const { control } of containers) body.push(`this.${control.name}.SuspendLayout();`);
  for (const { control } of all) {
    if (NEEDS_INIT.has(control.type)) body.push(`((System.ComponentModel.ISupportInitialize)(this.${control.name})).BeginInit();`);
  }
  body.push('this.SuspendLayout();');

  for (const { control } of all) {
    const t = `this.${control.name}`;
    body.push('// ');
    body.push(`// ${control.name}`);
    body.push('// ');
    const props = { ...control.props, Name: control.name };
    body.push(...propertyLines(t, control.type, props, false, control.controls || []));
    body.push(...eventLines(t, control.events));
    for (const col of columnsOf(control)) {
      body.push('// ');
      body.push(`// ${col.name}`);
      body.push('// ');
      body.push(...columnLines(col));
    }
  }

  for (const c of components) {
    body.push('// ');
    body.push(`// ${c.name}`);
    body.push('// ');
    const props = { ...c.props, Name: c.name };
    const lines = propertyLines(`this.${c.name}`, c.type, props, false, []).filter((l) => !l.includes('.Name = '));
    body.push(...lines);
    body.push(...eventLines(`this.${c.name}`, c.events));
  }

  body.push('// ');
  body.push(`// ${form.name}`);
  body.push('// ');
  const formProps = { ...form.props, Name: form.name };
  body.push(...propertyLines('this', 'Form', formProps, true, form.controls || []));
  body.push(...eventLines('this', form.events));

  for (const { control } of [...all].reverse()) {
    if (NEEDS_INIT.has(control.type)) body.push(`((System.ComponentModel.ISupportInitialize)(this.${control.name})).EndInit();`);
  }
  for (const { control } of [...containers].reverse()) {
    body.push(`this.${control.name}.ResumeLayout(false);`);
    body.push(`this.${control.name}.PerformLayout();`);
  }
  body.push('this.ResumeLayout(false);');
  body.push('this.PerformLayout();');

  const fields = [
    ...all.map(({ control }) => `private System.Windows.Forms.${control.type} ${control.name};`),
    ...all.flatMap(({ control }) => columnsOf(control).map((col) => `private System.Windows.Forms.${col.type || 'DataGridViewTextBoxColumn'} ${col.name};`)),
    ...components.map((c) => `private System.Windows.Forms.${c.type} ${c.name};`),
  ];

  return `namespace ${ns}
{
    partial class ${form.name}
    {
        /// <summary>
        /// Gerekli tasarımcı değişkeni.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Kullanılan tüm kaynakları temizler.
        /// </summary>
        /// <param name="disposing">Yönetilen kaynaklar silinmeliyse true; aksi halde false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Tasarımcı desteği için gerekli metot - bu metodun içeriğini
        /// kod düzenleyici ile değiştirmeyin. Form tasarımcısını kullanın.
        /// </summary>
        private void InitializeComponent()
        {
${indentBlock(body.join('\n'), 12)}
        }

        #endregion
${fields.length ? '\n' + indentBlock(fields.join('\n'), 8) + '\n' : ''}    }
}
`;
}
