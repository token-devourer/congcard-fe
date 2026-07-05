import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = path.resolve(WEB_ROOT, "..");
const PUBLIC_AUDIO_DIR = path.join(WEB_ROOT, "public", "audio");
const SOURCE_AUDIO_DIR = path.join(WORKSPACE_ROOT, "Assets", "MP3", "Ready");
const SOUND_TS = path.join(WEB_ROOT, "src", "lib", "sound.ts");

const ACTIVE_CLIPS = [
  {
    sound: "memeThrowup",
    sourceFile: "GagCat.mp3",
    publicFile: "gag-cat.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeSteal",
    sourceFile: "MueheheheCatInitiate.mp3",
    publicFile: "muehehehe-cat-initiate.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeStealExecute",
    sourceFile: "MueheheheCatExecute.mp3",
    publicFile: "muehehehe-cat-execute.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeFlashbang",
    sourceFile: "FlashbangCat&SFXmerged.mp3",
    publicFile: "flashbang-cat-sfx-merged.mp3",
    targetI: -17,
    targetTP: -1.5,
    targetLRA: 7,
    highpass: 55
  },
  {
    sound: "memeFavor",
    sourceFile: "AwowoCatInitiate.mp3",
    publicFile: "awowo-cat-initiate.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeFavorOpen",
    sourceFile: "AwowoCatOpen.mp3",
    publicFile: "awowo-cat-open.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeFavorExecute",
    sourceFile: "AwowoCatExecute.mp3",
    publicFile: "awowo-cat-execute.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memePeek",
    sourceFile: "AcumalakaFrog.mp3",
    publicFile: "acumalaka-frog.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeTimeskip",
    sourceFile: "TimeSkipCat.mp3",
    publicFile: "timeskip-cat.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 70
  },
  {
    sound: "memeNuke",
    sourceFile: "NukeCatInitiate.mp3",
    publicFile: "nuke-cat-initiate.mp3",
    targetI: -16,
    targetTP: -1,
    targetLRA: 8,
    highpass: 55
  },
  {
    sound: "memeNukeCountdown",
    sourceFile: "NukeCatCountDown.mp3",
    publicFile: "nuke-cat-countdown.mp3",
    targetI: -22,
    targetTP: -2,
    targetLRA: 12,
    highpass: 45
  }
];

function dbToLinear(db) {
  return Number((10 ** (db / 20)).toFixed(6));
}

function formatMetric(value, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a".padStart(8);
  return `${number.toFixed(1)}${suffix}`.padStart(8);
}

function formatSeconds(value) {
  return `${Number(value).toFixed(2)}s`.padStart(8);
}

function runFfmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static did not resolve a binary path."));
      return;
    }

    const child = spawn(ffmpegPath, args, {
      cwd: WEB_ROOT,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }
      reject(new Error(`ffmpeg failed with code ${code}\n${stderr}`));
    });
  });
}

function parseDuration(output, file) {
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error(`Unable to read duration for ${file}`);
  }

  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function parseLoudnorm(output, file) {
  const matches = output.match(/\{\s*"input_i"[\s\S]*?\}/g);
  const json = matches?.[matches.length - 1];
  if (!json) {
    throw new Error(`Unable to parse loudnorm output for ${file}`);
  }
  return JSON.parse(json);
}

async function getDuration(file) {
  const result = await runFfmpeg(["-hide_banner", "-nostdin", "-i", file, "-f", "null", "-"], {
    allowFailure: true
  });
  return parseDuration(`${result.stdout}\n${result.stderr}`, file);
}

function baseFilters(clip, duration) {
  const filters = [`highpass=f=${clip.highpass}`, "afade=t=in:st=0:d=0.005"];
  if (duration > 0.02) {
    filters.push(`afade=t=out:st=${Math.max(0, duration - 0.005).toFixed(3)}:d=0.005`);
  }
  return filters;
}

async function measureInput(file, clip) {
  const duration = await getDuration(file);
  const loudnorm = `loudnorm=I=${clip.targetI}:TP=${clip.targetTP}:LRA=${clip.targetLRA}:print_format=json`;
  const result = await runFfmpeg(["-hide_banner", "-nostdin", "-i", file, "-af", loudnorm, "-f", "null", "-"]);
  const metrics = parseLoudnorm(result.stderr, file);
  return { duration, metrics };
}

async function analyzeForTune(file, clip) {
  const duration = await getDuration(file);
  const filters = [
    ...baseFilters(clip, duration),
    `loudnorm=I=${clip.targetI}:TP=${clip.targetTP}:LRA=${clip.targetLRA}:print_format=json`
  ];
  const result = await runFfmpeg(["-hide_banner", "-nostdin", "-i", file, "-af", filters.join(","), "-f", "null", "-"]);
  const metrics = parseLoudnorm(result.stderr, file);
  return { duration, metrics };
}

async function tuneClip(clip, tempRoot) {
  const sourcePath = path.join(SOURCE_AUDIO_DIR, clip.sourceFile);
  const publicPath = path.join(PUBLIC_AUDIO_DIR, clip.publicFile);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source audio: ${sourcePath}`);
  }

  const outputPath = path.join(tempRoot, clip.publicFile);
  const { duration, metrics } = await analyzeForTune(sourcePath, clip);
  const loudnorm = [
    `loudnorm=I=${clip.targetI}`,
    `TP=${clip.targetTP}`,
    `LRA=${clip.targetLRA}`,
    `measured_I=${metrics.input_i}`,
    `measured_TP=${metrics.input_tp}`,
    `measured_LRA=${metrics.input_lra}`,
    `measured_thresh=${metrics.input_thresh}`,
    `offset=${metrics.target_offset}`,
    "linear=true",
    "print_format=summary"
  ].join(":");
  const limiter = `alimiter=limit=${dbToLinear(clip.targetTP)}:level=false`;
  const filters = [...baseFilters(clip, duration), loudnorm, limiter].join(",");

  await runFfmpeg([
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-map",
    "0:a:0",
    "-af",
    filters,
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "3",
    "-ar",
    "44100",
    outputPath
  ]);

  await fs.copyFile(outputPath, publicPath);
  await fs.copyFile(outputPath, sourcePath);
}

async function readReferencedAudioFiles() {
  const source = await fs.readFile(SOUND_TS, "utf8");
  return [...new Set([...source.matchAll(/["']\/audio\/([^"']+\.mp3)["']/g)].map((match) => match[1]))];
}

async function verifyCoverage() {
  const referencedFiles = await readReferencedAudioFiles();
  const manifestFiles = new Set(ACTIVE_CLIPS.map((clip) => clip.publicFile));
  const missingFromManifest = referencedFiles.filter((file) => !manifestFiles.has(file));
  const missingFiles = ACTIVE_CLIPS
    .map((clip) => clip.publicFile)
    .filter((file) => !existsSync(path.join(PUBLIC_AUDIO_DIR, file)));

  if (missingFromManifest.length > 0 || missingFiles.length > 0) {
    const details = [
      missingFromManifest.length > 0 ? `Missing manifest entries: ${missingFromManifest.join(", ")}` : "",
      missingFiles.length > 0 ? `Missing public audio files: ${missingFiles.join(", ")}` : ""
    ].filter(Boolean);
    throw new Error(details.join("\n"));
  }
}

async function audit() {
  await verifyCoverage();
  const rows = [];
  for (const clip of ACTIVE_CLIPS) {
    const file = path.join(PUBLIC_AUDIO_DIR, clip.publicFile);
    const { duration, metrics } = await measureInput(file, clip);
    rows.push({ clip, duration, metrics });
  }

  console.log("sound                 file                              dur     LUFS      TP     LRA   target");
  for (const row of rows) {
    console.log([
      row.clip.sound.padEnd(20),
      row.clip.publicFile.padEnd(32),
      formatSeconds(row.duration),
      formatMetric(row.metrics.input_i),
      formatMetric(row.metrics.input_tp),
      formatMetric(row.metrics.input_lra),
      `${row.clip.targetI} LUFS / ${row.clip.targetTP} dBTP`
    ].join(" "));
  }
}

async function tune() {
  await verifyCoverage();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "congcard-audio-"));
  try {
    for (const clip of ACTIVE_CLIPS) {
      await tuneClip(clip, tempRoot);
      console.log(`tuned ${clip.sound} -> ${clip.publicFile}`);
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
  await audit();
}

async function main() {
  const command = process.argv[2] ?? "audit";
  if (command === "audit") {
    await audit();
    return;
  }
  if (command === "tune") {
    await tune();
    return;
  }

  console.error("Usage: node scripts/tune-audio.mjs <audit|tune>");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
