import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AudioContextMock } from "../test/audio-context-mock";

import App from "./App";

const STEP = 0.005;

function advance(seconds: number) {
  for (let time = 0; time < seconds - STEP / 2; time += STEP) {
    AudioContextMock.instances.forEach((instance) => (instance.currentTime += STEP));
    vi.advanceTimersByTime(STEP * 1000);
  }
}

const button = (name: string) => screen.getByRole("button", { name });

async function play() {
  fireEvent.click(button("Uusi sarja"));
  await act(async () => {
    fireEvent.click(button("Toista"));
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("App", () => {
  beforeEach(() => {
    AudioContextMock.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("the title is visible", () => {
    render(<App />);
    expect(screen.getByText(/SiRad Web/)).toBeInTheDocument();
  });

  it("tells how to begin, and when a series is ready", () => {
    render(<App />);
    expect(screen.getByText("Aloita luomalla uusi sarja.")).toBeInTheDocument();
    expect(button("Toista")).toBeDisabled();

    fireEvent.click(button("Uusi sarja"));
    expect(screen.getByText("Sarja valmis toistettavaksi.")).toBeInTheDocument();
    expect(button("Toista")).toBeEnabled();
  });

  it("shows the group being played and the progress", async () => {
    render(<App />);
    await play();

    expect(screen.getByText("Toisto alkaa")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "25");

    // The start of the message (= = =) takes 52 units of 60 / (9 * 60) seconds before the first group
    act(() => advance(0.1 + (52 * 60) / (9 * 60) + 0.1));
    expect(screen.getByText("Toistetaan ryhmää 1 / 25")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("disables every setting during the playback", async () => {
    render(<App />);
    expect(screen.getAllByRole("combobox")).toHaveLength(4);
    await play();

    screen.getAllByRole("combobox").forEach((select) => expect(select).toBeDisabled());
    expect(button("Uusi sarja")).toBeDisabled();
    expect(button("Toista")).toBeDisabled();
    expect(button("Pysäytä")).toBeEnabled();
  });

  it("shows the message when the playback is stopped", async () => {
    render(<App />);
    await play();
    fireEvent.click(button("Pysäytä"));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
    expect(document.querySelector(".Results-caption")).toHaveTextContent("60 merkkiä/min");
    screen.getAllByRole("combobox").forEach((select) => expect(select).toBeEnabled());
  });

  it("shows the effective speed with the message when it was slower than the character speed", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Tehollinen nopeus"), { target: { value: "40" } });
    await play();
    fireEvent.click(button("Pysäytä"));

    expect(document.querySelector(".Results-caption")).toHaveTextContent("60 merkkiä/min, tehollinen 40 merkkiä/min");
  });
});
