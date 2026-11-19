import { describe, expect, it } from "vitest";

import { SPEEDS } from "../constants";
import { getDotLength } from "../utils";

import { buildMessageTimeline, buildTimeline, getMorseTiming, Timeline } from "./timeline";

const TIMING = { unit: 1, characterGap: 3, wordGap: 7 };

/** The timeline as units, tones positive and silences negative, e.g. [1, -1, 3]. */
const toUnits = (timeline: Timeline, unit = 1) =>
  timeline.events.map((event) => {
    const length = Math.round(((event.end - event.start) / unit) * 1000) / 1000;
    return event.type === "tone" ? length : -length;
  });

describe("getMorseTiming", () => {
  it("uses the standard 1, 3 and 7 unit gaps", () => {
    for (const speed of SPEEDS) {
      const unit = getDotLength(speed) / 1000;
      for (const effectiveSpeed of [0, speed, speed + 20]) {
        const timing = getMorseTiming(speed, effectiveSpeed);
        expect(timing.unit).toBeCloseTo(unit, 12);
        expect(timing.characterGap).toBeCloseTo(3 * unit, 12);
        expect(timing.wordGap).toBeCloseTo(7 * unit, 12);
      }
      expect(getMorseTiming(speed)).toEqual(getMorseTiming(speed, 0));
    }
  });

  it("keeps the elements at the character speed with Farnsworth timing", () => {
    expect(getMorseTiming(120, 60).unit).toBeCloseTo(getDotLength(120) / 1000, 12);
  });

  it("stretches the character and word gaps in the ratio 3:7 with Farnsworth timing", () => {
    const standard = getMorseTiming(120, 0);
    const farnsworth = getMorseTiming(120, 60);
    expect(farnsworth.characterGap).toBeGreaterThan(standard.characterGap);
    expect(farnsworth.wordGap / farnsworth.characterGap).toBeCloseTo(7 / 3, 12);
  });

  it("reaches the effective speed with Farnsworth timing", () => {
    // PARIS followed by a word gap is 50 units long at the standard timing
    const paris = [[".--.", ".-", ".-.", "..", "..."]];
    for (const [characterSpeed, effectiveSpeed] of [
      [60, 40],
      [120, 60],
      [160, 40],
      [160, 140]
    ]) {
      const timing = getMorseTiming(characterSpeed, effectiveSpeed);
      const duration = buildTimeline(paris, timing).duration + timing.wordGap;
      expect(duration).toBeCloseTo((50 * getDotLength(effectiveSpeed)) / 1000, 9);
    }
  });
});

describe("buildTimeline", () => {
  it("has a dot of one unit and a dash of three units, with one unit between them", () => {
    expect(toUnits(buildTimeline([[".-"]], TIMING))).toEqual([1, -1, 3]);
  });

  it("does not add a gap after the last element", () => {
    const timeline = buildTimeline([["-.-."]], TIMING);
    expect(timeline.events.at(-1)?.type).toBe("tone");
    expect(timeline.duration).toBe(3 + 1 + 1 + 1 + 3 + 1 + 1);
  });

  it("has exactly three units between characters", () => {
    expect(toUnits(buildTimeline([[".", "-", ".."]], TIMING))).toEqual([1, -3, 3, -3, 1, -1, 1]);
  });

  it("has exactly seven units between words", () => {
    expect(toUnits(buildTimeline([[".", "."], ["-"], ["."]], TIMING))).toEqual([1, -3, 1, -7, 3, -7, 1]);
  });

  it("has contiguous events starting from zero", () => {
    const timeline = buildTimeline([[".-", "-..."], ["-.-."]], TIMING);
    expect(timeline.events[0].start).toBe(0);
    timeline.events.forEach((event, index) => {
      expect(event.end).toBeGreaterThan(event.start);
      if (index > 0) expect(event.start).toBe(timeline.events[index - 1].end);
    });
    expect(timeline.events.at(-1)?.end).toBe(timeline.duration);
  });

  it("gives the start time of each character", () => {
    const timeline = buildTimeline([[".", "-"], [".."]], TIMING);
    expect(timeline.characterStarts).toEqual([0, 1 + 3, 1 + 3 + 3 + 7]);
  });

  it("gives the start time of each word", () => {
    const timeline = buildTimeline([[".", "."], ["-"], ["."]], TIMING);
    expect(timeline.wordStarts).toEqual([0, 5 + 7, 5 + 7 + 3 + 7]);
  });
});

describe("buildMessageTimeline", () => {
  const unit = getDotLength(60) / 1000;

  it("frames the message with = = = and + VA", () => {
    const timeline = buildMessageTimeline([["E"]], 60);
    const equals = [3, -1, 1, -1, 1, -1, 1, -1, 3];
    const plus = [1, -1, 3, -1, 1, -1, 3, -1, 1];
    // VA is a prosign, sent without a character gap between the letters
    const va = [1, -1, 1, -1, 1, -1, 3, -1, 1, -1, 3];
    expect(toUnits(timeline, unit)).toEqual([...equals, -3, ...equals, -3, ...equals, -7, 1, -7, ...plus, -7, ...va]);
  });

  it("has three units between the characters of a group and seven between groups", () => {
    const timeline = buildMessageTimeline(
      [
        ["E", "T", "E", "T", "E"],
        ["T", "E"]
      ],
      60
    );
    const groups = toUnits(timeline, unit).slice(3 * 9 + 2 + 1, -(1 + 9 + 1 + 11));
    expect(groups).toEqual([1, -3, 3, -3, 1, -3, 3, -3, 1, -7, 3, -3, 1]);
  });

  it("gives the start time of each group", () => {
    const timeline = buildMessageTimeline([["E"], ["T"], ["E"]], 60);
    // "=" is 13 units long
    const prelude = 3 * 13 + 2 * 3 + 7;
    expect(timeline.groupStarts).toHaveLength(3);
    expect(timeline.groupStarts[0]).toBeCloseTo(prelude * unit, 9);
    expect(timeline.groupStarts[1]).toBeCloseTo((prelude + 1 + 7) * unit, 9);
    expect(timeline.groupStarts[2]).toBeCloseTo((prelude + 1 + 7 + 3 + 7) * unit, 9);
  });

  it("gives the start time of each character of the message, without the start and the end of the message", () => {
    const timeline = buildMessageTimeline([["E", "T"], ["E"]], 60);
    const prelude = 3 * 13 + 2 * 3 + 7;
    expect(timeline.messageCharacterStarts).toHaveLength(3);
    expect(timeline.messageCharacterStarts[0]).toBeCloseTo(prelude * unit, 9);
    expect(timeline.messageCharacterStarts[1]).toBeCloseTo((prelude + 1 + 3) * unit, 9);
    expect(timeline.messageCharacterStarts[2]).toBeCloseTo((prelude + 1 + 3 + 3 + 7) * unit, 9);
    expect(timeline.messageCharacterStarts[0]).toBe(timeline.groupStarts[0]);
  });

  it("only stretches the gaps between characters and groups with Farnsworth timing", () => {
    const unit = getDotLength(120) / 1000;
    const standard = toUnits(buildMessageTimeline([["A", "B"], ["C"]], 120), unit);
    const farnsworth = toUnits(buildMessageTimeline([["A", "B"], ["C"]], 120, 60), unit);
    const { characterGap, wordGap } = getMorseTiming(120, 60);
    const scale = (gap: number) => Math.round((gap / unit) * 1000) / 1000;

    expect(farnsworth).toEqual(
      standard.map((length) => (length === -3 ? -scale(characterGap) : length === -7 ? -scale(wordGap) : length))
    );
  });
});
