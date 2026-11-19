import { MORSE_CODES } from "../constants";
import { MorseCharacter } from "../types";

export type MorseElement = "." | "-";

export interface DecoderOptions {
  /** A press shorter than this many units is a dot, a longer one a dash. A dot is 1 unit and a dash 3. */
  dashLimit?: number;
  /** A pause of at least this many units ends the character. The pause is 1 unit inside a character and 3 after it. */
  characterGapLimit?: number;
}

const CHARACTERS = new Map(Object.entries(MORSE_CODES).map(([character, pattern]) => [pattern, character]));

/** The character of a pattern of dots and dashes, e.g. ".-" is A. */
export function patternToCharacter(pattern: string) {
  return CHARACTERS.get(pattern) as MorseCharacter | undefined;
}

/**
 * Turns the presses of a Morse key into patterns of dots and dashes, one character at a time.
 *
 * The decoder has no clock of its own. It is told when the key goes down and up, and asked
 * with poll() whether the pause after the latest press has been long enough to end the character.
 * All times are in milliseconds on the same clock, e.g. the time stamps of the events.
 */
class MorseDecoder {
  private readonly dashLimit: number;
  private readonly characterGapLimit: number;
  private elements = "";
  private downAt: number | null = null;
  private upAt: number | null = null;

  /** @param unit Length of a dot in milliseconds at the speed that is being sent. */
  constructor(unit: number, options: DecoderOptions = {}) {
    this.dashLimit = unit * (options.dashLimit ?? 2);
    this.characterGapLimit = unit * (options.characterGapLimit ?? 2);
  }

  /** The dots and dashes of the character that is being sent. */
  get pattern() {
    return this.elements;
  }

  get keyIsDown() {
    return this.downAt !== null;
  }

  /** The time when the character that is being sent ends unless the key is pressed again. */
  get deadline() {
    return this.downAt === null && this.upAt !== null && this.elements ? this.upAt + this.characterGapLimit : null;
  }

  /** Returns the pattern of the previous character if it was ended by the pause before this press. */
  keyDown(time: number) {
    if (this.downAt !== null) return null;

    const completed = this.poll(time);
    this.downAt = time;
    return completed;
  }

  /** Returns the element that the press made. */
  keyUp(time: number): MorseElement | null {
    if (this.downAt === null) return null;

    const element = time - this.downAt < this.dashLimit ? "." : "-";
    this.elements += element;
    this.downAt = null;
    this.upAt = time;
    return element;
  }

  /** Returns the pattern of the character when the pause after it has been long enough, and starts a new one. */
  poll(time: number) {
    const deadline = this.deadline;
    if (deadline === null || time < deadline) return null;

    const completed = this.elements;
    this.elements = "";
    return completed;
  }

  /** Forgets the character that is being sent. */
  reset() {
    this.elements = "";
    this.downAt = null;
    this.upAt = null;
  }
}

export default MorseDecoder;
