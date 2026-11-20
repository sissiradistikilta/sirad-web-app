import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, renderHook, waitFor } from "@testing-library/react";

import { AudioContextMock } from "../../test/audio-context-mock";
import { Backend, BrowserWebSocket, startBackend } from "../../test/backend";
import { TONE_GAIN } from "../audio/MorsePlayer";
import { useApiConnection, useLive } from "../hooks";

// Live keying from end to end: several frontends connected to the real backend over real WebSockets.

const FREQUENCY = 3685000;
const RELEASE_DELAY = 120;
const FAST = { reconnectDelays: [50] };

// The backend and the frontends are really running: on a busy machine things can take a while
configure({ asyncUtilTimeout: 5000 });

const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("live keying between frontends", () => {
  let backend: Backend;

  /** A user in the Live mode: a connection to the backend and the keying on a frequency. */
  const openClient = (frequency: number | null = FREQUENCY) => {
    // Each client makes two tones: of its own key and of the keying of the others
    const first = AudioContextMock.instances.length;
    const hook = renderHook(
      (props) => {
        const api = useApiConnection(backend.url, FAST);
        return { api, live: useLive(api, props.frequency) };
      },
      { initialProps: { frequency } }
    );
    return {
      hook,
      get live() {
        return hook.result.current.live;
      },
      get connected() {
        return hook.result.current.api.connected;
      },
      /** The keying of the others as the client plays it: the levels of the tone and their times in seconds. */
      heard: () => AudioContextMock.instances[first + 1].gains[0].gain.events,
      keyDown: (t: number) => act(() => hook.result.current.live.keyDown(t)),
      keyUp: (t: number) => act(() => hook.result.current.live.keyUp(t))
    };
  };
  const levels = (client: ReturnType<typeof openClient>) =>
    client.heard().map(({ value }) => (value === TONE_GAIN ? "on" : "off"));

  beforeEach(async () => {
    AudioContextMock.instances = [];
    vi.stubGlobal("WebSocket", BrowserWebSocket);
    // The users have done something on the page: the audio can be started
    Object.defineProperty(navigator, "userActivation", { configurable: true, value: { hasBeenActive: true } });
    backend = await startBackend({ channels: { releaseDelay: RELEASE_DELAY } });
  });

  afterEach(async () => {
    cleanup();
    await backend.stop();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "userActivation");
  });

  it("tells each one how many there are on the frequency", async () => {
    const a = openClient();
    await waitFor(() => expect(a.live.channel).toEqual({ frequency: FREQUENCY, users: 1, holder: null }));

    const b = openClient();
    await waitFor(() => expect(b.live.channel?.users).toBe(2));
    await waitFor(() => expect(a.live.channel?.users).toBe(2));

    b.hook.unmount();
    await waitFor(() => expect(a.live.channel?.users).toBe(1));
  });

  it("plays the keying of one to the others in its rhythm, but not back to the one who keys", async () => {
    const a = openClient();
    const b = openClient();
    const c = openClient();
    await waitFor(() => expect(a.live.channel?.users).toBe(3));

    // A dot and a dash
    a.keyDown(1000);
    a.keyUp(1100);
    a.keyDown(1200);
    a.keyUp(1500);

    for (const listener of [b, c]) {
      await waitFor(() => expect(levels(listener)).toEqual(["on", "off", "on", "off"]));
      const [start, ...times] = listener.heard().map(({ time }) => time);
      times.forEach((time, index) => expect(time - start).toBeCloseTo([0.1, 0.2, 0.5][index], 6));
    }
    expect(a.heard()).toEqual([]);
  });

  it("lets only one key at a time, and frees the frequency a moment after the keying ends", async () => {
    const a = openClient();
    const b = openClient();
    await waitFor(() => expect(b.live.channel?.users).toBe(2));

    a.keyDown(1000);
    expect(a.live.transmitting).toBe(true);
    await waitFor(() => expect(b.live.receiving).toBe(true));
    expect(b.live.transmitting).toBe(false);

    // The key of the listener does nothing
    b.keyDown(50);
    expect(b.live.keyIsDown).toBe(false);
    await sleep(60);
    expect(a.heard()).toEqual([]);

    // The frequency stays with the one who keyed for a moment after the key is released
    a.keyUp(1100);
    expect(a.live.keyIsDown).toBe(false);
    await sleep(RELEASE_DELAY / 2);
    expect(a.live.transmitting).toBe(true);
    expect(b.live.receiving).toBe(true);

    await waitFor(() => expect(b.live.receiving).toBe(false));
    await waitFor(() => expect(a.live.transmitting).toBe(false));

    // Now it is the turn of the other one
    b.keyDown(2000);
    b.keyUp(2100);
    await waitFor(() => expect(levels(a)).toEqual(["on", "off"]));
    await waitFor(() => expect(a.live.receiving).toBe(true));
    expect(b.live.transmitting).toBe(true);
  });

  it("gives the frequency to one of two who press their keys at the same time", async () => {
    const a = openClient();
    const b = openClient();
    await waitFor(() => expect(b.live.channel?.users).toBe(2));

    a.keyDown(1000);
    b.keyDown(1000);

    await waitFor(() => expect([a.live.channel?.holder, b.live.channel?.holder].sort()).toEqual(["other", "self"]));
    const [winner, loser] = a.live.channel?.holder === "self" ? [a, b] : [b, a];
    expect(winner.live.keyIsDown).toBe(true);
    // The key of the one who was late is let go, and it hears the one who was first
    await waitFor(() => expect(loser.live.keyIsDown).toBe(false));
    expect(loser.live.receiving).toBe(true);
    await waitFor(() => expect(levels(loser)).toEqual(["on"]));
    expect(winner.heard()).toEqual([]);
  });

  it("keeps the frequencies apart, and moves a user from a frequency to another", async () => {
    const a = openClient();
    const b = openClient(7030000);
    await waitFor(() => expect(b.live.channel).toEqual({ frequency: 7030000, users: 1, holder: null }));
    await waitFor(() => expect(a.live.channel?.users).toBe(1));

    a.keyDown(1000);
    a.keyUp(1100);
    await sleep(RELEASE_DELAY * 2);
    expect(b.heard()).toEqual([]);
    expect(b.live.receiving).toBe(false);

    b.hook.rerender({ frequency: FREQUENCY });
    await waitFor(() => expect(b.live.channel).toEqual({ frequency: FREQUENCY, users: 2, holder: null }));
    await waitFor(() => expect(a.live.channel?.users).toBe(2));

    // Leaving a frequency silenced the tone: what is heard from here on is the keying
    b.heard().length = 0;
    a.keyDown(2000);
    a.keyUp(2100);
    await waitFor(() => expect(levels(b)).toEqual(["on", "off"]));
  });

  it("frees the frequency right away when the one who keys leaves with the key down", async () => {
    const a = openClient();
    const b = openClient();
    await waitFor(() => expect(b.live.channel?.users).toBe(2));

    a.keyDown(1000);
    await waitFor(() => expect(b.live.receiving).toBe(true));
    await waitFor(() => expect(levels(b)).toEqual(["on"]));

    a.hook.unmount();
    await waitFor(() => expect(b.live.channel).toEqual({ frequency: FREQUENCY, users: 1, holder: null }));
    expect(levels(b)).toEqual(["on", "off"]);
  });

  it("returns to the frequency when the backend comes back", async () => {
    const a = openClient();
    const b = openClient();
    await waitFor(() => expect(b.live.channel?.users).toBe(2));
    const { port } = backend;

    await backend.stop();
    await waitFor(() => expect(a.connected).toBe(false));
    await waitFor(() => expect(b.connected).toBe(false));
    expect(a.live.channel).toBeNull();
    // Without a connection the key does nothing
    a.keyDown(1000);
    expect(a.live.keyIsDown).toBe(false);

    backend = await startBackend({ port, channels: { releaseDelay: RELEASE_DELAY } });
    await waitFor(() => expect(a.live.channel).toEqual({ frequency: FREQUENCY, users: 2, holder: null }));
    await waitFor(() => expect(b.live.channel?.users).toBe(2));

    // Leaving a frequency silenced the tone: what is heard from here on is the keying
    b.heard().length = 0;
    a.keyDown(2000);
    a.keyUp(2100);
    await waitFor(() => expect(levels(b)).toEqual(["on", "off"]));
  });
});
