(function () {
  'use strict';
  var PAGE_URL = 'https://elcaminodeldiscipulo.vercel.app/';
  var SHARE_TEXT = '📖 Te recomiendo «El Camino del Discípulo», un libro para crecer en la fe y permanecer fieles a Cristo hasta el final. Mira el tráiler y consíguelo en Amazon: ';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- Barra superior ---------- */
  var nav = $('nav');
  function onScroll() { nav.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Polvo dorado en la portada ---------- */
  var cv = $('dust'), ctx = cv && cv.getContext && cv.getContext('2d');
  if (ctx && !reduce) {
    var P = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), running = true;
    function size() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    var count = window.innerWidth < 640 ? 45 : 90;
    for (var i = 0; i < count; i++) P.push({ x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.8, v: .00006 + Math.random() * .00018, ph: Math.random() * 6.28, a: .25 + Math.random() * .6 });
    new IntersectionObserver(function (e) { running = e[0].isIntersecting; if (running) requestAnimationFrame(draw); }).observe(cv);
    function draw(t) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var k = 0; k < P.length; k++) {
        var p = P[k]; p.y -= p.v * 16; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
        var x = (p.x + Math.sin(t / 2400 + p.ph) * .01) * W, tw = .55 + .45 * Math.sin(t / 700 + p.ph * 3);
        ctx.beginPath(); ctx.arc(x, p.y * H, p.r, 0, 6.283);
        ctx.fillStyle = 'rgba(246,220,160,' + (p.a * tw).toFixed(3) + ')'; ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  /* ---------- Libro 3D que sigue el puntero ---------- */
  var book = $('book3d');
  if (book && !reduce && window.matchMedia('(hover: hover)').matches) {
    var inner = book.querySelector('.book3d__inner'), shine = book.querySelector('.book3d__shine');
    document.querySelector('.hero').addEventListener('pointermove', function (e) {
      var r = book.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth, dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      inner.style.transform = 'rotateY(' + (-18 + dx * 22).toFixed(2) + 'deg) rotateX(' + (4 - dy * 14).toFixed(2) + 'deg)';
      shine.style.setProperty('--shine', (60 - dx * 80).toFixed(1) + '%');
    });
    document.querySelector('.hero').addEventListener('pointerleave', function () { inner.style.transform = ''; });
  }

  /* ---------- Aparición al hacer scroll ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: .18 }) : null;
  document.querySelectorAll('.head, .about__text, .audio-card, .checks li, .quote blockquote, .verse, .stage, .review__intro, .steps li, .kit__item, .file, .share, .closing__inner, .player')
    .forEach(function (el, i) {
      if (!io) return;
      el.classList.add('reveal'); el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el);
    });
  var stars = $('stars');
  if (stars && io) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { stars.classList.add('is-lit'); o.disconnect(); } }, { threshold: 1 }).observe(stars);

  /* ---------- Línea del recorrido y parallax ---------- */
  var journey = $('journey'), fill = $('journey-fill'), qbg = document.querySelector('.quote__bg'), ticking = false;
  function onScrollFx() {
    ticking = false;
    var vh = window.innerHeight;
    if (journey && fill) {
      var r = journey.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * .6 - r.top) / r.height));
      fill.style.height = (p * 100).toFixed(1) + '%';
    }
    if (qbg && !reduce) {
      var q = qbg.parentElement.getBoundingClientRect();
      if (q.bottom > 0 && q.top < vh) qbg.style.setProperty('--parallax', ((q.top + q.height / 2 - vh / 2) * -.15).toFixed(1) + 'px');
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFx); } }, { passive: true });
  onScrollFx();

  /* ---------- Tráiler ---------- */
  var video = $('video'), player = $('player'), big = $('video-big');
  function playTrailer() {
    pauseAudio();
    player.classList.add('is-started'); video.setAttribute('controls', '');
    var pr = video.play(); if (pr && pr.catch) pr.catch(function () {});
  }
  big.addEventListener('click', playTrailer);
  video.addEventListener('play', function () { player.classList.add('is-started'); video.setAttribute('controls', ''); pauseAudio(); });
  document.querySelectorAll('[data-play-trailer]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      $('trailer').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      setTimeout(playTrailer, reduce ? 0 : 650);
    });
  });

  /* ---------- Presentación narrada ---------- */
  var PEAKS = [0.26, 0.32, 0.17, 0.14, 0.15, 0.06, 0.06, 0.06, 0.27, 0.29, 0.11, 0.06, 0.37, 0.51, 0.49, 0.41, 0.3, 0.26, 0.45, 0.07, 0.68, 0.42, 0.33, 0.31, 0.21, 0.34, 0.45, 0.27, 0.23, 0.26, 0.31, 0.25, 0.07, 0.06, 0.51, 0.58, 0.37, 0.06, 0.43, 1.0, 0.38, 0.23, 0.38, 0.57, 0.61, 0.23, 0.06, 0.28, 0.46, 0.54, 0.4, 0.25, 0.41, 0.21, 0.56, 0.52, 0.19, 0.45, 0.31, 0.44, 0.17, 0.06, 0.61, 0.84, 0.43, 0.41, 0.4, 0.45, 0.1, 0.06, 0.21, 0.57, 0.52, 0.32, 0.28, 0.4, 0.33, 0.26, 0.15, 0.11, 0.17, 0.58, 0.22, 0.48, 0.27, 0.23, 0.21, 0.06, 0.56, 0.79, 0.56, 0.11, 0.82, 0.69, 0.65, 0.06];
  var CUES = [
    [0.0, 'Todo camino comienza con un primer paso…'], [3.2, 'Pero no basta con comenzar.'],
    [5.15, 'Después de mucho tiempo de oración y trabajo,'], [8.1, 'llega un libro pensado para quienes desean crecer en su relación con Dios y fortalecer su fe.'],
    [13.75, 'El Camino del Discípulo.'], [15.65, 'A lo largo de sus capítulos, recorre el camino del discípulo:'],
    [19.2, 'desde los fundamentos de la vida cristiana…'], [21.6, '…hasta una fe madura, firme y perseverante.'],
    [24.95, 'Siempre basada en la enseñanza de las Sagradas Escrituras.'], [28.45, 'Porque el verdadero desafío no es solo comenzar la vida cristiana…'],
    [32.55, '…es permanecer fieles a Cristo hasta el final.'], [35.65, 'El Camino del Discípulo.'], [37.4, 'Ya disponible en Amazon.']
  ];
  var audio = $('audio'), wave = $('wave'), cap = $('caption'), mini = $('mini'), miniCap = $('mini-cap'), miniBar = $('mini-bar');
  var toggles = document.querySelectorAll('[data-audio-toggle]');
  PEAKS.forEach(function (v) { var bar = document.createElement('i'); bar.style.height = Math.round(v * 100) + '%'; wave.appendChild(bar); });
  var bars = wave.children, lastCue = -1;
  function setPlaying(on) {
    toggles.forEach(function (b) { b.classList.toggle('is-playing', on); });
    if (on) { mini.hidden = false; requestAnimationFrame(function () { mini.classList.add('is-shown'); }); }
  }
  function pauseAudio() { if (!audio.paused) audio.pause(); }
  toggles.forEach(function (b) {
    b.addEventListener('click', function () {
      if (audio.paused) { if (!video.paused) video.pause(); var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); }
      else audio.pause();
    });
  });
  audio.addEventListener('play', function () { setPlaying(true); });
  audio.addEventListener('pause', function () { setPlaying(false); });
  audio.addEventListener('ended', function () {
    setPlaying(false); audio.currentTime = 0; cap.textContent = '¡Gracias por escuchar! Ya disponible en Amazon.';
    setTimeout(function () { mini.classList.remove('is-shown'); }, 1800);
  });
  audio.addEventListener('loadedmetadata', function () { $('t-dur').textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', function () {
    var d = audio.duration || 38.8, t = audio.currentTime, p = t / d, n = Math.floor(p * bars.length);
    for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < n);
    $('t-cur').textContent = fmt(t); miniBar.style.width = (p * 100).toFixed(2) + '%';
    wave.setAttribute('aria-valuenow', Math.round(p * 100));
    var c = 0; for (var k = 0; k < CUES.length; k++) if (t >= CUES[k][0] - .1) c = k;
    if (c !== lastCue) { lastCue = c; cap.textContent = CUES[c][1]; miniCap.textContent = CUES[c][1]; }
  });
  function seek(e) {
    var r = wave.getBoundingClientRect(), p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    var go = function () { audio.currentTime = p * (audio.duration || 38.8); };
    if (audio.readyState < 1) { audio.addEventListener('loadedmetadata', go, { once: true }); audio.load(); } else go();
    if (audio.paused) { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }
  wave.addEventListener('click', seek);
  wave.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggles[0].click(); }
  });

  /* ---------- Compartir ---------- */
  var status = $('share-status');
  function say(msg) { status.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { status.textContent = ''; }, 3500); }
  $('share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT + PAGE_URL);
  $('share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(PAGE_URL);
  $('share-copy').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(PAGE_URL).then(function () { say('¡Enlace copiado! ✓'); }, function () { say('Copia este enlace: ' + PAGE_URL); });
    } else say('Copia este enlace: ' + PAGE_URL);
  });
  var nativeBtn = $('share-native');
  if (navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function () {
      navigator.share({ title: 'El Camino del Discípulo', text: SHARE_TEXT, url: PAGE_URL }).catch(function () {});
    });
  }
})();
