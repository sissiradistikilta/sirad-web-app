import { MORSE_CODES } from "./constants";

export interface Option {
  label: string;
  shortLabel: string;
  value: string;
}

export type MorseCharacter = keyof typeof MORSE_CODES;
