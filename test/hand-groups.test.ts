import { describe, expect, it } from "vitest";
import type { Card, GameSnapshot, RoomSettings } from "@congcard/shared";
import { groupHand, shouldUseGroupedHand } from "../src/lib/handGroups";

const settings: RoomSettings = {
  modeId: "standard",
  maxPlayers: 10,
  turnTimeoutSec: 30,
  scoreTarget: 0,
  allowMidGameJoin: true,
  jumpInEnabled: false,
  stackingEnabled: false,
  challengeEnabled: true,
  callEnabled: true,
  batchEnabled: false,
  keyboardShortcutsEnabled: true,
  absentPlayerAction: "draw",
  autoPlayCallOne: false,
  deckBoxes: 1,
  modeOptions: {}
};

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function snapshot(hand: Card[], overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    seq: 1,
    code: "ABC123",
    phase: "playing",
    settings,
    players: [],
    viewers: [],
    self: { id: "me", role: "player", hand },
    discardTop: card("top", "red", 7),
    activeColor: "red",
    direction: 1,
    currentPlayerId: "me",
    roundNumber: 1,
    drawPileCount: 20,
    actionLog: [],
    ...overrides
  };
}

describe("groupHand", () => {
  it("sorts cards into stable color piles", () => {
    const state = snapshot([
      card("wild", null, "wild"),
      card("blue-2", "blue", 2),
      card("red-1", "red", 1),
      card("green-3", "green", 3),
      card("yellow-4", "yellow", 4)
    ]);

    expect(groupHand(state).map((group) => group.id)).toEqual(["red", "yellow", "green", "blue", "wild"]);
  });

  it("orders playable cards before non-playable cards inside each pile", () => {
    const state = snapshot(
      [card("red-9", "red", 9), card("red-2", "red", 2), card("red-7", "red", 7), card("red-skip", "red", "skip")],
      { activeColor: "blue" }
    );

    expect(groupHand(state)[0]?.cards.map((item) => item.card.id)).toEqual(["red-7", "red-2", "red-9", "red-skip"]);
  });

  it("sorts numbers before actions after playability", () => {
    const state = snapshot(
      [
        card("blue-reverse", "blue", "reverse"),
        card("blue-0", "blue", 0),
        card("blue-draw2", "blue", "draw2"),
        card("blue-skip", "blue", "skip")
      ],
      { activeColor: "blue" }
    );

    expect(groupHand(state)[3]?.cards.map((item) => item.card.value)).toEqual([0, "skip", "reverse", "draw2"]);
  });

  it("marks drawn cards inside their group", () => {
    const drawn = card("red-drawn", "red", 7);
    const state = snapshot([drawn], { self: { id: "me", role: "player", hand: [drawn], drawnCardId: drawn.id } });

    expect(groupHand(state)[0]).toMatchObject({ drawnCount: 1 });
  });
});

describe("shouldUseGroupedHand", () => {
  it("uses larger desktop and smaller mobile thresholds", () => {
    expect(shouldUseGroupedHand(18, false)).toBe(false);
    expect(shouldUseGroupedHand(19, false)).toBe(true);
    expect(shouldUseGroupedHand(12, true)).toBe(false);
    expect(shouldUseGroupedHand(13, true)).toBe(true);
  });
});
