import { TONE_FREQUENCY, TONE_GAIN } from "./MorsePlayer";

/**
 * How quickly the tone follows the key, in seconds. The gain approaches its target
 * exponentially, and is practically there in three time constants, about 5 ms.
 */
export const KEYING_TIME_CONSTANT = 0.0017;

/** How many times the delay of the audio is measured as the audio starts, and how often, in milliseconds. */
const CALIBRATION_SAMPLES = 12;
const CALIBRATION_INTERVAL = 7;

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
  /** How far ahead of what is heard the audio is scheduled, in seconds. See timeOf. */
  private lead = 0;

  /**
   * Starts the audio. Must be called from a user interaction (e.g. a press of the key),
   * browsers do not allow audio otherwise. Calling this again is harmless.
   */
  prepare() {
    if (!this.context || this.context.state === "closed") {
      this.context = new window.AudioContext();
      this.lead = 0;
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
      this.context.resume().then(
        () => this.calibrate(CALIBRATION_SAMPLES),
        () => undefined
      );
    }
  }

  /** Measures the delay of the audio a few times as it starts, for the first presses to be timed right. */
  private calibrate(samples: number) {
    const context = this.context;
    if (!context || context.state !== "running" || typeof context.getOutputTimestamp !== "function") return;

    this.timeOf(performance.now());
    if (samples > 1) window.setTimeout(() => this.calibrate(samples - 1), CALIBRATION_INTERVAL);
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
   * length of a tone would be up to a block off. That is a lot for a dot, which can be 40 ms. That is why the
   * key is moved at the time of the event itself, a constant moment later: every tone is as long as its press.
   */
  private timeOf(eventTime?: number) {
    const context = this.context;
    if (!context) return 0;

    const now = context.currentTime;
    if (eventTime === undefined || typeof context.getOutputTimestamp !== "function") return now;

    // The same moment on the clock of the audio and on the clock of the events
    const { contextTime, performanceTime } = context.getOutputTimestamp();
    if (!contextTime || !performanceTime) return now;
    const heardAt = (time: number) => contextTime + (time - performanceTime) / 1000;

    // What is scheduled now is heard a moment later. The longest such moment seen is the constant delay.
    this.lead = Math.max(this.lead, now - heardAt(performance.now()));
    return Math.max(now, heardAt(eventTime) + this.lead);
  }
}

export default Sidetone;
