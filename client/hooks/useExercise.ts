import { useCallback, useRef, useState } from "react";

import { patternToCharacter } from "../keying";
import { MorseCharacter } from "../types";

/** How long a wrong character is shown as wrong, in milliseconds. */
export const WRONG_TIME = 600;

export interface ExerciseResult {
  /** Characters sent correctly. */
  characters: number;
  errors: number;
  /** From the first press of the key to the last character, in seconds. */
  seconds: number;
  /** Characters a minute, 0 if nothing was sent. */
  speed: number;
}

/**
 * A sending exercise: the characters of the message are sent one at a time.
 * A correct character moves on to the next one, a wrong one has to be sent again.
 */
const useExercise = (message: MorseCharacter[]) => {
  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState(0);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [result, setResult] = useState<ExerciseResult | null>(null);

  // The same values for the callbacks of the key, which must not wait for a render
  const state = useRef({ running: false, position: 0, errors: 0, startedAt: null as number | null });
  const wrongTimer = useRef<number | null>(null);

  const clearWrong = useCallback(() => {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    wrongTimer.current = null;
    setWrong(false);
  }, []);

  const start = useCallback(() => {
    state.current = { running: true, position: 0, errors: 0, startedAt: null };
    clearWrong();
    setRunning(true);
    setPosition(0);
    setErrors(0);
    setResult(null);
  }, [clearWrong]);

  const finish = useCallback(
    (time: number) => {
      const { position: characters, errors: mistakes, startedAt, running: wasRunning } = state.current;
      if (!wasRunning) return;

      const seconds = startedAt === null ? 0 : Math.max(0, time - startedAt) / 1000;
      state.current.running = false;
      clearWrong();
      setRunning(false);
      setResult({
        characters,
        errors: mistakes,
        seconds,
        speed: seconds > 0 ? Math.round((characters / seconds) * 60) : 0
      });
    },
    [clearWrong]
  );

  /** The key went down: the time of the exercise starts from the first press. */
  const keyDown = useCallback((time: number) => {
    if (state.current.running && state.current.startedAt === null) state.current.startedAt = time;
  }, []);

  /** A character was sent, as dots and dashes. Returns whether it was the right one. */
  const send = useCallback(
    (pattern: string, time = performance.now()) => {
      if (!state.current.running) return null;

      if (patternToCharacter(pattern) === message[state.current.position]) {
        state.current.position += 1;
        clearWrong();
        setPosition(state.current.position);
        if (state.current.position >= message.length) finish(time);
        return true;
      }

      state.current.errors += 1;
      setErrors(state.current.errors);
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
      setWrong(true);
      wrongTimer.current = window.setTimeout(clearWrong, WRONG_TIME);
      return false;
    },
    [message, clearWrong, finish]
  );

  const stop = useCallback(() => finish(performance.now()), [finish]);

  return { errors, keyDown, position, result, running, send, start, stop, wrong };
};

export default useExercise;
