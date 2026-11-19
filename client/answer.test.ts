import { describe, expect, it } from "vitest";

import { markAnswer, parseAnswer } from "./answer";

describe("parseAnswer", () => {
  it("has an entry for each character", () => {
    expect(parseAnswer("ABC12", 125)).toEqual(["A", "B", "C", "1", "2"]);
  });

  it("takes small letters as capitals, also the Finnish ones", () => {
    expect(parseAnswer("abcåäöü", 125)).toEqual(["A", "B", "C", "Å", "Ä", "Ö", "Ü"]);
  });

  it("has an empty entry for a character skipped with a space", () => {
    expect(parseAnswer("A C  ", 125)).toEqual(["A", "", "C", "", ""]);
  });

  it("ignores what cannot be in a message", () => {
    expect(parseAnswer("A.b,?\n=+é-C", 125)).toEqual(["A", "B", "C"]);
  });

  it("is never longer than the message", () => {
    expect(parseAnswer("ABCDEFG", 5)).toEqual(["A", "B", "C", "D", "E"]);
    expect(parseAnswer("       ", 3)).toEqual(["", "", ""]);
  });

  it("is empty when nothing is written", () => {
    expect(parseAnswer("", 125)).toEqual([]);
  });
});

describe("markAnswer", () => {
  it("counts the correct, the wrong and the empty characters", () => {
    expect(markAnswer(["A", "B", "C", "D", "E"], ["A", "X", "", "D"])).toEqual({ correct: 2, wrong: 1, empty: 2 });
  });

  it("counts everything as empty when nothing was written", () => {
    expect(markAnswer(["A", "B"], [])).toEqual({ correct: 0, wrong: 0, empty: 2 });
  });

  it("counts everything as correct when the answer is the message", () => {
    expect(markAnswer(["A", "B"], ["A", "B"])).toEqual({ correct: 2, wrong: 0, empty: 0 });
  });
});
