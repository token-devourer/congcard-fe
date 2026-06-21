import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeRoomSettings, type Card, type GameSnapshot } from "@congcard/shared";
import messages from "../messages/en.json";

const { playSound, scheduleFlipMusicTransition } = vi.hoisted(() => ({
  playSound: vi.fn(),
  scheduleFlipMusicTransition: vi.fn()
}));
vi.mock("../src/lib/sound", () => ({ playSound }));
vi.mock("../src/lib/music", () => ({ scheduleFlipMusicTransition }));

import { CardView } from "../src/components/CardView";
import { ColorPicker } from "../src/components/ColorPicker";
import { FlipTransitionLayer } from "../src/components/FlipTransitionLayer";
import { RoundTable } from "../src/components/RoundTable";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function flipSnapshot(): GameSnapshot {
  const now = Date.now();
  return {
    seq: 1,
    code: "FLIP42",
    phase: "playing",
    settings: mergeRoomSettings({ modeId: "flip" }),
    players: [],
    viewers: [],
    direction: 1,
    roundNumber: 1,
    drawPileCount: 100,
    actionLog: [],
    flipSide: "light",
    pendingFlip: {
      id: 1,
      playerId: "p1",
      fromSide: "light",
      toSide: "dark",
      transitionTimes: [now + 500],
      resolvesAt: now + 1020
    }
  };
}

describe("Flip presentation", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.classList.remove("flip-light", "flip-dark", "flip-card-animating");
    playSound.mockClear();
    scheduleFlipMusicTransition.mockClear();
  });

  it("renders dark-side cards and actions", () => {
    const { rerender } = render(<CardView card={{ ...card("draw", "orange", "draw5"), side: "dark" }} />);
    expect(screen.getByLabelText("orange +5")).toHaveClass("card-orange", "card-side-dark");
    rerender(<CardView card={{ ...card("flip", "purple", "flip"), side: "dark" }} />);
    expect(screen.getByLabelText("purple Flip")).toHaveClass("card-purple", "card-side-dark");
  });

  it("uses gold ink for dark-side Wild labels and corner stars", () => {
    render(<CardView card={{ ...card("dark-wild", null, "wildColor"), side: "dark" }} />);

    expect(screen.getByLabelText("wild Wild Color")).toHaveClass("card-side-dark", "card-wild-dark-ink");
  });

  it("marks light cards with light ink including yellow", () => {
    const { rerender } = render(<CardView card={{ ...card("yellow", "yellow", 6), side: "light" }} />);
    expect(screen.getByLabelText("yellow 6")).toHaveClass("card-yellow", "card-side-light");
    rerender(<CardView card={{ ...card("standard-yellow", "yellow", "skip") }} />);
    expect(screen.getByLabelText("yellow Skip")).toHaveClass("card-side-light");
  });

  it("offers only dark-side colors when dark is active", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ColorPicker flipSide="dark" onPick={vi.fn()} onCancel={vi.fn()} />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("button", { name: "Orange" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cyan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Red" })).not.toBeInTheDocument();
  });

  it("synchronizes transition theme and SFX to the server timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T00:00:00Z"));
    render(<FlipTransitionLayer snapshot={flipSnapshot()} />);
    expect(document.body).toHaveClass("flip-light");
    act(() => vi.advanceTimersByTime(500));
    expect(document.body).toHaveClass("flip-dark");
    expect(playSound).toHaveBeenCalledWith("flipSweep", 1);
    expect(playSound).toHaveBeenCalledWith("flipImpact", 1);
    expect(playSound).toHaveBeenCalledWith("flipDark", 1);
    expect(scheduleFlipMusicTransition).toHaveBeenCalledWith("flipDark", 240, 500, 500);
  });

  it("clears the global card flip class after snapshot refreshes for the same transition", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T00:00:00Z"));
    const game = flipSnapshot();
    const { rerender } = render(<FlipTransitionLayer snapshot={game} />);

    act(() => vi.advanceTimersByTime(500));
    expect(document.body).toHaveClass("flip-card-animating");

    rerender(<FlipTransitionLayer snapshot={{ ...game, seq: 2, pendingFlip: { ...game.pendingFlip! } }} />);
    act(() => vi.advanceTimersByTime(600));
    expect(document.body).not.toHaveClass("flip-card-animating");
  });

  it("shows opponent inactive faces and closes the drawer for One/Catch", async () => {
    const game = flipSnapshot();
    delete game.pendingFlip;
    game.self = { id: "me", role: "player", hand: [card("mine", "red", 2)] };
    game.activeColor = "red";
    game.discardTop = card("top", "red", 5);
    game.currentPlayerId = "me";
    game.drawPileBack = { trackingId: "draw-back", color: "orange", value: 4, side: "dark" };
    game.players = [
      {
        id: "me", nickname: "Me", avatarId: "sun", seat: 0, cardCount: 1, score: 0, connected: true, away: false,
        isHost: true, ready: false, calledOne: false, autoPlay: false, missedDisconnectedTurns: 0, ping: 0
      },
      {
        id: "other", nickname: "Opponent", avatarId: "moon", seat: 1, cardCount: 2, score: 0, connected: true, away: false,
        isHost: false, ready: false, calledOne: false, autoPlay: false, missedDisconnectedTurns: 0, ping: 0,
        oppositeHand: [
          { trackingId: "one", color: "cyan", value: 3, side: "dark" },
          { trackingId: "two", color: "purple", value: "skip", side: "dark" }
        ]
      }
    ];

    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoundTable snapshot={game} isMyTurn canDraw onDraw={vi.fn()} />
      </NextIntlClientProvider>
    );

    expect(screen.getByLabelText("orange 4")).toBeInTheDocument();
    const selfSeat = screen.getByText("Me").closest(".tableseat") as HTMLElement;
    expect(selfSeat.querySelectorAll(".opposite-mini-card")).toHaveLength(1);
    expect(selfSeat.querySelector(".opposite-mini-back")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Opponent, 2 cards" }));
    expect(screen.getByLabelText("Opponent opposite card faces")).toBeInTheDocument();
    expect(screen.getAllByLabelText("cyan 3").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByLabelText("red 2")).not.toBeInTheDocument();
    const stackedFace = screen.getAllByLabelText("cyan 3").find((element) => element.closest(".opponent-face-stack"));
    expect(stackedFace?.closest(".opponent-face-stack")).toHaveStyle({ "--opponent-face-count": "1" });

    game.oneWindow = { playerId: "other", opensAt: Date.now(), deadline: Date.now() + 3000 };
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoundTable snapshot={game} isMyTurn canDraw onDraw={vi.fn()} />
      </NextIntlClientProvider>
    );
    await waitFor(() => expect(screen.queryByLabelText("Opponent opposite card faces")).not.toBeInTheDocument());
  });
});
