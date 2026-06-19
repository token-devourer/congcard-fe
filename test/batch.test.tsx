import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Card, GameSnapshot } from "@congcard/shared";
import messages from "../messages/en.json";
import { Hand } from "../src/components/Hand";
import { batchCardGroups } from "../src/lib/batch";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const hand = [
    card("red-5", "red", 5),
    card("blue-5", "blue", 5),
    card("green-5", "green", 5),
    card("yellow-7", "yellow", 7)
  ];
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
      batchEnabled: true,
      deckBoxes: 1,
      modeOptions: {}
    },
    players: [],
    viewers: [],
    self: { id: "me", role: "player", hand },
    discardTop: card("top", "red", 9),
    activeColor: "red",
    direction: 1,
    currentPlayerId: "me",
    roundNumber: 1,
    drawPileCount: 20,
    actionLog: [],
    ...overrides
  };
}

describe("Batch Cards", () => {
  it("derives only same-value groups with a legal starter", () => {
    const groups = batchCardGroups(snapshot());

    expect(groups).toHaveLength(1);
    expect(groups[0]?.value).toBe(5);
    expect(groups[0]?.cards.map((item) => item.id)).toEqual(["red-5", "blue-5", "green-5"]);
    expect([...groups[0]!.playableStarterIds]).toEqual(["red-5"]);
  });

  it("does not offer batches after drawing or outside the active turn", () => {
    expect(batchCardGroups(snapshot({ self: { id: "me", role: "player", hand: snapshot().self!.hand, drawnCardId: "red-5" } }))).toEqual([]);
    expect(batchCardGroups(snapshot({ currentPlayerId: "other" }))).toEqual([]);
  });

  it("selects cards in order and submits the ordered batch", () => {
    const onPlayBatch = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Hand
          snapshot={snapshot()}
          isMyTurn
          onPlay={vi.fn()}
          onPlayBatch={onPlayBatch}
          onPassDrawn={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Batch" }));
    fireEvent.click(screen.getByRole("button", { name: /5.*3 available/i }));

    const red = screen.getByRole("button", { name: /Select red 5 for batch/i });
    const blue = screen.getByRole("button", { name: /Select blue 5 for batch/i });
    fireEvent.click(red);
    fireEvent.click(blue);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play 2 cards" }));

    expect(onPlayBatch).toHaveBeenCalledWith([
      expect.objectContaining({ id: "red-5" }),
      expect.objectContaining({ id: "blue-5" })
    ]);
  });
});
