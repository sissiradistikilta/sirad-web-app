import { MORSE_CODES_MAP } from "./constants";
import { MorseCharacter } from "./types";

export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function getDotLength(speed: number) {
  return 60000 / (9 * speed);
}

export function getLineLength(speed: number) {
  return getDotLength(speed) * 3;
}

export function chunkArray<T>(arr: Array<T>, chunkSize: number) {
  const result: Array<Array<T>> = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}

export function filterToMorse(character: string): character is MorseCharacter {
  return Boolean(MORSE_CODES_MAP.get(character));
}
