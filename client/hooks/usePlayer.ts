import { useCallback, useEffect, useRef, useState } from "react";

import { buildMessageTimeline, MorsePlayer } from "../audio";
import { MorseCharacter } from "../types";

import useLetterChunks from "./useLetterChunks";

const usePlayer = (characterSpeed: number, effectiveSpeed: number, message: MorseCharacter[]) => {
  // The player, and its AudioContext, is created when the playback is started for the first time
  const player = useRef<MorsePlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);

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

  const startPlayback = useCallback(() => {
    player.current ??= new MorsePlayer();

    setPlaying(true);
    setStopped(false);
    setCurrentGroup(0);

    player.current.start(buildMessageTimeline(letterChunks, characterSpeed, effectiveSpeed), {
      onGroupChange: setCurrentGroup,
      onEnded: () => {
        setPlaying(false);
        setStopped(true);
      },
      onError: (error) => {
        console.error("Cannot start the audio playback", error);
        setPlaying(false);
      }
    });
  }, [letterChunks, characterSpeed, effectiveSpeed]);

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
