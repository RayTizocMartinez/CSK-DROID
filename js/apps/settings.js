/* =====================================================================
   SETTINGS — Eclair settings list, Sound, About phone, factory reset
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C, P = C.phone || {};

  var ICON = '<svg viewBox="0 0 48 48"><g transform="translate(3 3) scale(1.75)">' +
    '<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="url(#g-gray)" stroke="#333" stroke-width=".4"/></g></svg>';

  // the classic Eclair top-level list. `page` items open a sub screen; the rest just toast.
  var TOP = [
    ['Wireless & networks', 'Wi-Fi, Bluetooth, airplane mode'],
    ['Call settings', 'Voicemail, call forwarding, call waiting'],
    ['Sound & display', 'Set ringtones, notifications, brightness', 'sound'],
    ['Location & security', 'Set My Location, screen unlock'],
    ['Applications', 'Manage applications, set up quick launch shortcuts'],
    ['Accounts & sync', 'General sync settings'],
    ['Privacy', 'Location, backup, factory reset', 'privacy'],
    ['SD card & phone storage', 'Unmount SD card, view available storage'],
    ['Search', 'Manage search settings and history'],
    ['Language & keyboard', 'Set locale, text input and auto-correction'],
    ['Accessibility', 'Manage accessibility options'],
    ['Text-to-speech', 'Set text-to-speech options'],
    ['Date & time', 'Set date, time, time zone & format'],
    ['About phone', 'View legal info, phone status, software version', 'about']
  ];

  OS.registerApp({
    id: 'settings', name: 'Settings', icon: ICON,
    launch: function (root) {
      var page = 'top', taps = 0;

      function frame(title) {
        root.innerHTML = OS.titleBar(title);
        var list = OS.el('div', 'list scroll');
        root.appendChild(list);
        return list;
      }
      function row(list, t1, t2, onTap, extra) {
        var r = OS.el('div', 'row', '<div class="grow"><div class="t1">' + OS.esc(t1) + '</div>' + (t2 ? '<div class="t2">' + OS.esc(t2).replace(/\n/g, '<br>') + '</div>' : '') + '</div>' + (extra || ''));
        if (onTap) r.onclick = onTap; else r.classList.add('static');
        list.appendChild(r);
        return r;
      }
      function check(on) { return '<span class="chk' + (on ? ' on' : '') + '"></span>'; }

      function top() {
        page = 'top';
        var list = frame('Settings');
        var fs = row(list, 'Full screen', 'Hide the phone body and fill your screen', function () {
          OS.setFullscreen(!OS.isFullscreen());
          fs.querySelector('.chk').classList.toggle('on', OS.isFullscreen());
        }, check(OS.isFullscreen()));
        TOP.forEach(function (it) {
          row(list, it[0], it[1], function () {
            if (it[2] === 'sound') sound();
            else if (it[2] === 'privacy') privacy();
            else if (it[2] === 'about') about();
            else OS.toast(it[0] + ' is locked by the owner');
          });
        });
      }
      function sound() {
        page = 'sub';
        var list = frame('Sound & display');
        list.appendChild(OS.el('div', 'list-head', 'Sound settings'));
        var r = row(list, 'Silent mode', 'All sounds except media & alarms are silenced', function () {
          OS.setSilent(!OS.silent);
          r.querySelector('.chk').classList.toggle('on', OS.silent);
        }, check(OS.silent));
        row(list, 'Phone ringtone', 'Eclair', function () { OS.toast('Ringtone locked'); });
        row(list, 'Notification ringtone', 'Default', function () { OS.sfx('notify'); });
        list.appendChild(OS.el('div', 'list-head', 'Display settings'));
        row(list, 'Brightness', null, function () { OS.toast('Brightness is fine. Trust us.'); });
        row(list, 'Screen timeout', 'Never', null);
      }
      function privacy() {
        page = 'sub';
        var list = frame('Privacy');
        list.appendChild(OS.el('div', 'list-head', 'Personal data'));
        row(list, 'Factory data reset', 'Erases all data on phone', function () {
          OS.dialog({ title: 'Factory data reset', text: 'This will erase all data from your phone, including:\n\n• Messages you sent\n• Call history\n• Secrets you found\n\nThe phone will restart.',
            buttons: [{ label: 'Reset phone', action: function () { OS.store.clear(); location.reload(); } }, { label: 'Cancel' }] });
        });
      }
      function about() {
        page = 'sub'; taps = 0;
        var list = frame('About phone');
        row(list, 'Status', 'Phone number, signal, etc.', function () {
          OS.dialog({ title: 'Status', text: 'Battery level: ' + OS.battery + '%\nNetwork: ' + (P.carrier || '') + '\nMy phone number: Unknown\nOwner: ' + (P.ownerName || 'Unknown') });
        });
        row(list, 'Battery use', 'What has been using the battery', function () { OS.toast('Mostly the show.'); });
        row(list, 'Legal information', null, function () { OS.toast('Open source licenses'); });
        row(list, 'Model number', P.model);
        row(list, 'Firmware version', P.firmware);
        row(list, 'Baseband version', P.baseband);
        row(list, 'Kernel version', P.kernel);
        var egg = (C.easterEggs || {}).buildNumber;
        row(list, 'Build number', P.buildNumber, function () {
          if (!egg) return;
          taps++;
          var need = egg.taps || 7;
          if (taps < need && taps >= need - 3) OS.toast('You are ' + (need - taps) + ' step' + (need - taps === 1 ? '' : 's') + ' away');
          if (taps === need) { OS.run(egg.action); OS.emit('build-number'); }
        });
      }

      top();
      return {
        back: function () { if (page !== 'top') { top(); return true; } return false; }
      };
    }
  });
})();
