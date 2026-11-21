import { useCallback, useEffect, useRef, useState } from "react";

import { buildMessageTimeline, MorsePlayer, TimingMode } from "../audio";
import { MorseCharacter } from "../types";

import useLetterChunks from "./useLetterChunks";

const usePlayer = (
  characterSpeed: number,
  effectiveSpeed: number,
  message: MorseCharacter[],
  timingMode?: TimingMode
) => {
  // The player, and its AudioContext, is created when the playback is started for the first time
  const player = useRef<MorsePlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [currentCharacter, setCurrentCharacter] = useState(0);

  const letterChunks = useLetterChunks(message);

  useEffect(() => {
    setStopped(false);
  }, [message]);

  useEffect(() => {
    return () => {
      player.current?.dispose();
      player.current = null;
    };
  }, []);

  const stopPlayback = useCallback(() => {
    player.current?.stop();
    setPlaying(false);
    setStopped(true);
  }, []);

  /** @param groups A message to play instead of the one given to the hook, when it was created just now. */
  const startPlayback = useCallback(
    (groups?: MorseCharacter[][]) => {
      player.current ??= new MorsePlayer();

      setPlaying(true);
      setStopped(false);
      setCurrentGroup(0);
      setCurrentCharacter(0);

      player.current.start(
        buildMessageTimeline(Array.isArray(groups) ? groups : letterChunks, characterSpeed, effectiveSpeed, timingMode),
        {
          onGroupChange: setCurrentGroup,
          onCharacterChange: setCurrentCharacter,
          onEnded: () => {
            setPlaying(false);
            setStopped(true);
          },
          onError: (error) => {
            console.error("Cannot start the audio playback", error);
            setPlaying(false);
          }
        }
      );
    },
    [letterChunks, characterSpeed, effectiveSpeed, timingMode]
  );

  return {
    currentCharacter,
    currentGroup,
    numGroups: letterChunks.length,
    playing,
    startPlayback,
    stopped,
    stopPlayback
  };
};

export default usePlayer;
