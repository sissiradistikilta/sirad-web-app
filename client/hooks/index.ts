import useApiConnection, { Api } from "./useApiConnection";
import useExercise from "./useExercise";
import useKeyer from "./useKeyer";
import useLive from "./useLive";
import useLetterChunks from "./useLetterChunks";
import useMicrophoneHold, { canHoldMicrophone } from "./useMicrophoneHold";
import usePlayer from "./usePlayer";

export { canHoldMicrophone };
export { useApiConnection, useExercise, useKeyer, useLetterChunks, useLive, useMicrophoneHold, usePlayer };
export type { Api };
