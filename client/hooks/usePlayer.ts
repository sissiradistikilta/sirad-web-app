import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  const createAudioContext = useCallback(() => {
    if (audioCtx.current && audioCtx.current.state !== "closed") {
      return;
    }

    audioCtx.current = new window.AudioContext();
    let silence = audioCtx.current.createBufferSource();
    silence.buffer = audioCtx.current.createBuffer(1, 22050, 22050);
    silence.connect(audioCtx.current.destination);
    silence.start();
  }, []);

  const playBeep = useCallback(
    (duration: number) => {
      createAudioContext();
      const oscillator = audioCtx.current.createOscillator();
      const gainNode = audioCtx.current.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.current.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioCtx.current.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.current.currentTime + duration / 1000);
    },
    [createAudioContext]
  );

  const playMorseSequence = useCallback(
    async (letter: MorseCharacter, skipEndPause = false) => {
      const morse = MORSE_CODES_MAP.get(letter);
      if (!morse) return;
      for (let char of morse) {
        if (stopRequested.current) return;
        if (char === ".") {
          playBeep(dotLength.current);
          await sleep(dotLength.current);
        } else if (char === "-") {
          playBeep(lineLength.current);
          await sleep(lineLength.current);
        }
        await sleep(dotLength.current);
      }
      if (!skipEndPause) {
        await sleep(lineLength.current);
      }
    },
    [playBeep]
  );

  const stopPlayback = useCallback(async () => {
    stopRequested.current = true;
    setPlaying(false);
    setStopped(true);
  }, []);

  const startPlayback = useCallback(async () => {
    stopRequested.current = false;
    setPlaying(true);
    setStopped(false);

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
      await sleep(lineLength.current);
    }

    await playMorseSequence("+");
    await sleep(dotLength.current * 2);
    await playMorseSequence("V", true);
    await playMorseSequence("A", true);
    stopPlayback();
  }, [letterChunks, playMorseSequence, stopPlayback]);

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
