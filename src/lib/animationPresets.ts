export type GraphicsTier = "high" | "low";

export interface AnimationPreset {
  /** Particle count for event VFX (bursts, sparkles) */
  particleCount: number;
  /** Whether card glow box-shadows are rendered */
  glowEnabled: boolean;
  /** Whether travelling shine animation on playable cards is enabled */
  shineEnabled: boolean;
  /** Whether flight arcs use curved paths (vs straight line) */
  flightArc: boolean;
  /** Stagger delay between simultaneous items (ms) */
  staggerMs: number;
  /** Duration scale factor — lower = faster = less GPU time */
  durationScale: number;
  /** Whether backdrop-filter blur effects are rendered */
  blurEnabled: boolean;
  /** Whether card idle rock animation is active */
  cardRockEnabled: boolean;
  /** Reduce motion further (respects prefers-reduced-motion) */
  reduceMotion: boolean;
}

export const PRESETS: Record<GraphicsTier, AnimationPreset> = {
  high: {
    particleCount: 8,
    glowEnabled: true,
    shineEnabled: true,
    flightArc: true,
    staggerMs: 50,
    durationScale: 1,
    blurEnabled: true,
    cardRockEnabled: true,
    reduceMotion: false,
  },
  low: {
    particleCount: 3,
    glowEnabled: false,
    shineEnabled: false,
    flightArc: false,
    staggerMs: 0,
    durationScale: 0.6,
    blurEnabled: false,
    cardRockEnabled: false,
    reduceMotion: true,
  },
};

export function detectGraphicsTier(): GraphicsTier {
  if (typeof window === "undefined") return "high";

  const mem = (navigator as any).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) return "low";
  if (mem < 4 || cores < 4) return "low";
  return "high";
}
