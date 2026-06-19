const SFX_MASTER = 0.55;

let audioContext: AudioContext | null = null;
let sfxGain: GainNode | null = null;

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
    sfxGain.gain.value = SFX_MASTER;
    sfxGain.connect(audioContext.destination);
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
