# System Requirement: Mode "Chaos" + Meme Cards

## Ringkasan

Game mode baru untuk CongCard (UNO-like multiplayer) dimana:
- player bust jika memiliki >25 kartu
- 2 win condition: kartu habis duluan ATAU semua player lain bust
- Draw penalty: +1 (bukan +2), Wild: +2 (bukan +4)
- Fitur utama: **Meme Cards** — kartu spesial dengan efek unik, desain putih + rainbow

---

## Daftar Isi

1. [Game Mode: Chaos](#1-game-mode-chaos)
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

## 1. Game Mode: Chaos

### Aturan Dasar

| Aturan | Value |
|--------|-------|
| Mode ID | `"chaos"` |
| Initial hand size | 7 |
| Draw penalty | `draw2` → **draw1** (nilai +1) |
| Wild penalty | `wild4` → **wild2** (nilai +2) |
| Batas bust | Hand > 25 kartu → eliminated |
| Win 1 | Kartu habis (seperti UNO biasa) |
| Win 2 | Semua player lain sudah bust |
| Scoring | Standard (angka=value, action=20, wild=50) |

### Chaos Bust Logic

```
Setelah setiap playCard() dan setiap draw selesai:
  for each player:
    if player.hand.length > 25 && !player.finishedRank:
      player bust
      - Semua hand masuk discard pile
      - player.finishedRank = rank berikutnya
      - player.cardCount = 0
      - Emit presentationEvent { kind: "chaosBust" }

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

| Card Value | Standard | Chaos |
|-----------|----------|------------|
| draw2 | Draw 2 | Draw 1 |
| draw5 | Draw 5 | Draw 1 (dari flip mode) |
| wild4 | Draw 4 | Draw 2 |
| wild3 | Draw 3 | Draw 2 |
| wild | Wild (bebas) | Wild (bebas) |

---

## 2. Meme Cards — Core Set

### Common Sequence (Semua Chaos Cards)

Setiap chaos card memiliki sequence yang sama saat dimainkan:

```
1. [Action disable] — semua action terkunci selama sequence
2. [Glow] — kartu chaos glow di tengah meja (1s)
3. [SFX] — bass pitch (naik/turun tergantung kartu) + aset suara khas
4. [Efek] — efek kartu terjadi (swap, discard, dll.)
5. [Action enable] — action kembali aktif
6. [advanceTurn] — giliran ke next player
```

**Reduced motion:** skip entire glow & SFX sequence. Langsung ke efek + toast.

---

### 2.1 Flashbang

| Atribut | Detail |
|---------|--------|
| **Icon** | Flashbang Cat |
| **Type** | Special (color: null) |
| **Card Value** | `"flashbang"` |
| **Sound Cue** | Bass pitch rise → flashbang explosion → cat scream |
| **Efek** | Swap semua hand secara acak (permutasi). Tiap player dapat hand milik player lain — boleh dapat sendiri (filosofi chaos) |

**Flow:**
```
1. Player mainkan Flashbang
2. Server collect: hands[] = semua player hand
3. randomPermutation(hands.length) → mapping tiap index ke index acak
4. Setiap player.hand = hands[permutation[i]]
   - Boleh dapat hand sendiri (bukan strict derangement)
5. Emit flashbang event + disable action sampai sequence selesai
6. advanceTurn ke next player
```

**VFX — Normal:**
1. Kartu Flashbang glow di tengah meja (1s)
2. Bass pitch naik (audio)
3. Flashbang asset SFX → white screen fade in/out bersamaan (0.5s)
4. Cat scream asset SFX (ref: https://youtu.be/qfxDEZX9K0o?si=DbHusUTuQ2cdOmKu @0:13)
5. Toast "🔄 Hands Swapped!" muncul
6. Action disable sampai seluruh sequence selesai

**VFX — Reduced Motion:**
- Skip glow, white flash, cat scream entirely
- Hanya toast subtle "🔄 Hands Swapped!" fade in/out (500ms)
- SFX: bunyi swap pendek

---

### 2.2 Throw Up

| Atribut | Detail |
|---------|--------|
| **Icon** | Throw Up Cat |
| **Type** | Color card (punya warna spesifik) |
| **Card Value** | `"throwup"` |
| **Sound Cue** | Bass pitch down → cat vomit |
| **Efek** | Buang semua kartu di hand yang warnanya SAMA dengan warna kartu Throw Up. Hand kosong setelah discard = **menang** |

**Flow:**
```
1. Player mainkan Throw Up (punya warna, misal: green)
2. Server filter: player.hand.filter(c => c.color === "green")
3. Semua kartu hijau masuk discard pile (bisa 0)
4. Jika hand.length === 0 → player menang (completeRound)
5. advanceTurn ke next player
```

**Perbedaan dengan kartu lain:** Throw Up adalah color card (bukan special), jadi warnanya match dengan active color. Ini yang membedakan dari special cards lain yang putih.

**VFX — Normal:**
1. Kartu glow di tengah meja (common sequence)
2. Kartu discard satu per satu ke discard pile (reuse Batch discard animation)
3. Toast "Throw Up! +N card discarded"

**VFX — Reduced Motion:**
- Skip glow. Kartu langsung discard berturut-turut (tanpa jeda)
- Toast saja

**SFX:**
- Bass pitch down
- Cat vomit (audio aset — ref: https://youtu.be/aHXx15ahNtw?si=OwyFEApX33WwvY6W)
- Untuk setiap discard: reuse sound kartu biasa dengan pitch up

---

### 2.3 Steal

| Atribut | Detail |
|---------|--------|
| **Icon** | Evil Cat |
| **Type** | Special (color: null) |
| **Card Value** | `"steal"` |
| **Sound Cue** | Bass pitch up (glow) → evil cat laugh setelah pilih target |
| **Efek** | Pilih 1 player target (bukan diri sendiri) → lihat sebagian hand mereka → pilih 1 kartu untuk diambil. Jika hand target kosong setelah di-steal → target draw 2 sebagai kompensasi |

**Flow:**
```
1. Player mainkan Steal → glow sequence (bass pitch up)
2. Server set state: pendingSteal = { stealerId, targetCandidates: [...] }
3. Client render ModalSteal → pilih target player (hanya player lain)
4. room.send("stealTarget", { targetId })
5. Server kirim 5 kartu acak dari hand target (jika hand > 5), jika ≤ 5 kirim semua
6. Client render ModalStealCard → pilih kartu spesifik
7. room.send("stealChoice", { cardId })
8. Kartu pindah dari target.hand ke stealer.hand
9. Jika target.hand.length === 0 → target draw 2 dari draw pile
10. advanceTurn
```

**Cancel:** Cancel di step 3 (pilih target) atau step 6 (pilih kartu) → kartu hangus, kehilangan turn.

**State baru di GameStateInternal:**
```typescript
pendingSteal?: {
  stealerId: string;
  targetIds: string[];
  targetId?: string; // setelah dipilih
}
```

**VFX:**
- Glow sequence (common)
- Evil grin particle di sekitar kartu setelah milih target
- Kartu meluncur dari target seat ke player seat (FlightLayer)

**SFX:**
- Glow: bass pitch up
- Evil cat laugh (audio aset — ref: https://youtu.be/a2csXtfHIn4)

**Feasibility Note:** Butuh modal interaktif multi-step — pattern seperti ChallengeModal tapi 2 tahap.

---

### 2.4 Favor

| Atribut | Detail |
|---------|--------|
| **Icon** | Awoowo Cat |
| **Type** | Special (color: null) |
| **Card Value** | `"favor"` |
| **Sound Cue** | Bass pitch down (glow) → awoo cat sound saat pilih target |
| **Efek** | Pilih 1 player target (bukan diri sendiri) → minta mereka ngasih 1 kartu pilihan mereka. Mutual — tidak ada kompensasi |

**Flow:**
```
1. Player mainkan Favor → glow sequence (bass pitch down)
2. Client render ModalFavorTarget → pilih target player
3. room.send("favorTarget", { targetId })
4. Server set state: pendingFavor = { askerId, giverId }
5. Client (si giver) render ModalFavor → pilih kartu dari hand mereka
6. room.send("favorChoice", { cardId })
7. Kartu pindah dari giver.hand ke asker.hand
8. advanceTurn
```

**Cancel:** Cancel di step 2 (pilih target) atau step 5 (pilih kartu) → kartu hangus, kehilangan turn.

**State baru:**
```typescript
pendingFavor?: {
  askerId: string;
  targetIds: string[];
  targetId?: string; // setelah dipilih
}
```

**VFX:**
- Glow sequence (common)
- Efek "heart" atau "thanks" particle
- Kartu meluncur dari giver seat ke asker seat (FlightLayer, arah kebalik dari Steal)

**SFX:**
- Glow: bass pitch down
- Awoo cat sound (audio aset — ref: https://youtube.com/shorts/zJCnAPptIQo?si=iEwSOg7DvFe0o8my) diputar saat memilih target

---

### 2.5 Peek

| Atribut | Detail |
|---------|--------|
| **Icon** | Flipping Frog |
| **Type** | Special (color: null) |
| **Card Value** | `"peek"` |
| **Sound Cue** | Bass pitch down (glow) → frog laugh |
| **Efek** | Reveal semua kartu di hand semua player (termasuk dirimu sendiri). Action disable selama reveal. Auto close setelah timer |

**Flow:**
```
1. Player mainkan Peek → glow sequence (bass pitch down)
2. Frog laugh SFX
3. Server set: state.revealedHands = true, action disable
4. state.revealedUntil = Date.now() + 8000 (8 detik)
5. Di snapshotFor(): kirim semua hand (hanya selama revealed)
6. Client render ModalPeek — grid semua player + kartu + countdown timer
7. Setelah 8 detik → auto close, revealedHands dihapus, action enable
8. advanceTurn
```

**VFX — Normal:**
- Overlay modal dengan grid player collapsible
- Countdown timer visible
- Kartu flip animasi (progressive reveal)
- Lingkaran mata terbuka di tengah transisi

**VFX — Reduced Motion:**
- Skip flip animasi, kartu langsung muncul semua

**SFX:**
- Glow: bass pitch down
- Frog laugh (audio aset — ref: https://youtu.be/_OMFqXy3j1g?si=HoHbzIji9myHLBXS)

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
"standard" | "flip" | "chaos"

// Tambah ke GameMode.id
"standard" | "flip" | "chaos"

// Tambah ke PresentationEventKind
"flashbang" | "throwup" | "steal" | "favor" | "peek" | "chaosBust"

// Field baru di GameSnapshot
revealedHands?: Record<string, Card[]>;
pendingSteal?: PendingSteal;
pendingFavor?: PendingFavor;
```

### Server Mode (`server/src/engine/modes/chaos.ts`)

```typescript
export const chaosMode: GameMode = {
  id: "chaos",
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
getMode() → tambah "chaos" → chaosMode

applyPlayedCard() → tambah case:
  - "flashbang" → doFlashbang(state, player)
  - "throwup" → doThrowUp(state, player)
  - "steal" → startSteal(state, player)
  - "favor" → startFavor(state, player)
  - "peek" → startPeek(state, player)

Fungsi baru:
  - checkChaosBust(state) → cek >25 cards setiap selesai draw
   - doFlashbang(state, player) → random permutation of all hands
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
| { type: "chaosBust"; playerName: string; self: boolean }
```

### Frontend Sound (`web/src/lib/sound.ts`)

```typescript
// SoundName baru
| "memeFlashbang" | "memeThrowup" | "memeSteal" | "memeFavor" | "memePeek" | "chaosBust"

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
| **Flashbang** | ✅ **Mudah** | Kartu glow di tengah → white screen fade in/out → toast swap. For reduced motion: skip VFX, hanya toast. Reuse `eventWash` + white overlay |
| **Throw Up** | ✅ **Mudah** | Kartu glow di tengah → discard satu per satu reuse Batch animation → toast. Reduced motion: skip glow |
| **Steal** | ✅ **Bisa** | Reuse FlightLayer.tsx yang sudah ada untuk deal cards. Plus modal interaktif |
| **Favor** | ⚠️ **Tinggi + Audio aset** | Modal 2-step (pilih target → giver pilih kartu). State machine. FlightLayer arah balik. Heart particle |
| **Peek** | ✅ **Bisa** | Modal overlay grid player+kartu. Collapsible per player untuk banyak kartu. Progressive flip animation |
| **bust** | ✅ **Mudah** | Particle + kartu terbang ke discard. Reuse penalty VFX |
| **Vote** | ⚠️ **Modal** | Modal countdown + avatar vote. Particle hasil |
| **Time Skip** | ✅ **Sangat Mudah** | Lingkaran jam + particle skip di tiap seat |
| **Nuke** | ✅ **Mudah** | Lingkaran ekspansi + shockwave. Reuse penalty VFX |

### 5.2 SFX

| Sound | Feasibility | Teknik Synthesis |
|-------|-------------|-----------------|
| **Flashbang** | ⚠️ **Audio aset** | Bass pitch rise (procedural) + flashbang explosion (aset .mp3) + cat scream (aset .mp3). Untuk reduced motion: ganti dengan bunyi swap pendek procedural |
| **Throw Up** | ⚠️ **Audio aset** | Bass pitch down procedural + cat vomit (aset). Suara discard per kartu: reuse sound kartu biasa + pitch up |
| **Steal (evil laugh)** | ⚠️ **Cukup** | Ascending arpeggio triplet square wave + distortion. Alternatif: descending staccato |
| **Favor (awoowo)** | ⚠️ **Audio aset** | Awoo cat audio aset (ref: throw up video). Bass pitch down glow. Cancel = fizzle |
| **Peek (frog)** | ⚠️ **Audio aset** | Frog laugh audio aset. Bass pitch down glow. Action disable selama reveal |
| **bust** | ✅ **Bisa** | Low rumble (sine 40Hz) + noise burst + glass ting |
| **Nuke** | ✅ **Bisa** | Sama dengan bust tapi lebih besar |

Procedural synthesis = Web Audio API oscillators/noise/filters di sound.ts `render()`. Bisa juga pakai audio sprite (.ogg) untuk quality lebih baik.

### 5.3 Game Engine

| Efek | Complexity | Notes |
|------|-----------|-------|
| **Throw Up** | ✅ Rendah | Filter hand → discard. + completeRank check jika hand kosong. Fungsi 15 baris |
| **Flashbang** | ✅ Rendah | Random permutation of all hands. Fungsi 15 baris |
| **Peek** | ✅ Sedang | Flag reveal + kirim hand via snapshot. Perlu filter di snapshotFor() |
| **Steal** | ⚠️ Tinggi | State machine 2-step + modal interaktif. Obfuscate hand > 5. Kompensasi draw 2 |
| **Favor** | ⚠️ Tinggi | Modal 2-step (pilih target → giver pilih kartu). State machine. Cancel = fizzle. Tidak ada kompensasi |
| **bust >25** | ✅ Rendah | Cek di syncPlayerHandChange() + completeDraw() |
| **Vote** | ❓ Sulit | Multi-player input queue + timeout + tracking vote |

---

## 6. Prioritas Implementasi

### Fase 1 — Core

| Item | Est. Effort |
|------|-------------|
| Mode ID + shared types | 15 menit |
| Server mode file (deck, rules) | 1 jam |
| Engine: draw1/wild2 | 30 menit |
| Engine: bust check >25 | 1 jam |
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
  - [ ] `RoomSettings["modeId"]`: tambah `"chaos"`
  - [ ] `GameMode["id"]`: tambah `"chaos"`
  - [ ] `PresentationEventKind`: tambah `"flashbang"`, `"throwup"`, `"steal"`, `"favor"`, `"peek"`, `"chaosBust"`
  - [ ] `GameSnapshot`: tambah `revealedHands`, `pendingSteal`, `pendingFavor`
  - [ ] `roomSettingsSchema`: tambah `"chaos"` di enum
  - [ ] `roomSettingsUpdateSchema`: tambah `"chaos"` di enum
- [ ] `server/shared/src/index.ts` — mirror dari atas

### Server

- [ ] `server/src/engine/modes/chaos.ts` — file baru
  - [ ] `buildDeck()` — standard deck + meme cards
  - [ ] `isPlayable()` — meme card rules
  - [ ] `scoreHand()` — standard scoring
  - [ ] Export `chaosMode`
- [ ] `server/src/engine/game.ts`
  - [ ] Import `chaosMode`
  - [ ] `getMode()` — tambah case `"chaos"`
  - [ ] `applyPlayedCard()` — 5 case baru untuk meme cards
  - [ ] Fungsi `checkChaosBust()` — dipanggil setelah draw selesai
  - [ ] Fungsi `doFlashbang()` — collect + shuffle + redeal
  - [ ] Fungsi `doThrowUp()` — filter color → discard
  - [ ] Fungsi `startSteal()` / `resolveSteal()`
  - [ ] Fungsi `startFavor()` / `resolveFavor()`
  - [ ] Fungsi `startPeek()` — set revealed state + timeout
  - [ ] `GameStateInternal` — tambah `revealedHands`, `revealedUntil`, `pendingSteal`, `pendingFavor`
  - [ ] `snapshotFor()` — kirim `revealedHands` jika aktif
  - [ ] `syncPlayerHandChange()` — panggil `checkChaosBust()`

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
  - [ ] `EventVfx` — Chaos Bust (particle merah)
  - [ ] `eventWash()` — wash untuk tiap meme event
  - [ ] `toastContent()` — label/sublabel untuk tiap meme event
  - [ ] `eventPriority()` — priority baru
  - [ ] `eventToastDurationMs()` — duration baru
- [ ] `web/src/components/RoomClient.tsx`
  - [ ] Enable `"chaos"` di dropdown lobby
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
  - [ ] `lobby.modeChaos`: "Chaos"
  - [ ] `events.*` untuk meme events
  - [ ] `card.*` untuk meme card names
  - [ ] `rules.*` untuk mode description
- [ ] `web/messages/id.json`
  - [ ] `lobby.modeChaos`: "Chaos"
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
