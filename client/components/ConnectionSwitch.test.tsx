import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ConnectionSwitch from "./ConnectionSwitch";

describe("ConnectionSwitch", () => {
  const toggle = () => screen.getByRole("switch", { name: "Yhteys palvelimeen" });

  afterEach(cleanup);

  it("is on with a green light when there is a connection", () => {
    render(<ConnectionSwitch connected on onChange={vi.fn()} />);
    expect(toggle()).toBeChecked();
    expect(toggle()).toHaveClass("ConnectionSwitch-connected");
    expect(screen.getByRole("status")).toHaveTextContent("Yhteys palvelimeen");
  });

  it("is on with a red light when there is no connection", () => {
    render(<ConnectionSwitch connected={false} on onChange={vi.fn()} />);
    expect(toggle()).toBeChecked();
    expect(toggle()).toHaveClass("ConnectionSwitch-disconnected");
    expect(screen.getByRole("status")).toHaveTextContent("Ei yhteyttä palvelimeen");
  });

  it("is off with a grey light when the connection is switched off", () => {
    render(<ConnectionSwitch connected={false} on={false} onChange={vi.fn()} />);
    expect(toggle()).not.toBeChecked();
    expect(toggle()).toHaveClass("ConnectionSwitch-off");
    expect(screen.getByRole("status")).toHaveTextContent("Yhteys palvelimeen on pois päältä");
  });

  it("asks for the other state when pressed", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ConnectionSwitch connected on onChange={onChange} />);
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith(false);

    rerender(<ConnectionSwitch connected={false} on={false} onChange={onChange} />);
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("tells what a press does", () => {
    const { rerender } = render(<ConnectionSwitch connected on onChange={vi.fn()} />);
    expect(toggle()).toHaveAttribute("title", "Yhteys palvelimeen. Kytke pois päältä painamalla.");

    rerender(<ConnectionSwitch connected={false} on={false} onChange={vi.fn()} />);
    expect(toggle()).toHaveAttribute("title", "Yhteys palvelimeen on pois päältä. Kytke päälle painamalla.");
  });
});
