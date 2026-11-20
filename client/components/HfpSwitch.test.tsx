import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import HfpSwitch from "./HfpSwitch";

describe("HfpSwitch", () => {
  const toggle = () => screen.getByRole("switch", { name: "HFP" });

  afterEach(cleanup);

  it("has its label and is off", () => {
    render(<HfpSwitch active={false} failed={false} on={false} onChange={vi.fn()} />);
    expect(screen.getByText("HFP")).toBeInTheDocument();
    expect(toggle()).not.toBeChecked();
    expect(toggle()).not.toHaveClass("HfpSwitch-on");
    expect(screen.getByRole("status")).toHaveTextContent("HFP on pois päältä");
  });

  it("is on when the microphone is reserved", () => {
    render(<HfpSwitch active failed={false} on onChange={vi.fn()} />);
    expect(toggle()).toBeChecked();
    expect(toggle()).toHaveClass("HfpSwitch-on");
    expect(toggle()).not.toHaveClass("HfpSwitch-waiting");
    expect(screen.getByRole("status")).toHaveTextContent("HFP on päällä: mikrofoni on varattu");
  });

  it("is red while the microphone is being asked for, and when it was not given", () => {
    const { rerender } = render(<HfpSwitch active={false} failed={false} on onChange={vi.fn()} />);
    expect(toggle()).toHaveClass("HfpSwitch-waiting");
    expect(screen.getByRole("status")).toHaveTextContent("Varataan mikrofonia…");

    rerender(<HfpSwitch active={false} failed on onChange={vi.fn()} />);
    expect(toggle()).toHaveClass("HfpSwitch-waiting");
    expect(screen.getByRole("status")).toHaveTextContent("Mikrofonia ei saatu varattua");
  });

  it("asks for the other state when pressed", () => {
    const onChange = vi.fn();
    render(<HfpSwitch active={false} failed={false} on={false} onChange={onChange} />);
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith(true);
  });
});
