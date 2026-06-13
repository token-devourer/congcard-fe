import { describe, expect, it } from "vitest";
import type { Card, GameSnapshot } from "@congcard/shared";
import { canPlayCard, playableCardInHand } from "../src/lib/rules";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const hand = [card("red-1", "red", 1), card("blue-5", "blue", 5), card("blue-2", "blue", 2), card("wild", null, "wild")];
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

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(true);
    expect(canPlayCard(state, state.self!.hand[1]!)).toBe(true);
    expect(canPlayCard(state, state.self!.hand[3]!)).toBe(true);
    expect(canPlayCard(state, state.self!.hand[2]!)).toBe(false);
  });

  it("blocks actions when it is not my turn", () => {
    const state = snapshot({ currentPlayerId: "other" });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
  });

  it("blocks stale or non-owned card references", () => {
    const state = snapshot();

    expect(canPlayCard(state, card("red-9", "red", 9))).toBe(false);
    expect(playableCardInHand(state, card("red-9", "red", 9))).toBeNull();
  });

  it("blocks card actions while a One call is pending arbitration", () => {
    const state = snapshot({ oneWindow: { playerId: "other", opensAt: 1, deadline: 2, callPending: true, callResolvesAt: 3 } });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
    expect(playableCardInHand(state, state.self!.hand[0]!)).toBeNull();
  });

  it("allows only the drawn card while resolving a draw", () => {
    const state = snapshot({ self: { id: "me", hand: [card("red-1", "red", 1), card("blue-5", "blue", 5)], drawnCardId: "blue-5" } });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
    expect(canPlayCard(state, state.self!.hand[1]!)).toBe(true);
  });
});
