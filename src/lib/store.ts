"use client";

import { create } from "zustand";
import type { GameSnapshot } from "@kartu-satu/shared";

interface RoomStore {
  snapshot: GameSnapshot | null;
  error: string;
  setSnapshot: (snapshot: GameSnapshot | null) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  snapshot: null,
  error: "",
  setSnapshot: (snapshot) => set({ snapshot }),
  setError: (error) => set({ error }),
  reset: () => set({ snapshot: null, error: "" })
}));
