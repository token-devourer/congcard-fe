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
      // Sustained bass pad over a bright I-V-vi-IV (C - G - Am - F).
      note(0, 130.81, 7, "sine", 0.04, 1950), note(16, 98, 7, "sine", 0.04, 1900),
      note(32, 110, 7, "sine", 0.04, 1950), note(48, 87.31, 7, "sine", 0.04, 1850),
      note(64, 98, 7, "sine", 0.039, 1900), note(80, 110, 7, "sine", 0.039, 1940),
      note(96, 87.31, 7, "sine", 0.039, 1840), note(112, 98, 7, "sine", 0.039, 1900),
      // Off-beat bass bounce for drive.
      note(8, 130.81, 2, "triangle", 0.03, 1700), note(24, 196, 2, "triangle", 0.03, 1700),
      note(40, 220, 2, "triangle", 0.03, 1700), note(56, 174.61, 2, "triangle", 0.03, 1700),
      note(72, 196, 2, "triangle", 0.029, 1670), note(88, 220, 2, "triangle", 0.029, 1700),
      note(104, 174.61, 2, "triangle", 0.029, 1650), note(120, 196, 2, "triangle", 0.029, 1670),
      // Bright bouncing arpeggio melody.
      note(0, 523.25, 2, "triangle", 0.028, 4000), note(4, 659.25, 2, "triangle", 0.027, 4200),
      note(8, 783.99, 2, "triangle", 0.028, 4400), note(12, 659.25, 2, "triangle", 0.025, 4200),
      note(16, 587.33, 2, "triangle", 0.028, 4000), note(20, 783.99, 2, "triangle", 0.027, 4400),
      note(24, 987.77, 2, "triangle", 0.028, 4600), note(28, 783.99, 2, "triangle", 0.025, 4400),
      note(32, 440, 2, "triangle", 0.028, 3800), note(36, 523.25, 2, "triangle", 0.027, 4000),
      note(40, 659.25, 2, "triangle", 0.028, 4200), note(44, 523.25, 2, "triangle", 0.025, 4000),
      note(48, 523.25, 2, "triangle", 0.028, 4000), note(52, 698.46, 2, "triangle", 0.027, 4300),
      note(56, 880, 2, "triangle", 0.028, 4600), note(60, 698.46, 3, "triangle", 0.025, 4300),
      // Second phrase stays close to the first but resolves forward into the loop.
      note(64, 523.25, 2, "triangle", 0.027, 4000), note(68, 659.25, 2, "triangle", 0.026, 4200),
      note(72, 783.99, 2, "triangle", 0.027, 4400), note(76, 659.25, 2, "triangle", 0.025, 4200),
      note(80, 587.33, 2, "triangle", 0.027, 4020), note(84, 783.99, 2, "triangle", 0.026, 4400),
      note(88, 880, 2, "triangle", 0.027, 4520), note(92, 783.99, 2, "triangle", 0.025, 4400),
      note(96, 440, 2, "triangle", 0.027, 3820), note(100, 523.25, 2, "triangle", 0.026, 4000),
      note(104, 659.25, 2, "triangle", 0.027, 4200), note(108, 523.25, 2, "triangle", 0.025, 4000),
      note(112, 493.88, 2, "triangle", 0.027, 3900), note(116, 659.25, 2, "triangle", 0.026, 4200),
      note(120, 739.99, 2, "triangle", 0.027, 4300), note(124, 783.99, 3, "triangle", 0.024, 4400),
      // Sparkle bells one octave up at the tail of each bar.
      note(14, 1318.51, 2, "sine", 0.013, 6500), note(30, 1567.98, 2, "sine", 0.013, 6800),
      note(46, 1318.51, 2, "sine", 0.013, 6500), note(62, 1396.91, 2, "sine", 0.013, 6800),
      note(78, 1318.51, 2, "sine", 0.012, 6500), note(94, 1396.91, 2, "sine", 0.012, 6800),
      note(110, 1174.66, 2, "sine", 0.012, 6200), note(126, 1318.51, 2, "sine", 0.012, 6500)
    ]
  },
  flipDark: {
    bpm: 98,
    lengthSteps: 128,
    notes: [
      // Same rhythmic structure as play, but reharmonized darker and slightly slower.
      note(0, 110, 7, "sine", 0.041, 1550), note(16, 82.41, 7, "sine", 0.041, 1500),
      note(32, 87.31, 7, "sine", 0.041, 1540), note(48, 73.42, 7, "sine", 0.041, 1480),
      note(64, 82.41, 7, "sine", 0.04, 1500), note(80, 87.31, 7, "sine", 0.04, 1540),
      note(96, 73.42, 7, "sine", 0.04, 1480), note(112, 82.41, 7, "sine", 0.04, 1500),
      note(8, 110, 2, "triangle", 0.029, 1450), note(24, 164.81, 2, "triangle", 0.029, 1500),
      note(40, 174.61, 2, "triangle", 0.029, 1540), note(56, 146.83, 2, "triangle", 0.029, 1420),
      note(72, 164.81, 2, "triangle", 0.029, 1500), note(88, 174.61, 2, "triangle", 0.029, 1540),
      note(104, 146.83, 2, "triangle", 0.029, 1420), note(120, 164.81, 2, "triangle", 0.029, 1500),
      note(0, 440, 2, "triangle", 0.026, 3000), note(4, 523.25, 2, "triangle", 0.025, 3200),
      note(8, 659.25, 2, "triangle", 0.026, 3400), note(12, 523.25, 2, "triangle", 0.024, 3200),
      note(16, 493.88, 2, "triangle", 0.026, 3050), note(20, 659.25, 2, "triangle", 0.025, 3400),
      note(24, 783.99, 2, "triangle", 0.026, 3550), note(28, 659.25, 2, "triangle", 0.024, 3400),
      note(32, 392, 2, "triangle", 0.026, 2900), note(36, 493.88, 2, "triangle", 0.025, 3050),
      note(40, 587.33, 2, "triangle", 0.026, 3250), note(44, 493.88, 2, "triangle", 0.024, 3050),
      note(48, 440, 2, "triangle", 0.026, 3000), note(52, 587.33, 2, "triangle", 0.025, 3250),
      note(56, 698.46, 2, "triangle", 0.026, 3450), note(60, 587.33, 3, "triangle", 0.024, 3250),
      note(64, 440, 2, "triangle", 0.026, 3000), note(68, 523.25, 2, "triangle", 0.025, 3200),
      note(72, 659.25, 2, "triangle", 0.026, 3400), note(76, 523.25, 2, "triangle", 0.024, 3200),
      note(80, 493.88, 2, "triangle", 0.026, 3050), note(84, 659.25, 2, "triangle", 0.025, 3400),
      note(88, 739.99, 2, "triangle", 0.026, 3500), note(92, 659.25, 2, "triangle", 0.024, 3400),
      note(96, 392, 2, "triangle", 0.026, 2900), note(100, 493.88, 2, "triangle", 0.025, 3050),
      note(104, 587.33, 2, "triangle", 0.026, 3250), note(108, 493.88, 2, "triangle", 0.024, 3050),
      note(112, 466.16, 2, "triangle", 0.026, 2980), note(116, 587.33, 2, "triangle", 0.025, 3250),
      note(120, 698.46, 2, "triangle", 0.026, 3450), note(124, 587.33, 3, "triangle", 0.024, 3250),
      note(14, 1046.5, 2, "sine", 0.011, 5200), note(30, 1174.66, 2, "sine", 0.011, 5400),
      note(46, 987.77, 2, "sine", 0.011, 5000), note(62, 1174.66, 2, "sine", 0.011, 5400),
      note(78, 1046.5, 2, "sine", 0.011, 5200), note(94, 1174.66, 2, "sine", 0.011, 5400),
      note(110, 987.77, 2, "sine", 0.011, 5000), note(126, 1046.5, 2, "sine", 0.011, 5200)
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
