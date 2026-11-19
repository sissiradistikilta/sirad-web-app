import React, { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import AnswerInput from "./AnswerInput";

const boxes = () => Array.from(screen.getByLabelText("Kirjoitettava ryhmä").children);

function setup(answers: string[], length = 125, active = true) {
  const onChange = vi.fn();
  const inputRef = createRef<HTMLInputElement>();
  render(<AnswerInput active={active} answers={answers} inputRef={inputRef} length={length} onChange={onChange} />);
  return { inputRef, onChange };
}

describe("AnswerInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the first group with the first box as the current one", () => {
    setup([]);
    expect(screen.getByText("Ryhmä 1 / 25")).toBeInTheDocument();
    expect(boxes()).toHaveLength(5);
    expect(boxes()[0]).toHaveAttribute("aria-current", "true");
  });

  it("shows what is written, with a dash for a skipped character", () => {
    setup(["A", "", "C"]);
    expect(boxes().map((box) => box.textContent)).toEqual(["A", "–", "C", "", ""]);
    expect(boxes()[3]).toHaveAttribute("aria-current", "true");
  });

  it("shows the group of the character that is written next", () => {
    setup("ABCDEFGHIJKL".split(""));
    expect(screen.getByText("Ryhmä 3 / 25")).toBeInTheDocument();
    expect(boxes().map((box) => box.textContent)).toEqual(["K", "L", "", "", ""]);
  });

  it("stays in the last group when the answer is full", () => {
    setup("ABCDEFGHIJ".split(""), 10);
    expect(screen.getByText("Ryhmä 2 / 2")).toBeInTheDocument();
    expect(boxes().map((box) => box.textContent)).toEqual(["F", "G", "H", "I", "J"]);
  });

  it("has a shorter last group if the message does not fill it", () => {
    setup("ABCDE".split(""), 7);
    expect(boxes()).toHaveLength(2);
  });

  it("takes the focus when active, and tells what is written", () => {
    const { inputRef, onChange } = setup([]);
    expect(inputRef.current).toHaveFocus();

    fireEvent.change(screen.getByLabelText("Vastaus"), { target: { value: "ab" } });
    expect(onChange).toHaveBeenCalledWith("ab");
  });

  it("is a plain text field without the help of a phone's keyboard", () => {
    setup([]);
    const field = screen.getByLabelText("Vastaus");
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveAttribute("autocorrect", "off");
    expect(field).toHaveAttribute("autocapitalize", "characters");
    expect(field).toHaveAttribute("spellcheck", "false");
  });

  it("cannot be written to when not active", () => {
    const { inputRef } = setup([], 125, false);
    expect(inputRef.current).not.toHaveFocus();
    expect(screen.getByLabelText("Vastaus")).toHaveAttribute("readonly");
  });

  it("takes the focus back when it is lost during the exam, but not when the exam has ended", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    const view = render(<AnswerInput active answers={[]} inputRef={inputRef} length={125} onChange={onChange} />);

    inputRef.current?.blur();
    vi.advanceTimersByTime(1);
    expect(inputRef.current).toHaveFocus();

    // The press of a button takes the focus and ends the exam
    inputRef.current?.blur();
    view.rerender(<AnswerInput active={false} answers={[]} inputRef={inputRef} length={125} onChange={onChange} />);
    vi.advanceTimersByTime(1);
    expect(inputRef.current).not.toHaveFocus();
    vi.useRealTimers();
  });
});
