import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
    /** The audio clock advances 10 ms at a time. */
    const BLOCK = 0.01;

    /** Moves the time on, in milliseconds. The audio clock is at the edge of its latest block. */
    const at = (time: number) => {
      context().currentTime = Math.floor(time / 1000 / BLOCK) * BLOCK + 1;
    };
    const times = () => gain().events.map(({ time }) => time);

    beforeEach(async () => {
      sidetone.prepare();
      await Promise.resolve();
      context().baseLatency = BLOCK;
    });

    it("makes the tones and the gaps as long as they were keyed, wherever in the blocks of the audio they land", () => {
      // .--. keyed with a unit of 43 ms: none of the events is at the edge of a block
      const events = [103, 146, 189, 318, 361, 490, 533, 576];
      events.forEach((time, index) => {
        at(time);
        if (index % 2 === 0) sidetone.keyDown(time);
        else sidetone.keyUp(time);
      });

      const [start, ...rest] = times();
      rest.forEach((time, index) => expect(time - start).toBeCloseTo((events[index + 1] - events[0]) / 1000, 6));
      // The first press is played a block after it is handled
      expect(start).toBeCloseTo(1.1 + BLOCK, 6);
    });

    it("keeps the gap between two tones even if the events are handled late", () => {
      at(203);
      sidetone.keyDown(203);
      at(303);
      sidetone.keyUp(303);
      // The page was busy: the next press is handled 6 ms late, but played by its own time
      at(353);
      sidetone.keyDown(347);
      at(447);
      sidetone.keyUp(447);

      const [on, off, again, end] = times();
      expect(off - on).toBeCloseTo(0.1, 6);
      expect(again - off).toBeCloseTo(0.044, 6);
      expect(end - again).toBeCloseTo(0.1, 6);
    });

    it("never plays a release before the press, or anything in the past", () => {
      at(300);
      sidetone.keyDown(300);
      // The release is handled so late that its own time has passed
      at(400);
      sidetone.keyUp(330);
      at(450);
      sidetone.keyDown(450);

      const [on, off, again] = times();
      expect(off).toBeGreaterThanOrEqual(1.4);
      expect(off).toBeGreaterThan(on);
      expect(again).toBeGreaterThan(off);
    });

    it("starts from a clean state after a pause in the keying", () => {
      at(103);
      sidetone.keyDown(103);
      at(143);
      sidetone.keyUp(143);
      at(5007);
      sidetone.keyDown(5007);

      expect(times()[2]).toBeCloseTo(context().currentTime + BLOCK, 6);
    });

    it("moves the key right away without the time of the event", () => {
      at(403);
      sidetone.keyDown();
      expect(times()[0]).toBe(context().currentTime);
    });
  });
});
