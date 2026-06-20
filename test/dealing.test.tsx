import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { GameSnapshot, PublicPlayer } from "@congcard/shared";
import messages from "../messages/en.json";
import { RoundDealBoard } from "../src/components/RoundDealBoard";
import { musicSceneForSnapshot } from "../src/lib/music";

function player(id: string, seat: number, cardCount = 0): PublicPlayer {
  return {
    id,
    nickname: id === "host" ? "Host" : "Guest",
    avatarId: id === "host" ? "sun" : "moon",
    seat,
    cardCount,
    score: 0,
    connected: true,
    away: false,
    isHost: id === "host",
    ready: cardCount >= 7,
    calledOne: false,
    autoPlay: false,
    missedDisconnectedTurns: 0,
    ping: 0
  };
}

function snapshot(stage: NonNullable<GameSnapshot["roundDeal"]>["stage"] = "shuffleChoice"): GameSnapshot {
  return {
    seq: 1,
    serverNow: Date.now(),
    code: "DEAL42",
    phase: "dealing",
    settings: {
      modeId: "standard",
      maxPlayers: 10,
      turnTimeoutSec: 30,
      scoreTarget: "lastStand",
      allowMidGameJoin: true,
      jumpInEnabled: false,
      stackingEnabled: false,
      challengeEnabled: true,
      callEnabled: false,
      batchEnabled: false,
      keyboardShortcutsEnabled: true,
      absentPlayerAction: "draw",
      autoPlayCallOne: false,
      deckBoxes: 1,
      modeOptions: {}
    },
    players: [player("host", 0, 2), player("guest", 1, 7)],
    viewers: [],
    self: { id: "host", role: "player", hand: [] },
    direction: 1,
    roundNumber: 1,
    drawPileCount: 98,
    actionLog: [],
    roundDeal: {
      dealerPlayerId: "host",
      firstPlayerId: "host",
      stage,
      cardsPerPlayer: 7,
      readyPlayerCount: 1,
      totalPlayerCount: 2,
      inactivityDeadline: Date.now() + 30_000
    }
  };
}

function renderBoard(value: GameSnapshot, send = vi.fn()) {
  return {
    send,
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoundDealBoard snapshot={value} send={send} />
      </NextIntlClientProvider>
    )
  };
}

describe("round dealing UI", () => {
  it("shows dealer controls, progress, and concealed card counts", () => {
    renderBoard(snapshot());

    expect(screen.getByText("Ready 1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reshuffle" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deal cards" })).toBeEnabled();
    expect(screen.getByLabelText("2 face-down cards")).toBeInTheDocument();
    expect(screen.getByLabelText("Guest is ready")).toBeDisabled();
  });

  it("deals to an eligible selected player and supports Auto Deal", () => {
    const send = vi.fn();
    renderBoard(snapshot("manual"), send);

    fireEvent.click(screen.getByRole("button", { name: "Deal one card to Host" }));
    expect(send).toHaveBeenCalledWith("game.dealCard", { targetPlayerId: "host" });
    fireEvent.click(screen.getByRole("button", { name: "Auto Deal" }));
    expect(send).toHaveBeenCalledWith("game.autoDeal");
  });

  it("keeps dealing on the in-game music scene", () => {
    expect(musicSceneForSnapshot(snapshot("auto"))).toBe("play");
  });
});
