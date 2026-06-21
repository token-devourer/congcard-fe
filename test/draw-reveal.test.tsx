import { fireEvent, render, screen } from "@testing-library/react";
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
});
