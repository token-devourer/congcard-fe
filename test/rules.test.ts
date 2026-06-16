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
    settings: {
      modeId: "standard",
      maxPlayers: 10,
      turnTimeoutSec: 30,
      scoreTarget: 0,
      allowMidGameJoin: true,
      jumpInEnabled: false,
      stackingEnabled: false,
      challengeEnabled: true,
      deckBoxes: 1,
      modeOptions: {}
    },
    players: [],
    viewers: [],
    self: { id: "me", role: "player", hand },
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

  it("blocks card actions while a One window is active", () => {
    const state = snapshot({ oneWindow: { playerId: "other", opensAt: 1, deadline: 2 } });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
    expect(playableCardInHand(state, state.self!.hand[0]!)).toBeNull();
  });

  it("allows only the drawn card while resolving a draw", () => {
    const state = snapshot({
      self: { id: "me", role: "player", hand: [card("red-1", "red", 1), card("blue-5", "blue", 5)], drawnCardId: "blue-5" }
    });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
    expect(canPlayCard(state, state.self!.hand[1]!)).toBe(true);
  });

  it("allows an exact matching jump in when enabled", () => {
    const state = snapshot({
      currentPlayerId: "other",
      settings: { ...snapshot().settings, jumpInEnabled: true },
      self: { id: "me", role: "player", hand: [card("jump-red-5", "red", 5)] },
      discardTop: card("top-red-5", "red", 5)
    });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(true);
  });

  it("allows only matching stack cards during a draw stack", () => {
    const state = snapshot({
      currentPlayerId: "me",
      pendingStack: { kind: "draw2", targetPlayerId: "me", totalDraw: 2 },
      self: { id: "me", role: "player", hand: [card("blue-draw2", "blue", "draw2"), card("wild4", null, "wild4")] }
    });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(true);
    expect(canPlayCard(state, state.self!.hand[1]!)).toBe(false);
  });

  it("allows the first Wild +4 challenge target to stack while the challenge is open", () => {
    const state = snapshot({
      currentPlayerId: "me",
      pendingChallenge: { offenderId: "other", challengerId: "me", declaredColor: "blue", guilty: false },
      pendingStack: { kind: "wild4", targetPlayerId: "me", totalDraw: 4, challengeable: true, offenderId: "other" },
      self: { id: "me", role: "player", hand: [card("wild4", null, "wild4"), card("blue-2", "blue", 2)] }
    });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(true);
    expect(canPlayCard(state, state.self!.hand[1]!)).toBe(false);
  });

  it("allows exact matching Jump In during a pending draw stack", () => {
    const state = snapshot({
      currentPlayerId: "other",
      settings: { ...snapshot().settings, jumpInEnabled: true, stackingEnabled: true },
      pendingStack: { kind: "draw2", targetPlayerId: "other", totalDraw: 4 },
      self: { id: "me", role: "player", hand: [card("jump-blue-draw2", "blue", "draw2"), card("wild4", null, "wild4")] },
      discardTop: card("top-blue-draw2", "blue", "draw2")
    });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(true);
    expect(canPlayCard(state, state.self!.hand[1]!)).toBe(false);
  });

  it("blocks player actions while the game is paused", () => {
    const state = snapshot({ pauseReason: "notEnoughAvailablePlayers" });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
  });

  it("blocks spectator and waiting actions", () => {
    const state = snapshot({ self: { id: "viewer", role: "waiting", hand: [] } });

    expect(canPlayCard(state, card("red-1", "red", 1))).toBe(false);
    expect(playableCardInHand(state, card("red-1", "red", 1))).toBeNull();
  });

  it("blocks finished Last Stand players from taking actions", () => {
    const state = snapshot({
      settings: { ...snapshot().settings, scoreTarget: "lastStand" },
      players: [
        {
          id: "me",
          nickname: "Me",
          avatarId: "sun",
          seat: 0,
          cardCount: 0,
          score: 0,
          connected: true,
          away: false,
          isHost: false,
          ready: false,
          calledOne: false,
          autoPlay: false,
          missedDisconnectedTurns: 0,
          finishedRank: 1
        }
      ]
    });

    expect(canPlayCard(state, state.self!.hand[0]!)).toBe(false);
  });
});
