import { ALPHABETS, NUMBERS } from "./constants";
import { MorseCharacter } from "./types";
import { filterToMorse } from "./utils";

const pick = (characters: string, random: () => number) => characters.charAt(Math.floor(random() * characters.length));

/**
 * A random message for an exercise.
 *
 * A message of numbers has only numbers. Other messages are mostly letters: with a larger
 * character set, every character of the set is placed in the message once for each 125 characters,
 * and the rest of the message is random letters.
 */
export function createMessage(characters: string, length: number, random: () => number = Math.random) {
  if (characters === NUMBERS) {
    return Array.from({ length }, () => pick(NUMBERS, random)).filter(filterToMorse);
  }

  const message = Array.from({ length }, () => pick(ALPHABETS, random));

  if (characters !== ALPHABETS) {
    const rounds = Math.floor(length / 125);
    const usedIndexes = new Set<number>();
    for (let round = 0; round < rounds; round += 1) {
      for (const character of characters) {
        let index: number;
        do {
          index = Math.floor(random() * length);
        } while (usedIndexes.has(index));
        message[index] = character;
        usedIndexes.add(index);
      }
    }
  }

  return message.filter(filterToMorse) as MorseCharacter[];
}
