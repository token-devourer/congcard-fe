import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Card, GameSnapshot } from "@congcard/shared";
import messages from "../messages/en.json";
import { Hand } from "../src/components/Hand";
import { batchCardGroups, defaultBatchCardIds, groupBatchCardsByColor, orderedBatchCardsByColor } from "../src/lib/batch";

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
      keyboardShortcutsEnabled: true,
      absentPlayerAction: "draw",
      autoPlayCallOne: false,
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

  it("offers a batch starting with the drawn card after drawing", () => {
    const groups = batchCardGroups(
      snapshot({ self: { id: "me", role: "player", hand: snapshot().self!.hand, drawnCardId: "red-5" } })
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.value).toBe(5);
    expect([...groups[0]!.playableStarterIds]).toEqual(["red-5"]);
  });

  it("does not offer batches outside the active turn", () => {
    expect(batchCardGroups(snapshot({ currentPlayerId: "other" }))).toEqual([]);
  });

  it("does not offer throwup or chaos special batches", () => {
    const groups = batchCardGroups(
      snapshot({
        settings: { ...snapshot().settings, modeId: "chaos" },
        self: {
          id: "me",
          role: "player",
          hand: [
            card("throw-a", "red", "throwup"),
            card("throw-b", "red", "throwup"),
            card("flash-a", null, "flashbang"),
            card("flash-b", null, "flashbang"),
            card("red-5", "red", 5),
            card("blue-5", "blue", 5)
          ]
        }
      })
    );

    expect(groups.map((group) => group.value)).toEqual([5]);
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

  it("orders tray cards by color with the active color first", () => {
    const cards = orderedBatchCardsByColor(snapshot().self!.hand.slice(0, 3), "blue");
    const groups = groupBatchCardsByColor(snapshot().self!.hand.slice(0, 3), "blue");

    expect(cards.map((item) => item.id)).toEqual(["blue-5", "red-5", "green-5"]);
    expect(groups.map((group) => group.color)).toEqual(["blue", "red", "green"]);
    expect(groups.map((group) => group.cards.map((item) => item.id))).toEqual([["blue-5"], ["red-5"], ["green-5"]]);
  });

  it("builds a complete default selection with a legal starter first", () => {
    const groups = groupBatchCardsByColor(snapshot().self!.hand.slice(0, 3), "blue");

    expect(defaultBatchCardIds(groups, new Set(["red-5"]))).toEqual(["red-5", "blue-5", "green-5"]);
  });

  it("opens and closes Batch selection from shortcut commands", () => {
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Hand
          snapshot={snapshot()}
          isMyTurn
          batchShortcutCommand={{ id: 1, type: "toggle" }}
          onPlay={vi.fn()}
          onPassDrawn={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("region", { name: "Batch Cards" })).toBeInTheDocument();

    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Hand
          snapshot={snapshot()}
          isMyTurn
          batchShortcutCommand={{ id: 2, type: "close" }}
          onPlay={vi.fn()}
          onPassDrawn={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    expect(screen.queryByRole("region", { name: "Batch Cards" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batch" })).toHaveAttribute("aria-keyshortcuts", "B");
  });

  it("selects every card in the displayed default order", () => {
    const onPlayBatch = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Hand snapshot={snapshot()} isMyTurn onPlay={vi.fn()} onPlayBatch={onPlayBatch} onPassDrawn={vi.fn()} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Batch" }));
    fireEvent.click(screen.getByRole("button", { name: /5.*3 available/i }));

    const tray = screen.getByTestId("batch-card-tray");
    expect(within(tray).getAllByRole("button")[0]).toHaveAccessibleName(/Select red 5 for batch/i);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play 3 cards" }));

    expect(onPlayBatch).toHaveBeenCalledWith([
      expect.objectContaining({ id: "red-5" }),
      expect.objectContaining({ id: "green-5" }),
      expect.objectContaining({ id: "blue-5" })
    ]);
  });

  it("orders actions as Clear, All, then Play", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Hand snapshot={snapshot()} isMyTurn onPlay={vi.fn()} onPlayBatch={vi.fn()} onPassDrawn={vi.fn()} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Batch" }));
    fireEvent.click(screen.getByRole("button", { name: /5.*3 available/i }));

    expect(within(screen.getByTestId("batch-actions")).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Clear",
      "All",
      "Play 0 cards"
    ]);
  });
});
