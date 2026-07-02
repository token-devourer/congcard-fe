"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GameSnapshot, OpponentCardFace, PendingStack, PublicPlayer } from "@congcard/shared";
import { anchorRef } from "@/lib/anchors";
import { isSelfColorHunt } from "@/lib/rules";
import { useNow } from "@/lib/useNow";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import { PlayerSeat } from "./PlayerSeat";

function useMobilePortrait(): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 640px) and (orientation: portrait)");
    const update = () => setMatch(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return match;
}

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
  const isMobilePortrait = useMobilePortrait();
  const sorted = [...snapshot.players].sort((a, b) => a.seat - b.seat);
  const selfIndex = Math.max(
    0,
    sorted.findIndex((player) => player.id === snapshot.self?.id)
  );
  const ordered = sorted.map((_, index) => sorted[(selfIndex + index) % sorted.length]);
  // `currentPlayerId` advances to the next seat the moment a penalty/colour draw
  // begins — the engine clears `pendingStack` and moves the turn before the
  // drawer finishes (BE resolveStackDraw) — so a plain currentPlayerId highlight
  // jumps ahead while the penalised player is still drawing. Prefer the active
  // drawer, then a pending wild-colour stack target, then the current player.
  const highlightedPlayerId =
    snapshot.pendingDraw?.playerId ??
    (snapshot.pendingStack?.kind === "wildColor" ? snapshot.pendingStack.targetPlayerId : undefined) ??
    snapshot.currentPlayerId;
  const activePlayer = snapshot.players.find((player) => player.id === highlightedPlayerId);
  // `isMyTurn` tracks currentPlayerId, which races ahead during a penalty draw —
  // gate the chip's "your turn" on the highlighted focus actually being you so it
  // never pairs the drawer's avatar with a premature "your turn" label.
  const focusIsSelf = Boolean(highlightedPlayerId && highlightedPlayerId === snapshot.self?.id);
  const colorVar = snapshot.activeColor ? COLOR_VAR[snapshot.activeColor] : "var(--gold)";
  // The Wild Draw Color controls + collection enlarge the hand row, so let the
  // felt give up height here (matched by .board--color-draw) instead of pushing
  // the page into a scrollbar while you draw.
  const selfColorDraw = isSelfColorHunt(snapshot);
  const mobileTableMinH = selfColorDraw ? "min-h-[min(220px,30dvh)]" : "min-h-[min(340px,44dvh)]";
  const tableMinH = selfColorDraw
    ? "min-h-[min(280px,34dvh)]"
    : "min-h-[min(420px,46dvh)] md:min-h-[min(460px,50dvh)]";
  const now = useNow(100);
  const [hoveredOpponentId, setHoveredOpponentId] = useState<string>();
  const [pinnedOpponentId, setPinnedOpponentId] = useState<string>();
  const hoverCloseTimer = useRef<number | undefined>(undefined);
  const inspectedPlayerId = pinnedOpponentId ?? hoveredOpponentId;
  const inspectedPlayer = snapshot.players.find((player) => player.id === inspectedPlayerId && player.oppositeHand?.length);

  useEffect(() => {
    if (!snapshot.oneWindow) return;
    setHoveredOpponentId(undefined);
    setPinnedOpponentId(undefined);
  }, [snapshot.oneWindow]);

  function keepOpponentTrayOpen(playerId: string) {
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current);
    setHoveredOpponentId(playerId);
  }

  function scheduleOpponentTrayClose() {
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = window.setTimeout(() => setHoveredOpponentId(undefined), 140);
  }

  function toggleOpponentTray(playerId: string) {
    setPinnedOpponentId((current) => current === playerId ? undefined : playerId);
  }
  const oneVisibleUntil = Math.max(snapshot.oneWindow?.deadline ?? 0, snapshot.oneWindow?.callResolvesAt ?? 0);
  const oneReady =
    Boolean(snapshot.oneWindow) &&
    now >= (snapshot.oneWindow?.opensAt ?? 0) &&
    now <= oneVisibleUntil;
  const stackToTake = snapshot.pendingStack?.targetPlayerId === snapshot.self?.id ? snapshot.pendingStack : undefined;
  const drawLabel =
    stackToTake
      ? stackToTake.kind === "wildColor" && stackToTake.targetColor
        ? t("board.takeColorStack", { count: stackToTake.totalDraw, color: t(`colors.${stackToTake.targetColor}`) })
        : t("board.takeStack", { count: stackToTake.totalDraw })
      : t("board.draw");

  const centerPile = (
    <div className="grid justify-items-center gap-2.5">
      <TurnChip player={activePlayer} isMyTurn={isMyTurn && focusIsSelf} deadline={snapshot.turnDeadline} />
      {snapshot.pendingStack ? <StackPenaltyChip stack={snapshot.pendingStack} /> : null}

      <div className="flex items-center justify-center gap-4">
        <motion.button
          ref={anchorRef("draw")}
          className={`grid justify-items-center gap-1 text-center ${canDraw ? "pulse-gold rounded-xl" : ""}`}
          disabled={!canDraw}
          onClick={onDraw}
          whileTap={canDraw ? { scale: 0.94 } : undefined}
          aria-label={drawLabel}
          aria-keyshortcuts="D"
        >
          <span className="relative">
            <CardView card={snapshot.drawPileBack} hidden={!snapshot.drawPileBack} />
            <span className="absolute -right-2 -top-2 z-20 rounded-full bg-black/85 px-2 py-0.5 text-xs font-black text-[var(--gold)]">
              {snapshot.drawPileCount}
            </span>
          </span>
          <span className={`text-xs font-black uppercase tracking-wider ${canDraw ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>
            {drawLabel}
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
  );

  if (isMobilePortrait) {
    // Phone portrait: ellipse seating squeezes seats and clips them. Use a
    // vertical stack — opponent strip on top, central pile below — so seats
    // and cards both keep readable size in a 9:16 viewport.
    const opponents = ordered.filter((p) => p.id !== snapshot.self?.id);

    return (
      <div className={`relative grid h-full ${mobileTableMinH} w-full max-w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden px-1 pb-1 pt-2`}>
        <div
          className={`opponent-strip ${opponents.length > 3 ? "is-scrollable" : "is-centered"}`}
          role="list"
        >
          {opponents.map((player) => (
            <div key={player.id} role="listitem" className="opponent-strip-item">
              <PlayerSeat
                player={player}
                active={player.id === highlightedPlayerId}
                isSelf={false}
                oneOpen={oneReady && snapshot.oneWindow?.playerId === player.id}
                turnDeadline={snapshot.turnDeadline}
                turnTimeoutSec={snapshot.settings.turnTimeoutSec}
                onOppositeEnter={player.oppositeHand?.length && !snapshot.oneWindow ? () => keepOpponentTrayOpen(player.id) : undefined}
                onOppositeLeave={player.oppositeHand?.length && !snapshot.oneWindow ? scheduleOpponentTrayClose : undefined}
                onOppositeToggle={player.oppositeHand?.length && !snapshot.oneWindow ? () => toggleOpponentTray(player.id) : undefined}
              />
            </div>
          ))}
        </div>

        <div className="table-rim relative mx-auto min-h-0 w-full max-w-full overflow-hidden">
          <div className="table-felt grid place-items-center px-2 py-3">
            <DirectionRing direction={snapshot.direction} />
            <div className="relative z-10">{centerPile}</div>
          </div>
        </div>
        {inspectedPlayer?.oppositeHand ? (
          <OpponentFaceTray
            player={inspectedPlayer}
            cards={inspectedPlayer.oppositeHand}
            onEnter={() => keepOpponentTrayOpen(inspectedPlayer.id)}
            onLeave={scheduleOpponentTrayClose}
            onClose={() => { setPinnedOpponentId(undefined); setHoveredOpponentId(undefined); }}
          />
        ) : null}
      </div>
    );
  }


  return (
    <div className={`relative h-full ${tableMinH} w-full max-w-full min-w-0 overflow-hidden`}>
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
              active={player.id === highlightedPlayerId}
              isSelf={player.id === snapshot.self?.id}
              oneOpen={oneReady && snapshot.oneWindow?.playerId === player.id && player.id !== snapshot.self?.id}
              turnDeadline={snapshot.turnDeadline}
              turnTimeoutSec={snapshot.settings.turnTimeoutSec}
              onOppositeEnter={player.oppositeHand?.length && !snapshot.oneWindow ? () => keepOpponentTrayOpen(player.id) : undefined}
              onOppositeLeave={player.oppositeHand?.length && !snapshot.oneWindow ? scheduleOpponentTrayClose : undefined}
              onOppositeToggle={player.oppositeHand?.length && !snapshot.oneWindow ? () => toggleOpponentTray(player.id) : undefined}
            />
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2">
          {centerPile}
        </div>
        {inspectedPlayer?.oppositeHand ? (
          <OpponentFaceTray
            player={inspectedPlayer}
            cards={inspectedPlayer.oppositeHand}
            onEnter={() => keepOpponentTrayOpen(inspectedPlayer.id)}
            onLeave={scheduleOpponentTrayClose}
            onClose={() => { setPinnedOpponentId(undefined); setHoveredOpponentId(undefined); }}
          />
        ) : null}
      </div>
    </div>
  );
}

function OpponentFaceTray({
  player,
  cards,
  onEnter,
  onLeave,
  onClose
}: {
  player: PublicPlayer;
  cards: OpponentCardFace[];
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const ordered = [...cards].sort((a, b) => `${a.color ?? "wild"}-${a.value}`.localeCompare(`${b.color ?? "wild"}-${b.value}`));
  const groups = ordered.reduce<Array<{ color: string; cards: OpponentCardFace[] }>>((result, card) => {
    const color = card.color ?? "wild";
    const group = result.find((item) => item.color === color);
    if (group) {
      group.cards.push(card);
    } else {
      result.push({ color, cards: [card] });
    }
    return result;
  }, []);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <aside className="opponent-face-tray" onMouseEnter={onEnter} onMouseLeave={onLeave} aria-label={`${player.nickname} opposite card faces`}>
      <div className="opponent-face-tray-header">
        <div>
          <strong>{player.nickname}</strong>
          <span>{t("board.oppositeFaces")}</span>
        </div>
        <span className="opponent-face-total">{t("board.cards", { count: cards.length })}</span>
        <button type="button" onClick={onClose} aria-label="Close card tray">&times;</button>
      </div>
      <div className="opponent-face-tray-cards thin-scroll">
        {groups.map((group) => (
          <section key={group.color} className="opponent-face-group">
            <span>{group.color === "wild" ? "Wild" : t(`colors.${group.color}`)} · {group.cards.length}</span>
            <div
              className="opponent-face-stack"
              style={{ "--opponent-face-count": group.cards.length } as CSSProperties}
            >
              {group.cards.map((card, index) => (
                <span key={card.trackingId} className="opponent-face-stack-card" style={{ zIndex: index + 1 }}>
                  <CardView card={card} small />
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>,
    document.body
  );
}


function StackPenaltyChip({ stack }: { stack: PendingStack }) {
  const t = useTranslations();
  const labels: Record<PendingStack["kind"], string> = {
    draw1: "+1",
    draw2: "+2",
    draw5: "+5",
    wild2: "+2",
    wild3: "+3",
    wild4: "+4",
    wildColor: stack.targetColor ? t(`colors.${stack.targetColor}`) : "Wild"
  };

  return (
    <motion.div
      key={`${stack.kind}-${stack.totalDraw}`}
      initial={{ scale: 0.72, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      className="display rounded-full border-2 border-[var(--gold)] bg-[#2a1405]/90 px-4 py-1.5 text-sm font-black text-[var(--gold)] shadow-[0_0_24px_rgba(242,193,78,0.45)]"
    >
      {stack.kind === "wildColor"
        ? t("board.colorHuntPenalty", { count: stack.totalDraw, color: labels.wildColor })
        : t("board.stackPenalty", { count: stack.totalDraw, card: labels[stack.kind] })}
    </motion.div>
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
