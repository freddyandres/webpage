/* Unidos por una Patita — interacción de la página pública */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  document.documentElement.classList.remove('no-js');
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- Encabezado y menú ---------- */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const toggle = $('.nav-toggle');
  const nav = $('#menu-principal');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    $('.sr-only', toggle).textContent = open ? 'Cerrar menú' : 'Abrir menú';
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Resalta la sección actual en el menú
  const navLinks = $$('.main-nav a[href^="#"]:not(.btn)');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${en.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach((a) => { const s = $(a.getAttribute('href')); if (s) spy.observe(s); });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    $$('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Diálogos ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-dialog]');
    if (!b) return;
    e.preventDefault();
    const d = document.getElementById(b.dataset.openDialog);
    if (d && d.showModal) d.showModal();
  });
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  /* ---------- Acordeón (animado, uno abierto a la vez) ---------- */
  const faq = $$('#faq details');
  faq.forEach((d) => {
    const summary = $('summary', d);
    const answer = $('.answer', d);
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.classList.contains('animating')) return;
      const opening = !d.open;
      if (opening) faq.forEach((o) => { if (o !== d && o.open) collapse(o); });
      opening ? expand(d, answer) : collapse(d);
    });
  });
  function expand(d, answer) {
    d.open = true;
    const h = answer.scrollHeight;
    answer.style.height = '0px'; answer.style.opacity = '0';
    d.classList.add('animating');
    requestAnimationFrame(() => { answer.style.height = `${h}px`; answer.style.opacity = '1'; });
    setTimeout(() => { d.classList.remove('animating'); answer.style.height = ''; answer.style.opacity = ''; }, 360);
  }
  function collapse(d) {
    const answer = $('.answer', d);
    answer.style.height = `${answer.scrollHeight}px`;
    d.classList.add('animating');
    requestAnimationFrame(() => { answer.style.height = '0px'; answer.style.opacity = '0'; });
    setTimeout(() => { d.open = false; d.classList.remove('animating'); answer.style.height = ''; answer.style.opacity = ''; }, 360);
  }

  /* ---------- Configuración pública ---------- */
  let siteConfig = null;
  const configReady = fetch('/api/public/config').then((r) => r.json()).then((cfg) => {
    siteConfig = cfg;
    applyConfig(cfg);
    return cfg;
  }).catch(() => null);

  function applyConfig(cfg) {
    const select = $('#category');
    cfg.categories.forEach((c) => select.add(new Option(c.label, c.value)));
    const space = $('#space-options');
    cfg.spaceOptions.forEach((o) => {
      const l = document.createElement('label');
      l.className = 'choice';
      l.innerHTML = '<input type="radio" name="spaceNeeded"><span></span>';
      l.querySelector('input').value = o.value;
      l.querySelector('span').textContent = o.label;
      space.appendChild(l);
    });
    if (cfg.lunaPhotoUrl) {
      const img = $('#luna-photo');
      img.src = cfg.lunaPhotoUrl; img.hidden = false; $('#luna-placeholder').hidden = true;
      const s = $('#luna-story-photo');
      s.src = cfg.lunaPhotoUrl; s.hidden = false; $('#luna-story-illustration').hidden = true;
    }
    if (cfg.lunaStory) {
      const t = $('#luna-story-text');
      t.textContent = cfg.lunaStory; t.classList.remove('muted');
    }
    if (cfg.instagramUrl) {
      const a = document.createElement('a');
      a.href = cfg.instagramUrl; a.target = '_blank'; a.rel = 'noopener'; a.className = 'c-value';
      a.textContent = `@${cfg.instagramUrl.replace(/^https:\/\/(www\.)?instagram\.com\//, '').replace(/[/?].*$/, '')}`;
      $('#instagram-value').replaceWith(a);
    }
    if (cfg.eventAddress) $('#address-value').textContent = cfg.eventAddress;
  }

  /* ---------- Formulario por pasos ---------- */
  const form = $('#registration-form');
  const steps = $$('.form-step', form);
  const indicators = $$('[data-step-indicator]');
  const btnPrev = $('#btn-prev');
  const btnNext = $('#btn-next');
  const btnSubmit = $('#btn-submit');
  let current = 0;
  let photoDataUrl = null;
  let idempotencyKey = newKey();

  function newKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}xxxxxxxx`;
  }

  const FIELDS_BY_STEP = [
    ['fullName', 'documentNumber', 'phone', 'email', 'neighborhood'],
    ['businessName', 'managerName', 'category', 'productsDescription', 'socialMedia', 'photo'],
    ['productsToBring', 'spaceNeeded', 'needsTable', 'bringsOwnTable', 'needsPower', 'specialRequest'],
    ['acceptTerms', 'acceptData', 'acceptTruth', 'acceptFee'],
  ];

  const val = (n) => {
    const el = form.elements[n];
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    if (el.type === 'checkbox') return el.checked;
    return el.value.trim();
  };

  const RULES = {
    fullName: (v) => (!v ? 'Por favor escribe tu nombre completo.' : v.length < 5 ? 'Escribe tu nombre y apellido.' : ''),
    documentNumber: (v) => (v && !/^[0-9A-Za-z.\- ]{4,20}$/.test(v) ? 'El documento solo puede contener números y letras (4 a 20).' : ''),
    phone: (v) => {
      const d = v.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
      if (!v) return 'Por favor escribe tu número de celular.';
      return /^3\d{9}$/.test(d) ? '' : 'Escribe un celular colombiano válido de 10 dígitos (por ejemplo 300 123 4567).';
    },
    email: (v) => (!v ? 'Por favor escribe tu correo electrónico.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'El correo electrónico no parece válido.'),
    neighborhood: (v) => (!v ? 'Por favor escribe tu barrio de residencia.' : ''),
    businessName: (v) => (!v ? 'Por favor escribe el nombre del emprendimiento.' : v.length < 2 ? 'El nombre es demasiado corto.' : ''),
    managerName: (v) => (!v ? 'Por favor escribe el nombre de la persona encargada.' : v.length < 3 ? 'El nombre es demasiado corto.' : ''),
    category: (v) => (!v ? 'Por favor elige una categoría.' : ''),
    productsDescription: (v) => (!v ? 'Cuéntanos qué productos ofreces.' : v.length < 10 ? 'Describe un poco más tus productos (mínimo 10 caracteres).' : ''),
    productsToBring: (v) => (!v ? 'Cuéntanos qué productos llevarás.' : v.length < 3 ? 'Escribe un poco más.' : ''),
    spaceNeeded: (v) => (!v ? 'Cuéntanos cuánto espacio necesitas.' : ''),
    needsTable: (v) => (!v ? 'Indica si necesitas que la organización te proporcione una mesa.' : ''),
    bringsOwnTable: (v) => (!v ? 'Indica si llevarás tu propia mesa.' : ''),
    needsPower: (v) => (!v ? 'Indica si necesitas conexión eléctrica.' : ''),
    specialRequest: (v) => (val('spaceNeeded') === 'otro' && !v ? 'Elegiste «Otro» en el espacio: explícanos aquí lo que necesitas.' : ''),
    acceptTerms: (v) => (v ? '' : 'Debes aceptar las condiciones de participación.'),
    acceptData: (v) => (v ? '' : 'Debes autorizar el uso de tus datos para organizar el evento.'),
    acceptTruth: (v) => (v ? '' : 'Debes confirmar que la información es verdadera.'),
    acceptFee: (v) => (v ? '' : 'Debes aceptar el valor de inscripción de $10.000 COP por puesto.'),
  };

  function fieldWrap(name) {
    const el = form.elements[name];
    const node = el instanceof RadioNodeList ? el[0] : el;
    return node ? (node.closest('.check') || node.closest('.field')) : null;
  }

  function errorNode(name) {
    let n = form.querySelector(`[data-error-for="${name}"]`);
    if (!n) {
      const wrap = fieldWrap(name);
      if (!wrap) return null;
      n = document.createElement('p');
      n.className = 'field-error';
      n.dataset.errorFor = name;
      n.id = `err-${name}`;
      wrap.appendChild(n);
    }
    return n;
  }

  function setError(name, msg) {
    const wrap = fieldWrap(name);
    const node = errorNode(name);
    if (wrap) wrap.classList.toggle('has-error', !!msg);
    if (node) { node.textContent = msg || ''; if (!node.id) node.id = `err-${name}`; }
    const el = form.elements[name];
    const inputs = el instanceof RadioNodeList ? [...el] : el ? [el] : [];
    inputs.forEach((i) => {
      i.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (node) i.setAttribute('aria-describedby', node.id);
    });
  }

  function validateField(name) {
    const rule = RULES[name];
    if (!rule) return '';
    const msg = rule(val(name));
    setError(name, msg);
    return msg;
  }

  function validateStep(i) {
    let first = null;
    FIELDS_BY_STEP[i].forEach((n) => {
      if (validateField(n) && !first) first = n;
    });
    if (first) {
      const el = form.elements[first];
      const node = el instanceof RadioNodeList ? el[0] : el;
      if (node) { node.focus({ preventScroll: true }); node.closest('.field, .check').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      showAlert('Revisa los campos marcados para continuar.');
      return false;
    }
    hideAlert();
    return true;
  }

  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (n && fieldWrap(n)?.classList.contains('has-error')) validateField(n);
  });
  form.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n && RULES[n]) validateField(n);
    if (n === 'spaceNeeded' && fieldWrap('specialRequest')?.classList.contains('has-error')) validateField('specialRequest');
  });
  form.addEventListener('focusout', (e) => {
    const n = e.target.name;
    if (n && RULES[n] && e.target.value && e.target.type !== 'radio' && e.target.type !== 'checkbox') validateField(n);
  });

  // Coherencia: si la organización le proporciona mesa, normalmente no llevará la suya (y viceversa)
  form.addEventListener('change', (e) => {
    if (e.target.name === 'needsTable' && e.target.value === 'si' && !val('bringsOwnTable')) form.elements.bringsOwnTable.value = 'no';
    if (e.target.name === 'bringsOwnTable' && e.target.value === 'si' && !val('needsTable')) form.elements.needsTable.value = 'no';
  });

  $('#same-as-me').addEventListener('click', () => {
    form.elements.managerName.value = val('fullName');
    validateField('managerName');
  });

  function showAlert(msg) { const a = $('#form-alert'); a.textContent = msg; a.hidden = false; }
  function hideAlert() { $('#form-alert').hidden = true; }

  function goTo(i, { focus = true } = {}) {
    current = i;
    steps.forEach((s, k) => { s.hidden = k !== i; s.classList.toggle('is-active', k === i); });
    indicators.forEach((ind, k) => {
      ind.classList.toggle('is-active', k === i);
      ind.classList.toggle('is-done', k < i);
      if (k === i) ind.setAttribute('aria-current', 'step'); else ind.removeAttribute('aria-current');
    });
    btnPrev.hidden = i === 0;
    btnNext.hidden = i === steps.length - 1;
    btnSubmit.hidden = i !== steps.length - 1;
    $('#step-count').textContent = `Paso ${i + 1} de ${steps.length}`;
    if (i === steps.length - 1) renderSummary();
    if (focus) {
      $('#form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstInput = steps[i].querySelector('input:not([type=hidden]), select, textarea');
      if (firstInput) setTimeout(() => firstInput.focus({ preventScroll: true }), 350);
    }
  }

  btnNext.addEventListener('click', () => { if (validateStep(current)) goTo(current + 1); });
  btnPrev.addEventListener('click', () => { hideAlert(); goTo(current - 1); });

  function renderSummary() {
    const cfg = siteConfig || { categories: [], spaceOptions: [] };
    const label = (list, v) => (list.find((o) => o.value === v) || {}).label || v;
    const yn = (v) => (v === 'si' ? 'Sí' : v === 'no' ? 'No' : '—');
    const rows = [
      ['Nombre', val('fullName')],
      ['Celular', val('phone')],
      ['Correo', val('email')],
      ['Emprendimiento', val('businessName')],
      ['Categoría', label(cfg.categories, val('category'))],
      ['Espacio', label(cfg.spaceOptions, val('spaceNeeded'))],
      ['Mesa de la organización', yn(val('needsTable'))],
      ['Mesa propia', yn(val('bringsOwnTable'))],
      ['Electricidad', yn(val('needsPower'))],
      ['Fotografía', photoDataUrl ? 'Adjunta' : 'Sin fotografía'],
    ];
    const box = $('#summary');
    box.innerHTML = '<h4>Revisa tu información</h4><dl></dl>';
    const dl = $('dl', box);
    rows.forEach(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v || '—';
      dl.append(dt, dd);
    });
  }

  /* ---------- Fotografía (se reduce en el navegador antes de enviarla) ---------- */
  const photoInput = $('#photo');
  const dz = $('#dropzone');
  photoInput.addEventListener('change', () => handlePhoto(photoInput.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) handlePhoto(e.dataTransfer.files[0]); });
  $('.dz-remove').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearPhoto(); });

  function clearPhoto() {
    photoDataUrl = null;
    photoInput.value = '';
    $('.dz-preview').hidden = true;
    $('.dz-empty').hidden = false;
    setError('photo', '');
  }

  async function handlePhoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { clearPhoto(); setError('photo', 'La fotografía debe ser una imagen JPG, PNG o WebP.'); return; }
    if (file.size > 10 * 1024 * 1024) { clearPhoto(); setError('photo', 'La fotografía es demasiado pesada (máximo 10 MB).'); return; }
    try {
      photoDataUrl = await resizeImage(file, 1600, 0.85);
      $('.dz-preview img').src = photoDataUrl;
      $('.dz-preview').hidden = false;
      $('.dz-empty').hidden = true;
      setError('photo', '');
    } catch {
      clearPhoto();
      setError('photo', 'No pudimos leer esa imagen. Prueba con otra.');
    }
  }

  function resizeImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let q = quality, out = c.toDataURL('image/jpeg', q);
        while (out.length > 2.8 * 1024 * 1024 * 1.37 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }

  /* ---------- Envío ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (let i = 0; i < steps.length; i++) {
      if (!validateStepSilently(i)) { goTo(i, { focus: false }); validateStep(i); return; }
    }
    const payload = {
      fullName: val('fullName'), documentNumber: val('documentNumber'), phone: val('phone'), email: val('email'), neighborhood: val('neighborhood'),
      businessName: val('businessName'), managerName: val('managerName'), category: val('category'), productsDescription: val('productsDescription'),
      socialMedia: val('socialMedia'), photo: photoDataUrl,
      productsToBring: val('productsToBring'), spaceNeeded: val('spaceNeeded'), needsTable: val('needsTable'), bringsOwnTable: val('bringsOwnTable'),
      needsPower: val('needsPower'), specialRequest: val('specialRequest'),
      acceptTerms: val('acceptTerms'), acceptData: val('acceptData'), acceptTruth: val('acceptTruth'), acceptFee: val('acceptFee'),
      website: form.elements.website.value, idempotencyKey,
    };
    btnSubmit.disabled = true; btnSubmit.classList.add('is-loading');
    try {
      const res = await fetch('/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { showConfirmation(data.code); return; }
      if (res.status === 422 && data.fields) {
        Object.entries(data.fields).forEach(([k, v]) => setError(k, v));
        const firstStep = FIELDS_BY_STEP.findIndex((list) => list.some((f) => data.fields[f]));
        goTo(Math.max(0, firstStep), { focus: false });
        showAlert(data.error || 'Revisa los campos marcados.');
        $('#form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        showAlert(data.error || 'No pudimos enviar tu inscripción. Revisa tu conexión e inténtalo de nuevo.');
      }
    } catch {
      showAlert('No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo; tu información sigue aquí.');
    } finally {
      btnSubmit.disabled = false; btnSubmit.classList.remove('is-loading');
    }
  });

  function validateStepSilently(i) {
    return FIELDS_BY_STEP[i].every((n) => !RULES[n] || !RULES[n](val(n)));
  }

  function showConfirmation(code) {
    $('#form-card').hidden = true;
    const card = $('#confirm-card');
    $('#confirm-code').textContent = code;
    card.hidden = false;
    const conf = $('.confetti', card);
    conf.innerHTML = '';
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 1.2}s`;
      p.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      conf.appendChild(p);
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
    try { sessionStorage.setItem('upp:last', code); } catch { /* sin almacenamiento */ }
  }

  $('#btn-copy').addEventListener('click', async () => {
    const code = $('#confirm-code').textContent;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const r = document.createRange(); r.selectNodeContents($('#confirm-code'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      document.execCommand('copy');
      s.removeAllRanges();
    }
    const label = $('#btn-copy span');
    label.textContent = '¡Copiado!';
    toast(`Número ${code} copiado 🐾`);
    setTimeout(() => { label.textContent = 'Copiar número'; }, 2200);
  });

  $('#btn-new').addEventListener('click', () => {
    // Conserva los datos personales para facilitar inscribir otro emprendimiento
    const keep = Object.fromEntries(FIELDS_BY_STEP[0].map((n) => [n, val(n)]));
    form.reset();
    Object.entries(keep).forEach(([k, v]) => { form.elements[k].value = v; });
    clearPhoto();
    $$('.has-error', form).forEach((n) => n.classList.remove('has-error'));
    $$('.field-error', form).forEach((n) => { n.textContent = ''; });
    idempotencyKey = newKey();
    $('#confirm-card').hidden = true;
    $('#form-card').hidden = false;
    goTo(1);
  });

  /* ---------- Consulta del estado ---------- */
  $('#lookup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const out = $('#lookup-result');
    out.textContent = 'Consultando…';
    try {
      const res = await fetch('/api/registrations/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: f.code.value, phone: f.phone.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { out.textContent = data.error || 'No fue posible consultar en este momento.'; return; }
      out.innerHTML = '';
      const strong = document.createElement('strong'); strong.textContent = `${data.code} · ${data.businessName}`;
      const badge = document.createElement('span'); badge.className = `badge badge-${data.status}`; badge.textContent = data.statusLabel;
      out.append(strong, document.createTextNode(' — Estado: '), badge);
    } catch {
      out.textContent = 'No pudimos conectarnos. Inténtalo de nuevo.';
    }
  });

  configReady.then(() => goTo(0, { focus: false }));
})();
