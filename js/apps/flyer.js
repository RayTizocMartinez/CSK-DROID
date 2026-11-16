/* =====================================================================
   FLYER MAKER — pick a background, drop in a pose and a logo, add text,
   save it to the Gallery or download it.

   Art:      media/flyer/BK-1.png ... BK-5.png     backgrounds
             media/flyer/rod-1.png ... rod-5.png   poses
             media/flyer/club-1.png ... club-5.png logos
   Settings: js/content.js -> flyer
   Missing art is drawn as labeled placeholders.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'flyer';
  var DIR = 'media/flyer/';

  var DEFAULTS = {
    name: 'Flyer Maker',
    width: 720, height: 1280,           // flyer size in pixels (9:16 portrait, same as the BK art)
    count: 5,                           // BK-1..5, rod-1..5, club-1..5
    comics: [],                         // quick-add names on the Text tab
    maxSaved: 6                         // flyers kept in the Gallery
  };
  function cfg() {
    var g = C.flyer || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="9" y="4" width="30" height="40" rx="2" fill="#fff" stroke="#333"/>' +
    '<rect x="12" y="7" width="24" height="30" fill="#2a0f45"/><circle cx="24" cy="18" r="5" fill="#ffb02e"/>' +
    '<path d="M17 37c0-7 3-11 7-11s7 4 7 11z" fill="#ff3b5c"/><rect x="13" y="9" width="10" height="3" fill="#8fd14f"/>' +
    '<rect x="13" y="39" width="22" height="2" fill="#333"/>' +
    '<path d="M36 30l7-7 3 3-7 7-4 1z" fill="#ffd23a" stroke="#5a3a00"/></svg>';

  var FONTS = [
    { name: 'Bold', css: '900 {s}px "Droid Sans", Roboto, Arial, sans-serif', upper: true },
    { name: 'Narrow', css: '700 {s}px "Arial Narrow", "Roboto Condensed", sans-serif-condensed, Arial, sans-serif', upper: true },
    { name: 'Type', css: '700 {s}px "Courier New", "Droid Sans Mono", monospace', upper: false }
  ];
  var COLORS = ['#ffffff', '#ffd23a', '#ff9500', '#ff3b30', '#ff6ad5', '#2ee6d6', '#8fd14f', '#000000'];
  var OUTLINES = [null, '#000000', '#ffffff'];

  /* ---------- art ---------- */
  var SPR = {}, requested = {}, onArt = [];
  function load(name) {
    if (requested[name]) return;
    requested[name] = true;
    var exts = ['.png', '.jpg', '.jpeg'], k = 0, im = new Image();
    im.onload = function () { SPR[name] = im; onArt.forEach(function (f) { f(name); }); };
    im.onerror = function () { if (++k < exts.length) im.src = OS.url(DIR + name + exts[k]); };
    im.src = OS.url(DIR + name + exts[0]);
  }
  function art(kind, n) { return SPR[(kind === 'bg' ? 'BK-' : kind === 'pose' ? 'rod-' : 'club-') + n] || null; }
  function aspect(kind, n) {            // height / width
    var im = art(kind, n);
    if (im) return im.naturalHeight / im.naturalWidth;
    return kind === 'pose' ? 0.5 : 1;    // until the art loads: poses are 2:1 wide, logos square
  }

  /* ---------- placeholders ---------- */
  var HUES = [280, 200, 340, 30, 150];
  function phBg(ctx, w, h, n) {
    var hue = HUES[(n - 1) % HUES.length];
    var g = ctx.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, 'hsl(' + hue + ',70%,22%)'); g.addColorStop(1, 'hsl(' + ((hue + 60) % 360) + ',80%,10%)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (var i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc((i * 0.37 % 1) * w, (i * 0.61 % 1) * h, w * (0.08 + (i % 3) * 0.06), 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.font = '900 ' + Math.round(w * 0.12) + 'px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BK-' + n, w / 2, h / 2);
  }
  function phPose(ctx, w, h, n) {
    var c = 'hsl(' + HUES[(n - 1) % HUES.length] + ',60%,55%)';
    ctx.save(); ctx.translate(w / 2, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.2; pose(); ctx.strokeStyle = c; ctx.lineWidth = w * 0.14; pose();
    ctx.fillStyle = c; ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.03;
    ctx.beginPath(); ctx.arc(0, h * 0.12, w * 0.15, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(w * 0.14) + 'px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('rod-' + n, w / 2, h * 0.95);
    function pose() {
      var a = [[-0.4, 0.55, -0.3, 0.2], [0.42, 0.15, 0.3, 0.45], [0.35, 0.6, -0.1, 0.62], [-0.25, 0.9, 0.3, 0.88]][(n - 1) % 4] || [0, 0, 0, 0];
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25); ctx.lineTo(0, h * 0.58);                                    // body
      ctx.moveTo(0, h * 0.33); ctx.lineTo(w * a[0], h * a[1] * 0.9);                        // arm
      ctx.moveTo(0, h * 0.33); ctx.lineTo(w * a[2] * 0.9, h * (0.3 + a[3] * 0.4));          // arm
      ctx.moveTo(0, h * 0.58); ctx.lineTo(-w * 0.22, h * 0.86);                              // legs
      ctx.moveTo(0, h * 0.58); ctx.lineTo(w * 0.22, h * 0.86);
      ctx.stroke();
    }
  }
  function phLogo(ctx, w, h, n) {
    var c = 'hsl(' + HUES[(n + 1) % HUES.length] + ',80%,55%)', r = Math.min(w, h) / 2;
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(w / 2, h / 2, r * 0.96, 0, 7); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(w / 2, h / 2, r * 0.8, 0, 7); ctx.stroke();
    ctx.fillStyle = c; ctx.font = '900 ' + Math.round(r * 0.45) + 'px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('club-' + n, w / 2, h / 2);
  }
  function drawArt(ctx, kind, n, x, y, w, h) {
    var im = art(kind, n);
    if (kind === 'bg') {
      if (im) {                       // cover
        var s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
        ctx.drawImage(im, x + (w - im.naturalWidth * s) / 2, y + (h - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
      } else { ctx.save(); ctx.translate(x, y); phBg(ctx, w, h, n); ctx.restore(); }
      return;
    }
    if (im) ctx.drawImage(im, x, y, w, h);
    else {
      ctx.save(); ctx.translate(x, y);
      if (kind === 'pose' && w > h) { ctx.translate((w - h) / 2, 0); phPose(ctx, h, h, n); } else (kind === 'pose' ? phPose : phLogo)(ctx, w, h, n);
      ctx.restore();
    }
  }

  /* ---------- text helpers ---------- */
  function fontCss(it) { return FONTS[it.font || 0].css.replace('{s}', Math.round(it.size)); }
  function shown(it) { return FONTS[it.font || 0].upper ? String(it.text).toUpperCase() : String(it.text); }
  var measureCtx = document.createElement('canvas').getContext('2d');
  function textBox(it) {
    measureCtx.font = fontCss(it);
    return { w: Math.max(it.size * 0.6, measureCtx.measureText(shown(it)).width + it.size * 0.2), h: it.size * 1.2 };
  }

  /* ---------- the next show, for the quick-add buttons ---------- */
  function showDateText() {
    var w = (C.show || {}).weekly || {}, ns = OS.nextShow ? OS.nextShow() : null;
    if (!ns) return 'WEDNESDAYS 8PM';
    var tz = w.timeZone || 'America/Chicago';
    try {
      var d = new Date(ns.start);
      var day = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
      var tm = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' ', '');
      return day.replace(',', '') + ' · ' + tm;
    } catch (e) { return 'WEDNESDAYS 8PM'; }
  }

  /* ---------- saved flyers live in the Gallery ("My flyers") ---------- */
  OS.savedFlyers = function () { return OS.store.get('flyers', []); };

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg(), FW = K.width, FH = K.height, N = K.count;
      for (var n = 1; n <= N; n++) { load('BK-' + n); load('rod-' + n); load('club-' + n); }

      root.classList.add('fly');
      root.innerHTML =
        '<div class="fly-stage"><canvas class="fly-canvas"></canvas></div>' +
        '<div class="fly-selbar"></div><div class="fly-tray"></div>' +
        '<div class="fly-tabs">' +
        ['bg:Background', 'pose:Pose', 'logo:Logo', 'text:Text', 'save:Save'].map(function (t) {
          var p = t.split(':'); return '<button class="fly-tab" data-t="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div>';
      var stage = root.querySelector('.fly-stage'), cv = root.querySelector('.fly-canvas'), ctx = cv.getContext('2d');
      var selbar = root.querySelector('.fly-selbar'), tray = root.querySelector('.fly-tray');

      /* ----- the design ----- */
      function starter() {
        return { bg: 1, size: [FW, FH], items: [
          { type: 'logo', n: 1, x: FW * 0.5, y: FH * 0.15, w: FW * 0.42 },
          { type: 'pose', n: 1, x: FW * 0.5, y: FH * 0.62, w: FW * 0.9 },
          { type: 'text', text: (C.show || {}).name || 'SHOW NAME', x: FW * 0.5, y: FH * 0.32, size: FW * 0.085, color: '#ffffff', font: 0, outline: 1 },
          { type: 'text', text: showDateText(), x: FW * 0.5, y: FH * 0.86, size: FW * 0.065, color: '#ffd23a', font: 0, outline: 1 }
        ] };
      }
      var D = OS.store.get('flyer:design', null) || starter();
      // a flyer started at a different size: scale everything to fit the current one
      var old = D.size || [1080, 1350];
      if (old[0] !== FW || old[1] !== FH) {
        var sx = FW / old[0], sy = FH / old[1];
        D.items.forEach(function (it) { it.x *= sx; it.y *= sy; if (it.w) it.w *= sx; if (it.size) it.size *= sx; });
      }
      D.size = [FW, FH];
      var sel = -1, tab = null, saveT = null;
      function persist() { clearTimeout(saveT); saveT = setTimeout(function () { OS.store.set('flyer:design', D); }, 300); }
      function changed() { persist(); redraw(); }

      function size(it) {
        if (it.type === 'text') return textBox(it);
        return { w: it.w, h: it.w * aspect(it.type, it.n) };
      }
      function find(type) { for (var i = 0; i < D.items.length; i++) if (D.items[i].type === type) return i; return -1; }

      /* ----- drawing ----- */
      var view = { k: 1, ox: 0, oy: 0, pr: 1 }, queued = false;
      function layout() {
        var cw = stage.clientWidth, ch = stage.clientHeight;
        if (!cw || !ch) return;
        view.pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(cw * view.pr); cv.height = Math.round(ch * view.pr);
        view.k = Math.min((cw - 16) / FW, (ch - 16) / FH);
        view.ox = (cw - FW * view.k) / 2; view.oy = (ch - FH * view.k) / 2;
      }
      function render(c) {
        drawArt(c, 'bg', D.bg, 0, 0, FW, FH);
        D.items.forEach(function (it, i) {
          var s = size(it);
          if (it.type === 'text') {
            c.font = fontCss(it); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
            var o = OUTLINES[it.outline || 0];
            if (o) { c.lineWidth = it.size * 0.14; c.strokeStyle = o; c.strokeText(shown(it), it.x, it.y); }
            c.fillStyle = it.color; c.fillText(shown(it), it.x, it.y);
          } else drawArt(c, it.type, it.n, it.x - s.w / 2, it.y - s.h / 2, s.w, s.h);
        });
      }
      function draw() {
        queued = false;
        if (!cv.width) layout();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.setTransform(view.pr * view.k, 0, 0, view.pr * view.k, view.pr * view.ox, view.pr * view.oy);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FW, FH);
        ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
        render(ctx);
        ctx.restore();
        if (sel >= 0) { ctx.save(); drawSelection(); ctx.restore(); }   // the orange box can hang off the edge
      }
      function drawSelection() {
        var it = D.items[sel]; if (!it) return;
        var s = size(it), hs = 16 / view.k;
        ctx.lineWidth = 2.5 / view.k; ctx.strokeStyle = '#ff9500'; ctx.setLineDash([10 / view.k, 6 / view.k]);
        ctx.strokeRect(it.x - s.w / 2, it.y - s.h / 2, s.w, s.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff9500'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / view.k;
        ctx.beginPath(); ctx.arc(it.x + s.w / 2, it.y + s.h / 2, hs * 0.75, 0, 7); ctx.fill(); ctx.stroke();
      }
      function redraw() { if (!queued) { queued = true; requestAnimationFrame(draw); } }
      onArt.push(function () { redraw(); if (tab) openTray(tab); });

      /* ----- touch: select, move, corner-resize, pinch ----- */
      var pts = {}, gesture = null, lastTap = { t: 0, i: -1 };
      function toFlyer(e) {
        var r = cv.getBoundingClientRect(), f = stage.clientWidth / r.width;
        return { x: ((e.clientX - r.left) * f - view.ox) / view.k, y: ((e.clientY - r.top) * f - view.oy) / view.k };
      }
      function hit(p) {
        for (var i = D.items.length - 1; i >= 0; i--) {
          var it = D.items[i], s = size(it), pad = 8 / view.k;
          if (Math.abs(p.x - it.x) <= s.w / 2 + pad && Math.abs(p.y - it.y) <= s.h / 2 + pad) return i;
        }
        return -1;
      }
      function onHandle(p) {
        if (sel < 0) return false;
        var it = D.items[sel], s = size(it), hx = it.x + s.w / 2, hy = it.y + s.h / 2;
        return Math.hypot(p.x - hx, p.y - hy) < 26 / view.k;
      }
      function scaleItem(it, start, f) {
        f = Math.max(0.05, f);
        if (it.type === 'text') it.size = Math.max(FW * 0.015, Math.min(FW * 0.4, start * f));
        else it.w = Math.max(FW * 0.05, Math.min(FW * 2, start * f));
      }
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        var p = toFlyer(e);
        pts[e.pointerId] = p;
        var ids = Object.keys(pts);
        if (ids.length === 2 && sel >= 0) {            // pinch the selected item
          var a = pts[ids[0]], b = pts[ids[1]], it0 = D.items[sel];
          gesture = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, start: it0.type === 'text' ? it0.size : it0.w };
          return;
        }
        if (onHandle(p)) {
          var it = D.items[sel];
          gesture = { mode: 'resize', d: Math.hypot(p.x - it.x, p.y - it.y) || 1, start: it.type === 'text' ? it.size : it.w };
          return;
        }
        var i = hit(p);
        if (i >= 0) {
          var now = Date.now();
          if (D.items[i].type === 'text' && lastTap.i === i && now - lastTap.t < 350) { editText(i); gesture = null; return; }
          lastTap = { t: now, i: i };
          sel = i;
          gesture = { mode: 'move', sx: p.x, sy: p.y, ix: D.items[i].x, iy: D.items[i].y };
        } else { sel = -1; gesture = null; }
        updateSelbar(); redraw();
      });
      cv.addEventListener('pointermove', function (e) {
        if (!pts[e.pointerId]) return;
        var p = toFlyer(e);
        pts[e.pointerId] = p;
        if (!gesture || sel < 0) return;
        var it = D.items[sel];
        if (gesture.mode === 'move') {
          it.x = Math.max(-FW * 0.2, Math.min(FW * 1.2, gesture.ix + p.x - gesture.sx));
          it.y = Math.max(-FH * 0.2, Math.min(FH * 1.2, gesture.iy + p.y - gesture.sy));
        } else if (gesture.mode === 'resize') {
          scaleItem(it, gesture.start, Math.hypot(p.x - it.x, p.y - it.y) / gesture.d);
        } else if (gesture.mode === 'pinch') {
          var ids = Object.keys(pts); if (ids.length < 2) return;
          var a = pts[ids[0]], b = pts[ids[1]];
          scaleItem(it, gesture.start, Math.hypot(a.x - b.x, a.y - b.y) / gesture.d);
        }
        redraw();
      });
      function up(e) {
        delete pts[e.pointerId];
        if (gesture) { gesture = null; persist(); }
      }
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);

      /* ----- selected-item bar ----- */
      function updateSelbar() {
        var it = D.items[sel];
        if (!it) { selbar.classList.remove('on'); selbar.innerHTML = ''; return; }
        var b = [];
        if (it.type === 'text') {
          b.push(['edit', 'Edit']);
          b.push(['color', '<span class="sw" style="background:' + it.color + '"></span>Color']);
          b.push(['font', FONTS[it.font || 0].name]);
          b.push(['outline', OUTLINES[it.outline || 0] ? 'Outline' : 'No outline']);
        } else b.push(['label', it.type === 'pose' ? 'Pose ' + it.n : 'Logo ' + it.n]);
        b.push(['front', 'To front']);
        b.push(['del', 'Delete']);
        selbar.innerHTML = b.map(function (x) { return '<button data-a="' + x[0] + '"' + (x[0] === 'label' ? ' disabled' : '') + '>' + x[1] + '</button>'; }).join('');
        selbar.classList.add('on');
      }
      selbar.addEventListener('click', function (e) {
        var btn = e.target.closest('button'); if (!btn || sel < 0) return;
        var it = D.items[sel], a = btn.getAttribute('data-a');
        if (a === 'edit') return editText(sel);
        if (a === 'color') it.color = COLORS[(COLORS.indexOf(it.color) + 1) % COLORS.length];
        if (a === 'font') it.font = ((it.font || 0) + 1) % FONTS.length;
        if (a === 'outline') it.outline = ((it.outline || 0) + 1) % OUTLINES.length;
        if (a === 'front') { D.items.splice(sel, 1); D.items.push(it); sel = D.items.length - 1; }
        if (a === 'del') { D.items.splice(sel, 1); sel = -1; if (tab === 'pose' || tab === 'logo') openTray(tab); }
        updateSelbar(); changed();
      });

      /* ----- tabs + tray ----- */
      function thumb(kind, n) {
        var c = document.createElement('canvas'), w = 56, h = kind === 'bg' ? 70 : 56;
        c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px';
        var x = c.getContext('2d'); x.scale(2, 2);
        if (kind === 'bg') drawArt(x, 'bg', n, 0, 0, w, h);
        else {
          x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, w, h);
          var a = aspect(kind, n), tw = Math.min(w * 0.85, h * 0.85 / a), th = tw * a;
          drawArt(x, kind, n, (w - tw) / 2, (h - th) / 2, tw, th);
        }
        return c;
      }
      function trayBtn(content, cls, onClick) {
        var b = OS.el('button', 'fly-item ' + (cls || ''));
        if (typeof content === 'string') b.innerHTML = content; else b.appendChild(content);
        b.onclick = onClick;
        tray.appendChild(b);
        return b;
      }
      function openTray(t) {
        tab = t;
        Array.prototype.forEach.call(root.querySelectorAll('.fly-tab'), function (b) { b.classList.toggle('sel', b.getAttribute('data-t') === t); });
        tray.innerHTML = '';
        tray.classList.toggle('on', !!t);
        if (!t) return;
        var n;
        if (t === 'bg') {
          for (n = 1; n <= N; n++) (function (n) {
            trayBtn(thumb('bg', n), D.bg === n ? 'sel' : '', function () { D.bg = n; openTray('bg'); changed(); });
          })(n);
        } else if (t === 'pose' || t === 'logo') {
          var at = find(t), curN = at >= 0 ? D.items[at].n : 0;
          trayBtn('<span class="fly-none">None</span>', curN ? '' : 'sel', function () {
            var i = find(t); if (i >= 0) { D.items.splice(i, 1); sel = -1; updateSelbar(); }
            openTray(t); changed();
          });
          for (n = 1; n <= N; n++) (function (n) {
            trayBtn(thumb(t, n), curN === n ? 'sel' : '', function () {
              var i = find(t);
              if (i >= 0) D.items[i].n = n;
              else {
                D.items.push(t === 'pose' ? { type: 'pose', n: n, x: FW * 0.5, y: FH * 0.62, w: FW * 0.9 }
                                          : { type: 'logo', n: n, x: FW * 0.5, y: FH * 0.15, w: FW * 0.42 });
                i = D.items.length - 1;
              }
              sel = i; updateSelbar(); openTray(t); changed();
            });
          })(n);
        } else if (t === 'text') {
          trayBtn('<b>+</b>Text', 'fly-chip', function () { addText('', true); });
          trayBtn('<b>+</b>Date', 'fly-chip', function () { addText(showDateText()); });
          trayBtn('<b>+</b>Venue', 'fly-chip', function () { addText((C.show || {}).venue || 'VENUE'); });
          trayBtn('<b>+</b>Show', 'fly-chip', function () { addText((C.show || {}).name || 'SHOW NAME'); });
          (K.comics || []).forEach(function (name) { trayBtn('<b>+</b>' + OS.esc(name), 'fly-chip', function () { addText(name); }); });
        } else if (t === 'save') {
          trayBtn('Save to<br>Gallery', 'fly-chip fly-wide', saveToGallery);
          trayBtn('Download<br>PNG', 'fly-chip fly-wide', download);
          trayBtn('New<br>flyer', 'fly-chip fly-wide', newFlyer);
        }
      }
      Array.prototype.forEach.call(root.querySelectorAll('.fly-tab'), function (b) {
        b.onclick = function () { var t = b.getAttribute('data-t'); openTray(tab === t ? null : t); requestAnimationFrame(function () { layout(); redraw(); }); };
      });

      /* ----- text ----- */
      function addText(text, ask) {
        var it = { type: 'text', text: text || 'TEXT', x: FW * 0.5, y: FH * 0.5, size: FW * 0.07, color: '#ffffff', font: 0, outline: 1 };
        D.items.push(it); sel = D.items.length - 1;
        updateSelbar(); changed();
        if (ask) editText(sel, true);
      }
      function editText(i, isNew) {
        var it = D.items[i]; if (!it) return;
        var ov = OS.el('div', 'fly-dialog',
          '<div class="dlg"><div class="dlg-title">' + (isNew ? 'Add text' : 'Edit text') + '</div>' +
          '<div class="dlg-body"><input type="text" maxlength="60" enterkeyhint="done"></div>' +
          '<div class="dlg-btns"><button class="btn ok">OK</button><button class="btn cancel">Cancel</button></div></div>');
        root.appendChild(ov);
        var input = ov.querySelector('input');
        input.value = isNew ? '' : it.text;
        setTimeout(function () { input.focus(); input.select(); }, 50);
        function done(ok) {
          var v = input.value.trim();
          if (ok && v) it.text = v;
          else if (isNew) { D.items.splice(i, 1); sel = -1; }
          input.blur(); ov.remove();
          updateSelbar(); changed();
        }
        ov.querySelector('.ok').onclick = function () { done(true); };
        ov.querySelector('.cancel').onclick = function () { done(false); };
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); });
        dialogOpen = done;
      }
      var dialogOpen = null;

      /* ----- export ----- */
      function exportCanvas() {
        var c = document.createElement('canvas');
        c.width = FW; c.height = FH;
        render(c.getContext('2d'));
        return c;
      }
      function blocked() {
        OS.dialog({ title: 'Can\'t save here', text: 'The browser blocks saving pictures when index.html is opened by double-clicking. Open the phone through Live Server or GitHub Pages to save flyers.' });
      }
      function saveToGallery() {
        var url;
        try { url = exportCanvas().toDataURL('image/jpeg', 0.85); } catch (e) { return blocked(); }
        var list = OS.savedFlyers();
        list.unshift({ src: url, ts: Date.now() });
        while (list.length) {
          try { localStorage.setItem('eclair:flyers', JSON.stringify(list.slice(0, K.maxSaved))); break; }
          catch (e) { if (list.length <= 1) { OS.toast('Phone storage is full'); return; } list.pop(); }
        }
        OS.toast('Saved to Gallery › My flyers');
        OS.emit('flyer-saved');
      }
      function download() {
        var c = exportCanvas();
        try {
          c.toBlob(function (blob) {
            if (!blob) return blocked();
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (String((C.show || {}).name || 'flyer').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'flyer') + '-flyer.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
            OS.toast('Downloading flyer…');
          }, 'image/png');
        } catch (e) { blocked(); }
      }
      function newFlyer() {
        OS.dialog({ title: 'New flyer', text: 'Start over? This flyer will be cleared (saved ones stay in the Gallery).', buttons: [
          { label: 'Start over', action: function () { D = starter(); sel = -1; updateSelbar(); openTray(null); changed(); } },
          { label: 'Cancel' }
        ] });
      }

      /* ----- go ----- */
      function onResize() { layout(); redraw(); }
      window.addEventListener('resize', onResize);
      requestAnimationFrame(function () { layout(); redraw(); });

      OS.debugFlyer = { get design() { return D; }, get sel() { return sel; }, view: view, select: function (i) { sel = i; updateSelbar(); redraw(); } };

      return {
        back: function () {
          if (dialogOpen && root.querySelector('.fly-dialog')) { dialogOpen(false); return true; }
          if (tab) { openTray(null); requestAnimationFrame(function () { layout(); redraw(); }); return true; }
          if (sel >= 0) { sel = -1; updateSelbar(); redraw(); return true; }
          return false;
        },
        menu: function () {
          return [
            { label: 'Save to Gallery', action: saveToGallery },
            { label: 'Download PNG', action: download },
            { label: 'New flyer', action: newFlyer }
          ];
        },
        close: function () { window.removeEventListener('resize', onResize); OS.store.set('flyer:design', D); }
      };
    }
  });
})();
