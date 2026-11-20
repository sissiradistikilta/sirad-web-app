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
});
