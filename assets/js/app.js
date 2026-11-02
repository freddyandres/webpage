/*
 * Generales de Dios — interacciones y animaciones.
 * JavaScript sin dependencias. Contenido en data.js, emblemas en icons.js, mapa en world.js.
 */
(function () {
  'use strict';

  const D = window.GD;
  const ICONS = window.GD_ICONS || {};
  const WORLD = window.GD_WORLD;
  if (!D) return;

  /* ================================================================ UTILIDADES */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtNum = (n) => (n >= 10000 || n >= 1000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n));
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const safeStore = { get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } } };

  function svgIcon(name, cls) {
    const inner = ICONS[name] || ICONS.estrella || '';
    return `<svg class="ico-svg${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
  }
  function hydrateIcons(root) { $$('[data-icon]', root || document).forEach((el) => { if (!el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', svgIcon(el.dataset.icon)); }); }

  /* --------------------------------------------------------------- imágenes */
  const IMG_BASE = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
  const imgURL = (g, w) => (g && g.img ? `${IMG_BASE}${encodeURIComponent(g.img)}?width=${g.w ? Math.min(w, g.w) : w}` : '');
  const commonsPage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
  const altOf = (g) => `${g.nombre}${g.cred ? ' — ' + g.cred : ''}`;
  const imgTag = (g, w, extra) => (g.img ? `<img src="${imgURL(g, w)}" alt="${esc(altOf(g))}" loading="${extra === 'eager' ? 'eager' : 'lazy'}" decoding="async" data-gimg>` : '');
  const medallion = (g) => `<div class="medallion" aria-hidden="true"><div class="ring">${svgIcon(g.icono)}</div></div>`;
  const avatar = (g, w) => `<i class="av" style="--c:${g.c}">${svgIcon(g.icono)}${g.img ? `<img src="${imgURL(g, w || 120)}" alt="" loading="lazy" decoding="async" data-gimg>` : ''}</i>`;

  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-gimg')) {
      t.classList.add('ok');
      const h = t.closest('.has-img');
      if (h) h.classList.add('img-ok');
    }
  }, true);
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-gimg')) t.remove();
  }, true);

  /* ===================================================================== DATOS */
  const SALAS = D.salas;
  const GEN = D.generales;
  const byId = Object.create(null);
  const salaOf = (g) => SALAS[g.sala - 1];
  const CATS = [
    ['Patriarcas, reyes y profetas', ['Patriarca', 'Profeta', 'Juez', 'Rey', 'Reina', 'Líder']],
    ['Apóstoles y discípulos', ['Apóstol', 'Discípula', 'Diácono', 'Maestro']],
    ['Mártires', ['Mártir']],
    ['Reformadores y precursores', ['Reformador', 'Precursor']],
    ['Traductores de la Biblia', ['Traductor']],
    ['Teólogos y obispos', ['Teólogo', 'Padre de la Iglesia', 'Obispo']],
    ['Avivadores', ['Avivador']],
    ['Evangelistas y predicadores', ['Evangelista', 'Predicador', 'Colportor']],
    ['Misioneros', ['Misionero', 'Explorador']],
    ['Pastores', ['Pastor']],
    ['Reformadores sociales y educadores', ['Reformador social', 'Educador', 'Político', 'Rescatadora']],
  ];
  GEN.forEach((g, i) => {
    g.idx = i;
    g.c = salaOf(g).color;
    g.cats = CATS.filter(([, rs]) => g.roles.some((r) => rs.includes(r))).map(([n]) => n);
    g.search = norm([g.nombre, g.titulo, g.lugar, g.pais.join(' '), g.region.join(' '), g.roles.join(' '), g.cats.join(' '), g.resumen, g.mujer ? 'mujer mujeres misionera' : ''].join(' '));
    byId[g.id] = g;
  });
  const bySala = SALAS.map((s) => GEN.filter((g) => g.sala === s.n));
  const PAISES = new Set(GEN.flatMap((g) => g.pais));

  /* =================================================================== ENTRADA */
  const root = document.documentElement;
  function finishLoading() {
    if (finishLoading.done) return;
    finishLoading.done = true;
    const pre = $('#preloader');
    if (pre) pre.classList.add('done');
    root.classList.remove('loading');
    document.body.classList.remove('is-loading');
    safeStore.set('gd-pre', '1');
    Hero.start();
    const h = decodeURIComponent(location.hash || '');
    if (h.startsWith('#general/')) {
      const id = h.slice(9);
      if (byId[id]) setTimeout(() => Profile.open(id), 500);
    } else if (h.startsWith('#sala-') || h === '#linea' || h === '#mapa' || h === '#ciudades' || h === '#antorcha' || h === '#explorar') {
      const el = $(h);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'auto' }), 60);
    }
  }
  function initPreloader() {
    const seen = safeStore.get('gd-pre') === '1';
    const min = RM || seen ? 150 : 1500;
    const t0 = performance.now();
    const go = () => setTimeout(finishLoading, Math.max(0, min - (performance.now() - t0)));
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    setTimeout(finishLoading, 3200);
  }

  /* ==================================================================== REVELADO */
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }) : null;
  function observe(el) { if (!el) return; if (revealIO) revealIO.observe(el); else el.classList.add('in'); }
  function observeAll(rootEl) { $$('[data-reveal], .split, [data-io]', rootEl || document).forEach((el) => { if (!el.closest('#inicio')) observe(el); }); }

  function splitText(el) {
    if (el.dataset.splitDone) return;
    const text = el.textContent.trim();
    el.textContent = '';
    el.classList.add('split');
    const sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = text;
    el.appendChild(sr);
    let i = 0;
    text.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of tok) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', i++);
        s.textContent = ch;
        w.appendChild(s);
      }
      el.appendChild(w);
    });
    el.dataset.splitDone = '1';
  }

  function countUp(el, to, dur) {
    if (RM) { el.textContent = fmtNum(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      el.textContent = fmtNum(Math.round(to * easeOut(p)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ======================================================================= HERO */
  const Hero = (() => {
    const cv = $('#hero-canvas');
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    let W = 0, H = 0, parts = [], running = false, visible = true, mx = 0.5, my = 0.5, sprite = null, started = false;

    function makeSprite() {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const c = s.getContext('2d');
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,244,214,1)');
      g.addColorStop(0.18, 'rgba(255,196,110,.85)');
      g.addColorStop(0.45, 'rgba(255,130,40,.28)');
      g.addColorStop(1, 'rgba(255,100,20,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      return s;
    }
    function spawn(init) {
      const z = Math.random();
      return { x: Math.random() * W, y: init ? Math.random() * H : H + 20, z, r: 2 + z * 9 + Math.random() * 3, vy: -(0.18 + z * 0.75 + Math.random() * 0.25), vx: (Math.random() - 0.5) * 0.2, a: 0.25 + Math.random() * 0.55, tw: Math.random() * Math.PI * 2, ts: 0.02 + Math.random() * 0.04 };
    }
    function resize() {
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((W * H) / 8500, 50, 190));
      parts = Array.from({ length: n }, () => spawn(true));
      if (RM) draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        const al = p.a * (0.55 + 0.45 * Math.sin(p.tw));
        const s = p.r * 2;
        ctx.globalAlpha = al;
        ctx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    function frame() {
      if (!running) return;
      for (const p of parts) {
        p.tw += p.ts;
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.tw * 0.6) * 0.18 + (mx - 0.5) * p.z * 0.6;
        if (p.y < -30 || p.x < -40 || p.x > W + 40) Object.assign(p, spawn(false));
      }
      draw();
      requestAnimationFrame(frame);
    }
    function play() { if (running || RM || !ctx) return; running = true; requestAnimationFrame(frame); }
    function pause() { running = false; }
    function init() {
      if (!ctx) return;
      sprite = makeSprite();
      resize();
      window.addEventListener('resize', debounce(resize, 200));
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !document.hidden) play(); else pause(); }).observe(cv);
      }
      document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (visible) play(); });
      if (FINE) window.addEventListener('pointermove', (e) => { mx = e.clientX / window.innerWidth; my = e.clientY / window.innerHeight; }, { passive: true });
      play();
    }
    function start() {
      if (started) return;
      started = true;
      const lines = $$('#hero-title [data-split]');
      lines.forEach((el, i) => { el.style.setProperty('--d', `${0.15 + i * 0.28}s`); });
      requestAnimationFrame(() => {
        $$('#inicio [data-reveal], #inicio .split, #hero-title').forEach((el) => el.classList.add('in'));
        setTimeout(() => $$('#hero-stats [data-count]').forEach((el) => countUp(el, +el.dataset.count, 2000)), 1500);
      });
    }
    return { init, start };
  })();

  function renderHero() {
    const stats = [[GEN.length, 'generales'], [SALAS.length, 'salas'], [4000, 'años de historia'], [PAISES.size, 'naciones y territorios']];
    $('#hero-stats').innerHTML = stats.map(([n, l]) => `<div><dt><span aria-hidden="true" data-count="${n}">0</span><span class="visually-hidden">${fmtNum(n)}</span></dt><dd>${l}</dd></div>`).join('');
    $$('#hero-title [data-split]').forEach(splitText);
    const names = GEN.map((g) => g.nombre);
    const row = names.map((n) => `<span>${esc(n)}</span><span class="star">✦</span>`).join('');
    $('#marquee').innerHTML = row + row;
  }

  /* ============================================================ SALAS Y CORREDOR */
  function salaCard(s) {
    const gs = bySala[s.n - 1];
    const faces = gs.slice(0, 4).map((g) => avatar(g, 120)).join('');
    return `<li><a class="sala-card" href="#sala-${s.n}" style="--c:${s.color}">
      <span class="num">${s.num}</span>
      <span class="per">${esc(s.periodo)}</span>
      <h3>${esc(s.titulo)}</h3>
      <span class="cnt"><span>${gs.length} generales</span><span class="faces">${faces}</span></span>
    </a></li>`;
  }

  function genCard(g, i, total) {
    const s = salaOf(g);
    return `<button class="gcard ${g.img ? 'has-img' : ''}" type="button" data-open="${g.id}" style="--c:${g.c}" aria-label="${esc(g.nombre)}: ${esc(g.titulo)}. Ver vida y obra">
      <span class="media">${medallion(g)}${imgTag(g, 500)}</span>
      <span class="shade"></span><span class="spot"></span>
      <span class="badge">${s.num} · ${pad2(i + 1)}/${pad2(total)}</span>
      <span class="ico">${svgIcon(g.icono)}</span>
      <span class="body">
        <span class="dates">${esc(g.fechas)}</span>
        <span class="nm">${esc(g.nombre)}</span>
        <span class="epi">${esc(g.titulo)}</span>
        <span class="sum">${esc(g.resumen)}</span>
        <span class="foot"><span class="place">${svgIcon('pin')}<span>${esc(g.lugar)}</span></span><span class="go">Vida y obra <span data-icon="flecha"></span></span></span>
      </span>
    </button>`;
  }

  function salaSection(s) {
    const gs = bySala[s.n - 1];
    const next = SALAS[s.n];
    const exit = next
      ? `<a class="exit-card" href="#sala-${next.n}"><small>Siguiente sala</small><strong>${next.num} · ${esc(next.titulo)}</strong><span class="arrow">${svgIcon('siguiente')}</span></a>`
      : `<a class="exit-card" href="#linea"><small>Fin de las salas</small><strong>Ver la línea del tiempo</strong><span class="arrow">${svgIcon('siguiente')}</span></a>`;
    return `<section class="sala" id="sala-${s.n}" data-sala="${s.n}" style="--c:${s.color}" aria-labelledby="sala-${s.n}-t">
      <header class="sala-head">
        <div class="sala-num" aria-hidden="true">${s.num}</div>
        <div class="container"><div class="sala-content">
          <p class="kicker sala-kicker" data-reveal>Sala ${s.num} · ${esc(s.periodo)}</p>
          <h2 class="sala-title" id="sala-${s.n}-t" data-split>${esc(s.titulo)}</h2>
          <p class="sala-intro" data-reveal style="--d:.15s">${esc(s.intro)}</p>
          <blockquote class="sala-verse" data-reveal style="--d:.3s">«${esc(s.verso.t)}»<cite>${esc(s.verso.r)}</cite></blockquote>
          <div class="sala-meta" data-reveal style="--d:.45s">
            <span class="pill">${svgIcon('usuarios')}${gs.length} generales</span>
            <button class="btn btn-ghost btn-sm" type="button" data-tour-start="${s.n}"><span data-icon="play"></span><span>Tour de esta sala</span></button>
          </div>
        </div></div>
      </header>
      <div class="corridor">
        <div class="corridor-sticky">
          <div class="corridor-track">
            <div class="entry-card"><span class="num">${s.num}</span><h3>${esc(s.titulo)}</h3><p>${gs.length} retratos en esta sala. Desplázate para recorrerla y toca cualquiera para abrir su vida y obra.</p></div>
            ${gs.map((g, i) => genCard(g, i, gs.length)).join('')}
            ${exit}
          </div>
          <div class="corridor-foot"><span class="corridor-hint">Recorre la sala <span data-icon="flecha"></span></span><div class="corridor-bar"><span></span></div><span class="corridor-count">01 / ${pad2(gs.length)}</span></div>
        </div>
      </div>
    </section>`;
  }

  const Corridors = (() => {
    let list = [];
    let isStatic = false;
    function decideStatic() { return RM || window.innerWidth < 900; }
    function measure() {
      isStatic = decideStatic();
      document.body.classList.toggle('static-corridors', isStatic);
      list.forEach((c) => {
        if (isStatic) { c.el.style.height = ''; c.track.style.transform = ''; c.dist = 0; return; }
        const last = c.track.lastElementChild;
        const pr = parseFloat(getComputedStyle(c.track).paddingRight) || 0;
        const total = last.offsetLeft + last.offsetWidth + pr;
        c.dist = Math.max(0, total - c.sticky.clientWidth);
        c.el.style.height = `${c.dist + window.innerHeight}px`;
      });
    }
    function init() {
      list = $$('.sala').map((sec) => {
        const el = $('.corridor', sec);
        return { sec, el, sticky: $('.corridor-sticky', el), track: $('.corridor-track', el), bar: $('.corridor-bar', el), count: $('.corridor-count', el), cards: $$('.gcard', el), num: $('.sala-num', sec), head: $('.sala-head', sec), dist: 0, last: -1 };
      });
      measure();
      list.forEach((c) => c.track.addEventListener('scroll', () => Loop.request(), { passive: true }));
    }
    function update() {
      const vh = window.innerHeight, vw = window.innerWidth;
      list.forEach((c) => {
        const hr = c.head.getBoundingClientRect();
        if (hr.bottom > 0 && hr.top < vh && !RM) c.num.style.setProperty('--py', `${(hr.top + hr.height / 2 - vh / 2) * -0.25}px`);
        const r = c.el.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) return;
        let p;
        if (isStatic) {
          const max = c.track.scrollWidth - c.track.clientWidth;
          p = max > 0 ? c.track.scrollLeft / max : 0;
        } else {
          const span = r.height - vh;
          p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
          const x = -c.dist * p;
          c.track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
        }
        c.bar.style.setProperty('--p', p.toFixed(4));
        let best = 0, bestD = Infinity;
        c.cards.forEach((card, i) => {
          const cr = card.getBoundingClientRect();
          const center = cr.left + cr.width / 2;
          const d = Math.abs(center - vw / 2);
          if (d < bestD) { bestD = d; best = i; }
          if (!RM && cr.right > -100 && cr.left < vw + 100) card.style.setProperty('--px', `${((center - vw / 2) / vw) * -26}px`);
        });
        if (best !== c.last) { c.last = best; c.count.textContent = `${pad2(best + 1)} / ${pad2(c.cards.length)}`; }
      });
    }
    return { init, measure, update, get list() { return list; }, get isStatic() { return isStatic; } };
  })();

  function renderSalas() {
    $('#salas-grid').innerHTML = SALAS.map(salaCard).join('');
    const holder = $('#salas');
    holder.innerHTML = SALAS.map(salaSection).join('');
    $$('[data-split]', holder).forEach(splitText);
    $$('#recorrido [data-split], #prologo [data-split], section [data-split]').forEach(splitText);
  }

  /* ------------------------------------------------------------------ riel */
  const Rail = (() => {
    const rail = $('#rail');
    let links = [];
    function init() {
      rail.innerHTML = `<span class="rail-track"></span><span class="rail-fill"></span><svg class="rail-flame" viewBox="0 0 64 64" aria-hidden="true"><use href="#emblem"/></svg>` +
        SALAS.map((s) => `<a href="#sala-${s.n}" style="--c:${s.color}" aria-label="Sala ${s.num}: ${esc(s.titulo)}"><span class="lbl">${s.num} · ${esc(s.titulo)}</span><span class="dot"></span></a>`).join('');
      links = $$('a', rail);
    }
    function update() {
      const secs = Corridors.list.map((c) => c.sec);
      if (!secs.length) return;
      const vh = window.innerHeight;
      const first = secs[0].getBoundingClientRect();
      const last = secs[secs.length - 1].getBoundingClientRect();
      const inside = first.top < vh * 0.6 && last.bottom > vh * 0.4;
      rail.classList.toggle('show', inside);
      const total = last.bottom - first.top;
      const p = clamp((vh / 2 - first.top) / total, 0, 1);
      rail.style.setProperty('--rp', p.toFixed(4));
      let cur = -1;
      secs.forEach((s, i) => { const r = s.getBoundingClientRect(); if (r.top <= vh / 2 && r.bottom > vh / 2) cur = i; });
      if (cur !== Rail.cur) {
        Rail.cur = cur;
        links.forEach((a, i) => { a.classList.toggle('cur', i === cur); a.classList.toggle('past', i < cur); a.classList.toggle('flash', i === cur); });
        clearTimeout(Rail.ft);
        Rail.ft = setTimeout(() => links.forEach((a) => a.classList.remove('flash')), 2200);
      }
    }
    return { init, update, cur: -2, ft: 0 };
  })();

  /* =========================================================== PRÓLOGO (SCRUB) */
  const Scrub = (() => {
    let el, words = [];
    function init() {
      el = $('#scrub-text');
      if (!el) return;
      const text = el.textContent.trim();
      el.innerHTML = `<span class="visually-hidden">${esc(text)}</span>` + text.split(/\s+/).map((w) => `<span class="sw" aria-hidden="true">${esc(w)}</span>`).join(' ');
      words = $$('.sw', el);
    }
    function update() {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      const p = RM ? 1 : clamp((vh * 0.88 - r.top) / (vh * 0.62), 0, 1);
      const n = words.length;
      words.forEach((w, i) => w.style.setProperty('--o', clamp(p * (n + 2) - i, 0, 1).toFixed(3)));
    }
    return { init, update };
  })();

  /* ==================================================================== NAV */
  const Nav = (() => {
    const nav = $('#nav');
    const toggle = $('.nav-toggle');
    const menu = $('#mobile-menu');
    const links = $$('.nav-links a');
    const map = { recorrido: 'recorrido', linea: 'linea', mapa: 'mapa', ciudades: 'ciudades', antorcha: 'antorcha', explorar: 'explorar' };
    let lastY = 0;
    function setMenu(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      if (open) {
        menu.hidden = false;
        $$('a', menu).forEach((a, i) => a.style.setProperty('--i', i));
        requestAnimationFrame(() => menu.classList.add('open'));
        document.body.classList.add('no-scroll');
      } else {
        menu.classList.remove('open');
        document.body.classList.remove('no-scroll');
        setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 350);
      }
    }
    function init() {
      toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
    }
    function update() {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 30);
      const menuOpen = !menu.hidden;
      if (!menuOpen) nav.classList.toggle('hide', y > 500 && y > lastY + 2);
      if (y < lastY - 2 || y < 500) nav.classList.remove('hide');
      lastY = y;
      const vh = window.innerHeight;
      let cur = '';
      const salasEl = $('#salas');
      const sr = salasEl.getBoundingClientRect();
      if (sr.top < vh / 2 && sr.bottom > vh / 2) cur = 'recorrido';
      Object.keys(map).forEach((id) => { const el = document.getElementById(id); if (!el) return; const r = el.getBoundingClientRect(); if (r.top < vh / 2 && r.bottom > vh / 2) cur = map[id]; });
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${cur}`));
    }
    return { init, update };
  })();

  /* ========================================================== BUCLE DE SCROLL */
  const Loop = (() => {
    let ticking = false;
    const progress = $('#progress');
    function tick() {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
      Nav.update();
      Scrub.update();
      Corridors.update();
      Rail.update();
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
    function init() {
      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', debounce(() => { Corridors.measure(); Chains.layout(); request(); }, 160));
      request();
    }
    return { init, request };
  })();

  /* ==================================================== EFECTOS DE PUNTERO */
  function initPointerFX() {
    if (!FINE || RM) return;
    const glow = $('.cursor-glow');
    let gx = -600, gy = -600, tx = -600, ty = -600, raf = 0;
    const move = () => {
      gx = lerp(gx, tx, 0.14); gy = lerp(gy, ty, 0.14);
      glow.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0)`;
      raf = Math.abs(gx - tx) + Math.abs(gy - ty) > 0.5 ? requestAnimationFrame(move) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add('has-cursor');
      if (!raf) raf = requestAnimationFrame(move);
    }, { passive: true });
    document.addEventListener('pointerleave', () => document.body.classList.remove('has-cursor'));

    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.gcard');
      if (card) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      }
      const mag = e.target.closest && e.target.closest('.magnetic');
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        mag.style.transform = `translate(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.28).toFixed(1)}px)`;
      }
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest('.gcard');
      if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
      const mag = e.target.closest && e.target.closest('.magnetic');
      if (mag && !mag.contains(e.relatedTarget)) mag.style.transform = '';
    });
  }

  /* ============================================================ LÍNEA DEL TIEMPO */
  const Timeline = (() => {
    const SEG = [
      [-2100, -350, 1500, 'Antiguo Testamento', 1],
      [-350, 150, 560, 'Iglesia primitiva', 2],
      [150, 1100, 560, 'Iglesia antigua y medieval', 3],
      [1100, 1650, 1150, 'Precursores y Reforma', 4],
      [1650, 1800, 900, 'Grandes despertares', 5],
      [1800, 1880, 1250, 'Misiones y avivamiento', 7],
      [1880, 1935, 1700, 'El fuego de Pentecostés', 8],
      [1935, 2025, 1500, 'Siglo XX y XXI', 10],
    ];
    const PADL = 140, PADR = 220, AXIS = 390;
    const starts = [];
    let acc = PADL;
    SEG.forEach((s) => { starts.push(acc); acc += s[2]; });
    const WIDTH = acc + PADR;
    function x(y) {
      for (let i = 0; i < SEG.length; i++) {
        const [a, b, w] = SEG[i];
        if (y <= b || i === SEG.length - 1) return starts[i] + clamp((y - a) / (b - a), 0, 1) * w;
      }
      return WIDTH;
    }
    const yearLbl = (y) => (y < 0 ? `${-y} a.C.` : y === 1 ? '1 d.C.' : String(y));
    function lanes(items, nLanes, widthOf, cycle) {
      const ends = new Array(nLanes).fill(-Infinity);
      items.forEach((it, i) => {
        const w = widthOf(it);
        const left = it.x - 18;
        const pref = cycle ? i % cycle : 0;
        let lane = ends[pref] + 14 < left ? pref : ends.findIndex((e) => e + 14 < left);
        if (lane < 0) lane = ends.indexOf(Math.min(...ends));
        it.lane = lane;
        ends[lane] = left + w;
      });
    }
    function render() {
      const track = $('#tl-track');
      track.style.width = `${WIDTH}px`;
      let html = '';
      SEG.forEach((s, i) => {
        const col = SALAS[s[4] - 1].color;
        html += `<div class="tl-era" style="left:${starts[i]}px;width:${s[2]}px;--c:${col}"><span class="tl-era-lbl">${esc(s[3])}</span></div>`;
      });
      html += '<div class="tl-axis"></div>';
      const ticks = [-2000, -1500, -1000, -500, 1, 500, 1000, 1200, 1400, 1500, 1600, 1700, 1750, 1800, 1825, 1850, 1875, 1900, 1925, 1950, 1975, 2000, 2025];
      ticks.forEach((t) => { html += `<span class="tl-tick" style="left:${x(t)}px">${yearLbl(t)}</span>`; });

      const gens = GEN.map((g) => ({ g, x: x(g.y) })).sort((a, b) => a.x - b.x);
      lanes(gens, 7, (it) => 58 + it.g.nombre.length * 7.1, 3);
      gens.forEach((it, i) => {
        const top = AXIS - 52 - it.lane * 44;
        const g = it.g;
        html += `<button class="tl-mark" type="button" data-open="${g.id}" style="left:${it.x.toFixed(1)}px;top:${top - 16}px;height:${AXIS - top + 22}px;--c:${g.c};--d:${(0.6 + i * 0.015).toFixed(3)}s" aria-label="${esc(g.nombre)}, ${esc(g.fechas)}">
          <span class="lbl">${avatar(g, 120)}${esc(g.nombre)}</span><span class="stem" style="flex:1"></span><span class="dot"></span></button>`;
      });
      const evs = D.eventos.map((e) => ({ e, x: x(e.y) })).sort((a, b) => a.x - b.x);
      lanes(evs, 4, (it) => 60 + it.e.t.length * 6.6, 2);
      evs.forEach((it, i) => {
        const ly = AXIS + 34 + it.lane * 38;
        html += `<div class="tl-ev" style="left:${it.x.toFixed(1)}px;top:${AXIS - 6}px;height:${ly - AXIS + 26}px;--d:${(1 + i * 0.05).toFixed(2)}s"><span class="dia"></span><span class="stem" style="flex:1"></span><span class="lbl"><b>${yearLbl(it.e.y)}</b>${esc(it.e.t)}</span></div>`;
      });
      track.innerHTML = html;

      const eras = $('#tl-eras');
      eras.innerHTML = SALAS.map((s) => `<button type="button" style="--c:${s.color}" data-sala="${s.n}" title="${esc(s.titulo)}">${s.num}</button>`).join('');
    }
    function init() {
      render();
      const vp = $('#tl-viewport');
      const sec = $('#linea');
      observe(sec);
      sec.setAttribute('data-io', '');
      const scrollToX = (px) => vp.scrollTo({ left: Math.max(0, px - vp.clientWidth / 2), behavior: RM ? 'auto' : 'smooth' });
      $('#tl-eras').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const gs = bySala[+b.dataset.sala - 1];
        const avg = gs.reduce((s, g) => s + x(g.y), 0) / gs.length;
        $$('#tl-eras button').forEach((o) => o.classList.toggle('on', o === b));
        scrollToX(avg);
      });
      $('#tl-prev').addEventListener('click', () => vp.scrollBy({ left: -vp.clientWidth * 0.7, behavior: RM ? 'auto' : 'smooth' }));
      $('#tl-next').addEventListener('click', () => vp.scrollBy({ left: vp.clientWidth * 0.7, behavior: RM ? 'auto' : 'smooth' }));
      vp.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { vp.scrollBy({ left: 240, behavior: 'smooth' }); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { vp.scrollBy({ left: -240, behavior: 'smooth' }); e.preventDefault(); }
      });
      // arrastrar con inercia
      let down = false, moved = false, sx = 0, sl = 0, vx = 0, lx = 0, lt = 0, inertia = 0;
      vp.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = false; sx = lx = e.clientX; sl = vp.scrollLeft; vx = 0; lt = performance.now();
        cancelAnimationFrame(inertia);
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - sx;
        if (Math.abs(dx) > 5 && !moved) { moved = true; vp.classList.add('dragging'); }
        if (moved) {
          vp.scrollLeft = sl - dx;
          const now = performance.now();
          vx = (e.clientX - lx) / Math.max(1, now - lt);
          lx = e.clientX; lt = now;
        }
      });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        vp.classList.remove('dragging');
        if (moved && !RM) {
          let v = vx * 16;
          const glide = () => { vp.scrollLeft -= v; v *= 0.94; if (Math.abs(v) > 0.4) inertia = requestAnimationFrame(glide); };
          inertia = requestAnimationFrame(glide);
        }
      });
      vp.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      // posición inicial: un poco antes de la Reforma para invitar a explorar
      requestAnimationFrame(() => { vp.scrollLeft = 0; });
    }
    return { init };
  })();

  /* ================================================================== MAPA */
  function project(lat, lon) {
    const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
    const p2 = p * p, p4 = p2 * p2;
    const xr = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const yr = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [WORLD.tx + WORLD.scale * xr, WORLD.ty - WORLD.scale * yr];
  }
  const worldPaths = () => `<path class="grat" d="${WORLD.grat}"/><path class="land-glow" d="${WORLD.land}"/><path class="land" d="${WORLD.land}"/><path class="borders" d="${WORLD.borders}"/>`;

  const MapView = (() => {
    let svg, tip, wrap, filter = 0, route = null, tipFor = null;
    const NS = 'http://www.w3.org/2000/svg';
    function clusters(list) {
      const out = [];
      list.forEach((g) => {
        const [px, py] = project(g.coord[0], g.coord[1]);
        let c = out.find((o) => Math.hypot(o.x - px, o.y - py) < 8.5);
        if (!c) { c = { x: px, y: py, gs: [] }; out.push(c); }
        c.gs.push(g);
      });
      return out;
    }
    function renderPins() {
      const list = filter ? GEN.filter((g) => g.sala === filter) : GEN;
      const cs = clusters(list).sort((a, b) => a.x - b.x);
      const g = $('#pins', svg);
      g.innerHTML = cs.map((c, i) => {
        const n = c.gs.length;
        const col = c.gs.every((x) => x.sala === c.gs[0].sala) ? c.gs[0].c : '#e9c46a';
        const r = n > 1 ? 4.6 : 3;
        const names = c.gs.map((x) => x.nombre).join(', ');
        return `<g class="pin-g" style="--d:${(i * 0.012).toFixed(3)}s"><g class="pin" tabindex="0" role="button" data-ids="${c.gs.map((x) => x.id).join(',')}" transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})" style="--c:${col};--pd:${(Math.random() * 2.5).toFixed(2)}s" aria-label="${esc(names)}">
          <circle class="halo" r="${r + 1.5}"/><circle class="core" r="${r}"/>${n > 1 ? `<text class="cnt">${n}</text>` : ''}</g></g>`;
      }).join('');
      hideTip();
      if (wrap.classList.contains('in') && !RM) { wrap.classList.remove('in'); void wrap.offsetWidth; wrap.classList.add('in'); }
    }
    function showTip(pin) {
      const ids = pin.dataset.ids.split(',');
      const gs = ids.map((id) => byId[id]);
      const max = 6;
      tip.innerHTML = gs.slice(0, max).map((g) => `<div class="tip-row" role="button" tabindex="0" data-open="${g.id}" style="--c:${g.c}">${avatar(g, 120)}<div><strong>${esc(g.nombre)}</strong><small>${esc(g.lugar)} · ${esc(g.fechas)}</small></div></div>`).join('') +
        (gs.length > max ? `<small style="display:block;padding:6px">y ${gs.length - max} más…</small>` : '');
      tip.hidden = false;
      const wr = wrap.getBoundingClientRect();
      const pr = pin.getBoundingClientRect();
      let left = pr.left + pr.width / 2 - wr.left;
      const tw = tip.offsetWidth;
      left = clamp(left, tw / 2 + 8, wr.width - tw / 2 - 8);
      let top = pr.top - wr.top;
      tip.style.left = `${left}px`;
      if (top - tip.offsetHeight - 20 < 0) { tip.style.top = `${pr.bottom - wr.top + tip.offsetHeight + 16}px`; } else { tip.style.top = `${top}px`; }
      tipFor = pin;
    }
    function hideTip() { if (tip) { tip.hidden = true; tipFor = null; } }
    function drawRoute(r) {
      const g = $('#routes', svg);
      g.innerHTML = '';
      if (!r) return;
      g.style.setProperty('--rc', r.color);
      let html = '';
      r.tramos.forEach((t, i) => {
        const [ax, ay] = project(t[0][0], t[0][1]);
        const [bx, by] = project(t[1][0], t[1][1]);
        const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
        let nx = -dy / d, ny = dx / d;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const k = Math.min(d * 0.28, 90);
        const cx = (ax + bx) / 2 + nx * k, cy = (ay + by) / 2 + ny * k;
        html += `<path id="rp-${i}" class="route-path" d="M${ax.toFixed(1)} ${ay.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}" style="--d:${(i * 0.32).toFixed(2)}s"/>`;
        if (!RM) html += `<circle class="route-dot" r="1.7"><animateMotion dur="${(2.2 + d / 260).toFixed(2)}s" begin="${(i * 0.32 + 1).toFixed(2)}s" repeatCount="indefinite" rotate="auto"><mpath href="#rp-${i}"/></animateMotion></circle>`;
      });
      r.puntos.forEach((p, i) => {
        const [px, py] = project(p[1], p[2]);
        html += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.6" fill="${r.color}"/><text class="route-lbl" x="${(px + 3).toFixed(1)}" y="${(py - 3).toFixed(1)}" style="--d:${(0.4 + i * 0.12).toFixed(2)}s">${esc(p[0])}</text>`;
      });
      g.innerHTML = html;
      $$('.route-path', g).forEach((p) => p.style.setProperty('--len', p.getTotalLength().toFixed(1)));
    }
    function init() {
      svg = $('#world');
      tip = $('#map-tip');
      wrap = $('#map-wrap');
      svg.setAttribute('viewBox', `0 0 ${WORLD.w} ${WORLD.h}`);
      svg.innerHTML = `${worldPaths()}<g id="routes"></g><g id="pins"></g>`;
      renderPins();
      observe(wrap);
      wrap.setAttribute('data-io', '');

      const filters = $('#map-filters');
      filters.innerHTML = `<button class="chip-btn on" type="button" data-f="0" style="--c:#e9c46a">Todas</button>` + SALAS.map((s) => `<button class="chip-btn" type="button" data-f="${s.n}" style="--c:${s.color}" title="${esc(s.titulo)}">${s.num}</button>`).join('');
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        filter = +b.dataset.f;
        $$('button', filters).forEach((o) => o.classList.toggle('on', o === b));
        renderPins();
      });

      const rl = $('#route-list');
      rl.innerHTML = D.rutas.map((r) => `<button type="button" data-r="${r.id}" style="--rc:${r.color}" aria-pressed="false">${esc(r.titulo)}</button>`).join('');
      rl.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const r = D.rutas.find((x) => x.id === b.dataset.r);
        route = route === r ? null : r;
        $$('button', rl).forEach((o) => { const on = route && o.dataset.r === route.id; o.classList.toggle('on', !!on); o.setAttribute('aria-pressed', String(!!on)); });
        drawRoute(route);
      });

      svg.addEventListener('pointerover', (e) => { const pin = e.target.closest('.pin'); if (pin && FINE) showTip(pin); });
      svg.addEventListener('click', (e) => {
        const pin = e.target.closest('.pin');
        if (!pin) { hideTip(); return; }
        const ids = pin.dataset.ids.split(',');
        if (ids.length === 1 && FINE) { Profile.open(ids[0]); return; }
        if (tipFor === pin && !FINE) { hideTip(); return; }
        showTip(pin);
      });
      svg.addEventListener('keydown', (e) => { const pin = e.target.closest('.pin'); if (pin && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showTip(pin); const first = $('.tip-row', tip); if (first) first.focus(); } });
      wrap.addEventListener('pointerleave', () => { if (FINE) hideTip(); });
      tip.addEventListener('keydown', (e) => { const row = e.target.closest('.tip-row'); if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); Profile.open(row.dataset.open); } if (e.key === 'Escape') hideTip(); });

      // barras por región
      const counts = {};
      GEN.forEach((g) => g.region.forEach((r) => { counts[r] = (counts[r] || 0) + 1; }));
      const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const max = rows[0][1];
      $('#region-bars').innerHTML = rows.map(([r, n], i) => `<li><span>${esc(r)}</span><b>${n}</b><span class="bar"><span style="--v:${(n / max).toFixed(3)};--d:${(i * 0.08).toFixed(2)}s"></span></span></li>`).join('');
      observe($('.map-side'));
      // ruta inicial al entrar en vista
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(() => { if (!route) $('#route-list button[data-r="pentecostes"]').click(); }, 1400); } }, { threshold: 0.35 });
        io.observe(wrap);
      }
    }
    return { init };
  })();

  /* ============================================================= CIUDADES */
  const Cities = (() => {
    let svg, cur = -1, vb = null, anim = 0, auto = null, userTouched = false, inView = false;
    const VW = 150;
    function aspect() { const r = svg.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r.height / r.width : 0.375; }
    function setVB(v) { vb = v; svg.setAttribute('viewBox', `${v[0].toFixed(2)} ${v[1].toFixed(2)} ${v[2].toFixed(2)} ${v[3].toFixed(2)}`); }
    function targetVB(c) { const [x, y] = project(c.coord[0], c.coord[1]); const w = VW, h = VW * aspect(); return [x - w / 2, y - h / 2, w, h]; }
    function fly(to) {
      cancelAnimationFrame(anim);
      if (!vb || RM) { setVB(to); return; }
      const from = vb.slice();
      const fc = [from[0] + from[2] / 2, from[1] + from[3] / 2], tc = [to[0] + to[2] / 2, to[1] + to[3] / 2];
      const dist = Math.hypot(tc[0] - fc[0], tc[1] - fc[1]);
      const bump = Math.min(4, dist / 90);
      const t0 = performance.now(), dur = 900 + Math.min(900, dist * 2);
      const step = (t) => {
        const p = clamp((t - t0) / dur, 0, 1), e = easeInOut(p);
        const cx = lerp(fc[0], tc[0], e), cy = lerp(fc[1], tc[1], e);
        const w = lerp(from[2], to[2], e) * (1 + bump * Math.sin(Math.PI * e));
        const h = w * aspect();
        setVB([cx - w / 2, cy - h / 2, w, h]);
        if (p < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    function show(i, fromUser) {
      const C = D.ciudades;
      i = (i + C.length) % C.length;
      if (fromUser === true) { userTouched = true; stopAuto(); }
      cur = i;
      const c = C[i];
      $$('#city-list button').forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
      const [x, y] = project(c.coord[0], c.coord[1]);
      $('#city-marker').setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      fly(targetVB(c));
      $('#city-badge').innerHTML = `<p class="kicker">${esc(c.anio)} · ${esc(c.pais)}</p><h3>${esc(c.ciudad)}</h3>`;
      const gens = c.generales.map((id) => byId[id]).filter(Boolean);
      $('#city-body').innerHTML = `
        <div class="city-gens">${gens.map((g) => `<button class="gen-chip" type="button" data-open="${g.id}" style="--c:${g.c}">${avatar(g, 120)}${esc(g.nombre)}</button>`).join('')}</div>
        <div class="ba">
          <div class="ba-card before"><h4>${svgIcon('reloj2')} Antes</h4><p>${esc(c.antes)}</p></div>
          <div class="ba-card after"><h4>${svgIcon('estrellas')} Después</h4><p>${esc(c.despues)}</p></div>
        </div>
        <div class="city-auto"><span>${pad2(i + 1)} / ${pad2(C.length)}</span><button class="btn btn-ghost btn-sm" type="button" id="city-next"><span>Siguiente ciudad</span><span data-icon="flecha"></span></button></div>`;
      hydrateIcons($('#city-body'));
      const panel = $('#city-panel');
      panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
      const li = $$('#city-list button')[i];
      const list = $('#city-list');
      if (li && list) {
        const lr = list.getBoundingClientRect(), br = li.getBoundingClientRect();
        const beh = RM ? 'auto' : 'smooth';
        if (list.scrollWidth > list.clientWidth + 2) { if (br.left < lr.left || br.right > lr.right) list.scrollBy({ left: br.left - lr.left - 20, behavior: beh }); }
        else if (list.scrollHeight > list.clientHeight + 2) { if (br.top < lr.top || br.bottom > lr.bottom) list.scrollBy({ top: br.top - lr.top - 20, behavior: beh }); }
      }
    }
    function startAuto() { if (RM || userTouched || auto) return; auto = setInterval(() => { if (inView && !document.hidden) show(cur + 1, 'keep'); }, 7000); }
    function stopAuto() { clearInterval(auto); auto = null; }
    function init() {
      svg = $('#city-map');
      svg.innerHTML = `${worldPaths()}<g id="city-marker"><circle class="cm-ring" r="3"/><circle class="cm-core" r="1.3"/></g>`;
      $('#city-list').innerHTML = D.ciudades.map((c, i) => `<li role="presentation"><button type="button" role="tab" aria-selected="false" aria-controls="city-panel" data-i="${i}"><span class="n">${pad2(i + 1)}</span><strong>${esc(c.ciudad)}</strong><small>${esc(c.pais)} · ${esc(c.anio)}</small></button></li>`).join('');
      $('#city-list').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.i, true); });
      $('#city-list').addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, true); $$('#city-list button')[cur].focus(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, true); $$('#city-list button')[cur].focus(); }
      });
      $('#city-panel').addEventListener('click', (e) => { if (e.target.closest('#city-next')) show(cur + 1, true); });
      show(0, 'keep');
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) startAuto(); }, { threshold: 0.4 }).observe($('#city-panel'));
      }
      window.addEventListener('resize', debounce(() => { if (cur >= 0) setVB(targetVB(D.ciudades[cur])); }, 200));
    }
    return { init };
  })();

  /* ============================================================== CADENAS */
  const Chains = (() => {
    let stage, k = 0, raf = 0, played = false, visible = false, measure;
    function nodeHTML(n) {
      const g = n.id ? byId[n.id] : null;
      if (g) {
        return `<div class="cnode" style="--c:${g.c}"><button class="orb av" type="button" data-open="${g.id}" aria-label="Ver vida y obra de ${esc(g.nombre)}">${svgIcon(g.icono)}${g.img ? `<img src="${imgURL(g, 250)}" alt="" loading="lazy" decoding="async" data-gimg>` : ''}</button>
          <span class="yr">${esc(n.anio)}</span><h4>${esc(g.nombre)}</h4><span class="pl">${esc(n.lugar)}</span><p>${esc(n.t)}</p></div>`;
      }
      return `<div class="cnode minor"><span class="orb">${svgIcon('usuarios')}</span><span class="yr">${esc(n.anio)}</span><h4>${esc(n.nombre)}</h4><span class="pl">${esc(n.lugar)}</span><p>${esc(n.t)}</p></div>`;
    }
    function render() {
      const c = D.cadenas[k];
      $$('#chain-tabs button').forEach((b, i) => b.setAttribute('aria-selected', String(i === k)));
      stage.innerHTML = `<p class="chain-sub">${esc(c.sub)}</p>
        <div class="chain" id="chain">
          <svg class="chain-svg" aria-hidden="true"><defs><linearGradient id="chainGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2d48a"/><stop offset=".6" stop-color="#e9a23b"/><stop offset="1" stop-color="#ff6a1a"/></linearGradient></defs><path class="chain-line-bg"/><path class="chain-line"/><circle class="chain-spark" r="5" cx="-20" cy="-20"/></svg>
          ${c.nodos.map(nodeHTML).join('')}
        </div>
        ${c.nota ? `<p class="chain-note"><span data-icon="info"></span><span>${esc(c.nota)}</span></p>` : ''}`;
      hydrateIcons(stage);
      layout();
      if (visible || RM) play(); else played = false;
    }
    function layout() {
      const chain = $('#chain', stage);
      if (!chain) return;
      const cr = chain.getBoundingClientRect();
      const svg = $('.chain-svg', chain);
      svg.setAttribute('viewBox', `0 0 ${cr.width.toFixed(1)} ${cr.height.toFixed(1)}`);
      const pts = $$('.orb', chain).map((o) => { const r = o.getBoundingClientRect(); return [r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top]; });
      if (pts.length < 2) return;
      const vertical = Math.abs(pts[1][0] - pts[0][0]) < Math.abs(pts[1][1] - pts[0][1]);
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      const partial = [0];
      measure = measure || document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.appendChild(measure);
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        if (vertical) { const my = (ay + by) / 2; d += ` C${(ax + 26).toFixed(1)} ${my.toFixed(1)} ${(bx + 26).toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`; }
        else { const mx = (ax + bx) / 2; d += ` C${mx.toFixed(1)} ${(ay - 34).toFixed(1)} ${mx.toFixed(1)} ${(by - 34).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`; }
        measure.setAttribute('d', d);
        partial.push(measure.getTotalLength());
      }
      measure.remove();
      $('.chain-line', svg).setAttribute('d', d);
      $('.chain-line-bg', svg).setAttribute('d', d);
      chain._len = partial[partial.length - 1];
      chain._fr = partial.map((l) => l / chain._len);
      const line = $('.chain-line', svg);
      line.style.strokeDasharray = chain._len;
      line.style.strokeDashoffset = played ? 0 : chain._len;
    }
    function play() {
      cancelAnimationFrame(raf);
      const chain = $('#chain', stage);
      if (!chain || !chain._len) return;
      played = true;
      chain.classList.add('playing');
      const line = $('.chain-line', chain), spark = $('.chain-spark', chain), nodes = $$('.cnode', chain);
      const len = chain._len, fr = chain._fr;
      line.style.strokeDasharray = len;
      if (RM) { line.style.strokeDashoffset = 0; nodes.forEach((n) => n.classList.add('lit')); spark.style.display = 'none'; return; }
      line.style.strokeDashoffset = len;
      nodes.forEach((n) => n.classList.remove('lit'));
      const dur = 950 * nodes.length;
      const t0 = performance.now();
      const step = (t) => {
        const p = clamp((t - t0) / dur, 0, 1), e = easeInOut(p);
        line.style.strokeDashoffset = (len * (1 - e)).toFixed(1);
        const pt = line.getPointAtLength(len * e);
        spark.setAttribute('cx', pt.x.toFixed(1)); spark.setAttribute('cy', pt.y.toFixed(1));
        nodes.forEach((n, i) => { if (e >= fr[i] - 0.015) n.classList.add('lit'); });
        if (p < 1) raf = requestAnimationFrame(step); else loop(line, spark, len);
      };
      raf = requestAnimationFrame(step);
    }
    function loop(line, spark, len) {
      const t0 = performance.now();
      const step = (t) => {
        if (!visible) { raf = 0; return; }
        const p = ((t - t0) % 5200) / 5200;
        const pt = line.getPointAtLength(len * easeInOut(p));
        spark.setAttribute('cx', pt.x.toFixed(1)); spark.setAttribute('cy', pt.y.toFixed(1));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    function init() {
      stage = $('#chain-stage');
      const tabs = $('#chain-tabs');
      tabs.innerHTML = D.cadenas.map((c, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-k="${i}"><strong>${esc(c.titulo)}</strong><small>${c.nodos.length} eslabones · ${esc(c.nodos[0].anio)} – ${esc(c.nodos[c.nodos.length - 1].anio)}</small></button>`).join('');
      tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { k = +b.dataset.k; render(); } });
      render();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          if (visible) {
            if (!played) play();
            else if (!raf && !RM) { const chain = $('#chain', stage); if (chain) loop($('.chain-line', chain), $('.chain-spark', chain), chain._len); }
          }
        }, { threshold: 0.12 }).observe(stage);
      } else { visible = true; play(); }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
    }
    return { init, layout: () => { if (stage) layout(); } };
  })();

  /* ================================================================= VOCES */
  const Quotes = (() => {
    let list = [], i = 0, timer = 0, visible = false, hover = false;
    const DUR = 9000;
    function show(n) {
      i = (n + list.length) % list.length;
      const g = list[i];
      const words = g.cita.t.split(/\s+/);
      $('#quote-stage').innerHTML = `<div class="qt" style="--c:${g.c}">
        <div class="mark" aria-hidden="true">“</div>
        <blockquote><span class="visually-hidden">${esc(g.cita.t)}</span><span aria-hidden="true">${words.map((w, j) => `<span class="qw" style="--i:${j}">${esc(w)}</span>`).join(' ')}</span></blockquote>
        <button class="who" type="button" data-open="${g.id}">${avatar(g, 120)}<span><strong>${esc(g.nombre)}</strong><small>${esc(g.cita.f)}</small></span></button>
      </div>`;
      const bar = $('#q-bar');
      bar.classList.remove('run'); void bar.offsetWidth;
      if (visible && !hover && !RM) bar.classList.add('run');
      schedule();
    }
    function schedule() { clearTimeout(timer); if (visible && !hover && !RM) timer = setTimeout(() => show(i + 1), DUR); }
    function init() {
      list = shuffle(GEN.filter((g) => g.cita));
      $('#q-prev').addEventListener('click', () => show(i - 1));
      $('#q-next').addEventListener('click', () => show(i + 1));
      const st = $('#quote-stage');
      st.addEventListener('pointerenter', () => { hover = true; clearTimeout(timer); $('#q-bar').classList.remove('run'); });
      st.addEventListener('pointerleave', () => { hover = false; show(i); });
      $('#q-bar').style.setProperty('--qd', `${DUR}ms`);
      show(0);
      if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) show(i); if (!visible) clearTimeout(timer); }, { threshold: 0.4 }).observe(st);
    }
    return { init };
  })();

  /* =============================================================== EXPLORAR */
  const Explore = (() => {
    let cards = [], alpha = false;
    function cardHTML(g) {
      const s = salaOf(g);
      return `<button class="mcard ${g.img ? 'has-img' : ''}" type="button" data-open="${g.id}" data-id="${g.id}" style="--c:${g.c}">
        <span class="mmedia">${medallion(g)}${imgTag(g, 330)}</span>
        <span class="mbody"><span class="msala">Sala ${s.num} · ${esc(g.fechas)}</span><span class="nm">${esc(g.nombre)}</span><span class="mepi">${esc(g.titulo)}</span><span class="mmeta">${esc(g.pais.slice(0, 3).join(' · '))}</span></span>
      </button>`;
    }
    function apply() {
      const q = norm($('#f-q').value.trim());
      const sala = +$('#f-sala').value || 0;
      const reg = $('#f-region').value;
      const rol = $('#f-rol').value;
      const muj = $('#f-mujer').checked;
      const first = new Map();
      cards.forEach((c) => { if (!c.hidden) first.set(c, c.getBoundingClientRect()); });
      const grid = $('#explore-grid');
      const order = GEN.slice().sort(alpha ? (a, b) => a.nombre.localeCompare(b.nombre, 'es') : (a, b) => a.idx - b.idx);
      order.forEach((g) => grid.appendChild(cards.find((c) => c.dataset.id === g.id)));
      let n = 0;
      cards.forEach((c) => {
        const g = byId[c.dataset.id];
        const ok = (!q || q.split(/\s+/).every((t) => g.search.includes(t))) && (!sala || g.sala === sala) && (!reg || g.region.includes(reg)) && (!rol || g.cats.includes(rol)) && (!muj || g.mujer);
        c.hidden = !ok;
        if (ok) n++;
      });
      let empty = $('.empty', grid);
      if (!n) { if (!empty) grid.insertAdjacentHTML('beforeend', '<p class="empty">Ningún general coincide con tu búsqueda. Prueba con otro nombre o país.</p>'); }
      else if (empty) empty.remove();
      $('#f-count').textContent = n === GEN.length ? `Mostrando a los ${n} generales` : `Mostrando ${n} de ${GEN.length} generales`;
      if (RM || !Element.prototype.animate) return;
      cards.forEach((c) => {
        if (c.hidden) return;
        const f = first.get(c);
        const l = c.getBoundingClientRect();
        if (l.bottom < -200 || l.top > window.innerHeight + 200) return;
        if (f) {
          const dx = f.left - l.left, dy = f.top - l.top;
          if (Math.abs(dx) + Math.abs(dy) > 1) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
        } else {
          c.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      });
    }
    function init() {
      const grid = $('#explore-grid');
      grid.innerHTML = GEN.map(cardHTML).join('');
      cards = $$('.mcard', grid);
      $('#f-sala').insertAdjacentHTML('beforeend', SALAS.map((s) => `<option value="${s.n}">Sala ${s.num} · ${esc(s.titulo)}</option>`).join(''));
      const regions = [...new Set(GEN.flatMap((g) => g.region))].sort((a, b) => a.localeCompare(b, 'es'));
      $('#f-region').insertAdjacentHTML('beforeend', regions.map((r) => `<option>${esc(r)}</option>`).join(''));
      const cats = CATS.map(([n]) => n).filter((n) => GEN.some((g) => g.cats.includes(n)));
      $('#f-rol').insertAdjacentHTML('beforeend', cats.map((c) => `<option>${esc(c)}</option>`).join(''));
      $('#f-q').addEventListener('input', debounce(apply, 140));
      ['#f-sala', '#f-region', '#f-rol', '#f-mujer'].forEach((s) => $(s).addEventListener('change', apply));
      $('#f-sort').addEventListener('click', (e) => {
        alpha = !alpha;
        const b = e.currentTarget;
        b.setAttribute('aria-pressed', String(alpha));
        b.lastElementChild.textContent = alpha ? 'Orden: alfabético' : 'Orden: cronológico';
        apply();
      });
      apply();
    }
    return { init };
  })();

  /* =================================================================== QUIZ */
  const Quiz = (() => {
    let qs = [], i = 0, score = 0, marks = [];
    function options(correct) {
      const pool = shuffle(GEN.filter((g) => g.id !== correct.id)).slice(0, 3);
      return shuffle([correct, ...pool]);
    }
    function build() {
      const withQuote = shuffle(GEN.filter((g) => g.cita && !norm(g.cita.t).includes(norm(g.nombre.split(' ')[0]))));
      const all = shuffle(GEN);
      const out = [];
      withQuote.slice(0, 2).forEach((g) => out.push({ g, lbl: '¿Quién lo dijo?', q: `«${g.cita.t}»` }));
      all.filter((g) => !out.some((o) => o.g === g)).slice(0, 2).forEach((g) => out.push({ g, lbl: '¿A quién se conoce así?', q: `«${g.titulo}»` }));
      const h = all.find((g) => !out.some((o) => o.g === g) && g.hitos.some((x) => /\d/.test(x[0])));
      if (h) { const hit = h.hitos.find((x) => /\d/.test(x[0])); out.push({ g: h, lbl: `¿De quién es este hito? (${hit[0]})`, q: hit[1] }); }
      return shuffle(out).map((o) => ({ ...o, opts: options(o.g) }));
    }
    function render() {
      const card = $('#quiz-card');
      if (i >= qs.length) {
        const msgs = ['¡Sigue recorriendo las salas: cada historia vale la pena!', 'Buen comienzo: vuelve a las salas y descubre más.', '¡Bien! Ya conoces a varios generales.', '¡Muy bien! Tienes buena memoria.', '¡Excelente! Conoces bien la nube de testigos.', '¡Perfecto! Eres un verdadero historiador de la fe.'];
        card.innerHTML = `<div class="qz-end"><p class="kicker">Resultado</p><div class="score">${score} / ${qs.length}</div><p>${msgs[score]}</p><button class="btn btn-gold" type="button" id="qz-again"><span data-icon="reiniciar"></span><span>Jugar de nuevo</span></button></div>`;
        hydrateIcons(card);
        if (score >= 4) burst($('.score', card));
        return;
      }
      const q = qs[i];
      card.innerHTML = `<div class="qz-top"><span>Pregunta ${i + 1} de ${qs.length}</span><span class="qz-dots">${qs.map((_, j) => `<i class="${marks[j] || (j === i ? 'cur' : '')}"></i>`).join('')}</span></div>
        <p class="qz-q"><span class="lbl">${esc(q.lbl)}</span>${esc(q.q)}</p>
        <div class="qz-opts">${q.opts.map((g, j) => `<button type="button" data-id="${g.id}" style="--i:${j};--c:${g.c}">${avatar(g, 120)}<span>${esc(g.nombre)}</span></button>`).join('')}</div>
        <div class="qz-feedback" id="qz-fb" aria-live="polite"></div>`;
    }
    function answer(btn) {
      const q = qs[i];
      const ok = btn.dataset.id === q.g.id;
      $$('.qz-opts button').forEach((b) => { b.disabled = true; if (b.dataset.id === q.g.id) b.classList.add('ok'); });
      if (!ok) btn.classList.add('bad'); else { score++; burst(btn); }
      marks[i] = ok ? 'ok' : 'bad';
      $('#qz-fb').innerHTML = `<span>${ok ? '¡Correcto!' : 'Era'} <strong>${esc(q.g.nombre)}</strong> — ${esc(q.g.titulo)}.</span>
        <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-open="${q.g.id}">Ver ficha</button><button class="btn btn-gold btn-sm" type="button" id="qz-next">${i + 1 < qs.length ? 'Siguiente' : 'Ver resultado'}</button></span>`;
      $('#qz-next').focus({ preventScroll: true });
    }
    function burst(el) {
      if (RM || !el || !Element.prototype.animate) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (let k = 0; k < 22; k++) {
        const s = document.createElement('span');
        s.className = 'spark';
        s.style.left = `${cx}px`; s.style.top = `${cy}px`;
        document.body.appendChild(s);
        const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 110;
        s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => s.remove();
      }
    }
    function start() { qs = build(); i = 0; score = 0; marks = []; render(); }
    function init() {
      const card = $('#quiz-card');
      card.addEventListener('click', (e) => {
        const opt = e.target.closest('.qz-opts button');
        if (opt && !opt.disabled) { answer(opt); return; }
        if (e.target.closest('#qz-next')) { i++; render(); return; }
        if (e.target.closest('#qz-again')) start();
      });
      start();
    }
    return { init };
  })();

  /* ================================================================== VOZ */
  const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  const romanToInt = (r) => { let n = 0; for (let i = 0; i < r.length; i++) { const a = ROMAN[r[i]], b = ROMAN[r[i + 1]] || 0; n += a < b ? -a : a; } return n; };
  function speakable(t) {
    return String(t)
      .replace(/\b(siglos?|Siglos?|Sala|sala)\s+([IVXLC]+)(?:\s*[–-]\s*([IVXLC]+))?/g, (m, w, a, b) => `${w} ${romanToInt(a)}${b ? ' al ' + romanToInt(b) : ''}`)
      .replace(/\bc\.\s*/g, 'hacia ')
      .replace(/a\.C\./g, 'antes de Cristo').replace(/d\.C\./g, 'después de Cristo')
      .replace(/†\s*/g, 'murió ').replace(/\bn\.\s/g, 'nacido en ')
      .replace(/\s[–-]\s/g, ' a ').replace(/·/g, ', ').replace(/[«»“”]/g, '').replace(/\s+/g, ' ');
  }
  const Voice = (() => {
    const ok = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    let voice = null, guard = 0;
    function pick() {
      if (!ok) return;
      const vs = window.speechSynthesis.getVoices();
      const pref = ['es-419', 'es-mx', 'es-us', 'es-co', 'es-ar', 'es-cl', 'es-es', 'es'];
      for (const p of pref) { const v = vs.find((x) => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(p)); if (v) { voice = v; return; } }
    }
    if (ok) { pick(); window.speechSynthesis.addEventListener ? window.speechSynthesis.addEventListener('voiceschanged', pick) : (window.speechSynthesis.onvoiceschanged = pick); }
    function speak(text, onend) {
      if (!ok) return false;
      window.speechSynthesis.cancel();
      clearTimeout(guard);
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.lang = voice ? voice.lang : 'es-419';
      if (voice) u.voice = voice;
      u.rate = 1;
      let fired = false;
      const done = () => { if (fired) return; fired = true; clearTimeout(guard); if (onend) onend(); };
      u.onend = done; u.onerror = done;
      window.speechSynthesis.speak(u);
      const words = text.split(/\s+/).length;
      guard = setTimeout(done, (words / 2.2) * 1000 + 8000);
      return true;
    }
    function stop() { if (ok) { clearTimeout(guard); window.speechSynthesis.cancel(); } }
    return { ok, speak, stop };
  })();

  /* ================================================================= FICHA */
  const Profile = (() => {
    const dlg = $('#perfil');
    let cur = null, speaking = false;
    function html(g) {
      const s = salaOf(g);
      const cons = (g.con || []).map((id) => byId[id]).filter(Boolean);
      return `<div class="pf-grid">
        <div class="pf-media ${g.img ? 'has-img' : ''}">${medallion(g)}${imgTag(g, 960, 'eager')}
          ${g.img ? `<p class="pf-cred">${esc(g.cred || '')} · <a href="${commonsPage(g.img)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>` : ''}</div>
        <div class="pf-content">
          <p class="kicker pf-sala">Sala ${s.num} · ${esc(s.titulo)}</p>
          <h2 class="pf-name" id="pf-name">${esc(g.nombre)}</h2>
          <p class="pf-epi">${esc(g.titulo)}</p>
          <div class="pf-facts"><span>${svgIcon('calendario')}${esc(g.fechas)}</span><span>${svgIcon('pin')}${esc(g.lugar)}</span><span>${svgIcon('mundo')}${esc(g.pais.join(' · '))}</span></div>
          <p class="pf-sum">${esc(g.resumen)}</p>
          <div class="pf-bio">${g.bio.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          <h3 class="pf-h">Hitos</h3>
          <ul class="pf-hitos">${g.hitos.map((h) => `<li><b>${esc(h[0])}</b><span>${esc(h[1])}</span></li>`).join('')}</ul>
          <h3 class="pf-h">Legado</h3>
          <ul class="pf-legado">${g.legado.map((l) => `<li>${svgIcon('estrellas')}<span>${esc(l)}</span></li>`).join('')}</ul>
          ${g.cita ? `<blockquote class="pf-quote"><p>«${esc(g.cita.t)}»</p><cite>${esc(g.cita.f)}</cite></blockquote>` : ''}
          <blockquote class="pf-verse"><p>«${esc(g.verso.t)}»</p><cite>${esc(g.verso.r)}</cite></blockquote>
          ${cons.length ? `<h3 class="pf-h">Conexiones</h3><div class="pf-cons">${cons.map((c) => `<button class="gen-chip" type="button" data-open="${c.id}" style="--c:${c.c}">${avatar(c, 120)}${esc(c.nombre)}</button>`).join('')}</div>` : ''}
          <div class="pf-actions">
            ${Voice.ok ? `<button class="chip-btn" type="button" data-pf="voz" aria-pressed="false">${svgIcon('sonido')}<span>Escuchar</span></button>` : ''}
            <button class="chip-btn" type="button" data-pf="share">${svgIcon('compartir')}<span>Compartir</span></button>
            <button class="chip-btn" type="button" data-pf="sala">${svgIcon('ruta')}<span>Ir a su sala</span></button>
            <span class="pf-nav"><button class="icon-btn" type="button" data-pf="prev" aria-label="General anterior">${svgIcon('anterior')}</button><button class="icon-btn" type="button" data-pf="next" aria-label="General siguiente">${svgIcon('siguiente')}</button></span>
          </div>
        </div>
      </div>`;
    }
    function fill(g) {
      cur = g;
      dlg.style.setProperty('--c', g.c);
      const sc = $('#pf-scroll');
      sc.innerHTML = html(g);
      sc.scrollTop = 0;
      setSpeaking(false);
      try { history.replaceState(null, '', `#general/${g.id}`); } catch (e) { /* file:// */ }
    }
    function open(id) {
      const g = byId[id];
      if (!g) return;
      if (Tour.isOpen()) Tour.pause();
      fill(g);
      if (!dlg.open) {
        dlg.classList.remove('closing');
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        document.body.classList.add('no-scroll');
      }
      const close = $('.pf-close', dlg);
      if (close) close.focus({ preventScroll: true });
    }
    function close() {
      if (!dlg.open) return;
      Voice.stop();
      setSpeaking(false);
      const done = () => { dlg.classList.remove('closing'); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
      if (RM) done(); else { dlg.classList.add('closing'); setTimeout(done, 380); }
      if (!Tour.isOpen()) document.body.classList.remove('no-scroll');
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
    }
    function setSpeaking(v) {
      speaking = v;
      const b = $('[data-pf="voz"]', dlg);
      if (b) { b.setAttribute('aria-pressed', String(v)); b.lastElementChild.textContent = v ? 'Detener' : 'Escuchar'; }
    }
    function share() {
      const url = `${location.origin}${location.pathname}#general/${cur.id}`;
      const data = { title: `${cur.nombre} · Generales de Dios`, text: `${cur.nombre}: ${cur.titulo}`, url };
      if (navigator.share) { navigator.share(data).catch(() => {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Enlace copiado al portapapeles'), () => toast(url));
      else toast(url);
    }
    function init() {
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) { close(); return; }
        if (e.target.closest('[data-close]')) { close(); return; }
        const a = e.target.closest('[data-pf]');
        if (!a) return;
        const act = a.dataset.pf;
        if (act === 'prev') fill(GEN[(cur.idx - 1 + GEN.length) % GEN.length]);
        if (act === 'next') fill(GEN[(cur.idx + 1) % GEN.length]);
        if (act === 'share') share();
        if (act === 'sala') { const target = $(`#sala-${cur.sala}`); close(); if (Tour.isOpen()) Tour.close(); setTimeout(() => target && target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }), 420); }
        if (act === 'voz') {
          if (speaking) { Voice.stop(); setSpeaking(false); return; }
          const text = `${cur.nombre}. ${cur.titulo}. ${cur.bio.join(' ')}${cur.cita ? ` Una frase para recordar: ${cur.cita.t}` : ''}`;
          setSpeaking(true);
          Voice.speak(text, () => setSpeaking(false));
        }
      });
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
      dlg.addEventListener('keydown', (e) => {
        if (e.target.closest('input, select, textarea')) return;
        if (e.key === 'ArrowRight') fill(GEN[(cur.idx + 1) % GEN.length]);
        if (e.key === 'ArrowLeft') fill(GEN[(cur.idx - 1 + GEN.length) % GEN.length]);
      });
    }
    return { init, open, close };
  })();

  /* ================================================================= TOUR */
  const Tour = (() => {
    const el = $('#tour');
    let stations = [], idx = 0, playing = false, voiceOn = true, timer = 0, raf = 0, t0 = 0, dur = 0, open = false, lastFocus = null;
    function build() {
      stations = [];
      SALAS.forEach((s) => { stations.push({ type: 'sala', s }); bySala[s.n - 1].forEach((g) => stations.push({ type: 'gen', g, s })); });
      stations.push({ type: 'fin' });
    }
    function narration(st) {
      if (st.type === 'sala') return `Sala ${st.s.num}. ${st.s.titulo}. ${st.s.periodo}. ${st.s.intro}`;
      if (st.type === 'gen') return `${st.g.nombre}. ${st.g.titulo}. ${st.g.resumen}${st.g.cita ? ` ${st.g.cita.t}` : ''}`;
      return 'Fin del recorrido. La antorcha ahora está en tus manos. Heme aquí, envíame a mí.';
    }
    function estimate(text) { return clamp((text.split(/\s+/).length / 2.5) * 1000 + 1800, 6000, 26000); }
    function stationHTML(st) {
      if (st.type === 'sala') {
        const n = bySala[st.s.n - 1].length;
        return `<div class="ts-inter" style="--c:${st.s.color}"><div><p class="per">${esc(st.s.periodo)} · ${n} generales</p><div class="num">${st.s.num}</div><h2>${esc(st.s.titulo)}</h2><p>${esc(st.s.intro)}</p></div></div>`;
      }
      if (st.type === 'fin') {
        return `<div class="ts-inter" style="--c:#e9c46a"><div><p class="per">Fin del recorrido</p><svg class="finale-emblem" viewBox="0 0 64 64" aria-hidden="true"><use href="#emblem"/></svg><h2>Heme aquí, envíame a mí</h2><p>La antorcha que pasó por estas manos hoy está en las tuyas.</p>
          <div class="hero-actions" style="margin-top:26px"><button class="btn btn-gold" type="button" data-t="restart">${svgIcon('reiniciar')}<span>Volver a empezar</span></button><button class="btn btn-ghost" type="button" data-t="close">${svgIcon('cerrar')}<span>Salir del tour</span></button></div></div></div>`;
      }
      const g = st.g;
      return `<div class="ts" style="--c:${g.c}">
        <div class="ts-frame ${g.img ? 'has-img' : ''}">${medallion(g)}${imgTag(g, 960, 'eager')}</div>
        <div class="ts-text">
          <p class="kicker">Sala ${st.s.num} · ${esc(st.s.titulo)}</p>
          <h2 class="ts-name">${esc(g.nombre)}</h2>
          <p class="ts-epi">${esc(g.titulo)}</p>
          <div class="ts-meta"><span>${svgIcon('calendario')}${esc(g.fechas)}</span><span>${svgIcon('pin')}${esc(g.lugar)}</span></div>
          <p class="ts-sum">${esc(g.resumen)}</p>
          ${g.cita ? `<blockquote class="ts-quote">«${esc(g.cita.t)}»<cite>${esc(g.cita.f)}</cite></blockquote>` : `<blockquote class="ts-quote">«${esc(g.verso.t)}»<cite>${esc(g.verso.r)}</cite></blockquote>`}
        </div>
      </div>`;
    }
    function genIndex() { let n = 0; for (let k = 0; k <= idx; k++) if (stations[k].type === 'gen') n++; return n; }
    function render(dir) {
      const st = stations[idx];
      const stage = $('#tour-stage');
      const old = stage.firstElementChild;
      const wrap = document.createElement('div');
      wrap.innerHTML = stationHTML(st);
      const node = wrap.firstElementChild;
      if (!RM) node.classList.add('enter');
      if (dir < 0 && !RM) node.style.animationName = 'tsIn';
      stage.appendChild(node);
      if (old) { if (RM) old.remove(); else { old.classList.add('leave'); setTimeout(() => old.remove(), 560); } }
      const col = st.type === 'gen' ? st.g.c : st.type === 'sala' ? st.s.color : '#e9c46a';
      el.style.setProperty('--c', col);
      $('#tour-bg').style.setProperty('--tbg', st.type === 'gen' && st.g.img ? `url("${imgURL(st.g, 330)}")` : 'none');
      $('#tour-sala').textContent = st.type === 'fin' ? 'Generales de Dios' : `Sala ${st.s.num} · ${st.s.titulo}`;
      $('#tour-count').textContent = st.type === 'gen' ? `${pad2(genIndex())} / ${GEN.length}` : st.type === 'sala' ? `Sala ${st.s.n} / ${SALAS.length}` : '';
      $('#tour-jump').value = st.type === 'fin' ? '' : String(st.s.n);
      schedule();
    }
    function setProgress(p) { $('#tour-progress').style.setProperty('--tp', p.toFixed(4)); }
    function clearTimers() { clearTimeout(timer); cancelAnimationFrame(raf); Voice.stop(); }
    function schedule() {
      clearTimers();
      setProgress(0);
      if (!playing || stations[idx].type === 'fin') return;
      const text = narration(stations[idx]);
      dur = estimate(text);
      t0 = performance.now();
      const tick = (t) => { setProgress(clamp((t - t0) / dur, 0, 1)); if (playing) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      const started = performance.now();
      const advance = () => {
        if (!playing) return;
        const elapsed = performance.now() - started;
        // si la voz terminó demasiado pronto (sin voces disponibles o error), respeta el tiempo de lectura
        const wait = elapsed < dur * 0.55 ? dur - elapsed : 1100;
        timer = setTimeout(() => go(idx + 1, 1), wait);
      };
      if (voiceOn && Voice.ok) Voice.speak(text, advance);
      else timer = setTimeout(() => go(idx + 1, 1), dur);
    }
    function go(i, dir) {
      idx = clamp(i, 0, stations.length - 1);
      render(dir || 1);
    }
    function playBtn() {
      const b = $('#tour-play');
      b.innerHTML = svgIcon(playing ? 'pausa' : 'play');
      b.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    }
    function setPlaying(v) {
      playing = v;
      playBtn();
      if (v) schedule(); else { clearTimers(); setProgress(0); }
    }
    function start(fromSala) {
      build();
      lastFocus = document.activeElement;
      const n = clamp(+fromSala || 1, 1, SALAS.length);
      idx = stations.findIndex((st) => st.type === 'sala' && st.s.n === n);
      el.hidden = false;
      open = true;
      el.classList.remove('open'); void el.offsetWidth; el.classList.add('open');
      document.body.classList.add('no-scroll');
      $('#tour-stage').innerHTML = '';
      playing = true;
      playBtn();
      render(1);
      $('#tour-play').focus({ preventScroll: true });
    }
    function close() {
      clearTimers();
      playing = false;
      open = false;
      el.hidden = true;
      if (!$('#perfil').open) document.body.classList.remove('no-scroll');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function init() {
      $('#tour-jump').innerHTML = SALAS.map((s) => `<option value="${s.n}">Sala ${s.num} · ${esc(s.titulo)}</option>`).join('');
      $('#tour-close').addEventListener('click', close);
      $('#tour-prev').addEventListener('click', () => go(idx - 1, -1));
      $('#tour-next').addEventListener('click', () => go(idx + 1, 1));
      $('#tour-play').addEventListener('click', () => setPlaying(!playing));
      const vb = $('#tour-voice');
      if (!Voice.ok) { vb.hidden = true; voiceOn = false; }
      vb.addEventListener('click', () => { voiceOn = !voiceOn; vb.setAttribute('aria-pressed', String(voiceOn)); if (playing) schedule(); else Voice.stop(); });
      $('#tour-jump').addEventListener('change', (e) => go(stations.findIndex((st) => st.type === 'sala' && st.s.n === +e.target.value), 1));
      $('#tour-more').addEventListener('click', () => { const st = stations[idx]; const g = st.type === 'gen' ? st.g : st.type === 'sala' ? bySala[st.s.n - 1][0] : null; if (g) Profile.open(g.id); });
      el.addEventListener('click', (e) => { const t = e.target.closest('[data-t]'); if (!t) return; if (t.dataset.t === 'restart') { idx = 0; playing = true; playBtn(); render(1); } if (t.dataset.t === 'close') close(); });
      document.addEventListener('keydown', (e) => {
        if (!open || $('#perfil').open) return;
        if (e.target.closest && e.target.closest('select')) return;
        if (e.key === 'Tab') {
          const f = $$('button:not([hidden]), select, [href]', el).filter((x) => x.offsetParent !== null);
          if (f.length) {
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            else if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
          }
          return;
        }
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') go(idx + 1, 1);
        else if (e.key === 'ArrowLeft') go(idx - 1, -1);
        else if (e.key === ' ' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); setPlaying(!playing); }
      });
      let sx = 0, sy = 0;
      el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      el.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) go(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }, { passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden && open && playing) setPlaying(false); });
    }
    return { init, start, close, pause: () => { if (playing) setPlaying(false); }, isOpen: () => open };
  })();

  /* ================================================================ CRÉDITOS */
  function initCredits() {
    const dlg = $('#creditos');
    $('#cr-list').innerHTML = GEN.filter((g) => g.img).map((g) => `<li><strong>${esc(g.nombre)}</strong> — ${esc(g.cred || '')}. <a href="${commonsPage(g.img)}" target="_blank" rel="noopener">Ver archivo y licencia</a></li>`).join('') +
      '<li><strong>Mapa</strong> — Natural Earth (dominio público), vía el paquete world-atlas.</li><li><strong>Íconos</strong> — Lucide (licencia ISC) y diseños propios del portal.</li>';
    $('#open-credits').addEventListener('click', () => { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    $('#sources').innerHTML = D.fuentes.map((f) => `<li><strong>${f.url ? `<a href="${f.url}" target="_blank" rel="noopener">${esc(f.t)}</a>` : esc(f.t)}</strong><span>${esc(f.d)}</span></li>`).join('');
  }

  /* =================================================================== TOAST */
  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ======================================================= DELEGACIÓN GLOBAL */
  function initDelegation() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tour-start]');
      if (t) { e.preventDefault(); Tour.start(+t.dataset.tourStart || 1); return; }
      const o = e.target.closest('[data-open]');
      if (o) { e.preventDefault(); Profile.open(o.dataset.open); }
    });
  }

  /* ===================================================================== INICIO */
  function init() {
    renderHero();
    renderSalas();
    Scrub.init();
    hydrateIcons();
    Corridors.init();
    Rail.init();
    Nav.init();
    Timeline.init();
    MapView.init();
    Cities.init();
    Chains.init();
    Quotes.init();
    Explore.init();
    Quiz.init();
    Profile.init();
    Tour.init();
    initCredits();
    initDelegation();
    initPointerFX();
    hydrateIcons();
    observeAll();
    Hero.init();
    Loop.init();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { Corridors.measure(); Loop.request(); });
    initPreloader();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
