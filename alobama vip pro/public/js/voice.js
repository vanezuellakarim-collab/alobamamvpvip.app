/* ============================================================
   voice.js — BO GIONG NOI cua AloBaMa (dung chung)
   - NGHE : SpeechRecognition (vi-VN) -> chu
   - DOC  : uu tien GIONG VIET THAT lay tu server (/api/tts),
            mang loi thi tu dung giong co san cua trinh duyet
   - Mo khoa audio cho iPhone/iPad, nho dem am thanh de
     "Nghe lai" tuc thi, chong loi "im tieng" khi doc dai
   ============================================================ */
window.ABMVoice = (function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var synth = window.speechSynthesis || null;

  var RATES = { slow: 0.8, normal: 1, fast: 1.2 };
  var RATE_LABEL = { slow: '🐢 Chậm', normal: '🙂 Vừa', fast: '🐇 Nhanh' };
  /* 0.06 giay im lang — de "mo khoa" the audio tren iOS */
  var SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAABQAAAqAAbW1tbW1tbW1tbW1tbW1tbW1tbZKSkpKSkpKSkpKSkpKSkpKSkpKStra2tra2tra2tra2tra2tra2trbb29vb29vb29vb29vb29vb29vb2///////////////////////////AAAAAExhdmM1OS4zNwAAAAAAAAAAAAAAACQDYAAAAAAAAAKgvT8luAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

  var viVoice = null, voicesLoaded = false;
  var rec = null, listening = false, micGranted = false;
  var speaking = false, speakToken = 0, keepAlive = null;

  var netVoices = null, netLoading = null;
  var audioEl = null, unlocked = false, blobCache = {}, blobKeys = [];
  var lastFallback = false;

  /* ---------- Cau hinh luu trong may ---------- */
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem('abm_' + k);
      localStorage.setItem('abm_' + k, v);
    } catch (e) {}
    return v;
  }
  function getOn() { return ls('voice_on') !== '0'; }
  function setOn(v) { ls('voice_on', v ? '1' : '0'); if (!v) stopSpeak(); }
  function getRate() { var r = ls('voice_rate'); return RATES[r] !== undefined ? r : 'normal'; }
  function setRate(r) { if (RATES[r] !== undefined) ls('voice_rate', r); }
  function getHands() { return ls('hands') === '1'; }
  function setHands(v) { ls('hands', v ? '1' : '0'); }
  function getSrc() { return ls('voice_src') === 'device' ? 'device' : 'net'; }
  function setSrc(v) { ls('voice_src', v === 'device' ? 'device' : 'net'); }
  function getVoiceId() { return ls('voice_id') || 'google-vi'; }
  function setVoiceId(id) { ls('voice_id', String(id || 'google-vi')); }

  /* ---------- Danh sach giong lay tu server ---------- */
  function defaultList() { return [{ id: 'google-vi', label: 'Nữ Việt (mạng)', provider: 'google' }]; }
  function loadNetVoices(force) {
    if (netVoices && !force) return Promise.resolve(netVoices);
    if (netLoading) return netLoading;
    netLoading = fetch('/api/tts/voices').then(function (r) { return r.json(); }).then(function (j) {
      netLoading = null;
      netVoices = (j && j.ok && j.voices && j.voices.length) ? j.voices : defaultList();
      var id = getVoiceId();
      if (!netVoices.some(function (v) { return v.id === id; })) setVoiceId('google-vi');
      return netVoices;
    }).catch(function () {
      netLoading = null;
      netVoices = defaultList();
      return netVoices;
    });
    return netLoading;
  }
  function voiceLabel(id) {
    if (id === 'device') return 'Giọng của máy';
    var list = netVoices || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].label;
    return 'Nữ Việt (mạng)';
  }

  /* ---------- Giong co san cua trinh duyet (du phong) ---------- */
  function loadVoices() {
    if (!synth) return;
    var vs = [];
    try { vs = synth.getVoices() || []; } catch (e) { vs = []; }
    if (!vs.length) return;
    voicesLoaded = true;
    var vi = vs.filter(function (v) { return /^vi/i.test(v.lang || ''); });
    if (vi.length) {
      vi.sort(function (a, b) {
        var sa = (/google/i.test(a.name) ? 2 : 0) + (/female|nu|nữ|linh|mai|hoa/i.test(a.name) ? 1 : 0);
        var sb = (/google/i.test(b.name) ? 2 : 0) + (/female|nu|nữ|linh|mai|hoa/i.test(b.name) ? 1 : 0);
        return sb - sa;
      });
      viVoice = vi[0];
    } else viVoice = null;
  }
  if (synth) {
    loadVoices();
    try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) { synth.onvoiceschanged = loadVoices; }
    setTimeout(loadVoices, 600);
    setTimeout(loadVoices, 1800);
  }

  /* ---------- Mo khoa audio (iOS can thao tac nguoi dung) ---------- */
  function ensureAudio() {
    if (!audioEl) {
      try { audioEl = new Audio(); } catch (e) { audioEl = null; return null; }
      audioEl.preload = 'auto';
      try { audioEl.setAttribute('playsinline', ''); } catch (e) {}
    }
    return audioEl;
  }
  function unlockAudio() {
    var a = ensureAudio();
    if (!a || unlocked) return;
    unlocked = true;
    try {
      a.src = SILENT;
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
  }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('click', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, true);

  /* ---------- Cat cau de doc on dinh ---------- */
  function chunks(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    var parts = s.replace(/([.!?;:])\s+/g, '$1\n').split('\n');
    var out = [], buf = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim(); if (!p) continue;
      if ((buf + ' ' + p).trim().length <= 170) buf = (buf + ' ' + p).trim();
      else {
        if (buf) out.push(buf);
        if (p.length <= 170) buf = p;
        else {
          var words = p.split(' '), line = '';
          for (var j = 0; j < words.length; j++) {
            if ((line + ' ' + words[j]).trim().length > 170) { out.push(line); line = words[j]; }
            else line = (line + ' ' + words[j]).trim();
          }
          buf = line;
        }
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function stopSpeak() {
    speakToken++;
    speaking = false;
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
    if (synth) { try { synth.cancel(); } catch (e) {} }
  }

  /* ---------- DOC bang giong cua may ---------- */
  function speakDevice(text, opts, token, finish) {
    var parts = chunks(text);
    if (!synth || !parts.length) { setTimeout(finish, 50); return; }
    if (!voicesLoaded) loadVoices();
    var rate = RATES[opts.rate || getRate()] || 1;
    var i = 0;
    keepAlive = setInterval(function () { if (speaking) { try { synth.resume(); } catch (e) {} } }, 7000);
    function next() {
      if (token !== speakToken) return;
      if (i >= parts.length) return finish();
      var txt = parts[i++];
      var u = new SpeechSynthesisUtterance(txt);
      u.lang = 'vi-VN';
      if (viVoice) u.voice = viVoice;
      u.rate = rate === 1 ? 0.95 : rate;
      u.pitch = 1.02; u.volume = 1;
      var moved = false, guard = null;
      var go = function () {
        if (moved) return;
        moved = true;
        if (guard) clearTimeout(guard);
        if (token !== speakToken) return;
        setTimeout(next, 90);
      };
      u.onend = go; u.onerror = go;
      guard = setTimeout(go, Math.max(3500, (txt.length * 105) / rate + 2500));
      try { synth.speak(u); } catch (e) { go(); }
    }
    try { synth.cancel(); } catch (e) {}
    setTimeout(next, 80);
  }

  /* ---------- DOC bang GIONG VIET THAT (tu server) ---------- */
  function rememberBlob(k, obj) {
    blobCache[k] = obj; blobKeys.push(k);
    while (blobKeys.length > 40) {
      var old = blobKeys.shift();
      try { URL.revokeObjectURL(blobCache[old] && blobCache[old].url); } catch (e) {}
      delete blobCache[old];
    }
  }

  function speakNet(text, opts, token, finish, fallback) {
    var a = ensureAudio();
    if (!a || typeof URL === 'undefined' || !URL.createObjectURL) return fallback();
    var rate = opts.rate || getRate();
    var key = getVoiceId() + '|' + rate + '|' + text;
    var watchdog = setTimeout(function () { if (token === speakToken) fallback(); }, 12000);

    function playUrl(url, baked) {
      if (token !== speakToken) { clearTimeout(watchdog); return; }
      clearTimeout(watchdog);
      try {
        a.src = url;
        a.playbackRate = baked ? 1 : (RATES[rate] || 1);
        try { a.preservesPitch = true; a.mozPreservesPitch = true; a.webkitPreservesPitch = true; } catch (e) {}
        a.currentTime = 0;
      } catch (e) { return fallback(); }
      var done = false;
      var fin = function () {
        if (done) return;
        done = true;
        a.onended = null; a.onerror = null;
        if (token !== speakToken) return;
        finish();
      };
      a.onended = fin;
      a.onerror = function () { if (!done) { done = true; fallback(); } };
      var pr = null;
      try { pr = a.play(); } catch (e) { return fallback(); }
      if (pr && pr.catch) pr.catch(function () { if (!done) { done = true; fallback(); } });
    }

    if (blobCache[key]) { playUrl(blobCache[key].url, blobCache[key].baked === true); return; }

    var url = '/api/tts?text=' + encodeURIComponent(text) + '&rate=' + encodeURIComponent(rate) + '&voice=' + encodeURIComponent(getVoiceId());
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 10000) : null;
    fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      if (to) clearTimeout(to);
      if (!r.ok) throw new Error('tts http ' + r.status);
      var baked = r.headers.get('X-TTS-Rate-Baked') === '1';
      return r.blob().then(function (b) { return { blob: b, baked: baked }; });
    }).then(function (o) {
      if (token !== speakToken) return;
      if (!o.blob || o.blob.size < 500) return fallback();
      var u = URL.createObjectURL(o.blob);
      rememberBlob(key, { url: u, baked: o.baked });
      playUrl(u, o.baked);
    }).catch(function () {
      if (to) clearTimeout(to);
      if (token === speakToken) fallback();
    });
  }

  /* ---------- API chinh ---------- */
  function speak(text, opts) {
    opts = opts || {};
    stopSpeak();
    var token = speakToken;
    lastFallback = false;
    var finish = function () {
      if (token !== speakToken) return;
      speaking = false;
      if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
      if (typeof opts.onend === 'function') opts.onend();
    };
    var t = String(text || '').trim();
    if (!getOn() || !t) { setTimeout(finish, 60); return; }

    speaking = true;
    if (typeof opts.onstart === 'function') opts.onstart();

    var fellBack = false;
    var fallback = function () {
      if (fellBack || token !== speakToken) return;
      fellBack = true; lastFallback = true;
      if (typeof opts.onfallback === 'function') opts.onfallback();
      speakDevice(t, opts, token, finish);
    };

    if (getSrc() === 'net') speakNet(t, opts, token, finish, fallback);
    else speakDevice(t, opts, token, finish);
  }

  /* ---------- NGHE ---------- */
  var ERR_MSG = {
    'not-allowed': 'Máy chưa cho phép dùng micro. Hãy bấm vào ổ khóa 🔒 trên thanh địa chỉ → cho phép Micro, rồi thử lại ạ.',
    'service-not-allowed': 'Trình duyệt đang chặn micro (thường do mở trong khung xem trước). Hãy mở app ở TAB RIÊNG rồi thử lại ạ.',
    'audio-capture': 'Không tìm thấy micro trên máy này ạ.',
    'no-speech': 'Con chưa nghe thấy giọng ạ. Mình nói lại nhé!',
    'aborted': '',
    'network': 'Mạng đang yếu nên phần nghe giọng bị gián đoạn ạ. Mình gõ chữ cũng được nhé!',
    'language-not-supported': 'Máy này chưa hỗ trợ nhận giọng tiếng Việt ạ. Mình gõ chữ nhé!',
    'unsupported': 'Trình duyệt này chưa hỗ trợ nói trực tiếp. Mình gõ chữ cho trợ lý nhé — trợ lý vẫn ĐỌC trả lời bằng giọng nói ạ.'
  };
  function errText(code) { return ERR_MSG[code] || ('Phần nghe giọng đang lỗi (' + code + '). Mình thử lại hoặc gõ chữ nhé!'); }

  function ensureMic() {
    return new Promise(function (resolve) {
      if (micGranted || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return resolve(true);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        micGranted = true;
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        resolve(true);
      }).catch(function (e) {
        var n = (e && e.name) || '';
        resolve(n === 'NotFoundError' ? 'audio-capture' : 'not-allowed');
      });
    });
  }

  function stopListen() {
    if (rec) { try { rec.abort(); } catch (e) {} }
    listening = false;
  }

  function listen(opts) {
    opts = opts || {};
    if (!SR) {
      if (opts.onError) opts.onError('unsupported', errText('unsupported'));
      if (opts.onEnd) opts.onEnd({ text: '', error: 'unsupported' });
      return null;
    }
    stopSpeak();
    stopListen();
    var finalTxt = '', errCode = null, ended = false, watchdog = null, r = null;

    function done() {
      if (ended) return;
      ended = true;
      listening = false;
      if (watchdog) clearTimeout(watchdog);
      if (opts.onEnd) opts.onEnd({ text: finalTxt.trim(), error: errCode });
    }

    ensureMic().then(function (ok) {
      if (ok !== true) {
        errCode = ok;
        if (opts.onError) opts.onError(ok, errText(ok));
        return done();
      }
      try { r = new SR(); } catch (e) {
        errCode = 'unsupported';
        if (opts.onError) opts.onError(errCode, errText(errCode));
        return done();
      }
      rec = r;
      r.lang = 'vi-VN';
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onstart = function () {
        listening = true;
        if (opts.onStart) opts.onStart();
        watchdog = setTimeout(function () { try { r.stop(); } catch (e) {} }, 15000);
      };
      r.onresult = function (ev) {
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalTxt += t + ' ';
          else interim += t;
        }
        if (opts.onInterim) opts.onInterim((finalTxt + interim).trim());
      };
      r.onerror = function (ev) {
        errCode = (ev && ev.error) || 'unknown';
        if (errCode !== 'aborted' && errCode !== 'no-speech' && opts.onError) opts.onError(errCode, errText(errCode));
      };
      r.onend = function () { listening = false; done(); };
      try { r.start(); } catch (e) {
        errCode = 'unknown';
        if (opts.onError) opts.onError(errCode, errText(errCode));
        done();
      }
    });

    return {
      stop: function () { try { if (rec) rec.stop(); } catch (e) {} },
      abort: function () { stopListen(); done(); }
    };
  }

  function info() {
    return {
      stt: !!SR,
      tts: !!synth,
      viVoice: !!viVoice,
      voiceName: viVoice ? viVoice.name : '',
      src: getSrc(),
      voiceId: getSrc() === 'device' ? 'device' : getVoiceId(),
      netVoices: netVoices || [],
      fellBack: lastFallback,
      secure: window.isSecureContext !== false,
      framed: (function () { try { return window.self !== window.top; } catch (e) { return true; } })()
    };
  }

  loadNetVoices();

  return {
    speak: speak, stopSpeak: stopSpeak,
    listen: listen, stopListen: stopListen,
    isSpeaking: function () { return speaking; },
    isListening: function () { return listening; },
    getOn: getOn, setOn: setOn,
    getRate: getRate, setRate: setRate, rateLabel: function (r) { return RATE_LABEL[r || getRate()]; },
    getHands: getHands, setHands: setHands,
    getSrc: getSrc, setSrc: setSrc,
    getVoiceId: getVoiceId, setVoiceId: setVoiceId,
    loadNetVoices: loadNetVoices, voiceLabel: voiceLabel,
    unlockAudio: unlockAudio,
    info: info, errText: errText
  };
})();
