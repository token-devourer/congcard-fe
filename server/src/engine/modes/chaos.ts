import type { ActiveChaosSpecialValue, Card, CardValue, Color, GameMode, TurnContext } from "@congcard/shared";
import { ACTIVE_CHAOS_SPECIAL_VALUES, LIGHT_COLORS } from "@congcard/shared";
import { shuffleCards } from "./standard.js";

const CHAOS_SPECIALS = ACTIVE_CHAOS_SPECIAL_VALUES;

function numberCards(color: Color, deckIndex: number): Card[] {
  const cards: Card[] = [{ id: `${deckIndex}-${color}-0-0`, color, value: 0, deckIndex }];

  for (let value = 1; value <= 9; value += 1) {
    cards.push({ id: `${deckIndex}-${color}-${value}-0`, color, value: value as CardValue, deckIndex });
    cards.push({ id: `${deckIndex}-${color}-${value}-1`, color, value: value as CardValue, deckIndex });
  }

  return cards;
}

function actionCards(color: Color, deckIndex: number): Card[] {
  return ["skip", "reverse", "draw1", "throwup"].flatMap((value) =>
    [0, 1].map((copy) => ({
      id: `${deckIndex}-${color}-${value}-${copy}`,
      color,
      value: value as CardValue,
      deckIndex
    }))
  );
}

function wildCards(deckIndex: number): Card[] {
  return ["wild", "wild2"].flatMap((value) =>
    [0, 1, 2, 3].map((copy) => ({
      id: `${deckIndex}-wild-${value}-${copy}`,
      color: null,
      value: value as CardValue,
      deckIndex
    }))
  );
}

function specialCards(deckIndex: number): Card[] {
  return CHAOS_SPECIALS.map((value) => ({
    id: `${deckIndex}-special-${value}-0`,
    color: null,
    value,
    deckIndex
  }));
}

export function buildChaosDeckBox(deckIndex: number): Card[] {
  const cards: Card[] = [];

  for (const color of LIGHT_COLORS) {
    cards.push(...numberCards(color, deckIndex));
    cards.push(...actionCards(color, deckIndex));
  }

  cards.push(...wildCards(deckIndex));
  cards.push(...specialCards(deckIndex));
  return cards;
}

function isChaosSpecial(value: CardValue): value is ActiveChaosSpecialValue {
  return CHAOS_SPECIALS.includes(value as ActiveChaosSpecialValue);
}

function isPlayable(card: Card, ctx: TurnContext): boolean {
  if (card.color === null) {
    return card.value === "wild" || card.value === "wild2" || isChaosSpecial(card.value);
  }

  if (ctx.discardTop.color === null && isChaosSpecial(ctx.discardTop.value)) {
    return true;
  }

  return card.color === ctx.activeColor || card.value === ctx.discardTop.value;
}

export const chaosMode: GameMode = {
  id: "chaos",
  initialHandSize: 7,
  buildDeck(_playerCount, deckBoxes) {
    const cards: Card[] = [];
    for (let deckIndex = 0; deckIndex < (deckBoxes ?? 1); deckIndex += 1) {
      cards.push(...buildChaosDeckBox(deckIndex));
    }
    return shuffleCards(cards);
  },
  isPlayable,
  scoreHand(hand) {
    return hand.reduce((score, card) => {
      if (typeof card.value === "number") return score + card.value;
      if (card.value === "wild" || card.value === "wild2") return score + 50;
      return score + 20;
    }, 0);
  },
  allowedOutOfTurnActions() {
    return ["catchOne", "challenge"];
  }
};

export function isChaosSpecialValue(value: CardValue): boolean {
  return isChaosSpecial(value);
}
