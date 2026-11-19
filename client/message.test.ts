import { describe, expect, it } from "vitest";

import { ALPHABETS, CHARACTER_SETS, LENGTHS, NUMBERS, UMLAUTS } from "./constants";
import { createMessage } from "./message";

/** A repeatable sequence of numbers between 0 and 1. */
function sequence(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe("createMessage", () => {
  it("has the given length with every character set", () => {
    for (const { value } of CHARACTER_SETS) {
      for (const length of LENGTHS) {
        expect(createMessage(value, length)).toHaveLength(length);
      }
    }
  });

  it("only has characters of the set", () => {
    for (const { value } of CHARACTER_SETS) {
      createMessage(value, 250, sequence()).forEach((character) => expect(value).toContain(character));
    }
  });

  it("only has numbers in a message of numbers", () => {
    expect(createMessage(NUMBERS, 125).join("")).toMatch(/^[0-9]{125}$/);
  });

  it("only has letters in a message of letters", () => {
    expect(createMessage(ALPHABETS, 125).join("")).toMatch(/^[A-Z]{125}$/);
  });

  it("has every character of a larger set at least once in 125 characters", () => {
    const characters = ALPHABETS + NUMBERS + UMLAUTS;
    for (let seed = 1; seed <= 20; seed += 1) {
      const half = createMessage(characters, 125, sequence(seed));
      const full = createMessage(characters, 250, sequence(seed));
      Array.from(characters).forEach((character) => {
        expect(half).toContain(character);
        expect(full.filter((other) => other === character).length).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it("is mostly letters also with a larger set", () => {
    const message = createMessage(ALPHABETS + NUMBERS + UMLAUTS, 250, sequence());
    const others = message.filter((character) => !ALPHABETS.includes(character));
    expect(others).toHaveLength(2 * (NUMBERS + UMLAUTS).length);
  });

  it("gives the same message for the same random numbers", () => {
    expect(createMessage(ALPHABETS + NUMBERS, 125, sequence(7))).toEqual(
      createMessage(ALPHABETS + NUMBERS, 125, sequence(7))
    );
  });
});
