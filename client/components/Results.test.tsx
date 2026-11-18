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
});
