/* =====================================================================
   CSK TCG — the wallet, the collection and the payouts.
   Loaded before the apps so every mini game can pay Drink Tickets,
   even if the card game has never been opened.
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TCG; if (!D) return;
  var K = 'tcg:';
  function get(k, d) { return OS.store.get(K + k, d); }
  function set(k, v) { OS.store.set(K + k, v); }
  var byId = {}; D.cards.forEach(function (c) { byId[c.id] = c; });

  /* ---------- show day + calendar day (in the show's time zone) ---------- */
  var TZ = ((OS.C.show || {}).weekly || {}).timeZone || 'America/Chicago';
  var SHOWDAY = (((OS.C.show || {}).weekly || {}).weekday || 'Wednesday').slice(0, 3);
  function dayKey(d) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function isShowDay() {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date()) === SHOWDAY; } catch (e) { return false; }
  }

  /* ---------- wallet ---------- */
  var T = OS.tcg = {
    data: D, card: function (id) { return byId[id]; }, isShowDay: isShowDay,
    tickets: function () { return get('tickets', 0); },
    add: function (n, why, quiet) {
      n = Math.max(0, Math.round(n)); if (!n) return 0;
      set('tickets', T.tickets() + n);
      set('earned', get('earned', 0) + n);
      if (!quiet) OS.toast('+' + n + ' ' + D.currency + (why ? ' · ' + why : ''));
      OS.emit('tickets-changed', T.tickets());
      return n;
    },
    spend: function (n) {
      if (T.tickets() < n) return false;
      set('tickets', T.tickets() - n); OS.emit('tickets-changed', T.tickets()); return true;
    }
  };

  /* ---------- mini game payouts ---------- */
  function today() { var d = get('day', null), k = dayKey(); if (!d || d.key !== k) { d = { key: k, per: {}, first: {} }; set('day', d); } return d; }
  function pay(gameId, base) {
    var P = D.payouts[gameId]; if (!P) return 0;
    var d = today(), n = base, bonus = 0;
    if (n <= 0 && d.first[gameId]) return 0;
    var earned = d.per[gameId] || 0;
    if (earned >= D.dailySoftCap) n = n / 2;
    if (!d.first[gameId]) { d.first[gameId] = 1; bonus = D.firstPlayBonus || 0; }
    var mult = D.showDayDouble && isShowDay() ? 2 : 1;
    var total = Math.round((n + bonus) * mult);
    if (total <= 0) { set('day', d); return 0; }
    d.per[gameId] = earned + total; set('day', d);
    T.add(total, P.label + (bonus ? ' + first play today' : '') + (mult > 1 ? ' · show day x2' : ''));
    return total;
  }
  T.pay = pay;
  Object.keys(D.payouts).forEach(function (gid) {
    var P = D.payouts[gid];
    OS.on(P.event, function (data) {
      var v;
      if (P.flat != null) v = P.flat;
      else if (P.msPer) v = Math.floor((+data || 0) / P.msPer);
      else if (P.ticksPer) v = Math.min(P.max || 1e9, Math.floor((+data || 0) / P.ticksPer));
      else v = Math.floor(((data && P.field ? data[P.field] : data) || 0) / P.per);
      pay(gid, v);
    });
  });

  /* ---------- collection ---------- */
  T.collection = function () { return get('col', {}); };
  T.count = function (id) { return T.collection()[id] || 0; };
  T.maxCopies = function (id) { var c = byId[id]; return (c.battle ? 1 : D.maxCopies[c.rarity]) || 2; };
  // adds a card; returns { id, isNew, sold } (sold = tickets if it was an extra copy)
  T.grant = function (id) {
    var c = byId[id]; if (!c) return null;
    var col = T.collection(), have = col[id] || 0, out = { id: id, isNew: !have, sold: 0 };
    if (have >= T.maxCopies(id)) { out.sold = D.sellValue[c.rarity] || 5; set('tickets', T.tickets() + out.sold); OS.emit('tickets-changed', T.tickets()); }
    else { col[id] = have + 1; set('col', col); }
    OS.emit('tcg-collection');
    return out;
  };

  /* ---------- packs ---------- */
  T.packPool = function () { return D.cards.filter(function (c) { return !c.battle; }); };
  function rollRarity(minFeature) {
    var o = D.pack.odds, pool = T.packPool(), have = {};
    pool.forEach(function (c) { have[c.rarity] = 1; });
    var keys = ['openmic', 'feature', 'headliner', 'legend'].filter(function (k) { return have[k] && (!minFeature || k !== 'openmic'); });
    var tot = keys.reduce(function (a, k) { return a + (o[k] || 0); }, 0), r = Math.random() * tot;
    for (var i = 0; i < keys.length; i++) { r -= o[keys[i]] || 0; if (r < 0) return keys[i]; }
    return keys[keys.length - 1];
  }
  T.rollPack = function () {
    var pool = T.packPool(), out = [], rar = [];
    for (var i = 0; i < D.pack.size; i++) rar.push(rollRarity(false));
    if (D.pack.guaranteeFeature && rar.every(function (r) { return r === 'openmic'; })) rar[rar.length - 1] = rollRarity(true);
    var ORDER = ['openmic', 'feature', 'headliner', 'legend'];
    function usable(c) { return T.count(c.id) + out.filter(function (x) { return x === c.id; }).length < T.maxCopies(c.id); }
    rar.forEach(function (r) {
      // if you already have every card of this rarity maxed, the slot upgrades (until you own everything)
      for (var up = ORDER.indexOf(r); up < ORDER.length; up++) {
        var opts = pool.filter(function (c) { return c.rarity === ORDER[up]; });
        if (opts.length && opts.some(usable)) { r = ORDER[up]; break; }
      }
      // cards you can still use are 4x as likely as ones you're maxed out on
      var options = pool.filter(function (c) { return c.rarity === r; }), w = options.map(function (c) { return T.count(c.id) + out.filter(function (x) { return x === c.id; }).length < T.maxCopies(c.id) ? 4 : 1; });
      var tot = w.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * tot, k = 0;
      while (k < options.length - 1 && (x -= w[k]) >= 0) k++;
      out.push(options[k].id);
    });
    return out;
  };
  T.buyPack = function () { if (!T.spend(D.pack.price)) return null; return T.openPack(); };
  T.openPack = function () {
    var ids = T.rollPack();
    set('packs', get('packs', 0) + 1);
    return ids.map(T.grant);
  };
  T.freePacks = function () { return get('free', 0); };
  T.addFreePack = function (n) { set('free', T.freePacks() + (n || 1)); OS.emit('tcg-free'); };
  T.useFreePack = function () { if (T.freePacks() < 1) return null; set('free', T.freePacks() - 1); return T.openPack(); };

  /* ---------- deck ---------- */
  T.deck = function () { return get('deck', null) || D.starterDeck.slice(); };
  T.saveDeck = function (d) { set('deck', d); };
  T.deckValid = function (d) {
    if (d.length !== D.deckSize) return false;
    var n = {}; d.forEach(function (id) { n[id] = (n[id] || 0) + 1; });
    return Object.keys(n).every(function (id) { return byId[id] && n[id] <= T.count(id); });
  };

  /* ---------- territory ---------- */
  T.owned = function () { return get('owned', {}); };
  T.own = function (vid) { var o = T.owned(); if (!o[vid]) { o[vid] = Date.now(); set('owned', o); } };
  T.unlocked = function (idx) { if (idx === 0) return true; var prev = D.venues[idx - 1]; return !!T.owned()[prev.id]; };
  // daily income from venues you run (up to 3 days banked)
  T.collectIncome = function () {
    var own = Object.keys(T.owned()).length; if (!own) { set('incomeDay', dayKey()); return 0; }
    var last = get('incomeDay', null), k = dayKey();
    if (last === k) return 0;
    var days = 1;
    if (last) { days = Math.round((Date.parse(k) - Date.parse(last)) / 86400000); days = Math.max(1, Math.min(3, days)); }
    set('incomeDay', k);
    return T.add(own * D.venueIncome * days, 'your venues paid out');
  };

  /* ---------- first launch: you start with the starter deck's cards ---------- */
  T.init = function () {
    if (get('init', false)) return;
    var col = {};
    D.starterDeck.forEach(function (id) { if (byId[id]) col[id] = Math.min((col[id] || 0) + 1, T.maxCopies(id)); });
    set('col', col); set('deck', D.starterDeck.slice()); set('init', true);
    if (!get('tickets', 0)) set('tickets', D.pack.price);       // enough for a first pack
  };

  /* ---------- rewards the rest of the phone can hand out ----------
     In content.js rewards / dial codes / easter eggs:
       { type: "tickets", amount: 50 }   { type: "pack" }   { type: "card", id: "comic-11" }   */
  OS.actions = OS.actions || {};
  OS.actions.tickets = function (a) { T.add(a.amount || 0, a.text || ''); };
  OS.actions.pack = function (a) { T.init(); T.addFreePack(a.count || 1); OS.toast((a.count > 1 ? a.count + ' free packs' : 'Free pack') + ' waiting in ' + D.name); };
  OS.actions.card = function (a) { T.init(); var r = T.grant(a.id); if (r) OS.toast((r.isNew ? 'New card: ' : 'Card: ') + byId[a.id].name); };
})();
