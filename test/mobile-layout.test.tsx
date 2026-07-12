import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameSnapshot, PublicPlayer } from "@congcard/shared";
import messages from "../messages/en.json";
import { ColorPicker } from "../src/components/ColorPicker";
import { PlayerSeat } from "../src/components/PlayerSeat";
import { RoundEndOverlay, roundEndRevealAt } from "../src/components/RoundEndOverlay";
import { GameEventOverlay, PeekRevealWall } from "../src/components/GameEventOverlay";
import { TurnBanner } from "../src/components/TurnBanner";
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

  it("renders a Chaos-busted player as charred", () => {
    const burned = player({ id: "burned", seat: 1, finishedRank: 1, chaosBusted: true });
    const { container } = renderWithIntl(<PlayerSeat player={burned} />);

    expect(screen.getByText("burned").closest(".tableseat")).toHaveClass("busted");
    expect(screen.getByText("Charred by Chaos")).toBeInTheDocument();
    expect(container.querySelector(".busted-avatar")).toBeInTheDocument();
    expect(container.querySelector(".busted-soot-mask")).toBeInTheDocument();
    expect(container.querySelector(".busted-ash-plume")).toBeInTheDocument();
  });

  it("renders every revealed hand in the Peek cinematic wall", () => {
    const game = snapshot();
    game.phase = "playing";
    renderWithIntl(
      <PeekRevealWall
        snapshot={game}
        revealedHands={{
          host: [{ id: "host-red", trackingId: "host-red", color: "red", value: 4 }],
          guest: [{ id: "guest-blue", trackingId: "guest-blue", color: "blue", value: 7 }]
        }}
      />
    );

    expect(screen.getByRole("region", { name: "Peek reveal" })).toBeInTheDocument();
    expect(screen.getByLabelText("red 4")).toBeInTheDocument();
    expect(screen.getByLabelText("blue 7")).toBeInTheDocument();
  });

  it("keeps the rotating Time Skip backdrop oversized beyond the viewport", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const game = snapshot();
    game.phase = "playing";
    game.serverNow = 1_000;
    game.pendingChaos = {
      id: 7,
      kind: "timeskip",
      phase: "opening",
      actorId: "host",
      startsAt: 1_000,
      resolvesAt: 5_900
    };
    useRoomStore.setState({
      snapshot: game,
      clockOffset: 0,
      events: [{
        id: 70,
        type: "chaos",
        kind: "timeskip",
        phase: "opening",
        chainId: 7,
        actorId: "host",
        startsAt: 1_000,
        resolvesAt: 5_900
      }]
    });

    renderWithIntl(<GameEventOverlay />);

    expect(screen.getByTestId("chaos-energy-field")).toBeInTheDocument();
    expect(screen.getByTestId("timeskip-overscan")).toHaveClass("h-[260vmax]", "w-[260vmax]", "rounded-full");
  });

  it("suppresses the turn banner during blocking Chaos phases", () => {
    const game = snapshot();
    game.phase = "playing";
    game.currentPlayerId = "guest";
    game.pendingChaos = {
      id: 9,
      kind: "favor",
      phase: "opening",
      actorId: "guest",
      startsAt: 1_000,
      resolvesAt: 3_250
    };
    useRoomStore.setState({ snapshot: game, events: [{ id: 91, type: "yourTurn" }] });

    renderWithIntl(<TurnBanner />);

    expect(screen.queryByText("YOUR TURN!")).not.toBeInTheDocument();
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
      resolvesAt: 5_800
    }];
    const revealAt = 5_800 + CHAOS_BUST_RESULT_SETTLE_MS;

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
