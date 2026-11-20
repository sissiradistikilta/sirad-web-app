import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioContextMock } from "../../test/audio-context-mock";

import { TONE_FREQUENCY, TONE_GAIN } from "./MorsePlayer";
import Sidetone from "./Sidetone";

const context = () => AudioContextMock.instances[0];
const gain = () => context().gains[0].gain;

describe("Sidetone", () => {
  let sidetone: Sidetone;

  beforeEach(() => {
    AudioContextMock.instances = [];
    sidetone = new Sidetone();
  });

  afterEach(() => {
    sidetone.dispose();
  });

  it("does not create an AudioContext before the key is used", () => {
    expect(AudioContextMock.instances).toHaveLength(0);
    sidetone.keyUp();
    expect(AudioContextMock.instances).toHaveLength(0);
  });

  it("starts a silent sine wave and resumes the context when prepared", () => {
    sidetone.prepare();

    const [oscillator] = context().oscillators;
    expect(oscillator.type).toBe("sine");
    expect(oscillator.frequency.value).toBe(TONE_FREQUENCY);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(gain().value).toBe(0);
    expect(context().resume).toHaveBeenCalledTimes(1);
    // The tone has to follow the key as closely as the device can
    expect(context().options).toEqual({ latencyHint: 0 });
  });

  it("moves the gain towards the tone when the key goes down and towards silence when it goes up", () => {
    sidetone.keyDown();
    context().currentTime = 0.5;
    sidetone.keyUp();

    expect(gain().events).toEqual([
      { type: "setTarget", value: TONE_GAIN, time: 0 },
      { type: "setTarget", value: 0, time: 0.5 }
    ]);
  });

  it("keeps one AudioContext and one oscillator for all presses", () => {
    for (let press = 0; press < 10; press += 1) {
      sidetone.keyDown();
      sidetone.keyUp();
    }
    sidetone.prepare();

    expect(AudioContextMock.instances).toHaveLength(1);
    expect(context().oscillators).toHaveLength(1);
    expect(gain().events).toHaveLength(20);
  });

  it("closes the context when disposed, and works again after that", () => {
    sidetone.keyDown();
    sidetone.dispose();
    expect(context().close).toHaveBeenCalledTimes(1);

    sidetone.keyDown();
    expect(AudioContextMock.instances).toHaveLength(2);
    expect(AudioContextMock.instances[1].gains[0].gain.events).toHaveLength(1);
  });

  it("keys at a given time of the audio clock, but not in the past", async () => {
    expect(sidetone.currentTime).toBeNull();
    sidetone.prepare();
    await Promise.resolve();
    context().currentTime = 2;
    expect(sidetone.currentTime).toBe(2);

    sidetone.keyAt(true, 2.15);
    sidetone.keyAt(false, 1);

    // The keying from elsewhere has a gain of its own, on the same audio output as the key
    expect(AudioContextMock.instances).toHaveLength(1);
    expect(gain().events).toEqual([]);
    expect(context().gains[1].gain.events).toEqual([
      { type: "setTarget", value: TONE_GAIN, time: 2.15 },
      { type: "setTarget", value: 0, time: 2 }
    ]);
  });

  describe("with the times of the presses", () => {
    /** The audio plays what was scheduled 50 ms ago, and its clock advances 10 ms at a time. */
    const LATENCY = 0.05;
    const BLOCK = 0.01;
    let clock = 0;

    /** Moves the time on, in milliseconds. The audio clock is at the edge of its latest block. */
    const at = (time: number) => {
      clock = time;
      context().currentTime = Math.floor(time / 1000 / BLOCK) * BLOCK + 1;
    };

    beforeEach(async () => {
      vi.spyOn(performance, "now").mockImplementation(() => clock);
      sidetone.prepare();
      await Promise.resolve();
      Object.assign(context(), {
        getOutputTimestamp: () => ({ contextTime: clock / 1000 + 1 - LATENCY, performanceTime: clock })
      });
      // The audio has run for a while: the delay of the audio has been seen at its longest, at the end of a block
      at(9.999);
      sidetone.keyUp(clock);
      gain().events.length = 0;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("makes each tone as long as the press, wherever in the blocks of the audio the events land", () => {
      // A dot of 45 ms that starts early in a block and ends late in another
      at(103);
      sidetone.keyDown(103);
      const blockOfPress = context().currentTime;
      at(148);
      sidetone.keyUp(148);

      const [on, off] = gain().events;
      expect(off.time - on.time).toBeCloseTo(0.045, 6);
      // Without the times of the presses the tone would be 40 ms: from the edge of a block to another
      expect(context().currentTime - blockOfPress).toBeCloseTo(0.04, 6);
    });

    it("plays an event a constant moment after it happened, also when it is handled late", () => {
      at(203);
      sidetone.keyDown(203);
      // The release is handled 6 ms late, e.g. because the page was busy
      at(249);
      sidetone.keyUp(243);

      const [on, off] = gain().events;
      expect(off.time - on.time).toBeCloseTo(0.04, 6);
    });

    it("never schedules in the past", () => {
      at(300);
      sidetone.keyDown(100);
      expect(gain().events[0].time).toBe(context().currentTime);
    });

    it("moves the key right away without the time of the event", () => {
      at(403);
      sidetone.keyDown();
      expect(gain().events[0].time).toBe(context().currentTime);
    });
  });
});
