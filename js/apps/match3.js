/* =====================================================================
   MATCH 3 — swap neighbors to line up 3+, hit the target score before
   you run out of moves, clear the board, get a harder one. Forever.

   Tile sprites:  media/games/match3/tile-1.png ... tile-N.png
   Tuning:        js/content.js  ->  games.match3
   Everything except the tiles is drawn in code. Missing tiles are drawn too.

   Specials (drawn on top of your tile art, no extra sprites needed):
     4 in a row        -> LINE tile: clears its whole row (or column)
     L or T shape      -> BOMB tile: clears the 3x3 around it
     5 in a row        -> STAR tile: swap it with any tile to clear every tile of that type
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var ID = 'match3';
  var DIR = 'media/games/match3/';

  var DEFAULTS = {
    name: 'Match Killer',
    types: 6,             // how many tile sprites (tile-1 ... tile-6). 5 = easier, 7 = harder
    rows: 8, cols: 8,
    moves: 20,            // moves per board
    target: 800,          // score needed on board 1
    targetStep: 400,      // added for each board after that
    moveBonus: 60,        // points per unused move when a board is cleared
    hintDelay: 6,         // seconds of no moves before a hint wiggles
    praise: ['NICE', 'KILLER', 'COLD BLOODED', 'STANDING OVATION'],
    rewards: []
  };
  function cfg() {
    var g = (C.games || {})[ID] || {}, o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in g) o[k] = g[k];
    return o;
  }

  var W = 320;

  var ICON = '<svg viewBox="0 0 48 48">' +
    '<rect x="4" y="4" width="40" height="40" rx="7" fill="#2a1240" stroke="#0d0518"/>' +
    '<circle cx="15" cy="15" r="7" fill="#ff3b5c" stroke="#7a0f22"/><rect x="26" y="8" width="14" height="14" rx="4" fill="#2fa8ff" stroke="#0b3d6b"/>' +
    '<path d="M15 26l8 8-8 8-8-8z" fill="#ffe14d" stroke="#7a6200"/><circle cx="33" cy="33" r="7" fill="#ff3b5c" stroke="#7a0f22"/>' +
    '<circle cx="12" cy="12" r="2" fill="#fff" opacity=".7"/><circle cx="30" cy="30" r="2" fill="#fff" opacity=".7"/></svg>';

  /* ---------- sprites ---------- */
  var SPR = {}, requested = {};
  function load(name) {
    if (requested[name]) return;
    requested[name] = true;
    var exts = ['.png', '.jpg', '.jpeg'], k = 0, im = new Image();
    im.onload = function () { SPR[name] = im; };
    im.onerror = function () { if (++k < exts.length) im.src = OS.url(DIR + name + exts[k]); };
    im.src = OS.url(DIR + name + exts[0]);
  }

  /* ---------- sounds ---------- */
  var SND = {}, missing = {};
  var NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  var SYN = {
    swap:    function () { OS.beep(440, 0.05, 0, 0.05); },
    bad:     function () { OS.beep([180, 190], 0.15, 0, 0.1); },
    match:   function (n) { var f = NOTES[Math.min(NOTES.length - 1, (n || 1) - 1)]; OS.beep(f, 0.08, 0, 0.08); OS.beep(f * 1.5, 0.1, 0.06, 0.06); },
    special: function () { [659, 880, 1319].forEach(function (f, i) { OS.beep(f, 0.08, i * 0.05, 0.07); }); },
    blast:   function () { OS.beep([110, 165], 0.25, 0, 0.14); OS.beep(880, 0.15, 0.05, 0.05); },
    clear:   function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { OS.beep(f, 0.12, i * 0.09, 0.08); }); },
    over:    function () { [392, 330, 262, 196].forEach(function (f, i) { OS.beep(f, 0.22, i * 0.2, 0.09); }); },
    start:   function () { OS.beep(660, 0.07, 0, 0.06); OS.beep(990, 0.1, 0.08, 0.06); },
    shuffle: function () { for (var i = 0; i < 6; i++) OS.beep(300 + i * 80, 0.04, i * 0.04, 0.05); }
  };
  function snd(n, arg) {
    if (OS.silent) return;
    if (missing[n]) { if (SYN[n]) SYN[n](arg); return; }
    if (!SND[n]) { SND[n] = new Audio(OS.url(DIR + n + '.mp3')); SND[n].preload = 'auto'; SND[n].onerror = function () { missing[n] = true; }; }
    var a = SND[n].cloneNode();
    a.onerror = function () { missing[n] = true; if (SYN[n]) SYN[n](arg); };
    if (n === 'match' && arg > 1) { try { a.playbackRate = Math.min(2, 1 + (arg - 1) * 0.12); a.preservesPitch = false; } catch (e) {} }
    var p = a.play(); if (p && p.catch) p.catch(function () {});
  }

  /* ---------- placeholder tile art ---------- */
  var COLORS = ['#ff3b5c', '#ff9f1c', '#ffe14d', '#4cd964', '#2fa8ff', '#a35bff', '#ff6ad5', '#2ee6d6', '#c0c0c0', '#8b5a2b'];
  var SHAPES = ['circle', 'square', 'diamond', 'triangle', 'hex', 'star', 'drop', 'pill', 'octo', 'cross'];
  function shapePath(ctx, shape, r) {
    ctx.beginPath();
    var i, a;
    if (shape === 'circle') ctx.arc(0, 0, r, 0, 7);
    else if (shape === 'square') { var s = r * 0.85, q = r * 0.3; ctx.moveTo(-s + q, -s); ctx.arcTo(s, -s, s, s, q); ctx.arcTo(s, s, -s, s, q); ctx.arcTo(-s, s, -s, -s, q); ctx.arcTo(-s, -s, s, -s, q); }
    else if (shape === 'diamond') { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); }
    else if (shape === 'triangle') { ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, r * 0.75); ctx.lineTo(-r * 0.95, r * 0.75); }
    else if (shape === 'hex' || shape === 'octo') { var n = shape === 'hex' ? 6 : 8; for (i = 0; i < n; i++) { a = i / n * Math.PI * 2 + Math.PI / n; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } }
    else if (shape === 'star') { for (i = 0; i < 10; i++) { a = i / 10 * Math.PI * 2 - Math.PI / 2; var rr = i % 2 ? r * 0.48 : r; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } }
    else if (shape === 'drop') { ctx.moveTo(0, -r); ctx.bezierCurveTo(r * 0.9, -r * 0.1, r * 0.9, r, 0, r); ctx.bezierCurveTo(-r * 0.9, r, -r * 0.9, -r * 0.1, 0, -r); }
    else if (shape === 'pill') { ctx.ellipse(0, 0, r, r * 0.6, -0.6, 0, 7); }
    else { var t = r * 0.38; ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t); ctx.lineTo(r, -t); ctx.lineTo(r, t); ctx.lineTo(t, t); ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t); ctx.lineTo(-r, t); ctx.lineTo(-r, -t); ctx.lineTo(-t, -t); }
    ctx.closePath();
  }
  function fbTile(ctx, type, size) {
    var r = size * 0.42, col = COLORS[type % COLORS.length];
    shapePath(ctx, SHAPES[type % SHAPES.length], r);
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, col); g.addColorStop(1, shade(col));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
  }
  function shade(hex) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgb(' + ((n >> 16) * 0.45 | 0) + ',' + (((n >> 8) & 255) * 0.45 | 0) + ',' + ((n & 255) * 0.45 | 0) + ')';
  }

  OS.registerApp({
    id: ID, name: cfg().name, icon: ICON,
    launch: function (root) {
      var K = cfg();
      var ROWS = K.rows, COLS = K.cols, TYPES = Math.max(3, K.types | 0);
      for (var t = 1; t <= TYPES; t++) load('tile-' + t);
      load('tile-special'); load('background');

      var cv = OS.el('canvas', 'game-canvas');
      root.appendChild(cv);
      var ctx = cv.getContext('2d');
      var H = 520, CELL = 38, BX = 8, BY = 90;

      function resize() {
        var cw = root.clientWidth || 320, ch = root.clientHeight || 520;
        W = 320; H = Math.round(W * ch / cw);
        if (H < 500) { H = 500; W = Math.round(H * cw / ch); }   // wide or square screen: widen the world instead of squashing it
        CELL = Math.min((W - 16) / COLS, (H - 110) / ROWS);
        BX = (W - CELL * COLS) / 2;
        BY = 84 + Math.max(0, (H - 100 - CELL * ROWS) / 2);
        var pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(cw * pr); cv.height = Math.round(ch * pr);
      }
      resize();
      window.addEventListener('resize', resize);

      /* ----- state ----- */
      var state = 'title';        // title | play | paused | cleared | over
      var phase = 'idle';         // idle | swap | swapback | clear | fall
      var grid, board, moves, boardScore, total, target, cascade, pending, phaseT, idleT, hint, sel, clearedT, bonus;
      var fx = [], texts = [], clock = 0, shake = 0;
      var best = OS.store.get(ID + ':best', { board: 0, score: 0 });

      function rnd(n) { return Math.floor(Math.random() * n); }
      function tile(type, r, c, fromRow) { return { type: type, special: null, r: r, c: c, x: c, y: fromRow == null ? r : fromRow, vy: 0, pop: 0 }; }
      function at(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS ? grid[r][c] : null; }
      function same(a, b) { return a && b && a.type >= 0 && a.type === b.type; }

      function newGrid() {
        do {
          grid = [];
          for (var r = 0; r < ROWS; r++) {
            grid.push([]);
            for (var c = 0; c < COLS; c++) {
              var ty;
              do { ty = rnd(TYPES); }
              while ((c >= 2 && grid[r][c - 1].type === ty && grid[r][c - 2].type === ty) ||
                     (r >= 2 && grid[r - 1][c].type === ty && grid[r - 2][c].type === ty));
              grid[r].push(tile(ty, r, c, r - ROWS - 2));
            }
          }
        } while (!hasMove());
      }
      function startBoard() {
        target = K.target + K.targetStep * (board - 1);
        moves = K.moves; boardScore = 0; cascade = 0;
        sel = null; hint = null; idleT = 0;
        newGrid();
        phase = 'fall';          // let the new tiles drop in before input is allowed
      }
      function start() {
        board = 1; total = 0;
        startBoard();
        state = 'play';
        snd('start');
        OS.emit('game-start:' + ID);
      }
      // a board to look at behind the title screen
      board = 1; total = 0; startBoard();

      /* ----- matching ----- */
      function findRuns() {
        var runs = [], r, c, n;
        for (r = 0; r < ROWS; r++) for (c = 0; c < COLS;) {
          n = 1; while (c + n < COLS && same(grid[r][c], grid[r][c + n])) n++;
          if (n >= 3) { var cells = []; for (var i = 0; i < n; i++) cells.push([r, c + i]); runs.push({ cells: cells, dir: 'h' }); }
          c += n;
        }
        for (c = 0; c < COLS; c++) for (r = 0; r < ROWS;) {
          n = 1; while (r + n < ROWS && same(grid[r][c], grid[r + n][c])) n++;
          if (n >= 3) { var cells2 = []; for (var j = 0; j < n; j++) cells2.push([r + j, c]); runs.push({ cells: cells2, dir: 'v' }); }
          r += n;
        }
        return runs;
      }
      function lineAt(r, c) {
        var t = grid[r][c]; if (!t || t.type < 0) return false;
        var h = 1, v = 1, k;
        for (k = c - 1; k >= 0 && same(grid[r][k], t); k--) h++;
        for (k = c + 1; k < COLS && same(grid[r][k], t); k++) h++;
        for (k = r - 1; k >= 0 && same(grid[k][c], t); k--) v++;
        for (k = r + 1; k < ROWS && same(grid[k][c], t); k++) v++;
        return h >= 3 || v >= 3;
      }
      function swapCells(a, b) { var t = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t; fixPos(a); fixPos(b); }
      function fixPos(p) { var t = grid[p[0]][p[1]]; if (t) { t.r = p[0]; t.c = p[1]; } }
      function findMove() {
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          if (grid[r][c] && grid[r][c].special === 'all') return [[r, c], c + 1 < COLS ? [r, c + 1] : [r, c - 1]];
          var nb = [[r, c + 1], [r + 1, c]];
          for (var i = 0; i < 2; i++) {
            var b = nb[i]; if (b[0] >= ROWS || b[1] >= COLS) continue;
            swapCells([r, c], b);
            var ok = lineAt(r, c) || lineAt(b[0], b[1]);
            swapCells([r, c], b);
            if (ok) return [[r, c], b];
          }
        }
        return null;
      }
      function hasMove() { return !!findMove(); }

      /* ----- clearing ----- */
      function key(r, c) { return r * COLS + c; }
      function mostCommonType() {
        var cnt = {}, bestT = 0, bestN = -1;
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = grid[r][c]; if (t && t.type >= 0) cnt[t.type] = (cnt[t.type] || 0) + 1; }
        for (var k in cnt) if (cnt[k] > bestN) { bestN = cnt[k]; bestT = +k; }
        return bestT;
      }
      // clear a set of cells, set off any specials inside it, turn `creates` cells into specials
      function doClear(set, creates) {
        var queue = Object.keys(set).map(Number), done = {};
        while (queue.length) {
          var k = queue.shift(); if (done[k]) continue; done[k] = true;
          var r = Math.floor(k / COLS), c = k % COLS, t = grid[r][c];
          if (!t || !t.special || creates[k]) continue;
          var add = [];
          if (t.special === 'row') { for (var i = 0; i < COLS; i++) add.push(key(r, i)); fx.push({ kind: 'row', r: r, t: 0.35 }); }
          else if (t.special === 'col') { for (var j = 0; j < ROWS; j++) add.push(key(j, c)); fx.push({ kind: 'col', c: c, t: 0.35 }); }
          else if (t.special === 'bomb') { for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) if (at(r + dr, c + dc)) add.push(key(r + dr, c + dc)); fx.push({ kind: 'bomb', r: r, c: c, t: 0.4 }); }
          else if (t.special === 'all') { var ty = mostCommonType(); for (var a = 0; a < ROWS; a++) for (var b = 0; b < COLS; b++) if (grid[a][b] && grid[a][b].type === ty) add.push(key(a, b)); fx.push({ kind: 'all', r: r, c: c, t: 0.5 }); }
          snd('blast'); shake = Math.max(shake, 0.2);
          add.forEach(function (x) { if (!set[x]) { set[x] = true; queue.push(x); } });
        }
        var n = 0, sx = 0, sy = 0;
        Object.keys(set).forEach(function (ks) {
          var k = +ks; if (creates[k]) return;
          var r = Math.floor(k / COLS), c = k % COLS, t = grid[r][c];
          if (!t) return;
          fx.push({ kind: 'die', tile: t, t: 0.22 });
          grid[r][c] = null; n++; sx += c; sy += r;
        });
        Object.keys(creates).forEach(function (ks) {
          var k = +ks, t = grid[Math.floor(k / COLS)][k % COLS];
          if (!t) return;
          t.special = creates[k]; t.pop = 1;
          if (t.special === 'all') t.type = -1;
        });
        var pts = n * 10 * Math.max(1, cascade) + Object.keys(creates).length * 50;
        boardScore += pts; total += pts;
        if (n) texts.push({ s: '+' + pts, x: BX + (sx / n + 0.5) * CELL, y: BY + (sy / n + 0.5) * CELL, life: 1, size: 15, color: '#fff' });
        if (cascade >= 2) {
          var p = K.praise[Math.min(K.praise.length - 1, cascade - 2)];
          if (p) texts.push({ s: p, x: W / 2, y: BY + CELL * ROWS / 2, life: 1.2, size: 26, color: '#ffb02e' });
        }
        if (Object.keys(creates).length) snd('special'); else snd('match', cascade);
        phase = 'clear'; phaseT = 0.22;
      }
      function resolve(moved) {
        var runs = findRuns();
        if (!runs.length) return false;
        var set = {}, creates = {}, owner = {};
        runs.forEach(function (run, i) {
          run.cells.forEach(function (p) { var k = key(p[0], p[1]); set[k] = true; (owner[k] = owner[k] || []).push(i); });
        });
        function pick(run, prefer) {
          var cands = run.cells.map(function (p) { return key(p[0], p[1]); });
          if (prefer != null && cands.indexOf(prefer) >= 0) return prefer;
          if (moved) for (var m = 0; m < moved.length; m++) { var mk = key(moved[m][0], moved[m][1]); if (cands.indexOf(mk) >= 0 && !creates[mk]) return mk; }
          var mid = cands[Math.floor(cands.length / 2)];
          if (!creates[mid]) return mid;
          for (var x = 0; x < cands.length; x++) if (!creates[cands[x]]) return cands[x];
          return null;
        }
        var used = {};
        // L / T shapes: where a row run and a column run cross
        Object.keys(owner).forEach(function (ks) {
          var o = owner[ks]; if (o.length < 2) return;
          var big = o.some(function (i) { return runs[i].cells.length >= 5; });
          creates[+ks] = big ? 'all' : 'bomb';
          o.forEach(function (i) { used[i] = true; });
        });
        runs.forEach(function (run, i) {
          if (used[i]) return;
          var len = run.cells.length, k;
          if (len >= 5) { k = pick(run); if (k != null) creates[k] = 'all'; }
          else if (len === 4) { k = pick(run); if (k != null) creates[k] = run.dir === 'h' ? 'row' : 'col'; }
        });
        // don't overwrite an existing special; let it go off instead
        Object.keys(creates).forEach(function (ks) {
          var k = +ks, t = grid[Math.floor(k / COLS)][k % COLS];
          if (t && t.special) delete creates[k];
        });
        doClear(set, creates);
        return true;
      }
      function starSwap(a, b) {
        var ta = grid[a[0]][a[1]], tb = grid[b[0]][b[1]], set = {};
        var star = ta.special === 'all' ? ta : tb, other = star === ta ? tb : ta;
        if (other.special === 'all') { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) set[key(r, c)] = true; }
        else {
          for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) if (grid[r2][c2] && grid[r2][c2].type === other.type) set[key(r2, c2)] = true;
        }
        star.special = null; star.type = -2;            // spent; cleared below
        set[key(star.r, star.c)] = true;
        fx.push({ kind: 'all', r: star.r, c: star.c, t: 0.5 });
        snd('blast'); shake = 0.3;
        doClear(set, {});
      }
      function gravity() {
        for (var c = 0; c < COLS; c++) {
          var w = ROWS - 1;
          for (var r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c]) { var t = grid[r][c]; grid[r][c] = null; grid[w][c] = t; t.r = w; t.c = c; w--; }
          }
          var spawned = 0;
          for (var r2 = w; r2 >= 0; r2--) { spawned++; grid[r2][c] = tile(rnd(TYPES), r2, c, -spawned); }
        }
        phase = 'fall';
      }
      function shuffle() {
        var list = [];
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c] && !grid[r][c].special) list.push(grid[r][c].type);
        var tries = 0;
        do {
          for (var i = list.length - 1; i > 0; i--) { var j = rnd(i + 1), tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
          var n = 0;
          for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) if (grid[r2][c2] && !grid[r2][c2].special) grid[r2][c2].type = list[n++];
          tries++;
        } while ((findRuns().length || !hasMove()) && tries < 200);
        if (tries >= 200) newGrid();
        texts.push({ s: 'SHUFFLE', x: W / 2, y: BY + CELL * ROWS / 2, life: 1.2, size: 26, color: '#2fa8ff' });
        snd('shuffle');
      }

      /* ----- turn flow ----- */
      function trySwap(a, b) {
        if (state !== 'play' || phase !== 'idle') return;
        if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
        sel = null; hint = null; idleT = 0;
        swapCells(a, b);
        pending = [a, b];
        phase = 'swap';
        snd('swap');
      }
      function afterSwap() {
        var a = pending[0], b = pending[1];
        var ta = grid[a[0]][a[1]], tb = grid[b[0]][b[1]];
        cascade = 1;
        if ((ta && ta.special === 'all') || (tb && tb.special === 'all')) { moves--; starSwap(a, b); return; }
        if (resolve(pending)) { moves--; return; }
        swapCells(a, b);
        phase = 'swapback';
        snd('bad');
      }
      function endTurn() {
        phase = 'idle'; cascade = 0; idleT = 0;
        if (boardScore >= target) return boardClear();
        if (moves <= 0) return gameOver();
        if (!hasMove()) shuffle();
      }
      function boardClear() {
        state = 'cleared'; clearedT = 2.2;
        bonus = moves * K.moveBonus;
        total += bonus;
        snd('clear');
        OS.emit('game-board:' + ID, board);
        (K.rewards || []).forEach(function (r) {
          var k = ID + ':' + (r.id || r.board);
          if (board >= r.board && !OS.flag(k)) { OS.setFlag(k); OS.run(r.action); }
        });
        saveBest(board);
      }
      function saveBest(boardsCleared) {
        if (boardsCleared > best.board || (boardsCleared === best.board && total > best.score)) {
          best = { board: boardsCleared, score: total };
          OS.store.set(ID + ':best', best);
          return true;
        }
        return false;
      }
      var newBest = false;
      function gameOver() {
        state = 'over'; phaseT = 0;
        newBest = saveBest(board - 1);
        snd('over');
        OS.emit('game-over:' + ID, { boards: board - 1, score: total });
      }
      function pause() { if (state === 'play') state = 'paused'; }
      function resume() { if (state === 'paused') state = 'play'; }

      /* ----- input: swipe a tile, or tap one then a neighbor ----- */
      var down = null;
      function cellAt(e) {
        var rc = cv.getBoundingClientRect();
        var x = (e.clientX - rc.left) / rc.width * W, y = (e.clientY - rc.top) / rc.height * H;
        var c = Math.floor((x - BX) / CELL), r = Math.floor((y - BY) / CELL);
        return { r: r, c: c, x: x, y: y, inside: r >= 0 && r < ROWS && c >= 0 && c < COLS };
      }
      cv.addEventListener('pointerdown', function (e) {
        OS.audioCtx();
        if (state === 'title') { start(); return; }
        if (state === 'over') { if (phaseT > 0.8) start(); return; }
        if (state === 'paused') { resume(); return; }
        if (state !== 'play' || phase !== 'idle') return;
        var p = cellAt(e);
        if (!p.inside) { sel = null; return; }
        down = p;
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cv.addEventListener('pointermove', function (e) {
        if (!down) return;
        var p = cellAt(e), dx = p.x - down.x, dy = p.y - down.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.4) return;
        var b = Math.abs(dx) > Math.abs(dy) ? [down.r, down.c + (dx > 0 ? 1 : -1)] : [down.r + (dy > 0 ? 1 : -1), down.c];
        var a = [down.r, down.c];
        down = null;
        if (b[0] >= 0 && b[0] < ROWS && b[1] >= 0 && b[1] < COLS) trySwap(a, b);
      });
      cv.addEventListener('pointerup', function () {
        if (!down) return;
        var p = down; down = null;
        if (sel && Math.abs(sel[0] - p.r) + Math.abs(sel[1] - p.c) === 1) trySwap(sel, [p.r, p.c]);
        else if (sel && sel[0] === p.r && sel[1] === p.c) sel = null;
        else sel = [p.r, p.c];
      });
      cv.addEventListener('pointercancel', function () { down = null; });
      function onKey(e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (state === 'title' || (state === 'over' && phaseT > 0.8)) start();
          else if (state === 'paused') resume(); else if (state === 'play') pause();
        }
      }
      document.addEventListener('keydown', onKey);
      function onVis() { if (document.hidden) pause(); }
      document.addEventListener('visibilitychange', onVis);

      /* ----- update ----- */
      function settled() {
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          var t = grid[r][c]; if (t && (Math.abs(t.x - c) > 0.001 || Math.abs(t.y - r) > 0.001)) return false;
        }
        return true;
      }
      function update(dt) {
        clock += dt;
        shake = Math.max(0, shake - dt);
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          var t = grid[r][c]; if (!t) continue;
          var sp = 9 * dt;
          if (t.x < c) t.x = Math.min(c, t.x + sp); else if (t.x > c) t.x = Math.max(c, t.x - sp);
          if (t.y < r) {
            if (phase === 'swap' || phase === 'swapback') t.y = Math.min(r, t.y + sp);
            else { t.vy += 45 * dt; t.y = Math.min(r, t.y + t.vy * dt); if (t.y === r) t.vy = 0; }
          } else if (t.y > r) t.y = Math.max(r, t.y - sp);
          t.pop = Math.max(0, t.pop - dt * 3);
        }
        for (var i = fx.length - 1; i >= 0; i--) { fx[i].t -= dt; if (fx[i].t <= 0) fx.splice(i, 1); }
        for (var j = texts.length - 1; j >= 0; j--) { texts[j].y -= 24 * dt; texts[j].life -= dt; if (texts[j].life <= 0) texts.splice(j, 1); }

        if (state === 'cleared') {
          clearedT -= dt;
          if (clearedT <= 0) { board++; startBoard(); state = 'play'; }
          return;
        }
        if (state === 'over') { phaseT += dt; return; }
        if (state !== 'play') return;

        if (phase === 'swap' && settled()) afterSwap();
        else if (phase === 'swapback' && settled()) phase = 'idle';
        else if (phase === 'clear') { phaseT -= dt; if (phaseT <= 0) gravity(); }
        else if (phase === 'fall' && settled()) { cascade++; if (!resolve(null)) endTurn(); }
        else if (phase === 'idle') {
          idleT += dt;
          if (!hint && idleT > K.hintDelay) hint = findMove();
        }
      }

      /* ----- draw ----- */
      var FONT = '"Droid Sans", Roboto, Arial, sans-serif';
      function text(s, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px ' + FONT;
        ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
        ctx.strokeText(s, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
      }
      function rr(x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      }
      function drawTile(t, px, py, scale) {
        var s = CELL * (scale || 1);
        ctx.save(); ctx.translate(px, py);
        if (t.special === 'all' || t.type === -2) {
          var im0 = SPR['tile-special'];
          if (im0) ctx.drawImage(im0, -s * 0.46, -s * 0.46, s * 0.92, s * 0.92);
          else {
            var g = ctx.createRadialGradient(-s * 0.12, -s * 0.15, 1, 0, 0, s * 0.44);
            g.addColorStop(0, '#666'); g.addColorStop(1, '#0b0b12');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.fill();
            for (var i = 0; i < 7; i++) {
              var a = clock * 2 + i * 0.9;
              ctx.fillStyle = COLORS[i % COLORS.length];
              ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24, s * 0.06, 0, 7); ctx.fill();
            }
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.stroke();
          }
          ctx.restore(); return;
        }
        var im = SPR['tile-' + (t.type + 1)];
        if (im) ctx.drawImage(im, -s * 0.46, -s * 0.46, s * 0.92, s * 0.92);
        else fbTile(ctx, t.type, s);
        if (t.special === 'row' || t.special === 'col') {
          ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
          for (var k = -1; k <= 1; k++) {
            if (t.special === 'row') { rr(-s * 0.4, k * s * 0.17 - s * 0.035, s * 0.8, s * 0.07, s * 0.035); }
            else { rr(k * s * 0.17 - s * 0.035, -s * 0.4, s * 0.07, s * 0.8, s * 0.035); }
            ctx.fill(); ctx.stroke();
          }
        } else if (t.special === 'bomb') {
          var pulse = 0.42 + Math.sin(clock * 6) * 0.03;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, s * pulse, 0, 7); ctx.stroke();
          ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, s * (pulse + 0.05), 0, 7); ctx.stroke();
        }
        ctx.restore();
      }
      function background() {
        if (SPR.background) {
          var im = SPR.background, s = Math.max(W / im.width, H / im.height);
          ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
        } else {
          var g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, '#2a0f45'); g.addColorStop(1, '#0e0820');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = 'rgba(255,255,255,.04)';
          for (var i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc((i * 73) % W, (i * 131) % H, 18 + (i % 4) * 10, 0, 7); ctx.fill(); }
        }
      }
      function hud() {
        text('BOARD ' + board, 10, 22, 18, '#ffb02e', 'left');
        text('MOVES', W - 10, 14, 10, '#c9b8e0', 'right');
        text(String(moves), W - 10, 34, 24, moves <= 5 ? '#ff4a3d' : '#fff', 'right');
        text('SCORE ' + total, 10, 44, 11, '#c9b8e0', 'left');
        // progress toward this board's target
        var bx = 10, by = 60, bw = W - 20, bh = 12, f = Math.min(1, boardScore / target);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(bx, by, bw, bh, 6); ctx.fill();
        var g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff6ad5'); g.addColorStop(1, '#ffb02e');
        if (f > 0) { ctx.fillStyle = g; rr(bx, by, Math.max(bh, bw * f), bh, 6); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; rr(bx, by, bw, bh, 6); ctx.stroke();
        text(boardScore + ' / ' + target, W / 2, by + bh / 2 + 0.5, 9, '#fff');
      }
      function overlay(lines, dim) {
        ctx.fillStyle = 'rgba(0,0,0,' + (dim == null ? 0.65 : dim) + ')'; ctx.fillRect(0, 0, W, H);
        lines.forEach(function (l) { if (l) text(l[0], W / 2, l[1], l[2], l[3]); });
      }
      function draw() {
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake / 0.3, (Math.random() - 0.5) * 8 * shake / 0.3);
        background();
        // board
        ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(BX - 4, BY - 4, CELL * COLS + 8, CELL * ROWS + 8, 8); ctx.fill();
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)';
          ctx.fillRect(BX + c * CELL, BY + r * CELL, CELL, CELL);
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(BX - 4, BY - 4, CELL * COLS + 8, CELL * ROWS + 8); ctx.clip();   // new tiles slide in from above the board
        if (sel) {
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + Math.sin(clock * 8) * 0.3) + ')'; ctx.lineWidth = 2.5;
          rr(BX + sel[1] * CELL + 2, BY + sel[0] * CELL + 2, CELL - 4, CELL - 4, 6); ctx.stroke();
        }
        for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
          var t = grid[r2][c2]; if (!t) continue;
          var wig = 0;
          if (hint && state === 'play' && ((hint[0][0] === r2 && hint[0][1] === c2) || (hint[1][0] === r2 && hint[1][1] === c2))) wig = Math.sin(clock * 14) * 0.06;
          drawTile(t, BX + (t.x + 0.5 + wig) * CELL, BY + (t.y + 0.5) * CELL, 1 + t.pop * 0.25);
        }
        fx.forEach(function (f) {
          if (f.kind === 'die') { var k = f.t / 0.22; drawTile(f.tile, BX + (f.tile.x + 0.5) * CELL, BY + (f.tile.y + 0.5) * CELL, 0.2 + k * 1.0); }
        });
        ctx.restore();
        fx.forEach(function (f) {
          var a = Math.max(0, f.t / 0.4);
          ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, a) + ')';
          if (f.kind === 'row') ctx.fillRect(BX, BY + (f.r + 0.5) * CELL - CELL * 0.25 * a, CELL * COLS, CELL * 0.5 * a);
          else if (f.kind === 'col') ctx.fillRect(BX + (f.c + 0.5) * CELL - CELL * 0.25 * a, BY, CELL * 0.5 * a, CELL * ROWS);
          else if (f.kind === 'bomb' || f.kind === 'all') {
            var rad = (1 - f.t / (f.kind === 'all' ? 0.5 : 0.4)) * CELL * (f.kind === 'all' ? 6 : 2);
            ctx.strokeStyle = f.kind === 'all' ? 'rgba(255,106,213,' + a + ')' : 'rgba(255,176,46,' + a + ')';
            ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(BX + (f.c + 0.5) * CELL, BY + (f.r + 0.5) * CELL, rad, 0, 7); ctx.stroke();
          }
        });
        texts.forEach(function (tx) { ctx.globalAlpha = Math.min(1, tx.life * 2); text(tx.s, tx.x, tx.y, tx.size, tx.color); ctx.globalAlpha = 1; });
        ctx.restore();
        if (state !== 'title') hud();

        var blink = Math.floor(clock * 2) % 2 === 0;
        if (state === 'title') overlay([
          [K.name.toUpperCase(), H * 0.22, 32, '#ffb02e'],
          ['Swipe tiles to line up 3 or more.', H * 0.33, 13, '#fff'],
          ['Hit the target score to clear the board.', H * 0.38, 13, '#fff'],
          ['4 in a row = LINE   ·   L or T = BOMB', H * 0.45, 12, '#8fd14f'],
          ['5 in a row = STAR (swap to wipe a type)', H * 0.5, 12, '#ff6ad5'],
          blink ? ['TAP TO START', H * 0.63, 22, '#fff'] : null,
          best.board ? ['BEST  ' + best.board + ' board' + (best.board === 1 ? '' : 's') + '  ·  ' + best.score, H * 0.72, 13, '#c9b8e0'] : null
        ]);
        else if (state === 'paused') overlay([['PAUSED', H * 0.42, 30, '#ffb02e'], ['tap to resume', H * 0.5, 14, '#fff']]);
        else if (state === 'cleared') overlay([
          ['BOARD ' + board + ' CLEAR!', H * 0.38, 28, '#8fd14f'],
          [bonus ? '+' + bonus + ' for ' + (bonus / K.moveBonus) + ' moves left' : 'no moves to spare', H * 0.46, 14, '#fff'],
          ['next target: ' + (K.target + K.targetStep * board), H * 0.52, 13, '#c9b8e0']
        ], 0.5);
        else if (state === 'over') overlay([
          ['OUT OF MOVES', H * 0.28, 30, '#ff4a3d'],
          ['BOARDS CLEARED  ' + (board - 1), H * 0.38, 18, '#fff'],
          ['SCORE  ' + total, H * 0.44, 16, '#fff'],
          [newBest ? 'NEW BEST!' : 'BEST  ' + best.board + ' boards  ·  ' + best.score, H * 0.5, newBest ? 18 : 13, newBest ? '#8fd14f' : '#c9b8e0'],
          blink && phaseT > 0.8 ? ['TAP TO PLAY AGAIN', H * 0.62, 20, '#fff'] : null
        ]);
      }

      /* ----- loop ----- */
      var alive = true, last = performance.now();
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.04, (now - last) / 1000);
        last = now;
        update(dt); draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      OS.debugMatch3 = {
        get state() { return state; }, get phase() { return phase; }, get board() { return board; }, get moves() { return moves; },
        get score() { return boardScore; }, get total() { return total; }, findMove: findMove, swap: trySwap,
        grid: function () { return grid.map(function (row) { return row.map(function (t) { return t ? (t.special ? t.special[0].toUpperCase() : t.type) : '.'; }).join(''); }).join('\n'); },
        set: function (r, c, type, special) { grid[r][c].type = type; grid[r][c].special = special || null; }
      };

      return {
        back: function () { if (state === 'play') { pause(); return true; } return false; },
        menu: function () {
          var m = [];
          if (state === 'play') m.push({ label: 'Pause', action: pause });
          if (state === 'paused') m.push({ label: 'Resume', action: resume });
          m.push({ label: 'New game', action: start });
          m.push({ label: OS.silent ? 'Sound on' : 'Sound off', action: function () { OS.setSilent(!OS.silent); } });
          return m;
        },
        close: function () {
          alive = false;
          window.removeEventListener('resize', resize);
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('visibilitychange', onVis);
        }
      };
    }
  });
})();
