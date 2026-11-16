/* =====================================================================
   SLED RIDER — draw lines, hit play, watch a floppy stick figure sled.
   (in the spirit of the 2006 browser toy Line Rider)

   Physics: the rider is 10 points joined by sticks (Verlet). Bindings tie
   him to the sled and snap on a hard hit, so he tumbles off ragdoll-style.
   Lines: blue = ride on it, red = speed boost, green = scenery only.
   Lines are one-sided: you ride the TOP of anything drawn left-to-right.

   Sprite: media/games/sled/head.png (drawn on the stick body's neck)
   Settings: js/content.js -> games.sled
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'sled';
  var DIR = 'media/games/sled/';

  var DEFAULTS = {
    name: 'Line Ryder',
    gravity: 0.175,       // per physics tick (40 ticks a second)
    endurance: 0.3,       // how much the bindings can stretch before he falls off (lower = crashes easier)
    boost: 0.1,           // red line push per tick
    headSize: 9           // head size compared to the 5.5-unit torso
  };
  function cfg() { var g = (C.games || {})[ID] || {}, o = {}, k; for (k in DEFAULTS) o[k] = DEFAULTS[k]; for (k in g) o[k] = g[k]; return o; }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#888"/>' +
    '<path d="M6 18c10 2 16 14 36 18" stroke="#2f6fd0" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M14 23l12 4" stroke="#111" stroke-width="1.6"/><path d="M13 22c0 3 2 4 4 4M26 27c2 0 3 2 2 3" stroke="#111" stroke-width="1.4" fill="none"/>' +
    '<path d="M17 22l1-6M18 16l5 2M17 22l5 2" stroke="#111" stroke-width="1.8" stroke-linecap="round"/><circle cx="18.5" cy="13" r="3" fill="#ffd23a" stroke="#111"/>' +
    '<path d="M30 33c4 1 8 1 11 0" stroke="#e53935" stroke-width="2.5" stroke-linecap="round"/></svg>';

  /* ---------- the rider (positions in world units, sled pointing right) ---------- */
  //            name         x     y    friction
  var PTS = [['peg', 0, 0, 0.8], ['tail', 0, 5, 0], ['nose', 15, 5, 0], ['string', 17.5, 0, 0],
             ['butt', 5, 0, 0.8], ['shoulder', 5, -5.5, 0.8], ['rhand', 11.5, -5, 0.1], ['lhand', 11.5, -5, 0.1],
             ['lfoot', 10, 5, 0], ['rfoot', 10, 5, 0]];
  var P = {}; PTS.forEach(function (p, i) { P[p[0]] = i; });
  var BONES = [  // [a, b, kind]   kind: 0 = rigid, 1 = binding (snaps on crash), 2 = repel (only pushes apart)
    ['peg', 'tail', 0], ['tail', 'nose', 0], ['nose', 'string', 0], ['string', 'peg', 0], ['peg', 'nose', 0], ['string', 'tail', 0],
    ['peg', 'butt', 3], ['tail', 'butt', 3], ['nose', 'butt', 3],     // seat: holds until another binding snaps
    ['shoulder', 'butt', 0], ['shoulder', 'lhand', 0], ['shoulder', 'rhand', 0], ['butt', 'lfoot', 0], ['butt', 'rfoot', 0], ['shoulder', 'rhand', 0],
    ['shoulder', 'peg', 1], ['string', 'lhand', 1], ['string', 'rhand', 1], ['lfoot', 'nose', 1], ['rfoot', 'nose', 1],
    ['shoulder', 'lfoot', 2], ['shoulder', 'rfoot', 2]
  ].map(function (b) { return { a: P[b[0]], b: P[b[1]], kind: b[2], rest: 0 }; });
  (function () { BONES.forEach(function (b) { var A = PTS[b.a], B = PTS[b.b]; b.rest = Math.hypot(A[1] - B[1], A[2] - B[2]); if (b.kind === 2) b.rest *= 0.5; }); })();

  /* ---------- head sprite ---------- */
  var HEAD = null;
  (function () {
    var exts = ['.png', '.jpg'], k = 0, im = new Image();
    im.onload = function () { HEAD = im; };
    im.onerror = function () { if (++k < exts.length) im.src = OS.url(DIR + 'head' + exts[k]); };
    im.src = OS.url(DIR + 'head' + exts[0]);
  })();

  var COLORS = { blue: '#2f6fd0', red: '#e53935', green: '#2e9e3e' };

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      root.classList.add('sled');
      root.innerHTML =
        '<div class="sl-bar top">' +
          '<button data-t="pencil" class="sel" title="Pencil">✎</button><button data-t="line" title="Line">╱</button>' +
          '<button data-t="eraser" title="Eraser">⌫</button><button data-t="flag" title="Start flag">⚑</button><button data-t="hand" title="Move">✋</button>' +
          '<button data-a="undo" title="Undo">↶</button><button data-a="clear" title="Clear all">🗑</button></div>' +
        '<div class="sl-view"><canvas class="sl-canvas"></canvas><div class="sl-msg"></div></div>' +
        '<div class="sl-bar bottom">' +
          '<button data-c="blue" class="sw sel"></button><button data-c="red" class="sw"></button><button data-c="green" class="sw"></button>' +
          '<button data-a="play" class="sl-play">▶ Play</button></div>';
      var view = root.querySelector('.sl-view'), cv = root.querySelector('.sl-canvas'), ctx = cv.getContext('2d'), msg = root.querySelector('.sl-msg');
      root.querySelector('[data-c="blue"]').style.background = COLORS.blue;
      root.querySelector('[data-c="red"]').style.background = COLORS.red;
      root.querySelector('[data-c="green"]').style.background = COLORS.green;

      /* ----- track ----- */
      var lines = [], flag = { x: 0, y: -10 }, undo = [];
      var CELL = 40, grid = {};             // must exist before the first load()
      function mk(ax, ay, bx, by, type) {
        var dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, tx = dx / len, ty = dy / len;
        return { ax: ax, ay: ay, bx: bx, by: by, type: type, len: len, tx: tx, ty: ty, nx: ty, ny: -tx };   // normal = riding side (left of travel)
      }
      function load(t) {
        lines = (t.lines || []).map(function (l) { return mk(l[0], l[1], l[2], l[3], l[4] || 'blue'); });
        flag = t.flag ? { x: t.flag[0], y: t.flag[1] } : { x: 0, y: -10 };
        rebuildGrid();
      }
      function dump() { return { flag: [flag.x, flag.y], lines: lines.map(function (l) { return [Math.round(l.ax * 10) / 10, Math.round(l.ay * 10) / 10, Math.round(l.bx * 10) / 10, Math.round(l.by * 10) / 10, l.type]; }) }; }
      function demo() {
        var L = [], i, x, y, px, py;
        function seg(x0, y0, x1, y1, t) { L.push([x0, y0, x1, y1, t || 'blue']); }
        // smooth drop that levels out (no sharp corners = no crash)
        px = -20; py = 20;
        for (i = 1; i <= 24; i++) { var t = i / 24; x = -20 + t * 300; y = 20 + 110 * (1 - Math.cos(Math.PI * t)) / 2; seg(px, py, x, y); px = x; py = y; }
        seg(px, py, px + 110, py, 'red');                                        // speed strip
        px += 110;
        var y0 = py;
        for (i = 1; i <= 6; i++) { x = px + 12; y = y0 - 0.0035 * Math.pow(i * 12, 2); seg(px, py, x, y); px = x; py = y; }   // little kicker
        // long landing hill, then a runout
        var lx = px + 60, ly = y0 + 10; px = lx; py = ly;
        for (i = 1; i <= 50; i++) { var u = i / 50; x = lx + u * 1100; y = ly + 150 * (1 - Math.cos(Math.PI * u)) / 2; seg(px, py, x, y); px = x; py = y; }
        seg(px, py, px + 500, py);
        seg(lx - 60, ly - 120, lx + 40, ly - 160, 'green');                    // scenery
        seg(lx + 40, ly - 160, lx + 120, ly - 130, 'green');
        return { flag: [0, 0], lines: L };
      }
      var saved = OS.store.get(ID + ':track', null);
      load(saved || demo());
      function persist() { OS.store.set(ID + ':track', dump()); }
      function clearAll() {
        OS.dialog({ title: 'Clear all', text: 'Erase every line?', buttons: [{ label: 'Clear', action: function () { pushUndo(); lines = []; rebuildGrid(); persist(); spawn(); } }, { label: 'Cancel' }] });
      }
      function pushUndo() { undo.push(JSON.stringify(dump())); if (undo.length > 40) undo.shift(); }

      // spatial grid so collisions only test nearby lines (CELL/grid are declared up top)
      function cells(l) {
        var out = [], x0 = Math.floor(Math.min(l.ax, l.bx) / CELL) - 1, x1 = Math.floor(Math.max(l.ax, l.bx) / CELL) + 1;
        var y0 = Math.floor(Math.min(l.ay, l.by) / CELL) - 1, y1 = Math.floor(Math.max(l.ay, l.by) / CELL) + 1;
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) out.push(x + ',' + y);
        return out;
      }
      function rebuildGrid() {
        grid = {};
        lines.forEach(function (l) { if (l.type === 'green') return; cells(l).forEach(function (k) { (grid[k] = grid[k] || []).push(l); }); });
      }

      /* ----- simulation ----- */
      var lastBreak = null, rider = null, playing = false, crashed = false, acc = 0, ticks = 0;
      function spawn() {
        rider = PTS.map(function (p) { var x = flag.x + p[1], y = flag.y + p[2]; return { x: x, y: y, px: x - 0.4, py: y, f: p[3] }; });  // a small push to the right
        BONES.forEach(function (b) { b.broken = false; });
        crashed = false; ticks = 0;
      }
      spawn();
      function step() {
        var g = K.gravity, i, j;
        rider.forEach(function (p) { var vx = p.x - p.px, vy = p.y - p.py; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g; });
        for (j = 0; j < 6; j++) {
          for (i = 0; i < BONES.length; i++) {
            var b = BONES[i]; if (b.broken) continue;
            var A = rider[b.a], B = rider[b.b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.0001;
            if (b.kind === 2 && d >= b.rest) continue;                      // repel bones only push
            var diff = (d - b.rest) / d;
            if (b.kind === 1 && (d - b.rest) / b.rest > K.endurance) { lastBreak = [PTS[b.a][0], PTS[b.b][0], +((d - b.rest) / b.rest).toFixed(2)]; crash(); continue; }   // pulled away from the sled = bail
            A.x += dx * diff * 0.5; A.y += dy * diff * 0.5; B.x -= dx * diff * 0.5; B.y -= dy * diff * 0.5;
          }
          for (i = 0; i < rider.length; i++) collide(rider[i]);
        }
        ticks++;
      }
      function collide(p) {
        var k = Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL), near = grid[k];
        if (!near) return;
        for (var i = 0; i < near.length; i++) {
          var l = near[i], vx = p.x - p.px, vy = p.y - p.py;
          if (vx * l.nx + vy * l.ny > 0) continue;                       // only when moving into the line
          var rx = p.x - l.ax, ry = p.y - l.ay, dist = rx * l.nx + ry * l.ny, along = rx * l.tx + ry * l.ty;
          if (dist > 0 || dist < -10 || along < 0 || along > l.len) continue;
          p.x -= l.nx * dist; p.y -= l.ny * dist;                         // back onto the surface
          var vt = (p.x - p.px) * l.tx + (p.y - p.py) * l.ty;
          var fr = Math.min(Math.abs(vt), p.f * -dist) * (vt > 0 ? 1 : -1); // friction grows with how hard it's pressed in
          p.px += l.tx * fr; p.py += l.ty * fr;
          if (l.type === 'red') { p.px -= l.tx * K.boost; p.py -= l.ty * K.boost; }
        }
      }
      function crash() {
        if (crashed) return;
        crashed = true;
        BONES.forEach(function (b) { if (b.kind === 1 || b.kind === 3) b.broken = true; });
        try { if (!OS.silent) { OS.beep([90, 96], 0.2, 0, 0.18); OS.beep(60, 0.25, 0.08, 0.12); } } catch (e) {}
        OS.emit('sled-crash', ticks);
      }

      /* ----- camera + drawing ----- */
      var W = 0, H = 0, pr = 1, cam = { x: flag.x + 60, y: flag.y + 40, z: 2.2 };
      function resize() { W = view.clientWidth; H = view.clientHeight; pr = (window.devicePixelRatio || 1) * (OS.scale || 1); cv.width = Math.round(W * pr); cv.height = Math.round(H * pr); }
      function sx(x) { return (x - cam.x) * cam.z + W / 2; }
      function sy(y) { return (y - cam.y) * cam.z + H / 2; }
      function wx(x) { return (x - W / 2) / cam.z + cam.x; }
      function wy(y) { return (y - H / 2) / cam.z + cam.y; }
      function draw() {
        ctx.setTransform(pr, 0, 0, pr, 0, 0);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        // faint grid paper
        var gs = 50 * cam.z; if (gs > 18) {
          ctx.strokeStyle = '#eef2f7'; ctx.lineWidth = 1;
          for (var gx = ((W / 2 - cam.x * cam.z) % gs + gs) % gs; gx < W; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
          for (var gy = ((H / 2 - cam.y * cam.z) % gs + gs) % gs; gy < H; gy += gs) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
        }
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.5, 2 * cam.z * 0.6);
        lines.forEach(function (l) {
          ctx.strokeStyle = COLORS[l.type];
          ctx.beginPath(); ctx.moveTo(sx(l.ax), sy(l.ay)); ctx.lineTo(sx(l.bx), sy(l.by)); ctx.stroke();
          if (l.type === 'red' && !playing) {                                   // little arrows show the boost direction
            var mx = sx((l.ax + l.bx) / 2), my = sy((l.ay + l.by) / 2);
            ctx.beginPath(); ctx.moveTo(mx + l.tx * 5, my + l.ty * 5); ctx.lineTo(mx - l.tx * 3 + l.nx * 3, my - l.ty * 3 + l.ny * 3);
            ctx.moveTo(mx + l.tx * 5, my + l.ty * 5); ctx.lineTo(mx - l.tx * 3 - l.nx * 3, my - l.ty * 3 - l.ny * 3); ctx.stroke();
          }
        });
        if (preview) { ctx.strokeStyle = COLORS[color]; ctx.globalAlpha = 0.6; ctx.beginPath(); preview.forEach(function (q, i) { ctx[i ? 'lineTo' : 'moveTo'](sx(q.x), sy(q.y)); }); ctx.stroke(); ctx.globalAlpha = 1; }
        if (!playing) {                                                          // start flag
          var fx = sx(flag.x), fy = sy(flag.y);
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx, fy + 6); ctx.lineTo(fx, fy - 22); ctx.stroke();
          ctx.fillStyle = '#ff9500'; ctx.beginPath(); ctx.moveTo(fx, fy - 22); ctx.lineTo(fx + 14, fy - 17); ctx.lineTo(fx, fy - 12); ctx.fill();
        }
        drawRider();
        if (eraserAt) { ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(eraserAt.x, eraserAt.y, 14, 0, 7); ctx.stroke(); }
      }
      function drawRider() {
        var R = rider, z = cam.z;
        function X(i) { return sx(R[i].x); } function Y(i) { return sy(R[i].y); }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // sled: runner curling up at the nose, a seat post, and the rope
        ctx.strokeStyle = '#7a4a1f'; ctx.lineWidth = Math.max(1.5, 0.9 * z);
        ctx.beginPath(); ctx.moveTo(X(P.tail), Y(P.tail)); ctx.lineTo(X(P.nose), Y(P.nose));
        ctx.quadraticCurveTo(X(P.string) + (X(P.nose) - X(P.tail)) * 0.08, Y(P.string) + (Y(P.nose) - Y(P.string)) * 0.6, X(P.string), Y(P.string)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(P.peg), Y(P.peg)); ctx.lineTo(X(P.tail), Y(P.tail)); ctx.stroke();
        if (!crashed) { ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, 0.35 * z); ctx.beginPath(); ctx.moveTo(X(P.string), Y(P.string)); ctx.lineTo(X(P.lhand), Y(P.lhand)); ctx.stroke(); }
        // the stick body
        ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, 1.1 * z);
        ctx.beginPath();
        ctx.moveTo(X(P.butt), Y(P.butt)); ctx.lineTo(X(P.shoulder), Y(P.shoulder));
        ctx.moveTo(X(P.shoulder), Y(P.shoulder)); ctx.lineTo(X(P.lhand), Y(P.lhand));
        ctx.moveTo(X(P.shoulder), Y(P.shoulder)); ctx.lineTo(X(P.rhand), Y(P.rhand));
        ctx.moveTo(X(P.butt), Y(P.butt)); ctx.lineTo(X(P.lfoot), Y(P.lfoot));
        ctx.moveTo(X(P.butt), Y(P.butt)); ctx.lineTo(X(P.rfoot), Y(P.rfoot));
        ctx.stroke();
        // head on the neck, turned with the torso
        var tx = R[P.shoulder].x - R[P.butt].x, ty = R[P.shoulder].y - R[P.butt].y, tl = Math.hypot(tx, ty) || 1;
        var hs = K.headSize, hx = R[P.shoulder].x + tx / tl * hs * 0.45, hy = R[P.shoulder].y + ty / tl * hs * 0.45;
        ctx.save(); ctx.translate(sx(hx), sy(hy)); ctx.rotate(Math.atan2(ty, tx) + Math.PI / 2);
        var px = hs * z;
        if (HEAD) ctx.drawImage(HEAD, -px / 2, -px / 2, px, px);
        else {
          ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1.5, 0.6 * z);
          ctx.beginPath(); ctx.arc(0, 0, px * 0.42, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px * 0.16, -px * 0.06, px * 0.06, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(px * 0.1, px * 0.12, px * 0.14, 0.2, 1.5); ctx.stroke();
        }
        ctx.restore();
      }

      /* ----- editing: tools, colors, gestures ----- */
      var tool = 'pencil', color = 'blue', preview = null, eraserAt = null, ptrs = {}, gesture = null;
      root.querySelector('.sl-bar.top').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.getAttribute('data-a') === 'clear') { if (!playing) clearAll(); return; }
        if (b.getAttribute('data-a') === 'undo') { if (!playing && undo.length) { load(JSON.parse(undo.pop())); persist(); spawn(); } return; }
        tool = b.getAttribute('data-t');
        Array.prototype.forEach.call(root.querySelectorAll('[data-t]'), function (x) { x.classList.toggle('sel', x === b); });
      });
      root.querySelector('.sl-bar.bottom').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.getAttribute('data-a') === 'play') return playing ? stop() : play();
        color = b.getAttribute('data-c');
        Array.prototype.forEach.call(root.querySelectorAll('[data-c]'), function (x) { x.classList.toggle('sel', x === b); });
        if (tool === 'eraser' || tool === 'hand' || tool === 'flag') root.querySelector('[data-t="pencil"]').click();
      });
      function local(e) { var r = view.getBoundingClientRect(), k = r.width / W; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; }
      function addStroke(pts) {
        if (pts.length < 2) return;
        if (pts[pts.length - 1].x < pts[0].x) pts = pts.slice().reverse();       // always ride the top side
        pushUndo();
        for (var i = 0; i < pts.length - 1; i++) {
          if (Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) < 0.5) continue;
          lines.push(mk(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, color));
        }
        rebuildGrid(); persist();
      }
      function eraseAt(q) {
        var r = 14 / cam.z, before = lines.length;
        lines = lines.filter(function (l) {
          var t = Math.max(0, Math.min(l.len, (q.x - l.ax) * l.tx + (q.y - l.ay) * l.ty));
          return Math.hypot(q.x - (l.ax + l.tx * t), q.y - (l.ay + l.ty * t)) > r;
        });
        if (lines.length !== before) { rebuildGrid(); persist(); }
      }
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        var s = local(e); ptrs[e.pointerId] = s;
        var ids = Object.keys(ptrs);
        if (ids.length === 2) {                                                  // two fingers: pan + zoom
          preview = null; eraserAt = null;
          var a = ptrs[ids[0]], b = ptrs[ids[1]];
          gesture = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, wx: wx((a.x + b.x) / 2), wy: wy((a.y + b.y) / 2) };
          return;
        }
        var w = { x: wx(s.x), y: wy(s.y) };
        if (playing || tool === 'hand') gesture = { mode: 'pan', sx: s.x, sy: s.y, cx: cam.x, cy: cam.y };
        else if (tool === 'pencil') { gesture = { mode: 'pencil' }; preview = [w]; }
        else if (tool === 'line') { gesture = { mode: 'line', a: w }; preview = [w, w]; }
        else if (tool === 'eraser') { gesture = { mode: 'erase' }; pushUndo(); eraserAt = s; eraseAt(w); }
        else if (tool === 'flag') { gesture = { mode: 'flag' }; flag = w; persist(); spawn(); }
      });
      cv.addEventListener('pointermove', function (e) {
        if (!ptrs[e.pointerId]) return;
        var s = local(e); ptrs[e.pointerId] = s;
        if (!gesture) return;
        var w = { x: wx(s.x), y: wy(s.y) };
        if (gesture.mode === 'pinch') {
          var ids = Object.keys(ptrs); if (ids.length < 2) return;
          var a = ptrs[ids[0]], b = ptrs[ids[1]], cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          cam.z = Math.max(0.4, Math.min(8, gesture.z * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d));
          cam.x = gesture.wx - (cx - W / 2) / cam.z; cam.y = gesture.wy - (cy - H / 2) / cam.z;
          follow = false;
        } else if (gesture.mode === 'pan') { cam.x = gesture.cx - (s.x - gesture.sx) / cam.z; cam.y = gesture.cy - (s.y - gesture.sy) / cam.z; follow = false; }
        else if (gesture.mode === 'pencil') { var last = preview[preview.length - 1]; if (Math.hypot(w.x - last.x, w.y - last.y) * cam.z > 5) preview.push(w); }
        else if (gesture.mode === 'line') preview = [gesture.a, w];
        else if (gesture.mode === 'erase') { eraserAt = s; eraseAt(w); }
        else if (gesture.mode === 'flag') { flag = w; spawn(); }
      });
      function up(e) {
        delete ptrs[e.pointerId];
        if (!gesture) return;
        if (gesture.mode === 'pencil' || gesture.mode === 'line') addStroke(preview || []);
        if (gesture.mode === 'flag') persist();
        preview = null; eraserAt = null;
        gesture = Object.keys(ptrs).length ? null : null;
      }
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', function (e) {                               // mouse wheel zoom on desktop
        e.preventDefault();
        var s = local(e), bx = wx(s.x), by = wy(s.y);
        cam.z = Math.max(0.4, Math.min(8, cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        cam.x = bx - (s.x - W / 2) / cam.z; cam.y = by - (s.y - H / 2) / cam.z;
      }, { passive: false });

      /* ----- play / stop ----- */
      var follow = true, editCam = null;
      function play() {
        playing = true; follow = true; editCam = { x: cam.x, y: cam.y, z: cam.z };
        spawn(); acc = 0;
        root.querySelector('.sl-play').textContent = '■ Stop';
        root.classList.add('playing');
        OS.emit('sled-play');
      }
      function stop() {
        playing = false; spawn();
        if (editCam) { cam.x = editCam.x; cam.y = editCam.y; cam.z = editCam.z; }
        root.querySelector('.sl-play').textContent = '▶ Play';
        root.classList.remove('playing');
        msg.textContent = '';
      }

      /* ----- loop: fixed 40 ticks a second, like the original ----- */
      var alive = true, last = performance.now();
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (!W) resize();
        if (playing) {
          acc += dt;
          while (acc >= 1 / 40) { step(); acc -= 1 / 40; }
          if (follow) {
            var c = rider[crashed ? P.butt : P.peg];
            cam.x += (c.x + 20 - cam.x) * Math.min(1, dt * 4); cam.y += (c.y - cam.y) * Math.min(1, dt * 4);
          }
          var v = Math.hypot(rider[P.peg].x - rider[P.peg].px, rider[P.peg].y - rider[P.peg].py) * 40;
          msg.textContent = (crashed ? 'CRASHED · ' : '') + (ticks / 40).toFixed(1) + 's · ' + Math.round(v) + ' u/s';
        }
        draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.addEventListener('resize', resize);
      requestAnimationFrame(resize);

      function slots(save) {
        var items = [1, 2, 3].map(function (n) {
          var t = OS.store.get(ID + ':slot' + n, null);
          return { label: (save ? 'Save to ' : 'Load ') + 'slot ' + n + (t ? '' : ' (empty)'), action: function () {
            if (save) { OS.store.set(ID + ':slot' + n, dump()); OS.toast('Saved to slot ' + n); }
            else if (t) { pushUndo(); load(t); persist(); spawn(); OS.toast('Loaded slot ' + n); }
            else OS.toast('Slot ' + n + ' is empty');
          } };
        });
        OS.listDialog({ title: save ? 'Save track' : 'Load track', items: items });
      }

      OS.debugSled = { get lastBreak() { return lastBreak; }, get rider() { return rider; }, get crashed() { return crashed; }, get ticks() { return ticks; }, get lines() { return lines; },
        play: play, stop: stop, load: function (t) { load(t); spawn(); }, demo: demo, get cam() { return cam; } };

      return {
        back: function () { if (playing) { stop(); return true; } return false; },
        menu: function () {
          return [
            { label: playing ? 'Stop' : 'Play', action: function () { playing ? stop() : play(); } },
            { label: 'Save track', action: function () { slots(true); } },
            { label: 'Load track', action: function () { slots(false); } },
            { label: 'Clear all', action: clearAll },
            { label: 'Demo track', action: function () { pushUndo(); load(demo()); persist(); spawn(); cam.x = 60; cam.y = 40; cam.z = 2.2; } },
            { label: 'Find rider', action: function () { cam.x = flag.x + 30; cam.y = flag.y + 20; } }
          ];
        },
        close: function () { alive = false; window.removeEventListener('resize', resize); persist(); }
      };
    }
  });
})();
