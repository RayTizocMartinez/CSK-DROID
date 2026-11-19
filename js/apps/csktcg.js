/* =====================================================================
   CSK TCG — you're the booker. Earn Drink Tickets in every app on the phone,
   buy packs, build a lineup, and take over every comedy spot in town.

   Cards, venues, odds, payouts:  js/cards.js
   Battle rules:                  js/tcg-engine.js
   Wallet / collection / payouts: js/tcg-core.js
   Art:  media/cards/<card id>.png  ·  media/cards/rivals/<portrait>.png
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TCG; if (!D || !OS.tcg) return;
  var T = OS.tcg, E = new window.TCGEngine(D);
  var ART = 'media/cards/';
  var RAR = { openmic: 'Open Mic', feature: 'Feature', headliner: 'Headliner', legend: 'Legend' };

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="#1d1430" stroke="#000"/>' +
    '<rect x="9" y="11" width="18" height="26" rx="2.5" fill="#3b8fe8" stroke="#0b1b33" stroke-width="1.2" transform="rotate(-12 18 24)"/>' +
    '<rect x="20" y="10" width="18" height="26" rx="2.5" fill="#f2b01e" stroke="#3a2600" stroke-width="1.2" transform="rotate(10 29 23)"/>' +
    '<circle cx="29.5" cy="20" r="4" fill="#111"/><rect x="28.3" y="23" width="2.4" height="7" fill="#111" transform="rotate(10 29 26)"/>' +
    '<circle cx="12" cy="36" r="5" fill="#e8322e" stroke="#000" stroke-width="1"/><text x="12" y="38.6" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff" font-family="Arial">C</text></svg>';

  /* ---------- little helpers ---------- */
  function esc(s) { return OS.esc(s == null ? '' : String(s)); }
  function initials(n) { return (n || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function artHTML(id, name, cls) {
    return '<div class="tc-art ' + (cls || '') + '" data-ini="' + esc(initials(name)) + '"><img src="' + esc(OS.url(ART + id + '.png')) + '" alt="" onerror="this.remove()"></div>';
  }
  function portrait(v) {
    return '<div class="tc-portrait" data-ini="' + esc(initials(v.rival)) + '"><img src="' + esc(OS.url(ART + 'rivals/' + v.portrait + '.png')) + '" alt="" onerror="this.remove()"></div>';
  }
  function beep(kind) {
    var B = { play: [[520, 0.05]], hit: [[180, 0.07]], die: [[300, 0.06], [200, 0.1]], win: [[523, 0.1], [659, 0.1], [784, 0.16]], lose: [[392, 0.15], [294, 0.22]], flip: [[880, 0.03]], buy: [[660, 0.05], [990, 0.07]] }[kind] || [];
    var t = 0; B.forEach(function (n) { OS.beep(n[0], n[1], t, 0.05); t += n[1] * 0.9; });
  }

  /* ---------- a card, drawn ---------- */
  function cardHTML(id, o) {
    o = o || {};
    var c = T.card(id); if (!c) return '';
    var cost = o.cost != null ? o.cost : c.cost;
    var cls = 'tc-card r-' + c.rarity + ' t-' + c.type + (o.cls ? ' ' + o.cls : '') + (cost < c.cost ? ' cheap' : '');
    var stats = c.type === 'comic' ? '<b class="tc-p">' + c.punch + '</b><b class="tc-n">' + c.nerve + '</b>' : '';
    return '<div class="' + cls + '" data-id="' + esc(id) + '">' +
      artHTML(id, c.name) +
      '<b class="tc-cost">' + cost + '</b>' +
      '<div class="tc-name">' + esc(c.name) + '</div>' +
      '<div class="tc-text' + (((c.ability || '').length + (c.text || '').length) > 80 ? ' long' : '') + '">' + (c.ability ? '<b>' + esc(c.ability) + '.</b> ' : '') + esc(c.text) + '</div>' +
      '<div class="tc-rar">' + RAR[c.rarity] + (c.battle ? ' · Battle' : '') + (c.type === 'bit' ? ' · Bit' : '') + '</div>' + stats + '</div>';
  }

  OS.registerApp({
    id: 'csktcg', name: D.name, icon: ICON,
    launch: function (root, args) {
      T.init();
      root.classList.add('tcg');
      var view = 'hub', battle = null, backFn = null;
      setTimeout(function () { T.collectIncome(); }, 400);

      function frame(title, body, extra) {
        root.innerHTML = '<div class="tc-top"><b>' + esc(title) + '</b><span class="tc-wallet">' + ticketSvg() + ' <i>' + T.tickets() + '</i></span></div>' +
          '<div class="tc-body scroll">' + body + '</div>' + (extra || '');
      }
      function ticketSvg() { return '<svg viewBox="0 0 24 24" class="tc-tk"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" fill="#f2b01e"/><path d="M9 5v14" stroke="#7a5200" stroke-dasharray="1.6 1.6"/></svg>'; }
      function onTickets() { var w = root.querySelector('.tc-wallet i'); if (w) w.textContent = T.tickets(); }
      OS.on('tickets-changed', onTickets);

      /* =================== HUB =================== */
      function hub() {
        view = 'hub'; backFn = null;
        var own = Object.keys(T.owned()).length, col = T.collection(), have = D.cards.filter(function (c) { return col[c.id]; }).length;
        frame(D.name,
          '<div class="tc-hero"><div class="tc-logo">CSK<span>TCG</span></div><div class="tc-sub">You\'re the booker. Take over the town.</div></div>' +
          '<button class="tc-big" data-go="map"><b>Territory</b><span>' + own + ' / ' + D.venues.length + ' venues yours</span></button>' +
          '<button class="tc-big" data-go="shop"><b>Packs</b><span>' + D.pack.price + ' ' + esc(D.currency) + ' each' + (T.freePacks() ? ' · <em>' + T.freePacks() + ' free</em>' : '') + '</span></button>' +
          '<button class="tc-big" data-go="deck"><b>Lineup</b><span>Build your ' + D.deckSize + '-card deck</span></button>' +
          '<button class="tc-big" data-go="col"><b>Collection</b><span>' + have + ' / ' + D.cards.length + ' cards</span></button>' +
          '<div class="tc-earn"><b>Earn ' + esc(D.currency) + '</b> by playing anything on the phone: every game pays, the first play of each game each day pays +' + D.firstPlayBonus +
          ', ClikCok and BARKPOD pay for your time, and venues you own pay every day.' + (T.isShowDay() ? ' <em>It\'s show day: everything pays double.</em>' : '') + '</div>');
        Array.prototype.forEach.call(root.querySelectorAll('[data-go]'), function (b) {
          b.onclick = function () { ({ map: map, shop: shop, deck: deckView, col: collection })[b.getAttribute('data-go')](); };
        });
      }

      /* =================== TERRITORY MAP =================== */
      function map() {
        view = 'map'; backFn = hub;
        var own = T.owned(), pins = '';
        var home = { x: 50, y: 88 };
        D.venues.forEach(function (v, i) {
          var st = own[v.id] ? 'own' : T.unlocked(i) ? 'open' : 'locked';
          if (st === 'own') pins += '<svg class="tc-route" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="' + home.x + '" y1="' + home.y + '" x2="' + v.x + '" y2="' + v.y + '"/></svg>';
          pins += '<button class="tc-pin ' + st + '" data-i="' + i + '" style="left:' + v.x + '%;top:' + v.y + '%"><i><b>' + (st === 'own' ? '&#9733;' : st === 'locked' ? '&#128274;' : (i + 1)) + '</b></i><span>' + esc(v.name) + '</span></button>';
        });
        pins += '<div class="tc-pin home" style="left:' + home.x + '%;top:' + home.y + '%"><i><b>&#8962;</b></i><span>' + esc(D.homeBase) + '</span></div>';
        frame('Territory', '<div class="tc-map"><svg class="tc-river" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M-5 30 C 20 40, 30 20, 50 45 S 80 70, 105 55"/></svg>' + pins + '</div>' +
          '<div class="tc-maphint">Take over each spot in order. Venues you run pay ' + D.venueIncome + ' ' + esc(D.currency) + ' a day.</div>');
        Array.prototype.forEach.call(root.querySelectorAll('.tc-pin[data-i]'), function (b) { b.onclick = function () { venuePanel(+b.getAttribute('data-i')); }; });
      }
      function venuePanel(i) {
        var v = D.venues[i], own = T.owned()[v.id], open = T.unlocked(i), have = T.count(v.reward);
        var p = OS.el('div', 'tc-sheet',
          '<div class="tc-sheet-in">' + portrait(v) +
          '<div class="tc-v-name">' + esc(v.name) + '</div><div class="tc-v-vibe">' + esc(v.vibe) + '</div>' +
          '<div class="tc-v-rival">Booker: <b>' + esc(v.rival) + '</b> · ' + esc(v.rivalVibe) + '</div>' +
          '<div class="tc-v-stats">Crowd ' + (v.crowd || D.startCrowd) + (v.bonusMana ? ' · +' + v.bonusMana + ' Stage Time' : '') + (v.style === 'aggro' ? ' · Rushes you' : '') + '</div>' +
          '<div class="tc-v-reward"><span>' + (own ? 'Rematch pays ' + D.battle.rematchTickets + ' ' + esc(D.currency) : 'Take it over to win:') + '</span>' +
          (have ? cardHTML(v.reward, { cls: 'sm' }) : '<div class="tc-card sm mystery"><div class="tc-q">?</div><div class="tc-name">Battle-only card</div></div>') +
          (own ? '' : '<span>+ ' + v.tickets + ' ' + esc(D.currency) + '</span>') + '</div>' +
          '<div class="tc-v-btns">' + (open ? '<button class="tc-btn go">' + (own ? 'Rematch' : 'Take it over') + '</button>' : '<button class="tc-btn" disabled>Take over ' + esc(D.venues[i - 1].name) + ' first</button>') +
          '<button class="tc-btn close">Back</button></div></div>');
        root.appendChild(p);
        p.onclick = function (e) { if (e.target === p) p.remove(); };
        p.querySelector('.close').onclick = function () { p.remove(); };
        var go = p.querySelector('.go');
        if (go) go.onclick = function () {
          if (!T.deckValid(T.deck())) { OS.toast('Your lineup needs ' + D.deckSize + ' cards you own'); p.remove(); deckView(); return; }
          p.remove(); startBattle(i);
        };
      }

      /* =================== SHOP + PACKS =================== */
      function shop() {
        view = 'shop'; backFn = hub;
        var o = D.pack.odds;
        frame('Packs',
          '<div class="tc-pack-art"><div class="tc-pack"><b>CSK</b><span>TCG</span><i>' + D.pack.size + ' cards</i></div></div>' +
          '<button class="tc-btn buy big"' + (T.tickets() < D.pack.price ? ' disabled' : '') + '>Buy a pack · ' + D.pack.price + ' ' + esc(D.currency) + '</button>' +
          (T.freePacks() ? '<button class="tc-btn free big">Open free pack (' + T.freePacks() + ')</button>' : '') +
          '<div class="tc-odds">Every pack: ' + D.pack.size + ' cards' + (D.pack.guaranteeFeature ? ', at least one Feature or better' : '') + '.<br>Extra copies past what a deck can use sell back for ' + esc(D.currency) + ' automatically.<br>' +
          'Battle-only cards never come from packs. Take over venues to win them.</div>');
        root.querySelector('.buy').onclick = function () { var r = T.buyPack(); if (r) { beep('buy'); reveal(r); } else OS.toast('Not enough ' + D.currency); };
        var fr = root.querySelector('.free'); if (fr) fr.onclick = function () { var r = T.useFreePack(); if (r) { beep('buy'); reveal(r); } };
      }
      function reveal(results) {
        view = 'reveal'; backFn = shop;
        frame('New cards', '<div class="tc-reveal">' + results.map(function (r, k) {
          return '<div class="tc-flip" data-k="' + k + '"><div class="tc-back"><b>CSK</b></div>' + cardHTML(r.id, { cls: 'sm front' }) +
            (r.isNew ? '<em class="tc-tag new">NEW</em>' : r.sold ? '<em class="tc-tag sold">+' + r.sold + '</em>' : '') + '</div>';
        }).join('') + '</div><div class="tc-v-btns"><button class="tc-btn all">Flip all</button><button class="tc-btn done">Done</button></div><div class="tc-odds">Tap a card to flip it. Tap again to look closer.</div>');
        Array.prototype.forEach.call(root.querySelectorAll('.tc-flip'), function (f) {
          f.onclick = function () { if (f.classList.contains('up')) zoom(results[+f.getAttribute('data-k')].id); else { f.classList.add('up'); beep('flip'); } };
        });
        root.querySelector('.all').onclick = function () { Array.prototype.forEach.call(root.querySelectorAll('.tc-flip'), function (f, k) { setTimeout(function () { f.classList.add('up'); beep('flip'); }, k * 140); }); };
        root.querySelector('.done').onclick = shop;
      }
      function zoom(id, note) {
        var z = OS.el('div', 'tc-zoom', cardHTML(id, { cls: 'big' }) + (note ? '<div class="tc-znote">' + esc(note) + '</div>' : ''));
        z.onclick = function () { z.remove(); };
        root.appendChild(z);
      }

      /* =================== COLLECTION =================== */
      function collection() {
        view = 'col'; backFn = hub;
        var col = T.collection();
        frame('Collection', '<div class="tc-grid">' + D.cards.map(function (c) {
          var n = col[c.id] || 0;
          if (!n) {
            var how = c.battle ? (D.venues.filter(function (v) { return v.reward === c.id; })[0] || {}).name : 'packs';
            return '<div class="tc-card sm mystery r-' + c.rarity + '" data-hint="' + esc(c.battle ? 'Win it by taking over ' + how : 'Comes from packs') + '"><div class="tc-q">?</div><div class="tc-name">' + RAR[c.rarity] + '</div></div>';
          }
          return '<div class="tc-own">' + cardHTML(c.id, { cls: 'sm' }) + '<em>x' + n + '</em></div>';
        }).join('') + '</div>');
        Array.prototype.forEach.call(root.querySelectorAll('.tc-own .tc-card'), function (el) { el.onclick = function () { zoom(el.getAttribute('data-id')); }; });
        Array.prototype.forEach.call(root.querySelectorAll('.mystery'), function (el) { el.onclick = function () { OS.toast(el.getAttribute('data-hint')); }; });
      }

      /* =================== DECK BUILDER =================== */
      function deckView() {
        view = 'deck'; backFn = function () { if (!T.deckValid(work)) { OS.dialog({ title: 'Lineup not saved', text: 'A lineup needs exactly ' + D.deckSize + ' cards. Leave anyway?', buttons: [{ label: 'Leave', action: hub }, { label: 'Keep building' }] }); return; } T.saveDeck(work); hub(); };
        var work = T.deck().filter(function (id) { return T.card(id); });
        function cnt(list) { var n = {}; list.forEach(function (id) { n[id] = (n[id] || 0) + 1; }); return n; }
        function render() {
          var n = cnt(work), col = T.collection();
          var ids = D.cards.map(function (c) { return c.id; }).filter(function (id) { return col[id]; });
          ids.sort(function (a, b) { return T.card(a).cost - T.card(b).cost; });
          var dl = Object.keys(n).sort(function (a, b) { return T.card(a).cost - T.card(b).cost; });
          frame('Lineup',
            '<div class="tc-dhead"><b class="' + (work.length === D.deckSize ? 'ok' : '') + '">' + work.length + ' / ' + D.deckSize + '</b><span>Tap a card below to add it. Tap a line to take it out.</span></div>' +
            '<div class="tc-dlist">' + (dl.length ? dl.map(function (id) { var c = T.card(id); return '<button class="tc-dline r-' + c.rarity + '" data-id="' + id + '"><b>' + c.cost + '</b><span>' + esc(c.name) + '</span><i>x' + n[id] + '</i></button>'; }).join('') : '<div class="tc-odds">Empty lineup</div>') + '</div>' +
            '<div class="tc-dsub">Your cards</div><div class="tc-grid">' + ids.map(function (id) {
              var left = col[id] - (n[id] || 0);
              return '<div class="tc-own' + (left ? '' : ' used') + '">' + cardHTML(id, { cls: 'sm' }) + '<em>' + left + ' left</em></div>';
            }).join('') + '</div>',
            '<div class="tc-dbar"><button class="tc-btn reset">Starter</button><button class="tc-btn auto">Auto-fill</button><button class="tc-btn save"' + (work.length === D.deckSize ? '' : ' disabled') + '>Save</button></div>');
          Array.prototype.forEach.call(root.querySelectorAll('.tc-dline'), function (b) { b.onclick = function () { var k = work.indexOf(b.getAttribute('data-id')); if (k >= 0) work.splice(k, 1); render(); }; });
          Array.prototype.forEach.call(root.querySelectorAll('.tc-own .tc-card'), function (el) {
            var id = el.getAttribute('data-id');
            el.onclick = function () {
              if (work.length >= D.deckSize) { OS.toast('Lineup is full (' + D.deckSize + ')'); return; }
              if ((cnt(work)[id] || 0) >= T.count(id)) { OS.toast('No more copies of ' + T.card(id).name); return; }
              work.push(id); render();
            };
          });
          root.querySelector('.reset').onclick = function () { work = D.starterDeck.filter(function (id) { return T.count(id); }); render(); };
          root.querySelector('.auto').onclick = function () {
            var col2 = T.collection(), pool = [];
            Object.keys(col2).forEach(function (id) { for (var k = (cnt(work)[id] || 0); k < col2[id]; k++) pool.push(id); });
            pool.sort(function (a, b) { var A = T.card(a), B = T.card(b); var r = { legend: 4, headliner: 3, feature: 2, openmic: 1 }; return (r[B.rarity] - r[A.rarity]) || (A.cost - B.cost); });
            while (work.length < D.deckSize && pool.length) work.push(pool.shift());
            render();
          };
          root.querySelector('.save').onclick = function () { if (T.deckValid(work)) { T.saveDeck(work); OS.toast('Lineup saved'); hub(); } };
        }
        render();
      }

      /* =================== BATTLE =================== */
      function startBattle(vi) {
        var v = D.venues[vi];
        var s = E.create({ yourDeck: T.deck(), venue: v, youName: D.booker });
        battle = { s: s, v: v, vi: vi, sel: null, targeting: null, busy: false, logAt: 0, said: v.lines && v.lines.start };
        view = 'battle'; backFn = function () {
          if (battle.targeting) { battle.targeting = null; renderBattle(); return; }
          if (battle.sel) { battle.sel = null; renderBattle(); return; }
          OS.dialog({ title: 'Walk out?', text: 'Leaving now counts as a loss.', buttons: [{ label: 'Walk out', action: function () { battle = null; map(); } }, { label: 'Stay' }] });
        };
        renderBattle();
        bubble(v.lines && v.lines.start);
      }
      function rects() {
        var out = {};
        Array.prototype.forEach.call(root.querySelectorAll('[data-uid],[data-hero]'), function (el) {
          var r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
          out[el.getAttribute('data-uid') || 'h' + el.getAttribute('data-hero')] = { x: (r.left - b.left + r.width / 2) / (OS.scale || 1), y: (r.top - b.top + r.height / 2) / (OS.scale || 1) };
        });
        return out;
      }
      function floatAt(pos, text, cls) {
        if (!pos) return;
        var f = OS.el('div', 'tc-float ' + (cls || ''), esc(text));
        f.style.left = pos.x + 'px'; f.style.top = pos.y + 'px';
        root.appendChild(f); setTimeout(function () { f.remove(); }, 1000);
      }
      function animate(before) {
        var s = battle.s, logs = s.log.slice(battle.logAt), after = rects(); battle.logAt = s.log.length;
        logs.forEach(function (l) {
          var key = l.uid != null ? String(l.uid) : null;
          if (l.t === 'dmg') { floatAt(after[key] || before[key], '-' + l.amount, 'dmg'); beep('hit'); }
          else if (l.t === 'hero') { floatAt(after['h' + l.side] || before['h' + l.side], '-' + l.amount, 'dmg big'); beep('hit'); }
          else if (l.t === 'shield') floatAt(after[key] || before[key], 'blocked', 'info');
          else if (l.t === 'cling') floatAt(after[key], 'hangs on!', 'info');
          else if (l.t === 'death' || l.t === 'knock') { floatAt(before[key], l.t === 'knock' ? 'OUT' : 'BOMBED', 'out'); beep('die'); }
          else if (l.t === 'grow') floatAt(after[key], '+' + (l.punch ? l.punch + '/' : '') + l.nerve, 'up');
          else if (l.t === 'sniped') floatAt(before[key] || after[key], 'SNIPED', 'out');
          else if (l.t === 'steal') floatAt(after[key], 'Hey buddy', 'info');
          else if (l.t === 'overload' || l.t === 'overloaded') floatAt(after['h' + l.side], '-' + l.amount + ' Stage Time', 'info');
          else if (l.t === 'fatigue') floatAt(after['h' + l.side], 'Out of cards!', 'info');
          else if (l.t === 'burn') floatAt(after['h' + l.side], 'Hand full, card lost', 'info');
        });
      }
      function bubble(text) {
        if (!text) return;
        var b = OS.el('div', 'tc-bubble', esc(text));
        var bar = root.querySelector('.tb-foe'); if (!bar) return;
        bar.appendChild(b); setTimeout(function () { b.classList.add('gone'); setTimeout(function () { b.remove(); }, 400); }, 2600);
      }
      function heroBar(i) {
        var s = battle.s, sd = s.sides[i], v = battle.v, isFoe = i === 1;
        var gems = ''; for (var k = 0; k < sd.maxMana; k++) gems += '<i class="' + (k < sd.mana ? 'on' : '') + '"></i>';
        var tgt = battle.targeting && battle.targeting.list.some(function (t) { return t.k === 'hero' && t.side === i; });
        return '<div class="tb-hero ' + (isFoe ? 'tb-foe' : 'tb-you') + (tgt ? ' target' : '') + '" data-hero="' + i + '">' +
          (isFoe ? portrait(v) : '<div class="tc-portrait you" data-ini="YOU"></div>') +
          '<div class="tb-info"><b>' + esc(isFoe ? v.rival : D.booker) + '</b><span class="tb-gems">' + gems + '<em>' + sd.mana + '/' + sd.maxMana + '</em></span></div>' +
          '<div class="tb-crowd' + (sd.crowd <= 5 ? ' low' : '') + '" title="Crowd"><b>' + Math.max(0, sd.crowd) + '</b><span>Crowd</span></div>' +
          (isFoe ? '<div class="tb-cards"><span>' + sd.hand.length + ' in hand</span><span>' + sd.deck.length + ' left</span></div>' : '<div class="tb-cards"><span>' + sd.deck.length + ' left</span></div>') +
          (sd.overwatch ? '<div class="tb-ow" title="Overwatch">&#127919;</div>' : '') + '</div>';
      }
      function token(i, m) {
        var s = battle.s, c = T.card(m.id), p = E.punch(s, i, m);
        var ready = i === 0 && s.turn === 0 && E.canAttack(s, 0, m);
        var tgt = battle.targeting && battle.targeting.list.some(function (t) { return t.k === 'comic' && t.uid === m.uid; });
        var cls = 'tb-tok r-' + c.rarity + (m.bouncer ? ' bouncer' : '') + (m.thick ? ' thick' : '') + (ready ? ' ready' : '') +
          (battle.sel === m.uid ? ' sel' : '') + (tgt ? ' target' : '') + (m.sick && !m.cold ? ' sick' : '');
        return '<div class="' + cls + '" data-uid="' + m.uid + '" data-side="' + i + '">' + artHTML(c.id, c.name) +
          '<b class="tc-p' + (p > c.punch ? ' up' : '') + '">' + p + '</b><b class="tc-n' + (m.nerve < m.maxNerve ? ' hurt' : m.nerve > c.nerve ? ' up' : '') + '">' + m.nerve + '</b>' +
          (m.cling ? '<i class="tb-badge">1</i>' : '') + (m.sick && !m.cold ? '<i class="tb-zz">z</i>' : '') + '</div>';
      }
      function renderBattle() {
        if (!battle) return;
        var s = battle.s, me = s.sides[0], foe = s.sides[1], your = s.turn === 0 && s.over == null && !battle.busy;
        var slots = function (i) { var b = s.sides[i].board, h = ''; b.forEach(function (m) { h += token(i, m); }); for (var k = b.length; k < D.boardSize; k++) h += '<div class="tb-slot"></div>'; return h; };
        var hand = me.hand.map(function (h) {
          var c = T.card(h.id), cost = E.cost(s, 0, h.id), ok = your && E.canPlay(s, 0, h.uid);
          return '<div class="tb-hcard r-' + c.rarity + (ok ? ' ok' : '') + (cost < c.cost ? ' cheap' : '') + '" data-h="' + h.uid + '">' + artHTML(c.id, c.name) +
            '<b class="tc-cost">' + cost + '</b>' + (c.type === 'comic' ? '<b class="tc-p">' + c.punch + '</b><b class="tc-n">' + c.nerve + '</b>' : '<b class="tc-bit">BIT</b>') +
            '<span>' + esc(c.name) + '</span></div>';
        }).join('');
        var msg = battle.targeting ? battle.targeting.prompt : battle.sel ? 'Pick who to hit' : s.turn === 1 ? esc(battle.v.rival) + ' is booking…' : (your ? 'Your turn' : '');
        root.innerHTML =
          '<div class="tb">' + heroBar(1) +
          '<div class="tb-board foe">' + slots(1) + '</div>' +
          '<div class="tb-mid"><span class="tb-msg">' + msg + '</span>' +
            (battle.targeting ? '<button class="tc-btn tb-cancel">Cancel</button>' : '<button class="tc-btn tb-end"' + (your ? '' : ' disabled') + '>' + (s.turn === 0 ? 'End turn' : 'Their turn') + '</button>') + '</div>' +
          '<div class="tb-board you">' + slots(0) + '</div>' + heroBar(0) +
          '<div class="tb-hand">' + hand + '</div></div>';
        wire();
      }
      function wire() {
        var s = battle.s;
        var end = root.querySelector('.tb-end'); if (end) end.onclick = function () { if (s.turn === 0 && !battle.busy) { battle.sel = null; var b = rects(); E.endTurn(s); renderBattle(); animate(b); afterMove(); } };
        var can = root.querySelector('.tb-cancel'); if (can) can.onclick = function () { battle.targeting = null; renderBattle(); };
        Array.prototype.forEach.call(root.querySelectorAll('.tb-hcard'), function (el) { el.onclick = function () { handTap(+el.getAttribute('data-h')); }; });
        Array.prototype.forEach.call(root.querySelectorAll('.tb-tok'), function (el) { el.onclick = function () { tokenTap(+el.getAttribute('data-side'), +el.getAttribute('data-uid')); }; });
        Array.prototype.forEach.call(root.querySelectorAll('.tb-hero'), function (el) { el.onclick = function () { heroTap(+el.getAttribute('data-hero')); }; });
      }
      function handTap(uid) {
        var s = battle.s; if (battle.busy) return;
        var h = s.sides[0].hand.filter(function (x) { return x.uid === uid; })[0]; if (!h) return;
        battle.sel = null; battle.targeting = null;
        var c = T.card(h.id), ok = s.turn === 0 && E.canPlay(s, 0, uid), cost = E.cost(s, 0, h.id);
        var why = s.turn !== 0 ? 'Not your turn' : cost > s.sides[0].mana ? 'Need ' + cost + ' Stage Time' : c.type === 'comic' && s.sides[0].board.length >= D.boardSize ? 'Your stage is full' : !ok ? 'Nothing to target' : '';
        var z = OS.el('div', 'tc-zoom', cardHTML(h.id, { cls: 'big', cost: cost }) + '<div class="tc-zbtns"><button class="tc-btn play"' + (ok ? '' : ' disabled') + '>' + (ok ? 'Play' : esc(why)) + '</button><button class="tc-btn">Back</button></div>');
        root.appendChild(z);
        z.onclick = function (e) { if (e.target === z || e.target.textContent === 'Back') z.remove(); };
        z.querySelector('.play').onclick = function (e) {
          e.stopPropagation(); z.remove();
          var tl = E.targetsFor(s, 0, h.id);
          if (tl && tl.length) {
            battle.targeting = { list: tl, prompt: c.type === 'bit' ? 'Pick a target for ' + c.name : c.name + ': pick a target', run: function (t) { doPlay(uid, t); } };
            renderBattle();
          } else { if (tl && !tl.length && c.type === 'comic' && c.fx.opener) OS.toast('No target, so ' + (c.ability || c.name) + ' does nothing'); doPlay(uid, null); }
        };
      }
      function doPlay(uid, target) {
        var b = rects(); battle.targeting = null;
        if (E.play(battle.s, 0, uid, target)) beep('play');
        renderBattle(); animate(b); afterMove();
      }
      function tokenTap(side, uid) {
        var s = battle.s; if (battle.busy) return;
        var found = E.find(s, uid); if (!found) return;
        if (battle.targeting) {
          if (uid === battle.sel) { battle.sel = null; battle.targeting = null; renderBattle(); return; }
          var t = battle.targeting.list.filter(function (x) { return x.k === 'comic' && x.uid === uid; })[0];
          if (t) battle.targeting.run(t); else OS.toast('Can\'t target that');
          return;
        }
        if (battle.sel != null) {
          if (side === 1) { attackWith(battle.sel, { k: 'comic', side: 1, uid: uid }); return; }
          if (uid === battle.sel) { battle.sel = null; renderBattle(); return; }
        }
        if (side === 0 && s.turn === 0 && E.canAttack(s, 0, found.m)) {
          battle.sel = uid; battle.targeting = null;
          var list = E.attackTargets(s, 0, uid);
          battle.targeting = { list: list, prompt: 'Pick who ' + T.card(found.m.id).name + ' hits', run: function (t) { attackWith(uid, t); } };
          renderBattle(); return;
        }
        var note = side === 0 ? (found.m.attacked ? 'Already went this turn' : found.m.sick && !found.m.cold ? 'Just got here. Can go next turn' : '') : '';
        zoom(found.m.id, note);
      }
      function heroTap(side) {
        if (!battle.targeting || battle.busy) return;
        var t = battle.targeting.list.filter(function (x) { return x.k === 'hero' && x.side === side; })[0];
        if (t) battle.targeting.run(t); else if (side === 1 && E.bouncers(battle.s, 1).length) OS.toast('A Bouncer is in the way');
      }
      function attackWith(uid, target) {
        var s = battle.s, ok = E.attackTargets(s, 0, uid).some(function (t) { return t.k === target.k && t.side === target.side && t.uid === target.uid; });
        if (!ok) { OS.toast(E.bouncers(s, 1).length ? 'Hit the Bouncer first' : 'Can\'t hit that'); return; }
        var b = rects(); battle.sel = null; battle.targeting = null;
        E.attack(s, 0, uid, target);
        renderBattle(); animate(b); afterMove();
      }
      function afterMove() {
        var s = battle.s;
        if (s.over != null) { setTimeout(finish, 900); return; }
        if (s.turn === 1 && !battle.busy) { battle.busy = true; renderBattle(); setTimeout(aiStep, 700); }
      }
      function aiStep() {
        if (!battle || view !== 'battle' || !root.isConnected) return;
        var s = battle.s;
        if (s.over != null) { battle.busy = false; setTimeout(finish, 700); return; }
        if (s.turn !== 1) { battle.busy = false; renderBattle(); return; }
        var mv = E.aiMove(s), b = rects();
        if (mv.k === 'play') {
          var h = s.sides[1].hand.filter(function (x) { return x.uid === mv.uid; })[0];
          if (h) showPlayed(h.id);
          if (!E.aiApply(s, mv)) E.endTurn(s); else beep('play');
          setTimeout(function () { renderBattle(); animate(b); setTimeout(aiStep, 650); }, 900);
          return;
        }
        if (!E.aiApply(s, mv)) E.endTurn(s);
        renderBattle(); animate(b);
        if (mv.k === 'end') { battle.busy = false; renderBattle(); if (s.over != null) setTimeout(finish, 700); return; }
        setTimeout(aiStep, 750);
      }
      function showPlayed(id) {
        var z = OS.el('div', 'tc-played', '<span>' + esc(battle.v.rival) + ' plays</span>' + cardHTML(id, { cls: 'big' }));
        root.appendChild(z); setTimeout(function () { z.classList.add('gone'); setTimeout(function () { z.remove(); }, 300); }, 850);
      }
      function finish() {
        if (!battle) return;
        var s = battle.s, v = battle.v, won = s.over === 0, firstWin = won && !T.owned()[v.id], prize = null, tk = 0;
        if (won) {
          beep('win');
          if (firstWin) { T.own(v.id); prize = T.grant(v.reward); tk = T.add(v.tickets, 'took over ' + v.name, true); }
          else {
            tk = T.add(D.battle.rematchTickets, 'rematch win', true);
            if (Math.random() < D.battle.rematchCardChance) {
              var missing = D.venues.filter(function (x) { return T.owned()[x.id] && !T.count(x.reward); });
              if (missing.length) prize = T.grant(missing[Math.floor(Math.random() * missing.length)].reward);
            }
          }
          OS.emit('tcg-win', v.id);
        } else { beep('lose'); tk = T.add(D.battle.lossTickets, 'showed up', true); OS.emit('tcg-loss', v.id); }
        var all = D.venues.every(function (x) { return T.owned()[x.id]; });
        var o = OS.el('div', 'tc-end ' + (won ? 'won' : 'lost'),
          '<div class="tc-end-in"><div class="tc-end-t">' + (won ? (firstWin ? 'VENUE TAKEN' : 'YOU KILLED') : 'YOU BOMBED') + '</div>' +
          '<div class="tc-end-v">' + esc(v.name) + '</div>' + portrait(v) +
          '<div class="tc-end-q">"' + esc((v.lines || {})[won ? 'lose' : 'win'] || '') + '"<br><span>- ' + esc(v.rival) + '</span></div>' +
          (prize ? '<div class="tc-end-prize"><span>' + (prize.isNew ? 'New card!' : 'Card') + '</span>' + cardHTML(prize.id, { cls: 'sm' }) + '</div>' : '') +
          '<div class="tc-end-tk">+' + tk + ' ' + esc(D.currency) + '</div>' +
          (firstWin && all ? '<div class="tc-end-all">You run every room in town.</div>' : '') +
          '<button class="tc-btn go">Back to the map</button></div>');
        root.appendChild(o);
        o.querySelector('.go').onclick = function () { battle = null; map(); };
      }

      /* ---------- start ---------- */
      if (args && args.view === 'shop') shop(); else hub();

      OS.debugTcg = { E: E, T: T, get battle() { return battle; }, get view() { return view; }, render: function () { renderBattle(); }, start: startBattle, map: map, shop: shop, deck: deckView, col: collection, hub: hub, finish: finish };

      return {
        back: function () { var z = root.querySelector('.tc-zoom, .tc-sheet'); if (z) { z.remove(); return true; } if (backFn) { backFn(); return true; } return false; },
        menu: function () { return [{ label: 'Territory', action: map }, { label: 'Packs', action: shop }, { label: 'Lineup', action: deckView }, { label: 'Collection', action: collection }]; },
        close: function () { OS.off('tickets-changed', onTickets); battle = null; view = 'closed'; }
      };
    }
  });
})();
