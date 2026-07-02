"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useNow } from "@/lib/useNow";

interface CatchTarget {
  id: string;
  nickname: string;
  opensAt: number;
  deadline: number;
  callPending?: boolean;
  callResolvesAt?: number;
}

interface CallWindow {
  opensAt: number;
  deadline: number;
  callPending?: boolean;
  callResolvesAt?: number;
}

interface UnoButtonProps {
  canCallOne: boolean;
  callWindow?: CallWindow;
  onCallOne: () => void;
  catchTarget?: CatchTarget;
  onCatch: (targetId: string) => void;
}

// Six edge slots the call-to-action can pop into: right/left × top/middle/bottom.
// A fresh slot is rolled every time a new One/Catch window opens, so players have
// to spot the button instead of parking their cursor on a fixed spot. That hunt
// replaces the old "ready in" buffer and visible countdown as the difficulty.
const POSITIONS = [
  "top-24 right-2 items-end md:right-4",
  "top-1/2 right-2 -translate-y-1/2 items-end md:right-4",
  "bottom-28 right-2 items-end md:right-4",
  "top-24 left-2 items-start md:left-4",
  "top-1/2 left-2 -translate-y-1/2 items-start md:left-4",
  "bottom-28 left-2 items-start md:left-4"
];

function randomPosition(): string {
  return POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
}

export function UnoButton({ canCallOne, callWindow, onCallOne, catchTarget, onCatch }: UnoButtonProps) {
  const t = useTranslations();
  // Only tick while a One/Catch window is actually live.
  const now = useNow(100, Boolean(callWindow) || Boolean(catchTarget));
  const callPending = Boolean(callWindow?.callPending);
  const callVisibleUntil = Math.max(callWindow?.deadline ?? 0, callWindow?.callResolvesAt ?? 0);
  const catchVisibleUntil = Math.max(catchTarget?.deadline ?? 0, catchTarget?.callResolvesAt ?? 0);
  const callReady = canCallOne && Boolean(callWindow) && !callPending && now >= (callWindow?.opensAt ?? 0) && now <= (callWindow?.deadline ?? 0);
  const catchReady = Boolean(catchTarget) && now >= (catchTarget?.opensAt ?? 0) && now <= catchVisibleUntil;
  const callVisible = canCallOne && Boolean(callWindow) && now <= callVisibleUntil;
  const catchVisible = Boolean(catchTarget) && now <= catchVisibleUntil;

  // Only one of call/catch is ever live for a given client (the One window
  // belongs to exactly one player), so a single shared slot is enough. Key the
  // roll on the window's opensAt so it stays put while visible and re-rolls only
  // when a brand-new window opens.
  const activeKey =
    catchTarget && catchVisible
      ? `catch:${catchTarget.id}:${catchTarget.opensAt}`
      : callVisible && callWindow
        ? `call:${callWindow.opensAt}`
        : null;

  const [position, setPosition] = useState(POSITIONS[1]);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (activeKey && activeKey !== seenKey) {
    // Adjust derived state during render (supported React pattern): the button
    // mounts directly at its slot with no first-frame jump. We never touch the
    // slot when activeKey is null, so the exit animation plays from the same
    // spot the button lived at.
    setSeenKey(activeKey);
    setPosition(randomPosition());
  }

  return (
    <div className={`pointer-events-none fixed z-[60] flex flex-col gap-3 ${position}`}>
      <AnimatePresence>
        {catchTarget && catchVisible ? (
          <motion.button
            key={`catch-${catchTarget.id}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.12, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
            className={`display pointer-events-auto flex items-center gap-2 rounded-full border-2 px-5 py-3 text-lg font-black text-white ${
              catchReady ? "pulse-red urgent-action border-white/45" : "border-white/20 bg-black/80"
            }`}
            style={catchReady ? { background: "linear-gradient(180deg, #f06354, var(--red))", boxShadow: "var(--shadow-pop)" } : undefined}
            disabled={!catchReady}
            onClick={() => onCatch(catchTarget.id)}
            aria-keyshortcuts="C"
          >
            <span aria-hidden="true">!</span>
            {t("board.catch", { name: catchTarget.nickname })}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {callVisible && callWindow ? (
          <motion.button
            key="one"
            initial={{ scale: 0, opacity: 0, rotate: -20 }}
            animate={{ scale: [1, 1.1, 1], opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
            className={`display pointer-events-auto grid min-h-24 min-w-24 place-items-center rounded-full border-4 px-3 text-center text-xl font-black text-[#221a07] ${
              callReady ? "pulse-gold urgent-action border-white/50" : "border-white/20"
            }`}
            style={{
              background: "linear-gradient(180deg, var(--gold-strong), var(--gold) 60%, #d99e2b)",
              boxShadow: "0 0 44px rgba(242, 193, 78, 0.6), var(--shadow-pop)"
            }}
            disabled={!callReady}
            onClick={onCallOne}
            aria-keyshortcuts="O"
          >
            <span>{callPending ? t("board.calling") : t("board.one")}</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
