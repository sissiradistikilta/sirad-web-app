import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { AudioContextMock } from "../../test/audio-context-mock";

import useKeyer from "./useKeyer";

// At 60 characters a minute a dot is 60000 / (9 * 60) ms
const UNIT = 60000 / 540;

describe("useKeyer", () => {
  let onCharacter: ReturnType<typeof vi.fn<(pattern: string) => void>>;

  const render = (characterSpeed = 60) =>
    renderHook((props) => useKeyer(props.characterSpeed, onCharacter), { initialProps: { characterSpeed } });

  /** Presses the key for the given number of units, at the current time of the fake clock. */
  function press(hook: ReturnType<typeof render>, units: number) {
    act(() => hook.result.current.keyDown(performance.now()));
    act(() => {
      vi.advanceTimersByTime(units * UNIT);
    });
    act(() => hook.result.current.keyUp(performance.now()));
  }

  const wait = (units: number) =>
    act(() => {
      vi.advanceTimersByTime(units * UNIT);
    });

  beforeEach(() => {
    AudioContextMock.instances = [];
    vi.useFakeTimers();
    onCharacter = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the character being sent, element by element", () => {
    const hook = render();
    press(hook, 1);
    expect(hook.result.current.pattern).toBe(".");
    wait(1);
    press(hook, 3);
    expect(hook.result.current.pattern).toBe(".-");
    expect(onCharacter).not.toHaveBeenCalled();
  });

  it("ends the character after the pause", () => {
    const hook = render();
    press(hook, 1);
    wait(1);
    press(hook, 3);
    wait(1.9);
    expect(onCharacter).not.toHaveBeenCalled();

    wait(0.2);
    expect(onCharacter.mock.calls).toEqual([[".-"]]);
    expect(hook.result.current.pattern).toBe("");
  });

  it("sends S and then E when there is a longer pause after the third dot", () => {
    const hook = render();
    for (let dot = 0; dot < 3; dot += 1) {
      press(hook, 1);
      wait(1);
    }
    wait(2);
    press(hook, 1);
    wait(3);

    expect(onCharacter.mock.calls).toEqual([["..."], ["."]]);
  });

  it("shows when the key is down and sounds the tone", () => {
    const hook = render();
    act(() => hook.result.current.keyDown(performance.now()));
    expect(hook.result.current.keyIsDown).toBe(true);
    act(() => hook.result.current.keyUp(performance.now() + 100));
    expect(hook.result.current.keyIsDown).toBe(false);

    const events = AudioContextMock.instances[0].gains[0].gain.events;
    expect(events.map((event) => event.value)).toEqual([0.8, 0]);
  });

  it("follows the speed", () => {
    const hook = render(120);
    // 1.5 units at 60 characters a minute is a dash at 120
    press(hook, 1.5);
    expect(hook.result.current.pattern).toBe("-");
  });

  it("starts from a clean state when the speed changes or it is reset", () => {
    const hook = render();
    press(hook, 1);
    hook.rerender({ characterSpeed: 100 });
    expect(hook.result.current.pattern).toBe("");

    press(hook, 1);
    act(() => hook.result.current.reset());
    wait(10);
    expect(hook.result.current.pattern).toBe("");
    expect(onCharacter).not.toHaveBeenCalled();
  });

  it("releases the audio and the timer when unmounted", () => {
    const hook = render();
    press(hook, 1);
    hook.unmount();

    expect(AudioContextMock.instances[0].close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    wait(10);
    expect(onCharacter).not.toHaveBeenCalled();
  });

  it("starts the audio at the first interaction with the page, before the key is pressed", () => {
    render();
    expect(AudioContextMock.instances).toHaveLength(0);

    window.dispatchEvent(new Event("pointerdown"));
    expect(AudioContextMock.instances).toHaveLength(1);
    expect(AudioContextMock.instances[0].resume).toHaveBeenCalledTimes(1);
    expect(AudioContextMock.instances[0].gains[0].gain.events).toHaveLength(0);

    window.dispatchEvent(new Event("pointerdown"));
    expect(AudioContextMock.instances).toHaveLength(1);
  });
});
