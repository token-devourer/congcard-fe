"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "./store";

// Server-synced clock: countdowns (turn timer, One/Catch windows) compare
// against server timestamps, so local Date.now() alone drifts on machines
// with a skewed clock. The snapshot's serverNow keeps everyone aligned.
export function useNow(intervalMs = 250): number {
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now + clockOffset;
}
