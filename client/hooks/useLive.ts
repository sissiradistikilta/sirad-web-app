import { useCallback, useEffect, useRef, useState } from "react";

import { ApiMessage } from "../api/connection";
import { Sidetone } from "../audio";
import { Holder, LiveChannel } from "../live";

import { Api } from "./useApiConnection";

/**
 * How much later the keying of the others is played than it arrives, in seconds. The keying is played
 * by the times of the one who keys, and the delay is the room for the messages to arrive unevenly
 * without changing the rhythm.
 */
export const PLAYOUT_DELAY = 0.15;

const isHolder = (value: unknown): value is Holder => value === "self" || value === "other" || value === null;

/**
 * Live keying on a frequency: the user hears the keying of the others on the same frequency, and they hear
 * the keying of the user. Only one can key at a time, so the key does nothing while someone else is keying.
 *
 * @param frequency The frequency in hertz, or null to be on no frequency.
 */
const useLive = (api: Api, frequency: number | null) => {
  const { connected, send, subscribe } = api;
  /** The tone of the own key, and the tone of the keying of the others. */
  const local = useRef<Sidetone | null>(null);
  const remote = useRef<Sidetone | null>(null);
  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [keyIsDown, setKeyIsDown] = useState(false);
  const down = useRef(false);
  const holder = useRef<Holder>(null);
  const joined = useRef(false);
  /** The difference of the audio clock and the clock of the one who is keying, in seconds. */
  const offset = useRef<number | null>(null);
  const scheduled = useRef(0);

  const release = useCallback(() => {
    local.current?.keyUp();
    down.current = false;
    setKeyIsDown(false);
  }, []);

  /** Plays a press or a release of the key of someone else. */
  const play = useCallback((keyDown: boolean, t: number | null) => {
    const tone = (remote.current ??= new Sidetone());
    tone.prepare();
    const now = tone.currentTime;
    // The audio has not been allowed to start yet: there is nothing to hear
    if (now === null) return;

    let time = now;
    if (t !== null) {
      // The first event of a transmission sets the clocks side by side
      offset.current ??= now + PLAYOUT_DELAY - t / 1000;
      time = t / 1000 + offset.current;
    }
    // The events are played in the order they were sent
    time = Math.max(time, scheduled.current, now);
    scheduled.current = time;
    tone.keyAt(keyDown, time);
  }, []);

  useEffect(() => {
    if (!connected || frequency === null) return;

    const unsubscribe = subscribe((message: ApiMessage) => {
      if (message.type === "channel") {
        if (message.frequency !== frequency || typeof message.users !== "number" || !isHolder(message.holder)) return;

        joined.current = true;
        holder.current = message.holder;
        setChannel({ frequency, users: message.users, holder: message.holder });
        // The next transmission of someone is timed by its own clock
        if (message.holder !== "other") offset.current = null;
        // Someone else got the frequency first
        if (message.holder === "other" && down.current) release();
      } else if (message.type === "key" && joined.current) {
        if (typeof message.down !== "boolean") return;
        play(message.down, typeof message.t === "number" ? message.t : null);
      }
    });
    send({ type: "join", frequency });

    return () => {
      unsubscribe();
      send({ type: "leave" });
      joined.current = false;
      holder.current = null;
      offset.current = null;
      scheduled.current = 0;
      const now = remote.current?.currentTime;
      if (now !== null && now !== undefined) remote.current?.keyAt(false, now);
      release();
      setChannel(null);
    };
  }, [connected, frequency, send, subscribe, play, release]);

  /** The key went down. The time is in milliseconds on the clock of performance.now(). */
  const keyDown = useCallback(
    (time: number) => {
      if (!joined.current || holder.current === "other" || down.current) return;

      local.current ??= new Sidetone();
      local.current.keyDown();
      down.current = true;
      setKeyIsDown(true);
      send({ type: "key", down: true, t: time });
    },
    [send]
  );

  const keyUp = useCallback(
    (time: number) => {
      if (!down.current) return;

      release();
      send({ type: "key", down: false, t: time });
    },
    [send, release]
  );

  // The audio takes a moment to start, and it is needed for hearing the others even if the user never keys.
  // That is why it is started as soon as the browser allows it: after the user has done anything on the page.
  useEffect(() => {
    const prepare = () => {
      local.current ??= new Sidetone();
      local.current.prepare();
      remote.current ??= new Sidetone();
      remote.current.prepare();
    };
    if (navigator.userActivation?.hasBeenActive) prepare();
    window.addEventListener("pointerdown", prepare, { capture: true, once: true });
    window.addEventListener("keydown", prepare, { capture: true, once: true });

    return () => {
      window.removeEventListener("pointerdown", prepare, { capture: true });
      window.removeEventListener("keydown", prepare, { capture: true });
      local.current?.dispose();
      remote.current?.dispose();
      local.current = null;
      remote.current = null;
    };
  }, []);

  // What was told about a frequency holds only while connected and on that frequency. The state is cleared
  // a moment after either changes, and nothing of the old situation is shown meanwhile.
  const current = connected && channel?.frequency === frequency ? channel : null;

  return {
    channel: current,
    keyDown,
    keyIsDown,
    keyUp,
    /** Someone else is keying on the frequency: the key cannot be used. */
    receiving: current?.holder === "other",
    /** The user is keying, or has the frequency after keying. */
    transmitting: keyIsDown || current?.holder === "self"
  };
};

export default useLive;
