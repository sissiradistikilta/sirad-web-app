import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("the title is visible", () => {
    render(<App />);
    expect(screen.getByText(/SiRad Web/)).toBeInTheDocument();
  });
});
