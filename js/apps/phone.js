/* =====================================================================
   PHONE — dialer, call log, contacts, in-call screen
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C, P = C.phone || {};

  var ICON = '<svg viewBox="0 0 48 48"><g transform="translate(4 4) scale(1.67)">' +
    '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="url(#g-green)" stroke="#1d4d08" stroke-width=".6"/></g>' +
    '<path d="M14 9c3-2 6-2 8 0" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
  var CONTACTS_ICON = '<svg viewBox="0 0 48 48"><rect x="7" y="5" width="34" height="38" rx="3" fill="url(#g-orange)" stroke="#5a2a00"/>' +
    '<rect x="4" y="11" width="5" height="4" rx="1" fill="#ddd"/><rect x="4" y="22" width="5" height="4" rx="1" fill="#ddd"/><rect x="4" y="33" width="5" height="4" rx="1" fill="#ddd"/>' +
    '<circle cx="25" cy="19" r="6" fill="#fff"/><path d="M14 36c0-6 5-9 11-9s11 3 11 9z" fill="#fff"/></svg>';

  /* ---------- call log storage ---------- */
  function userCalls() { return OS.store.get('calls', []); }
  function addCall(entry) { var l = userCalls(); l.unshift(entry); OS.store.set('calls', l.slice(0, 50)); }
  function allCalls() {
    var mine = userCalls().map(function (e) { return { contact: e.contact, number: e.number, type: e.type, time: OS.fmtWhen(e.ts), duration: e.duration }; });
    return mine.concat(C.callLog || []);
  }

  OS.registerApp({
    id: 'phone', name: 'Phone', icon: ICON,
    launch: function (root, args) {
      var tab = args.tab || 'dialer', number = '', inCall = null, detail = null;

      root.innerHTML =
        '<div class="ph-tabs">' +
        tabBtn('dialer', 'dialpad', 'Phone') + tabBtn('log', 'log', 'Call log') + tabBtn('contacts', 'contacts', 'Contacts') +
        '</div><div class="ph-body"></div>';
      var bodyEl = root.querySelector('.ph-body');
      Array.prototype.forEach.call(root.querySelectorAll('.ph-tab'), function (b) {
        b.onclick = function () { detail = null; show(b.getAttribute('data-tab')); };
      });
      function tabBtn(id, glyph, label) {
        return '<button class="ph-tab" data-tab="' + id + '">' + OS.glyph(glyph) + '<span>' + label + '</span></button>';
      }

      function show(t) {
        tab = t;
        Array.prototype.forEach.call(root.querySelectorAll('.ph-tab'), function (b) { b.classList.toggle('sel', b.getAttribute('data-tab') === t); });
        bodyEl.innerHTML = '';
        if (t === 'dialer') renderDialer();
        else if (t === 'log') renderLog();
        else renderContacts();
      }

      /* ----- dialer ----- */
      var KEYS = [['1', 'oo'], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
      function renderDialer() {
        bodyEl.innerHTML =
          '<div class="dial-display"><div class="dial-num"></div></div>' +
          '<div class="keypad">' + KEYS.map(function (k) {
            return '<button class="key" data-k="' + k[0] + '"><b>' + k[0] + '</b><small>' + (k[1] === 'oo' ? OS.glyph('voicemail', 'vm-mini') : k[1]) + '</small></button>';
          }).join('') + '</div>' +
          '<div class="dial-actions"><button class="da-vm">' + OS.glyph('voicemail') + '</button>' +
          '<button class="da-call">' + OS.glyph('phone') + '</button>' +
          '<button class="da-del">' + OS.glyph('backspace') + '</button></div>';
        var numEl = bodyEl.querySelector('.dial-num');
        function upd() { numEl.textContent = OS.fmtNumber(number); numEl.classList.toggle('small', number.length > 12); }
        upd();
        Array.prototype.forEach.call(bodyEl.querySelectorAll('.key'), function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-k');
            OS.dtmf(k);
            number += k; upd();
            var code = (C.dialCodes || {})[number];
            if (code && /[*#]/.test(number)) { var n0 = number; number = ''; upd(); OS.emit('dialcode:' + n0); OS.run(code); }
          };
        });
        var del = bodyEl.querySelector('.da-del'), holdT = null;
        del.onclick = function () { number = number.slice(0, -1); upd(); };
        del.addEventListener('pointerdown', function () { holdT = setTimeout(function () { number = ''; upd(); }, 600); });
        del.addEventListener('pointerup', function () { clearTimeout(holdT); });
        del.addEventListener('pointerleave', function () { clearTimeout(holdT); });
        bodyEl.querySelector('.da-call').onclick = function () {
          if (!number) { var last = userCalls()[0]; if (last) { number = last.number; upd(); } return; }
          var code = (C.dialCodes || {})[number];
          var n = number; number = ''; upd();
          if (code) { OS.run(code); return; }
          dial(n);
        };
        bodyEl.querySelector('.da-vm').onclick = callVoicemailBox;
      }

      /* ----- call log ----- */
      function renderLog() {
        var list = OS.el('div', 'list scroll');
        var calls = allCalls();
        if (!calls.length) list.innerHTML = '<div class="empty">No call log</div>';
        calls.forEach(function (e) {
          var c = e.contact ? OS.contact(e.contact) : OS.findByNumber(e.number);
          var name = c ? c.name : (e.name || OS.fmtNumber(e.number || 'Unknown'));
          var num = c ? c.number : e.number;
          var row = OS.el('div', 'row call-row ' + e.type,
            '<div class="ct-ico">' + OS.glyph(e.type === 'missed' ? 'missed' : e.type) + '</div>' +
            '<div class="grow"><div class="t1">' + OS.esc(name) + '</div><div class="t2">' + (c ? 'Mobile ' : '') + OS.esc(OS.fmtNumber(num || '')) + '</div></div>' +
            '<div class="t2 right">' + OS.esc(e.time || '') + (e.duration ? '<br>' + fmtDur(e.duration) : '') + '</div>' +
            '<button class="row-call">' + OS.glyph('phone') + '</button>');
          row.onclick = function () { if (c) openContact(c); else if (num) dial(num); };
          row.querySelector('.row-call').onclick = function (ev) { ev.stopPropagation(); if (num) dial(num); };
          list.appendChild(row);
        });
        bodyEl.appendChild(list);
      }

      /* ----- contacts ----- */
      function renderContacts() {
        var list = OS.el('div', 'list scroll');
        var cs = OS.contacts.slice().sort(function (a, b) { return OS.natSort(a.name, b.name); });
        var letter = '';
        cs.forEach(function (c) {
          var L = (c.name || '?').charAt(0).toUpperCase();
          if (!/[A-Z]/.test(L)) L = '#';
          if (L !== letter) { letter = L; list.appendChild(OS.el('div', 'list-head', L)); }
          var row = OS.el('div', 'row', OS.avatar(c, 44) + '<div class="grow"><div class="t1">' + OS.esc(c.name) + '</div></div>');
          row.onclick = function () { openContact(c); };
          list.appendChild(row);
        });
        bodyEl.appendChild(list);
      }
      function openContact(c) {
        detail = c;
        bodyEl.innerHTML = '';
        var v = OS.el('div', 'contact-detail scroll',
          '<div class="cd-head">' + OS.avatar(c, 84) + '<div class="cd-name">' + OS.esc(c.name) + '</div></div>' +
          '<div class="list">' +
          '<div class="row cd-call">' + OS.glyph('phone', 'cd-g') + '<div class="grow"><div class="t1">Call mobile</div><div class="t2">' + OS.esc(OS.fmtNumber(c.number)) + '</div></div></div>' +
          '<div class="row cd-sms">' + OS.glyph('sms', 'cd-g') + '<div class="grow"><div class="t1">Send text message</div><div class="t2">' + OS.esc(OS.fmtNumber(c.number)) + '</div></div></div>' +
          (c.note ? '<div class="list-head">Notes</div><div class="cd-note">' + OS.esc(c.note).replace(/\n/g, '<br>') + '</div>' : '') +
          '</div>');
        v.querySelector('.cd-call').onclick = function () { dial(c.number); };
        v.querySelector('.cd-sms').onclick = function () { OS.open('messages', { thread: c.id, contact: c.id }); };
        bodyEl.appendChild(v);
      }

      /* ----- placing calls ----- */
      function dial(num) {
        var c = OS.findByNumber(num);
        var vb = P.voicemailBox || {};
        if (!c && vb.number && OS.digits(num) === OS.digits(vb.number)) return callVoicemailBox();
        if (c) startCall({ kind: 'contact', contact: c, number: c.number,
          file: c.voicemail || ('media/voicemail/' + c.id + '.mp3'), text: c.voicemailText, ring: c.ringSeconds });
        else startCall({ kind: 'unknown', number: num, file: (C.sounds || {}).notInService, text: P.notInServiceText, ring: 1.5 });
      }
      function callVoicemailBox() {
        var vb = P.voicemailBox || {};
        startCall({ kind: 'voicemail', name: 'Voicemail', number: vb.number || '', file: vb.file, text: vb.text, ring: 1 });
      }

      function startCall(t) {
        if (inCall) return;
        var primed = OS.primeAudio(t.file);   // must happen inside the tap for iOS
        var name = t.contact ? t.contact.name : (t.name || OS.fmtNumber(t.number));
        var ov = OS.el('div', 'incall',
          '<div class="ic-top"><div class="ic-status">Dialing</div><div class="ic-timer"></div></div>' +
          '<div class="ic-photo">' + OS.avatar(t.contact || { name: name }, 150) + '</div>' +
          '<div class="ic-name">' + OS.esc(name) + '</div>' +
          '<div class="ic-num">' + OS.esc(t.contact ? 'Mobile ' + OS.fmtNumber(t.number) : '') + '</div>' +
          '<div class="ic-btns"><button class="ic-mute">' + OS.glyph('mute') + '<span>Mute</span></button>' +
          '<button class="ic-spk">' + OS.glyph('sound') + '<span>Speaker</span></button></div>' +
          '<button class="ic-end">' + OS.glyph('phone') + '<span>End</span></button>');
        root.appendChild(ov);
        var st = ov.querySelector('.ic-status'), tm = ov.querySelector('.ic-timer');
        var stopRing = OS.loopSound('ringback', 6), voice = null, iv = null, to = null, connectedAt = 0, ended = false, muted = false;
        inCall = { end: finish };

        to = setTimeout(connect, (t.ring != null ? t.ring : (P.defaultRingSeconds || 4)) * 1000);
        function connect() {
          if (stopRing) { stopRing(); stopRing = null; }
          if (t.kind === 'unknown') {
            st.textContent = 'Call failed';
            OS.sfx('sit');
            to = setTimeout(function () { voice = OS.playVoice(t.file, t.text, finish, primed); }, 1100);
            return;
          }
          connectedAt = Date.now();
          st.textContent = t.kind === 'voicemail' ? 'Voicemail' : 'Connected';
          ov.classList.add('live');
          iv = setInterval(tick, 500); tick();
          voice = OS.playVoice(t.file, t.text, finish, primed);
          if (muted) voice.setMuted(true);
        }
        function tick() { tm.textContent = fmtDur(Math.floor((Date.now() - connectedAt) / 1000)); }
        function finish() {
          if (ended) return;
          ended = true;
          if (stopRing) stopRing();
          if (voice) voice.stop();
          clearTimeout(to); clearInterval(iv);
          st.textContent = 'Call ended';
          ov.classList.remove('live'); ov.classList.add('ended');
          OS.sfx('hangup');
          var dur = connectedAt ? Math.floor((Date.now() - connectedAt) / 1000) : 0;
          addCall({ contact: t.contact ? t.contact.id : null, number: t.number, type: 'outgoing', ts: Date.now(), duration: dur });
          OS.emit('called:' + (t.contact ? t.contact.id : t.kind), t);
          setTimeout(function () { ov.remove(); inCall = null; if (!detail) show(tab); }, 1300);
        }
        ov.querySelector('.ic-end').onclick = finish;
        ov.querySelector('.ic-mute').onclick = function () {
          muted = !muted; this.classList.toggle('on', muted); if (voice) voice.setMuted(muted);
        };
        ov.querySelector('.ic-spk').onclick = function () { this.classList.toggle('on'); };
      }

      if (args.call) { show(tab); dial(args.call); }
      else show(tab);

      return {
        back: function () {
          if (inCall) return true;                      // can't back out of a call
          if (detail) { detail = null; show(tab); return true; }
          return false;
        },
        menu: function () {
          return [
            { label: 'Clear call log', action: function () { OS.store.set('calls', []); if (tab === 'log') show('log'); OS.toast('Call log cleared'); } },
            { label: 'Call settings', action: function () { OS.toast('Not available'); } }
          ];
        },
        close: function () { if (inCall) inCall.end(); }
      };
    }
  });

  function fmtDur(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // separate drawer icon that opens straight to contacts
  OS.registerApp({ id: 'contacts', name: 'Contacts', icon: CONTACTS_ICON, alias: 'phone', aliasArgs: { tab: 'contacts' } });
})();
