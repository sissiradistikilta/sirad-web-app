import { vi } from "vitest";

export interface AutomationEvent {
  type: "setValue" | "linearRamp" | "setTarget";
  value: number;
  time: number;
}

export class AudioParamMock {
  events: AutomationEvent[] = [];

  constructor(public value: number) {}

  setValueAtTime(value: number, time: number) {
    this.events.push({ type: "setValue", value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "linearRamp", value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number) {
    this.events.push({ type: "setTarget", value, time });
    return this;
  }
}

class AudioNodeMock {
  connect = vi.fn();
  disconnect = vi.fn();
}

export class GainNodeMock extends AudioNodeMock {
  gain = new AudioParamMock(1);
}

export class OscillatorNodeMock extends AudioNodeMock {
  frequency = new AudioParamMock(440);
  type = "";
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

/**
 * The clock does not advance by itself: tests move currentTime, usually together with fake timers.
 * A new context is suspended until resume() is called, as in a browser before a user interaction.
 */
export class AudioContextMock {
  static instances: AudioContextMock[] = [];

  currentTime = 0;
  baseLatency = 0;
  state: AudioContextState = "suspended";
  destination = {};
  oscillators: OscillatorNodeMock[] = [];
  gains: GainNodeMock[] = [];
  addEventListener = vi.fn();
  removeEventListener = vi.fn();

  constructor(public options?: AudioContextOptions) {
    AudioContextMock.instances.push(this);
  }

  createOscillator() {
    const oscillator = new OscillatorNodeMock();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    const gain = new GainNodeMock();
    this.gains.push(gain);
    return gain;
  }

  resume = vi.fn(async () => {
    this.state = "running";
  });

  close = vi.fn(async () => {
    this.state = "closed";
  });
}

(globalThis as unknown as { AudioContext: typeof AudioContextMock }).AudioContext = AudioContextMock;
