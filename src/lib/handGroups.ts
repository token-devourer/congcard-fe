import type { Card, CardValue, Color, GameSnapshot } from "@congcard/shared";
import { canPlayCard, isSpecialValue } from "./rules";

export type HandGroupId = Color | "special" | "wild";

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

export const HAND_GROUP_ORDER: HandGroupId[] = ["red", "yellow", "green", "blue", "orange", "cyan", "purple", "pink", "special", "wild"];

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
  ["draw1", 12],
  ["draw2", 13],
  ["draw5", 14],
  ["throwup", 15],
  ["flip", 16],
  ["wild", 17],
  ["wild2", 18],
  ["wild3", 19],
  ["wild4", 20],
  ["wildColor", 21],
  ["flashbang", 22],
  ["steal", 23],
  ["favor", 24],
  ["peek", 25],
  ["timeskip", 26],
  ["nuke", 27]
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
    const id = groupIdForCard(card);
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

function groupIdForCard(card: Card): HandGroupId {
  if (!card.color && isSpecialValue(card.value)) {
    return "special";
  }

  return card.color ?? "wild";
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
