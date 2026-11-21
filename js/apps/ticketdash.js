/* =====================================================================
   OPEN MIC RUN — a low-poly 3D endless runner, in portrait (internal id: ticketdash).
   Bill runs down the street forever grabbing Drink Tickets.
   Swipe left / right to change lanes, up (or tap) to jump, down to slide.
   Every ticket you grab is a Drink Ticket for the CSK TCG / Killmiibos shop.

   Nothing to make: the runner, street and obstacles are all built in code.
   3D library: js/lib/three.min.js (loads only when the game opens)
   Settings: js/content.js -> games.ticketdash
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'ticketdash';
  var DEFAULTS = {
    name: 'Open Mic Run',
    model: 'media/games/ticketdash/runner.glb',   // your runner (if the file isn't there, the built-in guy runs)
    modelHeight: 1.9,      // how tall he stands in the game (the built-in guy is 1.9)
    startSpeed: 13,        // street units a second
    maxSpeed: 34,
    speedUp: 0.22,         // speed added each second
    bodyColor: '#f2c230',  // the runner's suit
    maskColor: '#141414',  // his ski mask
    pomColor: '#ff3b3b',   // the pom-pom on the mask
    signText: 'LOW CLEARANCE',
    rewards: []            // { tickets: 100, action: {...} } best run ever, once
  };
  function cfg() { var g = (C.games || {})[ID] || {}, o = {}, k; for (k in DEFAULTS) o[k] = DEFAULTS[k]; for (k in g) o[k] = g[k]; return o; }

  var ICON = '<svg viewBox="0 0 48 48"><defs><linearGradient id="tdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset=".55" stop-color="#cfeeff"/><stop offset=".56" stop-color="#5a5f6a"/><stop offset="1" stop-color="#3a3e46"/></linearGradient></defs>' +
    '<rect x="4" y="4" width="40" height="40" rx="7" fill="url(#tdg)" stroke="#1f2228"/>' +
    '<path d="M24 26L12 44M24 26l12 18M24 26v18" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>' +
    '<polygon points="20,15 28,15 29,27 19,27" fill="#f2c230" stroke="#7a5a00" stroke-width=".8"/>' +
    '<polygon points="20.5,8.5 27.5,8.5 28.5,14.5 19.5,14.5" fill="#141414"/><circle cx="24" cy="7.4" r="1.9" fill="#ff3b3b"/>' +
    '<path d="M21 27l-3 8M27 27l3 7M20 16l-4 6M28 16l4 5" stroke="#f2c230" stroke-width="3" stroke-linecap="round"/>' +
    '<g transform="rotate(-14 37 13)"><rect x="31" y="9" width="12" height="7" rx="1" fill="#ffd84d" stroke="#8a6a00" stroke-width=".8"/><circle cx="31" cy="12.5" r="1.4" fill="#cfeeff"/><circle cx="43" cy="12.5" r="1.4" fill="#cfeeff"/></g></svg>';

  /* ---------- load the 3D library only when needed ---------- */
  var threeWait = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (threeWait) return threeWait;
    function script(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement('script'); s.src = OS.url(src);
        s.onload = function () { res(); }; s.onerror = function () { rej(new Error(src)); };
        document.head.appendChild(s);
      });
    }
    // three first, then the model loader that plugs into it (the game still works if only the loader fails)
    threeWait = script('js/lib/three.min.js').then(function () { return script('js/lib/GLTFLoader.js').catch(function () {}); })
      .catch(function (e) { threeWait = null; throw e; });
    return threeWait;
  }

  function beep(f, d, w, v) { if (!OS.silent) OS.beep(f, d, w, v); }
  var SFX = {
    ticket: function (n) { beep(1046 + Math.min(12, n % 13) * 45, 0.05, 0, 0.05); },
    jump: function () { beep(392, 0.05, 0, 0.05); beep(587, 0.07, 0.04, 0.05); },
    slide: function () { beep(220, 0.08, 0, 0.05); beep(165, 0.1, 0.05, 0.04); },
    lane: function () { beep(660, 0.025, 0, 0.03); },
    crash: function () { beep([110, 117], 0.25, 0, 0.12); [392, 330, 262, 196].forEach(function (f, i) { beep(f, 0.12, 0.18 + i * 0.1, 0.07); }); },
    start: function () { beep(523, 0.07, 0, 0.06); beep(659, 0.07, 0.08, 0.06); beep(784, 0.12, 0.16, 0.06); }
  };

  var LANES = [-2, 0, 2];

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      root.classList.add('td');
      root.innerHTML = '<div class="td-load">loading…</div>';
      var inst = { alive: true, game: null };
      loadThree().then(function () { if (inst.alive) inst.game = game(root, K); })
        .catch(function () { if (inst.alive) root.innerHTML = '<div class="td-load">Couldn\'t load the game. Check your signal and open it again.</div>'; });
      return {
        back: function () { return inst.game ? inst.game.back() : false; },
        close: function () { inst.alive = false; if (inst.game) inst.game.close(); }
      };
    }
  });

  /* ======================================================================= */
  function game(root, K) {
    var T = window.THREE;
    root.innerHTML =
      '<canvas class="game-canvas td-cv"></canvas>' +
      '<div class="td-hud"><div class="td-tix"><i></i><b>0</b></div><div class="td-m">0 m</div></div>' +
      '<div class="td-over"></div>';
    var cv = root.querySelector('.td-cv'), hudT = root.querySelector('.td-tix b'), hudM = root.querySelector('.td-m'), over = root.querySelector('.td-over');

    /* ---------- renderer, scene, camera ---------- */
    var renderer = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
    var SKY = 0xa9dcff;
    var scene = new T.Scene(); scene.background = new T.Color(SKY); scene.fog = new T.Fog(SKY, 38, 105);
    var cam = new T.PerspectiveCamera(62, 0.56, 0.1, 140);
    scene.add(new T.HemisphereLight(0xffffff, 0x7c8796, 0.95));
    var sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(3, 10, -4); scene.add(sun);
    function resize() {
      var w = root.clientWidth || 320, h = root.clientHeight || 560;
      renderer.setPixelRatio(Math.min(1.5, (window.devicePixelRatio || 1) * (OS.scale || 1)));
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    resize(); window.addEventListener('resize', resize);

    /* ---------- little canvas textures (no image files) ---------- */
    function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; return t; }
    var winTex = canvasTex(32, 32, function (g, w, h) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#5d6f86';
      g.fillRect(4, 5, 9, 9); g.fillRect(19, 5, 9, 9); g.fillRect(4, 19, 9, 9); g.fillRect(19, 19, 9, 9);
    });
    winTex.wrapS = winTex.wrapT = T.RepeatWrapping; winTex.repeat.set(2, 5);
    var stripeTex = canvasTex(64, 8, function (g) { for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#e53030'; g.fillRect(i * 8, 0, 8, 8); } });
    var ticketTex = canvasTex(64, 32, function (g, w, h) {
      g.fillStyle = '#ffd84d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a07800'; g.lineWidth = 2; g.setLineDash([3, 2]); g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#7a5a00'; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DRINK', w / 2, 11); g.fillText('TICKET', w / 2, 22);
    });
    var signTex = canvasTex(128, 32, function (g, w, h) {
      g.fillStyle = '#ffcc00'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
      g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(K.signText).slice(0, 16), w / 2, h / 2 + 1);
    });

    /* ---------- materials ---------- */
    function mat(c, o) { var m = new T.MeshPhongMaterial({ color: c, flatShading: true, shininess: 8 }); if (o) for (var k in o) m[k] = o[k]; return m; }
    var M = {
      road: mat(0x4a4e57), line: mat(0xf4f4f4), walk: mat(0xb9bcc4), curb: mat(0x8e929b),
      body: mat(K.bodyColor, { shininess: 90, specular: new T.Color(0x887744) }), mask: mat(K.maskColor), eye: mat(0xffffff), pom: mat(K.pomColor), shoe: mat(0x222222),
      dumpster: mat(0x2f8f4e), lid: mat(0x23663a), crate: mat(0xb07a3c), pole: mat(0x666a72),
      stripe: mat(0xffffff, { map: stripeTex }), sign: mat(0xffffff, { map: signTex }),
      ticket: new T.MeshBasicMaterial({ map: ticketTex, side: T.DoubleSide }),
      shadow: new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    };
    var BLD = [0xf7b2a6, 0xffe08a, 0x9fd8c8, 0xb8c6ff, 0xf2f2f2, 0xd9a3e8, 0xffc48a].map(function (c) { return mat(c, { map: winTex }); });

    /* ---------- the runner (boxes + one low-poly ball) ---------- */
    function box(w, h, d, m, x, y, z) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x || 0, y || 0, z || 0); return b; }
    function pivot(parent, x, y, z) { var g = new T.Group(); g.position.set(x, y, z || 0); parent.add(g); return g; }
    var R = new T.Group(); scene.add(R);
    var hips = pivot(R, 0, 0.95, 0);
    var upper = pivot(hips, 0, 0, 0);
    upper.add(box(0.56, 0.7, 0.32, M.body, 0, 0.38, 0));
    var head = new T.Mesh(new T.IcosahedronGeometry(0.25, 1), M.mask); head.position.set(0, 0.98, 0); upper.add(head);
    var pom = new T.Mesh(new T.IcosahedronGeometry(0.09, 0), M.pom); pom.position.set(0, 0.27, 0); head.add(pom);
    head.add(box(0.08, 0.06, 0.04, M.eye, -0.08, 0.04, -0.235)); head.add(box(0.08, 0.06, 0.04, M.eye, 0.08, 0.04, -0.235));
    function limb(parent, x, y, upLen, loLen, w, foot) {
      var top = pivot(parent, x, y, 0); top.add(box(w, upLen, w, M.body, 0, -upLen / 2, 0));
      var mid = pivot(top, 0, -upLen, 0); mid.add(box(w * 0.92, loLen, w * 0.92, M.body, 0, -loLen / 2, 0));
      if (foot) mid.add(box(w * 1.05, 0.1, w * 1.6, M.shoe, 0, -loLen, -w * 0.3));
      return { top: top, mid: mid };
    }
    var armL = limb(upper, -0.36, 0.68, 0.36, 0.34, 0.15), armR = limb(upper, 0.36, 0.68, 0.36, 0.34, 0.15);
    var legL = limb(hips, -0.15, 0, 0.47, 0.44, 0.2, true), legR = limb(hips, 0.15, 0, 0.47, 0.44, 0.2, true);
    var shadow = new T.Mesh(new T.CircleGeometry(0.5, 12), M.shadow); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);

    function pose(phase, mode, k) {
      // mode: run / jump / slide / fall / idle
      var s = Math.sin(phase), c = Math.cos(phase);
      var L = { hipsY: 0.95, lean: -0.18, lh: s * 0.95, lk: -Math.max(0, c) * 1.3 - 0.15, rh: -s * 0.95, rk: -Math.max(0, -c) * 1.3 - 0.15,
        la: -s * 0.85, le: 1.3, ra: s * 0.85, re: 1.3, rootX: 0, bob: Math.abs(s) * 0.08 };
      if (mode === 'jump') { L.lh = 1.0; L.lk = -1.5; L.rh = -0.25; L.rk = -0.6; L.la = -2.4; L.ra = -2.2; L.le = 0.3; L.re = 0.3; L.lean = -0.05; L.bob = 0; }
      if (mode === 'slide') { L.hipsY = 0.42; L.lean = 1.15; L.lh = 1.45; L.rh = 1.25; L.lk = -0.1; L.rk = -0.5; L.la = -0.6; L.ra = 0.9; L.le = 0.3; L.re = 0.3; L.bob = 0; }
      if (mode === 'fall') { L.hipsY = 0.18; L.rootX = -1.45; L.lean = 0; L.lh = 0.2; L.rh = -0.2; L.lk = -0.3; L.rk = -0.1; L.la = -2.8; L.ra = -2.6; L.le = 0.2; L.re = 0.2; L.bob = 0; }
      if (mode === 'idle') { var b = Math.sin(phase * 0.5); L.lean = 0; L.lh = L.rh = 0; L.lk = L.rk = 0; L.la = 0.1; L.ra = -0.1; L.le = L.re = 0.25; L.bob = b * 0.02; }
      var a = k == null ? 1 : k;
      function to(o, prop, v) { o[prop] += (v - o[prop]) * a; }
      to(hips.position, 'y', L.hipsY + L.bob); to(upper.rotation, 'x', L.lean); to(R.rotation, 'x', L.rootX);
      to(legL.top.rotation, 'x', L.lh); to(legL.mid.rotation, 'x', L.lk); to(legR.top.rotation, 'x', L.rh); to(legR.mid.rotation, 'x', L.rk);
      to(armL.top.rotation, 'x', L.la); to(armL.mid.rotation, 'x', L.le); to(armR.top.rotation, 'x', L.ra); to(armR.mid.rotation, 'x', L.re);
    }

    /* ---------- your own runner: media/games/ticketdash/runner.glb ----------
       Animations named run (needed), jump, slide, fall, idle (all optional).
       Missing ones are faked by tilting the whole body. */
    var CM = null;
    if (T.GLTFLoader && K.model) new T.GLTFLoader().load(OS.url(K.model), function (gltf) {
      if (!running) return;
      var m = gltf.scene;
      var mixer = new T.AnimationMixer(m), acts = {};
      gltf.animations.forEach(function (c) {
        var n = c.name.toLowerCase();
        ['run', 'jump', 'slide', 'fall', 'idle'].forEach(function (k) { if (!acts[k] && n.indexOf(k) >= 0) acts[k] = mixer.clipAction(c); });
      });
      if (!acts.run && gltf.animations[0]) acts.run = mixer.clipAction(gltf.animations[0]);
      // measure him in his running pose, so the run's own hip offset doesn't push him off his shadow
      if (acts.run) { acts.run.play(); mixer.update(0); }
      m.updateMatrixWorld(true);
      var box = new T.Box3(), wp = new T.Vector3(), bones = 0;
      m.traverse(function (o) { if (o.isBone) { box.expandByPoint(o.getWorldPosition(wp)); bones++; } });
      if (!bones) box.setFromObject(m);
      var size = box.getSize(new T.Vector3()); if (!(size.y > 0)) return;
      var sc = K.modelHeight / size.y;
      m.scale.setScalar(sc);
      m.position.set(-(box.min.x + size.x / 2) * sc, -box.min.y * sc, -(box.min.z + size.z / 2) * sc);
      var turn = new T.Group(); turn.rotation.y = Math.PI; turn.add(m);          // Blender's front faces the camera; turn him to face down the street
      var holder = new T.Group(); holder.add(turn);                                // tilts at his feet for faked moves
      m.traverse(function (o) {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        [].concat(o.material).forEach(function (mt) { if (mt.map) mt.map.encoding = T.LinearEncoding; if ('metalness' in mt) { mt.metalness = 0; mt.roughness = 0.85; } mt.needsUpdate = true; });
      });
      if (acts.run) acts.run.stop();
      ['jump', 'slide', 'fall'].forEach(function (k) { if (acts[k]) { acts[k].setLoop(T.LoopOnce); acts[k].clampWhenFinished = true; } });
      hips.visible = false; R.rotation.x = 0; R.add(holder);
      CM = { holder: holder, turn: turn, mixer: mixer, acts: acts, cur: null };
    }, null, function () { /* no runner.glb: keep the built-in guy */ });
    function poseModel(mode, dt) {
      var want = CM.acts[mode] ? mode : (mode === 'fall' && !CM.acts.fall ? CM.cur : 'run');
      if (want && want !== CM.cur && CM.acts[want]) {
        var a = CM.acts[want]; a.reset(); a.play();
        if (CM.cur && CM.acts[CM.cur]) a.crossFadeFrom(CM.acts[CM.cur], 0.12, false);
        CM.cur = want;
      }
      var faked = !CM.acts[mode], tilt = 0, lift = 0, rate = 1;
      if (mode === 'run') rate = 0.85 + (speed - K.startSpeed) / Math.max(1, K.maxSpeed - K.startSpeed) * 0.75;
      if (mode === 'idle' && faked) rate = 0.45;
      if (mode === 'jump' && faked) { tilt = -0.3; rate = 0.35; }
      if (mode === 'slide' && faked) { tilt = 1.15; lift = 0.05; rate = 0.12; }
      if (mode === 'fall' && faked) { tilt = -1.5; lift = 0.12; rate = 0; }
      var k = Math.min(1, dt * 12);
      CM.holder.rotation.x += (tilt - CM.holder.rotation.x) * k;
      CM.holder.position.y += (lift - CM.holder.position.y) * k;
      CM.mixer.update(dt * rate);
    }

    /* ---------- the street: chunks that leapfrog forward ---------- */
    var CH = 30, NCH = 6, chunks = [];
    var unitBox = new T.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
    for (var ci = 0; ci < NCH; ci++) {
      var g = new T.Group();
      g.add(box(6.4, 0.1, CH, M.road, 0, -0.05, 0));
      [-1, 1].forEach(function (sd) {
        g.add(box(2, 0.25, CH, M.walk, sd * 4.2, 0.075, 0));
        g.add(box(0.2, 0.3, CH, M.curb, sd * 3.2, 0.1, 0));
      });
      for (var li = 0; li < 5; li++) { g.add(box(0.1, 0.02, 2.2, M.line, -1, 0.01, -CH / 2 + 3 + li * 6)); g.add(box(0.1, 0.02, 2.2, M.line, 1, 0.01, -CH / 2 + 3 + li * 6)); }
      g.userData.blds = [];
      [-1, 1].forEach(function (sd) {
        for (var bi = 0; bi < 3; bi++) {
          var b = new T.Mesh(unitBox, BLD[0]); b.position.set(0, 0, -CH / 2 + 5 + bi * 10); b.userData.side = sd; g.add(b); g.userData.blds.push(b);
        }
      });
      g.position.z = -ci * CH; scene.add(g); chunks.push(g);
      dressChunk(g);
    }
    function dressChunk(g) {
      g.userData.blds.forEach(function (b) {
        var w = 4 + Math.random() * 4, h = 5 + Math.random() * 14;
        b.scale.set(w, h, 8 + Math.random() * 2); b.position.x = b.userData.side * (5.4 + w / 2);
        b.material = BLD[Math.floor(Math.random() * BLD.length)];
      });
    }

    /* ---------- obstacles + tickets (pooled) ---------- */
    var pools = {}, live = [];
    function make(type) {
      var g = new T.Group();
      if (type === 'block') {
        if (Math.random() < 0.5) { g.add(box(1.7, 1.9, 2.6, M.dumpster, 0, 0.95, 0)); g.add(box(1.8, 0.12, 2.7, M.lid, 0, 1.96, 0)); }
        else { g.add(box(1.6, 1.0, 1.6, M.crate, 0, 0.5, 0)); g.add(box(1.5, 1.0, 1.5, M.crate, 0, 1.5, 0.1)); g.children[1].rotation.y = 0.3; }
        g.userData.d = 1.35;
      } else if (type === 'barrier') {
        g.add(box(1.8, 0.28, 0.12, M.stripe, 0, 0.72, 0)); g.add(box(1.8, 0.28, 0.12, M.stripe, 0, 0.32, 0));
        g.add(box(0.1, 0.9, 0.5, M.pole, -0.8, 0.45, 0)); g.add(box(0.1, 0.9, 0.5, M.pole, 0.8, 0.45, 0));
        g.userData.d = 0.3;
      } else if (type === 'bar') {
        g.add(box(1.9, 0.55, 0.1, M.sign, 0, 1.4, 0));
        g.add(box(0.1, 1.7, 0.1, M.pole, -0.95, 0.85, 0)); g.add(box(0.1, 1.7, 0.1, M.pole, 0.95, 0.85, 0));
        g.userData.d = 0.3;
      } else if (type === 'ticket') {
        g.add(new T.Mesh(new T.PlaneGeometry(0.8, 0.42), M.ticket));
        g.userData.d = 0.4;
      }
      g.userData.type = type; scene.add(g); return g;
    }
    function get(type, x, y, z) {
      var p = pools[type] || (pools[type] = []), o = p.pop() || make(type);
      o.visible = true; o.position.set(x, y || 0, z); o.rotation.set(0, 0, 0); o.userData.got = false; live.push(o); return o;
    }
    function free(o) { o.visible = false; (pools[o.userData.type] = pools[o.userData.type] || []).push(o); }

    var nextZ, rows;
    function spawnRow(z, early) {
      var lanes = [null, null, null], r = Math.random(), i;
      function one(t) { lanes[Math.floor(Math.random() * 3)] = t; }
      function shuffle(a) { for (var j = a.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)), t = a[j]; a[j] = a[k]; a[k] = t; } return a; }
      if (early || r < 0.28) one(['block', 'barrier', 'bar', 'block'][Math.floor(Math.random() * 4)]);
      else if (r < 0.48) { lanes = shuffle(['block', 'block', null]); }
      else if (r < 0.6) lanes = ['barrier', 'barrier', 'barrier'];
      else if (r < 0.72) lanes = ['bar', 'bar', 'bar'];
      else if (r < 0.88) lanes = shuffle(['block', 'barrier', Math.random() < 0.5 ? 'bar' : null]);
      else lanes = shuffle(['barrier', 'bar', 'block']);
      for (i = 0; i < 3; i++) if (lanes[i]) get(lanes[i], LANES[i], 0, z);
      // tickets lead you to a way through
      var safe = [], pref = [null, 'barrier', 'bar'];
      for (var q = 0; q < pref.length && !safe.length; q++) for (i = 0; i < 3; i++) if (lanes[i] === pref[q]) safe.push(i);
      var lane = safe[Math.floor(Math.random() * safe.length)], kind = lanes[lane];
      if (Math.random() < 0.85) {
        var n = 5, gap = Math.min(2.6, rows.gap / 7);
        for (i = 0; i < n; i++) {
          // over a barrier: an arc you jump through; under a sign: a low line; open lane: a line leading up to the row
          var tz = kind === 'barrier' || kind === 'bar' ? z + (i - 2) * gap : z + (i + 1) * gap, y = 1.0;
          if (kind === 'barrier') y = 1.0 + Math.max(0, 1.1 - Math.abs(i - 2) * 0.45);
          if (kind === 'bar') y = 0.55;
          get('ticket', LANES[lane], y, tz);
        }
      }
    }

    /* ---------- game state ---------- */
    var state = 'title', best = OS.store.get(ID + ':best', { tickets: 0, meters: 0 });
    var P, speed, dist, tix, runT, overT, phase = 0, camShake = 0;
    function reset() {
      live.slice().forEach(free); live = [];
      P = { lane: 1, x: 0, y: 0, vy: 0, z: 0, slideT: 0, air: false, dead: false };
      speed = K.startSpeed; dist = 0; tix = 0; runT = 0;
      rows = { gap: 18 }; nextZ = -40;
      chunks.forEach(function (g, i) { g.position.z = -i * CH + CH / 2 - 8; dressChunk(g); });
      hudT.textContent = '0'; hudM.textContent = '0 m';
    }
    reset();

    function title() {
      state = 'title';
      over.className = 'td-over on low'; root.classList.add('td-title');
      over.innerHTML = '<div class="td-card"><h1>' + OS.esc(K.name) + '</h1>' +
        '<p>Swipe ← → to switch lanes<br>Swipe ↑ or tap to jump · swipe ↓ to slide</p>' +
        '<p class="td-best">Best: <b>' + best.tickets + '</b> tickets · ' + best.meters + ' m</p>' +
        '<p class="td-pay">Every ticket you grab is a Drink Ticket.</p>' +
        '<button class="td-go">RUN</button></div>';
      over.querySelector('.td-go').onclick = function (e) { e.stopPropagation(); start(); };
    }
    function start() {
      reset(); state = 'play'; over.className = 'td-over'; over.innerHTML = ''; root.classList.remove('td-title');
      SFX.start(); OS.emit('game-start:' + ID);
    }
    function crash() {
      if (P.dead) return;
      P.dead = true; state = 'dying'; overT = 1.3; camShake = 0.35; SFX.crash();
      try { navigator.vibrate && navigator.vibrate(120); } catch (e) {}
      var m = Math.floor(dist), newBest = tix > best.tickets || (tix === best.tickets && m > best.meters);
      if (newBest) { best = { tickets: tix, meters: Math.max(m, best.meters) }; OS.store.set(ID + ':best', best); }
      else if (m > best.meters) { best.meters = m; OS.store.set(ID + ':best', best); }
      OS.emit('game-over:' + ID, { tickets: tix, meters: m, best: best.tickets });
      (K.rewards || []).forEach(function (r) {
        var k = ID + ':' + (r.id || r.tickets);
        if (best.tickets >= r.tickets && !OS.flag(k)) { OS.setFlag(k); OS.run(r.action); }
      });
      setTimeout(function () {
        if (state !== 'dying') return;
        state = 'over'; over.className = 'td-over on';
        over.innerHTML = '<div class="td-card"><h2>WIPEOUT</h2>' +
          '<div class="td-big"><i></i>' + tix + '</div><p>' + m + ' m</p>' +
          (newBest && tix ? '<p class="td-new">NEW BEST!</p>' : '<p class="td-best">Best: ' + best.tickets + ' tickets</p>') +
          '<button class="td-go">RUN AGAIN</button></div>';
        over.querySelector('.td-go').onclick = function (e) { e.stopPropagation(); start(); };
      }, 1100);
    }

    /* ---------- input: swipes, taps, keys ---------- */
    function act(a) {
      if (state !== 'play') return;
      if (a === 'left' && P.lane > 0) { P.lane--; SFX.lane(); }
      else if (a === 'right' && P.lane < 2) { P.lane++; SFX.lane(); }
      else if (a === 'up' && !P.air) { P.vy = 9.6; P.air = true; P.slideT = 0; SFX.jump(); }
      else if (a === 'down') { if (P.air) P.vy = -16; P.slideT = 0.62; SFX.slide(); }
    }
    var sx = null, sy = null, swiped = false;
    function down(x, y) { sx = x; sy = y; swiped = false; }
    function move(x, y) {
      if (sx == null || swiped) return;
      var dx = (x - sx) / (OS.scale || 1), dy = (y - sy) / (OS.scale || 1);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
      swiped = true;
      act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
    }
    function up() { if (sx != null && !swiped) act('up'); sx = null; }
    cv.addEventListener('touchstart', function (e) { var t = e.touches[0]; down(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { var t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchend', function (e) { up(); e.preventDefault(); }, { passive: false });
    cv.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); });
    window.addEventListener('mousemove', onMM); window.addEventListener('mouseup', onMU);
    function onMM(e) { if (sx != null) move(e.clientX, e.clientY); }
    function onMU() { if (sx != null) up(); }
    function onKey(e) {
      var m = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ' ': 'up', ArrowDown: 'down', s: 'down' }[e.key];
      if (!m) return;
      if (state === 'title' || state === 'over') { if (m === 'up') start(); return; }
      act(m); e.preventDefault();
    }
    window.addEventListener('keydown', onKey);

    /* ---------- update ---------- */
    var G = 30, HALF_W = 0.42;
    function update(dt) {
      phase += dt * (state === 'play' ? speed * 0.62 : 3);
      if (state === 'play') {
        runT += dt; speed = Math.min(K.maxSpeed, K.startSpeed + runT * K.speedUp);
        rows.gap = Math.max(15, speed * 1.25);
        var dz = speed * dt, prevZ = P.z; P.z -= dz; dist += dz * 0.5;
        // lanes
        P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 14);
        // jump / slide
        if (P.air) { P.vy -= G * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; P.air = false; } }
        if (P.slideT > 0) P.slideT -= dt;
        // spawn ahead
        while (nextZ > P.z - 115) { spawnRow(nextZ, dist < 120); nextZ -= rows.gap * (0.8 + Math.random() * 0.5); }
        // hits
        var sliding = P.slideT > 0 && !P.air, top = P.y + (sliding ? 0.9 : 1.95);
        for (var i = 0; i < live.length; i++) {
          var o = live[i], t = o.userData.type, d = o.userData.d;
          if (o.position.z < P.z - d - 0.3 || o.position.z > prevZ + d + 0.3) continue;      // swept, so nothing gets skipped at top speed
          var dxl = Math.abs(o.position.x - P.x);
          if (t === 'ticket') {
            if (!o.userData.got && dxl < 0.9 && Math.abs(o.position.y - (P.y + (sliding ? 0.5 : 1.0))) < 0.95) { o.userData.got = true; o.visible = false; tix++; hudT.textContent = tix; SFX.ticket(tix); bump(); }
            continue;
          }
          if (dxl > 0.9 + HALF_W - 0.25) continue;
          if (t === 'block') crash();
          else if (t === 'barrier' && P.y < 0.85) crash();
          else if (t === 'bar' && top > 1.1) crash();
          if (P.dead) break;
        }
        hudM.textContent = Math.floor(dist) + ' m';
      } else if (state === 'dying') {
        P.z -= Math.max(0, speed * 0.25) * dt; speed *= Math.pow(0.02, dt);
      }
      // recycle stuff behind the camera
      for (var j = live.length - 1; j >= 0; j--) { if (live[j].position.z > P.z + 9) { free(live[j]); live.splice(j, 1); } }
      chunks.forEach(function (g) { if (g.position.z - CH / 2 > P.z + 12) { g.position.z -= CH * NCH; dressChunk(g); } });
      // spin tickets
      var spin = performance.now() / 300;
      live.forEach(function (o) { if (o.userData.type === 'ticket') o.rotation.y = spin + o.position.z * 0.3; });

      // runner
      R.position.set(P.x, P.y, P.z);
      R.rotation.z = (P.x - LANES[P.lane]) * 0.12;
      var mode = state === 'title' ? 'idle' : P.dead ? 'fall' : P.air ? 'jump' : P.slideT > 0 ? 'slide' : 'run';
      if (CM) poseModel(mode, dt);
      else pose(phase, mode, mode === 'run' ? Math.min(1, dt * 18) : Math.min(1, dt * 12));
      shadow.position.set(P.x, 0.03, P.z); var sc = Math.max(0.4, 1 - P.y * 0.25); shadow.scale.set(sc, sc, sc);

      // camera: behind and above, looking down the street (closer and in front of him on the title screen)
      var tx, ty, tz, lx, ly, lz;
      if (state === 'title') { tx = 0; ty = 1.7; tz = P.z - 4.8; lx = 0; ly = 0.05; lz = P.z; }
      else { tx = P.x * 0.55; ty = 4.1; tz = P.z + 6.4; lx = P.x * 0.35; ly = 1.0; lz = P.z - 7; }
      var ck = Math.min(1, dt * (state === 'title' ? 3 : 7));
      cam.position.x += (tx - cam.position.x) * ck; cam.position.y += (ty - cam.position.y) * ck; cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 12);
      if (camShake > 0) { camShake -= dt; cam.position.x += (Math.random() - 0.5) * camShake; cam.position.y += (Math.random() - 0.5) * camShake; }
      look.x += (lx - look.x) * ck; look.y += (ly - look.y) * ck; look.z = lz;
      cam.lookAt(look);
      sun.position.set(P.x + 3, 10, P.z - 4); sun.target.position.set(P.x, 0, P.z - 8); sun.target.updateMatrixWorld();
    }
    var look = new T.Vector3(0, 1.3, -5);
    cam.position.set(0, 2.2, -4.6);
    var bumpT = 0, hudBox = root.querySelector('.td-tix');
    function bump() { hudBox.classList.remove('pop'); void hudBox.offsetWidth; hudBox.classList.add('pop'); }

    /* ---------- loop ---------- */
    var raf = 0, last = 0, running = true;
    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = t; return; }
      var dt = Math.min(1 / 30, (t - (last || t)) / 1000); last = t;
      update(dt);
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);
    title();

    OS.debugDash = { act: act, start: start, state: function () { return { state: state, tix: tix, dist: dist, speed: speed, P: P, live: live.length }; }, crash: crash, live: function () { return live.filter(function (o) { return o.visible; }).map(function (o) { return { t: o.userData.type, x: o.position.x, y: o.position.y, z: o.position.z }; }); } };
    return {
      back: function () { if (state === 'play') { crash(); return true; } return false; },
      close: function () {
        running = false; cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey);
        window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU);
        scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.isMesh && CM) [].concat(o.material).forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); });
        });
        Object.keys(M).forEach(function (k) { M[k].dispose(); }); BLD.forEach(function (m) { m.dispose(); });
        [winTex, stripeTex, ticketTex, signTex].forEach(function (t) { t.dispose(); });
        renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      }
    };
  }
})();
