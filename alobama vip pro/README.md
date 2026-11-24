# 📞 AloBaMa — MVP bản chạy thật (Node.js)

Ứng dụng kết nối **Ông/Bà** và **Con cháu**: đăng ký → nhận **2 tài khoản** → đăng nhập vai nào thấy giao diện vai đó. Server Node thuần (**không cần cài thư viện nào**), dữ liệu lưu trong `data.json`.

---

## 🆕 Bản cập nhật này có gì mới?

| # | Thay đổi |
|---|---|
| 1 | **Bỏ mục “🔔 Hoạt động gần đây”** ở giao diện **Con cháu** (gọn hơn, các mục khác giữ nguyên) |
| 2 | **Gói Năm: 500.000đ → 600.000đ** — sửa đồng bộ ở trang chủ, trang đăng ký, màn hình xác nhận, FAQ. Số tiền tiết kiệm cũng tính lại: **108.000đ** (≈ **50.000đ/tháng**) |
| 3 | **Trợ lý AI được nâng cấp thành trợ lý BIẾT NÓI** 🎤 — nghe giọng tiếng Việt, đọc câu trả lời thành tiếng, hiểu dữ liệu thật của gia đình và **thực hiện lệnh thật** (báo “tôi ổn”, gửi tin nhắn, đánh dấu xong việc, gọi con cháu, báo khẩn cấp…) |
| 4 | **Giọng đọc là GIỌNG VIỆT THẬT** 🇻🇳 — server tự lấy giọng nữ tiếng Việt tự nhiên (không cần API key), phát như file âm thanh nên **máy nào cũng nghe đúng tiếng Việt**, kể cả máy chưa cài giọng Việt. Mạng lỗi thì tự chuyển về giọng của máy. Muốn giọng nam / giọng vùng miền thì gắn key FPT.AI |

---

## 🛠️ KHÔNG CHẠY ĐƯỢC? Xem đây trước!

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Gõ `node server.js` báo **"'node' is not recognized..."** | Chưa cài Node.js | Tải bản **LTS** tại [nodejs.org](https://nodejs.org) → cài xong **đóng & mở lại terminal** → chạy lại |
| Nhấn đúp `run.bat` cửa sổ đóng ngay | Lỗi hiển thị trước khi đọc được | Chạy lại `run.bat` — bản mới có `pause`, hiện rõ lỗi. Hoặc mở CMD tại thư mục → gõ `node server.js` xem lỗi |
| **"Cannot find module .../server.js"** | Đứng sai thư mục | Phải `cd` vào thư mục **chứa file server.js** (thư mục `alobama`, không phải `alobama/alobama`) |
| Mở browser **"Không thể truy cập trang web này"** | Server chưa chạy hoặc tắt rồi | Phải để cửa sổ terminal **đang chạy** `node server.js` rồi mới mở http://localhost:3000 |
| Mở file `index.html` trực tiếp (đúp chuột) | App cần server, mở trực tiếp sẽ lỗi | Không mở file trực tiếp — chạy `node server.js` trước |
| Đăng ký xong bị **quay lại trang đăng nhập** | Cookie bị chặn (đã vá) | Đã vá bản mới — nếu vẫn gặp, thử trình duyệt khác hoặc tắt "Chặn cookie của bên thứ 3" |
| Port **3000 bị chiếm** (EADDRINUSE) | App khác đang dùng cổng | Chạy cổng khác: `set PORT=3001 && node server.js` (Windows) / `PORT=3001 node server.js` (Mac) |
| Đang xem qua **preview trong chat**, tắt server | Process không sống mãi | Nhắn "chạy lại server" là được |

**Chạy nhanh nhất: nhấn đúp `run.bat` (Windows) hoặc `./run.sh` (Mac/Linux).**

---

## 🚀 Cách chạy (2 bước)

**Cần có Node.js ≥ 16** ([tải tại nodejs.org](https://nodejs.org) — chọn bản LTS).

```bash
# 1. Mở terminal (CMD / PowerShell / Terminal của VS Code) tại thư mục alobama
cd alobama

# 2. Chạy server
node server.js
```

Mở trình duyệt: **http://localhost:3000**

> Xong! Không cần `npm install` gì cả. Muốn đổi cổng: `set PORT=8080 && node server.js` (Windows) hoặc `PORT=8080 node server.js` (Mac/Linux).

## 💻 Chạy bằng VS Code

1. Mở VS Code → **File → Open Folder…** → chọn thư mục `alobama`
2. Mở terminal trong VS Code: **View → Terminal** (hoặc `Ctrl + ~`)
3. Gõ `node server.js` → nhấn Enter
4. `Ctrl + Click` vào link `http://localhost:3000` trong terminal
## 👀 Demo cho giám khảo

| Cách | Cách làm |
|---|---|
| **1 máy** | Đăng ký → vào app Con cháu → bấm nút 🔄 (Đổi vai) trên thanh trên để nhảy qua lại giữa 2 giao diện |
| **2 thiết bị (đẹp nhất!)** | Máy tính đăng nhập `demo / 1234` (Con cháu) · Điện thoại **cùng wifi** đăng nhập `ongba1234 / 1234` (Ông/Bà) → bấm **TÔI ỔN** trên điện thoại → máy tính nhận thông báo **ngay lập tức** |
| **Điện thoại cùng wifi** | Xem IP máy tính (`ipconfig` trên Windows / `ifconfig` trên Mac), điện thoại mở `http://192.168.x.x:3000` |

**Tài khoản demo có sẵn:** `demo / 1234` (Con cháu) · `ongba1234 / 1234` (Ông/Bà)

## 🔁 Luồng chính của app

1. **Đăng ký** (`/register`): nhập tên, SĐT, tên ông bà, chọn gói (**59.000đ/tháng** hoặc **600.000đ/năm**) → hệ thống cấp 2 tài khoản (bản MVP **chưa thu tiền**)
2. **Đăng nhập** (`/login`): vào tài khoản nào → giao diện vai đó
   - **Con cháu**: xem vị trí, gửi ghi chú, đặt nhắc lịch, gọi, nhắn tin, nhận cảnh báo SOS
   - **Ông/Bà**: nút **TÔI ỔN** khổng lồ, lời nhắn từ con cháu, việc cần làm, gọi/nhắn (có **nói để nhắn tin**), **trợ lý AI biết nói**, **cờ tướng** + **ghép đôi**, nút **KHẨN CẤP**
3. Hai bên **tự đồng bộ** (poll 4 giây) — sự kiện bên này hiện ngay bên kia

## 📁 Cấu trúc thư mục

```
alobama/
├── server.js          # Server Node (API + đăng nhập + phục vụ trang)
├── ai.js              # 🆕 Bộ não trợ lý tiếng Việt (hiểu ý + thực hiện lệnh)
├── data.json          # "Database" — tự tạo khi chạy lần đầu
├── package.json
└── public/
    ├── index.html     # Landing page (Hero, Lợi ích, Tính năng, Giá, CTA, FAQ)
    ├── register.html  # Đăng ký → nhận 2 tài khoản
    ├── login.html     # Đăng nhập
    ├── ongba.html     # App bên Ông/Bà
    ├── conchau.html   # App bên Con cháu
    ├── css/style.css
    └── js/ (common.js · voice.js 🆕 · auth.js · ongba.js · conchau.js)
```

## 🌐 Đưa lên web miễn phí

| Nền tảng | Cách |
|---|---|
| **Render** ([render.com](https://render.com)) | New → Web Service → kết nối GitHub repo → Start command: `node server.js` — free tier |
| **Railway** ([railway.app](https://railway.app)) | New Project → Deploy from GitHub |
| **Glitch** ([glitch.com](https://glitch.com)) | New Project → Import từ GitHub — chạy `node server.js` |

> Lưu ý: `data.json` lưu trên đĩa của nền tảng — một số free tier reset định kỳ (dữ liệu demo mất là bình thường). Muốn dữ liệu bền hơn thì chuyển sang SQLite/Postgres ở bước tiếp theo.

## ⚠️ Ghi chú bản demo

- Mật khẩu mã hóa SHA-256 + salt — **chỉ dùng demo, chưa phải chuẩn bảo mật production**
- Bản đồ, vị trí, cuộc gọi và thời tiết là **dữ liệu mô phỏng**. Trợ lý AI là **bộ hiểu tiếng Việt chạy thật trong app** (không gọi dịch vụ ngoài, trừ khi bạn gắn API key — xem mục dưới)
- Thanh toán **chưa kích hoạt** (theo đúng MVP) — hiển thị giá 59k/tháng · 600k/năm


---

# 🎤 Trợ lý AI BIẾT NÓI — hướng dẫn chi tiết

## Cách dùng (bên Ông/Bà)

1. Đăng nhập `ongba1234 / 1234` → bấm ô **🤖 Trợ lý AI**
2. Bấm nút **🎤 BẤM ĐỂ NÓI** (nút to nhất màn hình) → nói tiếng Việt tự nhiên
3. Trợ lý **hiện chữ to + đọc thành tiếng** câu trả lời. Nói xong ngừng một lát là trợ lý tự trả lời.

| Nút | Tác dụng |
|---|---|
| 🎤 **BẤM ĐỂ NÓI** | Nghe giọng nói. Đang nghe mà bấm lại thì dừng & gửi câu vừa nói |
| 🔊 **Giọng đọc: BẬT/TẮT** | Bật/tắt việc trợ lý đọc thành tiếng |
| 🎙 **Giọng: Nữ Việt** | Đổi giọng đọc: **Nữ Việt (mạng)** ⇄ **Giọng của máy**. Bấm là nghe thử ngay câu “Dạ, con chào bà ạ…” |
| 🗣 **Rảnh tay** | Nghe → trả lời → **tự nghe tiếp**, không cần chạm máy. Nói **“dừng lại”** để tắt |
| 🔁 **Nghe lại** | Đọc lại câu trả lời gần nhất (mỗi bong bóng chat cũng có nút nghe lại riêng) |
| 🙂 **Tốc độ** | Đổi 🐢 Chậm / 🙂 Vừa / 🐇 Nhanh — lưu lại cho lần sau |
| 🧹 **Xóa** | Xóa hội thoại với trợ lý |
| ⌨️ **Ô gõ chữ** | Máy không có micro vẫn dùng được bình thường |

## Nói gì cũng hiểu — ví dụ lệnh thật

| Ông/bà nói | Trợ lý làm |
|---|---|
| “Hôm nay tôi có việc gì?” | Đọc **đúng lịch nhắc** con cháu đã đặt (giờ + việc) |
| “Nhắc tôi uống thuốc” | Đọc các cữ thuốc **chưa uống** |
| “Tôi uống thuốc rồi” | **Đánh dấu xong việc** thật, đồng bộ sang máy con cháu |
| “Đọc lời nhắn của con cháu” | Đọc **lời nhắn thật** mới nhất |
| “Nhắn cho con là tối nay bà khỏe” | **Gửi tin nhắn thật** vào hộp thư con cháu |
| “Gọi cho Minh” | **Nối máy** tới đúng người thân |
| “Tôi ổn” | **Báo “Tôi ổn”** cho con cháu kèm giờ chính xác |
| “Cứu bà với” / “bà bị ngã” | **Bắn cảnh báo KHẨN CẤP** + nhắc gọi 113/115 |
| “Bật / tắt chia sẻ vị trí” | Bật/tắt quyền riêng tư vị trí (quyền vẫn thuộc về ông/bà) |
| “Mấy giờ rồi”, “thời tiết hôm nay” | Trả lời theo giờ máy + thời tiết (mô phỏng) |
| “Kể chuyện vui”, “đọc câu ca dao” | Kể chuyện cười / ca dao / chuyện xưa |
| “Chơi cờ tướng” | Mở thẳng mục trò chơi |
| “Nói chậm lại”, “nhắc lại” | Đổi tốc độ đọc / đọc lại câu vừa nói |
| “Gói năm giá bao nhiêu?” | 59.000đ/tháng · **600.000đ/năm** (demo miễn phí) |

Hiểu cả **không dấu** (“hom nay toi co viec gi”), tự đổi cách gọi **ông/bà** theo tên đã đăng ký, và luôn dạ–thưa lễ phép.

## 🔧 Kỹ thuật (cho dev)

- `ai.js` — bộ hiểu ý (intent) tiếng Việt: chuẩn hoá bỏ dấu, ~22 nhóm ý định, đọc ngữ cảnh gia đình (lịch nhắc, lời nhắn, tin nhắn, giờ “tôi ổn”, danh bạ) rồi sinh câu trả lời + **action**.
- `POST /api/ai` `{ text, tz, voice }` → thực hiện action trên server (nên **đồng bộ sang máy con cháu**), lưu hội thoại vào `data.json` (`f.ai`, giữ 40 tin), trả `{ reply, ...state }`.
- `POST /api/ai/clear` → xóa hội thoại.
- `public/js/voice.js` — `ABMVoice`: `listen()` dùng `SpeechRecognition` (`vi-VN`); `speak()` **ưu tiên giọng Việt lấy từ server** (`/api/tts` → blob → thẻ audio), lỗi mạng thì tự dùng `speechSynthesis` của máy. Có mở khoá audio cho iOS, bộ nhớ đệm âm thanh (bấm “Nghe lại” là phát tức thì), chỉnh tốc độ bằng `playbackRate` giữ nguyên cao độ.
- `tts.js` + `GET /api/tts?text=…&rate=…&voice=…` — sinh **giọng nữ tiếng Việt thật** rồi trả về `audio/mpeg`; `GET /api/tts/voices` trả danh sách giọng cho giao diện. Có cache trong RAM (90 câu) nên câu hỏi lặp lại không phải tải lại.

### 🇻🇩 Giọng đọc tiếng Việt — cách hoạt động

| Thứ tự | Nguồn giọng | Cần gì |
|---|---|---|
| 1 | **FPT.AI** (nếu có `ABM_FPT_KEY`) — giọng nữ Bắc, nữ Nam, nam Bắc, nam Nam… | API key FPT.AI (có gói miễn phí) |
| 2 | **Giọng tiếng Việt của Google Dịch** — mặc định, **không cần key** | Server có internet |
| 3 | **Giọng của máy** (`speechSynthesis`) — dùng khi mạng lỗi hoặc người dùng chọn | Máy có cài giọng Việt thì nghe hay hơn |

```bash
# Mặc định: giọng nữ Việt, không cần cấu hình gì
node server.js

# Muốn giọng nam / giọng vùng miền (FPT.AI):
ABM_FPT_KEY=xxxx node server.js          # Mac/Linux
set ABM_FPT_KEY=xxxx && node server.js   # Windows
```

> Giọng lấy từ mạng cần **server có internet**. Máy người dùng không cần cài giọng Việt nữa vì âm thanh đã được dựng sẵn trên server. Nguồn Google Dịch là endpoint không chính thức, chỉ nên dùng cho bản demo — khi làm sản phẩm thật hãy gắn key FPT.AI / Viettel AI / Azure để có giọng chính thức và ổn định lâu dài.
- **Tùy chọn gắn AI thật**: đặt biến môi trường rồi chạy lại server — khi bộ máy trong app không hiểu câu hỏi, nó sẽ hỏi model thật:
  ```bash
  ABM_AI_KEY=sk-... ABM_AI_MODEL=gpt-4o-mini node server.js
  ```
  Hỗ trợ endpoint OpenAI-compatible qua `ABM_AI_URL`. Không có key thì app **vẫn chạy đầy đủ** bằng bộ hiểu tiếng Việt sẵn có. Lệnh điều khiển (báo ổn, gửi tin, khẩn cấp…) luôn do bộ máy trong app xử lý để bảo đảm an toàn & tức thì.

## ⚠️ Micro không nghe được? Xem đây

| Triệu chứng | Cách xử lý |
|---|---|
| Bấm 🎤 báo “chưa cho phép dùng micro” | Bấm ổ khóa 🔒 trên thanh địa chỉ → **Micro → Cho phép** → tải lại trang |
| Đang xem trong **khung preview của chat** | Khung xem trước thường chặn micro. Bấm **“↗ Mở app ở tab riêng”** trong app, hoặc mở thẳng link bằng tab mới |
| Dùng **Firefox** | Firefox chưa hỗ trợ nhận giọng nói → vẫn gõ chữ được, trợ lý vẫn đọc trả lời. Muốn nói thì dùng **Chrome / Edge / Safari** |
| Mở bằng `http://192.168.x.x:3000` (điện thoại cùng wifi) | Trình duyệt chỉ cho micro ở **https** hoặc **localhost**. Trên điện thoại: dùng link https (deploy Render/Railway) hoặc cắm cáp chạy localhost |
| Trợ lý đọc giọng “lạ”, không giống tiếng Việt | Bấm nút **🎙 Giọng** để chọn lại **Nữ Việt (mạng)**. Nếu đang ở “Giọng của máy” mà máy chưa cài giọng Việt thì sẽ nghe rất “tây” — chọn giọng mạng là hết |
| Bấm 🎙 mà nghe vẫn như cũ | Kiểm tra server có internet không (giọng mạng do server tải). Xem log server, hoặc chạy `ABM_TTS_DEBUG=1 node server.js` để thấy lỗi |
| Câu đầu tiên hơi chậm (~1 giây) | Bình thường: server đang dựng giọng. Các câu sau đã có cache nên nhanh hơn |
| Nói mà không thấy chữ hiện | Kiểm tra mạng (phần nhận giọng cần internet), nói to và gần micro, thử lại |
