import type { CardValue, Color, GameSnapshot } from "@congcard/shared";

export type UiEvent =
  | { id: number; type: "yourTurn" }
  | { id: number; type: "penalty"; playerId: string; nickname: string; count: number; self: boolean }
  | { id: number; type: "skip"; level?: number }
  | { id: number; type: "reverse"; direction: 1 | -1; level?: number }
  | { id: number; type: "colorChange"; color: Color; level?: number }
  | { id: number; type: "stack"; totalDraw: number; level: number }
  | { id: number; type: "matchChain"; value: CardValue; level: number }
  | { id: number; type: "calledOne"; nickname: string }
  | { id: number; type: "catchWindow"; playerId: string; nickname: string; self: boolean; opensAt: number; deadline: number }
  | { id: number; type: "roundWon"; winnerId: string; nickname: string; gameEnd: boolean }
  | { id: number; type: "roundLost"; winnerId: string; nickname: string; gameEnd: boolean };

const ACTION_LOCK_EVENT_TYPES = new Set<UiEvent["type"]>(["skip", "reverse", "penalty", "stack", "colorChange"]);
const ACTION_LOCK_MS = 700;

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

  const roundEnded =
    (next.phase === "roundEnd" || next.phase === "gameEnd") &&
    (prev.phase !== next.phase ||
      prev.roundWinnerId !== next.roundWinnerId ||
      prev.gameWinnerId !== next.gameWinnerId);

  if (roundEnded) {
    const winnerId = next.gameWinnerId ?? next.roundWinnerId;
    const winner = next.players.find((player) => player.id === winnerId);
    const selfPlayer = next.players.find((player) => player.id === selfId);

    if (winnerId && winner && selfPlayer) {
      events.push({
        id: eventId(),
        type: winnerId === selfId ? "roundWon" : "roundLost",
        winnerId,
        nickname: winner.nickname,
        gameEnd: next.phase === "gameEnd"
      });
    }
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
  const matchLevel = topChanged ? sameValuePitchLevel(next) : 0;
  let matchChainHandled = false;

  if (topChanged && next.discardTop?.value === "skip") {
    events.push({ id: eventId(), type: "skip", ...(matchLevel > 1 ? { level: matchLevel } : {}) });
    matchChainHandled = true;
  }

  if (next.direction !== prev.direction) {
    events.push({ id: eventId(), type: "reverse", direction: next.direction, ...(matchLevel > 1 ? { level: matchLevel } : {}) });
    matchChainHandled = topChanged && next.discardTop?.value === "reverse" ? true : matchChainHandled;
  }

  if (
    topChanged &&
    (next.discardTop?.value === "wild" || next.discardTop?.value === "wild4") &&
    next.activeColor
  ) {
    events.push({ id: eventId(), type: "colorChange", color: next.activeColor, ...(matchLevel > 1 ? { level: matchLevel } : {}) });
    matchChainHandled = true;
  }

  if (topChanged && matchLevel > 1 && !matchChainHandled && next.discardTop) {
    events.push({ id: eventId(), type: "matchChain", value: next.discardTop.value, level: matchLevel });
  }

  const lastPrevLogSeq = prev.actionLog.at(-1)?.seq ?? 0;
  let stackLog: GameSnapshot["actionLog"][number] | undefined;
  for (let index = next.actionLog.length - 1; index >= 0; index -= 1) {
    const entry = next.actionLog[index]!;
    if (entry.seq <= lastPrevLogSeq) {
      break;
    }

    if (/must stack or draw \d+ cards/.test(entry.message)) {
      stackLog = entry;
      break;
    }
  }
  const stackLogTotal = stackLog ? Number(/must stack or draw (\d+) cards/.exec(stackLog.message)?.[1] ?? 0) : 0;
  let stackEventAdded = false;
  if (stackLogTotal > 0) {
    events.push({
      id: eventId(),
      type: "stack",
      totalDraw: stackLogTotal,
      level: stackPitchLevel(stackLogTotal)
    });
    stackEventAdded = true;
  }

  if (
    !stackEventAdded &&
    next.pendingStack &&
    (!prev.pendingStack ||
      next.pendingStack.totalDraw !== prev.pendingStack.totalDraw ||
      next.pendingStack.targetPlayerId !== prev.pendingStack.targetPlayerId)
  ) {
    events.push({
      id: eventId(),
      type: "stack",
      totalDraw: next.pendingStack.totalDraw,
      level: stackPitchLevel(next.pendingStack.totalDraw)
    });
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

export function eventActionLockMs(events: UiEvent[]): number {
  return events.some((event) => ACTION_LOCK_EVENT_TYPES.has(event.type)) ? ACTION_LOCK_MS : 0;
}

export function isVisibleUiEvent(event: UiEvent): boolean {
  return event.type !== "matchChain";
}

function stackPitchLevel(totalDraw: number): number {
  return Math.min(8, Math.max(1, Math.floor(totalDraw / 2)));
}

function sameValuePitchLevel(next: GameSnapshot): number {
  const value = next.discardTop?.value;
  if (value === undefined || latestPlayedValueFromLog(next) !== value) {
    return 0;
  }

  const run = sameValueRunFromLog(next, value);
  return run > 1 ? Math.min(8, run) : 0;
}

function latestPlayedValueFromLog(snapshot: GameSnapshot): CardValue | undefined {
  for (let index = snapshot.actionLog.length - 1; index >= 0; index -= 1) {
    const value = playedCardValue(snapshot.actionLog[index]?.message);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function sameValueRunFromLog(snapshot: GameSnapshot, value: CardValue): number {
  let run = 0;

  for (let index = snapshot.actionLog.length - 1; index >= 0; index -= 1) {
    const playedValue = playedCardValue(snapshot.actionLog[index]?.message);
    if (playedValue === undefined) {
      continue;
    }

    if (playedValue !== value) {
      break;
    }

    run += 1;
  }

  return run;
}

function playedCardValue(message?: string): CardValue | undefined {
  const raw = message?.match(/^.+ played (?:(?:red|yellow|green|blue) )?(\d|skip|reverse|draw2|wild4|wild)\.$/)?.[1];
  if (!raw) {
    return undefined;
  }

  return /^\d$/.test(raw) ? Number(raw) as CardValue : raw as CardValue;
}
