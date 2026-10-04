// Öğretmen paneli: sınıflar, öğrenciler ve projeleri.
import { api, formatDate } from './api.js';
import { h, toast } from './ui.js';
import { topBar, initials, sizeText } from './projects.js';

export class TeacherView {
  constructor(ctx, studentId) {
    this.ctx = ctx;
    this.studentId = studentId;
  }

  async mount(root) {
    root.appendChild(topBar(this.ctx, 'teacher'));
    this.main = h('main', { class: 'page' });
    root.appendChild(this.main);
    if (this.studentId) await this.showStudent(this.studentId);
    else await this.showList();
  }

  async showList() {
    const savedClass = sessionStorage.getItem('ogretmen-sinif') || '';
    const classSel = h('select', { class: 'input' }, h('option', { value: '' }, 'Tüm sınıflar'));
    const search = h('input', { class: 'input', placeholder: 'Ad veya numara ara…', type: 'search' });
    const onlyStudents = h('input', { type: 'checkbox', checked: true });
    const tableHost = h('div', { class: 'table-wrap' }, h('div', { class: 'muted' }, 'Yükleniyor…'));
    this.main.appendChild(h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Öğretmen Paneli'), h('p', { class: 'muted' }, 'Öğrencilerin projelerini açıp inceleyebilir, çalıştırıp test edebilirsiniz. Öğrenci projeleri salt okunur açılır.'))));
    this.main.appendChild(h('div', { class: 'toolbar-row' },
      h('label', {}, 'Sınıf: ', classSel), search,
      h('label', { class: 'check' }, onlyStudents, ' Yalnızca öğrenciler')));
    this.main.appendChild(tableHost);

    let data;
    try {
      data = await api.students();
    } catch (e) {
      tableHost.innerHTML = '';
      tableHost.appendChild(h('div', { class: 'alert alert-error' }, e.message));
      return;
    }
    for (const c of data.classes) classSel.appendChild(h('option', { value: c, selected: c === savedClass }, c));

    const render = () => {
      const q = search.value.trim().toLocaleLowerCase('tr-TR');
      const cls = classSel.value;
      sessionStorage.setItem('ogretmen-sinif', cls);
      const rows = data.students.filter((s) =>
        (!cls || s.sinif === cls) &&
        (!onlyStudents.checked || s.role === 'ogrenci') &&
        (!q || s.name.toLocaleLowerCase('tr-TR').includes(q) || String(s.uid).includes(q)));
      tableHost.innerHTML = '';
      if (!rows.length) {
        tableHost.appendChild(h('div', { class: 'empty small' }, 'Bu filtreye uyan kullanıcı yok. Öğrenciler portal üzerinden ilk kez giriş yaptığında burada görünür.'));
        return;
      }
      const tbody = h('tbody');
      for (const s of rows) {
        const tr = h('tr', { class: 'clickable', onclick: () => { location.hash = `#/ogretmen/ogrenci/${s.id}`; } },
          h('td', {}, h('span', { class: 'avatar sm' }, initials(s.name)), ' ', h('b', {}, s.name), s.role === 'ogretmen' ? h('span', { class: 'badge badge-teacher' }, 'Öğretmen') : null),
          h('td', {}, s.uid),
          h('td', {}, s.sinif || '—'),
          h('td', { class: 'num' }, String(s.project_count)),
          h('td', {}, s.last_update ? formatDate(s.last_update) : '—'),
          h('td', {}, formatDate(s.last_login)));
        tbody.appendChild(tr);
      }
      tableHost.appendChild(h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Ad Soyad'), h('th', {}, 'No'), h('th', {}, 'Sınıf'), h('th', { class: 'num' }, 'Proje'), h('th', {}, 'Son proje değişikliği'), h('th', {}, 'Son giriş'))),
        tbody));
      tableHost.appendChild(h('div', { class: 'muted small' }, `${rows.length} kullanıcı`));
    };
    classSel.onchange = render;
    search.oninput = render;
    onlyStudents.onchange = render;
    render();
  }

  async showStudent(id) {
    this.main.appendChild(h('a', { href: '#/ogretmen', class: 'back-link' }, '← Öğrenci listesi'));
    const host = h('div', {}, h('div', { class: 'muted' }, 'Yükleniyor…'));
    this.main.appendChild(host);
    let data;
    try {
      data = await api.studentProjects(id);
    } catch (e) {
      host.innerHTML = '';
      host.appendChild(h('div', { class: 'alert alert-error' }, e.message));
      return;
    }
    const s = data.student;
    host.innerHTML = '';
    host.appendChild(h('div', { class: 'page-head' },
      h('div', { class: 'student-head' }, h('span', { class: 'avatar lg' }, initials(s.name)),
        h('div', {}, h('h1', {}, s.name), h('p', { class: 'muted' }, `No: ${s.uid}${s.sinif ? ' · Sınıf: ' + s.sinif : ''} · ${data.projects.length} proje`)))));
    if (!data.projects.length) {
      host.appendChild(h('div', { class: 'empty small' }, 'Bu öğrencinin henüz projesi yok.'));
      return;
    }
    const grid = h('div', { class: 'project-grid' });
    for (const p of data.projects) {
      const open = () => { location.hash = `#/proje/${p.id}`; };
      grid.appendChild(h('div', { class: 'project-card', ondblclick: open },
        h('div', { class: 'project-thumb', onclick: open }, h('div', { class: 'mini-window' }, h('div', { class: 'mini-title' }), h('div', { class: 'mini-body' }, h('i'), h('i'), h('b')))),
        h('div', { class: 'project-info' },
          h('div', { class: 'project-name', title: p.name }, p.name),
          h('div', { class: 'project-meta' }, 'Son değişiklik: ', formatDate(p.updated_at), ' · ', sizeText(p.size)),
          p.has_note ? h('div', { class: 'note-badge' }, '\u{1F4DD} Not yazılmış') : null),
        h('div', { class: 'project-actions' },
          h('button', { class: 'btn btn-primary btn-sm', onclick: open }, 'İncele / Çalıştır'),
          h('button', {
            class: 'btn btn-sm',
            onclick: async () => {
              try {
                const r = await api.copyProject(p.id, `${p.name} (${s.name})`);
                toast('Projenin kopyası kendi projelerinize eklendi.', 'success');
                location.hash = `#/proje/${r.id}`;
              } catch (e) { toast(e.message, 'error'); }
            },
          }, 'Kopyasını al'))));
    }
    host.appendChild(grid);
  }
}
