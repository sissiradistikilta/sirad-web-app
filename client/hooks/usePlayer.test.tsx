import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { AudioContextMock } from "../../test/audio-context-mock";
import { buildMessageTimeline } from "../audio";
import { MorseCharacter } from "../types";

import usePlayer from "./usePlayer";

const MESSAGE: MorseCharacter[] = ["A", "B", "C", "D", "E", "F", "G"];
const STEP = 0.005;

const context = () => AudioContextMock.instances[0];

function advance(seconds: number) {
  for (let time = 0; time < seconds - STEP / 2; time += STEP) {
    AudioContextMock.instances.forEach((instance) => (instance.currentTime += STEP));
    vi.advanceTimersByTime(STEP * 1000);
  }
}

const render = (message = MESSAGE) =>
  renderHook((props) => usePlayer(props.characterSpeed, props.effectiveSpeed, props.message), {
    initialProps: { characterSpeed: 160, effectiveSpeed: 0, message }
  });

async function start(hook: ReturnType<typeof render>) {
  await act(async () => {
    hook.result.current.startPlayback();
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("usePlayer", () => {
  beforeEach(() => {
    AudioContextMock.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("is ready to play without creating an AudioContext", () => {
    const hook = render();
    hook.rerender({ characterSpeed: 100, effectiveSpeed: 60, message: MESSAGE });
    hook.rerender({ characterSpeed: 100, effectiveSpeed: 60, message: [...MESSAGE] });

    expect(hook.result.current).toMatchObject({ currentGroup: 0, numGroups: 2, playing: false, stopped: false });
    expect(AudioContextMock.instances).toHaveLength(0);
  });

  it("starts the playback", async () => {
    const hook = render();
    await start(hook);

    expect(hook.result.current).toMatchObject({ currentGroup: 0, playing: true, stopped: false });
    expect(context().oscillators).toHaveLength(1);
  });

  it("keeps one AudioContext and one oscillator over renders during the playback", async () => {
    const hook = render();
    await start(hook);
    for (let round = 0; round < 5; round += 1) {
      hook.rerender({ characterSpeed: 160, effectiveSpeed: 0, message: MESSAGE });
      act(() => advance(0.1));
    }

    expect(AudioContextMock.instances).toHaveLength(1);
    expect(context().oscillators).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("follows the group being played and shows the playback as stopped at the end", async () => {
    const hook = render();
    const timeline = buildMessageTimeline([MESSAGE.slice(0, 5), MESSAGE.slice(5)], 160);
    await start(hook);

    act(() => advance(0.1 + timeline.groupStarts[0] + 0.05));
    expect(hook.result.current.currentGroup).toBe(1);
    expect(hook.result.current.currentCharacter).toBe(1);

    act(() => advance(timeline.groupStarts[1] - timeline.groupStarts[0]));
    expect(hook.result.current).toMatchObject({ currentGroup: 2, playing: true, stopped: false });

    act(() => advance(timeline.duration - timeline.groupStarts[1] + 0.1));
    expect(hook.result.current).toMatchObject({ currentGroup: 2, playing: false, stopped: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops the playback", async () => {
    const hook = render();
    await start(hook);
    act(() => advance(0.5));
    act(() => hook.result.current.stopPlayback());

    expect(hook.result.current).toMatchObject({ playing: false, stopped: true });
    expect(context().oscillators[0].stop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    act(() => advance(10));
    expect(hook.result.current).toMatchObject({ playing: false, stopped: true });
  });

  it("plays again right after stopping, without the stopped playback interfering", async () => {
    const hook = render();
    await start(hook);
    act(() => advance(0.5));
    act(() => {
      hook.result.current.stopPlayback();
      hook.result.current.startPlayback();
    });

    expect(hook.result.current).toMatchObject({ currentGroup: 0, playing: true, stopped: false });
    expect(context().oscillators).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(1);

    act(() => advance(1));
    expect(hook.result.current.playing).toBe(true);
  });

  it("uses the speeds that are set when the playback is started", async () => {
    const hook = render();
    hook.rerender({ characterSpeed: 40, effectiveSpeed: 0, message: MESSAGE });
    await start(hook);
    act(() => advance(1));

    // "=" starts with a dash, three units of 6 / 40 seconds
    const [attack, , release] = context().gains[0].gain.events;
    expect(release.time - attack.time).toBeCloseTo((3 * 6) / 40, 9);
  });

  it("is no longer stopped when the message changes", async () => {
    const hook = render();
    await start(hook);
    act(() => hook.result.current.stopPlayback());
    expect(hook.result.current.stopped).toBe(true);

    hook.rerender({ characterSpeed: 160, effectiveSpeed: 0, message: ["X", "Y"] });
    expect(hook.result.current).toMatchObject({ numGroups: 1, playing: false, stopped: false });
  });

  it("releases everything when unmounted during the playback", async () => {
    const hook = render();
    await start(hook);
    act(() => advance(0.5));
    hook.unmount();

    expect(context().oscillators[0].stop).toHaveBeenCalledTimes(1);
    expect(context().close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays the message given at the start instead of the one of the hook", async () => {
    const hook = render(["E"]);
    await act(async () => {
      hook.result.current.startPlayback([["T"]]);
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => advance(60));

    // Three times "=" (5 tones each), the message, "+" (5) and VA (6): T is one tone
    expect(context().gains[0].gain.events).toHaveLength((15 + 1 + 5 + 6) * 4);
    // The tone after the start of the message is the message: a dash for T
    const [attack, , release] = context().gains[0].gain.events.slice(15 * 4);
    expect(release.time - attack.time).toBeCloseTo((3 * 6) / 160, 9);
  });

  it("is not playing when the audio cannot be started", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("no audio");
    vi.spyOn(window, "AudioContext").mockImplementation(function () {
      throw failure;
    });
    const hook = render();

    await start(hook);
    expect(hook.result.current.playing).toBe(false);
    expect(error).toHaveBeenCalledWith("Cannot start the audio playback", failure);
    vi.restoreAllMocks();
  });
});
