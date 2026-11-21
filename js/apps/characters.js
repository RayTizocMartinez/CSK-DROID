/* =====================================================================
   CHARACTERS — a shelf of spinning 3D models from the show.
   Tap one to see it big: drag to turn it, pinch to zoom.

   Models:  media/characters/*.glb
   List:    js/content.js -> characters.list  (name, model, bio)
   3D viewer: js/lib/model-viewer-umd.min.js (bundled, works offline)
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;
  var CFG = C.characters || {};
  var DIR = 'media/characters/';

  function list() { return (CFG.list || []).filter(function (c) { return c && c.model; }); }

  /* ---------- buying with Drink Tickets (the phone-wide currency from js/tcg-core.js) ---------- */
  var T = OS.tcg;
  function price(c) { return c.price != null ? c.price : (CFG.price != null ? CFG.price : 200); }
  function ownedList() { return OS.store.get('chr:owned', []); }
  function owns(c) { return !T || price(c) <= 0 || ownedList().indexOf(c.model) >= 0; }
  function unlock(c) { var o = ownedList(); if (o.indexOf(c.model) < 0) { o.push(c.model); OS.store.set('chr:owned', o); } }
  OS.actions = OS.actions || {};
  // give one away from a dial code / reward: { type: "killmiibo", model: "rodichu-1.glb" }
  OS.actions.killmiibo = function (a) {
    var c = list().filter(function (x) { return x.model === a.model || x.name === a.name; })[0];
    if (c) { unlock(c); OS.toast('New Killmiibo: ' + c.name); OS.emit('killmiibo-unlocked', c.name); }
  };
  var TK = '<svg viewBox="0 0 24 24" class="chr-tk"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" fill="#f2b01e"/><path d="M9 5v14" stroke="#7a5200" stroke-dasharray="1.6 1.6"/></svg>';
  function src(c) { return OS.url(c.model.indexOf('/') >= 0 ? c.model : DIR + c.model); }

  var mvPromise = null;
  function loadViewer() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve(true);
    if (mvPromise) return mvPromise;
    mvPromise = new Promise(function (res) {
      var s = document.createElement('script');
      s.src = 'js/lib/model-viewer-umd.min.js';
      s.onload = function () { res(!!(window.customElements && customElements.get('model-viewer'))); };
      s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
    return mvPromise;
  }
  // shown when 3D can't load (e.g. index.html double-clicked, or a missing file)
  var FLAT = '<svg viewBox="0 0 64 96" class="chr-flat"><circle cx="32" cy="18" r="12" fill="#888"/><path d="M14 92V52c0-12 8-20 18-20s18 8 18 20v40z" fill="#888"/></svg>';
  function viewer(c, big) {
    var mv = document.createElement('model-viewer');
    mv.className = 'chr-model';
    mv.setAttribute('src', src(c));
    mv.setAttribute('alt', c.name || '');
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('rotation-per-second', big ? '25deg' : (16 + Math.random() * 12).toFixed(0) + 'deg');
    mv.setAttribute('auto-rotate-delay', '0');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('shadow-intensity', '1');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('exposure', '1.05');
    mv.setAttribute('loading', big ? 'eager' : 'lazy');
    mv.setAttribute('camera-orbit', '0deg 80deg ' + (big ? '115%' : '105%'));   // pulled back a bit so feet and heads aren't cropped
    if (big) mv.setAttribute('camera-controls', '');
    else { mv.setAttribute('disable-zoom', ''); mv.setAttribute('disable-pan', ''); }
    mv.addEventListener('error', function () { var f = OS.el('div', 'chr-model', FLAT); mv.replaceWith(f); });
    return mv;
  }

  var ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="7" fill="#1c1c26" stroke="#000"/>' +
    '<ellipse cx="24" cy="39" rx="13" ry="3" fill="#000" opacity=".5"/>' +
    '<circle cx="24" cy="15" r="6" fill="url(#g-sky)" stroke="#123"/><path d="M15 38v-9c0-6 4-9 9-9s9 3 9 9v9z" fill="url(#g-sky)" stroke="#123"/>' +
    '<path d="M8 12a16 7 0 0 1 32 0" fill="none" stroke="#ffb02e" stroke-width="2" stroke-dasharray="3 3"/><path d="M38 9l2 3-3.5 .5" fill="none" stroke="#ffb02e" stroke-width="2"/></svg>';

  OS.registerApp({
    id: 'characters', name: CFG.name || 'Characters', icon: ICON,
    launch: function (root) {
      root.classList.add('chr');
      var detail = null, ok = false;

      function render() {
        var cs = list(), have = cs.filter(owns).length;
        root.innerHTML = OS.titleBar(CFG.name || 'Characters');
        if (T) root.appendChild(OS.el('div', 'chr-bar', '<span>' + have + ' / ' + cs.length + ' collected</span><b>' + TK + ' <i>' + T.tickets() + '</i></b>'));
        var grid = OS.el('div', 'chr-grid scroll');
        if (!cs.length) grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No characters yet.</div>';
        cs.forEach(function (c) {
          var mine = owns(c);
          var card = OS.el('button', 'chr-card' + (mine ? '' : ' locked'));
          card.appendChild(ok ? viewer(c, false) : OS.el('div', 'chr-model', FLAT));
          card.appendChild(OS.el('div', 'chr-name', mine ? OS.esc(c.name || '') : '???'));
          if (!mine) card.appendChild(OS.el('div', 'chr-price', TK + ' ' + price(c).toLocaleString()));
          card.onclick = function () { if (mine) open(c); else buy(c); };
          grid.appendChild(card);
        });
        root.appendChild(grid);
        if (T && have < cs.length) root.appendChild(OS.el('div', 'chr-earn', 'Earn Drink Tickets by playing anything on the phone.'));
      }
      function buy(c) {
        var cost = price(c), bal = T.tickets();
        if (bal < cost) {
          OS.dialog({ title: 'Not enough Drink Tickets', text: 'This Killmiibo costs ' + cost.toLocaleString() + '. You have ' + bal.toLocaleString() + '.\n\nEvery game on the phone pays Drink Tickets. So do ClikCok, BARKPOD and PROMPT MACHINE. The first play of each game every day pays extra, and show day pays double.', buttons: [{ label: 'OK' }] });
          return;
        }
        OS.dialog({ title: 'Unlock a Killmiibo?', text: 'Spend ' + cost.toLocaleString() + ' Drink Tickets to find out who this is?\nYou have ' + bal.toLocaleString() + '.', buttons: [
          { label: 'Buy', action: function () {
            if (!T.spend(cost)) return;
            unlock(c); OS.beep(660, 0.06); OS.beep(990, 0.1, 0.07);
            OS.emit('killmiibo-unlocked', c.name);
            render(); open(c, true);
          } },
          { label: 'Not now' }
        ] });
      }
      function open(c, fresh) {
        detail = OS.el('div', 'chr-detail' + (fresh ? ' fresh' : ''), '<div class="chr-stage"></div><div class="chr-info">' + (fresh ? '<em>UNLOCKED!</em>' : '') + '<b>' + OS.esc(c.name || '') + '</b>' +
          (c.bio ? '<p>' + OS.esc(c.bio) + '</p>' : '') + '<div class="chr-hint">drag to spin · pinch to zoom</div></div>');
        detail.querySelector('.chr-stage').appendChild(ok ? viewer(c, true) : OS.el('div', 'chr-model', FLAT));
        root.appendChild(detail);
        OS.emit('character-viewed', c.name);
      }

      render();
      loadViewer().then(function (r) { ok = r; if (!detail) render(); });
      return {
        back: function () { if (detail) { detail.remove(); detail = null; return true; } return false; }
      };
    }
  });
})();
