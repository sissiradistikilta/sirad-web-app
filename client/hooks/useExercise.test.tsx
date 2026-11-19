import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { MorseCharacter } from "../types";

import useExercise, { WRONG_TIME } from "./useExercise";

const MESSAGE: MorseCharacter[] = ["E", "T", "A"];
const PATTERNS = { E: ".", T: "-", A: ".-" };

describe("useExercise", () => {
  const render = () => renderHook(() => useExercise(MESSAGE));

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does nothing before it is started", () => {
    const hook = render();
    act(() => hook.result.current.send(PATTERNS.E));
    expect(hook.result.current).toMatchObject({ errors: 0, position: 0, result: null, running: false });
  });

  it("moves on to the next character when the character is right", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.send(PATTERNS.E));
    expect(hook.result.current).toMatchObject({ errors: 0, position: 1, running: true, wrong: false });
  });

  it("stays on the character and shows it as wrong for a moment when the character is wrong", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.send(PATTERNS.T));
    expect(hook.result.current).toMatchObject({ errors: 1, position: 0, wrong: true });

    act(() => {
      vi.advanceTimersByTime(WRONG_TIME);
    });
    expect(hook.result.current).toMatchObject({ errors: 1, position: 0, wrong: false });
  });

  it("counts a pattern that is not a character as an error", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.send("........"));
    expect(hook.result.current).toMatchObject({ errors: 1, position: 0, wrong: true });
  });

  it("is no longer wrong when the right character is sent", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.send(PATTERNS.A));
    act(() => hook.result.current.send(PATTERNS.E));
    expect(hook.result.current).toMatchObject({ errors: 1, position: 1, wrong: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends with the result when the whole message is sent", () => {
    const hook = render();
    act(() => hook.result.current.start());
    // The time starts from the first press of the key: 3 characters in 6 seconds
    act(() => hook.result.current.keyDown(1000));
    act(() => hook.result.current.keyDown(2000));
    act(() => hook.result.current.send(PATTERNS.E, 3000));
    act(() => hook.result.current.send(PATTERNS.E, 4000));
    act(() => hook.result.current.send(PATTERNS.T, 5000));
    act(() => hook.result.current.send(PATTERNS.A, 7000));

    expect(hook.result.current.running).toBe(false);
    expect(hook.result.current.result).toEqual({ characters: 3, errors: 1, seconds: 6, speed: 30 });
  });

  it("gives the result so far when stopped", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.keyDown(performance.now()));
    act(() => hook.result.current.send(PATTERNS.E));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => hook.result.current.stop());

    expect(hook.result.current.running).toBe(false);
    expect(hook.result.current.result).toEqual({ characters: 1, errors: 0, seconds: 2, speed: 30 });
  });

  it("has no time or speed if the key was never pressed", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.stop());
    expect(hook.result.current.result).toEqual({ characters: 0, errors: 0, seconds: 0, speed: 0 });
  });

  it("starts again from the beginning", () => {
    const hook = render();
    act(() => hook.result.current.start());
    act(() => hook.result.current.send(PATTERNS.T));
    act(() => hook.result.current.send(PATTERNS.E));
    act(() => hook.result.current.stop());
    act(() => hook.result.current.start());

    expect(hook.result.current).toMatchObject({ errors: 0, position: 0, result: null, running: true, wrong: false });
  });
});
