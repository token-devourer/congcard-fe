"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GameSnapshot } from "@congcard/shared";
import { Avatar } from "./Avatar";

const CONFETTI_COLORS = ["var(--red)", "var(--yellow)", "var(--green)", "var(--blue)", "var(--gold)"];

interface RoundEndOverlayProps {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
  onLeave: () => void;
}

export function RoundEndOverlay({ snapshot, send, onLeave }: RoundEndOverlayProps) {
  const t = useTranslations();
  const open = snapshot.phase === "roundEnd" || snapshot.phase === "gameEnd";
  const isPlayer = snapshot.self?.role === "player";
  const me = isPlayer ? snapshot.players.find((player) => player.id === snapshot.self?.id) : undefined;
  const winner = snapshot.players.find((player) => player.id === (snapshot.gameWinnerId ?? snapshot.roundWinnerId));
  const placements = snapshot.lastStandPlacements;
  const lastStandRows = placements
    ?.map((placement) => {
      const player = snapshot.players.find((item) => item.id === placement.playerId);
      return player ? { placement, player } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const ranked = [...snapshot.players].sort((a, b) => b.score - a.score);
  const showLastStand = Boolean(lastStandRows?.length);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="round-end"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overflow-x-hidden bg-black/80 p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Confetti />

          <motion.div
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="mobile-modal panel relative grid max-w-md gap-4 p-5 text-center sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <div>
              <p className="display text-sm font-black uppercase tracking-[0.2em] text-[var(--gold)]">
                {snapshot.phase === "gameEnd" ? t("roundEnd.gameTitle") : t("roundEnd.roundTitle")}
              </p>
              {winner ? (
                <>
                  <motion.div
                    className="mt-3 flex justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <Avatar
                      avatarId={winner.avatarId}
                      size={84}
                      className="ring-4 ring-[var(--gold)] shadow-[0_0_36px_rgba(242,193,78,0.55)]"
                    />
                  </motion.div>
                  <h2 className="display mt-2 text-3xl font-black">{t("roundEnd.winner", { name: winner.nickname })}</h2>
                </>
              ) : null}
            </div>

            <div className="rounded-xl bg-black/30 p-3">
              <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <span>{t("roundEnd.player")}</span>
                <span>{showLastStand ? t("roundEnd.place") : t("roundEnd.score")}</span>
              </div>
              <div className="grid gap-1.5">
                {showLastStand
                  ? lastStandRows!.map(({ player, placement }, index) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + index * 0.08 }}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                          player.id === winner?.id ? "bg-[var(--gold)]/20 font-black" : placement.isLoser ? "bg-red-950/45" : "bg-black/20"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Avatar avatarId={player.avatarId} size={24} />
                          <span className="truncate">{player.nickname}</span>
                          {player.id === winner?.id ? <span>ðŸ†</span> : null}
                        </span>
                        <span className={placement.isLoser ? "font-black text-red-200" : "tabular-nums"}>
                          {placement.isLoser ? t("roundEnd.lost") : t("roundEnd.placement", { rank: placement.rank })}
                        </span>
                      </motion.div>
                    ))
                  : ranked.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.08 }}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      player.id === winner?.id ? "bg-[var(--gold)]/20 font-black" : "bg-black/20"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Avatar avatarId={player.avatarId} size={24} />
                      <span className="truncate">{player.nickname}</span>
                      {player.id === winner?.id ? <span>🏆</span> : null}
                    </span>
                    <span className="tabular-nums">{player.score}</span>
                  </motion.div>
                    ))}
              </div>
            </div>

            {snapshot.phase === "roundEnd" ? (
              !isPlayer ? (
                <p className="text-sm text-[var(--muted)]">
                  {snapshot.self?.role === "waiting" ? t("roundEnd.waitingPlayer") : t("roundEnd.spectatorOnly")}
                </p>
              ) : me?.isHost ? (
                <button className="button !min-h-12" onClick={() => send("game.start")}>
                  {t("roundEnd.nextRound")}
                </button>
              ) : (
                <p className="text-sm text-[var(--muted)]">{t("roundEnd.waitingHost")}</p>
              )
            ) : null}

            <button
              className={snapshot.phase === "gameEnd" ? "button !min-h-12" : "button secondary !min-h-10 text-sm"}
              onClick={onLeave}
            >
              {t("roundEnd.leave")}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => {
        const left = ((index * 37) % 100) + 1;
        const delay = (index % 7) * 0.22;
        const duration = 2.8 + (index % 5) * 0.45;
        const size = 7 + (index % 4) * 3;

        return (
          <motion.span
            key={index}
            className="absolute top-[-6%] block rounded-[2px]"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 1.6,
              background: CONFETTI_COLORS[index % CONFETTI_COLORS.length]
            }}
            animate={{
              y: ["0vh", "112vh"],
              x: [0, index % 2 === 0 ? 38 : -38, 0],
              rotate: [0, index % 2 === 0 ? 540 : -540]
            }}
            transition={{ repeat: Infinity, duration, delay, ease: "linear" }}
          />
        );
      })}
    </div>
  );
}
