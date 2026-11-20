import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import useMicrophoneHold, { canHoldMicrophone } from "./useMicrophoneHold";

describe("useMicrophoneHold", () => {
  let stops: ReturnType<typeof vi.fn>[];
  let getUserMedia: ReturnType<typeof vi.fn>;

  const render = (on = false) => renderHook((props) => useMicrophoneHold(props.on), { initialProps: { on } });
  /** Lets the answer to the request for the microphone arrive. */
  const settle = () => act(async () => undefined);

  beforeEach(() => {
    stops = [];
    getUserMedia = vi.fn(async () => {
      const stop = vi.fn();
      stops.push(stop);
      return { getTracks: () => [{ stop }] };
    });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("knows whether the browser can give the microphone", () => {
    expect(canHoldMicrophone()).toBe(true);
    Reflect.deleteProperty(navigator, "mediaDevices");
    expect(canHoldMicrophone()).toBe(false);
  });

  it("does not touch the microphone while off", async () => {
    const hook = render();
    await settle();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(hook.result.current).toEqual({ active: false, error: null });
  });

  it("reserves the microphone while on, without processing its sound, and frees it when switched off", async () => {
    const hook = render(true);
    expect(hook.result.current.active).toBe(false);
    await settle();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false }
    });
    expect(hook.result.current).toEqual({ active: true, error: null });
    expect(stops[0]).not.toHaveBeenCalled();

    hook.rerender({ on: false });
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(hook.result.current.active).toBe(false);
  });

  it("frees the microphone when the page is left", async () => {
    const hook = render(true);
    await settle();

    hook.unmount();
    expect(stops[0]).toHaveBeenCalledTimes(1);
  });

  it("tells when the microphone is not given", async () => {
    const denied = new Error("NotAllowedError");
    getUserMedia.mockRejectedValue(denied);
    const hook = render(true);
    await settle();

    expect(hook.result.current).toEqual({ active: false, error: denied });

    // Switching off clears the error, and a new try can succeed
    hook.rerender({ on: false });
    expect(hook.result.current.error).toBeNull();
  });

  it("frees the microphone if it is given only after the switch was already turned off", async () => {
    let give: (stream: unknown) => void = () => undefined;
    const stop = vi.fn();
    getUserMedia.mockImplementation(() => new Promise((resolve) => (give = resolve)));
    const hook = render(true);

    hook.rerender({ on: false });
    await act(async () => give({ getTracks: () => [{ stop }] }));

    expect(stop).toHaveBeenCalledTimes(1);
    expect(hook.result.current.active).toBe(false);
  });
});
