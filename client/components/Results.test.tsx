import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MorseCharacter } from "../types";

import Results from "./Results";

const messageOf = (length: number) => Array.from({ length }, (_, index) => "ABCDE"[index % 5] as MorseCharacter);

const texts = (selector: string) => Array.from(document.querySelectorAll(selector), (element) => element.textContent);

function setFullscreenSupport(enabled: boolean) {
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: enabled });
}

describe("Results", () => {
  afterEach(() => {
    cleanup();
    setFullscreenSupport(false);
    vi.restoreAllMocks();
  });

  it("numbers the rows of a full message like the form, by the first and the last character", () => {
    render(<Results message={messageOf(250)} />);

    expect(document.querySelectorAll(".Results-row")).toHaveLength(10);
    expect(texts(".Results-number:not(.Results-number-last)")).toEqual([
      "1",
      "26",
      "51",
      "76",
      "101",
      "126",
      "151",
      "176",
      "201",
      "226"
    ]);
    expect(texts(".Results-number-last")).toEqual(["25", "50", "75", "100", "125", "150", "175", "200", "225", "250"]);
  });

  it("has five rows for a half message", () => {
    render(<Results message={messageOf(125)} />);

    expect(texts(".Results-number:not(.Results-number-last)")).toEqual(["1", "26", "51", "76", "101"]);
    expect(texts(".Results-number-last")).toEqual(["25", "50", "75", "100", "125"]);
  });

  it("has five groups of five characters on a row, without numbers on the groups", () => {
    render(<Results message={messageOf(125)} />);

    const row = document.querySelector(".Results-row");
    expect(Array.from(row?.querySelectorAll(".Results-group") ?? [], (group) => group.textContent)).toEqual(
      Array(5).fill("ABCDE")
    );
    expect(document.querySelectorAll(".Results-group")).toHaveLength(25);
    expect(row?.children).toHaveLength(7);
  });

  it("shows the start and the end of the message, and the caption", () => {
    render(<Results caption="60 merkkiä/min" message={messageOf(125)} />);

    expect(screen.getByText("= = =")).toBeInTheDocument();
    expect(document.querySelector(".Results-footer")?.textContent).toBe("+ VA");
    expect(screen.getByText("VA")).toHaveClass("Results-prosign");
    expect(screen.getByText("60 merkkiä/min")).toBeInTheDocument();
  });

  it("does not offer the full screen where it is not supported", () => {
    render(<Results message={messageOf(125)} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the message in full screen and closes it", () => {
    setFullscreenSupport(true);
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const exitFullscreen = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;
    render(<Results message={messageOf(125)} />);

    fireEvent.click(screen.getByRole("button", { name: "Koko näyttö" }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen.mock.contexts[0]).toBe(document.querySelector(".Results"));

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.querySelector(".Results")
    });
    fireEvent(document, new Event("fullscreenchange"));

    fireEvent.click(screen.getByRole("button", { name: "Sulje koko näyttö" }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.getByRole("button", { name: "Koko näyttö" })).toBeInTheDocument();
  });

  describe("following the playback", () => {
    const classes = (selector: string) =>
      Array.from(document.querySelectorAll(selector), (element) => element.className);

    it("has no highlights when it does not follow the playback", () => {
      render(<Results message={messageOf(125)} />);
      expect(document.querySelector(".Results-following")).not.toBeInTheDocument();
      expect(document.querySelector(".Results-character-current, .Results-group-current")).not.toBeInTheDocument();
    });

    it("has nothing highlighted before the first character", () => {
      render(<Results currentCharacter={0} message={messageOf(125)} />);
      expect(document.querySelector(".Results-following")).toBeInTheDocument();
      expect(document.querySelector(".Results-character-current, .Results-group-current")).not.toBeInTheDocument();
    });

    it("highlights the character and the group being played, and dims what has been played", () => {
      // The 7th character is the second one of the second group
      render(<Results currentCharacter={7} message={messageOf(125)} />);

      const characters = classes(".Results-character");
      expect(characters.slice(0, 6).every((name) => name.includes("Results-character-played"))).toBe(true);
      expect(characters[6]).toContain("Results-character-current");
      expect(characters[7]).toBe("Results-character");
      expect(document.querySelectorAll(".Results-character-current")).toHaveLength(1);

      const groups = classes(".Results-group");
      expect(groups[1]).toContain("Results-group-current");
      expect(groups.filter((name) => name.includes("Results-group-current"))).toHaveLength(1);
      expect(classes(".Results-row")[0]).toContain("Results-row-current");
    });

    it("moves to the next row with the playback", () => {
      const view = render(<Results currentCharacter={25} message={messageOf(125)} />);
      expect(classes(".Results-row")[0]).toContain("Results-row-current");

      view.rerender(<Results currentCharacter={26} message={messageOf(125)} />);
      expect(classes(".Results-row")[0]).not.toContain("Results-row-current");
      expect(classes(".Results-row")[1]).toContain("Results-row-current");
    });

    it("has everything played at the end of the message", () => {
      render(<Results currentCharacter={126} message={messageOf(125)} />);
      expect(document.querySelectorAll(".Results-character-played")).toHaveLength(125);
      expect(document.querySelector(".Results-character-current, .Results-group-current")).not.toBeInTheDocument();
    });
  });

  describe("checked answer", () => {
    const message = messageOf(125);

    it("has no marks without an answer", () => {
      render(<Results message={message} />);
      expect(document.querySelector(".Results-marked, .Results-character-wrong")).not.toBeInTheDocument();
    });

    it("shows a correct answer as the message", () => {
      render(<Results answers={[...message]} message={message} />);
      expect(document.querySelector(".Results-marked")).toBeInTheDocument();
      expect(document.querySelector(".Results-character-wrong")).not.toBeInTheDocument();
      expect(document.querySelector(".Results-group")?.textContent).toBe("ABCDE");
    });

    it("marks a wrong character and shows the right one above it", () => {
      const answers = [...message] as string[];
      answers[1] = "X";
      render(<Results answers={answers} message={message} />);

      const wrong = document.querySelectorAll(".Results-character-wrong");
      expect(wrong).toHaveLength(1);
      expect(wrong[0].querySelector(".Results-correct")?.textContent).toBe("B");
      expect(wrong[0].lastChild?.textContent).toBe("X");
      expect(document.querySelectorAll(".Results-character")[1]).toBe(wrong[0]);
    });

    it("marks a skipped character and what was not written at all with a dash", () => {
      render(<Results answers={["A", "", "C"]} message={message} />);

      const wrong = document.querySelectorAll(".Results-character-wrong");
      expect(wrong).toHaveLength(123);
      expect(wrong[0].querySelector(".Results-correct")?.textContent).toBe("B");
      expect(wrong[0].lastChild?.textContent).toBe("–");
      expect(wrong[122].lastChild?.textContent).toBe("–");
    });
  });
});
