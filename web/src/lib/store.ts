"use client";

import { create } from "zustand";
import type { GameSnapshot } from "@congcard/shared";
import { diffSnapshots, eventActionLockMs, isVisibleUiEvent, type UiEvent } from "./events";
import { playUiEventSounds } from "./sound";

export interface RoomError {
  id: number;
  message: string;
  code?: string;
}

interface RoomStore {
  snapshot: GameSnapshot | null;
  events: UiEvent[];
  error: RoomError | null;
  /** serverNow - Date.now(); add to local time to get server time. */
  clockOffset: number;
  eventLockUntil: number;
  setSnapshot: (snapshot: GameSnapshot | null) => void;
  dismissEvent: (id: number) => void;
  setError: (message: string, code?: string) => void;
  reset: () => void;
}

const MAX_VISIBLE_EVENTS = 4;

let nextErrorId = 0;

export const useRoomStore = create<RoomStore>((set, get) => ({
  snapshot: null,
  events: [],
  error: null,
  clockOffset: 0,
  eventLockUntil: 0,
  setSnapshot: (snapshot) => {
    if (!snapshot) {
      set({ snapshot: null, eventLockUntil: 0 });
      return;
    }

    const fresh = diffSnapshots(get().snapshot, snapshot);
    const visibleEvents = fresh.filter(isVisibleUiEvent);
    const eventLockMs = eventActionLockMs(fresh);
    const nextClockOffset = typeof snapshot.serverNow === "number" ? snapshot.serverNow - Date.now() : get().clockOffset;
    playUiEventSounds(fresh, nextClockOffset);
    set((state) => ({
      snapshot,
      clockOffset: nextClockOffset,
      eventLockUntil: eventLockMs > 0 ? Math.max(state.eventLockUntil, Date.now() + eventLockMs) : state.eventLockUntil,
      events: [...state.events, ...visibleEvents].slice(-MAX_VISIBLE_EVENTS)
    }));
  },
  dismissEvent: (id) => set((state) => ({ events: state.events.filter((event) => event.id !== id) })),
  setError: (message, code) => {
    if (!message) {
      set({ error: null });
      return;
    }

    nextErrorId += 1;
    set({ error: { id: nextErrorId, message, ...(code ? { code } : {}) } });
  },
  reset: () => set({ snapshot: null, events: [], error: null, clockOffset: 0, eventLockUntil: 0 })
}));
