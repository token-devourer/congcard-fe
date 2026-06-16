import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Card, GameSnapshot } from "@congcard/shared";
import messages from "../messages/en.json";
import { Hand } from "../src/components/Hand";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function largeHand(): Card[] {
  return [
    card("red-1", "red", 1),
    card("red-2", "red", 2),
    card("red-3", "red", 3),
    card("red-4", "red", 4),
    card("yellow-1", "yellow", 1),
    card("yellow-2", "yellow", 2),
    card("yellow-3", "yellow", 3),
    card("yellow-draw2", "yellow", "draw2"),
    card("green-1", "green", 1),
    card("green-2", "green", 2),
    card("green-3", "green", 3),
    card("green-skip", "green", "skip"),
    card("blue-1", "blue", 1),
    card("blue-2", "blue", 2),
    card("blue-3", "blue", 3),
    card("blue-reverse", "blue", "reverse"),
    card("wild", null, "wild"),
    card("wild4", null, "wild4"),
    card("red-7", "red", 7)
  ];
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const hand = largeHand();
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
      deckBoxes: 1,
      modeOptions: {}
    },
    players: [],
    viewers: [],
    self: { id: "me", role: "player", hand, drawnCardId: "red-7" },
    discardTop: card("top", "red", 7),
    activeColor: "red",
    direction: 1,
    currentPlayerId: "me",
    roundNumber: 1,
    drawPileCount: 20,
    actionLog: [],
    ...overrides
  };
}

function renderHand(state = snapshot()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Hand snapshot={state} isMyTurn actionLocked={false} onPlay={vi.fn()} onPassDrawn={vi.fn()} />
    </NextIntlClientProvider>
  );
}

describe("Hand", () => {
  it("renders large hands as grouped piles", () => {
    renderHand();

    expect(screen.getByLabelText("Grouped hand")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Red: 5 cards/ })).toBeInTheDocument();
    expect(screen.getByText("Available 1")).toBeInTheDocument();
  });

  it("opens the active color group by default", () => {
    renderHand();

    expect(screen.getByTestId("hand-group-expanded")).toHaveAttribute("data-group-id", "red");
    expect(screen.getByText("Drawn card 1")).toBeInTheDocument();
  });

  it("expands a tapped group into readable cards without remounting the tray", () => {
    renderHand();

    const tray = screen.getByTestId("hand-group-expanded");
    fireEvent.click(screen.getByRole("button", { name: /Blue: 4 cards/ }));

    expect(screen.getByTestId("hand-group-expanded")).toBe(tray);
    expect(tray).toHaveAttribute("data-group-id", "blue");
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Play blue/ }).length).toBeGreaterThan(0);
  });

  it("keeps hover tray open until the pointer leaves grouped hand", () => {
    renderHand();

    const blue = screen.getByRole("button", { name: /Blue: 4 cards/ });
    fireEvent.mouseEnter(blue);
    expect(screen.getByTestId("hand-group-expanded")).toHaveAttribute("data-group-id", "blue");

    fireEvent.mouseLeave(blue, { relatedTarget: screen.getByTestId("hand-group-expanded") });
    expect(screen.getByTestId("hand-group-expanded")).toHaveAttribute("data-group-id", "blue");
  });

  it("closes the default tray until the active color changes", () => {
    const { rerender } = renderHand();

    fireEvent.click(screen.getByRole("button", { name: /Red: 5 cards/ }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByTestId("hand-group-expanded")).toHaveAttribute("data-group-id", "");

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Hand snapshot={snapshot({ activeColor: "blue" })} isMyTurn actionLocked={false} onPlay={vi.fn()} onPassDrawn={vi.fn()} />
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId("hand-group-expanded")).toHaveAttribute("data-group-id", "blue");
  });

  it("keeps the available badge in pile metadata", () => {
    renderHand();

    const badge = screen.getByText("Available 1");
    expect(badge.closest(".hand-group-meta")).not.toBeNull();
    expect(badge.closest(".hand-group-preview")).toBeNull();
  });
});
