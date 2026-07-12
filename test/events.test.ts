import { describe, expect, it } from "vitest";
import type { Card, ChaosEffectKind, GameSnapshot, PendingChaosPhase, PublicPlayer } from "@congcard/shared";
import { chaosTextMode, eventToastDurationMs, nukeDangerStage, selectActiveEvent } from "../src/components/GameEventOverlay";
import { nukePenaltyFlightCount, resolvedChaosGainPlayerIds } from "../src/components/FlightLayer";
import { diffSnapshots } from "../src/lib/events";
import { chaosSoundTimeline, soundForEvent, TURN_ALERT_SOUND } from "../src/lib/sound";
import { mergeVisibleUiEvents } from "../src/lib/store";

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

  it("maps chaos bust presentation events with enough duration for VFX", () => {
    const prev = snapshot({ presentationEvents: [] });
    const next = snapshot({
      players: [player({ id: "a", seat: 0 }), player({ id: "b", seat: 1, cardCount: 0, finishedRank: 1 })],
      presentationEvents: [{
        id: 9,
        seq: 9,
        kind: "chaosBust",
        targetIds: ["b"],
        amount: 26,
        startsAt: 2_000,
        resolvesAt: 6_800
      }]
    });

    const bust = diffSnapshots(prev, next).find((event) => event.type === "chaosBust");
    expect(bust).toMatchObject({ playerId: "b", nickname: "b", count: 26, self: false, startsAt: 2_000, resolvesAt: 6_800 });
    expect(eventToastDurationMs(bust!)).toBe(4_800);
  });

  it("uses only the server detonation window after the Nuke countdown", () => {
    const prev = snapshot({ presentationEvents: [] });
    const next = snapshot({
      presentationEvents: [{
        id: 10,
        seq: 10,
        kind: "chaos",
        chainId: 44,
        chaosKind: "nuke",
        phase: "detonating",
        targetIds: ["b"],
        startsAt: 41_000,
        resolvesAt: 43_800
      }]
    });

    const detonation = diffSnapshots(prev, next).find(
      (event) => event.type === "chaos" && event.kind === "nuke" && event.phase === "detonating"
    );

    expect(detonation).toBeDefined();
    expect(detonation).toMatchObject({ chainId: 44 });
    expect(eventToastDurationMs(detonation!)).toBe(2_800);
  });

  it("raises the Nuke danger stage as the countdown runs out", () => {
    expect([35_000, 25_000, 15_000, 8_000, 3_000].map(nukeDangerStage)).toEqual([0, 1, 2, 3, 4]);
  });

  it("maps dramatic Chaos metadata and follows the server duration", () => {
    const prev = snapshot({ presentationEvents: [] });
    const next = snapshot({
      presentationEvents: [{
        id: 11,
        seq: 11,
        kind: "chaos",
        chainId: 45,
        chaosKind: "throwup",
        phase: "sequence",
        actorId: "a",
        amount: 12,
        color: "red",
        startsAt: 2_000,
        resolvesAt: 4_180
      }]
    });

    const event = diffSnapshots(prev, next).find((item) => item.type === "chaos");
    expect(event).toMatchObject({ kind: "throwup", phase: "sequence", chainId: 45, actorId: "a", amount: 12, color: "red" });
    expect(eventToastDurationMs(event!)).toBe(2_180);
  });

  it("keeps each meme clip at its intended cinematic phase", () => {
    const chaosEvent = (kind: ChaosEffectKind, phase: PendingChaosPhase, targetIds?: string[], amount?: number) => ({
      id: 1,
      type: "chaos" as const,
      kind,
      phase,
      ...(targetIds ? { targetIds } : {}),
      ...(amount !== undefined ? { amount } : {})
    });

    expect(chaosSoundTimeline(chaosEvent("throwup", "sequence", undefined, 2)).filter((cue) => cue.sound === "memeThrowup")).toEqual([
      { sound: "memeThrowup", offsetMs: 650, level: 1 }
    ]);
    expect(chaosSoundTimeline(chaosEvent("steal", "opening")).some((cue) => cue.sound === "memeSteal")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("steal", "opening", ["b"])).some((cue) => cue.sound.startsWith("meme"))).toBe(false);
    expect(chaosSoundTimeline(chaosEvent("steal", "sequence")).some((cue) => cue.sound === "memeStealExecute")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("favor", "opening")).some((cue) => cue.sound === "memeFavor")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("favor", "opening", ["b"])).some((cue) => cue.sound === "memeFavorOpen")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("favor", "sequence")).some((cue) => cue.sound === "memeFavorExecute")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("peek", "opening")).some((cue) => cue.sound === "memePeek")).toBe(false);
    expect(chaosSoundTimeline(chaosEvent("peek", "reveal")).some((cue) => cue.sound === "memePeek")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("timeskip", "opening")).some((cue) => cue.sound === "memeTimeskip")).toBe(true);
    expect(chaosSoundTimeline(chaosEvent("timeskip", "autoplay", ["b", "c"]))).toEqual([
      { sound: "chaosTimeStep", offsetMs: 0, level: 1 },
      { sound: "chaosTimeStep", offsetMs: 1_000, level: 2 }
    ]);
    expect(chaosSoundTimeline(chaosEvent("timeskip", "sequence"))).toEqual([
      { sound: "chaosTimeReturn", offsetMs: 0, level: 1 }
    ]);
    expect(chaosSoundTimeline(chaosEvent("flashbang", "sequence"))).toEqual([
      { sound: "opening", offsetMs: 0, level: 1 },
      { sound: "chaosFlashbangCharge", offsetMs: 0, level: 1 },
      { sound: "memeFlashbang", offsetMs: 400, level: 1 },
      { sound: "chaosFlashbangImpact", offsetMs: 400, level: 1 },
      { sound: "chaosFlashbangSwap", offsetMs: 4_050, level: 1 }
    ]);
    expect(chaosSoundTimeline(chaosEvent("nuke", "opening"))).toEqual([
      { sound: "batchFinale", offsetMs: 0, level: 1 },
      { sound: "chaosNukeArm", offsetMs: 0, level: 1 },
      { sound: "memeNuke", offsetMs: 0, level: 1 }
    ]);
    expect(chaosSoundTimeline(chaosEvent("nuke", "countdown"))).toEqual([
      { sound: "memeNukeCountdown", offsetMs: 0, level: 1 },
      { sound: "chaosNukeCountdownBed", offsetMs: 0, level: 1 }
    ]);
    expect(chaosSoundTimeline(chaosEvent("nuke", "detonating"))).toEqual([
      { sound: "memeNukeDeath", offsetMs: 0, level: 1 },
      { sound: "chaosNukeDetonate", offsetMs: 0, level: 1 },
      { sound: "chaosNukeFinal", offsetMs: 1_900, level: 1 }
    ]);
  });

  it("replaces older phases from the same Chaos chain", () => {
    const opening = { id: 1, type: "chaos" as const, kind: "favor" as const, phase: "opening" as const, chainId: 71, actorId: "a" };
    const choice = { id: 2, type: "chaos" as const, kind: "favor" as const, phase: "chooseTarget" as const, chainId: 71, actorId: "a" };

    expect(mergeVisibleUiEvents([opening], [choice])).toEqual([choice]);
    expect(mergeVisibleUiEvents(
      [{ ...opening, chainId: undefined }],
      [{ ...choice, chainId: undefined }]
    )).toEqual([{ ...choice, chainId: undefined }]);
  });

  it("uses the newest phase and shows only one title per Chaos chain", () => {
    const opening = { id: 1, type: "chaos" as const, kind: "favor" as const, phase: "opening" as const, chainId: 8, actorId: "a", startsAt: 1_000 };
    const choice = { id: 2, type: "chaos" as const, kind: "favor" as const, phase: "chooseTarget" as const, chainId: 8, actorId: "a", startsAt: 2_000 };
    const targetOpening = { id: 3, type: "chaos" as const, kind: "favor" as const, phase: "opening" as const, chainId: 8, actorId: "a", targetIds: ["b"], startsAt: 3_000 };

    expect(selectActiveEvent([opening, choice])).toBe(choice);
    expect(chaosTextMode(opening)).toBe("opening");
    expect(chaosTextMode(choice)).toBe("prompt");
    expect(chaosTextMode(targetOpening)).toBe("none");
    expect(chaosTextMode({ ...opening, id: 4, kind: "flashbang", phase: "sequence" })).toBe("openingResult");
    expect(chaosTextMode({ ...opening, id: 5, kind: "nuke", phase: "detonating" })).toBe("result");
  });

  it("suppresses generic gain flights for Flashbang and creates Nuke penalty flights", () => {
    const flashbang = {
      id: 1,
      seq: 1,
      kind: "chaos" as const,
      chaosKind: "flashbang" as const,
      phase: "sequence" as const,
      targetIds: ["a", "b"],
      startsAt: 1_000,
      resolvesAt: 6_650
    };
    const nuke = {
      id: 2,
      seq: 2,
      kind: "chaos" as const,
      chaosKind: "nuke" as const,
      phase: "detonating" as const,
      targetIds: ["b"],
      amount: 17,
      startsAt: 7_000,
      resolvesAt: 9_800
    };

    expect(resolvedChaosGainPlayerIds([flashbang], 6_500, 6_700)).toEqual(["a", "b"]);
    expect(resolvedChaosGainPlayerIds([nuke], 9_700, 9_900)).toEqual(["b"]);
    expect(nukePenaltyFlightCount(nuke)).toBe(12);
    expect(nukePenaltyFlightCount(flashbang)).toBe(0);
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

  it("detects jump in from the latest out-of-turn play log", () => {
    const prev = snapshot({
      currentPlayerId: "a",
      discardTop: card({ id: "top-red-5", color: "red", value: 5 }),
      presentationEvents: []
    });
    const next = snapshot({
      currentPlayerId: "c",
      discardTop: card({ id: "top-blue-5", color: "blue", value: 5 }),
      presentationEvents: [
        {
          id: 2,
          seq: 2,
          kind: "cardPlayed",
          actorId: "b",
          cardValue: 5,
          startsAt: 1,
          resolvesAt: 2
        }
      ]
    });

    expect(diffSnapshots(prev, next).find((event) => event.type === "jumpIn")).toMatchObject({
      playerId: "b",
      nickname: "b",
      self: false
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
    expect(soundForEvent({ id: 11, type: "jumpIn", playerId: "b", nickname: "Ben", self: false })).toBe("jumpIn");
    expect(soundForEvent({ id: 12, type: "chaosBust", playerId: "b", nickname: "Ben", count: 26, self: false })).toBe("chaosBust");
    expect(soundForEvent({ id: 13, type: "roundWon", winnerId: "a", nickname: "Ava", gameEnd: true })).toBe("win");
    expect(soundForEvent({ id: 14, type: "roundLost", winnerId: "b", nickname: "Ben", gameEnd: false })).toBe("lose");
  });

  it("announces the total drawn when a Wild Draw Color hunt clears", () => {
    const prev = snapshot({
      presentationEvents: [],
      pendingDraw: { playerId: "b", reason: "colorHunt", mode: "auto", drawnCount: 9, targetColor: "cyan", requiredMatches: 1, matchesFound: 1 }
    });
    const next = snapshot({ presentationEvents: [] });

    const result = diffSnapshots(prev, next).find((event) => event.type === "drawResult");
    expect(result).toMatchObject({ type: "drawResult", playerId: "b", count: 9, color: "cyan", self: false });
    expect(soundForEvent(result!)).toBe("penalty");
  });

  it("does not announce a draw result mid-hunt or for ordinary draws", () => {
    const hunt = { playerId: "b", reason: "colorHunt", mode: "auto", targetColor: "cyan", requiredMatches: 1, matchesFound: 0 } as const;

    // Still drawing (pending draw persists) — nothing to summarise yet.
    const midHunt = diffSnapshots(
      snapshot({ presentationEvents: [], pendingDraw: { ...hunt, drawnCount: 3 } }),
      snapshot({ presentationEvents: [], pendingDraw: { ...hunt, drawnCount: 4 } })
    );
    expect(midHunt.map((event) => event.type)).not.toContain("drawResult");

    // An ordinary fixed draw resolving is not a color hunt.
    const fixedDraw = diffSnapshots(
      snapshot({ presentationEvents: [], pendingDraw: { playerId: "b", reason: "penalty", mode: "auto", drawnCount: 2, totalCount: 2, matchesFound: 0 } }),
      snapshot({ presentationEvents: [] })
    );
    expect(fixedDraw.map((event) => event.type)).not.toContain("drawResult");
  });
});
