import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { MORSE_CODES } from "../constants";

import MorseTree from "./MorseTree";

const node = (pattern: string) => document.querySelector(`[data-pattern="${pattern}"]`);
const stateOf = (pattern: string) =>
  node(pattern)?.getAttribute("class")?.replace("MorseTree-node MorseTree-node-", "");
const position = (pattern: string) => {
  const circle = node(pattern)?.querySelector("circle");
  return { x: Number(circle?.getAttribute("cx")), y: Number(circle?.getAttribute("cy")) };
};

describe("MorseTree", () => {
  afterEach(() => {
    cleanup();
  });

  it("has every character of the app in its place", () => {
    render(<MorseTree pattern="" />);
    Object.entries(MORSE_CODES).forEach(([character, pattern]) => {
      expect(node(pattern)?.textContent).toBe(character);
    });
  });

  it("has a dot to the left and a dash to the right, a level lower for each element", () => {
    render(<MorseTree pattern="" />);
    expect(position(".").x).toBeLessThan(position("").x);
    expect(position("-").x).toBeGreaterThan(position("").x);
    expect(position("..").x).toBeLessThan(position(".-").x);
    expect(position(".").y).toBeGreaterThan(position("").y);
    expect(position("...").y).toBeGreaterThan(position("..").y);
  });

  it("has nothing lit before anything is sent", () => {
    render(<MorseTree pattern="" />);
    expect(document.querySelectorAll(".MorseTree-node-off")).toHaveLength(
      document.querySelectorAll(".MorseTree-node").length - 1
    );
    expect(document.querySelectorAll(".MorseTree-edge-lit")).toHaveLength(0);
  });

  it("lights the path one element at a time: E, I, S, H", () => {
    const view = render(<MorseTree pattern="." />);
    expect(stateOf(".")).toBe("current");
    expect(stateOf("..")).toBe("off");

    view.rerender(<MorseTree pattern="..." />);
    expect(stateOf(".")).toBe("lit");
    expect(stateOf("..")).toBe("lit");
    expect(stateOf("...")).toBe("current");
    expect(stateOf("....")).toBe("off");
    expect(stateOf("-")).toBe("off");
    expect(document.querySelectorAll(".MorseTree-edge-lit")).toHaveLength(3);

    view.rerender(<MorseTree pattern="...." />);
    expect(stateOf("....")).toBe("current");
  });

  it("lights the path to a number on the fifth level", () => {
    render(<MorseTree pattern="....." />);
    expect(stateOf(".....")).toBe("current");
    expect(document.querySelectorAll(".MorseTree-edge-lit")).toHaveLength(5);
  });

  it("lights the path as far as it goes when the pattern is not a character", () => {
    render(<MorseTree pattern="......" />);
    expect(stateOf(".....")).toBe("lit");
    expect(document.querySelectorAll(".MorseTree-node-current")).toHaveLength(0);
  });

  it("shows a completed character as right or wrong", () => {
    const view = render(<MorseTree completed={{ pattern: "...", correct: true }} pattern="" />);
    expect(stateOf("...")).toBe("right");

    view.rerender(<MorseTree completed={{ pattern: "...", correct: false }} pattern="" />);
    expect(stateOf("...")).toBe("wrong");
  });
});
