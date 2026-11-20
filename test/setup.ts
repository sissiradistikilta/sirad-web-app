import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

import "./audio-context-mock";

// What a test stores in the browser is not there for the next one
afterEach(() => {
  if (typeof window !== "undefined") window.localStorage?.clear();
});
