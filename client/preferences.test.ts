import { afterEach, describe, expect, it, vi } from "vitest";

import { readConnectionPreference, writeConnectionPreference } from "./preferences";

describe("the preference of the connection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is on until switched off, and remembered", () => {
    expect(readConnectionPreference()).toBe(true);
    writeConnectionPreference(false);
    expect(readConnectionPreference()).toBe(false);
    writeConnectionPreference(true);
    expect(readConnectionPreference()).toBe(true);
  });

  it("is on if the browser does not let anything be stored", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(() => writeConnectionPreference(false)).not.toThrow();
    expect(readConnectionPreference()).toBe(true);
  });
});
