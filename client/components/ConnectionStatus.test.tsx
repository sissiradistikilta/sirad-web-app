import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ConnectionStatus from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it("shows a green light when connected", () => {
    render(<ConnectionStatus connected />);
    const light = screen.getByRole("status", { name: "Yhteys palvelimeen" });
    expect(light).toHaveClass("ConnectionStatus-connected");
  });

  it("shows a red light when not connected", () => {
    render(<ConnectionStatus connected={false} />);
    const light = screen.getByRole("status", { name: "Ei yhteyttä palvelimeen" });
    expect(light).toHaveClass("ConnectionStatus-disconnected");
  });
});
