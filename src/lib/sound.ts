import type { UiEvent } from "./events";

export type SoundName =
  | "turn"
  | "oneWindow"
  | "oneCalled"
  | "catch"
  | "wild"
  | "penalty"
  | "skip"
  | "reverse";

const STORAGE_KEY = "congcard:sound-muted";
const MASTER = 0.55;

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
}

export function unlockSound(): void {
  if (typeof window === "undefined" || isSoundMuted() || !hasAudioContext()) return;
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

export function soundForEvent(event: UiEvent): SoundName | null {
  switch (event.type) {
    case "yourTurn": return "turn";
    case "penalty": return "penalty";
    case "skip": return "skip";
    case "reverse": return "reverse";
    case "colorChange": return "wild";
    case "calledOne": return "oneCalled";
    case "catchWindow": return event.self ? "oneWindow" : "catch";
    default: return null;
  }
}

export function playUiEventSounds(events: UiEvent[]): void {
  for (const event of events) {
    const sound = soundForEvent(event);
    if (!sound) continue;
    if (event.type === "catchWindow" && typeof window !== "undefined") {
      window.setTimeout(() => playSound(sound), Math.max(0, event.opensAt - Date.now()));
    } else {
      playSound(sound);
    }
  }
}

export function playSound(name: SoundName): void {
  if (typeof window === "undefined" || isSoundMuted() || !hasAudioContext()) return;
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime + 0.005;
  render(name, ctx, t0);
}

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio is not available.");
    audioContext = new AC();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER;
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

function hasAudioContext(): boolean {
  return Boolean(window.AudioContext ?? window.webkitAudioContext);
}

function dest(): AudioNode {
  return masterGain ?? getAudioContext().destination;
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

function render(name: SoundName, ctx: AudioContext, t: number): void {
  switch (name) {
    case "turn": {
      // Two warm sine bells, a triumphant little major-third lift.
      tone(ctx, t, { freq: 523.25, dur: 0.18, type: "sine", gain: 0.22, lp: 4000 });
      tone(ctx, t + 0.08, { freq: 659.25, dur: 0.22, type: "sine", gain: 0.22, lp: 4000 });
      tone(ctx, t + 0.08, { freq: 1318.5, dur: 0.22, type: "sine", gain: 0.06, lp: 6000 });
      break;
    }
    case "oneWindow": {
      // Urgent ascending arpeggio — your moment to slam ONE.
      tone(ctx, t, { freq: 880, dur: 0.09, type: "triangle", gain: 0.22 });
      tone(ctx, t + 0.07, { freq: 1108, dur: 0.09, type: "triangle", gain: 0.22 });
      tone(ctx, t + 0.14, { freq: 1318, dur: 0.16, type: "triangle", gain: 0.26 });
      tone(ctx, t + 0.14, { freq: 1318, dur: 0.16, type: "sine", gain: 0.12, detune: 8 });
      break;
    }
    case "oneCalled": {
      // Royal fanfare — a single bright stab with a sparkle tail.
      tone(ctx, t, { freq: 523, dur: 0.08, type: "square", gain: 0.18, lp: 2400 });
      tone(ctx, t + 0.06, { freq: 784, dur: 0.12, type: "square", gain: 0.2, lp: 2800 });
      tone(ctx, t + 0.16, { freq: 1046, dur: 0.28, type: "triangle", gain: 0.22, lp: 5000 });
      tone(ctx, t + 0.16, { freq: 2093, dur: 0.28, type: "sine", gain: 0.07 });
      break;
    }
    case "catch": {
      // Slap + descending taunt — someone forgot, you pounce.
      noise(ctx, t, { dur: 0.09, gain: 0.42, hp: 1200, lp: 7000 });
      tone(ctx, t + 0.02, { freq: 440, dur: 0.18, type: "sawtooth", gain: 0.22, sweepTo: 180, lp: 1800 });
      tone(ctx, t + 0.18, { freq: 220, dur: 0.18, type: "square", gain: 0.16, lp: 1400 });
      break;
    }
    case "wild": {
      // Color-cycling shimmer: rising whole-tone arpeggio with bell harmonic.
      const freqs = [392, 523, 659, 784];
      freqs.forEach((f, i) => {
        tone(ctx, t + i * 0.05, { freq: f, dur: 0.16, type: "sine", gain: 0.18, lp: 5000 });
      });
      tone(ctx, t + 0.2, { freq: 1568, dur: 0.4, type: "triangle", gain: 0.08, lp: 6000 });
      break;
    }
    case "penalty": {
      // Heavy low thud + buzz — wajib narik kartu.
      noise(ctx, t, { dur: 0.18, gain: 0.5, hp: 60, lp: 800 });
      tone(ctx, t, { freq: 110, dur: 0.28, type: "sawtooth", gain: 0.32, sweepTo: 55, lp: 700 });
      tone(ctx, t + 0.05, { freq: 73, dur: 0.32, type: "square", gain: 0.18, lp: 600 });
      break;
    }
    case "skip": {
      // Sharp "tsk" — denied.
      noise(ctx, t, { dur: 0.06, gain: 0.38, hp: 2500, lp: 9000 });
      tone(ctx, t + 0.01, { freq: 660, dur: 0.1, type: "square", gain: 0.18, sweepTo: 220, lp: 2200 });
      break;
    }
    case "reverse": {
      // Whoosh: descending then ascending glide.
      tone(ctx, t, { freq: 880, dur: 0.18, type: "triangle", gain: 0.18, sweepTo: 330, lp: 3500 });
      tone(ctx, t + 0.16, { freq: 330, dur: 0.22, type: "triangle", gain: 0.2, sweepTo: 990, lp: 4500 });
      noise(ctx, t + 0.04, { dur: 0.18, gain: 0.12, hp: 600, lp: 3500 });
      break;
    }
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
