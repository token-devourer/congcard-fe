import { randomBytes } from "node:crypto";
import type { Card, CardValue, Color, FlipSide, GameMode, OpponentCardFace, TurnContext, VisibleCardFace } from "@congcard/shared";
import { DARK_COLORS, LIGHT_COLORS } from "@congcard/shared";
import { shuffleCards } from "./standard.js";
import { config } from "../../config.js";

interface FlipFace {
  color: Color | null;
  value: CardValue;
}

export interface FlipCardInternal extends Card {
  flipFaces?: Record<FlipSide, FlipFace>;
  trackingId?: string;
}

// Default mapping preserved for readability; will be randomized per deck build.
const DEFAULT_DARK_FOR_LIGHT: Record<(typeof LIGHT_COLORS)[number], (typeof DARK_COLORS)[number]> = {
  red: "orange",
  yellow: "cyan",
  green: "purple",
  blue: "pink"
};

function opaqueId(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString("base64url")}`;
}

function pairedCard(deckIndex: number, light: FlipFace, dark: FlipFace): FlipCardInternal {
  return {
    id: opaqueId("flip"),
    trackingId: opaqueId("back"),
    deckIndex,
    color: light.color,
    value: light.value,
    side: "light",
    flipFaces: { light, dark }
  };
}

export function buildFlipDeckBox(deckIndex: number): Card[] {
  const randomizePairs = process.env.NODE_ENV === "production" || config.nodeEnv === "production" || config.randomizeFlipPairs;

  if (!randomizePairs) {
    const cards: FlipCardInternal[] = [];
    for (const lightColor of LIGHT_COLORS) {
      const darkColor = DEFAULT_DARK_FOR_LIGHT[lightColor];
      cards.push(pairedCard(deckIndex, { color: lightColor, value: 0 }, { color: darkColor, value: 0 }));
      for (let value = 1; value <= 9; value += 1) {
        for (let copy = 0; copy < 2; copy += 1) {
          cards.push(
            pairedCard(
              deckIndex,
              { color: lightColor, value: value as CardValue },
              { color: darkColor, value: value as CardValue }
            )
          );
        }
      }

      const pairs: Array<[CardValue, CardValue]> = [
        ["skip", "skip"],
        ["reverse", "reverse"],
        ["draw2", "draw5"],
        ["flip", "flip"]
      ];
      for (const [lightValue, darkValue] of pairs) {
        for (let copy = 0; copy < 2; copy += 1) {
          cards.push(
            pairedCard(
              deckIndex,
              { color: lightColor, value: lightValue },
              { color: darkColor, value: darkValue }
            )
          );
        }
      }
    }

    for (let copy = 0; copy < 4; copy += 1) {
      cards.push(pairedCard(deckIndex, { color: null, value: "wild" }, { color: null, value: "wild" }));
      cards.push(pairedCard(deckIndex, { color: null, value: "wild3" }, { color: null, value: "wildColor" }));
    }

    return cards;
  }

  const lightFaces: FlipFace[] = [];
  for (const lightColor of LIGHT_COLORS) {
    lightFaces.push({ color: lightColor, value: 0 });
    for (let value = 1; value <= 9; value += 1) {
      lightFaces.push({ color: lightColor, value: value as CardValue });
      lightFaces.push({ color: lightColor, value: value as CardValue });
    }
    for (const action of ["skip", "reverse", "draw2", "flip"] as const) {
      lightFaces.push({ color: lightColor, value: action });
      lightFaces.push({ color: lightColor, value: action });
    }
  }
  for (let copy = 0; copy < 4; copy += 1) {
    lightFaces.push({ color: null, value: "wild" });
    lightFaces.push({ color: null, value: "wild3" });
  }

  const darkFaces: FlipFace[] = [];
  for (const darkColor of DARK_COLORS) {
    darkFaces.push({ color: darkColor, value: 0 });
    for (let value = 1; value <= 9; value += 1) {
      darkFaces.push({ color: darkColor, value: value as CardValue });
      darkFaces.push({ color: darkColor, value: value as CardValue });
    }
    for (const action of ["skip", "reverse", "draw5", "flip"] as const) {
      darkFaces.push({ color: darkColor, value: action });
      darkFaces.push({ color: darkColor, value: action });
    }
  }
  for (let copy = 0; copy < 4; copy += 1) {
    darkFaces.push({ color: null, value: "wild" });
    darkFaces.push({ color: null, value: "wildColor" });
  }

  const shuffledDarkFaces = shuffleCards(darkFaces);
  const darkWildFaces = shuffledDarkFaces.filter((face) => face.value === "wild" || face.value === "wildColor");
  const darkNonWildFaces = shuffledDarkFaces.filter((face) => face.value !== "wild" && face.value !== "wildColor");
  const darkFlipSafeFaces = darkNonWildFaces.filter((face) => face.value !== "flip");
  const darkFlipFaces = darkNonWildFaces.filter((face) => face.value === "flip");

  const lightFlipCount = lightFaces.reduce((count, face) => (face.value === "flip" ? count + 1 : count), 0);
  const reservedForFlip = darkFlipSafeFaces.slice(0, lightFlipCount);
  const remainderForOthers = shuffleCards([...darkFlipSafeFaces.slice(lightFlipCount), ...darkFlipFaces, ...darkWildFaces]);

  const cards: FlipCardInternal[] = [];
  let flipIndex = 0;
  let otherIndex = 0;
  for (const light of lightFaces) {
    const dark = light.value === "flip" ? reservedForFlip[flipIndex++] : remainderForOthers[otherIndex++];
    cards.push(pairedCard(deckIndex, light, dark!));
  }

  return cards;
}

export function applyFlipSide(card: Card, side: FlipSide): void {
  const faces = (card as FlipCardInternal).flipFaces;
  if (!faces) return;
  card.color = faces[side].color;
  card.value = faces[side].value;
  card.side = side;
}

export function publicCard(card: Card): Card {
  return { id: card.id, color: card.color, value: card.value, deckIndex: card.deckIndex, ...(card.side ? { side: card.side } : {}) };
}

export function visibleCardFace(card: Card): VisibleCardFace {
  return { color: card.color, value: card.value, ...(card.side ? { side: card.side } : {}) };
}

export function oppositeCardFace(card: Card, activeSide: FlipSide): OpponentCardFace | undefined {
  const internal = card as FlipCardInternal;
  const face = internal.flipFaces?.[activeSide === "light" ? "dark" : "light"];
  if (!face || !internal.trackingId) return undefined;
  return {
    trackingId: internal.trackingId,
    color: face.color,
    value: face.value,
    side: activeSide === "light" ? "dark" : "light"
  };
}

export function flipColors(side: FlipSide): readonly Color[] {
  return side === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

function isPlayable(card: Card, ctx: TurnContext): boolean {
  return card.color === null || card.color === ctx.activeColor || card.value === ctx.discardTop.value;
}

export const flipMode: GameMode = {
  id: "flip",
  initialHandSize: 7,
  buildDeck(_playerCount, deckBoxes) {
    const cards: Card[] = [];
    for (let deckIndex = 0; deckIndex < (deckBoxes ?? 1); deckIndex += 1) {
      cards.push(...buildFlipDeckBox(deckIndex));
    }
    return shuffleCards(cards);
  },
  isPlayable,
  scoreHand(hand) {
    return hand.reduce((score, card) => {
      if (typeof card.value === "number") return score + card.value;
      if (["wild", "wild3", "wildColor"].includes(String(card.value))) return score + 50;
      return score + 20;
    }, 0);
  },
  allowedOutOfTurnActions() {
    return ["catchOne", "challenge"];
  }
};
