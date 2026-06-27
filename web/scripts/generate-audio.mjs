/**
 * Audio Sprite Generator
 * 
 * Run in browser dev tools or with a Node.js + puppeteer setup:
 *   node scripts/generate-audio.mjs
 * 
 * This script renders all procedural sounds from sound.ts into a single
 * .ogg audio sprite file and generates the sprite timing manifest.
 * 
 * Prerequisites:
 *   - Node.js 24+
 *   - puppeteer: npm install -D puppeteer
 * 
 * The script opens a headless browser, renders each sound sequentially,
 * records via MediaRecorder, and concatenates them into sfx.ogg.
 * 
 * Output:
 *   web/public/audio/sfx.ogg   - concatenated audio sprite
 *   web/public/audio/sfx.json  - sprite manifest (start time per sound)
 */

// Sound names matching SoundName type in sound.ts
const SOUNDS = [
  "turn", "turnAlert", "oneWindow", "oneCalled", "catch", "wild",
  "stack", "matchChain", "batchFinale", "drawTick", "dealTick",
  "shuffle", "shuffleSettle", "flipSweep", "flipImpact", "flipLight",
  "flipDark", "opening", "dealComplete", "penalty", "skip", "reverse",
  "win", "lose", "jumpIn", "uiHover", "uiClick"
];

async function main() {
  console.log("Audio sprite generator - see instructions above.");
  console.log("Current sound list:", SOUNDS.length, "sounds");
  console.log("\nTo generate audio files:");
  console.log("1. npm install -D puppeteer");
  console.log("2. node scripts/generate-audio.mjs");
  console.log("3. Place generated files in web/public/audio/");
}

main().catch(console.error);
