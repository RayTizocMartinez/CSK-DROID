/* =====================================================================
   FLAPPY NICK — tap to flap Nick through the storm clouds.

   Sprites + sounds:  media/games/flappynick/   (see the README there)
   Tuning + rewards:  js/content.js  ->  games.flappynick
   Only the two Nick sprites are drawings; everything else is code.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var DIR = 'media/games/flappynick/';
  var ID = 'flappynick';

  var DEFAULTS = {
    name: 'Flappy Nick',
    gravity: 1400,        // pull down (units per second²; the screen is 320 wide)
    flap: 400,            // upward kick per tap
    maxFall: 620,
    speed: 125,           // how fast the clouds scroll at the start
    speedUp: 1.5,         // extra speed per point...
    maxSpeed: 200,        // ...up to this
    gap: 135,             // opening between storm clouds at the start
    gapShrink: 0.8,       // gap gets this much smaller per point...
    minGap: 105,          // ...down to this
    spacing: 185,         // distance between cloud columns
    hitbox: 0.7,          // how much of Nick's sprite counts as a hit (0.7 = middle 70%; lower = more forgiving)
    medals: [10, 20, 30, 50],   // bronze, silver, gold, platinum scores
    rewards: []
  };
  function cfg() {
    var g = (C.games || {})[ID] || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var W = 320, NICK_W = 60, COL_W = 62, FLOOR = 46;   // Nick is 60 wide; height follows the sprite's shape (192x96 -> 60x30)

  var ICON = '<svg viewBox="0 0 48 48">' +
    '<defs><linearGradient id="g-fn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a7bd5"/><stop offset="1" stop-color="#a8dcff"/></linearGradient></defs>' +
    '<rect x="4" y="4" width="40" height="40" rx="8" fill="url(#g-fn)" stroke="#0d2a4d"/>' +
    '<rect x="30" y="4" width="10" height="13" fill="#4a4560"/><circle cx="30" cy="17" r="4" fill="#4a4560"/><circle cx="36" cy="18" r="4.5" fill="#4a4560"/>' +
    '<rect x="30" y="31" width="10" height="13" fill="#4a4560"/><circle cx="31" cy="31" r="4" fill="#4a4560"/><circle cx="37" cy="30" r="4.5" fill="#4a4560"/>' +
    '<path d="M35 19l-2 5h3l-2 5" stroke="#ffe36a" stroke-width="1.4" fill="none"/>' +
    '<circle cx="11" cy="38" r="5" fill="#fff"/><circle cx="18" cy="39" r="6" fill="#fff"/><circle cx="25" cy="40" r="4" fill="#fff"/>' +
    '<circle cx="17" cy="23" r="7" fill="#f2c9a0" stroke="#5a3a20"/><circle cx="19.5" cy="21.5" r="1.4" fill="#222"/>' +
    '<path d="M9 22c-4-5-1-9 3-6" fill="#fff" stroke="#666"/></svg>';

  /* ---------- sprites (png or jpg) ---------- */
  var SPR = {}, loaded = false;
  function loadSprites() {
    if (loaded) return;
    loaded = true;
    ['nick-flap', 'nick-noflap', 'background'].forEach(function (name) {
      var exts = ['.png', '.jpg', '.jpeg'], k = 0, im = new Image();
      im.onload = function () { SPR[name] = im; };
      im.onerror = function () { if (++k < exts.length) im.src = OS.url(DIR + name + exts[k]); };
      im.src = OS.url(DIR + name + exts[0]);
    });
  }

  function nickH() {
    var im = SPR['nick-noflap'] || SPR['nick-flap'];
    return im ? NICK_W * im.naturalHeight / im.naturalWidth : NICK_W / 2;
  }

  /* ---------- sounds ---------- */
  var SND = {}, missing = {};
  var SYN = {
    flap:  function () { OS.beep(520, 0.05, 0, 0.06); OS.beep(780, 0.04, 0.03, 0.04); },
    point: function () { OS.beep(988, 0.07, 0, 0.07); OS.beep(1319, 0.12, 0.07, 0.07); },
    hit:   function () { OS.beep([90, 97], 0.22, 0, 0.18); },
    die:   function () { [440, 370, 311, 262, 196].forEach(function (f, i) { OS.beep(f, 0.12, 0.15 + i * 0.1, 0.08); }); },
    start: function () { OS.beep(660, 0.06, 0, 0.06); OS.beep(990, 0.1, 0.07, 0.06); },
    medal: function () { [784, 988, 1175, 1568].forEach(function (f, i) { OS.beep(f, 0.1, i * 0.08, 0.07); }); }
  };
  function snd(n) {
    if (OS.silent) return;
    if (missing[n]) { if (SYN[n]) SYN[n](); return; }
    if (!SND[n]) { SND[n] = new Audio(OS.url(DIR + n + '.mp3')); SND[n].preload = 'auto'; SND[n].onerror = function () { missing[n] = true; }; }
    var a = SND[n].cloneNode();
    a.onerror = function () { missing[n] = true; if (SYN[n]) SYN[n](); };
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  }

  /* ---------- placeholder Nick (until your sprites exist) ---------- */
  function fbNick(ctx, w, h, flapping) {
    var r = h * 0.5;
    ctx.translate(w * 0.12, 0);
    // wing behind
    ctx.save();
    ctx.translate(-r * 0.7, 0);
    ctx.rotate(flapping ? -0.9 : 0.5);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-r * 0.5, 0, r * 0.75, r * 0.35, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    // head
    ctx.fillStyle = '#f2c9a0'; ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    // hair
    ctx.fillStyle = '#3a2614';
    ctx.beginPath(); ctx.arc(0, -r * 0.15, r, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    // shades
    ctx.fillStyle = '#111'; ctx.fillRect(r * 0.05, -r * 0.25, r * 0.8, r * 0.32);
    ctx.fillStyle = 'rgba(120,200,255,.6)'; ctx.fillRect(r * 0.15, -r * 0.2, r * 0.25, r * 0.08);
    // grin (open when flapping)
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (flapping) { ctx.fillStyle = '#7a1f1f'; ctx.ellipse(r * 0.45, r * 0.42, r * 0.22, r * 0.18, 0, 0, 7); ctx.fill(); }
    else { ctx.arc(r * 0.4, r * 0.25, r * 0.28, 0.3, 1.6); ctx.stroke(); }
  }

  /* ---------- cloud drawing ---------- */
  function puff(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  function softCloud(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();                                   // one path = one fill, so no overlap seams
    ctx.arc(x, y, 14 * s, 0, 7); ctx.moveTo(x + 34 * s, y - 8 * s);
    ctx.arc(x + 16 * s, y - 8 * s, 18 * s, 0, 7); ctx.moveTo(x + 48 * s, y);
    ctx.arc(x + 34 * s, y, 14 * s, 0, 7);
    ctx.rect(x, y, 34 * s, 14 * s);
    ctx.fill('nonzero');
  }
  // a dark storm-cloud column: from y1 to y2, puffy rim on the gap side
  function stormColumn(ctx, x, y1, y2, rimAtBottom, seed, flash) {
    var g = ctx.createLinearGradient(x, 0, x + COL_W, 0);
    g.addColorStop(0, '#3a3650'); g.addColorStop(0.5, '#5b5675'); g.addColorStop(1, '#2e2b40');
    ctx.fillStyle = g;
    ctx.fillRect(x + 4, y1, COL_W - 8, y2 - y1);
    // lumpy sides
    for (var y = y1 + 6; y < y2; y += 22) {
      var o = ((seed * 7 + y) % 5) - 2;
      puff(ctx, x + 6, y, 9 + o);
      puff(ctx, x + COL_W - 6, y + 10, 9 - o);
    }
    // big puffy rim at the opening
    var ry = rimAtBottom ? y2 : y1;
    ctx.fillStyle = '#6a6585';
    puff(ctx, x + 10, ry, 15); puff(ctx, x + COL_W / 2, ry + (rimAtBottom ? 4 : -4), 18); puff(ctx, x + COL_W - 10, ry, 15);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    puff(ctx, x + COL_W / 2 - 6, ry + (rimAtBottom ? -2 : -8), 9);
    // lightning flicker
    if (flash) {
      ctx.strokeStyle = 'rgba(255,236,120,.95)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'miter';
      var lx = x + COL_W / 2, ly = rimAtBottom ? y2 - 60 : y1 + 10;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 7, ly + 18); ctx.lineTo(lx + 3, ly + 18); ctx.lineTo(lx - 5, ly + 40); ctx.stroke();
    }
  }

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      loadSprites();
      var cv = OS.el('canvas', 'game-canvas');
      root.appendChild(cv);
      var ctx = cv.getContext('2d');
      var H = 520, floorY = 474;

      function resize() {
        var cw = root.clientWidth || 320, ch = root.clientHeight || 520;
        W = 320; H = Math.round(W * ch / cw);
        if (H < 440) { H = 440; W = Math.round(H * cw / ch); }   // wide or square screen: widen the world instead of squashing it
        floorY = H - FLOOR;
        var pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(cw * pr); cv.height = Math.round(ch * pr);
      }
      resize();
      window.addEventListener('resize', resize);

      /* ----- state ----- */
      var state = 'title';                 // title | play | paused | dying | over
      var best = OS.store.get(ID + ':best', 0);
      var nick, cols, score, scroll, flapT, overT, shake, flashT, clock = 0, newBest, sky;

      function reset() {
        nick = { x: W * 0.3, y: H * 0.42, vy: 0, rot: 0 };
        cols = []; score = 0; scroll = 0; flapT = 0; overT = 0; shake = 0; flashT = 0; newBest = false;
      }
      reset();
      // background clouds (two parallax layers)
      sky = [];
      for (var i = 0; i < 9; i++) sky.push({ x: Math.random() * (W + 80), y: 30 + Math.random() * 300, s: 0.6 + Math.random() * 0.9, layer: i % 3 ? 0.25 : 0.5 });

      function speed() { return Math.min(K.maxSpeed, K.speed + score * K.speedUp); }
      function gap() { return Math.max(K.minGap, K.gap - score * K.gapShrink); }
      function addCol(x) {
        var g = gap(), margin = 60;
        var top = margin + Math.random() * Math.max(0, floorY - margin * 2 - g);
        cols.push({ x: x, top: top, bot: top + g, passed: false, seed: Math.floor(Math.random() * 100), zap: 0 });
      }

      function start() {
        reset();
        state = 'play';
        addCol(W + 40);
        flap();
        snd('start');
        OS.emit('game-start:' + ID);
      }
      function flap() {
        nick.vy = -K.flap;
        flapT = 0.18;
        snd('flap');
      }
      function pause() { if (state === 'play') state = 'paused'; }
      function resume() { if (state === 'paused') state = 'play'; }

      function die() {
        if (state !== 'play') return;
        state = 'dying';
        shake = 0.35; flashT = 0.25; overT = 1.1;
        snd('hit');
        setTimeout(function () { snd('die'); }, 120);
        try { if (!OS.silent && navigator.vibrate) navigator.vibrate(140); } catch (e) {}
        if (score > best) { best = score; newBest = true; OS.store.set(ID + ':best', best); }
        OS.emit('game-over:' + ID, { score: score, best: best });
      }
      function medal() {
        var m = K.medals || [], name = null;
        ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].forEach(function (n, i) { if (m[i] != null && score >= m[i]) name = n; });
        return name;
      }
      function checkRewards() {
        (K.rewards || []).forEach(function (r) {
          var key = ID + ':' + (r.id || r.score);
          if (score >= r.score && !OS.flag(key)) { OS.setFlag(key); OS.run(r.action); }
        });
      }

      /* ----- input ----- */
      function press() {
        OS.audioCtx();
        if (state === 'title' || (state === 'over' && overT <= -0.6)) start();
        else if (state === 'paused') resume();
        else if (state === 'play') flap();
      }
      cv.addEventListener('pointerdown', function (e) { e.preventDefault(); press(); });
      function onKey(e) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'Enter') {
          e.preventDefault();
          if (!e.repeat) press();
        } else if (e.key === 'p' || e.key === 'P') { if (state === 'play') pause(); else resume(); }
      }
      document.addEventListener('keydown', onKey);
      function onVis() { if (document.hidden) pause(); }
      document.addEventListener('visibilitychange', onVis);

      /* ----- update ----- */
      // box-vs-box: Nick's hit box (center cx,cy, half sizes hw,hh) against a cloud rectangle
      function hitsRect(cx, cy, hw, hh, x, y, w, h) {
        return cx + hw > x && cx - hw < x + w && cy + hh > y && cy - hh < y + h;
      }
      function update(dt) {
        clock += dt;
        shake = Math.max(0, shake - dt);
        flashT = Math.max(0, flashT - dt);
        flapT = Math.max(0, flapT - dt);
        var moving = state === 'play' || state === 'title';
        var sp = state === 'title' ? K.speed * 0.6 : speed();

        if (moving) {
          scroll += sp * dt;
          sky.forEach(function (c) { c.x -= sp * c.layer * dt; if (c.x < -80 * c.s) { c.x = W + 20; c.y = 30 + Math.random() * 300; } });
        }
        if (state === 'title') {
          nick.y = H * 0.42 + Math.sin(clock * 3) * 8;
          nick.rot = 0;
          if (Math.sin(clock * 6) > 0.6) flapT = 0.05;
        }
        if (state === 'play' || state === 'dying') {
          nick.vy = Math.min(K.maxFall, nick.vy + K.gravity * dt);
          nick.y += nick.vy * dt;
          var target = Math.max(-0.45, Math.min(1.35, nick.vy / 520));
          nick.rot += (target - nick.rot) * Math.min(1, dt * (nick.vy < 0 ? 18 : 6));
          var hw = NICK_W / 2 * K.hitbox, hh = nickH() / 2 * K.hitbox;
          if (nick.y < hh) { nick.y = hh; nick.vy = Math.max(0, nick.vy); }
          if (nick.y + hh > floorY) {
            nick.y = floorY - hh;
            if (state === 'play') die();
          }
        }
        if (state === 'play') {
          for (var i = cols.length - 1; i >= 0; i--) {
            var c = cols[i];
            c.x -= sp * dt;
            if (c.zap > 0) c.zap -= dt; else if (Math.random() < dt * 0.25) c.zap = 0.12;
            if (!c.passed && c.x + COL_W < nick.x) {
              c.passed = true; score++; snd('point'); checkRewards();
              var m = K.medals || [];
              if (m.indexOf(score) >= 0) setTimeout(function () { if (state === 'play') snd('medal'); }, 150);
            }
            if (c.x < -COL_W - 20) cols.splice(i, 1);
            if (hitsRect(nick.x, nick.y, hw, hh, c.x + 4, -50, COL_W - 8, c.top + 50) ||
                hitsRect(nick.x, nick.y, hw, hh, c.x + 4, c.bot, COL_W - 8, floorY - c.bot)) die();
          }
          var last = cols[cols.length - 1];
          if (!last || last.x < W + 20 - K.spacing) addCol((last ? last.x : W) + K.spacing);
        }
        if (state === 'dying') {
          overT -= dt;
          if (overT <= 0 && nick.y >= floorY - nickH() / 2 * K.hitbox - 1) state = 'over';
        } else if (state === 'over') overT -= dt;
      }

      /* ----- draw ----- */
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function text(s, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px ' + FONT;
        ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
        ctx.strokeText(s, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
      }
      function background() {
        if (SPR.background) {
          var im = SPR.background, s = Math.max(W / im.width, H / im.height);
          ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
        } else {
          var g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, '#2f6fd0'); g.addColorStop(0.65, '#8fd0ff'); g.addColorStop(1, '#d8f1ff');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
        // far clouds first (pale, slow), near clouds on top (white, faster)
        sky.forEach(function (c) { if (c.layer < 0.3) softCloud(ctx, c.x, c.y, c.s, 'rgba(214,236,255,.9)'); });
        sky.forEach(function (c) { if (c.layer >= 0.3) softCloud(ctx, c.x, c.y, c.s, '#ffffff'); });
      }
      function floor() {
        var off = scroll % 40;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, floorY + 10, W, H);
        for (var x = -off - 20; x < W + 40; x += 40) { puff(ctx, x, floorY + 12, 20); puff(ctx, x + 20, floorY + 6, 16); }
        ctx.fillStyle = 'rgba(160,190,220,.35)';
        for (var x2 = -off; x2 < W + 40; x2 += 40) puff(ctx, x2 + 10, floorY + 30, 12);
      }
      function drawNick() {
        var flapping = flapT > 0;
        ctx.save();
        ctx.translate(nick.x, nick.y);
        ctx.rotate(nick.rot);
        var im = flapping ? (SPR['nick-flap'] || SPR['nick-noflap']) : (SPR['nick-noflap'] || SPR['nick-flap']);
        var h = nickH();
        if (im) ctx.drawImage(im, -NICK_W / 2, -h / 2, NICK_W, h);
        else fbNick(ctx, NICK_W, h, flapping);
        ctx.restore();
      }
      function panel(lines, y, h) {
        ctx.fillStyle = 'rgba(10,20,40,.78)';
        ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 2;
        var x = 30, w = W - 60;
        ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.arcTo(x + w, y, x + w, y + h, 10); ctx.arcTo(x + w, y + h, x, y + h, 10);
        ctx.arcTo(x, y + h, x, y, 10); ctx.arcTo(x, y, x + w, y, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        lines.forEach(function (l) { if (l) text(l[0], l[4] != null ? l[4] : W / 2, l[1], l[2], l[3]); });
      }
      var MEDAL_COL = { BRONZE: '#cd7f32', SILVER: '#d8d8e0', GOLD: '#ffcc33', PLATINUM: '#b8f0ff' };
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake / 0.35, (Math.random() - 0.5) * 12 * shake / 0.35);
        background();
        cols.forEach(function (c) {
          var z = c.zap > 0;
          stormColumn(ctx, c.x, -20, c.top, true, c.seed, z);
          stormColumn(ctx, c.x, c.bot, floorY + 20, false, c.seed + 3, false);
        });
        floor();
        drawNick();
        ctx.restore();
        if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flashT * 2.5) + ')'; ctx.fillRect(0, 0, W, H); }

        var blink = Math.floor(clock * 2) % 2 === 0;
        if (state === 'play' || state === 'paused' || state === 'dying') text(String(score), W / 2, 52, 40, '#fff');
        if (state === 'title') {
          text(K.name.toUpperCase(), W / 2, H * 0.2, 36, '#ffb02e');
          text('Tap to flap. Dodge the storm clouds.', W / 2, H * 0.29, 13, '#fff');
          if (blink) text('TAP TO FLY', W / 2, H * 0.62, 24, '#fff');
          if (best) text('BEST  ' + best, W / 2, H * 0.7, 15, '#fff');
        } else if (state === 'paused') {
          panel([['PAUSED', H * 0.42, 28, '#ffb02e'], ['tap to resume', H * 0.5, 14, '#fff']], H * 0.34, H * 0.2);
        } else if (state === 'over') {
          var md = medal();
          panel([
            ['GAME OVER', H * 0.25, 30, '#ff4a3d'],
            ['SCORE', H * 0.35, 12, '#9fb3c8', W / 2 - 50], [String(score), H * 0.4, 26, '#fff', W / 2 - 50],
            ['BEST', H * 0.35, 12, '#9fb3c8', W / 2 + 50], [String(best), H * 0.4, 26, newBest ? '#8fd14f' : '#fff', W / 2 + 50],
            newBest ? ['NEW BEST!', H * 0.47, 15, '#8fd14f'] : null,
            md ? [md + ' MEDAL', H * 0.53, 16, MEDAL_COL[md]] : ['no medal yet', H * 0.53, 13, '#9fb3c8'],
            blink && overT <= -0.6 ? ['TAP TO FLY AGAIN', H * 0.62, 18, '#fff'] : null
          ], H * 0.18, H * 0.5);
        }
      }

      /* ----- loop ----- */
      var alive = true, last = performance.now();
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.04, (now - last) / 1000);
        last = now;
        update(dt); draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      OS.debugFlappy = { get state() { return state; }, get score() { return score; }, get nick() { return nick; }, get cols() { return cols; } };

      return {
        back: function () { if (state === 'play') { pause(); return true; } return false; },
        menu: function () {
          var m = [];
          if (state === 'play') m.push({ label: 'Pause', action: pause });
          if (state === 'paused') m.push({ label: 'Resume', action: resume });
          m.push({ label: 'New game', action: start });
          m.push({ label: OS.silent ? 'Sound on' : 'Sound off', action: function () { OS.setSilent(!OS.silent); } });
          return m;
        },
        close: function () {
          alive = false;
          window.removeEventListener('resize', resize);
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('visibilitychange', onVis);
        }
      };
    }
  });
})();
