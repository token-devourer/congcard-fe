import type { UiEvent } from "./events";
import { audioAvailable, sfxDestination, sharedAudioContext, unlockAudio } from "./audio";
import { duckMusic } from "./music";
import { safeGet, safeSet } from "./storage";

export type SoundName =
  | "turn"
  | "turnAlert"
  | "oneWindow"
  | "oneCalled"
  | "catch"
  | "wild"
  | "stack"
  | "matchChain"
  | "batchFinale"
  | "drawTick"
  | "dealTick"
  | "shuffle"
  | "shuffleSettle"
  | "flipSweep"
  | "flipImpact"
  | "flipLight"
  | "flipDark"
  | "opening"
  | "dealComplete"
  | "penalty"
  | "skip"
  | "reverse"
  | "win"
  | "lose"
  | "jumpIn"
  | "uiHover"
  | "uiClick";

const STORAGE_KEY = "congcard:sound-muted";
export const TURN_ALERT_SOUND: SoundName = "turnAlert";

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  return safeGet(STORAGE_KEY) === "1";
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  safeSet(STORAGE_KEY, muted ? "1" : "0");
}

export function unlockSound(): void {
  if (typeof window === "undefined" || isSoundMuted()) return;
  unlockAudio();
}

// Bell-style idle-turn alert. Playback still needs a prior user gesture.
export function playTurnAlert(): void {
  if (typeof window === "undefined" || isSoundMuted() || !audioAvailable()) return;
  const ctx = sharedAudioContext();
  unlockAudio();
  const t0 = ctx.currentTime + 0.005;
  render(TURN_ALERT_SOUND, ctx, t0, 1);
}

export function soundForEvent(event: UiEvent): SoundName | null {
  switch (event.type) {
    case "yourTurn": return "turn";
    case "penalty": return "penalty";
    case "skip": return "skip";
    case "reverse": return "reverse";
    case "colorChange": return "wild";
    case "stack": return "stack";
    case "matchChain": return "matchChain";
    case "calledOne": return "oneCalled";
    case "catchWindow": return event.self ? "oneWindow" : "catch";
    case "roundWon": return "win";
    case "roundLost": return "lose";
    case "jumpIn": return "jumpIn";
    default: return null;
  }
}
export function playUiEventSounds(events: UiEvent[], clockOffset = 0): void {
  for (const event of events) {
    const sound = soundForEvent(event);
    if (!sound) continue;
    const serverStart = event.type === "catchWindow" ? event.opensAt : event.startsAt;
    const startsInMs = serverStart ? Math.max(0, serverStart - (Date.now() + clockOffset)) : 0;
    const level = event.type === "stack" || event.type === "matchChain"
      ? event.level
      : event.type === "skip" || event.type === "reverse" || event.type === "colorChange"
        ? event.level ?? 1
        : 1;
    playSoundAt(sound, startsInMs, level);
      if (["penalty", "skip", "reverse", "colorChange", "stack", "jumpIn", "calledOne", "roundWon", "roundLost"].includes(event.type)) {
        duckMusic(startsInMs, event.type === "roundWon" || event.type === "roundLost" ? 1_600 : event.type === "jumpIn" ? 520 : 760);
    }
  }
}

function playSoundAt(name: SoundName, startsInMs: number, level = 1): void {
  if (typeof window === "undefined" || isSoundMuted() || !audioAvailable()) return;
  const ctx = sharedAudioContext();
  unlockAudio();
  render(name, ctx, ctx.currentTime + Math.max(0.005, startsInMs / 1000), level);
}
export function playSound(name: SoundName, level = 1): void {
  if (typeof window === "undefined" || isSoundMuted() || !audioAvailable()) return;
  const ctx = sharedAudioContext();
  unlockAudio();
  const t0 = ctx.currentTime + 0.005;
  render(name, ctx, t0, level);
}

function pitchedLevel(level: number): { level: number; ratio: number } {
  const capped = Math.min(8, Math.max(1, Math.round(level)));
  return { level: capped, ratio: 2 ** (((capped - 1) * 2) / 12) };
}

function dest(): AudioNode {
  return sfxDestination();
}

/** A musical "tone" with attack/decay envelope, optional detune layer, and lowpass shaping. */
function tone(
  ctx: AudioContext,
  start: number,
  opts: {
    freq: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    detune?: number;
    sweepTo?: number;
    lp?: number;
    attack?: number;
  }
): void {
  const { freq, dur, type = "sine", gain = 0.25, detune = 0, sweepTo, lp = 6000, attack = 0.008 } = opts;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lp;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), start + dur);
  if (detune) osc.detune.value = detune;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(filter);
  filter.connect(g);
  g.connect(dest());
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/** Short percussive noise burst (clap/snare-like). */
function noise(
  ctx: AudioContext,
  start: number,
  opts: { dur: number; gain?: number; lp?: number; hp?: number }
): void {
  const { dur, gain = 0.3, lp = 6000, hp = 200 } = opts;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hpF = ctx.createBiquadFilter();
  hpF.type = "highpass";
  hpF.frequency.value = hp;
  const lpF = ctx.createBiquadFilter();
  lpF.type = "lowpass";
  lpF.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(hpF);
  hpF.connect(lpF);
  lpF.connect(g);
  g.connect(dest());
  src.start(start);
  src.stop(start + dur + 0.02);
}

// Small helpers for tasteful per-event variation. We keep musical intent intact
// (same chord shape, same envelope feel) and only nudge cents/timing/volume so
// repeated triggers don't feel like a soundboard.
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function render(name: SoundName, ctx: AudioContext, t: number, level = 1): void {
  switch (name) {
    case "turn": {
      // Pick one of three short ascending motifs in major. Slight detune + jitter.
      const motifs: Array<[number, number]> = [
        [523.25, 659.25], // C5 -> E5
        [587.33, 739.99], // D5 -> F#5
        [493.88, 622.25]  // B4 -> D#5
      ];
      const [a, b] = pick(motifs);
      const cents = rand(-6, 6);
      const vol = rand(0.2, 0.26);
      tone(ctx, t,            { freq: a, dur: 0.18, type: "sine",     gain: vol,        lp: 4000, detune: cents });
      tone(ctx, t + rand(0.07, 0.09), { freq: b, dur: 0.22, type: "sine", gain: vol,    lp: 4000, detune: cents });
      tone(ctx, t + 0.08,     { freq: b * 2, dur: 0.22, type: "sine",  gain: rand(0.05, 0.08), lp: 6000 });
      // Optional sparkle on top — only sometimes, so it feels alive.
      if (Math.random() < 0.5) {
        tone(ctx, t + rand(0.1, 0.16), { freq: b * 3, dur: 0.14, type: "triangle", gain: 0.04, lp: 7000 });
      }
      break;
    }
    case "turnAlert": {
      tone(ctx, t, { freq: 988, dur: 0.16, type: "triangle", gain: 0.24, lp: 7200, attack: 0.004 });
      tone(ctx, t + 0.12, { freq: 1318, dur: 0.18, type: "triangle", gain: 0.26, lp: 7600, attack: 0.004 });
      tone(ctx, t + 0.28, { freq: 1760, dur: 0.46, type: "sine", gain: 0.16, lp: 8200, attack: 0.006 });
      tone(ctx, t + 0.28, { freq: 880, dur: 0.42, type: "triangle", gain: 0.09, lp: 5200, attack: 0.006 });
      noise(ctx, t + 0.04, { dur: 0.06, gain: 0.08, hp: 3200, lp: 9500 });
      break;
    }
    case "oneWindow": {
      tone(ctx, t,        { freq: 880,  dur: 0.09, type: "triangle", gain: 0.22 });
      tone(ctx, t + 0.07, { freq: 1108, dur: 0.09, type: "triangle", gain: 0.22 });
      tone(ctx, t + 0.14, { freq: 1318, dur: 0.16, type: "triangle", gain: 0.26 });
      tone(ctx, t + 0.14, { freq: 1318, dur: 0.16, type: "sine",     gain: 0.12, detune: 8 });
      break;
    }
    case "oneCalled": {
      tone(ctx, t,        { freq: 523,  dur: 0.08, type: "square",   gain: 0.18, lp: 2400 });
      tone(ctx, t + 0.06, { freq: 784,  dur: 0.12, type: "square",   gain: 0.2,  lp: 2800 });
      tone(ctx, t + 0.16, { freq: 1046, dur: 0.28, type: "triangle", gain: 0.22, lp: 5000 });
      tone(ctx, t + 0.16, { freq: 2093, dur: 0.28, type: "sine",     gain: 0.07 });
      break;
    }
    case "catch": {
      // Slap timbre varies: sharper crack vs. duller thump. Taunt pitch wobbles.
      const crack = Math.random() < 0.5;
      noise(ctx, t, {
        dur: rand(0.07, 0.11),
        gain: rand(0.36, 0.48),
        hp: crack ? 1600 : 900,
        lp: crack ? 8000 : 5500
      });
      const startFreq = rand(400, 500);
      tone(ctx, t + 0.02, {
        freq: startFreq, dur: 0.18, type: "sawtooth",
        gain: rand(0.2, 0.26), sweepTo: rand(150, 210), lp: 1800
      });
      tone(ctx, t + rand(0.16, 0.2), {
        freq: rand(200, 240), dur: 0.18, type: "square",
        gain: rand(0.14, 0.18), lp: 1400
      });
      // 40% chance of a final cheeky "ha" tick on top.
      if (Math.random() < 0.4) {
        tone(ctx, t + 0.32, { freq: rand(700, 900), dur: 0.07, type: "triangle", gain: 0.1, lp: 3500 });
      }
      break;
    }
    case "wild": {
      // Four-tone shimmer, but pick a starting key and direction each time.
      const transpose = pitchedLevel(level).ratio;
      const scales: number[][] = [
        [392, 523, 659, 784],   // G major-ish
        [440, 554, 659, 880],   // A
        [349, 466, 587, 698],   // F
        [493, 622, 740, 988]    // B
      ];
      const scale = pick(scales).slice();
      if (Math.random() < 0.35) scale.reverse(); // sometimes descending
      const step = rand(0.045, 0.06);
      scale.forEach((f, i) => {
        tone(ctx, t + i * step, {
          freq: f * transpose * (1 + rand(-0.003, 0.003)),
          dur: 0.16, type: "sine", gain: rand(0.15, 0.2), lp: 5000
        });
      });
      // Bell tail — pitch picked from last tone × harmonic.
      const tail = scale[scale.length - 1] * transpose * (Math.random() < 0.5 ? 2 : 3);
      tone(ctx, t + 0.2, { freq: tail, dur: rand(0.34, 0.46), type: "triangle", gain: rand(0.06, 0.1), lp: 6000 });
      break;
    }
    case "stack": {
      const { level: pitchLevel, ratio } = pitchedLevel(level);
      const root = 392 * ratio;
      const gain = 0.15 + pitchLevel * 0.025;
      tone(ctx, t, { freq: root, dur: 0.09, type: "square", gain, lp: 2600 });
      tone(ctx, t + 0.06, { freq: root * 1.5, dur: 0.11, type: "triangle", gain: gain + 0.02, lp: 4200 });
      tone(ctx, t + 0.13, { freq: root * 2, dur: 0.16, type: "sine", gain: gain * 0.75, lp: 6000 });
      noise(ctx, t + 0.015, { dur: 0.06, gain: 0.12 + pitchLevel * 0.025, hp: 1500 + pitchLevel * 250, lp: 8000 });
      break;
    }
    case "drawTick": {
      const { level: pitchLevel, ratio } = pitchedLevel(level);
      const root = 523 * ratio;
      tone(ctx, t, { freq: root, dur: 0.055, type: "triangle", gain: 0.12 + pitchLevel * 0.018, lp: 5200 });
      tone(ctx, t + 0.04, { freq: root * 1.5, dur: 0.08, type: "sine", gain: 0.07 + pitchLevel * 0.012, lp: 6500 });
      noise(ctx, t, { dur: 0.035, gain: 0.045 + pitchLevel * 0.01, hp: 2600, lp: 9000 });
      break;
    }
    case "dealTick": {
      const { level: pitchLevel, ratio } = pitchedLevel(level);
      const root = 392 * ratio;
      tone(ctx, t, { freq: root, dur: 0.065, type: "triangle", gain: 0.1 + pitchLevel * 0.012, lp: 4600 });
      noise(ctx, t, { dur: 0.028, gain: 0.04, hp: 1800, lp: 7200 });
      break;
    }
    case "shuffle": {
      for (let index = 0; index < 12; index += 1) {
        noise(ctx, t + index * 0.12, { dur: 0.085, gain: 0.12 + index * 0.006, hp: 700 + index * 110, lp: 6200 });
        tone(ctx, t + index * 0.12, { freq: 170 + index * 28, dur: 0.075, type: "triangle", gain: 0.06, lp: 2100 });
      }
      break;
    }
    case "shuffleSettle": {
      noise(ctx, t, { dur: 0.12, gain: 0.22, hp: 180, lp: 2200 });
      tone(ctx, t, { freq: 150, dur: 0.2, type: "triangle", gain: 0.2, sweepTo: 95, lp: 1500 });
      tone(ctx, t + 0.05, { freq: 659, dur: 0.28, type: "sine", gain: 0.1, lp: 5600 });
      break;
    }
    case "flipSweep": {
      noise(ctx, t, { dur: 0.24, gain: 0.14, hp: 900, lp: 7600 });
      noise(ctx, t + 0.07, { dur: 0.16, gain: 0.07, hp: 1600, lp: 8600 });
      break;
    }
    case "flipImpact": {
      const { ratio } = pitchedLevel(level);
      noise(ctx, t, { dur: 0.1, gain: 0.2, hp: 180, lp: 3600 });
      tone(ctx, t, { freq: 146.83 * ratio, dur: 0.24, type: "sine", gain: 0.14, lp: 1500 });
      break;
    }
    case "flipLight": {
      const { ratio } = pitchedLevel(level);
      [293.66, 329.63, 369.99, 392, 440, 587.33].forEach((freq, index) => {
        tone(ctx, t + index * 0.07, {
          freq: freq * ratio,
          dur: 0.22 + index * 0.018,
          type: "triangle",
          gain: 0.09,
          lp: 7600,
          attack: 0.004
        });
      });
      tone(ctx, t + 0.35, { freq: 1174.66 * ratio, dur: 0.38, type: "sine", gain: 0.065, lp: 8600, attack: 0.005 });
      break;
    }
    case "flipDark": {
      const { ratio } = pitchedLevel(level);
      [440, 392, 349.23, 329.63, 293.66, 220].forEach((freq, index) => {
        tone(ctx, t + index * 0.075, {
          freq: freq * ratio,
          dur: 0.23 + index * 0.02,
          type: "triangle",
          gain: 0.09,
          lp: 3000,
          attack: 0.004
        });
      });
      tone(ctx, t + 0.37, { freq: 146.83 * ratio, dur: 0.42, type: "sine", gain: 0.065, lp: 1900, attack: 0.005 });
      break;
    }
    case "opening": {
      tone(ctx, t, { freq: 392, dur: 0.12, type: "triangle", gain: 0.16, lp: 4400 });
      tone(ctx, t + 0.1, { freq: 587, dur: 0.24, type: "sine", gain: 0.18, lp: 6200 });
      noise(ctx, t + 0.08, { dur: 0.06, gain: 0.09, hp: 2200, lp: 8200 });
      break;
    }
    case "dealComplete": {
      [523, 659, 784].forEach((freq, index) => {
        tone(ctx, t + index * 0.07, { freq, dur: 0.3, type: "triangle", gain: 0.14, lp: 6000 });
      });
      tone(ctx, t + 0.14, { freq: 1046, dur: 0.42, type: "sine", gain: 0.1, lp: 7600 });
      break;
    }
    case "matchChain": {
      const { level: pitchLevel, ratio } = pitchedLevel(level);
      const root = 440 * ratio;
      const gain = 0.13 + pitchLevel * 0.025;
      tone(ctx, t, { freq: root, dur: 0.07, type: "triangle", gain, lp: 4200 });
      tone(ctx, t + 0.055, { freq: root * 1.5, dur: 0.09, type: "square", gain: gain * 0.78, lp: 3000 });
      tone(ctx, t + 0.12, { freq: root * 2, dur: 0.13, type: "sine", gain: gain * 0.6, lp: 6200 });
      noise(ctx, t + 0.01, { dur: 0.045, gain: 0.08 + pitchLevel * 0.015, hp: 2200 + pitchLevel * 260, lp: 8500 });
      break;
    }
      case "jumpIn": {
        noise(ctx, t, { dur: 0.03, gain: 0.12, hp: 3000, lp: 9000 });
        tone(ctx, t + 0.002, { freq: 740, dur: 0.07, type: "triangle", gain: 0.14, lp: 5600 });
        tone(ctx, t + 0.03, { freq: 988, dur: 0.09, type: "square", gain: 0.18, lp: 3600, sweepTo: 740 });
        tone(ctx, t + 0.08, { freq: 1480, dur: 0.14, type: "sine", gain: 0.07, lp: 8200 });
        break;
      }
    case "batchFinale": {
      // Triumphant climax for the end of a batch: a quick ascending run into a
      // bright sustained major chord, shimmer harmonics, and a celebratory swell.
      // Scales grander (higher, fuller, louder) with batch size via `level`.
      const { level: size, ratio } = pitchedLevel(level);
      const root = 523.25 * ratio;
      const grand = 0.18 + size * 0.02;

      const run = [root * 0.5, root * 0.63, root * 0.75, root];
      run.forEach((freq, i) => {
        tone(ctx, t + i * 0.05, { freq, dur: 0.12, type: "triangle", gain: 0.14 + i * 0.02, lp: 6000, attack: 0.004 });
      });

      const chordStart = t + run.length * 0.05;
      const chord = [root, root * 1.25, root * 1.5, root * 2];
      chord.forEach((freq, i) => {
        tone(ctx, chordStart, {
          freq,
          dur: 0.55 + i * 0.05,
          type: "triangle",
          gain: grand * (1 - i * 0.12),
          lp: 7500,
          detune: rand(-5, 5),
          attack: 0.006
        });
      });
      if (size >= 3) {
        tone(ctx, chordStart, { freq: root * 0.5, dur: 0.6, type: "sine", gain: grand * 0.5, lp: 3000 });
      }

      tone(ctx, chordStart + 0.06, { freq: root * 3, dur: 0.5, type: "sine", gain: 0.07 + size * 0.008, lp: 9000 });
      tone(ctx, chordStart + 0.12, { freq: root * 4, dur: 0.4, type: "sine", gain: 0.05, lp: 9500 });

      noise(ctx, t, { dur: 0.1, gain: 0.08, hp: 3000, lp: 9000 });
      noise(ctx, chordStart, { dur: 0.22, gain: 0.1 + size * 0.01, hp: 2400, lp: 9500 });
      break;
    }
    case "penalty": {
      // Heavy hit, but vary depth + buzz so a Draw 2 vs Draw 4 streak doesn't loop.
      const deep = Math.random() < 0.5;
      noise(ctx, t, { dur: rand(0.16, 0.22), gain: rand(0.45, 0.55), hp: 50, lp: deep ? 700 : 950 });
      const root = deep ? rand(95, 115) : rand(120, 140);
      tone(ctx, t, {
        freq: root, dur: 0.28, type: "sawtooth",
        gain: rand(0.28, 0.34), sweepTo: root * 0.5, lp: 700
      });
      tone(ctx, t + rand(0.04, 0.07), {
        freq: root * 0.66, dur: 0.32, type: "square",
        gain: rand(0.16, 0.2), lp: 600
      });
      // Occasional metallic clang for variety.
      if (Math.random() < 0.35) {
        tone(ctx, t + 0.02, { freq: rand(180, 240), dur: 0.18, type: "square", gain: 0.08, lp: 1800, detune: 14 });
      }
      break;
    }
    case "skip": {
      const { ratio } = pitchedLevel(level);
      const root = 660 * ratio;
      noise(ctx, t, { dur: 0.06, gain: 0.38, hp: 2500, lp: 9000 });
      tone(ctx, t + 0.01, { freq: root, dur: 0.1, type: "square", gain: 0.18, sweepTo: root / 3, lp: 2200 });
      break;
    }
    case "reverse": {
      const { ratio } = pitchedLevel(level);
      const high = 880 * ratio;
      const low = 330 * ratio;
      tone(ctx, t,        { freq: high, dur: 0.18, type: "triangle", gain: 0.18, sweepTo: low, lp: 3500 });
      tone(ctx, t + 0.16, { freq: low, dur: 0.22, type: "triangle", gain: 0.2,  sweepTo: high * 1.125, lp: 4500 });
      noise(ctx, t + 0.04, { dur: 0.18, gain: 0.12, hp: 600, lp: 3500 });
      break;
    }
    case "win": {
      const roots = [523.25, 587.33, 659.25];
      const root = pick(roots);
      const chord = [root, root * 1.25, root * 1.5, root * 2];
      noise(ctx, t + 0.02, { dur: 0.12, gain: 0.1, hp: 3200, lp: 9000 });
      chord.forEach((freq, index) => {
        tone(ctx, t + index * 0.08, {
          freq,
          dur: 0.28 + index * 0.04,
          type: "triangle",
          gain: 0.16,
          lp: 7000,
          detune: rand(-4, 4)
        });
      });
      tone(ctx, t + 0.2, { freq: root * 3, dur: 0.45, type: "sine", gain: 0.07, lp: 8500 });
      noise(ctx, t + 0.34, { dur: 0.16, gain: 0.08, hp: 2600, lp: 8500 });
      break;
    }
    case "lose": {
      tone(ctx, t,        { freq: 392, dur: 0.2,  type: "triangle", gain: 0.15, lp: 3200 });
      tone(ctx, t + 0.13, { freq: 330, dur: 0.24, type: "triangle", gain: 0.13, lp: 2800 });
      tone(ctx, t + 0.28, { freq: 247, dur: 0.42, type: "sine",     gain: 0.15, lp: 2100, sweepTo: 220 });
      noise(ctx, t + 0.12, { dur: 0.16, gain: 0.06, hp: 280, lp: 1200 });
      break;
    }
    case "uiHover": {
      const root = pick([1480, 1568, 1660, 1760]);
      tone(ctx, t, {
        freq: root,
        dur: 0.06,
        type: "sine",
        gain: rand(0.045, 0.07),
        lp: 7000,
        attack: 0.003
      });
      tone(ctx, t + 0.008, {
        freq: root * 1.5,
        dur: 0.05,
        type: "triangle",
        gain: rand(0.02, 0.035),
        lp: 8000
      });
      break;
    }
    case "uiClick": {
      noise(ctx, t, { dur: 0.025, gain: rand(0.18, 0.24), hp: 3200, lp: 9000 });
      const root = pick([880, 988, 1046, 1175]);
      tone(ctx, t + 0.005, {
        freq: root,
        dur: 0.09,
        type: "triangle",
        gain: rand(0.14, 0.18),
        lp: 5500,
        attack: 0.003
      });
      tone(ctx, t + 0.012, {
        freq: root * 2,
        dur: 0.16,
        type: "sine",
        gain: rand(0.06, 0.09),
        lp: 7500
      });
      break;
    }
  }
}
