import { MORSE_CODES } from "./constants";

/** The characters that a message can have: not the marks of the start and the end of a message. */
const CHARACTERS = new Set(Object.keys(MORSE_CODES).filter((character) => character !== "=" && character !== "+"));

/**
 * What has been written as the answer of an exam, one entry for each character of the message:
 * the character, or an empty string for a character that was skipped with a space.
 *
 * Small letters are taken as capitals, and anything that cannot be in a message is ignored.
 * The answer is never longer than the message.
 */
export function parseAnswer(text: string, length: number) {
  const answers: string[] = [];
  for (const typed of text) {
    if (answers.length >= length) break;

    const character = typed.toUpperCase();
    if (typed === " ") answers.push("");
    else if (CHARACTERS.has(character)) answers.push(character);
  }
  return answers;
}

export interface Marks {
  correct: number;
  /** A wrong character was written. */
  wrong: number;
  /** Skipped, or not written at all. */
  empty: number;
}

/** Compares the answer with the message, character by character. */
export function markAnswer(message: string[], answers: string[]): Marks {
  const marks = { correct: 0, wrong: 0, empty: 0 };
  message.forEach((character, index) => {
    const answer = answers[index] ?? "";
    if (answer === character) marks.correct += 1;
    else if (answer === "") marks.empty += 1;
    else marks.wrong += 1;
  });
  return marks;
}
