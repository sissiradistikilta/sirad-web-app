import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioContextMock, AutomationEvent } from "../../test/audio-context-mock";

import MorsePlayer, {
  HIDDEN_LOOKAHEAD,
  LOOKAHEAD,
  MIN_LEAD,
  QUIET_TIME,
  RAMP_TIME,
  START_DELAY,
  STOP_FADE,
  TONE_FREQUENCY,
  TONE_GAIN,
  URGENT_LEAD
} from "./MorsePlayer";
import { buildMessageTimeline, buildTimeline, MessageTimeline } from "./timeline";

const STEP = 0.005;

const context = () => AudioContextMock.instances[0];
const keyGain = (session = 0) => context().gains[session * 2].gain;
const masterGain = (session = 0) => context().gains[session * 2 + 1].gain;
const tones = (timeline: MessageTimeline) => timeline.events.filter((event) => event.type === "tone");

/** Lets a pending resume() of the context settle. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** Advances the audio clock and the timers together. */
function advance(seconds: number) {
  for (let time = 0; time < seconds - STEP / 2; time += STEP) {
    AudioContextMock.instances.forEach((instance) => (instance.currentTime += STEP));
    vi.advanceTimersByTime(STEP * 1000);
  }
}

/** A timeline of the given Morse patterns, one group per word, with a unit of 40 ms by default. */
function timelineOf(words: string[][], unit = 0.04): MessageTimeline {
  const timeline = buildTimeline(words, { unit, characterGap: 3 * unit, wordGap: 7 * unit });
  return { ...timeline, groupStarts: timeline.wordStarts };
}

/** Groups the automation events of the key gain by tone. */
function envelopes(events: AutomationEvent[]) {
  const result: AutomationEvent[][] = [];
  for (let index = 0; index < events.length; index += 4) result.push(events.slice(index, index + 4));
  return result;
}

describe("MorsePlayer", () => {
  let player: MorsePlayer;

  beforeEach(() => {
    AudioContextMock.instances = [];
    vi.useFakeTimers();
    player = new MorsePlayer();
  });

  afterEach(() => {
    player.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("audio context", () => {
    it("is not created before the playback is started", () => {
      expect(AudioContextMock.instances).toHaveLength(0);
    });

    it("is resumed before anything is played", async () => {
      player.start(timelineOf([[".-"]]));
      expect(context().resume).toHaveBeenCalledTimes(1);
      expect(context().oscillators).toHaveLength(0);

      await flush();
      expect(context().oscillators).toHaveLength(1);
      expect(context().oscillators[0].start).toHaveBeenCalledTimes(1);
    });

    it("is reused for every playback", async () => {
      player.start(timelineOf([["."]]));
      await flush();
      advance(1);
      player.start(timelineOf([["."]]));
      advance(0.1);
      player.stop();
      player.start(timelineOf([["."]]));

      expect(AudioContextMock.instances).toHaveLength(1);
      expect(context().resume).toHaveBeenCalledTimes(1);
      expect(context().close).not.toHaveBeenCalled();
    });

    it("is closed when the player is disposed, and created again if needed", async () => {
      player.start(timelineOf([[".-"]]));
      await flush();
      player.dispose();

      expect(context().close).toHaveBeenCalledTimes(1);
      expect(context().oscillators[0].stop).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);

      player.start(timelineOf([[".-"]]));
      await flush();
      expect(AudioContextMock.instances).toHaveLength(2);
      expect(AudioContextMock.instances[1].oscillators).toHaveLength(1);
    });

    it("reports an error if it cannot be resumed", async () => {
      player.start(timelineOf([["."]]));
      await flush();
      player.stop();

      context().state = "suspended";
      context().resume.mockRejectedValueOnce(new Error("not allowed"));
      const onError = vi.fn();
      player.start(timelineOf([["."]]), { onError });
      await flush();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(context().oscillators).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("scheduling", () => {
    it("plays a sine wave that is silent until the first tone", async () => {
      player.start(timelineOf([[".-"]]));
      await flush();

      const [oscillator] = context().oscillators;
      expect(oscillator.type).toBe("sine");
      expect(oscillator.frequency.value).toBe(TONE_FREQUENCY);
      expect(keyGain().value).toBe(0);
      expect(keyGain().events[0]).toEqual({ type: "setValue", value: 0, time: START_DELAY - RAMP_TIME / 2 });
    });

    it("schedules a tone as an attack and a release centered on its start and end", async () => {
      const timeline = timelineOf([[".-"]]);
      player.start(timeline);
      await flush();
      advance(1);

      const expected = tones(timeline).flatMap((tone) => [
        { type: "setValue", value: 0, time: START_DELAY + tone.start - RAMP_TIME / 2 },
        { type: "linearRamp", value: TONE_GAIN, time: START_DELAY + tone.start + RAMP_TIME / 2 },
        { type: "setValue", value: TONE_GAIN, time: START_DELAY + tone.end - RAMP_TIME / 2 },
        { type: "linearRamp", value: 0, time: START_DELAY + tone.end + RAMP_TIME / 2 }
      ]);
      expect(keyGain().events).toHaveLength(expected.length);
      keyGain().events.forEach((event, index) => {
        expect(event.type).toBe(expected[index].type);
        expect(event.value).toBe(expected[index].value);
        expect(event.time).toBeCloseTo(expected[index].time, 9);
      });
    });

    it("shortens the ramps of very short elements so that they do not overlap", async () => {
      player.start(timelineOf([["..-"]], 0.004));
      await flush();
      advance(0.5);

      const times = keyGain().events.map((event) => event.time);
      expect(times).toHaveLength(12);
      expect(times[1] - times[0]).toBeCloseTo(0.002, 9);
      times.forEach((time, index) => {
        if (index > 0) expect(time).toBeGreaterThanOrEqual(times[index - 1] - 1e-9);
      });
    });

    it("only schedules the tones that start within the look-ahead", async () => {
      const timeline = buildMessageTimeline([["A", "B", "C", "D", "E"]], 100);
      player.start(timeline);
      await flush();

      for (let round = 0; round < 40; round += 1) {
        const starts = envelopes(keyGain().events).map(([attack]) => attack.time);
        expect(Math.max(...starts)).toBeLessThan(context().currentTime + LOOKAHEAD);
        // ...and the queue does not run low
        const next = tones(timeline)[starts.length];
        if (next) expect(START_DELAY + next.start).toBeGreaterThan(context().currentTime + URGENT_LEAD - 0.03);
        advance(0.1);
      }
    });

    it("does not add tones while a ramp is being rendered or about to start", async () => {
      const timeline = buildMessageTimeline([["A", "B", "C", "D", "E"]], 100);
      player.start(timeline);
      await flush();

      let additions = 0;
      for (let time = 0; time < timeline.duration + 1; time += STEP) {
        const before = keyGain().events.length;
        advance(STEP);
        if (keyGain().events.length === before) continue;

        additions += 1;
        const now = context().currentTime;
        const rampStarts = keyGain()
          .events.slice(0, before)
          .filter((event) => event.type === "setValue")
          .map((event) => event.time);
        rampStarts.forEach((start) => {
          const rendering = start <= now && now < start + RAMP_TIME;
          const aboutToStart = now <= start && start < now + QUIET_TIME;
          expect(rendering || aboutToStart).toBe(false);
        });
      }
      expect(keyGain().events).toHaveLength(tones(timeline).length * 4);
      expect(additions).toBeGreaterThan(10);
    });

    it("adds tones regardless of the ramps when the queue is running low", async () => {
      // Elements this short leave no quiet moment between the ramps
      const timeline = timelineOf([Array(40).fill("....."), ["."]], 0.012);
      player.start(timeline);
      await flush();

      for (let time = 0; time < timeline.duration; time += 0.05) {
        const next = tones(timeline)[keyGain().events.length / 4];
        if (next) expect(START_DELAY + next.start).toBeGreaterThan(context().currentTime + URGENT_LEAD - 0.03);
        advance(0.05);
      }
      const scheduled = envelopes(keyGain().events);
      expect(scheduled).toHaveLength(tones(timeline).length);
      scheduled.forEach(([attack], index) => {
        expect(attack.time + RAMP_TIME / 2).toBeCloseTo(START_DELAY + tones(timeline)[index].start, 9);
      });
    });

    it("schedules every tone exactly once and in order", async () => {
      const timeline = buildMessageTimeline([["A", "B", "C", "D", "E"]], 100);
      player.start(timeline);
      await flush();
      advance(timeline.duration + 1);

      const scheduled = envelopes(keyGain().events);
      expect(scheduled).toHaveLength(tones(timeline).length);
      scheduled.forEach(([attack, , release], index) => {
        const tone = tones(timeline)[index];
        expect(attack.time + RAMP_TIME / 2).toBeCloseTo(START_DELAY + tone.start, 9);
        expect(release.time + RAMP_TIME / 2).toBeCloseTo(START_DELAY + tone.end, 9);
      });
    });

    it("schedules further ahead when the page is hidden", async () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      player.start(buildMessageTimeline([["A", "B", "C", "D", "E"]], 100));
      await flush();

      const last = keyGain().events.at(-1)?.time ?? 0;
      expect(last).toBeGreaterThan(LOOKAHEAD + 1);
      expect(last).toBeLessThan(HIDDEN_LOOKAHEAD + 0.3);
    });

    it("delays the rest of the message instead of scheduling in the past if the scheduler is held up", async () => {
      const timeline = buildMessageTimeline([["A", "B", "C", "D", "E"]], 100);
      player.start(timeline);
      await flush();
      const before = keyGain().events.length / 4;

      // The audio clock runs for a second without the timer getting a turn
      context().currentTime += 1;
      const now = context().currentTime;
      advance(timeline.duration + 1);

      const late = envelopes(keyGain().events).slice(before);
      // The next tone starts a little after the time of the scheduler getting its turn again
      expect(late[0][0].time).toBeGreaterThanOrEqual(now + MIN_LEAD);
      expect(late[0][0].time).toBeLessThanOrEqual(now + 0.025 + MIN_LEAD + 1e-9);
      // The timing of the delayed part is intact
      const delay = late[0][0].time + RAMP_TIME / 2 - tones(timeline)[before].start;
      late.forEach(([attack, , release], index) => {
        const tone = tones(timeline)[before + index];
        expect(attack.time + RAMP_TIME / 2).toBeCloseTo(delay + tone.start, 9);
        expect(release.time + RAMP_TIME / 2).toBeCloseTo(delay + tone.end, 9);
      });
    });
  });

  describe("callbacks", () => {
    it("reports the group being played", async () => {
      const timeline = timelineOf([["."], ["-"], [".."]]);
      const onGroupChange = vi.fn();
      player.start(timeline, { onGroupChange });
      await flush();
      expect(onGroupChange).not.toHaveBeenCalled();

      advance(START_DELAY + 0.02);
      expect(onGroupChange.mock.calls).toEqual([[1]]);

      advance(timeline.duration + 1);
      expect(onGroupChange.mock.calls).toEqual([[1], [2], [3]]);
    });

    it("reports the end of the playback and cleans up", async () => {
      const timeline = timelineOf([[".-"]]);
      const onEnded = vi.fn();
      player.start(timeline, { onEnded });
      await flush();

      advance(START_DELAY + timeline.duration);
      expect(onEnded).not.toHaveBeenCalled();

      advance(0.1);
      expect(onEnded).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);

      const [oscillator] = context().oscillators;
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
      oscillator.onended?.();
      expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
      context().gains.forEach((gain) => expect(gain.disconnect).toHaveBeenCalledTimes(1));

      advance(1);
      expect(onEnded).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopping", () => {
    it("fades out, stops the oscillator and the scheduler", async () => {
      const onEnded = vi.fn();
      const onGroupChange = vi.fn();
      player.start(buildMessageTimeline([["A", "B", "C", "D", "E"]], 100), { onEnded, onGroupChange });
      await flush();
      advance(0.5);
      const scheduled = keyGain().events.length;

      const now = context().currentTime;
      player.stop();

      expect(masterGain().events).toEqual([
        { type: "setValue", value: 1, time: now + MIN_LEAD },
        { type: "linearRamp", value: 0, time: now + MIN_LEAD + STOP_FADE }
      ]);
      expect(context().oscillators[0].stop).toHaveBeenCalledWith(now + MIN_LEAD + STOP_FADE);
      expect(vi.getTimerCount()).toBe(0);

      advance(5);
      expect(keyGain().events).toHaveLength(scheduled);
      expect(onGroupChange).not.toHaveBeenCalled();
      expect(onEnded).not.toHaveBeenCalled();
    });

    it("does nothing if nothing is playing", () => {
      player.stop();
      player.stop();
      expect(AudioContextMock.instances).toHaveLength(0);
    });

    it("cancels a start that is still waiting for the context", async () => {
      const onEnded = vi.fn();
      player.start(timelineOf([["."]]), { onEnded });
      player.stop();
      await flush();
      advance(1);

      expect(context().oscillators).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(onEnded).not.toHaveBeenCalled();
    });

    it("discards the nodes right away if the context is not running", async () => {
      player.start(timelineOf([[".-"]]));
      await flush();
      context().state = "suspended";
      player.stop();

      expect(masterGain().events).toHaveLength(0);
      expect(context().oscillators[0].stop).toHaveBeenCalledTimes(1);
      expect(context().oscillators[0].disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("restarting", () => {
    it("gives a new playback its own nodes and leaves the old ones alone", async () => {
      const first = { onEnded: vi.fn(), onGroupChange: vi.fn() };
      const second = { onEnded: vi.fn(), onGroupChange: vi.fn() };
      const timeline = buildMessageTimeline([["E"]], 160);

      player.start(timeline, first);
      await flush();
      advance(0.3);
      player.stop();
      const scheduled = keyGain(0).events.length;
      player.start(timeline, second);

      expect(context().oscillators).toHaveLength(2);
      expect(context().oscillators[0].stop).toHaveBeenCalledTimes(1);
      expect(context().oscillators[1].stop).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(1);

      advance(timeline.duration + 1);
      expect(keyGain(0).events).toHaveLength(scheduled);
      expect(keyGain(1).events).toHaveLength(tones(timeline).length * 4);
      expect(masterGain(1).events).toHaveLength(0);
      expect(first.onEnded).not.toHaveBeenCalled();
      expect(first.onGroupChange).not.toHaveBeenCalled();
      expect(second.onEnded).toHaveBeenCalledTimes(1);
      expect(second.onGroupChange).toHaveBeenCalledTimes(1);
    });

    it("stops the previous playback when started while playing", async () => {
      player.start(timelineOf([[".-"]]));
      await flush();
      player.start(timelineOf([[".-"]]));

      expect(context().oscillators).toHaveLength(2);
      expect(context().oscillators[0].stop).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
    });

    it("survives repeated quick starts and stops", async () => {
      const onEnded = vi.fn();
      const timeline = buildMessageTimeline([["E"]], 160);
      player.start(timeline, { onEnded });
      await flush();
      for (let round = 0; round < 20; round += 1) {
        advance(0.01 * round);
        player.stop();
        expect(vi.getTimerCount()).toBe(0);
        player.start(timeline, { onEnded });
        expect(vi.getTimerCount()).toBe(1);
      }
      advance(timeline.duration + 1);

      expect(AudioContextMock.instances).toHaveLength(1);
      expect(context().oscillators).toHaveLength(21);
      context().oscillators.forEach((oscillator) => expect(oscillator.stop).toHaveBeenCalledTimes(1));
      expect(onEnded).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
