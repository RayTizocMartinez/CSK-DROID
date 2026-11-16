/* =====================================================================
   GALLERY — albums A–Z, photo grid A–Z, swipe viewer
   Photo list comes from js/gallery-index.js (made by tools/gallery-builder.html)
   ===================================================================== */
(function () {
  'use strict';

  var ICON = '<svg viewBox="0 0 48 48">' +
    '<rect x="9" y="5" width="32" height="26" rx="2" transform="rotate(-10 25 18)" fill="#ddd" stroke="#666"/>' +
    '<rect x="6" y="13" width="34" height="28" rx="2" fill="#fafafa" stroke="#555"/>' +
    '<rect x="9" y="16" width="28" height="19" fill="url(#g-sky)"/>' +
    '<path d="M9 35l8-9 6 6 5-4 9 7z" fill="#4caf2a"/><circle cx="31" cy="21" r="3" fill="#ffe36a"/></svg>';

  var FLYERS = 'My flyers';            // flyers saved from the Flyer Maker app
  function albums() {
    var idx = window.GALLERY_INDEX || { albums: [] };
    var list = (idx.albums || []).map(function (a) {
      return { name: a.name, photos: (a.photos || []).slice().sort(function (x, y) { return OS.natSort(fileName(x), fileName(y)); }) };
    });
    var fl = OS.savedFlyers ? OS.savedFlyers() : [];
    if (fl.length) list.push({ name: FLYERS, photos: fl.map(function (f) { return f.src; }), saved: true });   // newest first
    return list.filter(function (a) { return a.photos.length; })
      .sort(function (a, b) { return OS.natSort(a.name, b.name); });
  }
  function fileName(p) {
    p = String(p);
    if (p.indexOf('data:') === 0) {
      var fl = OS.savedFlyers ? OS.savedFlyers() : [];
      for (var i = 0; i < fl.length; i++) if (fl[i].src === p) return 'Flyer ' + new Date(fl[i].ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return 'Flyer';
    }
    return p.split('/').pop();
  }

  OS.registerApp({
    id: 'gallery', name: 'Gallery', icon: ICON,
    launch: function (root, args) {
      args = args || {};
      var picking = !!args.pick;          // opened by the wallpaper chooser: tap a photo to pick it
      var view = 'albums', album = null, viewer = null;

      function renderAlbums() {
        view = 'albums'; album = null;
        var A = albums();
        root.innerHTML = OS.titleBar(picking ? 'Select picture' : 'Gallery');
        var wrap = OS.el('div', 'g-albums scroll');
        if (!A.length) wrap.innerHTML = '<div class="empty">No pictures.<br><small>Add photos to media/photos and rebuild js/gallery-index.js</small></div>';
        A.forEach(function (a) {
          var stack = a.photos.slice(0, 3).map(function (p, i) {
            return '<img loading="lazy" class="st st' + i + '" src="' + OS.url(p) + '" alt="">';
          }).reverse().join('');
          var tile = OS.el('button', 'g-album', '<div class="g-stack">' + stack + '<span class="g-count">' + a.photos.length + '</span></div><div class="g-name">' + OS.esc(a.name) + '</div>');
          tile.onclick = function () { renderGrid(a); };
          wrap.appendChild(tile);
        });
        root.appendChild(wrap);
      }

      function renderGrid(a) {
        view = 'grid'; album = a;
        root.innerHTML = OS.titleBar(a.name + '  (' + a.photos.length + ')');
        var grid = OS.el('div', 'g-grid scroll');
        a.photos.forEach(function (p, i) {
          var cell = OS.el('button', 'g-cell', '<img loading="lazy" src="' + OS.url(p) + '" alt="">');
          cell.onclick = function () { if (picking && args.onPick) args.onPick(p); else openViewer(i); };
          grid.appendChild(cell);
        });
        root.appendChild(grid);
        OS.emit('gallery-album:' + a.name);
      }

      function openViewer(i) {
        view = 'viewer';
        var photos = album.photos;
        var v = OS.el('div', 'g-viewer',
          '<div class="gv-track"><img class="gv-img" alt=""></div>' +
          '<div class="gv-bar top"><span class="gv-pos"></span></div>' +
          '<div class="gv-bar bottom"><span class="gv-name"></span></div>');
        root.appendChild(v);
        var img = v.querySelector('.gv-img');
        function load() {
          img.src = OS.url(photos[i]);
          v.querySelector('.gv-pos').textContent = (i + 1) + ' of ' + photos.length;
          v.querySelector('.gv-name').textContent = fileName(photos[i]);
          // warm up neighbours
          [i - 1, i + 1].forEach(function (j) { if (photos[j]) { var pre = new Image(); pre.src = OS.url(photos[j]); } });
          OS.emit('photo-viewed', photos[i]);
        }
        load();
        var sx = null, sy = 0, dx = 0;
        v.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; dx = 0; img.style.transition = 'none'; });
        v.addEventListener('pointermove', function (e) { if (sx == null) return; dx = e.clientX - sx; img.style.transform = 'translateX(' + dx + 'px)'; });
        v.addEventListener('pointerup', function (e) {
          if (sx == null) return;
          var moved = Math.abs(dx) > 8 || Math.abs(e.clientY - sy) > 8;
          sx = null; img.style.transition = 'transform .18s'; img.style.transform = '';
          if (dx < -50 && i < photos.length - 1) { i++; load(); }
          else if (dx > 50 && i > 0) { i--; load(); }
          else if (!moved) v.classList.toggle('chrome');
        });
        v.addEventListener('pointercancel', function () { sx = null; img.style.transform = ''; });
        viewer = { el: v, src: function () { return photos[i]; }, name: function () { return fileName(photos[i]); }, next: function (d) { var j = i + d; if (photos[j]) { i = j; load(); } } };
      }

      renderAlbums();

      return {
        back: function () {
          if (view === 'viewer') { viewer.el.remove(); viewer = null; view = 'grid'; return true; }
          if (view === 'grid') { renderAlbums(); return true; }
          return false;
        },
        menu: function () {
          if (view === 'viewer') return [
            { label: 'Previous', action: function () { viewer.next(-1); } },
            { label: 'Next', action: function () { viewer.next(1); } },
            { label: 'Details', action: function () { OS.dialog({ title: 'Details', text: 'Title: ' + viewer.name() + '\nAlbum: ' + album.name }); } }
          ].concat(album.saved ? [{ label: 'Delete', action: function () {
            var src = viewer.src();
            OS.dialog({ title: 'Delete', text: 'Delete this flyer?', buttons: [{ label: 'Delete', action: function () {
              OS.store.set('flyers', OS.savedFlyers().filter(function (f) { return f.src !== src; }));
              viewer.el.remove(); viewer = null; renderAlbums(); OS.toast('Flyer deleted');
            } }, { label: 'Cancel' }] });
          } }] : []);
          return [{ label: 'Camera', action: function () { OS.toast('Camera is not available'); } }];
        }
      };
    }
  });
})();
