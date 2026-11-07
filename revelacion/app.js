/* ==========================================================
   Revelación de género · En vivo
   Todo lo editable está en config.json
   ========================================================== */
(function () {
  "use strict";

  var DEFAULTS = {
    inicio: "2026-11-08T15:00:00-05:00",
    duracionHoras: 3,
    youtube: "",
    facebook: "",
    url: "",
    formato: "horizontal",
    revelado: ""
  };
  var POLL_MS = 30000;
  var PAGE_URL = location.origin + location.pathname;
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
  function updatePlayer() {
    var frame = $("#playerFrame");
    frame.classList.toggle("vertical", String(cfg.formato).toLowerCase() === "vertical");

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
    var hasStream = !!getEmbed();
    var revealed = normTeam(cfg.revelado);
    var phase;
    if (now >= en) phase = "fin";
    else if (now >= st - 30 * 60000) phase = hasStream ? "vivo" : "casi";
    else phase = "pronto";

    var key = phase + "|" + hasStream + "|" + revealed;
    if (key === lastPhase) return;
    lastPhase = key;

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
    if (phase === "vivo") lead.textContent = "¡Estamos en vivo! Sube el volumen 🔊 y celebra con nosotros.";
    else if (phase === "fin") lead.textContent = "Gracias por acompañarnos en este momento tan especial.";
    else lead.textContent = "Desde donde estés, acompáñanos en este momento tan especial.";

    if (!hasStream) {
      if (phase === "casi") {
        $("#phTitle").textContent = "¡Ya casi! Estamos preparando la cámara 🎥";
        $("#phSub").textContent = "La transmisión aparecerá aquí sola, no cierres la página.";
      } else if (phase === "fin") {
        $("#phTitle").textContent = "¡Gracias por acompañarnos!";
        $("#phSub").textContent = "Pronto compartiremos el video de este día.";
      } else {
        $("#phTitle").textContent = "La transmisión aparecerá aquí";
        $("#phSub").textContent = "Domingo 8 de noviembre · 3:00 p.m.";
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
      msg.textContent = "¡Eres Team Niño! 💙 No olvides tu prenda azul.";
    } else if (team === "nina") {
      msg.textContent = "¡Eres Team Niña! 💗 No olvides tu prenda rosada.";
    } else {
      msg.textContent = "";
    }
  }
  function initTeams() {
    team = store.get("revelacion-team") || "";
    renderTeam();
    $$(".team-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-team");
        team = t; store.set("revelacion-team", t);
        renderTeam();
        var r = b.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 3, COLORS[t], 40, { power: 8, hearts: 0.5 });
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
    setTimeout(function () {
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
  }

  /* ---------------- Compartir, calendario, invitación ---------------- */
  function initShare() {
    var msg = "🧸💙💗 ¡Acompáñanos EN VIVO a descubrir si nuestro bebé es niño o niña!\n📅 Domingo 8 de noviembre · 3:00 p.m.\n👉 " + PAGE_URL;
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
        navigator.share({ title: "¿Niño o Niña? · Revelación en vivo", text: "¡Acompáñanos en vivo! Domingo 8 de noviembre · 3:00 p.m.", url: PAGE_URL }).catch(function () { /* cancelado */ });
      });
    }
  }
  function initCalendar() {
    var toG = function (ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var url = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent("Revelación de género 🧸 ¿Niño o Niña?") +
      "&dates=" + toG(startMs()) + "/" + toG(endMs()) +
      "&details=" + encodeURIComponent("Si eres Team Niño ven con una prenda azul 💙 · Si eres Team Niña ven con una prenda rosada 💗\nEn vivo: " + PAGE_URL) +
      "&location=" + encodeURIComponent("Unidad Recreativa Rincón de Pacará, Av. 2G #58-100, B/ Los Álamos, Cali");
    $("#calLink").href = url;
  }
  function initInvite() {
    var dlg = $("#inviteDialog");
    $("#openInvite").addEventListener("click", function () {
      if (dlg.showModal) dlg.showModal(); else window.open("assets/invitacion.jpg", "_blank");
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
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

  /* ---------------- Arranque ---------------- */
  function init() {
    sizeCanvas();
    buildStars();
    buildGarland();
    showLocalTime();
    initTeams();
    initShare();
    initCalendar();
    initInvite();
    initScrollReveal();
    applyOverrides();
    updatePlayer();
    tick();
    setInterval(tick, 1000);
    startBalloons();

    $("#revealClose").addEventListener("click", closeReveal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#revealOverlay").hidden) closeReveal(); });

    var rz;
    window.addEventListener("resize", function () {
      clearTimeout(rz);
      rz = setTimeout(function () { sizeCanvas(); buildGarland(); }, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildGarland);

    refresh().then(function () {
      // Bienvenida: un poquito de confeti al abrir
      if (!normTeam(cfg.revelado)) setTimeout(function () { burst(innerWidth / 2, innerHeight * 0.35, COLORS.mix, 60, { power: 10, hearts: 0.3 }); }, 700);
    });
    setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
