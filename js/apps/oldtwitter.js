/* =====================================================================
   OLD TWITTER — one timeline for everybody with the phone.
   Make a profile (a name + a picture), post 140 characters, star tweets.
   The "Top" timeline mixes newness and stars 2:1 in favor of newness;
   "Latest" is plain newest-first.

   Uses its own Firebase project (NOT the prompt machine's), read with plain
   web requests every so often instead of a live connection, so it stays
   inside the free plan no matter how many phones are open.

   Moderation: old-twitter-admin.html (sign in with the admin email).
   Settings: js/content.js -> oldTwitter
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'oldtwitter';
  var DEFAULTS = {
    name: 'OLD TWITTER',
    database: 'https://old-twitter-csk-default-rtdb.firebaseio.com',
    apiKey: 'AIzaSyDx6P6KzRb8cr-6aBRHF-2ZjuXlpA7RAzo',
    maxChars: 140,
    cooldown: 30,          // seconds between tweets (the database enforces this too)
    refreshSeconds: 30,    // how often the timeline checks for new tweets while open
    feedSize: 150,         // how many recent tweets the timeline loads
    recencyWeight: 2,      // Top timeline: newness counts twice ...
    likesWeight: 1,        // ... as much as stars
    halfLifeHours: 12,     // how fast a tweet "ages" on the Top timeline
    reportsToHide: 3,      // tweets with this many reports disappear until an admin looks
    tweetBonus: 10,        // CSK TCG Drink Tickets for your first tweet of the day (0 = off)
    prompt: 'What are you doing?',
    blockedWords: []
  };
  function cfg() { var g = C.oldTwitter || {}, o = {}, k; for (k in DEFAULTS) o[k] = DEFAULTS[k]; for (k in g) o[k] = g[k]; return o; }
  var K = cfg();

  var ICON = '<svg viewBox="0 0 48 48"><defs><linearGradient id="otg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ae4ff"/><stop offset="1" stop-color="#2fb7ec"/></linearGradient></defs>' +
    '<rect x="4" y="4" width="40" height="40" rx="8" fill="url(#otg)" stroke="#167fae"/>' +
    '<ellipse cx="15" cy="13" rx="7" ry="3" fill="#fff" opacity=".55"/><ellipse cx="33" cy="10" rx="5" ry="2" fill="#fff" opacity=".45"/>' +
    '<path d="M10 17h28a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H21l-7 5v-5h-4a3 3 0 0 1-3-3V20a3 3 0 0 1 3-3z" fill="#fff" stroke="#167fae" stroke-width="1.2"/>' +
    '<text x="24" y="30.5" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial,sans-serif" font-weight="bold" font-size="11" fill="#33b5e5">140</text></svg>';
  // the classic default egg
  var EGG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#8ccfe8"/><ellipse cx="24" cy="27" rx="11" ry="14" fill="#fff"/><ellipse cx="20" cy="21" rx="3" ry="4" fill="#fff" opacity=".7"/><ellipse cx="24" cy="27" rx="11" ry="14" fill="none" stroke="#5aa9c8" stroke-width="1"/></svg>');

  function $(s, r) { return (r || document).querySelector(s); }
  function store(k, d) { return OS.store.get(ID + ':' + k, d); }
  function put(k, v) { OS.store.set(ID + ':' + k, v); }
  function db(path, q) { return K.database.replace(/\/$/, '') + '/' + path + '.json' + (q ? '?' + q : ''); }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms || 12000); })]); }
  function json(r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error((j && (j.error && (j.error.message || j.error))) || ('HTTP ' + r.status)); e.status = r.status; throw e; }); return r.json(); }

  /* ---------- who you are: an anonymous Firebase account made the first time you set up a profile ---------- */
  var Auth = {
    me: function () { return store('auth', null); },
    uid: function () { var a = Auth.me(); return a && a.uid; },
    token: function () {
      var a = Auth.me();
      if (a && a.idToken && a.exp - 60000 > Date.now()) return Promise.resolve(a.idToken);
      if (a && a.refreshToken) {
        return timeout(fetch('https://securetoken.googleapis.com/v1/token?key=' + K.apiKey, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(a.refreshToken)
        })).then(json).then(function (j) {
          a.idToken = j.id_token; a.refreshToken = j.refresh_token || a.refreshToken; a.exp = Date.now() + (+j.expires_in || 3600) * 1000;
          put('auth', a); return a.idToken;
        });
      }
      return timeout(fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + K.apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
      })).then(json).then(function (j) {
        var n = { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000 };
        put('auth', n); return n.idToken;
      });
    }
  };
  function write(method, path, body) {
    return Auth.token().then(function (t) {
      return timeout(fetch(db(path, 'auth=' + encodeURIComponent(t)), { method: method, body: body === undefined ? undefined : JSON.stringify(body) }));
    }).then(json);
  }

  /* ---------- Firebase-style keys that sort by time ---------- */
  var PUSH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  function pushId() {
    var now = Date.now(), s = '', i;
    for (i = 0; i < 8; i++) { s = PUSH.charAt(now % 64) + s; now = Math.floor(now / 64); }
    for (i = 0; i < 12; i++) s += PUSH.charAt(Math.floor(Math.random() * 64));
    return s;
  }

  /* ---------- profiles (cached on the phone, refreshed every 10 minutes) ---------- */
  var profiles = store('profiles', {});
  var asking = {};
  function getProfiles(uids, force) {
    var need = uids.filter(function (u, i) {
      if (uids.indexOf(u) !== i || asking[u]) return false;
      var p = profiles[u]; return force || !p || Date.now() - (p._at || 0) > 600000;
    }).slice(0, 40);
    if (!need.length) return Promise.resolve(false);
    return Promise.all(need.map(function (u) {
      asking[u] = 1;
      return timeout(fetch(db('profiles/' + u), { cache: 'no-store' })).then(json).then(function (p) {
        profiles[u] = p ? { name: p.name, pic: p.pic, _at: Date.now() } : { gone: 1, _at: Date.now() };
      }).catch(function () {}).then(function () { delete asking[u]; });
    })).then(function () {
      // keep the cache from growing forever
      var keys = Object.keys(profiles);
      if (keys.length > 300) keys.sort(function (a, b) { return profiles[a]._at - profiles[b]._at; }).slice(0, keys.length - 300).forEach(function (k) { delete profiles[k]; });
      put('profiles', profiles); return true;
    });
  }
  function picOf(uid) { var p = profiles[uid]; return (p && p.pic) || EGG; }
  function nameOf(t) { var p = profiles[t.uid]; return (p && p.name) || t.name || 'someone'; }

  /* ---------- the timeline ---------- */
  var tweets = store('cache', []);       // last good load, so it opens instantly / offline
  var banned = {};
  function count(o) { return o ? Object.keys(o).length : 0; }
  function loadFeed() {
    return Promise.all([
      timeout(fetch(db('tweets', 'orderBy=%22ts%22&limitToLast=' + K.feedSize), { cache: 'no-store' })).then(json),
      timeout(fetch(db('banned'), { cache: 'no-store' })).then(json).catch(function () { return null; })
    ]).then(function (res) {
      var raw = res[0] || {}; banned = res[1] || {};
      var list = Object.keys(raw).map(function (id) {
        var t = raw[id]; if (!t || !t.text) return null;
        return { id: id, uid: t.uid, name: t.name, text: t.text, ts: t.ts || 0, likes: count(t.likes), liked: !!(t.likes && Auth.uid() && t.likes[Auth.uid()]),
          reports: count(t.reports), reported: !!(t.reports && Auth.uid() && t.reports[Auth.uid()]) };
      }).filter(Boolean);
      tweets = list; put('cache', list);
      return list;
    });
  }
  function visible(list) {
    var me = Auth.uid();
    return list.filter(function (t) { return t.uid === me || (!banned[t.uid] && t.reports < K.reportsToHide); });
  }
  // Top: newness and stars, weighted 2:1 toward newness
  function ranked(list, mode) {
    list = visible(list).slice();
    if (mode === 'latest') return list.sort(function (a, b) { return b.ts - a.ts; });
    var now = Date.now(), maxL = Math.max(1, Math.max.apply(null, list.map(function (t) { return t.likes; }).concat([0])));
    var wr = +K.recencyWeight || 2, wl = +K.likesWeight || 1, hl = (+K.halfLifeHours || 12) * 3600000;
    list.forEach(function (t) {
      var fresh = Math.pow(0.5, Math.max(0, now - t.ts) / hl);              // 1 = just now, 0.5 after one half-life
      var stars = Math.log(1 + t.likes) / Math.log(1 + maxL);               // 1 = most-starred tweet on the timeline
      t._score = (wr * fresh + wl * stars) / (wr + wl);
    });
    return list.sort(function (a, b) { return b._score - a._score || b.ts - a.ts; });
  }

  /* ---------- text ---------- */
  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'less than a minute ago';
    if (s < 120) return 'about a minute ago';
    if (s < 3600) return Math.floor(s / 60) + ' minutes ago';
    if (s < 7200) return 'about an hour ago';
    if (s < 86400) return 'about ' + Math.floor(s / 3600) + ' hours ago';
    if (s < 172800) return 'yesterday';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmt(text) {
    return OS.esc(text)
      .replace(/(^|\s)(#\w+)/g, '$1<b class="ot-tag">$2</b>')
      .replace(/(^|\s)(@\w+)/g, '$1<b class="ot-at">$2</b>');
  }
  function bad(text) {
    var t = ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    return (K.blockedWords || []).some(function (w) { w = String(w).toLowerCase().trim(); return w && t.indexOf(' ' + w + ' ') >= 0; });
  }
  function dayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  /* ---------- picture: center square, 96px JPEG ---------- */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 96;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 96, 96);
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 96, 96);
        URL.revokeObjectURL(url);
        var q = 0.82, out = c.toDataURL('image/jpeg', q);
        while (out.length > 14000 && q > 0.3) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }

  function errText(e) {
    var m = String(e && e.message || e || '');
    if (/permission/i.test(m)) return banned[Auth.uid()] ? 'Your account can\'t tweet right now.' : 'Slow down a sec and try again.';
    if (/timeout|fetch|network/i.test(m) || !navigator.onLine) return 'No signal. Try again in a bit.';
    return 'Something went wrong. Try again.';
  }

  /* ======================= the app ======================= */
  OS.registerApp({
    id: ID, name: 'Old Twitter', icon: ICON,
    launch: function (root) {
      K = cfg();
      root.classList.add('ot');
      root.innerHTML =
        '<div class="ot-top"><div class="ot-logo">old twitter</div><button class="ot-me" aria-label="Your profile"></button></div>' +
        '<div class="ot-body scroll"><div class="ot-page"></div></div>';
      var body = $('.ot-body', root), page = $('.ot-page', root), meBtn = $('.ot-me', root);
      var mode = store('mode', 'top'), view = 'home', viewing = null, pending = [], refreshT = null, alive = true;

      function myProfile() { var u = Auth.uid(); return u && profiles[u] && !profiles[u].gone ? profiles[u] : null; }
      function drawMe() {
        var p = myProfile();
        meBtn.innerHTML = p ? '<img src="' + p.pic + '" alt="">' : '<span>Sign up</span>';
        meBtn.classList.toggle('has', !!p);
      }

      /* ---- one tweet ---- */
      function tweetHtml(t) {
        var mine = t.uid === Auth.uid();
        return '<div class="ot-tw" data-id="' + t.id + '">' +
          '<img class="ot-av" data-uid="' + OS.esc(t.uid) + '" src="' + picOf(t.uid) + '" alt="">' +
          '<div class="ot-tx"><b class="ot-nm" data-uid="' + OS.esc(t.uid) + '">' + OS.esc(nameOf(t)) + '</b> ' + fmt(t.text) +
          '<div class="ot-meta">' + ago(t.ts) + ' from killdroid' +
            (t.reports >= K.reportsToHide && mine ? ' · <i>hidden for review</i>' : '') + '</div></div>' +
          '<div class="ot-act"><button class="ot-star' + (t.liked ? ' on' : '') + '" aria-label="Star">' + (t.liked ? '★' : '☆') + '</button>' +
          '<span class="ot-n">' + (t.likes || '') + '</span>' +
          '<button class="ot-more" aria-label="More">⋯</button></div>' +
        '</div>';
      }
      function find(id) { return tweets.filter(function (t) { return t.id === id; })[0]; }

      /* ---- home ---- */
      function home(keepScroll) {
        view = 'home'; viewing = null;
        var p = myProfile(), top = keepScroll ? body.scrollTop : 0;
        var left = cooldownLeft();
        page.innerHTML =
          (p ? '<div class="ot-box"><div class="ot-q">' + OS.esc(K.prompt) + '<span class="ot-cnt">' + K.maxChars + '</span></div>' +
                '<textarea class="ot-in" maxlength="' + K.maxChars + '" rows="2"></textarea>' +
                '<div class="ot-row"><span class="ot-st"></span><button class="ot-go">update</button></div></div>'
             : '<div class="ot-join"><b>Join the conversation.</b> Pick a name and a picture and you can tweet with everyone else who has the phone.<button class="ot-signup">Sign up, it\'s free</button></div>') +
          '<div class="ot-tabs"><button data-m="top" class="' + (mode === 'top' ? 'on' : '') + '">Top</button><button data-m="latest" class="' + (mode === 'latest' ? 'on' : '') + '">Latest</button><span class="ot-pull">pull down to refresh</span></div>' +
          '<div class="ot-new" hidden></div>' +
          '<div class="ot-list"></div>';
        drawList();
        if (p) {
          var ta = $('.ot-in', page), cnt = $('.ot-cnt', page), go = $('.ot-go', page);
          ta.value = store('draft', '');
          var upd = function () { var n = K.maxChars - ta.value.length; cnt.textContent = n; cnt.className = 'ot-cnt' + (n < 20 ? ' warn' : '') + (n < 10 ? ' red' : ''); put('draft', ta.value); };
          ta.addEventListener('input', upd); upd();
          go.onclick = function () { tweet(ta, go); };
          if (left > 0) runCooldown(go);
        } else $('.ot-signup', page).onclick = function () { setup(); };
        page.querySelectorAll('.ot-tabs button').forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-m'); put('mode', mode); home(); }; });
        $('.ot-new', page).onclick = function () { pending = []; drawList(); body.scrollTop = 0; };
        body.scrollTop = top;
      }
      function drawList() {
        var list = $('.ot-list', page); if (!list) return;
        var r = ranked(tweets, mode);
        list.innerHTML = r.length ? r.map(tweetHtml).join('') : '<div class="ot-empty">No tweets yet. Be the first.</div>';
        var nb = $('.ot-new', page); if (nb) nb.hidden = true;
      }

      /* ---- refresh (on open, pull down, every 30 s while open) ---- */
      var loading = false;
      function refresh(showNew) {
        if (loading || !alive) return Promise.resolve();
        loading = true;
        var before = {}; tweets.forEach(function (t) { before[t.id] = 1; });
        return loadFeed().then(function (list) {
          var fresh = list.filter(function (t) { return !before[t.id] && t.uid !== Auth.uid(); });
          return getProfiles(list.map(function (t) { return t.uid; }).concat(Auth.uid() ? [Auth.uid()] : [])).then(function () {
            if (!alive) return;
            drawMe();
            if (view === 'home') {
              // quietly update stars etc.; if new tweets came in while you're scrolled down, show the old-school "new tweets" bar
              if (showNew && fresh.length && body.scrollTop > 40) {
                pending = pending.concat(fresh.map(function (t) { return t.id; }));
                var nb = $('.ot-new', page); if (nb) { nb.hidden = false; nb.textContent = pending.length + ' new tweet' + (pending.length > 1 ? 's' : ''); }
              } else drawList();
            } else if (view === 'profile' && viewing) profile(viewing, true);
          });
        }).catch(function () {
          if (view === 'home' && !tweets.length) { var l = $('.ot-list', page); if (l) l.innerHTML = '<div class="ot-empty">Can\'t reach Old Twitter. Check your signal.</div>'; }
        }).then(function () { loading = false; });
      }

      /* ---- posting ---- */
      function cooldownLeft() { return Math.max(0, Math.ceil((store('last', 0) + K.cooldown * 1000 - Date.now()) / 1000)); }
      var cdT = null;
      function runCooldown(go) {
        clearInterval(cdT);
        var tick = function () {
          var s = cooldownLeft(); if (!go.isConnected) { clearInterval(cdT); return; }
          if (s > 0) { go.disabled = true; go.textContent = s + 's'; } else { go.disabled = false; go.textContent = 'update'; clearInterval(cdT); }
        };
        tick(); cdT = setInterval(tick, 500);
      }
      function tweet(ta, go) {
        var st = $('.ot-st', page), text = ta.value.replace(/\s+/g, ' ').trim().slice(0, K.maxChars), p = myProfile(), uid = Auth.uid();
        if (!text) { ta.focus(); return; }
        if (cooldownLeft() > 0) return;
        if (bad(text)) { st.textContent = 'Let\'s keep it friendly.'; st.className = 'ot-st err'; return; }
        go.disabled = true; st.textContent = 'posting…'; st.className = 'ot-st';
        var id = pushId(), upd = {};
        upd['tweets/' + id] = { uid: uid, name: p.name, text: text, ts: { '.sv': 'timestamp' } };
        upd['last/' + uid] = { '.sv': 'timestamp' };
        write('PATCH', '', upd).then(function () {
          put('last', Date.now()); put('draft', '');
          tweets.push({ id: id, uid: uid, name: p.name, text: text, ts: Date.now(), likes: 0, reports: 0 });
          put('cache', tweets);
          OS.beep(1046, 0.05); OS.beep(1568, 0.07, 0.06);
          if (K.tweetBonus && OS.tcg && store('bonusDay', '') !== dayKey()) { put('bonusDay', dayKey()); OS.tcg.add(K.tweetBonus, 'first tweet today'); }
          mode = 'latest'; put('mode', mode); home();
          OS.emit('tweet', text);
        }).catch(function (e) {
          st.textContent = errText(e); st.className = 'ot-st err'; go.disabled = false;
          if (/permission/i.test(String(e && e.message))) { put('last', Date.now()); runCooldown(go); }
        });
      }

      /* ---- stars, reports, deleting ---- */
      function star(t, el) {
        if (!myProfile()) { OS.toast('Sign up to star tweets'); return; }
        var on = !t.liked; t.liked = on; t.likes += on ? 1 : -1;
        var b = $('.ot-star', el), n = $('.ot-n', el);
        b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; n.textContent = t.likes || '';
        if (on) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); OS.beep(1320, 0.04); }
        (on ? write('PUT', 'tweets/' + t.id + '/likes/' + Auth.uid(), true) : write('DELETE', 'tweets/' + t.id + '/likes/' + Auth.uid()))
          .then(function () { put('cache', tweets); })
          .catch(function () { t.liked = !on; t.likes += on ? -1 : 1; b.classList.toggle('on', !on); b.textContent = !on ? '★' : '☆'; n.textContent = t.likes || ''; OS.toast('Couldn\'t star that. Check your signal.'); });
      }
      function more(t) {
        var mine = t.uid === Auth.uid(), items = [];
        items.push({ label: 'View ' + nameOf(t) + '\'s profile', action: function () { profile(t.uid); } });
        if (mine) items.push({ label: 'Delete tweet', action: function () {
          OS.dialog({ title: 'Delete tweet?', text: 'This can\'t be undone.', buttons: [{ label: 'Cancel' }, { label: 'Delete', action: function () {
            write('DELETE', 'tweets/' + t.id).then(function () { tweets = tweets.filter(function (x) { return x.id !== t.id; }); put('cache', tweets); redraw(); OS.toast('Tweet deleted'); })
              .catch(function (e) { OS.toast(errText(e)); });
          } }] });
        } });
        else if (myProfile() && !t.reported) items.push({ label: 'Report tweet', action: function () {
          OS.dialog({ title: 'Report this tweet?', text: 'An admin will take a look. Tweets with enough reports are hidden until then.', buttons: [{ label: 'Cancel' }, { label: 'Report', action: function () {
            write('PUT', 'tweets/' + t.id + '/reports/' + Auth.uid(), true).then(function () { t.reported = true; t.reports++; put('cache', tweets); redraw(); OS.toast('Thanks. Reported.'); })
              .catch(function (e) { OS.toast(errText(e)); });
          } }] });
        } });
        else if (t.reported) items.push({ label: 'Reported', action: function () {} });
        OS.listDialog({ title: 'Tweet', items: items });
      }
      function redraw() { if (view === 'home') drawList(); else if (view === 'profile' && viewing) profile(viewing, true); }

      /* ---- a person's page ---- */
      var theirs = {};
      function profile(uid, quiet) {
        view = 'profile'; viewing = uid;
        var p = profiles[uid] || {}, list = (theirs[uid] || tweets.filter(function (t) { return t.uid === uid; })).slice().sort(function (a, b) { return b.ts - a.ts; });
        var stars = list.reduce(function (a, t) { return a + t.likes; }, 0), mine = uid === Auth.uid();
        var top = quiet ? body.scrollTop : 0;
        page.innerHTML =
          '<div class="ot-prof"><img src="' + picOf(uid) + '" alt=""><div><h2>' + OS.esc(p.name || (list[0] && list[0].name) || 'someone') + '</h2>' +
            '<div class="ot-stats"><span><b>' + list.length + '</b> tweets</span><span><b>' + stars + '</b> stars</span></div>' +
            (mine ? '<button class="ot-edit">Edit profile</button>' : '') + '</div></div>' +
          '<div class="ot-list">' + (list.length ? list.map(tweetHtml).join('') : '<div class="ot-empty">No tweets yet.</div>') + '</div>';
        if (mine) $('.ot-edit', page).onclick = function () { setup(); };
        body.scrollTop = top;
        if (!quiet) {
          // their whole history, not just what's on the timeline right now
          timeout(fetch(db('tweets', 'orderBy=%22uid%22&equalTo=' + encodeURIComponent(JSON.stringify(uid))), { cache: 'no-store' })).then(json).then(function (raw) {
            raw = raw || {};
            theirs[uid] = Object.keys(raw).map(function (id) { var t = raw[id]; return { id: id, uid: t.uid, name: t.name, text: t.text, ts: t.ts || 0, likes: count(t.likes), liked: !!(t.likes && Auth.uid() && t.likes[Auth.uid()]), reports: count(t.reports), reported: !!(t.reports && Auth.uid() && t.reports[Auth.uid()]) }; })
              .filter(function (t) { return t.text && t.uid === uid && (mine || t.reports < K.reportsToHide); });
            return getProfiles([uid], true);
          }).then(function () { if (alive && view === 'profile' && viewing === uid) profile(uid, true); }).catch(function () {});
        }
      }

      /* ---- making / editing your profile ---- */
      function setup() {
        view = 'setup'; viewing = null;
        var p = myProfile(), pic = p ? p.pic : null;
        page.innerHTML =
          '<div class="ot-setup"><h2>' + (p ? 'Edit your profile' : 'Join Old Twitter') + '</h2>' +
            '<div class="ot-pick"><img src="' + (pic || EGG) + '" alt=""><button class="ot-photo">' + (p ? 'Change picture' : 'Choose a picture') + '</button>' +
            '<input type="file" accept="image/*" hidden></div>' +
            '<label>Name</label><input class="ot-name" type="text" maxlength="24" placeholder="what should people call you?" value="' + OS.esc(p ? p.name : '') + '">' +
            '<div class="ot-st"></div>' +
            '<button class="ot-save">' + (p ? 'Save' : 'Create my account') + '</button>' +
            '<p class="ot-fine">Your name and picture are public to everyone using the phone. Be cool. Tweets that break the rules get deleted.</p></div>';
        var file = $('input[type=file]', page), img = $('.ot-pick img', page), nm = $('.ot-name', page), st = $('.ot-st', page), save = $('.ot-save', page);
        $('.ot-photo', page).onclick = function () { file.click(); };
        img.onclick = function () { file.click(); };
        file.onchange = function () {
          var f = file.files && file.files[0]; if (!f) return;
          shrink(f).then(function (d) { pic = d; img.src = d; st.textContent = ''; }).catch(function () { st.textContent = 'That picture didn\'t work. Try another.'; st.className = 'ot-st err'; });
        };
        save.onclick = function () {
          var name = nm.value.replace(/\s+/g, ' ').trim().slice(0, 24);
          if (!name) { st.textContent = 'You need a name.'; st.className = 'ot-st err'; nm.focus(); return; }
          if (bad(name)) { st.textContent = 'Pick a different name.'; st.className = 'ot-st err'; return; }
          if (!pic) { st.textContent = 'Pick a picture first.'; st.className = 'ot-st err'; return; }
          save.disabled = true; st.textContent = 'saving…'; st.className = 'ot-st';
          Auth.token().then(function () {
            return write('PUT', 'profiles/' + Auth.uid(), { name: name, pic: pic, ts: { '.sv': 'timestamp' } });
          }).then(function () {
            profiles[Auth.uid()] = { name: name, pic: pic, _at: Date.now() }; put('profiles', profiles);
            drawMe(); OS.toast(p ? 'Profile saved' : 'Welcome to Old Twitter'); home();
          }).catch(function (e) { st.textContent = errText(e); st.className = 'ot-st err'; save.disabled = false; });
        };
      }

      /* ---- taps ---- */
      page.addEventListener('click', function (e) {
        var u = e.target.closest('[data-uid]'); if (u && view !== 'profile') { profile(u.getAttribute('data-uid')); return; }
        var tw = e.target.closest('.ot-tw'); if (!tw) return;
        var t = find(tw.getAttribute('data-id')) || (viewing && (theirs[viewing] || []).filter(function (x) { return x.id === tw.getAttribute('data-id'); })[0]);
        if (!t) return;
        if (e.target.closest('.ot-star')) star(t, tw);
        else if (e.target.closest('.ot-more')) more(t);
      });
      meBtn.onclick = function () { if (myProfile()) profile(Auth.uid()); else setup(); };

      /* ---- pull down to refresh ---- */
      var py = null, pulled = 0;
      body.addEventListener('touchstart', function (e) { py = body.scrollTop <= 0 ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
      body.addEventListener('touchmove', function (e) {
        if (py == null) return; pulled = (e.touches[0].clientY - py) / (OS.scale || 1);
        page.style.transform = pulled > 0 ? 'translateY(' + Math.min(60, pulled / 2) + 'px)' : '';
      }, { passive: true });
      body.addEventListener('touchend', function () {
        if (py == null) return; page.style.transform = ''; py = null;
        if (pulled > 90) { pending = []; OS.toast('Refreshing…'); refresh(false); }
      });

      drawMe(); home();
      if (Auth.uid()) getProfiles([Auth.uid()]).then(drawMe);
      refresh(false);
      refreshT = setInterval(function () { if (!document.hidden) refresh(true); }, Math.max(15, K.refreshSeconds) * 1000);

      OS.debugTwitter = { auth: Auth, load: loadFeed, ranked: ranked, profiles: function () { return profiles; } };
      return {
        back: function () { if (view !== 'home') { home(); return true; } return false; },
        menu: function () {
          return [
            { label: 'Refresh', action: function () { pending = []; refresh(false); } },
            { label: myProfile() ? 'Edit profile' : 'Sign up', action: setup },
            { label: mode === 'top' ? 'Show latest first' : 'Show top tweets', action: function () { mode = mode === 'top' ? 'latest' : 'top'; put('mode', mode); home(); } }
          ];
        },
        close: function () { alive = false; clearInterval(refreshT); clearInterval(cdT); }
      };
    }
  });
})();
