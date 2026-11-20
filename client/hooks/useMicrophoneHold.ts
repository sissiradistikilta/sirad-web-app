import { useEffect, useState } from "react";

/** Whether the browser can give the microphone, which it does only on a secure page (https or localhost). */
export const canHoldMicrophone = () => typeof navigator.mediaDevices?.getUserMedia === "function";

/**
 * Keeps the microphone reserved while asked to, without doing anything with its sound.
 *
 * This is an experiment for Bluetooth headsets. A headset plays audio in a mode of high quality (A2DP),
 * which has a long delay, often 150-250 ms. When its microphone is in use, the headset changes to its
 * mode for calls (HFP), where the quality is lower but the delay can be shorter. A page cannot choose
 * the mode, but reserving the microphone makes the device choose it.
 *
 * @returns Whether the microphone is reserved, and the error if it could not be.
 */
const useMicrophoneHold = (on: boolean) => {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!on) return;

    let stream: MediaStream | null = null;
    let cancelled = false;
    const stop = (held: MediaStream) => held.getTracks().forEach((track) => track.stop());

    navigator.mediaDevices
      .getUserMedia({
        // The sound is not used, so it does not need to be processed
        audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false }
      })
      .then(
        (held) => {
          // Switched off while the user was being asked for the permission
          if (cancelled) {
            stop(held);
            return;
          }
          stream = held;
          setError(null);
          setActive(true);
        },
        (reason: unknown) => {
          if (!cancelled) setError(reason);
        }
      );

    return () => {
      cancelled = true;
      if (stream) stop(stream);
      setActive(false);
      setError(null);
    };
  }, [on]);

  return { active: on && active, error: on ? error : null };
};

export default useMicrophoneHold;
