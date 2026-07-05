"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Card, GameSnapshot, PresentationEvent, VisibleCardFace } from "@congcard/shared";
import { anchorRect } from "@/lib/anchors";
import { cardText } from "@/lib/rules";
import { playSound } from "@/lib/sound";
import { useRoomStore } from "@/lib/store";
import { useGraphicsPreset } from "./AnimationProvider";

type Flight =
  | { kind: "card"; card: Card | VisibleCardFace; from: string; to: string; delay?: number; pitchLevel?: number; batchIndex?: number; batchTotal?: number; drawReveal?: boolean; drawIndex?: number; drawTotal?: number }
  | { kind: "back"; from: string; to: string; delay?: number; drawIndex?: number; drawTotal?: number; dealing?: boolean; drawReveal?: boolean }
  | { kind: "token"; from: string; to: string; delay?: number };

const MAX_DRAW_FLIGHTS = 12;
const DRAW_STAGGER_SEC = 0.22;
const POOL_SIZE = 30;

// Pooled DOM elements for flights to reduce GC pressure
const elPool: HTMLDivElement[] = [];

function acquireEl(): HTMLDivElement {
  return elPool.pop() ?? document.createElement("div");
}

function releaseEl(el: HTMLDivElement) {
  el.innerHTML = "";
  el.style.cssText = "";
  if (elPool.length < POOL_SIZE) {
    elPool.push(el);
  }
}

export function FlightLayer() {
  const layerRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<GameSnapshot | null>(null);
  const animatedBatchIds = useRef(new Set<number>());
  const animatedChaosIds = useRef(new Set<number>());
  const animatedDealIds = useRef(new Set<number>());
  const animatedDrawIds = useRef(new Set<number>());
  const animatedPresentationIds = useRef(new Set<number>());
  const [reducedMotion, setReducedMotion] = useState(false);
  const snapshot = useRoomStore((state) => state.snapshot);
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const { preset } = useGraphicsPreset();

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = snapshot;

    const layer = layerRef.current;
    if (!snapshot || !layer) {
      return;
    }

    if (prev && prev.code !== snapshot.code) {
      animatedBatchIds.current.clear();
      animatedChaosIds.current.clear();
      animatedDealIds.current.clear();
      animatedDrawIds.current.clear();
      animatedPresentationIds.current.clear();
    }

    if (reducedMotion || preset.reduceMotion) {
      return;
    }

    const flights: Flight[] = [];
    const drawReveal = snapshot.pendingDraw?.reveal;
    if (drawReveal && !animatedDrawIds.current.has(drawReveal.id)) {
      animatedDrawIds.current.add(drawReveal.id);
      const serverNow = Date.now() + clockOffset;
      const destination = snapshot.pendingDraw?.playerId === snapshot.self?.id ? "hand" : `seat:${snapshot.pendingDraw?.playerId}`;
      const common = {
        from: "draw",
        to: destination,
        delay: Math.max(0, drawReveal.startsAt - serverNow) / 1000,
        drawIndex: drawReveal.index,
        drawTotal: snapshot.pendingDraw?.totalCount,
        drawReveal: true
      };
      flights.push(drawReveal.visibleCard ? { kind: "card", card: drawReveal.visibleCard, ...common } : { kind: "back", ...common });
    }
    const dealEvent = snapshot.roundDeal?.event;
    if (dealEvent && !animatedDealIds.current.has(dealEvent.id)) {
      animatedDealIds.current.add(dealEvent.id);
      const serverNow = Date.now() + clockOffset;
      if (dealEvent.kind === "shuffle") {
        window.setTimeout(() => playSound("shuffle"), Math.max(0, dealEvent.startsAt - serverNow));
        window.setTimeout(() => playSound("shuffleSettle"), Math.max(0, dealEvent.resolvesAt - serverNow - 120));
      } else if (dealEvent.kind === "deal") {
        dealEvent.targetPlayerIds.forEach((targetPlayerId, index) => {
          flights.push({
            kind: "back",
            from: "draw",
            to: targetPlayerId === snapshot.self?.id ? "hand" : `seat:${targetPlayerId}`,
            delay: Math.max(0, dealEvent.startsAt + index * dealEvent.cardIntervalMs - serverNow) / 1000,
            drawIndex: index + 1,
            drawTotal: dealEvent.targetPlayerIds.length,
            dealing: true
          });
        });
      } else {
        const delay = Math.max(0, dealEvent.startsAt - serverNow) / 1000;
        flights.push({ kind: "card", card: dealEvent.card, from: "draw", to: "discard", delay });
        window.setTimeout(() => playSound("opening"), Math.max(0, dealEvent.startsAt - serverNow));
        window.setTimeout(() => playSound("dealComplete"), Math.max(0, dealEvent.resolvesAt - serverNow));
      }
    }
    if (!prev || prev.code !== snapshot.code) {
      for (const flight of flights) {
        spawnFlight(layer, flight, preset);
      }
      return;
    }
    const sameRound =
      prev.roundNumber === snapshot.roundNumber && prev.phase === "playing" && snapshot.phase === "playing";

    if (sameRound) {
      const resolvedBatchTop = prev.pendingBatchPlay?.cards.at(-1)?.id;
      if (
        snapshot.discardTop &&
        snapshot.discardTop.id !== prev.discardTop?.id &&
        snapshot.discardTop.id !== resolvedBatchTop &&
        prev.currentPlayerId
      ) {
        flights.push({ kind: "card", card: snapshot.discardTop, from: `seat:${prev.currentPlayerId}`, to: "discard" });
      }

      const batch = snapshot.pendingBatchPlay;
      if (batch && !animatedBatchIds.current.has(batch.id)) {
        animatedBatchIds.current.add(batch.id);
        const source = batch.playerId === snapshot.self?.id ? "hand" : `seat:${batch.playerId}`;
        const serverNow = Date.now() + clockOffset;
        batch.cards.forEach((card, index) => {
          flights.push({
            kind: "card",
            card,
            from: source,
            to: "discard",
            delay: Math.max(0, batch.startsAt + index * batch.cardIntervalMs - serverNow) / 1000,
            pitchLevel: Math.min(8, index + 1),
            batchIndex: index + 1,
            batchTotal: batch.cards.length
          });
        });
      }

      const chaos = snapshot.pendingChaos;
      if (chaos?.kind === "throwup" && chaos.affectedCards?.length && !animatedChaosIds.current.has(chaos.id)) {
        animatedChaosIds.current.add(chaos.id);
        const source = chaos.actorId === snapshot.self?.id ? "hand" : `seat:${chaos.actorId}`;
        const serverNow = Date.now() + clockOffset;
        chaos.affectedCards.forEach((card, index) => {
          flights.push({
            kind: "card",
            card,
            from: source,
            to: "discard",
            delay: Math.max(0, chaos.startsAt + 650 + index * 90 - serverNow) / 1000,
            pitchLevel: Math.min(8, index + 1),
            batchIndex: index + 1,
            batchTotal: chaos.affectedCards?.length
          });
        });
      }

      const previousPresentationSeq = prev.presentationEvents?.at(-1)?.seq ?? 0;
      const serverNow = Date.now() + clockOffset;
      for (const event of snapshot.presentationEvents ?? []) {
        if (event.seq <= previousPresentationSeq || animatedPresentationIds.current.has(event.id)) {
          continue;
        }
        animatedPresentationIds.current.add(event.id);
        const transfer = chaosTransferFlight(event, snapshot);
        if (transfer) {
          flights.push({
            ...transfer,
            delay: Math.max(0, event.startsAt - serverNow) / 1000
          });
        }
      }

      for (const player of snapshot.players) {
        const before = prev.players.find((item) => item.id === player.id);
        if (!before) {
          continue;
        }

        const gained = player.cardCount - before.cardCount;
        if (gained > 0 && !snapshot.pendingDraw && !prev.pendingDraw) {
          const to = player.id === snapshot.self?.id ? "hand" : `seat:${player.id}`;
          const visibleGained = Math.min(gained, MAX_DRAW_FLIGHTS);
          for (let i = 0; i < visibleGained; i += 1) {
            flights.push({
              kind: "back",
              from: "draw",
              to,
              delay: i * DRAW_STAGGER_SEC,
              drawIndex: i + 1,
              drawTotal: gained
            });
          }
        }
      }
    }

    if (
      snapshot.phase === "playing" &&
      prev.currentPlayerId &&
      snapshot.currentPlayerId &&
      snapshot.currentPlayerId !== prev.currentPlayerId
    ) {
      flights.push({ kind: "token", from: `seat:${prev.currentPlayerId}`, to: `seat:${snapshot.currentPlayerId}` });
    }

    for (const flight of flights) {
      spawnFlight(layer, flight, preset);
    }
  }, [clockOffset, reducedMotion, snapshot, preset]);

  useEffect(() => {
    const layer = layerRef.current;
    return () => {
      if (layer) {
        gsap.killTweensOf(layer.children);
      }
    };
  }, []);

  return (
    <>
      <div ref={layerRef} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true" />
      {reducedMotion && snapshot?.pendingBatchPlay ? (
        <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[70] flex justify-center" aria-live="polite">
          <span className="display rounded-full border border-[var(--gold)]/60 bg-black/80 px-5 py-2 font-black text-[var(--gold-strong)]">
            Batch x{snapshot.pendingBatchPlay.cards.length}
          </span>
        </div>
      ) : null}
    </>
  );
}

function chaosTransferFlight(event: PresentationEvent, snapshot: GameSnapshot): Flight | null {
  if (
    event.kind !== "chaos" ||
    event.phase !== "sequence" ||
    (event.chaosKind !== "steal" && event.chaosKind !== "favor") ||
    !event.actorId ||
    !event.targetIds?.[0]
  ) {
    return null;
  }

  const actorDestination = event.actorId === snapshot.self?.id ? "hand" : `seat:${event.actorId}`;
  return {
    kind: "back",
    from: `seat:${event.targetIds[0]}`,
    to: actorDestination,
    drawIndex: 1,
    drawTotal: 1
  };
}

function spawnFlight(layer: HTMLDivElement, flight: Flight, preset: import("@/lib/animationPresets").AnimationPreset) {
  const from = anchorRect(flight.from);
  const to = anchorRect(flight.to);
  if (!from || !to) {
    return;
  }

  const el = acquireEl();
  if (flight.kind === "card") {
    el.className = "flight-card-shell";
    const card = document.createElement("div");
    const faceClass = `card-face card-small ${flight.card.side ? `card-side-${flight.card.side}` : "card-side-light"} ${flight.card.color ? `card-${flight.card.color}` : "card-wild"}`;
    card.className = flight.drawReveal ? "card-face card-small card-back flight-reveal-flip" : faceClass;
    el.appendChild(card);
    const label = document.createElement("span");
    label.className = "flight-card-label";
    label.textContent = cardText(flight.card);
    if (flight.drawReveal) label.hidden = true;
    card.appendChild(label);
    if (flight.drawReveal) {
      window.setTimeout(() => {
        card.className = `${faceClass} flight-reveal-flip revealed`;
        label.hidden = false;
      }, Math.max(0, ((flight.delay ?? 0) * 1000) + 110));
    }
    if (flight.batchIndex) {
      const badge = document.createElement("span");
      badge.className = "flight-draw-badge";
      badge.textContent = String(flight.batchIndex);
      el.appendChild(badge);
      el.style.zIndex = String(flight.batchIndex);
    }
  } else if (flight.kind === "back") {
    el.className = "flight-card-shell";
    const card = document.createElement("div");
    card.className = "card-face card-small card-back";
    el.appendChild(card);
    if (!flight.dealing && flight.drawTotal && flight.drawTotal > 1 && flight.drawIndex) {
      const badge = document.createElement("span");
      badge.className = "flight-draw-badge";
      badge.textContent = `+${flight.drawIndex}`;
      el.appendChild(badge);
    }
  } else {
    el.className = "turn-token";
  }
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.willChange = "transform";
  layer.appendChild(el);

  const startX = from.left + from.width / 2 - el.offsetWidth / 2;
  const startY = from.top + from.height / 2 - el.offsetHeight / 2;
  const endX = to.left + to.width / 2 - el.offsetWidth / 2;
  const endY = to.top + to.height / 2 - el.offsetHeight / 2;
  const lift = preset.flightArc ? Math.max(40, Math.abs(endY - startY) * 0.35) : 0;
  const isDrawReveal = flight.kind !== "token" && Boolean(flight.drawReveal);
  const isDealFlight = flight.kind === "back" && Boolean(flight.dealing);
  const spin = flight.kind === "token" || isDrawReveal ? 0 : startX < endX ? 14 : -14;
  const scale = preset.durationScale;
  const firstLegDuration = (isDrawReveal ? 0.1 : isDealFlight ? 0.15 : flight.kind === "back" ? 0.42 : 0.3) * scale;
  const secondLegDuration = (isDrawReveal ? 0.11 : isDealFlight ? 0.16 : flight.kind === "back" ? 0.38 : 0.3) * scale;
  const fadeDuration = (isDrawReveal ? 0.05 : isDealFlight ? 0.05 : flight.kind === "back" ? 0.18 : 0.16) * scale;
  if (flight.kind === "back") {
    const pitchLevel = Math.min(8, Math.max(1, flight.drawIndex ?? 1));
    window.setTimeout(() => playSound(flight.dealing ? "dealTick" : "drawTick", pitchLevel), Math.max(0, (flight.delay ?? 0) * 1000));
  } else if (flight.kind === "card" && flight.pitchLevel) {
    const delayMs = Math.max(0, (flight.delay ?? 0) * 1000);
    window.setTimeout(() => playSound("matchChain", flight.pitchLevel), delayMs);
    if (flight.batchTotal && flight.batchIndex === flight.batchTotal) {
      const landMs = Math.max(0, ((flight.delay ?? 0) + firstLegDuration + secondLegDuration) * 1000);
      window.setTimeout(() => playSound("batchFinale", Math.min(8, flight.batchTotal!)), landMs);
    }
  } else if (flight.kind === "card" && flight.drawReveal) {
    window.setTimeout(
      () => playSound("drawTick", Math.min(8, Math.max(1, flight.drawIndex ?? 1))),
      Math.max(0, (flight.delay ?? 0) * 1000)
    );
  }

  if (preset.flightArc && lift > 0) {
    gsap.set(el, { x: startX, y: startY, scale: flight.kind === "token" ? 0.6 : 0.72, opacity: 0.95, rotation: 0 });
    gsap.to(el, {
      delay: flight.delay ?? 0,
      keyframes: [
        {
          x: (startX + endX) / 2,
          y: Math.min(startY, endY) - lift,
          scale: flight.kind === "token" ? 1 : 1.04,
          rotation: spin,
          duration: firstLegDuration,
          ease: "power2.out"
        },
        { x: endX, y: endY, scale: 1, rotation: 0, duration: secondLegDuration, ease: "power2.in" },
        { opacity: 0, scale: 0.8, duration: fadeDuration, ease: "power1.in" }
      ],
      onComplete: () => { releaseEl(el); el.remove(); }
    });
  } else {
    gsap.set(el, { x: startX, y: startY, scale: flight.kind === "token" ? 0.6 : 0.72, opacity: 0.95 });
    gsap.to(el, {
      delay: flight.delay ?? 0,
      x: endX,
      y: endY,
      scale: 1,
      opacity: 0,
      duration: firstLegDuration + secondLegDuration + fadeDuration,
      ease: "power1.out",
      onComplete: () => { releaseEl(el); el.remove(); }
    });
  }
}
