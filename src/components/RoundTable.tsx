"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GameSnapshot, PublicPlayer } from "@congcard/shared";
import { anchorRef } from "@/lib/anchors";
import { useNow } from "@/lib/useNow";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import { PlayerSeat } from "./PlayerSeat";

const COLOR_VAR: Record<string, string> = {
  red: "var(--red)",
  yellow: "var(--yellow)",
  green: "var(--green)",
  blue: "var(--blue)"
};

interface RoundTableProps {
  snapshot: GameSnapshot;
  isMyTurn: boolean;
  canDraw: boolean;
  onDraw: () => void;
}

// Seats sit on an ellipse: you at six o'clock, then ascending seat order
// clockwise, so direction === 1 visually travels clockwise around the table.
function seatPosition(index: number, total: number): { left: string; top: string } {
  const theta = (Math.PI / 180) * (90 + (index * 360) / total);
  return {
    left: `${50 + 39 * Math.cos(theta)}%`,
    top: `${50 + 36 * Math.sin(theta)}%`
  };
}

export function RoundTable({ snapshot, isMyTurn, canDraw, onDraw }: RoundTableProps) {
  const t = useTranslations();
  const sorted = [...snapshot.players].sort((a, b) => a.seat - b.seat);
  const selfIndex = Math.max(
    0,
    sorted.findIndex((player) => player.id === snapshot.self?.id)
  );
  const ordered = sorted.map((_, index) => sorted[(selfIndex + index) % sorted.length]);
  const activePlayer = snapshot.players.find((player) => player.id === snapshot.currentPlayerId);
  const colorVar = snapshot.activeColor ? COLOR_VAR[snapshot.activeColor] : "var(--gold)";
  const now = useNow(100);
  const oneReady =
    Boolean(snapshot.oneWindow) &&
    now >= (snapshot.oneWindow?.opensAt ?? 0) &&
    now <= (snapshot.oneWindow?.deadline ?? 0);

  return (
    <div className="relative h-full min-h-[min(420px,46dvh)] md:min-h-[min(460px,50dvh)]">
      {/* Width-capped, centered stage: the felt keeps a sane aspect ratio on
          short/wide screens instead of stretching into a flat sliver. Seats
          and the center pile share its coordinate space so geometry holds. */}
      <div
        className="absolute inset-y-0 left-1/2 max-w-full -translate-x-1/2"
        style={{ aspectRatio: "2.05 / 1" }}
      >
        <div className="table-rim absolute inset-x-1 inset-y-8 md:inset-x-10 md:inset-y-6">
          <div className="table-felt">
            <DirectionRing direction={snapshot.direction} />
          </div>
        </div>

        {ordered.map((player, index) => (
          <div
            key={player.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={seatPosition(index, ordered.length)}
          >
            <PlayerSeat
              player={player}
              active={player.id === snapshot.currentPlayerId}
              isSelf={player.id === snapshot.self?.id}
              oneOpen={oneReady && snapshot.oneWindow?.playerId === player.id && player.id !== snapshot.self?.id}
              turnDeadline={snapshot.turnDeadline}
              turnTimeoutSec={snapshot.settings.turnTimeoutSec}
            />
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 z-[5] grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-2.5">
          <TurnChip player={activePlayer} isMyTurn={isMyTurn} deadline={snapshot.turnDeadline} />

          <div className="flex items-center justify-center gap-4">
            <motion.button
              ref={anchorRef("draw")}
              className={`grid justify-items-center gap-1 text-center ${canDraw ? "pulse-gold rounded-xl" : ""}`}
              disabled={!canDraw}
              onClick={onDraw}
              whileTap={canDraw ? { scale: 0.94 } : undefined}
              aria-label={t("board.draw")}
            >
              <span className="relative">
                <CardView hidden />
                <span className="absolute -right-2 -top-2 z-20 rounded-full bg-black/85 px-2 py-0.5 text-xs font-black text-[var(--gold)]">
                  {snapshot.drawPileCount}
                </span>
              </span>
              <span className={`text-xs font-black uppercase tracking-wider ${canDraw ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>
                {t("board.draw")}
              </span>
            </motion.button>

            <div className="grid justify-items-center gap-1.5">
              <div
                ref={anchorRef("discard")}
                className="relative rounded-[14px] p-[5px] transition-shadow duration-300"
                style={{ boxShadow: `0 0 0 3px ${colorVar}, 0 0 30px ${colorVar}` }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={snapshot.discardTop?.id ?? "empty"}
                    initial={{ scale: 1.18, rotate: -8, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 360, damping: 26 }}
                  >
                    <CardView card={snapshot.discardTop} />
                  </motion.div>
                </AnimatePresence>
              </div>
              {snapshot.activeColor ? (
                <span className="display rounded-full px-2.5 py-0.5 text-xs font-black text-black" style={{ background: colorVar }}>
                  {t("board.activeColor", { color: t(`colors.${snapshot.activeColor}`) })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)] [@media(max-height:760px)]:hidden">
            <span aria-hidden="true">{snapshot.direction === 1 ? "↻" : "↺"}</span>
            <span>{snapshot.direction === 1 ? t("board.clockwise") : t("board.counterclockwise")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnChip({ player, isMyTurn, deadline }: { player?: PublicPlayer; isMyTurn: boolean; deadline?: number }) {
  const t = useTranslations();
  const now = useNow(250);
  const seconds = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm transition-colors ${
        isMyTurn
          ? "border-[var(--gold)] bg-[var(--gold)]/90 text-black"
          : "border-[var(--line)] bg-black/55 text-[var(--text)]"
      }`}
    >
      {player ? <Avatar avatarId={player.avatarId} size={22} /> : null}
      <span className="display max-w-[140px] truncate text-sm font-black">
        {isMyTurn ? t("events.yourTurn") : (player?.nickname ?? t("board.waiting"))}
      </span>
      {seconds !== null ? (
        <span
          className={`rounded-full px-1.5 py-px text-xs font-black tabular-nums ${
            seconds <= 5 ? "bg-[var(--red)] text-white" : isMyTurn ? "bg-black/20" : "bg-white/10"
          }`}
        >
          {seconds}
        </span>
      ) : null}
    </div>
  );
}

function DirectionRing({ direction }: { direction: 1 | -1 }) {
  // Chevrons must point along their direction of travel; the whole group
  // spins via SMIL so the flow reads clockwise or counterclockwise at a glance.
  const chevron = direction === 1 ? "M -7 -77 L 9 -71 L -7 -65 Z" : "M 7 -77 L -9 -71 L 7 -65 Z";

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 124" preserveAspectRatio="none" aria-hidden="true">
      <g transform="translate(100,62) scale(1.18,0.72)">
        <g key={direction}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={direction === 1 ? "0" : "360"}
            to={direction === 1 ? "360" : "0"}
            dur="13s"
            repeatCount="indefinite"
          />
          <circle r="71" fill="none" stroke="rgba(242,193,78,0.16)" strokeWidth="2.5" strokeDasharray="2 13" strokeLinecap="round" />
          {[0, 120, 240].map((angle) => (
            <path key={angle} d={chevron} fill="rgba(242,193,78,0.5)" transform={`rotate(${angle})`} />
          ))}
        </g>
      </g>
    </svg>
  );
}
