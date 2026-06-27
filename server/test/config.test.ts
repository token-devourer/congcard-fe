import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("server configuration", () => {
  it("uses production-safe defaults", () => {
    expect(parseConfig({})).toEqual({
      nodeEnv: "development",
      port: 2567,
      corsOrigins: ["http://localhost:3000"],
      maxRooms: 100,
      turnTimeoutDefault: 30,
      reconnectGraceSec: 60,
      logLevel: "info",
      randomizeFlipPairs: false
    });
  });

  it("parses validated environment values and multiple origins", () => {
    expect(
      parseConfig({
        NODE_ENV: "production",
        PORT: "8080",
        CORS_ORIGINS: "https://one.example, https://two.example",
        MAX_ROOMS: "250",
        TURN_TIMEOUT_DEFAULT: "45",
        RECONNECT_GRACE_SEC: "90",
        LOG_LEVEL: "warn"
      })
    ).toMatchObject({
      nodeEnv: "production",
      port: 8080,
      corsOrigins: ["https://one.example", "https://two.example"],
      maxRooms: 250,
      turnTimeoutDefault: 45,
      reconnectGraceSec: 90,
      logLevel: "warn"
    });
  });

  it("rejects invalid numeric values", () => {
    expect(() => parseConfig({ PORT: "invalid" })).toThrow();
    expect(() => parseConfig({ TURN_TIMEOUT_DEFAULT: "2" })).toThrow();
  });
});
