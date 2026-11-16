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
        root.innerHTML = OS.titleBar(CFG.name || 'Characters');
        var grid = OS.el('div', 'chr-grid scroll');
        var cs = list();
        if (!cs.length) grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No characters yet.</div>';
        cs.forEach(function (c) {
          var card = OS.el('button', 'chr-card');
          card.appendChild(ok ? viewer(c, false) : OS.el('div', 'chr-model', FLAT));
          card.appendChild(OS.el('div', 'chr-name', OS.esc(c.name || '')));
          card.onclick = function () { open(c); };
          grid.appendChild(card);
        });
        root.appendChild(grid);
      }
      function open(c) {
        detail = OS.el('div', 'chr-detail', '<div class="chr-stage"></div><div class="chr-info"><b>' + OS.esc(c.name || '') + '</b>' +
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
