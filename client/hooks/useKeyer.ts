import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Sidetone } from "../audio";
import { MorseDecoder } from "../keying";
import { getDotLength } from "../utils";

/**
 * A Morse key with its tone: turns the presses of the key into characters at the given speed.
 *
 * @param onCharacter Called with the dots and dashes of each character when the pause after it ends it.
 */
const useKeyer = (characterSpeed: number, onCharacter: (pattern: string) => void) => {
  const sidetone = useRef<Sidetone | null>(null);
  const timer = useRef<number | null>(null);
  const callback = useRef(onCharacter);
  const [pattern, setPattern] = useState("");
  const [keyIsDown, setKeyIsDown] = useState(false);

  const decoder = useMemo(() => new MorseDecoder(getDotLength(characterSpeed)), [characterSpeed]);

  useEffect(() => {
    callback.current = onCharacter;
  }, [onCharacter]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const complete = useCallback((completed: string | null) => {
    if (!completed) return;
    setPattern("");
    callback.current(completed);
  }, []);

  const keyDown = useCallback(
    (time: number) => {
      if (decoder.keyIsDown) return;

      sidetone.current ??= new Sidetone();
      sidetone.current.keyDown();
      clearTimer();
      complete(decoder.keyDown(time));
      setKeyIsDown(true);
    },
    [decoder, clearTimer, complete]
  );

  const keyUp = useCallback(
    (time: number) => {
      if (!decoder.keyIsDown) return;

      sidetone.current?.keyUp();
      decoder.keyUp(time);
      setPattern(decoder.pattern);
      setKeyIsDown(false);

      // The character ends unless the key is pressed again before the deadline
      const deadline = decoder.deadline ?? time;
      timer.current = window.setTimeout(
        () => {
          timer.current = null;
          complete(decoder.poll(Math.max(deadline, performance.now())));
        },
        Math.max(0, deadline - performance.now())
      );
    },
    [decoder, complete]
  );

  /** Forgets the character that is being sent, e.g. when an exercise is restarted. */
  const reset = useCallback(() => {
    clearTimer();
    sidetone.current?.keyUp();
    decoder.reset();
    setPattern("");
    setKeyIsDown(false);
  }, [decoder, clearTimer]);

  // A change of speed starts from a clean state
  useEffect(() => reset, [reset]);

  // The audio takes a moment to start, which would cut the first press short. That is why
  // it is started as soon as the browser allows it: after the user has done anything on the page.
  useEffect(() => {
    const prepare = () => {
      sidetone.current ??= new Sidetone();
      sidetone.current.prepare();
    };
    if (navigator.userActivation?.hasBeenActive) prepare();
    window.addEventListener("pointerdown", prepare, { capture: true, once: true });
    window.addEventListener("keydown", prepare, { capture: true, once: true });

    return () => {
      window.removeEventListener("pointerdown", prepare, { capture: true });
      window.removeEventListener("keydown", prepare, { capture: true });
      sidetone.current?.dispose();
      sidetone.current = null;
    };
  }, []);

  return { keyDown, keyIsDown, keyUp, pattern, reset };
};

export default useKeyer;
