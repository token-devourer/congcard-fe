export interface SpriteEntry {
  start: number;
  dur: number;
}

export interface SpriteManifest {
  /** Total duration of the sprite in seconds */
  totalDuration: number;
  /** Sprite file path (relative to /public) */
  src: string;
  /** Named segments */
  sprites: Record<string, SpriteEntry>;
}

let audioBuffer: AudioBuffer | null = null;
let spriteManifest: SpriteManifest | null = null;
let loadPromise: Promise<void> | null = null;

/** Load the audio sprite from the server */
export function loadAudioSprite(ctx: AudioContext, manifest: SpriteManifest): Promise<void> {
  if (loadPromise) return loadPromise;
  spriteManifest = manifest;
  loadPromise = (async () => {
    const res = await fetch(manifest.src);
    const arrayBuffer = await res.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  })();
  return loadPromise;
}

/** Check if sprite is loaded */
export function spriteReady(): boolean {
  return audioBuffer !== null;
}

/** Get audio buffer (may be null if not loaded) */
export function getSpriteBuffer(): AudioBuffer | null {
  return audioBuffer;
}

/** Get sprite entry by name */
export function getSpriteEntry(name: string): SpriteEntry | undefined {
  return spriteManifest?.sprites[name];
}
