import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import MorseKey from "./MorseKey";

function setup() {
  const onDown = vi.fn();
  const onUp = vi.fn();
  render(
    <>
      <select aria-label="Nopeus">
        <option>60</option>
      </select>
      <MorseKey down={false} onDown={onDown} onUp={onUp} />
    </>
  );
  return { key: screen.getByRole("button", { name: "Sähkötysavain" }), onDown, onUp };
}

describe("MorseKey", () => {
  afterEach(() => {
    cleanup();
  });

  it("goes down and up with a press", () => {
    const { key, onDown, onUp } = setup();

    fireEvent.pointerDown(key, { button: 0, pointerId: 1 });
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onDown.mock.calls[0][0]).toEqual(expect.any(Number));
    expect(onUp).not.toHaveBeenCalled();

    fireEvent.pointerUp(key, { button: 0, pointerId: 1 });
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("goes up when the press is cancelled", () => {
    const { key, onDown, onUp } = setup();
    fireEvent.pointerDown(key, { button: 0, pointerId: 1 });
    fireEvent.pointerCancel(key, { pointerId: 1 });

    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("ignores the other buttons of a mouse", () => {
    const { key, onDown } = setup();
    fireEvent.pointerDown(key, { button: 2, pointerId: 1 });
    expect(onDown).not.toHaveBeenCalled();
  });

  it("goes down and up with the space bar, without repeating", () => {
    const { onDown, onUp } = setup();

    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    fireEvent.keyDown(document.body, { code: "Space", key: " ", repeat: true });
    fireEvent.keyDown(document.body, { code: "Space", key: " ", repeat: true });
    expect(onDown).toHaveBeenCalledTimes(1);

    fireEvent.keyUp(document.body, { code: "Space", key: " " });
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("prevents the space bar from scrolling the page", () => {
    setup();
    expect(fireEvent.keyDown(document.body, { code: "Space", key: " " })).toBe(false);
    expect(fireEvent.keyDown(document.body, { code: "KeyA", key: "a" })).toBe(true);
  });

  it("leaves the space bar to a control that has the focus", () => {
    const { onDown } = setup();
    expect(fireEvent.keyDown(screen.getByLabelText("Nopeus"), { code: "Space", key: " " })).toBe(true);
    expect(onDown).not.toHaveBeenCalled();
  });

  it("uses the space bar as the key when the key itself has the focus", () => {
    const { key, onDown } = setup();
    fireEvent.keyDown(key, { code: "Space", key: " " });
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it("stays down until both a finger and the space bar have let go", () => {
    const { key, onDown, onUp } = setup();
    fireEvent.pointerDown(key, { button: 0, pointerId: 1 });
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    fireEvent.pointerUp(key, { pointerId: 1 });
    expect(onUp).not.toHaveBeenCalled();

    fireEvent.keyUp(document.body, { code: "Space", key: " " });
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("goes up when the window is left", () => {
    const { onUp } = setup();
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    fireEvent.blur(window);
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("does not open a menu from a long press", () => {
    const { key } = setup();
    expect(fireEvent.contextMenu(key)).toBe(false);
  });

  it("shows whether it is down", () => {
    render(<MorseKey down onDown={() => undefined} onUp={() => undefined} />);
    expect(screen.getByRole("button", { name: "Sähkötysavain" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does nothing when disabled, and lets go if it is disabled while held", () => {
    const onDown = vi.fn();
    const onUp = vi.fn();
    const view = render(<MorseKey disabled down={false} onDown={onDown} onUp={onUp} />);
    const key = screen.getByRole("button", { name: "Sähkötysavain" });
    expect(key).toBeDisabled();
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    expect(onDown).not.toHaveBeenCalled();

    view.rerender(<MorseKey down={false} onDown={onDown} onUp={onUp} />);
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    expect(onDown).toHaveBeenCalledTimes(1);

    view.rerender(<MorseKey disabled down={false} onDown={onDown} onUp={onUp} />);
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("takes the focus when it is enabled, for the space bar to work after a click of another button", () => {
    const view = render(<MorseKey disabled down={false} onDown={() => undefined} onUp={() => undefined} />);
    expect(screen.getByRole("button", { name: "Sähkötysavain" })).not.toHaveFocus();

    view.rerender(<MorseKey down={false} onDown={() => undefined} onUp={() => undefined} />);
    expect(screen.getByRole("button", { name: "Sähkötysavain" })).toHaveFocus();
  });
});
