import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Card, GameSnapshot, PublicPlayer } from "@congcard/shared";
import { useRoomStore } from "../src/lib/store";

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

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
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

describe("room store event action lock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    useRoomStore.getState().reset();
  });

  afterEach(() => {
    useRoomStore.getState().reset();
    vi.useRealTimers();
  });

  it("locks local actions briefly for major events", () => {
    useRoomStore.getState().setSnapshot(snapshot({}));
    useRoomStore.getState().setSnapshot(
      snapshot({
        discardTop: card({ id: "top-2", value: "skip" })
      })
    );

    expect(useRoomStore.getState().eventLockUntil).toBe(1700);
  });

  it("does not lock local actions for passive awareness events", () => {
    useRoomStore.getState().setSnapshot(snapshot({}));
    useRoomStore.getState().setSnapshot(
      snapshot({
        players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, calledOne: true, cardCount: 1 })]
      })
    );

    expect(useRoomStore.getState().eventLockUntil).toBe(0);
  });
});
