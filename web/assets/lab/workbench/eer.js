// MySQL Workbench EER diyagramı: Reverse Engineer, ilişki çizme ("Place a Relationship Using
// Existing Columns"), Identifying Relationship ve Synchronize Model.
import { h } from '../../js/ui.js';
import { ICONS } from '../icons.js';
import { typeText } from '../mysql/engine.js';

const bq = (s) => '`' + String(s).replace(/`/g, '``') + '`';
const lc = (s) => String(s).toLowerCase();

function wizard(conn, title, steps, onFinish) {
  // steps: [{ title, render(el, api) , next?(): bool, auto?: true }]
  return new Promise((resolve) => {
    let i = 0;
    let result = null;
    const w = conn.desk.open({ title, width: 760, height: 520, modal: true, owner: conn.win, minimizable: false, onClose: () => { resolve(result); return true; } });
    const side = h('div', { class: 'wb-wiz-steps' });
    const page = h('div', { class: 'wb-wiz-page' });
    const back = h('button', { class: 'lab-btn' }, '< Back');
    const next = h('button', { class: 'lab-btn primary' }, 'Next >');
    const cancel = h('button', { class: 'lab-btn' }, 'Cancel');
    w.body.appendChild(h('div', { class: 'wb-wiz' }, h('div', { class: 'wb-wiz-main' }, side, page), h('div', { class: 'wb-wiz-foot' }, h('div', { class: 'spacer' }), back, next, cancel)));
    const go = (k) => {
      i = k;
      side.innerHTML = '';
      steps.forEach((s, j) => side.appendChild(h('div', { class: 'wb-wiz-step' + (j === i ? ' cur' : j < i ? ' done' : '') }, (j < i ? '✔ ' : '') + s.title)));
      page.innerHTML = '';
      page.appendChild(h('div', { class: 'wb-wiz-title' }, steps[i].title));
      back.disabled = i === 0;
      next.disabled = false;
      next.textContent = i === steps.length - 1 ? (steps[i].finishText || 'Finish') : steps[i].nextText || 'Next >';
      steps[i].render(page, { setNext: (on) => { next.disabled = !on; } });
    };
    back.onclick = () => go(i - 1);
    cancel.onclick = () => w.close();
    next.onclick = async () => {
      const s = steps[i];
      if (s.next && (await s.next()) === false) return;
      if (i === steps.length - 1) { result = await onFinish(); w.close(true); resolve(result); return; }
      go(i + 1);
    };
    go(0);
    w.center();
  });
}

function taskList(el, items, done) {
  const box = h('div', { class: 'inst-tasks' });
  el.appendChild(box);
  const rows = items.map((t) => { const ic = h('span', { class: 'inst-tick' }, '○'); box.appendChild(h('div', { class: 'inst-task' }, ic, h('span', {}, t))); return ic; });
  let k = 0;
  const tick = () => {
    if (k > 0) { rows[k - 1].textContent = '✔'; rows[k - 1].className = 'inst-tick ok'; }
    if (k < rows.length) { rows[k].textContent = '➜'; rows[k].className = 'inst-tick cur'; k++; setTimeout(tick, 250); } else done?.();
  };
  tick();
}

/** Database > Reverse Engineer... */
export async function reverseEngineer(conn) {
  const srv = conn.lab.server;
  const dbs = srv.databaseNames().filter((d) => srv.canSeeDb(conn.session.account, d));
  const chosen = new Set(conn.session.db ? [conn.session.db] : []);
  const model = await wizard(conn, 'Reverse Engineer Database', [
    { title: 'Connection Options', render(el) { el.append(h('div', {}, 'Set Parameters for Connecting to a DBMS'), h('div', { class: 'wb-form-row' }, h('label', {}, 'Stored Connection:'), h('select', { class: 'lab-input' }, h('option', {}, conn.conn.name))), h('div', { class: 'wb-form-row' }, h('label', {}, 'Hostname:'), h('span', {}, conn.conn.host), h('label', {}, 'Port:'), h('span', {}, String(conn.conn.port))), h('div', { class: 'wb-form-row' }, h('label', {}, 'Username:'), h('span', {}, conn.conn.user))); } },
    { title: 'Connect to DBMS', render(el, api) { api.setNext(false); el.appendChild(h('div', {}, 'The following tasks will now be executed. Please monitor the execution.')); taskList(el, ['Connect to DBMS', 'Retrieve Schema List from Database', 'Check Common Server Configuration Issues'], () => api.setNext(true)); } },
    {
      title: 'Select Schemas',
      render(el) {
        el.appendChild(h('div', {}, 'Select the schemas you want to include:'));
        for (const d of dbs) {
          const cb = h('input', { type: 'checkbox', checked: chosen.has(d) });
          cb.onchange = () => { if (cb.checked) chosen.add(d); else chosen.delete(d); };
          el.appendChild(h('label', { class: 'wb-te-colrow' }, cb, ' ', h('span', { html: ICONS.db, class: 'wb-tree-ico' }), d));
        }
      },
      next() {
        if (chosen.size !== 1) { conn.desk.message({ title: 'Reverse Engineer', text: 'Simülatörde tek bir şema seçin.', icon: 'warning', owner: conn.win }); return false; }
        return true;
      },
    },
    { title: 'Retrieve Objects', render(el, api) { api.setNext(false); taskList(el, ['Retrieve Objects from Selected Schemas', 'Check Results'], () => api.setNext(true)); } },
    { title: 'Select Objects', render(el) { const ctx = srv.getDb([...chosen][0]); const n = Object.keys(ctx.meta.tables).length; el.append(h('div', {}, 'Select the schema objects to import.'), h('label', { class: 'wb-te-colrow' }, h('input', { type: 'checkbox', checked: true, disabled: true }), ` Import MySQL Table Objects — ${n} Total Objects, ${n} Selected`)); }, nextText: 'Execute >' },
    { title: 'Reverse Engineer', render(el, api) { api.setNext(false); taskList(el, ['Reverse Engineer Selected Objects', 'Place Objects on Diagram'], () => api.setNext(true)); } },
    { title: 'Results', render(el) { const ctx = srv.getDb([...chosen][0]); el.append(h('div', {}, 'Reverse Engineer Finished Successfully'), h('div', { class: 'muted' }, `Summary of Reverse Engineered Objects:\n- ${Object.keys(ctx.meta.tables).length} tables from schema '${ctx.name}'`)); } },
  ], () => buildModel(conn, [...chosen][0]));
  if (model) openEer(conn, model);
}

function buildModel(conn, db) {
  const ctx = conn.lab.server.getDb(db);
  const store = conn.lab.store;
  store.state.models ??= {};
  const prev = store.state.models[db];
  const tables = Object.keys(ctx.meta.tables).sort();
  const pos = {};
  tables.forEach((t, i) => { pos[t] = prev?.pos?.[t] || { x: 30 + (i % 4) * 230, y: 30 + Math.floor(i / 4) * 230 }; });
  const rels = [];
  for (const m of Object.values(ctx.meta.tables)) {
    for (const f of m.fks) rels.push({ name: f.name, child: m.name, childCols: f.cols.slice(), parent: lc(f.refTable), parentCols: f.refCols.slice(), identifying: f.cols.every((c) => m.pk.some((p) => lc(p) === lc(c))), existing: true });
  }
  const model = { db, pos, rels, created: Date.now() };
  store.state.models[db] = model;
  store.touch();
  return model;
}

/** EER diyagram sekmesi */
export function openEer(conn, model) {
  const existing = conn.tabs.find((t) => t.eerDb === model.db);
  if (existing) { existing.model = model; existing.render(); conn.showTab(existing); return; }
  const tab = { eerDb: model.db, model, title: `EER Diagram (${model.db})`, icon: ICONS.schemaNew, el: h('div', { class: 'eer' }), focus() {} };
  let tool = 'select';
  let pick = null; // { table, col }
  let selRel = null;
  const canvas = h('div', { class: 'eer-canvas' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'eer-svg');
  const status = h('div', { class: 'eer-status' });
  const editor = h('div', { class: 'eer-editor hidden' });
  const tools = h('div', { class: 'eer-tools' });
  const ctx = () => conn.lab.server.getDb(model.db);
  const toolBtn = (id, label, title, disabled) => {
    const b = h('button', { class: 'eer-tool' + (tool === id ? ' on' : ''), title, disabled }, label);
    b.onclick = () => { tool = id; pick = null; render(); };
    return b;
  };
  const save = () => conn.lab.store.touch();
  function render() {
    const c = ctx();
    tools.innerHTML = '';
    tools.append(toolBtn('select', '↖', 'Select (Escape)'), toolBtn('hand', '✋', 'Hand Tool', true), toolBtn('table', '▦', 'Place a New Table', true), h('div', { class: 'eer-sep' }),
      toolBtn('r11', '1:1', 'Place a New 1:1 Non-Identifying Relationship', true), toolBtn('r1n', '1:n', 'Place a New 1:n Non-Identifying Relationship', true),
      toolBtn('r11i', '1:1', 'Place a New 1:1 Identifying Relationship', true), toolBtn('r1ni', '1:n', 'Place a New 1:n Identifying Relationship', true), toolBtn('rnm', 'n:m', 'Place a New n:m Identifying Relationship', true),
      toolBtn('exist', '⇢', 'Place a Relationship Using Existing Columns'));
    status.textContent = tool === 'exist' ? (pick ? `"${pick.table}.${pick.col}" seçildi. Şimdi başvurulan tablodaki birincil anahtar (PK) sütununa tıklayın.` : 'Önce yabancı anahtar (FK) olacak sütuna, sonra başvurulan tablodaki PK sütununa tıklayın.') : 'Hazır. İlişkiyi düzenlemek için çizgiye çift tıklayın.';
    canvas.querySelectorAll('.eer-table').forEach((x) => x.remove());
    if (!c) { status.textContent = `"${model.db}" şeması bulunamadı.`; return; }
    for (const m of Object.values(c.meta.tables)) {
      model.pos[m.name] ??= { x: 40, y: 40 };
      const p = model.pos[m.name];
      const fkCols = new Set(model.rels.filter((r) => r.child === m.name).flatMap((r) => r.childCols.map(lc)));
      const box = h('div', { class: 'eer-table', style: { left: p.x + 'px', top: p.y + 'px' }, 'data-t': m.name },
        h('div', { class: 'eer-thead' }, m.name),
        ...m.columns.map((col) => {
          const isPk = m.pk.some((x) => lc(x) === lc(col.name));
          const row = h('div', { class: 'eer-col' + (pick && pick.table === m.name && pick.col === col.name ? ' pick' : '') },
            h('span', { class: 'eer-ci ' + (isPk ? 'pk' : fkCols.has(lc(col.name)) ? 'fk' : col.notNull ? 'nn' : 'n') }, isPk ? '🔑' : fkCols.has(lc(col.name)) ? '◆' : '◇'),
            h('span', {}, col.name), h('span', { class: 'eer-ct' }, typeText(col).toUpperCase()));
          row.onclick = (e) => { e.stopPropagation(); if (tool === 'exist') pickColumn(m.name, col.name); };
          return row;
        }),
        h('div', { class: 'eer-tfoot' }, 'Indexes ›'));
      dragBox(box, m.name);
      canvas.appendChild(box);
    }
    requestAnimationFrame(drawLines);
  }
  function dragBox(box, name) {
    box.querySelector('.eer-thead').addEventListener('mousedown', (e) => {
      if (tool !== 'select') return;
      e.preventDefault();
      const sx = e.clientX;
      const sy = e.clientY;
      const p0 = { ...model.pos[name] };
      const move = (ev) => {
        model.pos[name] = { x: Math.max(0, p0.x + ev.clientX - sx), y: Math.max(0, p0.y + ev.clientY - sy) };
        box.style.left = model.pos[name].x + 'px';
        box.style.top = model.pos[name].y + 'px';
        drawLines();
      };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); save(); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }
  function pickColumn(table, col) {
    if (!pick) { pick = { table, col }; render(); return; }
    if (pick.table === table) { pick = { table, col }; render(); return; }
    const c = ctx();
    const child = c.meta.tables[pick.table];
    const parent = c.meta.tables[table];
    const cc = child.columns.find((x) => x.name === pick.col);
    const pc = parent.columns.find((x) => x.name === col);
    if (!parent.pk.some((x) => lc(x) === lc(col)) && !parent.uniques.some((u) => u.cols.length === 1 && lc(u.cols[0]) === lc(col))) {
      conn.desk.message({ title: 'MySQL Workbench', text: `Başvurulan sütun (${table}.${col}) birincil anahtar ya da UNIQUE olmalıdır.`, icon: 'warning', owner: conn.win });
      pick = null;
      render();
      return;
    }
    if (cc.type !== pc.type || !!cc.unsigned !== !!pc.unsigned) {
      conn.desk.message({ title: 'MySQL Workbench', text: `Sütun türleri uyumsuz: ${pick.table}.${pick.col} (${typeText(cc)}) ↔ ${table}.${col} (${typeText(pc)}).`, detail: 'Yabancı anahtar ile başvurduğu sütunun türleri aynı olmalıdır (ör. ikisi de INT).', icon: 'warning', owner: conn.win });
      pick = null;
      render();
      return;
    }
    let n = `fk_${pick.table}_${table}`;
    let k = 1;
    while (model.rels.some((r) => r.name === n) || Object.values(c.meta.tables).some((m) => m.fks.some((f) => f.name === n && !(m.name === pick.table && lc(f.refTable) === table)))) n = `fk_${pick.table}_${table}${k++}`;
    model.rels.push({ name: n, child: pick.table, childCols: [pick.col], parent: table, parentCols: [col], identifying: false, existing: false });
    pick = null;
    tool = 'select';
    save();
    render();
    conn.lab.events.emit('eer-relationship', { db: model.db });
  }
  function drawLines() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rect = (t) => {
      const b = canvas.querySelector(`.eer-table[data-t="${CSS.escape(t)}"]`);
      return b ? { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } : null;
    };
    let maxX = 0;
    let maxY = 0;
    for (const t of canvas.querySelectorAll('.eer-table')) { maxX = Math.max(maxX, t.offsetLeft + t.offsetWidth + 40); maxY = Math.max(maxY, t.offsetTop + t.offsetHeight + 40); }
    svg.setAttribute('width', maxX);
    svg.setAttribute('height', maxY);
    for (const r of model.rels) {
      const a = rect(r.child);
      const b = rect(r.parent);
      if (!a || !b) continue;
      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      // kutu kenarındaki uçlar
      const edge = (R, x2, y2) => {
        const cx = R.x + R.w / 2;
        const cy = R.y + R.h / 2;
        const dx = x2 - cx;
        const dy = y2 - cy;
        const sx = dx === 0 ? Infinity : (R.w / 2) / Math.abs(dx);
        const sy = dy === 0 ? Infinity : (R.h / 2) / Math.abs(dy);
        const s = Math.min(sx, sy);
        return [cx + dx * s, cy + dy * s];
      };
      const [x1, y1] = edge(a, bx, by);
      const [x2, y2] = edge(b, ax, ay);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('class', 'eer-rel' + (r.identifying ? '' : ' dashed') + (selRel === r ? ' sel' : ''));
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hit.setAttribute('x1', x1); hit.setAttribute('y1', y1); hit.setAttribute('x2', x2); hit.setAttribute('y2', y2);
      hit.setAttribute('class', 'eer-hit');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${r.name}: ${r.child}.${r.childCols.join(',')} → ${r.parent}.${r.parentCols.join(',')}`;
      hit.appendChild(title);
      hit.addEventListener('click', () => { selRel = r; drawLines(); });
      hit.addEventListener('dblclick', () => { selRel = r; drawLines(); editRel(r); });
      // çok tarafı: alt tabloda üç çizgi (kaz ayağı)
      const foot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      foot.setAttribute('cx', x1); foot.setAttribute('cy', y1); foot.setAttribute('r', 4);
      foot.setAttribute('class', 'eer-foot');
      const one = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      one.setAttribute('x', x2 - 3); one.setAttribute('y', y2 - 3); one.setAttribute('width', 6); one.setAttribute('height', 6);
      one.setAttribute('class', 'eer-one');
      svg.append(line, hit, foot, one);
    }
  }
  function editRel(r) {
    editor.classList.remove('hidden');
    editor.innerHTML = '';
    const ident = h('input', { type: 'checkbox', checked: r.identifying });
    ident.onchange = () => { r.identifying = ident.checked; save(); drawLines(); };
    const caption = h('input', { class: 'lab-input', value: r.name });
    caption.oninput = () => { r.name = caption.value.trim() || r.name; save(); };
    editor.append(h('div', { class: 'eer-ed-head' }, h('b', {}, 'Relationship'), h('div', { class: 'spacer' }), h('button', { class: 'wb-mini', onclick: () => editor.classList.add('hidden') }, '✕')),
      h('div', { class: 'wb-te-subtabs top' }, h('button', { class: 'wb-nav-tab' }, 'Relationship'), h('button', { class: 'wb-nav-tab active' }, 'Foreign Key')),
      h('div', { class: 'eer-ed-body' },
        h('div', { class: 'wb-form-row' }, h('label', {}, 'Caption:'), caption),
        h('div', { class: 'wb-form-row' }, h('label', {}, 'Referencing Table:'), h('b', {}, `${r.child}`), h('span', {}, ' Column: ' + r.childCols.join(', '))),
        h('div', { class: 'wb-form-row' }, h('label', {}, 'Referenced Table:'), h('b', {}, `${r.parent}`), h('span', {}, ' Column: ' + r.parentCols.join(', '))),
        h('div', { class: 'wb-form-row' }, h('label', {}, 'Cardinality:'), h('span', {}, 'One-to-Many')),
        h('label', { class: 'wb-te-colrow' }, ident, ' Identifying Relationship'),
        h('div', { class: 'wb-form-btns' }, h('button', { class: 'lab-btn', onclick: () => { model.rels = model.rels.filter((x) => x !== r); selRel = null; editor.classList.add('hidden'); save(); render(); } }, 'Delete Relationship'))));
  }
  tab.render = render;
  tab.el.append(h('div', { class: 'edmx-bar wb-eer-bar' }, h('b', {}, `EER Diagram — ${model.db}`), h('div', { class: 'spacer' }),
    h('button', { class: 'lab-btn', onclick: () => synchronizeModel(conn, model) }, 'Database > Synchronize Model...')),
  h('div', { class: 'eer-main' }, tools, h('div', { class: 'eer-scroll' }, canvas)), status, editor);
  canvas.appendChild(svg);
  canvas.addEventListener('click', () => { if (pick && tool === 'exist') { pick = null; render(); } });
  conn.addTab(tab);
  render();
}

/** Database > Synchronize Model... */
export async function synchronizeModel(conn, model) {
  if (!model) {
    const tab = conn.tabs.find((t) => t.eerDb);
    if (!tab) { await conn.desk.message({ title: 'Synchronize Model', text: 'Açık bir model yok. Önce Database > Reverse Engineer... ile modeli oluşturun.', icon: 'info', owner: conn.win }); return; }
    model = tab.model;
  }
  const c = conn.lab.server.getDb(model.db);
  if (!c) return;
  const sql = syncScript(c, model);
  const changes = sql.split('\n').filter((l) => /^ALTER TABLE/.test(l)).length;
  const ok = await wizard(conn, 'Synchronize Model with Database', [
    { title: 'Connection Options', render(el) { el.append(h('div', {}, 'Set Parameters for Connecting to a DBMS'), h('div', { class: 'wb-form-row' }, h('label', {}, 'Stored Connection:'), h('select', { class: 'lab-input' }, h('option', {}, conn.conn.name)))); } },
    { title: 'Connect to DBMS', render(el, api) { api.setNext(false); taskList(el, ['Connect to DBMS', 'Retrieve Schema List from Database'], () => api.setNext(true)); } },
    { title: 'Select Schemas', render(el) { el.append(h('div', {}, 'Select the Schemata to be Synchronized:'), h('label', { class: 'wb-te-colrow' }, h('input', { type: 'checkbox', checked: true, disabled: true }), ` Model Schema: ${model.db}  →  Database Schema: ${model.db}`)); } },
    { title: 'Retrieve Objects', render(el, api) { api.setNext(false); taskList(el, ['Retrieve Objects from Selected Schemas', 'Compare Objects'], () => api.setNext(true)); } },
    {
      title: 'Choose Direction',
      render(el) {
        const rows = model.rels.filter((r) => !c.meta.tables[r.child]?.fks.some((f) => sameFk(f, r)));
        el.append(h('div', {}, 'Model and Database Differences'),
          rows.length ? h('table', { class: 'wb-grid' }, h('thead', {}, h('tr', {}, h('th', {}, 'Source'), h('th', {}, 'Update'), h('th', {}, 'Destination'))),
            h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, `${r.child} (${r.name})`), h('td', { class: 'c' }, '➜'), h('td', {}, `${model.db}.${r.child}`))))) : h('div', { class: 'muted' }, changes ? 'Silinecek ilişkiler var.' : 'Model ile veritabanı aynı; uygulanacak değişiklik yok.'));
      },
    },
    { title: 'Review DB Changes', render(el) { const ta = h('textarea', { class: 'wb-wiz-sql', readonly: true }); ta.value = sql || '-- değişiklik yok'; el.append(h('div', {}, 'The following SQL script will be executed on the database to synchronize it with the model.'), ta); }, finishText: 'Execute >' },
  ], async () => {
    if (!sql) return true;
    const res = conn.session.execute(sql, { stopOnError: true });
    let failed = null;
    for (const r of res) {
      conn.output(r.ok, r.sql.replace(/\s+/g, ' '), r.message, r.ms);
      conn.lab.events.emit('query', { sql: r.sql, result: r, session: conn.session, connection: conn.conn });
      if (!r.ok) failed = r;
    }
    conn.refreshTree();
    if (failed) { await conn.desk.message({ title: 'Synchronize Model', text: `ERROR ${failed.error.code}: ${failed.error.message}`, detail: failed.sql, icon: 'error', owner: conn.win }); return false; }
    for (const r of model.rels) r.existing = true;
    conn.lab.store.touch();
    await conn.desk.message({ title: 'Synchronize Model', text: 'Synchronization finished successfully.', icon: 'info', owner: conn.win });
    conn.lab.events.emit('eer-sync', { db: model.db });
    return true;
  });
  return ok;
}

function sameFk(f, r) {
  return lc(f.refTable) === lc(r.parent) && f.cols.length === r.childCols.length && f.cols.every((c, i) => lc(c) === lc(r.childCols[i])) && f.refCols.every((c, i) => lc(c) === lc(r.parentCols[i]));
}

function syncScript(c, model) {
  const out = [];
  for (const m of Object.values(c.meta.tables)) {
    const mine = model.rels.filter((r) => r.child === m.name);
    const drop = m.fks.filter((f) => !mine.some((r) => sameFk(f, r)));
    const add = mine.filter((r) => !m.fks.some((f) => sameFk(f, r)));
    if (!drop.length && !add.length) continue;
    const t = `${bq(model.db)}.${bq(m.name)}`;
    if (drop.length) out.push(`ALTER TABLE ${t} \n${drop.map((f) => `DROP FOREIGN KEY ${bq(f.name)}`).join(',\n')};`);
    if (add.length) {
      const idx = add.filter((r) => ![m.pk, ...m.uniques.map((u) => u.cols), ...m.indexes.map((u) => u.cols)].some((cols) => r.childCols.every((x, i) => cols[i] && lc(cols[i]) === lc(x))));
      if (idx.length) out.push(`ALTER TABLE ${t} \n${idx.map((r) => `ADD INDEX ${bq(r.name + '_idx')} (${r.childCols.map((x) => bq(x) + ' ASC').join(', ')}) VISIBLE`).join(',\n')};`);
      out.push(`ALTER TABLE ${t} \n${add.map((r) => `ADD CONSTRAINT ${bq(r.name)}\n  FOREIGN KEY (${r.childCols.map(bq).join(', ')})\n  REFERENCES ${bq(model.db)}.${bq(r.parent)} (${r.parentCols.map(bq).join(', ')})\n  ON DELETE NO ACTION\n  ON UPDATE NO ACTION`).join(',\n')};`);
    }
  }
  return out.join('\n');
}
