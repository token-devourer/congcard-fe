"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { OpponentCardFace, PublicPlayer } from "@congcard/shared";
import { anchorRef } from "@/lib/anchors";
import { useNow } from "@/lib/useNow";
import { Avatar } from "./Avatar";
import { CardView } from "./CardView";
import { PingBadge } from "./PingBadge";

interface PlayerSeatProps {
  player?: PublicPlayer;
  active?: boolean;
  isSelf?: boolean;
  oneOpen?: boolean;
  turnDeadline?: number;
  turnTimeoutSec?: number;
  onOppositeEnter?: () => void;
  onOppositeLeave?: () => void;
  onOppositeToggle?: () => void;
}

export function PlayerSeat({
  player,
  active,
  isSelf,
  oneOpen,
  turnDeadline,
  turnTimeoutSec,
  onOppositeEnter,
  onOppositeLeave,
  onOppositeToggle
}: PlayerSeatProps) {
  const t = useTranslations();
  const prevCount = useRef<number | null>(null);
  const [shaking, setShaking] = useState(false);

  const cardCount = player?.cardCount ?? 0;

  useEffect(() => {
    if (prevCount.current !== null && cardCount - prevCount.current >= 2) {
      setShaking(true);
      const id = window.setTimeout(() => setShaking(false), 500);
      prevCount.current = cardCount;
      return () => window.clearTimeout(id);
    }

    prevCount.current = cardCount;
    return undefined;
  }, [cardCount]);

  if (!player) {
    return null;
  }

  const finishedRank = player.finishedRank;
  const finished = Boolean(finishedRank);
  const seatActive = Boolean(active && !finished);

  return (
    <div
      ref={anchorRef(`seat:${player.id}`)}
      className={`tableseat ${seatActive ? "active" : ""} ${oneOpen && !finished ? "pulse-red" : ""} ${
        !player.connected ? "offline" : player.away ? "away" : ""
      } ${shaking ? "shake" : ""}`}
      onMouseEnter={onOppositeEnter}
      onMouseLeave={onOppositeLeave}
      onClick={onOppositeToggle}
      onKeyDown={(event) => {
        if (onOppositeToggle && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOppositeToggle();
        }
      }}
      role={onOppositeToggle ? "button" : undefined}
      tabIndex={onOppositeToggle ? 0 : undefined}
      aria-label={onOppositeToggle ? `${player.nickname}, ${player.cardCount} cards` : undefined}
    >
      <div className="relative mx-auto h-14 w-14">
        {seatActive && turnDeadline && turnTimeoutSec ? <TimerRing deadline={turnDeadline} totalSec={turnTimeoutSec} /> : null}
        <Avatar
          avatarId={player.avatarId}
          size={48}
          className={`absolute left-1 top-1 ${seatActive ? "ring-2 ring-[var(--gold)]" : "ring-1 ring-white/15"} ${
            finished ? "opacity-75 grayscale-[0.25]" : ""
          }`}
        />
        {player.isHost ? (
          <span className="absolute -right-1.5 -top-1.5 text-sm drop-shadow" aria-label={t("lobby.host")}>
            👑
          </span>
        ) : null}
        {player.calledOne && player.cardCount === 1 ? (
          <span className="display absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--gold)] px-1.5 py-px text-[10px] font-black text-black shadow">
            {t("board.one")}
          </span>
        ) : null}
        {finished ? (
          <span className="display absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-green-300 px-1.5 py-px text-[10px] font-black text-black shadow">
            #{finishedRank}
          </span>
        ) : null}
      </div>

      <div className="mt-1 max-w-[96px] truncate text-center text-xs font-black leading-tight">
        {player.nickname}
        {isSelf ? <span className="text-[var(--gold)]"> ★</span> : null}
        {player.connected && player.ping > 0 ? <PingBadge ping={player.ping} /> : null}
      </div>

      <div className="mt-0.5 flex items-center justify-center gap-1.5">
        <CardCountChip count={player.cardCount} label={t("board.cards", { count: player.cardCount })} oppositeHand={player.oppositeHand} />
        <span className="text-[10px] font-bold text-[var(--muted)]">{t("board.points", { score: player.score })}</span>
      </div>

      {finished ? (
        <div className="mt-0.5 text-center text-[10px] font-black text-green-200">{t("board.finishedRank", { rank: finishedRank ?? "" })}</div>
      ) : null}
      {!player.connected ? <div className="mt-0.5 text-center text-[10px] font-bold text-red-300">{t("lobby.offline")}</div> : null}
      {player.connected && player.away ? <div className="mt-0.5 text-center text-[10px] font-bold text-[var(--gold)]">{t("lobby.away")}</div> : null}
    </div>
  );
}

function TimerRing({ deadline, totalSec }: { deadline: number; totalSec: number }) {
  const now = useNow(200);
  const remaining = Math.max(0, deadline - now);
  const fraction = Math.min(1, remaining / (totalSec * 1000));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining < 5000;

  return (
    <svg className="absolute inset-0 h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        stroke={urgent ? "var(--red)" : "var(--gold)"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        style={{ transition: "stroke-dashoffset 200ms linear, stroke 300ms ease" }}
      />
    </svg>
  );
}

function CardCountChip({ count, label, oppositeHand }: { count: number; label: string; oppositeHand?: OpponentCardFace[] }) {
  const fan = Math.max(1, Math.min(count, 4));

  return (
    <span className="flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5" aria-label={label}>
      <span className="opposite-mini-fan" aria-hidden="true">
        {oppositeHand?.length
          ? oppositeHand.slice(0, 4).map((card, index) => (
              <span key={card.trackingId} className="opposite-mini-card" style={{ transform: `rotate(${(index - (fan - 1) / 2) * 10}deg)` }}>
                <CardView card={card} micro />
              </span>
            ))
          : Array.from({ length: fan }, (_, index) => (
              <span
                key={index}
                className="card-back -ml-1 block h-3.5 w-2.5 rounded-[2px] border border-white/40 first:ml-0"
                style={{ transform: `rotate(${(index - (fan - 1) / 2) * 10}deg)` }}
              />
            ))}
      </span>
      <span className="text-[11px] font-black">{count}</span>
    </span>
  );
}
