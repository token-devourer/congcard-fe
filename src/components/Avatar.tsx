"use client";

import { createAvatar } from "@dicebear/core";
import type { Style } from "@dicebear/core";
import {
  adventurerNeutral,
  avataaarsNeutral,
  bigEarsNeutral,
  botttsNeutral,
  croodlesNeutral,
  funEmoji,
  loreleiNeutral,
  micah,
  miniavs,
  openPeeps,
  personas,
  pixelArt
} from "@dicebear/collection";

interface AvatarTheme {
  seed: string;
  bg: [string, string];
  style: Style<Record<string, unknown>>;
}

const THEME: Record<string, AvatarTheme> = {
  sun: { seed: "Solar captain", bg: ["ffd24a", "ff6f3c"], style: personas as Style<Record<string, unknown>> },
  moon: { seed: "Moon scout", bg: ["5c6cff", "202d82"], style: loreleiNeutral as Style<Record<string, unknown>> },
  star: { seed: "Star mechanic", bg: ["ffcf3a", "6b5cff"], style: botttsNeutral as Style<Record<string, unknown>> },
  bolt: { seed: "Volt kid", bg: ["9d5cff", "22d3ee"], style: pixelArt as Style<Record<string, unknown>> },
  leaf: { seed: "Green ranger", bg: ["32df8f", "087a4f"], style: adventurerNeutral as Style<Record<string, unknown>> },
  wave: { seed: "Blue diver", bg: ["41b8ff", "1259d8"], style: avataaarsNeutral as Style<Record<string, unknown>> },
  flame: { seed: "Flame mask", bg: ["ff4c59", "ff9b23"], style: funEmoji as Style<Record<string, unknown>> },
  stone: { seed: "Stone golem", bg: ["8c96a3", "34404d"], style: botttsNeutral as Style<Record<string, unknown>> },
  comet: { seed: "Comet runner", bg: ["20d2c1", "304ffe"], style: miniavs as Style<Record<string, unknown>> },
  spark: { seed: "Spark ace", bg: ["ff5fb7", "7b3ff3"], style: micah as Style<Record<string, unknown>> },
  cloud: { seed: "Cloud bard", bg: ["8ed7ff", "4d7cff"], style: croodlesNeutral as Style<Record<string, unknown>> },
  gem: { seed: "Gem envoy", bg: ["d15cff", "24d1a0"], style: bigEarsNeutral as Style<Record<string, unknown>> }
};

const uriCache = new Map<string, string>();

export function avatarUri(avatarId: string): string {
  if (avatarId === "bolt") {
    return "/avatars/soladerp.png";
  }

  const cached = uriCache.get(avatarId);
  if (cached) {
    return cached;
  }

  const theme = THEME[avatarId] ?? {
    seed: avatarId,
    bg: ["1a2420", "0d1410"] as [string, string],
    style: openPeeps as Style<Record<string, unknown>>
  };
  const uri = createAvatar(theme.style, {
    seed: theme.seed,
    backgroundColor: theme.bg,
    backgroundType: ["gradientLinear"],
    backgroundRotation: [25],
    radius: 50
  }).toDataUri();

  uriCache.set(avatarId, uri);
  return uri;
}

interface AvatarProps {
  avatarId: string;
  size?: number;
  className?: string;
}

export function Avatar({ avatarId, size = 40, className = "" }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URI, no optimizer needed
    <img
      src={avatarUri(avatarId)}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
