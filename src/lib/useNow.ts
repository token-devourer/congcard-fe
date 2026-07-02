"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "./store";

// Server-synced clock: countdowns (turn timer, One/Catch windows) compare
// against server timestamps, so local Date.now() alone drifts on machines
// with a skewed clock. The snapshot's serverNow keeps everyone aligned.
//
// Pass `enabled: false` while nothing on screen needs a ticking clock — the
// interval (and the re-render it forces every tick) only runs when enabled.
// A disabled hook still returns the correct server-synced time for the
// render it is called in.
export function useNow(intervalMs = 250, enabled = true): number {
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);

  return (enabled ? now : Date.now()) + clockOffset;
}
