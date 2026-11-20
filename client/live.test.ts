import { describe, expect, it } from "vitest";

import { formatFrequency, parseFrequency } from "./live";

describe("parseFrequency", () => {
  it("reads megahertz with a point or a comma", () => {
    expect(parseFrequency("3.6850")).toBe(3685000);
    expect(parseFrequency("3,685")).toBe(3685000);
    expect(parseFrequency("03.6850")).toBe(3685000);
    expect(parseFrequency(" 7 ")).toBe(7000000);
    expect(parseFrequency("14.")).toBe(14000000);
    expect(parseFrequency("1.5001")).toBe(1500100);
  });

  it("refuses what is not a frequency of the band", () => {
    expect(parseFrequency("")).toBeNull();
    expect(parseFrequency("abc")).toBeNull();
    expect(parseFrequency("1.4999")).toBeNull();
    expect(parseFrequency("30.0001")).toBeNull();
    expect(parseFrequency("3.68505")).toBeNull();
    expect(parseFrequency("-3.5")).toBeNull();
  });
});

describe("formatFrequency", () => {
  it("shows megahertz with four decimals", () => {
    expect(formatFrequency(3685000)).toBe("3.6850");
    expect(formatFrequency(14000000)).toBe("14.0000");
  });
});
