// Safe localStorage access. Reading or writing storage throws in private mode,
// when storage is disabled, or when over quota — and an uncaught throw here can
// blank the whole app. These wrappers degrade to no-ops instead.

export function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or full — ignore.
  }
}

export function safeRemove(key: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable — ignore.
  }
}

// A Storage-like shim for APIs that accept one (e.g. clearRoomSession).
export const safeStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: safeGet,
  setItem: safeSet,
  removeItem: safeRemove
};
