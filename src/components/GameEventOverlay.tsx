"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { anchorRect } from "@/lib/anchors";
import { useRoomStore } from "@/lib/store";
import { CHAOS_BUST_VFX_MS, type UiEvent } from "@/lib/events";
import { useNow } from "@/lib/useNow";
import { useGraphicsPreset } from "./AnimationProvider";

const COLOR_VAR: Record<string, string> = {
  red: "var(--red)",
  yellow: "var(--yellow)",
  green: "var(--green)",
  blue: "var(--blue)",
  orange: "var(--orange)",
  cyan: "var(--cyan)",
  purple: "var(--purple)",
  pink: "var(--pink)"
};

const COLOR_WASH: Record<string, string> = {
  red: "rgba(224, 73, 60, 0.4)",
  yellow: "rgba(238, 188, 58, 0.42)",
  green: "rgba(47, 155, 103, 0.4)",
  blue: "rgba(61, 126, 219, 0.42)",
  orange: "rgba(242, 169, 27, 0.42)",
  cyan: "rgba(29, 184, 128, 0.42)",
  purple: "rgba(130, 87, 216, 0.42)",
  pink: "rgba(232, 79, 154, 0.42)"
};

const BURST_POINTS = [
  [-120, -82, -20],
  [-88, 96, 14],
  [-36, -122, 7],
  [42, 112, -12],
  [98, -92, 18],
  [130, 40, -8],
  [0, -150, 0],
  [0, 150, 0]
] as const;

const CHAOS_SPARKS = [
  [-156, -42, -18],
  [-118, 108, 16],
  [-52, -142, 8],
  [38, 126, -10],
  [112, -96, 22],
  [152, 34, -16],
  [-10, -170, 0],
  [18, 168, 0],
  [-190, 18, -28],
  [190, -12, 28]
] as const;

const BUST_CONFETTI = [
  [-154, -102, -38],
  [-126, 90, 28],
  [-62, -164, 14],
  [72, 150, -24],
  [138, -86, 38],
  [174, 32, -18],
  [-176, 18, 24],
  [20, 182, 8]
] as const;

const BUST_SMOKE = [
  [-92, -54],
  [78, -66],
  [104, 52],
  [-70, 78],
  [8, -110]
] as const;

const STARBURST_CLIP = "polygon(50% 0%,57% 30%,73% 8%,72% 35%,96% 20%,78% 43%,100% 50%,77% 57%,94% 82%,69% 68%,70% 100%,56% 73%,43% 98%,44% 70%,19% 88%,31% 64%,0% 58%,28% 49%,3% 29%,35% 39%,28% 6%,47% 31%)";

const FLASHBANG_SFX_DELAY_MS = 650;
const FLASHBANG_SFX_DURATION_MS = 4_730;
const FLASHBANG_TOTAL_VFX_MS = FLASHBANG_SFX_DELAY_MS + FLASHBANG_SFX_DURATION_MS;

export function GameEventOverlay() {
  const events = useRoomStore((state) => state.events);
  const snapshot = useRoomStore((state) => state.snapshot);
  const dismissEvent = useRoomStore((state) => state.dismissEvent);
  const nukeCountdown = snapshot?.pendingChaos?.kind === "nuke" && snapshot.pendingChaos.phase === "countdown"
    ? snapshot.pendingChaos
    : undefined;
  // useNow already returns the server-synced clock — adding clockOffset on
  // top shifted every toast gate by the offset. Only tick while toasts exist.
  const now = useNow(50, events.length > 0 || Boolean(nukeCountdown));
  const { preset } = useGraphicsPreset();
  const reduceMotion = useReducedMotion() || preset.reduceMotion;
  const toastEvents = events.filter((event) => event.type !== "yourTurn" && event.type !== "matchChain");
  const visibleToasts = toastEvents.filter((event) => !(event.type === "chaos" && event.kind === "nuke" && event.phase === "countdown"));
  const active = visibleToasts
    .filter((event) => {
      const visualEnd = visualEventEnd(event);
      return (!event.startsAt || event.startsAt <= now) && (!visualEnd || visualEnd + 500 > now);
    })
    .sort((a, b) => eventPriority(b) - eventPriority(a) || (a.startsAt ?? 0) - (b.startsAt ?? 0))[0];

  useEffect(() => {
    for (const event of toastEvents) {
      const visualEnd = visualEventEnd(event);
      if (visualEnd && visualEnd + 500 <= now) dismissEvent(event.id);
    }
  }, [dismissEvent, now, toastEvents]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center overflow-hidden">
      {nukeCountdown?.countdownEndsAt ? (
        <NukeCountdownPulse startsAt={nukeCountdown.startsAt} endsAt={nukeCountdown.countdownEndsAt} reduceMotion={Boolean(reduceMotion)} now={now} />
      ) : null}
      <AnimatePresence>
        {active ? <EventToast key={active.id} event={active} onDone={() => dismissEvent(active.id)} preset={preset} /> : null}
      </AnimatePresence>
    </div>
  );
}

function eventPriority(event: UiEvent): number {
  switch (event.type) {
    case "chaosBust": return 6;
    case "chaos": return event.kind === "nuke" ? 6 : 4;
    case "catchWindow": return 5;
    case "jumpIn": return 4;
    case "calledOne": return 4;
    case "penalty":
    case "drawResult":
    case "stack": return 3;
    case "skip":
    case "reverse":
    case "colorChange": return 2;
    default: return 1;
  }
}

export function eventToastDurationMs(event: UiEvent): number {
  if (event.type === "chaosBust") {
    return CHAOS_BUST_VFX_MS;
  }
  if (event.type === "chaos") {
    if (event.kind === "flashbang" && event.phase === "sequence") {
      return FLASHBANG_TOTAL_VFX_MS + 250;
    }
    if (event.kind === "nuke" && event.phase === "countdown" && event.startsAt && event.resolvesAt) {
      return Math.max(2_400, event.resolvesAt - event.startsAt);
    }
    if (event.kind === "nuke" && event.phase === "detonating") {
      return event.startsAt && event.resolvesAt
        ? Math.max(700, event.resolvesAt - event.startsAt)
        : 1_600;
    }
    if (event.kind === "peek" && event.phase === "reveal") {
      return 5_200;
    }
    return 1_900;
  }
  if (event.startsAt && event.resolvesAt) {
    return Math.max(700, Math.min(2_400, event.resolvesAt - event.startsAt));
  }
  if (event.type === "penalty" || event.type === "stack") {
    return 2000;
  }

  if (event.type === "drawResult") {
    return 2400;
  }

  if (event.type === "skip" || event.type === "reverse" || event.type === "colorChange") {
    return 1700;
  }

  if (event.type === "catchWindow" || event.type === "calledOne") {
    return 1800;
  }

  return 1600;
}

function visualEventEnd(event: UiEvent): number | undefined {
  if (event.type === "chaosBust" && event.startsAt) {
    return Math.max(event.resolvesAt ?? 0, event.startsAt + CHAOS_BUST_VFX_MS);
  }
  return event.resolvesAt;
}

function EventToast({ event, onDone, preset }: { event: UiEvent; onDone: () => void; preset: import("@/lib/animationPresets").AnimationPreset }) {
  const t = useTranslations();
  const reduceMotion = useReducedMotion() || preset.reduceMotion;
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), eventToastDurationMs(event));
    return () => window.clearTimeout(id);
  }, [event]);

  const now = useNow(200);
  const { label, sublabel, background, color } = toastContent(event, t, now);
  const wash = eventWash(event);
  const shakeForSelfBust = event.type === "chaosBust" && event.self && !reduceMotion;

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center px-3 sm:px-4"
      initial={{ opacity: 0 }}
      animate={shakeForSelfBust ? {
        opacity: 1,
        x: [0, 0, -10, 9, -7, 6, 0, 0, -5, 4, -2, 0],
        y: [0, 0, 5, -4, 3, -3, 0, 0, 3, -2, 1, 0]
      } : { opacity: 1 }}
      exit={{ opacity: 0, x: 0, y: 0 }}
      transition={shakeForSelfBust ? {
        opacity: { duration: 0.18 },
        x: { duration: 1.18, times: [0, 0.14, 0.2, 0.26, 0.32, 0.38, 0.46, 0.62, 0.7, 0.77, 0.85, 1], ease: "easeOut" },
        y: { duration: 1.18, times: [0, 0.14, 0.2, 0.26, 0.32, 0.38, 0.46, 0.62, 0.7, 0.77, 0.85, 1], ease: "easeOut" }
      } : { duration: reduceMotion ? 0.12 : 0.18 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: wash }}
        initial={{ opacity: 0 }}
        animate={{ opacity: reduceMotion ? 0.45 : [0, 0.74, 0.48] }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : eventToastDurationMs(event) / 1000, ease: "easeOut" }}
      />

      <EventVfx event={event} reduceMotion={Boolean(reduceMotion)} preset={preset} />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { scale: 0.45, opacity: 0, y: 28 }}
        animate={reduceMotion ? { opacity: 1 } : { scale: [0.72, 1.12, 1], opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { scale: 0.84, opacity: 0, y: -22 }}
        transition={{ type: reduceMotion ? "tween" : "spring", stiffness: 420, damping: 22 }}
        className={`relative z-10 grid justify-items-center gap-2 ${
          event.type === "penalty" && event.self ? "shake" : ""
        }`}
      >
        <div
          className="event-toast-label display relative overflow-hidden rounded-[28px] border-2 border-white/30 text-center font-black uppercase text-white shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-md"
          style={{ background, color }}
        >
          <motion.span
            className="absolute inset-0"
            aria-hidden="true"
            style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 48%, transparent 64%)" }}
            initial={{ x: "-120%" }}
            animate={reduceMotion ? { x: "-120%" } : { x: "130%" }}
            transition={{ duration: 1.15, ease: "easeOut" }}
          />
          <span className="relative z-10">{label}</span>
        </div>
        {sublabel ? (
          <div className="event-toast-sublabel rounded-full border border-white/15 bg-black/78 px-4 py-1.5 text-sm font-black text-white shadow-[0_10px_28px_rgba(0,0,0,0.42)]">
            {sublabel}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function EventVfx({ event, reduceMotion, preset }: { event: UiEvent; reduceMotion: boolean; preset: import("@/lib/animationPresets").AnimationPreset }) {
  if (event.type === "chaosBust") {
    return <ChaosBustVfx event={event} reduceMotion={reduceMotion} preset={preset} />;
  }

  if (reduceMotion) {
    return null;
  }

  if (event.type === "chaos") {
    return <ChaosCardVfx event={event} preset={preset} />;
  }

  if (event.type === "reverse") {
    const symbol = event.direction === 1 ? "↻" : "↺";
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="display grid h-52 w-52 place-items-center rounded-full border-4 border-blue-200/50 text-8xl font-black text-blue-100/80"
          animate={{ rotate: event.direction === 1 ? 360 : -360, scale: [0.82, 1.1, 0.96] }}
          transition={{ duration: 1.45, ease: "easeInOut" }}
        >
          {symbol}
        </motion.div>
        <motion.div
          className="absolute h-72 w-72 rounded-full border border-blue-100/25"
          animate={{ rotate: event.direction === 1 ? -240 : 240, scale: [0.85, 1.28], opacity: [0, 0.7, 0] }}
          transition={{ duration: 1.7, ease: "easeOut" }}
        />
      </div>
    );
  }

  if (event.type === "skip") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="display grid h-52 w-52 place-items-center rounded-full border-[14px] border-white/40 text-8xl font-black text-white/70"
          animate={{ scale: [0.65, 1.08, 0.94], opacity: [0, 1, 0.58] }}
          transition={{ duration: 1.45, ease: "easeOut" }}
        >
          ⊘
        </motion.div>
      </div>
    );
  }

  if (event.type === "penalty") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="absolute h-56 w-56 rounded-full border-4 border-red-200/45"
          animate={{ scale: [0.3, 1.55], opacity: [0.9, 0] }}
          transition={{ duration: 1.25, ease: "easeOut" }}
        />
        {BURST_POINTS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className="absolute h-16 w-11 rounded-md border border-red-100/35 bg-gradient-to-b from-red-200/80 to-red-600/60 shadow-[0_0_18px_rgba(224,73,60,0.5)]"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.55 }}
            animate={{ x, y, rotate, opacity: [0, 1, 0], scale: [0.65, 1, 0.88] }}
            transition={{ duration: 1.35, delay: index * 0.035, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.type === "stack") {
    const level = Math.min(8, Math.max(1, event.level));
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="display absolute rounded-full border-4 border-[var(--gold)]/70 bg-black/35 px-8 py-5 text-7xl font-black text-[var(--gold-strong)] shadow-[0_0_58px_rgba(242,193,78,0.58)]"
          animate={{ scale: [0.58, 1.05 + level * 0.04, 0.96], rotate: [-4, 3, 0] }}
          transition={{ duration: 1.25, ease: "easeOut" }}
        >
          +{event.totalDraw}
        </motion.div>
        {Array.from({ length: preset.particleCount }, (_, index) => (
          <motion.div
            key={index}
            className="absolute h-24 w-16 rounded-lg border border-yellow-100/35 bg-gradient-to-b from-yellow-200/75 to-yellow-600/60"
            initial={{ y: 28, rotate: 0, opacity: 0 }}
            animate={{
              y: -58 - index * 14,
              rotate: (index - 1.5) * 15,
              opacity: [0, index < level ? 0.88 : 0.34, 0]
            }}
            transition={{ duration: 1.55, delay: index * 0.08, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.type === "colorChange") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        {(["red", "yellow", "green", "blue", "orange", "cyan", "purple", "pink"] as const).slice(0, preset.particleCount).map((color, index) => (
          <motion.div
            key={color}
            className="absolute h-24 w-24 rounded-full"
            style={{ background: COLOR_VAR[color] }}
            initial={{ scale: 0.25, opacity: 0, x: 0, y: 0 }}
            animate={{
              scale: [0.25, 1.2, 0.7],
              opacity: [0, color === event.color ? 0.86 : 0.4, 0],
              x: Math.cos((index / 8) * Math.PI * 2) * 150,
              y: Math.sin((index / 8) * Math.PI * 2) * 96
            }}
            transition={{ duration: 1.45, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.type === "calledOne" || event.type === "catchWindow") {
    const urgent = event.type === "catchWindow";
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        {Array.from({ length: Math.min(3, preset.particleCount) }, (_, index) => (
          <motion.div
            key={index}
            className={`absolute rounded-full border-4 ${urgent ? "border-red-200/45" : "border-[var(--gold)]/45"}`}
            initial={{ width: 120, height: 120, opacity: 0 }}
            animate={{ width: 340 + index * 72, height: 340 + index * 72, opacity: [0, 0.65, 0] }}
            transition={{ duration: 1.45, delay: index * 0.16, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.type === "jumpIn") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="absolute h-72 w-72 rounded-full border border-[var(--gold)]/30"
          animate={{ scale: [0.45, 1.18, 1.55], opacity: [0.7, 0.35, 0] }}
          transition={{ duration: 1.05, ease: "easeOut" }}
        />
        <motion.div
          className="absolute h-24 w-36 rounded-[26px] border-2 border-white/25 bg-white/10 shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-sm"
          initial={{ x: -160, y: 36, rotate: -14, opacity: 0, scale: 0.82 }}
          animate={{ x: [-160, -16, 0], y: [36, 0, -4], rotate: [-14, -2, 0], opacity: [0, 1, 0.95], scale: [0.82, 1.02, 1] }}
          transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="absolute h-24 w-36 rounded-[26px] border-2 border-[var(--gold)]/35 bg-[rgba(242,193,78,0.16)] shadow-[0_18px_42px_rgba(242,193,78,0.18)] backdrop-blur-sm"
          initial={{ x: 160, y: -24, rotate: 16, opacity: 0, scale: 0.78 }}
          animate={{ x: [160, 18, 0], y: [-24, 0, 8], rotate: [16, 3, 0], opacity: [0, 1, 0.85], scale: [0.78, 1.04, 1] }}
          transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1], delay: 0.04 }}
        />
      </div>
    );
  }

  return null;
}

function anchoredCenterStyle(anchorKey: string): CSSProperties {
  const rect = anchorRect(anchorKey);
  if (!rect) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  return {
    left: rect.left + rect.width / 2,
    top: rect.top + rect.height / 2,
    transform: "translate(-50%, -50%)"
  };
}

export function nukeDangerStage(remainingMs: number): 0 | 1 | 2 | 3 | 4 {
  if (remainingMs <= 5_000) return 4;
  if (remainingMs <= 10_000) return 3;
  if (remainingMs <= 20_000) return 2;
  if (remainingMs <= 30_000) return 1;
  return 0;
}

function NukeCountdownPulse({
  startsAt,
  endsAt,
  reduceMotion,
  now
}: {
  startsAt: number;
  endsAt: number;
  reduceMotion: boolean;
  now: number;
}) {
  const style = anchoredCenterStyle("draw");
  const totalMs = Math.max(1, endsAt - startsAt);
  const remainingMs = Math.max(0, endsAt - now);
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const dangerStage = nukeDangerStage(remainingMs);
  const pulseDuration = [1.8, 1.45, 1.08, 0.72, 0.46][dangerStage]!;
  const edgeOpacity = 0.08 + progress * 0.5;

  if (reduceMotion) {
    return (
      <div className="absolute inset-0 z-[1]">
        <div
          className="absolute inset-0"
          style={{
            opacity: edgeOpacity,
            background: "radial-gradient(ellipse at center, transparent 38%, rgba(74,0,0,0.42) 70%, rgba(18,0,0,0.88) 100%)",
            boxShadow: `inset 0 0 ${48 + progress * 90}px rgba(136, 0, 0, ${0.18 + progress * 0.38})`
          }}
        />
        <div className="absolute h-0 w-0" style={style}>
          <div
            className="absolute -left-12 -top-12 h-24 w-24 rounded-full border-2 border-red-300/30"
            style={{ opacity: 0.22 + progress * 0.38 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[1]">
      <motion.div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 34%, rgba(92,0,0,0.42) 68%, rgba(17,0,0,0.92) 100%)",
          boxShadow: `inset 0 0 ${52 + progress * 118}px rgba(154, 0, 0, ${0.2 + progress * 0.46})`
        }}
        animate={{ opacity: [edgeOpacity * 0.56, edgeOpacity, edgeOpacity * 0.56] }}
        transition={{ duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-2 rounded-[18px] border-2"
        style={{ borderColor: `rgba(255, 55, 38, ${0.12 + progress * 0.58})` }}
        animate={{ opacity: [0.35, 0.92, 0.35] }}
        transition={{ duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
      />
      {dangerStage >= 2 ? (
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,28,18,0.12),transparent_24%,transparent_76%,rgba(255,28,18,0.14))] mix-blend-screen"
          animate={{ opacity: [0.08, 0.2 + progress * 0.32, 0.08] }}
          transition={{ duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <div className="absolute h-0 w-0" style={style}>
        <motion.div
          className="absolute -left-20 -top-20 h-40 w-40 rounded-full border border-red-300/24"
          animate={{ scale: [0.72, 1.2 + progress * 0.3, 0.72], opacity: [0.12, 0.3 + progress * 0.42, 0.12] }}
          transition={{ duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {dangerStage === 4 ? (
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,60,24,0.08),rgba(180,0,0,0.22)_62%,rgba(45,0,0,0.34))]"
          animate={{ opacity: [0.12, 0.48, 0.12] }}
          transition={{ duration: 0.46, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </div>
  );
}

function SeatPulse({ playerId, index, label = "ZIP" }: { playerId: string; index: number; label?: string }) {
  return (
    <div className="absolute h-0 w-0" style={anchoredCenterStyle(`seat:${playerId}`)}>
      <motion.div
        className="display absolute -left-8 -top-8 grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--gold)]/55 bg-black/55 text-xs font-black text-[var(--gold-strong)] shadow-[0_0_28px_rgba(242,193,78,0.38)]"
        initial={{ scale: 0.35, opacity: 0, rotate: -12 }}
        animate={{ scale: [0.35, 1.12, 0.84], opacity: [0, 1, 0], rotate: [-12, 8, 0] }}
        transition={{ duration: 1.1, delay: index * 0.12, ease: "easeOut" }}
      >
        {label}
      </motion.div>
      <motion.div
        className="absolute -left-12 -top-12 h-24 w-24 rounded-full border border-white/25"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.35], opacity: [0.65, 0] }}
        transition={{ duration: 1.05, delay: index * 0.12, ease: "easeOut" }}
      />
    </div>
  );
}

function ChaosBustVfx({
  event,
  reduceMotion,
  preset
}: {
  event: Extract<UiEvent, { type: "chaosBust" }>;
  reduceMotion: boolean;
  preset: import("@/lib/animationPresets").AnimationPreset;
}) {
  const style = anchoredCenterStyle(`seat:${event.playerId}`);
  const particleCount = reduceMotion ? 0 : preset.particleCount;

  return (
    <div className="absolute inset-0 z-[2]" aria-hidden="true">
      {event.self && !reduceMotion ? (
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,248,188,0.54),rgba(255,105,38,0.28)_34%,rgba(121,16,8,0.18)_58%,transparent_76%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.46, 0.06, 0.22, 0] }}
          transition={{ duration: 0.86, times: [0, 0.24, 0.48, 0.64, 1], ease: "easeOut" }}
        />
      ) : null}
      <div className="absolute h-0 w-0" style={style}>
        {reduceMotion ? (
          <>
            <div
              className="absolute bg-gradient-to-br from-yellow-100 via-orange-400 to-red-700 opacity-85 shadow-[0_0_32px_rgba(255,128,42,0.42)]"
              style={{
                clipPath: STARBURST_CLIP,
                width: "clamp(220px, 32vw, 360px)",
                height: "clamp(220px, 32vw, 360px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
            />
            <div
              className="absolute rounded-full border-4 border-yellow-100/55"
              style={{
                width: "clamp(180px, 27vw, 300px)",
                height: "clamp(180px, 27vw, 300px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className="absolute rounded-full border-4 border-yellow-100/70 bg-orange-300/12 shadow-[0_0_34px_rgba(255,224,118,0.72)]"
              style={{
                width: "clamp(120px, 18vw, 180px)",
                height: "clamp(120px, 18vw, 180px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
              initial={{ scale: 1.28, opacity: 0 }}
              animate={{ scale: [1.28, 0.68, 0.08], opacity: [0, 0.58, 1] }}
              transition={{ duration: 0.18, ease: "easeIn" }}
            />
            <motion.div
              className="absolute -left-6 -top-6 h-12 w-12 rounded-full bg-white shadow-[0_0_38px_18px_rgba(255,230,118,0.75)]"
              initial={{ scale: 0.15, opacity: 0 }}
              animate={{ scale: [0.15, 0.82, 0.1, 1.45], opacity: [0, 0.9, 1, 0] }}
              transition={{ duration: 0.48, times: [0, 0.28, 0.38, 1], ease: "easeOut" }}
            />
            <motion.div
              className="absolute bg-gradient-to-br from-red-500 via-orange-600 to-red-950 shadow-[0_0_54px_rgba(255,71,30,0.62)]"
              style={{
                clipPath: STARBURST_CLIP,
                width: "clamp(240px, 35vw, 380px)",
                height: "clamp(240px, 35vw, 380px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
              initial={{ scale: 0.05, opacity: 0, rotate: -7 }}
              animate={{ scale: [0.05, 1.16, 0.98, 1.08], opacity: [0, 1, 0.88, 0], rotate: [-7, 5, -2, 9] }}
              transition={{ delay: 0.15, duration: 1.18, times: [0, 0.12, 0.52, 1], ease: "easeOut" }}
            />
            <motion.div
              className="absolute bg-gradient-to-br from-yellow-100 via-yellow-300 to-orange-500 shadow-[0_0_46px_rgba(255,224,105,0.72)]"
              style={{
                clipPath: STARBURST_CLIP,
                width: "clamp(190px, 29vw, 310px)",
                height: "clamp(190px, 29vw, 310px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
              initial={{ scale: 0.04, opacity: 0, rotate: 12 }}
              animate={{ scale: [0.04, 1.12, 0.92, 1.02], opacity: [0, 1, 0.82, 0], rotate: [12, -7, 3, -10] }}
              transition={{ delay: 0.17, duration: 0.98, times: [0, 0.12, 0.56, 1], ease: "easeOut" }}
            />
            <motion.div
              className="absolute bg-white shadow-[0_0_38px_rgba(255,255,255,0.92)]"
              style={{
                clipPath: STARBURST_CLIP,
                width: "clamp(110px, 18vw, 190px)",
                height: "clamp(110px, 18vw, 190px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
              initial={{ scale: 0.03, opacity: 0, rotate: -10 }}
              animate={{ scale: [0.03, 1.08, 0.72], opacity: [0, 1, 0], rotate: [-10, 4, 14] }}
              transition={{ delay: 0.18, duration: 0.62, times: [0, 0.2, 1], ease: "easeOut" }}
            />
            <motion.div
              className="absolute bg-gradient-to-br from-yellow-100 via-orange-400 to-red-700 shadow-[0_0_42px_rgba(255,117,38,0.58)]"
              style={{
                clipPath: STARBURST_CLIP,
                width: "clamp(170px, 26vw, 280px)",
                height: "clamp(170px, 26vw, 280px)",
                left: "50%",
                top: "50%",
                translate: "-50% -50%"
              }}
              initial={{ scale: 0.16, opacity: 0, rotate: -18 }}
              animate={{ scale: [0.16, 1.04, 1.34], opacity: [0, 0.58, 0], rotate: [-18, 8, 20] }}
              transition={{ delay: 0.74, duration: 0.92, times: [0, 0.22, 1], ease: "easeOut" }}
            />
            {[0.18, 0.3, 0.78].map((delay, index) => (
              <motion.div
                key={`shockwave-${index}`}
                className="absolute rounded-full border-4 border-yellow-100/70 shadow-[0_0_24px_rgba(255,182,66,0.35)]"
                style={{
                  width: "clamp(160px, 25vw, 280px)",
                  height: "clamp(160px, 25vw, 280px)",
                  left: "50%",
                  top: "50%",
                  translate: "-50% -50%"
                }}
                initial={{ scale: 0.18, opacity: 0 }}
                animate={{ scale: [0.18, 1.12, 1.72], opacity: [0, 0.78, 0] }}
                transition={{ delay, duration: index === 2 ? 1.28 : 0.94 + index * 0.2, times: [0, 0.18, 1], ease: "easeOut" }}
              />
            ))}
            {BUST_CONFETTI.slice(0, particleCount).map(([x, y, rotate], index) => {
              const starFragment = index % 3 === 1;
              return (
                <motion.div
                  key={index}
                  className={starFragment
                    ? "absolute -left-4 -top-4 h-8 w-8 bg-gradient-to-br from-white via-yellow-200 to-orange-500 shadow-[0_0_16px_rgba(255,222,92,0.78)]"
                    : "absolute -left-4 -top-6 h-12 w-8 rounded-md border-2 border-white/55 bg-gradient-to-b from-yellow-100 via-orange-400 to-red-600 shadow-[0_0_18px_rgba(255,92,73,0.62)]"}
                  style={starFragment ? { clipPath: STARBURST_CLIP } : undefined}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.2 }}
                  animate={{ x, y, rotate, opacity: [0, 1, 0.88, 0], scale: [0.2, 1.12, 0.86, 0.55] }}
                  transition={{ duration: 2.15, delay: 0.31 + index * 0.028, times: [0, 0.12, 0.68, 1], ease: "easeOut" }}
                />
              );
            })}
            {BUST_SMOKE.slice(0, Math.min(BUST_SMOKE.length, Math.ceil(particleCount / 2) + 1)).map(([x, y], index) => (
              <motion.div
                key={`smoke-${index}`}
                className="absolute -left-9 -top-9 h-16 w-16 rounded-full bg-gradient-to-br from-white/48 via-zinc-300/30 to-zinc-700/10 blur-[1px]"
                initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                animate={{ x, y, scale: [0.2, 1.18, 1.48], opacity: [0, 0.48, 0.24, 0] }}
                transition={{ duration: 2.05, delay: 0.62 + index * 0.07, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
              />
            ))}
            {BUST_CONFETTI.slice(0, Math.min(6, particleCount)).map(([x, y], index) => (
              <motion.div
                key={`ember-${index}`}
                className="absolute -left-1 -top-1 h-2 w-7 rounded-full bg-yellow-100 shadow-[0_0_14px_rgba(255,204,72,0.86)]"
                initial={{ x: 0, y: 0, rotate: 0, scaleX: 0.2, opacity: 0 }}
                animate={{ x: x * 0.82, y: y * 0.82, rotate: Math.atan2(y, x) * (180 / Math.PI), scaleX: [0.2, 1.3, 0.4], opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.15, delay: 0.24 + index * 0.024, ease: "easeOut" }}
              />
            ))}
          </>
        )}
        <motion.div
          className="display absolute grid min-h-16 w-[clamp(5.5rem,10vw,7.5rem)] place-items-center rounded-[20px] border-4 border-white/60 bg-gradient-to-b from-yellow-100 via-orange-500 to-red-800 px-3 py-2 text-center font-black text-white shadow-[0_18px_44px_rgba(0,0,0,0.52),0_0_28px_rgba(255,124,38,0.48)]"
          style={{ left: "50%", top: "50%", translate: "-50% -50%" }}
          initial={reduceMotion ? { opacity: 0 } : { scale: 0.2, opacity: 0, rotate: -12 }}
          animate={reduceMotion
            ? { opacity: 1 }
            : { scale: [0.2, 0.2, 1.16, 0.96, 0.86], opacity: [0, 0, 1, 1, 0], rotate: [-12, -12, 8, -3, 2] }}
          transition={reduceMotion
            ? { duration: 0.14, ease: "easeOut" }
            : { delay: 0.3, duration: 3, times: [0, 0.08, 0.2, 0.86, 1], ease: "easeOut" }}
        >
          <span className="text-3xl leading-none">{event.count}</span>
          <span className="text-sm leading-none">&gt;25</span>
        </motion.div>
      </div>
    </div>
  );
}

function ChaosCardVfx({ event, preset }: { event: Extract<UiEvent, { type: "chaos" }>; preset: import("@/lib/animationPresets").AnimationPreset }) {
  if (event.kind === "flashbang") {
    const flashDelay = FLASHBANG_SFX_DELAY_MS / 1000;
    const flashDuration = FLASHBANG_SFX_DURATION_MS / 1000;
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.98, 0.84, 0.34, 0] }}
          transition={{ delay: flashDelay, duration: flashDuration, times: [0, 0.05, 0.24, 0.72, 1], ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9),rgba(255,255,255,0.42)_30%,rgba(255,255,255,0)_68%)]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 0.72, 0.36, 0], scale: [0.9, 1.02, 1.08, 1.12] }}
          transition={{ delay: flashDelay, duration: flashDuration, times: [0, 0.12, 0.55, 1], ease: "easeOut" }}
        />
        {Array.from({ length: Math.min(3, preset.particleCount) }, (_, index) => (
          <motion.div
            key={index}
            className="absolute rounded-full border-4 border-white/55"
            initial={{ width: 80, height: 80, opacity: 0 }}
            animate={{ width: 360 + index * 90, height: 360 + index * 90, opacity: [0, 0.65, 0] }}
            transition={{ duration: 1.2, delay: flashDelay + index * 0.08, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.kind === "throwup") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="display absolute rounded-full border-4 border-lime-100/50 bg-green-400/38 px-8 py-4 text-4xl font-black text-lime-50 shadow-[0_0_48px_rgba(96,255,122,0.36)]"
          initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
          animate={{ scale: [0.3, 1.16, 0.9], opacity: [0, 1, 0.76], rotate: [-8, 8, -2] }}
          transition={{ duration: 1.05, ease: "easeOut" }}
        >
          BLEH
        </motion.div>
        {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className="absolute h-10 w-10 rounded-full bg-lime-300/70 shadow-[0_0_18px_rgba(132,255,99,0.45)]"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.22 }}
            animate={{ x, y, rotate, opacity: [0, 0.9, 0], scale: [0.22, 1, 0.55] }}
            transition={{ duration: 1.1, delay: index * 0.035, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.kind === "steal") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        {event.targetIds?.slice(0, 2).map((playerId, index) => <SeatPulse key={playerId} playerId={playerId} index={index} label="YOINK" />)}
        <motion.div
          className="display absolute rounded-[28px] border-2 border-purple-100/45 bg-purple-950/70 px-8 py-4 text-4xl font-black text-purple-100 shadow-[0_0_44px_rgba(190,88,255,0.42)]"
          initial={{ scale: 0.46, opacity: 0, y: 24 }}
          animate={{ scale: [0.46, 1.12, 0.95], opacity: [0, 1, 0.82], y: [24, -8, 0] }}
          transition={{ duration: 1.12, ease: "easeOut" }}
        >
          HEH
        </motion.div>
      </div>
    );
  }

  if (event.kind === "favor") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        {event.targetIds?.slice(0, 2).map((playerId, index) => <SeatPulse key={playerId} playerId={playerId} index={index} label="GIVE" />)}
        {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className="display absolute grid h-11 w-14 place-items-center rounded-full border border-pink-100/35 bg-pink-400/50 text-xs font-black text-white"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.35 }}
            animate={{ x, y, rotate, opacity: [0, 1, 0], scale: [0.35, 1.06, 0.64] }}
            transition={{ duration: 1.15, delay: index * 0.035, ease: "easeOut" }}
          >
            OK
          </motion.div>
        ))}
      </div>
    );
  }

  if (event.kind === "peek") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="absolute grid h-56 w-56 place-items-center rounded-full border-4 border-cyan-100/45 bg-black/35 shadow-[0_0_64px_rgba(80,220,255,0.38)]"
          initial={{ scaleX: 0.1, scaleY: 0.02, opacity: 0 }}
          animate={{ scaleX: [0.1, 1.2, 1], scaleY: [0.02, 0.72, 0.58], opacity: [0, 1, 0.74] }}
          transition={{ duration: 1.12, ease: "easeOut" }}
        >
          <motion.div
            className="h-20 w-20 rounded-full bg-cyan-100 shadow-[0_0_28px_rgba(165,255,255,0.75)]"
            animate={{ scale: [0.7, 1.1, 0.9] }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </motion.div>
        {Array.from({ length: Math.min(5, preset.particleCount) }, (_, index) => (
          <motion.div
            key={index}
            className="absolute h-20 w-14 rounded-lg border border-cyan-100/30 bg-white/12"
            initial={{ y: 70, rotateY: 90, opacity: 0 }}
            animate={{ y: -70, rotateY: [90, 0], opacity: [0, 0.82, 0] }}
            transition={{ duration: 1.1, delay: 0.1 + index * 0.09, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.kind === "timeskip") {
    const targets = event.targetIds?.length ? event.targetIds : event.actorId ? [event.actorId] : [];
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        {targets.slice(0, preset.particleCount).map((playerId, index) => <SeatPulse key={playerId} playerId={playerId} index={index} label="SKIP" />)}
        <motion.div
          className="display absolute grid h-56 w-56 place-items-center rounded-full border-[12px] border-yellow-100/45 bg-black/38 text-7xl font-black text-yellow-100"
          initial={{ scale: 0.42, opacity: 0, rotate: -90 }}
          animate={{ scale: [0.42, 1.04, 0.92], opacity: [0, 1, 0.76], rotate: [-90, 360] }}
          transition={{ duration: 1.35, ease: "easeInOut" }}
        >
          12
        </motion.div>
      </div>
    );
  }

  if (event.kind === "nuke") {
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        {event.targetIds?.slice(0, 1).map((playerId, index) => <SeatPulse key={playerId} playerId={playerId} index={index} label="HIT" />)}
        <motion.div
          className="absolute h-72 w-72 rounded-full border-4 border-orange-100/55 bg-[radial-gradient(circle,rgba(255,240,168,0.7),rgba(255,107,31,0.34)_42%,transparent_68%)]"
          initial={{ scale: 0.15, opacity: 0 }}
          animate={{ scale: [0.15, 1.1, 1.55], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.15, ease: "easeOut" }}
        />
        <motion.div
          className="display absolute rounded-[32px] border-4 border-white/35 bg-red-700/72 px-8 py-4 text-5xl font-black text-white shadow-[0_0_58px_rgba(255,80,40,0.55)]"
          initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
          animate={{ scale: [0.4, 1.18, 0.92], opacity: [0, 1, 0.8], rotate: [-8, 8, 0] }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          BOOM
        </motion.div>
      </div>
    );
  }

  return null;
}

function eventWash(event: UiEvent): string {
  switch (event.type) {
    case "chaosBust":
      return event.self
        ? "radial-gradient(circle at center, rgba(255, 214, 88, 0.28), transparent 34%), radial-gradient(circle at center, rgba(255, 64, 44, 0.42), transparent 54%), rgba(35, 4, 2, 0.44)"
        : "radial-gradient(circle at center, rgba(255, 214, 88, 0.22), transparent 38%), rgba(35, 4, 2, 0.28)";
    case "chaos":
      return event.kind === "nuke"
        ? "radial-gradient(circle at center, rgba(255, 80, 40, 0.42), transparent 42%), rgba(20, 4, 2, 0.48)"
        : "radial-gradient(circle at center, rgba(255, 255, 255, 0.26), transparent 34%), radial-gradient(circle at 30% 30%, rgba(255, 0, 180, 0.24), transparent 34%), radial-gradient(circle at 70% 60%, rgba(0, 190, 255, 0.22), transparent 38%)";
    case "penalty":
      return "radial-gradient(circle at center, rgba(255, 92, 73, 0.42), transparent 38%), radial-gradient(ellipse at center, transparent 38%, rgba(224, 73, 60, 0.5))";
    case "skip":
      return "radial-gradient(circle at center, rgba(255,255,255,0.18), transparent 28%), rgba(18, 25, 29, 0.34)";
    case "reverse":
      return "radial-gradient(circle at center, rgba(83, 151, 255, 0.34), transparent 42%)";
    case "colorChange":
      return `radial-gradient(circle at center, ${COLOR_WASH[event.color] ?? "rgba(242, 193, 78, 0.38)"}, transparent 48%)`;
    case "stack":
      return "radial-gradient(circle at center, rgba(255, 217, 96, 0.42), transparent 42%)";
    case "drawResult":
      return "radial-gradient(circle at center, rgba(255, 217, 96, 0.34), transparent 46%)";
    case "calledOne":
      return "radial-gradient(circle at center, rgba(255, 217, 96, 0.32), transparent 42%)";
    case "catchWindow":
      return "radial-gradient(circle at center, rgba(255, 72, 84, 0.36), transparent 44%)";
    case "jumpIn":
      return "radial-gradient(circle at center, rgba(242, 193, 78, 0.22), transparent 36%), rgba(11, 14, 17, 0.3)";
    default:
      return "transparent";
  }
}

function toastContent(
  event: UiEvent,
  t: ReturnType<typeof useTranslations>,
  now: number
): { label: string; sublabel?: string; background: string; color?: string } {
  switch (event.type) {
    case "chaosBust":
      return {
        label: "BUST!",
        sublabel: event.self
          ? t("events.chaosBustSelf", { count: event.count })
          : t("events.chaosBustOther", { name: event.nickname, count: event.count }),
        background: "linear-gradient(180deg, #fff0a8, #ff6b1f 48%, #8d1609)"
      };
    case "chaos": {
      if (event.kind === "nuke" && event.phase === "countdown") {
        const remaining = Math.max(0, Math.ceil(((event.countdownEndsAt ?? event.resolvesAt ?? now) - now) / 1000));
        return {
          label: `${remaining}`,
          sublabel: t("events.nukeCountdown"),
          background: "linear-gradient(180deg, #ffcb7a, #ff3e28 54%, #631009)"
        };
      }
      if (event.kind === "nuke" && event.phase === "detonating") {
        return {
          label: "BOOM",
          sublabel: t("events.nukeDetonating"),
          background: "linear-gradient(180deg, #fff0a8, #ff6b1f 46%, #7d1207)"
        };
      }
      const labels: Record<string, string> = {
        throwup: "THROW UP",
        steal: "STEAL",
        flashbang: "FLASHBANG",
        favor: "FAVOR",
        peek: "PEEK",
        timeskip: "TIME SKIP"
      };
      return {
        label: labels[event.kind] ?? "CHAOS",
        sublabel: event.phase === "chooseTarget" ? t("events.chaosChooseTarget") : event.phase === "chooseCard" ? t("events.chaosChooseCard") : undefined,
        background: "linear-gradient(135deg, #ff4ed8, #f2c14e 38%, #45d483 62%, #4f8cff)"
      };
    }
    case "penalty":
      return {
        label: `+${event.count}!`,
        sublabel: event.self
          ? t("events.youDrew", { count: event.count })
          : t("events.playerDrew", { name: event.nickname, count: event.count }),
        background: "linear-gradient(180deg, #ff7b68, var(--red) 58%, #8d2019)"
      };
    case "drawResult":
      return {
        label: `+${event.count}`,
        sublabel: event.self
          ? t("events.drawColorResultSelf", { count: event.count, color: t(`colors.${event.color}`) })
          : t("events.drawColorResultOther", { name: event.nickname, count: event.count, color: t(`colors.${event.color}`) }),
        background: "linear-gradient(180deg, #fff0a8, #ffc533 56%, #b66f08)",
        color: "#211405"
      };
    case "skip":
      return { label: t("events.skip"), background: "linear-gradient(180deg, #77808b, #242c35 62%, #10161d)" };
    case "reverse":
      return { label: t("events.reverse"), background: "linear-gradient(180deg, #72b1ff, var(--blue) 62%, #17427e)" };
    case "colorChange":
      return {
        label: t("events.colorChange", { color: t(`colors.${event.color}`) }),
        background: COLOR_VAR[event.color] ?? "var(--gold)",
        color: event.color === "yellow" || event.color === "cyan" ? "#221706" : "white"
      };
    case "stack":
      return {
        label: event.kind === "wildColor" ? `x${event.totalDraw}` : `+${event.totalDraw}`,
        sublabel: event.kind === "wildColor" && event.targetColor
          ? t("events.colorHunt", { color: t(`colors.${event.targetColor}`) })
          : t("events.stackPenalty"),
        background: "linear-gradient(180deg, #fff0a8, #ffc533 56%, #b66f08)",
        color: "#211405"
      };
    case "calledOne":
      return {
        label: t("board.one"),
        sublabel: t("events.calledOne", { name: event.nickname }),
        background: "linear-gradient(180deg, var(--gold-strong), var(--gold) 58%, var(--gold-deep))",
        color: "#221a07"
      };
    case "catchWindow":
      return {
        label: event.self ? t("events.youHaveOne") : t("events.catchWindow", { name: event.nickname }),
        background: "linear-gradient(180deg, rgba(30,38,31,0.98), rgba(7,10,8,0.96))"
      };
    case "jumpIn":
      return {
        label: t("events.jumpIn"),
        sublabel: event.self ? t("events.youJumpedIn") : t("events.playerJumpedIn", { name: event.nickname }),
        background: "linear-gradient(180deg, #fff2bf, #f2c14e 52%, #a96a00)",
        color: "#231705"
      };
    default:
      return { label: "", background: "transparent" };
  }
}
