"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRoomStore } from "@/lib/store";
import type { UiEvent } from "@/lib/events";

const COLOR_VAR: Record<string, string> = {
  red: "var(--red)",
  yellow: "var(--yellow)",
  green: "var(--green)",
  blue: "var(--blue)"
};

const COLOR_WASH: Record<string, string> = {
  red: "rgba(224, 73, 60, 0.4)",
  yellow: "rgba(238, 188, 58, 0.42)",
  green: "rgba(47, 155, 103, 0.4)",
  blue: "rgba(61, 126, 219, 0.42)"
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

export function GameEventOverlay() {
  const events = useRoomStore((state) => state.events);
  const dismissEvent = useRoomStore((state) => state.dismissEvent);
  const toasts = events.filter((event) => event.type !== "yourTurn" && event.type !== "matchChain");

  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center overflow-hidden">
      <AnimatePresence>
        {toasts.map((event) => (
          <EventToast key={event.id} event={event} onDone={() => dismissEvent(event.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function eventToastDurationMs(event: UiEvent): number {
  if (event.type === "penalty" || event.type === "stack") {
    return 2000;
  }

  if (event.type === "skip" || event.type === "reverse" || event.type === "colorChange") {
    return 1700;
  }

  if (event.type === "catchWindow" || event.type === "calledOne") {
    return 1800;
  }

  return 1600;
}

function EventToast({ event, onDone }: { event: UiEvent; onDone: () => void }) {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), eventToastDurationMs(event));
    return () => window.clearTimeout(id);
  }, [event]);

  const { label, sublabel, background, color } = toastContent(event, t);
  const wash = eventWash(event);

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center px-3 sm:px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.18 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: wash }}
        initial={{ opacity: 0 }}
        animate={{ opacity: reduceMotion ? 0.45 : [0, 0.74, 0.48] }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : eventToastDurationMs(event) / 1000, ease: "easeOut" }}
      />

      <EventVfx event={event} reduceMotion={Boolean(reduceMotion)} />

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { scale: 0.45, opacity: 0, y: 28 }}
        animate={reduceMotion ? { opacity: 1 } : { scale: [0.72, 1.12, 1], opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { scale: 0.84, opacity: 0, y: -22 }}
        transition={{ type: reduceMotion ? "tween" : "spring", stiffness: 420, damping: 22 }}
        className={`relative z-10 grid justify-items-center gap-2 ${event.type === "penalty" && event.self ? "shake" : ""}`}
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

function EventVfx({ event, reduceMotion }: { event: UiEvent; reduceMotion: boolean }) {
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
        {BURST_POINTS.map(([x, y, rotate], index) => (
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
        {Array.from({ length: 8 }, (_, index) => (
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
        {(["red", "yellow", "green", "blue"] as const).map((color, index) => (
          <motion.div
            key={color}
            className="absolute h-24 w-24 rounded-full"
            style={{ background: COLOR_VAR[color] }}
            initial={{ scale: 0.25, opacity: 0, x: 0, y: 0 }}
            animate={{
              scale: [0.25, 1.2, 0.7],
              opacity: [0, color === event.color ? 0.86 : 0.4, 0],
              x: Math.cos((index / 4) * Math.PI * 2) * 150,
              y: Math.sin((index / 4) * Math.PI * 2) * 96
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
        {[0, 1, 2].map((index) => (
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

  return null;
}

function eventWash(event: UiEvent): string {
  switch (event.type) {
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
    case "calledOne":
      return "radial-gradient(circle at center, rgba(255, 217, 96, 0.32), transparent 42%)";
    case "catchWindow":
      return "radial-gradient(circle at center, rgba(255, 72, 84, 0.36), transparent 44%)";
    default:
      return "transparent";
  }
}

function toastContent(
  event: UiEvent,
  t: ReturnType<typeof useTranslations>
): { label: string; sublabel?: string; background: string; color?: string } {
  switch (event.type) {
    case "penalty":
      return {
        label: `+${event.count}!`,
        sublabel: event.self
          ? t("events.youDrew", { count: event.count })
          : t("events.playerDrew", { name: event.nickname, count: event.count }),
        background: "linear-gradient(180deg, #ff7b68, var(--red) 58%, #8d2019)"
      };
    case "skip":
      return { label: t("events.skip"), background: "linear-gradient(180deg, #77808b, #242c35 62%, #10161d)" };
    case "reverse":
      return { label: t("events.reverse"), background: "linear-gradient(180deg, #72b1ff, var(--blue) 62%, #17427e)" };
    case "colorChange":
      return {
        label: t("events.colorChange", { color: t(`colors.${event.color}`) }),
        background: COLOR_VAR[event.color] ?? "var(--gold)",
        color: event.color === "yellow" ? "#221706" : "white"
      };
    case "stack":
      return {
        label: `+${event.totalDraw}`,
        sublabel: t("events.stackPenalty"),
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
    default:
      return { label: "", background: "transparent" };
  }
}
