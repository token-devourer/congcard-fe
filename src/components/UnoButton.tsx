"use client";

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

export function UnoButton({ canCallOne, callWindow, onCallOne, catchTarget, onCatch }: UnoButtonProps) {
  const t = useTranslations();
  const now = useNow(100);
  const callPending = Boolean(callWindow?.callPending);
  const callVisibleUntil = Math.max(callWindow?.deadline ?? 0, callWindow?.callResolvesAt ?? 0);
  const catchVisibleUntil = Math.max(catchTarget?.deadline ?? 0, catchTarget?.callResolvesAt ?? 0);
  const callReady = canCallOne && Boolean(callWindow) && !callPending && now >= (callWindow?.opensAt ?? 0) && now <= (callWindow?.deadline ?? 0);
  const catchReady = Boolean(catchTarget) && now >= (catchTarget?.opensAt ?? 0) && now <= catchVisibleUntil;
  const callVisible = canCallOne && Boolean(callWindow) && now <= callVisibleUntil;
  const catchVisible = Boolean(catchTarget) && now <= catchVisibleUntil;

  return (
    // Docked at the middle-right edge of the viewport, stacked vertically,
    // so the call-to-action never covers seats, the pile, or the hand.
    <div className="pointer-events-none fixed right-2 top-1/2 z-[60] flex -translate-y-1/2 flex-col items-end gap-3 md:right-4">
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
          >
            <span aria-hidden="true">!</span>
            {catchReady ? t("board.catch", { name: catchTarget.nickname }) : t("board.readyIn", { seconds: readySeconds(catchTarget.opensAt, now) })}
            <ActionCountdown opensAt={catchTarget.opensAt} deadline={catchTarget.callPending ? catchTarget.callResolvesAt ?? catchTarget.deadline : catchTarget.deadline} />
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
          >
            <span>{callPending ? t("board.calling") : callReady ? t("board.one") : t("board.readyIn", { seconds: readySeconds(callWindow.opensAt, now) })}</span>
            <ActionCountdown opensAt={callPending ? now : callWindow.opensAt} deadline={callPending ? callWindow.callResolvesAt ?? callWindow.deadline : callWindow.deadline} />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function readySeconds(opensAt: number, now: number): string {
  return Math.max(0, (opensAt - now) / 1000).toFixed(1);
}

function ActionCountdown({ opensAt, deadline }: { opensAt: number; deadline: number }) {
  const now = useNow(100);
  const active = now >= opensAt;
  const seconds = Math.max(0, ((active ? deadline : opensAt) - now) / 1000);
  const urgent = active && seconds <= 1.2;

  return (
    <span className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-sm tabular-nums ${urgent ? "bg-[var(--red)] text-white" : "bg-black/40"}`}>
      {active ? seconds.toFixed(0) : seconds.toFixed(1)}
    </span>
  );
}
