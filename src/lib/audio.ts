import { safeGet, safeSet } from "./storage";

const SFX_MASTER = 0.55;
const SFX_VOLUME_KEY = "congcard:sfx-volume";

let audioContext: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let sfxCompressor: DynamicsCompressorNode | null = null;
const sfxVolumeListeners = new Set<(volume: number) => void>();

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getSfxVolume(): number {
  const raw = safeGet(SFX_VOLUME_KEY);
  if (raw === null) return 1;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? clamp01(value) : 1;
}

export function setSfxVolume(volume: number): void {
  const value = clamp01(volume);
  safeSet(SFX_VOLUME_KEY, String(value));
  if (sfxGain && audioContext) {
    // Short ramp avoids a click when the user drags the slider.
    sfxGain.gain.setTargetAtTime(SFX_MASTER * value, audioContext.currentTime, 0.02);
  }
  for (const listener of sfxVolumeListeners) {
    listener(value);
  }
}

export function onSfxVolumeChange(listener: (volume: number) => void): () => void {
  sfxVolumeListeners.add(listener);
  return () => {
    sfxVolumeListeners.delete(listener);
  };
}

export function audioAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.AudioContext ?? window.webkitAudioContext);
}

export function sharedAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error("Web Audio is not available.");
    }

    audioContext = new AudioContextConstructor();
    sfxGain = audioContext.createGain();
    sfxCompressor = audioContext.createDynamicsCompressor();
    sfxCompressor.threshold.value = -15;
    sfxCompressor.knee.value = 14;
    sfxCompressor.ratio.value = 4;
    sfxCompressor.attack.value = 0.006;
    sfxCompressor.release.value = 0.18;
    sfxGain.gain.value = SFX_MASTER * getSfxVolume();
    sfxGain.connect(sfxCompressor);
    sfxCompressor.connect(audioContext.destination);
  }

  return audioContext;
}

export function sfxDestination(): AudioNode {
  return sfxGain ?? sharedAudioContext().destination;
}

export function unlockAudio(): void {
  if (!audioAvailable()) return;
  const context = sharedAudioContext();
  if (context.state === "suspended") {
    void context.resume();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
