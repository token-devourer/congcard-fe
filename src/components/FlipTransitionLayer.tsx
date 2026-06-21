"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { FlipSide, GameSnapshot } from "@congcard/shared";
import { scheduleFlipMusicTransition } from "@/lib/music";
import { playSound } from "@/lib/sound";
import { useRoomStore } from "@/lib/store";

export function FlipTransitionLayer({ snapshot }: { snapshot: GameSnapshot }) {
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const handled = useRef(new Set<number>());
  const pendingRef = useRef(snapshot.pendingFlip);
  const clockOffsetRef = useRef(clockOffset);
  const cardFlipTimer = useRef<number | undefined>(undefined);
  const reduceMotion = useReducedMotion();
  const [visualSide, setVisualSide] = useState<FlipSide>(snapshot.flipSide ?? "light");
  const pending = snapshot.pendingFlip;
  pendingRef.current = pending;
  clockOffsetRef.current = clockOffset;

  useEffect(() => {
    if (snapshot.settings.modeId !== "flip") {
      document.body.classList.remove("flip-light", "flip-dark", "flip-card-animating");
      return;
    }
    if (!pending) setVisualSide(snapshot.flipSide ?? "light");
  }, [pending, snapshot.flipSide, snapshot.settings.modeId]);

  useEffect(() => {
    if (snapshot.settings.modeId !== "flip") return;
    document.body.classList.toggle("flip-dark", visualSide === "dark");
    document.body.classList.toggle("flip-light", visualSide === "light");
  }, [snapshot.settings.modeId, visualSide]);

  useEffect(() => {
    const event = pendingRef.current;
    if (!event || handled.current.has(event.id)) return;
    handled.current.add(event.id);
    const timers: number[] = [];
    let side = event.fromSide;
    const serverNow = Date.now() + clockOffsetRef.current;
    const firstTransitionAt = event.transitionTimes[0]!;
    const finalTransitionAt = event.transitionTimes.at(-1)!;

    scheduleFlipMusicTransition(
      event.toSide === "dark" ? "flipDark" : "play",
      Math.max(0, firstTransitionAt - 260 - serverNow),
      Math.max(0, firstTransitionAt - serverNow),
      Math.max(0, finalTransitionAt - serverNow)
    );

    event.transitionTimes.forEach((transitionAt, index) => {
      const level = Math.min(8, index + 1);
      const sweepDelay = Math.max(0, transitionAt - 260 - serverNow);
      const impactDelay = Math.max(0, transitionAt - serverNow);
      timers.push(window.setTimeout(() => playSound("flipSweep", level), sweepDelay));
      timers.push(window.setTimeout(() => {
        side = side === "light" ? "dark" : "light";
        setVisualSide(side);
        if (!reduceMotion) {
          document.body.classList.remove("flip-card-animating");
          void document.body.offsetWidth;
          document.body.classList.add("flip-card-animating");
          if (cardFlipTimer.current) window.clearTimeout(cardFlipTimer.current);
          cardFlipTimer.current = window.setTimeout(() => {
            document.body.classList.remove("flip-card-animating");
            cardFlipTimer.current = undefined;
          }, 600);
        }
        playSound("flipImpact", level);
        playSound(side === "dark" ? "flipDark" : "flipLight", level);
      }, impactDelay));
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (cardFlipTimer.current) window.clearTimeout(cardFlipTimer.current);
      cardFlipTimer.current = undefined;
      document.body.classList.remove("flip-card-animating");
    };
  }, [pending?.id, reduceMotion]);

  useEffect(() => () => {
    document.body.classList.remove("flip-light", "flip-dark", "flip-card-animating");
  }, []);

  if (!pending) return null;
  return (
    <motion.div className="flip-transition-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="flip-transition-ring"
        animate={reduceMotion ? { opacity: [0, 1, 1] } : { rotateY: [0, 180, 360], scale: [0.82, 1.08, 1] }}
        transition={{ duration: Math.max(0.9, (pending.resolvesAt - pending.transitionTimes[0]!) / 1000), ease: "easeInOut" }}
      >
        {visualSide === "dark" ? "DARK" : "LIGHT"}
      </motion.div>
    </motion.div>
  );
}
