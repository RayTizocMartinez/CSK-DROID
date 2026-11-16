/* =====================================================================
   JAR — the 2010 "drink it" app, as a mason jar.
   Tilt the phone: the liquid stays level. Tip it like you're drinking:
   it pours out of the mouth. Shake: foam. Tap: refill. Empty: burp.

   Everything is drawn in code. Optional sounds: media/games/jar/
   Settings: js/content.js -> games.jar
   Tilt needs HTTPS (GitHub Pages); elsewhere you drag to tilt.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'jar';
  var DIR = 'media/games/jar/';

  var DEFAULTS = {
    name: "Nick's Pee",
    label: 'nicks pee',
    liquidTop: '#d4a10f',       // dark yellow
    liquidBottom: '#8a5f00',
    foam: '#fff2b3',
    drinkSpeed: 0.55,           // how fast it pours out when tipped
    emptyMessage: 'Nick needs a minute.',
    rewards: []                 // [{ count: 3, action: {...} }]  after this many jars finished
  };
  function cfg() {
    var g = (C.games || {})[ID] || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="#000" stroke="#333"/>' +
    '<path d="M15 10h18v4c4 2 5 5 5 9v15c0 2-2 4-4 4H14c-2 0-4-2-4-4V23c0-4 1-7 5-9z" fill="rgba(255,255,255,.12)" stroke="#cfd8dc" stroke-width="1.5"/>' +
    '<path d="M11.5 24h25v14c0 2-1.5 3-3 3H14.5c-1.5 0-3-1-3-3z" fill="#c99a0c"/>' +
    '<rect x="15" y="27" width="18" height="8" rx="1" fill="#efe3c4" stroke="#8a7a50" stroke-width=".6"/>' +
    '<path d="M18 31h12" stroke="#5a3a10" stroke-width="1.2"/>' +
    '<path d="M15 10h18M15 12h18" stroke="#cfd8dc" stroke-width="1"/><path d="M14 18c0 8 0 14 1 20" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none"/></svg>';

  /* ---------- sounds: optional mp3s, otherwise synthesized ---------- */
  var noiseBuf = null;
  function noise(dur, freq, q, vol, when) {
    var ctx = OS.audioCtx(); if (!ctx || OS.silent) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = ctx.currentTime + (when || 0);
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + Math.max(0.04, dur - 0.08)); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function sweep(f0, f1, dur, type, vol) {
    var ctx = OS.audioCtx(); if (!ctx || OS.silent) return;
    var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.linearRampToValueAtTime(0, t + dur);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    o.connect(lp); lp.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var SYN = {
    pour:  function () { noise(1.6, 1400, 0.7, 0.12); },
    drink: function () { sweep(220, 120, 0.16, 'sine', 0.2); noise(0.12, 500, 2, 0.06, 0.02); },
    fizz:  function () { noise(0.9, 5000, 0.5, 0.08); },
    burp:  function () { sweep(110, 70, 0.7, 'sawtooth', 0.22); sweep(140, 85, 0.5, 'square', 0.06); }
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

  /* ---------- polygon helpers (for keeping the liquid's volume right) ---------- */
  function area(poly) {
    var a = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(a / 2);
  }
  // part of the polygon "below" the surface: points whose projection on g is >= s
  function clip(poly, gx, gy, s) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var da = a[0] * gx + a[1] * gy - s, db = b[0] * gx + b[1] * gy - s;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { var t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      var cv = OS.el('canvas', 'game-canvas');
      root.appendChild(cv);
      var ctx = cv.getContext('2d');
      var W = 320, H = 520, J = null;

      /* ----- the jar's shape ----- */
      function buildJar() {
        var cx = W / 2, jw = Math.min(W * 0.66, H * 0.42), bottom = H * 0.84;
        var bodyH = jw * 1.08, shoulder = jw * 0.2, neckH = jw * 0.17, t = 7;
        var L = cx - jw / 2, R = cx + jw / 2, top = bottom - bodyH;
        var nw = jw * 0.8, nL = cx - nw / 2, nR = cx + nw / 2;
        var mouth = top - shoulder - neckH;
        J = { cx: cx, jw: jw, L: L, R: R, bottom: bottom, top: top, shoulder: shoulder, nL: nL, nR: nR, mouth: mouth, neckH: neckH, t: t, r: jw * 0.12 };
        // inside of the glass, as a polygon (clockwise from the top-left of the mouth)
        var p = [], i, q, iL = L + t, iR = R - t, inL = nL + t * 0.8, inR = nR - t * 0.8, ib = bottom - t * 1.6, r = J.r;
        function quad(x0, y0, x1, y1, x2, y2, rev) {
          for (i = 0; i <= 8; i++) { q = rev ? 1 - i / 8 : i / 8; p.push([(1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * x1 + q * q * x2, (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * y1 + q * q * y2]); }
        }
        p.push([inL, mouth]); p.push([inR, mouth]);
        p.push([inR, top - shoulder]);
        quad(inR, top - shoulder, iR, top - shoulder, iR, top);
        for (i = 0; i <= 6; i++) { var a = i / 6 * Math.PI / 2; p.push([iR - r + Math.cos(a) * r, ib - r + Math.sin(a) * r]); }
        for (i = 0; i <= 6; i++) { var b = Math.PI / 2 + i / 6 * Math.PI / 2; p.push([iL + r + Math.cos(b) * r, ib - r + Math.sin(b) * r]); }
        quad(iL, top, iL, top - shoulder, inL, top - shoulder);
        p.push([inL, mouth]);
        p.pop();
        J.poly = p; J.area = area(p);
        J.m1 = [inL, mouth]; J.m2 = [inR, mouth];
      }
      function resize() {
        var cw = root.clientWidth || 320, ch = root.clientHeight || 520;
        W = 320; H = Math.round(W * ch / cw);
        if (H < 440) { H = 440; W = Math.round(H * cw / ch); }
        var pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(cw * pr); cv.height = Math.round(ch * pr);
        buildJar();
      }
      resize();
      window.addEventListener('resize', resize);

      /* ----- state ----- */
      var vol = 0.82;                 // how full (0..1)
      var ang = Math.PI / 2, angV = 0;// direction of gravity on screen (PI/2 = straight down)
      var target = Math.PI / 2, wave = 0, foam = 0.15, clock = 0;
      var pouring = 0, spilling = 0, gulpT = 0, finished = OS.store.get(ID + ':finished', 0), wasEmpty = false;
      var bubbles = [], splash = [];
      var mode = 'wait', permAsked = false, lastSensor = 0;

      /* ----- tilt from the phone's sensors ----- */
      function screenAngle() { return ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180; }
      function onOrient(e) {
        if (e.beta == null || e.gamma == null) return;
        lastSensor = Date.now();
        if (mode !== 'tilt') { mode = 'tilt'; }
        var b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
        // gravity in device coordinates (x right, y up the screen)
        var gx = Math.sin(g) * Math.cos(b), gy = -Math.sin(b);
        var a = screenAngle(), sx = gx * Math.cos(a) + gy * Math.sin(a), sy = -gx * Math.sin(a) + gy * Math.cos(a);
        if (Math.hypot(sx, sy) < 0.2) return;           // phone lying flat: keep the last direction
        target = Math.atan2(-sy, sx);                     // canvas y points down
      }
      var lastMag = null;
      function onMotion(e) {
        var a = e.acceleration, mag;
        if (a && a.x != null) mag = Math.hypot(a.x, a.y, a.z);
        else if (e.accelerationIncludingGravity) {
          var g = e.accelerationIncludingGravity, m = Math.hypot(g.x || 0, g.y || 0, g.z || 0);
          mag = lastMag == null ? 0 : Math.abs(m - lastMag) * 2; lastMag = m;
        }
        if (mag > 13) shake(Math.min(1, (mag - 13) / 15));
      }
      window.addEventListener('deviceorientation', onOrient);
      window.addEventListener('devicemotion', onMotion);
      function askPermission() {
        if (permAsked) return;
        permAsked = true;
        try {
          if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().catch(function () {});
            if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().catch(function () {});
          }
        } catch (e) {}
      }
      var started = Date.now();

      /* ----- actions ----- */
      function shake(power) {
        if (vol < 0.03) return;
        if (foam < 0.9) snd('fizz');
        foam = Math.min(1, foam + 0.35 + power * 0.4);
        wave = Math.min(1, wave + 0.6);
        angV += (Math.random() - 0.5) * 6;
        for (var i = 0; i < 25; i++) bubble(true);
      }
      function refill() {
        if (pouring || vol > 0.86) return;
        pouring = 1.6;
        wasEmpty = false;
        snd('pour');
      }

      /* ----- touch: tap = refill, drag = tilt (when no sensors) ----- */
      var drag = null;
      cv.addEventListener('pointerdown', function (e) {
        OS.audioCtx(); askPermission();
        drag = { x: e.clientX, y: e.clientY, moved: false, base: target };
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cv.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 8) drag.moved = true;
        if (drag.moved && mode !== 'tilt') {
          var k = cv.getBoundingClientRect().width / W;
          target = drag.base - (dx / k) * 0.012;           // drag sideways to tip the jar
        }
      });
      function up() {
        if (drag && !drag.moved) refill();
        drag = null;
      }
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', function () { drag = null; });
      function onKey(e) {
        if (mode === 'tilt') return;
        if (e.key === 'ArrowLeft') { target += 0.15; e.preventDefault(); }
        else if (e.key === 'ArrowRight') { target -= 0.15; e.preventDefault(); }
        else if (e.key === 's' || e.key === 'S') shake(0.6);
        else if (e.key === ' ' || e.key === 'Enter') { refill(); e.preventDefault(); }
      }
      document.addEventListener('keydown', onKey);

      /* ----- simulation ----- */
      function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
      function surface() {                 // where the liquid's surface sits for the current tilt + volume
        var gx = Math.cos(ang), gy = Math.sin(ang), p = J.poly, lo = Infinity, hi = -Infinity;
        p.forEach(function (pt) { var d = pt[0] * gx + pt[1] * gy; if (d < lo) lo = d; if (d > hi) hi = d; });
        var want = vol * J.area, a = lo, b = hi;
        for (var i = 0; i < 22; i++) { var m = (a + b) / 2; if (area(clip(p, gx, gy, m)) > want) a = m; else b = m; }
        return { gx: gx, gy: gy, s: (a + b) / 2 };
      }
      function bubble(fromFoam) {
        if (bubbles.length > 70) return;
        var p = J.poly[Math.floor(Math.random() * J.poly.length)];
        bubbles.push({ x: J.cx + (Math.random() - 0.5) * J.jw * 0.8, y: J.bottom - 10 - Math.random() * (fromFoam ? J.jw * 0.8 : 20), r: 0.8 + Math.random() * 2.2, v: 20 + Math.random() * 40 });
      }
      function update(dt) {
        clock += dt;
        if (mode !== 'tilt' && !drag) target += (Math.PI / 2 - target) * Math.min(1, dt * 2.5);   // drag mode: jar settles upright
        if (mode === 'wait' && Date.now() - started > 1800) mode = 'drag';
        // slosh: the liquid swings toward the real gravity direction like a damped spring
        var d = wrap(target - ang);
        angV += d * 60 * dt - angV * 7 * dt;
        ang = wrap(ang + angV * dt);
        wave = Math.max(0, Math.min(1, wave * Math.pow(0.4, dt) + Math.abs(angV) * 0.03 * dt * 10));
        foam = Math.max(0.06, foam - dt * 0.07);

        var S = surface();
        // pour out of the mouth when the surface is above it
        var m1 = J.m1[0] * S.gx + J.m1[1] * S.gy - S.s, m2 = J.m2[0] * S.gx + J.m2[1] * S.gy - S.s;
        var over = Math.max(m1, m2);
        spilling = 0;
        if (over > 0 && vol > 0 && !pouring) {
          spilling = Math.min(1, over / (J.jw * 0.25));
          vol = Math.max(0, vol - spilling * K.drinkSpeed * dt);
          gulpT -= dt;
          if (gulpT <= 0) { snd('drink'); gulpT = 0.38; }
          if (Math.random() < spilling * 0.8) splash.push({ x: over === m1 ? J.m1[0] : J.m2[0], y: J.mouth, vx: S.gx * 160 + (Math.random() - 0.5) * 40, vy: S.gy * 160 + (Math.random() - 0.5) * 40, t: 0.8 });
          if (vol < 0.05 && !wasEmpty) { vol = 0; emptied(); }      // last sip (a little always gets stuck in the corner)
        }
        if (pouring) {
          pouring = Math.max(0, pouring - dt);
          vol = Math.min(0.9, vol + dt * 0.62);
          foam = Math.min(0.8, foam + dt * 0.5);
          if (Math.random() < 0.6) bubble(false);
        }
        if (vol > 0.05 && Math.random() < dt * 6) bubble(false);
        for (var i = bubbles.length - 1; i >= 0; i--) {
          var b = bubbles[i];
          b.x -= S.gx * b.v * dt; b.y -= S.gy * b.v * dt; b.x += Math.sin(clock * 3 + i) * 6 * dt;
          if (b.x * S.gx + b.y * S.gy < S.s - 2 || b.y < J.mouth - 30) bubbles.splice(i, 1);
        }
        for (var j = splash.length - 1; j >= 0; j--) {
          var s = splash[j]; s.vx += Math.cos(target) * 900 * dt; s.vy += Math.sin(target) * 900 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
          if (s.t <= 0 || s.y > H + 20 || s.y < -20 || s.x < -20 || s.x > W + 20) splash.splice(j, 1);
        }
      }
      function emptied() {
        wasEmpty = true;
        finished++;
        OS.store.set(ID + ':finished', finished);
        setTimeout(function () { snd('burp'); }, 350);
        setTimeout(function () { if (alive) OS.toast(K.emptyMessage); }, 900);
        OS.emit('jar-finished', finished);
        (K.rewards || []).forEach(function (r) {
          var k = ID + ':' + (r.id || r.count);
          if (finished >= r.count && !OS.flag(k)) { OS.setFlag(k); OS.run(r.action); }
        });
      }

      /* ----- drawing ----- */
      function jarPath(c) {                 // outside of the glass
        var cx = J.cx, L = J.L, R = J.R, b = J.bottom, top = J.top, r = J.r * 1.3;
        c.beginPath();
        c.moveTo(J.nL, J.mouth);
        c.lineTo(J.nR, J.mouth);
        c.lineTo(J.nR, top - J.shoulder);
        c.quadraticCurveTo(R, top - J.shoulder, R, top);
        c.lineTo(R, b - r); c.quadraticCurveTo(R, b, R - r, b);
        c.lineTo(L + r, b); c.quadraticCurveTo(L, b, L, b - r);
        c.lineTo(L, top);
        c.quadraticCurveTo(L, top - J.shoulder, J.nL, top - J.shoulder);
        c.closePath();
      }
      function innerPath(c) {
        c.beginPath();
        J.poly.forEach(function (p, i) { c[i ? 'lineTo' : 'moveTo'](p[0], p[1]); });
        c.closePath();
      }
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        var S = surface();

        // back of the glass
        ctx.save(); innerPath(ctx); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill(); ctx.restore();

        // the liquid: everything past the surface line, with a wobbly top
        if (vol > 0.001) {
          ctx.save();
          innerPath(ctx); ctx.clip();
          ctx.translate(S.gx * S.s, S.gy * S.s);
          ctx.rotate(ang - Math.PI / 2);                 // now +y points "down" (toward gravity)
          var big = W + H, amp = 2 + wave * 9;
          var lg = ctx.createLinearGradient(0, 0, 0, J.jw * 1.4);
          lg.addColorStop(0, K.liquidTop); lg.addColorStop(1, K.liquidBottom);
          ctx.fillStyle = lg;
          ctx.beginPath(); ctx.moveTo(-big, big);
          for (var x = -big; x <= big; x += 6) ctx.lineTo(x, Math.sin(x * 0.06 + clock * 5) * amp * 0.5 + Math.sin(x * 0.13 - clock * 3) * amp * 0.3);
          ctx.lineTo(big, big); ctx.closePath(); ctx.fill();
          // foam on top
          var fh = 3 + foam * 18;
          ctx.fillStyle = K.foam;
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.moveTo(-big, fh);
          for (var x2 = -big; x2 <= big; x2 += 6) ctx.lineTo(x2, Math.sin(x2 * 0.06 + clock * 5) * amp * 0.5 - 1);
          ctx.lineTo(big, fh); ctx.closePath(); ctx.fill();
          for (var k = -J.jw; k < J.jw; k += 7) {
            var rr = 2 + ((k * 7) % 5 + 5) % 5 * foam;
            ctx.beginPath(); ctx.arc(k + Math.sin(clock + k) * 2, fh * 0.6, rr, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
          // bubbles rising
          ctx.save(); innerPath(ctx); ctx.clip();
          ctx.fillStyle = 'rgba(255,248,200,.55)';
          bubbles.forEach(function (b) { if (b.x * S.gx + b.y * S.gy > S.s) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); } });
          ctx.restore();
        }

        // pour stream (refilling) from above
        if (pouring) {
          ctx.strokeStyle = K.liquidTop; ctx.lineCap = 'round';
          ctx.lineWidth = 6 + Math.sin(clock * 30) * 1.5;
          ctx.beginPath(); ctx.moveTo(J.cx + Math.sin(clock * 9) * 2, -10); ctx.lineTo(J.cx + Math.sin(clock * 7) * 3, J.bottom - J.jw * 0.3); ctx.stroke();
        }
        // spilling out of the mouth
        if (spilling) {
          ctx.fillStyle = K.liquidTop;
          splash.forEach(function (s) { ctx.globalAlpha = Math.min(1, s.t * 2); ctx.beginPath(); ctx.arc(s.x, s.y, 2.5 + spilling * 2.5, 0, 7); ctx.fill(); });
          ctx.globalAlpha = 1;
        }

        // the glass
        jarPath(ctx);
        ctx.lineWidth = J.t; ctx.strokeStyle = 'rgba(200,220,230,.35)'; ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(230,245,255,.75)'; ctx.stroke();
        // thick glass bottom
        ctx.fillStyle = 'rgba(200,220,230,.18)';
        ctx.beginPath(); ctx.ellipse(J.cx, J.bottom - J.t * 0.8, J.jw / 2 - J.t, J.t * 0.9, 0, 0, 7); ctx.fill();
        // screw threads on the neck
        ctx.strokeStyle = 'rgba(220,235,245,.55)'; ctx.lineWidth = 2;
        for (var n = 0; n < 3; n++) {
          var y = J.mouth + J.neckH * (0.25 + n * 0.25);
          ctx.beginPath(); ctx.moveTo(J.nL - 1, y + 2); ctx.quadraticCurveTo(J.cx, y - 3, J.nR + 1, y + 2); ctx.stroke();
        }
        // rim
        ctx.fillStyle = 'rgba(230,245,255,.5)'; ctx.fillRect(J.nL - 1, J.mouth - 2, J.nR - J.nL + 2, 3);
        // shine
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(J.L + J.jw * 0.13, J.top + 8); ctx.lineTo(J.L + J.jw * 0.13, J.bottom - J.jw * 0.22); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.beginPath(); ctx.moveTo(J.R - J.jw * 0.1, J.top + 20); ctx.lineTo(J.R - J.jw * 0.1, J.bottom - J.jw * 0.4); ctx.stroke();

        // the label
        var lw = J.jw * 0.5, lh = J.jw * 0.22, lx = J.cx - lw / 2, ly = (J.top + J.bottom) / 2 - lh / 2 + J.jw * 0.06;
        ctx.save();
        ctx.translate(J.cx, ly + lh / 2); ctx.rotate(-0.025); ctx.translate(-J.cx, -(ly + lh / 2));
        ctx.fillStyle = '#efe3c4'; ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 1;
        ctx.fillRect(lx, ly, lw, lh); ctx.strokeRect(lx, ly, lw, lh);
        ctx.strokeStyle = 'rgba(138,122,80,.5)'; ctx.strokeRect(lx + 3, ly + 3, lw - 6, lh - 6);
        ctx.fillStyle = '#3a2408'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'italic 700 ' + Math.round(lh * 0.42) + 'px Georgia, "Times New Roman", serif';
        ctx.fillText(K.label, J.cx, ly + lh / 2 + 1);
        ctx.restore();

        // hints
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#777'; ctx.font = '12px ' + FONT;
        var hint = mode === 'tilt' ? 'tilt to drink  ·  shake for foam  ·  tap to refill'
                 : mode === 'drag' ? 'drag sideways to tip  ·  tap to refill  ·  S to shake'
                 : 'tap to start';
        ctx.fillText(hint, W / 2, H - 16);
        if (finished) { ctx.fillStyle = '#555'; ctx.fillText('jars finished: ' + finished, W / 2, 18); }
        if (vol < 0.01 && !pouring) {
          ctx.fillStyle = '#d4a10f'; ctx.font = 'bold 18px ' + FONT;
          ctx.fillText('tap to refill', W / 2, J.mouth - 30);
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

      OS.debugJar = { get vol() { return vol; }, get mode() { return mode; }, get finished() { return finished; },
        tilt: function (deg) { target = deg * Math.PI / 180; mode = 'drag'; }, shake: shake, refill: refill };

      return {
        menu: function () {
          return [
            { label: 'Refill', action: refill },
            { label: 'Shake', action: function () { shake(0.7); } },
            { label: OS.silent ? 'Sound on' : 'Sound off', action: function () { OS.setSilent(!OS.silent); } }
          ];
        },
        close: function () {
          alive = false;
          window.removeEventListener('resize', resize);
          window.removeEventListener('deviceorientation', onOrient);
          window.removeEventListener('devicemotion', onMotion);
          document.removeEventListener('keydown', onKey);
        }
      };
    }
  });
})();
