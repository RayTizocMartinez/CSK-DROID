/* =====================================================================
   WALLPAPER — the Android 2.1 way:
     long-press the home screen  ->  "Add to Home screen"  ->  Wallpapers
     ->  "Select wallpaper from":  Gallery / Live wallpapers / Wallpapers

   Wallpapers = any image named wallpaper / background that the phone can
   find (see media/wallpaper/README.md). Gallery = pick any photo, then
   crop it on the classic orange-box crop screen.
   The choice is saved per visitor and used on the home + lock screens.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C, $ = OS.$;

  /* ---------- live wallpapers: image sequences ---------- */
  // content.js -> home.liveWallpapers: [{ id, name, description, folder, pattern, fps, pingpong, start }]
  // Videos are found automatically: media/live/live-wallpaper-1.mp4 ... live-wallpaper-9.mp4 (.webm works too)
  var LIVE_DIR = 'media/live/', VID_MAX = 9, VID_EXT = ['.mp4', '.webm', '.mov'];
  function vidCandidates(n) {
    var out = [];
    ['live-wallpaper-', 'live-wallpapper-', 'live_wallpaper_'].forEach(function (b) { VID_EXT.forEach(function (e) { out.push(LIVE_DIR + b + n + e); }); });
    return out;
  }
  function rawLive() { return ((C.home || {}).liveWallpapers || []).filter(function (d) { return d && d.id; }); }
  function cfgLive() { return rawLive().filter(function (d) { return d.folder || d.video; }); }
  function override(def) {   // a content.js entry with the same id can rename an auto-found video
    var o = rawLive().filter(function (d) { return d.id === def.id; })[0];
    if (o) { if (o.name) def.name = o.name; if (o.description) def.description = o.description; if (o.speed) def.speed = o.speed; }
    return def;
  }
  function vidDef(n, url) { return override({ id: 'live-wallpaper-' + n, name: 'Live wallpaper ' + n, video: url || vidCandidates(n) }); }
  var foundVids = [], vidPromise = null;
  function probeVideo(url) {
    return new Promise(function (res) {
      var v = document.createElement('video'), done = false;
      function fin(ok) { if (done) return; done = true; v.removeAttribute('src'); try { v.load(); } catch (e) {} res(ok); }
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { fin(true); }; v.onerror = function () { fin(false); };
      setTimeout(function () { fin(false); }, 8000);
      v.src = OS.url(url);
    });
  }
  function discoverVideos() {
    if (vidPromise) return vidPromise;
    vidPromise = Promise.all(Array.apply(null, Array(VID_MAX)).map(function (_, i) {
      var n = i + 1, list = vidCandidates(n);
      function next(k) { return k >= list.length ? Promise.resolve(null) : probeVideo(list[k]).then(function (ok) { return ok ? vidDef(n, list[k]) : next(k + 1); }); }
      return next(0);
    })).then(function (defs) { foundVids = defs.filter(Boolean); return foundVids; });
    return vidPromise;
  }
  function liveList() {
    var ids = {};
    foundVids.forEach(function (d) { ids[d.id] = 1; });
    return foundVids.concat(cfgLive().filter(function (d) { return !ids[d.id]; }));
  }
  function findLive(id) {
    var d = liveList().filter(function (d) { return d.id === id; })[0];
    if (d) return d;
    var m = /^live-wallpaper-(\d+)$/.exec(id || '');
    return m ? vidDef(+m[1]) : null;   // saved before discovery finished: try the names directly
  }
  function frameUrl(def, n) {
    var pat = def.pattern || '####.jpg', m = pat.match(/#+/), num = String(n);
    if (!m) return def.folder + n + pat;
    while (num.length < m[0].length) num = '0' + num;
    return def.folder + pat.replace(/#+/, num);
  }
  // loads frames 8 at a time until one is missing; cached per wallpaper
  var frameCache = {};
  function getFrames(def, onFirst) {
    var e = frameCache[def.id];
    if (e) { if (onFirst && e.first) onFirst(e.first); else if (onFirst) e.waiting.push(onFirst); return e.promise; }
    e = frameCache[def.id] = { first: null, waiting: onFirst ? [onFirst] : [] };
    function probe(n) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(im); };
        im.onerror = function () { res(null); };
        im.src = OS.url(frameUrl(def, n));
      });
    }
    e.promise = new Promise(function (resolve) {
      var frames = [], triedZero = def.start != null;
      function batch(n) {
        var ps = [];
        for (var k = 0; k < 8; k++) ps.push(probe(n + k));
        Promise.all(ps).then(function (ims) {
          for (var k = 0; k < ims.length; k++) {
            if (!ims[k]) {
              if (!frames.length && !triedZero) { triedZero = true; return batch(0); }   // numbering starts at 0?
              return resolve(frames);
            }
            frames.push(ims[k]);
            if (frames.length === 1) { e.first = ims[k]; e.waiting.forEach(function (f) { f(ims[k]); }); e.waiting = []; }
          }
          if (frames.length >= (def.maxFrames || 300)) return resolve(frames);
          batch(n + 8);
        });
      }
      batch(def.start != null ? def.start : 1);
    });
    return e.promise;
  }
  // plays a sequence into a canvas, filling it (cropped if needed)
  function Player(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.raf = null; this.token = null; }
  Player.prototype.draw = function (im) {
    var cv = this.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h || !im) return;
    var pr = (window.devicePixelRatio || 1) * (OS.scale || 1), Wd = Math.round(w * pr), Hd = Math.round(h * pr);
    if (cv.width !== Wd || cv.height !== Hd) { cv.width = Wd; cv.height = Hd; }
    var s = Math.max(Wd / im.naturalWidth, Hd / im.naturalHeight);
    this.ctx.drawImage(im, (Wd - im.naturalWidth * s) / 2, (Hd - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
  };
  // videos play in a <video> laid over the canvas (muted + inline so phones allow autoplay)
  Player.prototype.playVideo = function (def, gate) {
    var self = this, token = {}, cv = this.cv, urls = [].concat(def.video), k = 0;
    this.token = token;
    var v = this.video = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('disablepictureinpicture', '');
    v.className = 'lw-video ' + (cv.className || '');
    if (cv.id === 'live') { v.id = 'live-video'; document.documentElement.classList.add('live-vid'); }
    else cv.style.display = 'none';
    // playback speed: per video (content.js "speed"), else home.liveSpeed, else half speed
    var rate = def.speed || (C.home || {}).liveSpeed || 0.5;
    function setRate() { v.defaultPlaybackRate = rate; v.playbackRate = rate; }
    v.onloadedmetadata = setRate; v.onplay = setRate;
    v.onerror = function () { if (self.token === token && ++k < urls.length) v.src = OS.url(urls[k]); };
    v.src = OS.url(urls[0]);
    setRate();
    cv.parentNode.insertBefore(v, cv.nextSibling);
    function tick() {
      if (self.token !== token) return;
      var show = !gate || gate();                             // pause behind apps to save battery
      if (show && v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else if (!show && !v.paused) v.pause();
      self.timer = setTimeout(tick, 300);
    }
    tick();
  };
  Player.prototype.play = function (def, gate) {
    var self = this, token = {}, i = 0, dir = 1, last = 0, frames = null;
    this.stop();
    if (def.video) return this.playVideo(def, gate);
    this.token = token;
    getFrames(def, function (first) { if (self.token === token && !frames) self.draw(first); }).then(function (f) {
      if (self.token !== token || !f.length) return;
      frames = f;
      self.raf = requestAnimationFrame(function tick(now) {
        if (self.token !== token) return;
        self.raf = requestAnimationFrame(tick);
        if (gate && !gate()) return;                         // hidden behind an app: don't burn battery
        if (now - last < 1000 / (def.fps || 12)) return;
        last = now;
        self.draw(frames[i]);
        if (frames.length < 2) return;
        if (def.pingpong) { if (i + dir >= frames.length || i + dir < 0) dir = -dir; i += dir; }
        else i = (i + 1) % frames.length;
      });
    });
  };
  Player.prototype.stop = function () {
    this.token = null; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    if (this.video) {
      var v = this.video; this.video = null;
      v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) {} v.remove();
      if (this.cv.id === 'live') document.documentElement.classList.remove('live-vid'); else this.cv.style.display = '';
    }
  };
  // a still from a video, for the list thumbnail
  function videoThumb(def, cb) {
    var urls = [].concat(def.video), k = 0, v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', '');
    v.onloadeddata = function () { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch (e) {} };
    v.onseeked = function () {
      var c = document.createElement('canvas'); c.width = 88; c.height = 144;
      var s = Math.max(88 / v.videoWidth, 144 / v.videoHeight), x = c.getContext('2d');
      x.drawImage(v, (88 - v.videoWidth * s) / 2, (144 - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
      try { cb(c.toDataURL('image/jpeg', 0.7)); } catch (e) {}
      v.removeAttribute('src'); try { v.load(); } catch (e) {}
    };
    v.onerror = function () { if (++k < urls.length) v.src = OS.url(urls[k]); };
    v.src = OS.url(urls[0]);
  }

  var bgPlayer = null;
  function liveVisible() { return OS.state === 'lock' || (OS.state === 'on' && !OS.current()); }
  function startLive(def) {
    var cv = $('#live');
    if (!cv) return;
    document.documentElement.classList.add('live-wp');
    if (!bgPlayer) bgPlayer = new Player(cv);
    bgPlayer.play(def, liveVisible);
  }
  function stopLive() {
    document.documentElement.classList.remove('live-wp');
    if (bgPlayer) bgPlayer.stop();
  }

  /* ---------- applying ---------- */
  function cssUrl(src) { return 'url("' + OS.url(src).replace(/"/g, '%22') + '")'; }
  // CSS background for a saved wallpaper: {src} = fill + center crop, {src, crop} = exact crop
  function bgFor(w) {
    if (!w || !w.src) return null;
    var c = w.crop;
    if (!c) return cssUrl(w.src) + ' center / cover no-repeat';
    var px = c.w >= 0.999 ? 0 : c.x / (1 - c.w) * 100;
    var py = c.h >= 0.999 ? 0 : c.y / (1 - c.h) * 100;
    return cssUrl(w.src) + ' ' + px + '% ' + py + '% / ' + (100 / c.w) + '% ' + (100 / c.h) + '% no-repeat';
  }
  OS.applyWallpaper = function () {
    var w = OS.store.get('wallpaper', null), home = $('#home'), lock = $('#lock');
    var def = w && w.live ? findLive(w.live) : null;
    if (def) { home.style.background = ''; lock.style.background = ''; startLive(def); return; }
    stopLive();
    var bg = bgFor(w);
    if (bg) {
      home.style.background = bg + ', #000';
      lock.style.background = 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.7)), ' + bg + ', #000';
    } else { home.style.background = ''; lock.style.background = ''; }
  };
  OS.setWallpaper = function (w) {
    OS.store.set('wallpaper', w);
    OS.applyWallpaper();
    OS.emit('wallpaper-changed', w);
  };

  /* ---------- the classic dialogs ---------- */
  var ICO = {
    shortcut: '<svg viewBox="0 0 48 48"><rect x="8" y="8" width="32" height="32" rx="5" fill="url(#g-gray)" stroke="#333"/><path d="M18 30l12-12m-9 0h9v9" stroke="#222" stroke-width="3" fill="none"/></svg>',
    widget:   '<svg viewBox="0 0 48 48"><rect x="6" y="12" width="36" height="24" rx="4" fill="url(#g-sky)" stroke="#123"/><rect x="11" y="17" width="12" height="14" rx="2" fill="#fff" opacity=".8"/><rect x="26" y="17" width="11" height="5" rx="1" fill="#fff" opacity=".8"/></svg>',
    folder:   '<svg viewBox="0 0 48 48"><path d="M6 14h14l4 4h18v20H6z" fill="url(#g-orange)" stroke="#5a2a00"/></svg>',
    wallpaper:'<svg viewBox="0 0 48 48"><rect x="10" y="4" width="28" height="40" rx="3" fill="#222" stroke="#999"/><rect x="13" y="8" width="22" height="30" fill="url(#g-green)"/><circle cx="29" cy="14" r="3" fill="#ffe36a"/><path d="M13 38l8-10 5 5 4-3 5 8z" fill="#1d4d08"/></svg>',
    live:     '<svg viewBox="0 0 48 48"><rect x="10" y="4" width="28" height="40" rx="3" fill="#222" stroke="#999"/><rect x="13" y="8" width="22" height="30" fill="#103"/><circle cx="20" cy="18" r="4" fill="#ff6ad5"/><circle cx="28" cy="27" r="5" fill="#2fa8ff"/><circle cx="19" cy="32" r="3" fill="#8fd14f"/></svg>'
  };
  OS.addToHome = function () {
    OS.listDialog({ title: 'Add to Home screen', items: [
      { label: 'Shortcuts', icon: ICO.shortcut, action: function () { OS.toast('No shortcuts available'); } },
      { label: 'Widgets', icon: ICO.widget, action: function () { OS.toast('No room for widgets. Too many bits.'); } },
      { label: 'Folders', icon: ICO.folder, action: function () { OS.toast('Folders are locked by the owner'); } },
      { label: 'Wallpapers', icon: ICO.wallpaper, action: OS.chooseWallpaper }
    ] });
  };
  OS.chooseWallpaper = function () {
    OS.listDialog({ title: 'Select wallpaper from', items: [
      { label: 'Gallery', icon: (OS.apps.gallery || {}).icon, action: function () {
        OS.open('gallery', { pick: true, onPick: function (src) { OS.open('wallpaper', { crop: src }); } });
      } },
      { label: 'Live wallpapers', icon: ICO.live, action: function () { OS.open('wallpaper', { live: true }); } },
      { label: 'Wallpapers', icon: ICO.wallpaper, action: function () { OS.open('wallpaper'); } }
    ] });
  };

  /* ---------- finding wallpapers ---------- */
  function probe(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(src); };
      im.onerror = function () { res(null); };
      im.src = OS.url(src);
    });
  }
  function probeAny(base) {           // base.jpg, then base.png
    return probe(base + '.jpg').then(function (r) { return r || probe(base + '.png'); });
  }
  function probeSeries(base) {        // base-1, base-2, ... until one is missing
    var out = [];
    function next(i) {
      return probeAny(base + '-' + i).then(function (r) {
        if (!r || i > 30) return out;
        out.push(r); return next(i + 1);
      });
    }
    return next(1);
  }
  function candidates() {
    var fixed = ['media/wallpaper/lockscreen', 'media/wallpaper/background',
      'media/games/podstack/background', 'media/games/flappynick/background', 'media/games/match3/background'];
    return Promise.all([
      Promise.all(fixed.map(probeAny)),
      probeSeries('media/wallpaper/wallpaper'),
      probeSeries('media/wallpaper/background')
    ]).then(function (r) {
      var list = [{ src: null }], seen = {};
      function add(src) { if (src && !seen[src]) { seen[src] = 1; list.push({ src: src }); } }
      r[1].forEach(add); r[2].forEach(add); r[0].forEach(add);
      ((C.home || {}).wallpapers || []).forEach(add);
      // gallery photos with "wallpaper" or "background" in the name
      ((window.GALLERY_INDEX || {}).albums || []).forEach(function (a) {
        (a.photos || []).forEach(function (p) { if (/wallpaper|background/i.test(String(p).split('/').pop())) add(p); });
      });
      return list;
    });
  }

  /* ---------- the hidden Wallpaper "activity" ---------- */
  OS.registerApp({
    id: 'wallpaper', name: 'Wallpapers', hidden: true,
    launch: function (root, args) {
      return args.crop ? cropper(root, args.crop) : args.live ? livePicker(root) : picker(root);
    }
  });

  // big preview + thumbnail strip + "Set wallpaper"
  function picker(root) {
    root.classList.add('wp');
    root.innerHTML = OS.titleBar('Wallpapers') +
      '<div class="wp-preview"></div><div class="wp-strip"><span class="wp-loading">Loading…</span></div>' +
      '<div class="wp-bar"><button class="btn wp-set">Set wallpaper</button></div>';
    var preview = root.querySelector('.wp-preview'), strip = root.querySelector('.wp-strip');
    var list = [{ src: null }], sel = 0, cur = OS.store.get('wallpaper', null);
    function show() {
      var it = list[sel];
      preview.classList.toggle('wp-default', !it.src);
      preview.style.backgroundImage = it.src ? cssUrl(it.src) : '';
      Array.prototype.forEach.call(strip.children, function (b, i) { b.classList.toggle('sel', i === sel); });
    }
    candidates().then(function (l) {
      list = l;
      strip.innerHTML = '';
      list.forEach(function (it, i) {
        if (cur && cur.src === it.src) sel = i;
        var b = OS.el('button', 'wp-thumb' + (it.src ? '' : ' wp-default'));
        if (it.src) b.style.backgroundImage = cssUrl(it.src);
        b.onclick = function () { sel = i; show(); };
        strip.appendChild(b);
      });
      show();
      var s = strip.children[sel]; if (s && s.scrollIntoView) s.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    show();
    root.querySelector('.wp-set').onclick = function () {
      var it = list[sel];
      OS.setWallpaper(it.src ? { src: it.src } : null);
      OS.home();
    };
    return {};
  }

  // Live wallpapers: list with thumbnail + description, tap for a moving preview
  function livePicker(root) {
    root.classList.add('wp');
    var view = 'list', prev = null;
    function list() {
      view = 'list';
      if (prev) { prev.stop(); prev = null; }
      root.innerHTML = OS.titleBar('Live wallpapers');
      var l = OS.el('div', 'list scroll');
      var defs = liveList();
      if (!defs.length) l.innerHTML = '<div class="empty">' + (foundVids.length || vidDone ? 'No live wallpapers installed' : 'Looking for live wallpapers…') + '</div>';
      defs.forEach(function (def) {
        var row = OS.el('div', 'row lw-row', '<div class="lw-thumb"></div><div class="grow"><div class="t1">' + OS.esc(def.name || def.id) + '</div>' +
          (def.description ? '<div class="t2">' + OS.esc(def.description) + '</div>' : '') + '</div>');
        var th = row.querySelector('.lw-thumb');
        if (def.video) videoThumb(def, function (u) { th.style.backgroundImage = 'url("' + u + '")'; });
        else getFrames(def, function (first) { th.style.backgroundImage = 'url("' + first.src + '")'; });
        row.onclick = function () { preview(def); };
        l.appendChild(row);
      });
      root.appendChild(l);
    }
    function preview(def) {
      view = 'preview';
      root.innerHTML = OS.titleBar(def.name || def.id) + '<canvas class="lw-preview"></canvas>' +
        '<div class="wp-bar"><button class="btn lw-set">Set wallpaper</button></div>';
      prev = new Player(root.querySelector('.lw-preview'));
      prev.play(def);
      root.querySelector('.lw-set').onclick = function () {
        prev.stop(); prev = null;
        OS.setWallpaper({ live: def.id });
        OS.home();
      };
    }
    var vidDone = false;
    list();
    discoverVideos().then(function () { vidDone = true; if (view === 'list' && root.isConnected) list(); });
    return {
      back: function () { if (view === 'preview') { list(); return true; } return false; },
      close: function () { if (prev) prev.stop(); }
    };
  }

  // the classic crop screen: drag the orange box, drag a corner to resize, Save / Discard
  function cropper(root, src) {
    root.classList.add('crop');
    root.innerHTML = '<div class="crop-area"><img class="crop-img" alt="">' +
      '<div class="crop-box"><i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i></div></div>' +
      '<div class="wp-bar"><button class="btn crop-save">Save</button><button class="btn crop-discard">Discard</button></div>';
    var area = root.querySelector('.crop-area'), img = root.querySelector('.crop-img'), box = root.querySelector('.crop-box');
    var home = $('#home');
    var aspect = (home.clientWidth || 332) / (home.clientHeight || 541);
    var I = { x: 0, y: 0, w: 1, h: 1 }, B = { x: 0, y: 0, w: 1, h: 1 }, ready = false;

    function draw() {
      box.style.left = B.x + 'px'; box.style.top = B.y + 'px';
      box.style.width = B.w + 'px'; box.style.height = B.h + 'px';
    }
    function layout() {
      var aw = area.clientWidth, ah = area.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !aw) return;
      var s = Math.min(aw / nw, ah / nh);
      I = { w: nw * s, h: nh * s }; I.x = (aw - I.w) / 2; I.y = (ah - I.h) / 2;
      img.style.left = I.x + 'px'; img.style.top = I.y + 'px'; img.style.width = I.w + 'px'; img.style.height = I.h + 'px';
      if (I.w / I.h > aspect) { B.h = I.h; B.w = B.h * aspect; } else { B.w = I.w; B.h = B.w / aspect; }
      B.x = I.x + (I.w - B.w) / 2; B.y = I.y + (I.h - B.h) / 2;
      ready = true;
      draw();
    }
    img.onload = function () { requestAnimationFrame(layout); };
    img.onerror = function () { OS.toast('Couldn\'t open that picture'); OS.home(); };
    img.src = OS.url(src);

    var drag = null;
    box.addEventListener('pointerdown', function (e) {
      if (!ready) return;
      e.preventDefault();
      var h = e.target.classList.contains('h') ? e.target.className.replace('h ', '') : null;
      drag = { mode: h || 'move', sx: e.clientX, sy: e.clientY, b: { x: B.x, y: B.y, w: B.w, h: B.h } };
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
    });
    box.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var k = area.getBoundingClientRect().width / area.clientWidth || 1;   // the phone body may be scaled
      var dx = (e.clientX - drag.sx) / k, dy = (e.clientY - drag.sy) / k, b = drag.b;
      if (drag.mode === 'move') {
        B.x = Math.max(I.x, Math.min(I.x + I.w - B.w, b.x + dx));
        B.y = Math.max(I.y, Math.min(I.y + I.h - B.h, b.y + dy));
      } else {
        var sx = drag.mode.indexOf('r') >= 0 ? 1 : -1, sy = drag.mode.indexOf('b') >= 0 ? 1 : -1;
        var ax = sx > 0 ? b.x : b.x + b.w, ay = sy > 0 ? b.y : b.y + b.h;     // opposite corner stays put
        var w = Math.max(b.w + sx * dx, (b.h + sy * dy) * aspect);
        var maxW = Math.min(sx > 0 ? I.x + I.w - ax : ax - I.x, (sy > 0 ? I.y + I.h - ay : ay - I.y) * aspect);
        w = Math.max(Math.min(60, maxW), Math.min(maxW, w));
        B.w = w; B.h = w / aspect;
        B.x = sx > 0 ? ax : ax - B.w; B.y = sy > 0 ? ay : ay - B.h;
      }
      draw();
    });
    function end() { drag = null; }
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    root.querySelector('.crop-save').onclick = function () {
      if (!ready) return;
      OS.setWallpaper({ src: src, crop: { x: (B.x - I.x) / I.w, y: (B.y - I.y) / I.h, w: B.w / I.w, h: B.h / I.h } });
      OS.toast('Wallpaper set');
      OS.home();
    };
    root.querySelector('.crop-discard').onclick = function () { OS.home(); };
    return {};
  }
})();
