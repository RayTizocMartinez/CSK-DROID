/* =====================================================================
   BALLOON HEIST — a monkey in a ski mask throws knives at balloons.
   Drag back anywhere on the screen to aim (like a slingshot), let go to throw.
   A knife flies through every balloon it touches. Pop enough to clear the level
   before you run out of knives.

   Sprites:  media/games/balloons/balloon-1.png ... balloon-5.png
             (ballon-1.png ... ballon-5.png also work)
             media/games/balloons/bg.png   optional background
   Tuning:   js/content.js -> games.balloons
   The monkey, knives, sky and effects are drawn in code.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'balloons';
  var DIR = 'media/games/balloons/';

  var DEFAULTS = {
    name: 'Balloon Heist',
    gravity: 520,         // pulls the knife down (units per second², screen is 320 wide)
    maxThrow: 660,        // fastest throw
    startDarts: 6,        // knives on level 1 (one fewer every 5 levels, never under 4)
    rewards: []           // [{ level: 10, action: {...} }]
  };
  function cfg() {
    var g = (C.games || {})[ID] || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="url(#g-sky)" stroke="#123"/>' +
    '<path d="M31 26q1 6-2 10" stroke="#fff" stroke-opacity=".8" fill="none"/><ellipse cx="31" cy="18" rx="7" ry="8.5" fill="#e8322e" stroke="#7a1010"/><ellipse cx="28.5" cy="15" rx="2" ry="3" fill="#fff" opacity=".55"/>' +
    '<circle cx="15" cy="32" r="9" fill="#1b1b1f" stroke="#000"/><circle cx="7.5" cy="30" r="3" fill="#7a4a24"/><circle cx="22.5" cy="30" r="3" fill="#7a4a24"/>' +
    '<rect x="9" y="28" width="12" height="5" rx="2.5" fill="#d9a877"/><circle cx="12.5" cy="30.5" r="1.3" fill="#000"/><circle cx="17.5" cy="30.5" r="1.3" fill="#000"/><ellipse cx="15" cy="37" rx="2.2" ry="1.6" fill="#d9a877"/>' +
    '<path d="M20 22l6-6" stroke="#ddd" stroke-width="1.6"/><path d="M26 16l2-2" stroke="#555" stroke-width="2"/></svg>';

  /* ---------- sprites ---------- */
  var COLORS = ['#e8322e', '#2e7de8', '#3bbf3b', '#f2c419', '#a24be0'];   // fallback colors for balloon-1..5
  var SPR = {}, loaded = false;
  function loadOne(key, names) {
    var tries = [], k = 0, im = new Image();
    names.forEach(function (n) { ['.png', '.jpg', '.jpeg'].forEach(function (e) { tries.push(n + e); }); });
    im.onload = function () { SPR[key] = im; };
    im.onerror = function () { if (++k < tries.length) im.src = OS.url(DIR + tries[k]); };
    im.src = OS.url(DIR + tries[0]);
  }
  function loadSprites() {
    if (loaded) return; loaded = true;
    for (var i = 1; i <= 5; i++) loadOne('b' + i, ['balloon-' + i, 'ballon-' + i]);
    loadOne('bg', ['bg']);
  }

  /* ---------- sounds ---------- */
  var nb = null;
  function noise(dur, freq, q, vol, when, type) {
    var ctx = OS.audioCtx(); if (!ctx || OS.silent) return;
    if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = nb.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = ctx.currentTime + (when || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nb; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t); s.stop(t + dur + 0.05);
  }
  var SYN = {
    pop:   function () { noise(0.09, 2200 + Math.random() * 1500, 0.8, 0.35); noise(0.05, 600, 1, 0.2); },
    throw: function () { noise(0.18, 1800, 1.5, 0.08, 0, 'highpass'); },
    clear: function () { [523, 659, 784, 1047].forEach(function (f, i) { OS.beep(f, 0.12, i * 0.09, 0.06); }); },
    fail:  function () { [392, 330, 262, 196].forEach(function (f, i) { OS.beep(f, 0.16, i * 0.12, 0.06); }); },
    start: function () { OS.beep(523, 0.07, 0, 0.06); OS.beep(784, 0.1, 0.08, 0.06); }
  };
  var SND = {}, missing = {};
  function snd(n) {
    if (OS.silent) return;
    if (missing[n]) { if (SYN[n]) SYN[n](); return; }
    if (!SND[n]) { SND[n] = new Audio(OS.url(DIR + n + '.mp3')); SND[n].preload = 'auto'; SND[n].onerror = function () { missing[n] = true; }; }
    var a = SND[n].cloneNode();
    a.onerror = function () { missing[n] = true; if (SYN[n]) SYN[n](); };
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function seeded(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  /* ---------- level layouts ---------- */
  // Each returns points in a 0..1 box; they get fitted into the area right of the monkey.
  var PATTERNS = [
    function grid(n, r) { var cols = Math.ceil(Math.sqrt(n * 1.3)), pts = []; for (var i = 0; i < n; i++) pts.push([(i % cols) / Math.max(1, cols - 1), Math.floor(i / cols) / Math.max(1, Math.ceil(n / cols) - 1)]); return pts; },
    function pyramid(n) { var pts = [], row = 0, k = 0; while (k < n) { var inRow = row + 1; for (var j = 0; j < inRow && k < n; j++, k++) pts.push([0.5 + (j - row / 2) * 0.14, row * 0.16]); row++; } return pts; },
    function ring(n) { var pts = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; pts.push([0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]); } return pts; },
    function wave(n) { var pts = []; for (var i = 0; i < n; i++) { var u = i / Math.max(1, n - 1); pts.push([u, 0.5 + Math.sin(u * Math.PI * 3) * 0.45]); } return pts; },
    function diagonal(n) { var pts = []; for (var i = 0; i < n; i++) { var u = i / Math.max(1, n - 1); pts.push([u, 1 - u + (i % 2) * 0.08]); } return pts; },
    function columns(n) { var pts = [], per = Math.ceil(n / 3); for (var i = 0; i < n; i++) pts.push([Math.floor(i / per) / 2, (i % per) / Math.max(1, per - 1)]); return pts; },
    function scatter(n, r) { var pts = []; for (var i = 0; i < n; i++) pts.push([r(), r()]); return pts; },
    function smile(n) { var pts = [[0.25, 0.1], [0.75, 0.1]]; for (var i = 0; i < n - 2; i++) { var a = Math.PI * (0.15 + 0.7 * i / Math.max(1, n - 3)); pts.push([0.5 - Math.cos(a) * 0.5, 0.45 + Math.sin(a) * 0.55]); } return pts; }
  ];

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      loadSprites();
      var cv = OS.el('canvas', 'game-canvas');
      root.appendChild(cv);
      var ctx = cv.getContext('2d');
      var W = 320, H = 520;
      function resize() {
        var cw = root.clientWidth || 320, ch = root.clientHeight || 520;
        W = 320; H = Math.round(W * ch / cw);
        if (H < 440) { H = 440; W = Math.round(H * cw / ch); }
        var pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(cw * pr); cv.height = Math.round(ch * pr);
      }
      resize();
      window.addEventListener('resize', resize);

      /* ----- state ----- */
      var BR = 13;                       // balloon hit radius
      var state = 'title', clock = 0;
      var level = 1, score = 0, levelStartScore = 0, darts = 0, need = 0, popped = 0;
      var balloons = [], dart = null, bits = [], floats = [];
      var aim = null, throwT = 0, overT = 0, combo = 0;
      var best = OS.store.get(ID + ':best', { level: 0, score: 0 });

      function monkey() { return { x: 40, y: H - 62 }; }
      function hand(ang) { var m = monkey(); return { x: m.x + 6 + Math.cos(ang) * 16, y: m.y - 22 + Math.sin(ang) * 16 }; }

      function buildLevel(n) {
        var r = seeded(n * 7 + 3);
        var count = Math.min(40, 8 + n * 2);
        var pat = PATTERNS[(n - 1) % PATTERNS.length];
        var pts = pat(count, r);
        // fit into the area right of the monkey; later levels push further away
        var x0 = 110 + Math.min(60, n * 4), x1 = W - 18, y0 = 60, y1 = H - 140;
        var bw = (x1 - x0) * Math.min(1, 0.55 + n * 0.04), bh = (y1 - y0) * Math.min(1, 0.45 + n * 0.04);
        var ox = x0 + r() * ((x1 - x0) - bw), oy = y0 + r() * ((y1 - y0) - bh);
        balloons = pts.map(function (p, i) {
          return { x: ox + p[0] * bw, y: oy + p[1] * bh, kind: 1 + Math.floor(r() * 5), t: r() * 6,
            move: n >= 6 && i % 3 === 0 ? 10 + Math.min(30, n * 2) : 0, gone: false };
        });
        darts = Math.max(4, K.startDarts - Math.floor((n - 1) / 5));
        need = Math.ceil(count * Math.min(0.75, 0.5 + n * 0.02));
        popped = 0; dart = null; aim = null; bits = []; floats = [];
        levelStartScore = score;
      }
      function startGame() { level = 1; score = 0; buildLevel(1); state = 'play'; snd('start'); OS.emit('game-start:' + ID); }
      function retry() { score = levelStartScore; buildLevel(level); state = 'play'; snd('start'); }
      function nextLevel() { level++; buildLevel(level); state = 'play'; snd('start'); }

      /* ----- input: drag back to aim ----- */
      function toWorld(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
      function aimVel() {
        var dx = aim.sx - aim.x, dy = aim.sy - aim.y, len = Math.hypot(dx, dy);
        if (len < 8) return null;
        var pull = Math.min(1, len / 120), sp = 180 + pull * (K.maxThrow - 180);
        return { vx: dx / len * sp, vy: dy / len * sp, ang: Math.atan2(dy, dx), pull: pull };
      }
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault(); OS.audioCtx();
        if (state === 'title') { startGame(); return; }
        if (state === 'clear' && overT <= 0) { nextLevel(); return; }
        if (state === 'fail' && overT <= 0) { retry(); return; }
        if (state !== 'play' || dart || darts <= 0) return;
        var p = toWorld(e); aim = { sx: p.x, sy: p.y, x: p.x, y: p.y, id: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      });
      cv.addEventListener('pointermove', function (e) { if (aim && e.pointerId === aim.id) { var p = toWorld(e); aim.x = p.x; aim.y = p.y; } });
      function release(e) {
        if (!aim || e.pointerId !== aim.id) return;
        var v = aimVel(); aim = null;
        if (!v || state !== 'play') return;
        var h = hand(v.ang);
        dart = { x: h.x, y: h.y, vx: v.vx, vy: v.vy, hits: 0 };
        darts--; combo = 0; throwT = 0.25; snd('throw');
      }
      cv.addEventListener('pointerup', release);
      cv.addEventListener('pointercancel', function () { aim = null; });

      /* ----- update ----- */
      function segHit(ax, ay, bx, by, cx, cy, r) {
        var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        var px = ax + dx * t - cx, py = ay + dy * t - cy;
        return px * px + py * py <= r * r;
      }
      function pop(b) {
        b.gone = true; popped++; combo++;
        var pts = 10 * combo; score += pts;
        floats.push({ x: b.x, y: b.y - 10, t: 0.8, s: '+' + pts });
        var col = COLORS[b.kind - 1];
        for (var i = 0; i < 9; i++) { var a = rnd(0, 6.28), sp = rnd(60, 180); bits.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: rnd(0.4, 0.8), c: col, r: rnd(0, 6) }); }
        snd('pop');
      }
      function bx(b) { return b.x + (b.move ? Math.sin(b.t * 1.4) * b.move : 0); }
      function by(b) { return b.y + Math.sin(b.t * 2) * 2.5; }

      function update(dt) {
        clock += dt;
        throwT = Math.max(0, throwT - dt);
        balloons.forEach(function (b) { b.t += dt; });
        if (dart) {
          // small steps so fast knives can't skip over balloons
          var steps = 4;
          for (var s = 0; s < steps; s++) {
            var h = dt / steps, ox = dart.x, oy = dart.y;
            dart.vy += K.gravity * h; dart.x += dart.vx * h; dart.y += dart.vy * h;
            var ang = Math.atan2(dart.vy, dart.vx), tx = dart.x + Math.cos(ang) * 8, ty = dart.y + Math.sin(ang) * 8;
            var otx = ox + Math.cos(ang) * 8, oty = oy + Math.sin(ang) * 8;
            balloons.forEach(function (b) { if (!b.gone && segHit(otx, oty, tx, ty, bx(b), by(b), BR)) pop(b); });
          }
          if (dart.x > W + 30 || dart.x < -30 || dart.y > H + 30) { dart = null; afterThrow(); }
        }
        bits.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 400 * dt; b.t -= dt; b.r += dt * 8; });
        bits = bits.filter(function (b) { return b.t > 0; });
        floats.forEach(function (f) { f.y -= 30 * dt; f.t -= dt; });
        floats = floats.filter(function (f) { return f.t > 0; });
        if (state === 'clear' || state === 'fail') overT -= dt;
      }
      function afterThrow() {
        if (combo >= 4) floats.push({ x: W / 2, y: H * 0.3, t: 1.2, s: combo + ' IN ONE KNIFE!', big: true });
        if (popped >= need) return clear();
        if (darts === 0) fail();
      }
      function clear() {
        score += darts * 50;
        state = 'clear'; overT = 0.8; snd('clear');
        saveBest();
        OS.emit('level-clear:' + ID, level);
        (K.rewards || []).forEach(function (r) {
          var k = ID + ':' + (r.id || r.level);
          if (level >= r.level && !OS.flag(k)) { OS.setFlag(k); OS.run(r.action); }
        });
      }
      function fail() {
        state = 'fail'; overT = 0.8; snd('fail');
        saveBest();
        OS.emit('game-over:' + ID, { level: level, score: score });
      }
      function saveBest() {
        var lv = state === 'clear' ? level : level - 1;
        if (score > best.score || lv > best.level) {
          best = { level: Math.max(best.level, lv), score: Math.max(best.score, score) };
          OS.store.set(ID + ':best', best);
        }
      }

      /* ----- draw ----- */
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function text(s, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineJoin = 'round';
        ctx.strokeText(s, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
      }
      function cloud(x, y, s) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, 7); ctx.arc(x + 14 * s, y - 6 * s, 15 * s, 0, 7); ctx.arc(x + 30 * s, y, 11 * s, 0, 7); ctx.fill();
        ctx.fillRect(x, y, 30 * s, 11 * s);
      }
      function drawBalloon(b) {
        var x = bx(b), y = by(b);
        // string
        ctx.strokeStyle = 'rgba(60,60,60,.7)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.quadraticCurveTo(x + Math.sin(b.t * 3) * 4, y + 24, x, y + 32); ctx.stroke();
        var im = SPR['b' + b.kind];
        if (im) { var h = 34, w = h * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); return; }
        ctx.fillStyle = COLORS[b.kind - 1]; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, 12, 15, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 3, y + 17); ctx.lineTo(x + 3, y + 17); ctx.lineTo(x, y + 14); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x - 4, y - 6, 3, 5, -0.4, 0, 7); ctx.fill();
      }
      function drawDart(x, y, ang) {          // it's a knife now; the tip sits about 10 units ahead of (x, y)
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = '#d6dbe0'; ctx.strokeStyle = '#6d747b'; ctx.lineWidth = 0.6;                 // blade
        ctx.beginPath(); ctx.moveTo(-1, -2); ctx.lineTo(7, -2); ctx.quadraticCurveTo(10, -1.6, 11.5, 0.2); ctx.lineTo(-1, 1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(10, 0.4); ctx.stroke();   // sharp edge shine
        ctx.fillStyle = '#9aa1a8'; ctx.fillRect(-2.2, -3.2, 1.6, 6.4);                               // guard
        ctx.fillStyle = '#3a2416'; ctx.fillRect(-10, -1.7, 7.8, 3.4);                                // handle
        ctx.fillStyle = '#c9c9c9'; ctx.beginPath(); ctx.arc(-7.6, 0, 0.6, 0, 7); ctx.arc(-4.6, 0, 0.6, 0, 7); ctx.fill();   // rivets
        ctx.restore();
      }
      function drawMonkey(ang, holding) {
        var m = monkey(), x = m.x, y = m.y;
        var BROWN = '#7a4a24', DARK = '#5a3418', TAN = '#d9a877', MASK = '#1b1b1f';
        // crate
        ctx.fillStyle = '#9b6b3a'; ctx.fillRect(x - 22, y + 14, 44, 30);
        ctx.strokeStyle = '#6b4520'; ctx.lineWidth = 2; ctx.strokeRect(x - 22, y + 14, 44, 30);
        ctx.beginPath(); ctx.moveTo(x - 22, y + 14); ctx.lineTo(x + 22, y + 44); ctx.stroke();
        // tail
        ctx.strokeStyle = BROWN; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.quadraticCurveTo(x - 30, y + 6, x - 26, y - 10); ctx.quadraticCurveTo(x - 23, y - 18, x - 17, y - 13); ctx.stroke();
        // legs + body
        ctx.fillStyle = BROWN;
        ctx.beginPath(); ctx.ellipse(x - 6, y + 11, 6, 4, 0, 0, 7); ctx.ellipse(x + 8, y + 11, 6, 4, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y - 2, 13, 15, 0, 0, 7); ctx.fill();
        ctx.fillStyle = TAN; ctx.beginPath(); ctx.ellipse(x + 2, y + 1, 7, 9, 0, 0, 7); ctx.fill();
        // back arm
        ctx.strokeStyle = DARK; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x - 12, y + 4); ctx.stroke();
        // head: ears poke out of the ski mask
        var hx = x + 2, hy = y - 28;
        ctx.fillStyle = BROWN; ctx.beginPath(); ctx.arc(hx - 13, hy + 1, 5.5, 0, 7); ctx.arc(hx + 13, hy + 1, 5.5, 0, 7); ctx.fill();
        ctx.fillStyle = TAN; ctx.beginPath(); ctx.arc(hx - 13, hy + 1, 3, 0, 7); ctx.arc(hx + 13, hy + 1, 3, 0, 7); ctx.fill();
        // the mask
        ctx.fillStyle = MASK; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2c2c33'; ctx.lineWidth = 1;                              // knit ribs
        for (var i = -9; i <= 9; i += 3) { ctx.beginPath(); ctx.moveTo(hx + i, hy - 11 + Math.abs(i) * 0.3); ctx.lineTo(hx + i, hy - 6); ctx.stroke(); }
        ctx.fillStyle = MASK; ctx.beginPath(); ctx.arc(hx, hy - 12, 3.2, 0, 7); ctx.fill();   // pom-pom
        // eye slot + mouth hole show the face underneath
        ctx.fillStyle = TAN;
        ctx.beginPath(); ctx.moveTo(hx - 8, hy - 4); ctx.lineTo(hx + 8, hy - 4); ctx.arc(hx + 8, hy - 1, 3, -Math.PI / 2, Math.PI / 2); ctx.lineTo(hx - 8, hy + 2); ctx.arc(hx - 8, hy - 1, 3, Math.PI / 2, Math.PI * 1.5); ctx.fill();
        // snarling mouth hole: bared, gritted teeth
        ctx.beginPath(); ctx.ellipse(hx + 1, hy + 6.8, 5.2, 3.4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#3a0f0a';
        ctx.beginPath(); ctx.moveTo(hx - 3.6, hy + 7.6); ctx.quadraticCurveTo(hx + 1, hy + 3.6, hx + 5.6, hy + 7.6); ctx.quadraticCurveTo(hx + 1, hy + 9.4, hx - 3.6, hy + 7.6); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(hx - 2.6, hy + 7); ctx.quadraticCurveTo(hx + 1, hy + 4.4, hx + 4.6, hy + 7); ctx.lineTo(hx + 4.2, hy + 7.9); ctx.quadraticCurveTo(hx + 1, hy + 8.6, hx - 2.2, hy + 7.9); ctx.fill();
        ctx.strokeStyle = '#8a7a70'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(hx - 2.4, hy + 7.3); ctx.lineTo(hx + 4.4, hy + 7.3);
        for (var tt = -1; tt <= 3; tt += 1.3) { ctx.moveTo(hx + tt, hy + 5.6); ctx.lineTo(hx + tt, hy + 8.3); }
        ctx.stroke();
        // squinting eyes locked on the target
        var lx = Math.cos(ang) * 1, ly = Math.sin(ang) * 0.6;
        ctx.fillStyle = '#fff3ee'; ctx.beginPath(); ctx.arc(hx - 4, hy - 0.6, 2.6, 0, 7); ctx.arc(hx + 4, hy - 0.6, 2.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(hx - 3.6 + lx, hy - 0.2 + ly, 1.1, 0, 7); ctx.arc(hx + 4.4 + lx, hy - 0.2 + ly, 1.1, 0, 7); ctx.fill();
        // the mask's knit pulls down into a deep V scowl over the eyes
        ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 12, 0, 7); ctx.clip();
        ctx.fillStyle = MASK;
        ctx.beginPath(); ctx.moveTo(hx - 11, hy - 5); ctx.lineTo(hx - 7.5, hy - 3.2); ctx.lineTo(hx - 0.8, hy + 0.6); ctx.lineTo(hx + 0.8, hy + 0.6); ctx.lineTo(hx + 7.5, hy - 3.2); ctx.lineTo(hx + 11, hy - 5); ctx.lineTo(hx + 11, hy - 4); ctx.lineTo(hx - 11, hy - 4); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';       // brows
        ctx.beginPath(); ctx.moveTo(hx - 7.6, hy - 3.6); ctx.lineTo(hx - 1.2, hy + 0.1); ctx.moveTo(hx + 7.6, hy - 3.6); ctx.lineTo(hx + 1.2, hy + 0.1); ctx.stroke();
        // throbbing anger mark on the mask
        var pulse = 1 + Math.sin(clock * 9) * 0.15;
        ctx.save(); ctx.translate(hx + 7, hy - 8); ctx.scale(pulse, pulse);
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-2.5, -0.8); ctx.quadraticCurveTo(-0.8, -0.8, -0.8, -2.5); ctx.moveTo(0.8, -2.5); ctx.quadraticCurveTo(0.8, -0.8, 2.5, -0.8);
        ctx.moveTo(2.5, 0.8); ctx.quadraticCurveTo(0.8, 0.8, 0.8, 2.5); ctx.moveTo(-0.8, 2.5); ctx.quadraticCurveTo(-0.8, 0.8, -2.5, 0.8); ctx.stroke();
        ctx.restore();
        // throwing arm swings with the aim
        var h = hand(ang);
        ctx.strokeStyle = BROWN; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x + 6, y - 22 + 8); ctx.lineTo(h.x, h.y); ctx.stroke();
        ctx.fillStyle = TAN; ctx.beginPath(); ctx.arc(h.x, h.y, 3, 0, 7); ctx.fill();
        if (holding) drawDart(h.x + Math.cos(ang) * 4, h.y + Math.sin(ang) * 4, ang);
      }
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        if (SPR.bg) {
          var im = SPR.bg, s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
          ctx.drawImage(im, (W - im.naturalWidth * s) / 2, (H - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
        } else {
          var g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, '#5fb4f0'); g.addColorStop(1, '#cfeaff');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          cloud(((clock * 6) % (W + 120)) - 60, H * 0.12, 1); cloud(((clock * 4 + 200) % (W + 120)) - 60, H * 0.3, 0.7);
          ctx.fillStyle = '#6cbf4a'; ctx.fillRect(0, H - 18, W, 18);
          ctx.fillStyle = '#4f9a33'; ctx.fillRect(0, H - 18, W, 3);
        }

        balloons.forEach(function (b) { if (!b.gone) drawBalloon(b); });
        bits.forEach(function (b) {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.globalAlpha = Math.min(1, b.t * 2);
          ctx.fillStyle = b.c; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
        });

        // aim preview: dotted arc
        var v = aim && aimVel(), ang = -0.6;
        if (v) {
          ang = v.ang;
          var h = hand(ang), px = h.x, py = h.y, vx = v.vx, vy = v.vy;
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          for (var i = 0; i < 16; i++) {
            for (var k = 0; k < 3; k++) { vy += K.gravity * 0.012; px += vx * 0.012; py += vy * 0.012; }
            ctx.globalAlpha = 1 - i / 16; ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else if (dart) ang = -0.2 + throwT * 2;
        drawMonkey(ang, state === 'play' && !dart && darts > 0);
        if (dart) drawDart(dart.x, dart.y, Math.atan2(dart.vy, dart.vx));

        floats.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.t * 2); text(f.s, f.x, f.y, f.big ? 20 : 12, f.big ? '#ffd23a' : '#fff'); ctx.globalAlpha = 1; });

        // HUD
        if (state !== 'title') {
          text('LEVEL ' + level, 10, 20, 15, '#fff', 'left');
          text(score.toLocaleString(), W - 10, 20, 15, '#fff', 'right');
          text(popped + ' / ' + need, W / 2, 20, 15, popped >= need ? '#8fd14f' : '#fff');
          for (var d = 0; d < darts; d++) drawDart(16 + d * 14, 42, -Math.PI / 2);
        }
        var blink = Math.floor(clock * 2) % 2 === 0;
        if (state === 'title') {
          text(K.name.toUpperCase(), W / 2, H * 0.17, 32, '#fff');
          text('Drag back anywhere to aim.', W / 2, H * 0.25, 13, '#fff');
          text('Let go to throw. Knives go through', W / 2, H * 0.29, 13, '#fff');
          text('every balloon they touch.', W / 2, H * 0.33, 13, '#fff');
          if (blink) text('TAP TO START', W / 2, H * 0.43, 22, '#ffd23a');
          if (best.level) text('BEST  LEVEL ' + best.level + '  ·  ' + best.score.toLocaleString(), W / 2, H * 0.49, 13, '#fff');
        } else if (state === 'clear') {
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
          text('LEVEL ' + level + ' CLEAR', W / 2, H * 0.32, 26, '#8fd14f');
          if (darts) text('+' + darts * 50 + ' for knives left', W / 2, H * 0.39, 14, '#fff');
          text(score.toLocaleString(), W / 2, H * 0.45, 30, '#fff');
          if (blink && overT <= 0) text('TAP FOR LEVEL ' + (level + 1), W / 2, H * 0.55, 18, '#ffd23a');
        } else if (state === 'fail') {
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
          text('OUT OF KNIVES', W / 2, H * 0.32, 26, '#ff6b5b');
          text('popped ' + popped + ' of ' + need, W / 2, H * 0.39, 14, '#fff');
          text('BEST  LEVEL ' + best.level + '  ·  ' + best.score.toLocaleString(), W / 2, H * 0.45, 13, '#ccc');
          if (blink && overT <= 0) text('TAP TO TRY AGAIN', W / 2, H * 0.55, 18, '#ffd23a');
        }
      }

      /* ----- loop ----- */
      var alive = true, last = performance.now();
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.033, (now - last) / 1000); last = now;
        update(dt); draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      OS.debugBalloons = { get state() { return state; }, get level() { return level; }, get balloons() { return balloons; }, get darts() { return darts; },
        get popped() { return popped; }, get need() { return need; }, get dart() { return dart; }, get score() { return score; },
        start: startGame, go: function (n) { level = n; buildLevel(n); state = 'play'; },
        throwAt: function (vx, vy) { if (state !== 'play' || dart || !darts) return; var a = Math.atan2(vy, vx), h = hand(a); dart = { x: h.x, y: h.y, vx: vx, vy: vy }; darts--; combo = 0; throwT = 0.25; },
        hand: hand };

      return {
        back: function () { if (state === 'play' || state === 'clear' || state === 'fail') { state = 'title'; aim = null; dart = null; return true; } return false; },
        menu: function () { return [{ label: 'Restart level', action: retry }, { label: 'New game', action: startGame }, { label: OS.silent ? 'Sound on' : 'Sound off', action: function () { OS.setSilent(!OS.silent); } }]; },
        close: function () { alive = false; window.removeEventListener('resize', resize); }
      };
    }
  });
})();
