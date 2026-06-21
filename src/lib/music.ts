import type { GameSnapshot } from "@congcard/shared";
import { audioAvailable, sharedAudioContext, unlockAudio } from "./audio";
import { safeGet, safeSet } from "./storage";

export type MusicScene = "lobby" | "play" | "flipDark";

interface SynthNote {
  step: number;
  frequency: number;
  durationSteps: number;
  type: OscillatorType;
  gain: number;
  cutoff: number;
}

interface TrackDefinition {
  bpm: number;
  lengthSteps: number;
  notes: readonly SynthNote[];
}

const MUSIC_STORAGE_KEY = "congcard:music-muted";
const MUSIC_VOLUME_KEY = "congcard:music-volume";
const MUSIC_MASTER_GAIN = 0.65;
// Per-note gains in the track tables are authored very low; scale them up here so
// the bed sits clearly under the SFX instead of being inaudible (~6x louder).
const NOTE_GAIN_SCALE = 3.4;
const CROSSFADE_SECONDS = 1.5;
const FLIP_FADE_IN_SECONDS = 0.75;
const LOOKAHEAD_MS = 250;
const SCHEDULE_AHEAD_SECONDS = 2;

const note = (
  step: number,
  frequency: number,
  durationSteps: number,
  type: OscillatorType,
  gain: number,
  cutoff: number
): SynthNote => ({ step, frequency, durationSteps, type, gain, cutoff });

type CanonMelodyNote = readonly [offset: number, frequency: number, durationSteps?: number];

interface CanonBar {
  bass: number;
  chord: readonly [number, number, number];
  melody: readonly CanonMelodyNote[];
}

function buildCanonTrack(
  bpm: number,
  bars: readonly CanonBar[],
  timbre: { bassCutoff: number; chordCutoff: number; melodyCutoff: number; melodyGain: number }
): TrackDefinition {
  const notes = bars.flatMap((bar, barIndex) => {
    const step = barIndex * 16;
    const isClosingBar = barIndex === bars.length - 1;
    const bedDuration = isClosingBar ? 17 : 16;
    const chordNotes = bar.chord.map((frequency, chordIndex) =>
      note(
        step,
        frequency,
        isClosingBar && chordIndex > 0 ? 16 : bedDuration,
        "sine",
        chordIndex === 0 ? 0.009 : 0.008,
        timbre.chordCutoff
      )
    );
    const melodyNotes = bar.melody.map(([offset, frequency, durationSteps = 3]) =>
      note(step + offset, frequency, durationSteps, "triangle", timbre.melodyGain, timbre.melodyCutoff)
    );
    return [note(step, bar.bass, bedDuration, "sine", 0.032, timbre.bassCutoff), ...chordNotes, ...melodyNotes];
  });

  return { bpm, lengthSteps: bars.length * 16, notes };
}

const LIGHT_CANON_BARS: readonly CanonBar[] = [
  { bass: 146.83, chord: [293.66, 369.99, 440], melody: [[0, 739.99], [4, 659.25], [8, 587.33], [12, 554.37]] },
  { bass: 110, chord: [220, 277.18, 329.63], melody: [[0, 493.88], [4, 440], [8, 493.88], [12, 554.37]] },
  { bass: 123.47, chord: [246.94, 293.66, 369.99], melody: [[0, 587.33], [4, 554.37], [8, 493.88], [12, 440]] },
  { bass: 92.5, chord: [185, 220, 277.18], melody: [[0, 440], [4, 554.37], [8, 739.99], [12, 659.25]] },
  { bass: 98, chord: [196, 246.94, 293.66], melody: [[0, 587.33], [4, 493.88], [8, 392], [12, 440]] },
  { bass: 146.83, chord: [293.66, 369.99, 440], melody: [[0, 369.99], [4, 440], [8, 587.33], [12, 739.99]] },
  { bass: 98, chord: [196, 246.94, 293.66], melody: [[0, 783.99], [4, 739.99], [8, 659.25], [12, 587.33]] },
  { bass: 110, chord: [220, 277.18, 329.63], melody: [[0, 554.37], [4, 493.88], [8, 440], [12, 440, 5]] }
];

const DARK_CANON_BARS: readonly CanonBar[] = [
  { bass: 146.83, chord: [293.66, 349.23, 440], melody: [[0, 698.46], [4, 659.25], [8, 587.33], [12, 523.25]] },
  { bass: 110, chord: [220, 261.63, 329.63], melody: [[0, 466.16], [4, 440], [8, 466.16], [12, 523.25]] },
  { bass: 116.54, chord: [233.08, 293.66, 349.23], melody: [[0, 587.33], [4, 523.25], [8, 466.16], [12, 440]] },
  { bass: 87.31, chord: [174.61, 220, 261.63], melody: [[0, 440], [4, 523.25], [8, 698.46], [12, 659.25]] },
  { bass: 130.81, chord: [261.63, 329.63, 392], melody: [[0, 783.99], [4, 659.25], [8, 523.25], [12, 587.33]] },
  { bass: 98, chord: [196, 233.08, 293.66], melody: [[0, 466.16], [4, 587.33], [8, 783.99], [12, 698.46]] },
  { bass: 116.54, chord: [233.08, 293.66, 349.23], melody: [[0, 698.46], [4, 587.33], [8, 466.16], [12, 440]] },
  { bass: 110, chord: [220, 277.18, 329.63], melody: [[0, 554.37], [4, 493.88], [8, 440], [12, 440, 5]] }
];

export const MUSIC_TRACKS: Readonly<Record<MusicScene, TrackDefinition>> = {
  lobby: {
    bpm: 70,
    lengthSteps: 64,
    notes: [
      note(0, 130.81, 14, "sine", 0.045, 1800), note(0, 261.63, 14, "triangle", 0.025, 2600),
      note(0, 329.63, 14, "sine", 0.018, 2400), note(0, 392, 14, "sine", 0.016, 2400),
      note(16, 110, 14, "sine", 0.045, 1800), note(16, 220, 14, "triangle", 0.024, 2500),
      note(16, 261.63, 14, "sine", 0.018, 2400), note(16, 329.63, 14, "sine", 0.016, 2400),
      note(32, 87.31, 14, "sine", 0.044, 1700), note(32, 174.61, 14, "triangle", 0.024, 2400),
      note(32, 220, 14, "sine", 0.018, 2300), note(32, 261.63, 14, "sine", 0.016, 2300),
      note(48, 98, 14, "sine", 0.045, 1750), note(48, 196, 14, "triangle", 0.024, 2500),
      note(48, 246.94, 14, "sine", 0.018, 2400), note(48, 293.66, 14, "sine", 0.016, 2400),
      note(8, 392, 2, "sine", 0.02, 3200), note(12, 440, 2, "sine", 0.018, 3200),
      note(24, 329.63, 2, "sine", 0.019, 3200), note(28, 392, 2, "sine", 0.018, 3200),
      note(40, 261.63, 2, "sine", 0.019, 3000), note(44, 329.63, 2, "sine", 0.018, 3100),
      note(56, 293.66, 2, "sine", 0.019, 3100), note(60, 261.63, 3, "sine", 0.018, 3000),
      // Gentle twinkles to lift the welcome mood.
      note(6, 783.99, 2, "sine", 0.012, 5000), note(22, 659.25, 2, "sine", 0.012, 5000),
      note(38, 698.46, 2, "sine", 0.012, 4800), note(54, 587.33, 2, "sine", 0.012, 4800)
    ]
  },
  play: buildCanonTrack(104, LIGHT_CANON_BARS, {
    bassCutoff: 1650,
    chordCutoff: 2600,
    melodyCutoff: 4200,
    melodyGain: 0.02
  }),
  flipDark: buildCanonTrack(100, DARK_CANON_BARS, {
    bassCutoff: 1400,
    chordCutoff: 2100,
    melodyCutoff: 3400,
    melodyGain: 0.019
  })
};

let requestedScene: MusicScene | null = null;
let activeScene: MusicScene | null = null;
let activeBus: GainNode | null = null;
let musicMaster: GainNode | null = null;
let schedulerId: number | null = null;
let nextCycleTime = 0;
let unlocked = false;
let suspended = false;
const cleanupTimers = new Set<number>();

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getMusicVolume(): number {
  const raw = safeGet(MUSIC_VOLUME_KEY);
  if (raw === null) return 1;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? clampVolume(value) : 1;
}

export function setMusicVolume(volume: number): void {
  const value = clampVolume(volume);
  safeSet(MUSIC_VOLUME_KEY, String(value));
  if (musicMaster && audioAvailable()) {
    // Short ramp avoids a click when the user drags the slider.
    musicMaster.gain.setTargetAtTime(MUSIC_MASTER_GAIN * value, sharedAudioContext().currentTime, 0.02);
  }
}

export function isMusicMuted(): boolean {
  if (typeof window === "undefined") return true;
  return safeGet(MUSIC_STORAGE_KEY) === "1";
}

export function setMusicMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  safeSet(MUSIC_STORAGE_KEY, muted ? "1" : "0");
  if (muted) {
    haltActiveScene();
    return;
  }

  unlockMusic();
  startRequestedScene();
}

export function musicSceneForSnapshot(snapshot: GameSnapshot | null): MusicScene | null {
  if (!snapshot) return null;
  if (snapshot.phase === "lobby") return "lobby";
  if (snapshot.phase !== "dealing" && snapshot.phase !== "playing") return null;
  return snapshot.settings.modeId === "flip" && snapshot.flipSide === "dark" ? "flipDark" : "play";
}

export function setMusicScene(scene: MusicScene | null): void {
  requestedScene = scene;
  if (!scene) {
    haltActiveScene();
    return;
  }
  startRequestedScene();
}

export function scheduleFlipMusicTransition(
  scene: "play" | "flipDark",
  fadeOutStartDelayMs: number,
  fadeOutEndDelayMs: number,
  fadeInDelayMs: number
): void {
  requestedScene = scene;
  if (!canPlayMusic()) return;
  const context = sharedAudioContext();
  const now = context.currentTime;
  startScene(scene, {
    fadeOutAt: now + Math.max(0, fadeOutStartDelayMs) / 1000,
    fadeOutEndAt: now + Math.max(0, fadeOutEndDelayMs) / 1000,
    fadeInAt: now + Math.max(0, fadeInDelayMs) / 1000
  });
}

export function unlockMusic(): void {
  if (typeof window === "undefined" || !audioAvailable()) return;
  unlocked = true;
  unlockAudio();
  startRequestedScene();
}

export function setMusicSuspended(value: boolean): void {
  suspended = value;
  if (value) {
    haltActiveScene();
  } else {
    startRequestedScene();
  }
}

function canPlayMusic(): boolean {
  return unlocked && !suspended && !isMusicMuted() && audioAvailable() && requestedScene !== null;
}

function startRequestedScene(): void {
  if (!canPlayMusic() || !requestedScene || activeScene === requestedScene) return;
  startScene(requestedScene);
}

function ensureMusicMaster(context: AudioContext): GainNode {
  if (!musicMaster) {
    musicMaster = context.createGain();
    musicMaster.gain.value = MUSIC_MASTER_GAIN * getMusicVolume();
    musicMaster.connect(context.destination);
  }
  return musicMaster;
}

function startScene(
  scene: MusicScene,
  transition?: { fadeOutAt: number; fadeOutEndAt: number; fadeInAt: number }
): void {
  const context = sharedAudioContext();
  const now = context.currentTime;
  const previousBus = activeBus;
  stopScheduler();

  if (previousBus) {
    if (transition) {
      fadeAndDisconnectAt(previousBus, now, transition.fadeOutAt, transition.fadeOutEndAt);
    } else {
      fadeAndDisconnect(previousBus, now);
    }
  }

  const bus = context.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  const sceneStart = transition ? transition.fadeInAt : now + 0.08;
  if (transition) {
    bus.gain.setValueAtTime(0.0001, sceneStart);
    bus.gain.linearRampToValueAtTime(1, sceneStart + FLIP_FADE_IN_SECONDS);
  } else {
    bus.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
  }
  bus.connect(ensureMusicMaster(context));

  activeScene = scene;
  activeBus = bus;
  const track = MUSIC_TRACKS[scene];
  const secondsPerStep = 60 / track.bpm / 4;
  scheduleTrackCycle(context, bus, track, sceneStart, secondsPerStep);
  nextCycleTime = sceneStart + track.lengthSteps * secondsPerStep;
  schedulerId = window.setInterval(scheduleMusic, LOOKAHEAD_MS);
}

function haltActiveScene(): void {
  stopScheduler();
  const bus = activeBus;
  activeBus = null;
  activeScene = null;
  if (!bus || !audioAvailable()) return;
  fadeAndDisconnect(bus, sharedAudioContext().currentTime);
}

function fadeAndDisconnect(bus: GainNode, now: number): void {
  fadeAndDisconnectAt(bus, now, now, now + CROSSFADE_SECONDS);
}

function fadeAndDisconnectAt(bus: GainNode, now: number, fadeOutAt: number, fadeOutEndAt: number): void {
  const fadeStart = Math.max(now, fadeOutAt);
  const fadeEnd = Math.max(fadeStart + 0.05, fadeOutEndAt);
  const currentGain = Math.max(0.0001, bus.gain.value);
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(currentGain, now);
  bus.gain.setValueAtTime(currentGain, fadeStart);
  bus.gain.linearRampToValueAtTime(0.0001, fadeEnd);
  const timer = window.setTimeout(() => {
    bus.disconnect();
    cleanupTimers.delete(timer);
  }, (fadeEnd - now + 0.1) * 1000);
  cleanupTimers.add(timer);
}

function stopScheduler(): void {
  if (schedulerId !== null) {
    window.clearInterval(schedulerId);
    schedulerId = null;
  }
}

function scheduleMusic(): void {
  if (!activeScene || !activeBus || !audioAvailable()) return;
  const context = sharedAudioContext();
  const track = MUSIC_TRACKS[activeScene];
  const secondsPerStep = 60 / track.bpm / 4;
  const cycleDuration = track.lengthSteps * secondsPerStep;

  while (nextCycleTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
    scheduleTrackCycle(context, activeBus, track, nextCycleTime, secondsPerStep);
    nextCycleTime += cycleDuration;
  }
}

function scheduleTrackCycle(
  context: AudioContext,
  destination: AudioNode,
  track: TrackDefinition,
  startsAt: number,
  secondsPerStep: number
): void {
  for (const synthNote of track.notes) {
    scheduleNote(
      context,
      destination,
      synthNote,
      startsAt + synthNote.step * secondsPerStep,
      secondsPerStep
    );
  }
}

function scheduleNote(
  context: AudioContext,
  destination: AudioNode,
  synthNote: SynthNote,
  start: number,
  secondsPerStep: number
): void {
  const duration = synthNote.durationSteps * secondsPerStep;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  oscillator.type = synthNote.type;
  oscillator.frequency.setValueAtTime(synthNote.frequency, start);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(synthNote.cutoff, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(synthNote.gain * NOTE_GAIN_SCALE, start + Math.min(0.08, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}
