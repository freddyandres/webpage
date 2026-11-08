/* ==========================================================
   Juegos y cartitas para el bebé
   Usa lo que expone app.js en window.Revelacion
   ========================================================== */
(function () {
  "use strict";

  var R, $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function getName() { return R.store.get("revelacion-nombre") || ""; }
  function setName(n) { R.store.set("revelacion-nombre", n); }
  function celebrate(target, colors, n) {
    var r = target.getBoundingClientRect();
    R.burst(r.left + r.width / 2, r.top + r.height / 3, colors || R.COLORS.mix, n || 60, { power: 10, hearts: 0.35 });
  }

  /* ---------------- Ranking (biberones y objetos) ---------------- */
  function fmtTime(s) { var m = Math.floor(s / 60); return m ? m + ":" + ("0" + (s % 60)).slice(-2) + " min" : s + " s"; }
  function renderTop(box, list, juego) {
    box.innerHTML = "";
    if (!list || !list.length) { box.appendChild(el("p", "top-empty", "¡Sé la primera persona en el ranking!")); return; }
    var ol = el("ol", "top-list");
    list.forEach(function (it, i) {
      var li = el("li", i < 3 ? "podio p" + (i + 1) : "");
      li.appendChild(el("span", "top-pos", i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1)));
      li.appendChild(el("span", "top-name", it.nombre));
      li.appendChild(el("span", "top-val", juego === "objetos" ? fmtTime(it.valor) : it.valor + (it.valor === 1 ? " biberón" : " biberones")));
      ol.appendChild(li);
    });
    box.appendChild(ol);
  }
  function loadTop(juego, box) {
    R.rpc("revelacion_top", { p_juego: juego }).then(function (l) { renderTop(box, l, juego); })
      .catch(function () { box.innerHTML = ""; box.appendChild(el("p", "top-empty", "No se pudo cargar el ranking.")); });
  }
  // Formulario para guardar el puntaje con el nombre
  function scoreSaver(container, juego, valor, topBox) {
    var form = el("form", "save-score");
    var input = el("input");
    input.maxLength = 40; input.placeholder = "Tu nombre"; input.required = true; input.value = getName();
    input.setAttribute("aria-label", "Tu nombre para el ranking");
    var btn = el("button", "btn btn-primary", "Guardar en el ranking 🏆");
    btn.type = "submit";
    var msg = el("p", "save-msg");
    form.appendChild(input); form.appendChild(btn); form.appendChild(msg);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = input.value.trim();
      if (!n) return;
      setName(n);
      btn.disabled = true; msg.textContent = "Guardando…";
      R.rpc("revelacion_guardar_puntaje", { p_juego: juego, p_votante: R.voterId(), p_nombre: n, p_valor: valor })
        .then(function (l) {
          renderTop(topBox, l, juego);
          msg.textContent = "¡Listo! Ya estás en el ranking 🎉";
          form.classList.add("saved");
        })
        .catch(function () { msg.textContent = "No se pudo guardar, intenta de nuevo."; btn.disabled = false; });
    });
    container.appendChild(form);
  }

  /* ================= Cartitas para el bebé ================= */
  function initLetters() {
    var form = $("#letterForm"), wall = $("#lettersWall");
    if (!form) return;
    var nameIn = $("#letterName"), textIn = $("#letterText"), status = $("#letterStatus");
    nameIn.value = getName();
    var count = $("#letterCount");
    textIn.addEventListener("input", function () { count.textContent = textIn.value.length + "/400"; });
    var shown = 24, all = [];

    function when(iso) {
      var d = new Date(iso);
      if (isNaN(d)) return "";
      return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d);
    }
    function render(list) {
      all = Array.isArray(list) ? list : [];
      $("#lettersTotal").textContent = all.length
        ? all.length + (all.length === 1 ? " cartita" : " cartitas") + " para el bebé 💕"
        : "Todavía no hay cartitas… ¡escribe la primera! ✨";
      wall.innerHTML = "";
      all.slice(0, shown).forEach(function (m, i) {
        var card = el("article", "letter " + ["c1", "c2", "c3", "c4"][i % 4]);
        card.appendChild(el("p", "letter-text", m.mensaje));
        var foot = el("p", "letter-from");
        foot.appendChild(el("b", null, "— " + m.nombre));
        foot.appendChild(el("span", null, when(m.creado)));
        card.appendChild(foot);
        wall.appendChild(card);
      });
      if (all.length > shown) {
        var more = el("button", "btn btn-soft letters-more", "Ver más cartitas (" + (all.length - shown) + ")");
        more.type = "button";
        more.addEventListener("click", function () { shown += 24; render(all); });
        wall.appendChild(more);
      }
    }
    function load() {
      if (document.hidden) return;
      R.rpc("revelacion_mensajes_lista").then(render).catch(function () { /* se reintenta */ });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = nameIn.value.trim(), t = textIn.value.trim();
      if (!n || !t) return;
      setName(n);
      var btn = $("button[type=submit]", form);
      btn.disabled = true; status.textContent = "Enviando tu cartita…";
      R.rpc("revelacion_dejar_mensaje", { p_votante: R.voterId(), p_nombre: n, p_mensaje: t })
        .then(function (list) {
          render(list);
          textIn.value = ""; count.textContent = "0/400";
          status.textContent = "¡Gracias! Tu cartita quedó guardada para el bebé 💌";
          celebrate(btn, R.COLORS.mix, 50);
          R.Sound.chime("nina");
        })
        .catch(function () { status.textContent = "No se pudo enviar (máximo 5 cartitas por persona). Intenta de nuevo."; })
        .then(function () { btn.disabled = false; });
    });
    load();
    setInterval(load, 20000);
  }

  /* ================= Juego 2: ¿Cuánto sabes del bebé? ================= */
  // Cada opción es [código, texto]. El código es el que se guarda en la base de datos,
  // así se puede cambiar el orden en pantalla sin mezclar las respuestas ya dadas.
  var PREGUNTAS = [
    { q: "¿A quién se parecerá?", o: [[1, "A papá 👨"], [0, "A mamá 👩"], [4, "A la hermanita 👧"], [2, "Mitad y mitad 💞"], [3, "A los abuelos 👵👴"]] },
    { q: "¿Quién será más dormilón?", o: [[2, "Papá 💤"], [1, "Mamá 🛌"], [3, "La hermanita 😪"], [0, "El bebé 😴"]] },
    { q: "¿Nacerá con mucho cabello?", o: [[0, "¡Muchísimo! 🦁"], [1, "Poquito 🌱"], [2, "Calvito 🥚"]] },
    { q: "¿Será tranquilo o inquieto?", o: [[0, "Tranquilito 😇"], [1, "Inquieto 🤸"], [2, "Un torbellino 🌪️"]] },
    { q: "¿Quién lo consentirá más?", o: [[1, "Papá 💙"], [0, "Mamá 💗"], [3, "La hermanita 👧"], [2, "Los abuelos 🧓"]] }
  ];
  function initTrivia() {
    var box = $("#triviaBox");
    if (!box) return;
    var answers = {};
    try { answers = JSON.parse(R.store.get("revelacion-trivia") || "{}") || {}; } catch (e) { answers = {}; }
    var results = {}, idx = 0, points = 0;

    function save() { R.store.set("revelacion-trivia", JSON.stringify(answers)); }
    function counts(qi) { return results[String(qi + 1)] || {}; }
    function topOption(qi) {
      var c = counts(qi), best = -1, max = -1;
      Object.keys(c).forEach(function (k) { if (c[k] > max) { max = c[k]; best = Number(k); } });
      return best;
    }
    function bars(qi, mine) {
      var c = counts(qi), tot = 0, wrap = el("div", "t-bars");
      PREGUNTAS[qi].o.forEach(function (op) { tot += Number(c[op[0]] || 0); });
      PREGUNTAS[qi].o.forEach(function (op) {
        var k = op[0], n = Number(c[k] || 0), pct = tot ? Math.round(n * 100 / tot) : 0;
        var row = el("div", "t-bar" + (k === mine ? " mine" : ""));
        var fill = el("span", "t-fill"); fill.style.width = pct + "%";
        row.appendChild(fill);
        row.appendChild(el("span", "t-label", op[1]));
        row.appendChild(el("span", "t-pct", pct + "%"));
        wrap.appendChild(row);
      });
      wrap.appendChild(el("p", "t-total", tot + (tot === 1 ? " persona respondió" : " personas respondieron")));
      return wrap;
    }
    function showQuestion() {
      box.innerHTML = "";
      var q = PREGUNTAS[idx];
      box.appendChild(el("p", "t-progress", "Pregunta " + (idx + 1) + " de " + PREGUNTAS.length + " · " + points + " puntos"));
      box.appendChild(el("h3", "t-q", q.q));
      var opts = el("div", "t-opts");
      q.o.forEach(function (op) {
        var b = el("button", "t-opt", op[1]);
        b.type = "button";
        b.addEventListener("click", function () { choose(op[0], b); });
        opts.appendChild(b);
      });
      box.appendChild(opts);
    }
    function choose(k, btn) {
      $$(".t-opt", box).forEach(function (b) { b.disabled = true; });
      btn.classList.add("picked");
      answers[idx + 1] = k; save();
      R.Sound.chime(k % 2 ? "nino" : "nina");
      R.rpc("revelacion_responder", { p_votante: R.voterId(), p_pregunta: idx + 1, p_opcion: k })
        .then(function (r) { results = r || {}; })
        .catch(function () { /* sin conexión: igual se muestra lo que haya */ })
        .then(function () {
          var majority = topOption(idx) === k;
          var gained = 10 + (majority ? 5 : 0);
          points += gained;
          celebrate(btn, majority ? R.COLORS.mix : null, majority ? 50 : 25);
          box.appendChild(el("p", "t-feedback", majority
            ? "+" + gained + " puntos · ¡Piensas como la mayoría! 🎉"
            : "+" + gained + " puntos · ¡Respuesta original! ✨"));
          box.appendChild(bars(idx, k));
          var next = el("button", "btn btn-primary t-next", idx < PREGUNTAS.length - 1 ? "Siguiente pregunta →" : "Ver mi resultado 🏆");
          next.type = "button";
          next.addEventListener("click", function () {
            idx++;
            if (idx < PREGUNTAS.length) showQuestion(); else showSummary(true);
          });
          box.appendChild(next);
        });
    }
    function showSummary(finished) {
      box.innerHTML = "";
      if (finished) {
        R.store.set("revelacion-trivia-puntos", String(points));
        celebrate(box, R.COLORS.mix, 90);
      }
      var p = Number(R.store.get("revelacion-trivia-puntos") || points);
      var head = el("div", "t-done");
      head.appendChild(el("p", "t-done-emoji", "👶"));
      head.appendChild(el("h3", "t-q", "¡Hiciste " + p + " puntos!"));
      head.appendChild(el("p", "t-sub", "Así respondió toda la familia:"));
      box.appendChild(head);
      PREGUNTAS.forEach(function (q, qi) {
        var block = el("div", "t-sum");
        block.appendChild(el("p", "t-sum-q", q.q));
        var mine = answers[qi + 1];
        block.appendChild(bars(qi, mine == null ? -1 : Number(mine)));
        box.appendChild(block);
      });
      var again = el("button", "btn btn-soft t-next", "Jugar otra vez 🔄");
      again.type = "button";
      again.addEventListener("click", function () { idx = 0; points = 0; showQuestion(); });
      box.appendChild(again);
    }
    function refreshResults() {
      return R.rpc("revelacion_trivia_resultados").then(function (r) { results = r || {}; }).catch(function () {});
    }
    refreshResults().then(function () {
      if (Object.keys(answers).length >= PREGUNTAS.length) showSummary(false); else showQuestion();
    });
  }

  /* ================= Juego 3: Alimenta al bebé ================= */
  function initBottles() {
    var canvas = $("#bottleCanvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), W = 360, H = 480, dpr = 1;
    var overlay = $("#bottleOverlay"), hud = $("#bottleHud"), topBox = $("#bottleTop");
    var state = "idle", items = [], score = 0, lives = 3, babyX = W / 2, targetX = W / 2, t0 = 0, last = 0, spawnAcc = 0, mouthOpen = 0, raf = 0;
    var level = 1, banner = 0;
    // Cada 8 puntos sube de nivel: más rápido, más seguido, más brócoli y caídas en zigzag
    function lvlOf(sc) { return Math.min(10, 1 + Math.floor(sc / 8)); }

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function rr(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function drawBottle(x, y, gold, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = gold ? "#f7d46b" : "#fff"; ctx.strokeStyle = gold ? "#c99a2e" : "#9fbfd8"; ctx.lineWidth = 2;
      rr(-11, -8, 22, 30, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold ? "#fff3c4" : "#fdf3e1"; rr(-9, 4, 18, 16, 5); ctx.fill();
      ctx.fillStyle = gold ? "#e7b43c" : pick2(x); rr(-12, -14, 24, 7, 3); ctx.fill();
      ctx.fillStyle = "#f3cf9e"; ctx.beginPath(); ctx.ellipse(0, -19, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = gold ? "#c99a2e" : "#9fbfd8"; ctx.lineWidth = 1.5;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(4, -2 + i * 6); ctx.lineTo(9, -2 + i * 6); ctx.stroke(); }
      if (gold) { ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("★", 0, 0); }
      ctx.restore();
    }
    function pick2(x) { return ((x | 0) % 2) ? "#9fd0f1" : "#f6a9c3"; }
    function drawBroccoli(x, y, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = "#7fae5a"; rr(-5, 0, 10, 16, 4); ctx.fill();
      ctx.fillStyle = "#4e9a3a";
      [[-10, -2, 9], [10, -2, 9], [0, -10, 11], [-6, -12, 7], [7, -12, 7]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(-3, -13, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawBaby(x) {
      var y = H - 58;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = "rgba(122,74,53,.12)"; ctx.beginPath(); ctx.ellipse(0, 48, 44, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; rr(-36, 22, 72, 28, 14); ctx.fill();                       // babero / cuerpo
      ctx.fillStyle = "#f6a9c3"; rr(-36, 22, 36, 28, 14); ctx.fill();
      ctx.fillStyle = "#9fd0f1"; rr(0, 22, 36, 28, 14); ctx.fill();
      ctx.fillStyle = "#ffd9bf"; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();   // cara
      ctx.beginPath(); ctx.arc(-33, 2, 8, 0, Math.PI * 2); ctx.arc(33, 2, 8, 0, Math.PI * 2); ctx.fill(); // orejas
      ctx.strokeStyle = "#a8664a"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-2, -33); ctx.quadraticCurveTo(8, -46, 4, -30); ctx.stroke();       // mechón
      ctx.fillStyle = "#3a2318";
      ctx.beginPath(); ctx.arc(-12, -4, 4, 0, Math.PI * 2); ctx.arc(12, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(242,159,174,.6)"; ctx.beginPath(); ctx.ellipse(-20, 8, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(20, 8, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c95f6e";
      var mo = mouthOpen > 0 ? 8 : 3;
      ctx.beginPath(); ctx.ellipse(0, 14, 7, mo, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawBg() {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#eaf5fd"); g.addColorStop(1, "#fdeef4");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.7)";
      [[60, 70, 26], [90, 64, 20], [270, 120, 24], [300, 112, 18]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#f3e6cc"; ctx.fillRect(0, H - 16, W, 16);
    }
    function frame(ts) {
      if (state !== "play") return;
      var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
      var elapsed = (ts - t0) / 1000;
      var speed = 125 + (level - 1) * 28 + Math.min(30, elapsed * 1.2);
      var every = Math.max(0.28, 0.85 - (level - 1) * 0.06);
      var brocP = Math.min(0.45, 0.18 + (level - 1) * 0.035);
      spawnAcc += dt;
      if (spawnAcc > every) {
        spawnAcc = 0;
        var n = level >= 5 && Math.random() < 0.3 ? 2 : 1;
        for (var s2 = 0; s2 < n; s2++) {
          var r = Math.random(), kind = r < 0.08 ? "gold" : (r < 0.08 + brocP ? "broc" : "bottle");
          var bx = rand(30, W - 30);
          items.push({ bx: bx, x: bx, y: -30 - s2 * 60, k: kind, v: speed * rand(0.85, 1.2), rot: rand(-0.4, 0.4), vr: rand(-1.5, 1.5),
            zz: level >= 3 && Math.random() < 0.15 + level * 0.05 ? rand(30, 70) : 0, ph: rand(0, 6) });
        }
      }
      banner = Math.max(0, banner - dt);
      babyX += (targetX - babyX) * Math.min(1, dt * 14);
      mouthOpen = Math.max(0, mouthOpen - dt);
      drawBg();
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.y += it.v * dt; it.rot += it.vr * dt;
        if (it.zz) { it.ph += dt * 2.6; it.x = Math.max(20, Math.min(W - 20, it.bx + Math.sin(it.ph) * it.zz)); }
        var caught = it.y > H - 92 && it.y < H - 40 && Math.abs(it.x - babyX) < 40;
        if (caught) {
          items.splice(i, 1);
          if (it.k === "broc") {
            lives--; R.Sound.sfx("ouch");
            flash("#e85d75");
            if (lives <= 0) return end();
          } else {
            score += it.k === "gold" ? 3 : 1; mouthOpen = 0.25;
            R.Sound.sfx(it.k === "gold" ? "gold" : "catch");
            if (lvlOf(score) > level) {
              level = lvlOf(score); banner = 1.6;
              R.Sound.sfx("level");
              R.Sound.gameTempo(1 + (level - 1) * 0.1);
              R.burst(innerWidth / 2, innerHeight * 0.4, R.COLORS.mix, 50, { power: 9 });
            }
            var rc = canvas.getBoundingClientRect();
            R.burst(rc.left + it.x * rc.width / W, rc.top + (H - 70) * rc.height / H, it.k === "gold" ? ["#f7d46b", "#fff3c4", "#e7b43c"] : R.COLORS.mix, it.k === "gold" ? 24 : 10, { power: 5 });
          }
          hudUpdate();
          continue;
        }
        if (it.y > H + 30) { items.splice(i, 1); continue; }
        if (it.k === "broc") drawBroccoli(it.x, it.y, it.rot); else drawBottle(it.x, it.y, it.k === "gold", it.rot);
      }
      drawBaby(babyX);
      if (banner > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, banner);
        ctx.fillStyle = "rgba(255,255,255,.85)"; rr(70, 190, 220, 76, 24); ctx.fill();
        ctx.fillStyle = "#cf5a85"; ctx.textAlign = "center";
        ctx.font = "700 34px Fredoka, sans-serif"; ctx.fillText("¡Nivel " + level + "!", W / 2, 236);
        ctx.font = "600 14px Quicksand, sans-serif"; ctx.fillStyle = "#7a4a35"; ctx.fillText(level === 1 ? "¡A jugar!" : "¡Más rápido!", W / 2, 256);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    function flash(c) {
      canvas.style.boxShadow = "0 0 0 6px " + c;
      setTimeout(function () { canvas.style.boxShadow = ""; }, 180);
    }
    function hudUpdate() {
      hud.innerHTML = "";
      hud.appendChild(el("span", "hud-score", "🍼 " + score + " · Nivel " + level));
      hud.appendChild(el("span", "hud-lives", "❤️".repeat(Math.max(0, lives)) + "🤍".repeat(Math.max(0, 3 - lives))));
    }
    function start() {
      state = "play"; items = []; score = 0; lives = 3; babyX = targetX = W / 2; spawnAcc = 0; level = 1; banner = 1.2;
      R.Sound.sfx("start"); R.Sound.gameTempo(1); R.Sound.gameMusic(true);
      overlay.hidden = true; hudUpdate();
      t0 = last = performance.now();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    }
    function end() {
      state = "over"; cancelAnimationFrame(raf);
      R.Sound.gameMusic(false); R.Sound.sfx("over");
      var best = Math.max(score, Number(R.store.get("revelacion-biberones") || 0));
      R.store.set("revelacion-biberones", String(best));
      overlay.innerHTML = "";
      overlay.appendChild(el("p", "ov-emoji", score >= 20 ? "🏆" : "🍼"));
      overlay.appendChild(el("h3", "ov-title", "¡" + score + (score === 1 ? " biberón!" : " biberones!")));
      overlay.appendChild(el("p", "ov-sub", "Llegaste al nivel " + level + " · Tu mejor puntaje: " + best));
      if (score > 0) scoreSaver(overlay, "biberones", score, topBox);
      var again = el("button", "btn btn-soft", "Jugar otra vez 🔄");
      again.type = "button"; again.addEventListener("click", start);
      overlay.appendChild(again);
      overlay.hidden = false;
      celebrate(canvas, R.COLORS.mix, 60);
    }
    function pointer(e) {
      var r = canvas.getBoundingClientRect();
      var x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * W / r.width;
      targetX = Math.max(30, Math.min(W - 30, x));
    }
    canvas.addEventListener("pointerdown", pointer);
    canvas.addEventListener("pointermove", function (e) { if (state === "play") pointer(e); });
    canvas.addEventListener("touchmove", function (e) { if (state === "play") { pointer(e); e.preventDefault(); } }, { passive: false });
    window.addEventListener("keydown", function (e) {
      if (state !== "play") return;
      if (e.key === "ArrowLeft") { targetX = Math.max(30, targetX - 40); e.preventDefault(); }
      if (e.key === "ArrowRight") { targetX = Math.min(W - 30, targetX + 40); e.preventDefault(); }
    });
    $("#bottleStart").addEventListener("click", start);
    document.addEventListener("visibilitychange", function () { if (document.hidden && state === "play") end(); });
    size(); drawBg(); drawBaby(W / 2);
    loadTop("biberones", topBox);
    initBottles.pause = function () { if (state === "play") end(); };
  }

  /* ================= Juego 4: Encuentra los objetos del bebé ================= */
  var TARGETS = [
    { k: "chupete", n: "Chupete" },
    { k: "osito", n: "Osito" },
    { k: "biberon", n: "Biberón" },
    { k: "panal", n: "Pañal" },
    { k: "zapatito", n: "Zapatito" }
  ];
  var DECOYS = ["pelota", "cubo", "patito", "sonajero", "media", "libro", "carrito", "globo", "estrella", "corazon", "luna", "pelota", "cubo", "patito", "globo", "estrella"];
  var PALETTE = ["#f6a9c3", "#9fd0f1", "#ffd36e", "#b8e3c8", "#d8c4f0", "#f3c9a5"];
  function initObjects() {
    var scene = $("#objScene");
    if (!scene) return;
    var listBox = $("#objList"), timerEl = $("#objTimer"), overlay = $("#objOverlay"), topBox = $("#objTop");
    var found = {}, start = 0, penalty = 0, tick = 0, playing = false, lv = 0, prevTotal = 0;
    // Cada nivel: más objetos, más pequeños, más girados y más parecidos a los que buscas
    var LEVELS = [
      { cols: 5, rows: 7, min: 34, max: 46, rot: 35, pen: 2, tricky: 0 },
      { cols: 6, rows: 8, min: 28, max: 38, rot: 70, pen: 3, tricky: 0.3 },
      { cols: 7, rows: 9, min: 24, max: 32, rot: 120, pen: 4, tricky: 0.5 }
    ];
    var TRICKY = ["media", "sonajero", "carrito", "libro"];

    function layout() {
      var L = LEVELS[lv], cols = L.cols, rows = L.rows, cw = 360 / cols, ch = 420 / rows, cells = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) cells.push([c, r]);
      cells.sort(function () { return Math.random() - 0.5; });
      var kinds = TARGETS.map(function (t) { return t.k; });
      while (kinds.length < cells.length) kinds.push(Math.random() < L.tricky ? pick(TRICKY) : pick(DECOYS));
      // los objetos a encontrar van en posiciones al azar entre los demás
      kinds.sort(function () { return Math.random() - 0.5; });
      var html = '<rect width="360" height="300" fill="url(#wallG)"/>' +
        '<rect y="300" width="360" height="180" fill="#ead7bd"/>' +
        '<g opacity=".35" stroke="#c9ad8a">' + [330, 365, 400, 440].map(function (y) { return '<line x1="0" x2="360" y1="' + y + '" y2="' + y + '"/>'; }).join("") + "</g>" +
        '<rect x="226" y="34" width="100" height="84" rx="10" fill="#dff0fb" stroke="#fff" stroke-width="6"/><line x1="276" x2="276" y1="34" y2="118" stroke="#fff" stroke-width="5"/>' +
        '<rect x="20" y="150" width="130" height="10" rx="4" fill="#c9a37c"/><rect x="200" y="210" width="140" height="10" rx="4" fill="#c9a37c"/>' +
        '<ellipse cx="180" cy="420" rx="150" ry="40" fill="#f6d0de" opacity=".7"/>' +
        '<g stroke="#e8d3b8" stroke-width="5" opacity=".9">' + [40, 70, 100, 130].map(function (x) { return '<line x1="' + x + '" x2="' + x + '" y1="250" y2="330"/>'; }).join("") + '<line x1="30" x2="140" y1="250" y2="250"/></g>';
      cells.forEach(function (cell, i) {
        var k = kinds[i], x = cell[0] * cw + cw / 2 + rand(-cw * 0.2, cw * 0.2), y = 40 + cell[1] * ch + ch / 2 + rand(-ch * 0.18, ch * 0.18);
        var s = rand(L.min, L.max), rot = rand(-L.rot, L.rot), color = pick(PALETTE);
        var isT = TARGETS.some(function (t) { return t.k === k; });
        html += '<g class="obj' + (isT ? " target" : "") + '" data-k="' + k + '" transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + rot.toFixed(0) + ')" style="color:' + color + '">' +
          '<circle r="' + Math.max(16, s * 0.55).toFixed(0) + '" fill="transparent"/>' +
          '<use href="#i-' + k + '" x="' + (-s / 2).toFixed(1) + '" y="' + (-s / 2).toFixed(1) + '" width="' + s.toFixed(1) + '" height="' + s.toFixed(1) + '"/></g>';
      });
      scene.innerHTML = '<defs><linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf3f7"/><stop offset="1" stop-color="#eef7fd"/></linearGradient></defs>' + html;
    }
    function renderList() {
      listBox.innerHTML = "";
      TARGETS.forEach(function (t) {
        var li = el("li", found[t.k] ? "got" : "");
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 40 40"); svg.innerHTML = '<use href="#i-' + t.k + '"/>';
        svg.style.color = "#f6a9c3";
        li.appendChild(svg);
        li.appendChild(el("span", null, (found[t.k] ? "✓ " : "") + t.n));
        listBox.appendChild(li);
      });
    }
    function secs() { return Math.round((performance.now() - start) / 1000) + penalty; }
    function total() { return prevTotal + secs(); }
    function showTimer(extra) { timerEl.textContent = "Nivel " + (lv + 1) + "/3 · ⏱️ " + fmtTime(total()) + (extra || ""); }
    function playLevel() {
      found = {}; penalty = 0; playing = true;
      layout(); renderList();
      overlay.hidden = true;
      start = performance.now();
      clearInterval(tick);
      tick = setInterval(function () { showTimer(); }, 250);
      showTimer();
      R.Sound.gameTempo(1 + lv * 0.15); R.Sound.gameMusic(true);
    }
    function startGame() { lv = 0; prevTotal = 0; R.Sound.sfx("start"); playLevel(); }
    function levelDone() {
      playing = false; clearInterval(tick);
      prevTotal += secs();
      if (lv < LEVELS.length - 1) {
        R.Sound.sfx("level");
        overlay.innerHTML = "";
        overlay.appendChild(el("p", "ov-emoji", ["⭐", "🌟"][lv]));
        overlay.appendChild(el("h3", "ov-title", "¡Nivel " + (lv + 1) + " superado!"));
        overlay.appendChild(el("p", "ov-sub", "Llevas " + fmtTime(prevTotal) + ". El siguiente es más difícil: más objetos y más pequeños 👀"));
        var next = el("button", "btn btn-primary", "Ir al nivel " + (lv + 2) + " →");
        next.type = "button";
        next.addEventListener("click", function () { lv++; playLevel(); });
        overlay.appendChild(next);
        overlay.hidden = false;
        celebrate(scene, R.COLORS.mix, 50);
      } else {
        finish();
      }
    }
    function finish() {
      R.Sound.gameMusic(false); R.Sound.sfx("win");
      var t = Math.max(3, prevTotal);
      var best = Number(R.store.get("revelacion-objetos") || 0);
      if (!best || t < best) { best = t; R.store.set("revelacion-objetos", String(t)); }
      overlay.innerHTML = "";
      overlay.appendChild(el("p", "ov-emoji", "🧸"));
      overlay.appendChild(el("h3", "ov-title", "¡Superaste los 3 niveles en " + fmtTime(t) + "!"));
      overlay.appendChild(el("p", "ov-sub", "Tu mejor tiempo: " + fmtTime(best)));
      scoreSaver(overlay, "objetos", t, topBox);
      var again = el("button", "btn btn-soft", "Jugar otra vez 🔄");
      again.type = "button"; again.addEventListener("click", startGame);
      overlay.appendChild(again);
      overlay.hidden = false;
      celebrate(scene, R.COLORS.mix, 90);
    }
    scene.addEventListener("click", function (e) {
      if (!playing) return;
      var g = e.target.closest && e.target.closest(".obj");
      if (!g) return;
      var k = g.getAttribute("data-k");
      if (g.classList.contains("target") && !found[k]) {
        found[k] = true;
        g.classList.add("found");
        g.insertAdjacentHTML("beforeend", '<circle r="13" fill="#2fb47a" opacity=".92"/><path d="M-6 0l4 4 8-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>');
        R.Sound.sfx("found");
        var r = g.getBoundingClientRect();
        R.burst(r.left + r.width / 2, r.top + r.height / 2, R.COLORS.mix, 22, { power: 6 });
        renderList();
        if (Object.keys(found).length === TARGETS.length) { playing = false; setTimeout(levelDone, 450); }
      } else if (!g.classList.contains("found")) {
        var pen = LEVELS[lv].pen;
        penalty += pen;
        g.classList.remove("nope"); void g.getBoundingClientRect(); g.classList.add("nope");
        R.Sound.sfx("wrong");
        showTimer("  (+" + pen + " s)");
      }
    });
    $("#objStart").addEventListener("click", startGame);
    document.addEventListener("visibilitychange", function () {
      if (!playing) return;
      R.Sound.gameMusic(!document.hidden);
    });
    layout(); renderList();
    loadTop("objetos", topBox);
    initObjects.pause = function () { if (playing) R.Sound.gameMusic(false); };
    initObjects.resume = function () { if (playing) R.Sound.gameMusic(true); };
  }

  /* ================= Pestañas de juegos ================= */
  function initTabs() {
    var tabs = $$(".game-tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var g = t.getAttribute("data-game");
        tabs.forEach(function (o) {
          var on = o === t;
          o.setAttribute("aria-selected", String(on));
          o.tabIndex = on ? 0 : -1;
          $("#game-" + o.getAttribute("data-game")).hidden = !on;
        });
        if (g !== "biberones" && initBottles.pause) initBottles.pause();
        if (g !== "objetos" && initObjects.pause) initObjects.pause();
        if (g === "objetos" && initObjects.resume) initObjects.resume();
      });
    });
  }

  function init() {
    R = window.Revelacion;
    if (!R) return;
    initTabs();
    initLetters();
    initTrivia();
    initBottles();
    initObjects();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
