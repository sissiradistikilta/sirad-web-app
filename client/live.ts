/** The frequencies of live keying, in hertz: the HF band of a field radio, in steps of 100 Hz. */
export const MIN_FREQUENCY = 1500000;
export const MAX_FREQUENCY = 30000000;
export const FREQUENCY_STEP = 100;
export const DEFAULT_FREQUENCY = 3685000;

/** Who is keying on a frequency: this user, someone else or nobody. */
export type Holder = "self" | "other" | null;

/** What the backend tells about the frequency the user is on. */
export interface LiveChannel {
  frequency: number;
  /** How many there are on the frequency, this user included. */
  users: number;
  holder: Holder;
}

/**
 * The frequency in hertz of megahertz written by a user, e.g. "3.685" or "3,6850" -> 3685000.
 * Null if it is not a frequency that can be used.
 */
export function parseFrequency(text: string) {
  const match = /^(\d{1,2})(?:[.,](\d{0,4}))?$/.exec(text.trim());
  if (!match) return null;

  const frequency = Number(match[1]) * 1000000 + Number((match[2] ?? "").padEnd(4, "0")) * FREQUENCY_STEP;
  return frequency >= MIN_FREQUENCY && frequency <= MAX_FREQUENCY ? frequency : null;
}

/** A frequency in megahertz as on the display of a radio, e.g. 3685000 -> "3.6850". */
export function formatFrequency(frequency: number) {
  return (frequency / 1000000).toFixed(4);
}
