/* =====================================================================
   MESSAGES — threads, conversation view, timed incoming texts
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C, P = C.phone || {};

  var ICON = '<svg viewBox="0 0 48 48"><path d="M8 8h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-9 7v-7H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="url(#g-green)" stroke="#1d4d08"/>' +
    '<circle cx="15" cy="21" r="3" fill="#fff"/><circle cx="24" cy="21" r="3" fill="#fff"/><circle cx="33" cy="21" r="3" fill="#fff"/>' +
    '<path d="M9 12h30" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ---------- data ---------- */
  var S = OS.sms = {};
  function contentThread(id) { return (C.threads || []).filter(function (t) { return t.id === id; })[0] || null; }
  function extraThreads() { return OS.store.get('extraThreads', {}); }
  function extraMsgs(id) { return OS.store.get('sms:' + id, []); }

  S.thread = function (id) {
    var t = contentThread(id) || extraThreads()[id];
    if (!t) {
      var c = OS.contact(id);
      if (!c) return null;
      t = { id: id, contact: id };
    }
    var c2 = t.contact ? OS.contact(t.contact) : null;
    return {
      id: id, raw: t, contact: c2,
      name: c2 ? c2.name : (t.name || OS.fmtNumber(t.number || 'Unknown')),
      number: c2 ? c2.number : (t.number || ''),
      messages: (t.messages || []).concat(extraMsgs(id))
    };
  };
  S.threads = function () {
    var ids = (C.threads || []).map(function (t) { return t.id; });
    Object.keys(extraThreads()).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    OS.store.get('smsIds', []).forEach(function (id) { if (ids.indexOf(id) < 0 && S.thread(id)) ids.push(id); });
    // threads that have messages stored this session float to the top, newest first
    return ids.map(function (id, i) {
      var t = S.thread(id), ex = extraMsgs(id);
      t.sortKey = ex.length ? ex[ex.length - 1].ts : -i;
      return t;
    }).filter(function (t) { return t.messages.length; })
      .sort(function (a, b) { return b.sortKey - a.sortKey; });
  };

  // unread counts (first run uses `unread` from content.js)
  function unreadMap() {
    var u = OS.store.get('unread', null);
    if (!u) { u = {}; (C.threads || []).forEach(function (t) { if (t.unread) u[t.id] = t.unread; }); OS.store.set('unread', u); }
    return u;
  }
  S.unread = function (id) { return unreadMap()[id] || 0; };
  S.totalUnread = function () { var u = unreadMap(), n = 0; Object.keys(u).forEach(function (k) { n += u[k]; }); return n; };
  function setUnread(id, n) { var u = unreadMap(); if (n) u[id] = n; else delete u[id]; OS.store.set('unread', u); OS.emit('unread-changed'); }

  function store(id, msg) {
    var l = extraMsgs(id); l.push(msg);
    if (l.length > 400) l = l.slice(-400);
    OS.store.set('sms:' + id, l);
    var ids = OS.store.get('smsIds', []);
    if (ids.indexOf(id) < 0) { ids.push(id); OS.store.set('smsIds', ids); }
  }
  // wipe everything stored for a thread (used by the weekly prompt reset)
  S.clearThread = function (id) {
    OS.store.set('sms:' + id, []);
    setUnread(id, 0);
    OS.clearNotifs('sms:' + id);
    OS.emit('sms-changed');
  };
  // like / dislike a message (joke prompts)
  S.rate = function (id, msgId, value) {
    var l = extraMsgs(id), m = null;
    for (var i = 0; i < l.length; i++) if (l[i].id === msgId) m = l[i];
    if (!m || m.rated) return null;
    m.rated = value;
    OS.store.set('sms:' + id, l);
    OS.emit('prompt-rated', { thread: id, value: value, msg: m });
    OS.emit('prompt-rated:' + value, m);
    return m;
  };

  var openThreadId = null, liveAppend = null;

  // deliver an incoming text (scheduled messages, dial codes, auto replies)
  S.deliver = function (id, text, meta) {
    meta = meta || {};
    if (!id) return;
    if (!contentThread(id) && !OS.contact(id) && !extraThreads()[id]) {
      var ex = extraThreads();
      ex[id] = { id: id, name: meta.from || 'Unknown', number: meta.number || '' };
      OS.store.set('extraThreads', ex);
    }
    var msg = { text: text, ts: meta.ts || Date.now() };
    if (meta.kind) msg.kind = meta.kind;
    if (meta.id) msg.id = meta.id;
    store(id, msg);
    var t = S.thread(id);
    if (openThreadId === id && liveAppend && OS.state === 'on') {
      liveAppend(msg);
      if (!meta.quiet) OS.sfx('notify');
    } else {
      var n = S.unread(id) + 1;
      setUnread(id, n);
      // one notification per conversation, showing how many are waiting (like Android did)
      OS.notify({ icon: 'sms', tag: 'sms:' + id, replace: true, quiet: meta.quiet,
        title: t.name + (n > 1 ? '  (' + n + ' new)' : ''), text: text,
        onTap: function () { OS.open('messages', { thread: id }); } });
    }
    OS.emit('sms-received:' + id, text);
    OS.emit('sms-changed');
  };

  /* ---------- scheduler ---------- */
  OS.once('unlocked', function () {
    var delivered = OS.store.get('delivered', []);
    (C.scheduledMessages || []).forEach(function (m) {
      if (delivered.indexOf(m.id) >= 0) return;
      var arm = function () {
        setTimeout(function () {
          var d = OS.store.get('delivered', []);
          if (d.indexOf(m.id) >= 0) return;
          d.push(m.id); OS.store.set('delivered', d);
          S.deliver(m.thread, m.text, m);
        }, (m.delay || 0) * 1000);
      };
      if (m.trigger) OS.once(m.trigger, arm); else arm();
    });
  });

  /* ---------- app ---------- */
  OS.registerApp({
    id: 'messages', name: 'Messaging', icon: ICON,
    launch: function (root, args) {
      var view = 'list';
      function onChange() { if (view === 'list') renderList(); }
      OS.on('sms-changed', onChange);

      function renderList() {
        view = 'list'; openThreadId = null; liveAppend = null;
        root.innerHTML = OS.titleBar('Messaging', OS.glyph('sms'));
        var list = OS.el('div', 'list scroll');
        var ts = S.threads();
        if (!ts.length) list.innerHTML = '<div class="empty">No conversations.</div>';
        ts.forEach(function (t) {
          var last = t.messages[t.messages.length - 1] || {};
          var u = S.unread(t.id);
          var row = OS.el('div', 'row thread-row' + (u ? ' unread' : ''),
            OS.avatar(t.contact || { name: t.name }, 48) +
            '<div class="grow"><div class="t1">' + OS.esc(t.name) + (t.messages.length > 1 ? ' <span class="cnt">(' + t.messages.length + ')</span>' : '') + '</div>' +
            '<div class="t2 snip">' + OS.esc(last.text || '') + '</div></div>' +
            '<div class="t2 right">' + OS.esc(last.ts ? OS.fmtWhen(last.ts) : (last.time || '')) + '</div>');
          row.onclick = function () { renderThread(t.id); };
          list.appendChild(row);
        });
        root.appendChild(list);
      }

      function renderThread(id) {
        var t = S.thread(id);
        if (!t) return renderList();
        view = 'thread'; openThreadId = id;
        setUnread(id, 0); OS.clearNotifs('sms:' + id);
        root.innerHTML = OS.titleBar(t.name + (t.number ? '  ' + OS.fmtNumber(t.number) : ''), OS.glyph('sms'));
        var convo = OS.el('div', 'convo scroll');
        root.appendChild(convo);
        var compose = OS.el('div', 'compose',
          '<input type="text" placeholder="Type to compose" maxlength="160" enterkeyhint="send"><button class="btn send">Send</button>');
        root.appendChild(compose);
        t.messages.forEach(function (m) { convo.appendChild(bubble(m, t)); });
        convo.scrollTop = convo.scrollHeight;
        liveAppend = function (m) { convo.appendChild(bubble(m, t)); convo.scrollTop = convo.scrollHeight; };

        var input = compose.querySelector('input');
        function send() {
          var text = input.value.trim();
          if (!text) return;
          input.value = '';
          var msg = { me: true, text: text, ts: Date.now() };
          if (t.raw.failSend) msg.failed = true;
          store(id, msg); liveAppend(msg);
          OS.emit('sms-sent:' + id, text);
          var replies = t.raw.autoReplies;
          if (!t.raw.failSend && replies && replies.length) {
            var k = 'replyIdx:' + id, i = OS.store.get(k, 0);
            OS.store.set(k, i + 1);
            var reply = replies[i % replies.length];
            setTimeout(function () { S.deliver(id, reply); }, ((P.replyDelaySeconds || 4) + Math.random() * 2) * 1000);
          }
        }
        compose.querySelector('.send').onclick = send;
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      }

      function bubble(m, t) {
        var b = OS.el('div', 'msg ' + (m.me ? 'out' : 'in'));
        var who = m.me ? { name: 'Me', id: 'me' } : (t.contact || { name: t.name });
        b.innerHTML = OS.avatar(who, 40) +
          '<div class="bubble"><div class="b-text">' + OS.esc(m.text).replace(/\n/g, '<br>') + '</div>' +
          '<div class="b-time">' + (m.failed ? '<span class="fail">Message not sent</span>' : OS.esc(m.ts ? OS.fmtWhen(m.ts) : (m.time || ''))) + '</div></div>';
        if (m.kind === 'prompt' && m.id && !m.me) {
          var rate = OS.el('div', 'rate');
          var paint = function (v) {
            rate.className = 'rate' + (v ? ' done ' + v : '');
            rate.innerHTML = v
              ? OS.glyph(v === 'like' ? 'up' : 'down') + '<span>' + (v === 'like' ? 'You liked this' : 'You passed on this') + '</span>'
              : '<button class="r-like">' + OS.glyph('up') + '<span>Like</span></button><button class="r-dislike">' + OS.glyph('down') + '<span>Nah</span></button>';
            if (!v) {
              rate.querySelector('.r-like').onclick = function () { if (S.rate(t.id, m.id, 'like')) paint('like'); };
              rate.querySelector('.r-dislike').onclick = function () { if (S.rate(t.id, m.id, 'dislike')) paint('dislike'); };
            }
          };
          paint(m.rated);
          b.querySelector('.bubble').appendChild(rate);
        }
        return b;
      }

      if (args.thread) renderThread(args.thread); else renderList();

      return {
        back: function () { if (view === 'thread') { renderList(); return true; } return false; },
        menu: function () {
          var items = [];
          if (view === 'thread') items.push({ label: 'Delete thread', action: function () {
            OS.dialog({ title: 'Delete', text: 'This phone will not let you delete this.', buttons: [{ label: 'OK' }] });
          } });
          items.push({ label: 'Settings', action: function () { OS.open('settings'); } });
          return items;
        },
        close: function () {
          openThreadId = null; liveAppend = null;
          OS.off('sms-changed', onChange);
        }
      };
    }
  });
})();
