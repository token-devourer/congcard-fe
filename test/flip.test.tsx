import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeRoomSettings, type Card, type GameSnapshot } from "@congcard/shared";
import messages from "../messages/en.json";

const { playSound } = vi.hoisted(() => ({ playSound: vi.fn() }));
vi.mock("../src/lib/sound", () => ({ playSound }));

import { CardView } from "../src/components/CardView";
import { ColorPicker } from "../src/components/ColorPicker";
import { FlipTransitionLayer } from "../src/components/FlipTransitionLayer";

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
  });

  it("renders dark-side cards and actions", () => {
    const { rerender } = render(<CardView card={card("draw", "orange", "draw5")} />);
    expect(screen.getByLabelText("orange +5")).toHaveClass("card-orange");
    rerender(<CardView card={card("flip", "purple", "flip")} />);
    expect(screen.getByLabelText("purple Flip")).toHaveClass("card-purple");
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
  });
});
