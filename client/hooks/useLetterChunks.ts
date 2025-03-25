import { useMemo } from "react";

import { MorseCharacter } from "../types";

const useLetterChunks = (message: MorseCharacter[]) =>
  useMemo(
    () => Array.from({ length: Math.ceil(message.length / 5) }, (_, i) => message.slice(i * 5, i * 5 + 5)),
    [message]
  );

export default useLetterChunks;
