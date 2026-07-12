"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import type { ChaosSelectableCard, GameSnapshot } from "@congcard/shared";
import { anchorRect } from "@/lib/anchors";
import { useRoomStore } from "@/lib/store";
import { CHAOS_BUST_VFX_MS, type UiEvent } from "@/lib/events";
import { useNow } from "@/lib/useNow";
import { useGraphicsPreset } from "./AnimationProvider";
import { CardView } from "./CardView";

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
type NoticeUiEvent = Exclude<UiEvent, { type: "chaos" }>;

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
  const visibleEvents = toastEvents.filter((event) => !(event.type === "chaos" && event.kind === "nuke" && event.phase === "countdown"));
  const activeEvents = visibleEvents
    .filter((event) => {
      const visualEnd = visualEventEnd(event);
      return (!event.startsAt || event.startsAt <= now) && (!visualEnd || visualEnd + 500 > now);
    });
  const activeCinematic = selectActiveEvent(
    activeEvents.filter((event) => event.type === "chaos" || event.type === "chaosBust")
  );
  const activeNotice = activeCinematic
    ? undefined
    : selectActiveEvent(activeEvents.filter((event) => event.type !== "chaos" && event.type !== "chaosBust")) as NoticeUiEvent | undefined;

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
        {activeCinematic?.type === "chaos" ? (
          <ChaosCinematic
            key={activeCinematic.id}
            event={activeCinematic}
            onDone={() => dismissEvent(activeCinematic.id)}
            preset={preset}
          />
        ) : activeCinematic ? (
          <EventToast key={activeCinematic.id} event={activeCinematic as NoticeUiEvent} onDone={() => dismissEvent(activeCinematic.id)} preset={preset} />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {activeNotice ? <EventToast key={activeNotice.id} event={activeNotice} onDone={() => dismissEvent(activeNotice.id)} preset={preset} /> : null}
      </AnimatePresence>
    </div>
  );
}

export function selectActiveEvent(events: UiEvent[]): UiEvent | undefined {
  return [...events].sort(
    (a, b) => eventPriority(b) - eventPriority(a) || (b.startsAt ?? 0) - (a.startsAt ?? 0) || b.id - a.id
  )[0];
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
      return event.startsAt && event.resolvesAt
        ? Math.max(FLASHBANG_TOTAL_VFX_MS, event.resolvesAt - event.startsAt)
        : 5_650;
    }
    if (event.kind === "nuke" && event.phase === "countdown" && event.startsAt && event.resolvesAt) {
      return Math.max(2_400, event.resolvesAt - event.startsAt);
    }
    if (event.kind === "nuke" && event.phase === "detonating") {
      return event.startsAt && event.resolvesAt
        ? Math.max(700, event.resolvesAt - event.startsAt)
        : 2_800;
    }
    if (event.kind === "peek" && event.phase === "reveal") {
      return event.startsAt && event.resolvesAt ? event.resolvesAt - event.startsAt : 4_800;
    }
    if (event.phase === "chooseTarget" || event.phase === "chooseCard") {
      return 1_050;
    }
    if (["throwup", "steal", "favor", "peek", "timeskip"].includes(event.kind) && event.startsAt && event.resolvesAt) {
      return Math.max(650, event.resolvesAt - event.startsAt);
    }
    if (event.startsAt && event.resolvesAt) {
      return Math.max(650, event.resolvesAt - event.startsAt);
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

function useEventDismissTimer(event: UiEvent, onDone: () => void): void {
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const deadline = visualEventEnd(event);
    const remainingMs = deadline
      ? Math.max(0, deadline - (Date.now() + clockOffset))
      : eventToastDurationMs(event);
    const id = window.setTimeout(() => onDoneRef.current(), remainingMs);
    return () => window.clearTimeout(id);
  }, [clockOffset, event]);
}

export type ChaosTextMode = "opening" | "openingResult" | "prompt" | "result" | "none";

export function chaosTextMode(event: Extract<UiEvent, { type: "chaos" }>): ChaosTextMode {
  if (event.phase === "chooseTarget" || event.phase === "chooseCard") return "prompt";
  if (event.kind === "throwup" || event.kind === "flashbang") return "openingResult";
  if (event.phase === "opening" && !event.targetIds?.length) return "opening";
  if (
    (event.phase === "sequence" && (event.kind === "steal" || event.kind === "favor" || event.kind === "timeskip")) ||
    (event.kind === "nuke" && event.phase === "detonating")
  ) {
    return "result";
  }
  return "none";
}

function ChaosCinematic({
  event,
  onDone,
  preset
}: {
  event: Extract<UiEvent, { type: "chaos" }>;
  onDone: () => void;
  preset: import("@/lib/animationPresets").AnimationPreset;
}) {
  const reduceMotion = useReducedMotion() || preset.reduceMotion;
  const isChoice = event.phase === "chooseTarget" || event.phase === "chooseCard";
  const shakeScreen = !reduceMotion && (
    event.kind === "flashbang" ||
    event.kind === "throwup" && event.phase === "sequence" ||
    event.kind === "steal" && event.phase === "sequence" ||
    event.kind === "timeskip" && event.phase === "opening" ||
    event.kind === "nuke" && event.phase === "detonating"
  );
  useEventDismissTimer(event, onDone);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={shakeScreen ? {
        opacity: 1,
        x: [0, 0, -11, 10, -8, 7, -5, 4, 0],
        y: [0, 0, 6, -5, 4, -4, 3, -2, 0]
      } : { opacity: 1 }}
      exit={{ opacity: 0, x: 0, y: 0 }}
      transition={shakeScreen ? {
        opacity: { duration: 0.16 },
        x: { delay: event.kind === "flashbang" ? 0.62 : 0, duration: 1.15, ease: "easeOut" },
        y: { delay: event.kind === "flashbang" ? 0.62 : 0, duration: 1.15, ease: "easeOut" }
      } : { duration: reduceMotion ? 0.1 : 0.16 }}
    >
      {!isChoice ? (
        <motion.div
          className="absolute inset-0"
          style={{ background: eventWash(event) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: reduceMotion ? 0.34 : [0, 0.72, 0.46] }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : eventToastDurationMs(event) / 1000, ease: "easeOut" }}
        />
      ) : null}
      <EventVfx event={event} reduceMotion={Boolean(reduceMotion)} preset={preset} />
      <ChaosTextLanes event={event} reduceMotion={Boolean(reduceMotion)} />
    </motion.div>
  );
}

function ChaosTextLanes({ event, reduceMotion }: { event: Extract<UiEvent, { type: "chaos" }>; reduceMotion: boolean }) {
  const t = useTranslations();
  const mode = chaosTextMode(event);
  const titles: Partial<Record<Extract<UiEvent, { type: "chaos" }>["kind"], string>> = {
    throwup: "THROW UP",
    steal: "STEAL",
    flashbang: "FLASHBANG",
    favor: "FAVOR",
    peek: "PEEK",
    timeskip: "TIME SKIP",
    nuke: t("events.nukeArmed")
  };
  const title = titles[event.kind] ?? "CHAOS";
  const prompt = event.phase === "chooseTarget" ? t("events.chaosChooseTarget") : t("events.chaosChooseCard");
  const result = (() => {
    if (event.kind === "throwup") {
      return (event.amount ?? 0) > 0
        ? t("events.chaosPurge", { count: event.amount ?? 0 })
        : t("events.chaosDryHeave");
    }
    if (event.kind === "flashbang") return t("events.chaosHandsScrambled");
    if (event.kind === "steal") return t("events.chaosClaimed");
    if (event.kind === "favor") return t("events.chaosFavorReceived");
    if (event.kind === "timeskip") return t("events.chaosTimeReturned");
    if (event.kind === "nuke") return t("events.nukeCards", { count: event.amount ?? 0 });
    return undefined;
  })();
  const resultDelay = event.kind === "flashbang"
    ? 4.8
    : event.kind === "nuke"
      ? 1.9
      : event.kind === "throwup"
        ? 0.9
        : 0.65;

  return (
    <>
      {mode === "opening" || mode === "openingResult" ? (
        <motion.div
          className="absolute inset-x-3 z-10 flex justify-center"
          style={{ top: "max(76px, calc(env(safe-area-inset-top) + 64px))" }}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.72, y: -10 }}
          animate={{ opacity: [0, 1, 1, 0], scale: reduceMotion ? 1 : [0.72, 1.08, 1, 0.96], y: [-10, 0, 0, -6] }}
          transition={{ duration: 0.9, times: [0, 0.18, 0.72, 1], ease: "easeOut" }}
          aria-live="polite"
        >
          <div className="display max-w-[min(82vw,38rem)] rounded-2xl border-2 border-white/35 bg-black/72 px-6 py-2 text-center text-2xl font-black uppercase text-white shadow-[0_16px_44px_rgba(0,0,0,0.5)] backdrop-blur-md sm:text-4xl">
            {title}
          </div>
        </motion.div>
      ) : null}
      {mode === "prompt" ? (
        <motion.div
          className="absolute inset-x-3 z-10 flex justify-center"
          style={{ top: "max(76px, calc(env(safe-area-inset-top) + 64px))" }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <div className="display rounded-full border border-[var(--gold)]/55 bg-black/82 px-5 py-2 text-sm font-black uppercase text-[var(--gold-strong)] shadow-[0_12px_34px_rgba(0,0,0,0.48)] backdrop-blur-md sm:text-base">
            {prompt}
          </div>
        </motion.div>
      ) : null}
      {(mode === "result" || mode === "openingResult") && result ? (
        <motion.div
          className="absolute inset-x-3 z-10 flex justify-center"
          style={{ bottom: "max(22dvh, calc(env(safe-area-inset-bottom) + 112px))" }}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.68, y: 16 }}
          animate={{ opacity: [0, 1, 0.92], scale: reduceMotion ? 1 : [0.68, 1.12, 1], y: [16, 0, 0] }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: reduceMotion ? 0 : resultDelay, duration: reduceMotion ? 0.12 : 0.72, ease: "easeOut" }}
          aria-live="polite"
        >
          <div className="display max-w-[min(88vw,34rem)] rounded-full border-2 border-white/35 bg-black/78 px-6 py-2 text-center text-xl font-black uppercase text-white shadow-[0_14px_38px_rgba(0,0,0,0.52)] backdrop-blur-md sm:text-3xl">
            {result}
          </div>
        </motion.div>
      ) : null}
    </>
  );
}

function EventToast({ event, onDone, preset }: { event: NoticeUiEvent; onDone: () => void; preset: import("@/lib/animationPresets").AnimationPreset }) {
  const t = useTranslations();
  const reduceMotion = useReducedMotion() || preset.reduceMotion;
  useEventDismissTimer(event, onDone);

  const { label, sublabel, background, color } = toastContent(event, t);
  const wash = eventWash(event);
  const shakeForSelfBust = event.type === "chaosBust" && event.self && !reduceMotion;
  const shakeScreen = shakeForSelfBust;

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center px-3 sm:px-4"
      initial={{ opacity: 0 }}
      animate={shakeScreen ? {
        opacity: 1,
        x: [0, 0, -10, 9, -7, 6, 0, 0, -5, 4, -2, 0],
        y: [0, 0, 5, -4, 3, -3, 0, 0, 3, -2, 1, 0]
      } : { opacity: 1 }}
      exit={{ opacity: 0, x: 0, y: 0 }}
      transition={shakeScreen ? {
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
        transition={{ type: "tween", duration: reduceMotion ? 0.12 : 0.46, ease: "easeOut" }}
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

  if (event.type === "chaos") {
    return <ChaosCardVfx event={event} preset={preset} reduceMotion={reduceMotion} />;
  }

  if (reduceMotion) {
    return null;
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
      <motion.div
        className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_7px,rgba(255,54,35,0.055)_8px)]"
        animate={{ opacity: [0.08, 0.18 + progress * 0.24, 0.08], y: ["-1%", "1%"] }}
        transition={{ duration: Math.max(0.7, pulseDuration * 1.35), repeat: Infinity, ease: "linear" }}
      />
      {[
        "left-3 top-3 border-l-4 border-t-4",
        "right-3 top-3 border-r-4 border-t-4",
        "bottom-3 left-3 border-b-4 border-l-4",
        "bottom-3 right-3 border-b-4 border-r-4"
      ].map((position) => (
        <motion.div
          key={position}
          className={`absolute h-14 w-14 border-red-300/45 ${position}`}
          animate={{ opacity: [0.22, 0.52 + progress * 0.38, 0.22] }}
          transition={{ duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
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

function SeatPulse({
  playerId,
  index,
  label = "ZIP",
  delay
}: {
  playerId: string;
  index: number;
  label?: string;
  delay?: number;
}) {
  const pulseDelay = delay ?? index * 0.12;
  return (
    <div className="absolute h-0 w-0" style={anchoredCenterStyle(`seat:${playerId}`)}>
      <motion.div
        className="display absolute -left-8 -top-8 grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--gold)]/55 bg-black/55 text-xs font-black text-[var(--gold-strong)] shadow-[0_0_28px_rgba(242,193,78,0.38)]"
        initial={{ scale: 0.35, opacity: 0, rotate: -12 }}
        animate={{ scale: [0.35, 1.12, 0.84], opacity: [0, 1, 0], rotate: [-12, 8, 0] }}
        transition={{ duration: 1.1, delay: pulseDelay, ease: "easeOut" }}
      >
        {label}
      </motion.div>
      <motion.div
        className="absolute -left-12 -top-12 h-24 w-24 rounded-full border border-white/25"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.35], opacity: [0.65, 0] }}
        transition={{ duration: 1.05, delay: pulseDelay, ease: "easeOut" }}
      />
    </div>
  );
}

function FlashbangCardGhost({ playerId, index }: { playerId: string; index: number }) {
  const rect = anchorRect(`seat:${playerId}`);
  if (!rect || typeof window === "undefined") return null;
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2 - window.innerHeight * 0.04;
  const dx = centerX - startX;
  const dy = centerY - startY;
  const orbitX = ((index % 3) - 1) * 72;
  const orbitY = (index % 2 === 0 ? -1 : 1) * (54 + index * 4);

  return (
    <motion.div
      className="absolute z-[3] h-16 w-11 rounded-md border-2 border-cyan-50/65 bg-gradient-to-br from-fuchsia-500/75 via-white/45 to-cyan-400/75 shadow-[0_0_24px_rgba(255,255,255,0.72)]"
      style={{ left: startX - 22, top: startY - 32 }}
      initial={{ opacity: 0, scale: 0.4, rotate: -18 + index * 7 }}
      animate={{
        x: [0, dx, dx + orbitX, dx, 0],
        y: [0, dy, dy + orbitY, dy, 0],
        opacity: [0, 0.82, 0.36, 0.75, 0],
        scale: [0.4, 0.9, 0.62, 0.84, 0.42],
        rotate: [-18 + index * 7, 90 + index * 22, 230 + index * 26, 390 + index * 18, 520 + index * 11]
      }}
      transition={{ duration: 5.25, delay: 0.16 + index * 0.025, times: [0, 0.14, 0.55, 0.84, 1], ease: "easeInOut" }}
      aria-hidden="true"
    />
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

const CHAOS_MEME_ART: Partial<Record<Extract<UiEvent, { type: "chaos" }>["kind"], string>> = {
  throwup: "/memes/gag-cat.png",
  steal: "/memes/muhehehe-cat.png",
  flashbang: "/memes/flashbang-cat.png",
  favor: "/memes/awowo-cat.png",
  peek: "/memes/acumalaka-frog.png",
  timeskip: "/memes/timeskip-cat.png",
  nuke: "/memes/nuke-cat.png"
};

function MemeCutout({
  kind,
  className = "",
  delay = 0,
  rotate = 0
}: {
  kind: Extract<UiEvent, { type: "chaos" }>["kind"];
  className?: string;
  delay?: number;
  rotate?: number;
}) {
  const src = CHAOS_MEME_ART[kind];
  if (!src) return null;
  return (
    <div className="absolute inset-0 z-[2] grid place-items-center pb-[8dvh]" aria-hidden="true">
      <motion.img
        src={src}
        alt=""
        className={`relative max-h-[42vh] w-[clamp(170px,30vw,390px)] object-contain drop-shadow-[0_24px_36px_rgba(0,0,0,0.62)] ${className}`}
        initial={{ scale: 0.18, opacity: 0, rotate: rotate - 16, y: 34 }}
        animate={{ scale: [0.18, 1.18, 0.98], opacity: [0, 1, 0.92], rotate: [rotate - 16, rotate + 7, rotate], y: [34, -10, 0] }}
        transition={{ duration: 1.05, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function anchorBeamStyle(fromKey: string, toKey: string): CSSProperties | undefined {
  const from = anchorRect(fromKey);
  const to = anchorRect(toKey);
  if (!from || !to) return undefined;
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const toX = to.left + to.width / 2;
  const toY = to.top + to.height / 2;
  const dx = toX - fromX;
  const dy = toY - fromY;
  return {
    left: fromX,
    top: fromY,
    width: Math.hypot(dx, dy),
    transformOrigin: "0 50%",
    transform: `translateY(-50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`
  };
}

function StaticChaosCutout({ event }: { event: Extract<UiEvent, { type: "chaos" }> }) {
  const src = CHAOS_MEME_ART[event.kind];
  if (!src) return null;
  return (
    <div className="absolute inset-0 z-[1] grid place-items-center pb-[8dvh]" aria-hidden="true">
      <div className="absolute h-56 w-56 rounded-full border-2 border-white/30 bg-black/35" />
      <img src={src} alt="" className="relative max-h-[34vh] w-[clamp(150px,28vw,300px)] object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.58)]" />
    </div>
  );
}

function ChaosCardVfx({
  event,
  preset,
  reduceMotion
}: {
  event: Extract<UiEvent, { type: "chaos" }>;
  preset: import("@/lib/animationPresets").AnimationPreset;
  reduceMotion: boolean;
}) {
  const snapshot = useRoomStore((state) => state.snapshot);
  if (reduceMotion) {
    const revealedHands = event.kind === "peek" && event.phase === "reveal" && snapshot?.pendingChaos?.kind === "peek"
      ? snapshot.pendingChaos.revealedHands
      : undefined;
    return (
      <>
        <StaticChaosCutout event={event} />
        {event.kind === "flashbang" ? <div className="absolute inset-0 z-[2] bg-white/28" aria-hidden="true" /> : null}
        {event.kind === "nuke" && event.phase === "detonating" ? (
          <div className="absolute h-0 w-0 z-[2]" style={anchoredCenterStyle(event.targetIds?.[0] ? `seat:${event.targetIds[0]}` : "discard")} aria-hidden="true">
            <div
              className="absolute -left-28 -top-28 h-56 w-56 bg-orange-400/85 shadow-[0_0_48px_rgba(255,94,30,0.62)]"
              style={{ clipPath: STARBURST_CLIP }}
            />
          </div>
        ) : null}
        {revealedHands ? <PeekRevealWall snapshot={snapshot} revealedHands={revealedHands} reduceMotion /> : null}
      </>
    );
  }
  if (event.kind === "flashbang") {
    const flashDelay = FLASHBANG_SFX_DELAY_MS / 1000;
    const flashDuration = FLASHBANG_SFX_DURATION_MS / 1000;
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(77,15,91,0.2),rgba(2,4,12,0.94)_72%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0.78, 0] }}
          transition={{ duration: 5.65, times: [0, 0.08, 0.82, 1], ease: "easeInOut" }}
        />
        <MemeCutout kind="flashbang" delay={0.08} />
        {[0, 1, 2].map((index) => (
          <motion.div
            key={`flash-lock-${index}`}
            className="absolute z-[3] rounded-full border-2 border-amber-100/65 shadow-[0_0_28px_rgba(255,235,164,0.7)]"
            initial={{ width: 90, height: 90, opacity: 0, rotate: index * 36, scale: 1.7 }}
            animate={{ width: 210 + index * 72, height: 210 + index * 72, opacity: [0, 0.86, 0], rotate: index * 36 + 120, scale: [1.7, 0.72, 0.54] }}
            transition={{ duration: 0.66, delay: index * 0.045, ease: "easeIn" }}
          />
        ))}
        {event.targetIds?.slice(0, 10).map((playerId, index) => (
          <FlashbangCardGhost key={playerId} playerId={playerId} index={index} />
        ))}
        <motion.div
          className="absolute inset-0 z-[6] bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.96, 0.48, 0.16, 0] }}
          transition={{ delay: flashDelay, duration: flashDuration, times: [0, 0.025, 0.08, 0.38, 0.78, 1], ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 z-[7] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.98),rgba(255,246,198,0.62)_24%,rgba(120,229,255,0.18)_52%,rgba(255,255,255,0)_74%)] mix-blend-screen"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 0.98, 0.5, 0], scale: [0.9, 1.02, 1.14, 1.28] }}
          transition={{ delay: flashDelay, duration: flashDuration, times: [0, 0.05, 0.58, 1], ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 z-[7] opacity-45 mix-blend-screen"
          style={{ background: "linear-gradient(90deg, rgba(255,36,196,0.18), transparent 34%, transparent 66%, rgba(38,231,255,0.2))" }}
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: [-12, 10, -6, 0], opacity: [0, 0.62, 0.2, 0] }}
          transition={{ delay: flashDelay + 0.18, duration: 3.8, ease: "easeOut" }}
        />
        {Array.from({ length: Math.min(4, preset.particleCount) }, (_, index) => (
          <motion.div
            key={index}
            className="absolute z-[8] rounded-full border-4 border-white/65 shadow-[0_0_24px_rgba(255,255,255,0.78)]"
            initial={{ width: 80, height: 80, opacity: 0 }}
            animate={{ width: 360 + index * 110, height: 360 + index * 110, opacity: [0, 0.82, 0] }}
            transition={{ duration: 1.45, delay: flashDelay + index * 0.07, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.kind === "throwup") {
    const empty = (event.amount ?? 0) === 0;
    const tint = event.color ? COLOR_VAR[event.color] : "#5df06f";
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at center, ${tint}55, rgba(19,82,34,0.3) 42%, rgba(3,18,8,0.78) 100%)` }}
          animate={{ opacity: [0, 0.88, 0.5, 0], scale: [1.08, 1, 1.04, 1.12] }}
          transition={{ duration: Math.max(1.9, eventToastDurationMs(event) / 1000), times: [0, 0.18, 0.8, 1], ease: "easeInOut" }}
        />
        <motion.div
          className="absolute h-[min(72vw,620px)] w-[min(72vw,620px)] rounded-full border-[18px] border-lime-200/24"
          initial={{ scale: 0.1, opacity: 0, rotate: -30 }}
          animate={{ scale: [0.1, 0.72, 1.15, 1.55], opacity: [0, 0.75, 0.34, 0], rotate: [-30, 60, 150, 240] }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        />
        <MemeCutout kind="throwup" delay={0.36} className={empty ? "grayscale" : ""} />
        {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className={`absolute ${index % 3 === 0 ? "h-16 w-8 rounded-[60%]" : "h-10 w-10 rounded-full"} bg-lime-300/75 shadow-[0_0_22px_rgba(132,255,99,0.58)]`}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.22 }}
            animate={empty
              ? { x: x * 0.25, y: y * 0.25, rotate, opacity: [0, 0.5, 0], scale: [0.22, 0.55, 0.2] }
              : { x: x * 1.35, y: y * 1.18, rotate: rotate + index * 28, opacity: [0, 1, 0], scale: [0.22, 1.25, 0.45] }}
            transition={{ duration: 1.45, delay: 0.82 + index * 0.045, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.kind === "steal") {
    if (event.phase === "chooseTarget" || event.phase === "chooseCard") return null;
    const targetId = event.targetIds?.[0];
    const executing = event.phase === "sequence";
    const locking = event.phase === "opening" && Boolean(targetId);
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(129,42,180,0.2),rgba(8,2,15,0.92)_68%)]"
          animate={{ opacity: [0, 0.94, 0.7, 0] }}
          transition={{ duration: Math.max(0.85, eventToastDurationMs(event) / 1000), times: [0, 0.12, 0.82, 1] }}
        />
        {targetId ? <SeatPulse playerId={targetId} index={0} label={executing ? "STOLEN" : "LOCK"} /> : null}
        {!locking ? <MemeCutout kind="steal" delay={executing ? 0.1 : 0.5} /> : null}
        {!targetId ? (
          <>
            {[-1, 1].map((side) => (
              <motion.div
                key={side}
                className="absolute h-7 w-24 rounded-[100%] bg-fuchsia-200 shadow-[0_0_36px_rgba(235,126,255,0.95)]"
                style={{ x: side * 62, y: -68, rotate: side * 7 }}
                initial={{ scaleX: 0.05, opacity: 0 }}
                animate={{ scaleX: [0.05, 1.2, 0.9], opacity: [0, 1, 0.72] }}
                transition={{ duration: 0.72, delay: 0.45, ease: "easeOut" }}
              />
            ))}
          </>
        ) : null}
        {locking && targetId ? (
          <div className="absolute h-0 w-0" style={anchoredCenterStyle(`seat:${targetId}`)}>
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="absolute -left-20 -top-20 h-40 w-40 rounded-full border-2 border-fuchsia-200/60"
                initial={{ scale: 2.2, opacity: 0, rotate: index * 30 }}
                animate={{ scale: [2.2, 0.72 + index * 0.08], opacity: [0, 0.9, 0.25], rotate: index * 30 + 120 }}
                transition={{ duration: 0.72, delay: index * 0.06, ease: "easeIn" }}
              />
            ))}
          </div>
        ) : null}
        {executing ? (
          <>
            {[-1, 0, 1].map((line, index) => (
              <motion.div
                key={line}
                className="absolute h-2 w-[min(74vw,720px)] origin-center bg-gradient-to-r from-transparent via-fuchsia-100 to-transparent shadow-[0_0_18px_rgba(255,125,255,0.9)]"
                initial={{ scaleX: 0, opacity: 0, rotate: -24 + line * 10, y: line * 34 }}
                animate={{ scaleX: [0, 1.25, 0.2], opacity: [0, 1, 0] }}
                transition={{ duration: 0.62, delay: 0.12 + index * 0.08, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute h-80 w-80 rounded-full border-[10px] border-fuchsia-200/35"
              initial={{ scale: 0.12, opacity: 0 }}
              animate={{ scale: [0.12, 1.25, 1.8], opacity: [0, 0.85, 0] }}
              transition={{ duration: 1.15, delay: 0.2, ease: "easeOut" }}
            />
          </>
        ) : null}
      </div>
    );
  }

  if (event.kind === "favor") {
    if (event.phase === "chooseTarget" || event.phase === "chooseCard") return null;
    const targetId = event.targetIds?.[0];
    const executing = event.phase === "sequence";
    const openingTarget = event.phase === "opening" && Boolean(targetId);
    const beamStyle = event.actorId && targetId ? anchorBeamStyle(`seat:${event.actorId}`, `seat:${targetId}`) : undefined;
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,116,190,0.34),rgba(255,203,92,0.14)_46%,rgba(31,5,24,0.68)_100%)]"
          animate={{ opacity: [0, 0.88, 0.58, 0] }}
          transition={{ duration: Math.max(1.2, eventToastDurationMs(event) / 1000), times: [0, 0.16, 0.82, 1] }}
        />
        {targetId ? <SeatPulse playerId={targetId} index={0} label={executing ? "GIFT" : "OPEN"} /> : null}
        <MemeCutout kind="favor" delay={executing ? 0.08 : openingTarget ? 0.28 : 0.44} />
        {beamStyle ? (
          <motion.div
            className="absolute h-4 rounded-full bg-gradient-to-r from-amber-200 via-pink-200 to-fuchsia-300 shadow-[0_0_24px_rgba(255,126,202,0.9)]"
            style={beamStyle}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 0.94], opacity: [0, 1, 0.48] }}
            transition={{ duration: 0.72, delay: openingTarget ? 0.18 : 0.28, ease: "easeOut" }}
          />
        ) : null}
        {[0, 1, 2].map((index) => (
          <motion.div
            key={`favor-ring-${index}`}
            className="absolute rounded-full border-[6px] border-pink-100/35"
            initial={{ width: 80, height: 80, opacity: 0, scale: 0.2 }}
            animate={{ width: 260 + index * 100, height: 260 + index * 100, opacity: [0, 0.72, 0], scale: [0.2, 1.18] }}
            transition={{ duration: 1.35, delay: 0.24 + index * 0.14, ease: "easeOut" }}
          />
        ))}
        {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className="absolute grid h-12 w-12 place-items-center rounded-full border border-pink-100/40 bg-pink-500/58 text-white shadow-[0_0_18px_rgba(255,117,193,0.55)]"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.35 }}
            animate={{ x: x * 1.2, y: y * 1.15, rotate, opacity: [0, 1, 0], scale: [0.35, 1.15, 0.55] }}
            transition={{ duration: 1.45, delay: 0.46 + index * 0.05, ease: "easeOut" }}
          >
            <Heart size={22} fill="currentColor" strokeWidth={2.5} />
          </motion.div>
        ))}
      </div>
    );
  }

  if (event.kind === "peek") {
    const revealing = event.phase === "reveal";
    const revealedHands = revealing && snapshot?.pendingChaos?.kind === "peek"
      ? snapshot.pendingChaos.revealedHands
      : undefined;
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(109,255,244,0.22),rgba(4,25,32,0.76)_58%,rgba(0,3,8,0.94))]"
          animate={{ opacity: [0, 0.96, 0.72, 0] }}
          transition={{ duration: Math.max(0.65, eventToastDurationMs(event) / 1000), times: [0, 0.1, 0.9, 1] }}
        />
        <motion.div
          className="absolute grid h-[min(62vw,520px)] w-[min(82vw,720px)] place-items-center rounded-[50%] border-[10px] border-cyan-100/45 bg-black/48 shadow-[0_0_90px_rgba(80,220,255,0.55)]"
          initial={{ scaleX: 0.1, scaleY: 0.02, opacity: 0 }}
          animate={revealing
            ? { scaleX: [0.1, 1.18, 1], scaleY: [0.02, 0.76, 0.62], opacity: [0, 1, 0.78] }
            : { scaleX: [0.08, 0.75], scaleY: [0.02, 0.18], opacity: [0, 0.72] }}
          transition={{ duration: revealing ? 1.05 : 0.58, ease: "easeOut" }}
        >
          <motion.div
            className="h-28 w-28 rounded-full border-[18px] border-cyan-100 bg-black shadow-[0_0_48px_rgba(165,255,255,0.9)]"
            animate={{ scale: [0.55, 1.18, 0.86], x: [-18, 24, 0] }}
            transition={{ duration: 1.35, ease: "easeOut" }}
          />
        </motion.div>
        <MemeCutout kind="peek" delay={revealing ? 0.25 : 0.08} rotate={revealing ? 180 : 0} className={revealing ? "opacity-65" : ""} />
        {revealing && revealedHands ? <PeekRevealWall snapshot={snapshot} revealedHands={revealedHands} /> : null}
        {revealing ? (
          <motion.div
            className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_5px,rgba(142,255,245,0.08)_6px)]"
            animate={{ y: ["-8%", "8%"], opacity: [0.2, 0.55, 0.2] }}
            transition={{ duration: 1.2, repeat: 3, ease: "linear" }}
          />
        ) : null}
      </div>
    );
  }

  if (event.kind === "timeskip") {
    const targets = event.targetIds?.length ? event.targetIds : event.actorId ? [event.actorId] : [];
    const autoplay = event.phase === "autoplay";
    const returning = event.phase === "sequence";
    return (
      <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(33,92,88,0.2),rgba(7,10,23,0.94)_78%)]" />
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          <motion.div
            data-testid="timeskip-overscan"
            className="h-[160vmax] w-[160vmax] shrink-0 bg-[conic-gradient(from_0deg_at_center,rgba(255,217,96,0.2),rgba(35,220,210,0.18),rgba(14,18,35,0.8),rgba(255,217,96,0.2))]"
            animate={{ rotate: autoplay ? [0, 80] : [0, 260], opacity: [0, 0.82, 0.5, 0] }}
            transition={{ duration: Math.max(1.4, eventToastDurationMs(event) / 1000), ease: autoplay ? "linear" : "easeInOut" }}
          />
        </div>
        {autoplay ? targets.map((playerId, index) => (
          <SeatPulse key={playerId} playerId={playerId} index={index} delay={index} label="WARP" />
        )) : null}
        {returning && event.actorId ? (
          <SeatPulse playerId={event.actorId} index={0} delay={0.08} label="RETURN" />
        ) : null}
        {!autoplay && !returning ? <MemeCutout kind="timeskip" delay={0.46} /> : null}
        {!autoplay && !returning ? [0, 1, 2].map((clone) => (
          <motion.img
            key={clone}
            src="/memes/timeskip-cat.png"
            alt=""
            className="absolute w-[clamp(160px,28vw,350px)] object-contain opacity-20"
            initial={{ x: 0, scale: 0.45, opacity: 0, rotate: -25 }}
            animate={{ x: (clone - 1) * 170, scale: [0.45, 1.08, 0.78], opacity: [0, 0.28, 0], rotate: [-25, clone * 30, 100] }}
            transition={{ duration: 1.4, delay: 0.5 + clone * 0.12, ease: "easeOut" }}
          />
        )) : null}
        <motion.div
          className="display absolute grid h-[min(58vw,420px)] w-[min(58vw,420px)] place-items-center rounded-full border-[16px] border-yellow-100/50 bg-black/42 text-7xl font-black text-yellow-100 shadow-[0_0_72px_rgba(255,214,91,0.45)]"
          initial={{ scale: 0.42, opacity: 0, rotate: -90 }}
          animate={returning ? {
            scale: [1.2, 0.18, 1.32],
            opacity: [0.7, 0.95, 0],
            rotate: [720, 0, -90]
          } : {
            scale: autoplay ? [0.86, 1.02, 0.9] : [0.42, 1.12, 0.94],
            opacity: autoplay ? [0.38, 0.72, 0.38] : [0, 1, 0.76],
            rotate: autoplay ? [0, 720] : [-90, 540]
          }}
          transition={{ duration: returning ? 0.95 : autoplay ? Math.max(1, eventToastDurationMs(event) / 1000) : 2.1, ease: autoplay ? "linear" : "easeInOut" }}
        >
          <span className="relative grid h-28 w-28 place-items-center rounded-full border-4 border-cyan-100/45 bg-black/65 text-5xl shadow-[0_0_38px_rgba(87,242,229,0.4)]">
            {returning ? "BACK" : autoplay ? "FAST" : "12"}
          </span>
        </motion.div>
        {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className="absolute h-16 w-2 rounded-full bg-gradient-to-b from-yellow-100 to-cyan-300 shadow-[0_0_16px_rgba(130,255,242,0.55)]"
            initial={{ x: 0, y: 0, rotate, opacity: 0, scaleY: 0.2 }}
            animate={{ x: x * 1.65, y: y * 1.35, rotate: rotate + 180, opacity: [0, 0.9, 0], scaleY: [0.2, 1.5, 0.5] }}
            transition={{ duration: returning ? 0.8 : 1.4, delay: returning ? index * 0.03 : autoplay ? 0.15 + index * 0.08 : 0.7 + index * 0.06, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  if (event.kind === "nuke") {
    const detonating = event.phase === "detonating";
    const targetId = event.targetIds?.[0];
    if (!detonating) {
      return (
        <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true">
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,132,41,0.28),rgba(62,5,2,0.72)_58%,rgba(8,1,1,0.96))]"
            animate={{ opacity: [0, 0.94, 0.76, 0] }}
            transition={{ duration: 3.2, times: [0, 0.12, 0.84, 1], ease: "easeInOut" }}
          />
          <MemeCutout kind="nuke" delay={0.12} />
          {[0, 1, 2].map((index) => (
            <motion.div
              key={`nuke-reactor-${index}`}
              className="absolute rounded-full border-[8px] border-orange-100/35 shadow-[0_0_52px_rgba(255,94,30,0.48)]"
              initial={{ width: 120, height: 120, opacity: 0, rotate: -40 + index * 24 }}
              animate={{ width: 300 + index * 120, height: 300 + index * 120, opacity: [0, 0.82, 0.18], rotate: 220 + index * 80 }}
              transition={{ duration: 2.7, delay: 0.1 + index * 0.12, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="absolute inset-x-0 top-0 h-[18dvh] bg-[repeating-linear-gradient(135deg,rgba(255,188,45,0.62)_0,rgba(255,188,45,0.62)_22px,rgba(40,4,2,0.82)_22px,rgba(40,4,2,0.82)_44px)] shadow-[0_16px_42px_rgba(0,0,0,0.58)]"
            initial={{ y: "-105%" }}
            animate={{ y: ["-105%", "-38%", "-52%"] }}
            transition={{ duration: 1.15, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-[18dvh] bg-[repeating-linear-gradient(135deg,rgba(255,188,45,0.62)_0,rgba(255,188,45,0.62)_22px,rgba(40,4,2,0.82)_22px,rgba(40,4,2,0.82)_44px)] shadow-[0_-16px_42px_rgba(0,0,0,0.58)]"
            initial={{ y: "105%" }}
            animate={{ y: ["105%", "38%", "52%"] }}
            transition={{ duration: 1.15, ease: "easeOut" }}
          />
          {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
            <motion.div
              key={index}
              className="absolute h-12 w-3 rounded-full bg-gradient-to-b from-yellow-100 via-orange-400 to-red-700 shadow-[0_0_20px_rgba(255,119,38,0.72)]"
              initial={{ x: 0, y: 0, rotate, opacity: 0, scaleY: 0.2 }}
              animate={{ x: x * 1.45, y: y * 1.25, rotate: rotate + 180, opacity: [0, 1, 0], scaleY: [0.2, 1.5, 0.4] }}
              transition={{ duration: 1.55, delay: 0.72 + index * 0.045, ease: "easeOut" }}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true">
        <motion.div
          className="absolute inset-0 z-[6] bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.96, 0.18, 0] }}
          transition={{ duration: 0.48, times: [0, 0.12, 0.42, 1], ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,224,113,0.42),rgba(239,55,19,0.42)_38%,rgba(31,2,1,0.92)_78%)]"
          animate={{ opacity: [0, 1, 0.72, 0] }}
          transition={{ duration: 2.8, times: [0, 0.08, 0.8, 1], ease: "easeOut" }}
        />
        {targetId ? <SeatPulse playerId={targetId} index={0} label="HIT" delay={0.08} /> : null}
        <div className="absolute h-0 w-0" style={anchoredCenterStyle(targetId ? `seat:${targetId}` : "discard")}>
          {[
            ["#fff8c9", 190, 0],
            ["#ffcc45", 260, 16],
            ["#f34b1e", 340, -12]
          ].map(([fill, size, rotate], index) => (
            <motion.div
              key={String(fill)}
              className="absolute"
              style={{
                left: `-${Number(size) / 2}px`,
                top: `-${Number(size) / 2}px`,
                width: Number(size),
                height: Number(size),
                background: String(fill),
                clipPath: STARBURST_CLIP,
                filter: "drop-shadow(0 0 28px rgba(255,92,27,0.72))"
              }}
              initial={{ scale: 0.04, opacity: 0, rotate: Number(rotate) }}
              animate={{ scale: [0.04, 1.18, 0.82], opacity: [0, 1, 0], rotate: Number(rotate) + (index % 2 === 0 ? 95 : -88) }}
              transition={{ duration: 1.18, delay: 0.08 + index * 0.055, ease: "easeOut" }}
            />
          ))}
          {[0, 1].map((index) => (
            <motion.div
              key={`nuke-shock-${index}`}
              className="absolute -left-24 -top-24 h-48 w-48 rounded-full border-[8px] border-orange-100/60"
              initial={{ scale: 0.12, opacity: 0 }}
              animate={{ scale: [0.12, 2.1 + index * 0.75], opacity: [0, 0.86, 0] }}
              transition={{ duration: 1.25, delay: 0.16 + index * 0.1, ease: "easeOut" }}
            />
          ))}
          {[-70, -30, 10, 50, 86].map((x, index) => (
            <motion.div
              key={x}
              className="absolute h-24 w-24 rounded-full bg-gradient-to-b from-orange-100 via-orange-500 to-stone-900/85 shadow-[0_0_28px_rgba(255,113,35,0.62)]"
              style={{ left: x - 48, top: -20 }}
              initial={{ scale: 0.18, opacity: 0 }}
              animate={{ y: [0, -90 - index * 16, -132], x: [0, (index - 2) * 16], scale: [0.18, 1.08, 0.72], opacity: [0, 0.94, 0] }}
              transition={{ duration: 1.75, delay: 0.34 + index * 0.065, ease: "easeOut" }}
            />
          ))}
        </div>
        <motion.div
          className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_6px,rgba(255,81,36,0.08)_7px)]"
          animate={{ y: ["-2%", "2%"], opacity: [0, 0.58, 0] }}
          transition={{ duration: 2.8, ease: "linear" }}
        />
        {CHAOS_SPARKS.slice(0, preset.particleCount).map(([x, y, rotate], index) => (
          <motion.div
            key={index}
            className="absolute h-14 w-9 rounded-md border border-orange-50/55 bg-gradient-to-br from-yellow-200 via-red-500 to-black shadow-[0_0_18px_rgba(255,100,32,0.65)]"
            initial={{ x: 0, y: 0, rotate, opacity: 0, scale: 0.2 }}
            animate={{ x: x * 1.7, y: y * 1.45, rotate: rotate + index * 92, opacity: [0, 1, 0], scale: [0.2, 1.05, 0.45] }}
            transition={{ duration: 1.8, delay: 0.28 + index * 0.045, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }

  return null;
}

export function PeekRevealWall({
  snapshot,
  revealedHands,
  reduceMotion = false
}: {
  snapshot: GameSnapshot | null;
  revealedHands: Record<string, ChaosSelectableCard[]>;
  reduceMotion?: boolean;
}) {
  if (!snapshot) return null;
  const players = snapshot.players.filter((player) => revealedHands[player.id]);
  return (
    <motion.div
      className="absolute inset-x-2 bottom-3 top-20 z-[4] grid grid-cols-2 content-center gap-1.5 overflow-hidden sm:grid-cols-3 lg:grid-cols-4"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 0.96] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 4.65, times: [0, 0.12, 0.86, 1], ease: "easeInOut" }}
      role="region"
      aria-label="Peek reveal"
    >
      {players.map((player, playerIndex) => (
        <motion.section
          key={player.id}
          className="min-w-0 overflow-hidden rounded-lg border border-cyan-100/28 bg-black/72 px-2 py-1.5 shadow-[0_0_26px_rgba(91,235,238,0.2)] backdrop-blur-sm"
          initial={reduceMotion ? false : { opacity: 0, y: 20, rotateX: -16 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.36 + playerIndex * 0.08, ease: "easeOut" }}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black uppercase text-cyan-50">
            <span className="truncate">{player.nickname}</span>
            <span className="text-cyan-200/70">{revealedHands[player.id]?.length ?? 0}</span>
          </div>
          <motion.div
            className="flex min-h-16 items-center gap-1"
            animate={!reduceMotion && (revealedHands[player.id]?.length ?? 0) > 4 ? { x: ["0%", "-58%", "0%"] } : { x: "0%" }}
            transition={{ duration: 3.7, delay: 0.55 + playerIndex * 0.04, ease: "easeInOut" }}
          >
            {(revealedHands[player.id] ?? []).map((card, cardIndex) => (
              <motion.div
                key={card.id}
                className="shrink-0"
                initial={reduceMotion ? false : { opacity: 0, rotateY: 90, y: 12 }}
                animate={{ opacity: 1, rotateY: 0, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.44 + playerIndex * 0.07 + Math.min(12, cardIndex) * 0.025 }}
              >
                <CardView card={card} micro />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      ))}
    </motion.div>
  );
}

function eventWash(event: UiEvent): string {
  switch (event.type) {
    case "chaosBust":
      return event.self
        ? "radial-gradient(circle at center, rgba(255, 214, 88, 0.28), transparent 34%), radial-gradient(circle at center, rgba(255, 64, 44, 0.42), transparent 54%), rgba(35, 4, 2, 0.44)"
        : "radial-gradient(circle at center, rgba(255, 214, 88, 0.22), transparent 38%), rgba(35, 4, 2, 0.28)";
    case "chaos":
      if (event.kind === "nuke") return event.phase === "detonating"
        ? "radial-gradient(circle at center, rgba(255, 218, 92, 0.42), rgba(255, 57, 27, 0.26) 36%, transparent 60%), rgba(20, 4, 2, 0.72)"
        : "radial-gradient(circle at center, rgba(255, 112, 35, 0.32), transparent 44%), rgba(20, 4, 2, 0.62)";
      if (event.kind === "flashbang") return "radial-gradient(circle at center, rgba(255, 237, 171, 0.18), transparent 36%), rgba(3, 4, 12, 0.74)";
      if (event.kind === "throwup") return `radial-gradient(circle at center, ${event.color ? COLOR_WASH[event.color] : "rgba(82, 238, 108, 0.4)"}, transparent 42%), rgba(2, 26, 9, 0.5)`;
      if (event.kind === "steal") return "radial-gradient(circle at center, rgba(188, 73, 255, 0.34), transparent 40%), rgba(8, 1, 15, 0.68)";
      if (event.kind === "favor") return "radial-gradient(circle at center, rgba(255, 120, 194, 0.38), transparent 38%), radial-gradient(circle at 70% 30%, rgba(255, 210, 91, 0.25), transparent 34%)";
      if (event.kind === "peek") return "radial-gradient(ellipse at center, rgba(87, 242, 229, 0.3), transparent 44%), rgba(0, 12, 20, 0.62)";
      if (event.kind === "timeskip") return "conic-gradient(from 0deg at center, rgba(255, 218, 94, 0.25), rgba(70, 229, 220, 0.2), rgba(19, 20, 45, 0.5), rgba(255, 218, 94, 0.25))";
      return "radial-gradient(circle at center, rgba(255, 255, 255, 0.26), transparent 34%), radial-gradient(circle at 30% 30%, rgba(255, 0, 180, 0.24), transparent 34%), radial-gradient(circle at 70% 60%, rgba(0, 190, 255, 0.22), transparent 38%)";
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
  event: NoticeUiEvent,
  t: ReturnType<typeof useTranslations>
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
