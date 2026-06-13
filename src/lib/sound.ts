import type { UiEvent } from "./events";

export type SoundName = "turn" | "oneWindow" | "oneCalled" | "catch" | "wild" | "penalty" | "skip" | "reverse";

const STORAGE_KEY = "congcard:sound-muted";

// Per-note volumes below are mix ratios; this lifts the overall output to a
// clearly audible level without clipping (peaks stay under 0.9).
const MASTER_GAIN = 5;

let audioContext: AudioContext | null = null;

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
}

export function unlockSound(): void {
  if (typeof window === "undefined" || isSoundMuted() || !hasAudioContext()) {
    return;
  }

  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

export function soundForEvent(event: UiEvent): SoundName | null {
  switch (event.type) {
    case "yourTurn":
      return "turn";
    case "penalty":
      return "penalty";
    case "skip":
      return "skip";
    case "reverse":
      return "reverse";
    case "colorChange":
      return "wild";
    case "calledOne":
      return "oneCalled";
    case "catchWindow":
      return event.self ? "oneWindow" : "catch";
    default:
      return null;
  }
}

export function playUiEventSounds(events: UiEvent[]): void {
  for (const event of events) {
    const sound = soundForEvent(event);
    if (!sound) {
      continue;
    }

    if (event.type === "catchWindow" && typeof window !== "undefined") {
      window.setTimeout(() => playSound(sound), Math.max(0, event.opensAt - Date.now()));
    } else {
      playSound(sound);
    }
  }
}

export function playSound(name: SoundName): void {
  if (typeof window === "undefined" || isSoundMuted() || !hasAudioContext()) {
    return;
  }

  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const notes = soundNotes(name);

  notes.forEach((note, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + index * 0.075;
    const end = start + note.duration;

    osc.type = note.type;
    osc.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.9, note.volume * MASTER_GAIN), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio is not available.");
    }

    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function hasAudioContext(): boolean {
  return Boolean(window.AudioContext ?? window.webkitAudioContext);
}

function soundNotes(name: SoundName): Array<{ frequency: number; duration: number; volume: number; type: OscillatorType }> {
  switch (name) {
    case "turn":
      return [
        { frequency: 523, duration: 0.09, volume: 0.05, type: "sine" },
        { frequency: 784, duration: 0.13, volume: 0.06, type: "sine" }
      ];
    case "oneWindow":
      return [
        { frequency: 880, duration: 0.08, volume: 0.065, type: "triangle" },
        { frequency: 988, duration: 0.08, volume: 0.065, type: "triangle" },
        { frequency: 1175, duration: 0.12, volume: 0.07, type: "triangle" }
      ];
    case "oneCalled":
      return [
        { frequency: 659, duration: 0.08, volume: 0.06, type: "triangle" },
        { frequency: 1047, duration: 0.16, volume: 0.075, type: "triangle" }
      ];
    case "catch":
      return [
        { frequency: 330, duration: 0.08, volume: 0.065, type: "square" },
        { frequency: 247, duration: 0.12, volume: 0.06, type: "square" }
      ];
    case "wild":
      return [
        { frequency: 392, duration: 0.06, volume: 0.05, type: "sine" },
        { frequency: 523, duration: 0.06, volume: 0.055, type: "sine" },
        { frequency: 659, duration: 0.11, volume: 0.06, type: "sine" }
      ];
    case "penalty":
      return [
        { frequency: 196, duration: 0.1, volume: 0.065, type: "sawtooth" },
        { frequency: 147, duration: 0.16, volume: 0.06, type: "sawtooth" }
      ];
    case "skip":
      return [{ frequency: 220, duration: 0.16, volume: 0.055, type: "square" }];
    case "reverse":
      return [
        { frequency: 740, duration: 0.07, volume: 0.045, type: "triangle" },
        { frequency: 554, duration: 0.07, volume: 0.05, type: "triangle" },
        { frequency: 415, duration: 0.12, volume: 0.055, type: "triangle" }
      ];
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
