/** The frequencies that can be used, in hertz: the HF band of a field radio, in steps of 100 Hz. */
export const MIN_FREQUENCY = 1500000;
export const MAX_FREQUENCY = 30000000;
export const FREQUENCY_STEP = 100;
/** How long a frequency stays reserved for the one who keyed last, after the key was released, in milliseconds. */
export const RELEASE_DELAY = 500;
/** How long a key can be held down before the frequency is taken away, in milliseconds. */
export const MAX_KEY_DOWN = 30000;

/** Who is keying on a frequency, from the point of view of the one who is told. */
export type Holder = "self" | "other" | null;

export type ChannelMessage =
  | {
      type: "channel";
      frequency: number;
      users: number;
      holder: Holder;
    } /** The time t is on the clock of the one who keys. It is null when the server lets the key go, which means right away. */
  | { type: "key"; down: boolean; t: number | null };

export interface ChannelsOptions {
  releaseDelay?: number;
  maxKeyDown?: number;
}

interface Channel<Member> {
  frequency: number;
  members: Set<Member>;
  /** The one who is keying, or who keyed last and still has the frequency. */
  holder: Member | null;
  down: boolean;
  releaseTimer: ReturnType<typeof setTimeout> | null;
  maxDownTimer: ReturnType<typeof setTimeout> | null;
}

export function isFrequency(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_FREQUENCY &&
    value <= MAX_FREQUENCY &&
    value % FREQUENCY_STEP === 0
  );
}

/**
 * The frequencies of live keying. Those who are on the same frequency hear the keying of each other.
 *
 * Only one can key at a time: the first press of a key reserves the frequency, and it is released
 * a moment after the key was last released. The keying of the others is ignored meanwhile.
 * The keying is not sent back to the one who keys.
 */
class Channels<Member> {
  private readonly channels = new Map<number, Channel<Member>>();
  private readonly frequencies = new Map<Member, number>();
  private readonly releaseDelay: number;
  private readonly maxKeyDown: number;

  /** @param send Sends a message to a member. */
  constructor(
    private readonly send: (member: Member, message: ChannelMessage) => void,
    options: ChannelsOptions = {}
  ) {
    this.releaseDelay = options.releaseDelay ?? RELEASE_DELAY;
    this.maxKeyDown = options.maxKeyDown ?? MAX_KEY_DOWN;
  }

  /** Moves a member to a frequency. Everyone on the frequency is told about the new situation. */
  join(member: Member, frequency: number) {
    if (this.frequencies.get(member) === frequency) {
      const current = this.channels.get(frequency);
      if (current) this.tell(current, member);
      return;
    }
    this.leave(member);

    let channel = this.channels.get(frequency);
    if (!channel) {
      channel = { frequency, members: new Set(), holder: null, down: false, releaseTimer: null, maxDownTimer: null };
      this.channels.set(frequency, channel);
    }
    channel.members.add(member);
    this.frequencies.set(member, frequency);
    this.tellAll(channel);
  }

  /** Takes a member off its frequency, e.g. when its connection closes. */
  leave(member: Member) {
    const channel = this.channelOf(member);
    if (!channel) return;

    if (channel.holder === member) this.release(channel, null);
    channel.members.delete(member);
    this.frequencies.delete(member);

    if (channel.members.size === 0) {
      this.clearTimers(channel);
      this.channels.delete(channel.frequency);
    } else {
      this.tellAll(channel);
    }
  }

  /**
   * A member pressed or released its key.
   *
   * @param t The time of the event on the clock of the member, in milliseconds. It is passed on as such,
   *          for the listeners to reproduce the rhythm regardless of the delays of the network.
   */
  key(member: Member, down: boolean, t: number) {
    const channel = this.channelOf(member);
    if (!channel) return;

    if (channel.holder !== null && channel.holder !== member) {
      // Someone else has the frequency: the member is reminded of it
      this.tell(channel, member);
      return;
    }
    if (down === channel.down && channel.holder === member) return;
    if (!down && channel.holder !== member) return;

    const reserved = channel.holder !== member;
    channel.holder = member;
    channel.down = down;
    this.clearTimers(channel);
    if (reserved) this.tellAll(channel);
    this.relay(channel, { type: "key", down, t });

    if (down) {
      channel.maxDownTimer = setTimeout(() => this.release(channel, t + this.maxKeyDown), this.maxKeyDown);
    } else {
      channel.releaseTimer = setTimeout(() => this.release(channel, t), this.releaseDelay);
    }
  }

  /** How many members there are on a frequency. */
  users(frequency: number) {
    return this.channels.get(frequency)?.members.size ?? 0;
  }

  private channelOf(member: Member) {
    const frequency = this.frequencies.get(member);
    return frequency === undefined ? undefined : this.channels.get(frequency);
  }

  /** Frees the frequency. If the key was still down, the listeners are told that it went up. */
  private release(channel: Channel<Member>, t: number | null) {
    this.clearTimers(channel);
    if (channel.down) this.relay(channel, { type: "key", down: false, t });
    channel.down = false;
    channel.holder = null;
    this.tellAll(channel);
  }

  private clearTimers(channel: Channel<Member>) {
    if (channel.releaseTimer !== null) clearTimeout(channel.releaseTimer);
    if (channel.maxDownTimer !== null) clearTimeout(channel.maxDownTimer);
    channel.releaseTimer = null;
    channel.maxDownTimer = null;
  }

  /** Sends a message to everyone on the frequency except the one who is keying. */
  private relay(channel: Channel<Member>, message: ChannelMessage) {
    channel.members.forEach((member) => {
      if (member !== channel.holder) this.send(member, message);
    });
  }

  private tell(channel: Channel<Member>, member: Member) {
    const holder: Holder = channel.holder === null ? null : channel.holder === member ? "self" : "other";
    this.send(member, { type: "channel", frequency: channel.frequency, users: channel.members.size, holder });
  }

  private tellAll(channel: Channel<Member>) {
    channel.members.forEach((member) => this.tell(channel, member));
  }
}

export default Channels;
