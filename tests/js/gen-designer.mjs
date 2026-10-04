// Tüm kontrol türlerini içeren bir form için Designer.cs üretir (C# testleri derleyip çalıştırır).
// Kullanım: node tests/js/gen-designer.mjs > cikti.json
import { generateDesigner } from '../../web/assets/js/codegen.js';
import { CONTROLS } from '../../web/assets/js/catalog.js';
import { formCs, programCs } from '../../web/assets/js/templates.js';

const form = {
  name: 'Form1',
  props: {
    Text: 'Tüm "kontroller"', ClientSize: [640, 480], BackColor: 'LightYellow', ForeColor: '#102030', StartPosition: 'CenterScreen',
    FormBorderStyle: 'FixedSingle', MaximizeBox: false, Opacity: 95, KeyPreview: true, AcceptButton: 'button1', CancelButton: 'button1',
    Font: { name: 'Tahoma', size: 10.5, style: ['Bold', 'Italic'] },
  },
  events: { Load: 'Form1_Load', FormClosing: 'Form1_FormClosing' },
  controls: [],
  components: [{ type: 'Timer', name: 'timer1', props: { Interval: 250, TimerEnabled: true }, events: { Tick: 'timer1_Tick' } }],
};
let y = 0;
for (const [type, info] of Object.entries(CONTROLS)) {
  if (info.component) continue;
  const name = info.prefix + '1';
  const c = { type, name, props: { ...info.defaults(name), Location: [10, (y += 30)], Size: info.size, TabIndex: y }, events: { [info.defaultEvent]: `${name}_${info.defaultEvent}` } };
  if (info.container) c.controls = [];
  form.controls.push(c);
}
const find = (n) => form.controls.find((c) => c.name === n);
Object.assign(find('textBox1').props, { Multiline: true, PasswordChar: '*', ScrollBars: 'Vertical', HAlign: 'Center', Text: 'a\\b\n"c"', Anchor: 'Top, Left, Right', CharacterCasing: 'Upper', PlaceholderText: 'ipucu' });
Object.assign(find('label1').props, { TextAlign: 'MiddleCenter', BorderStyle: 'FixedSingle', Cursor: 'Hand', Dock: 'Bottom', Visible: false });
Object.assign(find('comboBox1').props, { Items: ['Bir', 'İki', 'Üç'], DropDownStyle: 'DropDownList', Sorted: true });
Object.assign(find('listBox1').props, { Items: ['x', 'y'], SelectionMode: 'MultiExtended' });
Object.assign(find('checkedListBox1').props, { Items: ['a'], CheckOnClick: true });
Object.assign(find('numericUpDown1').props, { Minimum: -10, Maximum: 1000, Value: 2.5, DecimalPlaces: 1, Increment: 0.5 });
Object.assign(find('progressBar1').props, { IntMaximum: 50, IntValue: 20, Step: 5, ProgressStyle: 'Continuous' });
Object.assign(find('trackBar1').props, { TrackMaximum: 20, TrackValue: 3, TickFrequency: 2, Orientation: 'Vertical' });
Object.assign(find('dateTimePicker1').props, { Format: 'Short' });
Object.assign(find('pictureBox1').props, { ImageLocation: 'https://example.com/a.png', SizeMode: 'Zoom', BorderStyle: 'Fixed3D' });
Object.assign(find('checkBox1').props, { Checked: true, BackColor: 'SystemColors.Control' });
Object.assign(find('button1').props, { FlatStyle: 'Flat', Enabled: false, Tag: 'etiket' });
// İç içe kontrol
find('panel1').controls.push({ type: 'RadioButton', name: 'radioButton2', props: { Text: 'iç', AutoSize: true, Location: [5, 5], Size: [40, 19], Checked: true, Anchor: 'Bottom, Right' }, events: { CheckedChanged: 'radioButton2_CheckedChanged' } });
find('groupBox1').controls.push({ type: 'Panel', name: 'panel2', props: { Location: [5, 20], Size: [50, 50], Dock: 'Fill' }, controls: [{ type: 'Button', name: 'button2', props: { Text: 'derin', Location: [1, 1], Size: [40, 20] }, events: { MouseMove: 'button2_MouseMove', KeyPress: 'button2_KeyPress' } }], events: {} });

const handlers = [];
const sig = { MouseMove: 'MouseEventArgs', KeyPress: 'KeyPressEventArgs', FormClosing: 'FormClosingEventArgs', LinkClicked: 'LinkLabelLinkClickedEventArgs', ItemCheck: 'ItemCheckEventArgs' };
const collect = (list) => {
  for (const c of list) {
    for (const [evt, h] of Object.entries(c.events || {})) handlers.push(`        private void ${h}(object sender, ${sig[evt] || 'EventArgs'} e) { Olaylar.Add("${h}"); }`);
    if (c.controls) collect(c.controls);
  }
};
collect(form.controls);
collect(form.components);
for (const [evt, h] of Object.entries(form.events)) handlers.push(`        private void ${h}(object sender, ${sig[evt] || 'EventArgs'} e) { Olaylar.Add("${h}"); }`);

const code = formCs('TumKontroller', 'Form1').replace('            InitializeComponent();\n        }\n',
  '            InitializeComponent();\n        }\n\n        public static List<string> Olaylar = new List<string>();\n\n' + handlers.join('\n') + '\n');
process.stdout.write(JSON.stringify({
  name: 'Tüm Kontroller', namespace: 'TumKontroller',
  files: [
    { name: 'Program.cs', content: programCs('TumKontroller') },
    { name: 'Form1.cs', content: code },
    { name: 'Form1.Designer.cs', content: generateDesigner('TumKontroller', form) },
  ],
}));
