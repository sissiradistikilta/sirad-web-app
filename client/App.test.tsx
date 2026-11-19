import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";

import { AudioContextMock } from "../test/audio-context-mock";

import App from "./App";
import { MORSE_CODES } from "./constants";
import { MorseCharacter } from "./types";

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

  it("shows the receiving exercise first, and the sending exercise from its tab", () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Vastaanotto" })).toHaveAttribute("aria-selected", "true");
    expect(button("Uusi sarja")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
    expect(screen.getByRole("tab", { name: "Anto" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Uusi sarja" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#anto");

    fireEvent.click(screen.getByRole("tab", { name: "Vastaanotto" }));
    expect(button("Uusi sarja")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("opens the sending exercise from the address", () => {
    window.history.replaceState(null, "", "#anto");
    render(<App />);
    expect(screen.getByRole("tab", { name: "Anto" })).toHaveAttribute("aria-selected", "true");
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("stops the playback when the exercise is changed", async () => {
    render(<App />);
    await play();
    fireEvent.click(screen.getByRole("tab", { name: "Anto" }));

    expect(AudioContextMock.instances[0].oscillators[0].stop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("sending exercise", () => {
    const UNIT = 60000 / (9 * 60);
    const wait = (units: number) =>
      act(() => {
        vi.advanceTimersByTime(units * UNIT);
      });

    /** Sends a character with the key and waits for the pause that ends it. */
    function send(character: string) {
      const key = button("Sähkötysavain");
      // The time stamps of the events follow the fake clock of the test
      const fire = (type: "pointerDown" | "pointerUp") => {
        const event = createEvent[type](key, { button: 0, pointerId: 1 });
        Object.defineProperty(event, "timeStamp", { value: performance.now() });
        fireEvent(key, event);
      };
      Array.from(MORSE_CODES[character as MorseCharacter]).forEach((element) => {
        fire("pointerDown");
        wait(element === "-" ? 3 : 1);
        fire("pointerUp");
        wait(1);
      });
      wait(2);
    }

    const group = () => Array.from(screen.getByLabelText("Sähkötettävä ryhmä").children);
    const states = () => group().map((element) => element.className.replace("Send-character Send-character-", ""));

    function startExercise() {
      render(<App />);
      fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
      fireEvent.click(button("Aloita"));
    }

    it("has the key in use only during the exercise", () => {
      render(<App />);
      fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
      expect(screen.queryByRole("button", { name: "Sähkötysavain" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("combobox")).toHaveLength(3);

      fireEvent.click(button("Aloita"));
      expect(button("Sähkötysavain")).toBeEnabled();
      expect(button("Sähkötysavain")).toHaveFocus();
      expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    });

    it("shows a group of five characters with the first one as the current one", () => {
      startExercise();
      expect(group()).toHaveLength(5);
      expect(states()).toEqual(["current", "pending", "pending", "pending", "pending"]);
      expect(screen.getByText("Ryhmä 1 / 25")).toBeInTheDocument();
    });

    it("turns a character green when it is sent right and moves on", () => {
      startExercise();
      send(group()[0].textContent);
      expect(states()).toEqual(["done", "current", "pending", "pending", "pending"]);
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    });

    it("turns a character red for a moment when it is sent wrong and stays on it", () => {
      startExercise();
      send(group()[0].textContent === "E" ? "T" : "E");
      expect(states()).toEqual(["wrong", "pending", "pending", "pending", "pending"]);

      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(states()).toEqual(["current", "pending", "pending", "pending", "pending"]);
    });

    it("shows what is being sent", () => {
      startExercise();
      const key = button("Sähkötysavain");
      fireEvent.pointerDown(key, { button: 0, pointerId: 1 });
      fireEvent.pointerUp(key, { pointerId: 1 });
      expect(screen.getByLabelText("Sähkötetty")).toHaveTextContent("·E");
    });

    it("lights the path of the character in the tree, and shows the completed character for a moment", () => {
      startExercise();
      const key = button("Sähkötysavain");
      const state = (pattern: string) => document.querySelector(`[data-pattern="${pattern}"]`)?.getAttribute("class");

      fireEvent.pointerDown(key, { button: 0, pointerId: 1 });
      fireEvent.pointerUp(key, { pointerId: 1 });
      expect(state(".")).toContain("MorseTree-node-current");

      wait(3);
      expect(state(".")).toContain(group()[0].textContent === "E" ? "MorseTree-node-right" : "MorseTree-node-wrong");

      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(state(".")).toContain("MorseTree-node-off");
    });

    it("shows the next group when a group is done", () => {
      startExercise();
      const first = group().map((element) => element.textContent);
      first.forEach((character) => send(character));

      expect(screen.getByText("Ryhmä 2 / 25")).toBeInTheDocument();
      expect(states()).toEqual(["current", "pending", "pending", "pending", "pending"]);
    });

    it("shows the result when the exercise is stopped", () => {
      startExercise();
      const [first, second] = group().map((element) => element.textContent);
      send(first);
      send(second === "E" ? "T" : "E");
      fireEvent.click(button("Lopeta"));

      const result = screen.getByLabelText("Harjoituksen tulos");
      expect(result).toHaveTextContent("Merkkejä1 / 125");
      expect(result).toHaveTextContent("Virheitä1");
      expect(screen.queryByRole("button", { name: "Sähkötysavain" })).not.toBeInTheDocument();
      expect(button("Uusi harjoitus")).toBeEnabled();
      expect(screen.getAllByRole("combobox")).toHaveLength(3);
    });
  });
});
