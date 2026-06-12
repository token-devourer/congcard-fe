import { describe, expect, it } from "vitest";
import type { Card, GameSnapshot } from "@kartu-satu/shared";
import { canPlayCard } from "../src/lib/rules";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const hand = [card("red-1", "red", 1), card("blue-5", "blue", 5), card("wild", null, "wild")];
  return {
    seq: 1,
    code: "ABC123",
    phase: "playing",
    settings: { modeId: "standard", maxPlayers: 10, turnTimeoutSec: 30, scoreTarget: 0, modeOptions: {} },
    players: [],
    self: { id: "me", hand },
    discardTop: card("top", "green", 5),
    activeColor: "red",
    direction: 1,
    currentPlayerId: "me",
    roundNumber: 1,
    drawPileCount: 20,
    actionLog: [],
    ...overrides
  };
}

describe("client rules", () => {
  it("allows matching color, matching value, and wild cards", () => {
    const state = snapshot();

    expect(canPlayCard(state, card("red-9", "red", 9))).toBe(true);
    expect(canPlayCard(state, card("blue-5", "blue", 5))).toBe(true);
    expect(canPlayCard(state, card("wild", null, "wild"))).toBe(true);
    expect(canPlayCard(state, card("blue-2", "blue", 2))).toBe(false);
  });

  it("blocks actions when it is not my turn", () => {
    const state = snapshot({ currentPlayerId: "other" });

    expect(canPlayCard(state, card("red-9", "red", 9))).toBe(false);
  });
});
