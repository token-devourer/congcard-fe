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
const LOOKAHEAD_MS = 100;
const SCHEDULE_AHEAD_SECONDS = 0.4;

const note = (
  step: number,
  frequency: number,
  durationSteps: number,
  type: OscillatorType,
  gain: number,
  cutoff: number
): SynthNote => ({ step, frequency, durationSteps, type, gain, cutoff });

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
  play: {
    bpm: 104,
    lengthSteps: 128,
    notes: [
      // Eight-bar C major progression: C, G, Am, F, C, G, F, G.
      note(0, 130.81, 14, "sine", 0.032, 1650), note(16, 98, 14, "sine", 0.032, 1600),
      note(32, 110, 14, "sine", 0.032, 1650), note(48, 87.31, 14, "sine", 0.032, 1580),
      note(64, 130.81, 14, "sine", 0.032, 1650), note(80, 98, 14, "sine", 0.032, 1600),
      note(96, 87.31, 14, "sine", 0.032, 1580), note(112, 98, 14, "sine", 0.032, 1600),
      // Quiet chord bed keeps every melodic phrase anchored to its harmony.
      note(0, 261.63, 14, "sine", 0.009, 2600), note(0, 329.63, 14, "sine", 0.008, 2600), note(0, 392, 14, "sine", 0.008, 2600),
      note(16, 196, 14, "sine", 0.009, 2550), note(16, 246.94, 14, "sine", 0.008, 2550), note(16, 293.66, 14, "sine", 0.008, 2550),
      note(32, 220, 14, "sine", 0.009, 2600), note(32, 261.63, 14, "sine", 0.008, 2600), note(32, 329.63, 14, "sine", 0.008, 2600),
      note(48, 174.61, 14, "sine", 0.009, 2500), note(48, 220, 14, "sine", 0.008, 2500), note(48, 261.63, 14, "sine", 0.008, 2500),
      note(64, 261.63, 14, "sine", 0.009, 2600), note(64, 329.63, 14, "sine", 0.008, 2600), note(64, 392, 14, "sine", 0.008, 2600),
      note(80, 196, 14, "sine", 0.009, 2550), note(80, 246.94, 14, "sine", 0.008, 2550), note(80, 293.66, 14, "sine", 0.008, 2550),
      note(96, 174.61, 14, "sine", 0.009, 2500), note(96, 220, 14, "sine", 0.008, 2500), note(96, 261.63, 14, "sine", 0.008, 2500),
      note(112, 196, 14, "sine", 0.009, 2550), note(112, 246.94, 14, "sine", 0.008, 2550), note(112, 293.66, 14, "sine", 0.008, 2550),
      // A relaxed two-phrase melody with rests between each short response.
      note(0, 659.25, 3, "triangle", 0.021, 3900), note(4, 783.99, 3, "triangle", 0.021, 4100),
      note(8, 880, 2, "triangle", 0.019, 4200), note(11, 783.99, 2, "triangle", 0.018, 4100), note(14, 659.25, 2, "triangle", 0.018, 3900),
      note(16, 587.33, 3, "triangle", 0.021, 3800), note(20, 783.99, 3, "triangle", 0.021, 4100),
      note(24, 987.77, 3, "triangle", 0.02, 4300), note(28, 880, 2, "triangle", 0.018, 4200), note(30, 783.99, 2, "triangle", 0.018, 4100),
      note(32, 659.25, 3, "triangle", 0.021, 3900), note(36, 880, 3, "triangle", 0.021, 4200),
      note(40, 1046.5, 3, "triangle", 0.02, 4400), note(44, 987.77, 2, "triangle", 0.018, 4300), note(46, 880, 2, "triangle", 0.018, 4200),
      note(48, 1046.5, 3, "triangle", 0.021, 4400), note(52, 880, 3, "triangle", 0.02, 4200),
      note(56, 783.99, 2, "triangle", 0.019, 4100), note(59, 698.46, 3, "triangle", 0.019, 4000), note(63, 659.25, 1, "triangle", 0.016, 3900),
      note(64, 659.25, 3, "triangle", 0.021, 3900), note(68, 783.99, 3, "triangle", 0.021, 4100),
      note(72, 1046.5, 3, "triangle", 0.02, 4400), note(76, 987.77, 2, "triangle", 0.018, 4300), note(78, 783.99, 2, "triangle", 0.018, 4100),
      note(80, 587.33, 3, "triangle", 0.021, 3800), note(84, 783.99, 3, "triangle", 0.021, 4100),
      note(88, 987.77, 3, "triangle", 0.02, 4300), note(92, 880, 2, "triangle", 0.018, 4200), note(94, 783.99, 2, "triangle", 0.018, 4100),
      note(96, 880, 3, "triangle", 0.021, 4200), note(100, 1046.5, 3, "triangle", 0.021, 4400),
      note(104, 880, 2, "triangle", 0.019, 4200), note(107, 783.99, 2, "triangle", 0.018, 4100), note(110, 698.46, 2, "triangle", 0.018, 4000),
      note(112, 783.99, 3, "triangle", 0.021, 4100), note(116, 880, 3, "triangle", 0.02, 4200),
      note(120, 987.77, 3, "triangle", 0.02, 4300), note(124, 587.33, 2, "triangle", 0.018, 3800), note(127, 493.88, 1, "triangle", 0.016, 3700)
    ]
  },
  flipDark: {
    bpm: 100,
    lengthSteps: 128,
    notes: [
      // The same eight-bar rhythm in A minor: Am, F, C, G, Am, F, Dm, E.
      note(0, 110, 14, "sine", 0.033, 1420), note(16, 87.31, 14, "sine", 0.033, 1380),
      note(32, 130.81, 14, "sine", 0.033, 1420), note(48, 98, 14, "sine", 0.033, 1380),
      note(64, 110, 14, "sine", 0.033, 1420), note(80, 87.31, 14, "sine", 0.033, 1380),
      note(96, 73.42, 14, "sine", 0.033, 1340), note(112, 82.41, 14, "sine", 0.033, 1360),
      note(0, 220, 14, "sine", 0.009, 2150), note(0, 261.63, 14, "sine", 0.008, 2150), note(0, 329.63, 14, "sine", 0.008, 2150),
      note(16, 174.61, 14, "sine", 0.009, 2050), note(16, 220, 14, "sine", 0.008, 2050), note(16, 261.63, 14, "sine", 0.008, 2050),
      note(32, 261.63, 14, "sine", 0.009, 2150), note(32, 329.63, 14, "sine", 0.008, 2150), note(32, 392, 14, "sine", 0.008, 2150),
      note(48, 196, 14, "sine", 0.009, 2050), note(48, 246.94, 14, "sine", 0.008, 2050), note(48, 293.66, 14, "sine", 0.008, 2050),
      note(64, 220, 14, "sine", 0.009, 2150), note(64, 261.63, 14, "sine", 0.008, 2150), note(64, 329.63, 14, "sine", 0.008, 2150),
      note(80, 174.61, 14, "sine", 0.009, 2050), note(80, 220, 14, "sine", 0.008, 2050), note(80, 261.63, 14, "sine", 0.008, 2050),
      note(96, 146.83, 14, "sine", 0.009, 1980), note(96, 174.61, 14, "sine", 0.008, 1980), note(96, 220, 14, "sine", 0.008, 1980),
      note(112, 164.81, 14, "sine", 0.009, 2020), note(112, 207.65, 14, "sine", 0.008, 2020), note(112, 246.94, 14, "sine", 0.008, 2020),
      // Dark-side variation mirrors the light motif without borrowing clashing notes.
      note(0, 659.25, 3, "triangle", 0.02, 3200), note(4, 880, 3, "triangle", 0.02, 3400),
      note(8, 1046.5, 2, "triangle", 0.018, 3550), note(11, 987.77, 2, "triangle", 0.017, 3450), note(14, 880, 2, "triangle", 0.017, 3400),
      note(16, 523.25, 3, "triangle", 0.02, 3000), note(20, 698.46, 3, "triangle", 0.02, 3250),
      note(24, 880, 3, "triangle", 0.019, 3400), note(28, 783.99, 2, "triangle", 0.017, 3300), note(30, 698.46, 2, "triangle", 0.017, 3250),
      note(32, 659.25, 3, "triangle", 0.02, 3200), note(36, 783.99, 3, "triangle", 0.02, 3300),
      note(40, 1046.5, 3, "triangle", 0.019, 3550), note(44, 987.77, 2, "triangle", 0.017, 3450), note(46, 783.99, 2, "triangle", 0.017, 3300),
      note(48, 587.33, 3, "triangle", 0.02, 3100), note(52, 783.99, 3, "triangle", 0.02, 3300),
      note(56, 987.77, 2, "triangle", 0.019, 3450), note(59, 880, 3, "triangle", 0.018, 3400), note(63, 783.99, 1, "triangle", 0.016, 3300),
      note(64, 659.25, 3, "triangle", 0.02, 3200), note(68, 880, 3, "triangle", 0.02, 3400),
      note(72, 1046.5, 3, "triangle", 0.019, 3550), note(76, 987.77, 2, "triangle", 0.017, 3450), note(78, 880, 2, "triangle", 0.017, 3400),
      note(80, 523.25, 3, "triangle", 0.02, 3000), note(84, 698.46, 3, "triangle", 0.02, 3250),
      note(88, 880, 3, "triangle", 0.019, 3400), note(92, 783.99, 2, "triangle", 0.017, 3300), note(94, 698.46, 2, "triangle", 0.017, 3250),
      note(96, 587.33, 3, "triangle", 0.02, 3100), note(100, 698.46, 3, "triangle", 0.02, 3250),
      note(104, 880, 2, "triangle", 0.018, 3400), note(107, 783.99, 2, "triangle", 0.017, 3300), note(110, 698.46, 2, "triangle", 0.017, 3250),
      note(112, 659.25, 3, "triangle", 0.02, 3200), note(116, 830.61, 3, "triangle", 0.02, 3350),
      note(120, 987.77, 3, "triangle", 0.019, 3450), note(124, 830.61, 2, "triangle", 0.017, 3350), note(127, 659.25, 1, "triangle", 0.016, 3200)
    ]
  }
};

let requestedScene: MusicScene | null = null;
let activeScene: MusicScene | null = null;
let activeBus: GainNode | null = null;
let musicMaster: GainNode | null = null;
let schedulerId: number | null = null;
let nextStepTime = 0;
let currentStep = 0;
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

function startScene(scene: MusicScene): void {
  const context = sharedAudioContext();
  const now = context.currentTime;
  const previousBus = activeBus;
  stopScheduler();

  if (previousBus) {
    fadeAndDisconnect(previousBus, now);
  }

  const bus = context.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
  bus.connect(ensureMusicMaster(context));

  activeScene = scene;
  activeBus = bus;
  currentStep = 0;
  nextStepTime = now + 0.08;
  schedulerId = window.setInterval(scheduleMusic, LOOKAHEAD_MS);
  scheduleMusic();
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
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
  bus.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_SECONDS);
  const timer = window.setTimeout(() => {
    bus.disconnect();
    cleanupTimers.delete(timer);
  }, (CROSSFADE_SECONDS + 0.1) * 1000);
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

  while (nextStepTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
    for (const synthNote of track.notes) {
      if (synthNote.step === currentStep) {
        scheduleNote(context, activeBus, synthNote, nextStepTime, secondsPerStep);
      }
    }
    nextStepTime += secondsPerStep;
    currentStep = (currentStep + 1) % track.lengthSteps;
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
