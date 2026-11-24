/* ============ common.js — tien ich dung chung ============ */
window.ABM = (function () {
  'use strict';
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function hm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function sameDay(t) { var a = new Date(t), b = new Date(); return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); }
  function when(t) {
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'Vừa xong';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' phút trước';
    if (sameDay(t)) return 'Hôm nay lúc ' + hm(t);
    return new Date(t).toLocaleDateString('vi-VN') + ' lúc ' + hm(t);
  }
  var toastTimer = null;
  function ago(t) {
    var ms = Date.now() - new Date(t).getTime();
    var m = Math.floor(ms / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return m + ' phút trước';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' giờ trước';
    return Math.floor(h / 24) + ' ngày trước';
  }
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  async function api(p, body) {
    var r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if (r.status === 401) { location.href = '/login'; throw new Error('auth'); }
    var j = await r.json().catch(function () { return { ok: false, error: 'Lỗi kết nối máy chủ' }; });
    return j;
  }
  async function get(p) {
    var r = await fetch(p);
    if (r.status === 401) { location.href = '/login'; throw new Error('auth'); }
    return r.json();
  }
  function logout() { api('/api/logout').then(function () { location.href = '/'; }).catch(function () { location.href = '/'; }); }
  function switchRole() {
    api('/api/switch').then(function (j) {
      if (j.ok) location.href = j.redirect; else toast(j.error || 'Không chuyển được vai');
    });
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(function () { toast('Đã sao chép ✅'); }, function () { fallbackCopy(txt); });
    }
    fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    try {
      var ta = document.createElement('textarea'); ta.value = txt;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta); toast('Đã sao chép ✅');
    } catch (e) { toast('Không sao chép được — hãy chép tay nhé'); }
  }
  return { $: $, $$: $$, esc: esc, hm: hm, when: when, ago: ago, toast: toast, api: api, get: get, logout: logout, switchRole: switchRole, copyText: copyText };
})();
/* Canh bao neu mo file truc tiep (file://) — app can chay qua "node server.js" */
(function () {
  if (location.protocol === 'file:') {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#7F1D1D;color:#fff;padding:14px 16px;border-radius:14px;font:600 13.5px/1.5 sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)';
    b.innerHTML = '⚠️ Bạn đang mở file HTML trực tiếp — app sẽ KHÔNG chạy được kiểu này.<br>Đúng cách: mở terminal tại thư mục alobama → gõ <b style="font-family:monospace">node server.js</b> → mở <b>http://localhost:3000</b>';
    document.body.appendChild(b);
  }
})();
