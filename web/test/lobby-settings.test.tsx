import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { mergeRoomSettings, roomSettingsUpdateSchema, type GameSnapshot, type PublicPlayer } from "@congcard/shared";
import messages from "../messages/en.json";
import { Lobby } from "../src/components/RoomClient";

function player(overrides: Partial<PublicPlayer> & { id: string; seat: number }): PublicPlayer {
  const { id, seat, ...rest } = overrides;

  return {
    id,
    nickname: id,
    avatarId: "sun",
    seat,
    cardCount: 0,
    score: 0,
    connected: true,
    away: false,
    isHost: false,
    ready: false,
    calledOne: false,
    autoPlay: false,
    missedDisconnectedTurns: 0,
    ping: 0,
    ...rest
  };
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    seq: 1,
    code: "ABC123",
    phase: "lobby",
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
      batchEnabled: false,
      keyboardShortcutsEnabled: true,
      absentPlayerAction: "draw",
      autoPlayCallOne: false,
      deckBoxes: 1,
      modeOptions: {}
    },
    players: [
      player({ id: "host", seat: 0, isHost: true }),
      player({ id: "guest", seat: 1 })
    ],
    viewers: [],
    self: { id: "host", role: "player", hand: [] },
    direction: 1,
    roundNumber: 1,
    drawPileCount: 108,
    actionLog: [],
    ...overrides
  };
}

function LobbyHarness() {
  const [state, setState] = useState<GameSnapshot>(snapshot());
  const [localModeId, setLocalModeId] = useState<string | null>(null);

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <Lobby
        snapshot={state}
        code={state.code}
        localModeId={localModeId}
        setLocalModeId={setLocalModeId}
        send={(type, payload) => {
          if (type !== "room.updateSettings") {
            return;
          }

          const update = roomSettingsUpdateSchema.parse(payload ?? {});
          setState((previous) => ({
            ...previous,
            settings: mergeRoomSettings({ ...previous.settings, ...update })
          }));
        }}
      />
    </NextIntlClientProvider>
  );
}

describe("Lobby settings", () => {
  it("keeps Jump In and Stacking enabled together across incremental updates", () => {
    render(<LobbyHarness />);

    expect(screen.getByText("Players").closest("section")).toHaveClass("lobby-layout");
    expect(screen.getByRole("button", { name: /Copy code/ }).closest("div")).toHaveClass("lobby-actions");

    const jumpIn = screen.getByText("Enable Jump In").closest("label")?.querySelector("input") as HTMLInputElement | null;
    const stacking = screen.getByText("Enable stacking").closest("label")?.querySelector("input") as HTMLInputElement | null;

    expect(jumpIn).not.toBeNull();
    expect(stacking).not.toBeNull();
    expect(jumpIn).not.toBeChecked();
    expect(stacking).not.toBeChecked();
    expect(jumpIn).toBeEnabled();
    expect(stacking).toBeEnabled();

    fireEvent.click(jumpIn!);
    expect(jumpIn).toBeChecked();
    expect(stacking).not.toBeChecked();

    fireEvent.click(stacking!);
    expect(jumpIn).toBeChecked();
    expect(stacking).toBeChecked();
    expect(jumpIn).toBeEnabled();
    expect(stacking).toBeEnabled();
  });

  it("switches One and Catch defaults when Last Stand is selected", () => {
    render(<LobbyHarness />);

    const scoreTarget = screen.getByText("Score target").closest("label")?.querySelector("select") as HTMLSelectElement | null;
    const call = screen.getByText("Enable One and Catch").closest("label")?.querySelector("input") as HTMLInputElement | null;

    expect(scoreTarget).not.toBeNull();
    expect(call).not.toBeNull();
    expect(call).toBeChecked();

    fireEvent.change(scoreTarget!, { target: { value: "lastStand" } });
    expect(call).not.toBeChecked();

    fireEvent.change(scoreTarget!, { target: { value: "0" } });
    expect(call).toBeChecked();
  });

  it("keeps Batch Cards disabled by default and independently configurable", () => {
    render(<LobbyHarness />);

    const batch = screen.getByText("Enable Batch Cards").closest("label")?.querySelector("input") as HTMLInputElement | null;
    const stacking = screen.getByText("Enable stacking").closest("label")?.querySelector("input") as HTMLInputElement | null;

    expect(batch).not.toBeNull();
    expect(batch).not.toBeChecked();
    fireEvent.click(batch!);
    expect(batch).toBeChecked();
    expect(stacking).not.toBeChecked();
  });

  it("keeps keyboard shortcuts enabled by default and independently configurable", () => {
    render(<LobbyHarness />);

    const shortcuts = screen.getByText("Enable keyboard shortcuts").closest("label")?.querySelector("input") as HTMLInputElement | null;
    const batch = screen.getByText("Enable Batch Cards").closest("label")?.querySelector("input") as HTMLInputElement | null;

    expect(shortcuts).not.toBeNull();
    expect(shortcuts).toBeChecked();
    expect(shortcuts).toBeEnabled();

    fireEvent.click(shortcuts!);
    expect(shortcuts).not.toBeChecked();
    expect(batch).not.toBeChecked();

    fireEvent.click(shortcuts!);
    expect(shortcuts).toBeChecked();
  });

  it("allows only the host to change keyboard shortcuts", () => {
    const guestSnapshot = snapshot({ self: { id: "guest", role: "player", hand: [] } });

    function GuestHarness() {
      const [lm, setLm] = useState<string | null>(null);
      return (
        <NextIntlClientProvider locale="en" messages={messages}>
          <Lobby snapshot={guestSnapshot} code={guestSnapshot.code} localModeId={lm} setLocalModeId={setLm} send={() => undefined} />
        </NextIntlClientProvider>
      );
    }

    render(<GuestHarness />);

    const shortcuts = screen.getByText("Enable keyboard shortcuts").closest("label")?.querySelector("input") as HTMLInputElement | null;
    expect(shortcuts).toBeDisabled();
  });

  it("configures away and offline behavior independently", () => {
    render(<LobbyHarness />);

    const action = screen.getByText("Away / offline behavior").closest("label")?.querySelector("select") as HTMLSelectElement | null;

    expect(action).not.toBeNull();
    expect(action).toHaveValue("draw");
    expect(screen.queryByText("Autoplay calls One")).not.toBeInTheDocument();

    fireEvent.change(action!, { target: { value: "autoplay" } });
    const callOne = screen.getByText("Autoplay calls One").closest("label")?.querySelector("input") as HTMLInputElement | null;
    expect(callOne).not.toBeNull();
    expect(callOne).not.toBeChecked();

    fireEvent.click(callOne!);
    expect(callOne).toBeChecked();

    fireEvent.change(action!, { target: { value: "none" } });
    expect(screen.queryByText("Autoplay calls One")).not.toBeInTheDocument();
    expect(screen.getByText("Enable stacking").closest("label")?.querySelector("input")).toBeEnabled();
  });
});
