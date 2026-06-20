export type ShortcutKey = "d" | "p" | "o" | "c" | "b" | "r" | "escape";

export type GameShortcutCommand =
  | { type: "draw" }
  | { type: "pass" }
  | { type: "callOne" }
  | { type: "catchOne"; targetId: string }
  | { type: "toggleBatch" }
  | { type: "openRules" }
  | { type: "closeColorPicker" }
  | { type: "closeBatch" };

export interface GameShortcutContext {
  enabled: boolean;
  canDraw: boolean;
  canPass: boolean;
  canCallOne: boolean;
  catchTargetId?: string;
  canBatch: boolean;
  batchSelecting: boolean;
  canOpenRules: boolean;
  colorPickerOpen: boolean;
}

export interface ShortcutWindow {
  opensAt: number;
  deadline: number;
  callPending?: boolean;
}

export function isShortcutWindowOpen(window: ShortcutWindow | undefined, now: number): boolean {
  return Boolean(window && !window.callPending && now >= window.opensAt && now <= window.deadline);
}

export function shortcutKey(event: KeyboardEvent): ShortcutKey | null {
  const key = event.key.toLowerCase();
  return key === "d" || key === "p" || key === "o" || key === "c" || key === "b" || key === "r" || key === "escape"
    ? key
    : null;
}

export function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
    return true;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest("input, select, textarea, [contenteditable]:not([contenteditable='false'])"));
}

export function resolveGameShortcut(key: ShortcutKey, context: GameShortcutContext): GameShortcutCommand | null {
  if (!context.enabled) {
    return null;
  }

  if (key === "escape") {
    if (context.colorPickerOpen) {
      return { type: "closeColorPicker" };
    }
    if (context.batchSelecting) {
      return { type: "closeBatch" };
    }
    return null;
  }

  if (key === "d" && context.canDraw) {
    return { type: "draw" };
  }
  if (key === "p" && context.canPass) {
    return { type: "pass" };
  }
  if (key === "o" && context.canCallOne) {
    return { type: "callOne" };
  }
  if (key === "c" && context.catchTargetId) {
    return { type: "catchOne", targetId: context.catchTargetId };
  }
  if (key === "b" && (context.canBatch || context.batchSelecting)) {
    return { type: "toggleBatch" };
  }
  if (key === "r" && context.canOpenRules) {
    return { type: "openRules" };
  }

  return null;
}
