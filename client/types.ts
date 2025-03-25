import { LENGTHS, MORSE_CODES, SPEEDS } from "./constants";

export interface Option {
  label: string;
  value: string;
}

export type MorseCharacter = keyof typeof MORSE_CODES;
