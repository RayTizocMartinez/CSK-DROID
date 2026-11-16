/* =====================================================================
   NICK RUN — one-button rooftop runner (Canabalt style).
   Tap to jump (hold = higher). Jars slow you down. Miss a gap: game over.

   Sprites:  media/games/nickrun/nick-run.png   one pose, or a strip of frames
             media/games/nickrun/nick-jump.png
   Tuning:   js/content.js -> games.nickrun
   Everything else (city, rooftops, jars, pigeons) is drawn in code.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'nickrun';
  var DIR = 'media/games/nickrun/';

  var DEFAULTS = {
    name: 'Nick Run',
    startSpeed: 150,      // units per second (the screen is 320 wide)
    maxSpeed: 380,
    accel: 7,             // speed gained per second
    jarSlow: 0.72,        // speed is multiplied by this when you hit a jar
    jarChance: 0.55,      // chance a rooftop has jars
    rewards: []           // [{ meters: 500, action: {...} }]
  };
  function cfg() {
    var g = (C.games || {})[ID] || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="#8e9aa6" stroke="#2a3038"/>' +
    '<rect x="4" y="30" width="16" height="14" fill="#3a3f46"/><rect x="27" y="26" width="17" height="18" fill="#3a3f46"/>' +
    '<rect x="7" y="33" width="3" height="3" fill="#c9d1d9"/><rect x="13" y="33" width="3" height="3" fill="#c9d1d9"/><rect x="31" y="30" width="3" height="3" fill="#c9d1d9"/><rect x="37" y="30" width="3" height="3" fill="#c9d1d9"/>' +
    '<circle cx="23" cy="13" r="3" fill="#111"/><path d="M23 16l-1 7M22 23l-5 4M22 23l5 3M23 18l-5-1M23 18l5-2" stroke="#111" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
    '<path d="M10 20h6M8 24h7" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/></svg>';

  /* ---------- sprites ---------- */
  var SPR = {}, loaded = false;
  function loadSprites() {
    if (loaded) return; loaded = true;
    ['nick-run', 'nick-jump'].forEach(function (name) {
      var exts = ['.png', '.jpg', '.jpeg'], k = 0, im = new Image();
      im.onload = function () { SPR[name] = im; };
      im.onerror = function () { if (++k < exts.length) im.src = OS.url(DIR + name + exts[k]); };
      im.src = OS.url(DIR + name + exts[0]);
    });
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
    jump:  function () { OS.beep(330, 0.06, 0, 0.06); OS.beep(495, 0.08, 0.04, 0.05); },
    land:  function () { noise(0.12, 180, 1, 0.25); },
    smash: function () { noise(0.35, 4500, 0.7, 0.2); noise(0.2, 2500, 2, 0.12, 0.03); },
    fall:  function () { [440, 370, 311, 262, 220, 175].forEach(function (f, i) { OS.beep(f, 0.12, i * 0.09, 0.07); }); },
    start: function () { OS.beep(523, 0.07, 0, 0.06); OS.beep(784, 0.1, 0.08, 0.06); },
    flap:  function () { noise(0.25, 1200, 0.6, 0.06); }
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
  function hash(n) { var h = Math.sin(n * 91.345) * 47453.13; return h - Math.floor(h); }

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
      var RUN_H = 40, HIT_W = 14, HIT_H = 34;
      var GRAV = 1500, HOLD_GRAV = 700, JUMP_V = 430, HOLD_MAX = 0.26;
      var lastDeath = null;
      var state = 'title', best = OS.store.get(ID + ':best', 0);
      var cruise = 150, p, speed, blocks, jars, birds, dust, shards, camY, dist, overT, clock = 0, shake = 0, newBest = false, stride = 0;

      function reset() {
        p = { x: 0, y: 0, vy: 0, ground: true, lastTop: 0, coyote: 0, buffer: 0, hold: 0, holding: false, dead: false };
        speed = cruise = K.startSpeed; dist = 0; stride = 0; newBest = false;
        blocks = []; jars = []; birds = []; dust = []; shards = [];
        var top = H * 0.62;
        blocks.push({ x: -200, w: 760, top: top, seed: 1 });
        p.y = top; p.lastTop = top; camY = top - H * 0.62;
        while (blocks[blocks.length - 1].x < 520) addBlock();
      }
      function addBlock() {
        var last = blocks[blocks.length - 1];
        var s = Math.max(Math.min(speed, cruise), K.startSpeed);      // size gaps for how fast he's going right now
        var gap = s * rnd(0.22, 0.42) + 18;
        var w = rnd(170, 430) * (s / K.startSpeed > 1.8 ? 1.25 : 1);
        var up = Math.min(55, 10 + (420 - gap) * 0.12);                // can't climb as high over big gaps
        var top = Math.max(H * 0.42, Math.min(H * 0.86, last.top + rnd(-up, 70)));
        var b = { x: last.x + last.w + gap, w: w, top: top, seed: Math.random() * 1000 };
        blocks.push(b);
        if (Math.random() < K.jarChance) {
          var n = 1 + Math.floor(Math.random() * 3), x0 = b.x + rnd(80, Math.max(90, w - 120));
          for (var i = 0; i < n; i++) jars.push({ x: x0 + i * 13, y: top, hit: false });
        }
        if (Math.random() < 0.45) {
          var bx = b.x + rnd(40, w - 40), m = 2 + Math.floor(Math.random() * 4);
          for (var j = 0; j < m; j++) birds.push({ x: bx + j * rnd(6, 12), y: top - 3, vx: 0, vy: 0, fly: false, t: Math.random() * 6 });
        }
      }
      reset();

      function start() { reset(); state = 'play'; snd('start'); OS.emit('game-start:' + ID); }
      function blockAt(x) { for (var i = 0; i < blocks.length; i++) { var b = blocks[i]; if (x >= b.x && x <= b.x + b.w) return b; } return null; }

      /* ----- input: one button ----- */
      function press() {
        OS.audioCtx();
        if (state === 'title' || (state === 'over' && overT <= -0.7)) { start(); return; }
        if (state !== 'play') return;
        p.holding = true;
        p.buffer = 0.12;                       // a tap just before landing still counts
      }
      function release() { p && (p.holding = false); }
      cv.addEventListener('pointerdown', function (e) { e.preventDefault(); press(); });
      cv.addEventListener('pointerup', release);
      cv.addEventListener('pointercancel', release);
      function onKey(e) {
        if (e.key !== ' ' && e.key !== 'ArrowUp' && e.key !== 'w' && e.key !== 'Enter') return;
        e.preventDefault();
        if (e.type === 'keydown') { if (!e.repeat) press(); } else release();
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);

      /* ----- update ----- */
      function update(dt) {
        clock += dt;
        shake = Math.max(0, shake - dt);
        if (state === 'title') stride += 90 * dt;           // jog in place on the title screen
        if (state === 'play' || state === 'dying') {
          if (state === 'play') {
            cruise = Math.min(K.maxSpeed, cruise + K.accel * dt);
            speed += (cruise - speed) * Math.min(1, dt * 1.6);          // after a jar, get back up to cruising speed
          }
          var oldX = p.x, oldBottom = p.y;
          p.x += speed * dt;
          dist = Math.max(dist, p.x / 10);

          // jumping
          p.buffer = Math.max(0, p.buffer - dt);
          p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - dt);
          if (state === 'play' && p.buffer > 0 && (p.ground || p.coyote > 0)) {
            p.vy = -JUMP_V; p.ground = false; p.coyote = 0; p.buffer = 0; p.hold = HOLD_MAX; snd('jump');
          }
          var g = (p.holding && p.hold > 0 && p.vy < 0) ? HOLD_GRAV : GRAV;
          p.hold = Math.max(0, p.hold - dt);
          if (!p.ground) { p.vy = Math.min(900, p.vy + g * dt); p.y += p.vy * dt; }

          // rooftops: land on top, or slam into the side of a taller building
          var b = blockAt(p.x);
          if (p.ground) {
            if (!b || Math.abs(b.top - p.y) > 2) { p.ground = false; p.vy = 0; }      // ran off the edge
          } else if (b && !p.dead) {
            if (oldBottom <= b.top + 1 && p.y >= b.top) {
              p.y = b.top; p.vy = 0; p.ground = true;
              snd('land'); for (var i = 0; i < 6; i++) dust.push({ x: p.x + rnd(-8, 8), y: p.y, vx: rnd(-40, 20), vy: rnd(-40, -10), t: 0.45 });
            } else if (p.y > b.top + 6 && oldX < b.x + 2) {
              die('wall');
            }
          }
          if (p.ground) { stride += speed * dt; p.lastTop = p.y; }

          // jars: smash + slow down
          if (!p.dead) jars.forEach(function (j) {
            if (j.hit) return;
            if (Math.abs(j.x - p.x) < HIT_W / 2 + 4 && p.y > j.y - 14) {
              j.hit = true; speed = Math.max(K.startSpeed * 0.8, speed * K.jarSlow); shake = 0.15; snd('smash');
              for (var s = 0; s < 10; s++) shards.push({ x: j.x, y: j.y - 8, vx: rnd(40, 200), vy: rnd(-260, -60), t: 0.9, c: s % 3 ? '#d4a10f' : '#cfe3ea' });
            }
          });
          // pigeons scatter
          birds.forEach(function (bd) {
            if (!bd.fly && bd.x - p.x < 70 && bd.x - p.x > -20) { bd.fly = true; bd.vx = rnd(-30, 60); bd.vy = rnd(-160, -90); if (Math.random() < 0.3) snd('flap'); }
            if (bd.fly) { bd.x += bd.vx * dt; bd.y += bd.vy * dt; bd.vy -= 20 * dt; }
            bd.t += dt;
          });
          // fell too far
          // fell well below the last roof (or every roof nearby): that's the end
          var lowest = blocks.reduce(function (m, b) { return b.x < p.x + 200 && b.x + b.w > p.x - 200 ? Math.max(m, b.top) : m; }, p.lastTop);
          if (!p.dead && p.y > Math.max(p.lastTop, lowest) + 140) die('fall');
          if (speed > K.maxSpeed * 0.85 && state === 'play') shake = Math.max(shake, 0.02);
          if (state === 'dying') { overT -= dt; if (overT <= 0) state = 'over'; }
        }
        if (state === 'over') overT -= dt;

        // world upkeep
        while (blocks[blocks.length - 1].x < p.x + 520) addBlock();
        blocks = blocks.filter(function (b) { return b.x + b.w > p.x - 400; });
        jars = jars.filter(function (j) { return j.x > p.x - 300; });
        birds = birds.filter(function (b) { return b.x > p.x - 300 && b.y > camY - 200; });
        dust.forEach(function (d) { d.x += d.vx * dt; d.y += d.vy * dt; d.t -= dt; });
        dust = dust.filter(function (d) { return d.t > 0; });
        shards.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; s.t -= dt; });
        shards = shards.filter(function (s) { return s.t > 0; });

        // camera follows the runner up and down (a little behind)
        var target = (p.dead ? camY : Math.min(p.y, p.lastTop + 40) - H * 0.62);   // don't chase him down a gap
        camY += (target - camY) * Math.min(1, dt * 3);
      }
      function die(why) {
        if (p.dead) return;
        p.dead = true; p.ground = false;
        lastDeath = { why: why, x: p.x, y: p.y, vy: p.vy, speed: speed, blocks: blocks.filter(function (b) { return b.x + b.w > p.x - 300 && b.x < p.x + 300; }).map(function (b) { return [Math.round(b.x), Math.round(b.w), Math.round(b.top)]; }) };
        if (why === 'wall') { p.vy = 60; speed = 0; shake = 0.3; }
        state = 'dying'; overT = 1.4;
        snd('fall');
        var m = Math.floor(dist);
        if (m > best) { best = m; newBest = true; OS.store.set(ID + ':best', best); }
        OS.emit('game-over:' + ID, { meters: m, best: best });
        (K.rewards || []).forEach(function (r) {
          var k = ID + ':' + (r.id || r.meters);
          if (m >= r.meters && !OS.flag(k)) { OS.setFlag(k); OS.run(r.action); }
        });
      }

      /* ----- draw ----- */
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function text(s, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineJoin = 'round';
        ctx.strokeText(s, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
      }
      function skyline(par, base, color, minH, maxH, wMin, wMax, seedOff) {
        var camX = p.x - W * 0.25, off = camX * par, x0 = Math.floor(off / 40) - 1;
        ctx.fillStyle = color;
        for (var i = x0; i < x0 + Math.ceil(W / 40) + 3; i++) {
          var h = minH + hash(i + seedOff) * (maxH - minH), bw = wMin + hash(i * 3.1 + seedOff) * (wMax - wMin);
          var sx = i * 40 - off, y = base - h - (camY - (H * 0.62 - H * 0.62)) * par * 0.2;
          ctx.fillRect(sx, y, bw, H - y + 200);
          if (hash(i * 7.7 + seedOff) > 0.7) ctx.fillRect(sx + bw * 0.45, y - 14, 2, 14);        // antenna
        }
      }
      function drawRunner(x, y) {
        var air = !p.ground && !(state === 'title');
        var im = air ? (SPR['nick-jump'] || SPR['nick-run']) : SPR['nick-run'];
        if (im) {
          var frames = air && SPR['nick-jump'] ? 1 : Math.max(1, Math.round(im.naturalWidth / im.naturalHeight));
          var fw = im.naturalWidth / frames, fh = im.naturalHeight, f = frames > 1 ? Math.floor(stride / 9) % frames : 0;
          var dh = RUN_H, dw = RUN_H * fw / fh, bob = frames === 1 && !air ? Math.abs(Math.sin(stride / 9)) * 2 : 0;
          ctx.drawImage(im, f * fw, 0, fw, fh, x - dw / 2, y - dh - bob, dw, dh);
          return;
        }
        // stand-in runner: a stick figure with a proper running cycle
        var t = stride / 7, s = Math.sin(t), c = Math.cos(t);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        var hipX = x, hipY = y - 15, neckX = x + 3, neckY = y - 29;
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(neckX, neckY);
        if (air) { ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + 9, hipY + 3); ctx.lineTo(hipX + 6, hipY + 13); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX - 8, hipY + 6); ctx.lineTo(hipX - 12, hipY + 13); }
        else {
          ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + s * 7, hipY + 8); ctx.lineTo(hipX + s * 8 + 2, hipY + 15 - Math.max(0, c) * 4);
          ctx.moveTo(hipX, hipY); ctx.lineTo(hipX - s * 7, hipY + 8); ctx.lineTo(hipX - s * 8 + 2, hipY + 15 - Math.max(0, -c) * 4);
        }
        ctx.moveTo(neckX, neckY + 3); ctx.lineTo(neckX + (air ? 8 : -s * 7), neckY + 10); ctx.lineTo(neckX + (air ? 13 : -s * 6 + 5), neckY + (air ? 4 : 14));
        ctx.moveTo(neckX, neckY + 3); ctx.lineTo(neckX + (air ? -6 : s * 7), neckY + 10); ctx.lineTo(neckX + (air ? -10 : s * 6 + 5), neckY + (air ? 2 : 14));
        ctx.stroke();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(neckX + 2, neckY - 5, 5, 0, 7); ctx.fill();
      }
      function drawJar(x, y) {
        ctx.fillStyle = 'rgba(200,225,235,.35)'; ctx.strokeStyle = '#cfe3ea'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(x - 5, y - 13, 10, 13); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c99a0c'; ctx.fillRect(x - 4, y - 9, 8, 8.5);
        ctx.fillStyle = '#cfe3ea'; ctx.fillRect(x - 4, y - 15, 8, 2.5);
      }
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#9aa6b2'); g.addColorStop(1, '#c9d0d6');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save();
        if (shake > 0) ctx.translate(rnd(-3, 3) * shake * 10, rnd(-3, 3) * shake * 10);
        skyline(0.15, H * 0.55, '#aab3bc', 60, 170, 26, 44, 0);
        skyline(0.35, H * 0.68, '#7f8a95', 40, 150, 30, 46, 50);
        var camX = p.x - W * 0.25;
        ctx.translate(-camX, -camY);
        // rooftops
        blocks.forEach(function (b) {
          if (b.x > camX + W + 20 || b.x + b.w < camX - 20) return;
          ctx.fillStyle = '#3a3f46'; ctx.fillRect(b.x, b.top, b.w, H + camY - b.top + 200);
          ctx.fillStyle = '#4c525a'; ctx.fillRect(b.x, b.top, b.w, 4);
          ctx.fillStyle = '#2c3036'; ctx.fillRect(b.x + b.w - 6, b.top, 6, H + camY - b.top + 200);
          for (var wy = b.top + 18; wy < camY + H + 20; wy += 22) for (var wx = b.x + 12; wx < b.x + b.w - 16; wx += 18) {
            var lit = hash(wx * 0.37 + wy * 1.7 + b.seed) > 0.82;
            ctx.fillStyle = lit ? '#c9d1a0' : '#555c64'; ctx.fillRect(wx, wy, 8, 10);
          }
          var vents = Math.floor(hash(b.seed) * 3);
          for (var v = 0; v < vents; v++) { var vx = b.x + 30 + hash(b.seed + v) * (b.w - 80); ctx.fillStyle = '#4c525a'; ctx.fillRect(vx, b.top - 10, 18, 10); }
        });
        jars.forEach(function (j) { if (!j.hit) drawJar(j.x, j.y); });
        // pigeons
        ctx.strokeStyle = '#2a2a2a'; ctx.fillStyle = '#2a2a2a'; ctx.lineWidth = 1.4;
        birds.forEach(function (bd) {
          if (bd.fly) { var fl = Math.sin(bd.t * 22) * 4; ctx.beginPath(); ctx.moveTo(bd.x - 5, bd.y - fl); ctx.lineTo(bd.x, bd.y); ctx.lineTo(bd.x + 5, bd.y - fl); ctx.stroke(); }
          else { ctx.beginPath(); ctx.ellipse(bd.x, bd.y - 2, 3.5, 2.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(bd.x + 3, bd.y - 4.5, 1.6, 0, 7); ctx.fill(); }
        });
        dust.forEach(function (d) { ctx.fillStyle = 'rgba(220,220,220,' + d.t * 1.5 + ')'; ctx.beginPath(); ctx.arc(d.x, d.y - 2, 3, 0, 7); ctx.fill(); });
        shards.forEach(function (s) { ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 2.5, 2.5); });
        drawRunner(p.x, p.y);
        ctx.restore();
        // speed lines at high speed
        if (state === 'play' && speed > K.maxSpeed * 0.7) {
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
          for (var i = 0; i < 6; i++) { var ly = hash(Math.floor(clock * 8) + i) * H; ctx.beginPath(); ctx.moveTo(W, ly); ctx.lineTo(W - 40 - hash(i) * 60, ly); ctx.stroke(); }
        }
        // HUD + screens
        if (state !== 'title') text(Math.floor(dist).toLocaleString() + ' m', 10, 22, 22, '#fff', 'left');
        if (best && state !== 'title') text('BEST ' + best.toLocaleString(), W - 10, 22, 12, '#eef', 'right');
        var blink = Math.floor(clock * 2) % 2 === 0;
        if (state === 'title') {
          text(K.name.toUpperCase(), W / 2, H * 0.2, 38, '#fff');
          text('Tap to jump. Hold to jump higher.', W / 2, H * 0.29, 13, '#fff');
          text('Jars slow you down. Gaps end you.', W / 2, H * 0.335, 13, '#fff');
          if (blink) text('TAP TO RUN', W / 2, H * 0.44, 22, '#ffd23a');
          if (best) text('BEST  ' + best.toLocaleString() + ' m', W / 2, H * 0.5, 14, '#fff');
        } else if (state === 'over') {
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
          text('YOU RAN', W / 2, H * 0.3, 18, '#ccc');
          text(Math.floor(dist).toLocaleString() + ' m', W / 2, H * 0.37, 40, '#fff');
          text(newBest ? 'NEW BEST!' : 'BEST  ' + best.toLocaleString() + ' m', W / 2, H * 0.45, newBest ? 20 : 14, newBest ? '#8fd14f' : '#ccc');
          if (blink && overT <= -0.7) text('TAP TO RUN AGAIN', W / 2, H * 0.56, 20, '#ffd23a');
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

      OS.debugNickRun = { get state() { return state; }, get dist() { return dist; }, get speed() { return speed; }, get p() { return p; },
        get blocks() { return blocks; }, get lastDeath() { return lastDeath; }, get jars() { return jars; }, press: press, release: release };

      return {
        back: function () { if (state === 'play') { die('quit'); return true; } return false; },
        menu: function () { return [{ label: 'New run', action: start }, { label: OS.silent ? 'Sound on' : 'Sound off', action: function () { OS.setSilent(!OS.silent); } }]; },
        close: function () {
          alive = false;
          window.removeEventListener('resize', resize);
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('keyup', onKey);
        }
      };
    }
  });
})();
