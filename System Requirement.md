# System Requirement Document — Game Online UNO

|||
|-|-|
|**Versi Dokumen**|1.0|
|**Tanggal**|12 Juni 2026|
|**Target Rilis**|v0.1 (MVP — Mode Standard)|
|**Frontend**|Vercel|
|**Backend**|Railway|

\---

## 1\. Ringkasan Eksekutif

Game kartu online multiplayer realtime berbasis web dengan mekanik permainan UNO standar, mendukung **lebih dari 4 pemain dalam satu ruangan** (target: 2–10 pemain di v0.1, dapat diskalakan hingga 16+ pemain dengan multi-dek). Frontend di-deploy ke **Vercel**, backend (server otoritatif + WebSocket) di-deploy ke **Railway**. Arsitektur dirancang **modular sejak v0.1** agar mode permainan lain (Flip, No Mercy, Jump-In, Speed, house rules 7-0/stacking) dapat ditambahkan tanpa menulis ulang inti sistem. Seluruh ilustrasi kartu, nama produk, dan identitas visual **harus original** (lihat §2 — Catatan Legal).

\---

## 3\. Tujuan \& Sasaran

### 3.1 Tujuan v0.1 (MVP)

1. Permainan mode standar yang lengkap dan benar secara aturan, dimainkan 2–10 pemain dalam satu ruangan via browser.
2. Server otoritatif penuh — klien tidak pernah memegang informasi rahasia (kartu pemain lain, urutan dek).
3. Pengalaman bermain lancar: latensi aksi < 300 ms (p95), reconnect otomatis saat koneksi putus.
4. Identitas visual original dengan ilustrasi kartu yang menarik.

### 3.2 Sasaran Jangka Panjang (v0.2+)

* Mode permainan tambahan via arsitektur *rules engine* yang pluggable.
* Akun pemain, statistik, leaderboard, matchmaking publik.
* Dukungan >10 pemain dengan penskalaan multi-dek otomatis.

### 3.3 Di Luar Cakupan v0.1 (Non-Goals)

* Aplikasi mobile native (web responsif sudah mencukupi).
* Bot/AI pemain.
* Voice/video chat.
* Monetisasi, kosmetik berbayar.
* Ranked matchmaking.

\---

## 4\. Aturan Permainan — Mode Standard (v0.1)

Berdasarkan aturan UNO klasik resmi (2–10 pemain, dek 108 kartu).

### 4.1 Komposisi Dek (108 kartu)

|Kartu|Jumlah|Rincian|
|-|-|-|
|Angka 0|4|1 per warna (merah, kuning, hijau, biru)|
|Angka 1–9|72|2 per angka per warna|
|Skip (Lewati)|8|2 per warna|
|Reverse (Balik Arah)|8|2 per warna|
|Draw Two (+2)|8|2 per warna|
|Wild (Ganti Warna)|4|tanpa warna|
|Wild Draw Four (+4)|4|tanpa warna|

### 4.2 Alur Permainan

1. **Setup**: setiap pemain mendapat 7 kartu; 1 kartu dibuka sebagai awal *discard pile*. Jika kartu pembuka adalah kartu aksi, efeknya berlaku sesuai aturan resmi (Wild Draw Four pembuka dikocok ulang).
2. **Giliran**: pemain memainkan kartu yang cocok warna, angka, atau simbol dengan kartu teratas discard pile, ATAU memainkan Wild/Wild+4, ATAU menarik 1 kartu dari dek (kartu hasil tarikan boleh langsung dimainkan jika valid; jika tidak, giliran berlanjut).
3. **Efek kartu aksi**: Skip melewati 1 pemain; Reverse membalik arah putaran (pada 2 pemain berfungsi sebagai Skip); +2 memaksa pemain berikut menarik 2 kartu dan kehilangan giliran; Wild memilih warna; Wild+4 memilih warna dan memaksa pemain berikut menarik 4 kartu + kehilangan giliran.
4. **Tantangan Wild+4**: pemain yang terkena +4 boleh menantang. Jika pelempar terbukti punya kartu warna yang cocok, pelempar menarik 4 kartu; jika tantangan gagal, penantang menarik 6 kartu. (Server dapat memverifikasi karena otoritatif.)
5. **Panggilan "Satu!"**: saat tersisa 1 kartu, pemain wajib menekan tombol panggilan dalam jendela waktu tertentu (default 3 detik setelah memainkan kartu kedua-terakhir). Pemain lain dapat menekan tombol "Tangkap!" — jika pemain lupa dan tertangkap, penalti tarik 2 kartu.
6. **Dek habis**: discard pile (kecuali kartu teratas) dikocok ulang menjadi dek baru.
7. **Akhir ronde**: pemain pertama yang kehabisan kartu memenangkan ronde. Skor dihitung dari kartu sisa lawan (angka = nilai nominal; Skip/Reverse/+2 = 20; Wild/Wild+4 = 50).
8. **Akhir permainan**: konfigurasi per ruangan — (a) satu ronde selesai, atau (b) pemain pertama yang mencapai 500 poin (mode akumulasi resmi).

### 4.3 Penanganan >4 Pemain

* **5–10 pemain**: dek tunggal 108 kartu (sesuai batas resmi UNO).
* **11–16 pemain (v0.2+)**: dek digandakan otomatis (216 kartu) — penskalaan multi-dek adalah pendekatan yang lazim untuk grup besar karena aturan resmi berhenti di 10 pemain.
* **Timer giliran wajib** (default 30 detik, dapat dikonfigurasi 15–60 detik) untuk mencegah permainan menjadi lambat pada jumlah pemain besar; saat timer habis, server otomatis menarik 1 kartu untuk pemain tersebut dan melanjutkan giliran.
* Pemain ke-2 dst. yang AFK 3 giliran berturut-turut otomatis diubah menjadi *spectator* dan kartunya dikembalikan ke dek (dikocok).

\---

## 5\. Kebutuhan Fungsional

### 5.1 Manajemen Ruangan (Room/Lobby)

|ID|Kebutuhan|Prioritas|
|-|-|-|
|F-01|Pemain dapat membuat ruangan privat dengan kode 6 karakter yang dapat dibagikan (link join langsung).|Wajib|
|F-02|Pemain bergabung via kode/link tanpa registrasi — cukup nickname + avatar pilihan.|Wajib|
|F-03|Host dapat mengatur: jumlah maksimal pemain (2–10), timer giliran, target skor (1 ronde / 500 poin), dan toggle house rules (disiapkan untuk v0.2).|Wajib|
|F-04|Host dapat mengeluarkan (kick) pemain dari lobby.|Wajib|
|F-05|Lobby menampilkan daftar pemain realtime + status siap (ready check).|Wajib|
|F-06|Migrasi host otomatis jika host keluar.|Wajib|
|F-07|Daftar ruangan publik + quick join.|v0.2|

### 5.2 Gameplay

|ID|Kebutuhan|Prioritas|
|-|-|-|
|F-10|Implementasi lengkap aturan §4 dengan validasi 100% di server.|Wajib|
|F-11|Klien hanya menerima: kartu di tangannya sendiri, jumlah kartu lawan, kartu teratas discard pile, warna aktif, arah putaran, giliran aktif.|Wajib|
|F-12|Animasi kartu (main, tarik, shuffle) dan indikator giliran yang jelas.|Wajib|
|F-13|Tombol panggilan "Satu!" dan tombol tangkap pemain yang lupa.|Wajib|
|F-14|Tantangan Wild+4 dengan dialog konfirmasi berbatas waktu.|Wajib|
|F-15|Reconnect: pemain yang terputus dapat kembali ke ruangan dalam ≤ 60 detik dan menerima snapshot state penuh; selama terputus, timer giliran tetap berjalan.|Wajib|
|F-16|Papan skor antar-ronde dan layar kemenangan.|Wajib|
|F-17|Emote/quick chat (preset, bukan free text — mengurangi kebutuhan moderasi).|Sebaiknya|
|F-18|Spectator mode (menonton tanpa melihat kartu siapa pun).|v0.2|
|F-19|Riwayat aksi (game log) di sisi UI.|Sebaiknya|

### 5.3 Ekstensibilitas Mode Permainan (kebutuhan arsitektural v0.1)

|ID|Kebutuhan|Prioritas|
|-|-|-|
|F-30|Logika permainan diimplementasikan sebagai **rules engine modular**: definisi dek, validasi langkah, efek kartu, dan kondisi menang dipisahkan dalam interface `GameMode` (lihat §8.3). Mode `standard` adalah implementasi pertama.|Wajib|
|F-31|Konfigurasi ruangan menyimpan `modeId` + `modeOptions` (JSON) sehingga mode baru tidak mengubah skema data.|Wajib|
|F-32|Protokol WebSocket bersifat mode-agnostik: event generik (`playCard`, `drawCard`, `declareColor`, `callOut`, dst.) + payload yang divalidasi per mode.|Wajib|

Mode kandidat masa depan (referensi desain, BUKAN cakupan v0.1): **Jump-In** (mainkan kartu identik di luar giliran), **Seven-Zero** (7 = tukar tangan, 0 = rotasi tangan), **Stacking** (+2/+4 bertumpuk), **Speed**, **No Mercy-like** (kartu aksi ekstrem + eliminasi), **Flip-like** (dek dua sisi). Semua harus dapat diekspresikan melalui interface `GameMode` tanpa menyentuh kode transport/lobby.

\---

## 6\. Kebutuhan Non-Fungsional

|Kategori|Kebutuhan|
|-|-|
|**Latensi**|Aksi pemain → update di semua klien: < 300 ms p95 (region yang sama dengan server). Server Railway dipilih region terdekat dengan mayoritas pemain (mis. `asia-southeast1` Singapura untuk pemain Indonesia).|
|**Kapasitas v0.1**|≥ 100 ruangan bersamaan (≈ 500–1.000 koneksi WebSocket) pada 1 instance Railway 512 MB–1 GB RAM. Riset menunjukkan server murah sanggup \~3.000 koneksi untuk game kartu turn-based.|
|**Keamanan**|(a) Server otoritatif — semua langkah divalidasi server; (b) dek dikocok dengan CSPRNG (`crypto.randomInt`, algoritma Fisher–Yates); (c) rate limiting per koneksi; (d) validasi \& sanitasi semua payload (zod/valibot); (e) CORS dibatasi ke domain Vercel produksi + preview; (f) WSS (TLS) wajib — otomatis di Railway.|
|**Anti-cheat**|Tidak ada state rahasia di klien (F-11). ID kartu di payload klien diverifikasi terhadap tangan pemain di server. Timestamp aksi dari server, bukan klien.|
|**Reliabilitas**|Graceful shutdown saat redeploy Railway: server menolak ruangan baru, menunggu ronde aktif selesai (maks. 5 menit) atau menyimpan snapshot state ke Redis untuk pemulihan. Health check endpoint `/healthz`.|
|**Ketersediaan**|Target 99% (hobby-tier realistis). Railway restart otomatis on-crash.|
|**Responsivitas UI**|Mobile-first; layak dimainkan di layar 360 px; landscape \& portrait. Lighthouse Performance ≥ 85.|
|**Aksesibilitas**|Simbol unik per warna kartu (bukan warna saja) untuk pemain buta warna; mode high-contrast; navigasi keyboard dasar.|
|**i18n**|Struktur string terpusat; v0.1 mendukung Bahasa Indonesia + Inggris.|
|**Observabilitas**|Log terstruktur (pino), error tracking (Sentry free tier), metrik dasar Railway (CPU/RAM/egress).|

\---

## 7\. Arsitektur Sistem

### 7.1 Diagram Tingkat Tinggi

```
┌────────────────────────┐         HTTPS (assets, pages)
│  Browser (Pemain 1..N) │◄───────────────────────────────┐
└──────────┬─────────────┘                                │
           │ WSS (Socket.IO / WebSocket)        ┌─────────┴─────────┐
           ▼                                    │  VERCEL           │
┌─────────────────────────────────┐             │  Next.js Frontend │
│  RAILWAY                        │             │  (static + SSR)   │
│  ┌───────────────────────────┐  │             └───────────────────┘
│  │ Node.js Game Server       │  │
│  │ - Lobby \& Room Manager    │  │
│  │ - Rules Engine (GameMode) │  │
│  │ - Turn/Timer Scheduler    │  │
│  └─────────────┬─────────────┘  │
│                │ (opsional v0.2)│
│  ┌─────────────▼─────────────┐  │
│  │ Redis (state snapshot,    │  │
│  │ scale-out adapter)        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ PostgreSQL (v0.2: akun,   │  │
│  │ statistik, riwayat match) │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Keputusan kunci (hasil riset):** Vercel Serverless/Fluid Functions **tidak dapat meng-host koneksi WebSocket** karena fungsinya stateless dan berumur pendek — solusi yang direkomendasikan Vercel sendiri adalah meng-host server WebSocket di platform terpisah dengan proses persisten. Karena itu seluruh logika realtime berada di Railway (container persisten, dukungan WebSocket otomatis), dan Vercel murni melayani frontend.

### 7.2 Alasan Pemilihan Platform

|Platform|Peran|Alasan|
|-|-|-|
|**Vercel**|Frontend Next.js|CDN global, preview deployment per-PR, gratis untuk hobby. Tidak ada kebutuhan API realtime di sisi Vercel.|
|**Railway**|Backend WebSocket|Proses long-running, WebSocket out-of-the-box, deploy dari GitHub, TLS otomatis, harga berbasis pemakaian (estimasi v0.1: \~$5–10/bln pada plan Hobby — 0.5 vCPU + 512 MB ≈ $5/bln + egress $0.10/GB).|

### 7.3 Pilihan Framework Realtime

|Opsi|Kelebihan|Kekurangan|Putusan|
|-|-|-|-|
|**Colyseus** (direkomendasikan)|Room \& matchmaking bawaan, sinkronisasi state otomatis dengan delta-patch (`@colyseus/schema`), filter visibilitas per-klien (`@filter` — cocok untuk kartu rahasia), reconnect bawaan, bahkan punya demo resmi game kartu bergaya UNO turn-based.|Kurva belajar schema; komunitas lebih kecil dari Socket.IO.|✅ **Dipakai v0.1**|
|Socket.IO|Komunitas sangat besar, fleksibel.|Harus membangun sendiri room lifecycle, state sync, reconnect-with-state, matchmaking — semuanya sudah disediakan Colyseus.|Cadangan|
|Nakama / managed (Ably, dsb.)|Fitur lengkap.|Overkill / biaya / lock-in untuk skala v0.1.|Tidak|

Jika tim lebih nyaman dengan Socket.IO, arsitektur tetap valid — interface `GameMode` (§8.3) tidak bergantung pada transport.

\---

## 8\. Spesifikasi Backend (Railway)

### 8.1 Tech Stack

|Komponen|Teknologi|
|-|-|
|Runtime|Node.js 22 LTS, TypeScript (strict)|
|Framework realtime|Colyseus 0.16+ (di atas `ws`)|
|HTTP (health, REST kecil)|Express / Hono (dibundel Colyseus)|
|Validasi|zod|
|RNG|`node:crypto` (Fisher–Yates shuffle)|
|Logging|pino|
|Test|Vitest (unit rules engine), `@colyseus/testing` (integrasi room)|
|Persistensi v0.1|In-memory (state ruangan ephemeral)|
|Persistensi v0.2|Redis (Railway plugin) untuk snapshot/scale-out; PostgreSQL untuk akun/statistik|

### 8.2 Struktur Modul

```
server/
├── src/
│   ├── index.ts                 # bootstrap, health check, graceful shutdown
│   ├── rooms/
│   │   ├── GameRoom.ts          # lifecycle Colyseus: join/leave/reconnect/dispose
│   │   └── LobbyRoom.ts         # daftar ruangan publik (v0.2)
│   ├── engine/                  # ← INTI: bebas dependensi transport
│   │   ├── GameMode.ts          # interface mode (lihat 8.3)
│   │   ├── modes/
│   │   │   └── standard/
│   │   │       ├── StandardMode.ts
│   │   │       ├── deck.ts      # komposisi 108 kartu, multi-dek scaling
│   │   │       └── effects.ts   # skip/reverse/draw/wild/challenge
│   │   ├── state/               # skema state (tangan, pile, giliran, skor)
│   │   └── timers.ts            # turn timer, callout window
│   └── shared/                  # tipe \& konstanta yang di-share ke frontend (package)
└── test/
```

### 8.3 Interface `GameMode` (kontrak ekstensibilitas)

```ts
interface GameMode {
  id: string;                                  // "standard", "sevenzero", ...
  buildDeck(playerCount: number): Card\[];      // termasuk aturan multi-dek
  initialHandSize: number;
  isPlayable(card: Card, ctx: TurnContext): boolean;
  applyEffect(card: Card, ctx: TurnContext): StateMutation\[];
  onTurnTimeout(ctx: TurnContext): StateMutation\[];
  checkRoundEnd(state: GameState): RoundResult | null;
  scoreHand(hand: Card\[]): number;
  allowedOutOfTurnActions(ctx: TurnContext): ActionType\[]; // utk Jump-In/Speed kelak
}
```

Mode baru = satu folder baru di `engine/modes/` + registrasi di registry. Tidak ada perubahan di transport, lobby, maupun frontend generik.

### 8.4 Kontrak Event WebSocket (ringkasan)

**Klien → Server:** `room.create`, `room.join {code, nickname, avatar}`, `room.ready`, `room.updateSettings` (host), `room.kick` (host), `game.start` (host), `game.playCard {cardId, declaredColor?}`, `game.drawCard`, `game.playDrawn {play: boolean}`, `game.callOut {targetId?}` (panggil "Satu!" / tangkap), `game.challenge {accept: boolean}`, `chat.emote {emoteId}`.

**Server → Klien:** `room.state` (lobby snapshot), `game.state` (delta-patch; tangan sendiri full, lawan hanya `cardCount`), `game.turn {playerId, deadline}`, `game.event` (log aksi untuk animasi: cardPlayed, cardDrawn{count}, reversed, skipped, colorDeclared, calledOut, challenged, roundEnd, gameEnd), `error {code, message}`.

Semua pesan diberi `seq` monotonic per ruangan untuk deteksi out-of-order di klien.

### 8.5 Konfigurasi Deploy Railway

* Deploy dari GitHub repo (monorepo: root directory `server/`), builder Nixpacks/Dockerfile.
* Env vars: `PORT` (disediakan Railway), `CORS\_ORIGINS`, `NODE\_ENV`, `SENTRY\_DSN`, `MAX\_ROOMS`, `TURN\_TIMEOUT\_DEFAULT`.
* Region: Southeast Asia (Singapura) — terdekat ke pemain Indonesia.
* Custom domain opsional (`api.namagame.com`) atau default `\*.up.railway.app`; TLS/WSS otomatis.
* Health check path `/healthz`; restart policy on-failure.
* **Scaling v0.1: vertikal saja (1 instance).** Sticky session tidak menjadi masalah pada 1 instance; scale-out horizontal (v0.3) membutuhkan Redis presence/driver Colyseus.

\---

## 9\. Spesifikasi Frontend (Vercel)

### 9.1 Tech Stack

|Komponen|Teknologi|
|-|-|
|Framework|Next.js 15+ (App Router) — landing \& halaman statis di-prerender; halaman game adalah client component|
|Bahasa|TypeScript (strict), share package `shared/` dengan server|
|State|Zustand (state UI) + colyseus.js client (state server, read-only mirror)|
|Styling|Tailwind CSS|
|Animasi|Framer Motion (kartu terbang, flip, shuffle, indikator giliran)|
|Audio|Howler.js — SFX kartu, notifikasi giliran (dengan mute toggle)|
|i18n|next-intl (id, en)|
|Test|Vitest + React Testing Library; Playwright untuk smoke E2E (2 browser bermain 1 ronde)|

### 9.2 Halaman \& Komponen Utama

|Route|Isi|
|-|-|
|`/`|Landing: buat ruangan / masukkan kode, pilih nickname \& avatar|
|`/room/\[code]`|Lobby (daftar pemain, settings host, ready check) → bertransisi ke papan permainan|
|Papan permainan|Tata letak radial: lawan tersusun melingkar (mendukung 2–10 kursi secara dinamis), discard pile + dek di tengah, tangan sendiri kipas di bawah, tombol "Satu!", timer ring per avatar, log aksi, papan skor overlay|
|`/rules`|Aturan main (ditulis ulang, original)|

### 9.3 Kebutuhan UX Khusus Banyak Pemain

* Layout kursi dinamis: algoritma penempatan melingkar yang tetap terbaca pada 10 pemain di layar ponsel (avatar + jumlah kartu + indikator giliran; bukan render kartu lawan).
* Highlight giliran aktif yang sangat jelas + countdown visual; notifikasi suara/vibrasi saat giliran tiba (penting karena antrean panjang di ruangan besar).
* Optimistic UI hanya untuk hover/seleksi; aksi kartu menunggu konfirmasi server (≤300 ms, ditutupi animasi).

### 9.4 Konfigurasi Deploy Vercel

* Root directory `web/` (monorepo), framework preset Next.js.
* Env vars: `NEXT\_PUBLIC\_GAME\_SERVER\_URL` (`wss://api.namagame.com`), `NEXT\_PUBLIC\_SENTRY\_DSN`.
* Preview deployment per-PR; `CORS\_ORIGINS` server menyertakan wildcard domain preview (`https://\*-project.vercel.app`) untuk staging.
* Asset kartu dilayani dari `/public` via CDN Vercel (immutable cache, hashed filename).

\---

## 10\. Kebutuhan Aset \& Ilustrasi Kartu (Original)

### 10.1 Prinsip Desain

1. **Original \& berjarak dari trade dress Mattel**: hindari oval putih besar khas UNO; eksplorasi arah visual sendiri (mis. flat-illustration dengan karakter/maskot per warna, gaya art-deco, atau motif Nusantara — diputuskan di fase desain).
2. **Keterbacaan adalah raja**: nilai kartu terbaca pada render \~60 px lebar di ponsel; indeks angka/simbol di dua sudut kartu.
3. **Aksesibilitas**: setiap warna memiliki **ikon/pattern unik** (mis. merah=api, biru=air, hijau=daun, kuning=petir) sehingga kartu tetap dapat dibedakan tanpa persepsi warna; palet diuji terhadap deuteranopia/protanopia.
4. **Konsistensi sistem**: satu design system kartu — grid, radius, stroke, drop shadow, tipografi angka custom/lisensi open (mis. via Google Fonts OFL).

### 10.2 Daftar Aset v0.1

|Aset|Jumlah|Keterangan|
|-|-|-|
|Wajah kartu angka|40 desain (0–9 × 4 warna)|template parametrik + ilustrasi aksen per warna|
|Wajah kartu aksi|12 desain (Skip/Reverse/+2 × 4 warna)|ikonografi aksi original|
|Wajah kartu wild|2 desain (Wild, Wild+4)|ilustrasi hero — paling menonjol|
|Punggung kartu|1|identitas brand utama|
|Avatar pemain|≥ 12|dipilih saat join|
|Logo + wordmark|1 set|nama original (§2)|
|Meja/background, SFX|1 set|tema default|

### 10.3 Pipeline Teknis Aset

* Format master: **SVG** (vektor) → diekspor ke sprite sheet WebP/AVIF 2 resolusi (1x/2x); target total payload kartu < 1.5 MB terkompresi.
* Penamaan: `card\_{color}\_{value}.svg` (mis. `card\_red\_7`, `card\_wild\_draw4`), dipetakan 1:1 ke enum `Card` di package `shared/`.
* Struktur tema (`themes/default/…`) sehingga v0.2+ dapat menambahkan skin/tema kartu dan dek mode lain (mis. dek dua sisi untuk mode Flip-like) tanpa refactor.
* Sumber ilustrasi: ilustrator komisi ATAU AI-assisted yang di-retouch manual — apa pun jalurnya, hasil akhir harus melewati review orisinalitas (§2) dan hak pakainya dimiliki proyek.

\---

## 11\. Model Data Inti (in-memory, v0.1)

```ts
type Color = "red" | "yellow" | "green" | "blue";
type CardValue = 0|1|2|3|4|5|6|7|8|9 | "skip" | "reverse" | "draw2" | "wild" | "wild4";
interface Card { id: string; color: Color | null; value: CardValue; deckIndex: number } // deckIndex utk multi-dek

interface RoomSettings { modeId: "standard"; maxPlayers: number /\*2–10\*/; turnTimeoutSec: number;
  scoreTarget: 0 | 500; modeOptions: Record<string, unknown> }

interface Player { sessionId: string; nickname: string; avatarId: string; seat: number;
  hand: Card\[] /\* server-only \*/; cardCount: number; score: number;
  connected: boolean; isHost: boolean; calledUno: boolean }

interface GameState { phase: "lobby"|"playing"|"roundEnd"|"gameEnd";
  drawPile: Card\[] /\* server-only \*/; discardTop: Card; activeColor: Color;
  direction: 1 | -1; currentSeat: number; turnDeadline: number;
  pendingChallenge?: { from: number; to: number; deadline: number }; roundNumber: number }
```

\---

## 12\. Pengujian \& Kriteria Penerimaan v0.1

### 12.1 Pengujian

* **Unit (wajib, coverage tinggi pada `engine/`)**: validasi semua matriks kartu-vs-discard, efek aksi termasuk edge case (Reverse pada 2 pemain, +4 challenge, dek habis \& reshuffle, kartu pembuka aksi, timeout otomatis, penalti lupa "Satu!").
* **Simulasi**: bot acak memainkan 10.000 game otomatis di engine — tidak boleh ada deadlock/invariant rusak (jumlah total kartu selalu 108, giliran selalu maju).
* **Integrasi**: `@colyseus/testing` — join/leave/reconnect/kick/host-migration pada 10 klien simulasi.
* **E2E**: Playwright, 3 browser, satu ronde penuh melawan staging Railway.
* **Load test ringan**: `artillery`/skrip ws — 100 ruangan × 6 klien terhadap instance staging.

### 12.2 Kriteria Penerimaan (Definition of Done v0.1)

1. 10 pemain nyata dapat menyelesaikan permainan penuh tanpa desync atau crash.
2. Kill koneksi salah satu pemain di tengah giliran → reconnect ≤ 60 dtk → state pulih benar.
3. Tidak ada data tangan lawan di payload jaringan mana pun (diverifikasi via inspeksi traffic).
4. Frontend live di domain Vercel, backend live di Railway, WSS lintas-origin berfungsi dari produksi dan preview.
5. Semua aset visual original dan nama publik bebas dari merek "UNO".

\---

## 13\. Roadmap Versi

|Versi|Cakupan|
|-|-|
|**v0.1**|Mode standard 2–10 pemain, room privat, reconnect, skor, ilustrasi original set pertama.|
|v0.2|House rules toggle (Jump-In, Seven-Zero, Stacking), spectator, room publik + quick join, Redis snapshot, 11–16 pemain multi-dek.|
|v0.3|Akun \& statistik (PostgreSQL), leaderboard, tema kartu tambahan, scale-out horizontal.|
|v0.4+|Mode besar (No Mercy-like dengan eliminasi, Flip-like dek dua sisi, Speed/realtime), turnamen.|

\---

## 14\. Risiko \& Mitigasi

|Risiko|Dampak|Mitigasi|
|-|-|-|
|Klaim IP dari Mattel|Takedown|§2 dijalankan ketat sebelum rilis publik; review legal atas nama \& artwork final.|
|Cold start/redeploy Railway memutus game aktif|Pengalaman buruk|Graceful shutdown + (v0.2) snapshot Redis; jadwal deploy di jam sepi.|
|Latensi pemain lintas region|Game terasa lambat|Region Singapura; turn-based mentoleransi latensi lebih besar daripada game aksi.|
|Biaya egress membengkak|Biaya|State delta-patch (bukan full snapshot per aksi), aset dilayani dari Vercel CDN bukan Railway.|
|Ruangan besar terasa membosankan (antre giliran)|Retensi|Timer giliran ketat, animasi/emote selama menunggu, house rules Jump-In di v0.2.|

\---

