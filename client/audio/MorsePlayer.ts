import { MessageTimeline, TimelineEvent } from "./timeline";

export const TONE_FREQUENCY = 800;
/** Level of the tone, 1 being full scale. */
export const TONE_GAIN = 0.8;

/** Attack and release time of a Morse element, in seconds. */
export const RAMP_TIME = 0.005;
/** How far ahead of the audio clock the tones are scheduled, in seconds. */
export const LOOKAHEAD = 0.3;
/** Timers of a hidden tab are throttled to about once a second, so more is scheduled at a time. */
export const HIDDEN_LOOKAHEAD = 2.5;
/** How often the scheduling queue is topped up, in milliseconds. */
export const SCHEDULER_INTERVAL = 25;
/** Silence before the first tone, in seconds. */
export const START_DELAY = 0.1;
/** The closest to the current time that anything is scheduled, in seconds. */
export const MIN_LEAD = 0.02;
/** Tones are not added to the queue when a ramp starts sooner than this, in seconds. See canSchedule. */
export const QUIET_TIME = 0.02;
/** ...unless the next tone to be added starts sooner than this, in seconds. */
export const URGENT_LEAD = 0.1;
/** Fade out time when the playback is stopped, in seconds. */
export const STOP_FADE = 0.01;
/** Silence after the last tone before the playback is reported as ended, in seconds. */
export const END_TAIL = 0.05;

export interface PlaybackCallbacks {
  /** Number of the message group that is being played, 0 before the first group. */
  onGroupChange?: (group: number) => void;
  /** Number of the character of the message that is being played, 0 before the first character. */
  onCharacterChange?: (character: number) => void;
  /** The whole message was played. Not called when the playback is stopped. */
  onEnded?: () => void;
  /** The playback could not be started. */
  onError?: (error: unknown) => void;
}

interface Session {
  context: AudioContext;
  oscillator: OscillatorNode;
  keyGain: GainNode;
  masterGain: GainNode;
  timeline: MessageTimeline;
  tones: TimelineEvent[];
  callbacks: PlaybackCallbacks;
  ramp: number;
  /** Start times of the scheduled ramps that have not been rendered yet. */
  ramps: number[];
  /** Time of the audio clock at the start of the timeline. */
  startTime: number;
  nextTone: number;
  group: number;
  character: number;
  timer: number;
}

/**
 * Plays a precalculated Morse timeline with the Web Audio API.
 *
 * One sine oscillator runs for the duration of a playback and the tones are keyed with gain
 * automation on the clock of the AudioContext. A JavaScript timer only tops up the queue
 * of scheduled tones a little ahead of the audio clock, it never times an individual tone.
 *
 * Each playback has its own nodes: oscillator -> key gain (the Morse envelope) -> master gain.
 * Stopping fades the master gain out and discards the nodes, so nothing scheduled for
 * a previous playback can be heard in the next one.
 */
class MorsePlayer {
  private context: AudioContext | null = null;
  private session: Session | null = null;
  /** Identifies the latest start or stop request, to ignore the outcome of an outdated one. */
  private generation = 0;

  /** Must be called from a user interaction (e.g. a click), browsers do not allow audio otherwise. */
  start(timeline: MessageTimeline, callbacks: PlaybackCallbacks = {}) {
    this.stop();
    const generation = this.generation;

    let context: AudioContext;
    try {
      context = this.getContext();
    } catch (error) {
      callbacks.onError?.(error);
      return;
    }

    if (context.state === "running") {
      this.begin(context, timeline, callbacks);
      return;
    }

    context.resume().then(
      () => {
        if (generation === this.generation) this.begin(context, timeline, callbacks);
      },
      (error: unknown) => {
        if (generation === this.generation) callbacks.onError?.(error);
      }
    );
  }

  stop() {
    this.generation += 1;

    const session = this.session;
    if (!session) return;

    const { context, masterGain } = session;
    if (context.state !== "running") {
      // The audio clock is not advancing, a fade out would only be heard when it continues
      this.end(session);
      this.disconnect(session);
      return;
    }

    // The master gain has no other automation, so its value is known without reading it back.
    // The fade is scheduled a little ahead for it to be rendered as a whole.
    const fadeStart = context.currentTime + Math.max(MIN_LEAD, Math.min(context.baseLatency || 0, 0.05));
    masterGain.gain.setValueAtTime(1, fadeStart);
    masterGain.gain.linearRampToValueAtTime(0, fadeStart + STOP_FADE);
    this.end(session, fadeStart + STOP_FADE);
  }

  /** Stops the playback and releases the AudioContext. The player can still be started again. */
  dispose() {
    this.stop();

    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      context.close().catch(() => undefined);
    }
  }

  private getContext() {
    if (!this.context || this.context.state === "closed") {
      this.context = new window.AudioContext();
    }
    return this.context;
  }

  private begin(context: AudioContext, timeline: MessageTimeline, callbacks: PlaybackCallbacks) {
    const oscillator = context.createOscillator();
    const keyGain = context.createGain();
    const masterGain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = TONE_FREQUENCY;
    keyGain.gain.value = 0;

    oscillator.connect(keyGain);
    keyGain.connect(masterGain);
    masterGain.connect(context.destination);
    oscillator.start();

    // The attack and the release of a tone must fit in the shortest tone and the shortest gap
    const shortest = timeline.events.reduce((min, event) => Math.min(min, event.end - event.start), Infinity);

    const session: Session = {
      context,
      oscillator,
      keyGain,
      masterGain,
      timeline,
      tones: timeline.events.filter((event) => event.type === "tone"),
      callbacks,
      ramp: Math.min(RAMP_TIME, shortest / 2),
      ramps: [],
      startTime: context.currentTime + START_DELAY,
      nextTone: 0,
      group: 0,
      character: 0,
      timer: window.setInterval(() => this.tick(session), SCHEDULER_INTERVAL)
    };
    this.session = session;

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    context.addEventListener("statechange", this.handleStateChange);

    this.tick(session);
  }

  private tick(session: Session) {
    if (session !== this.session) return;

    const { context, timeline, tones, ramp } = session;
    const now = context.currentTime;
    const hidden = document.visibilityState === "hidden";
    const horizon = now + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);

    while (session.ramps.length > 0 && session.ramps[0] + ramp <= now) session.ramps.shift();
    const scheduling = session.nextTone < tones.length && this.canSchedule(session, now, hidden);

    while (scheduling && session.nextTone < tones.length) {
      const tone = tones[session.nextTone];
      // The ramps are centered on the nominal start and end of the tone,
      // which keeps the lengths of the tones and the gaps exact at half amplitude
      let attackStart = session.startTime + tone.start - ramp / 2;

      if (attackStart < now + MIN_LEAD) {
        // The scheduler has been held up for longer than the look-ahead. The rest of
        // the timeline is delayed rather than starting a tone in the past, which would click.
        session.startTime += now + MIN_LEAD - attackStart;
        attackStart = now + MIN_LEAD;
      }
      if (attackStart >= horizon) break;

      const releaseStart = session.startTime + tone.end - ramp / 2;
      const { gain } = session.keyGain;
      gain.setValueAtTime(0, attackStart);
      gain.linearRampToValueAtTime(TONE_GAIN, attackStart + ramp);
      gain.setValueAtTime(TONE_GAIN, releaseStart);
      gain.linearRampToValueAtTime(0, releaseStart + ramp);

      session.ramps.push(attackStart, releaseStart);
      session.nextTone += 1;
    }

    const position = now - session.startTime;

    let group = session.group;
    while (group < timeline.groupStarts.length && position >= timeline.groupStarts[group]) {
      group += 1;
    }
    if (group !== session.group) {
      session.group = group;
      session.callbacks.onGroupChange?.(group);
    }

    const starts = timeline.messageCharacterStarts;
    let character = session.character;
    while (character < starts.length && position >= starts[character]) {
      character += 1;
    }
    if (character !== session.character) {
      session.character = character;
      session.callbacks.onCharacterChange?.(character);
    }

    if (session.nextTone >= tones.length && position >= timeline.duration + END_TAIL) {
      // Everything has been played and the key gain is at zero
      this.end(session);
      session.callbacks.onEnded?.();
    }
  }

  /**
   * Chromium's audio thread does not wait if the automation of a gain is being changed at
   * the very moment it renders. It uses the previous value for that render quantum instead,
   * which is harmless while the gain is constant but turns a ramp into a step, which clicks.
   * The moment is very short, but it can stretch to milliseconds on a busy computer. This was
   * seen a few times in measurements. That is why tones are added to the queue only when
   * no ramp is being rendered or about to be. The exceptions are a queue that is running low,
   * and a hidden page, where the timer rarely gets a turn.
   */
  private canSchedule(session: Session, now: number, hidden: boolean) {
    const nextRamp = session.ramps[0];
    if (hidden || nextRamp === undefined || nextRamp >= now + QUIET_TIME) return true;

    const nextAttack = session.startTime + session.tones[session.nextTone].start - session.ramp / 2;
    return nextAttack < now + URGENT_LEAD;
  }

  /** Ends the session: nothing more is scheduled and the nodes are discarded once the oscillator stops. */
  private end(session: Session, stopTime?: number) {
    window.clearInterval(session.timer);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    session.context.removeEventListener("statechange", this.handleStateChange);
    if (this.session === session) this.session = null;

    session.oscillator.onended = () => this.disconnect(session);
    try {
      session.oscillator.stop(stopTime);
    } catch {
      this.disconnect(session);
    }
  }

  private disconnect(session: Session) {
    session.oscillator.onended = null;
    session.oscillator.disconnect();
    session.keyGain.disconnect();
    session.masterGain.disconnect();
  }

  private resumeContext(context: AudioContext) {
    if (context.state !== "running" && context.state !== "closed") {
      context.resume().catch(() => undefined);
    }
  }

  private handleVisibilityChange = () => {
    const session = this.session;
    if (!session) return;

    // Some browsers suspend the audio of a hidden tab and do not continue it by themselves
    if (document.visibilityState === "visible") this.resumeContext(session.context);
    // Extends the look-ahead right away when the tab gets hidden, before the timers are throttled
    this.tick(session);
  };

  private handleStateChange = () => {
    // The browser can suspend the context e.g. for an interruption on a phone
    if (this.session) this.resumeContext(this.session.context);
  };
}

export default MorsePlayer;
