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
const MUSIC_MASTER_GAIN = 0.35;
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
      note(56, 293.66, 2, "sine", 0.019, 3100), note(60, 261.63, 3, "sine", 0.018, 3000)
    ]
  },
  play: {
    bpm: 96,
    lengthSteps: 64,
    notes: [
      note(0, 130.81, 7, "sine", 0.038, 1900), note(16, 98, 7, "sine", 0.038, 1850),
      note(32, 110, 7, "sine", 0.038, 1900), note(48, 87.31, 7, "sine", 0.038, 1800),
      note(0, 523.25, 2, "triangle", 0.024, 3600), note(4, 659.25, 2, "triangle", 0.022, 3800),
      note(8, 783.99, 2, "triangle", 0.022, 4000), note(12, 659.25, 2, "triangle", 0.02, 3800),
      note(16, 493.88, 2, "triangle", 0.023, 3600), note(20, 587.33, 2, "triangle", 0.021, 3700),
      note(24, 783.99, 2, "triangle", 0.022, 4000), note(28, 587.33, 2, "triangle", 0.02, 3700),
      note(32, 440, 2, "triangle", 0.023, 3500), note(36, 523.25, 2, "triangle", 0.021, 3700),
      note(40, 659.25, 2, "triangle", 0.022, 3900), note(44, 523.25, 2, "triangle", 0.02, 3700),
      note(48, 349.23, 2, "triangle", 0.023, 3400), note(52, 440, 2, "triangle", 0.021, 3600),
      note(56, 587.33, 2, "triangle", 0.022, 3800), note(60, 523.25, 3, "triangle", 0.021, 3700)
    ]
  },
  flipDark: {
    bpm: 66,
    lengthSteps: 64,
    notes: [
      note(0, 73.42, 14, "sine", 0.048, 1300), note(0, 146.83, 14, "triangle", 0.022, 1900),
      note(0, 174.61, 14, "sine", 0.016, 1800), note(16, 58.27, 14, "sine", 0.048, 1250),
      note(16, 116.54, 14, "triangle", 0.022, 1850), note(16, 146.83, 14, "sine", 0.016, 1750),
      note(32, 65.41, 14, "sine", 0.048, 1300), note(32, 130.81, 14, "triangle", 0.022, 1900),
      note(32, 155.56, 14, "sine", 0.016, 1800), note(48, 55, 14, "sine", 0.048, 1200),
      note(48, 110, 14, "triangle", 0.022, 1800), note(48, 130.81, 14, "sine", 0.016, 1700),
      note(10, 293.66, 3, "sine", 0.015, 2400), note(26, 233.08, 3, "sine", 0.015, 2200),
      note(42, 261.63, 3, "sine", 0.015, 2300), note(58, 220, 4, "sine", 0.015, 2100)
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
  if (snapshot.phase !== "playing") return null;
  return snapshot.settings.modeOptions["flipSide"] === "dark" ? "flipDark" : "play";
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
    musicMaster.gain.value = MUSIC_MASTER_GAIN;
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
  gain.gain.exponentialRampToValueAtTime(synthNote.gain, start + Math.min(0.08, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}
