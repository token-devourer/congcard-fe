import { describe, expect, it } from "vitest";
import type { Card, GameSnapshot, PublicPlayer } from "@congcard/shared";
import { diffSnapshots } from "../src/lib/events";
import { soundForEvent } from "../src/lib/sound";

function player(overrides: Partial<PublicPlayer> & { id: string }): PublicPlayer {
  return {
    nickname: overrides.id,
    avatarId: "sun",
    seat: 0,
    cardCount: 5,
    score: 0,
    connected: true,
    isHost: false,
    ready: false,
    calledOne: false,
    ...overrides
  };
}

function card(overrides: Partial<Card> & { id: string }): Card {
  return { color: "red", value: 5, deckIndex: 0, ...overrides };
}

function snapshot(overrides: Partial<GameSnapshot>): GameSnapshot {
  return {
    seq: 1,
    code: "ABC123",
    phase: "playing",
    settings: { modeId: "standard", maxPlayers: 10, turnTimeoutSec: 30, scoreTarget: 0, modeOptions: {} },
    players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1 })],
    direction: 1,
    roundNumber: 1,
    drawPileCount: 80,
    actionLog: [],
    self: { id: "a", hand: [] },
    discardTop: card({ id: "top-1" }),
    activeColor: "red",
    currentPlayerId: "a",
    ...overrides
  };
}

describe("diffSnapshots", () => {
  it("returns nothing without a previous snapshot", () => {
    expect(diffSnapshots(null, snapshot({}))).toEqual([]);
  });

  it("detects a penalty when a player's card count jumps by two or more", () => {
    const prev = snapshot({});
    const next = snapshot({
      players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, cardCount: 9 })]
    });

    const events = diffSnapshots(prev, next);
    const penalty = events.find((event) => event.type === "penalty");
    expect(penalty).toMatchObject({ playerId: "b", count: 4, self: false });
  });

  it("marks a penalty against yourself as self", () => {
    const prev = snapshot({});
    const next = snapshot({
      players: [player({ id: "a", seat: 0, cardCount: 7 }), player({ id: "b", seat: 1 })]
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "penalty")).toMatchObject({
      playerId: "a",
      self: true
    });
  });

  it("does not emit penalties when a new round deals hands", () => {
    const prev = snapshot({ roundNumber: 1 });
    const next = snapshot({
      roundNumber: 2,
      players: [player({ id: "a", seat: 0, cardCount: 7 }), player({ id: "b", seat: 1, cardCount: 7 })]
    });

    expect(diffSnapshots(prev, next).filter((event) => event.type === "penalty")).toEqual([]);
  });

  it("detects skip, reverse, and wild color change from the discard top", () => {
    const prev = snapshot({});
    const next = snapshot({
      discardTop: card({ id: "top-2", color: null, value: "wild" }),
      activeColor: "blue",
      direction: -1
    });

    const types = diffSnapshots(prev, next).map((event) => event.type);
    expect(types).toContain("reverse");
    expect(types).toContain("colorChange");

    const skipped = diffSnapshots(prev, snapshot({ discardTop: card({ id: "top-3", value: "skip" }) }));
    expect(skipped.map((event) => event.type)).toContain("skip");
  });

  it("detects a real ONE call but not the flip caused by being caught", () => {
    const prev = snapshot({});
    const called = snapshot({
      players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, calledOne: true, cardCount: 1 })]
    });
    expect(diffSnapshots(prev, called).map((event) => event.type)).toContain("calledOne");

    // catchOne deals 2 penalty cards and then sets calledOne, so no celebration.
    const caught = snapshot({
      players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, calledOne: true, cardCount: 3 })]
    });
    expect(diffSnapshots(prev, caught).map((event) => event.type)).not.toContain("calledOne");
  });

  it("announces your turn when the current player becomes you", () => {
    const prev = snapshot({ currentPlayerId: "b" });
    const next = snapshot({ currentPlayerId: "a" });

    expect(diffSnapshots(prev, next).map((event) => event.type)).toContain("yourTurn");
    expect(diffSnapshots(next, snapshot({ currentPlayerId: "a", seq: 2 })).map((event) => event.type)).not.toContain(
      "yourTurn"
    );
  });

  it("detects an opened catch window", () => {
    const prev = snapshot({});
    const next = snapshot({
      players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, cardCount: 1 })],
      oneWindow: { playerId: "b", opensAt: 100, deadline: 123 }
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "catchWindow")).toMatchObject({
      playerId: "b",
      self: false,
      opensAt: 100,
      deadline: 123
    });
  });

  it("ignores stale catch windows for players who no longer have one card", () => {
    const prev = snapshot({});
    const stale = snapshot({ oneWindow: { playerId: "b", opensAt: 100, deadline: 123 } });

    expect(diffSnapshots(prev, stale).map((event) => event.type)).not.toContain("catchWindow");
  });

  it("maps awareness events to sounds", () => {
    expect(soundForEvent({ id: 1, type: "yourTurn" })).toBe("turn");
    expect(
      soundForEvent({ id: 2, type: "catchWindow", playerId: "a", nickname: "Ava", self: true, opensAt: 10, deadline: 20 })
    ).toBe("oneWindow");
    expect(
      soundForEvent({ id: 3, type: "catchWindow", playerId: "b", nickname: "Ben", self: false, opensAt: 10, deadline: 20 })
    ).toBe("catch");
    expect(soundForEvent({ id: 4, type: "colorChange", color: "blue" })).toBe("wild");
    expect(soundForEvent({ id: 5, type: "calledOne", nickname: "Ava" })).toBe("oneCalled");
    expect(soundForEvent({ id: 6, type: "penalty", playerId: "a", nickname: "Ava", count: 2, self: true })).toBe("penalty");
    expect(soundForEvent({ id: 7, type: "skip" })).toBe("skip");
    expect(soundForEvent({ id: 8, type: "reverse", direction: -1 })).toBe("reverse");
  });
});
