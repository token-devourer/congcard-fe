import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { mergeRoomSettings, type GameSnapshot } from "@congcard/shared";
import messages from "../messages/en.json";
import { AudioControls } from "../src/components/AudioControls";
import { MUSIC_TRACKS, musicSceneForSnapshot } from "../src/lib/music";

function snapshot(phase: GameSnapshot["phase"], flipSide?: "dark"): GameSnapshot {
  return {
    seq: 1,
    code: "ABC123",
    phase,
    settings: mergeRoomSettings(flipSide ? { modeId: "flip" } : {}),
    ...(flipSide ? { flipSide } : {}),
    players: [],
    viewers: [],
    direction: 1,
    roundNumber: 1,
    drawPileCount: 108,
    actionLog: []
  };
}

describe("synth music", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("selects lobby, play, and Flip dark-side scenes", () => {
    expect(musicSceneForSnapshot(snapshot("lobby"))).toBe("lobby");
    expect(musicSceneForSnapshot(snapshot("playing"))).toBe("play");
    expect(musicSceneForSnapshot(snapshot("playing", "dark"))).toBe("flipDark");
    expect(musicSceneForSnapshot(snapshot("roundEnd"))).toBeNull();
  });

  it("defines restrained oscillator-only tracks", () => {
    expect(MUSIC_TRACKS.lobby.bpm).toBe(70);
    expect(MUSIC_TRACKS.play.bpm).toBe(104);
    expect(MUSIC_TRACKS.flipDark.bpm).toBe(66);
    expect(MUSIC_TRACKS.play.lengthSteps).toBe(128);
    expect(MUSIC_TRACKS.flipDark.lengthSteps).toBe(128);
    for (const track of Object.values(MUSIC_TRACKS)) {
      expect(track.notes.length).toBeGreaterThan(0);
      expect(track.notes.every((item) => ["sine", "triangle"].includes(item.type))).toBe(true);
      expect(Math.max(...track.notes.map((item) => item.gain))).toBeLessThanOrEqual(0.05);
    }
  });

  it("enables music by default and persists an independent mute choice", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AudioControls />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Audio" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Music on" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Music on" }));
    expect(screen.getByRole("button", { name: "Music off" })).toBeInTheDocument();
    expect(window.localStorage.getItem("congcard:music-muted")).toBe("1");
    expect(window.localStorage.getItem("congcard:sound-muted")).toBeNull();
  });
});
