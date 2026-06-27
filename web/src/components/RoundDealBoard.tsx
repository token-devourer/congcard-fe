"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Suspense, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { GameSnapshot, PublicPlayer } from "@congcard/shared";
import { anchorRef } from "@/lib/anchors";
import { useRoomStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { CardView } from "./CardView";
import { PlayerSeat } from "./PlayerSeat";

const FlightLayer = dynamic(() => import("./FlightLayer").then((m) => ({ default: m.FlightLayer })));

interface RoundDealBoardProps {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
}

export function RoundDealBoard({ snapshot, send }: RoundDealBoardProps) {
  const t = useTranslations("dealing");
  const now = useNow(250);
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const deal = snapshot.roundDeal;
  if (!deal) {
    return null;
  }

  const selfId = snapshot.self?.id;
  const isDealer = deal.dealerPlayerId === selfId;
  const busy = Boolean(deal.event);
  const manual = deal.stage === "manual";
  const seconds = deal.inactivityDeadline ? Math.max(0, Math.ceil((deal.inactivityDeadline - now) / 1000)) : null;
  const dealer = snapshot.players.find((player) => player.id === deal.dealerPlayerId);
  const self = snapshot.players.find((player) => player.id === selfId);
  const eventDelay = deal.event ? Math.max(0, deal.event.startsAt - (Date.now() + clockOffset)) / 1000 : 0;
  const titleKey = deal.stage === "shuffleChoice"
    ? "chooseAction"
    : deal.stage === "manual"
      ? "manualTitle"
      : deal.stage === "auto"
        ? "autoTitle"
        : "openingTitle";

  const dealTo = (player: PublicPlayer) => {
    if (isDealer && manual && !busy && player.cardCount < deal.cardsPerPlayer) {
      send("game.dealCard", { targetPlayerId: player.id });
    }
  };

  return (
    <section className="deal-board">
      <div className="deal-table panel">
        <div className="deal-heading">
          <div>
            <p className="display text-xs font-black uppercase text-[var(--gold)]">{t("roundSetup", { round: snapshot.roundNumber })}</p>
            <h2 className="display text-2xl font-black">{t(titleKey)}</h2>
          </div>
          <div className="deal-progress" aria-live="polite">
            <strong>{t("readyCount", { ready: deal.readyPlayerCount, total: deal.totalPlayerCount })}</strong>
            {seconds !== null && !busy ? <span>{t("autoIn", { seconds })}</span> : null}
          </div>
        </div>

        <div className="deal-player-grid" role="list">
          {snapshot.players.map((player) => {
            const ready = player.cardCount >= deal.cardsPerPlayer;
            const eligible = isDealer && manual && !busy && !ready;
            return (
              <div key={player.id} role="listitem" className="relative">
                <button
                  type="button"
                  className={`deal-target ${eligible ? "eligible" : ""}`}
                  disabled={!eligible}
                  onClick={() => dealTo(player)}
                  aria-label={ready ? t("playerReady", { name: player.nickname }) : t("dealTo", { name: player.nickname })}
                >
                  <PlayerSeat player={player} isSelf={player.id === selfId} />
                  {player.id === deal.dealerPlayerId ? <span className="deal-badge dealer">{t("dealer")}</span> : null}
                  <span className={`deal-badge count ${ready ? "ready" : ""}`}>
                    {ready ? t("ready") : `${player.cardCount}/${deal.cardsPerPlayer}`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="deal-center">
          <motion.div
            ref={anchorRef("draw")}
            className={`deal-deck ${deal.event?.kind === "shuffle" ? "is-shuffling" : ""}`}
            animate={deal.event?.kind === "shuffle" ? { rotate: [0, -8, 7, -5, 0], x: [0, -12, 14, -8, 0] } : {}}
            transition={{ duration: 1.8, delay: eventDelay, ease: "easeInOut" }}
          >
            <CardView hidden />
            {deal.event?.kind === "shuffle" ? (
              <span className="shuffle-satellites" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index} className="shuffle-satellite" style={{ "--shuffle-index": index } as CSSProperties}>
                    <CardView hidden small />
                  </span>
                ))}
              </span>
            ) : null}
            <span>{snapshot.drawPileCount}</span>
          </motion.div>

          <div ref={anchorRef("discard")} className="deal-opening-slot">
            {deal.event?.kind === "opening" ? (
              <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: eventDelay + 0.58, duration: 0.2 }}>
                <CardView card={deal.event.card} />
              </motion.div>
            ) : <div className="deal-slot-mark">CC</div>}
          </div>
        </div>

        <div className="deal-controls">
          {isDealer && deal.stage === "shuffleChoice" ? (
            <>
              <button type="button" className="button secondary" disabled={busy} onClick={() => send("game.reshuffleDeck")}>{t("reshuffle")}</button>
              <button type="button" className="button" disabled={busy} onClick={() => send("game.beginDeal")}>{t("dealCards")}</button>
            </>
          ) : null}
          {isDealer && manual ? (
            <button type="button" className="button" disabled={busy} onClick={() => send("game.autoDeal")}>{t("autoDeal")}</button>
          ) : null}
          {!isDealer && deal.stage !== "auto" && deal.stage !== "opening" ? (
            <p className="text-center text-sm font-bold text-[var(--muted)]">
              {dealer ? t("waitingDealer", { name: dealer.nickname }) : t("waitingActiveDealer")}
            </p>
          ) : null}
          {deal.stage === "auto" ? <p className="text-center text-sm font-bold text-[var(--gold)]">{t("autoDealing")}</p> : null}
          {deal.stage === "opening" ? <p className="text-center text-sm font-bold text-[var(--gold)]">{t("opening")}</p> : null}
        </div>
      </div>

      <button
        type="button"
        ref={anchorRef("hand")}
        className={`deal-hand panel ${isDealer && manual && !busy && self && self.cardCount < deal.cardsPerPlayer ? "eligible" : ""}`}
        disabled={!isDealer || !manual || busy || !self || self.cardCount >= deal.cardsPerPlayer}
        onClick={() => self && dealTo(self)}
      >
        <span className="display text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{t("yourCards")}</span>
        <span className="deal-hand-cards" aria-label={t("faceDownCount", { count: self?.cardCount ?? 0 })}>
          {Array.from({ length: Math.min(self?.cardCount ?? 0, deal.cardsPerPlayer) }, (_, index) => (
            <span key={index} style={{ marginLeft: index === 0 ? 0 : -34 }}><CardView hidden small /></span>
          ))}
        </span>
        <strong>{self?.cardCount ?? 0}/{deal.cardsPerPlayer}</strong>
      </button>

      <Suspense fallback={null}><FlightLayer /></Suspense>
    </section>
  );
}
