import { act, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../messages/en.json";
import { TurnAlertLayer, TURN_ALERT_DELAY_MS } from "../src/components/TurnAlertLayer";
import { playTurnAlert } from "../src/lib/sound";

vi.mock("../src/lib/sound", () => ({
  playTurnAlert: vi.fn()
}));

function renderAlert(isMyTurn: boolean, isAway: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TurnAlertLayer isMyTurn={isMyTurn} isAway={isAway} roomCode="ABC123" />
    </NextIntlClientProvider>
  );
}

function renderAlertNode(isMyTurn: boolean, isAway: boolean) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <TurnAlertLayer isMyTurn={isMyTurn} isAway={isAway} roomCode="ABC123" />
    </NextIntlClientProvider>
  );
}

describe("TurnAlertLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not alert before the idle delay", () => {
    renderAlert(true, false);

    act(() => {
      vi.advanceTimersByTime(TURN_ALERT_DELAY_MS - 1);
    });

    expect(playTurnAlert).not.toHaveBeenCalled();
  });

  it("alerts after the idle delay for an active non-away turn", () => {
    renderAlert(true, false);

    act(() => {
      vi.advanceTimersByTime(TURN_ALERT_DELAY_MS);
    });

    expect(playTurnAlert).toHaveBeenCalledTimes(1);
  });

  it("does not alert while the player is away", () => {
    renderAlert(true, true);

    act(() => {
      vi.advanceTimersByTime(TURN_ALERT_DELAY_MS + 1000);
    });

    expect(playTurnAlert).not.toHaveBeenCalled();
  });

  it("cancels a pending alert when the turn ends", () => {
    const view = renderAlert(true, false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    view.rerender(renderAlertNode(false, false));
    act(() => {
      vi.advanceTimersByTime(TURN_ALERT_DELAY_MS);
    });

    expect(playTurnAlert).not.toHaveBeenCalled();
  });

  it("cancels a pending alert when the player becomes away", () => {
    const view = renderAlert(true, false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    view.rerender(renderAlertNode(true, true));
    act(() => {
      vi.advanceTimersByTime(TURN_ALERT_DELAY_MS);
    });

    expect(playTurnAlert).not.toHaveBeenCalled();
  });
});
