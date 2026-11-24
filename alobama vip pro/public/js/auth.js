/* ============ auth.js — dang ky & dang nhap ============ */
(function () {
  'use strict';
  var $ = ABM.$, $$ = ABM.$$, toast = ABM.toast;

  /* ---------- TRANG DANG NHAP ---------- */
  var loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#err'); err.classList.remove('show');
      var btn = $('#btnLogin'); btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
      try {
        var j = await ABM.api('/api/login', { username: $('#username').value, password: $('#password').value });
        btn.disabled = false; btn.textContent = 'Đăng nhập →';
        if (j.ok) location.href = j.redirect;
        else { err.textContent = j.error || 'Đăng nhập thất bại'; err.classList.add('show'); }
      } catch (ex) {
        btn.disabled = false; btn.textContent = 'Đăng nhập →';
        if (ex && ex.message === 'auth') return;
        err.textContent = 'Không kết nối được server. Mở terminal tại thư mục alobama, gõ "node server.js" rồi mở http://localhost:3000';
        err.classList.add('show');
      }
    });
    /* nut demo: dien & dang nhap luon */
    $$('.demo-box .chip-mini').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#username').value = b.getAttribute('data-u');
        $('#password').value = b.getAttribute('data-p');
        loginForm.dispatchEvent(new Event('submit'));
      });
    });
  }

  /* ---------- TRANG DANG KY ---------- */
  var regForm = $('#regForm');
  if (regForm) {
    /* chon goi */
    $$('.plan').forEach(function (pl) {
      pl.addEventListener('click', function () {
        $$('.plan').forEach(function (x) { x.classList.remove('sel'); });
        pl.classList.add('sel');
        pl.querySelector('input').checked = true;
      });
    });

    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#err'); err.classList.remove('show');
      var plan = document.querySelector('input[name="plan"]:checked').value;
      var btn = $('#btnReg'); btn.disabled = true; btn.textContent = 'Đang tạo tài khoản...';
      var j;
      try {
        j = await ABM.api('/api/register', {
          name: $('#name').value, phone: $('#phone').value,
          elderName: $('#elderName').value, username: $('#username').value,
          password: $('#password').value, plan: plan
        });
      } catch (ex) {
        btn.disabled = false; btn.textContent = '🎉 Đăng ký & nhận 2 tài khoản';
        err.textContent = 'Không kết nối được server. Mở terminal tại thư mục alobama, gõ "node server.js" rồi mở http://localhost:3000';
        err.classList.add('show');
        return;
      }
      if (!j.ok) {
        btn.disabled = false; btn.textContent = '🎉 Đăng ký & nhận 2 tài khoản';
        err.textContent = j.error || 'Đăng ký thất bại'; err.classList.add('show');
        return;
      }
      /* tu dang nhap tai khoan con chau luon */
      try { await ABM.api('/api/login', { username: j.conchau.username, password: j.conchau.password }); } catch (ex2) {}

      $('#stepForm').hidden = true;
      $('#stepDone').hidden = false;
      $('#doneCode').textContent = j.code;
      $('#donePlan').textContent = j.plan === 'year' ? 'Gói Năm 600.000đ' : 'Gói Tháng 59.000đ';
      $('#cu').textContent = j.conchau.username;
      $('#cp').textContent = j.conchau.password;
      $('#gu').textContent = j.ongba.username;
      $('#gp').textContent = j.ongba.password;
      toast('Đăng ký thành công! Đang đăng nhập với tư cách Con cháu');
    });

    /* nut sao chep */
    $$('.copy').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-copy');
        ABM.copyText($('#' + id).textContent);
      });
    });

    $('#btnGoFam').addEventListener('click', function () { location.href = '/app/conchau'; });
    $('#btnGoGp').addEventListener('click', function () { ABM.switchRole(); });
  }
})();
