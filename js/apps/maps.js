/* =====================================================================
   MAPS — a 2010-style map with a pin on the show. The info balloon's
   "Get directions" hands off to the visitor's REAL map app with a route:
     iPhone/iPad  -> Apple Maps         Android / computer -> Google Maps
   plus Waze, "other map app" (Android chooser) and Copy address.

   Address: js/content.js -> show.address   (falls back to show.venue)
   The street map itself is drawn in code; it's decoration, not real data.
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C;

  var ICON = '<svg viewBox="0 0 48 48">' +
    '<path d="M5 12l12-5 14 5 12-5v29l-12 5-14-5-12 5z" fill="#f2efe4" stroke="#6b6b5e" stroke-linejoin="round"/>' +
    '<path d="M17 7v29M31 12v29" stroke="#c9c4b0"/>' +
    '<path d="M5 26c8-2 12 3 20 0s12-3 18-1" stroke="#7cb7ff" stroke-width="3" fill="none"/>' +
    '<path d="M9 33l30-17" stroke="#f9c74f" stroke-width="3"/>' +
    '<path d="M28 4c-5 0-8 3.5-8 8 0 6 8 14 8 14s8-8 8-14c0-4.5-3-8-8-8z" fill="#e53935" stroke="#7f1010"/>' +
    '<circle cx="28" cy="12" r="3" fill="#fff"/></svg>';

  /* ---------- where the show is + how to open real map apps ---------- */
  function place() {
    var s = C.show || {};
    var addr = (s.address || '').trim();
    return { name: s.venue || 'The show', address: addr, query: addr ? (s.venue ? s.venue + ', ' + addr : addr) : (s.venue || '') };
  }
  var UA = navigator.userAgent || '';
  var IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var ANDROID = /Android/i.test(UA);
  function q() { return encodeURIComponent(place().query); }
  function go(url, sameTab) {
    OS.emit('maps-directions', url);
    if (sameTab) { location.href = url; return; }      // geo: links hand off to the phone's map app chooser
    // a real link click: opens the map app / a new tab and leaves the phone page where it is
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  var LINKS = {
    directions: function () { return IOS ? 'https://maps.apple.com/?daddr=' + q() + '&dirflg=d' : 'https://www.google.com/maps/dir/?api=1&destination=' + q(); },
    google: function () { return 'https://www.google.com/maps/dir/?api=1&destination=' + q(); },
    apple: function () { return 'https://maps.apple.com/?daddr=' + q() + '&dirflg=d'; },
    waze: function () { return 'https://waze.com/ul?q=' + q() + '&navigate=yes'; },
    other: function () { return 'geo:0,0?q=' + q(); }                          // Android: pick any map app
  };
  function copyAddress() {
    var text = place().address || place().query;
    function done() { OS.toast('Address copied'); }
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); return; }
    } catch (e) {}
    fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { OS.dialog({ title: 'Address', text: text }); }
      ta.remove();
    }
  }

  /* ---------- a made-up street map (seeded, so it's the same every time) ---------- */
  function hash(x, y) { var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
  var STREETS = ['Main St', 'Broadway', 'Elm St', 'Rittiman Rd', 'Oak Dr', 'Walzem Rd', 'Pine Ave', 'Loop 410', 'Cedar Ln', 'Austin Hwy', 'Maple St', 'Perrin Beitel'];

  OS.registerApp({
    id: 'maps', name: 'Maps', icon: ICON,
    launch: function (root) {
      root.classList.add('maps');
      var P = place();
      root.innerHTML =
        '<div class="mp-search">' + OS.glyph('search') + '<span>' + OS.esc(P.name) + '</span></div>' +
        '<div class="mp-view"><canvas class="mp-canvas"></canvas>' +
        '<div class="mp-balloon">' +
          '<div class="mb-title">' + OS.esc(P.name) + '</div>' +
          '<div class="mb-addr">' + (P.address ? OS.esc(P.address) : '<i>Address coming soon</i>') + '</div>' +
          '<div class="mb-when"></div>' +
          '<button class="mb-go">' + OS.glyph('directions') + '<span>Get directions</span></button>' +
          '<div class="mb-more"><button data-l="alt"></button><button data-l="waze">Waze</button>' +
          (ANDROID ? '<button data-l="other">Other app</button>' : '') + '<button data-l="copy">Copy</button></div>' +
        '</div>' +
        '<div class="mp-zoom"><button data-z="1">+</button><button data-z="-1">−</button></div>' +
        '<div class="mp-locating">Locating…</div></div>';
      var view = root.querySelector('.mp-view'), cv = root.querySelector('.mp-canvas'), ctx = cv.getContext('2d');
      var balloon = root.querySelector('.mp-balloon');
      var alt = balloon.querySelector('[data-l="alt"]');
      alt.textContent = IOS ? 'Google Maps' : 'Apple Maps';

      var s = C.show || {}, w = s.weekly || {};
      var hm = String(w.time || '20:00').split(':'), hh = +hm[0];
      balloon.querySelector('.mb-when').textContent = (s.name ? s.name + ' · ' : '') + 'every ' + (w.weekday || 'Wednesday') + ' ' + ((hh % 12) || 12) + ':' + (hm[1] || '00') + ' ' + (hh < 12 ? 'AM' : 'PM') + (w.zoneLabel ? ' ' + w.zoneLabel : '');

      /* ----- view state ----- */
      var W = 0, H = 0, pr = 1, cam = { x: 0, y: 0 }, zoom = 1, zoomT = 1, drop = 0, dropT = 0, open = false, clock = 0;
      function resize() {
        W = view.clientWidth; H = view.clientHeight;
        pr = (window.devicePixelRatio || 1) * (OS.scale || 1);
        cv.width = Math.round(W * pr); cv.height = Math.round(H * pr);
      }
      function pinScreen() { return { x: W / 2 + (0 - cam.x) * zoom, y: H * 0.62 + (0 - cam.y) * zoom }; }

      function draw() {
        ctx.setTransform(pr, 0, 0, pr, 0, 0);
        ctx.fillStyle = '#f2efe9'; ctx.fillRect(0, 0, W, H);
        var sp = 64 * zoom, ox = W / 2 - cam.x * zoom, oy = H * 0.62 - cam.y * zoom;
        var i0 = Math.floor(-ox / sp) - 1, i1 = Math.ceil((W - ox) / sp) + 1;
        var j0 = Math.floor(-oy / sp) - 1, j1 = Math.ceil((H - oy) / sp) + 1, i, j;
        // blocks: parks + buildings
        for (i = i0; i < i1; i++) for (j = j0; j < j1; j++) {
          var h = hash(i, j), x = ox + i * sp, y = oy + j * sp;
          if (h < 0.08) { ctx.fillStyle = '#c8e6b0'; ctx.fillRect(x + 4, y + 4, sp - 8, sp - 8); }
          else if (h > 0.55) { ctx.fillStyle = '#e8e2d6'; ctx.fillRect(x + sp * 0.18, y + sp * 0.2, sp * (0.3 + hash(j, i) * 0.4), sp * 0.5); }
        }
        // a river
        ctx.strokeStyle = '#a9cbf5'; ctx.lineWidth = 16 * zoom; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var x2 = -20; x2 <= W + 20; x2 += 10) {
          var wx = (x2 - ox) / zoom, wy = 210 + Math.sin(wx / 140) * 60;
          ctx[x2 === -20 ? 'moveTo' : 'lineTo'](x2, oy + wy * zoom);
        }
        ctx.stroke();
        // streets: every 4th is a big orange road
        for (var pass = 0; pass < 2; pass++) {
          for (i = i0; i < i1; i++) road(ox + i * sp, 0, ox + i * sp, H, i % 4 === 0, pass);
          for (j = j0; j < j1; j++) road(0, oy + j * sp, W, oy + j * sp, j % 4 === 0, pass);
          road(ox - 600 * zoom, oy + 500 * zoom, ox + 600 * zoom, oy - 700 * zoom, true, pass);       // diagonal highway
        }
        // street names
        ctx.fillStyle = '#6d6a60'; ctx.font = (zoom > 1.4 ? 11 : 10) + 'px "Droid Sans", Roboto, Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        for (i = i0; i < i1; i++) if (i % 2 === 0) {
          ctx.save(); ctx.translate(ox + i * sp + 3, oy + (Math.floor((H * 0.3 - oy) / sp) + 0.5) * sp); ctx.rotate(-Math.PI / 2);
          ctx.fillText(STREETS[((i % STREETS.length) + STREETS.length) % STREETS.length], 0, 0); ctx.restore();
        }
        for (j = j0; j < j1; j++) if (j % 2 === 0) ctx.fillText(STREETS[(((j + 5) % STREETS.length) + STREETS.length) % STREETS.length], ox + (Math.floor((W * 0.6 - ox) / sp) + 0.2) * sp, oy + j * sp - 3);
        // the pin (drops in, then bounces)
        var p = pinScreen(), dy = -(1 - drop) * H * 0.7;
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(p.x + 4, p.y, 8 * Math.max(0.4, drop), 3 * Math.max(0.4, drop), 0, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(p.x, p.y + dy);
        ctx.fillStyle = '#e53935'; ctx.strokeStyle = '#7f1010'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -10, -12, -16, -12, -26); ctx.arc(0, -26, 12, Math.PI, 0); ctx.bezierCurveTo(12, -16, 4, -10, 0, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, -26);
        ctx.restore();
        placeBalloon();
      }
      function road(x1, y1, x2, y2, big, pass) {
        ctx.lineCap = 'butt';
        if (pass === 0) { ctx.strokeStyle = big ? '#e0b860' : '#d6d0c2'; ctx.lineWidth = (big ? 9 : 6) * Math.max(0.8, zoom) + 2; }
        else { ctx.strokeStyle = big ? '#fdd876' : '#ffffff'; ctx.lineWidth = (big ? 9 : 6) * Math.max(0.8, zoom); }
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      function placeBalloon() {
        if (!open) { balloon.classList.remove('on'); return; }
        var p = pinScreen(), bw = balloon.offsetWidth, bh = balloon.offsetHeight;
        var left = Math.max(6, Math.min(W - bw - 6, p.x - bw / 2));
        balloon.style.left = left + 'px';
        balloon.style.top = (p.y - 44 - bh) + 'px';
        balloon.style.setProperty('--tip', (p.x - left) + 'px');
        balloon.classList.add('on');
      }

      /* ----- drag to pan, tap the pin to reopen the balloon ----- */
      var down = null;
      cv.addEventListener('pointerdown', function (e) {
        down = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cv.addEventListener('pointermove', function (e) {
        if (!down) return;
        var k = view.getBoundingClientRect().width / W || 1, dx = (e.clientX - down.x) / k, dy = (e.clientY - down.y) / k;
        if (Math.hypot(dx, dy) > 6) down.moved = true;
        if (down.moved) { cam.x = down.cx - dx / zoom; cam.y = down.cy - dy / zoom; }
      });
      cv.addEventListener('pointerup', function (e) {
        if (!down) return;
        if (!down.moved) {
          var r = view.getBoundingClientRect(), k = r.width / W, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, p = pinScreen();
          open = Math.hypot(x - p.x, y - (p.y - 22)) < 30 ? true : false;
        }
        down = null;
      });
      Array.prototype.forEach.call(root.querySelectorAll('.mp-zoom button'), function (b) {
        b.onclick = function () { zoomT = Math.max(0.6, Math.min(2.4, zoomT * (b.getAttribute('data-z') === '1' ? 1.4 : 1 / 1.4))); };
      });

      /* ----- the buttons that leave for the real map app ----- */
      balloon.querySelector('.mb-go').onclick = function () { go(LINKS.directions()); };
      balloon.querySelector('.mb-more').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var l = b.getAttribute('data-l');
        if (l === 'copy') copyAddress();
        else if (l === 'alt') go(IOS ? LINKS.google() : LINKS.apple());
        else if (l === 'waze') go(LINKS.waze());
        else if (l === 'other') go(LINKS.other(), true);
      });

      /* ----- loop: "Locating…", pin drop, balloon pops up ----- */
      var alive = true, last = performance.now(), t0 = last, autoOpened = false;
      requestAnimationFrame(function () { resize(); });
      function frame(now) {
        if (!alive) return;
        var dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
        if (!W) resize();
        var age = (now - t0) / 1000;
        if (age > 0.9) {
          root.querySelector('.mp-locating').classList.add('done');
          dropT = Math.min(1, dropT + dt * 2.6);
          var t = dropT; drop = t < 1 ? 1 - Math.abs(Math.cos(t * Math.PI * 1.5)) * (1 - t) : 1;   // fall + bounce
          if (t >= 1 && !autoOpened) { autoOpened = true; open = true; }   // pops up once when the pin lands
        }
        zoom += (zoomT - zoom) * Math.min(1, dt * 8);
        draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.addEventListener('resize', resize);
      OS.emit('maps-opened');

      OS.debugMaps = { links: LINKS, get open() { return open; }, place: place };

      return {
        back: function () { if (open) { open = false; return true; } return false; },
        menu: function () {
          return [
            { label: 'Directions', action: function () { go(LINKS.directions()); } },
            { label: 'Copy address', action: copyAddress },
            { label: 'Show the venue', action: function () { cam.x = 0; cam.y = 0; zoomT = 1; open = true; } }
          ];
        },
        close: function () { alive = false; window.removeEventListener('resize', resize); }
      };
    }
  });
})();
