import type { Color, GameSnapshot } from "@congcard/shared";

export type UiEvent =
  | { id: number; type: "yourTurn" }
  | { id: number; type: "penalty"; playerId: string; nickname: string; count: number; self: boolean }
  | { id: number; type: "skip" }
  | { id: number; type: "reverse"; direction: 1 | -1 }
  | { id: number; type: "colorChange"; color: Color }
  | { id: number; type: "calledOne"; nickname: string }
  | { id: number; type: "catchWindow"; playerId: string; nickname: string; self: boolean; opensAt: number; deadline: number };

let nextEventId = 1;

function eventId(): number {
  nextEventId += 1;
  return nextEventId;
}

export function diffSnapshots(prev: GameSnapshot | null, next: GameSnapshot): UiEvent[] {
  const selfId = next.self?.id ?? prev?.self?.id;
  const events: UiEvent[] = [];

  if (!prev || prev.code !== next.code) {
    return events;
  }

  const becameMyTurn =
    Boolean(selfId) &&
    next.phase === "playing" &&
    !next.pendingChallenge &&
    next.currentPlayerId === selfId &&
    (prev.currentPlayerId !== selfId || prev.phase !== "playing" || Boolean(prev.pendingChallenge));

  // A new round deals 7 cards to everyone, so skip per-card diffs to avoid
  // spurious penalty popups, but still announce the opening turn.
  if (prev.roundNumber !== next.roundNumber || prev.phase !== "playing" || next.phase !== "playing") {
    if (becameMyTurn) {
      events.push({ id: eventId(), type: "yourTurn" });
    }

    return events;
  }

  for (const player of next.players) {
    const before = prev.players.find((item) => item.id === player.id);
    if (!before) {
      continue;
    }

    const gained = player.cardCount - before.cardCount;
    if (gained >= 2) {
      events.push({
        id: eventId(),
        type: "penalty",
        playerId: player.id,
        nickname: player.nickname,
        count: gained,
        self: player.id === selfId
      });
    }

    // cardCount === 1 guards against any future path that flips calledOne
    // outside a genuine call (a caught player ends up with 3 cards).
    if (!before.calledOne && player.calledOne && player.cardCount === 1) {
      events.push({ id: eventId(), type: "calledOne", nickname: player.nickname });
    }
  }

  const topChanged = Boolean(next.discardTop) && next.discardTop?.id !== prev.discardTop?.id;

  if (topChanged && next.discardTop?.value === "skip") {
    events.push({ id: eventId(), type: "skip" });
  }

  if (next.direction !== prev.direction) {
    events.push({ id: eventId(), type: "reverse", direction: next.direction });
  }

  if (
    topChanged &&
    (next.discardTop?.value === "wild" || next.discardTop?.value === "wild4") &&
    next.activeColor
  ) {
    events.push({ id: eventId(), type: "colorChange", color: next.activeColor });
  }

  if (next.oneWindow && (next.oneWindow.playerId !== prev.oneWindow?.playerId || next.oneWindow.opensAt !== prev.oneWindow?.opensAt)) {
    const target = next.players.find((item) => item.id === next.oneWindow?.playerId);
    if (target && target.cardCount === 1 && !target.calledOne) {
      events.push({
        id: eventId(),
        type: "catchWindow",
        playerId: target.id,
        nickname: target.nickname,
        self: target.id === selfId,
        opensAt: next.oneWindow.opensAt,
        deadline: next.oneWindow.deadline
      });
    }
  }

  if (becameMyTurn) {
    events.push({ id: eventId(), type: "yourTurn" });
  }

  return events;
}
