'use strict';
/* ============================================================
   AloBaMa — BO NAO TRO LY AI TIENG VIET (ai.js)
   - Chay hoan toan offline, KHONG can API key (mac dinh)
   - Hieu cau noi tieng Viet co dau / khong dau / noi bang giong
   - Doc du lieu that cua gia dinh: lich nhac, loi nhan, gio "Toi on"
   - Co the THUC HIEN lenh: bao "Toi on", gui tin, danh dau xong viec,
     goi con chau, bao khan cap, mo man hinh, doi toc do doc
   - Tuy chon: gan API that (OpenAI-compatible) qua bien moi truong
   ============================================================ */

const https = require('https');

/* ---------------- Chuan hoa tieng Viet ---------------- */
const DIA = {
  a: 'àáạảãâầấậẩẫăằắặẳẵ',
  e: 'èéẹẻẽêềếệểễ',
  i: 'ìíịỉĩ',
  o: 'òóọỏõôồốộổỗơờớợởỡ',
  u: 'ùúụủũưừứựửữ',
  y: 'ỳýỵỷỹ',
  d: 'đ'
};
const TRANS = {};
Object.keys(DIA).forEach(function (k) {
  DIA[k].split('').forEach(function (ch) { TRANS[ch] = k; TRANS[ch.toUpperCase()] = k; });
});
TRANS['Đ'] = 'd';

function deburr(s) {
  return String(s || '').split('').map(function (c) { return TRANS[c] || c; }).join('');
}
function norm(s) {
  return deburr(String(s || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------------- Van ban de DOC THANH TIENG ---------------- */
function sayify(t) {
  let s = String(t || '');
  s = s.replace(/\p{Extended_Pictographic}/gu, '').replace(/[\uFE0F\u200D]/g, '');
  s = s.replace(/\d{1,3}(?:\.\d{3})+đ/g, function (m) {
    var n = Number(m.replace(/[^0-9]/g, ''));
    if (!isFinite(n)) return m;
    return (n % 1000 === 0 ? (n / 1000) + ' nghìn' : String(n)) + ' đồng';
  });
  s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, function (_, h, m) {
    return Number(m) === 0 ? (Number(h) + ' giờ') : (Number(h) + ' giờ ' + Number(m));
  });
  s = s.replace(/\b113\b/g, 'một một ba');
  s = s.replace(/\b115\b/g, 'một một năm');
  s = s.replace(/\bAI\b/g, 'trợ lý');
  s = s.replace(/\bSOS\b/g, 'khẩn cấp');
  s = s.replace(/[“”"*_•→]/g, ' ');
  s = s.replace(/\s*([,;.!?])\s*/g, '$1 ').replace(/\s+/g, ' ').trim();
  return s;
}

/* ---------------- Thoi gian theo mui gio cua may khach ---------------- */
const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
function localNow(tz) { return new Date(Date.now() - (Number(tz) || 0) * 60000); }
function partOfDay(h) {
  if (h < 11) return 'buổi sáng';
  if (h < 14) return 'buổi trưa';
  if (h < 18) return 'buổi chiều';
  return 'buổi tối';
}
function dateLabel(d) {
  return WD[d.getUTCDay()] + ', ngày ' + d.getUTCDate() + ' tháng ' + (d.getUTCMonth() + 1) + ' năm ' + d.getUTCFullYear();
}

/* ---------------- Thoi tiet MO PHONG (on dinh theo ngay) ---------------- */
function weatherOf(d) {
  const key = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const h1 = Math.abs(Math.sin(key) * 10000) % 1;
  const h2 = Math.abs(Math.sin(key + 7) * 10000) % 1;
  const kinds = [
    { t: 'nắng nhẹ, trời trong', ic: '☀️', base: 28, tip: 'đội nón và mang theo nước khi ra ngoài' },
    { t: 'nhiều mây, mát mẻ', ic: '⛅', base: 25, tip: 'đi bộ ngoài trời rất dễ chịu' },
    { t: 'có mưa rào vài nơi', ic: '🌦️', base: 24, tip: 'nhớ mang áo mưa, đường trơn dễ ngã' },
    { t: 'nắng gắt, khá oi', ic: '🌤️', base: 33, tip: 'tránh ra đường lúc giữa trưa và uống nhiều nước' },
    { t: 'se lạnh về sáng sớm', ic: '🌥️', base: 21, tip: 'mặc thêm áo mỏng khi dậy sớm' }
  ];
  const k = kinds[Math.floor(h2 * kinds.length) % kinds.length];
  return { temp: k.base + Math.round(h1 * 3), kind: k };
}

/* ---------------- Ngu canh gia dinh ---------------- */
function buildCtx(o) {
  const f = o.f, user = o.user, d = localNow(o.tz);
  const elder = f.elderName || 'bà';
  const p = /\b(ong|cu|bo|cha|ba noi|ong noi)\b/.test(norm(elder)) && !/\bba\b/.test(norm(elder)) ? 'ông' : 'bà';
  const rems = (f.rems || []).slice();
  const pending = rems.filter(function (r) { return !r.done; })
    .sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
  const isMed = function (r) { return /thuoc|vitamin|vien uong/.test(norm(r.title)); };
  const notes = (f.notes || []);
  const famMsgs = (f.msgs || []).filter(function (m) { return m.who === 'fam'; });
  const contacts = o.contacts || [];
  const lastOkH = f.lastOk ? Math.round((Date.now() - f.lastOk) / 3600000) : null;
  return {
    f: f, user: user, d: d, elder: elder, p: p,
    hour: d.getUTCHours(), minute: d.getUTCMinutes(),
    greet: partOfDay(d.getUTCHours()),
    dateLabel: dateLabel(d),
    clock: ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2),
    rems: rems, pending: pending,
    medPending: pending.filter(isMed),
    medDone: rems.filter(function (r) { return r.done && isMed(r); }),
    notes: notes, famMsgs: famMsgs, contacts: contacts, lastOkH: lastOkH,
    weather: weatherOf(d)
  };
}

function tidy(s) {
  return String(s || '')
    .replace(/([.!?]\s+)([a-zà-ỹđ])/g, function (_, a, b) { return a + b.toUpperCase(); })
    .replace(/([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]\s+)(bà|ông)(?=\s|[.,!?]|$)/gu, function (_, a, b) { return a + b.charAt(0).toUpperCase() + b.slice(1); })
    .replace(/\s+/g, ' ')
    .trim();
}

function R(text, extra) {
  const r = { text: text, say: sayify(text), chips: [], action: null, id: 'answer' };
  return Object.assign(r, extra || {});
}
function remList(list, max) {
  return list.slice(0, max || 4).map(function (r) { return r.time + ' — ' + r.title; }).join('; ');
}

/* ---------------- Chuyen ke / chuyen cuoi / ca dao ---------------- */
const JOKES = [
  'Dạ con kể {p} nghe chuyện vui nhé: Có chú quạ học nói cả tuần mới được câu “Chào ông cháu đi chợ về!”, ai nghe cũng phải bật cười ạ 😄',
  'Dạ chuyện này vui lắm ạ: Ông hỏi cháu “Sao cháu vẽ con mèo có 6 chân?”, cháu đáp “Tại con mèo chạy nhanh quá, cháu vẽ không kịp chân ạ!” 😄',
  'Dạ: Bà đi chợ mua cá, người bán hỏi “Bà muốn cá to hay cá nhỏ?”, bà đáp “Cho tôi con cá… đã ăn cơm rồi, khỏi phải nấu nữa!” 😄',
  'Dạ: Hai ông bạn già ngồi câu cá cả buổi không được con nào. Một ông bảo “Thôi về, cá hôm nay đi học hết rồi!” 😄'
];
const POEMS = [
  'Dạ con đọc {p} nghe câu ca dao quen thuộc ạ: “Công cha như núi Thái Sơn, nghĩa mẹ như nước trong nguồn chảy ra.” 🌾',
  'Dạ: “Chiều chiều ra đứng ngõ sau, trông về quê mẹ ruột đau chín chiều.” Thương lắm {p} ạ 🌾',
  'Dạ: “Anh em nào phải người xa, cùng chung bác mẹ một nhà cùng thân.” Gia đình mình cũng vậy đó {p} ạ ❤️'
];
const STORIES = [
  'Dạ ngày xưa có ông lão trồng cả vườn bưởi trước nhà. Bưởi chín ông không bán, cứ để dành chờ các cháu về. Năm nào cháu về cũng reo lên “Ông ơi bưởi thơm quá!”. Ông bảo: “Bưởi thơm là để gọi các cháu về đấy mà.” 🌳',
  'Dạ có bà cụ mỗi sáng đều ra hiên ngồi phơi nắng. Hàng xóm hỏi sao bà ngồi một mình hoài, bà cười: “Tôi có nắng, có chim, có tiếng cháu gọi điện — đâu có một mình đâu!” ☀️',
  'Dạ ngày xưa ở làng nọ có cây đa già, gốc là chỗ người già ngồi kể chuyện, ngọn là chỗ trẻ con thả diều. Cả làng thương nhau nhờ có một cái cây. {p} thấy ấm áp không ạ 🌳'
];

/* ---------------- Cac "y dinh" (intent) ---------------- */
const INTENTS = [
  /* 1. Dung nghe / thoai che do ranh tay */
  {
    id: 'stop', re: /\b(dung lai|dung nghe|tat micro|im lang|dung noi nua|thoi dung|ngung nghe)\b/,
    run: function (c) {
      return R('Dạ, con tắt micro rồi ạ. Khi nào cần {p} cứ bấm nút 🎤 nhé!'.replace(/{p}/g, c.p),
        { action: { type: 'hands_off' }, chips: ['Kể chuyện vui', 'Việc hôm nay'] });
    }
  },
  /* 2. Khan cap — uu tien cao nhat */
  {
    id: 'sos', re: /\b(cuu|khan cap|cap cuu|bi nga|nga xuong|bat tinh|kho tho|dau nguc|dot quy|chay mau|tai bien|nguoi la)\b/,
    run: function (c) {
      return R('🚨 Con đã GỬI TÍN HIỆU KHẨN CẤP tới con cháu ngay rồi ạ! {p} ngồi hoặc nằm chỗ an toàn, đừng cố đi lại. Nếu nguy hiểm, gọi ngay 113 hoặc 115 nhé ạ ❤️'.replace(/{p}/g, c.p),
        { action: { type: 'sos' }, chips: ['Tôi đã ổn rồi', 'Gọi con cháu'], mood: 'sos' });
    }
  },
  {
    id: 'safe', re: /\b(toi da on|da on roi|on lai roi|khong sao nua|het roi)\b/,
    run: function (c) {
      return R('Dạ may quá ạ! Con đã báo con cháu là {p} ổn rồi, cả nhà bớt lo 🥰'.replace(/{p}/g, c.p),
        { action: { type: 'safe' }, chips: ['Nghỉ ngơi chút', 'Kể chuyện vui'] });
    }
  },
  /* 3. Bao "Toi on" */
  {
    id: 'ok', re: /\b(toi on|ba on|ong on|van khoe|bao khoe|on roi|khoe roi|bao con chau.*on|danh dau on)\b/,
    run: function (c) {
      return R('✅ Dạ, con đã báo cho con cháu: “{p} vẫn khỏe!” lúc ' + c.clock + ' rồi ạ. Cả nhà yên tâm lắm ❤️'.replace(/{p}/g, c.p),
        { action: { type: 'ok' }, chips: ['Việc hôm nay', 'Lời nhắn từ con cháu', 'Kể chuyện vui'] });
    }
  },
  /* 4. Danh dau viec da xong */
  {
    id: 'rem_done', re: /\b(da uong|da lam|da xong|da an|uong roi|lam roi|xong roi|danh dau xong|hoan thanh)\b|\b(uong|lam)\b[^?]*\b(roi|xong)\b/,
    run: function (c) {
      const target = c.medPending[0] || c.pending[0];
      if (!target) {
        return R('Dạ, hôm nay {p} không còn việc nào chưa làm nữa ạ. Giỏi quá! 👏'.replace(/{p}/g, c.p),
          { chips: ['Kể chuyện vui', 'Thời tiết hôm nay'] });
      }
      return R('👍 Dạ, con đánh dấu “' + target.title + '” lúc ' + target.time + ' là ĐÃ XONG rồi ạ. {p} giỏi lắm!'.replace(/{p}/g, c.p),
        { action: { type: 'rem_done', id: target.id, title: target.title }, chips: ['Còn việc gì nữa?', 'Báo tôi ổn'] });
    }
  },
  /* 5. Doc tin / nhan cho con chau */
  {
    id: 'dictate', re: /\b(nhan cho|nhan voi|nhan tin|nhan rang|nhan ho|gui tin|gui loi|bao con|noi voi con|dan con|gui cho con)\b/,
    run: function (c, raw) {
      const m = String(raw).match(/(?:là|rằng|:)\s*(.{3,})$/i);
      let content = m ? m[1].trim() : '';
      if (!content) {
        const m2 = String(raw).match(/(?:nhắn|nhắn cho|nhắn với|bảo|nói với)\s+(?:con cháu|con|cháu|con trai|con gái)\s+(.{4,})$/i);
        content = m2 ? m2[1].trim() : '';
      }
      content = content.replace(/^(là|rằng)\s+/i, '').slice(0, 160);
      if (content && !/^(gì|gi|với|cho)\b/i.test(content)) {
        return R('💬 Dạ, con đã gửi tới con cháu: “' + content + '” rồi ạ. Chắc các con vui lắm! 🥰',
          { action: { type: 'msg', text: content }, chips: ['Gọi con cháu', 'Lời nhắn từ con cháu'] });
      }
      return R('Dạ, {p} muốn nhắn gì cho con cháu ạ? {p} nói kiểu này nhé: “Nhắn cho con là tối nay bà khỏe”. Hoặc con mở màn hình nhắn tin giúp {p} nha 💬'.replace(/{p}/g, c.p),
        { action: { type: 'nav', screen: 'gpMsgs' }, chips: ['Báo tôi ổn', 'Gọi con cháu'] });
    }
  },
  /* 17. Gia goi */
  {
    id: 'price', re: /\b(gia|bao nhieu tien|phi|goi cuoc|thanh toan|mien phi|goi nam|goi thang)\b/,
    run: function (c) {
      return R('🎁 Dạ, gói Tháng 59.000đ/tháng, gói Năm 600.000đ/năm (rẻ hơn khoảng 108.000đ) cho cả 2 tài khoản ạ. Nhưng bản thử nghiệm này MIỄN PHÍ hoàn toàn, {p} cứ dùng thoải mái nhé!'.replace(/{p}/g, c.p),
        { chips: ['Trợ lý làm được gì?', 'Kể chuyện vui'] });
    }
  },
  /* 6. Goi con chau */
  {
    id: 'call', re: /\b(goi|dien thoai|noi chuyen voi|gap con|gap chau)\b/, rawNot: /gói|giá/i,
    run: function (c, raw, n) {
      if (!c.contacts.length) {
        return R('Dạ, trong danh bạ chưa có người thân nào ạ. {p} bảo con cháu đăng ký thêm giúp nhé!'.replace(/{p}/g, c.p),
          { chips: ['Nhắn cho con cháu', 'Việc hôm nay'] });
      }
      const SKIP = { con: 1, chau: 1, trai: 1, gai: 1, noi: 1, ngoai: 1, anh: 1, chi: 1, em: 1, nguoi: 1, than: 1 };
      let who = c.contacts[0];
      for (let i = 0; i < c.contacts.length; i++) {
        const parts = norm(c.contacts[i].name).split(' ').filter(function (w) { return w.length > 2 && !SKIP[w]; });
        if (parts.some(function (w) { return n.indexOf(w) >= 0; })) { who = c.contacts[i]; break; }
      }
      return R('📞 Dạ, con nối máy cho ' + who.name + ' ngay đây ạ. {p} giữ máy nhé!'.replace(/{p}/g, c.p),
        { action: { type: 'call', name: who.name }, chips: ['Nhắn cho con cháu', 'Báo tôi ổn'] });
    }
  },
  /* 7. Doc loi nhan / tin nhan tu con chau */
  {
    id: 'notes', re: /\b(loi nhan|con nhan|con chau nhan|tin nhan|doc.*nhan|con gui|co gi moi|con noi gi|nhan gi|loi dan)\b/,
    run: function (c) {
      if (c.notes.length) {
        const n0 = c.notes[0];
        const more = c.notes.length > 1 ? (' Còn ' + (c.notes.length - 1) + ' lời nhắn nữa ở trang chính ạ.') : '';
        return R('💌 Dạ, ' + n0.from + ' nhắn: “' + n0.txt + '”.' + more + ' Thương {p} lắm đó ạ ❤️'.replace(/{p}/g, c.p),
          { chips: ['Nhắn lại cho con cháu', 'Gọi con cháu', 'Báo tôi ổn'] });
      }
      if (c.famMsgs.length) {
        const m0 = c.famMsgs[c.famMsgs.length - 1];
        return R('💬 Dạ, tin gần nhất từ con cháu: “' + m0.text + '”. {p} muốn trả lời thì nói “Nhắn cho con là…” nhé ạ!'.replace(/{p}/g, c.p),
          { chips: ['Nhắn cho con là bà khỏe', 'Gọi con cháu'] });
      }
      return R('Dạ, chưa có lời nhắn nào mới ạ. {p} muốn con nhắn cho con cháu một câu không ạ? 💌'.replace(/{p}/g, c.p),
        { chips: ['Nhắn cho con là bà nhớ con', 'Gọi con cháu'] });
    }
  },
  /* 8. Thuoc */
  {
    id: 'med', re: /\b(thuoc|vitamin|vien uong|uong gi|ke don|don thuoc)\b/,
    run: function (c) {
      if (c.medPending.length) {
        return R('💊 Dạ, {p} còn ' + c.medPending.length + ' cữ chưa uống: ' + remList(c.medPending, 3) + '. {p} nhớ uống sau khi ăn nhẹ và với nước ấm nhé ạ. Uống xong {p} nói “tôi uống thuốc rồi” để con đánh dấu giúp nha!'.replace(/{p}/g, c.p),
          { chips: ['Tôi uống thuốc rồi', 'Còn việc gì nữa?', 'Gọi con cháu'] });
      }
      if (c.medDone.length) {
        return R('✅ Dạ, thuốc hôm nay {p} uống đủ rồi ạ: ' + remList(c.medDone, 3) + '. Giỏi lắm {p} ơi! 👏'.replace(/{p}/g, c.p),
          { chips: ['Báo tôi ổn', 'Kể chuyện vui'] });
      }
      return R('Dạ, hiện chưa có lịch thuốc nào trong máy ạ. {p} bảo con cháu thêm lịch nhắc ở mục “Nhắc việc” nhé. {p} nhớ uống thuốc theo đơn bác sĩ, đừng tự đổi liều nha 💊'.replace(/{p}/g, c.p),
        { chips: ['Việc hôm nay', 'Nhắn cho con cháu'] });
    }
  },
  /* 9. Gio / ngay thang */
  {
    id: 'time', re: /\b(may gio|bao nhieu gio|gio gi|thu may|ngay bao nhieu|hom nay ngay|hom nay thu|ngay may)\b/,
    run: function (c) {
      return R('🕐 Dạ, bây giờ là ' + c.clock + ', ' + c.dateLabel + ' ạ. Chúc {p} ' + c.greet + ' thật an lành! ' + (c.hour < 18 ? '☀️' : '🌙'),
        { chips: ['Việc hôm nay', 'Thời tiết hôm nay', 'Kể chuyện vui'] });
    }
  },
  /* 10. Viec hom nay / lich nhac */
  {
    id: 'todo', re: /\b(viec hom nay|hom nay co gi|lich|nhac viec|viec can lam|can lam|con viec|viec gi|phai lam)\b/,
    run: function (c) {
      if (!c.pending.length) {
        return R('Dạ, hôm nay {p} không còn việc gì phải nhớ nữa ạ. {p} nghỉ ngơi, uống nước, nghe chuyện vui nhé ☕'.replace(/{p}/g, c.p),
          { chips: ['Kể chuyện vui', 'Chơi cờ tướng', 'Thời tiết hôm nay'] });
      }
      return R('⏰ Dạ, hôm nay {p} còn ' + c.pending.length + ' việc: ' + remList(c.pending, 4) + '. Việc nào xong rồi {p} nói “đã làm xong” giúp con nhé ạ!'.replace(/{p}/g, c.p),
        { chips: ['Tôi uống thuốc rồi', 'Thuốc của tôi', 'Báo tôi ổn'] });
    }
  },
  /* 11. Thoi tiet */
  {
    id: 'weather', re: /\b(thoi tiet|nhiet do|troi|nang|mua|nong|lanh|gio troi)\b/,
    run: function (c) {
      const w = c.weather;
      return R(w.kind.ic + ' Dạ, hôm nay trời ' + w.kind.t + ', khoảng ' + w.temp + ' độ ạ. {p} nhớ ' + w.kind.tip + ' nhé! (Bản demo dùng số liệu mô phỏng ạ)'.replace(/{p}/g, c.p),
        { chips: ['Việc hôm nay', 'Đi bộ tốt không?', 'Kể chuyện vui'] });
    }
  },
  /* 12. Tro choi */
  {
    id: 'games', re: /\b(co tuong|choi co|tro choi|ghep doi|game|choi gi|giai tri|luyen tri nho)\b/,
    run: function (c) {
      return R('♟️ Dạ, con mở mục Trò chơi cho {p} nhé! Có cờ tướng đấu với máy và trò ghép đôi luyện trí nhớ. Chơi mỗi ngày một chút cho đầu óc minh mẫn ạ 🧠'.replace(/{p}/g, c.p),
        { action: { type: 'nav', screen: 'gpGames' }, chips: ['Kể chuyện vui', 'Việc hôm nay'] });
    }
  },
  /* 13. Ke chuyen / cuoi / tho / hat */
  {
    id: 'story', re: /\b(chuyen cuoi|ke chuyen|hai huoc|cuoi|vui vui|ke.*chuyen|hat|bai hat|tho|ca dao|chuyen vui)\b/,
    run: function (c, raw, n) {
      let t;
      if (/\b(tho|ca dao|hat)\b/.test(n)) t = pick(POEMS);
      else if (/\b(chuyen cuoi|cuoi|hai huoc)\b/.test(n)) t = pick(JOKES);
      else t = pick(STORIES);
      return R(t.replace(/{p}/g, c.p), { chips: ['Kể nữa đi', 'Đọc câu ca dao', 'Chơi cờ tướng'] });
    }
  },
  /* 14. Buon / co don / mat ngu */
  {
    id: 'lonely', re: /\b(buon|co don|nho con|nho chau|mot minh|kho tam|lo lang|mat ngu|ngu khong duoc|stress|chan qua)\b/,
    run: function (c) {
      const nm = c.contacts.length ? c.contacts[0].name : 'con cháu';
      return R('Dạ, con nghe {p} đây ạ ❤️ {p} đừng giữ trong lòng một mình. Con gọi ' + nm + ' cho {p} nói chuyện nhé? Hoặc {p} nghe con kể một chuyện vui cho nhẹ lòng ạ 🌷'.replace(/{p}/g, c.p),
        { chips: ['Gọi con cháu', 'Kể chuyện vui', 'Nhắn cho con là bà nhớ con'] });
    }
  },
  /* 15. Suc khoe nhe */
  {
    id: 'health', re: /\b(met|om|dau|huyet ap|duong huyet|tieu duong|chong mat|mat ngu|an uong|tap the duc|di bo|suc khoe|ngu|an gi)\b/,
    run: function (c, raw, n) {
      if (/huyet ap/.test(n)) {
        return R('Dạ, với huyết áp {p} nhớ ăn nhạt, uống thuốc đúng giờ và đo mỗi sáng nhé. Nếu thấy đau đầu nhiều, mờ mắt hay choáng thì nói “khẩn cấp” để con báo con cháu ngay ạ ❤️',
          { chips: ['Tôi hơi mệt', 'Thuốc của tôi', 'Gọi con cháu'] });
      }
      if (/di bo|tap the duc/.test(n)) {
        return R('🚶 Dạ, {p} đi bộ nhẹ 15–20 phút mỗi ngày là rất tốt ạ. Đi chỗ bằng phẳng, có người đi cùng càng tốt, mang nước theo và nghỉ khi thấy mệt nhé!'.replace(/{p}/g, c.p),
          { chips: ['Thời tiết hôm nay', 'Đặt nhắc đi bộ', 'Báo tôi ổn'] });
      }
      if (/an gi|an uong/.test(n)) {
        return R('🍚 Dạ, {p} ăn ấm, mềm, đủ rau và đạm nhé — cháo, cá, trứng, đậu phụ都很 tốt ạ. Ăn chậm, chia nhỏ bữa và uống đủ nước trong ngày nha!'.replace(/{p}/g, c.p).replace('都很', ' đều rất'),
          { chips: ['Việc hôm nay', 'Nhắn cho con cháu', 'Kể chuyện vui'] });
      }
      return R('Dạ, {p} thấy không khỏe chỗ nào ạ? {p} nghỉ ngơi, uống nước ấm và ngồi chỗ vững nhé. Nếu mệt nhiều hoặc đau bất thường, {p} nói “khẩn cấp” — con báo con cháu ngay lập tức ạ ❤️ Con chỉ gợi ý chăm sóc thôi, việc thuốc men vẫn theo bác sĩ nha.'.replace(/{p}/g, c.p),
        { chips: ['Gọi con cháu', 'Khẩn cấp', 'Kể chuyện vui'] });
    }
  },
  /* 16. Vi tri / quyen rieng tu */
  {
    id: 'loc', re: /\b(vi tri|dinh vi|ban do|o dau|chia se vi tri)\b/,
    run: function (c, raw, n) {
      if (/\b(bat|mo|dong y|cho phep)\b/.test(n) && /chia se|vi tri/.test(n)) {
        return R('📍 Dạ, con BẬT chia sẻ vị trí rồi ạ. Con cháu sẽ thấy {p} đang ở đâu. {p} có thể tắt bất cứ lúc nào — quyền quyết định luôn là của {p} nhé!'.replace(/{p}/g, c.p),
          { action: { type: 'perm', on: true }, chips: ['Tắt chia sẻ vị trí', 'Báo tôi ổn'] });
      }
      if (/\b(tat|khong cho|dung chia se|an)\b/.test(n)) {
        return R('🔒 Dạ, con TẮT chia sẻ vị trí rồi ạ. Con cháu sẽ không thấy {p} ở đâu nữa. Khi nào muốn, {p} nói “bật chia sẻ vị trí” nhé!'.replace(/{p}/g, c.p),
          { action: { type: 'perm', on: false }, chips: ['Báo tôi ổn', 'Việc hôm nay'] });
      }
      return R('📍 Dạ, việc chia sẻ vị trí hoàn toàn do {p} quyết định ạ. Bật thì con cháu yên tâm hơn khi {p} ra ngoài; tắt cũng không sao cả. {p} muốn con bật hay tắt ạ?'.replace(/{p}/g, c.p),
        { chips: ['Bật chia sẻ vị trí', 'Tắt chia sẻ vị trí'] });
    }
  },
  /* 18. Nghe lai / noi cham / noi nhanh */
  {
    id: 'voice_ctrl', re: /\b(noi lai|nhac lai|doc lai|nghe lai|noi cham|cham lai|noi nhanh|noi to|noi nho)\b/,
    run: function (c, raw, n) {
      if (/noi cham|cham lai/.test(n)) {
        return R('Dạ, từ giờ con nói CHẬM hơn cho {p} dễ nghe ạ 🐢'.replace(/{p}/g, c.p), { action: { type: 'rate', value: 'slow' } });
      }
      if (/noi nhanh/.test(n)) {
        return R('Dạ, con nói nhanh hơn một chút nhé ạ 🐇', { action: { type: 'rate', value: 'fast' } });
      }
      const hist = (c.f.ai || []).filter(function (m) { return m.who === 'ai'; });
      const last = hist[hist.length - 1];
      if (last) return R('🔁 Dạ, con nhắc lại ạ: ' + last.text, { chips: ['Cảm ơn con', 'Việc hôm nay'] });
      return R('Dạ, con chưa nói gì để nhắc lại ạ. {p} muốn hỏi con điều gì nào? 😊'.replace(/{p}/g, c.p),
        { chips: ['Việc hôm nay', 'Thời tiết hôm nay'] });
    }
  },
  /* 19. Gioi thieu / huong dan */
  {
    id: 'help', re: /\b(giup|huong dan|lam duoc gi|ban lam gi|co the lam gi|cach dung|dung sao|ban la ai|ten gi|tro ly)\b/,
    run: function (c) {
      return R('Dạ, con là trợ lý biết nói của AloBaMa ạ 🤖 {p} cứ bấm nút 🎤 rồi nói tự nhiên. Con giúp được: xem việc hôm nay, nhắc uống thuốc, đọc lời nhắn của con cháu, báo “tôi ổn”, nhắn tin, gọi con cháu, xem thời tiết, kể chuyện vui và mở trò chơi ạ.'.replace(/{p}/g, c.p),
        { chips: ['Việc hôm nay', 'Lời nhắn từ con cháu', 'Kể chuyện vui', 'Gọi con cháu'] });
    }
  },
  /* 20. Cam on */
  {
    id: 'thanks', re: /\b(cam on|biet on|quy qua|gioi qua|hay qua|tot qua)\b/,
    run: function (c) {
      return R(pick([
        'Dạ không có gì ạ, giúp {p} là niềm vui của con mà 😊❤️',
        'Dạ, {p} cứ gọi con bất cứ lúc nào nhé. Con luôn ở đây ạ 🥰',
        'Dạ con cảm ơn {p} đã nói chuyện với con ạ! Chúc {p} một ngày thật vui 🌷'
      ]).replace(/{p}/g, c.p), { chips: ['Kể chuyện vui', 'Báo tôi ổn'] });
    }
  },
  /* 21. Tam biet / di ngu */
  {
    id: 'bye', re: /\b(tam biet|di ngu|ngu day|bye|chao tam biet|thoi nhe)\b/,
    run: function (c) {
      return R('Dạ, {p} nghỉ ngơi nhé ạ 😴 Con vẫn ở đây, cần gì {p} cứ gọi con. Chúc {p} ngủ thật ngon và mơ đẹp ạ 🌙'.replace(/{p}/g, c.p),
        { action: { type: 'hands_off' }, chips: ['Báo tôi ổn', 'Kể chuyện vui'] });
    }
  },
  /* 22. Chao hoi */
  {
    id: 'greet', re: /\b(chao|hello|alo|con oi|ba oi|ong oi|oi con)\b/,
    run: function (c) {
      const todo = c.pending.length ? (' Hôm nay {p} còn ' + c.pending.length + ' việc cần làm ạ.') : ' Hôm nay {p} không có việc gì gấp ạ.';
      const okLine = (c.lastOkH === null || c.lastOkH > 20) ? ' {p} bấm nút TÔI ỔN để con cháu yên tâm nhé!' : '';
      return R(pick([
        'Dạ, con chào {p} ạ! 🌷 Chúc {p} ' + c.greet + ' tốt lành.',
        'Dạ con nghe {p} đây ạ! Con là trợ lý biết nói của AloBaMa 🤖',
        'Dạ, chào {p}! Hôm nay {p} thấy trong người thế nào ạ? ❤️'
      ]).replace(/{p}/g, c.p) + todo.replace(/{p}/g, c.p) + okLine.replace(/{p}/g, c.p),
        { chips: ['Việc hôm nay', 'Lời nhắn từ con cháu', 'Kể chuyện vui', 'Báo tôi ổn'] });
    }
  }
];

const FALLBACKS = [
  'Dạ, câu này con chưa hiểu rõ ạ 😅 {p} thử nói “việc hôm nay”, “nhắc uống thuốc”, “đọc lời nhắn” hay “kể chuyện vui” giúp con nhé!',
  'Dạ con nghe chưa rõ ý {p} ạ. {p} muốn con xem việc cần làm, gọi con cháu, hay kể chuyện cho vui ạ?',
  'Dạ, con còn đang học thêm mỗi ngày ạ 🌱 {p} nói lại ngắn gọn giúp con nhé, ví dụ: “mấy giờ rồi”, “gọi cho con”, “báo tôi ổn”.',
  'Dạ, con chưa chắc ý {p} ạ. Nhưng con biết chắc là con cháu rất thương {p} đó 🥰 {p} muốn con gọi các cháu không ạ?'
];

function fallback(c) {
  return R(pick(FALLBACKS).replace(/{p}/g, c.p),
    { id: 'fallback', chips: ['Việc hôm nay', 'Thuốc của tôi', 'Lời nhắn từ con cháu', 'Kể chuyện vui'] });
}

/* ---------------- TUY CHON: noi API that (OpenAI-compatible) ---------------- */
function llmAvailable() { return !!(process.env.ABM_AI_KEY || process.env.OPENAI_API_KEY); }

function llmReply(c, text) {
  return new Promise(function (resolve) {
    if (!llmAvailable()) return resolve(null);
    let url;
    try { url = new URL(process.env.ABM_AI_URL || 'https://api.openai.com/v1/chat/completions'); } catch (e) { return resolve(null); }
    const hist = (c.f.ai || []).slice(-6).map(function (m) {
      return { role: m.who === 'ai' ? 'assistant' : 'user', content: m.text };
    });
    const sys = 'Bạn là trợ lý tiếng Việt của ứng dụng AloBaMa, nói chuyện với người lớn tuổi tên ' + c.elder + '. ' +
      'Xưng "con", gọi người dùng là "' + c.p + '", luôn dạ/thưa lễ phép, câu ngắn gọn tối đa 3 câu, dễ hiểu, ấm áp. ' +
      'Không chẩn đoán bệnh, không khuyên đổi thuốc; việc khẩn cấp khuyên bấm nút KHẨN CẤP hoặc gọi 113/115. ' +
      'Bối cảnh hiện tại: ' + c.clock + ', ' + c.dateLabel + '. Việc chưa làm: ' + (remList(c.pending, 5) || 'không có') + '. ' +
      'Lời nhắn mới nhất: ' + (c.notes[0] ? c.notes[0].txt : 'không có') + '. Người thân: ' +
      (c.contacts.map(function (x) { return x.name; }).join(', ') || 'chưa có') + '. ' +
      'Giá gói: 59.000đ/tháng hoặc 600.000đ/năm, bản demo miễn phí. Không dùng markdown, không emoji quá 1 ký tự.';
    const payload = JSON.stringify({
      model: process.env.ABM_AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }].concat(hist).concat([{ role: 'user', content: String(text).slice(0, 400) }]),
      max_tokens: 260, temperature: 0.7
    });
    const req = https.request({
      hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (process.env.ABM_AI_KEY || process.env.OPENAI_API_KEY),
        'Content-Length': Buffer.byteLength(payload)
      }
    }, function (res) {
      let b = '';
      res.on('data', function (d) { b += d; if (b.length > 200000) req.destroy(); });
      res.on('end', function () {
        try {
          const j = JSON.parse(b);
          const t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          resolve(t ? String(t).trim().slice(0, 600) : null);
        } catch (e) { resolve(null); }
      });
    });
    req.setTimeout(12000, function () { req.destroy(); resolve(null); });
    req.on('error', function () { resolve(null); });
    req.end(payload);
  });
}

/* ---------------- Diem vao chinh ---------------- */
async function respond(o) {
  const c = buildCtx(o);
  const text = String(o.text || '').trim();
  const n = norm(text);
  let out = null;
  for (let i = 0; i < INTENTS.length; i++) {
    const it = INTENTS[i];
    if (it.rawNot && it.rawNot.test(text)) continue;
    if (it.re.test(n)) { out = it.run(c, text, n); out.id = it.id; break; }
  }
  if (!out) out = fallback(c);

  /* Chi dung API that khi bo may local khong hieu — lenh dieu khien van uu tien local */
  if (out.id === 'fallback' && llmAvailable()) {
    const t = await llmReply(c, text);
    if (t) out = R(t, { id: 'llm', chips: ['Việc hôm nay', 'Lời nhắn từ con cháu', 'Kể chuyện vui'] });
  }
  /* Thay {p} = cách gọi ông/bà ở MỌI câu trả lời, rồi viết hoa đầu câu */
  out.text = tidy(out.text.replace(/\{p\}/g, c.p));
  out.chips = (out.chips || []).map(function (q) { return String(q).replace(/\{p\}/g, c.p); });
  out.say = sayify(out.text);
  return out;
}

module.exports = { respond: respond, norm: norm, sayify: sayify, llmAvailable: llmAvailable };
