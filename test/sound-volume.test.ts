import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudioContext {}

class FakeAudio {
  readonly src: string;
  volume = 1;
  readonly play = vi.fn(() => Promise.resolve());
  private readonly listeners = new Map<string, EventListenerOrEventListenerObject>();

  constructor(src: string) {
    this.src = src;
    createdAudios.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, listener);
  }
}

let createdAudios: FakeAudio[] = [];

describe("raw SFX clip volume", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    createdAudios = [];
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    Object.defineProperty(window, "Audio", { configurable: true, value: FakeAudio });
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates active MP3 clips when SFX volume or mute changes", async () => {
    const { setSfxVolume } = await import("../src/lib/audio");
    const { playSound, setSoundMuted } = await import("../src/lib/sound");

    setSfxVolume(1);
    playSound("memeNukeCountdown");

    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe("/audio/nuke-cat-countdown.mp3");
    expect(createdAudios[0].volume).toBeCloseTo(0.58);

    setSfxVolume(0.25);
    expect(createdAudios[0].volume).toBeCloseTo(0.145);

    setSoundMuted(true);
    expect(createdAudios[0].volume).toBe(0);

    setSoundMuted(false);
    expect(createdAudios[0].volume).toBeCloseTo(0.145);
  });
});
