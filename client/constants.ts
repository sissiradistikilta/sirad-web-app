import { Option } from "./types";

export const MORSE_CODES = {
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  Å: ".--.-",
  Ä: ".-.-",
  Ö: "---.",
  Ü: "..--",
  "=": "-...-",
  "+": ".-.-."
};

export const MORSE_CODES_MAP = new Map(Object.entries(MORSE_CODES));

export const BASE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SPECIAL_CHARACTER_SETS: Option[] = [
  {
    label: "Ei erikoismerkkejä",
    value: ""
  },
  {
    label: "Numerot",
    value: "0123456789"
  },
  {
    label: "Ääkköset ja numerot",
    value: "ÅÄÖÜ0123456789"
  }
];

export const LENGTHS = [125, 250] as const;

export type Length = (typeof LENGTHS)[number];

export const SPEEDS = [40, 60, 80, 100, 120, 140, 160] as const;

export type Speed = (typeof SPEEDS)[number];
