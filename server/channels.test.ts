// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Channels, { ChannelMessage, isFrequency, MAX_KEY_DOWN, RELEASE_DELAY } from "./channels";

const FREQUENCY = 3685000;

describe("isFrequency", () => {
  it("accepts the HF band in steps of 100 Hz", () => {
    expect(isFrequency(1500000)).toBe(true);
    expect(isFrequency(3685000)).toBe(true);
    expect(isFrequency(30000000)).toBe(true);
  });

  it("refuses everything else", () => {
    expect(isFrequency(1499900)).toBe(false);
    expect(isFrequency(30000100)).toBe(false);
    expect(isFrequency(3685050)).toBe(false);
    expect(isFrequency(3685000.5)).toBe(false);
    expect(isFrequency("3685000")).toBe(false);
    expect(isFrequency(undefined)).toBe(false);
  });
});

describe("Channels", () => {
  let received: Record<string, ChannelMessage[]>;
  let channels: Channels<string>;

  /** The messages a member has got since the last call. */
  const take = (member: string) => {
    const messages = received[member] ?? [];
    received[member] = [];
    return messages;
  };
  const state = (users: number, holder: "self" | "other" | null) => ({
    type: "channel",
    frequency: FREQUENCY,
    users,
    holder
  });

  beforeEach(() => {
    vi.useFakeTimers();
    received = {};
    channels = new Channels<string>((member, message) => {
      (received[member] ??= []).push(message);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tells everyone on a frequency how many there are", () => {
    channels.join("a", FREQUENCY);
    expect(take("a")).toEqual([state(1, null)]);

    channels.join("b", FREQUENCY);
    expect(take("a")).toEqual([state(2, null)]);
    expect(take("b")).toEqual([state(2, null)]);

    channels.leave("b");
    expect(take("a")).toEqual([state(1, null)]);
    expect(channels.users(FREQUENCY)).toBe(1);
  });

  it("passes the keying on to the others on the frequency, but not back to the one who keys", () => {
    channels.join("a", FREQUENCY);
    channels.join("b", FREQUENCY);
    channels.join("c", FREQUENCY);
    channels.join("elsewhere", 7000000);
    ["a", "b", "c", "elsewhere"].forEach(take);

    channels.key("a", true, 1000);
    channels.key("a", false, 1100);

    expect(take("a")).toEqual([state(3, "self")]);
    const heard = [state(3, "other"), { type: "key", down: true, t: 1000 }, { type: "key", down: false, t: 1100 }];
    expect(take("b")).toEqual(heard);
    expect(take("c")).toEqual(heard);
    expect(take("elsewhere")).toEqual([]);
  });

  it("keeps the frequency for the one who keys, and frees it a moment after the key is released", () => {
    channels.join("a", FREQUENCY);
    channels.join("b", FREQUENCY);
    channels.key("a", true, 0);
    channels.key("a", false, 100);
    ["a", "b"].forEach(take);

    // The keying of the other one is ignored, and it is reminded of who has the frequency
    channels.key("b", true, 50);
    expect(take("a")).toEqual([]);
    expect(take("b")).toEqual([state(2, "other")]);

    // A new press before the delay keeps the frequency
    vi.advanceTimersByTime(RELEASE_DELAY - 1);
    channels.key("a", true, 600);
    vi.advanceTimersByTime(RELEASE_DELAY * 2);
    expect(take("b")).toEqual([{ type: "key", down: true, t: 600 }]);

    channels.key("a", false, 700);
    vi.advanceTimersByTime(RELEASE_DELAY - 1);
    expect(take("a")).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(take("a")).toEqual([state(2, null)]);
    expect(take("b")).toEqual([{ type: "key", down: false, t: 700 }, state(2, null)]);

    // Now the other one can key
    channels.key("b", true, 2000);
    expect(take("a")).toEqual([state(2, "other"), { type: "key", down: true, t: 2000 }]);
    expect(take("b")).toEqual([state(2, "self")]);
  });

  it("releases the key and the frequency when the one who keys leaves", () => {
    channels.join("a", FREQUENCY);
    channels.join("b", FREQUENCY);
    channels.key("a", true, 0);
    ["a", "b"].forEach(take);

    channels.leave("a");
    const messages = take("b");
    expect(messages).toEqual([{ type: "key", down: false, t: null }, state(2, null), state(1, null)]);
  });

  it("takes the frequency away from a key that is held down too long", () => {
    channels.join("a", FREQUENCY);
    channels.join("b", FREQUENCY);
    channels.key("a", true, 0);
    ["a", "b"].forEach(take);

    vi.advanceTimersByTime(MAX_KEY_DOWN);
    expect(take("a")).toEqual([state(2, null)]);
    expect(take("b")).toEqual([{ type: "key", down: false, t: MAX_KEY_DOWN }, state(2, null)]);
  });

  it("moves a member from a frequency to another", () => {
    channels.join("a", FREQUENCY);
    channels.join("b", FREQUENCY);
    ["a", "b"].forEach(take);

    channels.join("a", 7000000);
    expect(take("b")).toEqual([state(1, null)]);
    expect(take("a")).toEqual([{ type: "channel", frequency: 7000000, users: 1, holder: null }]);
    expect(channels.users(FREQUENCY)).toBe(1);
  });
});
