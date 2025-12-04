import { vi } from "vitest";

class AudioContextMock {
  createOscillator() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      type: ""
    };
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() }
    };
  }
  createAnalyser() {
    return {};
  }
  destination = {};
  resume = vi.fn();
  suspend = vi.fn();
  close = vi.fn();
  currentTime = 0;
}

(globalThis as unknown as { AudioContext: typeof AudioContextMock }).AudioContext = AudioContextMock;
