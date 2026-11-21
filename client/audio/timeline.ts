import { MORSE_CODES_MAP } from "../constants";
import { MorseCharacter } from "../types";
import { getDotLength } from "../utils";

export type TimingMode = "standard" | "classic";

/** All durations are in seconds, the unit of the Web Audio clock. */
export interface MorseTiming {
  /** Length of a dot and of the gap between the elements of a character. A dash is three units. */
  unit: number;
  /** Gap between two characters. */
  characterGap: number;
  /** Gap between two words (groups). */
  wordGap: number;
}

export interface TimelineEvent {
  type: "tone" | "silence";
  start: number;
  end: number;
}

export interface Timeline {
  /** Contiguous tone and silence events, starting from zero. */
  events: TimelineEvent[];
  /** Start time of each word. */
  wordStarts: number[];
  /** Start time of each character, in the order they are sent. */
  characterStarts: number[];
  /** End time of the last tone. */
  duration: number;
}

export interface MessageTimeline extends Timeline {
  /** Start time of each five-character group of the message. */
  groupStarts: number[];
  /** Start time of each character of the message, without the start and the end of the message. */
  messageCharacterStarts: number[];
}

const START_OF_MESSAGE: MorseCharacter[] = ["=", "=", "="];
const END_OF_MESSAGE: MorseCharacter[] = ["+"];
// Sent as a prosign: one character without a gap between the letters
const END_OF_WORK: MorseCharacter[] = ["V", "A"];

/**
 * Standard timing is 1 unit between elements, 3 between characters and 7 between words.
 *
 * With Farnsworth timing (effective speed slower than the character speed) the characters
 * themselves are sent at the character speed and only the character and word gaps are
 * stretched. The standard word PARIS is 50 units: 31 units of elements and the gaps inside
 * the characters, and 19 units of character and word gaps. Keeping the 31 units at the
 * character speed, the 19 units are stretched so that the word takes as long as it would
 * at the effective speed.
 */
export function getMorseTiming(
  characterSpeed: number,
  effectiveSpeed = 0,
  timingMode: TimingMode = "standard"
): MorseTiming {
  const dotLength = timingMode === "classic" ? getDotLength : (speed: number) => 6000 / speed;
  const unit = dotLength(characterSpeed) / 1000;
  let gapUnit = unit;

  if (effectiveSpeed > 0 && effectiveSpeed < characterSpeed) {
    const effectiveUnit = dotLength(effectiveSpeed) / 1000;
    gapUnit = (50 * effectiveUnit - 31 * unit) / 19;
  }

  return { unit, characterGap: 3 * gapUnit, wordGap: 7 * gapUnit };
}

/**
 * Converts words of Morse patterns (e.g. [[".-", "-..."], ["-.-."]]) into a timeline.
 * A gap is only added between two elements, characters or words, never after the last one.
 */
export function buildTimeline(words: string[][], timing: MorseTiming): Timeline {
  const events: TimelineEvent[] = [];
  const wordStarts: number[] = [];
  const characterStarts: number[] = [];
  let time = 0;

  const add = (type: TimelineEvent["type"], duration: number) => {
    events.push({ type, start: time, end: time + duration });
    time += duration;
  };

  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) add("silence", timing.wordGap);
    wordStarts.push(time);

    word.forEach((pattern, characterIndex) => {
      if (characterIndex > 0) add("silence", timing.characterGap);
      characterStarts.push(time);

      Array.from(pattern).forEach((element, elementIndex) => {
        if (elementIndex > 0) add("silence", timing.unit);
        add("tone", element === "-" ? 3 * timing.unit : timing.unit);
      });
    });
  });

  return { events, wordStarts, characterStarts, duration: time };
}

const toPattern = (character: MorseCharacter) => MORSE_CODES_MAP.get(character) ?? "";

/**
 * Timeline of a whole exercise: start of message (= = =), the groups,
 * end of message (+) and end of work (VA).
 */
export function buildMessageTimeline(
  groups: MorseCharacter[][],
  characterSpeed: number,
  effectiveSpeed = 0,
  timingMode: TimingMode = "standard"
): MessageTimeline {
  const words = [
    START_OF_MESSAGE.map(toPattern),
    ...groups.map((group) => group.map(toPattern)),
    END_OF_MESSAGE.map(toPattern),
    [END_OF_WORK.map(toPattern).join("")]
  ];
  const timeline = buildTimeline(words, getMorseTiming(characterSpeed, effectiveSpeed, timingMode));

  const characters = groups.reduce((sum, group) => sum + group.length, 0);

  return {
    ...timeline,
    groupStarts: timeline.wordStarts.slice(1, 1 + groups.length),
    messageCharacterStarts: timeline.characterStarts.slice(
      START_OF_MESSAGE.length,
      START_OF_MESSAGE.length + characters
    )
  };
}
