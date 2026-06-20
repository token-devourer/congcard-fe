import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Card, GameSnapshot, PublicPlayer } from "@congcard/shared";
import messages from "../messages/en.json";
import { Board } from "../src/components/RoomClient";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function player(id: string, seat: number): PublicPlayer {
  return {
    id,
    nickname: id === "offender" ? "Alex" : "Me",
    avatarId: id === "offender" ? "sun" : "moon",
    seat,
    cardCount: id === "me" ? 3 : 2,
    score: 0,
    connected: true,
    away: false,
    isHost: id === "offender",
    ready: false,
    calledOne: false,
    autoPlay: false,
    missedDisconnectedTurns: 0,
    ping: 0
  };
}

function snapshot(): GameSnapshot {
  return {
    seq: 7,
    serverNow: Date.now(),
    code: "CHAL42",
    phase: "playing",
    settings: {
      modeId: "standard",
      maxPlayers: 10,
      turnTimeoutSec: 30,
      scoreTarget: 0,
      allowMidGameJoin: true,
      jumpInEnabled: false,
      stackingEnabled: true,
      challengeEnabled: true,
      callEnabled: true,
      batchEnabled: true,
      keyboardShortcutsEnabled: true,
      absentPlayerAction: "draw",
      autoPlayCallOne: false,
      deckBoxes: 1,
      modeOptions: {}
    },
    players: [player("offender", 0), player("me", 1)],
    viewers: [],
    self: {
      id: "me",
      role: "player",
      hand: [card("wild4-a", null, "wild4"), card("wild4-b", null, "wild4"), card("blue-1", "blue", 1)]
    },
    discardTop: card("top-wild4", null, "wild4"),
    activeColor: "green",
    direction: 1,
    currentPlayerId: "me",
    turnDeadline: Date.now() + 30_000,
    pendingChallenge: {
      offenderId: "offender",
      challengerId: "me",
      declaredColor: "green",
      guilty: false,
      drawCount: 4
    },
    pendingStack: {
      kind: "wild4",
      targetPlayerId: "me",
      totalDraw: 4,
      challengeable: true,
      offenderId: "offender",
      declaredColor: "green",
      guilty: false
    },
    roundNumber: 1,
    drawPileCount: 80,
    actionLog: []
  };
}

function renderBoard(gameSnapshot = snapshot()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Board
        snapshot={gameSnapshot}
        send={vi.fn()}
        onLeave={vi.fn()}
        selectedCard={null}
        setSelectedCard={vi.fn()}
        rulesOpen={false}
        onOpenRules={vi.fn()}
      />
    </NextIntlClientProvider>
  );
}

describe("Wild +4 challenge batch access", () => {
  it("renders a concise inline decision panel", () => {
    renderBoard();

    const panel = screen.getByRole("region", { name: "Wild +4 challenge" });
    expect(panel).toHaveClass("challenge-panel");
    expect(screen.queryByRole("dialog", { name: "Wild +4 challenge" })).not.toBeInTheDocument();
    expect(screen.getByText("Did Alex still hold the previous active color?")).toBeInTheDocument();
    expect(screen.getByText("Correct: Alex draws 4. Wrong: you draw 6.")).toBeInTheDocument();
  });

  it("opens Batch +4 without hiding the challenge decision", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Batch +4" }));

    expect(screen.getByRole("region", { name: "Batch Cards" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Wild +4 challenge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take 4" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Challenge!" })).toBeDisabled();
  });

  it("opens the same Batch tray with keyboard B", () => {
    renderBoard();

    fireEvent.keyDown(window, { key: "b" });

    expect(screen.getByRole("region", { name: "Batch Cards" })).toBeInTheDocument();
  });

  it("hides Batch +4 when only one legal Wild +4 is available", () => {
    const gameSnapshot = snapshot();
    gameSnapshot.self!.hand = [card("wild4-a", null, "wild4"), card("blue-1", "blue", 1)];
    gameSnapshot.players.find((item) => item.id === "me")!.cardCount = 2;

    renderBoard(gameSnapshot);

    expect(screen.queryByRole("button", { name: "Batch +4" })).not.toBeInTheDocument();
  });
});
