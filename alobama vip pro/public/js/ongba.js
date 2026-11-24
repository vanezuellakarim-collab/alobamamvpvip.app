/* ============ ongba.js — app ben Ong/Ba (du lieu tu server) ============ */
(function () {
  'use strict';
  var $ = ABM.$, $$ = ABM.$$, esc = ABM.esc, hm = ABM.hm, when = ABM.when, toast = ABM.toast;

  var ST = null, lastRev = -1;

  /* ---------- Dong bo voi server (poll 4 giay) ---------- */
  function applyState(s, silent) {
    var changed = s.rev !== lastRev;
    ST = s; lastRev = s.rev;
    if (changed || !silent) renderAll();
  }
  async function poll() {
    try {
      var s = await ABM.get('/api/state');
      applyState(s, true);
    } catch (e) { /* mat ket noi — thu lan sau */ }
  }
  async function act(p, body) {
    var s = await ABM.api(p, body || {});
    if (s && s.ok) applyState(s);
    return s;
  }
  setInterval(poll, 4000);

  /* ---------- Header ---------- */
  $('#btnSwitch').addEventListener('click', function () { ABM.switchRole(); });
  $('#btnLogout').addEventListener('click', function () { ABM.logout(); });

  /* ---------- Chuyen man ---------- */
  function gshow(id) {
    var wasAI = !$('#gpAI').hidden;
    $$('.gp-screen').forEach(function (s) { s.hidden = (s.id !== id); });
    $('#appBody').scrollTop = 0;
    if (wasAI && id !== 'gpAI') leaveAI();
    if (id === 'gpAI') openAI();
    if (id === 'gpXQ') { if (!XQ.inited) xqInit(); else xqRender(); }
    if (id === 'gpMem') { if (!MEM.inited) memInit(); }
  }
  $$('.js-gpback').forEach(function (b) { b.addEventListener('click', function () { gshow('gpHome'); }); });
  $('#appBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'call') $('#gpCallModal').classList.add('show');
    else if (a === 'msg') { gshow('gpMsgs'); renderThread($('#gpMsgList'), 'gp'); }
    else if (a === 'ai') { gshow('gpAI'); }
    else if (a === 'games') gshow('gpGames');
    else if (a === 'xq') gshow('gpXQ');
    else if (a === 'mem') gshow('gpMem');
  });

  /* ---------- Loi chao ---------- */
  function updateGreet() {
    if (!ST) return;
    var d = new Date(), h = d.getHours(), g = 'buổi tối';
    if (h < 11) g = 'buổi sáng'; else if (h < 14) g = 'buổi trưa'; else if (h < 18) g = 'buổi chiều';
    $('#gpGreet').textContent = 'Chào ' + ST.elderName + ' 👋 Chúc bạn ' + g + ' tốt lành!';
    $('#gpDate').textContent = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }) + ' • ' + hm(d);
  }
  setInterval(function () { if (ST) updateGreet(); }, 30000);

  /* ---------- Render trang chinh ---------- */
  function renderAll() {
    if (!ST) return;
    $('#famChip').textContent = 'Gia đình ' + ST.code;
    updateGreet();

    var notes = (ST.notes || []).slice(0, 4);
    $('#gpNotes').innerHTML = notes.length
      ? notes.map(function (n) {
          return '<div class="note-gp"><span class="from">💌 ' + esc(n.from) + ' · ' + when(n.t) + '</span>' + esc(n.txt) + '</div>';
        }).join('')
      : '<div class="empty-gp">Chưa có lời nhắn nào. Con cháu gửi lời nhắn sẽ hiện ngay tại đây!</div>';

    var list = (ST.rems || []).filter(function (r) { return !r.done; })
      .slice().sort(function (a, b) { return a.time.localeCompare(b.time); });
    $('#gpRems').innerHTML = list.length
      ? list.map(function (r) {
          return '<div class="rem-gp"><span class="rem-time">🕐 ' + esc(r.time) + '</span><span>' + esc(r.title) + '</span><button class="rem-done" data-id="' + r.id + '">✓ Xong</button></div>';
        }).join('')
      : '<div class="empty-gp">Hôm nay không có việc gì phải nhớ cả. Thư giãn nhé ạ! ☕</div>';

    /* Quyen rieng tu — chia se vi tri */
    $('#gpPermCard').hidden = !ST.locRequested;
    var tg = $('#btnLocToggle');
    if (ST.locAllowed) { tg.textContent = '✓ ĐANG BẬT'; tg.className = 'lp-toggle on'; $('#lpText').innerHTML = 'Con cháu đang thấy bạn ở đâu<small>Tắt bất cứ lúc nào — quyết định luôn thuộc về bạn</small>'; }
    else { tg.textContent = 'TẮT'; tg.className = 'lp-toggle off'; $('#lpText').innerHTML = 'Bật để con cháu thấy bạn đang ở đâu<small>Tắt bất cứ lúc nào — quyết định luôn thuộc về bạn</small>'; }

    /* Hoi thoai tro ly (dong bo tu server) */
    if (!$('#gpAI').hidden) renderAI();
  }

  /* ---------- Nut TOI ON + SOS ---------- */
  $('#btnOk').addEventListener('click', async function () {
    var b = $('#btnOk');
    b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst');
    b.textContent = '✓ ĐANG GỬI...';
    var s = await act('/api/ok');
    b.textContent = s && s.ok ? '✓ ĐÃ BÁO RỒI' : '✅ TÔI ỔN';
    if (s && s.ok) toast('❤️ Đã báo cho con cháu: “vẫn khỏe!”');
    setTimeout(function () { b.textContent = '✅ TÔI ỔN'; }, 2000);
  });
  $('#btnSos').addEventListener('click', async function () {
    await act('/api/sos');
    $('#sosOv').classList.add('show');
  });
  $('#btnSosSafe').addEventListener('click', async function () {
    $('#sosOv').classList.remove('show');
    await act('/api/safe');
    toast('Phù, may quá ạ! 🥰');
  });

  /* ---------- Quyen rieng tu vi tri ---------- */
  $('#btnLocToggle').addEventListener('click', async function () {
    var on = !(ST && ST.locAllowed);
    var s = await act('/api/perm/toggle', { on: on });
    if (s && s.ok) toast(on ? '📍 Đã BẬT chia sẻ vị trí' : '🔒 Đã TẮT chia sẻ vị trí');
  });
  $('#btnPermAllow').addEventListener('click', async function () {
    var s = await act('/api/perm/allow');
    if (s && s.ok) toast('📍 Đã cho phép — con cháu sẽ thấy bạn ở đâu');
  });
  $('#btnPermDeny').addEventListener('click', async function () {
    var s = await act('/api/perm/deny');
    if (s && s.ok) toast('Đã để sau — con cháu nhận được thông báo');
  });

  /* ---------- Danh dau viec da lam ---------- */
  $('#gpRems').addEventListener('click', function (e) {
    var b = e.target.closest('.rem-done'); if (!b) return;
    act('/api/rem/done', { id: b.getAttribute('data-id') });
    toast('Tốt lắm ạ! 👏 Con cháu rất vui');
  });

  /* ---------- Goi dien ---------- */
  var callTimer = null, callInt = null;
  function startCall(name, ava) {
    $('#callName').textContent = name; $('#callAva').textContent = ava;
    var st = $('#callState'); st.textContent = 'Đang gọi...';
    $('#callModal').classList.add('show');
    clearTimeout(callTimer); clearInterval(callInt);
    callTimer = setTimeout(function () {
      var s = 0;
      st.textContent = 'Đang nói chuyện';
      callInt = setInterval(function () { s++; st.textContent = 'Đang nói chuyện — 0' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }, 1000);
    }, 2000);
  }
  function endCall() { clearTimeout(callTimer); clearInterval(callInt); $('#callModal').classList.remove('show'); }
  $('#btnCallEnd').addEventListener('click', endCall);
  $('#callModal').addEventListener('click', function (e) { if (e.target === this) endCall(); });
  $$('.contact').forEach(function (c) {
    c.addEventListener('click', function () {
      $('#gpCallModal').classList.remove('show');
      startCall(c.getAttribute('data-name'), c.getAttribute('data-ava'));
    });
  });
  $$('.js-mclose').forEach(function (b) { b.addEventListener('click', function () { b.closest('.modal').classList.remove('show'); }); });
  $$('.modal').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('show'); }); });

  /* ---------- Tin nhan 2 chieu ---------- */
  function renderThread(el, me) {
    if (!el || !ST) return;
    el.innerHTML = (ST.msgs || []).map(function (m) {
      return '<div class="msg ' + (m.who === me ? 'me' : 'them') + '">' + esc(m.text) + '<span class="msg-t">' + hm(m.t) + '</span></div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }
  async function sendMsg(text) {
    text = String(text || '').trim(); if (!text) return;
    var s = await act('/api/msg', { text: text });
    if (s && s.ok) { renderThread($('#gpMsgList'), 'gp'); }
  }
  $$('.gp-chip').forEach(function (b) { b.addEventListener('click', function () { sendMsg(b.getAttribute('data-text')); }); });

  /* ================================================================
     TRO LY AI BIET NOI — hoi bang giong, tra loi bang giong
     - Nhan giong noi: ABMVoice.listen (vi-VN)
     - Doc tra loi   : ABMVoice.speak  (giong tieng Viet)
     - Hieu & thuc hien lenh tren server (/api/ai)
     ================================================================ */
  var V = window.ABMVoice;
  var aiBusy = false, micCtl = null, lastSay = '', emptyRounds = 0, hardErr = 0;
  var DEFAULT_CHIPS = ['Việc hôm nay', 'Kể chuyện vui', 'Lời nhắn từ con cháu', 'Gọi con cháu'];

  function aiVisible() { return !$('#gpAI').hidden; }
  function pname() { return (ST && ST.elderName) || 'bà'; }
  function pshort() {
    var n = pname().toLowerCase();
    return (/ông|cụ|bố|cha/.test(n) && !/bà/.test(n)) ? 'ông' : 'bà';
  }
  function pCap() { var x = pshort(); return x.charAt(0).toUpperCase() + x.slice(1); }

  function setOrb(mode) {
    var orb = $('#aiOrb'); if (!orb) return;
    orb.className = 'ai-orb ' + mode;
    $('#aiOrbIc').textContent = mode === 'listen' ? '👂' : mode === 'think' ? '💭' : mode === 'talk' ? '🔊' : '🤖';
    var st = $('#aiState'), sub = $('#aiSub'), mt = $('#micTx'), mb = $('#btnMic');
    mb.classList.toggle('listening', mode === 'listen');
    mb.classList.toggle('busy', mode === 'think');
    mb.disabled = (mode === 'think');
    if (mode === 'listen') {
      st.textContent = 'Con đang nghe đây ạ…';
      sub.textContent = pCap() + ' nói đi, nói xong ngừng một lát là con trả lời';
      mt.textContent = 'ĐANG NGHE… (bấm để dừng)';
    } else if (mode === 'think') {
      st.textContent = 'Con đang nghĩ một chút…';
      sub.textContent = 'Chỉ vài giây thôi ạ';
      mt.textContent = 'ĐỢI CON MỘT CHÚT…';
    } else if (mode === 'talk') {
      st.textContent = 'Con đang trả lời…';
      sub.textContent = 'Bấm 🔁 Nghe lại nếu chưa nghe rõ';
      mt.textContent = 'BẤM ĐỂ NÓI TIẾP';
    } else {
      st.textContent = 'Bấm nút 🎤 rồi nói ạ';
      sub.textContent = 'Ví dụ: “Hôm nay tôi có việc gì?”';
      mt.textContent = 'BẤM ĐỂ NÓI';
    }
  }
  function heard(t) {
    var el = $('#aiHeard');
    if (!t) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.textContent = '“' + t + '”';
  }
  function note(msg, withOpen) {
    var el = $('#aiNote');
    if (!msg) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = esc(msg) + (withOpen ? ' <button class="ai-open" id="btnOpenTab" type="button">↗ Mở app ở tab riêng</button>' : '');
    var b = $('#btnOpenTab');
    if (b) b.addEventListener('click', function () { window.open(location.href, '_blank'); });
  }
  function checkSupport() {
    var i = V.info(), m = [];
    if (!i.stt) m.push('Máy này chưa hỗ trợ NGHE giọng nói — ' + pshort() + ' gõ chữ hoặc chọn câu gợi ý nhé, con vẫn ĐỌC trả lời ạ.');
    else if (i.framed) m.push('Đang xem trong khung xem trước nên micro có thể bị chặn. Nếu bấm 🎤 mà không nghe được, hãy mở app ở tab riêng ạ.');
    if (i.src === 'net') {
      if (!i.tts) m.push('Máy chưa có bộ đọc dự phòng — nếu mạng yếu con sẽ chỉ hiện chữ to rõ ạ.');
    } else {
      if (!i.tts) m.push('Máy chưa có bộ đọc nên con chỉ hiện chữ to rõ thôi ạ.');
      else if (!i.viVoice) m.push('Máy chưa cài giọng tiếng Việt — bấm nút 🎙 để chọn “Nữ Việt (mạng)” cho dễ nghe ạ.');
    }
    note(m.join(' '), i.stt && i.framed);
  }

  /* ---------- Ve hoi thoai ---------- */
  function renderAI() {
    var el = $('#aiList'); if (!el) return;
    var hist = (ST && ST.ai) || [];
    if (!hist.length) {
      el.innerHTML = '<div class="msg them">Dạ, con chào ' + esc(pname()) + ' ạ! 🌷 Con là trợ lý biết nói của AloBaMa. ' +
        esc(pCap()) + ' bấm nút 🎤 rồi nói tự nhiên nhé — ví dụ “hôm nay tôi có việc gì”, “nhắc tôi uống thuốc”, “kể chuyện vui” ạ.</div>';
    } else {
      el.innerHTML = hist.map(function (m, i) {
        if (m.who !== 'ai') {
          return '<div class="msg me">' + esc(m.text) + (m.voice ? '<span class="msg-t">🎤 giọng nói</span>' : '') + '</div>';
        }
        return '<div class="msg them">' + esc(m.text) +
          '<button class="say-again" type="button" data-i="' + i + '" title="Nghe lại câu này">🔁 Nghe lại</button></div>';
      }).join('');
      var last = hist[hist.length - 1];
      if (last && last.who === 'ai') lastSay = last.say || last.text;
    }
    if (aiBusy) {
      var ty = document.createElement('div');
      ty.className = 'msg them typing'; ty.innerHTML = '<span></span><span></span><span></span>';
      el.appendChild(ty);
    }
    el.scrollTop = el.scrollHeight;
    renderChips();
  }
  function renderChips() {
    var box = $('#aiChips'); if (!box) return;
    var hist = (ST && ST.ai) || [];
    var last = hist[hist.length - 1];
    var list = (last && last.who === 'ai' && last.chips && last.chips.length) ? last.chips.slice(0) : [];
    DEFAULT_CHIPS.forEach(function (d) { if (list.length < 6 && list.indexOf(d) < 0) list.push(d); });
    box.innerHTML = list.slice(0, 6).map(function (q) {
      return '<button class="chip-btn ai-chip" type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('');
  }
  $('#aiList').addEventListener('click', function (e) {
    var b = e.target.closest('.say-again'); if (!b) return;
    var m = ((ST && ST.ai) || [])[+b.getAttribute('data-i')];
    if (!m) return;
    if (!V.getOn()) { V.setOn(true); syncVoiceBtns(); }
    setOrb('talk');
    V.speak(m.say || m.text, { onend: function () { if (!aiBusy) setOrb('idle'); } });
  });

  /* ---------- Gui cau hoi len server ---------- */
  async function sendAI(q, viaVoice) {
    q = String(q || '').trim();
    if (!q || aiBusy) return;
    aiBusy = true; heard(''); setOrb('think'); renderAI();
    var s = null;
    try {
      s = await ABM.api('/api/ai', { text: q, tz: new Date().getTimezoneOffset(), voice: !!viaVoice });
    } catch (ex) {
      aiBusy = false; setOrb('idle'); renderAI();
      if (ex && ex.message === 'auth') return;
      toast('Mất kết nối máy chủ — thử lại nhé');
      return;
    }
    aiBusy = false;
    if (!s || !s.ok) {
      setOrb('idle'); renderAI();
      toast((s && s.error) || 'Trợ lý chưa trả lời được, thử lại nhé');
      return;
    }
    applyState(s);
    var reply = s.reply || {};
    lastSay = reply.say || reply.text || '';
    emptyRounds = 0;

    /* Lenh phia server da thuc hien — bao lai cho nguoi dung */
    var a = reply.action || null;
    if (a) {
      if (a.type === 'ok') toast('✅ Đã báo con cháu: “tôi ổn”');
      else if (a.type === 'msg') toast('💬 Đã gửi tin nhắn cho con cháu');
      else if (a.type === 'rem_done') toast('👍 Đã đánh dấu xong việc');
      else if (a.type === 'perm') toast(a.on ? '📍 Đã bật chia sẻ vị trí' : '🔒 Đã tắt chia sẻ vị trí');
      else if (a.type === 'safe') toast('🥰 Đã báo cả nhà là mọi thứ ổn');
      else if (a.type === 'sos') { $('#sosOv').classList.add('show'); }
      else if (a.type === 'rate') { V.setRate(a.value); syncVoiceBtns(); }
      else if (a.type === 'hands_off') { setHands(false); }
    }

    setOrb('talk');
    V.speak(lastSay, {
      onend: function () { afterReply(a); },
      onfallback: function () { note('Chưa tải được giọng Việt từ mạng — con tạm dùng giọng của máy ạ.'); }
    });
  }
  function afterReply(a) {
    setOrb('idle');
    if (a && a.type === 'call') {
      var nm = a.name || 'Con cháu';
      var av = /cháu/i.test(nm) ? '🧒' : /gái|con gái/i.test(nm) ? '👩' : '👨';
      startCall(nm, av); return;
    }
    if (a && a.type === 'nav') { gshow(a.screen); if (a.screen === 'gpMsgs') renderThread($('#gpMsgList'), 'gp'); return; }
    if (a && (a.type === 'hands_off' || a.type === 'sos')) return;
    if (V.getHands() && aiVisible()) setTimeout(startListen, 600);
  }

  /* ---------- Nghe giong noi ---------- */
  function startListen() {
    if (!aiVisible() || aiBusy) return;
    if (!V.info().stt) { checkSupport(); toast('Máy chưa hỗ trợ micro — mình gõ chữ nhé'); return; }
    V.stopSpeak();
    setOrb('listen'); heard('…');
    micCtl = V.listen({
      onInterim: function (t) { heard(t || '…'); },
      onError: function (code, msg) {
        if (msg) note(msg, code === 'service-not-allowed' || code === 'not-allowed');
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture' || code === 'unsupported') {
          hardErr++; setHands(false);
        }
      },
      onEnd: function (res) {
        micCtl = null; heard('');
        if (res.text) { hardErr = 0; sendAI(res.text, true); return; }
        setOrb('idle');
        if (res.error && res.error !== 'no-speech' && res.error !== 'aborted') return;
        emptyRounds++;
        if (V.getHands() && aiVisible() && emptyRounds < 4 && hardErr < 2) setTimeout(startListen, 700);
        else if (V.getHands()) { setHands(false); note('Con tạm dừng nghe cho đỡ tốn pin ạ. Khi nào cần, ' + pshort() + ' bấm nút 🎤 nhé!'); }
      }
    });
  }
  $('#btnMic').addEventListener('click', function () {
    if (aiBusy) return;
    if (V.isListening()) { if (micCtl) micCtl.stop(); return; }
    startListen();
  });

  /* ---------- Cac nut phu ---------- */
  function syncVoiceBtns() {
    var on = V.getOn(), h = V.getHands();
    var b1 = $('#btnVoiceOn'), b2 = $('#btnHands'), b3 = $('#btnRate');
    b1.textContent = on ? '🔊 Giọng đọc: BẬT' : '🔇 Giọng đọc: TẮT';
    b1.classList.toggle('on', on);
    b2.textContent = h ? '🗣 Rảnh tay: BẬT' : '🗣 Rảnh tay: TẮT';
    b2.classList.toggle('on', h);
    b3.textContent = '🙂 Tốc độ: ' + V.rateLabel().replace(/^[^ ]+ /, '');
    var b4 = $('#btnVoicePick');
    if (b4) {
      var lbl = V.getSrc() === 'device' ? 'Giọng của máy' : V.voiceLabel(V.getVoiceId());
      b4.textContent = '🎙 ' + lbl.replace(' (mạng)', '');
      b4.classList.toggle('on', V.getSrc() === 'net');
    }
  }
  function setHands(v) {
    V.setHands(v); syncVoiceBtns();
    if (!v) { V.stopListen(); emptyRounds = 0; if (!aiBusy) setOrb('idle'); }
  }
  $('#btnVoiceOn').addEventListener('click', function () {
    var on = !V.getOn();
    V.setOn(on); syncVoiceBtns();
    toast(on ? '🔊 Trợ lý sẽ đọc câu trả lời' : '🔇 Đã tắt giọng đọc');
    if (on && lastSay) { setOrb('talk'); V.speak(lastSay, { onend: function () { setOrb('idle'); } }); }
  });
  $('#btnHands').addEventListener('click', function () {
    var h = !V.getHands();
    if (h && !V.info().stt) { checkSupport(); toast('Máy chưa hỗ trợ micro ạ'); return; }
    setHands(h);
    if (h) {
      if (!V.getOn()) { V.setOn(true); syncVoiceBtns(); }
      note('Chế độ RẢNH TAY: con nghe — trả lời — rồi tự nghe tiếp. Nói “dừng lại” để tắt ạ.');
      emptyRounds = 0; hardErr = 0; startListen();
    } else { note(''); checkSupport(); }
  });
  $('#btnVoicePick').addEventListener('click', async function () {
    var list = await V.loadNetVoices();
    var ids = list.map(function (v) { return v.id; }).concat(['device']);
    var cur = V.getSrc() === 'device' ? 'device' : V.getVoiceId();
    var i = ids.indexOf(cur); if (i < 0) i = 0;
    var next = ids[(i + 1) % ids.length];
    if (next === 'device') { V.setSrc('device'); }
    else { V.setSrc('net'); V.setVoiceId(next); }
    syncVoiceBtns();
    if (!V.getOn()) { V.setOn(true); syncVoiceBtns(); }
    var sample = 'Dạ, con chào ' + pshort() + ' ạ! Con nói bằng giọng này nhé. ' + pCap() + ' nghe có rõ không ạ?';
    setOrb('talk');
    V.speak(sample, {
      onend: function () { setOrb('idle'); },
      onfallback: function () { note('Chưa tải được giọng Việt từ mạng — con tạm dùng giọng của máy ạ.'); }
    });
    toast('🎙 ' + (next === 'device' ? 'Giọng của máy' : V.voiceLabel(next)));
  });
  $('#btnRepeat').addEventListener('click', function () {
    if (!lastSay) { toast('Chưa có câu nào để nghe lại ạ'); return; }
    if (!V.getOn()) { V.setOn(true); syncVoiceBtns(); }
    setOrb('talk');
    V.speak(lastSay, { onend: function () { setOrb('idle'); } });
  });
  $('#btnRate').addEventListener('click', function () {
    var order = ['slow', 'normal', 'fast'], cur = V.getRate();
    var next = order[(order.indexOf(cur) + 1) % order.length];
    V.setRate(next); syncVoiceBtns();
    setOrb('talk');
    V.speak('Dạ, con nói với tốc độ này ạ. Nghe vừa chưa ạ?', { onend: function () { setOrb('idle'); } });
  });
  $('#btnAiClear').addEventListener('click', async function () {
    V.stopSpeak();
    var s = await ABM.api('/api/ai/clear', {});
    if (s && s.ok) { applyState(s); lastSay = ''; setOrb('idle'); toast('🧹 Đã xóa hội thoại'); }
  });
  $('#aiForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#aiInput').value;
    $('#aiInput').value = '';
    sendAI(v, false);
  });
  $('#aiChips').addEventListener('click', function (e) {
    var b = e.target.closest('.ai-chip'); if (!b) return;
    sendAI(b.getAttribute('data-q'), false);
  });

  /* ---------- NOI DE NHAN TIN (man hinh nhan tin) ---------- */
  var dictCtl = null;
  $('#btnDictate').addEventListener('click', function () {
    var btn = $('#btnDictate'), tx = $('#dictateTx');
    if (dictCtl) { dictCtl.stop(); return; }
    if (!V.info().stt) { toast('Máy chưa hỗ trợ micro — mình chọn câu có sẵn nhé'); return; }
    btn.classList.add('listening'); tx.textContent = 'ĐANG NGHE… (bấm để gửi)';
    dictCtl = V.listen({
      onInterim: function (t) { tx.textContent = t ? ('“' + t.slice(0, 40) + '”') : 'ĐANG NGHE…'; },
      onError: function (code, msg) { if (msg) toast(msg); },
      onEnd: function (res) {
        dictCtl = null; btn.classList.remove('listening'); tx.textContent = 'NÓI ĐỂ NHẮN TIN';
        if (res.text) { sendMsg(res.text); toast('💬 Đã gửi bằng giọng nói'); }
        else toast('Con chưa nghe rõ ạ — mình thử lại nhé');
      }
    });
  });

  /* ---------- Mo man hinh tro ly ---------- */
  function openAI() {
    renderAI(); syncVoiceBtns(); checkSupport(); setOrb('idle');
    V.unlockAudio();
    V.loadNetVoices().then(function () { syncVoiceBtns(); });
    var hist = (ST && ST.ai) || [];
    if (!hist.length && V.getOn()) {
      var hi = 'Dạ, con chào ' + pname() + ' ạ! Con là trợ lý biết nói của AloBaMa. ' + pCap() + ' bấm nút micro rồi nói chuyện với con nhé!';
      lastSay = hi;
      setTimeout(function () {
        if (!aiVisible() || aiBusy || V.isListening()) return;
        setOrb('talk'); V.speak(hi, { onend: function () { setOrb('idle'); } });
      }, 420);
    }
  }
  /* roi khoi man hinh thi dung nghe / dung doc */
  function leaveAI() { V.stopListen(); V.stopSpeak(); setHands(false); }

  /* ================================================================
     CO TUONG — DAU VOI MAY (AI: minimax + alpha-beta, độ sâu 3)
     Người cầm quân ĐỎ (đi trước), máy cầm quân Đen.
     ================================================================ */
  var XQ = { b: null, turn: 'r', sel: null, over: false, winner: null, hist: [], thinking: false, inited: false };
  var CH = { r: { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵' }, b: { K: '將', A: '士', B: '象', N: '馬', R: '車', C: '砲', P: '卒' } };
  var VAL = { K: 100000, R: 90, C: 45, N: 40, B: 20, A: 20, P: 10 };
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function xqInit() {
    XQ.b = []; for (var r = 0; r < 10; r++) { XQ.b.push([null, null, null, null, null, null, null, null, null]); }
    var back = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];
    for (var i = 0; i < 9; i++) { XQ.b[0][i] = { t: back[i], c: 'b' }; XQ.b[9][i] = { t: back[i], c: 'r' }; }
    XQ.b[2][1] = { t: 'C', c: 'b' }; XQ.b[2][7] = { t: 'C', c: 'b' };
    XQ.b[7][1] = { t: 'C', c: 'r' }; XQ.b[7][7] = { t: 'C', c: 'r' };
    [0, 2, 4, 6, 8].forEach(function (i) { XQ.b[3][i] = { t: 'P', c: 'b' }; XQ.b[6][i] = { t: 'P', c: 'r' }; });
    XQ.turn = 'r'; XQ.sel = null; XQ.over = false; XQ.winner = null; XQ.hist = []; XQ.thinking = false; XQ.inited = true;
    $('#xqOver').hidden = true; xqRender();
  }
  function inPalace(r, c, col) { return c >= 3 && c <= 5 && (col === 'b' ? (r <= 2) : (r >= 7)); }
  function kingsFace() {
    var K = null, k = null;
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = XQ.b[r][c]; if (!p) continue;
      if (p.t === 'K') { if (p.c === 'r') K = [r, c]; else k = [r, c]; }
    }
    if (!K || !k) return false;
    if (K[1] !== k[1]) return false;
    for (var rr = Math.min(K[0], k[0]) + 1; rr < Math.max(K[0], k[0]); rr++) { if (XQ.b[rr][K[1]]) return false; }
    return true;
  }
  function leavesFace(r, c, rr, cc) {
    var p = XQ.b[r][c], cap = XQ.b[rr][cc];
    XQ.b[rr][cc] = p; XQ.b[r][c] = null;
    var f = kingsFace();
    XQ.b[r][c] = p; XQ.b[rr][cc] = cap;
    return f;
  }
  /* Nuoc di hop le cho NGUOI choi (co kiem tra 2 Tướng không được đối mặt) */
  function legalMoves(r, c) {
    var p = XQ.b[r][c]; if (!p) return [];
    var res = [];
    function push(rr, cc) {
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) return;
      var q = XQ.b[rr][cc]; if (q && q.c === p.c) return;
      if (leavesFace(r, c, rr, cc)) return;
      res.push([rr, cc]);
    }
    var i, rr, cc;
    if (p.t === 'R') {
      for (i = 0; i < 4; i++) { rr = r + DIRS[i][0]; cc = c + DIRS[i][1];
        while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
          var q1 = XQ.b[rr][cc];
          if (!q1) { res.push([rr, cc]); } else { if (q1.c !== p.c) res.push([rr, cc]); break; }
          rr += DIRS[i][0]; cc += DIRS[i][1];
        } }
    } else if (p.t === 'C') {
      for (i = 0; i < 4; i++) { rr = r + DIRS[i][0]; cc = c + DIRS[i][1]; var jump = false;
        while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
          var q2 = XQ.b[rr][cc];
          if (!jump) { if (!q2) res.push([rr, cc]); else jump = true; }
          else { if (q2) { if (q2.c !== p.c) res.push([rr, cc]); break; } }
          rr += DIRS[i][0]; cc += DIRS[i][1];
        } }
    } else if (p.t === 'N') {
      var H = [[-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0], [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]];
      for (i = 0; i < H.length; i++) {
        rr = r + H[i][0]; cc = c + H[i][1];
        if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
        var lr = r + H[i][2], lc = c + H[i][3];
        if (lr < 0 || lr > 9 || lc < 0 || lc > 8) continue;
        if (XQ.b[lr][lc]) continue;
        push(rr, cc);
      }
    } else if (p.t === 'B') {
      var E = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      for (i = 0; i < E.length; i++) {
        rr = r + E[i][0]; cc = c + E[i][1];
        if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
        if (p.c === 'r' && rr < 5) continue; if (p.c === 'b' && rr > 4) continue;
        if (XQ.b[r + E[i][0] / 2][c + E[i][1] / 2]) continue;
        push(rr, cc);
      }
    } else if (p.t === 'A') {
      var A = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (i = 0; i < A.length; i++) { rr = r + A[i][0]; cc = c + A[i][1]; if (inPalace(rr, cc, p.c)) push(rr, cc); }
    } else if (p.t === 'K') {
      for (i = 0; i < 4; i++) { rr = r + DIRS[i][0]; cc = c + DIRS[i][1]; if (inPalace(rr, cc, p.c)) push(rr, cc); }
    } else if (p.t === 'P') {
      var fwd = p.c === 'r' ? -1 : 1;
      push(r + fwd, c);
      var crossed = p.c === 'r' ? r <= 4 : r >= 5;
      if (crossed) { push(r, c - 1); push(r, c + 1); }
    }
    return res;
  }

  /* --- Sinh nuoc di "tho" cho AI (nhanh, khong kiem tra doi mat 2 Tuong) --- */
  function rawMoves(color) {
    var out = [];
    function add(r, c, rr, cc) {
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) return;
      var q = XQ.b[rr][cc];
      if (q && q.c === color) return;
      out.push({ fr: r, fc: c, tr: rr, tc: cc, capV: q ? VAL[q.t] : 0 });
    }
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = XQ.b[r][c]; if (!p || p.c !== color) continue;
      var i, rr, cc, q;
      if (p.t === 'R') {
        for (i = 0; i < 4; i++) { rr = r + DIRS[i][0]; cc = c + DIRS[i][1];
          while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
            q = XQ.b[rr][cc];
            if (!q) { out.push({ fr: r, fc: c, tr: rr, tc: cc, capV: 0 }); }
            else { if (q.c !== color) out.push({ fr: r, fc: c, tr: rr, tc: cc, capV: VAL[q.t] }); break; }
            rr += DIRS[i][0]; cc += DIRS[i][1];
          } }
      } else if (p.t === 'C') {
        for (i = 0; i < 4; i++) { rr = r + DIRS[i][0]; cc = c + DIRS[i][1]; var jumped = false;
          while (rr >= 0 && rr <= 9 && cc >= 0 && cc <= 8) {
            q = XQ.b[rr][cc];
            if (!jumped) { if (!q) out.push({ fr: r, fc: c, tr: rr, tc: cc, capV: 0 }); else jumped = true; }
            else { if (q) { if (q.c !== color) out.push({ fr: r, fc: c, tr: rr, tc: cc, capV: VAL[q.t] }); break; } }
            rr += DIRS[i][0]; cc += DIRS[i][1];
          } }
      } else if (p.t === 'N') {
        var H = [[-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0], [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]];
        for (i = 0; i < H.length; i++) {
          rr = r + H[i][0]; cc = c + H[i][1];
          if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
          var lr = r + H[i][2], lc = c + H[i][3];
          if (lr < 0 || lr > 9 || lc < 0 || lc > 8) continue;
          if (XQ.b[lr][lc]) continue;
          add(r, c, rr, cc);
        }
      } else if (p.t === 'B') {
        var E = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
        for (i = 0; i < E.length; i++) {
          rr = r + E[i][0]; cc = c + E[i][1];
          if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
          if (p.c === 'r' && rr < 5) continue; if (p.c === 'b' && rr > 4) continue;
          if (XQ.b[r + E[i][0] / 2][c + E[i][1] / 2]) continue;
          add(r, c, rr, cc);
        }
      } else if (p.t === 'A') {
        var A = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (i = 0; i < A.length; i++) { rr = r + A[i][0]; cc = c + A[i][1]; if (inPalace(rr, cc, color)) add(r, c, rr, cc); }
      } else if (p.t === 'K') {
        for (i = 0; i < 4; i++) { rr = r + DIRS[i][0]; cc = c + DIRS[i][1]; if (inPalace(rr, cc, color)) add(r, c, rr, cc); }
      } else if (p.t === 'P') {
        var fwd = color === 'r' ? -1 : 1;
        add(r, c, r + fwd, c);
        var crossed = color === 'r' ? r <= 4 : r >= 5;
        if (crossed) { add(r, c, r, c - 1); add(r, c, r, c + 1); }
      }
    }
    return out;
  }
  function evalBoard() {
    var s = 0;
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = XQ.b[r][c]; if (!p) continue;
      var v = VAL[p.t];
      if (p.t === 'P') { v += (p.c === 'r' ? (9 - r) : r) * 2; if ((p.c === 'r' && r <= 4) || (p.c === 'b' && r >= 5)) v += 6; }
      s += (p.c === 'b' ? v : -v);
    }
    return s; /* >0: loi cho may (Den) */
  }
  function make(m) { m.moved = XQ.b[m.fr][m.fc]; m.captured = XQ.b[m.tr][m.tc]; XQ.b[m.tr][m.tc] = m.moved; XQ.b[m.fr][m.fc] = null; }
  function unmake(m) { XQ.b[m.fr][m.fc] = m.moved; XQ.b[m.tr][m.tc] = m.captured || null; }
  function alphabeta(depth, alpha, beta, color) {
    if (depth <= 0) return evalBoard();
    var ms = rawMoves(color);
    ms.sort(function (a, b) { return b.capV - a.capV; });
    var best = (color === 'b') ? -1e9 : 1e9;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i]; make(m);
      var val;
      if (m.captured && m.captured.t === 'K') {
        val = (m.captured.c === 'r' ? 1 : -1) * (1e6 + depth * 1000);
      } else {
        val = alphabeta(depth - 1, alpha, beta, color === 'b' ? 'r' : 'b');
      }
      unmake(m);
      if (color === 'b') { if (val > best) best = val; if (best > alpha) alpha = best; }
      else { if (val < best) best = val; if (best < beta) beta = best; }
      if (beta <= alpha) break;
    }
    return best;
  }
  function aiPick() {
    var ms = rawMoves('b').filter(function (m) { return !leavesFace(m.fr, m.fc, m.tr, m.tc); });
    if (!ms.length) return null;
    ms.sort(function (a, b) { return b.capV - a.capV; });
    var scored = [], alpha = -1e9;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i]; make(m);
      var val;
      if (m.captured && m.captured.t === 'K') val = 1e6;
      else val = alphabeta(2, alpha, 1e9, 'r');
      unmake(m);
      scored.push({ m: m, v: val });
      if (val > alpha) alpha = val;
    }
    var bestV = -1e9;
    for (var j = 0; j < scored.length; j++) if (scored[j].v > bestV) bestV = scored[j].v;
    var cands = scored.filter(function (x) { return x.v >= bestV - 8; });
    return cands[Math.floor(Math.random() * cands.length)].m;
  }

  /* --- Dieu khien van co --- */
  function applyMove(fr, fc, tr, tc) {
    var p = XQ.b[fr][fc], cap = XQ.b[tr][tc];
    XQ.hist.push({ fr: fr, fc: fc, tr: tr, tc: tc, cap: cap, p: p });
    XQ.b[tr][tc] = p; XQ.b[fr][fc] = null; XQ.sel = null;
    if (cap && cap.t === 'K') { XQ.over = true; XQ.winner = p.c; return; }
    XQ.turn = (p.c === 'r') ? 'b' : 'r';
  }
  function showOver() {
    $('#xqOver').hidden = false;
    $('#xqOverMsg').textContent = XQ.winner === 'r'
      ? '🏆 BẠN THẮNG! Máy đã mất Tướng'
      : '🤖 Máy thắng ván này — bấm Ván mới thử lại nhé!';
  }
  function scheduleAI() {
    XQ.thinking = true; xqRender();
    setTimeout(function () {
      if (!XQ.inited || XQ.over) { XQ.thinking = false; xqRender(); return; }
      var m = aiPick();
      XQ.thinking = false;
      if (!m) { XQ.over = true; XQ.winner = 'r'; xqRender(); showOver(); return; }
      applyMove(m.fr, m.fc, m.tr, m.tc);
      xqRender();
      if (XQ.over) showOver();
    }, 550 + Math.random() * 400);
  }
  function xqRender() {
    var box = $('#xqPieces'); if (!box || !XQ.b) return;
    var html = '';
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = XQ.b[r][c]; if (!p) continue;
      var left = ((50 + c * 100) / 9).toFixed(3), top = (5 + r * 10).toFixed(1);
      var sel = (XQ.sel && XQ.sel[0] === r && XQ.sel[1] === c) ? ' sel' : '';
      html += '<button class="pc ' + p.c + sel + '" style="left:' + left + '%;top:' + top + '%" data-r="' + r + '" data-c="' + c + '" aria-label="quân cờ">' + CH[p.c][p.t] + '</button>';
    }
    if (XQ.sel && XQ.turn === 'r' && !XQ.over && !XQ.thinking) {
      var mv = legalMoves(XQ.sel[0], XQ.sel[1]);
      for (var i = 0; i < mv.length; i++) {
        var rr2 = mv[i][0], cc2 = mv[i][1];
        var l2 = ((50 + cc2 * 100) / 9).toFixed(3), t2 = (5 + rr2 * 10).toFixed(1);
        html += '<button class="dot' + (XQ.b[rr2][cc2] ? ' cap' : '') + '" style="left:' + l2 + '%;top:' + t2 + '%" data-r="' + rr2 + '" data-c="' + cc2 + '" aria-label="nước đi"></button>';
      }
    }
    box.innerHTML = html;
    var tu = $('#xqTurn');
    if (tu) {
      if (XQ.over) tu.textContent = '🏁 Ván đã kết thúc';
      else if (XQ.thinking) tu.textContent = '🤖 Máy đang nghĩ…';
      else if (XQ.turn === 'r') tu.textContent = '🔴 Lượt của BẠN (quân Đỏ)';
      else tu.textContent = '⚫ Quân Đen (máy)';
    }
  }
  $('#xqPieces').addEventListener('click', function (e) {
    var btn = e.target.closest('button'); if (!btn) return;
    if (XQ.over || XQ.thinking || XQ.turn !== 'r') return;
    var r = +btn.getAttribute('data-r'), c = +btn.getAttribute('data-c');
    if (btn.classList.contains('dot')) {
      applyMove(XQ.sel[0], XQ.sel[1], r, c);
      xqRender();
      if (XQ.over) { showOver(); return; }
      scheduleAI();
      return;
    }
    var p = XQ.b[r][c]; if (!p) { XQ.sel = null; xqRender(); return; }
    if (p.c === 'r') { XQ.sel = (XQ.sel && XQ.sel[0] === r && XQ.sel[1] === c) ? null : [r, c]; xqRender(); return; }
    if (XQ.sel) {
      var mv = legalMoves(XQ.sel[0], XQ.sel[1]);
      for (var i = 0; i < mv.length; i++) {
        if (mv[i][0] === r && mv[i][1] === c) {
          applyMove(XQ.sel[0], XQ.sel[1], r, c);
          xqRender();
          if (XQ.over) { showOver(); return; }
          scheduleAI();
          return;
        }
      }
    }
  });
  $('#btnXQNew').addEventListener('click', xqInit);
  $('#btnXQAgain').addEventListener('click', xqInit);
  $('#btnXQUndo').addEventListener('click', function () {
    if (XQ.thinking || XQ.over) { toast('Chưa đi lại được lúc này'); return; }
    if (XQ.hist.length < 2) { toast('Chưa có nước nào để đi lại'); return; }
    XQ.hist.pop(); var m1 = XQ.hist.pop();
    XQ.b[m1.fr][m1.fc] = m1.p; XQ.b[m1.tr][m1.tc] = m1.cap || null;
    XQ.turn = 'r'; XQ.sel = null; xqRender();
    toast('↩ Đã đi lại — lượt của bạn');
  });

  /* ================== TRO GHEP DOI ================== */
  var MEM = { deck: [], open: [], lock: false, moves: 0, inited: false };
  var MEMO = ['🌸', '🍊', '🐥', '🎸', '☕', '🌳'];
  function memInit() {
    var all = MEMO.concat(MEMO).map(function (e) { return { e: e, open: false, done: false }; });
    for (var i = all.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = all[i]; all[i] = all[j]; all[j] = x; }
    MEM.deck = all; MEM.open = []; MEM.lock = false; MEM.moves = 0; MEM.inited = true;
    $('#memMoves').textContent = 'Lượt lật: 0'; memRender();
  }
  function memRender() {
    $('#memGrid').innerHTML = MEM.deck.map(function (c, i) {
      return '<button class="mem' + ((c.open || c.done) ? ' flip' : '') + (c.done ? ' done' : '') + '" data-i="' + i + '">' +
        '<span class="face back">❓</span><span class="face front">' + c.e + '</span></button>';
    }).join('');
  }
  $('#memGrid').addEventListener('click', function (e) {
    var b = e.target.closest('.mem'); if (!b || MEM.lock) return;
    var i = +b.getAttribute('data-i'), card = MEM.deck[i];
    if (card.done || card.open) return;
    card.open = true; MEM.open.push(i); memRender();
    if (MEM.open.length === 2) {
      MEM.moves++; $('#memMoves').textContent = 'Lượt lật: ' + MEM.moves; MEM.lock = true;
      var a1 = MEM.deck[MEM.open[0]], a2 = MEM.deck[MEM.open[1]];
      setTimeout(function () {
        if (a1.e === a2.e) { a1.done = true; a2.done = true; }
        else { a1.open = false; a2.open = false; }
        MEM.open = []; MEM.lock = false; memRender();
        if (MEM.deck.every(function (x) { return x.done; })) toast('🎉 Giỏi quá! Hoàn thành trong ' + MEM.moves + ' lượt');
      }, 650);
    }
  });
  $('#btnMemNew').addEventListener('click', memInit);

  /* ---------- Khoi dong ---------- */
  poll();
})();
