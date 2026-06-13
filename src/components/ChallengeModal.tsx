"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GameSnapshot } from "@congcard/shared";
import { useNow } from "@/lib/useNow";
import { CardView } from "./CardView";

const COLOR_VAR: Record<string, string> = {
  red: "var(--red)",
  yellow: "var(--yellow)",
  green: "var(--green)",
  blue: "var(--blue)"
};

interface ChallengeModalProps {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
}

export function ChallengeModal({ snapshot, send }: ChallengeModalProps) {
  const t = useTranslations();
  const pending = snapshot.pendingChallenge;
  const forMe = Boolean(pending && pending.challengerId === snapshot.self?.id);
  const offender = pending ? snapshot.players.find((player) => player.id === pending.offenderId) : undefined;
  const actionLocked = Boolean(snapshot.oneWindow?.callPending);

  return (
    <AnimatePresence>
      {pending && forMe ? (
        <motion.div
          key="challenge"
          // No blocking backdrop: clicks pass through to the board so the
          // player can still hit ONE/CATCH while the challenge is pending.
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="panel pointer-events-auto grid w-full max-w-sm gap-3 p-4 shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center gap-4">
              <motion.div animate={{ rotate: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                <CardView small card={{ id: "challenge-wild4", color: null, value: "wild4", deckIndex: 0 }} />
              </motion.div>
              <div>
                <h2 className="display text-2xl font-black">{t("challenge.title")}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {t("challenge.declared", {
                    name: offender?.nickname ?? "?",
                    color: t(`colors.${pending.declaredColor}`)
                  })}
                </p>
                <span
                  className="mt-2 inline-block h-5 w-12 rounded-full border border-white/30"
                  style={{ background: COLOR_VAR[pending.declaredColor] }}
                  aria-label={t(`colors.${pending.declaredColor}`)}
                />
              </div>
            </div>

            <ul className="grid gap-1.5 rounded-lg bg-black/25 p-3 text-sm">
              <li>✋ {t("challenge.explainAccept")}</li>
              <li>⚔️ {t("challenge.explainWin", { name: offender?.nickname ?? "?" })}</li>
              <li>💥 {t("challenge.explainLose")}</li>
            </ul>

            <DeadlineBar deadline={snapshot.turnDeadline} totalSec={snapshot.settings.turnTimeoutSec} />

            <div className="grid grid-cols-2 gap-3">
              <button className="button secondary !min-h-12" disabled={actionLocked} onClick={() => send("game.challenge", { accept: false })}>
                {t("challenge.accept")}
              </button>
              <button className="button danger !min-h-12" disabled={actionLocked} onClick={() => send("game.challenge", { accept: true })}>
                {t("challenge.challenge")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DeadlineBar({ deadline, totalSec }: { deadline?: number; totalSec: number }) {
  const now = useNow(150);

  if (!deadline) {
    return null;
  }

  const fraction = Math.max(0, Math.min(1, (deadline - now) / (totalSec * 1000)));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/40">
      <div
        className="h-full rounded-full"
        style={{
          width: `${fraction * 100}%`,
          background: fraction < 0.25 ? "var(--red)" : "var(--gold)",
          transition: "width 150ms linear, background 300ms ease"
        }}
      />
    </div>
  );
}
