import { TONE_FREQUENCY, TONE_GAIN } from "./MorsePlayer";

/**
 * How quickly the tone follows the key, in seconds. The gain approaches its target
 * exponentially, and is practically there in three time constants, about 5 ms.
 */
export const KEYING_TIME_CONSTANT = 0.0017;

/** After this long without the key being used, the next press is timed from a clean start, in milliseconds. */
const BURST_IDLE = 1500;

/**
 * The tone of a Morse key: sounds for as long as the key is down.
 *
 * Unlike in the playback of a message, nothing can be scheduled in advance here. A sine
 * oscillator runs all the time and the key moves the gain towards the level of the tone or
 * towards silence. The gain starts from whatever it is at that moment, so the tone does not
 * click even if the key is released in the middle of the attack.
 *
 * The same audio output also plays keying that comes from elsewhere (keyAt), with a gain of its own.
 * One AudioContext is enough for both: a second one would be a second audio stream for the device to
 * mix, and on some devices that adds delay to the tone of the key.
 */
class Sidetone {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  /** The gain of the keying that comes from elsewhere. */
  private scheduled: GainNode | null = null;
  /** The difference of the audio clock and the clock of the events of the key, in seconds. See timeOf. */
  private offset: number | null = null;
  private lastEvent = 0;

  /**
   * Starts the audio. Must be called from a user interaction (e.g. a press of the key),
   * browsers do not allow audio otherwise. Calling this again is harmless.
   */
  prepare() {
    if (!this.context || this.context.state === "closed") {
      // The smallest delay the device can do. By default a browser plays the audio in larger blocks to
      // save power, which makes the tone follow the key several times later (e.g. 40 ms instead of 10 ms).
      this.context = new window.AudioContext({ latencyHint: 0 });
      this.offset = null;
      this.oscillator = this.context.createOscillator();
      this.gain = this.context.createGain();
      this.scheduled = this.context.createGain();

      this.oscillator.type = "sine";
      this.oscillator.frequency.value = TONE_FREQUENCY;
      this.gain.gain.value = 0;
      this.scheduled.gain.value = 0;

      this.oscillator.connect(this.gain);
      this.gain.connect(this.context.destination);
      this.oscillator.connect(this.scheduled);
      this.scheduled.connect(this.context.destination);
      this.oscillator.start();
    }

    if (this.context.state !== "running") {
      this.context.resume().catch(() => undefined);
    }
  }

  /**
   * The key went down.
   *
   * @param eventTime The time of the press in milliseconds on the clock of performance.now(), e.g. the
   *                  timeStamp of the event. With it the tone gets exactly the length of the press.
   */
  keyDown(eventTime?: number) {
    this.prepare();
    this.setLevel(TONE_GAIN, eventTime);
  }

  keyUp(eventTime?: number) {
    this.setLevel(0, eventTime);
  }

  /** The time of the audio clock in seconds, or null if the audio has not been started. */
  get currentTime() {
    return this.context && this.context.state === "running" ? this.context.currentTime : null;
  }

  /**
   * Moves the key at the given time of the audio clock, in seconds. This is for keying that comes
   * from elsewhere and is played a moment late, to keep its rhythm regardless of when it arrives.
   */
  keyAt(down: boolean, time: number) {
    if (!this.context || !this.scheduled) return;
    this.scheduled.gain.setTargetAtTime(
      down ? TONE_GAIN : 0,
      Math.max(time, this.context.currentTime),
      KEYING_TIME_CONSTANT
    );
  }

  /** Silences the tone and releases the AudioContext. The tone can still be used again. */
  dispose() {
    const context = this.context;
    this.context = null;
    this.oscillator = null;
    this.gain = null;
    this.scheduled = null;

    if (context && context.state !== "closed") {
      context.close().catch(() => undefined);
    }
  }

  private setLevel(level: number, eventTime?: number) {
    if (!this.context || !this.gain) return;
    this.gain.gain.setTargetAtTime(level, this.timeOf(eventTime), KEYING_TIME_CONSTANT);
  }

  /**
   * The time of the audio clock at which an event of the key is played.
   *
   * The audio clock advances a block of audio at a time, about 3-10 ms depending on the device. If the key
   * were simply moved "now", the presses and the releases would land on the edges of the blocks, and the
   * lengths of the tones and of the gaps between them would be up to a block off. That is a lot for a dot,
   * which can be 40 ms.
   *
   * That is why the first press of a burst of keying sets the two clocks side by side, one block ahead, and
   * the events after it are played by their own times. Every tone and every gap is then exactly as long
   * as it was keyed.
   */
  private timeOf(eventTime?: number) {
    const context = this.context;
    if (!context) return 0;

    const now = context.currentTime;
    if (eventTime === undefined) {
      this.offset = null;
      return now;
    }

    const seconds = eventTime / 1000;
    const continues = this.offset !== null && eventTime - this.lastEvent < BURST_IDLE;
    this.lastEvent = eventTime;
    if (continues && this.offset !== null && seconds + this.offset >= now) return seconds + this.offset;

    // The first event of a burst, or the events have fallen behind the audio: a new start
    const block = Math.min(Math.max(context.baseLatency || 0.005, 0.003), 0.02);
    this.offset = now + block - seconds;
    return now + block;
  }
}

export default Sidetone;
