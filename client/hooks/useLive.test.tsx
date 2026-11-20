import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { AudioContextMock } from "../../test/audio-context-mock";
import { ApiMessage } from "../api/connection";
import { TONE_GAIN } from "../audio/MorsePlayer";

import { Api } from "./useApiConnection";
import useLive, { PLAYOUT_DELAY, TRANSMIT_HOLD } from "./useLive";

const FREQUENCY = 3685000;

describe("useLive", () => {
  let sent: ApiMessage[];
  let listeners: Set<(message: ApiMessage) => void>;
  let api: Api;

  const render = (frequency: number | null = FREQUENCY, connected = true) =>
    renderHook((props) => useLive({ ...api, connected: props.connected }, props.frequency), {
      initialProps: { frequency, connected }
    });
  const receive = (message: ApiMessage) => act(() => listeners.forEach((listener) => listener(message)));
  const channel = (holder: "self" | "other" | null, users = 2, frequency = FREQUENCY) =>
    receive({ type: "channel", frequency, users, holder });
  /** The automation of a tone: the first is of the own key, the second of the keying of the others. */
  const tone = (index: number) => AudioContextMock.instances[0].gains[index].gain.events;

  beforeEach(() => {
    AudioContextMock.instances = [];
    sent = [];
    listeners = new Set();
    const send = vi.fn((message: ApiMessage) => {
      sent.push(message);
      return true;
    });
    const subscribe = (listener: (message: ApiMessage) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };
    api = { connected: true, send, subscribe };
    // The user has done something on the page: the audio can be started
    Object.defineProperty(navigator, "userActivation", { configurable: true, value: { hasBeenActive: true } });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "userActivation");
  });

  it("goes to the frequency when there is a connection, and leaves it when the frequency changes", () => {
    const hook = render(FREQUENCY, false);
    expect(sent).toEqual([]);

    hook.rerender({ frequency: FREQUENCY, connected: true });
    expect(sent).toEqual([{ type: "join", frequency: FREQUENCY }]);
    expect(hook.result.current.channel).toBeNull();

    channel(null);
    expect(hook.result.current.channel).toEqual({ frequency: FREQUENCY, users: 2, holder: null });

    hook.rerender({ frequency: 7000000, connected: true });
    expect(sent.slice(1)).toEqual([{ type: "leave" }, { type: "join", frequency: 7000000 }]);
    expect(hook.result.current.channel).toBeNull();

    // What is still told about the old frequency is ignored
    channel(null);
    expect(hook.result.current.channel).toBeNull();
  });

  it("sends the presses of the key with their times and plays the tone of the key", () => {
    const hook = render();
    channel(null);
    sent = [];

    act(() => hook.result.current.keyDown(1000));
    expect(hook.result.current.keyIsDown).toBe(true);
    expect(hook.result.current.transmitting).toBe(true);
    act(() => hook.result.current.keyUp(1100));
    expect(hook.result.current.keyIsDown).toBe(false);

    expect(sent).toEqual([
      { type: "key", down: true, t: 1000 },
      { type: "key", down: false, t: 1100 }
    ]);
    expect(tone(0).map(({ value }) => value)).toEqual([TONE_GAIN, 0]);

    // The transmission stays on for a moment after the key was released
    channel("self");
    expect(hook.result.current.transmitting).toBe(true);
    expect(hook.result.current.receiving).toBe(false);
  });

  it("does not key before it is on the frequency", () => {
    const hook = render();
    sent = [];

    act(() => hook.result.current.keyDown(1000));
    expect(hook.result.current.keyIsDown).toBe(false);
    expect(sent).toEqual([]);
  });

  it("does not key while someone else is keying", () => {
    const hook = render();
    channel("other");
    sent = [];
    expect(hook.result.current.receiving).toBe(true);

    act(() => hook.result.current.keyDown(1000));
    expect(hook.result.current.keyIsDown).toBe(false);
    expect(sent).toEqual([]);
  });

  it("lets the key go when someone else got the frequency first", () => {
    const hook = render();
    channel(null);
    act(() => hook.result.current.keyDown(1000));

    channel("other");
    expect(hook.result.current.keyIsDown).toBe(false);
    expect(hook.result.current.transmitting).toBe(false);
    expect(tone(0).map(({ value }) => value)).toEqual([TONE_GAIN, 0]);
  });

  it("plays the keying of the others by the times of the one who keys, a moment late", async () => {
    render();
    // The audio starts
    await act(async () => undefined);
    channel("other");
    const context = AudioContextMock.instances[0];

    context.currentTime = 10;
    receive({ type: "key", down: true, t: 5000 });
    // The messages arrive unevenly, but the rhythm is that of the one who keys
    context.currentTime = 10.09;
    receive({ type: "key", down: false, t: 5100 });
    context.currentTime = 10.11;
    receive({ type: "key", down: true, t: 5200 });
    receive({ type: "key", down: false, t: 5500 });

    const events = tone(1);
    expect(events.map(({ value }) => value)).toEqual([TONE_GAIN, 0, TONE_GAIN, 0]);
    const start = 10 + PLAYOUT_DELAY;
    [0, 0.1, 0.2, 0.5].forEach((at, index) => expect(events[index].time).toBeCloseTo(start + at, 6));
  });

  it("times each transmission by its own clock, and lets the key go right away when the server says so", async () => {
    render();
    await act(async () => undefined);
    const context = AudioContextMock.instances[0];

    channel("other");
    context.currentTime = 10;
    receive({ type: "key", down: true, t: 5000 });
    receive({ type: "key", down: false, t: null });
    channel(null);

    // Someone else, with a clock of its own
    channel("other");
    context.currentTime = 20;
    receive({ type: "key", down: true, t: 100 });

    const times = tone(1).map(({ time }) => time);
    expect(times[0]).toBeCloseTo(10 + PLAYOUT_DELAY, 6);
    // Not before the press it ends
    expect(times[1]).toBeCloseTo(10 + PLAYOUT_DELAY, 6);
    expect(times[2]).toBeCloseTo(20 + PLAYOUT_DELAY, 6);
  });

  it("shows nothing of the frequency as soon as the connection is lost", () => {
    const hook = render();
    channel("other");
    expect(hook.result.current.receiving).toBe(true);

    hook.rerender({ frequency: FREQUENCY, connected: false });
    expect(hook.result.current.channel).toBeNull();
    expect(hook.result.current.receiving).toBe(false);
    expect(sent[sent.length - 1]).toEqual({ type: "leave" });
  });

  it("ignores messages it does not understand", () => {
    const hook = render();
    receive({ type: "channel", frequency: FREQUENCY, users: "two", holder: null });
    receive({ type: "channel", frequency: FREQUENCY, users: 2, holder: "someone" });
    receive({ type: "key", down: true, t: 1 });
    expect(hook.result.current.channel).toBeNull();

    channel("other");
    receive({ type: "key", down: "yes", t: 1 });
    receive({ type: "other" });
    expect(hook.result.current.channel).toEqual({ frequency: FREQUENCY, users: 2, holder: "other" });
  });

  it("shows the transmission from the first press until half a second after the last release", () => {
    vi.useFakeTimers();
    const hook = render();
    channel(null);
    expect(hook.result.current.transmitting).toBe(false);

    // On right away, without waiting for the backend to tell that the user has the frequency
    act(() => hook.result.current.keyDown(1000));
    expect(hook.result.current.transmitting).toBe(true);
    act(() => hook.result.current.keyUp(1100));
    expect(hook.result.current.transmitting).toBe(true);

    // A new press before the half a second has passed keeps it on
    act(() => {
      vi.advanceTimersByTime(TRANSMIT_HOLD - 1);
    });
    act(() => hook.result.current.keyDown(1600));
    act(() => {
      vi.advanceTimersByTime(TRANSMIT_HOLD * 2);
    });
    expect(hook.result.current.transmitting).toBe(true);

    act(() => hook.result.current.keyUp(2700));
    act(() => {
      vi.advanceTimersByTime(TRANSMIT_HOLD - 1);
    });
    expect(hook.result.current.transmitting).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current.transmitting).toBe(false);
    vi.useRealTimers();
  });

  it("ends the transmission right away when someone else has the frequency", () => {
    const hook = render();
    channel(null);
    act(() => hook.result.current.keyDown(1000));
    act(() => hook.result.current.keyUp(1100));
    expect(hook.result.current.transmitting).toBe(true);

    channel("other");
    expect(hook.result.current.transmitting).toBe(false);
    expect(hook.result.current.receiving).toBe(true);
  });
});
