import { COLORS, type Card, type CardValue, type Color, type GameSnapshot } from "@congcard/shared";
import { canPlayCard } from "./rules";

export interface BatchCardGroup {
  value: CardValue;
  cards: Card[];
  playableStarterIds: Set<string>;
}

export interface BatchColorGroup {
  color: Color | null;
  cards: Card[];
}

export function groupBatchCardsByColor(cards: Card[], activeColor?: Color): BatchColorGroup[] {
  const colorOrder: Array<Color | null> = [
    ...(activeColor ? [activeColor] : []),
    ...COLORS.filter((color) => color !== activeColor),
    null
  ];

  return colorOrder
    .map((color) => ({
      color,
      cards: cards
        .filter((card) => card.color === color)
        .sort((left, right) => left.deckIndex - right.deckIndex || left.id.localeCompare(right.id))
    }))
    .filter((group) => group.cards.length > 0);
}

export function orderedBatchCardsByColor(cards: Card[], activeColor?: Color): Card[] {
  return groupBatchCardsByColor(cards, activeColor).flatMap((group) => group.cards);
}

export function defaultBatchCardIds(colorGroups: BatchColorGroup[], playableStarterIds: Set<string>): string[] {
  const orderedIds = colorGroups.flatMap((group) => group.cards.map((card) => card.id));
  const starterId = orderedIds.find((id) => playableStarterIds.has(id));
  if (!starterId) {
    return [];
  }

  return [starterId, ...orderedIds.filter((id) => id !== starterId)];
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
    draw1: "+1",
    draw2: "+2",
    draw5: "+5",
    flip: "Flip",
    wild: "Wild",
    wild2: "Wild +2",
    wild3: "Wild +3",
    wild4: "Wild +4",
    wildColor: "Wild Color",
    flashbang: "Flashbang",
    throwup: "Throw Up",
    steal: "Steal",
    favor: "Favor",
    peek: "Peek",
    vote: "Vote",
    chaosCard: "Chaos",
    timeskip: "Time Skip",
    mirror: "Mirror",
    pandemic: "Pandemic",
    magnet: "Magnet",
    jackpot: "Jackpot",
    roulette: "Roulette",
    nuke: "Nuke",
    mime: "Mime"
  };
  return labels[value];
}
