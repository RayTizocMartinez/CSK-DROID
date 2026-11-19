/* =====================================================================
   CSK TCG — battle rules. No drawing here, just the game.
   Side 0 is you, side 1 is the rival.
   ===================================================================== */
(function (root) {
  'use strict';

  function makeRng(seed) {
    if (seed == null) return Math.random;
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function Engine(data) {
    this.D = data;
    this.byId = {};
    var self = this;
    data.cards.forEach(function (c) { self.byId[c.id] = c; });
  }
  var P = Engine.prototype;

  P.card = function (id) { return this.byId[id]; };

  /* ---------- setup ---------- */
  P.create = function (o) {
    var D = this.D, rnd = makeRng(o.seed), uid = 1;
    var self = this;
    function side(name, deck, crowd, bonusMana) {
      return { name: name, crowd: crowd, maxCrowd: crowd, mana: 0, maxMana: bonusMana || 0, overloadNext: 0,
        deck: shuffle(deck.filter(function (id) { return self.byId[id]; }).slice(), rnd), hand: [], board: [], fatigue: 0, discount: null, overwatch: false };
    }
    var v = o.venue || {};
    var s = {
      rnd: rnd, next: function () { return uid++; },
      sides: [side(o.youName || D.booker || 'You', o.yourDeck, D.startCrowd), side(v.rival || 'Rival', o.foeDeck || v.deck, v.crowd || D.startCrowd, v.bonusMana || 0)],
      turn: 0, round: 0, over: null, log: [], style: [o.yourStyle || 'normal', v.style || 'normal']
    };
    var n = D.startHand || 3;
    for (var i = 0; i < n; i++) this.draw(s, 0);
    for (i = 0; i < n + 1; i++) this.draw(s, 1);
    this.startTurn(s, 0);
    return s;
  };

  /* ---------- helpers ---------- */
  P.foe = function (i) { return 1 - i; };
  P.log = function (s, e) { s.log.push(e); };
  P.find = function (s, uid) {
    for (var i = 0; i < 2; i++) { var b = s.sides[i].board; for (var k = 0; k < b.length; k++) if (b[k].uid === uid) return { side: i, idx: k, m: b[k] }; }
    return null;
  };
  P.punch = function (s, sideIdx, m) {
    var p = m.punch;
    s.sides[sideIdx].board.forEach(function (o) { if (o !== m && o.auraPunch && o.nerve > 0) p += o.auraPunch; });
    return Math.max(0, p);
  };
  P.cost = function (s, sideIdx, id) {
    var c = this.byId[id], sd = s.sides[sideIdx], cost = c.cost;
    if (c.type === 'comic' && sd.discount && c.cost >= sd.discount.minCost) cost -= sd.discount.amount;
    return Math.max(0, cost);
  };
  P.bouncers = function (s, sideIdx) { return s.sides[sideIdx].board.filter(function (m) { return m.bouncer && m.nerve > 0; }); };

  P.draw = function (s, i) {
    var sd = s.sides[i];
    if (!sd.deck.length) {
      sd.fatigue++;
      this.log(s, { t: 'fatigue', side: i, amount: sd.fatigue });
      this.hitHero(s, i, sd.fatigue);
      return null;
    }
    var id = sd.deck.pop();
    if (sd.hand.length >= (this.D.handLimit || 7)) { this.log(s, { t: 'burn', side: i, id: id }); return null; }
    var h = { uid: s.next(), id: id };
    sd.hand.push(h);
    this.log(s, { t: 'draw', side: i, id: id, uid: h.uid });
    return h;
  };

  P.startTurn = function (s, i) {
    var sd = s.sides[i];
    s.turn = i; if (i === 0) s.round++;
    sd.maxMana = Math.min(10, sd.maxMana + 1);
    sd.mana = Math.max(0, sd.maxMana - sd.overloadNext);
    if (sd.overloadNext) this.log(s, { t: 'overloaded', side: i, amount: sd.overloadNext });
    sd.overloadNext = 0;
    sd.board.forEach(function (m) { m.sick = false; m.attacked = false; });
    this.log(s, { t: 'turn', side: i, round: s.round });
    this.draw(s, i);
    this.checkOver(s);
  };

  P.endTurn = function (s) {
    if (s.over != null) return;
    this.log(s, { t: 'end', side: s.turn });
    this.startTurn(s, this.foe(s.turn));
  };

  /* ---------- damage + death ---------- */
  P.hitHero = function (s, i, n) {
    if (n <= 0) return;
    s.sides[i].crowd -= n;
    this.log(s, { t: 'hero', side: i, amount: n });
  };
  P.hitComic = function (s, m, n) {
    if (n <= 0 || m.nerve <= 0) return;
    if (m.thick) { m.thick = false; this.log(s, { t: 'shield', uid: m.uid }); return; }
    m.nerve -= n;
    this.log(s, { t: 'dmg', uid: m.uid, amount: n });
    if (m.nerve <= 0 && m.cling) { m.cling = false; m.nerve = 1; this.log(s, { t: 'cling', uid: m.uid }); }
  };
  P.kill = function (s, m) { if (m.nerve > 0) { m.nerve = 0; this.log(s, { t: 'knock', uid: m.uid }); } };
  P.cleanup = function (s) {
    var self = this, any = true;
    while (any) {
      any = false;
      for (var i = 0; i < 2; i++) {
        var sd = s.sides[i], dead = sd.board.filter(function (m) { return m.nerve <= 0; });
        if (!dead.length) continue;
        any = true;
        sd.board = sd.board.filter(function (m) { return m.nerve > 0; });
        dead.forEach(function (d) {
          self.log(s, { t: 'death', side: i, uid: d.uid, id: d.id });
          sd.board.forEach(function (o) {
            if (o.onAllyDeath) { o.punch += o.onAllyDeath.punch || 0; o.nerve += o.onAllyDeath.nerve || 0; o.maxNerve += o.onAllyDeath.nerve || 0;
              self.log(s, { t: 'grow', uid: o.uid, punch: o.onAllyDeath.punch || 0, nerve: o.onAllyDeath.nerve || 0 }); }
          });
        });
      }
    }
    this.checkOver(s);
  };
  P.checkOver = function (s) {
    if (s.over != null) return;
    var a = s.sides[0].crowd <= 0, b = s.sides[1].crowd <= 0;
    if (a || b) { s.over = a && b ? 1 - s.turn : (a ? 1 : 0); this.log(s, { t: 'over', winner: s.over }); }
  };

  /* ---------- what can be targeted ---------- */
  // returns null when the card needs no target, otherwise a list of targets (maybe empty)
  P.targetsFor = function (s, i, id) {
    var c = this.byId[id], fx = c.fx || {}, f = this.foe(i), self = this, out = [];
    var mode = c.type === 'bit' ? fx.play : fx.opener;
    function comics(side, pred) { s.sides[side].board.forEach(function (m) { if (!pred || pred(m)) out.push({ k: 'comic', side: side, uid: m.uid }); }); }
    switch (mode) {
      case 'destroyBig': comics(f, function (m) { return self.byId[m.id].cost >= fx.minCost; }); return out;
      case 'damageEnemyComic': case 'destroyEnemyComic': comics(f); return out;
      case 'steal': if (s.sides[i].board.length < this.D.boardSize - 1) comics(f); return out;
      case 'copyStats': comics(0); comics(1); return out;
      case 'damageAny': comics(0); comics(1); out.push({ k: 'hero', side: f }); return out;
      default: return null;
    }
  };
  // bits with a required target can't be played without one; comic openers just fizzle
  P.canPlay = function (s, i, handUid) {
    if (s.over != null || s.turn !== i) return false;
    var sd = s.sides[i], h = sd.hand.filter(function (x) { return x.uid === handUid; })[0];
    if (!h) return false;
    var c = this.byId[h.id];
    if (this.cost(s, i, h.id) > sd.mana) return false;
    if (c.type === 'comic' && sd.board.length >= this.D.boardSize) return false;
    if (c.type === 'bit') { var t = this.targetsFor(s, i, h.id); if (t && !t.length) return false; }
    return true;
  };

  /* ---------- playing a card ---------- */
  P.play = function (s, i, handUid, target, slot) {
    if (!this.canPlay(s, i, handUid)) return false;
    var sd = s.sides[i], hi = -1;
    sd.hand.forEach(function (x, k) { if (x.uid === handUid) hi = k; });
    var h = sd.hand[hi], c = this.byId[h.id], fx = c.fx || {}, f = this.foe(i), self = this;
    var tlist = this.targetsFor(s, i, h.id);
    if (tlist && target && !tlist.some(function (t) { return t.k === target.k && t.side === target.side && t.uid === target.uid; })) return false;
    if (tlist && tlist.length && !target && c.type === 'bit') return false;
    sd.mana -= this.cost(s, i, h.id);
    sd.hand.splice(hi, 1);
    this.log(s, { t: 'play', side: i, id: h.id, uid: h.uid });
    var tm = target && target.k === 'comic' ? this.find(s, target.uid) : null;

    if (c.type === 'bit') {
      switch (fx.play) {
        case 'destroyEnemyComic': if (tm) this.kill(s, tm.m); break;
        case 'damageAny': if (tm) this.hitComic(s, tm.m, fx.amount); else if (target && target.k === 'hero') this.hitHero(s, target.side, fx.amount); break;
        case 'overloadEnemy': s.sides[f].overloadNext += fx.amount; this.log(s, { t: 'overload', side: f, amount: fx.amount }); break;
        case 'aoeDraw': s.sides[f].board.slice().forEach(function (m) { self.hitComic(s, m, fx.amount); }); for (var d = 0; d < (fx.draw || 0); d++) this.draw(s, i); break;
      }
      this.cleanup(s);
      return true;
    }

    // a comic
    if (sd.discount && c.cost >= sd.discount.minCost) sd.discount = null;
    var m = { uid: h.uid, id: c.id, punch: c.punch, nerve: c.nerve, maxNerve: c.nerve, sick: !fx.cold, attacked: false,
      bouncer: !!fx.bouncer, cold: !!fx.cold, thick: !!fx.thick, cling: !!fx.cling, auraPunch: fx.auraPunch || 0, onAllyDeath: fx.onAllyDeath || null };
    var at = slot == null ? sd.board.length : Math.max(0, Math.min(sd.board.length, slot));
    sd.board.splice(at, 0, m);
    if (fx.overload) sd.overloadNext += fx.overload;
    switch (fx.opener) {
      case 'destroyBig': if (tm) this.kill(s, tm.m); break;
      case 'damageEnemyComic': if (tm) this.hitComic(s, tm.m, fx.amount); break;
      case 'discountBig': sd.discount = { minCost: fx.minCost, amount: fx.amount }; this.log(s, { t: 'discount', side: i }); break;
      case 'buffAllies': sd.board.forEach(function (o) { if (o !== m) { o.punch += fx.punch || 0; o.nerve += fx.nerve || 0; o.maxNerve += fx.nerve || 0; self.log(s, { t: 'grow', uid: o.uid, punch: fx.punch || 0, nerve: fx.nerve || 0 }); } }); break;
      case 'copyStats': if (tm && tm.m !== m) { m.punch = tm.m.punch; m.nerve = tm.m.nerve; m.maxNerve = tm.m.nerve; this.log(s, { t: 'copy', uid: m.uid, from: tm.m.uid }); } break;
      case 'steal':
        if (tm && tm.side === f && sd.board.length < this.D.boardSize) {
          s.sides[f].board.splice(tm.idx, 1); tm.m.sick = true; tm.m.attacked = false; sd.board.push(tm.m);
          this.log(s, { t: 'steal', side: i, uid: tm.m.uid });
        }
        break;
      case 'snipeNext': sd.overwatch = true; this.log(s, { t: 'overwatch', side: i }); break;
    }
    // the other side's sniper takes out whatever lands next
    if (s.sides[f].overwatch && m.nerve > 0) { s.sides[f].overwatch = false; this.log(s, { t: 'sniped', uid: m.uid }); this.kill(s, m); }
    this.cleanup(s);
    return true;
  };

  /* ---------- attacking ---------- */
  P.canAttack = function (s, i, m) { return s.over == null && s.turn === i && m.nerve > 0 && !m.attacked && (!m.sick || m.cold) && this.punch(s, i, m) > 0; };
  P.attackTargets = function (s, i, uid) {
    var f = this.foe(i), b = this.bouncers(s, f), out = [];
    if (b.length) b.forEach(function (m) { out.push({ k: 'comic', side: f, uid: m.uid }); });
    else { s.sides[f].board.forEach(function (m) { out.push({ k: 'comic', side: f, uid: m.uid }); }); out.push({ k: 'hero', side: f }); }
    return out;
  };
  P.attack = function (s, i, uid, target) {
    var a = this.find(s, uid);
    if (!a || a.side !== i || !this.canAttack(s, i, a.m)) return false;
    var ok = this.attackTargets(s, i, uid).some(function (t) { return t.k === target.k && t.side === target.side && t.uid === target.uid; });
    if (!ok) return false;
    a.m.attacked = true;
    var ap = this.punch(s, i, a.m);
    this.log(s, { t: 'attack', side: i, uid: uid, target: target });
    if (target.k === 'hero') this.hitHero(s, target.side, ap);
    else {
      var d = this.find(s, target.uid), dp = this.punch(s, d.side, d.m);
      this.hitComic(s, d.m, ap);
      this.hitComic(s, a.m, dp);
    }
    this.cleanup(s);
    return true;
  };

  /* =====================================================================
     THE RIVAL'S BRAIN — one move at a time so the screen can show each one
     ===================================================================== */
  P.aiMove = function (s) {
    var i = s.turn, f = this.foe(i), sd = s.sides[i], fd = s.sides[f], self = this;
    if (s.over != null) return { k: 'end' };
    var ready = sd.board.filter(function (m) { return self.canAttack(s, i, m); });
    var foeB = this.bouncers(s, f), aggro = s.style && s.style[i] === 'aggro';

    // 1. lethal? swing at the venue
    var dmg = ready.reduce(function (a, m) { return a + self.punch(s, i, m); }, 0);
    if (!foeB.length && ready.length && dmg >= fd.crowd) return { k: 'attack', uid: ready[0].uid, target: { k: 'hero', side: f } };

    // 2. play the best card we can afford
    var best = null;
    sd.hand.forEach(function (h) {
      if (!self.canPlay(s, i, h.uid)) return;
      var c = self.byId[h.id], fx = c.fx || {}, tl = self.targetsFor(s, i, h.id), score = self.cost(s, i, h.id) + 0.5, tgt = null;
      function val(t) { var x = self.find(s, t.uid); if (!x) return 0; return self.punch(s, x.side, x.m) + x.m.nerve + self.byId[x.m.id].cost; }
      var enemyT = (tl || []).filter(function (t) { return t.k === 'comic' && t.side === f; });
      var mode = c.type === 'bit' ? fx.play : fx.opener;
      switch (mode) {
        case 'destroyBig': case 'destroyEnemyComic': case 'steal':
          enemyT.sort(function (a, b) { return val(b) - val(a); });
          if (enemyT[0]) { tgt = enemyT[0]; score += val(tgt) * 0.6; }
          else if (c.type === 'comic') score -= mode === 'steal' ? 6 : 2;
          if (mode === 'destroyEnemyComic' && tgt && val(tgt) < 7) score -= 4;      // save the light for something big
          break;
        case 'damageEnemyComic':
          var kill = enemyT.filter(function (t) { var x = self.find(s, t.uid); return x.m.nerve <= fx.amount && !x.m.thick; }).sort(function (a, b) { return val(b) - val(a); });
          tgt = kill[0] || enemyT.sort(function (a, b) { return val(b) - val(a); })[0] || null;
          if (kill[0]) score += 2;
          break;
        case 'damageAny':
          var k2 = enemyT.filter(function (t) { var x = self.find(s, t.uid); return x.m.nerve <= fx.amount && !x.m.thick; }).sort(function (a, b) { return val(b) - val(a); });
          if (k2[0]) { tgt = k2[0]; score += 2; }
          else if (fd.crowd <= fx.amount + dmg) { tgt = { k: 'hero', side: f }; score += 10; }
          else if (aggro || sd.hand.length >= 5 || fd.crowd <= 8) { tgt = { k: 'hero', side: f }; score -= aggro ? 0 : 1; }
          else return;
          break;
        case 'copyStats':
          var all = (tl || []).map(function (t) { var x = self.find(s, t.uid); return { t: t, v: x.m.punch + x.m.nerve }; }).sort(function (a, b) { return b.v - a.v; });
          if (all[0] && all[0].v > 2) { tgt = all[0].t; score += all[0].v * 0.5; } else score -= 2;
          break;
        case 'aoeDraw':
          var hits = fd.board.filter(function (m) { return m.nerve <= fx.amount && !m.thick; }).length;
          if (!fd.board.length) return;
          score += hits * 2 + fd.board.length * 0.3 - 1;
          break;
        case 'overloadEnemy': score = 0.4; break;
        case 'buffAllies': score += sd.board.length * 0.6 - 1; break;
        case 'snipeNext': score += 1; break;
      }
      if (fx.overload && sd.mana - self.cost(s, i, h.id) > 0) score -= 0.5;
      if (!best || score > best.score) best = { uid: h.uid, target: tgt, score: score };
    });
    if (best && best.score > 0) return { k: 'play', uid: best.uid, target: best.target };

    // 3. attacks: clear threats we can beat, else go for the venue
    ready.sort(function (a, b) { return self.punch(s, i, b) - self.punch(s, i, a); });
    for (var r = 0; r < ready.length; r++) {
      var m = ready[r], ap = this.punch(s, i, m), tl2 = this.attackTargets(s, i, m.uid), pick = null, pv = -1e9;
      tl2.forEach(function (t) {
        if (t.k === 'hero') { var hv = foeB.length ? -1e9 : (aggro ? 3 + ap : 1 + ap * 0.4); if (hv > pv) { pv = hv; pick = t; } return; }
        var x = self.find(s, t.uid), dp = self.punch(s, f, x.m);
        var kills = !x.m.thick && x.m.nerve <= ap, dies = !m.thick && m.nerve <= dp && !m.cling;
        var theirV = self.byId[x.m.id].cost + dp, ourV = self.byId[m.id].cost + ap;
        var v = (kills ? theirV * 1.4 : -2) - (dies ? ourV : 0) + (x.m.bouncer ? 0.5 : 0) + (x.m.thick ? 1 : 0);
        if (foeB.length) v += 50;
        if (v > pv) { pv = v; pick = t; }
      });
      if (pick && (pv > 0 || foeB.length)) return { k: 'attack', uid: m.uid, target: pick };
    }
    return { k: 'end' };
  };
  P.aiApply = function (s, mv) {
    if (mv.k === 'play') return this.play(s, s.turn, mv.uid, mv.target);
    if (mv.k === 'attack') return this.attack(s, s.turn, mv.uid, mv.target);
    this.endTurn(s); return true;
  };
  // run a whole turn for whoever's up (used by the simulator / tests)
  P.aiTurn = function (s) {
    var guard = 0, side = s.turn;
    while (s.over == null && s.turn === side && guard++ < 60) {
      var mv = this.aiMove(s);
      if (!this.aiApply(s, mv)) this.endTurn(s);
    }
  };

  root.TCGEngine = Engine;
  if (typeof module !== 'undefined') module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
