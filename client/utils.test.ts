import { describe, expect, it } from "vitest";

import { chunkArray, filterToMorse, getDotLength, getLineLength } from "./utils";

describe("getDotLength", () => {
  it("is the length of a dot in milliseconds at a speed in characters a minute", () => {
    expect(getDotLength(60)).toBeCloseTo(111.11, 2);
    expect(getDotLength(100)).toBeCloseTo(66.67, 2);
  });
});

describe("getLineLength", () => {
  it("is three dots", () => {
    expect(getLineLength(60)).toBeCloseTo(3 * getDotLength(60), 6);
  });
});

describe("chunkArray", () => {
  it("splits an array into groups, the last of which can be shorter", () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6, 7], 5)).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7]
    ]);
    expect(chunkArray([], 5)).toEqual([]);
  });
});

describe("filterToMorse", () => {
  it("tells whether a character has a Morse code", () => {
    expect(filterToMorse("A")).toBe(true);
    expect(filterToMorse("5")).toBe(true);
    expect(filterToMorse("a")).toBe(false);
    expect(filterToMorse("#")).toBe(false);
  });
});
