import { describe, expect, it } from "vitest";
import type { Card, GameSnapshot, PublicPlayer } from "@congcard/shared";
import { diffSnapshots } from "../src/lib/events";
import { soundForEvent, TURN_ALERT_SOUND } from "../src/lib/sound";

function player(overrides: Partial<PublicPlayer> & { id: string }): PublicPlayer {
  return {
    nickname: overrides.id,
    avatarId: "sun",
    seat: 0,
    cardCount: 5,
    score: 0,
    connected: true,
    away: false,
    isHost: false,
    ready: false,
    calledOne: false,
    autoPlay: false,
    missedDisconnectedTurns: 0,
    ping: 0,
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
    settings: {
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
    },
    players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1 })],
    viewers: [],
    direction: 1,
    roundNumber: 1,
    drawPileCount: 80,
    actionLog: [],
    self: { id: "a", role: "player", hand: [] },
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

  it("prefers structured presentation events over log and card-count inference", () => {
    const prev = snapshot({ presentationEvents: [] });
    const next = snapshot({
      players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, cardCount: 11 })],
      presentationEvents: [{
        id: 7,
        seq: 7,
        kind: "penalty",
        targetIds: ["b"],
        amount: 6,
        level: 3,
        startsAt: 1_000,
        resolvesAt: 3_000
      }]
    });

    const penalties = diffSnapshots(prev, next).filter((event) => event.type === "penalty");
    expect(penalties).toHaveLength(1);
    expect(penalties[0]).toMatchObject({ count: 6, playerId: "b", startsAt: 1_000, resolvesAt: 3_000 });
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

  it("detects stack growth with capped pitch levels", () => {
    const prev = snapshot({ pendingStack: { kind: "draw2", targetPlayerId: "b", totalDraw: 2 } });
    const next = snapshot({ pendingStack: { kind: "draw2", targetPlayerId: "a", totalDraw: 10 } });

    expect(diffSnapshots(prev, next).find((event) => event.type === "stack")).toMatchObject({
      totalDraw: 10,
      level: 5
    });
  });

  it("detects repeated same-value plays as a rising pitch chain", () => {
    const prev = snapshot({
      discardTop: card({ id: "top-red-5", color: "red", value: 5 }),
      actionLog: [{ seq: 1, type: "play", message: "A played red 5.", at: 1 }]
    });
    const next = snapshot({
      discardTop: card({ id: "top-blue-5", color: "blue", value: 5 }),
      actionLog: [
        { seq: 1, type: "play", message: "A played red 5.", at: 1 },
        { seq: 2, type: "play", message: "B played blue 5.", at: 2 }
      ]
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "matchChain")).toMatchObject({
      value: 5,
      level: 2
    });
  });

  it("raises action sound level for repeated icon cards", () => {
    const prev = snapshot({
      discardTop: card({ id: "top-red-reverse", color: "red", value: "reverse" }),
      actionLog: [
        { seq: 1, type: "play", message: "A played red reverse.", at: 1 },
        { seq: 2, type: "reverse", message: "Turn direction changed.", at: 2 }
      ]
    });
    const next = snapshot({
      direction: -1,
      discardTop: card({ id: "top-blue-reverse", color: "blue", value: "reverse" }),
      actionLog: [
        { seq: 1, type: "play", message: "A played red reverse.", at: 1 },
        { seq: 2, type: "reverse", message: "Turn direction changed.", at: 2 },
        { seq: 3, type: "play", message: "B played blue reverse.", at: 3 },
        { seq: 4, type: "reverse", message: "Turn direction changed.", at: 4 }
      ]
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "reverse")).toMatchObject({
      direction: -1,
      level: 2
    });
  });

  it("detects auto-resolved stack growth from the action log", () => {
    const prev = snapshot({ actionLog: [{ seq: 1, type: "round", message: "Round 1 started.", at: 1 }] });
    const next = snapshot({
      actionLog: [
        { seq: 1, type: "round", message: "Round 1 started.", at: 1 },
        { seq: 2, type: "draw", message: "Ben must stack or draw 8 cards.", at: 2 },
        { seq: 3, type: "draw", message: "Ben drew 8 stacked cards.", at: 3 }
      ]
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "stack")).toMatchObject({
      totalDraw: 8,
      level: 4
    });
  });

  it("detects when you win a round or game", () => {
    const prev = snapshot({});
    const next = snapshot({
      phase: "gameEnd",
      roundWinnerId: "a",
      gameWinnerId: "a"
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "roundWon")).toMatchObject({
      winnerId: "a",
      nickname: "a",
      gameEnd: true
    });
  });

  it("detects when another player wins while you are playing", () => {
    const prev = snapshot({});
    const next = snapshot({
      phase: "roundEnd",
      roundWinnerId: "b"
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "roundLost")).toMatchObject({
      winnerId: "b",
      nickname: "b",
      gameEnd: false
    });
  });

  it("does not play a loss sound for spectators", () => {
    const prev = snapshot({ self: { id: "viewer", role: "spectator", hand: [] } });
    const next = snapshot({
      phase: "roundEnd",
      roundWinnerId: "b",
      self: { id: "viewer", role: "spectator", hand: [] }
    });

    expect(diffSnapshots(prev, next).map((event) => event.type)).not.toContain("roundLost");
  });

  it("maps awareness events to sounds", () => {
    expect(soundForEvent({ id: 1, type: "yourTurn" })).toBe("turn");
    expect(TURN_ALERT_SOUND).toBe("turnAlert");
    expect(
      soundForEvent({ id: 2, type: "catchWindow", playerId: "a", nickname: "Ava", self: true, opensAt: 10, deadline: 20 })
    ).toBe("oneWindow");
    expect(
      soundForEvent({ id: 3, type: "catchWindow", playerId: "b", nickname: "Ben", self: false, opensAt: 10, deadline: 20 })
    ).toBe("catch");
    expect(soundForEvent({ id: 4, type: "colorChange", color: "blue" })).toBe("wild");
    expect(soundForEvent({ id: 5, type: "stack", totalDraw: 4, level: 2 })).toBe("stack");
    expect(soundForEvent({ id: 6, type: "matchChain", value: 7, level: 3 })).toBe("matchChain");
    expect(soundForEvent({ id: 7, type: "calledOne", nickname: "Ava" })).toBe("oneCalled");
    expect(soundForEvent({ id: 8, type: "penalty", playerId: "a", nickname: "Ava", count: 2, self: true })).toBe("penalty");
    expect(soundForEvent({ id: 9, type: "skip" })).toBe("skip");
    expect(soundForEvent({ id: 10, type: "reverse", direction: -1 })).toBe("reverse");
    expect(soundForEvent({ id: 11, type: "roundWon", winnerId: "a", nickname: "Ava", gameEnd: true })).toBe("win");
    expect(soundForEvent({ id: 12, type: "roundLost", winnerId: "b", nickname: "Ben", gameEnd: false })).toBe("lose");
  });
});
