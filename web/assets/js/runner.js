// Çalışan öğrenci programının "masaüstü"sü: pencereler, olaylar, zamanlayıcılar, iletişim kutuları.
import { createItem, setProp, clientOf, measureText, ICONS, BUTTON_TEXT, BUTTON_SETS } from './winui.js';

const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);

export class Desktop {
  /**
   * @param {HTMLElement} root  Masaüstü öğesi
   * @param {object} hooks      { onOutput(text), onError(info), onEnded(reason) }
   */
  constructor(root, hooks = {}) {
    this.root = root;
    this.hooks = hooks;
    this.engine = null;
    root.classList.add('wf-desktop');
    root.innerHTML = '<div class="wf-windows"></div><div class="wf-modal-shade"></div><div class="wf-taskbar"></div>';
    this.windows = root.querySelector('.wf-windows');
    this.shade = root.querySelector('.wf-modal-shade');
    this.taskbar = root.querySelector('.wf-taskbar');
    this.items = new Map();
    this.timers = new Map();
    this.applying = false;
    this.running = false;
    this.z = 10;
    this.cascade = 0;
    this.flushPending = false;
    this.dialogs = [];
    this.bindDelegated();
  }

  attach(engine) {
    this.engine = engine;
  }

  // ------------------------------------------------------------------ yaşam döngüsü

  start() {
    this.clear();
    this.running = true;
  }

  stop() {
    this.running = false;
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
  }

  clear() {
    this.stop();
    this.items.clear();
    this.windows.innerHTML = '';
    this.taskbar.innerHTML = '';
    for (const d of this.dialogs) d.remove();
    this.dialogs = [];
    this.cascade = 0;
    this.updateModal();
  }

  dispatch(id, evt, data = '') {
    if (this.applying || !this.running || !this.engine) return '';
    try {
      return this.engine.Dispatch(id, evt, String(data)) ?? '';
    } catch (e) {
      console.error(e);
      this.hooks.onError?.({ type: 'Motor hatası', message: String(e?.message || e), line: 0, file: 0 });
      return '';
    }
  }

  // ------------------------------------------------------------------ motorun çağırdığı fonksiyonlar

  applyOps(json) {
    const ops = JSON.parse(json);
    this.applying = true;
    try {
      for (const op of ops) {
        try {
          this.applyOp(op);
        } catch (e) {
          console.error('İşlem uygulanamadı', op, e);
        }
      }
    } finally {
      this.applying = false;
    }
    this.updateModal();
    this.renderTaskbar();
  }

  scheduleFlush() {
    if (this.flushPending) return;
    this.flushPending = true;
    setTimeout(() => {
      this.flushPending = false;
      if (this.engine && this.running) {
        try { this.engine.Flush(); } catch (e) { console.error(e); }
      }
    }, 0);
  }

  measure(text, font) {
    const m = measureText(text, font);
    return `${m.w},${m.h}`;
  }

  /** Beklemesi gereken yerlerde (ör. FormClosing) tarayıcının kendi pencereleri kullanılır. */
  messageBox(text, caption, buttons, icon) {
    const head = (ICONS[icon] ? ICONS[icon] + ' ' : '') + (caption ? caption + '\n\n' : '');
    switch (buttons) {
      case 'OK':
        window.alert(head + text);
        return 'OK';
      case 'YesNo':
      case 'YesNoCancel':
        return window.confirm(head + text + '\n\n[Tamam = Evet,  İptal = Hayır]') ? 'Yes' : 'No';
      case 'RetryCancel':
        return window.confirm(head + text + '\n\n[Tamam = Yeniden Dene]') ? 'Retry' : 'Cancel';
      case 'AbortRetryIgnore':
        return window.confirm(head + text + '\n\n[Tamam = Yeniden Dene,  İptal = Durdur]') ? 'Retry' : 'Abort';
      default:
        return window.confirm(head + text) ? 'OK' : 'Cancel';
    }
  }

  inputBox(prompt, title, def) {
    const r = window.prompt((title ? title + '\n\n' : '') + prompt, def);
    return r;
  }

  query(id, what) {
    const item = this.items.get(id);
    const input = item?.input;
    if (!input) return '0';
    if (what === 'selstart') return String(input.selectionStart ?? 0);
    if (what === 'sellength') return String((input.selectionEnd ?? 0) - (input.selectionStart ?? 0));
    return '';
  }

  output(text) {
    this.hooks.onOutput?.(text);
  }

  error(json) {
    let info;
    try { info = JSON.parse(json); } catch { info = { message: json }; }
    this.hooks.onError?.(info);
  }

  programEnded(reason) {
    this.stop();
    this.windows.innerHTML = '';
    this.taskbar.innerHTML = '';
    for (const d of this.dialogs) d.remove();
    this.dialogs = [];
    this.items.clear();
    this.updateModal();
    this.hooks.onEnded?.(reason);
  }

  /** Beklenebilir iletişim kutusu (MessageBox / InputBox). */
  showDialog(requestId, kind, json) {
    const data = JSON.parse(json);
    const box = document.createElement('div');
    box.className = 'wf-window wf-dialog';
    const title = kind === 'inputbox' ? data.title : data.caption;
    box.innerHTML = `
      <div class="wf-titlebar"><span class="wf-title"></span>
        <span class="wf-caption-buttons"><button class="wf-cap wf-close" tabindex="-1">&#10005;</button></span></div>
      <div class="wf-dialog-body"><div class="wf-dialog-icon"></div><div class="wf-dialog-text"></div></div>
      <div class="wf-dialog-buttons"></div>`;
    box.querySelector('.wf-title').textContent = title || ' ';
    box.querySelector('.wf-dialog-text').textContent = kind === 'inputbox' ? data.prompt : data.text;
    const iconEl = box.querySelector('.wf-dialog-icon');
    if (kind === 'messagebox' && ICONS[data.icon]) iconEl.textContent = ICONS[data.icon];
    else iconEl.remove();

    let input = null;
    let names;
    if (kind === 'inputbox') {
      input = document.createElement('input');
      input.className = 'wf-dialog-input';
      input.value = data.value || '';
      box.querySelector('.wf-dialog-body').appendChild(input);
      names = ['OK', 'Cancel'];
    } else {
      names = BUTTON_SETS[data.buttons] || ['OK'];
    }

    const finish = (result) => {
      box.remove();
      this.dialogs = this.dialogs.filter((d) => d !== box);
      this.updateModal();
      if (!this.running || !this.engine) return;
      let value = result;
      if (kind === 'inputbox') value = result === 'OK' ? input.value : '';
      try { this.engine.CompleteDialog(requestId, value); } catch (e) { console.error(e); }
    };

    const buttons = box.querySelector('.wf-dialog-buttons');
    const def = Math.min(Number(data.default) || 0, names.length - 1);
    names.forEach((n, i) => {
      const b = document.createElement('button');
      b.className = 'wf-button wf-dialog-button';
      b.textContent = BUTTON_TEXT[n] || n;
      b.onclick = () => finish(n);
      buttons.appendChild(b);
      if (i === def && !input) setTimeout(() => b.focus(), 0);
    });
    const cancelName = names.includes('Cancel') ? 'Cancel' : names.includes('No') ? 'No' : names.length === 1 ? names[0] : null;
    box.querySelector('.wf-close').onclick = () => { if (cancelName) finish(cancelName); };
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cancelName) { e.preventDefault(); finish(cancelName); }
      if (e.key === 'Enter' && input) { e.preventDefault(); finish('OK'); }
      e.stopPropagation();
    });
    this.makeDraggable(box, null);
    this.root.appendChild(box);
    this.dialogs.push(box);
    box.style.zIndex = 100000 + this.dialogs.length;
    const r = this.root.getBoundingClientRect();
    box.style.left = Math.max(0, (r.width - box.offsetWidth) / 2) + 'px';
    box.style.top = Math.max(0, (r.height - box.offsetHeight) / 2.5) + 'px';
    if (input) setTimeout(() => { input.focus(); input.select(); }, 0);
    this.updateModal();
  }

  // ------------------------------------------------------------------ işlemler

  applyOp(op) {
    switch (op[0]) {
      case 'c': {
        const [, id, type] = op;
        const item = createItem(type, id);
        this.items.set(id, item);
        if (type === 'Form') this.setupWindow(item);
        return;
      }
      case 's': {
        const [, id, prop, value] = op;
        if (prop === 'timer') return this.setTimer(id, Number(value));
        const item = this.items.get(id);
        if (!item) return;
        if (item.type === 'Form') return this.setFormProp(item, prop, value);
        if (prop === 'listen') return this.setListen(item, value);
        setProp(item, prop, value);
        return;
      }
      case 'p': {
        const [, id, parentId] = op;
        const item = this.items.get(id);
        if (!item) return;
        item.parentId = parentId;
        if (parentId === 0) {
          if (item.type === 'Form' && !item.embedded) this.windows.appendChild(item.el);
          else item.el.remove();
          return;
        }
        const parent = this.items.get(parentId);
        if (!parent) return;
        if (item.type === 'Form') {
          item.embedded = true;
          item.el.classList.add('wf-embedded');
        }
        clientOf(parent).appendChild(item.el);
        return;
      }
      case 'm': {
        const [, id, method, arg] = op;
        const item = this.items.get(id);
        if (!item) return;
        this.callMethod(item, method, arg);
        return;
      }
      case 'd': {
        const [, id] = op;
        const item = this.items.get(id);
        if (item) {
          item.el.remove();
          this.items.delete(id);
        }
        if (this.timers.has(id)) {
          clearInterval(this.timers.get(id));
          this.timers.delete(id);
        }
        return;
      }
      case 'reset':
        this.clear();
        this.running = true;
        return;
      default:
    }
  }

  callMethod(item, method, arg) {
    const input = item.input;
    switch (method) {
      case 'focus':
        setTimeout(() => (input || item.el).focus?.(), 0);
        return;
      case 'selectall':
        input?.select?.();
        return;
      case 'select': {
        const [s, l] = String(arg).split(',').map(Number);
        try { input?.setSelectionRange?.(s, s + l); } catch { /* yok */ }
        return;
      }
      case 'scrollend':
        if (input) input.scrollTop = input.scrollHeight;
        return;
      case 'activate':
        if (item.type === 'Form') this.bringToFront(item);
        return;
      default:
    }
  }

  setTimer(id, interval) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
    }
    if (interval > 0) {
      this.timers.set(id, setInterval(() => this.dispatch(id, 'tick'), Math.max(interval, 10)));
    }
  }

  setListen(item, value) {
    const set = new Set(value ? value.split(',') : []);
    item.listen = set;
    for (const evt of ['mouseenter', 'mouseleave']) {
      const key = '_' + evt;
      if (set.has(evt) && !item[key]) {
        item[key] = () => { if (!this.isDisabled(item)) this.dispatch(item.id, evt); };
        item.el.addEventListener(evt, item[key]);
      } else if (!set.has(evt) && item[key]) {
        item.el.removeEventListener(evt, item[key]);
        item[key] = null;
      }
    }
  }

  // ------------------------------------------------------------------ pencereler (Form)

  setupWindow(item) {
    item.el.classList.add('wf-hidden');
    item.state = 'Normal';
    item.placed = false;
    item.props.border = 'Sizable';
    item.props.startpos = 'WindowsDefaultLocation';
    const bar = item.el.querySelector('.wf-titlebar');
    item.el.querySelector('.wf-close').onclick = () => this.dispatch(item.id, 'close');
    item.el.querySelector('.wf-max').onclick = () => this.toggleMaximize(item);
    item.el.querySelector('.wf-min').onclick = () => this.minimize(item);
    bar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.wf-cap')) return;
      if (item.props.box?.[2] !== '0' && this.isSizable(item)) this.toggleMaximize(item);
    });
    item.el.addEventListener('pointerdown', () => this.activate(item), true);
    this.makeDraggable(item.el, item);
    this.makeResizable(item);
  }

  isSizable(item) {
    return item.props.border === 'Sizable' || item.props.border === 'SizableToolWindow';
  }

  setFormProp(item, prop, value) {
    switch (prop) {
      case 'bounds':
        setProp(item, prop, value);
        if (item.placed && item.state !== 'Maximized') this.positionWindow(item);
        return;
      case 'visible':
        if (value === '1') this.showWindow(item);
        else item.el.classList.add('wf-hidden');
        return;
      case 'text':
        setProp(item, prop, value);
        return;
      case 'border': {
        item.props.border = value;
        item.el.classList.toggle('wf-noborder', value === 'None');
        item.el.classList.toggle('wf-toolwindow', value.includes('ToolWindow'));
        item.el.classList.toggle('wf-fixed', !this.isSizable(item));
        return;
      }
      case 'box': {
        item.props.box = value;
        const [ctl, min, max] = value.split('');
        item.el.querySelector('.wf-caption-buttons').style.display = ctl === '0' ? 'none' : '';
        item.el.querySelector('.wf-min').style.display = min === '0' ? 'none' : '';
        item.el.querySelector('.wf-max').style.display = max === '0' ? 'none' : '';
        return;
      }
      case 'state':
        if (value === 'Maximized' && item.state !== 'Maximized') this.toggleMaximize(item, true);
        else if (value === 'Normal' && item.state === 'Maximized') this.toggleMaximize(item, true);
        else if (value === 'Minimized') this.minimize(item, true);
        else if (value === 'Normal' && item.state === 'Minimized') this.restore(item, true);
        return;
      case 'modal':
        item.modal = value === '1';
        item.el.classList.toggle('wf-modal', item.modal);
        return;
      case 'topmost':
        item.topmost = value === '1';
        this.bringToFront(item);
        return;
      case 'opacity':
        item.el.style.opacity = value;
        return;
      case 'keypreview':
        item.keypreview = value === '1';
        return;
      case 'startpos':
        item.props.startpos = value;
        return;
      case 'taskbar':
        item.props.taskbar = value;
        return;
      case 'toplevel':
        item.embedded = value === '0';
        item.el.classList.toggle('wf-embedded', item.embedded);
        return;
      case 'listen':
        this.setListen(item, value);
        return;
      default:
        setProp(item, prop, value);
    }
  }

  showWindow(item) {
    item.el.classList.remove('wf-hidden');
    if (item.embedded) {
      item.el.style.left = (item.x || 0) + 'px';
      item.el.style.top = (item.y || 0) + 'px';
      return;
    }
    if (!item.el.parentNode) this.windows.appendChild(item.el);
    if (!item.placed) {
      item.placed = true;
      const pos = item.props.startpos;
      if (pos !== 'Manual') {
        const r = this.windows.getBoundingClientRect();
        const w = item.el.offsetWidth;
        const h = item.el.offsetHeight;
        let x;
        let y;
        if (pos === 'CenterScreen' || pos === 'CenterParent') {
          x = Math.round((r.width - w) / 2);
          y = Math.round((r.height - h) / 2);
        } else {
          x = 24 + (this.cascade % 8) * 28;
          y = 16 + (this.cascade % 8) * 28;
          this.cascade++;
        }
        item.x = Math.max(0, x);
        item.y = Math.max(0, y);
        this.positionWindow(item);
        this.dispatch(item.id, 'move', `${item.x},${item.y}`);
      } else {
        this.positionWindow(item);
      }
    }
    this.bringToFront(item);
  }

  positionWindow(item) {
    item.el.style.left = (item.x || 0) + 'px';
    item.el.style.top = (item.y || 0) + 'px';
  }

  bringToFront(item) {
    item.el.style.zIndex = (item.topmost ? 50000 : 0) + (++this.z);
    for (const it of this.items.values()) {
      if (it.type === 'Form') it.el.classList.toggle('wf-active', it === item);
    }
    this.renderTaskbar();
  }

  activate(item) {
    if (item.embedded) return;
    const wasActive = item.el.classList.contains('wf-active');
    this.bringToFront(item);
    if (!wasActive) this.dispatch(item.id, 'activate');
  }

  toggleMaximize(item, fromCode = false) {
    if (item.state === 'Maximized') {
      item.state = 'Normal';
      item.el.classList.remove('wf-maximized');
      const r = item.restore;
      if (r) {
        item.x = r.x; item.y = r.y;
        this.positionWindow(item);
        this.sendResize(item, r.w, r.h);
      }
    } else {
      item.restore = { x: item.x, y: item.y, w: item.clientW, h: item.clientH };
      item.state = 'Maximized';
      item.el.classList.add('wf-maximized');
      const r = this.windows.getBoundingClientRect();
      item.x = 0; item.y = 0;
      this.positionWindow(item);
      const frameW = item.el.offsetWidth - item.client.offsetWidth;
      const frameH = item.el.offsetHeight - item.client.offsetHeight;
      this.sendResize(item, Math.floor(r.width - frameW), Math.floor(r.height - frameH));
    }
    if (!fromCode) this.dispatch(item.id, 'state', item.state);
  }

  minimize(item, fromCode = false) {
    item.prevState = item.state === 'Minimized' ? item.prevState : item.state;
    item.state = 'Minimized';
    item.el.classList.add('wf-minimized');
    if (!fromCode) this.dispatch(item.id, 'state', 'Minimized');
    this.renderTaskbar();
  }

  restore(item, fromCode = false) {
    item.el.classList.remove('wf-minimized');
    item.state = item.prevState === 'Maximized' ? 'Maximized' : 'Normal';
    if (!fromCode) this.dispatch(item.id, 'state', item.state);
    this.activate(item);
  }

  sendResize(item, w, h) {
    w = Math.max(40, Math.round(w));
    h = Math.max(10, Math.round(h));
    item.client.style.width = w + 'px';
    item.client.style.height = h + 'px';
    item.clientW = w;
    item.clientH = h;
    this.dispatch(item.id, 'resize', `${w},${h}`);
  }

  makeDraggable(el, item) {
    const bar = el.querySelector('.wf-titlebar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.wf-cap')) return;
      if (item && item.state === 'Maximized') return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const ox = el.offsetLeft;
      const oy = el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const nx = Math.max(-el.offsetWidth + 60, ox + ev.clientX - startX);
        const ny = Math.max(0, oy + ev.clientY - startY);
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        if (item) {
          item.x = el.offsetLeft;
          item.y = el.offsetTop;
          this.dispatch(item.id, 'move', `${item.x},${item.y}`);
        }
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
  }

  makeResizable(item) {
    const grip = item.el.querySelector('.wf-grip');
    grip.addEventListener('pointerdown', (e) => {
      if (!this.isSizable(item) || item.state === 'Maximized') return;
      e.preventDefault();
      e.stopPropagation();
      grip.setPointerCapture(e.pointerId);
      const sx = e.clientX;
      const sy = e.clientY;
      const w0 = item.clientW;
      const h0 = item.clientH;
      let frame = 0;
      const move = (ev) => {
        const w = w0 + ev.clientX - sx;
        const h = h0 + ev.clientY - sy;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => this.sendResize(item, w, h));
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }

  updateModal() {
    let top = null;
    for (const it of this.items.values()) {
      if (it.type === 'Form' && it.modal && !it.el.classList.contains('wf-hidden')) {
        if (!top || Number(it.el.style.zIndex) > Number(top.el.style.zIndex)) top = it;
      }
    }
    const hasDialog = this.dialogs.length > 0;
    this.shade.classList.toggle('active', !!top || hasDialog);
    this.shade.style.zIndex = hasDialog ? 99999 : top ? Number(top.el.style.zIndex) - 1 : 0;
    if (top) top.el.style.zIndex = Math.max(Number(top.el.style.zIndex), 40000 + this.z);
  }

  renderTaskbar() {
    const forms = [...this.items.values()].filter((i) => i.type === 'Form' && !i.embedded && i.placed &&
      !i.el.classList.contains('wf-hidden') && i.props.taskbar !== '0');
    this.taskbar.innerHTML = '';
    for (const f of forms) {
      const b = document.createElement('button');
      b.className = 'wf-task' + (f.el.classList.contains('wf-active') && f.state !== 'Minimized' ? ' active' : '');
      b.textContent = f.title.textContent || 'Form';
      b.onclick = () => (f.state === 'Minimized' ? this.restore(f) : f.el.classList.contains('wf-active') ? this.minimize(f) : this.activate(f));
      this.taskbar.appendChild(b);
    }
  }

  // ------------------------------------------------------------------ olaylar

  itemFrom(target) {
    const el = target?.closest?.('[data-wf-id]');
    if (!el || !this.root.contains(el)) return null;
    return this.items.get(Number(el.dataset.wfId)) || null;
  }

  formOf(item) {
    let it = item;
    while (it && it.type !== 'Form') it = this.items.get(it.parentId);
    return it;
  }

  isDisabled(item) {
    return !!item.el.closest('.wf-disabled');
  }

  listens(item, evt) {
    if (item.listen?.has(evt)) return true;
    if (KEY_EVENTS.has(evt)) {
      const f = this.formOf(item);
      return !!f?.keypreview || !!f?.listen?.has(evt);
    }
    return false;
  }

  mouseData(item, e) {
    const host = item.type === 'Form' ? item.client : item.el;
    const r = host.getBoundingClientRect();
    const btn = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
    const delta = e.type === 'wheel' ? (e.deltaY < 0 ? 120 : -120) : 0;
    return `${Math.round(e.clientX - r.left)},${Math.round(e.clientY - r.top)},${btn},${delta}`;
  }

  keyData(e) {
    let code = e.keyCode || 0;
    if (code === 0 && e.key?.length === 1) code = e.key.toUpperCase().charCodeAt(0);
    return `${code},${e.shiftKey ? 1 : 0},${e.ctrlKey ? 1 : 0},${e.altKey ? 1 : 0}`;
  }

  /** Form'un istemci alanında mı (başlık çubuğunda değil)? */
  inClient(item, target) {
    return item.type !== 'Form' || item.client.contains(target);
  }

  bindDelegated() {
    const root = this.root;
    const mouse = (evt) => (e) => {
      const item = this.itemFrom(e.target);
      if (!item || this.isDisabled(item) || !this.inClient(item, e.target)) return;
      if (evt === 'click' && (item.type === 'CheckBox' || item.type === 'RadioButton')) return;
      if (evt === 'click' && item.type === 'Button') {
        this.dispatch(item.id, 'click', this.mouseData(item, e));
        return;
      }
      if (!this.listens(item, evt)) return;
      this.dispatch(item.id, evt, this.mouseData(item, e));
    };
    for (const evt of ['click', 'dblclick', 'mousedown', 'mouseup']) root.addEventListener(evt, mouse(evt));
    let lastMove = 0;
    root.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - lastMove < 15) return;
      lastMove = now;
      mouse('mousemove')(e);
    });
    root.addEventListener('wheel', mouse('wheel'), { passive: true });
    root.addEventListener('contextmenu', (e) => {
      const item = this.itemFrom(e.target);
      if (item && (this.listens(item, 'mousedown') || this.listens(item, 'mouseup') || this.listens(item, 'click'))) e.preventDefault();
    });

    root.addEventListener('keydown', (e) => {
      const item = this.itemFrom(e.target);
      if (!item || this.isDisabled(item)) return;
      if (this.listens(item, 'keydown')) {
        const r = this.dispatch(item.id, 'keydown', this.keyData(e));
        if (r === 'handled' || r === 'suppress') {
          e.preventDefault();
          if (r === 'suppress') item.suppressNextPress = true;
          return;
        }
      }
      // Tarayıcı Backspace/Esc için keypress üretmez; WinForms üretir.
      if ((e.key === 'Backspace' || e.key === 'Escape') && this.listens(item, 'keypress')) {
        const r = this.dispatch(item.id, 'keypress', e.key === 'Backspace' ? '\b' : '\u001b');
        if (r === 'handled') { e.preventDefault(); return; }
      }
      const form = this.formOf(item);
      if (form && e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.closest('.wf-combo-list')) {
        if (this.dispatch(form.id, 'accept') === 'handled') e.preventDefault();
      }
      if (form && e.key === 'Escape') {
        if (this.dispatch(form.id, 'cancel') === 'handled') e.preventDefault();
      }
    });

    root.addEventListener('keypress', (e) => {
      const item = this.itemFrom(e.target);
      if (!item || this.isDisabled(item)) return;
      if (item.suppressNextPress) {
        item.suppressNextPress = false;
        e.preventDefault();
        return;
      }
      if (!this.listens(item, 'keypress')) return;
      const ch = e.key === 'Enter' ? '\r' : e.key.length === 1 ? e.key : '';
      if (!ch) return;
      const r = this.dispatch(item.id, 'keypress', ch);
      if (r === 'handled') {
        e.preventDefault();
      } else if (r.startsWith('replace:')) {
        e.preventDefault();
        const rep = r.substring(8);
        const input = item.input;
        if (input?.setRangeText) {
          input.setRangeText(rep, input.selectionStart, input.selectionEnd, 'end');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });

    root.addEventListener('keyup', (e) => {
      const item = this.itemFrom(e.target);
      if (!item || this.isDisabled(item) || !this.listens(item, 'keyup')) return;
      if (this.dispatch(item.id, 'keyup', this.keyData(e)) === 'handled') e.preventDefault();
    });

    root.addEventListener('input', (e) => {
      const item = this.itemFrom(e.target);
      if (!item) return;
      if (item.type === 'TextBox' || (item.type === 'ComboBox' && e.target === item.input)) {
        this.dispatch(item.id, 'input', e.target.value);
      } else if (item.type === 'TrackBar') {
        this.dispatch(item.id, 'input', e.target.value);
      }
    });

    root.addEventListener('change', (e) => {
      const item = this.itemFrom(e.target);
      if (!item) return;
      if ((item.type === 'CheckBox' || item.type === 'RadioButton') && e.target === item.input) {
        this.dispatch(item.id, 'change', item.input.checked ? '1' : '0');
        this.dispatch(item.id, 'click', '');
      } else if (item.type === 'NumericUpDown') {
        this.dispatch(item.id, 'input', e.target.value);
      } else if (item.type === 'DateTimePicker') {
        if (!e.target.value) return;
        this.dispatch(item.id, 'input', item.input.type === 'time' ? `2000-01-01T${e.target.value}` : e.target.value);
      }
    });

    root.addEventListener('focusin', (e) => {
      const item = this.itemFrom(e.target);
      if (!item || item.type === 'Form' || item.type === 'Panel' || item.type === 'GroupBox') return;
      if (this.lastFocus === item.id) return;
      this.lastFocus = item.id;
      this.dispatch(item.id, 'focus');
    });

    // ComboBox ve ListBox fare etkileşimleri
    root.addEventListener('mousedown', (e) => {
      const item = this.itemFrom(e.target);
      if (!item || this.isDisabled(item)) return;
      if (item.type === 'ComboBox') this.comboMouse(item, e);
      else if (item.type === 'ListBox' || item.type === 'CheckedListBox') this.listMouse(item, e);
    });
    root.addEventListener('keydown', (e) => {
      const item = this.itemFrom(e.target);
      if (!item || this.isDisabled(item)) return;
      if (item.type === 'ComboBox') this.comboKey(item, e);
      else if (item.type === 'ListBox' || item.type === 'CheckedListBox') this.listKey(item, e);
    });
    document.addEventListener('mousedown', (e) => {
      for (const it of this.items.values()) {
        if (it.type === 'ComboBox' && it.open && !it.el.contains(e.target)) this.closeCombo(it);
      }
    });
  }

  comboMouse(item, e) {
    const option = e.target.closest('.wf-combo-item');
    if (option) {
      e.preventDefault();
      this.closeCombo(item);
      this.dispatch(item.id, 'select', option.dataset.index);
      return;
    }
    const style = item.el.classList.contains('wf-dropdownlist');
    if (e.target === item.button || (style && e.target === item.input)) {
      e.preventDefault();
      if (item.open) this.closeCombo(item);
      else this.openCombo(item);
      item.input.focus();
    }
  }

  openCombo(item) {
    item.open = true;
    item.el.classList.add('open');
    item.el.style.zIndex = 100000;
    this.dispatch(item.id, 'dropdown');
  }

  closeCombo(item) {
    if (!item.open) return;
    item.open = false;
    item.el.classList.remove('open');
    item.el.style.zIndex = item.props.z || '';
    this.dispatch(item.id, 'dropdownclosed');
  }

  comboKey(item, e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = item.items.length;
      if (!n) return;
      let i = item.sel + (e.key === 'ArrowDown' ? 1 : -1);
      i = Math.max(0, Math.min(n - 1, i));
      if (i !== item.sel) this.dispatch(item.id, 'select', i);
    } else if ((e.key === 'Enter' || e.key === 'Escape') && item.open) {
      e.preventDefault();
      this.closeCombo(item);
    } else if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
      e.preventDefault();
      if (item.open) this.closeCombo(item); else this.openCombo(item);
    }
  }

  listMouse(item, e) {
    const row = e.target.closest('.wf-list-item');
    if (!row) return;
    const i = Number(row.dataset.index);
    if (e.target.matches('input[type=checkbox]') || (item.type === 'CheckedListBox' && item.sel.includes(i))) {
      e.preventDefault();
      this.dispatch(item.id, 'check', i);
    }
    const mode = item.el.dataset.selmode || 'One';
    let sel;
    if (mode === 'None') return;
    if (mode === 'One') sel = [i];
    else if (mode === 'MultiSimple') sel = item.sel.includes(i) ? item.sel.filter((x) => x !== i) : [...item.sel, i];
    else if (e.ctrlKey) sel = item.sel.includes(i) ? item.sel.filter((x) => x !== i) : [...item.sel, i];
    else if (e.shiftKey && item.anchor != null) {
      const [a, b] = [Math.min(item.anchor, i), Math.max(item.anchor, i)];
      sel = [];
      for (let k = a; k <= b; k++) sel.push(k);
    } else sel = [i];
    if (!e.shiftKey) item.anchor = i;
    this.dispatch(item.id, 'select', sel.join(','));
  }

  listKey(item, e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      if (e.key === ' ' && item.type === 'CheckedListBox' && item.sel.length) {
        e.preventDefault();
        this.dispatch(item.id, 'check', item.sel[0]);
      }
      return;
    }
    e.preventDefault();
    const n = item.items.length;
    if (!n) return;
    const cur = item.sel.length ? item.sel[item.sel.length - 1] : -1;
    const i = Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)));
    this.dispatch(item.id, 'select', String(i));
    item.el.querySelector(`.wf-list-item[data-index="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  }
}
