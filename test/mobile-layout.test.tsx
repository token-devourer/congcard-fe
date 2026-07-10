import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameSnapshot, PublicPlayer } from "@congcard/shared";
import messages from "../messages/en.json";
import { ColorPicker } from "../src/components/ColorPicker";
import { RoundEndOverlay, roundEndRevealAt } from "../src/components/RoundEndOverlay";
import { CHAOS_BUST_RESULT_SETTLE_MS } from "../src/lib/events";
import { useRoomStore } from "../src/lib/store";

function player(overrides: Partial<PublicPlayer> & { id: string; seat: number }): PublicPlayer {
  const { id, seat, ...rest } = overrides;

  return {
    id,
    nickname: id,
    avatarId: "sun",
    seat,
    cardCount: 0,
    score: 0,
    connected: true,
    away: false,
    isHost: false,
    ready: false,
    calledOne: false,
    autoPlay: false,
    missedDisconnectedTurns: 0,
    ping: 0,
    ...rest
  };
}

function snapshot(): GameSnapshot {
  const winner = player({ id: "host", seat: 0, isHost: true, score: 14 });
  const guest = player({ id: "guest", seat: 1 });

  return {
    seq: 1,
    code: "ABC123",
    phase: "roundEnd",
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
    players: [winner, guest],
    viewers: [],
    self: { id: "guest", role: "player", hand: [] },
    direction: 1,
    roundNumber: 1,
    drawPileCount: 80,
    actionLog: [],
    roundWinnerId: winner.id
  };
}

function renderWithIntl(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

afterEach(() => vi.useRealTimers());

describe("mobile layout surfaces", () => {
  it("uses the mobile safe modal shell for color picking", () => {
    renderWithIntl(<ColorPicker onPick={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId("color-picker-overlay")).toHaveClass("overflow-hidden");
    expect(screen.getByRole("dialog")).toHaveClass("mobile-modal", "modal-color-picker");
  });

  it("uses the mobile safe modal shell for round end", () => {
    renderWithIntl(<RoundEndOverlay snapshot={snapshot()} send={vi.fn()} onLeave={vi.fn()} />);

    expect(screen.getByTestId("round-end-overlay")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("round-end-overlay")).not.toHaveClass("overflow-y-auto");
    expect(screen.getByRole("dialog")).toHaveClass("mobile-modal", "modal-round-end");
  });

  it("waits for a finishing chaos bust before showing the round result", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    useRoomStore.setState({ clockOffset: 0 });
    const result = snapshot();
    result.serverNow = 1_000;
    result.settings.modeId = "chaos";
    result.presentationEvents = [{
      id: 9,
      seq: 9,
      kind: "chaosBust",
      targetIds: ["guest"],
      amount: 26,
      startsAt: 1_000,
      resolvesAt: 4_600
    }];
    const revealAt = 4_600 + CHAOS_BUST_RESULT_SETTLE_MS;

    expect(roundEndRevealAt(result)).toBe(revealAt);
    expect(roundEndRevealAt(result, revealAt)).toBeUndefined();
    renderWithIntl(<RoundEndOverlay snapshot={result} send={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByTestId("round-end-overlay")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(revealAt - 1_000 - 1));
    expect(screen.queryByTestId("round-end-overlay")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("round-end-overlay")).toBeInTheDocument();
  });
});
