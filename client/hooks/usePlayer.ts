import { useCallback, useEffect, useRef, useState } from "react";

import { MORSE_CODES_MAP } from "../constants";
import { MorseCharacter } from "../types";
import { getDotLength, getLineLength, sleep } from "../utils";

import useLetterChunks from "./useLetterChunks";

const usePlayer = (speed: number, message: MorseCharacter[]) => {
  const audioCtx = useRef<AudioContext>(new window.AudioContext());
  const stopRequested = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const dotLength = useRef(getDotLength(speed));
  const lineLength = useRef(getLineLength(speed));

  const letterChunks = useLetterChunks(message);

  useEffect(() => {
    setStopped(false);
  }, [message]);

  useEffect(() => {
    dotLength.current = getDotLength(speed);
    lineLength.current = getLineLength(speed);
  }, [speed]);

  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const createAudioContext = useCallback(() => {
    if (audioCtx.current && audioCtx.current.state !== "closed") {
      return;
    }

    audioCtx.current = new window.AudioContext();
  }, []);

  const stopOscillator = useCallback(() => {
    if (gainNodeRef.current) {
      const ctx = audioCtx.current;
      const now = ctx.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(now);
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
      gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.04);
    }
    window.setTimeout(() => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    }, 60);
  }, []);

  const startOscillator = useCallback(() => {
    createAudioContext();
    const ctx = audioCtx.current;
    if (oscillatorRef.current && gainNodeRef.current) {
      const now = ctx.currentTime;
      const gainNode = gainNodeRef.current;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
    }
    window.setTimeout(() => {
      if (!(oscillatorRef.current && gainNodeRef.current)) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, ctx.currentTime);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start();

        oscillatorRef.current = oscillator;
        gainNodeRef.current = gainNode;
      }
    }, 45);
  }, [createAudioContext]);

  const playBeep = useCallback(
    async (duration: number) => {
      startOscillator();
      const ctx = audioCtx.current;
      const gainNode = gainNodeRef.current;
      if (!gainNode) return;

      const now = ctx.currentTime;
      const maxRamp = Math.max(0.002, Math.min(0.01, duration / 400));
      const rampTime = Math.min(maxRamp, duration / 400);
      const fadeOut = rampTime;
      const endTime = now + duration / 1000;

      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(1.0, now + rampTime);
      gainNode.gain.setValueAtTime(1.0, endTime - fadeOut);
      gainNode.gain.linearRampToValueAtTime(0, endTime);

      await sleep(duration);
    },
    [startOscillator]
  );

  const playSilence = useCallback(
    async (duration: number) => {
      startOscillator();
      const ctx = audioCtx.current;
      const gainNode = gainNodeRef.current;
      if (!gainNode) return;

      const now = ctx.currentTime;
      const maxRamp = Math.max(0.002, Math.min(0.01, duration / 400));
      const rampTime = Math.min(maxRamp, duration / 400);

      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + rampTime);

      await sleep(duration);
    },
    [startOscillator]
  );

  const playMorseSequence = useCallback(
    async (letter: MorseCharacter, skipEndPause = false) => {
      const morse = MORSE_CODES_MAP.get(letter);
      if (!morse) return;
      for (const char of morse) {
        if (stopRequested.current) return;
        if (char === ".") {
          await playBeep(dotLength.current);
        } else if (char === "-") {
          await playBeep(lineLength.current);
        }
        await playSilence(dotLength.current);
      }
      if (!skipEndPause) {
        await playSilence(lineLength.current);
      }
    },
    [playBeep, playSilence]
  );

  const stopPlayback = useCallback(async () => {
    stopRequested.current = true;
    setPlaying(false);
    setStopped(true);
    stopOscillator();
  }, [stopOscillator]);

  const startPlayback = useCallback(async () => {
    stopRequested.current = false;
    setPlaying(true);
    setStopped(false);
    setCurrentGroup(0);
    startOscillator();

    await sleep(50);

    for (let i = 0; i < 3; i += 1) {
      if (stopRequested.current) return stopPlayback();
      await playMorseSequence("=");
    }

    await sleep(lineLength.current);

    for (let i = 0; i < letterChunks.length; i++) {
      setCurrentGroup(i + 1);
      if (stopRequested.current) return stopPlayback();
      for (const letter of letterChunks[i]) {
        await playMorseSequence(letter);
      }
      await playSilence(lineLength.current);
    }

    await playMorseSequence("+");
    await sleep(dotLength.current * 2);
    await playMorseSequence("V", true);
    await playMorseSequence("A", true);
    stopPlayback();
  }, [letterChunks, playMorseSequence, stopPlayback, startOscillator, playSilence]);

  useEffect(() => {
    return () => {
      stopOscillator();
    };
  }, [stopOscillator]);

  return {
    currentGroup,
    numGroups: letterChunks.length,
    playing,
    startPlayback,
    stopped,
    stopPlayback
  };
};

export default usePlayer;
