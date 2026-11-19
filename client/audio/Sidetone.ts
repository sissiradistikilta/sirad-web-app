import { TONE_FREQUENCY, TONE_GAIN } from "./MorsePlayer";

/**
 * How quickly the tone follows the key, in seconds. The gain approaches its target
 * exponentially, and is practically there in three time constants, about 5 ms.
 */
export const KEYING_TIME_CONSTANT = 0.0017;

/**
 * The tone of a Morse key: sounds for as long as the key is down.
 *
 * Unlike in the playback of a message, nothing can be scheduled in advance here. A sine
 * oscillator runs all the time and the key moves the gain towards the level of the tone or
 * towards silence. The gain starts from whatever it is at that moment, so the tone does not
 * click even if the key is released in the middle of the attack.
 */
class Sidetone {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  /**
   * Starts the audio. Must be called from a user interaction (e.g. a press of the key),
   * browsers do not allow audio otherwise. Calling this again is harmless.
   */
  prepare() {
    if (!this.context || this.context.state === "closed") {
      this.context = new window.AudioContext();
      this.oscillator = this.context.createOscillator();
      this.gain = this.context.createGain();

      this.oscillator.type = "sine";
      this.oscillator.frequency.value = TONE_FREQUENCY;
      this.gain.gain.value = 0;

      this.oscillator.connect(this.gain);
      this.gain.connect(this.context.destination);
      this.oscillator.start();
    }

    if (this.context.state !== "running") {
      this.context.resume().catch(() => undefined);
    }
  }

  keyDown() {
    this.prepare();
    this.setLevel(TONE_GAIN);
  }

  keyUp() {
    this.setLevel(0);
  }

  /** Silences the tone and releases the AudioContext. The tone can still be used again. */
  dispose() {
    const context = this.context;
    this.context = null;
    this.oscillator = null;
    this.gain = null;

    if (context && context.state !== "closed") {
      context.close().catch(() => undefined);
    }
  }

  private setLevel(level: number) {
    if (!this.context || !this.gain) return;
    this.gain.gain.setTargetAtTime(level, this.context.currentTime, KEYING_TIME_CONSTANT);
  }
}

export default Sidetone;
