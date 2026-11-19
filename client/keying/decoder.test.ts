import { describe, expect, it } from "vitest";

import { MORSE_CODES } from "../constants";

import MorseDecoder, { patternToCharacter } from "./decoder";

const UNIT = 100;

/**
 * Keys a pattern with the given element and gap lengths in units, starting at the given time.
 * Returns the time when the key went up for the last time.
 */
function send(decoder: MorseDecoder, pattern: string, start = 0, { dot = 1, dash = 3, gap = 1 } = {}) {
  let time = start;
  Array.from(pattern).forEach((element, index) => {
    if (index > 0) time += gap * UNIT;
    decoder.keyDown(time);
    time += (element === "-" ? dash : dot) * UNIT;
    decoder.keyUp(time);
  });
  return time;
}

describe("patternToCharacter", () => {
  it("finds every character of the app", () => {
    Object.entries(MORSE_CODES).forEach(([character, pattern]) => {
      expect(patternToCharacter(pattern)).toBe(character);
    });
  });

  it("does not know other patterns", () => {
    expect(patternToCharacter("......")).toBeUndefined();
    expect(patternToCharacter("")).toBeUndefined();
  });
});

describe("MorseDecoder", () => {
  it("makes a dot of a short press and a dash of a long one", () => {
    const decoder = new MorseDecoder(UNIT);
    decoder.keyDown(0);
    expect(decoder.keyUp(100)).toBe(".");
    decoder.keyDown(200);
    expect(decoder.keyUp(500)).toBe("-");
    expect(decoder.pattern).toBe(".-");
  });

  it("has the limit between a dot and a dash at two units", () => {
    const decoder = new MorseDecoder(UNIT);
    decoder.keyDown(0);
    expect(decoder.keyUp(199)).toBe(".");
    decoder.keyDown(300);
    expect(decoder.keyUp(500)).toBe("-");
  });

  it("builds the character one element at a time: E, I, S, H", () => {
    const decoder = new MorseDecoder(UNIT);
    const seen: (string | undefined)[] = [];
    let time = 0;
    for (let element = 0; element < 4; element += 1) {
      decoder.keyDown(time);
      decoder.keyUp(time + UNIT);
      seen.push(patternToCharacter(decoder.pattern));
      time += 2 * UNIT;
    }
    expect(seen).toEqual(["E", "I", "S", "H"]);
  });

  it("ends the character when the pause has been long enough", () => {
    const decoder = new MorseDecoder(UNIT);
    const end = send(decoder, "...");

    expect(decoder.deadline).toBe(end + 2 * UNIT);
    expect(decoder.poll(end + 2 * UNIT - 1)).toBeNull();
    expect(decoder.pattern).toBe("...");
    expect(decoder.poll(end + 2 * UNIT)).toBe("...");
    expect(decoder.pattern).toBe("");
    expect(decoder.deadline).toBeNull();
    expect(decoder.poll(end + 10 * UNIT)).toBeNull();
  });

  it("starts a new character after a long pause: S and then E", () => {
    const decoder = new MorseDecoder(UNIT);
    const end = send(decoder, "...");

    // The key is pressed again before anything has asked whether the character ended
    expect(decoder.keyDown(end + 3 * UNIT)).toBe("...");
    decoder.keyUp(end + 4 * UNIT);
    expect(decoder.pattern).toBe(".");
  });

  it("continues the character after a short pause", () => {
    const decoder = new MorseDecoder(UNIT);
    const end = send(decoder, "...");

    expect(decoder.keyDown(end + UNIT)).toBeNull();
    decoder.keyUp(end + 2 * UNIT);
    expect(decoder.pattern).toBe("....");
  });

  it("does not end the character while the key is down", () => {
    const decoder = new MorseDecoder(UNIT);
    const end = send(decoder, ".");
    decoder.keyDown(end + UNIT);

    expect(decoder.keyIsDown).toBe(true);
    expect(decoder.deadline).toBeNull();
    expect(decoder.poll(end + 20 * UNIT)).toBeNull();
    decoder.keyUp(end + 21 * UNIT);
    expect(decoder.pattern).toBe(".-");
  });

  it("decodes every character sent with the standard timing", () => {
    const decoder = new MorseDecoder(UNIT);
    let time = 0;
    Object.entries(MORSE_CODES).forEach(([character, pattern]) => {
      const end = send(decoder, pattern, time);
      const completed = decoder.poll(end + 3 * UNIT);
      expect(completed && patternToCharacter(completed)).toBe(character);
      time = end + 3 * UNIT;
    });
  });

  it("tolerates sloppy timing", () => {
    const decoder = new MorseDecoder(UNIT);
    // Long dots, short dashes and uneven gaps
    const end = send(decoder, "-.-.", 0, { dot: 1.6, dash: 2.3, gap: 1.7 });
    expect(decoder.poll(end + 2.2 * UNIT)).toBe("-.-.");
  });

  it("ignores a repeated key down and a key up without a key down", () => {
    const decoder = new MorseDecoder(UNIT);
    expect(decoder.keyUp(50)).toBeNull();
    decoder.keyDown(100);
    expect(decoder.keyDown(150)).toBeNull();
    expect(decoder.keyUp(200)).toBe(".");
    expect(decoder.pattern).toBe(".");
  });

  it("takes the limits as options", () => {
    const decoder = new MorseDecoder(UNIT, { dashLimit: 2.5, characterGapLimit: 4 });
    decoder.keyDown(0);
    expect(decoder.keyUp(240)).toBe(".");
    expect(decoder.poll(240 + 399)).toBeNull();
    expect(decoder.poll(240 + 400)).toBe(".");
  });

  it("forgets the character when reset", () => {
    const decoder = new MorseDecoder(UNIT);
    send(decoder, ".-");
    decoder.keyDown(1000);
    decoder.reset();

    expect(decoder.pattern).toBe("");
    expect(decoder.keyIsDown).toBe(false);
    expect(decoder.deadline).toBeNull();
  });
});
