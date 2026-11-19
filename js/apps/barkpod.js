/* =====================================================================
   BARKPOD — the MIC DOGS podcast, straight from the RSS feed.
   Stream any episode, or download it to listen offline (always the listener's choice).
   Remembers where you stopped, keeps playing when you leave the app,
   and puts a notification in the shade when a new episode drops.

   Feed + options:  js/content.js -> barkpod
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'barkpod';
  var CACHE = 'barkpod-audio-v1';

  var DEFAULTS = {
    name: 'BARKPOD',
    feed: 'https://feed.podbean.com/MICDOGSSA/feed.xml',
    checkMinutes: 30,      // how often to look for new episodes while the phone is open
    skipBack: 15,
    skipForward: 30
  };
  function cfg() {
    var g = C.barkpod || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }
  var K = cfg();

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="8" fill="#ff7a1a" stroke="#7a3300"/>' +
    '<rect x="4" y="4" width="40" height="20" rx="8" fill="#ffffff" opacity=".18"/>' +
    '<path d="M15 21c-5 1-6 8-4 12 2 2 4 0 5-3z" fill="#5a3418"/><path d="M33 21c5 1 6 8 4 12-2 2-4 0-5-3z" fill="#5a3418"/>' +
    '<ellipse cx="24" cy="27" rx="9.5" ry="10" fill="#c98a4b"/><ellipse cx="24" cy="32" rx="5.5" ry="4.5" fill="#f1d3ae"/>' +
    '<ellipse cx="24" cy="29.5" rx="2.4" ry="1.7" fill="#111"/><circle cx="20.3" cy="24.5" r="1.4" fill="#111"/><circle cx="27.7" cy="24.5" r="1.4" fill="#111"/>' +
    '<path d="M12 25a12 12 0 0 1 24 0" fill="none" stroke="#111" stroke-width="2.6"/>' +
    '<rect x="9" y="23" width="5" height="8" rx="2" fill="#222"/><rect x="34" y="23" width="5" height="8" rx="2" fill="#222"/></svg>';

  /* ---------- small helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function store(k, d) { return OS.store.get(ID + ':' + k, d); }
  function save(k, v) { OS.store.set(ID + ':' + k, v); }
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function fmtLen(s) {
    s = Math.round(s || 0); if (!s) return '';
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return h ? h + ' hr ' + (m ? m + ' min' : '') : m + ' min';
  }
  function fmtMB(b) { return b ? (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB') : ''; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(ms) { var d = new Date(ms); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function parseDur(t) {
    if (!t) return 0; t = String(t).trim();
    if (/^\d+$/.test(t)) return +t;
    return t.split(':').reduce(function (a, p) { return a * 60 + (+p || 0); }, 0);
  }
  function plain(html) {
    var d = new DOMParser().parseFromString('<div>' + (html || '').replace(/<br\s*\/?>|<\/p>/gi, '\n') + '</div>', 'text/html');
    return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- the feed ---------- */
  var feed = store('feed', null);           // last good copy, so the list works offline too
  var loading = null;
  function itunes(el, tag) { var n = el.getElementsByTagName('itunes:' + tag)[0]; return n || null; }
  function parse(xml) {
    var d = new DOMParser().parseFromString(xml, 'text/xml');
    var ch = d.querySelector('channel'); if (!ch) throw new Error('not a podcast feed');
    var img = itunes(ch, 'image'), chImg = (img && img.getAttribute('href')) || ($('image url', ch) || {}).textContent || '';
    var eps = Array.prototype.map.call(d.querySelectorAll('item'), function (it) {
      var enc = it.querySelector('enclosure'); if (!enc) return null;
      var eImg = itunes(it, 'image'), sum = itunes(it, 'summary');
      var desc = plain(($('description', it) || sum || {}).textContent || '');
      var g = ($('guid', it) || {}).textContent || enc.getAttribute('url');
      return {
        id: g.trim(), title: (($('title', it) || {}).textContent || 'Episode').trim(),
        date: Date.parse(($('pubDate', it) || {}).textContent || '') || 0,
        dur: parseDur((itunes(it, 'duration') || {}).textContent),
        url: enc.getAttribute('url'), size: +enc.getAttribute('length') || 0,
        image: eImg ? eImg.getAttribute('href') : '',
        desc: desc.length > 2000 ? desc.slice(0, 2000) + '…' : desc
      };
    }).filter(Boolean).sort(function (a, b) { return b.date - a.date; });
    return { title: (($('title', ch) || {}).textContent || K.name).trim(), image: chImg,
      author: ((itunes(ch, 'author') || {}).textContent || '').trim(), eps: eps, fetched: Date.now() };
  }
  function refresh() {
    if (loading) return loading;
    loading = fetch(K.feed, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (xml) {
      var f = parse(xml), known = store('known', null), isNew = store('new', []);
      if (known) {
        var fresh = f.eps.filter(function (e) { return known.indexOf(e.id) < 0; });
        fresh.forEach(function (e) { if (isNew.indexOf(e.id) < 0) isNew.push(e.id); });
        if (fresh.length) {
          var e0 = fresh[0];
          OS.notify({ title: fresh.length > 1 ? fresh.length + ' new episodes' : 'New episode', text: e0.title, icon: 'podcast', tag: 'barkpod-new', replace: true,
            onTap: function () { OS.open(ID, { episode: e0.id }); } });
        }
      } else if (f.eps[0]) isNew = [f.eps[0].id];              // first time: just the newest gets a NEW tag
      save('known', f.eps.map(function (e) { return e.id; }));
      save('new', isNew.filter(function (id) { return f.eps.some(function (e) { return e.id === id; }); }));
      feed = f; save('feed', f); badge();
      OS.emit('barkpod-feed');
      return f;
    }).then(function (f) { loading = null; return f; }, function (e) { loading = null; throw e; });
    return loading;
  }
  function episode(id) { return feed ? feed.eps.filter(function (e) { return e.id === id; })[0] || null : null; }
  function isNewEp(id) { return store('new', []).indexOf(id) >= 0; }
  function clearNew(id) { save('new', store('new', []).filter(function (x) { return x !== id; })); badge(); }
  function badge() { if (OS.setBadge) OS.setBadge(ID, store('new', []).length); }

  /* ---------- downloads (saved in the browser's cache storage, never automatic) ---------- */
  var dlMeta = store('dl', {});              // id -> { bytes, at }
  var active = {};                           // id -> { got, total, ctrl }
  function isDownloaded(id) { return !!dlMeta[id]; }
  function dlBytes() { var t = 0; for (var k in dlMeta) t += dlMeta[k].bytes || 0; return t; }
  function startDownload(ep) {
    if (active[ep.id] || isDownloaded(ep.id) || !window.caches) return;
    var st = active[ep.id] = { got: 0, total: ep.size || 0, ctrl: window.AbortController ? new AbortController() : null };
    OS.emit('barkpod-dl', ep.id);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    var last = 0;
    function tick() { var now = Date.now(); if (now - last > 400) { last = now; OS.emit('barkpod-dl', ep.id); } }
    fetch(ep.url, st.ctrl ? { signal: st.ctrl.signal } : {}).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      st.total = +r.headers.get('content-length') || st.total;
      var type = r.headers.get('content-type') || 'audio/mpeg';
      return caches.open(CACHE).then(function (cache) {
        if (window.TransformStream && r.body && r.body.pipeThrough) {
          // stream straight to storage (an episode can be 200 MB; never hold it all in memory)
          var counted = r.body.pipeThrough(new TransformStream({ transform: function (chunk, c) { st.got += chunk.byteLength; tick(); c.enqueue(chunk); } }));
          return cache.put(ep.url, new Response(counted, { headers: { 'Content-Type': type } }));
        }
        return r.blob().then(function (b) { st.got = b.size; return cache.put(ep.url, new Response(b, { headers: { 'Content-Type': type } })); });
      });
    }).then(function () {
      delete active[ep.id];
      dlMeta[ep.id] = { bytes: st.got || st.total, at: Date.now() }; save('dl', dlMeta);
      OS.emit('barkpod-dl', ep.id);
      var c = OS.current();
      if (c && c.id === ID) OS.toast('Downloaded');
      else OS.notify({ title: 'Download complete', text: ep.title, icon: 'download', quiet: true, onTap: function () { OS.open(ID, { episode: ep.id }); } });
    }).catch(function (e) {
      var cancelled = st.cancelled;
      delete active[ep.id];
      if (window.caches) caches.open(CACHE).then(function (c) { c.delete(ep.url); });
      OS.emit('barkpod-dl', ep.id);
      if (!cancelled) OS.toast(/quota/i.test(e && (e.name + e.message)) ? 'Not enough space to download' : 'Download failed');
    });
  }
  function cancelDownload(id) { var st = active[id]; if (st) { st.cancelled = true; if (st.ctrl) st.ctrl.abort(); } }
  function deleteDownload(ep) {
    delete dlMeta[ep.id]; save('dl', dlMeta);
    if (window.caches) caches.open(CACHE).then(function (c) { return c.delete(ep.url); });
    OS.emit('barkpod-dl', ep.id);
  }
  function askDownload(ep) {
    OS.dialog({ title: 'Download episode?', text: ep.title + '\n\n' + (ep.size ? fmtMB(ep.size) + '. ' : '') + 'Best on Wi-Fi. You can listen offline once it\'s done.',
      buttons: [{ label: 'Download', action: function () { startDownload(ep); } }, { label: 'Cancel' }] });
  }
  function askDelete(ep) {
    OS.dialog({ title: 'Remove download?', text: ep.title + '\n\nFrees ' + fmtMB(dlMeta[ep.id] && dlMeta[ep.id].bytes) + '. You can still stream it.',
      buttons: [{ label: 'Remove', action: function () { deleteDownload(ep); } }, { label: 'Keep' }] });
  }
  function askCancel(ep) {
    OS.dialog({ title: 'Stop download?', text: ep.title, buttons: [{ label: 'Stop', action: function () { cancelDownload(ep.id); } }, { label: 'Keep going' }] });
  }

  /* ---------- the player (lives outside the app so it keeps playing) ---------- */
  var audio = new Audio(); audio.preload = 'metadata';
  var nowId = null, objUrl = null, lastSave = 0;
  var positions = store('pos', {}), played = store('played', {});
  var speed = store('speed', 1);
  function savePos(force) {
    if (!nowId || !audio.duration) return;
    var now = Date.now(); if (!force && now - lastSave < 4000) return; lastSave = now;
    if (audio.currentTime > audio.duration - 15) { delete positions[nowId]; played[nowId] = 1; save('played', played); }
    else positions[nowId] = Math.floor(audio.currentTime);
    save('pos', positions);
  }
  function load(ep, autoplay) {
    if (nowId === ep.id && audio.src) { if (autoplay) play(); return; }
    savePos(true);
    nowId = ep.id; save('now', ep.id); clearNew(ep.id);
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    function setSrc(src) {
      audio.src = src; audio.playbackRate = speed;
      var resume = positions[ep.id] || 0;
      audio.addEventListener('loadedmetadata', function once() {
        audio.removeEventListener('loadedmetadata', once);
        if (resume && resume < audio.duration - 10) audio.currentTime = resume;
        audio.playbackRate = speed;
      });
      if (autoplay) play();
      mediaSession(ep);
      OS.emit('barkpod-now');
    }
    if (isDownloaded(ep.id) && window.caches) {
      caches.open(CACHE).then(function (c) { return c.match(ep.url); }).then(function (r) {
        if (!r) { delete dlMeta[ep.id]; save('dl', dlMeta); return setSrc(ep.url); }
        return r.blob().then(function (b) { objUrl = URL.createObjectURL(b); setSrc(objUrl); });
      }).catch(function () { setSrc(ep.url); });
    } else setSrc(ep.url);
  }
  function play() { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
  function toggle() { if (!audio.src) return; if (audio.paused) play(); else audio.pause(); }
  function skip(s) { if (!audio.src) return; audio.currentTime = Math.max(0, Math.min((audio.duration || 0) - 1, audio.currentTime + s)); savePos(true); }
  function setSpeed(s) { speed = s; save('speed', s); audio.playbackRate = s; }
  function nowEp() { return nowId ? episode(nowId) : null; }
  function mediaSession(ep) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    var art = ep.image || (feed && feed.image);
    navigator.mediaSession.metadata = new MediaMetadata({ title: ep.title, artist: (feed && feed.title) || K.name, album: K.name,
      artwork: art ? [{ src: art, sizes: '512x512' }] : [] });
    var ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', play); ms.setActionHandler('pause', function () { audio.pause(); });
      ms.setActionHandler('seekbackward', function () { skip(-K.skipBack); });
      ms.setActionHandler('seekforward', function () { skip(K.skipForward); });
      ms.setActionHandler('seekto', function (d) { if (d.seekTime != null) audio.currentTime = d.seekTime; });
    } catch (e) {}
  }
  function nowPlayingNote() {
    var ep = nowEp(); if (!ep) return;
    if (audio.paused) { OS.clearNotifs('barkpod-now'); return; }
    OS.notify({ title: K.name, text: ep.title, icon: 'podcast', tag: 'barkpod-now', replace: true, quiet: true,
      onTap: function () { OS.open(ID, { episode: ep.id }); } });
  }
  var listened = 0, lastT = null;
  audio.addEventListener('timeupdate', function () {
    savePos(false);
    // every 2 minutes actually listened = 1 Drink Ticket in the card game
    var now = Date.now();
    if (lastT && !audio.paused) { var dt = Math.min(5000, now - lastT) * (audio.playbackRate || 1); listened += dt; if (listened >= 120000) { listened -= 120000; OS.emit('barkpod-listened'); } }
    lastT = audio.paused ? null : now;
  });
  audio.addEventListener('pause', function () { savePos(true); nowPlayingNote(); OS.emit('barkpod-state'); });
  audio.addEventListener('play', function () { nowPlayingNote(); OS.emit('barkpod-state'); });
  audio.addEventListener('ended', function () { savePos(true); delete positions[nowId]; played[nowId] = 1; save('pos', positions); save('played', played); nowPlayingNote(); OS.emit('barkpod-state'); });
  audio.addEventListener('error', function () { if (audio.src) OS.toast('Can\'t play this episode right now'); });
  window.addEventListener('pagehide', function () { savePos(true); });

  // look for new episodes in the background while the phone is in use
  function bgCheck() { if (document.hidden) return; var f = store('feed', null); if (!f || Date.now() - f.fetched > K.checkMinutes * 60000) refresh().catch(function () {}); }
  OS.on('unlocked', function () { badge(); setTimeout(bgCheck, 4000); });
  setInterval(bgCheck, 5 * 60000);

  /* ---------- the app ---------- */
  var DL = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  var REFRESH = '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/></svg>';
  function skipIcon(n, fwd) {
    return '<svg viewBox="0 0 24 24"><path d="' + (fwd ? 'M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z' : 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z') + '"/>' +
      '<text x="12" y="16.3" text-anchor="middle" font-size="6.5" font-weight="bold" font-family="Arial">' + n + '</text></svg>';
  }

  OS.registerApp({
    id: ID, name: K.name, icon: ICON,
    launch: function (root, args) {
      K = cfg();
      root.classList.add('bp');
      var view = 'list', tab = 'eps', plEp = null, timer = null;

      function header() {
        var f = feed;
        return '<div class="bp-head">' + (f && f.image ? '<img class="bp-cover" src="' + OS.esc(f.image) + '" alt="">' : '<div class="bp-cover">' + ICON + '</div>') +
          '<div class="bp-head-t"><b>' + OS.esc(f ? f.title : K.name) + '</b>' +
          '<span>' + (f ? f.eps.length + ' episodes' + (f.author ? ' · ' + OS.esc(f.author) : '') : 'Loading…') + '</span></div>' +
          '<button class="bp-refresh" aria-label="Refresh">' + REFRESH + '</button></div>' +
          '<div class="bp-tabs"><button data-t="eps" class="' + (tab === 'eps' ? 'on' : '') + '">Episodes</button>' +
          '<button data-t="dl" class="' + (tab === 'dl' ? 'on' : '') + '">Downloads' + (Object.keys(dlMeta).length ? ' (' + Object.keys(dlMeta).length + ')' : '') + '</button></div>';
      }
      function rowHTML(ep) {
        var st = active[ep.id], done = isDownloaded(ep.id), pos = positions[ep.id], isP = played[ep.id];
        var sub = [fmtDate(ep.date), fmtLen(ep.dur)].filter(Boolean).join(' · ');
        var tag = isNewEp(ep.id) ? '<i class="bp-new">NEW</i>' : isP ? '<i class="bp-played">Played</i>' : pos && ep.dur ? '<i class="bp-left">' + fmtLen(ep.dur - pos) + ' left</i>' : '';
        var btn = st ? '<button class="bp-dl busy" aria-label="Downloading"><span>' + (st.total ? Math.floor(st.got / st.total * 100) : 0) + '%</span></button>'
          : done ? '<button class="bp-dl done" aria-label="Downloaded">' + CHECK + '</button>'
          : '<button class="bp-dl" aria-label="Download">' + DL + '</button>';
        var prog = pos && ep.dur && !isP ? '<div class="bp-prog"><i style="width:' + Math.min(100, pos / ep.dur * 100).toFixed(1) + '%"></i></div>' : '';
        return '<div class="bp-row' + (isP ? ' played' : '') + (nowId === ep.id ? ' now' : '') + '" data-id="' + OS.esc(ep.id) + '">' +
          '<div class="bp-r-main"><div class="bp-r-title">' + OS.esc(ep.title) + '</div><div class="bp-r-sub">' + sub + ' ' + tag + '</div>' + prog + '</div>' + btn + '</div>';
      }
      function mini() {
        var ep = nowEp(); if (!ep) return '';
        return '<div class="bp-mini"><div class="bp-mini-t"><b>' + OS.esc(ep.title) + '</b><span>' + fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration || ep.dur) + '</span></div>' +
          '<button class="bp-mini-play">' + (audio.paused ? PLAY : PAUSE) + '</button></div>';
      }
      function renderList() {
        view = 'list'; stopTimer();
        var sc = root.querySelector('.bp-list'), top = sc ? sc.scrollTop : 0;
        root.innerHTML = OS.titleBar(K.name) + header() + '<div class="bp-list scroll"></div>' + mini();
        var list = root.querySelector('.bp-list');
        if (!feed) list.innerHTML = '<div class="empty">' + (loadErr ? 'Can\'t reach the podcast feed.<br>Check your connection and tap refresh.' : 'Fetching episodes…') + '</div>';
        else {
          var eps = tab === 'dl' ? feed.eps.filter(function (e) { return isDownloaded(e.id) || active[e.id]; }) : feed.eps;
          if (!eps.length) list.innerHTML = '<div class="empty">No downloads yet.<br>Tap ' + DL.replace('<svg', '<svg class="inl"') + ' next to an episode to save it for offline.</div>';
          list.innerHTML += eps.map(rowHTML).join('');
          if (tab === 'dl' && eps.length) list.innerHTML += '<div class="bp-space">Using ' + fmtMB(dlBytes()) + ' on this phone</div>';
        }
        list.scrollTop = top;
        wireList();
        if (nowEp()) startTimer();
      }
      function wireList() {
        root.querySelector('.bp-refresh').onclick = function () { OS.toast('Checking for new episodes…'); doRefresh(true); };
        Array.prototype.forEach.call(root.querySelectorAll('.bp-tabs button'), function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); renderList(); }; });
        Array.prototype.forEach.call(root.querySelectorAll('.bp-row'), function (r) {
          var ep = episode(r.getAttribute('data-id'));
          r.onclick = function () { openPlayer(ep); };
          r.querySelector('.bp-dl').onclick = function (e) { e.stopPropagation(); dlButton(ep); };
        });
        var m = root.querySelector('.bp-mini');
        if (m) { m.onclick = function () { openPlayer(nowEp()); }; m.querySelector('.bp-mini-play').onclick = function (e) { e.stopPropagation(); toggle(); }; }
      }
      function dlButton(ep) {
        if (active[ep.id]) askCancel(ep);
        else if (isDownloaded(ep.id)) askDelete(ep);
        else askDownload(ep);
      }

      function openPlayer(ep) {
        if (!ep) return;
        view = 'player'; plEp = ep;
        clearNew(ep.id);                     // just looking doesn't interrupt whatever is playing
        var art = ep.image || (feed && feed.image);
        root.innerHTML = OS.titleBar(K.name) +
          '<div class="bp-pl scroll">' +
            '<div class="bp-art">' + (art ? '<img src="' + OS.esc(art) + '" alt="">' : ICON) + '</div>' +
            '<div class="bp-pl-title">' + OS.esc(ep.title) + '</div>' +
            '<div class="bp-pl-date">' + fmtDate(ep.date) + (ep.dur ? ' · ' + fmtLen(ep.dur) : '') + '</div>' +
            '<input class="bp-seek" type="range" min="0" max="1000" value="0" aria-label="Position">' +
            '<div class="bp-times"><span class="bp-cur">0:00</span><span class="bp-rem">-' + fmtTime(ep.dur) + '</span></div>' +
            '<div class="bp-ctrl"><button class="bp-back">' + skipIcon(K.skipBack, false) + '</button>' +
              '<button class="bp-play">' + PLAY + '</button>' +
              '<button class="bp-fwd">' + skipIcon(K.skipForward, true) + '</button></div>' +
            '<div class="bp-row2"><button class="bp-speed">' + speed + '×</button><button class="bp-pdl"></button></div>' +
            (ep.desc ? '<div class="bp-desc">' + OS.esc(ep.desc).replace(/\n/g, '<br>') + '</div>' : '') +
          '</div>';
        var seek = root.querySelector('.bp-seek'), seeking = false;
        seek.addEventListener('input', function () { seeking = true; var d = audio.duration || ep.dur; root.querySelector('.bp-cur').textContent = fmtTime(seek.value / 1000 * d); });
        seek.addEventListener('change', function () { var d = audio.duration || ep.dur; if (d) { audio.currentTime = seek.value / 1000 * d; savePos(true); } seeking = false; });
        root.querySelector('.bp-play').onclick = function () { if (nowId !== ep.id || !audio.src) load(ep, true); else toggle(); };
        root.querySelector('.bp-back').onclick = function () { skip(-K.skipBack); };
        root.querySelector('.bp-fwd').onclick = function () { skip(K.skipForward); };
        root.querySelector('.bp-speed').onclick = function (e) {
          var S = [1, 1.25, 1.5, 1.75, 2, 0.75], i = S.indexOf(speed); setSpeed(S[(i + 1) % S.length]); e.currentTarget.textContent = speed + '×';
        };
        root.querySelector('.bp-pdl').onclick = function () { dlButton(ep); };
        function update() {
          if (view !== 'player') return;
          var d = audio.duration || ep.dur, t = nowId === ep.id ? audio.currentTime : (positions[ep.id] || 0);
          if (!seeking) { seek.value = d ? Math.round(t / d * 1000) : 0; root.querySelector('.bp-cur').textContent = fmtTime(t); }
          root.querySelector('.bp-rem').textContent = '-' + fmtTime(Math.max(0, d - t));
          root.querySelector('.bp-play').innerHTML = nowId === ep.id && !audio.paused ? PAUSE : PLAY;
          var b = root.querySelector('.bp-pdl'), st = active[ep.id];
          b.className = 'bp-pdl' + (st ? ' busy' : isDownloaded(ep.id) ? ' done' : '');
          b.innerHTML = st ? 'Downloading… ' + (st.total ? Math.floor(st.got / st.total * 100) : 0) + '%' :
            isDownloaded(ep.id) ? CHECK + ' Downloaded' : DL + ' Download' + (ep.size ? ' · ' + fmtMB(ep.size) : '');
        }
        update(); stopTimer(); timer = setInterval(update, 250);
      }
      function startTimer() {
        stopTimer();
        timer = setInterval(function () {
          var m = root.querySelector('.bp-mini span'), ep = nowEp();
          if (m && ep) m.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration || ep.dur);
        }, 500);
      }
      function stopTimer() { if (timer) clearInterval(timer); timer = null; }

      // live updates from downloads / playback
      function onDl(id) {
        if (!root.isConnected || view === 'player') return;
        var r = root.querySelector('.bp-row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'), ep = episode(id);
        if (tab === 'dl' && !active[id] && !isDownloaded(id)) return renderList();
        if (r && ep) { var n = OS.el('div', '', rowHTML(ep)).firstChild; r.replaceWith(n); wireList(); }
        var tb = root.querySelector('.bp-tabs [data-t="dl"]'); if (tb) tb.textContent = 'Downloads' + (Object.keys(dlMeta).length ? ' (' + Object.keys(dlMeta).length + ')' : '');
      }
      function onState() {
        if (!root.isConnected || view !== 'list') return;
        var m = root.querySelector('.bp-mini-play'); if (m) m.innerHTML = audio.paused ? PLAY : PAUSE; else renderList();
      }
      function onFeed() { if (root.isConnected && view === 'list') renderList(); }
      OS.on('barkpod-dl', onDl); OS.on('barkpod-state', onState); OS.on('barkpod-feed', onFeed); OS.on('barkpod-now', onState);

      var loadErr = false;
      function doRefresh(loud) {
        refresh().then(function (f) { loadErr = false; if (loud) OS.toast(f.eps.length + ' episodes'); }, function () {
          loadErr = true; if (view === 'list') renderList();
          if (loud) OS.toast(feed ? 'Offline. Showing saved episodes.' : 'Can\'t reach the podcast feed');
        });
      }

      if (args && args.episode && episode(args.episode)) openPlayer(episode(args.episode));
      else renderList();
      if (!feed || Date.now() - feed.fetched > 5 * 60000) doRefresh(false);
      else badge();
      if (args && args.episode && !episode(args.episode)) refresh().then(function () { var e = episode(args.episode); if (e) openPlayer(e); }).catch(function () {});

      OS.debugBarkpod = { get feed() { return feed; }, get audio() { return audio; }, get active() { return active; }, get dl() { return dlMeta; },
        get view() { return view; }, open: function (i) { openPlayer(feed.eps[i || 0]); }, download: startDownload, remove: deleteDownload, refresh: refresh };

      return {
        back: function () { if (view === 'player') { renderList(); return true; } return false; },
        menu: function () {
          return [
            { label: 'Refresh', action: function () { doRefresh(true); } },
            { label: 'Downloads', action: function () { tab = 'dl'; renderList(); } },
            { label: 'Stop playback', action: function () { savePos(true); audio.pause(); OS.clearNotifs('barkpod-now'); } }
          ];
        },
        close: function () {
          stopTimer();
          OS.off && (OS.off('barkpod-dl', onDl), OS.off('barkpod-state', onState), OS.off('barkpod-feed', onFeed), OS.off('barkpod-now', onState));
          view = 'closed';
        }
      };
    }
  });

  // pick up where we left off after a reload (paused, ready to resume)
  OS.on('unlocked', function () { var id = store('now', null), ep = id && episode(id); if (ep && !nowId) { nowId = null; load(ep, false); } });
})();
