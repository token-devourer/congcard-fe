import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeRoomSettings, type GameSnapshot } from "@congcard/shared";

const musicMocks = vi.hoisted(() => ({
  setMusicScene: vi.fn(),
  setMusicSuspended: vi.fn(),
  unlockMusic: vi.fn()
}));

vi.mock("../src/lib/music", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/music")>();
  return { ...original, ...musicMocks };
});

import { MusicLayer } from "../src/components/MusicLayer";

function snapshot(): GameSnapshot {
  return {
    seq: 1,
    code: "ABC123",
    phase: "lobby",
    settings: mergeRoomSettings(),
    players: [],
    viewers: [],
    direction: 1,
    roundNumber: 1,
    drawPileCount: 108,
    actionLog: []
  };
}

describe("MusicLayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the current scene, unlocks after interaction, and cleans up", () => {
    const view = render(<MusicLayer snapshot={snapshot()} />);
    expect(musicMocks.setMusicScene).toHaveBeenCalledWith("lobby");

    fireEvent.pointerDown(document);
    expect(musicMocks.unlockMusic).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(musicMocks.setMusicScene).toHaveBeenLastCalledWith(null);
  });
});
