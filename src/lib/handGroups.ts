import type { Card, CardValue, Color, GameSnapshot } from "@congcard/shared";
import { canPlayCard } from "./rules";

export type HandGroupId = Color | "wild";

export interface GroupedHandCard {
  card: Card;
  playable: boolean;
  drawn: boolean;
}

export interface HandGroup {
  id: HandGroupId;
  cards: GroupedHandCard[];
  count: number;
  playableCount: number;
  drawnCount: number;
}

export const HAND_GROUP_ORDER: HandGroupId[] = ["red", "yellow", "green", "blue", "orange", "cyan", "purple", "pink", "wild"];

const VALUE_ORDER = new Map<CardValue, number>([
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, 7],
  [8, 8],
  [9, 9],
  ["skip", 10],
  ["reverse", 11],
  ["draw2", 12],
  ["draw5", 13],
  ["flip", 14],
  ["wild", 15],
  ["wild3", 16],
  ["wild4", 17],
  ["wildColor", 18]
]);

export function shouldUseGroupedHand(cardCount: number, isNarrow: boolean): boolean {
  return cardCount > (isNarrow ? 12 : 18);
}

export function groupHand(snapshot: GameSnapshot, actionLocked = false): HandGroup[] {
  const hand = snapshot.self?.hand ?? [];
  const drawnCardId = snapshot.self?.drawnCardId;
  const groups = new Map<HandGroupId, GroupedHandCard[]>();

  for (const id of HAND_GROUP_ORDER) {
    groups.set(id, []);
  }

  for (const card of hand) {
    const id = card.color ?? "wild";
    groups.get(id)?.push({
      card,
      playable: !actionLocked && canPlayCard(snapshot, card),
      drawn: card.id === drawnCardId
    });
  }

  return HAND_GROUP_ORDER.map((id) => {
    const cards = [...(groups.get(id) ?? [])].sort(compareGroupedCards);
    return {
      id,
      cards,
      count: cards.length,
      playableCount: cards.filter((item) => item.playable).length,
      drawnCount: cards.filter((item) => item.drawn).length
    };
  });
}

function compareGroupedCards(left: GroupedHandCard, right: GroupedHandCard): number {
  if (left.playable !== right.playable) {
    return left.playable ? -1 : 1;
  }

  const valueDelta = valueRank(left.card.value) - valueRank(right.card.value);
  if (valueDelta !== 0) {
    return valueDelta;
  }

  return left.card.id.localeCompare(right.card.id);
}

function valueRank(value: CardValue): number {
  return VALUE_ORDER.get(value) ?? 99;
}
