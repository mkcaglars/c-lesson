// Araç kutusundaki kontroller, özellikleri ve olayları.

export const COLOR_NAMES = [
  'Transparent', 'Black', 'White', 'Red', 'Green', 'Blue', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Gray',
  'DarkGray', 'LightGray', 'Silver', 'Navy', 'Teal', 'Maroon', 'Olive', 'Lime', 'Aqua', 'Fuchsia', 'Gold', 'Coral',
  'Crimson', 'DarkBlue', 'DarkGreen', 'DarkRed', 'DodgerBlue', 'ForestGreen', 'Indigo', 'Khaki', 'LightBlue',
  'LightGreen', 'LightYellow', 'MediumSeaGreen', 'MidnightBlue', 'Orchid', 'RoyalBlue', 'Salmon', 'SeaGreen',
  'SkyBlue', 'SteelBlue', 'Tomato', 'Turquoise', 'Violet', 'Wheat', 'WhiteSmoke', 'Beige', 'Lavender', 'MintCream',
];

export const SYSTEM_COLORS = {
  Control: '#f0f0f0', ControlText: '#000000', ControlDark: '#a0a0a0', ControlLight: '#e3e3e3', ControlLightLight: '#ffffff',
  ControlDarkDark: '#696969', Window: '#ffffff', WindowText: '#000000', Highlight: '#0078d7', HighlightText: '#ffffff',
  ActiveCaption: '#99b4d1', InactiveCaption: '#bfcddb', GrayText: '#6d6d6d', ButtonFace: '#f0f0f0', ButtonHighlight: '#ffffff',
  ButtonShadow: '#a0a0a0', Info: '#ffffe1', InfoText: '#000000', MenuBar: '#f0f0f0', Menu: '#f0f0f0', MenuText: '#000000',
  HotTrack: '#0066cc', AppWorkspace: '#ababab', Desktop: '#000000',
};

const CSS_NAMED = {
  Transparent: 'transparent', DarkGray: '#a9a9a9', Gray: '#808080', Green: '#008000', Purple: '#800080', Maroon: '#800000',
  Olive: '#808000', Teal: '#008080', Navy: '#000080', Silver: '#c0c0c0', Lime: '#00ff00', Aqua: '#00ffff', Fuchsia: '#ff00ff',
};

/** Model renk değeri ("Red", "SystemColors.Control", "#RRGGBB") → CSS. */
export function colorToCss(v) {
  if (!v) return '';
  if (v.startsWith('#')) return v;
  if (v.startsWith('SystemColors.')) return SYSTEM_COLORS[v.substring(13)] || '';
  return CSS_NAMED[v] || v.toLowerCase();
}

export const DEFAULT_FONT = { name: 'Segoe UI', size: 9, style: [] };

export function fontToCss(f) {
  if (!f) return '';
  const st = f.style || [];
  return [f.name, f.size, st.includes('Bold') ? 1 : 0, st.includes('Italic') ? 1 : 0, st.includes('Underline') ? 1 : 0, st.includes('Strikeout') ? 1 : 0].join('|');
}

const CONTENT_ALIGN = ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'];
const BORDER = ['None', 'FixedSingle', 'Fixed3D'];
const CURSORS = ['Default', 'Hand', 'IBeam', 'WaitCursor', 'Cross', 'Help', 'No', 'SizeAll'];

/**
 * Özellik tanımları. type: string|text|bool|int|decimal|enum|color|font|point|size|anchor|items|char|controlref|cursor
 * cat: Özellikler penceresindeki kategori. def: varsayılan (bu değerde koda yazılmaz).
 */
export const PROPS = {
  Name: { type: 'name', cat: 'Tasarım', desc: 'Kodda bu kontrole erişmek için kullanılan ad.' },
  Text: { type: 'text', cat: 'Görünüm', def: '', desc: 'Kontrolde görünen metin.' },
  Location: { type: 'point', cat: 'Düzen', desc: 'Kontrolün sol üst köşesinin konumu (x; y).' },
  Size: { type: 'size', cat: 'Düzen', desc: 'Kontrolün genişliği ve yüksekliği.' },
  ClientSize: { type: 'size', cat: 'Düzen', desc: 'Formun iç alanının boyutu.' },
  BackColor: { type: 'color', cat: 'Görünüm', def: '', desc: 'Arka plan rengi.' },
  ForeColor: { type: 'color', cat: 'Görünüm', def: '', desc: 'Yazı rengi.' },
  Font: { type: 'font', cat: 'Görünüm', def: null, desc: 'Yazı tipi.' },
  Enabled: { type: 'bool', cat: 'Davranış', def: true, desc: 'Kontrol kullanılabilir mi?' },
  Visible: { type: 'bool', cat: 'Davranış', def: true, desc: 'Program çalışırken kontrol görünsün mü?' },
  TabIndex: { type: 'int', cat: 'Davranış', def: null, desc: 'Tab tuşuyla geçiş sırası.' },
  TabStop: { type: 'bool', cat: 'Davranış', def: true },
  Tag: { type: 'string', cat: 'Veri', def: '', desc: 'Kontrolle ilgili ek bilgi saklamak için.' },
  Anchor: { type: 'anchor', cat: 'Düzen', def: 'Top, Left', desc: 'Form boyutu değişince kontrolün hangi kenarlara bağlı kalacağı.' },
  Dock: { type: 'enum', cat: 'Düzen', values: ['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill'], def: 'None', enumType: 'System.Windows.Forms.DockStyle', desc: 'Kontrolü kapsayıcının bir kenarına yapıştırır.' },
  AutoSize: { type: 'bool', cat: 'Düzen', def: false, desc: 'Boyut içeriğe göre otomatik ayarlansın mı?' },
  Cursor: { type: 'cursor', cat: 'Görünüm', values: CURSORS, def: 'Default', desc: 'Fare imleci kontrolün üzerindeyken görünecek imleç.' },
  TextAlign: { type: 'enum', cat: 'Görünüm', values: CONTENT_ALIGN, def: 'TopLeft', enumType: 'System.Drawing.ContentAlignment', desc: 'Metnin hizalanması.' },
  BorderStyle: { type: 'enum', cat: 'Görünüm', values: BORDER, def: 'None', enumType: 'System.Windows.Forms.BorderStyle', desc: 'Kenarlık türü.' },
  FlatStyle: { type: 'enum', cat: 'Görünüm', values: ['Flat', 'Popup', 'Standard', 'System'], def: 'Standard', enumType: 'System.Windows.Forms.FlatStyle' },
  UseVisualStyleBackColor: { type: 'bool', cat: 'Görünüm', def: false },
  // Metin kutuları
  Multiline: { type: 'bool', cat: 'Davranış', def: false, desc: 'Birden çok satır yazılabilsin mi?' },
  ReadOnly: { type: 'bool', cat: 'Davranış', def: false, desc: 'Yalnızca okunur mu?' },
  PasswordChar: { type: 'char', cat: 'Davranış', def: '', desc: 'Şifre girişi için gösterilecek karakter (ör. *).' },
  UseSystemPasswordChar: { type: 'bool', cat: 'Davranış', def: false },
  MaxLength: { type: 'int', cat: 'Davranış', def: 32767, desc: 'En fazla karakter sayısı.' },
  ScrollBars: { type: 'enum', cat: 'Görünüm', values: ['None', 'Horizontal', 'Vertical', 'Both'], def: 'None', enumType: 'System.Windows.Forms.ScrollBars' },
  WordWrap: { type: 'bool', cat: 'Davranış', def: true },
  PlaceholderText: { type: 'string', cat: 'Görünüm', def: '', desc: 'Kutu boşken gösterilen silik ipucu metni.' },
  CharacterCasing: { type: 'enum', cat: 'Davranış', values: ['Normal', 'Upper', 'Lower'], def: 'Normal', enumType: 'System.Windows.Forms.CharacterCasing' },
  HAlign: { type: 'enum', cat: 'Görünüm', values: ['Left', 'Right', 'Center'], def: 'Left', enumType: 'System.Windows.Forms.HorizontalAlignment', code: 'TextAlign', desc: 'Metnin hizalanması.' },
  // Seçim kontrolleri
  Checked: { type: 'bool', cat: 'Görünüm', def: false, desc: 'İşaretli mi?' },
  Items: { type: 'items', cat: 'Veri', def: [], desc: 'Listedeki öğeler (her satıra bir öğe).' },
  DropDownStyle: { type: 'enum', cat: 'Görünüm', values: ['Simple', 'DropDown', 'DropDownList'], def: 'DropDown', enumType: 'System.Windows.Forms.ComboBoxStyle', desc: 'DropDownList: yalnızca listeden seçilebilir.' },
  SelectionMode: { type: 'enum', cat: 'Davranış', values: ['None', 'One', 'MultiSimple', 'MultiExtended'], def: 'One', enumType: 'System.Windows.Forms.SelectionMode' },
  Sorted: { type: 'bool', cat: 'Davranış', def: false, desc: 'Öğeler alfabetik sıralansın mı?' },
  CheckOnClick: { type: 'bool', cat: 'Davranış', def: false },
  // Sayısal
  Minimum: { type: 'decimal', cat: 'Veri', def: 0 },
  Maximum: { type: 'decimal', cat: 'Veri', def: 100 },
  Value: { type: 'decimal', cat: 'Veri', def: 0 },
  Increment: { type: 'decimal', cat: 'Veri', def: 1 },
  DecimalPlaces: { type: 'int', cat: 'Veri', def: 0 },
  IntMinimum: { type: 'int', cat: 'Davranış', def: 0, code: 'Minimum' },
  IntMaximum: { type: 'int', cat: 'Davranış', def: 100, code: 'Maximum' },
  IntValue: { type: 'int', cat: 'Davranış', def: 0, code: 'Value' },
  Step: { type: 'int', cat: 'Davranış', def: 10 },
  TickFrequency: { type: 'int', cat: 'Görünüm', def: 1 },
  Orientation: { type: 'enum', cat: 'Görünüm', values: ['Horizontal', 'Vertical'], def: 'Horizontal', enumType: 'System.Windows.Forms.Orientation' },
  ProgressStyle: { type: 'enum', cat: 'Davranış', values: ['Blocks', 'Continuous', 'Marquee'], def: 'Blocks', enumType: 'System.Windows.Forms.ProgressBarStyle', code: 'Style' },
  Format: { type: 'enum', cat: 'Görünüm', values: ['Long', 'Short', 'Time', 'Custom'], def: 'Long', enumType: 'System.Windows.Forms.DateTimePickerFormat' },
  // Resim
  ImageLocation: { type: 'string', cat: 'Görünüm', def: '', desc: 'Resmin internet adresi (https://...).' },
  SizeMode: { type: 'enum', cat: 'Davranış', values: ['Normal', 'StretchImage', 'AutoSize', 'CenterImage', 'Zoom'], def: 'Normal', enumType: 'System.Windows.Forms.PictureBoxSizeMode' },
  // Zamanlayıcı
  Interval: { type: 'int', cat: 'Davranış', def: 100, desc: 'Tick olayının kaç milisaniyede bir çalışacağı.' },
  TimerEnabled: { type: 'bool', cat: 'Davranış', def: false, code: 'Enabled', desc: 'Program başlarken zamanlayıcı çalışsın mı?' },
  // Form
  StartPosition: { type: 'enum', cat: 'Düzen', values: ['Manual', 'CenterScreen', 'WindowsDefaultLocation', 'WindowsDefaultBounds', 'CenterParent'], def: 'WindowsDefaultLocation', enumType: 'System.Windows.Forms.FormStartPosition', desc: 'Form açıldığında nerede görünsün?' },
  FormBorderStyle: { type: 'enum', cat: 'Görünüm', values: ['None', 'FixedSingle', 'Fixed3D', 'FixedDialog', 'Sizable', 'FixedToolWindow', 'SizableToolWindow'], def: 'Sizable', enumType: 'System.Windows.Forms.FormBorderStyle', desc: 'Pencere kenarlığı (Sizable: boyutlandırılabilir).' },
  MaximizeBox: { type: 'bool', cat: 'Pencere', def: true },
  MinimizeBox: { type: 'bool', cat: 'Pencere', def: true },
  ControlBox: { type: 'bool', cat: 'Pencere', def: true },
  ShowInTaskbar: { type: 'bool', cat: 'Pencere', def: true },
  TopMost: { type: 'bool', cat: 'Pencere', def: false },
  KeyPreview: { type: 'bool', cat: 'Davranış', def: false, desc: 'Tuş olaylarını önce form alsın mı?' },
  WindowState: { type: 'enum', cat: 'Pencere', values: ['Normal', 'Minimized', 'Maximized'], def: 'Normal', enumType: 'System.Windows.Forms.FormWindowState' },
  Opacity: { type: 'percent', cat: 'Pencere', def: 100 },
  // DataGridView
  Columns: { type: 'columns', cat: 'Veri', def: [], desc: 'Tablonun sütunları (Name, HeaderText, tür, genişlik).' },
  AllowUserToAddRows: { type: 'bool', cat: 'Davranış', def: true, desc: 'En altta yeni kayıt satırı gösterilsin mi?' },
  AllowUserToDeleteRows: { type: 'bool', cat: 'Davranış', def: true, desc: 'Kullanıcı Delete tuşuyla satır silebilsin mi?' },
  MultiSelect: { type: 'bool', cat: 'Davranış', def: true, desc: 'Birden fazla satır/hücre seçilebilsin mi?' },
  GridSelectionMode: { type: 'enum', cat: 'Davranış', values: ['CellSelect', 'FullRowSelect', 'FullColumnSelect', 'RowHeaderSelect', 'ColumnHeaderSelect'], def: 'RowHeaderSelect', enumType: 'System.Windows.Forms.DataGridViewSelectionMode', code: 'SelectionMode', desc: 'FullRowSelect: tıklanınca tüm satır seçilir.' },
  AutoSizeColumnsMode: { type: 'enum', cat: 'Düzen', values: ['None', 'ColumnHeader', 'AllCellsExceptHeader', 'AllCells', 'DisplayedCellsExceptHeader', 'DisplayedCells', 'Fill'], def: 'None', enumType: 'System.Windows.Forms.DataGridViewAutoSizeColumnsMode', desc: 'Fill: sütunlar tablonun genişliğini doldurur.' },
  ColumnHeadersHeightSizeMode: { type: 'enum', cat: 'Düzen', values: ['EnableResizing', 'DisableResizing', 'AutoSize'], def: 'EnableResizing', enumType: 'System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode' },
  RowHeadersVisible: { type: 'bool', cat: 'Görünüm', def: true, desc: 'Soldaki satır başlıkları görünsün mü?' },
  ColumnHeadersVisible: { type: 'bool', cat: 'Görünüm', def: true },
  RowHeadersWidth: { type: 'int', cat: 'Düzen', def: 41 },
  BackgroundColor: { type: 'color', cat: 'Görünüm', def: '', desc: 'Satırların dışında kalan alanın rengi.' },
  GridColor: { type: 'color', cat: 'Görünüm', def: '', desc: 'Hücre çizgilerinin rengi.' },
  AcceptButton: { type: 'controlref', cat: 'Davranış', def: '', refType: 'Button', desc: 'Enter tuşuna basınca tıklanacak düğme.' },
  CancelButton: { type: 'controlref', cat: 'Davranış', def: '', refType: 'Button', desc: 'Esc tuşuna basınca tıklanacak düğme.' },
};

// Olay → (temsilci türü, argüman türü)
export const EVENT_TYPES = {
  MouseClick: ['System.Windows.Forms.MouseEventHandler', 'MouseEventArgs'],
  MouseDoubleClick: ['System.Windows.Forms.MouseEventHandler', 'MouseEventArgs'],
  MouseDown: ['System.Windows.Forms.MouseEventHandler', 'MouseEventArgs'],
  MouseUp: ['System.Windows.Forms.MouseEventHandler', 'MouseEventArgs'],
  MouseMove: ['System.Windows.Forms.MouseEventHandler', 'MouseEventArgs'],
  MouseWheel: ['System.Windows.Forms.MouseEventHandler', 'MouseEventArgs'],
  KeyDown: ['System.Windows.Forms.KeyEventHandler', 'KeyEventArgs'],
  KeyUp: ['System.Windows.Forms.KeyEventHandler', 'KeyEventArgs'],
  KeyPress: ['System.Windows.Forms.KeyPressEventHandler', 'KeyPressEventArgs'],
  FormClosing: ['System.Windows.Forms.FormClosingEventHandler', 'FormClosingEventArgs'],
  FormClosed: ['System.Windows.Forms.FormClosedEventHandler', 'FormClosedEventArgs'],
  Validating: ['System.ComponentModel.CancelEventHandler', 'System.ComponentModel.CancelEventArgs'],
  LinkClicked: ['System.Windows.Forms.LinkLabelLinkClickedEventHandler', 'LinkLabelLinkClickedEventArgs'],
  ItemCheck: ['System.Windows.Forms.ItemCheckEventHandler', 'ItemCheckEventArgs'],
  CellClick: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellContentClick: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellDoubleClick: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellContentDoubleClick: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellValueChanged: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellEndEdit: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellEnter: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  RowEnter: ['System.Windows.Forms.DataGridViewCellEventHandler', 'DataGridViewCellEventArgs'],
  CellBeginEdit: ['System.Windows.Forms.DataGridViewCellCancelEventHandler', 'DataGridViewCellCancelEventArgs'],
  CellMouseClick: ['System.Windows.Forms.DataGridViewCellMouseEventHandler', 'DataGridViewCellMouseEventArgs'],
  CellMouseDoubleClick: ['System.Windows.Forms.DataGridViewCellMouseEventHandler', 'DataGridViewCellMouseEventArgs'],
  ColumnHeaderMouseClick: ['System.Windows.Forms.DataGridViewCellMouseEventHandler', 'DataGridViewCellMouseEventArgs'],
  RowHeaderMouseClick: ['System.Windows.Forms.DataGridViewCellMouseEventHandler', 'DataGridViewCellMouseEventArgs'],
  CellFormatting: ['System.Windows.Forms.DataGridViewCellFormattingEventHandler', 'DataGridViewCellFormattingEventArgs'],
  CellValidating: ['System.Windows.Forms.DataGridViewCellValidatingEventHandler', 'DataGridViewCellValidatingEventArgs'],
  DataError: ['System.Windows.Forms.DataGridViewDataErrorEventHandler', 'DataGridViewDataErrorEventArgs'],
  RowsAdded: ['System.Windows.Forms.DataGridViewRowsAddedEventHandler', 'DataGridViewRowsAddedEventArgs'],
  RowsRemoved: ['System.Windows.Forms.DataGridViewRowsRemovedEventHandler', 'DataGridViewRowsRemovedEventArgs'],
  UserAddedRow: ['System.Windows.Forms.DataGridViewRowEventHandler', 'DataGridViewRowEventArgs'],
  UserDeletedRow: ['System.Windows.Forms.DataGridViewRowEventHandler', 'DataGridViewRowEventArgs'],
  UserDeletingRow: ['System.Windows.Forms.DataGridViewRowCancelEventHandler', 'DataGridViewRowCancelEventArgs'],
  DataBindingComplete: ['System.Windows.Forms.DataGridViewBindingCompleteEventHandler', 'DataGridViewBindingCompleteEventArgs'],
};

export function eventTypes(evt) {
  return EVENT_TYPES[evt] || ['System.EventHandler', 'EventArgs'];
}

export const EVENT_DESC = {
  Click: 'Kontrole tıklandığında', DoubleClick: 'Çift tıklandığında', TextChanged: 'Metin değiştiğinde',
  KeyDown: 'Bir tuşa basıldığında', KeyUp: 'Tuş bırakıldığında', KeyPress: 'Bir karakter tuşuna basıldığında',
  MouseClick: 'Fare ile tıklandığında (konum bilgisiyle)', MouseDown: 'Fare tuşuna basıldığında', MouseUp: 'Fare tuşu bırakıldığında',
  MouseMove: 'Fare üzerinde hareket ettiğinde', MouseEnter: 'Fare kontrolün üzerine geldiğinde', MouseLeave: 'Fare kontrolden ayrıldığında',
  Enter: 'Kontrol odağı aldığında', Leave: 'Kontrol odağı kaybettiğinde', Load: 'Form ilk kez yüklenirken', Shown: 'Form ilk kez gösterildiğinde',
  FormClosing: 'Form kapanmadan hemen önce (iptal edilebilir)', FormClosed: 'Form kapandıktan sonra', Resize: 'Boyut değiştiğinde',
  CheckedChanged: 'İşaret durumu değiştiğinde', SelectedIndexChanged: 'Seçili öğe değiştiğinde', ValueChanged: 'Değer değiştiğinde',
  Tick: 'Her Interval milisaniyede bir', LinkClicked: 'Bağlantıya tıklandığında', Activated: 'Form etkinleştiğinde', Scroll: 'Kaydırıldığında',
  ItemCheck: 'Bir öğenin işareti değişmek üzereyken', Validating: 'Kontrolden çıkılırken doğrulama için',
  CellClick: 'Bir hücreye (ya da başlığa) tıklandığında — e.RowIndex, e.ColumnIndex', CellContentClick: 'Hücrenin içeriğine (yazı, düğme, onay kutusu) tıklandığında',
  CellDoubleClick: 'Hücreye çift tıklandığında', CellValueChanged: 'Hücrenin değeri değiştiğinde', CellEndEdit: 'Hücre düzenlemesi bittiğinde',
  SelectionChanged: 'Seçili satır/hücreler değiştiğinde', CurrentCellChanged: 'Geçerli hücre değiştiğinde', RowEnter: 'Bir satıra girildiğinde',
  UserDeletingRow: 'Kullanıcı Delete ile satır silmek üzereyken (iptal edilebilir)', UserAddedRow: 'Kullanıcı yeni satıra veri girdiğinde',
  CellFormatting: 'Hücre ekrana yazılmadan önce (renk/biçim değiştirmek için)', DataError: 'Hücreye geçersiz veri girildiğinde',
  ColumnHeaderMouseClick: 'Sütun başlığına tıklandığında', CellBeginEdit: 'Hücre düzenlenmeye başlanırken (iptal edilebilir)',
};

const COMMON_EVENTS = ['Click', 'DoubleClick', 'MouseClick', 'MouseDown', 'MouseUp', 'MouseMove', 'MouseEnter', 'MouseLeave', 'KeyDown', 'KeyUp', 'KeyPress', 'Enter', 'Leave', 'TextChanged', 'Resize', 'VisibleChanged', 'EnabledChanged', 'Validating'];
const COMMON_PROPS = ['Name', 'Text', 'Location', 'Size', 'Anchor', 'Dock', 'BackColor', 'ForeColor', 'Font', 'Cursor', 'Enabled', 'Visible', 'TabIndex', 'TabStop', 'Tag'];

/**
 * Kontrol türleri. prefix: varsayılan ad öneki. size: varsayılan boyut. defaults: eklenince ayarlanan özellikler.
 */
export const CONTROLS = {
  Button: {
    title: 'Button', desc: 'Tıklanabilen düğme', icon: '▭', prefix: 'button', size: [75, 23],
    props: [...COMMON_PROPS, 'TextAlign', 'FlatStyle', 'AutoSize', 'UseVisualStyleBackColor'],
    events: COMMON_EVENTS, defaultEvent: 'Click',
    defaults: (n) => ({ Text: n, UseVisualStyleBackColor: true }),
    propDefaults: { TextAlign: 'MiddleCenter' },
  },
  Label: {
    title: 'Label', desc: 'Metin etiketi', icon: 'A', prefix: 'label', size: [38, 15],
    props: [...COMMON_PROPS, 'AutoSize', 'TextAlign', 'BorderStyle'],
    events: COMMON_EVENTS, defaultEvent: 'Click',
    defaults: (n) => ({ Text: n, AutoSize: true }),
  },
  TextBox: {
    title: 'TextBox', desc: 'Yazı yazılabilen kutu', icon: '⌶', prefix: 'textBox', size: [100, 23],
    props: [...COMMON_PROPS, 'Multiline', 'ReadOnly', 'PasswordChar', 'UseSystemPasswordChar', 'MaxLength', 'ScrollBars', 'WordWrap', 'PlaceholderText', 'CharacterCasing', 'HAlign', 'BorderStyle'],
    events: COMMON_EVENTS, defaultEvent: 'TextChanged',
    defaults: () => ({}),
    propDefaults: { BorderStyle: 'Fixed3D' },
  },
  CheckBox: {
    title: 'CheckBox', desc: 'İşaretlenebilen kutu', icon: '☑', prefix: 'checkBox', size: [83, 19],
    props: [...COMMON_PROPS, 'Checked', 'AutoSize', 'TextAlign', 'UseVisualStyleBackColor'],
    events: ['CheckedChanged', ...COMMON_EVENTS], defaultEvent: 'CheckedChanged',
    defaults: (n) => ({ Text: n, AutoSize: true, UseVisualStyleBackColor: true }),
    propDefaults: { TextAlign: 'MiddleLeft' },
  },
  RadioButton: {
    title: 'RadioButton', desc: 'Gruptan tek seçim', icon: '◉', prefix: 'radioButton', size: [94, 19],
    props: [...COMMON_PROPS, 'Checked', 'AutoSize', 'TextAlign', 'UseVisualStyleBackColor'],
    events: ['CheckedChanged', ...COMMON_EVENTS], defaultEvent: 'CheckedChanged',
    defaults: (n) => ({ Text: n, AutoSize: true, UseVisualStyleBackColor: true }),
    propDefaults: { TextAlign: 'MiddleLeft' },
  },
  ComboBox: {
    title: 'ComboBox', desc: 'Açılır liste', icon: '▼', prefix: 'comboBox', size: [121, 23],
    props: [...COMMON_PROPS, 'Items', 'DropDownStyle', 'Sorted'],
    events: ['SelectedIndexChanged', ...COMMON_EVENTS], defaultEvent: 'SelectedIndexChanged',
    defaults: () => ({ FormattingEnabled: true }),
  },
  ListBox: {
    title: 'ListBox', desc: 'Öğe listesi', icon: '☰', prefix: 'listBox', size: [120, 94],
    props: [...COMMON_PROPS, 'Items', 'SelectionMode', 'Sorted', 'BorderStyle'],
    events: ['SelectedIndexChanged', ...COMMON_EVENTS], defaultEvent: 'SelectedIndexChanged',
    defaults: () => ({ FormattingEnabled: true }),
    propDefaults: { BorderStyle: 'Fixed3D' },
  },
  CheckedListBox: {
    title: 'CheckedListBox', desc: 'İşaretlenebilir liste', icon: '☷', prefix: 'checkedListBox', size: [120, 94],
    props: [...COMMON_PROPS, 'Items', 'CheckOnClick', 'Sorted'],
    events: ['ItemCheck', 'SelectedIndexChanged', ...COMMON_EVENTS], defaultEvent: 'SelectedIndexChanged',
    defaults: () => ({ FormattingEnabled: true }),
  },
  GroupBox: {
    title: 'GroupBox', desc: 'Başlıklı çerçeve (kapsayıcı)', icon: '⬚', prefix: 'groupBox', size: [200, 100], container: true,
    props: [...COMMON_PROPS],
    events: COMMON_EVENTS, defaultEvent: 'Enter',
    defaults: (n) => ({ Text: n }),
  },
  Panel: {
    title: 'Panel', desc: 'Kapsayıcı alan', icon: '▢', prefix: 'panel', size: [200, 100], container: true,
    props: [...COMMON_PROPS.filter((p) => p !== 'Text'), 'BorderStyle'],
    events: COMMON_EVENTS, defaultEvent: 'Click',
    defaults: () => ({}),
  },
  PictureBox: {
    title: 'PictureBox', desc: 'Resim kutusu', icon: '\u{1F5BC}', prefix: 'pictureBox', size: [100, 50],
    props: [...COMMON_PROPS.filter((p) => p !== 'Text' && p !== 'Font'), 'ImageLocation', 'SizeMode', 'BorderStyle'],
    events: COMMON_EVENTS.filter((e) => e !== 'TextChanged'), defaultEvent: 'Click',
    defaults: () => ({ TabStop: false }),
  },
  NumericUpDown: {
    title: 'NumericUpDown', desc: 'Sayı seçici', icon: '⇳', prefix: 'numericUpDown', size: [120, 23],
    props: [...COMMON_PROPS.filter((p) => p !== 'Text'), 'Minimum', 'Maximum', 'Value', 'Increment', 'DecimalPlaces', 'HAlign'],
    events: ['ValueChanged', ...COMMON_EVENTS], defaultEvent: 'ValueChanged',
    defaults: () => ({}),
  },
  ProgressBar: {
    title: 'ProgressBar', desc: 'İlerleme çubuğu', icon: '▬', prefix: 'progressBar', size: [100, 23],
    props: [...COMMON_PROPS.filter((p) => p !== 'Text'), 'IntMinimum', 'IntMaximum', 'IntValue', 'Step', 'ProgressStyle'],
    events: COMMON_EVENTS, defaultEvent: 'Click',
    defaults: () => ({}),
  },
  TrackBar: {
    title: 'TrackBar', desc: 'Kaydırma çubuğu', icon: '═', prefix: 'trackBar', size: [104, 45],
    props: [...COMMON_PROPS.filter((p) => p !== 'Text'), 'TrackMinimum', 'TrackMaximum', 'TrackValue', 'TickFrequency', 'Orientation'],
    events: ['Scroll', 'ValueChanged', ...COMMON_EVENTS], defaultEvent: 'Scroll',
    defaults: () => ({}),
  },
  DateTimePicker: {
    title: 'DateTimePicker', desc: 'Tarih seçici', icon: '\u{1F4C5}', prefix: 'dateTimePicker', size: [200, 23],
    props: [...COMMON_PROPS.filter((p) => p !== 'Text'), 'Format'],
    events: ['ValueChanged', ...COMMON_EVENTS], defaultEvent: 'ValueChanged',
    defaults: () => ({}),
  },
  LinkLabel: {
    title: 'LinkLabel', desc: 'Bağlantı etiketi', icon: '\u{1F517}', prefix: 'linkLabel', size: [60, 15],
    props: [...COMMON_PROPS, 'AutoSize', 'TextAlign'],
    events: ['LinkClicked', ...COMMON_EVENTS], defaultEvent: 'LinkClicked',
    defaults: (n) => ({ Text: n, AutoSize: true }),
  },
  RichTextBox: {
    title: 'RichTextBox', desc: 'Çok satırlı metin alanı', icon: '≣', prefix: 'richTextBox', size: [100, 96],
    props: [...COMMON_PROPS, 'ReadOnly', 'WordWrap', 'MaxLength', 'BorderStyle'],
    events: COMMON_EVENTS, defaultEvent: 'TextChanged',
    defaults: () => ({}),
    propDefaults: { BorderStyle: 'Fixed3D' },
  },
  DataGridView: {
    title: 'DataGridView', desc: 'Satır ve sütunlu tablo', icon: '▦', prefix: 'dataGridView', size: [240, 150], init: true,
    props: [...COMMON_PROPS.filter((p) => p !== 'Text'), 'Columns', 'AllowUserToAddRows', 'AllowUserToDeleteRows', 'ReadOnly', 'MultiSelect', 'GridSelectionMode', 'AutoSizeColumnsMode', 'ColumnHeadersHeightSizeMode', 'RowHeadersVisible', 'ColumnHeadersVisible', 'RowHeadersWidth', 'BackgroundColor', 'GridColor', 'BorderStyle'],
    events: ['CellClick', 'CellContentClick', 'CellDoubleClick', 'CellValueChanged', 'CellEndEdit', 'CellBeginEdit', 'CellEnter', 'CellFormatting', 'CellMouseClick', 'ColumnHeaderMouseClick', 'RowHeaderMouseClick', 'SelectionChanged', 'CurrentCellChanged', 'RowEnter', 'RowsAdded', 'RowsRemoved', 'UserAddedRow', 'UserDeletingRow', 'UserDeletedRow', 'DataError', 'DataBindingComplete', 'Sorted', ...COMMON_EVENTS.filter((e) => e !== 'TextChanged')],
    defaultEvent: 'CellContentClick',
    defaults: () => ({ ColumnHeadersHeightSizeMode: 'AutoSize', RowHeadersWidth: 51 }),
    propDefaults: { BorderStyle: 'FixedSingle' },
  },
  Timer: {
    title: 'Timer', desc: 'Zamanlayıcı (görünmez)', icon: '⏱', prefix: 'timer', component: true,
    props: ['Name', 'TimerEnabled', 'Interval', 'Tag'],
    events: ['Tick'], defaultEvent: 'Tick',
    defaults: () => ({}),
  },
};

// TrackBar int özellikleri (ProgressBar'dan farklı varsayılanlar)
PROPS.TrackMinimum = { type: 'int', cat: 'Davranış', def: 0, code: 'Minimum' };
PROPS.TrackMaximum = { type: 'int', cat: 'Davranış', def: 10, code: 'Maximum' };
PROPS.TrackValue = { type: 'int', cat: 'Davranış', def: 0, code: 'Value' };

export const FORM_INFO = {
  title: 'Form',
  props: ['Name', 'Text', 'ClientSize', 'BackColor', 'ForeColor', 'Font', 'StartPosition', 'FormBorderStyle', 'MaximizeBox', 'MinimizeBox', 'ControlBox', 'ShowInTaskbar', 'TopMost', 'WindowState', 'Opacity', 'KeyPreview', 'AcceptButton', 'CancelButton', 'Cursor', 'Enabled', 'Tag'],
  events: ['Load', 'Shown', 'Activated', 'FormClosing', 'FormClosed', 'Click', 'DoubleClick', 'MouseClick', 'MouseDown', 'MouseUp', 'MouseMove', 'KeyDown', 'KeyUp', 'KeyPress', 'Resize'],
  defaultEvent: 'Load',
};

export const TOOLBOX_GROUPS = [
  { title: 'Ortak Kontroller', items: ['Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton', 'ComboBox', 'ListBox', 'CheckedListBox', 'PictureBox', 'NumericUpDown', 'DateTimePicker', 'ProgressBar', 'TrackBar', 'LinkLabel', 'RichTextBox'] },
  { title: 'Kapsayıcılar', items: ['GroupBox', 'Panel'] },
  { title: 'Veri', items: ['DataGridView'] },
  { title: 'Bileşenler', items: ['Timer'] },
];

/** Bir özelliğin bu kontrol türündeki varsayılan değeri. */
export function propDefault(type, prop) {
  const info = CONTROLS[type];
  if (info?.propDefaults && prop in info.propDefaults) return info.propDefaults[prop];
  return PROPS[prop]?.def;
}

/** Özelliğin koddaki (C#) adı. */
export function codeName(prop) {
  return PROPS[prop]?.code || prop;
}

/** DataGridView sütun türleri. */
export const COLUMN_TYPES = {
  DataGridViewTextBoxColumn: 'Metin (TextBox)',
  DataGridViewCheckBoxColumn: 'Onay kutusu (CheckBox)',
  DataGridViewButtonColumn: 'Düğme (Button)',
  DataGridViewComboBoxColumn: 'Açılır liste (ComboBox)',
  DataGridViewLinkColumn: 'Bağlantı (Link)',
  DataGridViewImageColumn: 'Resim (Image)',
};
