"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GameSnapshot } from "@congcard/shared";
import { useNow } from "@/lib/useNow";

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

interface ChallengeModalProps {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
  actionLocked?: boolean;
  canBatchStack?: boolean;
  onBatchStack?: () => void;
}

export function ChallengeModal({
  snapshot,
  send,
  actionLocked: eventLocked = false,
  canBatchStack = false,
  onBatchStack
}: ChallengeModalProps) {
  const t = useTranslations();
  const pending = snapshot.pendingChallenge;
  const forMe = Boolean(pending && pending.challengerId === snapshot.self?.id);
  const offender = pending ? snapshot.players.find((player) => player.id === pending.offenderId) : undefined;
  const actionLocked = Boolean(snapshot.oneWindow) || eventLocked;
  const stackTotal = snapshot.pendingStack?.challengeable
    ? snapshot.pendingStack.totalDraw
    : snapshot.pendingChallenge?.drawCount ?? 4;
  const title = pending?.kind === "wild3" ? t("challenge.title3") : t("challenge.title");
  const canStackWild = Boolean(
    pending &&
      snapshot.pendingStack?.challengeable &&
      snapshot.pendingStack.targetPlayerId === snapshot.self?.id &&
      snapshot.self?.hand.some((card) => card.value === snapshot.pendingStack?.kind)
  );

  return (
    <AnimatePresence>
      {pending && forMe ? (
        <motion.section
          key="challenge"
          className="challenge-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          role="region"
          aria-label={title}
          aria-live="polite"
        >
          <div className="challenge-copy">
            <div className="challenge-mark" aria-hidden="true">+{pending.kind === "wild3" ? 3 : 4}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="display text-lg font-black">{title}</h2>
                <span
                  className="inline-block h-4 w-10 rounded-full border border-white/30"
                  style={{ background: COLOR_VAR[pending.declaredColor] }}
                  aria-label={t(`colors.${pending.declaredColor}`)}
                />
              </div>
              <p className="text-xs text-[var(--muted)]">
                {t("challenge.declared", {
                  name: offender?.nickname ?? "?",
                  color: t(`colors.${pending.declaredColor}`)
                })}
              </p>
              <p className="mt-1 text-sm font-bold">{t("challenge.prompt", { name: offender?.nickname ?? "?" })}</p>
            </div>
          </div>

          <div className="challenge-outcome">
            {t("challenge.outcome", { name: offender?.nickname ?? "?", count: stackTotal, loseCount: stackTotal + 2 })}
            {canStackWild ? <span>{t(pending.kind === "wild3" ? "challenge.stackHint3" : "challenge.stackHint")}</span> : null}
          </div>

          <DeadlineBar deadline={snapshot.turnDeadline} totalSec={snapshot.settings.turnTimeoutSec} />

          <div className={`challenge-actions ${canBatchStack ? "has-batch" : ""}`}>
            <button className="button secondary !min-h-10 !px-3 text-sm" disabled={actionLocked} onClick={() => send("game.challenge", { accept: false })}>
              {t("challenge.accept", { count: stackTotal })}
            </button>
            <button className="button danger !min-h-10 !px-3 text-sm" disabled={actionLocked} onClick={() => send("game.challenge", { accept: true })}>
              {t("challenge.challenge")}
            </button>
            {canBatchStack ? (
              <button className="button !min-h-10 !px-3 text-sm" disabled={actionLocked} onClick={onBatchStack} aria-keyshortcuts="B">
                {t(pending.kind === "wild3" ? "challenge.batchStack3" : "challenge.batchStack")}
              </button>
            ) : null}
          </div>
        </motion.section>
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
    <div className="challenge-deadline h-2 overflow-hidden rounded-full bg-black/40">
      <div
        className="h-full w-full origin-left rounded-full"
        style={{
          transform: `scaleX(${fraction})`,
          background: fraction < 0.25 ? "var(--red)" : "var(--gold)",
          transition: "transform 150ms linear, background 300ms ease"
        }}
      />
    </div>
  );
}
