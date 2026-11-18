/* =====================================================================
   MAIN.JS — power on, boot, lock screen, home screen, drawer,
   status bar, nav buttons. Runs after all apps have registered.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C, $ = OS.$, P = C.phone || {};
  var body = document.body;
  function setState(s) { body.className = 'state-' + s + (OS.isFullscreen && OS.isFullscreen() ? ' fullscreen' : ''); OS.state = s; }

  /* ---------- status bar ---------- */
  function signalSVG() {
    var bars = '';
    for (var i = 0; i < 4; i++) bars += '<rect x="' + (3 + i * 5) + '" y="' + (16 - i * 4) + '" width="3.5" height="' + (5 + i * 4) + '" rx=".5"/>';
    return '<svg class="glyph" viewBox="0 0 24 24">' + bars + '</svg><b class="sb-3g">3G</b>';
  }
  function batterySVG(level) {
    var h = Math.round(14 * level / 100);
    var col = level <= 15 ? '#ff3b30' : '#fff';
    return '<svg class="glyph" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="2" rx=".5"/>' +
      '<rect x="6.5" y="4" width="11" height="18" rx="1.5" fill="none" stroke="#fff" stroke-width="1.5"/>' +
      '<rect x="8.5" y="' + (20 - h) + '" width="7" height="' + h + '" fill="' + col + '"/></svg>';
  }
  function tickClock() {
    var now = new Date();
    $('#sb-time').textContent = OS.fmtTime(now);
    $('#sb-battery').innerHTML = batterySVG(OS.battery);
    var lt = $('#lock .lk-time');
    if (lt) {
      var t = OS.fmtTime(now).split(' ');
      lt.innerHTML = t[0] + (t[1] ? '<span class="lk-ampm">' + t[1] + '</span>' : '');
      $('#lock .lk-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    tickCountdown();
    updateBadges();
  }
  OS.battery = P.battery == null ? 63 : P.battery;
  $('#sb-signal').innerHTML = signalSVG();
  $('#shade-carrier').textContent = P.carrier || '';

  /* ---------- notification shade dragging ---------- */
  (function () {
    var sb = $('#statusbar'), shade = $('#shade'), startY = null, moved = false;
    sb.addEventListener('pointerdown', function (e) { startY = e.clientY; moved = false; sb.setPointerCapture(e.pointerId); });
    sb.addEventListener('pointermove', function (e) {
      if (startY == null) return;
      var dy = e.clientY - startY;
      if (dy > 6) { moved = true; shade.style.transition = 'none'; shade.style.transform = 'translateY(calc(-100% + ' + Math.min(dy, shade.clientHeight) + 'px))'; }
    });
    function end(e) {
      if (startY == null) return;
      var dy = e.clientY - startY; startY = null;
      shade.style.transition = ''; shade.style.transform = '';
      if (!moved || dy > 60) OS.openShade();
    }
    sb.addEventListener('pointerup', end);
    sb.addEventListener('pointercancel', function () { startY = null; shade.style.transition = ''; shade.style.transform = ''; });
    $('.shade-handle').onclick = OS.closeShade;
    $('#shade-clear').onclick = function () { OS.clearNotifs(); };
  })();

  /* ---------- nav buttons ---------- */
  var navIcons = { back: 'back', menu: 'menu', home: 'home' };
  Array.prototype.forEach.call(document.querySelectorAll('#navbar button'), function (b) {
    var k = b.getAttribute('data-nav');
    b.innerHTML = OS.glyph(navIcons[k]);
    b.onclick = function () {
      if (OS.state === 'off') return powerOn();
      if (OS.state !== 'on' && OS.state !== 'lock') return;
      if (OS.state === 'lock') { if (k === 'back') OS.closeShade(); return; }
      if (k === 'back') OS.back();
      else if (k === 'menu') OS.menu();
      else if (k === 'home') OS.home();
    };
  });
  // keyboard: Esc = back, Home = home
  document.addEventListener('keydown', function (e) {
    if (OS.state !== 'on') return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); OS.back(); }
  });
  // phone back gesture -> fake BACK button instead of leaving the site
  try {
    history.pushState({ eclair: 1 }, '');
    window.addEventListener('popstate', function () {
      history.pushState({ eclair: 1 }, '');
      if (OS.state === 'on') OS.back(); else if (OS.state === 'lock') OS.closeShade();
    });
  } catch (e) {}

  /* ---------- power + boot ---------- */
  var booted = false;
  function powerOn() {
    OS.audioCtx(); OS.primeSpeech();
    if (!booted) return boot();
    showLock();
  }
  function powerOff() {
    OS.home(); OS.closeShade();
    setState('off');
    $('#off .off-hint').textContent = 'tap to wake';
  }
  $('#off').addEventListener('click', powerOn);
  $('#power').addEventListener('click', function (e) {
    e.stopPropagation();
    if (OS.state === 'off') powerOn(); else if (OS.state === 'on' || OS.state === 'lock') powerOff();
  });

  function boot() {
    booted = true;
    setState('boot');
    var b = $('#boot');
    b.innerHTML = '<div class="boot-text">' + OS.esc(P.bootText || 'android') + '</div>' +
      '<img class="boot-img" src="media/boot/boot.png" alt="" onerror="this.remove()">';
    OS.sfx('boot');
    OS.preloadIcons(function () {
      buildHome(); buildDrawer();
      setTimeout(showLock, 3200);
    });
  }

  /* ---------- lock screen ---------- */
  function showLock() {
    setState('lock');
    var L = $('#lock');
    L.innerHTML =
      '<div class="lk-carrier">' + OS.esc(P.carrier || '') + '</div>' +
      '<div class="lk-time"></div><div class="lk-date"></div>' +
      (P.lockMessage ? '<div class="lk-msg">' + OS.esc(P.lockMessage) + '</div>' : '') +
      '<div class="lk-hint">Drag to unlock</div>' +
      '<div class="lk-bar"><div class="lk-track"></div>' +
      '<div class="lk-tab left">' + OS.glyph('lock') + '</div>' +
      '<div class="lk-tab right">' + OS.glyph(OS.silent ? 'silent' : 'sound') + '</div></div>';
    tickClock();
    var bar = $('.lk-bar', L);
    dragTab($('.lk-tab.left', L), bar, 1, unlock);
    dragTab($('.lk-tab.right', L), bar, -1, function () {
      OS.setSilent(!OS.silent);
      $('.lk-tab.right', L).innerHTML = OS.glyph(OS.silent ? 'silent' : 'sound');
      OS.toast(OS.silent ? 'Silent mode on' : 'Silent mode off');
    });
  }
  function dragTab(tab, bar, dir, onDone) {
    var sx = 0, dx = 0, dragging = false;
    tab.addEventListener('pointerdown', function (e) {
      dragging = true; sx = e.clientX; dx = 0;
      tab.setPointerCapture(e.pointerId); tab.classList.add('drag'); bar.classList.add(dir > 0 ? 'dragL' : 'dragR');
      OS.audioCtx(); OS.primeSpeech();
    });
    tab.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var max = bar.clientWidth - tab.clientWidth;
      dx = Math.max(0, Math.min(max, (e.clientX - sx) / OS.scale * dir));
      tab.style.transform = 'translateX(' + (dx * dir) + 'px)';
    });
    function up() {
      if (!dragging) return;
      dragging = false;
      tab.classList.remove('drag'); bar.classList.remove('dragL', 'dragR');
      var max = bar.clientWidth - tab.clientWidth;
      var hit = dx > max * 0.7;
      tab.style.transition = 'transform .2s'; tab.style.transform = '';
      setTimeout(function () { tab.style.transition = ''; }, 220);
      dx = 0;
      if (hit) onDone();
    }
    tab.addEventListener('pointerup', up);
    tab.addEventListener('pointercancel', up);
  }
  var unlockedOnce = false;
  function unlock() {
    OS.sfx('unlock');
    setState('on');
    $('#lock').innerHTML = '';
    if (!unlockedOnce) { unlockedOnce = true; OS.emit('unlocked'); }
  }

  /* ---------- home screen ---------- */
  function iconButton(app) {
    var b = OS.el('button', 'icon-wrap', OS.iconHTML(app) + '<span class="icon-label">' + OS.esc(app.name) + '</span><span class="badge"></span>');
    b.setAttribute('data-app', app.id);
    b.onclick = function () {
      if (b._noClick) { b._noClick = false; return; }
      OS.open(app.id);
    };
    return b;
  }

  /* ---------- home layout (4x4 grid, saved per visitor) ---------- */
  var COLS = 4, ROWS = 4, SLOTS = COLS * ROWS;
  function defaultLayout() {
    var l = [];
    for (var i = 0; i < SLOTS; i++) l.push(null);
    ((C.home || {}).icons || []).forEach(function (id, i) { if (i < SLOTS) l[i] = id || null; });
    return l;
  }
  function getLayout() {
    var l = OS.store.get('homeLayout', null);
    if (!l || l.length !== SLOTS) l = defaultLayout();
    return l.map(function (id) { return id && OS.apps[id] ? id : null; });
  }
  function saveLayout(l) { OS.store.set('homeLayout', l); }
  OS.resetHome = function () { OS.store.set('homeLayout', null); buildHome(); OS.toast('Home screen reset'); };

  /* ---------- long-press to pick up an icon ---------- */
  var HOLD_MS = 450, drag = null;
  function holdable(btn, src) {
    var t = null, sx = 0, sy = 0;
    btn.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      sx = e.clientX; sy = e.clientY;
      btn.classList.add('pressing');
      clearTimeout(t);
      t = setTimeout(function () {
        t = null; btn.classList.remove('pressing');
        btn._noClick = true;
        startDrag(src, btn, sx, sy);
      }, HOLD_MS);
    });
    function cancel() { if (t) { clearTimeout(t); t = null; } btn.classList.remove('pressing'); }
    btn.addEventListener('pointermove', function (e) {
      if (t && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel();
    });
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('pointerleave', cancel);
  }

  function startDrag(src, btn, x, y) {
    var app = OS.apps[src.app];
    if (!app) return;
    try { navigator.vibrate && navigator.vibrate(35); } catch (e) {}
    if (src.from === 'drawer') OS.closeDrawer();
    var ghost = OS.el('div', 'drag-ghost', OS.iconHTML(app));
    ghost.style.transform = 'translate(-50%, -50%) scale(' + (OS.scale * 1.2) + ')';
    document.body.appendChild(ghost);
    if (src.from === 'home') btn.classList.add('lifted');
    $('#home').classList.add('editing');
    drag = { src: src, btn: btn, ghost: ghost, target: null };
    moveDrag(x, y);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragCancel);
  }
  function onDragMove(e) { e.preventDefault(); moveDrag(e.clientX, e.clientY); }
  function moveDrag(x, y) {
    drag.ghost.style.left = x + 'px';
    drag.ghost.style.top = y + 'px';
    var hit = document.elementFromPoint(x, y), tgt = null;
    if (hit) tgt = hit.closest('.trash') || hit.closest('.slot');
    if (tgt !== drag.target) {
      if (drag.target) drag.target.classList.remove('over');
      drag.target = tgt;
      if (tgt) tgt.classList.add('over');
    }
  }
  function endDragUI() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragCancel);
    if (drag.target) drag.target.classList.remove('over');
    drag.ghost.remove();
    drag.btn.classList.remove('lifted');
    $('#home').classList.remove('editing');
  }
  function onDragCancel() { endDragUI(); drag = null; }
  function onDragEnd() {
    var d = drag; endDragUI(); drag = null;
    var tgt = d.target, l = getLayout();
    if (!tgt) return;
    if (tgt.classList.contains('trash')) {
      if (d.src.from === 'home') { l[d.src.index] = null; saveLayout(l); buildHome(); OS.toast(OS.apps[d.src.app].name + ' removed from Home'); }
      return;
    }
    var j = +tgt.getAttribute('data-i');
    if (d.src.from === 'home') {
      var i = d.src.index;
      if (i === j) return;
      var tmp = l[j]; l[j] = l[i]; l[i] = tmp;               // swap with whatever was there
    } else {
      var k = l.indexOf(d.src.app);
      if (k === j) return;
      if (k >= 0) { l[k] = l[j]; l[j] = d.src.app; }          // already on home: move it
      else if (l[j] === null) l[j] = d.src.app;
      else {
        var free = l.indexOf(null);
        if (free < 0) { OS.toast('No more room on this Home screen.'); return; }
        l[free] = l[j]; l[j] = d.src.app;                    // bump the old icon to a free spot
      }
    }
    saveLayout(l); buildHome();
    OS.emit('home-rearranged');
  }
  // stop the browser's long-press menu from popping up over the phone
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('#device')) e.preventDefault(); });
  /* ---------- weekly show countdown (computed in the show's time zone) ---------- */
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var zfmt = {};
  function zoneParts(ts, tz) {
    var f = zfmt[tz] || (zfmt[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'long',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
    var o = {};
    f.formatToParts(new Date(ts)).forEach(function (x) { o[x.type] = x.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: DAYS.indexOf(o.weekday.toLowerCase()) };
  }
  function zoneOffset(ts, tz) {
    var q = zoneParts(ts, tz);
    return Date.UTC(q.y, q.m - 1, q.d, q.h, q.mi, q.s) - Math.floor(ts / 1000) * 1000;
  }
  function zonedToUtc(y, m, d, h, mi, tz) {          // wall-clock time in tz -> real timestamp
    var guess = Date.UTC(y, m - 1, d, h, mi);
    return guess - zoneOffset(guess - zoneOffset(guess, tz), tz);
  }
  OS.nextShow = function (now) {
    var w = (C.show || {}).weekly;
    if (!w) return null;
    now = now || Date.now();
    var tz = w.timeZone || 'America/Chicago';
    var day = DAYS.indexOf(String(w.weekday || 'wednesday').toLowerCase());
    var hm = String(w.time || '20:00').split(':');
    var live = (w.liveHours == null ? 3 : w.liveHours) * 3600000;
    var q = zoneParts(now, tz), ahead = (day - q.wd + 7) % 7;
    var starts = [-7, 0, 7].map(function (k) { return zonedToUtc(q.y, q.m, q.d + ahead + k, +hm[0], +hm[1] || 0, tz); });
    for (var i = 0; i < starts.length; i++) {
      if (now < starts[i] + live) return { start: starts[i], live: now >= starts[i], tz: tz };
    }
    return null;
  };
  // wall-clock time in a time zone -> real timestamp (used by trophies for show-night windows)
  OS.zonedToUtc = function (y, m, d, h, mi, tz) { return zonedToUtc(y, m, d, h || 0, mi || 0, tz || ((C.show || {}).weekly || {}).timeZone || 'America/Chicago'); };
  // start of the most recent show day (midnight, show time zone). Used for the weekly reset.
  OS.lastShowDay = function (now) {
    var w = (C.show || {}).weekly;
    if (!w) return 0;
    now = now || Date.now();
    var tz = w.timeZone || 'America/Chicago';
    var day = DAYS.indexOf(String(w.weekday || 'wednesday').toLowerCase());
    var q = zoneParts(now, tz), back = (q.wd - day + 7) % 7;
    return zonedToUtc(q.y, q.m, q.d - back, 0, 0, tz);
  };
  function showWhenText() {
    var w = (C.show || {}).weekly || {};
    var hm = String(w.time || '20:00').split(':'), h = +hm[0], mi = hm[1] || '00';
    return String(w.weekday || '').slice(0, 3).toUpperCase() + ' ' + ((h % 12) || 12) + ':' + mi + ' ' + (h < 12 ? 'AM' : 'PM') +
      (w.zoneLabel ? ' ' + w.zoneLabel : '');
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function tickCountdown() {
    var el = document.querySelector('.w-count');
    if (!el) return;
    var ns = OS.nextShow();
    el.classList.toggle('live', !!(ns && ns.live));
    if (!ns || ns.live) return;
    var t = Math.max(0, Math.floor((ns.start - Date.now()) / 1000));
    var v = { d: Math.floor(t / 86400), h: pad(Math.floor(t / 3600) % 24), m: pad(Math.floor(t / 60) % 60), s: pad(t % 60) };
    Object.keys(v).forEach(function (k) { var b = el.querySelector('[data-u="' + k + '"]'); if (b.textContent != v[k]) b.textContent = v[k]; });
  }
  OS.countdownText = function () {               // e.g. "2d 04h 13m" for other apps to reuse
    var ns = OS.nextShow();
    if (!ns) return '';
    if (ns.live) return (C.show || {}).liveText || 'LIVE NOW';
    var t = Math.floor((ns.start - Date.now()) / 1000);
    return Math.floor(t / 86400) + 'd ' + pad(Math.floor(t / 3600) % 24) + 'h ' + pad(Math.floor(t / 60) % 60) + 'm';
  };

  function buildHome() {
    var H = $('#home');
    H.innerHTML = '';
    var w = OS.el('div', 'home-widgets');
    var s = C.show || {};
    var cell = function (u, label) { return '<div class="wc-cell"><b data-u="' + u + '">--</b><small>' + label + '</small></div>'; };
    var sw = OS.el('button', 'w-count',
      '<div class="wc-head"><span class="wc-name">' + OS.esc(s.name || '') + '</span><span class="wc-tag">NEXT SHOW</span></div>' +
      '<div class="wc-digits">' + cell('d', 'DAYS') + '<i>:</i>' + cell('h', 'HRS') + '<i>:</i>' + cell('m', 'MIN') + '<i>:</i>' + cell('s', 'SEC') + '</div>' +
      '<div class="wc-live">' + OS.esc(s.liveText || 'LIVE NOW') + '</div>' +
      '<div class="wc-foot"><b>' + OS.esc(showWhenText()) + '</b><span>' + OS.esc(s.venue || '') + '</span></div>');
    sw.onclick = function () {
      var ns = OS.nextShow(), text = (s.venue || '') + '\nEvery ' + ((s.weekly || {}).weekday || '') + ' · ' + showWhenText().replace(/^\S+ /, '');
      if (ns && !ns.live) {
        var local = new Date(ns.start);
        text += '\n\nNext show: ' + local.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) +
          ', ' + OS.fmtTime(local) + ' your time\n(' + OS.countdownText() + ' from now)';
      } else if (ns) text += '\n\nThe show is on right now.';
      var btns = [{ label: 'OK' }];
      if (s.ticketsUrl) btns.unshift({ label: 'Tickets', action: function () { window.open(s.ticketsUrl, '_blank', 'noopener'); } });
      OS.dialog({ title: s.name, text: text, buttons: btns });
      OS.emit('countdown-tapped');
    };
    w.appendChild(sw);
    H.appendChild(w);

    var grid = OS.el('div', 'home-grid');
    grid.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
    grid.style.gridTemplateRows = 'repeat(' + ROWS + ', minmax(0, 1fr))';
    getLayout().forEach(function (id, i) {
      var slot = OS.el('div', 'slot');
      slot.setAttribute('data-i', i);
      if (id) {
        var b = iconButton(OS.apps[id]);
        holdable(b, { from: 'home', index: i, app: id });
        slot.appendChild(b);
      }
      grid.appendChild(slot);
    });
    H.appendChild(grid);

    var dock = OS.el('div', 'dock');
    var d = (C.home || {}).dock || [];
    if (OS.apps[d[0]]) dock.appendChild(iconButton(OS.apps[d[0]])); else dock.appendChild(OS.el('div', 'dock-space'));
    var handle = OS.el('button', 'drawer-handle trash',
      '<svg class="h-dots" viewBox="0 0 24 24">' + dots() + '</svg>' +
      '<svg class="h-trash glyph" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>');
    handle.onclick = OS.openDrawer;
    dock.appendChild(handle);
    if (OS.apps[d[1]]) dock.appendChild(iconButton(OS.apps[d[1]])); else dock.appendChild(OS.el('div', 'dock-space'));
    H.appendChild(dock);
    tickCountdown();
  }
  function dots() {
    var o = '';
    for (var y = 0; y < 3; y++) for (var x = 0; x < 3; x++) o += '<rect x="' + (5 + x * 5.5) + '" y="' + (5 + y * 5.5) + '" width="3" height="3" fill="#fff"/>';
    return o;
  }
  /* ---------- app drawer (alphabetical, like Eclair) ---------- */
  function buildDrawer() {
    var D = $('#drawer');
    D.innerHTML = '';
    var grid = OS.el('div', 'drawer-grid');
    OS.appList().forEach(function (app) {
      var b = iconButton(app);
      holdable(b, { from: 'drawer', app: app.id });
      grid.appendChild(b);
    });
    D.appendChild(grid);
    var close = OS.el('button', 'drawer-handle drawer-close', '<svg viewBox="0 0 24 24">' + dots() + '</svg>');
    close.onclick = OS.closeDrawer;
    D.appendChild(close);
  }
  OS.rebuildLauncher = function () { buildHome(); buildDrawer(); };

  // unread count bubble on the Messaging icons
  // other apps can put a number on their icon too: OS.setBadge('barkpod', 2)
  OS.badges = OS.badges || {};
  OS.setBadge = function (id, n) { OS.badges[id] = n || 0; updateBadges(); };
  function updateBadges() {
    var counts = {}, k;
    for (k in OS.badges) counts[k] = OS.badges[k];
    counts.messages = OS.sms ? OS.sms.totalUnread() : 0;
    Array.prototype.forEach.call(document.querySelectorAll('.icon-wrap[data-app] .badge'), function (b) {
      var n = counts[b.parentNode.getAttribute('data-app')] || 0;
      b.textContent = n > 99 ? '99+' : n; b.classList.toggle('on', n > 0);
    });
  }
  OS.on('unread-changed', updateBadges);
  OS.on('sms-changed', updateBadges);
  OS.updateBadges = updateBadges;

  /* ---------- desktop: scale the phone body to fit the window ---------- */
  var BODY_W = 392, BODY_H = 772;
  var kbShift = 0;
  var FS_W = 332, FS_MIN_H = 520;                         // full screen mode: screen width, shortest allowed height
  var fullscreen = !!OS.store.get('fullscreen', false);
  document.body.classList.toggle('fullscreen', fullscreen);
  OS.isFullscreen = function () { return fullscreen; };
  OS.setFullscreen = function (on) {
    fullscreen = !!on; OS.store.set('fullscreen', fullscreen);
    document.body.classList.toggle('fullscreen', fullscreen);
    fit(); window.dispatchEvent(new Event('resize'));    // let games resize their canvases
  };
  function typing() { var a = document.activeElement; return a && /^(input|textarea)$/i.test(a.tagName) && a.closest('#device'); }
  function fit() {
    var c = $('#case'), vw = window.innerWidth, vh = window.innerHeight;
    if (!typing()) {
      if (fullscreen) {
        // no phone body: the screen is stretched to the window. Width stays 332 so apps look the same,
        // height grows to whatever the window's shape needs. Notch / home bar space is kept clear.
        var cs = getComputedStyle(document.body);
        vh -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        OS.scale = Math.min(vw / FS_W, vh / FS_MIN_H);
        $('#device').style.height = (vh / OS.scale) + 'px';
      } else {
        $('#device').style.height = '';
        var margin = vw < 600 ? 4 : 24;                      // phones: fill the screen; desktop: breathing room
        OS.scale = Math.min(1.2, (vh - margin * 2) / BODY_H, (vw - margin * 2) / BODY_W);
      }
    }
    // while typing on a phone, slide the whole phone up so the text box sits above the keyboard
    var shift = 0, vv = window.visualViewport;
    if (typing() && vv) {
      var r = document.activeElement.getBoundingClientRect();
      shift = Math.min(0, kbShift + (vv.height + vv.offsetTop - 10 - r.bottom));
    }
    kbShift = shift;
    c.style.transform = 'translateY(' + shift + 'px) scale(' + OS.scale + ')';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 300); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  document.addEventListener('focusin', function () { setTimeout(fit, 350); });
  document.addEventListener('focusout', function () { setTimeout(fit, 100); });
  fit();
  $('.engrave').textContent = P.bodyLabel || '';

  // browsers scroll hidden-overflow boxes to reveal a tapped or focused element
  // (keyboard opening, tapping near an edge). The phone's layers must never scroll.
  ['#screen', '#stage', '#device', '#case'].forEach(function (sel) {
    var el = $(sel);
    if (el) el.addEventListener('scroll', function () { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } });
  });

  /* ---------- long-press empty home screen -> "Add to Home screen" ---------- */
  (function () {
    var H = $('#home'), t = null, sx = 0, sy = 0;
    H.addEventListener('pointerdown', function (e) {
      if (OS.state !== 'on' || e.target.closest('.icon-wrap, .w-count, .drawer-handle')) return;
      sx = e.clientX; sy = e.clientY;
      clearTimeout(t);
      t = setTimeout(function () {
        t = null;
        try { if (navigator.vibrate) navigator.vibrate(35); } catch (err) {}
        if (OS.addToHome) OS.addToHome();
      }, 600);
    });
    function cancel() { clearTimeout(t); t = null; }
    H.addEventListener('pointermove', function (e) { if (t && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel(); });
    H.addEventListener('pointerup', cancel);
    H.addEventListener('pointercancel', cancel);
    H.addEventListener('pointerleave', cancel);
  })();
  if (OS.applyWallpaper) OS.applyWallpaper();

  /* ---------- go ---------- */
  OS.renderNotifs();
  setInterval(tickClock, 10000);
  setInterval(tickCountdown, 1000);
  tickClock();
  OS.powerOff = powerOff;

  // ?boot skips the power-on tap (handy while testing)
  if (/[?&]boot\b/.test(location.search)) boot();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
