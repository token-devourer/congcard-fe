import { describe, expect, it } from "vitest";
import { formatRoomCodeInput, parseRoomCode } from "../src/lib/roomCode";

describe("room code guards", () => {
  it("normalizes allowed room code input and strips invalid characters", () => {
    expect(formatRoomCodeInput(" ab c-234!! ")).toBe("ABC234");
    expect(formatRoomCodeInput("o0i1zzzz")).toBe("ZZZZ");
  });

  it("parses only valid six-character room codes", () => {
    expect(parseRoomCode("abc234")).toBe("ABC234");
    expect(parseRoomCode("ABC12!")).toBeNull();
    expect(parseRoomCode("ABC12")).toBeNull();
  });
});
