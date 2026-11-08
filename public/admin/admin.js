/* Unidos por una Patita — panel administrativo */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;
  const fmtDate = (iso, opts = { dateStyle: 'medium', timeStyle: 'short' }) => (iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', ...opts }) : '');
  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') n.className = v; else if (k === 'dataset') Object.assign(n.dataset, v); else if (k in n) n[k] = v; else n.setAttribute(k, v);
    });
    children.flat().forEach((c) => c != null && n.append(c.nodeType ? c : document.createTextNode(String(c))));
    return n;
  };

  let me = null;
  let catalog = { categories: [], statuses: [], spaceOptions: [] };
  let items = [];
  let currentId = null;

  /* ---------- API ---------- */
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/login') { showLogin(); throw new Error(data.error || 'Sesión expirada'); }
    if (!res.ok) { const err = new Error(data.error || 'Ocurrió un error.'); err.status = res.status; throw err; }
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }
  function alertIn(id, msg) { const a = $(id); a.textContent = msg || ''; a.hidden = !msg; }

  /* ---------- Sesión ---------- */
  function showLogin() {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    if ($('#detail').open) $('#detail').close();
    setTimeout(() => $('#password').focus(), 50);
  }

  async function boot() {
    try {
      const data = await api('/api/admin/me');
      me = data.admin; catalog = data.catalog;
      startApp();
    } catch { showLogin(); }
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = $('button[type=submit]', f);
    if (!f.password.value) { alertIn('#login-error', 'Escribe la clave de administración.'); return; }
    btn.disabled = true; btn.classList.add('is-loading');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password: f.password.value } });
      f.password.value = '';
      alertIn('#login-error', '');
      const data = await api('/api/admin/me');
      me = data.admin; catalog = data.catalog;
      startApp();
    } catch (err) {
      alertIn('#login-error', err.message);
    } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
  });
  $('.pwd-toggle').addEventListener('click', (e) => {
    const i = $('#password');
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    e.target.textContent = show ? 'Ocultar' : 'Ver';
    e.target.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST', body: {} }); } catch { /* ignorar */ }
    me = null; items = [];
    $('#reg-body').innerHTML = '';
    showLogin();
  });

  let started = false;
  function startApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#me-name').textContent = me.fullName;
    $('#me-role').textContent = me.role === 'admin' ? 'Administrador(a)' : 'Solo lectura';
    $('#me-initial').textContent = me.fullName.trim().charAt(0).toUpperCase();
    document.body.classList.toggle('read-only', me.role !== 'admin');
    if (!started) {
      const cat = $('#f-category');
      catalog.categories.forEach((c) => cat.add(new Option(c.label, c.value)));
      const st = $('#f-status');
      catalog.statuses.forEach((s) => st.add(new Option(s.label, s.value)));
      started = true;
    }
    refresh();
  }

  /* ---------- Pestañas ---------- */
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
    if (t.dataset.tab === 'configuracion') loadSettings();
    if (t.dataset.tab === 'cuenta') loadAdmins();
    if (t.dataset.tab === 'inscripciones') refresh();
  }));

  /* ---------- Inscripciones ---------- */
  async function refresh() {
    await Promise.all([loadStats(), loadList()]);
    $('#last-sync').textContent = `Actualizado: ${fmtDate(new Date().toISOString(), { timeStyle: 'short' })}`;
  }

  async function loadStats() {
    try {
      const s = await api('/api/admin/stats');
      const set = (k, v) => { $(`[data-stat="${k}"]`).textContent = v; };
      set('total', s.total); set('pending', s.pending); set('approved', s.approved); set('rejected', s.rejected);
      set('available', s.maxStalls ? s.availableStalls : 'Sin límite');
      set('available-note', s.maxStalls ? `de ${s.maxStalls} puestos` : 'Configúralo en Configuración');
      set('collected', money(s.collectedCop));
      set('collected-note', `${s.paidCount} pago(s) registrado(s) · esperado ${money(s.expectedCop)} por ${s.approved} aprobada(s)`);
    } catch { /* manejado en api() */ }
  }

  async function loadList() {
    const p = new URLSearchParams();
    const q = $('#f-q').value.trim();
    if (q) p.set('q', q);
    if ($('#f-category').value) p.set('category', $('#f-category').value);
    if ($('#f-status').value) p.set('status', $('#f-status').value);
    try {
      const data = await api(`/api/admin/registrations?${p}`);
      items = data.items;
      renderTable(!!(q || $('#f-category').value || $('#f-status').value));
    } catch { /* manejado */ }
  }

  function badge(status, label) { return el('span', { class: `badge badge-${status}` }, label); }

  function renderTable(filtered) {
    const body = $('#reg-body');
    body.replaceChildren(...items.map((r) => el('tr', { dataset: { id: r.id }, tabIndex: 0 },
      el('td', { class: 'cell-code' }, r.code),
      el('td', { class: 'cell-main' }, el('strong', {}, r.businessName), el('small', {}, r.fullName)),
      el('td', { class: 'cell-cat' }, r.categoryLabel),
      el('td', { class: 'cell-contact' }, r.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'), el('small', {}, r.email)),
      el('td', { class: 'cell-date' }, fmtDate(r.createdAt, { dateStyle: 'medium' })),
      el('td', { class: 'cell-status' }, badge(r.status, r.statusLabel)),
      el('td', { class: 'cell-pay' }, el('span', { class: `pay ${r.paymentReceived ? 'yes' : 'no'}` }, r.paymentReceived ? '✓ Pagado' : 'Sin pago')),
      el('td', { class: 'cell-act' }, el('button', { class: 'view-btn', type: 'button' }, 'Ver')),
    )));
    $('#empty').hidden = items.length > 0;
    $('#empty-text').textContent = filtered ? 'No hay inscripciones que coincidan con la búsqueda.' : 'Aún no hay inscripciones. Cuando alguien se inscriba aparecerá aquí. 🐾';
    $('#result-count').textContent = items.length ? `${items.length} inscripción(es) mostrada(s)` : '';
  }

  $('#reg-body').addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) openDetail(tr.dataset.id); });
  $('#reg-body').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr'); if (tr) openDetail(tr.dataset.id); } });

  let qTimer;
  $('#f-q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(loadList, 250); });
  $('#f-category').addEventListener('change', loadList);
  $('#f-status').addEventListener('change', loadList);
  $('#btn-refresh').addEventListener('click', async () => { await refresh(); toast('Información actualizada'); });

  // Mantiene la información al día mientras el panel está abierto
  setInterval(() => { if (me && !document.hidden && !$('#app-view').hidden && !$('[data-panel="inscripciones"]').hidden && !$('#detail').open) refresh(); }, 60_000);

  /* ---------- Detalle ---------- */
  const dlg = $('#detail');
  $('#d-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { currentId = null; });

  async function openDetail(id) {
    try {
      const r = await api(`/api/admin/registrations/${id}`);
      currentId = r.id;
      renderDetail(r);
      if (!dlg.open) dlg.showModal();
    } catch (err) { toast(err.message); }
  }

  function renderDetail(r) {
    const yn = (b) => (b ? 'Sí' : 'No');
    alertIn('#d-error', '');
    $('#d-code').textContent = r.code;
    $('#d-title').textContent = r.businessName;
    $('#d-sub').textContent = `Recibida el ${fmtDate(r.createdAt)}${r.reviewedBy ? ` · Revisada por ${r.reviewedBy} (${fmtDate(r.reviewedAt)})` : ''}`;

    const seg = $('#d-status');
    seg.replaceChildren(...catalog.statuses.map((s) => el('button', {
      type: 'button', role: 'radio', dataset: { v: s.value }, disabled: me.role !== 'admin',
      'aria-checked': String(r.status === s.value),
    }, s.label)));
    $('#d-paid').checked = r.paymentReceived;
    $('#d-paid').disabled = me.role !== 'admin';

    const wa = `https://wa.me/57${r.phone}?text=${encodeURIComponent(`Hola ${r.fullName.split(' ')[0]}, te escribimos de Unidos por una Patita 🐾 sobre tu inscripción ${r.code} (${r.businessName}).`)}`;
    $('#d-wa').href = wa;
    $('#d-mail').href = `mailto:${r.email}?subject=${encodeURIComponent(`Unidos por una Patita · Inscripción ${r.code}`)}`;

    const section = (title, rows) => el('div', { class: 'detail-section' }, el('h3', {}, title),
      el('dl', {}, rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v === null || v === undefined || v === '' ? '—' : v)])));
    $('#d-sections').replaceChildren(
      section('A. Datos personales', [
        ['Nombre completo', r.fullName], ['Documento', r.documentNumber], ['Celular', r.phone], ['Correo', r.email], ['Barrio', r.neighborhood],
      ]),
      section('B. Emprendimiento', [
        ['Nombre', r.businessName], ['Persona encargada', r.managerName], ['Categoría', r.categoryLabel],
        ['Descripción de productos', r.productsDescription], ['Redes sociales', r.socialMedia],
      ]),
      section('C. Puesto', [
        ['Productos que llevará', r.productsToBring], ['Espacio', r.spaceLabel], ['Necesita mesa de la organización', yn(r.needsTable)],
        ['Lleva mesa propia', yn(r.bringsOwnTable)], ['Necesita electricidad', yn(r.needsPower)], ['Solicitud especial', r.specialRequest],
      ]),
      section('D. Confirmación', [
        ['Condiciones de participación', yn(r.acceptedTerms)], ['Autorización de datos', yn(r.acceptedData)],
        ['Información verdadera', yn(r.acceptedTruth)], ['Acepta valor de inscripción', `${yn(r.acceptedFee)} (${money(r.feeCop)})`],
      ]),
    );

    const ph = $('#d-photo');
    if (r.hasPhoto) {
      const img = el('img', { class: 'detail-photo', alt: `Productos de ${r.businessName}`, loading: 'lazy', src: `/api/admin/registrations/${r.id}/photo` });
      ph.replaceChildren(el('a', { href: img.src, target: '_blank', rel: 'noopener' }, img));
    } else {
      ph.replaceChildren(el('p', { class: 'muted small' }, 'No adjuntó fotografía.'));
    }
    $('#d-notes').value = r.adminNotes || '';
    $('#d-notes').readOnly = me.role !== 'admin';
    $('#d-history').replaceChildren(...r.history.map((h) => el('li', {},
      h.detail || h.action, el('small', {}, `${fmtDate(h.createdAt)}${h.adminName ? ` · ${h.adminName}` : ''}`))));
  }

  async function patch(changes, okMsg) {
    if (!currentId) return;
    try {
      const r = await api(`/api/admin/registrations/${currentId}`, { method: 'PATCH', body: changes });
      renderDetail(r);
      toast(okMsg);
      loadStats(); loadList();
    } catch (err) {
      alertIn('#d-error', err.message);
      if (currentId) openDetail(currentId);
    }
  }

  $('#d-status').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b || b.disabled || b.getAttribute('aria-checked') === 'true') return;
    const label = b.textContent;
    patch({ status: b.dataset.v }, `Estado cambiado a «${label}»`);
  });
  $('#d-paid').addEventListener('change', (e) => patch({ paymentReceived: e.target.checked }, e.target.checked ? 'Pago registrado' : 'Pago desmarcado'));
  $('#d-save-notes').addEventListener('click', () => patch({ adminNotes: $('#d-notes').value }, 'Nota guardada'));

  /* ---------- Configuración ---------- */
  async function loadSettings() {
    try {
      const s = await api('/api/admin/settings');
      const f = $('#settings-form');
      f.maxStalls.value = s.maxStalls || '';
      f.eventAddress.value = s.eventAddress || '';
      f.instagramUrl.value = s.instagramUrl || '';
      f.lunaStory.value = s.lunaStory || '';
      $$('input, textarea', f).forEach((i) => { i.readOnly = me.role !== 'admin'; });
      showLuna(s.lunaPhotoUrl);
    } catch { /* manejado */ }
  }
  function showLuna(url) {
    $('#luna-img').hidden = !url;
    if (url) $('#luna-img').src = url;
    $('#luna-empty').hidden = !!url;
    $('#luna-remove').hidden = !url;
  }

  $('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: {
        maxStalls: f.maxStalls.value, eventAddress: f.eventAddress.value, instagramUrl: f.instagramUrl.value, lunaStory: f.lunaStory.value,
      } });
      alertIn('#settings-error', '');
      toast('Configuración guardada');
    } catch (err) { alertIn('#settings-error', err.message); }
  });

  $('#luna-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('La fotografía debe ser JPG, PNG o WebP'); return; }
    try {
      const dataUrl = await resizeImage(file, 1800, 0.88);
      const s = await api('/api/admin/settings/luna-photo', { method: 'POST', body: { photo: dataUrl } });
      showLuna(s.lunaPhotoUrl);
      toast('Fotografía de Luna actualizada 🐾');
    } catch (err) { toast(err.message || 'No se pudo subir la fotografía'); }
  });
  $('#luna-remove').addEventListener('click', async () => {
    if (!confirm('¿Quitar la fotografía de Luna de la página?')) return;
    try { const s = await api('/api/admin/settings/luna-photo', { method: 'DELETE' }); showLuna(s.lunaPhotoUrl); toast('Fotografía quitada'); }
    catch (err) { toast(err.message); }
  });

  function resizeImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer esa imagen.')); };
      img.src = url;
    });
  }

  /* ---------- Cuenta ---------- */
  async function loadAdmins() {
    try {
      const { items: admins } = await api('/api/admin/admins');
      $('#admin-list').replaceChildren(...admins.map((a) => el('li', {},
        el('span', { class: 'avatar sm' }, a.fullName.charAt(0)),
        el('div', {}, el('strong', {}, a.fullName), el('small', {}, `${a.role === 'admin' ? 'Acceso completo' : 'Solo consulta'}${a.lastLoginAt ? ` · Último ingreso: ${fmtDate(a.lastLoginAt)}` : ''}`)))));
    } catch { /* manejado */ }
  }

  $('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.newPassword.value !== f.newPassword2.value) { alertIn('#password-error', 'Las claves nuevas no coinciden.'); return; }
    try {
      await api('/api/admin/password', { method: 'POST', body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
      f.reset();
      alertIn('#password-error', '');
      toast('Clave actualizada');
    } catch (err) { alertIn('#password-error', err.message); }
  });

  boot();
})();
