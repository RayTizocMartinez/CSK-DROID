/* =====================================================================
   POD STACK — catch falling pods, stack them high, dodge the trash.
   (in the spirit of the old 2008 "stack the scoops" phone games)

   Sprites + sounds:  media/games/podstack/   (see the README there)
   Tuning + rewards:  js/content.js  ->  games.podstack
   Any sprite or sound that's missing is drawn / synthesized instead.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var DIR = 'media/games/podstack/';

  /* ---------- tuning (anything here can be overridden in content.js) ---------- */
  var DEFAULTS = {
    name: 'Pod Stack',
    lives: 3, maxLives: 5,
    startSpeed: 150,        // fall speed at level 1 (the screen is 320 units wide)
    speedUp: 1.12,          // fall speed multiplier per level
    maxSpeed: 520,
    spawnEvery: 1.0,        // seconds between drops at level 1
    spawnSpeedUp: 0.9,      // drop interval multiplier per level
    minSpawn: 0.35,
    trashChance: 0.2,       // chance a drop is trash at level 1
    trashChanceStep: 0.04,  // added per level
    trashChanceMax: 0.45,
    goldChance: 0.03,       // rare gold pod: +1 life
    podsPerLevel: 12,
    knockOff: 3,            // pods knocked off the stack when you catch trash
    podSpacing: 31,         // how far apart stacked pods sit (pods are 50 tall; smaller = tighter)
    holderSink: 18,         // how far the bottom pod sits down into the holder
    missCostsLife: false,   // true = letting a pod hit the floor costs a life
    colors: ['default'],
    rewards: []
  };
  function cfg() {
    var g = (C.games || {}).podstack || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  /* ---------- sizes in game units ---------- */
  var W = 320;
  var POD_W = 50, POD_H = 50, STEP = 31, SINK = 18;   // square pod art (168x168); STEP/SINK come from content.js
  var TRASH = 46;
  var HOLDER_W = 84, HOLDER_H = 84;          // square holder art (252x252)
  var CATCH = POD_W * 0.62;                   // how far off-center still counts as a catch

  /* ---------- drawer icon ---------- */
  var ICON = '<svg viewBox="0 0 48 48">' +
    '<defs><linearGradient id="g-pod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#bcd0e6"/></linearGradient></defs>' +
    '<rect x="5" y="30" width="38" height="13" rx="5" fill="#7a3fb8" stroke="#2c0f4d"/>' +
    '<rect x="9" y="19" width="30" height="16" rx="7" fill="url(#g-pod)" stroke="#334"/>' +
    '<ellipse cx="18" cy="27" rx="6" ry="5" fill="#ff7a00"/><ellipse cx="30" cy="27" rx="6" ry="5" fill="#ffd23a"/>' +
    '<rect x="11" y="6" width="26" height="16" rx="7" fill="url(#g-pod)" stroke="#334"/>' +
    '<ellipse cx="20" cy="14" rx="6" ry="5" fill="#1f6bff"/><ellipse cx="31" cy="14" rx="5" ry="4.5" fill="#fff" stroke="#9ab"/>' +
    '<ellipse cx="20" cy="9" rx="8" ry="2" fill="#fff" opacity=".7"/></svg>';

  /* ---------- sprite loading ---------- */
  var SPR = {}, loadedOnce = false;
  function spriteNames(K) {
    var n = ['holder', 'background', 'pod', 'pod-default', 'pod-gold', 'trash', 'trash-1', 'trash-2', 'trash-3'];
    K.colors.forEach(function (c) { n.push('pod-' + c); });
    return n;
  }
  function loadSprites(K) {
    if (loadedOnce) return;
    loadedOnce = true;
    spriteNames(K).forEach(function (name) {
      if (SPR[name] !== undefined) return;
      SPR[name] = null;
      // try name.png, then name.jpg, then name.jpeg
      var exts = ['.png', '.jpg', '.jpeg'], k = 0;
      var im = new Image();
      im.onload = function () { SPR[name] = im; if ((name === 'pod' || name === 'pod-default') && !SPR['pod-gold-auto']) makeGold(im); };
      im.onerror = function () { if (++k < exts.length) im.src = OS.url(DIR + name + exts[k]); };
      im.src = OS.url(DIR + name + exts[0]);
    });
  }

  // no pod-gold.png? make one by tinting pod-default.png gold
  function makeGold(im) {
    var c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(255, 196, 0, .55)';
    x.fillRect(0, 0, c.width, c.height);
    SPR['pod-gold-auto'] = c;
  }
  // which picture to use for a pod of this color
  function podSprite(color) {
    if (SPR['pod-' + color]) return SPR['pod-' + color];
    if (color === 'gold') return SPR['pod-gold-auto'] || null;
    return SPR.pod || SPR['pod-default'] || null;
  }

  /* ---------- sounds ---------- */
  var SND = {}, sndMissing = {};
  var SYN = {
    catch: function () { OS.beep(700, 0.05, 0, 0.08); OS.beep(1050, 0.07, 0.05, 0.08); },
    combo: function () { [784, 988, 1175, 1568].forEach(function (f, i) { OS.beep(f, 0.08, i * 0.07, 0.08); }); },
    trash: function () { OS.beep([98, 104], 0.3, 0, 0.18); OS.beep(70, 0.25, 0.12, 0.15); },
    gold:  function () { [1046, 1318, 1568, 2093].forEach(function (f, i) { OS.beep(f, 0.09, i * 0.05, 0.07); }); },
    level: function () { [523, 659, 784, 1046].forEach(function (f, i) { OS.beep(f, 0.1, i * 0.09, 0.08); }); },
    over:  function () { [523, 440, 349, 262].forEach(function (f, i) { OS.beep(f, 0.22, i * 0.2, 0.1); }); },
    start: function () { OS.beep(880, 0.08, 0, 0.07); OS.beep(1320, 0.12, 0.09, 0.07); }
  };
  function snd(n) {
    if (OS.silent) return;
    if (sndMissing[n]) { if (SYN[n]) SYN[n](); return; }
    if (!SND[n]) {
      SND[n] = new Audio(OS.url(DIR + n + '.mp3'));
      SND[n].preload = 'auto';
      SND[n].onerror = function () { sndMissing[n] = true; };
    }
    var a = SND[n].cloneNode();
    a.onerror = function () { sndMissing[n] = true; if (SYN[n]) SYN[n](); };
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  }

  /* ---------- placeholder art (used until your PNGs exist) ---------- */
  var POD_PAL = {
    default: ['#1f6bff', '#ff7a00'], blue: ['#1f6bff', '#ffffff'], orange: ['#ff7a00', '#ffd23a'], green: ['#16b04a', '#9df0ff'],
    purple: ['#8a3fff', '#ff6ad5'], red: ['#ff2a2a', '#ffb0b0'], gold: ['#ffc400', '#fff3a0']
  };
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return 'hsl(' + h + ',85%,50%)'; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fbPod(ctx, color, w, h) {
    h = h * 0.72;
    var pal = POD_PAL[color] || [hue(color), '#ffffff'];
    rr(ctx, -w / 2, -h / 2, w, h, h * 0.45);
    var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, color === 'gold' ? '#fff6c0' : '#ffffff'); g.addColorStop(1, color === 'gold' ? '#e0a800' : '#b9cbe0');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(20,30,50,.55)'; ctx.stroke();
    ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.ellipse(-w * 0.17, h * 0.06, w * 0.19, h * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.ellipse(w * 0.19, h * 0.06, w * 0.17, h * 0.28, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-w * 0.08, -h * 0.3, w * 0.28, h * 0.09, 0, 0, 7); ctx.fill();
  }
  function fbTrash(ctx, v, w, h) {
    ctx.lineWidth = 2; ctx.strokeStyle = '#1a1a1a';
    if (v === 1) {                       // crumpled paper
      ctx.beginPath();
      var pts = [[-.45, -.1], [-.3, -.42], [0, -.35], [.3, -.45], [.45, -.05], [.35, .35], [.05, .45], [-.35, .4]];
      pts.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](p[0] * w, p[1] * h); });
      ctx.closePath(); ctx.fillStyle = '#d8d2c0'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w * .2, -h * .2); ctx.lineTo(w * .1, 0); ctx.lineTo(-w * .05, h * .25); ctx.moveTo(w * .2, -h * .3); ctx.lineTo(w * .05, -h * .05);
      ctx.lineWidth = 1; ctx.strokeStyle = '#8a8470'; ctx.stroke();
    } else if (v === 2) {                // banana peel
      ctx.fillStyle = '#ffd33a';
      ctx.beginPath(); ctx.moveTo(0, -h * .45);
      ctx.quadraticCurveTo(-w * .55, -h * .1, -w * .45, h * .4); ctx.quadraticCurveTo(-w * .2, h * .05, 0, -h * .05);
      ctx.quadraticCurveTo(w * .2, h * .05, w * .45, h * .4); ctx.quadraticCurveTo(w * .55, -h * .1, 0, -h * .45);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3a12'; ctx.fillRect(-w * .06, -h * .5, w * .12, h * .1);
    } else {                             // crushed soda can
      rr(ctx, -w * .3, -h * .45, w * .6, h * .9, 6);
      var g = ctx.createLinearGradient(-w * .3, 0, w * .3, 0);
      g.addColorStop(0, '#8a0f0f'); g.addColorStop(.4, '#ff3b30'); g.addColorStop(1, '#7a0a0a');
      ctx.fillStyle = g; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8c8c8'; ctx.fillRect(-w * .3, -h * .45, w * .6, h * .12);
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-w * .3, h * .05); ctx.lineTo(0, -h * .05); ctx.lineTo(w * .3, h * .08); ctx.stroke();
    }
  }
  function fbHolder(ctx, w, h) {
    ctx.save(); ctx.translate(0, h * 0.2); h = h * 0.6;
    ctx.beginPath();
    ctx.moveTo(-w * .5, -h * .5); ctx.lineTo(w * .5, -h * .5); ctx.lineTo(w * .4, h * .5); ctx.lineTo(-w * .4, h * .5); ctx.closePath();
    var g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#3d1670'); g.addColorStop(.35, '#9a5ae0'); g.addColorStop(1, '#2c0f4d');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#140626'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5;
    for (var i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * w * .12, -h * .32); ctx.lineTo(i * w * .1, h * .4); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-w * .5, -h * .5, w, h * .14);
    ctx.restore();
  }

  /* ---------- the app ---------- */
  OS.registerApp({
    id: 'podstack', name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      STEP = +K.podSpacing || 31; SINK = K.holderSink == null ? 18 : +K.holderSink;
      loadSprites(K);
      var cv = OS.el('canvas', 'game-canvas');
      root.appendChild(cv);
      var ctx = cv.getContext('2d');
      var H = 480, groundY = 466;

      function resize() {
        var cw = root.clientWidth || 320, ch = root.clientHeight || 480;
        W = 320; H = Math.round(W * ch / cw);
        if (H < 440) { H = 440; W = Math.round(H * cw / ch); }   // wide or square screen: widen the world instead of squashing it
        groundY = H - 12;
        var pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(cw * pr); cv.height = Math.round(ch * pr);
      }
      resize();
      window.addEventListener('resize', resize);

      /* ----- state ----- */
      var state = 'title';                      // title | play | paused | dying | over
      var best = OS.store.get('podstack:best', 0);
      var score, lives, level, caught, run, lastColor, maxStack, newBest;
      var holder = { x: W / 2, tx: W / 2 };
      var stack = [], items = [], debris = [], texts = [];
      var cam = 0, spawnT = 0, shake = 0, flash = 0, overT = 0, clock = 0;
      var music = null;

      function podY(i) { return groundY - HOLDER_H + SINK - POD_H / 2 - i * STEP; }
      function topX() { return stack.length ? stack[stack.length - 1].x : holder.x; }
      function speed() { return Math.min(K.maxSpeed, K.startSpeed * Math.pow(K.speedUp, level - 1)); }
      function interval() { return Math.max(K.minSpawn, K.spawnEvery * Math.pow(K.spawnSpeedUp, level - 1)); }
      function trashChance() { return Math.min(K.trashChanceMax, K.trashChance + K.trashChanceStep * (level - 1)); }

      function reset() {
        score = 0; lives = K.lives; level = 1; caught = 0; run = 0; lastColor = null; maxStack = 0; newBest = false;
        stack = []; items = []; debris = []; texts = [];
        cam = 0; spawnT = 0.8; shake = 0; flash = 0;
        holder.x = holder.tx = W / 2;
      }
      reset();

      function start() {
        reset();
        state = 'play';
        snd('start');
        startMusic();
        OS.emit('game-start:podstack');
      }
      function startMusic() {
        if (OS.silent) return;
        if (!music) {
          music = new Audio(OS.url(DIR + 'music.mp3'));
          music.loop = true; music.volume = 0.45;
          music.onerror = function () { music = false; };
        }
        if (music) { var p = music.play(); if (p && p.catch) p.catch(function () {}); }
      }
      function stopMusic() { if (music) music.pause(); }
      function pause() { if (state !== 'play') return; state = 'paused'; stopMusic(); }
      function resume() { if (state !== 'paused') return; state = 'play'; startMusic(); }

      function addText(s, x, y, opt) {
        opt = opt || {};
        texts.push({ s: s, x: x, y: y, life: 1, big: !!opt.big, color: opt.color || '#fff', screen: !!opt.screen });
      }

      function spawn() {
        var r = Math.random(), kind = 'pod';
        if (r < K.goldChance) kind = 'gold';
        else if (r < K.goldChance + trashChance()) kind = 'trash';
        var drift = level > 2 ? (Math.random() - 0.5) * speed() * 0.3 * Math.min(1, (level - 2) / 3) : 0;
        items.push({
          kind: kind,
          color: kind === 'pod' ? K.colors[Math.floor(Math.random() * K.colors.length)] : kind === 'gold' ? 'gold' : null,
          v: 1 + Math.floor(Math.random() * 3),
          x: 30 + Math.random() * (W - 60), y: -cam - 40, py: -cam - 40,
          vy: speed() * (0.85 + Math.random() * 0.3), vx: drift,
          rot: 0, vr: kind === 'trash' ? (Math.random() - 0.5) * 5 : 0
        });
      }

      function catchItem(it) {
        if (it.kind === 'trash') return hitTrash(it);
        if (it.kind === 'gold') {
          score += 100;
          lives = Math.min(K.maxLives, lives + 1);
          addText('+1 LIFE', topX(), podY(stack.length) - 20, { color: '#ffd23a', big: true });
          snd('gold');
          checkRewards();
          return;
        }
        stack.push({ color: it.color, x: topX() + (it.x - topX()) * 0.5, pop: 1 });
        caught++;
        maxStack = Math.max(maxStack, stack.length);
        run = it.color === lastColor ? run + 1 : 1;
        lastColor = it.color;
        var pts = 10 + stack.length;
        if (run >= 3 && run % 3 === 0) {
          var bonus = 50 * (run / 3);
          pts += bonus;
          addText('COMBO +' + bonus, W / 2, H * 0.3, { big: true, color: '#8fd14f', screen: true });
          snd('combo');
        } else snd('catch');
        score += pts;
        addText('+' + pts, topX() + 30, podY(stack.length - 1) - 10);
        var nl = 1 + Math.floor(caught / K.podsPerLevel);
        if (nl > level) {
          level = nl;
          addText('LEVEL ' + level, W / 2, H * 0.22, { big: true, color: '#ffb02e', screen: true });
          setTimeout(function () { if (state === 'play') snd('level'); }, 150);
          OS.emit('game-level:podstack', level);
        }
        checkRewards();
      }

      function hitTrash(it) {
        lives--;
        run = 0; lastColor = null;
        shake = 0.35; flash = 0.3;
        snd('trash');
        try { if (!OS.silent && navigator.vibrate) navigator.vibrate(120); } catch (e) {}
        debris.push({ kind: 'trash', v: it.v, x: it.x, y: it.y, vx: (Math.random() < 0.5 ? -1 : 1) * 160, vy: -220, rot: it.rot, vr: 9 });
        var n = Math.min(K.knockOff, stack.length);
        for (var i = 0; i < n; i++) {
          var p = stack.pop();
          debris.push({ kind: 'pod', color: p.color, x: p.x, y: podY(stack.length), vx: (Math.random() - 0.5) * 300, vy: -150 - Math.random() * 150, rot: 0, vr: (Math.random() - 0.5) * 12 });
        }
        addText(lives > 0 ? 'TRASH! -1' : 'TRASHED', W / 2, H * 0.38, { big: true, color: '#ff4a3d', screen: true });
        if (lives <= 0) gameOver();
      }

      function gameOver() {
        state = 'dying';
        overT = 1.4;
        while (stack.length) {
          var p = stack.pop();
          debris.push({ kind: 'pod', color: p.color, x: p.x, y: podY(stack.length), vx: (Math.random() - 0.5) * 360, vy: -100 - Math.random() * 260, rot: 0, vr: (Math.random() - 0.5) * 14 });
        }
        stopMusic();
        snd('over');
        if (score > best) { best = score; newBest = true; OS.store.set('podstack:best', best); }
        OS.emit('game-over:podstack', { score: score, best: best, stack: maxStack, level: level });
      }

      function checkRewards() {
        (K.rewards || []).forEach(function (r) {
          var key = 'podstack:' + (r.id || r.score);
          if (score >= r.score && !OS.flag(key)) { OS.setFlag(key); OS.run(r.action); }
        });
      }

      /* ----- input ----- */
      var drag = null, keys = { l: false, r: false };
      function toGame(e) {
        var r = cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
      }
      cv.addEventListener('pointerdown', function (e) {
        OS.audioCtx();
        if (state === 'title' || (state === 'over' && overT <= -0.5)) start();
        else if (state === 'paused') { resume(); return; }
        if (state !== 'play') return;
        var p = toGame(e);
        drag = { sx: p.x, hx: holder.tx };
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cv.addEventListener('pointermove', function (e) {
        if (!drag || state !== 'play') return;
        var p = toGame(e);
        holder.tx = drag.hx + (p.x - drag.sx) * 1.15;
      });
      function endDrag() { drag = null; }
      cv.addEventListener('pointerup', endDrag);
      cv.addEventListener('pointercancel', endDrag);
      function onKey(e) {
        var down = e.type === 'keydown', k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.l = down; e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.r = down; e.preventDefault(); }
        else if (down && (k === ' ' || k === 'Enter')) {
          e.preventDefault();
          if (state === 'title' || (state === 'over' && overT <= -0.5)) start();
          else if (state === 'play') pause(); else if (state === 'paused') resume();
        }
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);
      function onVis() { if (document.hidden) pause(); }
      document.addEventListener('visibilitychange', onVis);

      /* ----- update ----- */
      function update(dt) {
        clock += dt;
        shake = Math.max(0, shake - dt);
        flash = Math.max(0, flash - dt);

        if (state === 'play') {
          if (keys.l) holder.tx -= 340 * dt;
          if (keys.r) holder.tx += 340 * dt;
          holder.tx = Math.max(HOLDER_W / 2, Math.min(W - HOLDER_W / 2, holder.tx));
          spawnT -= dt;
          if (spawnT <= 0) { spawn(); spawnT = interval() * (0.75 + Math.random() * 0.5); }
        }
        if (state === 'play' || state === 'dying') {
          holder.x += (holder.tx - holder.x) * Math.min(1, dt * 20);
          // the stack sways: each pod chases the one below it, higher pods lag more
          for (var i = 0; i < stack.length; i++) {
            var p = stack[i], target = i ? stack[i - 1].x : holder.x;
            p.x += (target - p.x) * Math.min(1, dt * Math.max(7, 26 - i * 0.8));
            var lim = POD_W * 0.42;
            if (p.x - target > lim) p.x = target + lim; else if (target - p.x > lim) p.x = target - lim;
            p.pop = Math.max(0, p.pop - dt * 4);
          }
          var land = podY(stack.length), tx = topX();
          for (var j = items.length - 1; j >= 0; j--) {
            var it = items[j];
            it.py = it.y;
            it.y += it.vy * dt; it.x += it.vx * dt; it.rot += it.vr * dt;
            if (it.x < 24 || it.x > W - 24) { it.vx = -it.vx; it.x = Math.max(24, Math.min(W - 24, it.x)); }
            if (state === 'play' && !it.missed && it.py < land && it.y >= land) {
              if (Math.abs(it.x - tx) < CATCH) { items.splice(j, 1); catchItem(it); land = podY(stack.length); tx = topX(); continue; }
              it.missed = true;
              if (it.kind === 'pod') { run = 0; lastColor = null; }   // a dropped pod breaks the combo streak
            }
            if (it.y + cam > H + 60) {
              items.splice(j, 1);
              if (state === 'play' && it.kind === 'pod' && K.missCostsLife) {
                lives--; addText('MISSED -1', W / 2, H * 0.38, { big: true, color: '#ff4a3d', screen: true });
                if (lives <= 0) gameOver();
              }
            }
          }
          var camTarget = Math.max(0, H * 0.45 - podY(stack.length));
          cam += (camTarget - cam) * Math.min(1, dt * 2.5);
        }
        for (var d = debris.length - 1; d >= 0; d--) {
          var b = debris[d];
          b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
          if (b.y + cam > H + 80) debris.splice(d, 1);
        }
        for (var t = texts.length - 1; t >= 0; t--) {
          texts[t].y -= 28 * dt; texts[t].life -= dt * 0.9;
          if (texts[t].life <= 0) texts.splice(t, 1);
        }
        if (state === 'dying' || state === 'over') {
          overT -= dt;
          if (state === 'dying' && overT <= 0) { state = 'over'; items = []; }
        }
      }

      /* ----- draw ----- */
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function sprite(name, x, y, w, h, rot, fb, img) {
        ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
        var im = img || SPR[name];
        if (im) ctx.drawImage(im, -w / 2, -h / 2, w, h); else fb(w, h);
        ctx.restore();
      }
      function drawPod(color, x, y, rot, s) {
        s = s || 1;
        var im = podSprite(color);
        if (color === 'gold' && im) { ctx.save(); ctx.shadowColor = '#ffc400'; ctx.shadowBlur = 14; }
        sprite('pod-' + color, x, y, POD_W * s, POD_H * s, rot, function (w, h) { fbPod(ctx, color, w, h); }, im);
        if (color === 'gold' && im) ctx.restore();
      }
      function drawTrash(v, x, y, rot) {
        sprite('trash-' + v, x, y, TRASH, TRASH, rot, function (w, h) { fbTrash(ctx, v, w, h); }, SPR['trash-' + v] || SPR.trash);
      }
      function text(s, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px ' + FONT;
        ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
        ctx.strokeText(s, x, y);
        ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
      }
      function background() {
        if (SPR.background) {
          var im = SPR.background, s = Math.max(W / im.width, H / im.height);
          ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
          return;
        }
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1a2e'); g.addColorStop(1, '#16324a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // laundromat tiles drifting with the camera
        ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
        var off = (cam * 0.35) % 32;
        for (var y = -32 + off; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (var x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        // row of washing machines on the floor (scrolls away as the stack grows)
        var fy = groundY + cam;
        if (fy - 110 < H) {
          for (var m = 0; m < Math.ceil(W / 78); m++) {
            var mx = 10 + m * 78;
            ctx.fillStyle = '#c9d2dc'; rr(ctx, mx, fy - 104, 70, 104, 6); ctx.fill();
            ctx.fillStyle = '#9aa6b2'; ctx.fillRect(mx, fy - 104, 70, 16);
            ctx.fillStyle = '#2b3a4a'; ctx.beginPath(); ctx.arc(mx + 35, fy - 48, 24, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(120,190,255,.35)'; ctx.beginPath(); ctx.arc(mx + 35, fy - 48, 18, 0, 7); ctx.fill();
          }
          ctx.fillStyle = 'rgba(5,12,20,.55)'; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#0d1824'; ctx.fillRect(0, fy, W, H);
        }
      }
      function hud() {
        text(String(score), 10, 20, 22, '#fff', 'left');
        text('LV ' + level + '  ·  STACK ' + stack.length, 10, 42, 11, '#9fb3c8', 'left');
        for (var i = 0; i < lives; i++) drawPod(K.colors[0], W - 18 - i * 26, 20, 0, 0.42);
      }
      function overlay(lines) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
        lines.forEach(function (l) { if (l) text(l[0], W / 2, l[1], l[2], l[3]); });
      }
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake / 0.35, (Math.random() - 0.5) * 10 * shake / 0.35);
        background();
        // holder + stack
        sprite('holder', holder.x, groundY - HOLDER_H / 2 + cam, HOLDER_W, HOLDER_H, 0, function (w, h) { fbHolder(ctx, w, h); });
        for (var i = 0; i < stack.length; i++) {
          var p = stack[i], below = i ? stack[i - 1].x : holder.x;
          drawPod(p.color, p.x, podY(i) + cam, (p.x - below) / POD_W * 0.5, 1 + p.pop * 0.18);
        }
        items.forEach(function (it) {
          if (it.kind === 'trash') drawTrash(it.v, it.x, it.y + cam, it.rot);
          else drawPod(it.color, it.x, it.y + cam, Math.sin(clock * 3 + it.x) * 0.15, 1);
        });
        debris.forEach(function (b) {
          if (b.kind === 'trash') drawTrash(b.v, b.x, b.y + cam, b.rot); else drawPod(b.color, b.x, b.y + cam, b.rot, 1);
        });
        texts.forEach(function (t) {
          ctx.globalAlpha = Math.min(1, t.life * 2);
          text(t.s, t.x, t.y + (t.screen ? 0 : cam), t.big ? 24 : 14, t.color);
          ctx.globalAlpha = 1;
        });
        ctx.restore();
        if (flash > 0) { ctx.fillStyle = 'rgba(255,40,30,' + (flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
        if (state !== 'title') hud();

        var blink = Math.floor(clock * 2) % 2 === 0;
        if (state === 'title') overlay([
          [K.name.toUpperCase(), H * 0.28, 34, '#ffb02e'],
          ['Drag to move. Stack the pods.', H * 0.4, 14, '#fff'],
          ['Catch trash and your stack falls.', H * 0.45, 14, '#ff8a7a'],
          [K.colors.length > 1 ? '3 of a color in a row = COMBO' : 'Catch 3 in a row = COMBO', H * 0.5, 14, '#8fd14f'],
          blink ? ['TAP TO START', H * 0.64, 22, '#fff'] : null,
          best ? ['BEST  ' + best, H * 0.74, 14, '#9fb3c8'] : null
        ]);
        else if (state === 'paused') overlay([['PAUSED', H * 0.42, 32, '#ffb02e'], ['tap to resume', H * 0.52, 15, '#fff']]);
        else if (state === 'over') overlay([
          ['GAME OVER', H * 0.26, 34, '#ff4a3d'],
          ['SCORE  ' + score, H * 0.38, 22, '#fff'],
          ['TALLEST STACK  ' + maxStack, H * 0.45, 15, '#9fb3c8'],
          [newBest ? 'NEW BEST!' : 'BEST  ' + best, H * 0.52, newBest ? 20 : 15, newBest ? '#8fd14f' : '#9fb3c8'],
          blink && overT <= -0.5 ? ['TAP TO PLAY AGAIN', H * 0.66, 20, '#fff'] : null
        ]);
      }

      /* ----- loop ----- */
      var alive = true, last = performance.now();
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      // handy for testing in the browser console
      OS.debugPodstack = { get state() { return state; }, get stack() { return stack.length; }, get score() { return score; }, get lives() { return lives; },
        drop: function (kind, color) { spawn(); var it = items[items.length - 1]; it.kind = kind || 'pod'; it.color = kind === 'trash' ? null : (color || it.color || 'blue'); it.x = holder.x; it.vx = 0; return it; } };

      return {
        back: function () {
          if (state === 'play') { pause(); return true; }
          return false;
        },
        menu: function () {
          var items2 = [];
          if (state === 'play') items2.push({ label: 'Pause', action: pause });
          if (state === 'paused') items2.push({ label: 'Resume', action: resume });
          items2.push({ label: 'New game', action: start });
          items2.push({ label: OS.silent ? 'Sound on' : 'Sound off', action: function () {
            OS.setSilent(!OS.silent);
            if (OS.silent) stopMusic(); else if (state === 'play') startMusic();
          } });
          return items2;
        },
        close: function () {
          alive = false;
          stopMusic();
          window.removeEventListener('resize', resize);
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('keyup', onKey);
          document.removeEventListener('visibilitychange', onVis);
        }
      };
    }
  });
})();
