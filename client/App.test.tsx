import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";

import { AudioContextMock } from "../test/audio-context-mock";

import App from "./App";
import { CHARACTER_SETS, MORSE_CODES } from "./constants";
import { MorseCharacter } from "./types";

const STEP = 0.005;
/** The set of characters with only the numbers. */
const NUMBERS = CHARACTER_SETS[CHARACTER_SETS.length - 1].value;

function advance(seconds: number) {
  for (let time = 0; time < seconds - STEP / 2; time += STEP) {
    AudioContextMock.instances.forEach((instance) => (instance.currentTime += STEP));
    vi.advanceTimersByTime(STEP * 1000);
  }
}

const button = (name: string) => screen.getByRole("button", { name });

async function play() {
  await act(async () => {
    fireEvent.click(button("Aloita"));
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

  it("tells how to begin, and creates a series and plays it from one button", async () => {
    render(<App />);
    expect(screen.getByText("Aloita, niin saat uuden sarjan ja sen toisto alkaa.")).toBeInTheDocument();
    expect(button("Aloita")).toBeEnabled();
    expect(button("Lopeta")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Uusi sarja" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toista" })).not.toBeInTheDocument();

    await play();
    expect(AudioContextMock.instances[0].oscillators).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "25");
    expect(screen.queryByText("Aloita, niin saat uuden sarjan ja sen toisto alkaa.")).not.toBeInTheDocument();
  });

  it("plays a new series each time", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    render(<App />);
    await play();
    fireEvent.click(button("Lopeta"));
    expect(document.querySelector(".Results-group")?.textContent).toBe("AAAAA");

    random.mockReturnValue(0.99);
    await play();
    fireEvent.click(button("Lopeta"));
    expect(document.querySelector(".Results-group")?.textContent).toBe("ZZZZZ");
    random.mockRestore();
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
    expect(screen.getAllByRole("combobox")).toHaveLength(5);
    await play();

    screen.getAllByRole("combobox").forEach((select) => expect(select).toBeDisabled());
    expect(button("Aloita")).toBeDisabled();
    expect(button("Lopeta")).toBeEnabled();
  });

  it("shows the message when the playback is stopped", async () => {
    render(<App />);
    await play();
    fireEvent.click(button("Lopeta"));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
    expect(document.querySelector(".Results-caption")).toHaveTextContent("60 merkkiä/min");
    screen.getAllByRole("combobox").forEach((select) => expect(select).toBeEnabled());
  });

  it("shows the effective speed with the message when it was slower than the character speed", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Tehollinen nopeus"), { target: { value: "40" } });
    await play();
    fireEvent.click(button("Lopeta"));

    expect(document.querySelector(".Results-caption")).toHaveTextContent("60 merkkiä/min, tehollinen 40 merkkiä/min");
  });

  describe("practice mode", () => {
    const UNIT = 60 / (9 * 60);
    const classes = (selector: string) =>
      Array.from(document.querySelectorAll(selector), (element) => element.className);

    async function practise() {
      render(<App />);
      fireEvent.change(screen.getByLabelText("Tila"), { target: { value: "harjoittelu" } });
      await play();
    }

    it("is an exam on paper unless the practice mode is chosen", async () => {
      render(<App />);
      expect(screen.getByLabelText("Tila")).toHaveValue("koe-paperi");
      await play();
      expect(document.querySelector(".Results")).not.toBeInTheDocument();
    });

    it("shows the message from the start of the playback, with nothing highlighted before the first character", async () => {
      await practise();
      expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
      expect(document.querySelector(".Results-following")).toBeInTheDocument();
      expect(document.querySelector(".Results-character-current")).not.toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("follows the playback: the group and the character being played are highlighted", async () => {
      await practise();

      // The start of the message takes 52 units before the first character
      act(() => advance(0.1 + 52 * UNIT + 0.05));
      expect(classes(".Results-group")[0]).toContain("Results-group-current");
      expect(classes(".Results-character")[0]).toContain("Results-character-current");
      expect(document.querySelectorAll(".Results-character-current")).toHaveLength(1);
      expect(document.querySelectorAll(".Results-character-played")).toHaveLength(0);

      // No character with its gap is longer than 13 + 3 units
      act(() => advance(16 * UNIT));
      expect(classes(".Results-character")[0]).toContain("Results-character-played");
      expect(document.querySelectorAll(".Results-character-current")).toHaveLength(1);
    });

    it("keeps the message in sight without highlights when the playback is stopped", async () => {
      await practise();
      act(() => advance(0.1 + 60 * UNIT));
      fireEvent.click(button("Lopeta"));

      expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
      expect(document.querySelector(".Results-following")).not.toBeInTheDocument();
      expect(document.querySelector(".Results-caption")).toHaveTextContent("60 merkkiä/min");
    });

    it("cannot be changed during the playback", async () => {
      render(<App />);
      await play();
      expect(screen.getByLabelText("Tila")).toBeDisabled();
    });
  });

  describe("exam on a keyboard", () => {
    const field = () => screen.getByLabelText("Vastaus");
    const write = (text: string) => fireEvent.change(field(), { target: { value: text } });
    const boxes = () => Array.from(screen.getByLabelText("Kirjoitettava ryhmä").children, (box) => box.textContent);
    const current = () =>
      Array.from(screen.getByLabelText("Kirjoitettava ryhmä").children).findIndex((box) =>
        box.hasAttribute("aria-current")
      );

    async function startExam() {
      render(<App />);
      fireEvent.change(screen.getByLabelText("Tila"), { target: { value: "koe-nappaimisto" } });
      await play();
    }

    it("gives the focus to the answer when the playback starts, for the keyboard of a phone to open", async () => {
      await startExam();
      expect(field()).toHaveFocus();
      expect(field()).not.toHaveAttribute("readonly");
    });

    it("shows the group being written as five boxes with its number, and not where the playback is", async () => {
      await startExam();
      expect(boxes()).toEqual(["", "", "", "", ""]);
      expect(current()).toBe(0);
      expect(screen.getByText("Ryhmä 1 / 25")).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(document.querySelector(".Results")).not.toBeInTheDocument();
    });

    it("writes the characters to the boxes, as capitals", async () => {
      await startExam();
      write("ab");
      expect(boxes()).toEqual(["A", "B", "", "", ""]);
      expect(current()).toBe(2);
    });

    it("skips a character with a space", async () => {
      await startExam();
      write("a b");
      expect(boxes()).toEqual(["A", "–", "B", "", ""]);
      expect(current()).toBe(3);
    });

    it("goes back with the backspace", async () => {
      await startExam();
      write("abc");
      write("ab");
      expect(boxes()).toEqual(["A", "B", "", "", ""]);
      expect(current()).toBe(2);
    });

    it("moves on to the next group after the fifth character", async () => {
      await startExam();
      write("abcde");
      expect(screen.getByText("Ryhmä 2 / 25")).toBeInTheDocument();
      expect(boxes()).toEqual(["", "", "", "", ""]);

      write("abcdef");
      expect(boxes()).toEqual(["F", "", "", "", ""]);
    });

    it("lets the answer be finished after the playback has ended", async () => {
      await startExam();
      write("abc");
      // A message of 125 letters at 60 characters a minute takes well under ten minutes
      act(() => advance(600));

      expect(screen.getByText("Sanoma päättyi. Kirjoita vastaus loppuun ja paina Valmis.")).toBeInTheDocument();
      expect(boxes()).toEqual(["A", "B", "C", "", ""]);
      expect(document.querySelector(".Results")).not.toBeInTheDocument();
      expect(button("Aloita")).toBeDisabled();

      write("abcd");
      expect(boxes()).toEqual(["A", "B", "C", "D", ""]);

      fireEvent.click(button("Valmis"));
      expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
      expect(field()).toHaveAttribute("readonly");
      expect(button("Aloita")).toBeEnabled();
    });

    it("ends by itself when the last character is written after the playback", async () => {
      await startExam();
      act(() => advance(600));
      write("a".repeat(124));
      expect(document.querySelector(".Results")).not.toBeInTheDocument();

      write("a".repeat(125));
      expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
    });

    it("ends when the playback is stopped", async () => {
      await startExam();
      write("ab");
      fireEvent.click(button("Lopeta"));

      expect(document.querySelectorAll(".Results-row")).toHaveLength(5);
      expect(AudioContextMock.instances[0].oscillators[0].stop).toHaveBeenCalledTimes(1);
    });

    it("checks the answer at the end: the wrong characters are marked and counted", async () => {
      // A message of the letter A only
      const random = vi.spyOn(Math, "random").mockReturnValue(0);
      await startExam();
      random.mockRestore();
      write("ab a");
      fireEvent.click(button("Lopeta"));

      const characters = document.querySelectorAll(".Results-character");
      expect(characters[0]).not.toHaveClass("Results-character-wrong");
      expect(characters[1]).toHaveClass("Results-character-wrong");
      expect(characters[1].lastChild?.textContent).toBe("B");
      expect(characters[1].querySelector(".Results-correct")?.textContent).toBe("A");
      expect(characters[2]).toHaveClass("Results-character-wrong");
      expect(characters[2].lastChild?.textContent).toBe("–");
      expect(characters[3]).not.toHaveClass("Results-character-wrong");
      expect(document.querySelectorAll(".Results-character-wrong")).toHaveLength(123);

      const summary = screen.getByLabelText("Kokeen tulos");
      expect(summary).toHaveTextContent("Oikein2 / 125");
      expect(summary).toHaveTextContent("Väärin1");
      expect(summary).toHaveTextContent("Tyhjiä122");
    });

    it("does not check anything in an exam on paper", async () => {
      render(<App />);
      await play();
      fireEvent.click(button("Lopeta"));
      expect(screen.queryByLabelText("Kokeen tulos")).not.toBeInTheDocument();
      expect(document.querySelector(".Results-marked")).not.toBeInTheDocument();
    });

    it("starts with an empty answer each time", async () => {
      await startExam();
      write("abc");
      fireEvent.click(button("Lopeta"));
      await act(async () => {
        fireEvent.click(button("Aloita"));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(boxes()).toEqual(["", "", "", "", ""]);
      expect(field()).toHaveValue("");
    });
  });

  it("makes the series of the receiving exercise by the settings", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Merkkien nopeus"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Merkit"), { target: { value: NUMBERS } });
    fireEvent.change(screen.getByLabelText("Pituus"), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Tila"), { target: { value: "harjoittelu" } });
    expect(screen.getByLabelText("Merkit")).toHaveValue(NUMBERS);
    expect(screen.getByLabelText("Merkkien nopeus")).toHaveValue("100");
    await play();

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "50");
    // The start of the message takes 52 units of 60 / (9 * 100) seconds at this speed
    act(() => advance(0.1 + (52 * 60) / (9 * 100) + 0.1));
    expect(screen.getByText("Toistetaan ryhmää 1 / 50")).toBeInTheDocument();
    // Only numbers were asked for
    const groups = Array.from(document.querySelectorAll(".Results-group"), (group) => group.textContent ?? "");
    expect(groups).toHaveLength(50);
    groups.forEach((group) => expect(group).toMatch(/^[0-9]{5}$/));
    expect(document.querySelector(".Results-caption")).toHaveTextContent("100 merkkiä/min");
  });

  it("makes the series of the sending exercise by the settings", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
    fireEvent.change(screen.getByLabelText("Nopeus"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Merkit"), { target: { value: NUMBERS } });
    fireEvent.change(screen.getByLabelText("Pituus"), { target: { value: "250" } });
    fireEvent.click(button("Aloita"));

    expect(screen.getByText("Ryhmä 1 / 50")).toBeInTheDocument();
    const group = Array.from(screen.getByLabelText("Sähkötettävä ryhmä").children).map((item) => item.textContent);
    expect(group).toHaveLength(5);
    group.forEach((character) => expect(character).toMatch(/^[0-9]$/));
  });

  it("has the Live mode only when live keying is in use", () => {
    const { unmount } = render(<App />);
    expect(screen.queryByRole("tab", { name: "Live" })).not.toBeInTheDocument();
    unmount();

    // The mode is not opened from the address either
    window.history.replaceState(null, "", "#live");
    render(<App />);
    expect(screen.getByRole("tab", { name: "Vastaanotto" })).toHaveAttribute("aria-selected", "true");
    cleanup();

    render(<App live />);
    expect(screen.getByRole("tab", { name: "Live" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Taajuus (MHz)")).toBeInTheDocument();
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("shows the receiving exercise first, and the sending exercise from its tab", () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Vastaanotto" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Tehollinen nopeus")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
    expect(screen.getByRole("tab", { name: "Anto" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Tehollinen nopeus")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#anto");

    fireEvent.click(screen.getByRole("tab", { name: "Vastaanotto" }));
    expect(screen.getByLabelText("Tehollinen nopeus")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("keeps the path of the page when the mode is changed, e.g. in the preview of a pull request", () => {
    // The page has a base address, against which a relative address would be resolved
    const base = document.createElement("base");
    base.href = "/";
    document.head.appendChild(base);
    window.history.replaceState(null, "", "/pr-20/?debug=1");
    render(<App live />);

    fireEvent.click(screen.getByRole("tab", { name: "Live" }));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/pr-20/?debug=1#live");
    fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/pr-20/?debug=1#anto");
    fireEvent.click(screen.getByRole("tab", { name: "Vastaanotto" }));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/pr-20/?debug=1");

    base.remove();
    window.history.replaceState(null, "", "/");
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
      expect(screen.getAllByRole("combobox")).toHaveLength(4);

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

    it("shows no help in an exam: no tree and nothing of what is being sent", () => {
      render(<App />);
      fireEvent.click(screen.getByRole("tab", { name: "Anto" }));
      expect(screen.getByLabelText("Tila")).toHaveValue("harjoittelu");
      fireEvent.change(screen.getByLabelText("Tila"), { target: { value: "koe" } });
      fireEvent.click(button("Aloita"));

      expect(document.querySelector(".MorseTree")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Sähkötetty")).not.toBeInTheDocument();

      // The exercise itself works as in the practice mode
      send(group()[0].textContent);
      expect(states()).toEqual(["done", "current", "pending", "pending", "pending"]);
      send(group()[1].textContent === "E" ? "T" : "E");
      expect(states()).toEqual(["done", "wrong", "pending", "pending", "pending"]);
    });

    it("shows the tree and what is being sent in the practice mode", () => {
      startExercise();
      expect(document.querySelector(".MorseTree")).toBeInTheDocument();
      expect(screen.getByLabelText("Sähkötetty")).toBeInTheDocument();
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
      expect(button("Aloita")).toBeEnabled();
      expect(screen.getAllByRole("combobox")).toHaveLength(4);
    });
  });
});
