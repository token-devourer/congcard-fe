import { describe, expect, it, vi } from "vitest";
import { clearRoomSession, reconnectStorageKey, resumeStorageKey, roomSessionKeys } from "../src/lib/session";

describe("room session storage", () => {
  it("uses separate reconnect and resume keys", () => {
    expect(reconnectStorageKey("ABC123")).toBe("congcard:reconnect:ABC123");
    expect(resumeStorageKey("ABC123")).toBe("congcard:resume:ABC123");
    expect(roomSessionKeys("ABC123")).toEqual(["congcard:reconnect:ABC123", "congcard:resume:ABC123"]);
  });

  it("clears both room session tokens", () => {
    const storage = { removeItem: vi.fn() };

    clearRoomSession(storage, "ABC123");

    expect(storage.removeItem).toHaveBeenCalledWith("congcard:reconnect:ABC123");
    expect(storage.removeItem).toHaveBeenCalledWith("congcard:resume:ABC123");
  });
});
