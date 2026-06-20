import type { Card, CardValue, GameSnapshot } from "@congcard/shared";
import { canPlayCard } from "./rules";

export interface BatchCardGroup {
  value: CardValue;
  cards: Card[];
  playableStarterIds: Set<string>;
}

export function batchCardGroups(snapshot: GameSnapshot, actionLocked = false): BatchCardGroup[] {
  if (
    actionLocked ||
    !snapshot.settings.batchEnabled ||
    !snapshot.self ||
    snapshot.self.role !== "player" ||
    snapshot.phase !== "playing" ||
    snapshot.pauseReason ||
    snapshot.pendingBatchPlay ||
    snapshot.oneWindow ||
    snapshot.currentPlayerId !== snapshot.self.id
  ) {
    return [];
  }

  // After drawing, the player is committed to the just-drawn card: only a batch
  // that starts with it is allowed, so the drawn card is forced as the lone
  // starter (and only its value can be batched).
  const drawnId = snapshot.self.drawnCardId;
  const drawnCard = drawnId ? snapshot.self.hand.find((card) => card.id === drawnId) : undefined;

  const grouped = new Map<CardValue, Card[]>();
  for (const card of snapshot.self.hand) {
    const cards = grouped.get(card.value) ?? [];
    cards.push(card);
    grouped.set(card.value, cards);
  }

  return [...grouped.entries()]
    .map(([value, cards]) => ({
      value,
      cards,
      playableStarterIds: drawnCard
        ? new Set<string>(value === drawnCard.value && canPlayCard(snapshot, drawnCard) ? [drawnCard.id] : [])
        : new Set(cards.filter((card) => canPlayCard(snapshot, card)).map((card) => card.id))
    }))
    .filter((group) => group.cards.length >= 2 && group.playableStarterIds.size > 0);
}

export function batchValueText(value: CardValue): string {
  if (typeof value === "number") {
    return String(value);
  }

  const labels: Record<Exclude<CardValue, number>, string> = {
    skip: "Skip",
    reverse: "Reverse",
    draw2: "+2",
    wild: "Wild",
    wild4: "Wild +4"
  };
  return labels[value];
}
