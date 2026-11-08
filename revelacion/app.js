/* ==========================================================
   Revelación de género · En vivo
   Todo lo editable está en config.json
   ========================================================== */
(function () {
  "use strict";

  var DEFAULTS = {
    inicio: "2026-11-08T17:20:00-05:00",
    duracionHoras: 2.5,
    youtube: "",
    facebook: "",
    url: "",
    formato: "horizontal",
    revelado: "",
    whatsapp: "",
    meet: "",
    fotos: []
  };
  var POLL_MS = 30000;
  var VOTES_POLL_MS = 15000;
  // Base de datos de votos (Supabase). La llave es pública a propósito:
  // solo permite votar y leer el conteo, no ver ni borrar los votos.
  var VOTES_API = "https://jbhtiakcfergqltnvgtx.supabase.co";
  var VOTES_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaHRpYWtjZmVyZ3FsdG52Z3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4ODkwMTYsImV4cCI6MjEwOTQ2NTAxNn0.7osLkacK7pxGUMeGyS9sLHTo9VrcbCROyM-Ai8iA7FQ";
  // ?v=520: enlace nuevo para que WhatsApp no muestre la vista previa vieja (decía 3 p.m.)
  var PAGE_URL = location.origin + location.pathname + "?v=520";
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COLORS = {
    nino: ["#9fd0f1", "#5aa3d3", "#cfe9fb", "#ffffff", "#3f86b8"],
    nina: ["#f6a9c3", "#e5779e", "#ffd1e0", "#ffffff", "#cf5a85"],
    mix: ["#9fd0f1", "#5aa3d3", "#f6a9c3", "#e5779e", "#f3e6cc", "#e0b85a", "#ffffff"]
  };
  var BALLOON = {
    pink: ["#f6a9c3", "#e5779e", "#c95f86"],
    blue: ["#9fd0f1", "#68a9d8", "#4c8dbd"],
    cream: ["#f2e4c6", "#dcc79f", "#bfa676"]
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };

  var params = new URLSearchParams(location.search);
  var cfg = Object.assign({}, DEFAULTS);
  var shownReveal = "";
  var currentEmbed = "";

  /* ---------------- Utilidades ---------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normTeam(v) {
    v = String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (/^(nino|boy|azul|varon|m)$/.test(v)) return "nino";
    if (/^(nina|girl|rosa|rosada|f)$/.test(v)) return "nina";
    return "";
  }
  function startMs() { var t = Date.parse(cfg.inicio); return isNaN(t) ? Date.parse(DEFAULTS.inicio) : t; }
  function endMs() { return startMs() + (Number(cfg.duracionHoras) || 3) * 3600000; }

  /* ---------------- Configuración (se revisa sola) ---------------- */
  function loadConfig() {
    return fetch("config.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { cfg = Object.assign({}, DEFAULTS, data); })
      .catch(function () { /* se queda con lo último que tenía */ })
      .then(applyOverrides);
  }
  function applyOverrides() {
    // Para probar sin tocar config.json:  ?yt=LINK  ?fb=LINK  ?revelar=nina|nino  ?formato=vertical
    if (params.get("yt")) cfg.youtube = params.get("yt");
    if (params.get("fb")) cfg.facebook = params.get("fb");
    if (params.get("formato")) cfg.formato = params.get("formato");
    if (params.get("revelar")) cfg.revelado = params.get("revelar");
  }
  function refresh() {
    return loadConfig().then(function () {
      updatePlayer();
      updatePhase();
      checkReveal();
      updatePhotoLinks();
      initCalendar();
      renderGallery();
    });
  }

  /* ---------------- Reproductor ---------------- */
  function youtubeId(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^[\w-]{11}$/.test(s)) return s;
    try {
      var u = new URL(s);
      if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1, 12);
      if (u.searchParams.get("v")) return u.searchParams.get("v").slice(0, 11);
      var m = u.pathname.match(/\/(live|embed|shorts|v)\/([\w-]{11})/);
      if (m) return m[2];
    } catch (e) { /* no es URL */ }
    return "";
  }
  function getEmbed() {
    var id = youtubeId(cfg.youtube);
    if (id) {
      return {
        src: "https://www.youtube.com/embed/" + id + "?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1",
        open: "https://www.youtube.com/watch?v=" + id
      };
    }
    if (cfg.facebook) {
      return {
        src: "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(cfg.facebook) + "&show_text=false&autoplay=true&mute=true",
        open: cfg.facebook
      };
    }
    if (cfg.url && /^https:\/\//.test(cfg.url)) return { src: cfg.url, open: cfg.url };
    return null;
  }
  // Google Meet no se puede mostrar dentro de una página: se ofrece un botón para entrar
  function meetUrl() {
    var u = String(cfg.meet || "").trim();
    return /^https:\/\/meet\.google\.com\//.test(u) ? u : "";
  }
  function updateMeet() {
    var url = meetUrl(), box = $("#phMeet");
    box.hidden = !url || !!getEmbed();
    $("#playerFrame").classList.toggle("meet-mode", !box.hidden);
    if (!url) return;
    $("#meetLink").href = url;
  }
  function hasLive() { return !!getEmbed() || !!meetUrl(); }

  function updatePlayer() {
    var frame = $("#playerFrame");
    frame.classList.toggle("vertical", String(cfg.formato).toLowerCase() === "vertical");
    updateMeet();

    var e = getEmbed();
    var key = e ? e.src : "";
    if (key === currentEmbed) return;
    currentEmbed = key;

    var player = $("#player");
    var old = $("iframe", player);
    if (old) old.remove();
    $("#placeholder").hidden = !!e;
    $("#openExternal").hidden = !e;

    if (e) {
      var f = document.createElement("iframe");
      f.src = e.src;
      f.title = "Transmisión en vivo de la revelación de género";
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen; web-share";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      player.appendChild(f);
      $("#openExternalLink").href = e.open;
    }
  }

  /* ---------------- Cuenta regresiva y estado ---------------- */
  var cdEls = {};
  $$("#countdown [data-u]").forEach(function (el) { cdEls[el.getAttribute("data-u")] = el; });

  function setCd(u, v) {
    var el = cdEls[u];
    if (el.textContent !== v) {
      el.textContent = v;
      el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
    }
  }
  function tick() {
    var now = Date.now(), diff = startMs() - now;
    if (diff > 0) {
      var s = Math.floor(diff / 1000);
      var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      setCd("d", String(d)); setCd("h", pad(h)); setCd("m", pad(m)); setCd("s", pad(sec));
      $("#phCount").textContent = d > 0
        ? "Faltan " + d + (d === 1 ? " día " : " días ") + pad(h) + ":" + pad(m) + ":" + pad(sec)
        : "Faltan " + pad(h) + ":" + pad(m) + ":" + pad(sec);
    } else {
      $("#phCount").textContent = "";
    }
    updatePhase();
  }

  var lastPhase = "";
  function updatePhase() {
    var now = Date.now(), st = startMs(), en = endMs();
    var hasStream = hasLive();
    var isMeet = !getEmbed() && !!meetUrl();
    var revealed = normTeam(cfg.revelado);
    var phase;
    if (now >= en) phase = "fin";
    else if (now >= st - 30 * 60000) phase = hasStream ? "vivo" : "casi";
    else phase = "pronto";

    var key = phase + "|" + hasStream + "|" + isMeet + "|" + revealed;
    if (key === lastPhase) return;
    lastPhase = key;
    Sound.setLive(phase === "vivo");

    var pill = $("#statusPill");
    pill.setAttribute("data-state", phase);
    $("#statusText").textContent = { pronto: "Próximamente", casi: "Ya casi", vivo: "En vivo", fin: revealed ? "¡Ya lo sabemos!" : "Finalizado" }[phase];

    var started = now >= st;
    $("#countdown").hidden = started;
    var done = $("#countdownDone");
    done.hidden = !started;
    if (started) {
      done.textContent = phase === "fin" ? "¡Gracias por acompañarnos! 💕" : (hasStream ? "¡Estamos en vivo! 🎉" : "¡Ya comenzamos! 🎉");
    }

    var lead = $("#liveLead");
    if (phase === "vivo") lead.textContent = isMeet
      ? "¡Estamos en vivo por Google Meet! Toca el botón verde para entrar 🎉"
      : "¡Estamos en vivo! Sube el volumen 🔊 y celebra con nosotros.";
    else if (phase === "fin") lead.textContent = "Gracias por acompañarnos en este momento tan especial.";
    else lead.textContent = "Desde donde estés, acompáñanos en este momento tan especial.";

    if (isMeet) {
      if (phase === "vivo") {
        $("#phTitle").textContent = "¡Estamos en vivo! Entra ya 🎉";
        $("#phSub").textContent = "Toca el botón para unirte a la videollamada";
      } else if (phase === "fin") {
        $("#phTitle").textContent = "¡Gracias por acompañarnos!";
        $("#phSub").textContent = "Pronto compartiremos el video de este día.";
      } else {
        $("#phTitle").textContent = "Únete por Google Meet 🎥";
        $("#phSub").textContent = "Domingo 8 de noviembre · 5:20 p.m.";
      }
    } else if (!hasStream) {
      if (phase === "casi") {
        $("#phTitle").textContent = "¡Ya casi! Estamos preparando la cámara 🎥";
        $("#phSub").textContent = "La transmisión aparecerá aquí sola, no cierres la página.";
      } else if (phase === "fin") {
        $("#phTitle").textContent = "¡Gracias por acompañarnos!";
        $("#phSub").textContent = "Pronto compartiremos el video de este día.";
      } else {
        $("#phTitle").textContent = "La transmisión aparecerá aquí";
        $("#phSub").textContent = "Domingo 8 de noviembre · 5:20 p.m.";
      }
    }
  }

  function showLocalTime() {
    try {
      var st = new Date(startMs());
      var fmt = function (tz) {
        return new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(st);
      };
      var viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      var local = fmt(viewerTz), col = fmt("America/Bogota");
      if (local !== col) {
        var day = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(st);
        var el = $("#localTime");
        el.textContent = "En tu hora: " + day + ", " + local;
        el.hidden = false;
      }
    } catch (e) { /* sin Intl */ }
  }

  /* ---------------- Guirnalda de globos (como la decoración) ---------------- */
  function buildGarland() {
    var arch = $("#arch"), svg = $("#garland");
    var aw = arch.offsetWidth, ah = arch.offsetHeight;
    if (!aw) return;
    var s = aw / 340, M = 30;
    var Hu = ah / s + M * 2;
    svg.setAttribute("viewBox", "0 0 400 " + Hu.toFixed(1));
    svg.style.width = 400 * s + "px";
    svg.style.height = Hu * s + "px";
    svg.style.left = -M * s + "px";
    svg.style.top = -M * s + "px";

    var R = 170, cx = 200, cy = M + R, xl = M, yb = Hu - M - 20;
    var L1 = Math.max(0, yb - cy), arcSpan = Math.PI * (196 / 180), L2 = R * arcSpan, L = L1 + L2;
    function at(d, off) {
      if (d < L1) return [xl - off, yb - d];
      var th = Math.PI - (d - L1) / R;
      return [cx + (R + off) * Math.cos(th), cy - (R + off) * Math.sin(th)];
    }
    var rnd = mulberry32(20261108), items = [];
    function add(d, r, kind) {
      var off = r >= 10 ? r * 0.45 + rnd() * 12 - 2 : rnd() * 34 - 4;
      var p = at(d, off);
      items.push({ x: p[0] + (rnd() - 0.5) * 8, y: p[1] + (rnd() - 0.5) * 8, r: r, k: kind });
    }
    function kind() {
      var v = rnd();
      return v < 0.31 ? "pink" : v < 0.62 ? "blue" : v < 0.92 ? "cream" : "clear";
    }
    var nBig = Math.round(L / 11);
    for (var i = 0; i < nBig; i++) add(rnd() * L, 10 + Math.pow(rnd(), 1.5) * 26, kind());
    // racimo grande al final (como el lado azul de la foto)
    for (var j = 0; j < 9; j++) add(L - rnd() * L * 0.16, 14 + rnd() * 20, rnd() < 0.75 ? "blue" : "pink");
    // racimo en la base
    for (var k = 0; k < 8; k++) add(rnd() * L * 0.15, 14 + rnd() * 22, kind());
    // globitos pequeños encima
    for (var q = 0; q < Math.round(L / 14); q++) add(rnd() * L, 4 + rnd() * 6, rnd() < 0.5 ? "pink" : "blue");

    items.sort(function (a, b) { return b.r - a.r; });
    var html = "";
    items.forEach(function (b) {
      var x = b.x.toFixed(1), y = b.y.toFixed(1), r = b.r.toFixed(1);
      var style = ' style="--d:' + (-rnd() * 5).toFixed(2) + "s;--t:" + (4 + rnd() * 3).toFixed(2) + 's"';
      html += '<g class="gb"' + style + ">";
      if (b.k === "clear") {
        html += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#g-clear)" stroke="#fff" stroke-opacity=".9" stroke-width="1.2"/>';
        html += '<circle cx="' + (b.x + b.r * 0.12).toFixed(1) + '" cy="' + (b.y + b.r * 0.12).toFixed(1) + '" r="' + (b.r * 0.55).toFixed(1) + '" fill="url(#g-' + (rnd() < 0.5 ? "pink" : "blue") + ')" opacity=".85"/>';
      } else {
        html += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#g-' + b.k + ')"/>';
      }
      if (b.r > 9) {
        html += '<ellipse cx="' + (b.x - b.r * 0.36).toFixed(1) + '" cy="' + (b.y - b.r * 0.4).toFixed(1) + '" rx="' + (b.r * 0.22).toFixed(1) + '" ry="' + (b.r * 0.12).toFixed(1) + '" fill="#fff" opacity=".6" transform="rotate(-38 ' + (b.x - b.r * 0.36).toFixed(1) + " " + (b.y - b.r * 0.4).toFixed(1) + ')"/>';
      }
      html += "</g>";
    });
    svg.innerHTML = html;
  }

  /* ---------------- Estrellas del fondo ---------------- */
  function buildStars() {
    var box = $("#stars"), cols = ["#f7bfd2", "#bfe0f6", "#f7bfd2", "#bfe0f6", "#f3dca2"], html = "";
    var spots = [[8, 14], [88, 9], [14, 46], [92, 38], [6, 72], [84, 66], [20, 90], [74, 92], [50, 4], [96, 84], [3, 30], [62, 58]];
    spots.forEach(function (p, i) {
      html += '<svg class="star" style="left:' + p[0] + "%;top:" + p[1] + "%;--s:" + (12 + (i * 7) % 16) + "px;--c:" + cols[i % cols.length] + ";--d:" + (-i * 0.7).toFixed(1) + "s;--t:" + (2.8 + (i % 4) * 0.6).toFixed(1) + 's"><use href="#star"/></svg>';
    });
    box.innerHTML = html;
  }

  /* ---------------- Confeti ---------------- */
  var canvas = $("#confetti"), ctx = canvas.getContext("2d"), parts = [], running = false, dpr = 1;
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function heartPath(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(-s * 0.05, s * 0.05, -s * 0.5, s * 0.05, -s * 0.5, -s * 0.2);
    c.bezierCurveTo(-s * 0.5, -s * 0.5, -s * 0.1, -s * 0.55, 0, -s * 0.25);
    c.bezierCurveTo(s * 0.1, -s * 0.55, s * 0.5, -s * 0.5, s * 0.5, -s * 0.2);
    c.bezierCurveTo(s * 0.5, s * 0.05, s * 0.05, s * 0.05, 0, s * 0.3);
    c.fill();
  }
  function burst(x, y, colors, n, opts) {
    if (REDUCED) return;
    opts = opts || {};
    var spread = opts.spread || Math.PI * 2, angle = opts.angle == null ? -Math.PI / 2 : opts.angle, power = opts.power || 9;
    for (var i = 0; i < n; i++) {
      var a = angle + (Math.random() - 0.5) * spread, v = power * (0.45 + Math.random() * 0.75);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        s: rand(6, 12), rot: rand(0, 6.28), vr: rand(-0.25, 0.25),
        c: pick(colors), shape: Math.random() < (opts.hearts || 0.2) ? "heart" : (Math.random() < 0.5 ? "rect" : "circle"),
        life: 0, max: rand(140, 240), wob: rand(0, 6.28)
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function rain(colors, ms) {
    if (REDUCED) return;
    var end = Date.now() + ms;
    (function drop() {
      for (var i = 0; i < 6; i++) burst(rand(0, innerWidth), -20, colors, 1, { angle: Math.PI / 2, spread: 0.8, power: 3, hearts: 0.3 });
      if (Date.now() < end) setTimeout(drop, 60);
    })();
  }
  function cannons(colors) {
    burst(0, innerHeight, colors, 90, { angle: -Math.PI / 3, spread: 0.7, power: 19, hearts: 0.25 });
    burst(innerWidth, innerHeight, colors, 90, { angle: -Math.PI * 2 / 3, spread: 0.7, power: 19, hearts: 0.25 });
  }
  function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life++; p.vy += 0.16; p.vx *= 0.985; p.vy *= 0.985; p.wob += 0.08;
      p.x += p.vx + Math.sin(p.wob) * 0.6; p.y += p.vy; p.rot += p.vr;
      var alpha = Math.max(0, 1 - p.life / p.max);
      if (alpha <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = alpha; ctx.fillStyle = p.c;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === "heart") heartPath(ctx, p.s * 1.5);
      else if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.2, 0, 6.283); ctx.fill(); }
      else { ctx.scale(1, Math.cos(p.wob)); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------------- Sonido (canción de cuna + efectos sintetizados) ---------------- */
  var Sound = (function () {
    var ctx = null, master = null, noiseBuf = null;
    // Sonido activado por defecto; solo queda apagado si la persona lo silenció
    var enabled = store.get("revelacion-sonido") !== "0", live = false, paused = false, videoOn = false, unlocked = false;
    // Música de fondo: canción de cuna instrumental original (cajita de música, arpa y colchón suave),
    // grabada para repetirse sin cortes
    var MUSIC_URL = "assets/cancion-cuna.m4a", MUSIC_VOL = 0.6;
    var musicBuf = null, musicLoading = null, musicGain = null, musicSrc = null, wantMusic = false;
    var btn, hint;

    function N(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function ensure() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.8;
        var comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function ready() { return enabled && ensure(); }
    function env(g, t, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    function tone(f, t, d, o) {
      o = o || {};
      var a = o.a || 0.005, osc = ctx.createOscillator(), g = ctx.createGain(), node = osc;
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + a + d);
      if (o.lp) { var fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
      env(g, t, a, o.v || 0.2, d);
      node.connect(g); g.connect(o.dest || master);
      osc.start(t); osc.stop(t + a + d + 0.05);
    }
    function noise(t, d, o) {
      o = o || {};
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var ch = noiseBuf.getChannelData(0);
        for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var fl = ctx.createBiquadFilter(); fl.type = o.type || "bandpass"; fl.frequency.value = o.f || 2000; fl.Q.value = o.q || 0.8;
      var g = ctx.createGain(); env(g, t, o.a || 0.002, o.v || 0.3, d);
      src.connect(fl); fl.connect(g); g.connect(master);
      src.start(t, Math.random() * 0.5); src.stop(t + (o.a || 0.002) + d + 0.1);
    }
    function bell(f, t, v, d, dest) {
      tone(f, t, d, { v: v, dest: dest });
      tone(f * 2, t, d * 0.5, { v: v * 0.25, dest: dest });
      tone(f * 3.01, t, d * 0.25, { v: v * 0.08, dest: dest });
    }

    /* Efectos */
    function pop() {
      if (!ready()) return;
      var t = ctx.currentTime;
      noise(t, 0.07, { f: 1500, q: 0.7, v: 0.45 });
      tone(720, t, 0.09, { to: 140, v: 0.22, type: "triangle" });
    }
    function chime(t0) {
      if (!ready()) return;
      var t = ctx.currentTime, seq = t0 === "nino" ? [72, 76, 79, 84] : [76, 79, 83, 88];
      seq.forEach(function (m, i) { bell(N(m), t + i * 0.08, 0.15, 0.9); });
    }
    function drumroll(ms) {
      if (!ready()) return;
      var t0 = ctx.currentTime + 0.05, dur = ms / 1000, t = t0;
      while (t < t0 + dur) {
        var p = (t - t0) / dur;
        noise(t, 0.05, { f: 3000, q: 0.6, v: 0.04 + p * 0.32 });
        t += 0.08 - p * 0.04;
      }
      tone(N(38), t0, 0.25, { a: dur, v: 0.35 });
      tone(N(45), t0, 0.25, { a: dur, v: 0.12 });
    }
    function fanfare(t0) {
      if (!ready()) return;
      var t = ctx.currentTime;
      noise(t, 2, { type: "highpass", f: 5500, q: 0.3, v: 0.3 });   // platillo
      tone(N(36), t, 0.5, { v: 0.6, to: N(28) });                    // bombo
      [[0, 0.16, [67, 71, 74]], [0.2, 1.7, [72, 76, 79, 84]]].forEach(function (c) {
        c[2].forEach(function (m) {
          tone(N(m), t + c[0], c[1], { type: "sawtooth", v: 0.07, a: 0.02, lp: 2400 });
          tone(N(m), t + c[0], c[1], { type: "square", v: 0.025, a: 0.02, lp: 1600 });
        });
      });
      var steps = [0, 2, 4, 7, 9], base = t0 === "nino" ? 72 : 76;
      for (var i = 0; i < 14; i++) bell(N(base + steps[i % 5] + 12 * Math.floor(i / 5)), t + 0.4 + i * 0.07, 0.07, 0.8);
      tone(N(36), t + 2.1, 0.4, { v: 0.4, to: N(30) });
      noise(t + 2.1, 1.4, { type: "highpass", f: 6000, q: 0.3, v: 0.18 });
    }

    /* Efectos y música de los juegos */
    function sfx(name) {
      if (!ready()) return;
      var t = ctx.currentTime;
      if (name === "catch") {
        tone(880, t, 0.07, { type: "square", v: 0.05, lp: 3200 });
        tone(1320, t + 0.05, 0.09, { type: "square", v: 0.045, lp: 3200 });
      } else if (name === "gold") {
        [84, 88, 91, 96].forEach(function (m, i) { bell(N(m), t + i * 0.05, 0.09, 0.5); });
      } else if (name === "ouch") {
        tone(420, t, 0.28, { type: "sawtooth", v: 0.07, to: 140, lp: 1400 });
        noise(t, 0.08, { f: 700, v: 0.18 });
      } else if (name === "level") {
        [72, 76, 79, 84, 88].forEach(function (m, i) { tone(N(m), t + i * 0.07, 0.16, { type: "triangle", v: 0.13 }); });
        bell(N(96), t + 0.38, 0.08, 0.7);
      } else if (name === "over") {
        [67, 64, 60, 55].forEach(function (m, i) { tone(N(m), t + i * 0.2, 0.26, { type: "triangle", v: 0.13 }); });
      } else if (name === "start") {
        [60, 64, 67, 72].forEach(function (m, i) { tone(N(m), t + i * 0.08, 0.12, { type: "square", v: 0.04, lp: 2600 }); });
      } else if (name === "found") {
        bell(N(84), t, 0.12, 0.6); bell(N(91), t + 0.07, 0.1, 0.6);
      } else if (name === "wrong") {
        tone(230, t, 0.13, { type: "square", v: 0.05, lp: 900 });
        tone(180, t + 0.1, 0.16, { type: "square", v: 0.05, lp: 900 });
      } else if (name === "win") {
        fanfare("nina");
      }
    }
    // Musiquita original estilo videojuego; se acelera con el nivel
    var GMEL = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 74,
                72, 76, 79, 76, 77, 81, 84, 81, 79, 77, 76, 74, 72, 0, 72, 0];
    var GBASS = [48, 55, 50, 57, 48, 55, 43, 50, 48, 55, 53, 60, 55, 52, 48, 48];
    var gameOn = false, gTimer = null, gGain = null, gNext = 0, gStep = 0, gTempo = 1;
    function gSchedule() {
      var dur = 0.15 / gTempo;
      while (gNext < ctx.currentTime + 0.3) {
        var m = GMEL[gStep % GMEL.length];
        if (m) tone(N(m), gNext, dur * 0.9, { type: "square", v: 0.035, lp: 2200, dest: gGain });
        if (gStep % 2 === 0) tone(N(GBASS[(gStep / 2) % GBASS.length]), gNext, dur * 1.6, { type: "triangle", v: 0.08, dest: gGain });
        if (gStep % 4 === 2) noise(gNext, 0.03, { type: "highpass", f: 7000, v: 0.05 });
        gNext += dur; gStep++;
      }
    }
    function gameMusic(on) {
      if (!on) {
        gameOn = false;
        if (gTimer) {
          clearInterval(gTimer); gTimer = null;
          var g = gGain, now = ctx.currentTime;
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + 0.3);
          setTimeout(function () { g.disconnect(); }, 500);
        }
        startMusic();
        return;
      }
      gameOn = true;
      stopMusic();
      if (!ready() || gTimer) return;
      gGain = ctx.createGain(); gGain.gain.value = 1; gGain.connect(master);
      gNext = ctx.currentTime + 0.1; gStep = 0;
      gTimer = setInterval(gSchedule, 80);
      gSchedule();
    }
    function gameTempo(x) { gTempo = Math.max(0.5, Math.min(2.2, x || 1)); }

    /* Música de fondo */
    function loadMusic() {
      if (musicBuf || musicLoading) return musicLoading;
      musicLoading = fetch(MUSIC_URL)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (data) {
          return new Promise(function (ok, fail) { ctx.decodeAudioData(data, ok, fail); });
        })
        .then(function (buf) { musicBuf = buf; })
        .catch(function () { musicLoading = null; });
      return musicLoading;
    }
    function canPlayMusic() { return enabled && !live && !paused && !videoOn && !gameOn && !document.hidden; }
    function startMusic() {
      if (!canPlayMusic() || musicSrc || !ensure()) return;
      wantMusic = true;
      if (!musicBuf) {
        var p = loadMusic();
        if (p) p.then(function () { if (wantMusic && musicBuf) startMusic(); });
        return;
      }
      var now = ctx.currentTime;
      musicGain = ctx.createGain();
      musicGain.gain.setValueAtTime(0.0001, now);
      musicGain.gain.exponentialRampToValueAtTime(MUSIC_VOL, now + 1.2);
      musicGain.connect(master);
      musicSrc = ctx.createBufferSource();
      musicSrc.buffer = musicBuf;
      musicSrc.loop = true;
      musicSrc.connect(musicGain);
      musicSrc.start(now + 0.05);
    }
    function stopMusic() {
      wantMusic = false;
      if (!musicSrc) return;
      var src = musicSrc, g = musicGain, now = ctx.currentTime;
      musicSrc = null; musicGain = null;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      setTimeout(function () { try { src.stop(); } catch (e) { /* ya paró */ } g.disconnect(); }, 800);
    }

    function render() {
      btn.classList.toggle("on", enabled);
      btn.setAttribute("aria-pressed", String(enabled));
      btn.setAttribute("aria-label", enabled ? "Silenciar" : "Activar sonido");
      btn.title = enabled ? "Silenciar" : "Activar sonido";
    }
    function setEnabled(v) {
      enabled = v;
      store.set("revelacion-sonido", v ? "1" : "0");
      render();
      if (hint) { hint.remove(); hint = null; }
      if (v) { ensure(); chime("nina"); startMusic(); } else stopMusic();
    }
    function init() {
      btn = $("#soundBtn"); hint = $("#soundHint");
      render();
      btn.addEventListener("click", function () { setEnabled(!enabled); });
      if (enabled) {
        if (hint) { hint.remove(); hint = null; }
        // Intenta sonar sola; si el navegador lo bloquea, arranca con el primer toque
        var events = ["pointerdown", "touchend", "click", "keydown"];
        var unlock = function () {
          events.forEach(function (ev) { document.removeEventListener(ev, unlock, true); });
          unlocked = true;
          document.dispatchEvent(new Event("sonido-listo"));
          hideSplash();
          if (enabled) { ensure(); startMusic(); }
        };
        events.forEach(function (ev) { document.addEventListener(ev, unlock, true); });
        if (ensure()) {
          startMusic();
          setTimeout(function () {
            if (ctx.state === "running") unlock();
            else showSplash();
          }, 350);
        }
      } else {
        setTimeout(function () { if (hint) hint.classList.add("show"); }, 1800);
        setTimeout(function () { if (hint) hint.classList.remove("show"); }, 12000);
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stopMusic(); else startMusic();
      });
    }
    function showSplash() {
      var sp = $("#splash");
      if (!sp || sp.dataset.done) return;
      sp.hidden = false;
      document.body.classList.add("has-splash");
      $("#splashBtn").focus({ preventScroll: true });
    }
    function hideSplash() {
      var sp = $("#splash");
      if (!sp || sp.dataset.done) return;
      sp.dataset.done = "1";
      document.body.classList.remove("has-splash");
      if (sp.hidden) { sp.remove(); return; }
      sp.classList.add("leaving");
      burst(innerWidth / 2, innerHeight * 0.45, COLORS.mix, 70, { power: 11, hearts: 0.35 });
      setTimeout(function () { sp.remove(); }, 650);
    }
    function setLive(v) { live = v; if (v) stopMusic(); else startMusic(); }
    function pause(v) { paused = v; if (v) stopMusic(); else startMusic(); }
    function video(v) { videoOn = v; if (v) stopMusic(); else startMusic(); }

    function canSound() { return enabled && unlocked; }

    return { init: init, pop: pop, chime: chime, drumroll: drumroll, fanfare: fanfare, setLive: setLive, pause: pause, video: video, canSound: canSound, sfx: sfx, gameMusic: gameMusic, gameTempo: gameTempo };
  })();

  /* ---------------- Globos que suben (se pueden reventar) ---------------- */
  var layer = $("#balloonLayer"), balloonTimer = null, team = "";
  function spawnBalloon(force) {
    if (REDUCED || document.hidden) return;
    if (!force && layer.children.length >= 8) return;
    var revealed = normTeam(cfg.revelado);
    var palette = revealed === "nina" ? (Math.random() < 0.75 ? "pink" : "cream")
      : revealed === "nino" ? (Math.random() < 0.75 ? "blue" : "cream")
      : pick(["pink", "blue", "cream", "pink", "blue"]);
    var c = BALLOON[palette];
    var w = rand(40, 66);
    var edge = force ? rand(4, 92) : (Math.random() < 0.5 ? rand(0, 14) : rand(82, 94));
    var b = document.createElement("button");
    b.type = "button";
    b.className = "fb";
    b.tabIndex = -1;
    b.setAttribute("aria-hidden", "true");
    b.style.cssText = "--x:" + edge + "%;--w:" + w.toFixed(0) + "px;--dur:" + rand(13, 19).toFixed(1) + "s;--sw:" + rand(2.8, 4.4).toFixed(1) + "s;--c1:" + c[0] + ";--c2:" + c[1] + ";--c3:" + c[2] + ";animation-delay:" + (force ? rand(0, 1.2).toFixed(2) : 0) + "s";
    b.innerHTML = '<span class="shape"></span>';
    b.addEventListener("animationend", function (ev) { if (ev.animationName === "rise") b.remove(); });
    b.addEventListener("pointerdown", function () {
      if (b.classList.contains("popping")) return;
      var r = b.getBoundingClientRect();
      b.classList.add("popping");
      Sound.pop();
      burst(r.left + r.width / 2, r.top + r.height / 2, [c[0], c[1], "#fff", "#f3e6cc"], 26, { power: 6 });
      setTimeout(function () { b.remove(); }, 330);
    });
    layer.appendChild(b);
  }
  function startBalloons() {
    if (REDUCED) return;
    clearInterval(balloonTimer);
    balloonTimer = setInterval(spawnBalloon, 2600);
    setTimeout(spawnBalloon, 600);
  }
  function balloonRelease(n) {
    for (var i = 0; i < n; i++) setTimeout(function () { spawnBalloon(true); }, i * 120);
  }

  /* ---------------- Equipos y corazones ---------------- */
  function floatHeart(t) {
    if (REDUCED) return;
    var box = $("#hearts");
    var h = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    h.setAttribute("class", "fh");
    h.setAttribute("viewBox", "0 0 32 29");
    h.innerHTML = '<use href="#heart"/>';
    var col = t === "nino" ? pick(["#5aa3d3", "#9fd0f1", "#3f86b8"]) : pick(["#e5779e", "#f6a9c3", "#cf5a85"]);
    h.style.cssText = "--c:" + col + ";--s:" + rand(22, 38).toFixed(0) + "px;--dx:" + rand(-60, 40).toFixed(0) + "px;--r:" + rand(-30, 30).toFixed(0) + "deg;--dur:" + rand(2.2, 3.4).toFixed(1) + "s";
    h.addEventListener("animationend", function () { h.remove(); });
    box.appendChild(h);
  }
  function renderTeam() {
    $$(".team-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-team") === team)); });
    var msg = $("#teamMsg"), revealed = normTeam(cfg.revelado);
    if (revealed && team) {
      msg.textContent = team === revealed ? "¡Acertaste! Eres del team ganador 🏆🎉" : "¡Casi! Pero lo vamos a amar igualito 💕";
    } else if (team === "nino") {
      msg.textContent = "¡Eres Team Niño! 💙 Ponte tu camiseta azul y envíanos la foto 📸";
    } else if (team === "nina") {
      msg.textContent = "¡Eres Team Niña! 💗 Ponte tu camiseta rosada y envíanos la foto 📸";
    } else {
      msg.textContent = "";
    }
  }
  /* ---------------- Votos compartidos ---------------- */
  var Votes = (function () {
    var counts = null, busy = false;
    function enabledApi() { return !/^__/.test(VOTES_API); }
    function voterId() {
      var id = store.get("revelacion-id");
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function () { return ((Math.random() * 16) | 0).toString(16); });
        store.set("revelacion-id", id);
      }
      return id;
    }
    function rpc(name, body) {
      return fetch(VOTES_API + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: VOTES_KEY, Authorization: "Bearer " + VOTES_KEY },
        body: JSON.stringify(body || {})
      }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    function setNum(el, v, old) {
      el.textContent = v;
      if (old != null && old !== v) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    }
    function show(c) {
      if (!c) return;
      var n = Number(c.nino) || 0, g = Number(c.nina) || 0, tot = n + g;
      var prev = counts;
      counts = { nino: n, nina: g };
      $("#scoreboard").hidden = false;
      setNum($("#sbNino"), n, prev && prev.nino);
      setNum($("#sbNina"), g, prev && prev.nina);
      $("#sbTotal").textContent = tot === 1 ? "1 voto" : tot + " votos";
      var pn = tot ? Math.round(n * 100 / tot) : 50, pg = tot ? 100 - pn : 50;
      $("#sbFillNino").style.flexGrow = tot ? Math.max(n, tot * 0.06) : 1;
      $("#sbFillNina").style.flexGrow = tot ? Math.max(g, tot * 0.06) : 1;
      $("#sbPctNino").textContent = pn + "%";
      $("#sbPctNina").textContent = pg + "%";
      $("#sbBar").setAttribute("aria-label", "Team Niño " + n + " votos, Team Niña " + g + " votos");
      var r = normTeam(cfg.revelado);
      $("#sbNote").textContent = r
        ? "Resultado final de la votación · " + (r === "nina" ? pg : pn) + "% acertó 🎉"
        : "Marcador en vivo · se actualiza solo";
    }
    function load() {
      if (!enabledApi() || busy || document.hidden) return;
      busy = true;
      rpc("revelacion_conteo").then(show).catch(function () { /* sin conexión: se reintenta */ }).then(function () { busy = false; });
    }
    function vote(t) {
      if (!enabledApi()) return;
      var before = store.get("revelacion-votado");
      if (counts && before !== t) {
        // respuesta inmediata en pantalla mientras se guarda
        var c = { nino: counts.nino, nina: counts.nina };
        c[t]++;
        if (before === "nino" || before === "nina") c[before] = Math.max(0, c[before] - 1);
        show(c);
      }
      rpc("revelacion_votar", { p_votante: voterId(), p_equipo: t })
        .then(function (c) { store.set("revelacion-votado", t); show(c); })
        .catch(function () { load(); });
    }
    function init() {
      if (!enabledApi()) return;
      load();
      setInterval(load, VOTES_POLL_MS);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
      // Si eligió equipo antes de que existiera el marcador, se envía su voto guardado
      var t = store.get("revelacion-team");
      if ((t === "nino" || t === "nina") && store.get("revelacion-votado") !== t && !normTeam(cfg.revelado)) vote(t);
    }
    return { init: init, vote: vote, rpc: rpc, voterId: voterId, refresh: function () { if (counts) show(counts); } };
  })();

  function initTeams() {
    team = store.get("revelacion-team") || "";
    renderTeam();
    $$(".team-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-team");
        if (!normTeam(cfg.revelado)) {
          // después de la revelación ya no se cambian los votos
          team = t; store.set("revelacion-team", t);
          Votes.vote(t);
        }
        renderTeam();
        var r = b.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 3, COLORS[t], 40, { power: 8, hearts: 0.5 });
        Sound.chime(t);
        for (var i = 0; i < 6; i++) setTimeout(function () { floatHeart(t); }, i * 140);
        if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) { /* nada */ } }
      });
    });
  }

  /* ---------------- ¡La gran revelación! ---------------- */
  var TEXT = {
    nina: { title: "¡Es una <b>Niña!</b>", sub: "Nuestra princesa viene en camino 💗", ribbon: "💗 ¡Es una niña! 💗", c1: "#e5779e", c2: "#f6a9c3" },
    nino: { title: "¡Es un <b>Niño!</b>", sub: "Nuestro príncipe viene en camino 💙", ribbon: "💙 ¡Es un niño! 💙", c1: "#5aa3d3", c2: "#9fd0f1" }
  };
  function applyRevealedLook(t) {
    var T = TEXT[t];
    document.body.classList.remove("revealed-nino", "revealed-nina");
    document.body.classList.add("revealed-" + t);
    var rib = $("#revealRibbon");
    rib.textContent = T.ribbon;
    rib.style.setProperty("--rc1", T.c1); rib.style.setProperty("--rc2", T.c2);
    rib.hidden = false;
    var h1 = $("#heroTitle");
    h1.classList.add("is-revealed");
    h1.innerHTML = t === "nina"
      ? '<small>¡Es una</small><span class="t-nina">Niña!</span>'
      : '<small>¡Es un</small><span class="t-nino">Niño!</span>';
    $(".eyebrow").textContent = "¡Ya lo sabemos!";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "nina" ? "#fbd3e1" : "#cfe7f8");
    renderTeam();
    Votes.refresh();
    requestAnimationFrame(buildGarland);
  }
  function checkReveal() {
    var t = normTeam(cfg.revelado);
    if (!t || t === shownReveal) return;
    shownReveal = t;
    applyRevealedLook(t);
    var seenKey = "revelacion-visto-" + t;
    var isPreview = !!params.get("revelar");
    if (isPreview) { playReveal(t); return; }
    if (store.get(seenKey) !== "1") {
      store.set(seenKey, "1");
      playReveal(t);
    }
  }
  function playReveal(t) {
    var T = TEXT[t], ov = $("#revealOverlay");
    ov.classList.remove("show-result");
    ov.removeAttribute("data-team");
    $("#revealTitle").innerHTML = T.title;
    $("#roSub").textContent = T.sub;
    $("#roGuess").textContent = team ? (team === t ? "¡Acertaste! 🏆" : "¡Te ganamos esta vez! 😄💕") : "";
    ov.hidden = false;
    document.body.style.overflow = "hidden";
    var wait = REDUCED ? 300 : 3200;
    Sound.pause(true);
    Sound.drumroll(wait);
    setTimeout(function () {
      Sound.fanfare(t);
      ov.setAttribute("data-team", t);
      ov.classList.add("show-result");
      cannons(COLORS[t].concat(["#f3e6cc", "#e0b85a"]));
      setTimeout(function () { burst(innerWidth / 2, innerHeight * 0.42, COLORS[t], 120, { power: 14, hearts: 0.45 }); }, 250);
      rain(COLORS[t], 4500);
      balloonRelease(18);
      if (navigator.vibrate) { try { navigator.vibrate([60, 40, 120]); } catch (e) { /* nada */ } }
      $("#revealClose").focus();
    }, wait);
  }
  function closeReveal() {
    $("#revealOverlay").hidden = true;
    document.body.style.overflow = "";
    Sound.pause(false);
  }

  /* ---------------- Compartir, calendario, invitación ---------------- */
  function initShare() {
    var msg = "🧸💙💗 ¡Acompáñanos EN VIVO a descubrir si el Bebé Castillo Cano es niño o niña!\n📅 Domingo 8 de noviembre · 5:20 p.m. (hora Colombia)\n👉 " + PAGE_URL;
    $("#waLink").href = "https://wa.me/?text=" + encodeURIComponent(msg);

    var copyBtn = $("#copyLink");
    copyBtn.addEventListener("click", function () {
      var done = function () {
        var sp = $("span", copyBtn), prev = sp.textContent;
        sp.textContent = "¡Copiado! ✓";
        setTimeout(function () { sp.textContent = prev; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PAGE_URL).then(done, function () { window.prompt("Copia el enlace:", PAGE_URL); });
      } else {
        window.prompt("Copia el enlace:", PAGE_URL);
      }
    });

    if (navigator.share) {
      var ns = $("#nativeShare");
      ns.hidden = false;
      ns.addEventListener("click", function () {
        navigator.share({ title: "¿Niño o Niña? · Revelación en vivo", text: "¡Acompáñanos en vivo! Domingo 8 de noviembre · 5:20 p.m.", url: PAGE_URL }).catch(function () { /* cancelado */ });
      });
    }
  }
  function initCalendar() {
    var toG = function (ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var url = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent("Revelación Bebé Castillo Cano 🧸 ¿Niño o Niña?") +
      "&dates=" + toG(startMs()) + "/" + toG(endMs()) +
      "&details=" + encodeURIComponent((meetUrl() ? "Únete por Google Meet: " + meetUrl() + "\n" : "") + "Transmisión en vivo 🎥\nSi eres Team Niño ponte una camiseta azul 💙 · Si eres Team Niña una rosada 💗 ¡y envíanos tu foto! 📸\nEn vivo: " + PAGE_URL) +
      "&location=" + encodeURIComponent(PAGE_URL);
    $("#calLink").href = url;
  }
  /* ---------------- Galería de fotos del Team (desde config.json) ---------------- */
  var lastGallery = "";
  function renderGallery() {
    var list = Array.isArray(cfg.fotos) ? cfg.fotos.filter(function (f) { return f && f.foto; }) : [];
    var key = JSON.stringify(list);
    if (key === lastGallery) return;
    lastGallery = key;
    var sec = $("#fotos"), box = $("#gallery");
    sec.hidden = !list.length;
    if (!list.length) { box.innerHTML = ""; return; }
    var nN = 0, nG = 0;
    box.innerHTML = "";
    list.forEach(function (f, i) {
      var t = normTeam(f.team) || "nino";
      if (t === "nino") nN++; else nG++;
      var label = t === "nino" ? "Team Niño 💙" : "Team Niña 💗";

      var b = document.createElement("button");
      b.type = "button";
      b.className = "g-item " + t;
      b.style.animationDelay = (i * 0.06).toFixed(2) + "s";
      var img = document.createElement("img");
      img.src = f.foto; img.alt = "Foto " + label; img.loading = "lazy";
      var chip = document.createElement("span");
      chip.className = "g-chip"; chip.textContent = label;
      b.appendChild(img);
      if (f.nombre) {
        var nm = document.createElement("span");
        nm.className = "g-name"; nm.textContent = String(f.nombre);
        b.appendChild(nm);
        img.alt = "Foto de " + f.nombre + ", " + label;
      }
      b.appendChild(chip);
      b.addEventListener("click", function () {
        var d = $("#photoDialog");
        $("#photoDialogImg").src = f.foto;
        $("#photoDialogImg").alt = img.alt;
        $("#photoDialogCap").textContent = (f.nombre ? f.nombre + " · " : "") + label;
        if (d.showModal) d.showModal(); else window.open(f.foto, "_blank");
      });
      box.appendChild(b);
    });
    $("#galleryLead").textContent = list.length + (list.length === 1 ? " foto" : " fotos") + " · " + nN + " Team Niño 💙 · " + nG + " Team Niña 💗";
  }

  function updatePhotoLinks() {
    // Si config.json trae un número de WhatsApp, la foto llega directo a ese chat;
    // si no, WhatsApp deja escoger a quién enviarla.
    var num = String(cfg.whatsapp || "").replace(/\D/g, "");
    var base = "https://wa.me/" + num + "?text=";
    $("#photoNino").href = base + encodeURIComponent("¡Soy Team Niño! 💙 Aquí va mi foto con la camiseta azul 📸");
    $("#photoNina").href = base + encodeURIComponent("¡Soy Team Niña! 💗 Aquí va mi foto con la camiseta rosada 📸");
  }

  /* ---------------- Aparición al hacer scroll ---------------- */
  function initScrollReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window) || REDUCED) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------------- Video del anuncio: arranca solo al verlo ---------------- */
  // Los navegadores solo dejan sonar un video después de que la persona toca la página
  // (por eso la bienvenida "Entrar"). Antes de eso arranca en silencio.
  function initStoryAutoplay(v) {
    if (REDUCED || !("IntersectionObserver" in window)) return;
    var userPaused = false, autoPlaying = false, visible = false;
    function play() {
      if (userPaused || !v.paused || v.ended) return;
      autoPlaying = true;
      v.muted = !Sound.canSound();
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        // si el navegador no deja con sonido, lo intenta en silencio
        v.muted = true;
        v.play().catch(function () { /* sin reproducción automática */ });
      });
    }
    v.addEventListener("pause", function () {
      // si la persona lo pausó a mano mientras se veía, no lo volvemos a arrancar solos
      if (visible && !v.ended && autoPlaying && document.visibilityState === "visible") userPaused = true;
    });
    v.addEventListener("ended", function () { userPaused = true; });
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible = en.isIntersecting;
        if (visible) play();
        else if (!v.paused) { autoPlaying = false; v.pause(); autoPlaying = true; }
      });
    }, { threshold: 0.6 }).observe(v);
    // al tocar "Entrar", si el video ya iba en silencio, se le pone sonido
    document.addEventListener("sonido-listo", function () {
      if (!v.paused && v.muted && Sound.canSound()) v.muted = false;
    });
  }

  /* ---------------- Arranque ---------------- */
  function init() {
    // lo que usan los juegos y las cartitas (juegos.js)
    window.Revelacion = { store: store, rpc: Votes.rpc, voterId: Votes.voterId, burst: burst, COLORS: COLORS, Sound: Sound, normTeam: normTeam };
    sizeCanvas();
    buildStars();
    buildGarland();
    showLocalTime();
    initTeams();
    initShare();
    initCalendar();
    updatePhotoLinks();
    var pd = $("#photoDialog");
    pd.addEventListener("click", function (e) { if (e.target === pd) pd.close(); });
    initScrollReveal();
    applyOverrides();
    updatePlayer();
    tick();
    setInterval(tick, 1000);
    startBalloons();
    Sound.init();
    // Al tocar el reel de Instagram se pausa la música de fondo; vuelve al tocar la página
    var reel = $("#reelFrame");
    if (reel) {
      window.addEventListener("blur", function () {
        setTimeout(function () { if (document.activeElement === reel) Sound.video(true); }, 0);
      });
      window.addEventListener("focus", function () { Sound.video(false); });
    }
    var sv = $("#storyVideo");
    sv.addEventListener("play", function () { if (!sv.muted) Sound.video(true); });
    sv.addEventListener("volumechange", function () { if (!sv.paused) Sound.video(!sv.muted); });
    sv.addEventListener("pause", function () { Sound.video(false); });
    sv.addEventListener("ended", function () { Sound.video(false); });
    initStoryAutoplay(sv);

    $("#revealClose").addEventListener("click", closeReveal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#revealOverlay").hidden) closeReveal(); });

    var rz;
    window.addEventListener("resize", function () {
      clearTimeout(rz);
      rz = setTimeout(function () { sizeCanvas(); buildGarland(); }, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildGarland);

    refresh().then(function () {
      Votes.init();
      // Bienvenida: un poquito de confeti al abrir
      if (!normTeam(cfg.revelado)) setTimeout(function () { burst(innerWidth / 2, innerHeight * 0.35, COLORS.mix, 60, { power: 10, hearts: 0.3 }); }, 700);
    });
    setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
