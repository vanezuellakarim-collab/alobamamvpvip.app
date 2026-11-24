/* ============ conchau.js — app ben Con/Chau (du lieu tu server) ============ */
(function () {
  'use strict';
  var $ = ABM.$, $$ = ABM.$$, esc = ABM.esc, hm = ABM.hm, when = ABM.when, ago = ABM.ago, toast = ABM.toast;

  var ST = null, lastRev = -1;

  function applyState(s, silent) {
    var changed = s.rev !== lastRev;
    ST = s; lastRev = s.rev;
    if (changed || !silent) renderAll();
  }
  async function poll() {
    try { var s = await ABM.get('/api/state'); applyState(s, true); } catch (e) {}
  }
  async function act(p, body) {
    var s = await ABM.api(p, body || {});
    if (s && s.ok) applyState(s);
    return s;
  }
  setInterval(poll, 4000);

  $('#btnSwitch').addEventListener('click', function () { ABM.switchRole(); });
  $('#btnLogout').addEventListener('click', function () { ABM.logout(); });

  /* ---------- Bao SOS tu ong/ba ---------- */
  var lastSos = null;
  function checkSos() {
    var evs = (ST && ST.events) || [];
    var sos = null;
    for (var i = 0; i < evs.length; i++) { if (evs[i].type === 'sos') { sos = evs[i]; break; } }
    if (sos && (!lastSos || sos.t !== lastSos.t)) {
      $('#sosBanner').hidden = false;
      $('#sosName').textContent = '🚨 ' + (ST.elderName || 'Ông/Bà') + ' đang gặp khẩn cấp!';
      $('#sosWhen').textContent = 'Đã nhận lúc ' + hm(sos.t);
      if (lastSos !== null && navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
    lastSos = sos;
  }
  $('#btnBannerSafe').addEventListener('click', async function () {
    $('#sosBanner').hidden = true;
    await act('/api/safe');
    toast('Đã báo ông/bà: “mọi thứ ổn rồi” 🥰');
  });
  $('#btnBannerCall').addEventListener('click', function () {
    startCall(ST.elderName || 'Ông/Bà', '👵');
  });

  /* ---------- Render ---------- */
  function renderAll() {
    if (!ST) return;
    $('#famChip').textContent = 'Gia đình ' + ST.code;
    $('#gpName').textContent = ST.elderName || 'Ông/Bà';
    $('#famMeta').textContent = 'Gia đình ' + ST.code + ' · ' + (ST.plan === 'year' ? 'Gói năm' : 'Gói tháng');

    /* Pill trang thai khang */
    var pill = $('#pillOk');
    if (ST.lastOk && (Date.now() - new Date(ST.lastOk).getTime() < 26 * 3600e3)) {
      pill.className = 'pill ok';
      pill.textContent = '✅ Vẫn khỏe · ' + when(ST.lastOk);
    } else {
      pill.className = 'pill idle';
      pill.textContent = '⚠️ Chưa báo hôm nay';
    }

    /* Vi tri — 2 trang thai: duoc phep / bi khoa */
    var allowed = ST.locAllowed === true;
    $('#locAllowedBox').hidden = !allowed;
    $('#locLockBox').hidden = allowed;
    if (allowed) {
      if (ST.loc) {
        var left = Math.min(92, Math.max(8, 10 + (ST.loc.x - 44) * 5));
        var top = Math.min(85, Math.max(14, 16 + (ST.loc.y - 32) * 4.5));
        var pin = $('#pin');
        pin.style.left = left.toFixed(1) + '%';
        pin.style.top = top.toFixed(1) + '%';
        $('#mapLabel').textContent = (ST.elderName || 'Bà') + ' đang ở đây';
        $('#locAddr').textContent = '📍 Vĩ độ ' + ST.loc.y.toFixed(4) + ' · Kinh độ ' + ST.loc.x.toFixed(4);
        $('#locWhen').textContent = 'Cập nhật ' + ago(ST.loc.updatedAt);
        $('#locCount').textContent = '';
      } else {
        $('#mapLabel').textContent = 'Đang định vị…';
        $('#locAddr').textContent = 'Chưa có dữ liệu vị trí';
        $('#locWhen').textContent = 'Bấm “Cập nhật vị trí mới” để hỏi máy';
      }
    } else {
      $('#lockName').textContent = (ST.elderName || 'Ông/bà') + ' chưa cho phép chia sẻ vị trí';
      $('#askPending').hidden = !ST.locRequested;
      $('#btnAskLoc').hidden = !!ST.locRequested;
    }

    /* Loi nhan */
    $('#noteList').innerHTML = (ST.notes || []).length
      ? ST.notes.map(function (n) {
          return '<div class="note-admin-item"><div style="min-width:0"><div class="na-tx">💌 ' + esc(n.txt) + '</div><div class="na-meta">' + esc(n.from) + ' · ' + when(n.t) + '</div></div><button class="del" data-kind="note" data-id="' + n.id + '" title="Xóa">✕</button></div>';
        }).join('')
      : '<div class="empty">Chưa có lời nhắn nào — hãy gửi lời chào đầu tiên nhé! 💛</div>';

    /* Nhac viec */
    $('#remList').innerHTML = (ST.rems || []).length
      ? ST.rems.map(function (r) {
          return '<div class="rem-admin"><span class="ra-time">🕐 ' + esc(r.time) + '</span><div class="ra-mid" style="flex:1"><b>' + (r.done ? '☑' : '⬜') + ' ' + esc(r.title) + '</b><small>' + (r.done ? 'Đã hoàn thành' : 'Chưa đến giờ') + '</small></div><button class="del" data-kind="rem" data-id="' + r.id + '" title="Xóa">✕</button></div>';
        }).join('')
      : '<div class="empty">Chưa có lịch nhắc nào.</div>';

    /* Tin nhan */
    $('#msgList').innerHTML = (ST.msgs || []).length
      ? ST.msgs.map(function (m) {
          return '<div class="msg ' + (m.who === 'fam' ? 'me' : 'them') + '">' + esc(m.text) + '<span class="msg-t">' + hm(m.t) + '</span></div>';
        }).join('')
      : '<div class="empty">Chưa có tin nhắn nào.</div>';
    var ml = $('#msgList'); ml.scrollTop = ml.scrollHeight;

    checkSos();
  }

  /* ---------- Truy cap nhanh ---------- */
  document.querySelectorAll('.qa').forEach(function (q) {
    q.addEventListener('click', function () {
      var a = q.getAttribute('data-act');
      if (a === 'call') startCall(ST.elderName || 'Ông/Bà', '👵');
      else if (a === 'msg') { $('#secMsg').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { $('#msgInput').focus(); }, 400); }
      else if (a === 'note') { $('#secNote').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { $('#noteInput').focus(); }, 400); }
      else if (a === 'rem') { $('#secRem').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { $('#remInput').focus(); }, 400); }
    });
  });

  /* ---------- Vi tri ---------- */
  $('#btnLocRefresh').addEventListener('click', async function () {
    toast('Đang cập nhật vị trí…');
    var s = await act('/api/loc', {});
    if (s && s.ok) toast('📍 Đã cập nhật vị trí mới');
  });
  $('#btnAskLoc').addEventListener('click', async function () {
    var s = await act('/api/perm/request');
    if (s && s.ok) toast('📩 Đã gửi lời đề nghị — ông/bà sẽ quyết định trên máy của họ');
  });

  /* ---------- Loi nhan / nhan viec / tin nhan ---------- */
  $('#noteForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var s = await act('/api/note', { text: $('#noteInput').value });
    if (s && s.ok) { $('#noteInput').value = ''; toast('💌 Đã gửi lời nhắn'); }
  });
  $('#remForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var s = await act('/api/rem', { title: $('#remInput').value, time: $('#remTime').value });
    if (s && s.ok) { $('#remInput').value = ''; $('#remTime').value = ''; toast('⏰ Đã thêm lịch nhắc'); }
  });
  $('#msgForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var s = await act('/api/msg', { text: $('#msgInput').value });
    if (s && s.ok) { $('#msgInput').value = ''; }
  });
  document.querySelectorAll('.chip-mini').forEach(function (b) {
    b.addEventListener('click', async function () {
      var s = await act('/api/msg', { text: b.getAttribute('data-text') });
      if (s && s.ok) toast('Đã gửi 💬');
    });
  });
  document.body.addEventListener('click', function (e) {
    var d = e.target.closest('.del'); if (!d) return;
    var kind = d.getAttribute('data-kind'), id = d.getAttribute('data-id');
    if (kind === 'note') act('/api/note/delete', { id: id });
    else if (kind === 'rem') act('/api/rem/delete', { id: id });
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

  poll();
})();
