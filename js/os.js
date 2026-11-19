/* =====================================================================
   OS.JS — the fake Android 2.1 system: audio, storage, events,
   notifications, toasts, dialogs, menus, app launching.
   Apps register themselves with OS.registerApp({...}).
   ===================================================================== */
(function () {
  'use strict';
  var C = window.PHONE_CONTENT || {};
  var OS = window.OS = { C: C };

  /* ---------- tiny helpers ---------- */
  var $ = OS.$ = function (s, r) { return (r || document).querySelector(s); };
  OS.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  OS.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  // encode each piece of a path so spaces and # in file names work
  OS.url = function (p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    return p.split('/').map(encodeURIComponent).join('/');
  };
  OS.natSort = function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); };

  /* ---------- storage ---------- */
  var PREFIX = 'eclair:';
  OS.store = {
    get: function (k, d) { try { var v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} },
    clear: function () {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); }); } catch (e) {}
    }
  };
  OS.flag = function (n) { return !!OS.store.get('flags', {})[n]; };
  OS.setFlag = function (n) { var f = OS.store.get('flags', {}); f[n] = true; OS.store.set('flags', f); OS.emit('flag:' + n); };

  /* ---------- events ---------- */
  var handlers = {};
  OS.on = function (n, f) { (handlers[n] = handlers[n] || []).push(f); };
  OS.off = function (n, f) { handlers[n] = (handlers[n] || []).filter(function (x) { return x !== f; }); };
  OS.once = function (n, f) { var done = false; OS.on(n, function (d) { if (!done) { done = true; f(d); } }); };
  OS.emit = function (n, d) {
    (handlers[n] || []).slice().forEach(function (f) { try { f(d); } catch (e) { console.error(e); } });
  };

  /* ---------- icons (small system glyphs, 24x24) ---------- */
  var P = {
    sms: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    missed: 'M19.59 7L12 14.59 6.41 9H11V7H3v8h2v-4.59l7 7 9-9z',
    incoming: 'M20 5.41L18.59 4 7 15.59V9H5v10h10v-2H8.41z',
    outgoing: 'M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z',
    info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    voicemail: 'M18.5 6C15.46 6 13 8.46 13 11.5c0 1.33.47 2.55 1.26 3.5H9.74c.79-.95 1.26-2.17 1.26-3.5C11 8.46 8.54 6 5.5 6S0 8.46 0 11.5 2.46 17 5.5 17h13c3.04 0 5.5-2.46 5.5-5.5S21.54 6 18.5 6zm-13 9C3.57 15 2 13.43 2 11.5S3.57 8 5.5 8 9 9.57 9 11.5 7.43 15 5.5 15zm13 0c-1.93 0-3.5-1.57-3.5-3.5S16.57 8 18.5 8 22 9.57 22 11.5 20.43 15 18.5 15z',
    phone: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
    back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    backspace: 'M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    sound: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    silent: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    mute: 'M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z',
    contacts: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    log: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    up: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
    down: 'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z',
    directions: 'M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z',
    podcast: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
    download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    dialpad: 'M12 19c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'
  };
  OS.glyph = function (name, cls) {
    return '<svg class="glyph ' + (cls || '') + '" viewBox="0 0 24 24"><path d="' + (P[name] || P.info) + '"/></svg>';
  };

  /* ---------- formatting ---------- */
  OS.fmtTime = function (d) {
    d = d || new Date();
    var h = d.getHours(), m = ('0' + d.getMinutes()).slice(-2);
    if ((C.phone || {}).use24h) return h + ':' + m;
    return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  OS.fmtWhen = function (ts) {
    var d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return OS.fmtTime(d);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  OS.digits = function (s) { return String(s || '').replace(/\D/g, ''); };
  OS.fmtNumber = function (s) {
    var d = OS.digits(s);
    if (/[*#]/.test(s)) return s;
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    if (d.length === 7) return d.slice(0, 3) + '-' + d.slice(3);
    return s;
  };

  /* ---------- contacts ---------- */
  OS.contacts = (C.contacts || []).slice();
  OS.contact = function (id) { return OS.contacts.filter(function (c) { return c.id === id; })[0] || null; };
  OS.findByNumber = function (num) {
    var d = OS.digits(num);
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (!d) return null;
    return OS.contacts.filter(function (c) {
      var cd = OS.digits(c.number);
      if (cd.length === 11 && cd[0] === '1') cd = cd.slice(1);
      return cd === d || (d.length === 7 && cd.slice(-7) === d);
    })[0] || null;
  };
  OS.avatar = function (c, size) {
    c = c || {};
    var name = c.name || '?';
    var src = c.avatar || (c.id ? 'media/avatars/' + c.id + '.jpg' : '');
    var s = size ? ' style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px"' : '';
    var ch = name.charAt(0).toUpperCase();
    var face = /[A-Z]/.test(ch) ? OS.esc(ch) : OS.glyph('contacts', 'av-g');
    return '<div class="avatar"' + s + '><span>' + face + '</span>' +
      (src ? '<img src="' + OS.url(src) + '" alt="" onerror="this.remove()">' : '') + '</div>';
  };

  /* ---------- audio ---------- */
  var actx = null;
  OS.audioCtx = function () {
    if (!actx) { var A = window.AudioContext || window.webkitAudioContext; if (A) { try { actx = new A(); } catch (e) {} } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  };
  OS.silent = OS.store.get('silent', false);
  OS.setSilent = function (v) { OS.silent = !!v; OS.store.set('silent', OS.silent); OS.emit('silent', OS.silent); };

  function beep(freqs, dur, when, vol) {
    var ctx = OS.audioCtx(); if (!ctx) return;
    when = when || 0; vol = vol == null ? 0.12 : vol;
    var t = ctx.currentTime + when, g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.02));
    g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(ctx.destination);
    [].concat(freqs).forEach(function (f) {
      var o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  OS.beep = beep;
  var SYNTH = {
    notify: function () { beep(880, 0.1); beep(1320, 0.16, 0.12); },
    unlock: function () { beep(1500, 0.04, 0, 0.06); beep(1100, 0.05, 0.05, 0.06); },
    hangup: function () { beep(480, 0.15); beep(480, 0.15, 0.25); beep(480, 0.15, 0.5); },
    ringback: function () { beep([440, 480], 2, 0, 0.08); },
    sit: function () { beep(913.8, 0.274); beep(1370.6, 0.274, 0.274); beep(1776.7, 0.38, 0.548); },
    boot: function () { beep(523, 0.15, 0, 0.06); beep(659, 0.15, 0.15, 0.06); beep(784, 0.3, 0.3, 0.06); }
  };
  var CALL_SOUNDS = { hangup: 1, ringback: 1, sit: 1 };   // play even in silent mode
  var missing = {};
  OS.sfx = function (name) {
    if (OS.silent && !CALL_SOUNDS[name]) return;
    var file = (C.sounds || {})[name];
    if (file && !missing[name]) {
      var a = new Audio(OS.url(file));
      a.onerror = function () { missing[name] = true; if (SYNTH[name]) SYNTH[name](); };
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    } else if (SYNTH[name]) SYNTH[name]();
  };
  // looping sound (ringback). returns a stop() function
  OS.loopSound = function (name, synthEverySec) {
    var stopped = false, a = null, iv = null, file = (C.sounds || {})[name];
    function synth() {
      if (stopped || !SYNTH[name]) return;
      SYNTH[name](); iv = setInterval(function () { SYNTH[name](); }, synthEverySec * 1000);
    }
    if (file && !missing[name]) {
      a = new Audio(OS.url(file)); a.loop = true;
      a.onerror = function () { missing[name] = true; a = null; synth(); };
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    } else synth();
    return function () {
      stopped = true;
      if (a) { a.onerror = null; a.pause(); }
      if (iv) clearInterval(iv);
    };
  };
  OS.scale = 1;   // desktop phone body is scaled to fit the window; drag maths divide by this
  var DTMF = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477] };
  OS.dtmf = function (k) { if (!OS.silent && DTMF[k]) beep(DTMF[k], 0.12, 0, 0.08); };

  OS.speak = function (text, onend) {
    var finished = false;
    function fin() { if (finished) return; finished = true; if (onend) onend(); }
    try {
      if (!('speechSynthesis' in window)) throw 0;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
      // safety net in case the browser never fires onend
      var t = setTimeout(fin, 4000 + text.length * 110);
      return function () { finished = true; clearTimeout(t); try { speechSynthesis.cancel(); } catch (e) {} };
    } catch (e) {
      var t2 = setTimeout(fin, Math.max(2000, text.length * 60));
      return function () { finished = true; clearTimeout(t2); };
    }
  };
  // iOS needs audio + speech "touched" during a real tap before they'll play later
  OS.primeSpeech = function () {
    try { if ('speechSynthesis' in window) { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
  };
  OS.primeAudio = function (file) {
    if (!file) return null;
    var a = new Audio(OS.url(file));
    a.muted = true;
    var p = a.play();
    if (p && p.then) p.then(function () { a.pause(); a.currentTime = 0; a.muted = false; }).catch(function () { a.muted = false; });
    else a.muted = false;
    return a;
  };
  // play a voice file; if it's missing, read `text` aloud instead.
  OS.playVoice = function (file, text, onend, primed) {
    var done = false, stopFn = function () {}, audio = null;
    function fin() { if (done) return; done = true; if (onend) onend(); }
    function fallback() {
      if (done) return;
      if (text) stopFn = OS.speak(text, fin);
      else { var t = setTimeout(fin, 1500); stopFn = function () { clearTimeout(t); }; }
    }
    if (file) {
      audio = primed || new Audio(OS.url(file));
      audio.muted = false;
      if (audio.error) { audio = null; fallback(); }
      else {
        audio.onended = fin;
        audio.onerror = function () { audio.onerror = null; fallback(); };
        var p = audio.play();
        if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotAllowedError') fallback(); });
        stopFn = function () { audio.onended = null; audio.onerror = null; audio.pause(); };
      }
    } else fallback();
    return {
      stop: function () { done = true; stopFn(); },
      setMuted: function (m) { if (audio) audio.volume = m ? 0 : 1; }
    };
  };

  /* ---------- toast ---------- */
  var toastT = null;
  OS.toast = function (text) {
    var t = $('#toast');
    t.textContent = text; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, Math.max(2000, String(text).length * 70));
  };

  /* ---------- dialog ---------- */
  var dialogOpen = false;
  OS.dialog = function (o) {
    var d = $('#dialog');
    d.innerHTML = '';
    var box = OS.el('div', 'dlg');
    if (o.title) box.appendChild(OS.el('div', 'dlg-title', OS.glyph('info') + OS.esc(o.title)));
    box.appendChild(OS.el('div', 'dlg-body', OS.esc(o.text || '').replace(/\n/g, '<br>')));
    var btns = OS.el('div', 'dlg-btns');
    (o.buttons || [{ label: 'OK' }]).forEach(function (b) {
      var btn = OS.el('button', 'btn', OS.esc(b.label));
      btn.onclick = function () { OS.closeDialog(); if (b.action) b.action(); };
      btns.appendChild(btn);
    });
    box.appendChild(btns);
    d.appendChild(box);
    d.onclick = null;
    d.classList.add('on'); dialogOpen = true;
  };
  // Android-style list dialog (icon + label rows); tap outside to cancel
  OS.listDialog = function (o) {
    var d = $('#dialog');
    d.innerHTML = '';
    var box = OS.el('div', 'dlg');
    box.appendChild(OS.el('div', 'dlg-title', OS.esc(o.title || '')));
    var list = OS.el('div', 'dlg-list');
    (o.items || []).forEach(function (it) {
      var r = OS.el('button', 'dl-row', '<span class="dl-ico">' + (it.icon || '') + '</span><span>' + OS.esc(it.label) + '</span>');
      r.onclick = function (e) { e.stopPropagation(); OS.closeDialog(); if (it.action) it.action(); };
      list.appendChild(r);
    });
    box.appendChild(list);
    d.appendChild(box);
    d.onclick = function (e) { if (e.target === d) OS.closeDialog(); };
    d.classList.add('on'); dialogOpen = true;
  };
  OS.closeDialog = function () { $('#dialog').classList.remove('on'); dialogOpen = false; };

  /* ---------- options menu (MENU button) ---------- */
  var menuOpen = false;
  OS.showMenu = function (items) {
    var m = $('#menu');
    if (!items || !items.length) return;
    m.innerHTML = '';
    var panel = OS.el('div', 'menu-panel');
    items.forEach(function (it) {
      var b = OS.el('button', 'menu-item', OS.esc(it.label));
      b.onclick = function (e) { e.stopPropagation(); OS.closeMenu(); it.action(); };
      panel.appendChild(b);
    });
    m.appendChild(panel);
    m.onclick = OS.closeMenu;
    m.classList.add('on'); menuOpen = true;
  };
  OS.closeMenu = function () { $('#menu').classList.remove('on'); menuOpen = false; };

  /* ---------- notifications + status bar ---------- */
  OS.notifs = [];
  var nid = 0;
  OS.notify = function (n) {
    n.id = ++nid; n.time = Date.now();
    if (n.replace && n.tag) OS.notifs = OS.notifs.filter(function (x) { return x.tag !== n.tag; });
    OS.notifs.unshift(n);
    renderNotifs();
    if (n.quiet) return n.id;
    ticker(n);
    OS.sfx('notify');
    try { if (!OS.silent && navigator.vibrate) navigator.vibrate([0, 180, 90, 180]); } catch (e) {}
    return n.id;
  };
  OS.clearNotifs = function (tag) {
    OS.notifs = OS.notifs.filter(function (n) { return tag ? n.tag !== tag : n.sticky; });
    renderNotifs();
  };
  function ticker(n) {
    var t = $('#sb-ticker');
    t.innerHTML = '';
    var span = OS.el('span', '', OS.glyph(n.icon || 'info') + '<b>' + OS.esc(n.title) + ':</b> ' + OS.esc(n.text || ''));
    t.appendChild(span);
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(ticker.t);
    ticker.t = setTimeout(function () { t.classList.remove('on'); }, 3600);
  }
  function renderNotifs() {
    var icons = [], seen = {};
    OS.notifs.forEach(function (n) { var i = n.icon || 'info'; if (!seen[i]) { seen[i] = 1; icons.push(OS.glyph(i)); } });
    $('#sb-icons').innerHTML = icons.slice(0, 5).join('');
    var list = $('#shade-list');
    list.innerHTML = '';
    OS.notifs.forEach(function (n) {
      var row = OS.el('div', 'notif',
        '<div class="n-ico">' + OS.glyph(n.icon || 'info') + '</div>' +
        '<div class="n-body"><div class="n-title">' + OS.esc(n.title) + '</div><div class="n-text">' + OS.esc(n.text || '') + '</div></div>' +
        '<div class="n-time">' + OS.fmtTime(new Date(n.time)) + '</div>');
      row.onclick = function () {
        OS.notifs = OS.notifs.filter(function (x) { return x !== n; });
        renderNotifs(); OS.closeShade();
        if (n.onTap) n.onTap();
      };
      list.appendChild(row);
    });
    $('#shade').classList.toggle('empty', !OS.notifs.length);
    document.documentElement.classList.toggle('has-notif', OS.notifs.length > 0);   // blinks the body LED
  }
  OS.renderNotifs = renderNotifs;

  // notification shade: tap or drag the status bar down
  var shadeOpen = false;
  OS.openShade = function () { if (document.body.classList.contains('state-on') || document.body.classList.contains('state-lock')) { $('#shade').classList.add('open'); shadeOpen = true; } };
  OS.closeShade = function () { $('#shade').classList.remove('open'); shadeOpen = false; };

  /* ---------- apps ---------- */
  var apps = {}, order = [];
  OS.apps = apps;
  OS.registerApp = function (def) { apps[def.id] = def; order.push(def.id); };
  OS.appList = function () {
    return order.map(function (id) { return apps[id]; }).filter(function (a) { return !a.hidden; })
      .sort(function (a, b) { return OS.natSort(a.name, b.name); });
  };
  var iconOverride = {};
  OS.preloadIcons = function (done) {
    var ids = order.slice(), left = ids.length, finished = false;
    function one() { if (--left <= 0 && !finished) { finished = true; done(); } }
    if (!left) return done();
    setTimeout(function () { if (!finished) { finished = true; done(); } }, 1500);
    ids.forEach(function (id) {
      var img = new Image();
      img.onload = function () { iconOverride[id] = img.src; one(); };
      img.onerror = one;
      img.src = 'media/icons/' + id + '.png';
    });
  };
  OS.iconHTML = function (app) {
    return '<div class="icon">' + (iconOverride[app.id] ? '<img src="' + iconOverride[app.id] + '" alt="">' : (app.icon || '')) + '</div>';
  };

  var current = null;
  OS.current = function () { return current; };
  OS.open = function (id, args) {
    var app = apps[id];
    if (!app) { OS.toast('Application not installed'); return; }
    if (app.alias) { OS.open(app.alias, Object.assign({}, app.aliasArgs || {}, args || {})); OS.emit('opened:' + id, args); return; }
    OS.closeShade(); OS.closeMenu(); OS.closeDrawer();
    closeCurrent();
    var view = $('#appview');
    view.innerHTML = '';
    var root = OS.el('div', 'app app-' + id);
    view.appendChild(root);
    view.classList.remove('open'); void view.offsetWidth; view.classList.add('open');
    current = { id: id, root: root, inst: {} };
    current.inst = app.launch(root, args || {}) || {};
    OS.emit('opened:' + id, args);
  };
  function closeCurrent() {
    if (!current) return;
    var c = current; current = null;
    try { if (c.inst.close) c.inst.close(); } catch (e) { console.error(e); }
    var v = $('#appview'); v.classList.remove('open'); v.innerHTML = '';
  }
  OS.closeApp = closeCurrent;
  OS.call = function (number) { OS.open('phone', { call: number }); };

  // drawer
  var drawerOpen = false;
  OS.openDrawer = function () { $('#drawer').classList.add('open'); drawerOpen = true; };
  OS.closeDrawer = function () { $('#drawer').classList.remove('open'); drawerOpen = false; };

  /* ---------- hardware buttons ---------- */
  OS.back = function () {
    if (dialogOpen) return OS.closeDialog();
    if (menuOpen) return OS.closeMenu();
    if (shadeOpen) return OS.closeShade();
    if (current) {
      if (current.inst.back && current.inst.back()) return;
      return closeCurrent();
    }
    if (drawerOpen) return OS.closeDrawer();
  };
  OS.home = function () { OS.closeDialog(); OS.closeMenu(); OS.closeShade(); closeCurrent(); OS.closeDrawer(); };
  OS.menu = function () {
    if (menuOpen) return OS.closeMenu();
    if (current) { if (current.inst.menu) OS.showMenu(current.inst.menu()); return; }
    OS.showMenu([
      { label: 'Wallpaper', action: function () { if (OS.chooseWallpaper) OS.chooseWallpaper(); } },
      { label: 'Notifications', action: OS.openShade },
      { label: 'Apps', action: OS.openDrawer },
      { label: 'Reset home screen', action: function () { if (OS.resetHome) OS.resetHome(); } },
      { label: 'Settings', action: function () { OS.open('settings'); } }
    ]);
  };

  /* ---------- action runner (easter eggs, dial codes) ---------- */
  OS.run = function (a) {
    if (!a) return;
    if (Array.isArray(a)) { a.forEach(OS.run); return; }
    function go() {
      switch (a.type) {
        case 'toast': OS.toast(a.text); break;
        case 'dialog': OS.dialog({ title: a.title, text: a.text, buttons: [{ label: a.button || 'OK' }] }); break;
        case 'sms': if (OS.sms) OS.sms.deliver(a.thread, a.text, a); break;
        case 'open': OS.open(a.app, a.args); break;
        case 'call': OS.call(a.number); break;
        case 'sound': OS.playVoice(a.file, a.text); break;
        case 'link': window.open(a.url, '_blank', 'noopener'); break;
        case 'flag': OS.setFlag(a.name); break;
        case 'event': OS.emit(a.name); break;
        default: if (OS.actions && OS.actions[a.type]) OS.actions[a.type](a); else console.warn('Unknown action', a);
      }
    }
    if (a.delay) setTimeout(go, a.delay * 1000); else go();
  };

  /* ---------- shared UI bits ---------- */
  OS.titleBar = function (text, iconSvg) {
    return '<div class="titlebar">' + (iconSvg ? '<span class="tb-ico">' + iconSvg + '</span>' : '') + '<span>' + OS.esc(text) + '</span></div>';
  };
})();
