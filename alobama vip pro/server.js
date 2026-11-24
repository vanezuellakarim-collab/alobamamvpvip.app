#!/usr/bin/env node
/* ============================================================
   AloBaMa — server MVP (Node thuan, KHONG can npm install)
   Chay:  node server.js   ->   mo http://localhost:3000
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AI = require('./ai');
const TTS = require('./tts');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* ================== "DATABASE" (file JSON — du dung cho demo) ================== */
let db = null;

function saveDB() { try { fs.writeFileSync(DATA, JSON.stringify(db)); } catch (e) { console.error('Luu du lieu loi:', e.message); } }

function hash(pw, salt) { return crypto.createHash('sha256').update(salt + ':' + pw).digest('hex'); }
function newId(p) { return p + crypto.randomBytes(4).toString('hex'); }

function addUser(username, password, role, fid, name) {
  const salt = crypto.randomBytes(8).toString('hex');
  db.users[username.toLowerCase()] = {
    u: username.toLowerCase(), salt, pw: hash(password, salt),
    role, fid, name, createdAt: Date.now()
  };
}

function loadDB() {
  try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { db = null; }
  if (!db || !db.users || !db.users['demo']) {
    db = { users: {}, families: {}, sessions: {} };
    const fid = 'f_demo';
    const t = Date.now();
    db.families[fid] = {
      id: fid, code: 'GD-2468', name: 'Gia dinh Demo', elderName: 'Bà Lan',
      plan: 'year', createdAt: t, rev: 1,
      gpLogin: { u: 'ongba1234', pin: '1234' },
      locAllowed: false, locRequested: null,
      notes: [
        { id: newId('n'), txt: 'Mẹ ơi, trưa nay con gửi cháo cho mẹ, mẹ nhớ ăn cơm đầy bụng nhé!', from: 'Minh (con trai)', t: t - 90 * 60000 },
        { id: newId('n'), txt: 'Cuối tuần này Hương về chơi với mẹ, mẹ đừng đi đâu xa nha!', from: 'Hương (con gái)', t: t - 26 * 3600000 }
      ],
      rems: [
        { id: newId('r'), title: 'Uống thuốc huyết áp', time: '07:00', rep: 'daily', done: false },
        { id: newId('r'), title: 'Uống nước & đi bộ nhẹ ngoài công viên', time: '16:30', rep: 'daily', done: false },
        { id: newId('r'), title: 'Khám tim mạch — bệnh viện ĐK', time: '09:00', rep: 'once', done: false }
      ],
      msgs: [
        { id: newId('m'), who: 'gp', text: 'Chào con, mẹ đây ạ ❤️', t: t - 55 * 60000 },
        { id: newId('m'), who: 'fam', text: 'Con chào mẹ! Hôm nay mẹ khỏe không ạ?', t: t - 50 * 60000 },
        { id: newId('m'), who: 'gp', text: 'Mẹ khỏe, con cứ yên tâm nha!', t: t - 48 * 60000 }
      ],
      events: [
        { id: newId('e'), type: 'ok', text: 'Bà Lan đã chạm nút “Tôi ổn” — bình thường', t: t - 2 * 3600000 },
        { id: newId('e'), type: 'note', text: 'Con cháu đã gửi lời nhắn mới cho bà', t: t - 26 * 3600000 }
      ],
      lastOk: t - 2 * 3600000,
      loc: { x: 52, y: 42, updatedAt: t - 5 * 60000 },
      ai: []
    };
    addUser('demo', '1234', 'fam', fid, 'Minh (con trai)');
    addUser('ongba1234', '1234', 'gp', fid, 'Bà Lan');
    saveDB();
    console.log('OK Da tao du lieu mau (tai khoan demo: demo/1234 va ongba1234/1234)');
  }
}

/* ================== PHIEN DANG NHAP (cookie) ================== */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(function (p) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function getSession(req) {
  const t = parseCookies(req)['abm_sess'];
  if (!t) return null;
  const s = db.sessions[t];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[t]; return null; }
  return { token: t, u: s.u };
}
function createSession(u) {
  const t = crypto.randomBytes(18).toString('hex');
  db.sessions[t] = { u: u, exp: Date.now() + 7 * 864e5 };
  saveDB();
  return t;
}
function setCookieHeader(req, token, clear) {
  /* Gui 2 cookie song song: SameSite=None;Secure (preview nhung https) + SameSite=Lax (localhost) */
  if (clear) {
    return [
      'abm_sess=; Path=/; HttpOnly; Max-Age=0; SameSite=None; Secure',
      'abm_sess=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
    ];
  }
  return [
    'abm_sess=' + token + '; Path=/; HttpOnly; Max-Age=' + 7 * 86400 + '; SameSite=None; Secure',
    'abm_sess=' + token + '; Path=/; HttpOnly; Max-Age=' + 7 * 86400 + '; SameSite=Lax'
  ];
}
function auth(req, role) {
  const s = getSession(req);
  if (!s) return null;
  const user = db.users[s.u];
  if (!user) return null;
  if (role && user.role !== role) return null;
  return user;
}
function familyOf(user) { return db.families[user.fid]; }
function touch(f) { f.rev = (f.rev || 0) + 1; }

function stateOf(user) {
  const f = familyOf(user);
  return {
    ok: true, rev: f.rev, role: user.role, name: user.name,
    code: f.code, elderName: f.elderName, plan: f.plan,
    lastOk: f.lastOk || null, loc: f.loc,
    locAllowed: f.locAllowed === true, locRequested: f.locRequested || null,
    notes: f.notes, rems: f.rems, msgs: f.msgs,
    events: f.events.slice(0, 30),
    ai: user.role === 'gp' ? (f.ai || []).slice(-40) : undefined,
    gpLogin: user.role === 'fam' ? f.gpLogin : undefined
  };
}

/* ================== TIEN ICH RESPONSE ================== */
function json(res, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
function errJson(res, msg, code) {
  res.writeHead(code || 400, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: msg }));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let b = '';
    req.on('data', function (c) { b += c; if (b.length > 100000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', function () { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

function sendFile(res, fp) {
  fs.readFile(fp, function (e, buf) {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

/* ================== API ================== */
async function api(req, res, p) {
  const b = (req.method === 'POST') ? await readBody(req) : {};

  /* --- Dang ky --- */
  if (p === '/api/register' && req.method === 'POST') {
    const name = String(b.name || '').trim();
    const phone = String(b.phone || '').replace(/\D/g, '');
    const elder = String(b.elderName || '').trim();
    const plan = b.plan === 'month' ? 'month' : 'year';
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (name.length < 2) return errJson(res, 'Vui lòng nhập họ tên của bạn');
    if (phone.length < 9 || phone.length > 11) return errJson(res, 'Số điện thoại chưa hợp lệ (9–11 số)');
    if (elder.length < 2) return errJson(res, 'Vui lòng nhập tên gọi của Ông/Bà');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return errJson(res, 'Tên đăng nhập: 3–20 ký tự (chữ thường, số, _)');
    if (password.length < 4) return errJson(res, 'Mật khẩu tối thiểu 4 ký tự');
    if (db.users[username]) return errJson(res, 'Tên đăng nhập đã tồn tại — chọn tên khác nhé');

    let gpn; do { gpn = 'ongba' + Math.floor(1000 + Math.random() * 9000); } while (db.users[gpn]);
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const fid = newId('f');
    db.families[fid] = {
      id: fid, code: 'GD-' + Math.floor(1000 + Math.random() * 9000), name: 'Gia đình ' + name,
      elderName: elder, plan, createdAt: Date.now(), rev: 1,
      gpLogin: { u: gpn, pin: pin },
      locAllowed: false, locRequested: null,
      notes: [], rems: [], msgs: [],
      events: [
        { id: newId('e'), type: 'note', text: 'Chào mừng gia đình ' + elder + ' đến với AloBaMa! 🎉', t: Date.now() }
      ],
      lastOk: null, loc: { x: 52, y: 42, updatedAt: Date.now() },
      ai: []
    };
    addUser(username, password, 'fam', fid, name);
    addUser(gpn, pin, 'gp', fid, elder);
    saveDB();
    return json(res, {
      ok: true, code: db.families[fid].code, plan: plan,
      conchau: { username: username, password: password },
      ongba: { username: gpn, password: pin }
    });
  }

  /* --- Dang nhap --- */
  if (p === '/api/login' && req.method === 'POST') {
    const user = db.users[String(b.username || '').trim().toLowerCase()];
    if (!user || user.pw !== hash(String(b.password || ''), user.salt)) {
      return errJson(res, 'Sai tên đăng nhập hoặc mật khẩu');
    }
    const t = createSession(user.u);
    return json(res, {
      ok: true, role: user.role,
      redirect: user.role === 'gp' ? '/app/ongba' : '/app/conchau'
    }, { 'Set-Cookie': setCookieHeader(req, t) });
  }

  /* --- Dang xuat --- */
  if (p === '/api/logout' && req.method === 'POST') {
    const s = getSession(req);
    if (s) { delete db.sessions[s.token]; saveDB(); }
    return json(res, { ok: true, redirect: '/' }, { 'Set-Cookie': setCookieHeader(req, '', true) });
  }

  /* --- Doi vai nhanh trong cung gia dinh (tien demo tren 1 may) --- */
  if (p === '/api/switch' && req.method === 'POST') {
    const user = auth(req);
    if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    const other = Object.values(db.users).find(function (x) { return x.fid === user.fid && x.u !== user.u; });
    if (!other) return errJson(res, 'Không tìm thấy tài khoản còn lại trong gia đình');
    const t = createSession(other.u);
    return json(res, { ok: true, redirect: other.role === 'gp' ? '/app/ongba' : '/app/conchau' }, { 'Set-Cookie': setCookieHeader(req, t) });
  }

  /* --- Lay trang thai gia dinh (poll moi 4s o client) --- */
  if (p === '/api/state' && req.method === 'GET') {
    const user = auth(req);
    if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    return json(res, stateOf(user));
  }

  /* --- GIONG DOC TIENG VIET THAT (cho tro ly AI) --- */
  if (p === '/api/tts/voices' && req.method === 'GET') {
    const user = auth(req); if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    return json(res, { ok: true, voices: TTS.voices(), premium: TTS.hasPremium() });
  }
  if (p === '/api/tts' && req.method === 'GET') {
    const user = auth(req); if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    let q;
    try { q = new URL(req.url, 'http://x').searchParams; } catch (e) { q = new Map(); }
    const text = String((q.get ? q.get('text') : '') || '').slice(0, 800);
    const rate = String((q.get ? q.get('rate') : '') || 'normal');
    const voice = String((q.get ? q.get('voice') : '') || 'google-vi');
    if (!text.trim()) return errJson(res, 'Chưa có nội dung để đọc');
    try {
      const out = await TTS.synthesize(text, { rate: rate, voice: voice });
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': out.audio.length,
        'Cache-Control': 'private, max-age=604800',
        'X-TTS-Provider': out.provider,
        'X-TTS-Rate-Baked': out.rateBaked ? '1' : '0'
      });
      return res.end(out.audio);
    } catch (e) {
      if (process.env.ABM_TTS_DEBUG) console.error('[TTS] loi:', e.message);
      return errJson(res, 'Chưa tải được giọng Việt từ mạng — app sẽ dùng giọng của máy', 502);
    }
  }

  /* --- TRO LY AI (hoi bang chu hoac bang giong) --- */
  if (p === '/api/ai' && req.method === 'POST') {
    const user = auth(req); if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    const f = familyOf(user);
    const text = String(b.text || '').trim().slice(0, 300);
    if (!text) return errJson(res, 'Chưa nghe rõ — bạn nói lại giúp nhé');
    if (!f.ai) f.ai = [];

    const contacts = Object.values(db.users)
      .filter(function (x) { return x.fid === user.fid && x.u !== user.u; })
      .map(function (x) { return { name: x.name, role: x.role }; });

    f.ai.push({ id: newId('a'), who: 'me', text: text, t: Date.now(), voice: b.voice === true });

    let reply;
    try {
      reply = await AI.respond({ text: text, f: f, user: user, contacts: contacts, tz: Number(b.tz) || 0 });
    } catch (e) {
      console.error('LOI AI:', e && e.stack || e);
      reply = { text: 'Dạ, con bị lỗi một chút ạ. Bạn thử lại giúp con nhé!', say: 'Dạ, con bị lỗi một chút ạ. Bạn thử lại giúp con nhé!', chips: [], action: null };
    }

    /* Thuc hien lenh that (dong bo sang may con chau) */
    const a = reply.action || null;
    if (a) {
      if (a.type === 'ok') {
        f.lastOk = Date.now();
        f.events.unshift({ id: newId('e'), type: 'ok', text: f.elderName + ' báo “Tôi ổn” qua trợ lý giọng nói', t: Date.now() });
      } else if (a.type === 'sos') {
        f.events.unshift({ id: newId('e'), type: 'sos', text: '🚨 KHẨN CẤP: ' + f.elderName + ' gọi trợ lý giúp đỡ!', t: Date.now() });
      } else if (a.type === 'safe') {
        f.events.unshift({ id: newId('e'), type: 'safe', text: f.elderName + ' đã nói “tôi ổn rồi” với trợ lý', t: Date.now() });
      } else if (a.type === 'msg') {
        const mt = String(a.text || '').trim().slice(0, 160);
        if (mt) {
          f.msgs.push({ id: newId('m'), who: user.role, text: mt, t: Date.now() });
          f.msgs = f.msgs.slice(-100);
          f.events.unshift({ id: newId('e'), type: 'msg', text: (user.role === 'gp' ? f.elderName : user.name) + ' nhắn (bằng giọng nói): “' + mt + '”', t: Date.now() });
        }
      } else if (a.type === 'rem_done') {
        const r = f.rems.find(function (x) { return x.id === a.id; });
        if (r) {
          r.done = true;
          f.events.unshift({ id: newId('e'), type: 'rem_done', text: f.elderName + ' đã xong việc: “' + r.title + '”', t: Date.now() });
        }
      } else if (a.type === 'perm') {
        f.locAllowed = a.on === true; f.locRequested = null;
        if (f.locAllowed) { if (!f.loc) f.loc = { x: 52, y: 42 }; f.loc.updatedAt = Date.now(); }
        f.events.unshift({ id: newId('e'), type: 'perm', text: (f.locAllowed ? '✅ ' : '🔒 ') + f.elderName + (f.locAllowed ? ' đã BẬT' : ' đã TẮT') + ' chia sẻ vị trí (qua trợ lý)', t: Date.now() });
      }
      f.events = f.events.slice(0, 30);
    }

    const msg = {
      id: newId('a'), who: 'ai', text: reply.text, say: reply.say,
      chips: (reply.chips || []).slice(0, 4), action: a, mood: reply.mood || null, t: Date.now()
    };
    f.ai.push(msg);
    f.ai = f.ai.slice(-40);
    touch(f); saveDB();
    return json(res, Object.assign({ reply: msg }, stateOf(user)));
  }
  if (p === '/api/ai/clear' && req.method === 'POST') {
    const user = auth(req); if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    const f = familyOf(user);
    f.ai = []; touch(f); saveDB();
    return json(res, stateOf(user));
  }

  /* --- Hanh dong ben Ong/Ba --- */
  if (p === '/api/ok' && req.method === 'POST') {
    const user = auth(req, 'gp'); if (!user) return errJson(res, 'Chỉ tài khoản Ông/Bà', 401);
    const f = familyOf(user);
    f.lastOk = Date.now();
    f.events.unshift({ id: newId('e'), type: 'ok', text: f.elderName + ' vừa chạm nút “Tôi ổn” — bình thường', t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/sos' && req.method === 'POST') {
    const user = auth(req, 'gp'); if (!user) return errJson(res, 'Chỉ tài khoản Ông/Bà', 401);
    const f = familyOf(user);
    f.events.unshift({ id: newId('e'), type: 'sos', text: '🚨 KHẨN CẤP: ' + f.elderName + ' vừa bấm nút khẩn cấp!', t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/safe' && req.method === 'POST') {
    const user = auth(req); if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    const f = familyOf(user);
    f.events.unshift({ id: newId('e'), type: 'safe', text: user.role === 'gp' ? f.elderName + ' đã nhấn “Tôi đã ổn” sau cảnh báo' : (user.name + ' đã xác nhận xử lý tình huống khẩn cấp'), t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/rem/done' && req.method === 'POST') {
    const user = auth(req, 'gp'); if (!user) return errJson(res, 'Chỉ tài khoản Ông/Bà', 401);
    const f = familyOf(user);
    const r = f.rems.find(function (x) { return x.id === b.id; });
    if (r) { r.done = true; touch(f); saveDB(); }
    return json(res, stateOf(user));
  }

  /* --- Hanh dong ben Con chau --- */
  if (p === '/api/note' && req.method === 'POST') {
    const user = auth(req, 'fam'); if (!user) return errJson(res, 'Chỉ tài khoản Con cháu', 401);
    const txt = String(b.text || '').trim().slice(0, 120);
    if (!txt) return errJson(res, 'Chưa nhập nội dung ghi chú');
    const f = familyOf(user);
    f.notes.unshift({ id: newId('n'), txt: txt, from: user.name, t: Date.now() });
    f.notes = f.notes.slice(0, 12);
    f.events.unshift({ id: newId('e'), type: 'note', text: user.name + ' đã gửi lời nhắn mới cho ' + f.elderName, t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/note/delete' && req.method === 'POST') {
    const user = auth(req, 'fam'); if (!user) return errJson(res, 'Chỉ tài khoản Con cháu', 401);
    const f = familyOf(user);
    f.notes = f.notes.filter(function (x) { return x.id !== b.id; }); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/rem' && req.method === 'POST') {
    const user = auth(req, 'fam'); if (!user) return errJson(res, 'Chỉ tài khoản Con cháu', 401);
    const title = String(b.title || '').trim().slice(0, 60);
    const time = /^\d{2}:\d{2}$/.test(String(b.time || '')) ? b.time : '08:00';
    if (!title) return errJson(res, 'Chưa nhập việc cần nhắc');
    const f = familyOf(user);
    f.rems.unshift({ id: newId('r'), title: title, time: time, rep: b.rep === 'once' ? 'once' : 'daily', done: false });
    f.rems = f.rems.slice(0, 30);
    f.events.unshift({ id: newId('e'), type: 'rem', text: user.name + ' đặt lịch nhắc: “' + title + '” lúc ' + time, t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/rem/delete' && req.method === 'POST') {
    const user = auth(req, 'fam'); if (!user) return errJson(res, 'Chỉ tài khoản Con cháu', 401);
    const f = familyOf(user);
    f.rems = f.rems.filter(function (x) { return x.id !== b.id; }); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/msg' && req.method === 'POST') {
    const user = auth(req); if (!user) return errJson(res, 'Chưa đăng nhập', 401);
    const text = String(b.text || '').trim().slice(0, 120);
    if (!text) return errJson(res, 'Tin nhắn trống');
    const f = familyOf(user);
    f.msgs.push({ id: newId('m'), who: user.role, text: text, t: Date.now() });
    f.msgs = f.msgs.slice(-100);
    f.events.unshift({ id: newId('e'), type: 'msg', text: (user.role === 'gp' ? f.elderName : user.name) + ' nhắn: “' + text + '”', t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/perm/request' && req.method === 'POST') {
    const user = auth(req, 'fam'); if (!user) return errJson(res, 'Chỉ tài khoản Con cháu', 401);
    const f = familyOf(user);
    if (f.locAllowed) return json(res, stateOf(user));
    f.locRequested = Date.now();
    f.events.unshift({ id: newId('e'), type: 'perm', text: 'Con cháu xin phép XEM VỊ TRÍ của ' + f.elderName, t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/perm/allow' && req.method === 'POST') {
    const user = auth(req, 'gp'); if (!user) return errJson(res, 'Chỉ tài khoản Ông/Bà', 401);
    const f = familyOf(user);
    f.locAllowed = true; f.locRequested = null;
    if (!f.loc) f.loc = { x: 52, y: 42 };
    f.loc.updatedAt = Date.now();
    f.events.unshift({ id: newId('e'), type: 'perm', text: '✅ ' + f.elderName + ' đã ĐỒNG Ý chia sẻ vị trí', t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/perm/deny' && req.method === 'POST') {
    const user = auth(req, 'gp'); if (!user) return errJson(res, 'Chỉ tài khoản Ông/Bà', 401);
    const f = familyOf(user);
    f.locRequested = null;
    f.events.unshift({ id: newId('e'), type: 'perm', text: '❌ ' + f.elderName + ' chưa muốn chia sẻ vị trí lúc này', t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/perm/toggle' && req.method === 'POST') {
    const user = auth(req, 'gp'); if (!user) return errJson(res, 'Chỉ tài khoản Ông/Bà', 401);
    const f = familyOf(user);
    f.locAllowed = b.on === true; f.locRequested = null;
    f.events.unshift({ id: newId('e'), type: 'perm', text: f.locAllowed ? ('✅ ' + f.elderName + ' đã BẬT chia sẻ vị trí') : ('🔒 ' + f.elderName + ' đã TẮT chia sẻ vị trí'), t: Date.now() });
    f.events = f.events.slice(0, 30); touch(f); saveDB();
    return json(res, stateOf(user));
  }
  if (p === '/api/loc' && req.method === 'POST') {
    const user = auth(req, 'fam'); if (!user) return errJson(res, 'Chỉ tài khoản Con cháu', 401);
    const f = familyOf(user);
    if (!f.locAllowed) return errJson(res, f.elderName + ' chưa cho phép chia sẻ vị trí', 403);
    f.loc = { x: 46 + Math.random() * 10, y: 34 + Math.random() * 14, updatedAt: Date.now() };
    touch(f); saveDB();
    return json(res, stateOf(user));
  }

  return errJson(res, 'Không tìm thấy API', 404);
}

/* ================== ROUTING ================== */
const server = http.createServer(function (req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { p = '/'; }

  if (p.startsWith('/api/')) {
    api(req, res, p).catch(function (e) {
      try { errJson(res, 'Lỗi máy chủ: ' + e.message, 500); } catch (_) {}
    });
    return;
  }

  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }

  /* Trang app — yeu cau dang nhap dung vai */
  if (p === '/app/ongba' || p === '/app/conchau') {
    const s = getSession(req);
    if (!s) { res.writeHead(302, { Location: '/login' }); return res.end(); }
    const user = db.users[s.u];
    if (!user) { res.writeHead(302, { Location: '/login' }); return res.end(); }
    const want = p === '/app/ongba' ? 'gp' : 'fam';
    if (user.role !== want) {
      res.writeHead(302, { Location: want === 'gp' ? '/app/conchau' : '/app/ongba' }); return res.end();
    }
    return sendFile(res, path.join(PUB, p === '/app/ongba' ? 'ongba.html' : 'conchau.html'));
  }

  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

  if (p === '/') return sendFile(res, path.join(PUB, 'index.html'));
  if (p === '/login') return sendFile(res, path.join(PUB, 'login.html'));
  if (p === '/register') return sendFile(res, path.join(PUB, 'register.html'));

  const fp = path.normalize(path.join(PUB, p));
  if (fp.startsWith(PUB) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return sendFile(res, fp);

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!DOCTYPE html><html lang="vi"><meta charset="utf-8"><title>404</title><body style="font-family:sans-serif;display:grid;place-items:center;height:90vh;margin:0;background:#FFFAF5"><div style="text-align:center"><div style="font-size:64px">👵📱</div><h1>404 — Không tìm thấy trang</h1><p><a href="/" style="color:#EA580C;font-weight:800">← Về trang chủ AloBaMa</a></p></div>');
});

loadDB();
server.listen(PORT, '0.0.0.0', function () {
  console.log('');
  console.log('  📞 AloBaMa MVP đang chạy tại:  http://localhost:' + PORT);
  console.log('  👵 Tài khoản demo Ông/Bà :  ongba1234 / 1234');
  console.log('  👨‍👩‍👧 Tài khoản demo Con cháu:  demo / 1234');
  console.log('');
});
