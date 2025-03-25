import { vi } from "vitest"

globalThis.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn() },
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn() },
  }),
  createAnalyser: vi.fn(),
  destination: {},
  resume: vi.fn(),
  suspend: vi.fn(),
  close: vi.fn(),
  currentTime: 0,
}));
