"use client";

import { useEffect } from "react";
import type { GameSnapshot } from "@congcard/shared";
import { musicSceneForSnapshot, setMusicScene, setMusicSuspended, unlockMusic } from "@/lib/music";

export function MusicLayer({ snapshot }: { snapshot: GameSnapshot | null }) {
  const scene = musicSceneForSnapshot(snapshot);

  useEffect(() => {
    setMusicScene(scene);
  }, [scene]);

  useEffect(() => {
    const unlock = () => unlockMusic();
    const syncVisibility = () => setMusicSuspended(document.hidden);

    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    document.addEventListener("keydown", unlock, { once: true, capture: true });
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();

    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", syncVisibility);
      setMusicScene(null);
    };
  }, []);

  return null;
}
