"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { FlipSide, GameSnapshot } from "@congcard/shared";
import { playSound } from "@/lib/sound";
import { useRoomStore } from "@/lib/store";

export function FlipTransitionLayer({ snapshot }: { snapshot: GameSnapshot }) {
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const handled = useRef(new Set<number>());
  const reduceMotion = useReducedMotion();
  const [visualSide, setVisualSide] = useState<FlipSide>(snapshot.flipSide ?? "light");
  const pending = snapshot.pendingFlip;

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
    if (!pending || handled.current.has(pending.id)) return;
    handled.current.add(pending.id);
    const timers: number[] = [];
    let side = pending.fromSide;
    const serverNow = Date.now() + clockOffset;

    pending.transitionTimes.forEach((transitionAt, index) => {
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
        }
        playSound("flipImpact", level);
        playSound(side === "dark" ? "flipDark" : "flipLight", level);
        timers.push(window.setTimeout(() => document.body.classList.remove("flip-card-animating"), 600));
      }, impactDelay));
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [clockOffset, pending, reduceMotion]);

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
