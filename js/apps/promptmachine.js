/* =====================================================================
   PROMPT MACHINE — send a prompt to the show's queue from the phone, any day.
   Same database as the prompt-machine web page, so the receiver at the show
   reads these out with everything else. You can watch your prompts and see
   when one gets read on stage.

   Settings: js/content.js -> promptMachine
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'promptmachine';
  var DEFAULTS = {
    name: 'PROMPT MACHINE',
    database: 'https://prompt-bot-csk-default-rtdb.firebaseio.com',
    path: 'prompts',
    maxChars: 200,
    cooldown: 10,          // seconds between sends on one phone (same as the web page)
    readBonus: 50          // Drink Tickets (CSK TCG) when one of your prompts gets read on stage
  };
  function cfg() { var g = C.promptMachine || {}, o = {}, k; for (k in DEFAULTS) o[k] = DEFAULTS[k]; for (k in g) o[k] = g[k]; return o; }
  var K = cfg();
  function url(p) { return K.database.replace(/\/$/, '') + '/' + K.path + (p ? '/' + p : '') + '.json'; }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="6" fill="#050805" stroke="#000"/>' +
    '<rect x="8" y="8" width="32" height="24" rx="2" fill="#0b120b" stroke="#2c6a2a" stroke-width="1.5"/>' +
    '<path d="M12 15l4 3-4 3" fill="none" stroke="#7dff7a" stroke-width="2"/><rect x="18" y="20" width="8" height="2" fill="#7dff7a"/>' +
    '<rect x="13" y="25" width="22" height="1.5" fill="#3f8f3d"/>' +
    '<circle cx="15" cy="37.5" r="2.4" fill="#ffb000"/><circle cx="24" cy="37.5" r="2.4" fill="#ff3b3b"/><rect x="29" y="36" width="10" height="3" rx="1.5" fill="#3f8f3d"/></svg>';

  /* ---------- your prompts (kept on this phone) ---------- */
  function mine() { return OS.store.get(ID + ':mine', []); }
  function saveMine(a) { OS.store.set(ID + ':mine', a.slice(-30)); }
  function outbox() { return OS.store.get(ID + ':outbox', []); }
  function saveOutbox(a) { OS.store.set(ID + ':outbox', a); }

  function send(text, name) {
    // Firebase's plain web API: same record the web page writes
    return fetch(url(), { method: 'POST', body: JSON.stringify({ text: text, name: name || '', ts: { '.sv': 'timestamp' }, played: false }) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var a = mine(); a.push({ id: j.name, text: text, at: Date.now(), state: 'queued' }); saveMine(a);
        OS.emit('prompt-sent');
        return j.name;
      });
  }
  function flushOutbox() {
    var box = outbox(); if (!box.length || !navigator.onLine) return Promise.resolve(0);
    var sent = 0;
    return box.reduce(function (p, item) {
      return p.then(function () { return send(item.text, item.name).then(function () { sent++; saveOutbox(outbox().filter(function (x) { return x.at !== item.at; })); }); });
    }, Promise.resolve()).then(function () { if (sent) OS.toast(sent > 1 ? sent + ' saved prompts sent' : 'Saved prompt sent'); return sent; }, function () { return sent; });
  }
  // check which of your prompts got read on stage
  function checkPlayed(quiet) {
    var a = mine(), open = a.filter(function (p) { return p.state === 'queued'; }).slice(-15);
    if (!open.length) return Promise.resolve([]);
    return Promise.all(open.map(function (p) {
      return fetch(url(p.id + '/played'), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : undefined; }).catch(function () { return undefined; })
        .then(function (v) { return { p: p, v: v }; });
    })).then(function (res) {
      var read = [], a2 = mine();
      res.forEach(function (x) {
        if (x.v === undefined) return;                       // couldn't reach it, try later
        var m = a2.filter(function (q) { return q.id === x.p.id; })[0]; if (!m) return;
        if (x.v === true) { m.state = 'read'; m.readAt = Date.now(); read.push(m); }
        else if (x.v === null) m.state = 'cleared';          // removed from the queue without being read
      });
      saveMine(a2);
      if (read.length) {
        if (OS.tcg && K.readBonus) OS.tcg.add(K.readBonus * read.length, 'your prompt got read on stage', true);
        if (!quiet) OS.toast(read.length > 1 ? read.length + ' of your prompts got read on stage!' : 'Your prompt got read on stage!');
        else OS.notify({ title: K.name, text: (read.length > 1 ? read.length + ' of your prompts were' : '"' + read[0].text.slice(0, 60) + '" was') + ' read on stage!', icon: 'sms', tag: 'pm-read', replace: true,
          onTap: function () { OS.open(ID); } });
      }
      return read;
    });
  }
  // once in a while when the phone unlocks: send anything saved offline, look for prompts that got read
  OS.on('unlocked', function () {
    setTimeout(function () {
      flushOutbox();
      var last = OS.store.get(ID + ':checked', 0);
      if (Date.now() - last > 3 * 3600000) { OS.store.set(ID + ':checked', Date.now()); checkPlayed(true); }
    }, 6000);
  });
  window.addEventListener('online', function () { flushOutbox(); });

  /* ---------- the app ---------- */
  function showLine() {
    var n = OS.nextShow ? OS.nextShow() : null;
    if (!n) return '';
    var ms = n.start - Date.now();
    if (n.live || ms <= 0) return '<span class="pm-live">● SHOW IS LIVE. The machine may speak any second.</span>';
    var d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
    return 'NEXT SHOW IN ' + (d ? d + 'D ' : '') + (d || h ? h + 'H ' : '') + m + 'M. Prompts sent now wait in the queue.';
  }

  OS.registerApp({
    id: ID, name: K.name, icon: ICON,
    launch: function (root) {
      K = cfg();
      root.classList.add('pm');
      root.innerHTML =
        '<div class="pm-wrap scroll">' +
          '<h1 class="pm-title">' + OS.esc(K.name) + '</h1>' +
          '<p class="pm-sub">Feed the machine. The comedian decides when it speaks.</p>' +
          '<div class="pm-show"></div>' +
          '<div class="pm-crt">' +
            '<label>Your prompt</label>' +
            '<textarea class="pm-text" maxlength="' + K.maxChars + '" placeholder="> type something for the comedian..."></textarea>' +
            '<div class="pm-count">0 / ' + K.maxChars + '</div>' +
            '<label>Name (optional)</label>' +
            '<input class="pm-name" type="text" maxlength="24" placeholder="anonymous" autocomplete="nickname">' +
            '<button class="pm-send">TRANSMIT ▶</button>' +
            '<div class="pm-status"></div>' +
          '</div>' +
          '<div class="pm-minehead">YOUR PROMPTS</div><div class="pm-mine"></div>' +
          '<p class="pm-fine">Your prompt goes into the show\'s queue. It may be read out loud by a robot in front of everyone. Or it may never be chosen. That\'s showbiz.</p>' +
        '</div>';
      var ta = root.querySelector('.pm-text'), nm = root.querySelector('.pm-name'), btn = root.querySelector('.pm-send'),
        st = root.querySelector('.pm-status'), cnt = root.querySelector('.pm-count'), list = root.querySelector('.pm-mine'), show = root.querySelector('.pm-show');
      nm.value = OS.store.get(ID + ':name', '');
      ta.value = OS.store.get(ID + ':draft', '');

      function status(msg, cls) { st.className = 'pm-status ' + (cls || ''); st.textContent = msg; }
      function count() { cnt.textContent = ta.value.length + ' / ' + K.maxChars; cnt.classList.toggle('warn', ta.value.length > K.maxChars * 0.85); OS.store.set(ID + ':draft', ta.value); }
      ta.addEventListener('input', count); count();
      nm.addEventListener('change', function () { OS.store.set(ID + ':name', nm.value.trim().slice(0, 24)); });

      function renderMine() {
        var a = mine().slice().reverse(), box = outbox();
        var rows = box.map(function (p) { return '<div class="pm-item wait"><span class="pm-tag">SAVED</span>' + OS.esc(p.text) + '<em>will send when you\'re back online</em></div>'; });
        rows = rows.concat(a.map(function (p) {
          var tag = p.state === 'read' ? '<span class="pm-tag read">READ ON STAGE</span>' : p.state === 'cleared' ? '<span class="pm-tag gone">CLEARED</span>' : '<span class="pm-tag">IN QUEUE</span>';
          return '<div class="pm-item ' + (p.state || '') + '">' + tag + OS.esc(p.text) + '<em>' + new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</em></div>';
        }));
        list.innerHTML = rows.length ? rows.join('') : '<div class="pm-empty">> nothing sent yet</div>';
      }

      var cdTimer = null;
      function cooldownLeft() { return Math.max(0, Math.ceil((OS.store.get(ID + ':last', 0) + K.cooldown * 1000 - Date.now()) / 1000)); }
      function runCooldown() {
        clearInterval(cdTimer);
        function tick() {
          var s = cooldownLeft();
          if (s > 0) { btn.disabled = true; btn.textContent = 'RECHARGING… ' + s; }
          else { btn.disabled = false; btn.textContent = 'TRANSMIT ▶'; clearInterval(cdTimer); }
        }
        tick(); cdTimer = setInterval(tick, 500);
      }
      runCooldown();

      btn.onclick = function () {
        var text = ta.value.replace(/\s+/g, ' ').trim().slice(0, K.maxChars), name = nm.value.replace(/\s+/g, ' ').trim().slice(0, 24);
        if (!text) { status('> The machine requires words.', 'err'); ta.focus(); return; }
        if (cooldownLeft() > 0) return;
        OS.store.set(ID + ':name', name);
        btn.disabled = true; status('> TRANSMITTING…', 'wait');
        var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 10000); });
        Promise.race([send(text, name), timeout]).then(function () {
          OS.store.set(ID + ':last', Date.now());
          ta.value = ''; count();
          status('> RECEIVED. Your prompt is in the queue.', 'ok');
          OS.beep(880, 0.06); OS.beep(1320, 0.08, 0.07);
          renderMine(); runCooldown();
        }).catch(function () {
          if (!navigator.onLine) {
            var box = outbox(); box.push({ text: text, name: name, at: Date.now() }); saveOutbox(box);
            OS.store.set(ID + ':last', Date.now());
            ta.value = ''; count();
            status('> NO SIGNAL. Saved. It sends itself when you\'re back online.', 'wait');
            renderMine(); runCooldown();
          } else { status('> Transmission failed. Check your signal and try again.', 'err'); btn.disabled = false; }
        });
      };

      function tickShow() { show.innerHTML = showLine(); }
      tickShow(); var showTimer = setInterval(tickShow, 30000);
      renderMine();
      flushOutbox().then(function (n) { if (n) renderMine(); });
      checkPlayed(false).then(function (r) { renderMine(); if (r.length) status('> ' + (r.length > 1 ? r.length + ' of your prompts were' : 'One of your prompts was') + ' read on stage.' + (OS.tcg && K.readBonus ? ' +' + (K.readBonus * r.length) + ' Drink Tickets.' : ''), 'ok'); });

      OS.debugPrompt = { send: send, mine: mine, check: checkPlayed, outbox: outbox };
      return {
        close: function () { clearInterval(cdTimer); clearInterval(showTimer); }
      };
    }
  });
})();
