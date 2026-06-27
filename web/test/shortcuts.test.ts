import { describe, expect, it } from "vitest";
import {
  isShortcutWindowOpen,
  resolveGameShortcut,
  shortcutKey,
  shouldIgnoreShortcut,
  type GameShortcutContext
} from "../src/lib/shortcuts";

const available: GameShortcutContext = {
  enabled: true,
  canDraw: true,
  canPass: true,
  canCallOne: true,
  catchTargetId: "target",
  canJumpIn: true,
  canBatch: true,
  batchSelecting: false,
  canOpenRules: true,
  colorPickerOpen: false
};

describe("keyboard shortcuts", () => {
  it("maps every supported action through explicit eligibility", () => {
    expect(resolveGameShortcut("d", available)).toEqual({ type: "draw" });
    expect(resolveGameShortcut("p", available)).toEqual({ type: "pass" });
    expect(resolveGameShortcut("o", available)).toEqual({ type: "callOne" });
    expect(resolveGameShortcut("c", available)).toEqual({ type: "catchOne", targetId: "target" });
    expect(resolveGameShortcut("j", available)).toEqual({ type: "jumpIn" });
    expect(resolveGameShortcut("b", available)).toEqual({ type: "toggleBatch" });
    expect(resolveGameShortcut("r", available)).toEqual({ type: "openRules" });
  });

  it("blocks all actions when the room setting is disabled", () => {
    for (const key of ["d", "p", "o", "c", "j", "b", "r", "escape"] as const) {
      expect(resolveGameShortcut(key, { ...available, enabled: false, colorPickerOpen: true })).toBeNull();
    }
  });

  it("does not invoke a disabled related action", () => {
    const blocked = {
      ...available,
      canDraw: false,
      canPass: false,
      canCallOne: false,
      catchTargetId: undefined,
      canJumpIn: false,
      canBatch: false,
      canOpenRules: false
    };

    for (const key of ["d", "p", "o", "c", "j", "b", "r"] as const) {
      expect(resolveGameShortcut(key, blocked)).toBeNull();
    }
  });

  it("closes the color picker before batch selection", () => {
    expect(resolveGameShortcut("escape", { ...available, colorPickerOpen: true, batchSelecting: true })).toEqual({
      type: "closeColorPicker"
    });
    expect(resolveGameShortcut("escape", { ...available, batchSelecting: true })).toEqual({ type: "closeBatch" });
  });

  it("opens One and Catch only inside the authoritative fairness window", () => {
    const window = { opensAt: 1_000, deadline: 4_000 };

    expect(isShortcutWindowOpen(window, 999)).toBe(false);
    expect(isShortcutWindowOpen(window, 1_000)).toBe(true);
    expect(isShortcutWindowOpen(window, 4_000)).toBe(true);
    expect(isShortcutWindowOpen(window, 4_001)).toBe(false);
    expect(isShortcutWindowOpen({ ...window, callPending: true }, 2_000)).toBe(false);
  });

  it("normalizes supported keys and ignores unknown keys", () => {
    expect(shortcutKey(new KeyboardEvent("keydown", { key: "D" }))).toBe("d");
    expect(shortcutKey(new KeyboardEvent("keydown", { key: "J" }))).toBe("j");
    expect(shortcutKey(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("escape");
    expect(shortcutKey(new KeyboardEvent("keydown", { key: "1" }))).toBeNull();
  });

  it("ignores modified, repeated, and editable-target events", () => {
    expect(shouldIgnoreShortcut(new KeyboardEvent("keydown", { key: "d", ctrlKey: true }))).toBe(true);
    expect(shouldIgnoreShortcut(new KeyboardEvent("keydown", { key: "d", altKey: true }))).toBe(true);
    expect(shouldIgnoreShortcut(new KeyboardEvent("keydown", { key: "d", metaKey: true }))).toBe(true);
    expect(shouldIgnoreShortcut(new KeyboardEvent("keydown", { key: "d", repeat: true }))).toBe(true);

    const input = document.createElement("input");
    const inputEvent = new KeyboardEvent("keydown", { key: "d", bubbles: true });
    input.addEventListener("keydown", (event) => expect(shouldIgnoreShortcut(event)).toBe(true));
    input.dispatchEvent(inputEvent);

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const editableEvent = new KeyboardEvent("keydown", { key: "d", bubbles: true });
    editable.addEventListener("keydown", (event) => expect(shouldIgnoreShortcut(event)).toBe(true));
    editable.dispatchEvent(editableEvent);
  });
});
