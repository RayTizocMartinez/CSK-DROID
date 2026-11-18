/* =====================================================================
   CLIKCOK — a never-ending feed of 5-second videos. No likes, no follows.
   The only number it keeps is a tiny timer of how long you've been scrolling.
   Close the app and the next time you open it, it congratulates you.

   Videos:  media/clikcok/clok0000.mp4 ... clok0100.mp4  (found automatically, played in random order)
   Tuning:  js/content.js -> clikcok
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'clikcok';
  var DIR = 'media/clikcok/';

  var DEFAULTS = {
    name: 'ClikCok',
    count: 100,           // look for clok0000 ... clok0100 (it keeps looking past this if the files keep going)
    handle: '@clikcok',
    tags: ['#fyp', '#foryou', '#clok', '#doomscroll', '#5seconds', '#coldstartkillers', '#nolikes', '#keepscrolling', '#relatable', '#killdroid'],
    rewards: []           // [{ minutes: 60, action: {...} }]  total minutes ever scrolled
  };
  function cfg() {
    var g = C.clikcok || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="9" fill="#111" stroke="#000"/>' +
    '<circle cx="24" cy="25" r="12" fill="none" stroke="#25f4ee" stroke-width="3.2" transform="translate(-1.4 -1)"/>' +
    '<circle cx="24" cy="25" r="12" fill="none" stroke="#fe2c55" stroke-width="3.2" transform="translate(1.4 1)"/>' +
    '<circle cx="24" cy="25" r="12" fill="none" stroke="#fff" stroke-width="2.4"/>' +
    '<path d="M24 25V17.5M24 25l5.5 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
    '<rect x="19" y="8" width="10" height="3" rx="1.5" fill="#fff"/></svg>';

  /* ---------- finding the videos ---------- */
  function pad(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }
  function names(n) { return [DIR + 'clok' + pad(n) + '.mp4', DIR + 'cloks' + pad(n) + '.mp4', DIR + 'clok' + n + '.mp4']; }
  function exists(url) {
    return fetch(OS.url(url), { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  var found = {}, foundList = [], scanning = null, scanDone = false, listeners = [];
  function scan(limit) {
    if (scanning) return scanning;
    scanning = new Promise(function (resolve) {
      var n = 0, misses = 0, lastHit = -1;
      function one(i) {
        var list = names(i);
        function next(k) {
          if (k >= list.length) return Promise.resolve(false);
          return exists(list[k]).then(function (ok) {
            if (!ok) return next(k + 1);
            if (!found[i]) { found[i] = list[k]; foundList.push(list[k]); listeners.forEach(function (f) { f(list[k]); }); }
            return true;
          });
        }
        return next(0);
      }
      function batch() {
        var ps = [], start = n;
        for (var k = 0; k < 12; k++) ps.push(one(n++));
        Promise.all(ps).then(function (hits) {
          hits.forEach(function (h, k) { if (h) { lastHit = start + k; misses = 0; } else misses++; });
          // look up to the configured count, and keep going past it while files keep turning up
          if (n <= limit || (lastHit >= n - 12 && misses < 12)) batch();
          else { scanDone = true; listeners.forEach(function (f) { f(); }); resolve(foundList); }
        });
      }
      batch();
    });
    return scanning;
  }

  /* ---------- the timer that survives closing ---------- */
  function fmtClock(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function fmtWords(ms) {
    var s = Math.max(1, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60, out = [];
    if (h) out.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) out.push(m + (m === 1 ? ' minute' : ' minutes'));
    if (ss && !h) out.push(ss + (ss === 1 ? ' second' : ' seconds'));
    return out.length > 1 ? out.slice(0, -1).join(', ') + ' and ' + out[out.length - 1] : out[0];
  }
  function verdict(ms) {
    var m = ms / 60000;
    if (m < 0.5) return 'Rookie numbers. We believe in you.';
    if (m < 2) return 'A light snack. Your thumb is warming up.';
    if (m < 5) return 'Solid. That\'s a whole commercial break.';
    if (m < 15) return 'Your thumb is proud of you.';
    if (m < 30) return 'Elite. Most people blink more than that.';
    if (m < 60) return 'You are the algorithm now.';
    return 'Legendary. Please drink some water. Then keep going.';
  }
  function finishSession() {
    var p = OS.store.get(ID + ':pending', 0);
    if (!p) return;
    OS.store.set(ID + ':pending', 0);
    OS.store.set(ID + ':last', { ms: p, at: Date.now() });
    var total = OS.store.get(ID + ':total', 0) + p;
    OS.store.set(ID + ':total', total);
    OS.store.set(ID + ':sessions', OS.store.get(ID + ':sessions', 0) + 1);
    OS.emit(ID + '-session', p);
    var K = cfg();
    (K.rewards || []).forEach(function (r) {
      var k = ID + ':' + (r.id || r.minutes);
      if (total >= r.minutes * 60000 && !OS.flag(k)) { OS.setFlag(k); setTimeout(function () { OS.run(r.action); }, 400); }
    });
  }

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      root.classList.add('ck');
      finishSession();                                   // a session left over from a reload / closed browser counts too
      var last = OS.store.get(ID + ':last', null);
      var greet = last && !last.shown ? last : null;
      if (greet) { last.shown = true; OS.store.set(ID + ':last', last); }

      root.innerHTML =
        '<div class="ck-feed"></div>' +
        '<div class="ck-top"><span class="ck-tab">Following</span><b class="ck-tab on">For You</b></div>' +
        '<div class="ck-timer" title="time spent scrolling">0:00</div>' +
        '<button class="ck-mute" aria-label="Sound"></button>' +
        '<div class="ck-over"></div>';
      var feed = root.querySelector('.ck-feed'), timerEl = root.querySelector('.ck-timer');
      var muteBtn = root.querySelector('.ck-mute'), over = root.querySelector('.ck-over');

      /* ----- three recycled slides: previous, current, next ----- */
      var slots = [0, 1, 2].map(function () {
        var el = OS.el('div', 'ck-slide empty',
          '<video class="ck-vid" playsinline webkit-playsinline loop preload="auto" disablepictureinpicture></video>' +
          '<div class="ck-paused">&#9654;</div>' +
          '<div class="ck-cap"><b class="ck-handle"></b><div class="ck-desc"></div><div class="ck-song">&#9835; original sound - ' + OS.esc(K.handle.replace(/^@/, '')) + '</div></div>' +
          '<div class="ck-bar"><i></i></div>');
        feed.appendChild(el);
        var v = el.querySelector('video');
        v.setAttribute('playsinline', ''); v.playsInline = true;
        return { el: el, v: v, bar: el.querySelector('.ck-bar i'), idx: -1, url: null };
      });
      var hist = [], pos = 0, bag = [];
      var muted = !!OS.silent, started = false, paused = false;
      function setMuted(m) { muted = m; slots.forEach(function (s) { s.v.muted = m; }); muteBtn.classList.toggle('off', m); }
      setMuted(muted);

      function nextClip() {
        if (!foundList.length) return null;
        if (!scanDone) {
          // still finding files: random pick from what's here, skipping anything seen recently
          var recent = hist.slice(-Math.min(6, foundList.length - 1)), pool = foundList.filter(function (u) { return recent.indexOf(u) < 0 && u !== hist[hist.length - 1]; });
          return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        }
        if (!bag.length) {
          bag = foundList.slice();
          for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
          if (bag.length > 1 && bag[bag.length - 1] === hist[hist.length - 1]) { var x = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = x; }
        }
        return bag.pop();
      }
      function clipAt(n) {
        if (n < 0) return null;
        while (hist.length <= n) { var c = nextClip(); if (!c) return null; hist.push(c); }
        return hist[n];
      }
      function slotFor(n) { return slots[((n % 3) + 3) % 3]; }
      function fill(n) {
        var s = slotFor(n), url = clipAt(n);
        s.n = n;
        if (url && s.url !== url) {
          s.url = url; s.v.src = OS.url(url);
          var num = (url.match(/(\d+)\.mp4$/) || [])[1] || '';
          var tags = K.tags.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3).join(' ');
          s.el.querySelector('.ck-handle').textContent = K.handle;
          s.el.querySelector('.ck-desc').textContent = 'clok #' + (+num) + '  ' + tags;
        }
        if (!url && s.url) { s.url = null; s.v.removeAttribute('src'); try { s.v.load(); } catch (e) {} }
        s.el.classList.toggle('empty', !url);
      }
      var H = 1, drag = 0, anim = false;
      function layout(withAnim) {
        H = feed.clientHeight || 1;
        slots.forEach(function (s) {
          var off = (s.n - pos) * H + drag;
          s.el.style.transition = withAnim ? 'transform .28s cubic-bezier(.2,.8,.3,1)' : 'none';
          s.el.style.transform = 'translateY(' + off + 'px)';
        });
      }
      function playCurrent() {
        slots.forEach(function (s) {
          if (s.n === pos) {
            if (!started) return;
            try { s.v.currentTime = 0; } catch (e) {}
            if (!paused) { var p = s.v.play(); if (p && p.catch) p.catch(function () {}); }
          } else s.v.pause();
        });
      }
      function go(dir) {
        if (anim || !started) return;
        var target = pos + dir;
        if (target < 0 || !clipAt(target)) { drag = 0; layout(true); return; }
        pos = target; drag = 0; paused = false;
        slots.forEach(function (s) { s.el.classList.remove('is-paused'); });
        anim = true; layout(true);
        playCurrent();
        setTimeout(function () { anim = false; fill(pos - 1); fill(pos + 1); layout(false); }, 290);
      }
      function setup() { fill(pos - 1); fill(pos); fill(pos + 1); layout(false); }

      /* ----- swiping ----- */
      var t0 = null;
      feed.addEventListener('pointerdown', function (e) {
        if (!started || anim) return;
        t0 = { y: e.clientY, t: performance.now(), id: e.pointerId, moved: false };
        try { feed.setPointerCapture(e.pointerId); } catch (er) {}
      });
      feed.addEventListener('pointermove', function (e) {
        if (!t0 || e.pointerId !== t0.id) return;
        var dy = (e.clientY - t0.y) / (OS.scale || 1);
        if (Math.abs(dy) > 6) t0.moved = true;
        if (t0.moved) { drag = dy; if (pos === 0 && drag > 0) drag *= 0.35; layout(false); }
      });
      function up(e) {
        if (!t0 || e.pointerId !== t0.id) return;
        var dy = drag, dt = performance.now() - t0.t, moved = t0.moved; t0 = null;
        if (!moved) { togglePause(); return; }
        var fast = Math.abs(dy) / Math.max(1, dt) > 0.5;
        if (dy < -H * 0.22 || (fast && dy < -20)) go(1);
        else if (dy > H * 0.22 || (fast && dy > 20)) go(-1);
        else { drag = 0; layout(true); }
      }
      feed.addEventListener('pointerup', up);
      feed.addEventListener('pointercancel', function () { t0 = null; drag = 0; layout(true); });
      var wheelLock = 0;
      feed.addEventListener('wheel', function (e) {
        e.preventDefault();
        if (performance.now() < wheelLock || Math.abs(e.deltaY) < 15) return;
        wheelLock = performance.now() + 450; go(e.deltaY > 0 ? 1 : -1);
      }, { passive: false });
      function onKey(e) {
        if (!root.isConnected || !started) return;
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { go(1); e.preventDefault(); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') { go(-1); e.preventDefault(); }
        else if (e.key === ' ') { togglePause(); e.preventDefault(); }
      }
      window.addEventListener('keydown', onKey);
      function togglePause() {
        var s = slotFor(pos); if (!s.url) return;
        paused = !paused;
        s.el.classList.toggle('is-paused', paused);
        if (paused) s.v.pause(); else { var p = s.v.play(); if (p && p.catch) p.catch(function () {}); }
      }
      muteBtn.onclick = function (e) { e.stopPropagation(); setMuted(!muted); };

      /* ----- start (the tap also unlocks sound on phones) ----- */
      function start() {
        if (started) return;
        started = true;
        over.innerHTML = ''; over.className = 'ck-over';
        slots.forEach(function (s) {           // touch every video during the tap so they're allowed to play with sound
          if (s.n === pos || !s.url) return;
          var p = s.v.play(); if (p && p.then) p.then(function () { s.v.pause(); }).catch(function () {});
        });
        setup(); playCurrent();
      }
      function showStart() {
        over.className = 'ck-over show';
        if (greet) {
          var total = OS.store.get(ID + ':total', 0);
          over.innerHTML = '<div class="ck-card">' + confetti() +
            '<div class="ck-cong">Congratulations!</div>' +
            '<div class="ck-you">You scrolled for</div>' +
            '<div class="ck-big">' + OS.esc(fmtWords(greet.ms)) + '</div>' +
            '<div class="ck-verdict">' + OS.esc(verdict(greet.ms)) + '</div>' +
            '<div class="ck-total">All-time: ' + OS.esc(fmtWords(total)) + '</div>' +
            '<button class="ck-go">Keep scrolling</button></div>';
        } else {
          over.innerHTML = '<div class="ck-card plain"><div class="ck-logo">' + ICON + '</div>' +
            '<div class="ck-name">' + OS.esc(K.name) + '</div><div class="ck-sub">5 seconds at a time. Forever.</div>' +
            '<button class="ck-go">Start scrolling</button></div>';
        }
        over.querySelector('.ck-go').onclick = function () { if (foundList.length) start(); else emptyNote(); };
      }
      function confetti() {
        var cols = ['#fe2c55', '#25f4ee', '#ffd23a', '#8fd14f', '#fff'], h = '<div class="ck-confetti">';
        for (var i = 0; i < 26; i++) h += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' + cols[i % 5] + ';animation-delay:' + (Math.random() * 1.2).toFixed(2) + 's;animation-duration:' + (1.6 + Math.random() * 1.4).toFixed(2) + 's"></i>';
        return h + '</div>';
      }
      function emptyNote() {
        if (!scanDone) { OS.toast('Loading your feed…'); return; }
        OS.dialog({ title: K.name, text: 'No cloks yet.\n\nPut videos named clok0000.mp4, clok0001.mp4 … in media/clikcok/' });
      }
      showStart();

      // feed fills in as videos are found
      function onFound(url) {
        if (!started) { if (!slotFor(pos).url) setup(); return; }
        if (!slotFor(pos).url || !slotFor(pos + 1).url) { fill(pos); fill(pos + 1); layout(false); if (slotFor(pos).url) playCurrent(); } }
      listeners.push(onFound);
      scan(K.count);
      if (foundList.length) setup();

      /* ----- the tiny timer: only runs while you're actually in here, scrolling ----- */
      var session = 0, lastT = performance.now();
      var tick = setInterval(function () {
        var now = performance.now(), dt = Math.min(2000, now - lastT); lastT = now;
        var c = OS.current();
        var active = started && !document.hidden && OS.state === 'on' && c && c.id === ID;
        if (active) {
          session += dt;
          OS.store.set(ID + ':pending', session);
          timerEl.textContent = fmtClock(session);
        }
        var s = slotFor(pos);
        if (s.v.duration) s.bar.style.width = (s.v.currentTime / s.v.duration * 100) + '%';
        if (!active && started && !s.v.paused) s.v.pause();
        else if (active && !paused && s.v.paused && s.url) { var p = s.v.play(); if (p && p.catch) p.catch(function () {}); }
      }, 200);
      window.addEventListener('resize', onResize);
      function onResize() { layout(false); }

      OS.debugClikcok = { get found() { return foundList; }, get pos() { return pos; }, get hist() { return hist; }, get session() { return session; },
        get started() { return started; }, start: start, next: function () { go(1); }, prev: function () { go(-1); }, slots: slots };

      return {
        menu: function () {
          return [
            { label: muted ? 'Sound on' : 'Sound off', action: function () { setMuted(!muted); } },
            { label: 'Time spent', action: function () {
              var tot = OS.store.get(ID + ':total', 0) + session;
              OS.dialog({ title: 'Time spent', text: 'This session: ' + fmtWords(session || 1000) + '\nAll-time: ' + fmtWords(tot || 1000) + '\nSessions: ' + (OS.store.get(ID + ':sessions', 0) + 1) });
            } }
          ];
        },
        close: function () {
          clearInterval(tick);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('resize', onResize);
          listeners = listeners.filter(function (f) { return f !== onFound; });
          slots.forEach(function (s) { s.v.pause(); s.v.removeAttribute('src'); try { s.v.load(); } catch (e) {} });
          if (session > 0) { OS.store.set(ID + ':pending', session); finishSession(); }
        }
      };
    }
  });
})();
