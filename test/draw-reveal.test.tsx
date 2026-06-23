import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { mergeRoomSettings, type Card, type GameSnapshot, type PublicPlayer } from "@congcard/shared";
import messages from "../messages/en.json";
import { Board } from "../src/components/RoomClient";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function player(id: string, seat: number): PublicPlayer {
  return {
    id,
    nickname: id,
    avatarId: "sun",
    seat,
    cardCount: 2,
    score: 0,
    connected: true,
    away: false,
    isHost: id === "me",
    ready: false,
    calledOne: false,
    autoPlay: false,
    missedDisconnectedTurns: 0,
    ping: 0
  };
}

function snapshot(mode: "choice" | "manual" | "auto" = "choice"): GameSnapshot {
  return {
    seq: 1,
    serverNow: Date.now(),
    code: "DRAW42",
    phase: "playing",
    settings: mergeRoomSettings({ modeId: "flip", keyboardShortcutsEnabled: true }),
    players: [player("me", 0), player("other", 1)],
    viewers: [],
    self: { id: "me", role: "player", hand: [card("red-5", "red", 5), card("blue-2", "blue", 2)] },
    discardTop: card("discard", null, "wildColor"),
    activeColor: "cyan",
    direction: 1,
    currentPlayerId: "me",
    roundNumber: 1,
    drawPileCount: 80,
    actionLog: [],
    flipSide: "dark",
    pendingDraw: {
      playerId: "me",
      reason: "colorHunt",
      mode,
      drawnCount: 2,
      targetColor: "cyan",
      requiredMatches: 2,
      matchesFound: 1,
      deadline: Date.now() + 20_000
    }
  };
}

function renderBoard(game: GameSnapshot, send = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Board
        snapshot={game}
        send={send}
        onLeave={vi.fn()}
        selectedCard={null}
        setSelectedCard={vi.fn()}
        rulesOpen={false}
        onOpenRules={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  return send;
}

describe("authoritative draw controls", () => {
  it("offers Auto and Manual for Wild Draw Color while locking normal cards", () => {
    const send = renderBoard(snapshot());

    expect(screen.getByRole("region", { name: "Wild Draw Color" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play red 5" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Manual Draw" }));
    expect(send).toHaveBeenCalledWith("game.chooseColorDraw", { mode: "manual" });
    fireEvent.click(screen.getByRole("button", { name: "Auto Draw" }));
    expect(send).toHaveBeenCalledWith("game.chooseColorDraw", { mode: "auto" });
  });

  it("routes keyboard D to one authoritative manual draw", () => {
    const send = renderBoard(snapshot("manual"));

    fireEvent.keyDown(window, { key: "d" });
    expect(send).toHaveBeenCalledWith("game.drawColorCard");
  });

  it("keeps sequentially revealed cards together in the draw status", () => {
    const game = snapshot("auto");
    game.pendingDraw = {
      ...game.pendingDraw!,
      drawnCount: 2,
      totalCount: 4,
      revealedCards: [
        { color: "red", value: 1, side: "dark" },
        { color: "cyan", value: 2, side: "dark" }
      ],
      reveal: {
        id: 3,
        index: 3,
        startsAt: Date.now() - 200,
        revealsAt: Date.now() - 100,
        resolvesAt: Date.now() + 200,
        visibleCard: { color: "purple", value: 3, side: "dark" }
      }
    };
    renderBoard(game);

    const status = screen.getByText("Drawing for me").closest('[role="status"]') as HTMLElement;
    expect(within(status).getByLabelText("red 1")).toBeInTheDocument();
    expect(within(status).getByLabelText("cyan 2")).toBeInTheDocument();
    expect(within(status).getByLabelText("purple 3")).toBeInTheDocument();
    expect(within(status).getByText("3 / 4 cards")).toBeInTheDocument();
  });

  it("compacts large draw sequences with the newest card on top", () => {
    const game = snapshot("auto");
    game.pendingDraw = {
      ...game.pendingDraw!,
      drawnCount: 12,
      totalCount: 14,
      revealedCards: Array.from({ length: 12 }, (_, index) => ({ color: "cyan" as const, value: (index % 10) as Card["value"], side: "dark" as const })),
      reveal: {
        id: 13,
        index: 13,
        startsAt: Date.now() - 120,
        revealsAt: Date.now() - 40,
        resolvesAt: Date.now() + 140,
        visibleCard: { color: "pink", value: 3, side: "dark" }
      }
    };
    renderBoard(game);

    const row = screen.getByText("13 / 14 cards").closest('[role="status"]')?.querySelector(".draw-collection-row") as HTMLElement;
    expect(row).toHaveStyle({ "--draw-card-count": "13" });
    expect(row.lastElementChild).toHaveStyle({ zIndex: "14" });
  });

  it("counts the cards drawn while hunting for a color", () => {
    renderBoard(snapshot("auto"));

    const status = screen.getByText("Drawing for me").closest('[role="status"]') as HTMLElement;
    // matchesFound 1 of 2 cyan, but the status now leads with the running draw count.
    expect(within(status).getByText(/2 drawn.*1\/2 Cyan/)).toBeInTheDocument();
  });

  it("compresses the felt only while you personally hunt for a color", () => {
    const { container, rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Board snapshot={snapshot()} send={vi.fn()} onLeave={vi.fn()} selectedCard={null} setSelectedCard={vi.fn()} rulesOpen={false} onOpenRules={vi.fn()} />
      </NextIntlClientProvider>
    );
    expect(container.querySelector("section.board")).toHaveClass("board--color-draw");

    const opponentHunt = snapshot();
    opponentHunt.pendingDraw = { ...opponentHunt.pendingDraw!, playerId: "other" };
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Board snapshot={opponentHunt} send={vi.fn()} onLeave={vi.fn()} selectedCard={null} setSelectedCard={vi.fn()} rulesOpen={false} onOpenRules={vi.fn()} />
      </NextIntlClientProvider>
    );
    expect(container.querySelector("section.board")).not.toHaveClass("board--color-draw");
  });
});
