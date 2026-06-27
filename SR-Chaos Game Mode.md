# System Requirement: Mode "Meledak 25" + Meme Cards

## Ringkasan

Game mode baru untuk CongCard (UNO-like multiplayer) dimana:
- Player meledak jika memiliki >25 kartu
- 2 win condition: kartu habis duluan ATAU semua player lain meledak
- Draw penalty: +1 (bukan +2), Wild: +2 (bukan +4)
- Fitur utama: **Meme Cards** — kartu spesial dengan efek unik, desain putih + rainbow

---

## Daftar Isi

1. [Game Mode: Meledak 25](#1-game-mode-meledak-25)
2. [Meme Cards — Core Set](#2-meme-cards--core-set)
3. [Meme Cards — Tambahan (10 ide)](#3-meme-cards--tambahan)
4. [Arsitektur Implementasi](#4-arsitektur-implementasi)
5. [Feasibility Analysis](#5-feasibility-analysis)
   - [VFX](#51-vfx)
   - [SFX](#52-sfx)
   - [Game Engine](#53-game-engine)
6. [Prioritas Implementasi](#6-prioritas-implementasi)
7. [Checklist File-by-File](#7-checklist-file-by-file)

---

## 1. Game Mode: Meledak 25

### Aturan Dasar

| Aturan | Value |
|--------|-------|
| Mode ID | `"explode-25"` |
| Initial hand size | 7 |
| Draw penalty | `draw2` → **draw1** (nilai +1) |
| Wild penalty | `wild4` → **wild2** (nilai +2) |
| Batas meledak | Hand > 25 kartu → eliminated |
| Win 1 | Kartu habis (seperti UNO biasa) |
| Win 2 | Semua player lain sudah meledak |
| Scoring | Standard (angka=value, action=20, wild=50) |

### Meledak Logic

```
Setelah setiap playCard() dan setiap draw selesai:
  for each player:
    if player.hand.length > 25 && !player.finishedRank:
      player meledak
      - Semua hand masuk discard pile
      - player.finishedRank = rank berikutnya
      - player.cardCount = 0
      - Emit presentationEvent { kind: "explode" }

Jika hanya 1 player tersisa (sisanya finishedRank):
  completeRound(state, lastPlayerId)
```

### Deck Composition (per deck box)

| Jenis | Jumlah |
|-------|--------|
| Kartu standard (draw1 & wild2) | 108 |
| Meme cards (5 jenis × 4 copies) | 20 |
| **Total** | **~128 kartu** |

### Perubahan dari Standard UNO

| Card Value | Standard | Meledak 25 |
|-----------|----------|------------|
| draw2 | Draw 2 | Draw 1 |
| draw5 | Draw 5 | Draw 1 (dari flip mode) |
| wild4 | Draw 4 | Draw 2 |
| wild3 | Draw 3 | Draw 2 |
| wild | Wild (bebas) | Wild (bebas) |

---

## 2. Meme Cards — Core Set

### 2.1 Flashbang

| Atribut | Detail |
|---------|--------|
| **Icon** | Flashbang Cat |
| **Type** | Special (color: null) |
| **Card Value** | `"flashbang"` |
| **Sound Cue** | Flashbang explosion + cat scream |
| **Efek** | Kumpulin semua kartu dari semua player → shuffle → deal random ke semua player |

**Flow:**
```
1. Player mainkan Flashbang
2. Server collect: allHands = [...player1.hand, ...player2.hand, ...]
3. Server shuffle(allHands)
4. Server deal kembali: count = floor(allHands.length / playerCount)
   - Sisa kartu (jika ganjil) masuk discard pile
5. Semua player dapat kartu baru secara acak
6. Emit flashbang event
```

**VFX:**
- Flash putih penuh layar (opacity spike 0→1→0 dalam 0.5s)
- Kartu-kartu terbang ke tengah lalu tersebar ke semua seat
- Particle effect mirip shatter

**SFX:**
- White noise burst (0.4s) via ctx.createBufferSource + random samples
- Cat scream: cat scream.mp3+reverb fade out + flashbang SFX

---

### 2.2 Throw Up

| Atribut | Detail |
|---------|--------|
| **Icon** | Throw Up Cat |
| **Type** | Color card (punya warna spesifik) |
| **Card Value** | `"throwup"` |
| **Sound Cue** | Throw up cat sound |
| **Efek** | Buang semua kartu di hand yang warnanya SAMA dengan warna kartu Throw Up |

**Flow:**
```
1. Player mainkan Throw Up (punya warna, misal: green)
2. Server filter: player.hand.filter(c => c.color === "green")
3. Semua kartu hijau masuk discard pile
4. advanceTurn
```

**Perbedaan dengan kartu lain:** Throw Up adalah color card (bukan special), jadi warnanya match dengan active color. Ini yang membedakan dari special cards lain yang putih.

**VFX:**
- Particle kartu hijau/ungu meluncur ke discard pile
- Efek "splash" dengan warna sesuai kartu

**SFX:**
- Low LFO square wave + gain wobble descend
- Filtered noise dengan pitch bend turun

---

### 2.3 Steal

| Atribut | Detail |
|---------|--------|
| **Icon** | Evil Cat |
| **Type** | Special (color: null) |
| **Card Value** | `"steal"` |
| **Sound Cue** | Mueheheheh cat (evil laugh) |
| **Efek** | Pilih 1 player target → lihat hand mereka → pilih kartu spesifik untuk diambil |

**Flow:**
```
1. Player mainkan Steal
2. Server set state: pendingSteal = { stealerId, targetCandidates: [...] }
3. Client render ModalSteal → pilih target player
4. room.send("stealTarget", { targetId })
5. Server kirim hand target (tanpa kartu random yang diobfuscate)
6. Client render ModalStealCard → pilih kartu spesifik
7. room.send("stealChoice", { cardId })
8. Kartu pindah dari target.hand ke stealer.hand
```

**State baru di GameStateInternal:**
```typescript
pendingSteal?: {
  stealerId: string;
  targetIds: string[];
  targetId?: string; // setelah dipilih
}
```

**VFX:**
- Kartu meluncur dari target seat ke player seat (animasi flight)
- Efek "evil grin" di sekitar kartu
- Bisa reuse FlightLayer.tsx yang sudah ada

**SFX:**
- Ascending arpeggio cepat (triplet) square wave + distortion
- Alternatif: descending staccato notes jika evil laugh susah disintesis

**Feasibility Note:** Butuh modal interaktif multi-step — pattern seperti ChallengeModal tapi 2 tahap.

---

### 2.4 Favor

| Atribut | Detail |
|---------|--------|
| **Icon** | Awoowo Cat |
| **Type** | Special (color: null) |
| **Card Value** | `"favor"` |
| **Sound Cue** | Awoowo cat sound |
| **Efek** | Pilih 1 player target → minta mereka ngasih 1 kartu pilihan mereka |

**Flow:**
```
1. Player mainkan Favor
2. Server set state: pendingFavor = { askerId, giverId }
3. Client (si giver) render ModalFavor → pilih kartu dari hand mereka
4. room.send("favorChoice", { cardId })
5. Kartu pindah dari giver.hand ke asker.hand
```

**State baru:**
```typescript
pendingFavor?: {
  askerId: string;
  giverId: string;
}
```

**VFX:**
- Sama seperti Steal tapi arahnya kebalik (dari giver ke asker)
- Efek "heart" atau "thanks" particle

**SFX:**
- Sine wave dengan vibrato naik-turun (400Hz → 600Hz → 300Hz)
- Contour membentuk "awoowo"

---

### 2.5 Peek

| Atribut | Detail |
|---------|--------|
| **Icon** | Flipping Frog |
| **Type** | Special (color: null) |
| **Card Value** | `"peek"` |
| **Sound Cue** | Frog laugh |
| **Efek** | Reveal semua kartu di hand semua player (termasuk dirimu sendiri) selama durasi tertentu |

**Flow:**
```
1. Player mainkan Peek
2. Server set: state.revealedHands = true
3. state.revealedUntil = Date.now() + 8000 (8 detik)
4. Di snapshotFor(): kirim semua hand (hanya selama revealed)
5. Client render ModalPeek — grid semua player + kartu
6. Setelah 8 detik, revealedHands dihapus
```

**State baru:**
```typescript
// Di GameStateInternal:
revealedHands: boolean;
revealedUntil?: number;

// Di GameSnapshot (hanya saat aktif):
revealedHands?: Record<string, Card[]>;
```

**UI Solusi — ModalPeek:**
```
┌─────────────────────────────────┐
│  👁️ PEEK! — All Hands Revealed   │
├─────────────────────────────────┤
│                                  │
│  ┌─ Player 1 ─────────────────┐ │
│  │ [r1][r5][y3][b2][g7][wd].. │ │
│  └────────────────────────────┘ │
│  ┌─ Player 2 ─────────────────┐ │
│  │ [y1][g4][b9][r2][rv][sk].. │ │
│  └────────────────────────────┘ │
│  ┌─ Kamu ─────────────────────┐ │
│  │ [b3][r7][g1][wd][wd]...... │ │
│  └────────────────────────────┘ │
│                                  │
│    [Tutup otomatis dalam 5dtk]   │
└─────────────────────────────────┘
```

**Untuk banyak player & banyak kartu:**
- Per-player: collapsible section + expand
- Scroll horizontal per baris player
- Color-coded dots untuk quick scan
- Progressive reveal animation (kartu flip satu per satu)

**VFX:**
- Overlay semi-transparan
- Kartu flip 180° (animasi CSS 3D transform)
- Lingkaran mata terbuka di tengah transisi

**SFX:**
- Square wave croak pendek + fast amplitude modulation
- Delay/reverb (bisa reuse filter dari sound.ts)

---

## 3. Meme Cards — Tambahan

### 3.1 Vote

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Vote / Kotak Suara |
| **Type** | Special |
| **Efek** | Setiap player vote 1 player. Yang vote terbanyak draw N (N = jumlah vote mereka). Seri → semua draw 1 |
| **Sound Cue** | Drum roll → gong/buzzer |
| **Feasibility** | **Sulit** — butuh multi-player input + timeout + vote tracking |

---

### 3.2 Chaos

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Chaos / Tanda ? eksplosif |
| **Type** | Special |
| **Efek** | Semua player discard 1 random card → draw 1 card baru |
| **Sound Cue** | Glitch noise + ascending sweep |
| **Feasibility** | **Mudah** — tanpa modal, loop server |

---

### 3.3 Time Skip

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Jam / Arloji |
| **Type** | Special |
| **Efek** | Skip semua player lain. Giliran kembali ke kamu |
| **Sound Cue** | Tick-tock cepat → ascending chime |
| **Feasibility** | **Sangat Mudah** — `advanceTurn(state, N-1)` |

---

### 3.4 Mirror

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Cermin |
| **Type** | Special |
| **Efek** | Salin kartu terakhir di discard → tambah 1 copy ke handmu |
| **Sound Cue** | Glass shatter + reverb |
| **Feasibility** | **Sangat Mudah** — duplikasi card object |

---

### 3.5 Pandemic

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Sakit / Masker |
| **Type** | Special |
| **Efek** | Setiap player kasih 1 random card ke kiri (pass left) |
| **Sound Cue** | Bersin + kartu shuffle |
| **Feasibility** | **Mudah** — rotasi array |

---

### 3.6 Magnet

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Magnet |
| **Type** | Special |
| **Efek** | Ambil semua kartu wild dari SEMUA player ke handmu |
| **Sound Cue** | Magnet tarik + thud |
| **Feasibility** | **Mudah** — filter wild → push ke hand |

---

### 3.7 Jackpot

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Hoki / Emas |
| **Type** | Special |
| **Efek** | Draw 3. Ada duplicate? → discard semua (bersih). Semua unique? → keep (+3) |
| **Sound Cue** | Slot spin → ding/ding/ding atau buzzer |
| **Feasibility** | **Sedang** — butuh modal untuk show hasil draw |

---

### 3.8 Roulette

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Roda / Roulette |
| **Type** | Special |
| **Efek** | 50% kamu discard 2, 50% target discard 3 |
| **Sound Cue** | Wheel spin → ball click → ding |
| **Feasibility** | **Mudah** — random + discard |

---

### 3.9 Nuke

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Bom |
| **Type** | Special |
| **Efek** | Semua player discard setengah hand (round down) |
| **Sound Cue** | Ledakan + low rumble + glass ting |
| **Feasibility** | **Mudah** — loop Math.floor(N/2) discard |

---

### 3.10 Mime

| Atribut | Detail |
|---------|--------|
| **Icon** | Kucing Topeng / Pura-pura |
| **Type** | Special |
| **Efek** | Ambil 1 kartu dari discard pile (bukan top card) ke handmu |
| **Sound Cue** | Kabut tipis + ascending note |
| **Feasibility** | **Sedang** — butuh pilih dari discard pile via modal |

---

## 4. Arsitektur Implementasi

### Shared Types (`web/shared/src/index.ts` & `server/shared/src/index.ts`)

```typescript
// Tambah ke CARD_VALUES
"flashbang" | "throwup" | "steal" | "favor" | "peek"

// Tambah ke RoomSettings.modeId
"standard" | "flip" | "explode-25"

// Tambah ke GameMode.id
"standard" | "flip" | "explode-25"

// Tambah ke PresentationEventKind
"flashbang" | "throwup" | "steal" | "favor" | "peek" | "explode"

// Field baru di GameSnapshot
revealedHands?: Record<string, Card[]>;
pendingSteal?: PendingSteal;
pendingFavor?: PendingFavor;
```

### Server Mode (`server/src/engine/modes/meledak.ts`)

```typescript
export const meledakMode: GameMode = {
  id: "explode-25",
  initialHandSize: 7,
  buildDeck(playerCount, deckBoxes?) {
    // 1. Standard deck (dengan draw1 & wild2)
    // 2. + Meme cards
    // 3. shuffle + return
  },
  isPlayable(card, ctx) {
    // Special cards (flashbang, steal, favor, peek) → selalu playable
    // Throw up → cocok warna atau wild
    // Standard → sama dengan standard mode
  },
  scoreHand(hand) {
    // Sama dengan standard scoring
  },
  allowedOutOfTurnActions(ctx) {
    return ["catchOne", "challenge"];
  }
};
```

### Server Engine (`server/src/engine/game.ts`)

```
getMode() → tambah "explode-25" → meledakMode

applyPlayedCard() → tambah case:
  - "flashbang" → doFlashbang(state, player)
  - "throwup" → doThrowUp(state, player)
  - "steal" → startSteal(state, player)
  - "favor" → startFavor(state, player)
  - "peek" → startPeek(state, player)

Fungsi baru:
  - checkExplode(state) → cek >25 cards setiap selesai draw
  - doFlashbang(state, player) → collect + shuffle + redeal
  - doThrowUp(state, player) → filter warna + discard
  - startSteal → set pendingSteal
  - resolveSteal(state, targetId, cardId)
  - startFavor → set pendingFavor
  - resolveFavor(state, cardId)
  - startPeek → set revealedHands
```

### Frontend Events (`web/src/lib/events.ts`)

```typescript
// UiEvent types baru
| { type: "flashbang" }
| { type: "throwup"; color: Color; count: number; self: boolean }
| { type: "steal"; targetName: string; self: boolean }
| { type: "favor"; targetName: string; self: boolean }
| { type: "peek" }
| { type: "explode"; playerName: string; self: boolean }
```

### Frontend Sound (`web/src/lib/sound.ts`)

```typescript
// SoundName baru
| "memeFlashbang" | "memeThrowup" | "memeSteal" | "memeFavor" | "memePeek" | "explode"

// soundForEvent() mapping:
// flashbang → "memeFlashbang"
// throwup → "memeThrowup"
// dll.
```

---

## 5. Feasibility Analysis

### 5.1 VFX

| Efek | Feasibility | Caranya |
|------|-------------|---------|
| **Flashbang** | ✅ **Mudah** | `eventWash` radial-gradient putih + motion.div opacity spike. Particle reuse dari BURST_POINTS |
| **Throw Up** | ✅ **Mudah** | Toast "+N" diikuti particle warna sesuai kartu. Mirip penalty |
| **Steal** | ✅ **Bisa** | Reuse FlightLayer.tsx yang sudah ada untuk deal cards. Plus modal interaktif |
| **Favor** | ✅ **Bisa** | Sama framework dengan Steal, arah kebalik |
| **Peek** | ✅ **Bisa** | Modal overlay grid player+kartu. Collapsible per player untuk banyak kartu. Progressive flip animation |
| **Meledak** | ✅ **Mudah** | Particle + kartu terbang ke discard. Reuse penalty VFX |
| **Vote** | ⚠️ **Modal** | Modal countdown + avatar vote. Particle hasil |
| **Time Skip** | ✅ **Sangat Mudah** | Lingkaran jam + particle skip di tiap seat |
| **Nuke** | ✅ **Mudah** | Lingkaran ekspansi + shockwave. Reuse penalty VFX |

### 5.2 SFX

| Sound | Feasibility | Teknik Synthesis |
|-------|-------------|-----------------|
| **Flashbang** | ✅ **Bisa** | White noise burst (0.4s) + high-freq sawtooth dengan pitch descend |
| **Throw Up** | ✅ **Bisa** | Low LFO square wave + gain wobble + filtered noise descend |
| **Steal (evil laugh)** | ⚠️ **Cukup** | Ascending arpeggio triplet square wave + distortion. Alternatif: descending staccato |
| **Favor (awoowo)** | ⚠️ **Cukup** | Sine wave vibrato (400→600→300Hz). Tidak sama persis kucing tapi recognizable |
| **Peek (frog)** | ✅ **Bisa** | Square wave croak + fast AM + delay/reverb |
| **Meledak** | ✅ **Bisa** | Low rumble (sine 40Hz) + noise burst + glass ting |
| **Nuke** | ✅ **Bisa** | Sama dengan meledak tapi lebih besar |

Procedural synthesis = Web Audio API oscillators/noise/filters di sound.ts `render()`. Bisa juga pakai audio sprite (.ogg) untuk quality lebih baik.

### 5.3 Game Engine

| Efek | Complexity | Notes |
|------|-----------|-------|
| **Throw Up** | ✅ Rendah | Filter hand → discard. Fungsi 10 baris |
| **Flashbang** | ✅ Rendah | Collect → shuffle → deal. Fungsi 20 baris |
| **Peek** | ✅ Sedang | Flag reveal + kirim hand via snapshot. Perlu filter di snapshotFor() |
| **Steal** | ⚠️ Tinggi | State machine 2-step + modal interaktif |
| **Favor** | ⚠️ Tinggi | Sama dengan Steal |
| **Meledak >25** | ✅ Rendah | Cek di syncPlayerHandChange() + completeDraw() |
| **Vote** | ❓ Sulit | Multi-player input queue + timeout + tracking vote |

---

## 6. Prioritas Implementasi

### Fase 1 — Core

| Item | Est. Effort |
|------|-------------|
| Mode ID + shared types | 15 menit |
| Server mode file (deck, rules) | 1 jam |
| Engine: draw1/wild2 | 30 menit |
| Engine: meledak check >25 | 1 jam |
| Frontend: enable option | 15 menit |
| **Total** | **~3 jam** |

### Fase 2 — Kartu Tanpa Modal (Mudah)

| Item | Est. Effort |
|------|-------------|
| **Throw Up** — server effect + VFX + SFX | 2 jam |
| **Flashbang** — server effect + VFX + SFX | 2 jam |
| **Time Skip** — server effect + VFX + SFX | 30 menit |
| **Mirror** — server effect + VFX + SFX | 1 jam |
| **Nuke** — server effect + VFX + SFX | 1 jam |
| **Roulette** — server effect + VFX + SFX | 1 jam |
| **Total** | **~7.5 jam** |

### Fase 3 — Kartu Dengan Display Modal

| Item | Est. Effort |
|------|-------------|
| **Peek** — server effect + ModalPeek + VFX + SFX | 3 jam |
| **Jackpot** — server effect + ModalJackpot + VFX + SFX | 2 jam |
| **Chaos** — server effect + VFX + SFX | 1 jam |
| **Pandemic** — server effect + VFX + SFX | 1.5 jam |
| **Magnet** — server effect + VFX + SFX | 1 jam |
| **Total** | **~8.5 jam** |

### Fase 4 — Kartu Dengan Modal Interaktif

| Item | Est. Effort |
|------|-------------|
| **Steal** — server state machine + ModalStealTarget + ModalStealCard + VFX + SFX | 5 jam |
| **Favor** — server state machine + ModalFavor + VFX + SFX | 4 jam |
| **Mime** — server effect + ModalMime + VFX + SFX | 2 jam |
| **Total** | **~11 jam** |

### Fase 5 — Multi-Player Interaction

| Item | Est. Effort |
|------|-------------|
| **Vote** — vote system + timeout + ModalVote + VFX + SFX | 6 jam |
| **Total** | **~6 jam** |

**Grand Total Estimasi: ~36 jam**

---

## 7. Checklist File-by-File

### Shared Types (2 files)

- [ ] `web/shared/src/index.ts`
  - [ ] `CARD_VALUES`: tambah `"flashbang"`, `"throwup"`, `"steal"`, `"favor"`, `"peek"`
  - [ ] `RoomSettings["modeId"]`: tambah `"explode-25"`
  - [ ] `GameMode["id"]`: tambah `"explode-25"`
  - [ ] `PresentationEventKind`: tambah `"flashbang"`, `"throwup"`, `"steal"`, `"favor"`, `"peek"`, `"explode"`
  - [ ] `GameSnapshot`: tambah `revealedHands`, `pendingSteal`, `pendingFavor`
  - [ ] `roomSettingsSchema`: tambah `"explode-25"` di enum
  - [ ] `roomSettingsUpdateSchema`: tambah `"explode-25"` di enum
- [ ] `server/shared/src/index.ts` — mirror dari atas

### Server

- [ ] `server/src/engine/modes/meledak.ts` — file baru
  - [ ] `buildDeck()` — standard deck + meme cards
  - [ ] `isPlayable()` — meme card rules
  - [ ] `scoreHand()` — standard scoring
  - [ ] Export `meledakMode`
- [ ] `server/src/engine/game.ts`
  - [ ] Import `meledakMode`
  - [ ] `getMode()` — tambah case `"explode-25"`
  - [ ] `applyPlayedCard()` — 5 case baru untuk meme cards
  - [ ] Fungsi `checkExplode()` — dipanggil setelah draw selesai
  - [ ] Fungsi `doFlashbang()` — collect + shuffle + redeal
  - [ ] Fungsi `doThrowUp()` — filter color → discard
  - [ ] Fungsi `startSteal()` / `resolveSteal()`
  - [ ] Fungsi `startFavor()` / `resolveFavor()`
  - [ ] Fungsi `startPeek()` — set revealed state + timeout
  - [ ] `GameStateInternal` — tambah `revealedHands`, `revealedUntil`, `pendingSteal`, `pendingFavor`
  - [ ] `snapshotFor()` — kirim `revealedHands` jika aktif
  - [ ] `syncPlayerHandChange()` — panggil `checkExplode()`

### Frontend — Components

- [ ] `web/src/components/CardView.tsx`
  - [ ] Render white/rainbow card untuk meme cards
  - [ ] Icon mapping `iconForValue()` untuk meme values
  - [ ] `drawAmount()` — draw1 & wild2
- [ ] `web/src/components/GameEventOverlay.tsx`
  - [ ] `EventVfx` — Flashbang (flash putih + particle)
  - [ ] `EventVfx` — Throw Up (splash warna)
  - [ ] `EventVfx` — Steal (kartu terbang)
  - [ ] `EventVfx` — Favor (kartu terbang balik)
  - [ ] `EventVfx` — Peek (mata terbuka)
  - [ ] `EventVfx` — Explode (ledakan merah + particle)
  - [ ] `eventWash()` — wash untuk tiap meme event
  - [ ] `toastContent()` — label/sublabel untuk tiap meme event
  - [ ] `eventPriority()` — priority baru
  - [ ] `eventToastDurationMs()` — duration baru
- [ ] `web/src/components/RoomClient.tsx`
  - [ ] Enable `"explode-25"` di dropdown lobby
  - [ ] Import & render: `MemeStealModal`, `MemeFavorModal`, `MemePeekModal`
  - [ ] Handler: `stealTarget`, `stealChoice`, `favorChoice`
- [ ] `web/src/components/MemePeekModal.tsx` — file baru
  - [ ] Grid player + kartu dengan collapsible
  - [ ] Auto-close timer
  - [ ] Progressive flip animation
- [ ] `web/src/components/MemeStealModal.tsx` — file baru
  - [ ] Step 1: Pilih target player
  - [ ] Step 2: Pilih kartu spesifik dari hand target
  - [ ] Send choice via room.send
- [ ] `web/src/components/MemeFavorModal.tsx` — file baru
  - [ ] Tampilkan hand sendiri
  - [ ] Pilih 1 kartu untuk diberikan
  - [ ] Send choice via room.send

### Frontend — Lib

- [ ] `web/src/lib/events.ts`
  - [ ] `UiEvent` type — 6 event baru
  - [ ] `presentationUiEvent()` — mapping dari PresentationEvent
  - [ ] `ACTION_LOCK_EVENT_TYPES` — tambah meme events
- [ ] `web/src/lib/sound.ts`
  - [ ] `SoundName` — 6 nama baru
  - [ ] `soundForEvent()` — mapping baru
  - [ ] `render()` — 6 procedural sound implementation
  - [ ] `playUiEventSounds()` — tambah duckMusic untuk meme events
- [ ] `web/src/lib/rules.ts`
  - [ ] `canPlayCard()` — special cards always playable
  - [ ] `cardText()` — untuk meme card names

### Frontend — Assets

- [ ] `web/public/sprites/card-icons.svg`
  - [ ] `icon-meme-flashbang` — flashbang cat SVG
  - [ ] `icon-meme-throwup` — throw up cat SVG
  - [ ] `icon-meme-steal` — evil cat SVG
  - [ ] `icon-meme-favor` — awoowo cat SVG
  - [ ] `icon-meme-peek` — flipping frog SVG
- [ ] `web/public/audio/` — optional audio clips untuk SFX yang lebih authentic

### Frontend — Styles

- [ ] `web/src/app/globals.css`
  - [ ] `.card-meme` — white background + rainbow border + glow
- [ ] `web/src/styles/foundation.css`
  - [ ] Meme card face styles
  - [ ] Meme badge styles

### Frontend — i18n

- [ ] `web/messages/en.json`
  - [ ] `lobby.modeMeledak`: "Explode 25"
  - [ ] `events.*` untuk meme events
  - [ ] `card.*` untuk meme card names
  - [ ] `rules.*` untuk mode description
- [ ] `web/messages/id.json`
  - [ ] `lobby.modeMeledak`: "Meledak 25"
  - [ ] `events.*` untuk meme events (Indo)
  - [ ] `card.*` untuk meme card names (Indo)
  - [ ] `rules.*` untuk mode description (Indo)

---

## Catatan Khusus UI/UX

### Peek — Solusi UI untuk Banyak Player & Banyak Kartu

Kendala utama: 10 player × 20+ kartu = 200+ kartu di satu layar.

**Solusi yang disarankan:**

1. **Default collapsed per player** — hanya lihat nama + jumlah kartu + color dots
2. **Expand on click** — klik player untuk lihat kartu mereka
3. **Grouped color view** — kartu dikelompokkan per warna (reuse logic dari Hand.tsx GroupedHand)
4. **Timer 8 detik** — cukup untuk scan strategis tanpa bikin turn delay
5. **Animasi progressive** — kartu flip 180° satu per satu (bikin momen dramatis)
6. **Mobile** — full screen modal, swipe per player

### Steal/Favor — UX Flow

**Steal:**
```
Step 1: [Pilih Target]       Step 2: [Pilih Kartu]
┌──────────────────┐         ┌──────────────────────┐
│  Siapa?           │         │  Ambil kartu apa?    │
│                   │         │                      │
│  (A) Player 1     │         │  [r5] [y3] [b8] ..  │
│  (B) Player 2     │         │  [g1] [wd] [rv]     │
│  (C) Player 3     │         │                      │
│                   │         │  [Cancel]            │
│  [Cancel]         │         └──────────────────────┘
└──────────────────┘
```

**Favor:**
```
Step 1: [Pilih Target]       Step 2: [Giver pilih kartu]
┌──────────────────┐         ┌──────────────────────────┐
│  Minta siapa?     │         │  Kartu mana untuk       │
│                   │         │  PlayerName?            │
│  (A) Player 1     │         │                         │
│  (B) Player 2     │         │  [r5] [y3] [b8] ..     │
│  (C) Player 3     │         │  [g1] [wd] [rv]        │
│                   │         │                         │
│  [Cancel]         │         │  [Cancel]               │
└──────────────────┘         └──────────────────────────┘
```
