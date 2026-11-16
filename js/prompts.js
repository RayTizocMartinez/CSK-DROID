/* =====================================================================
   PROMPTS.JS — the Writer texts joke prompts at random times.

   Reads one line at a time from the text files listed in content.js
   (media/prompts/text-1.txt ...), wraps it in a random framing
   ("what about... {prompt}"), and texts it from the Writer.

   - New texts keep stacking up (unread count + notification) until read
   - Texts that "arrived" while the visitor was away show up when they return
   - Each prompt has Like / Nah buttons; the Writer answers with :) or :(
   - The whole thread wipes clean at the start of every show day
   ===================================================================== */
(function () {
  'use strict';
  var C = OS.C, P = C.prompts;
  if (!P || P.enabled === false) return;

  var THREAD = P.thread || 'writer';
  var FOLDER = P.folder || 'media/prompts/';
  var lines = null, timer = null, lastFraming = -1, started = false, loadProblem = null;

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function avgGap() { return ((P.minMinutes || 1) + (P.maxMinutes || 4)) / 2 * 60000; }
  function nextGap() {
    var lo = P.minMinutes == null ? 1 : P.minMinutes, hi = P.maxMinutes == null ? 4 : P.maxMinutes;
    return (lo + Math.random() * Math.max(0, hi - lo)) * 60000;
  }

  /* ---------- load the text files ---------- */
  function load() {
    var files = P.files || ['text-1.txt', 'text-2.txt', 'text-3.txt'];
    function get(url) {
      return fetch(OS.url(url), { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.text() : null; })
        .catch(function () { return null; });
    }
    var missing = [], packed = window.PROMPT_FILES || {}, usedPacked = false;
    return Promise.all(files.map(function (f) {
      // Windows hides extensions, so "text-1.txt" is often really "text-1.txt.txt"
      return get(FOLDER + f).then(function (t) { return t != null ? t : get(FOLDER + f + '.txt'); })
        // can't read the .txt (opened by double-click)? use the copy packed into js/prompts-data.js
        .then(function (t) { if (t == null && packed[f] != null) { usedPacked = true; return packed[f]; } return t; })
        .then(function (t) { if (t == null) missing.push(f); return t || ''; });
    })).then(function (texts) {
      loadProblem = null;
      if (missing.length === files.length && location.protocol === 'file:') loadProblem = 'The Writer can\'t read the prompt files when index.html is opened by double-clicking. Open tools/prompts-builder.html to pack your text files into the phone, or open the phone through Live Server / GitHub Pages.';
      else if (usedPacked && window.PROMPT_FILES_SAMPLE) loadProblem = 'The Writer is using the SAMPLE prompts, not your text files. When index.html is opened by double-clicking, the phone can\'t read the .txt files. Open tools/prompts-builder.html, choose media/prompts, and save the downloaded prompts-data.js into the js folder (replace the old one). Or open the phone through Live Server.';
      else if (missing.length === files.length) loadProblem = 'The Writer can\'t find any prompt files in ' + FOLDER + ' (' + files.join(', ') + ').';
      lines = [];
      texts.forEach(function (txt, fi) {
        txt.replace(/^﻿/, '').split(/\r?\n/).forEach(function (l, li) {
          l = l.trim();
          if (l && l.charAt(0) !== '#') lines.push({ key: files[fi] + ':' + l.toLowerCase(), text: l });
        });
      });
      if (!loadProblem && !lines.length) loadProblem = 'The prompt files in ' + FOLDER + ' are empty (lines starting with # are skipped).';
      if (missing.length && missing.length < files.length) console.warn('[prompts] missing: ' + missing.join(', '));
      if (loadProblem) console.warn('[prompts] ' + loadProblem);
      if (usedPacked && !window.PROMPT_FILES_SAMPLE) console.info('[prompts] using the packed copy in js/prompts-data.js (rebuild it after editing the .txt files)');
    });
  }

  /* ---------- build one message ---------- */
  function makeText() {
    var used = OS.store.get('prompts:used', []);
    var pool = lines.filter(function (l) { return used.indexOf(l.key) < 0; });
    if (!pool.length) { used = []; pool = lines; }          // went through them all: start over
    var line = pick(pool);
    used.push(line.key);
    OS.store.set('prompts:used', used);

    var fr = P.framings && P.framings.length ? P.framings : ['what about... {prompt}'];
    var i;
    do { i = Math.floor(Math.random() * fr.length); } while (fr.length > 1 && i === lastFraming);
    lastFraming = i;
    var f = fr[i];
    return f.indexOf('{prompt}') >= 0 ? f.replace('{prompt}', line.text) : f + ' ' + line.text;
  }
  function send(ts, quiet) {
    if (!lines || !lines.length || !OS.sms) return;
    OS.sms.deliver(THREAD, makeText(), {
      kind: 'prompt', id: 'p' + (ts || Date.now()) + Math.floor(Math.random() * 1e4),
      ts: ts, quiet: quiet, from: P.name || 'The Writer'
    });
    OS.store.set('prompts:last', ts || Date.now());
    OS.emit('prompt-received');
  }

  /* ---------- weekly reset on show day ---------- */
  function checkReset() {
    if (P.resetOnShowDay === false || !OS.lastShowDay) return false;
    var cur = OS.lastShowDay();
    var stored = OS.store.get('prompts:cycle', null);
    OS.store.set('prompts:cycle', cur);
    if (stored === null || stored === cur) return false;
    OS.sms.clearThread(THREAD);
    OS.store.set('prompts:used', []);
    OS.store.set('prompts:nextAt', null);
    if (P.showDayMessage) OS.sms.deliver(THREAD, P.showDayMessage, { from: P.name, ts: Math.max(cur, Date.now() - 1000) });
    OS.emit('prompts-reset');
    return true;
  }

  /* ---------- timing ---------- */
  function schedule(ms) {
    clearTimeout(timer);
    OS.store.set('prompts:nextAt', Date.now() + ms);
    timer = setTimeout(fire, ms);
  }
  function fire() {
    checkReset();
    send(null, false);
    schedule(nextGap());
  }
  function warn() {
    if (loadProblem) OS.dialog({ title: lines && lines.length ? 'Sample prompts' : 'No joke prompts', text: loadProblem });
  }
  function begin() {
    if (started) return;
    started = true;
    // tell whoever is testing why no texts will come (visitors never see this if the files are there)
    if (loadProblem) setTimeout(warn, 1500);
    checkReset();
    var now = Date.now(), nextAt = OS.store.get('prompts:nextAt', null);
    if (!nextAt) { schedule((P.firstDelaySeconds == null ? 25 : P.firstDelaySeconds) * 1000); return; }
    if (nextAt > now) { schedule(nextAt - now); return; }
    // the visitor was away: drop in the texts that "arrived" meanwhile (capped), with their old times
    var missed = Math.min(P.maxCatchUp == null ? 3 : P.maxCatchUp, 1 + Math.floor((now - nextAt) / avgGap()));
    var floor = OS.lastShowDay ? OS.lastShowDay() : 0;
    var times = [], t = now;
    for (var k = 0; k < missed; k++) {                // the most recent ones, counting back from now
      t -= avgGap() * (k ? 0.6 + Math.random() * 0.8 : 0.1 + Math.random() * 0.5);
      if (t >= nextAt - 1000 && t > floor) times.unshift(t);
    }
    times.forEach(function (t, i) { send(Math.round(t), i < times.length - 1); });
    schedule(nextGap());
  }

  /* ---------- writer's reaction to a like / dislike ---------- */
  OS.on('prompt-rated', function (e) {
    if (e.thread !== THREAD) return;
    var list = e.value === 'like' ? (P.likeReplies || [':)']) : (P.dislikeReplies || [':(']);
    var d = (P.replyDelaySeconds == null ? 3 : P.replyDelaySeconds) * (0.7 + Math.random() * 0.6) * 1000;
    setTimeout(function () { OS.sms.deliver(THREAD, pick(list), { from: P.name }); }, d);
  });

  // dial code / action {type:"event", name:"prompts:send"} sends one right now
  OS.on('prompts:send', function () {
    if (!lines || !lines.length) { warn(); return; }
    send(null, false); schedule(nextGap());
  });

  // hidden tools for testing in the browser console
  OS.prompts = { send: function () { send(null, false); }, reset: function () { OS.store.set('prompts:cycle', 0); checkReset(); },
    get lines() { return lines; } };

  var ready = load();
  OS.once('unlocked', function () { ready.then(begin); });
})();
