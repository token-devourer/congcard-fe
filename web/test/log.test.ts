import { describe, expect, it } from "vitest";
import { translateLog, type Translate } from "../src/lib/log";
import idMessages from "../messages/id.json";
import enMessages from "../messages/en.json";

const t: Translate = (key, values) => `${key}|${JSON.stringify(values ?? {})}`;

// One sample per server log template (BE/src/engine/game.ts pushLog calls).
const ALL_TEMPLATES = [
  "A timed out and drew one card.",
  "A lost the challenge and drew six.",
  "A won the challenge.",
  "A took four cards.",
  "A must choose whether to challenge.",
  "A played red 7.",
  "A played blue skip.",
  "A played green reverse.",
  "A played yellow draw2.",
  "A played wild.",
  "A played wild4.",
  "A drew one card.",
  "A drew two cards.",
  "A passed after drawing.",
  "A called One.",
  "A was skipped.",
  "Turn direction changed.",
  "Active color is blue.",
  "A won the round with 42 points.",
  "Round 2 started.",
  "Discard pile was shuffled into the draw pile.",
  "A caught B.",
  "A joined the room.",
  "A left the room.",
  "A reconnected.",
  "A disconnected.",
  "A is not ready.",
  "A is ready.",
  "A was kicked from the room.",
  "A is now the host.",
  "Room settings were updated."
];

function strictT(messages: unknown, locale: string): Translate {
  return (key) => {
    const value = key.split(".").reduce<unknown>((node, part) => {
      if (node && typeof node === "object" && part in node) {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);

    if (typeof value !== "string") {
      throw new Error(`Missing message "${key}" in locale "${locale}"`);
    }
    return value;
  };
}

describe("translateLog", () => {
  it("translates a colored card play, composing the card name", () => {
    expect(translateLog("Zainal played red 7.", t)).toBe(
      'log.played|{"name":"Zainal","card":"log.cardWithColor|{\\"value\\":\\"7\\",\\"color\\":\\"colors.red|{}\\"}"}'
    );
  });

  it("translates a wild4 play without a color", () => {
    expect(translateLog("Zainal played wild4.", t)).toBe('log.played|{"name":"Zainal","card":"log.valWild4|{}"}');
  });

  it("does not swallow the timeout template with the generic draw one", () => {
    expect(translateLog("Player timed out and drew one card.", t)).toContain("log.timedOut");
    expect(translateLog("Player drew one card.", t)).toContain("log.drewOne");
  });

  it("distinguishes ready from not ready", () => {
    expect(translateLog("Player is ready.", t)).toContain("log.ready");
    expect(translateLog("Player is not ready.", t)).toContain("log.notReady");
  });

  it("passes unknown messages (emotes) through untouched", () => {
    expect(translateLog("Zainal: Hello!", t)).toBe("Zainal: Hello!");
  });

  it("has a translation in every locale for every server log template", () => {
    for (const [messages, locale] of [
      [idMessages, "id"],
      [enMessages, "en"]
    ] as const) {
      const lookup = strictT(messages, locale);
      for (const template of ALL_TEMPLATES) {
        // strictT throws if any referenced key is missing from the catalog
        expect(() => translateLog(template, lookup), `${locale}: ${template}`).not.toThrow();
      }
    }
  });
});
