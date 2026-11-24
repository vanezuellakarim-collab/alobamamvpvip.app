'use strict';
/* ============================================================
   AloBaMa — tts.js : GIONG DOC TIENG VIET THAT cho tro ly AI
   ------------------------------------------------------------
   Chuoi nha cung cap:
     1. "fpt"    : FPT.AI (chinh thuc, can ABM_FPT_KEY) — nhieu giong
                   Viet: nu Bac, nu Nam, nam Bac, nam Nam...
     2. "google" : giong tieng Viet cua Google Dich — MIEN PHI,
                   khong can key, dung ngay (mac dinh).
     3. Neu mang loi -> app tu dung giong co san cua trinh duyet.
   KHONG can npm install: chi dung https/crypto co san cua Node.
   ============================================================ */

const https = require('https');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/* Giong cua FPT.AI (chi dung khi co key) */
const FPT_VOICES = [
  { id: 'banmai', label: 'Nữ Bắc (Ban Mai)' },
  { id: 'lannhi', label: 'Nữ Nam (Lan Nhi)' },
  { id: 'leminh', label: 'Nam Bắc (Lê Minh)' },
  { id: 'giahuy', label: 'Nam Nam (Gia Huy)' },
  { id: 'thuminh', label: 'Nữ Bắc (Thu Minh)' }
];
const GOOGLE_VOICE = { id: 'google-vi', label: 'Nữ Việt (mạng)' };

function fptKey() { return process.env.ABM_FPT_KEY || process.env.FPT_API_KEY || ''; }

function voices() {
  const list = [];
  if (fptKey()) FPT_VOICES.forEach(function (v) { list.push({ id: 'fpt:' + v.id, label: v.label, provider: 'fpt' }); });
  list.push({ id: GOOGLE_VOICE.id, label: GOOGLE_VOICE.label, provider: 'google' });
  return list;
}
/* Giong "fpt:*" can key; neu khong co key thi tu ve google */
function resolveVoice(id) {
  id = String(id || '');
  if (id.indexOf('fpt:') === 0 && fptKey()) return { provider: 'fpt', voice: id.slice(4) };
  return { provider: 'google', voice: 'vi' };
}

/* ---------------- Cache trong RAM ---------------- */
const CACHE = new Map();
const CACHE_MAX = 90;
function cacheGet(k) {
  const v = CACHE.get(k);
  if (v) { CACHE.delete(k); CACHE.set(k, v); }
  return v || null;
}
function cacheSet(k, buf) {
  if (!buf || !buf.length) return;
  CACHE.set(k, buf);
  while (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
}

/* ---------------- Cat cau ---------------- */
function splitText(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  if (s.length <= max) return [s];
  const sentences = s.replace(/([.!?;:])\s+/g, '$1\n').split('\n');
  const out = [];
  let cur = '';
  sentences.forEach(function (p) {
    p = p.trim(); if (!p) return;
    if ((cur + ' ' + p).trim().length <= max) { cur = (cur + ' ' + p).trim(); return; }
    if (cur) { out.push(cur); cur = ''; }
    if (p.length <= max) { cur = p; return; }
    const words = p.split(' ');
    let line = '';
    words.forEach(function (w) {
      if ((line + ' ' + w).trim().length > max) { out.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    });
    cur = line;
  });
  if (cur) out.push(cur);
  return out;
}

function httpsGetBuffer(url, headers, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const r = https.get(url, { headers: headers || { 'User-Agent': UA } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpsGetBuffer(res.headers.location, headers, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('http ' + res.statusCode)); }
      const bufs = [];
      res.on('data', function (d) { bufs.push(d); });
      res.on('end', function () { resolve(Buffer.concat(bufs)); });
    });
    r.setTimeout(timeoutMs || 12000, function () { r.destroy(new Error('timeout')); });
    r.on('error', reject);
  });
}

/* ---------------- Google Dich (giong nu Viet, mien phi) ---------------- */
async function googleSpeak(text) {
  const parts = splitText(text, 180);
  const bufs = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(p) +
      '&tl=vi&client=tw-ob&total=1&idx=0&textlen=' + p.length + '&prev=input';
    const b = await httpsGetBuffer(url, { 'User-Agent': UA, 'Referer': 'https://translate.google.com/' }, 12000);
    if (b && b.length > 400) bufs.push(b);
  }
  if (!bufs.length) throw new Error('google: khong co am thanh');
  return Buffer.concat(bufs);
}

/* ---------------- FPT.AI (chinh thuc, can key) ---------------- */
function fptRequest(text, voice, speed) {
  return new Promise(function (resolve, reject) {
    const body = Buffer.from(String(text), 'utf8');
    const r = https.request({
      hostname: 'api.fpt.ai', path: '/hmi/tts/v5', method: 'POST',
      headers: {
        'api-key': fptKey(), 'voice': voice, 'speed': String(speed),
        'format': 'mp3', 'Cache-Control': 'no-cache',
        'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length
      }
    }, function (res) {
      let b = '';
      res.on('data', function (d) { b += d; });
      res.on('end', function () {
        try {
          const j = JSON.parse(b);
          if (j && j.async) return resolve(j.async);
          reject(new Error('fpt: ' + (j && j.message ? j.message : 'khong tra ve link audio')));
        } catch (e) { reject(new Error('fpt: phan hoi khong hop le')); }
      });
    });
    r.setTimeout(12000, function () { r.destroy(new Error('fpt timeout')); });
    r.on('error', reject);
    r.end(body);
  });
}
async function fptSpeak(text, voice, rate) {
  const speed = rate === 'slow' ? -2 : rate === 'fast' ? 2 : 0;
  const parts = splitText(text, 480);
  const bufs = [];
  for (let i = 0; i < parts.length; i++) {
    const link = await fptRequest(parts[i], voice, speed);
    let audio = null;
    for (let tryN = 0; tryN < 4; tryN++) {
      await new Promise(function (r) { setTimeout(r, tryN === 0 ? 350 : 700); });
      try { audio = await httpsGetBuffer(link, { 'User-Agent': UA }, 12000); } catch (e) { audio = null; }
      if (audio && audio.length > 800) break;
    }
    if (audio && audio.length > 800) bufs.push(audio);
  }
  if (!bufs.length) throw new Error('fpt: khong tai duoc am thanh');
  return Buffer.concat(bufs);
}

/* ---------------- Diem vao chinh ---------------- */
async function synthesize(text, opts) {
  opts = opts || {};
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  if (!clean) throw new Error('Chưa có nội dung để đọc');
  const rate = ['slow', 'normal', 'fast'].indexOf(opts.rate) >= 0 ? opts.rate : 'normal';
  const picked = resolveVoice(opts.voice);
  const key = picked.provider + '|' + picked.voice + '|' + rate + '|' + clean;

  const hit = cacheGet(key);
  if (hit) return { audio: hit, provider: picked.provider, rateBaked: picked.provider === 'fpt', cached: true };

  const order = picked.provider === 'fpt' ? ['fpt', 'google'] : ['google'];
  let lastErr = null;
  for (let i = 0; i < order.length; i++) {
    const pv = order[i];
    try {
      const audio = pv === 'fpt' ? await fptSpeak(clean, picked.voice, rate) : await googleSpeak(clean);
      if (audio && audio.length > 800) {
        cacheSet(key, audio);
        /* Toc do: FPT chinh duoc tren server; Google thi de trình duyet chinh */
        return { audio: audio, provider: pv, rateBaked: pv === 'fpt', cached: false };
      }
      lastErr = new Error(pv + ': am thanh qua ngan');
    } catch (e) {
      lastErr = e;
      if (process.env.ABM_TTS_DEBUG) console.error('[TTS] ' + pv + ' loi:', e.message);
    }
  }
  throw lastErr || new Error('Không tạo được giọng đọc');
}

module.exports = {
  synthesize: synthesize,
  voices: voices,
  hasPremium: function () { return !!fptKey(); },
  splitText: splitText,
  cacheSize: function () { return CACHE.size; }
};
