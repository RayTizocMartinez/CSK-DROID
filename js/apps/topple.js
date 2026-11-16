/* =====================================================================
   MASK STACK — a tower stacker in the spirit of Topple (ngmoco, 2008).
   Blocks wearing colored ski masks drop onto a little stage. Stack them as
   tall as you can. Their faces show how they feel about it.

   Drag to move the block, tap to spin it, let go after dragging to drop it.
   Tilt the phone to sway the tower (arrow keys on a computer).
   Drop 3 blocks off the stage and it's over.

   Physics:  js/lib/matter.min.js (bundled Matter.js, works offline)
   Tuning:   js/content.js -> games.topple
   Optional: media/games/topple/bg.png and sounds (see README there)
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'topple';
  var DIR = 'media/games/topple/';

  var DEFAULTS = {
    name: 'Mask Stack',
    lives: 3,             // blocks you can lose off the stage
    stageWidth: 150,      // width of the stage (screen is 320 wide)
    tilt: 0.45,           // how hard tilting the phone pushes the tower sideways
    bounce: 0.1,          // how bouncy blocks are when they land (0 = dead, 1 = rubber)
    rewards: []           // [{ height: 20, action: {...} }]  height counted in blocks
  };
  function cfg() {
    var g = (C.games || {})[ID] || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="#2a1414" stroke="#000"/>' +
    '<rect x="10" y="38" width="28" height="4" fill="#a0703c"/>' +
    '<rect x="12" y="26" width="12" height="12" fill="#e8322e" stroke="#000" stroke-width=".8"/><rect x="24" y="26" width="12" height="12" fill="#2e7de8" stroke="#000" stroke-width=".8"/>' +
    '<rect x="18" y="14" width="12" height="12" fill="#f2c419" stroke="#000" stroke-width=".8"/><circle cx="24" cy="12.5" r="2.2" fill="#f2c419" stroke="#000" stroke-width=".6"/>' +
    '<rect x="19.5" y="17" width="9" height="3.4" rx="1.7" fill="#e7b48a"/><circle cx="22" cy="18.7" r=".9"/><circle cx="26" cy="18.7" r=".9"/><ellipse cx="24" cy="23" rx="2" ry="1.4" fill="#e7b48a"/>' +
    '<rect x="13.5" y="29" width="9" height="3.4" rx="1.7" fill="#e7b48a"/><rect x="25.5" y="29" width="9" height="3.4" rx="1.7" fill="#e7b48a"/>' +
    '<circle cx="16" cy="30.7" r=".9"/><circle cx="20" cy="30.7" r=".9"/><circle cx="28" cy="30.7" r=".9"/><circle cx="32" cy="30.7" r=".9"/></svg>';

  /* ---------- physics library (loaded on first open) ---------- */
  var mPromise = null;
  function loadMatter() {
    if (window.Matter) return Promise.resolve(true);
    if (mPromise) return mPromise;
    mPromise = new Promise(function (res) {
      var s = document.createElement('script');
      s.src = 'js/lib/matter.min.js';
      s.onload = function () { res(!!window.Matter); };
      s.onerror = function () { mPromise = null; res(false); };
      document.head.appendChild(s);
    });
    return mPromise;
  }

  /* ---------- optional background ---------- */
  var BG = null, bgTried = false;
  function loadBg() {
    if (bgTried) return; bgTried = true;
    var tries = ['bg.png', 'bg.jpg'], k = 0, im = new Image();
    im.onload = function () { BG = im; };
    im.onerror = function () { if (++k < tries.length) im.src = OS.url(DIR + tries[k]); };
    im.src = OS.url(DIR + tries[0]);
  }

  /* ---------- sounds ---------- */
  var SYN = {
    land:   function (v) { var ctx = OS.audioCtx(); if (!ctx || OS.silent) return; var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
              o.type = 'sine'; o.frequency.setValueAtTime(260 + v * 60, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.12);
              g.gain.setValueAtTime(Math.min(0.18, 0.05 + v * 0.03), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
              o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.18); },
    drop:   function () { OS.beep(660, 0.04, 0, 0.04); },
    spin:   function () { OS.beep(990, 0.03, 0, 0.035); },
    lose:   function () { var ctx = OS.audioCtx(); if (!ctx || OS.silent) return; var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
              o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.7);
              g.gain.setValueAtTime(0.07, t); g.gain.linearRampToValueAtTime(0.001, t + 0.75);
              o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.8); },
    level:  function () { [523, 659, 784].forEach(function (f, i) { OS.beep(f, 0.1, i * 0.08, 0.05); }); },
    over:   function () { [392, 330, 262, 196].forEach(function (f, i) { OS.beep(f, 0.16, i * 0.13, 0.06); }); },
    start:  function () { OS.beep(523, 0.07, 0, 0.06); OS.beep(784, 0.1, 0.08, 0.06); }
  };
  var SND = {}, missing = {};
  function snd(n, v) {
    if (OS.silent) return;
    if (missing[n]) { if (SYN[n]) SYN[n](v || 1); return; }
    if (!SND[n]) { SND[n] = new Audio(OS.url(DIR + n + '.mp3')); SND[n].preload = 'auto'; SND[n].onerror = function () { missing[n] = true; }; }
    var a = SND[n].cloneNode();
    if (n === 'land') a.volume = Math.min(1, 0.3 + (v || 1) * 0.15);
    a.onerror = function () { missing[n] = true; if (SYN[n]) SYN[n](v || 1); };
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  }

  /* ---------- pieces ---------- */
  var S = 20;                                        // one block cell
  var SHAPES = {
    I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    L: [[0, 0], [0, 1], [0, 2], [1, 2]], J: [[1, 0], [1, 1], [1, 2], [0, 2]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]]
  };
  var KEYS = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
  var MASK = { I: '#1aa0cc', O: '#e8b000', T: '#8a2be2', L: '#e86a00', J: '#1f4fd6', S: '#22a33a', Z: '#d4161b' };
  var SKIN = '#e7b48a';
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, Math.round(v * f))); }
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      loadBg();
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

      var M = null, engine = null, stage = null;
      var state = 'loading', clock = 0;
      var pieces = [], held = null, bag = [], nextKey = null;
      var lives = K.lives, height = 0, bestRun = 0, milestone = 0, overT = 0;
      var camTop = 0, floats = [];
      var best = OS.store.get(ID + ':best', 0);
      var tiltDeg = 0, keyTilt = 0, tiltAsked = false, tiltLive = false;
      var STAGE_Y = 0;                                // world y of the stage top

      function pickKey() {
        if (!bag.length) { bag = KEYS.slice(); for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; } }
        return bag.pop();
      }

      /* ----- world ----- */
      function setupWorld() {
        M = window.Matter;
        engine = M.Engine.create({ positionIterations: 20, velocityIterations: 16, enableSleeping: true });
        engine.gravity.y = 1;
        stage = M.Bodies.rectangle(W / 2, STAGE_Y + 10, K.stageWidth, 20, { isStatic: true, friction: 1, frictionStatic: 1.5, label: 'stage' });
        M.Composite.add(engine.world, stage);
        M.Events.on(engine, 'collisionStart', function (ev) {
          ev.pairs.forEach(function (p) {
            [p.bodyA.parent, p.bodyB.parent].forEach(function (b, i) {
              var pc = b.piece; if (!pc) return;
              var o = i ? p.bodyA.parent : p.bodyB.parent;
              var dv = Math.hypot(b.velocity.x - o.velocity.x, b.velocity.y - o.velocity.y);
              if (!pc.landed) { pc.landed = true; pc.landT = clock; }
              if (dv > 1.6) { pc.squash = Math.min(1, dv / 7); if (i === 0) snd('land', Math.min(4, dv / 2)); }
            });
          });
        });
      }
      function makePiece(key, x, y, angle) {
        var cells = SHAPES[key];
        var parts = cells.map(function (c) { return M.Bodies.rectangle(c[0] * S, c[1] * S, S, S); });
        var body = M.Body.create({ parts: parts, friction: 0.9, frictionStatic: 1.2, restitution: K.bounce, density: 0.0016, slop: 0.05, sleepThreshold: 40 });
        // remember which cell wears the face (nearest the middle) and which is on top (gets the pom-pom)
        var cx = body.position.x, cy = body.position.y, face = null, top = null;
        body.parts.slice(1).forEach(function (p) {          // parts[0] is the whole piece itself
          var d = Math.hypot(p.position.x - cx, p.position.y - cy);
          if (!face || d < face.d - 0.01) face = { d: d, x: p.position.x - cx, y: p.position.y - cy };
          if (!top || p.position.y < top.y - 0.01 || (Math.abs(p.position.y - top.y) < 0.01 && Math.abs(p.position.x - cx) < Math.abs(top.x))) top = { x: p.position.x - cx, y: p.position.y - cy };
        });
        M.Body.setPosition(body, { x: x, y: y });
        M.Body.setAngle(body, angle || 0);
        var pc = { body: body, key: key, color: MASK[key], face: face, top: top, landed: false, squash: 0,
          mood: 'whee', moodT: 0, blink: Math.random() * 4, lost: false };
        body.piece = pc;
        return pc;
      }
      // a held piece is just drawn, not simulated, until you let go
      function spawnHeld() {
        var key = nextKey || pickKey(); nextKey = pickKey();
        held = { key: key, x: W / 2, angle: 0, shown: 0, pc: null };
        held.pc = makePiece(key, W / 2, heldY(), 0);   // used for drawing only
      }
      function heldY() { return STAGE_Y - Math.max(height * S, 0) - 70; }

      function towerTop() {
        // tallest point among settled blocks still on (or over) the stage
        var top = STAGE_Y;
        pieces.forEach(function (pc) {
          if (pc.lost || !pc.landed || pc.body.speed > 0.5 || pc.body.position.y > STAGE_Y + 5) return;
          var b = pc.body.bounds; if (b.min.y < top) top = b.min.y;
        });
        return top;
      }

      function startGame() {
        pieces.forEach(function (pc) { M.Composite.remove(engine.world, pc.body); });
        pieces = []; floats = []; lives = K.lives; height = 0; bestRun = 0; milestone = 0; bag = []; nextKey = null;
        M.Body.setPosition(stage, { x: W / 2, y: STAGE_Y + 10 });
        camTop = STAGE_Y - H + 90;
        spawnHeld(); state = 'play'; snd('start');
        OS.emit('game-start:' + ID);
      }
      function dropHeld() {
        if (!held) return;
        var pc = makePiece(held.key, held.x, heldY(), held.angle);
        M.Composite.add(engine.world, pc.body);
        pieces.push(pc); held = null; snd('drop');
        setTimeout(function () { if (state === 'play' && !held) spawnHeld(); }, 650);
      }
      function gameOver() {
        state = 'over'; overT = 1; held = null; snd('over');
        if (bestRun > best) { best = bestRun; OS.store.set(ID + ':best', best); }
        OS.emit('game-over:' + ID, { height: bestRun });
      }

      /* ----- tilt ----- */
      function onOrient(e) { if (e.gamma != null) { tiltDeg = e.gamma; tiltLive = true; } }
      window.addEventListener('deviceorientation', onOrient);
      function askTilt() {
        if (tiltAsked) return; tiltAsked = true;
        var D = window.DeviceOrientationEvent;
        if (D && typeof D.requestPermission === 'function') {
          D.requestPermission().then(function (r) { if (r !== 'granted') OS.toast('Tilt is off. Use the arrows instead.'); }).catch(function () {});
        }
      }
      function tilt() {
        var t = keyTilt;
        if (tiltLive) { var g = tiltDeg; if (Math.abs(g) < 3) g = 0; t += Math.max(-1, Math.min(1, g / 35)); }
        return Math.max(-1, Math.min(1, t));
      }
      function onKey(e) {
        if (!root.isConnected) return;
        var down = e.type === 'keydown';
        if (e.key === 'ArrowLeft') keyTilt = down ? -1 : (keyTilt < 0 ? 0 : keyTilt);
        else if (e.key === 'ArrowRight') keyTilt = down ? 1 : (keyTilt > 0 ? 0 : keyTilt);
        else if (down && (e.key === ' ' || e.key === 'ArrowUp') && held && state === 'play') { held.angle += Math.PI / 2; snd('spin'); }
        else if (down && e.key === 'ArrowDown' && held && state === 'play') dropHeld();
        else return;
        e.preventDefault();
      }
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);

      /* ----- touch: drag to move, tap to spin, let go after a drag to drop ----- */
      var touch = null;
      function toWorld(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
      cv.addEventListener('click', askTilt);       // iPhones only allow the tilt question from a tap
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault(); OS.audioCtx();
        if (state === 'title') { askTilt(); startGame(); return; }
        if (state === 'over') { if (overT <= 0) startGame(); return; }
        if (state !== 'play' || !held) return;
        var p = toWorld(e);
        touch = { id: e.pointerId, sx: p.x, x0: held.x, moved: false };
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      });
      cv.addEventListener('pointermove', function (e) {
        if (!touch || e.pointerId !== touch.id || !held) return;
        var p = toWorld(e), dx = p.x - touch.sx;
        if (Math.abs(dx) > 6) touch.moved = true;
        if (touch.moved) held.x = Math.max(14, Math.min(W - 14, touch.x0 + dx));
      });
      cv.addEventListener('pointerup', function (e) {
        if (!touch || e.pointerId !== touch.id) return;
        var t = touch; touch = null;
        if (!held || state !== 'play') return;
        if (t.moved) dropHeld();
        else { held.angle += Math.PI / 2; snd('spin'); }
      });
      cv.addEventListener('pointercancel', function () { touch = null; });

      /* ----- update ----- */
      var acc = 0, STEP = 1000 / 120, lastTilt = 0;
      function update(dt) {
        clock += dt;
        if (!engine) return;
        var tl = tilt();
        engine.gravity.x = tl * K.tilt;
        // resting blocks fall asleep (keeps the tower steady); tilting wakes them up
        if (Math.abs(tl - lastTilt) > 0.02) { pieces.forEach(function (pc) { if (!pc.lost) M.Sleeping.set(pc.body, false); }); lastTilt = tl; }
        acc += dt * 1000;
        var n = 0;
        while (acc >= STEP && n < 8) { M.Engine.update(engine, STEP); acc -= STEP; n++; }
        if (n === 8) acc = 0;

        pieces.forEach(function (pc) {
          var b = pc.body;
          pc.squash = Math.max(0, pc.squash - dt * 4);
          pc.blink -= dt; if (pc.blink < -0.12) pc.blink = 2 + Math.random() * 4;
          if (!pc.lost && (b.position.y > STAGE_Y + 220 || b.position.x < -120 || b.position.x > W + 120)) {
            pc.lost = true; M.Composite.remove(engine.world, b);
            if (state === 'play') {
              lives--; snd('lose');
              floats.push({ x: Math.max(40, Math.min(W - 40, b.position.x)), y: H * 0.45, t: 1.2, s: lives > 0 ? 'LOST ONE!' : 'TOPPLED!', c: '#ff6b5b', screen: true });
              if (lives <= 0) gameOver();
            }
          }
          // faces: how does this block feel right now?
          var want;
          var off = Math.abs(b.position.x - stage.position.x) > K.stageWidth / 2 + 4 && b.position.y > STAGE_Y - 30;
          if (!pc.landed) want = 'whee';
          else if (off || b.position.y > STAGE_Y + 8 || b.speed > 3.5) want = 'panic';
          else if (b.speed > 0.7 || Math.abs(b.angularVelocity) > 0.025) want = 'worried';
          else want = 'happy';
          if (want !== pc.mood) { pc.moodT += dt; if (pc.moodT > (want === 'happy' ? 0.5 : 0.12)) { pc.mood = want; pc.moodT = 0; } } else pc.moodT = 0;
        });
        pieces = pieces.filter(function (pc) { return !pc.lost || pc.body.position.y < STAGE_Y + 2000; }).filter(function (pc) { return !pc.lost; });

        if (state === 'play') {
          height = Math.max(0, (STAGE_Y - towerTop()) / S);
          if (height > bestRun) bestRun = height;
          var ms = Math.floor(height / 5) * 5;
          if (ms > milestone) {
            milestone = ms; snd('level');
            floats.push({ x: W / 2, y: H * 0.3, t: 1.5, s: ms + ' BLOCKS TALL!', c: '#ffd23a', screen: true, big: true });
            (K.rewards || []).forEach(function (r) {
              var k = ID + ':' + (r.id || r.height);
              if (ms >= r.height && !OS.flag(k)) { OS.setFlag(k); OS.run(r.action); }
            });
          }
        }
        if (held) held.shown = Math.min(1, held.shown + dt * 5);
        if (state === 'over') overT -= dt;
        floats.forEach(function (f) { f.y -= 24 * dt; f.t -= dt; });
        floats = floats.filter(function (f) { return f.t > 0; });

        // camera keeps the held block near the top and the tower in view
        var want = Math.min(STAGE_Y - H + 90, heldY() - H * 0.18);
        camTop += (want - camTop) * Math.min(1, dt * 3);
      }

      /* ----- draw ----- */
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function text(s, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineJoin = 'round';
        ctx.strokeText(s, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
      }
      function drawWall() {
        if (BG) {
          var s = Math.max(W / BG.naturalWidth, H / BG.naturalHeight);
          ctx.drawImage(BG, (W - BG.naturalWidth * s) / 2, (H - BG.naturalHeight * s) / 2, BG.naturalWidth * s, BG.naturalHeight * s);
          return;
        }
        // comedy club brick wall, scrolling slower than the tower
        ctx.fillStyle = '#2a1414'; ctx.fillRect(0, 0, W, H);
        var off = (-camTop * 0.4) % 28;
        for (var r = -1; r < H / 14 + 2; r++) {
          var y = r * 14 + (off % 14) - 14, row = Math.floor((r * 14 - off) / 14);
          for (var c = -1; c < W / 28 + 1; c++) {
            var x = c * 28 + ((row & 1) ? 14 : 0);
            ctx.fillStyle = ((c * 7 + row * 13) & 3) ? '#4a1f1a' : '#552520';
            ctx.fillRect(x + 1, y + 1, 26, 12);
          }
        }
        // spotlight
        var g = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, H * 0.6);
        g.addColorStop(0, 'rgba(255,240,200,.22)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      function face(pc, x, y, ang) {
        // eye slot + mouth hole cut in the mask. Every mood is some flavor of mad.
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.12, 1.12);
        var m = pc.mood, mask = pc.color, panic = m === 'panic';
        var blink = pc.blink < 0 && !panic && m !== 'whee';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // eye slot
        ctx.fillStyle = SKIN;
        ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, -7); ctx.arc(7, -4, 3, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-7, -1); ctx.arc(-7, -4, 3, Math.PI / 2, Math.PI * 1.5); ctx.fill();
        // eyes: glaring inward, or blown wide open when it's going over
        if (blink) {
          ctx.strokeStyle = '#111'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-6, -2.6); ctx.lineTo(-1.6, -2.2); ctx.moveTo(6, -2.6); ctx.lineTo(1.6, -2.2); ctx.stroke();
        } else {
          var er = panic ? 2.7 : 2.3;
          ctx.fillStyle = panic ? '#fff' : '#fff1e6';
          ctx.beginPath(); ctx.arc(-3.7, -3.4, er, 0, 7); ctx.arc(3.7, -3.4, er, 0, 7); ctx.fill();
          ctx.fillStyle = panic ? '#111' : '#b3121b';                                  // red irises when calm and mean
          var pr = panic ? 0.7 : 1.25, px = panic ? 0 : 0.8;
          ctx.beginPath(); ctx.arc(-3.7 + px, -2.9, pr, 0, 7); ctx.arc(3.7 - px, -2.9, pr, 0, 7); ctx.fill();
          if (!panic) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-3.7 + px, -2.9, 0.55, 0, 7); ctx.arc(3.7 - px, -2.9, 0.55, 0, 7); ctx.fill(); }
        }
        // the mask pulls down into a hard V scowl over the eyes (shallower when screaming)
        var vy = panic ? -5 : -2.6, sy = panic ? -6.6 : -5.6;
        ctx.fillStyle = mask;
        ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(10, sy); ctx.lineTo(1, vy); ctx.lineTo(-1, vy); ctx.lineTo(-10, sy); ctx.fill();
        ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-8.4, sy + 0.2); ctx.lineTo(-1, vy); ctx.moveTo(8.4, sy + 0.2); ctx.lineTo(1, vy); ctx.stroke();
        // mouth hole
        ctx.fillStyle = SKIN;
        var mw = panic ? 4.6 : 5.4, mh = panic || m === 'whee' ? 4.2 : 3.2;
        ctx.beginPath(); ctx.ellipse(0, 5, mw, mh, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a0707';
        if (panic || m === 'whee') {
          // yelling: open mouth with fangs
          var oh = panic ? 3.3 : 2.6;
          ctx.beginPath(); ctx.ellipse(0, 5.2, panic ? 3.2 : 3.8, oh, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-2.6, 5.2 - oh + 0.4); ctx.lineTo(-1.6, 5.2 - oh + 2.4); ctx.lineTo(-0.7, 5.2 - oh + 0.3); ctx.fill();
          ctx.beginPath(); ctx.moveTo(2.6, 5.2 - oh + 0.4); ctx.lineTo(1.6, 5.2 - oh + 2.4); ctx.lineTo(0.7, 5.2 - oh + 0.3); ctx.fill();
          if (panic) { ctx.beginPath(); ctx.moveTo(-1.6, 5.2 + oh - 0.3); ctx.lineTo(-0.9, 5.2 + oh - 1.9); ctx.lineTo(-0.2, 5.2 + oh - 0.2); ctx.fill();
                       ctx.beginPath(); ctx.moveTo(1.6, 5.2 + oh - 0.3); ctx.lineTo(0.9, 5.2 + oh - 1.9); ctx.lineTo(0.2, 5.2 + oh - 0.2); ctx.fill(); }
        } else {
          // gritted teeth in a sneer (one side curls up)
          ctx.beginPath(); ctx.moveTo(-4, 6); ctx.quadraticCurveTo(-1, 2.8, 4.2, 3.6); ctx.lineTo(4, 6.4); ctx.quadraticCurveTo(0, 7.6, -4, 6); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-3.2, 5.6); ctx.quadraticCurveTo(-0.8, 3.6, 3.6, 4.2); ctx.lineTo(3.5, 5.8); ctx.quadraticCurveTo(0, 6.8, -3.2, 5.6); ctx.fill();
          ctx.strokeStyle = '#7d6a60'; ctx.lineWidth = 0.4;
          ctx.beginPath(); ctx.moveTo(-3, 5.3); ctx.quadraticCurveTo(0, 4.6, 3.5, 5);
          for (var t = -2; t <= 3; t += 1.25) { ctx.moveTo(t, 3.9); ctx.lineTo(t, 6.6); }
          ctx.stroke();
        }
        if (m === 'worried') {
          // straining: sweat + a throbbing vein on the mask
          ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.moveTo(-9, -1); ctx.quadraticCurveTo(-7.4, 2, -9, 2.8); ctx.quadraticCurveTo(-10.6, 2, -9, -1); ctx.fill();
          var pz = 1 + Math.sin(clock * 12) * 0.18;
          ctx.save(); ctx.translate(6.5, -8.5); ctx.scale(pz, pz); ctx.strokeStyle = '#ff2a1f'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-2.2, -0.7); ctx.quadraticCurveTo(-0.7, -0.7, -0.7, -2.2); ctx.moveTo(0.7, -2.2); ctx.quadraticCurveTo(0.7, -0.7, 2.2, -0.7);
          ctx.moveTo(2.2, 0.7); ctx.quadraticCurveTo(0.7, 0.7, 0.7, 2.2); ctx.moveTo(-0.7, 2.2); ctx.quadraticCurveTo(-0.7, 0.7, -2.2, 0.7); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
      }
      function drawPiece(pc, x, y, ang, alpha) {
        var b = pc.body, cx = b.position.x, cy = b.position.y;
        ctx.save();
        if (alpha != null) ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        if (pc.squash) ctx.scale(1 + pc.squash * 0.14, 1 - pc.squash * 0.14);
        ctx.rotate(ang);
        var light = shade(pc.color, 1.25), dark = shade(pc.color, 0.55);
        var ca = Math.cos(-b.angle), sa = Math.sin(-b.angle);
        var cells = b.parts.slice(1).map(function (p) { var dx = p.position.x - cx, dy = p.position.y - cy; return [dx * ca - dy * sa, dx * sa + dy * ca]; });
        var pom = [pc.top.x, pc.top.y - S / 2 - 2.6];
        // thick black outline around the whole silhouette (drawn under the fills)
        ctx.fillStyle = '#0b0b0b';
        cells.forEach(function (c) { ctx.fillRect(c[0] - S / 2 - 1.8, c[1] - S / 2 - 1.8, S + 3.6, S + 3.6); });
        ctx.beginPath(); ctx.arc(pom[0], pom[1], 5.2, 0, 7); ctx.fill();
        // chunky knit blocks: lit top, shadowed bottom, ribbed fabric
        cells.forEach(function (c) {
          var lx = c[0], ly = c[1];
          ctx.fillStyle = pc.color; ctx.fillRect(lx - S / 2, ly - S / 2, S, S);
          ctx.fillStyle = light; ctx.fillRect(lx - S / 2, ly - S / 2, S, 2.5);
          ctx.fillStyle = dark; ctx.fillRect(lx - S / 2, ly + S / 2 - 3, S, 3);
          ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1;
          for (var k = -6; k <= 6; k += 3) { ctx.beginPath(); ctx.moveTo(lx + k, ly - S / 2 + 3); ctx.lineTo(lx + k, ly + S / 2 - 3); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8; ctx.strokeRect(lx - S / 2 + 0.4, ly - S / 2 + 0.4, S - 0.8, S - 0.8);
        });
        // pom-pom
        ctx.fillStyle = pc.color; ctx.beginPath(); ctx.arc(pom[0], pom[1], 3.6, 0, 7); ctx.fill();
        ctx.fillStyle = light; ctx.beginPath(); ctx.arc(pom[0] - 1.1, pom[1] - 1.1, 1.3, 0, 7); ctx.fill();
        face(pc, pc.face.x, pc.face.y, 0);
        ctx.restore();
      }
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        drawWall();
        if (!engine) {
          text(state === 'error' ? 'Could not load the physics engine' : 'Loading…', W / 2, H / 2, 14, '#fff');
          return;
        }
        ctx.save(); ctx.translate(0, -camTop);

        // milestone lines every 5 blocks
        ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
        for (var m = 5; m <= Math.max(10, Math.ceil(bestRun / 5) * 5 + 10); m += 5) {
          var my = STAGE_Y - m * S;
          if (my < camTop - 20 || my > camTop + H + 20) continue;
          ctx.strokeStyle = m <= milestone ? 'rgba(143,209,79,.6)' : 'rgba(255,255,255,.35)';
          ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
          ctx.setLineDash([]); text(String(m), W - 6, my - 8, 10, m <= milestone ? '#8fd14f' : 'rgba(255,255,255,.7)', 'right'); ctx.setLineDash([6, 6]);
        }
        ctx.setLineDash([]);
        if (best > 0) {
          var by = STAGE_Y - best * S;
          ctx.strokeStyle = 'rgba(255,210,58,.8)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by); ctx.stroke();
          text('BEST', 6, by - 8, 10, '#ffd23a', 'left');
        }

        // the stage
        var sx = stage.position.x - K.stageWidth / 2;
        ctx.fillStyle = '#1a0d0a'; ctx.fillRect(sx + 8, STAGE_Y + 20, K.stageWidth - 16, 400);
        ctx.fillStyle = '#a0703c'; ctx.fillRect(sx, STAGE_Y, K.stageWidth, 20);
        ctx.fillStyle = '#c48a4c'; ctx.fillRect(sx, STAGE_Y, K.stageWidth, 3);
        ctx.strokeStyle = '#6b4520'; ctx.lineWidth = 1;
        for (var px = sx + 25; px < sx + K.stageWidth; px += 25) { ctx.beginPath(); ctx.moveTo(px, STAGE_Y + 3); ctx.lineTo(px, STAGE_Y + 20); ctx.stroke(); }

        pieces.forEach(function (pc) { drawPiece(pc, pc.body.position.x, pc.body.position.y, pc.body.angle); });

        if (held && state === 'play') {
          var hy = heldY();
          // guide line straight down
          ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(held.x, hy + 30); ctx.lineTo(held.x, STAGE_Y); ctx.stroke(); ctx.setLineDash([]);
          M.Body.setPosition(held.pc.body, { x: held.x, y: hy }); M.Body.setAngle(held.pc.body, held.angle);
          held.pc.mood = 'happy'; held.pc.blink -= 0.016; if (held.pc.blink < -0.12) held.pc.blink = 3;
          var bob = Math.sin(clock * 4) * 2;
          drawPiece(held.pc, held.x, hy + bob, held.angle, 0.4 + held.shown * 0.6);
        }
        ctx.restore();

        floats.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.t * 2); text(f.s, f.x, f.y, f.big ? 20 : 15, f.c || '#fff'); ctx.globalAlpha = 1; });

        // HUD
        if (state !== 'title') {
          text(height.toFixed(1) + ' TALL', 10, 20, 15, '#fff', 'left');
          text('BEST ' + Math.max(best, bestRun).toFixed(1), 10, 38, 11, '#ffd23a', 'left');
          for (var l = 0; l < K.lives; l++) {
            var lx = W - 16 - l * 16;
            ctx.fillStyle = l < lives ? '#e8322e' : 'rgba(255,255,255,.2)';
            ctx.beginPath(); ctx.arc(lx, 18, 6, 0, 7); ctx.fill();
            if (l < lives) { ctx.fillStyle = SKIN; ctx.fillRect(lx - 4, 15.5, 8, 3); }
          }
          if (nextKey && state === 'play') {
            text('NEXT', W - 34, 40, 9, 'rgba(255,255,255,.7)');
            var cells = SHAPES[nextKey], mx = 0, mxy = 0;
            cells.forEach(function (c) { mx = Math.max(mx, c[0]); mxy = Math.max(mxy, c[1]); });
            ctx.fillStyle = MASK[nextKey];
            cells.forEach(function (c) { ctx.fillRect(W - 34 + (c[0] - mx / 2 - 0.5) * 6, 50 + c[1] * 6, 5.5, 5.5); });
          }
          // tilt bubble
          var t = tilt(), bx = W / 2, byy = H - 14;
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx - 40, byy - 5, 80, 10);
          ctx.fillStyle = Math.abs(t) > 0.05 ? '#ffd23a' : 'rgba(255,255,255,.6)';
          ctx.beginPath(); ctx.arc(bx + t * 34, byy, 4, 0, 7); ctx.fill();
        }
        var blinkT = Math.floor(clock * 2) % 2 === 0;
        if (state === 'title') {
          ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
          text(K.name.toUpperCase(), W / 2, H * 0.16, 32, '#fff');
          text('Stack the crew as tall as you can.', W / 2, H * 0.24, 13, '#fff');
          text('Drag to move · tap to spin', W / 2, H * 0.28, 13, '#fff');
          text('drag & let go to drop', W / 2, H * 0.32, 13, '#fff');
          text('Tilt the phone to sway the tower.', W / 2, H * 0.36, 13, '#fff');
          if (blinkT) text('TAP TO START', W / 2, H * 0.46, 22, '#ffd23a');
          if (best) text('BEST  ' + best.toFixed(1) + ' TALL', W / 2, H * 0.52, 13, '#fff');
        } else if (state === 'over') {
          ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
          text('TOPPLED', W / 2, H * 0.3, 30, '#ff6b5b');
          text(bestRun.toFixed(1) + ' BLOCKS TALL', W / 2, H * 0.38, 18, '#fff');
          text('BEST  ' + best.toFixed(1), W / 2, H * 0.44, 13, '#ffd23a');
          if (blinkT && overT <= 0) text('TAP TO PLAY AGAIN', W / 2, H * 0.54, 18, '#ffd23a');
        }
      }

      /* ----- loop ----- */
      var alive = true, last = performance.now();
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.05, (now - last) / 1000); last = now;
        update(dt); draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      loadMatter().then(function (ok) {
        if (!alive) return;
        if (!ok) { state = 'error'; return; }
        setupWorld(); camTop = STAGE_Y - H + 90; state = 'title';
      });

      OS.debugTopple = { get state() { return state; }, get pieces() { return pieces; }, get held() { return held; }, get lives() { return lives; },
        get height() { return height; }, get engine() { return engine; }, start: function () { startGame(); }, drop: dropHeld,
        move: function (x) { if (held) held.x = x; }, spin: function () { if (held) held.angle += Math.PI / 2; }, setTilt: function (t) { keyTilt = t; } };

      return {
        back: function () { if (state === 'play' || state === 'over') { state = 'title'; held = null; return true; } return false; },
        menu: function () { return [{ label: 'Restart', action: function () { if (engine) startGame(); } }, { label: OS.silent ? 'Sound on' : 'Sound off', action: function () { OS.setSilent(!OS.silent); } }]; },
        close: function () {
          alive = false;
          window.removeEventListener('resize', resize);
          window.removeEventListener('deviceorientation', onOrient);
          window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
          if (engine) { M.Engine.clear(engine); M.Composite.clear(engine.world, false); }
        }
      };
    }
  });
})();
