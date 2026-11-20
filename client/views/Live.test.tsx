import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ApiMessage } from "../api/connection";
import { Api } from "../hooks";

import Live from "./Live";

describe("Live", () => {
  let sent: ApiMessage[];
  let listeners: Set<(message: ApiMessage) => void>;
  let api: Api;

  const receive = (message: ApiMessage) => act(() => listeners.forEach((listener) => listener(message)));
  const key = () => screen.getByRole("button", { name: "Sähkötysavain" });

  beforeEach(() => {
    sent = [];
    listeners = new Set();
    api = {
      connected: true,
      send: vi.fn((message: ApiMessage) => {
        sent.push(message);
        return true;
      }),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    };
  });

  afterEach(cleanup);

  it("goes to the default frequency and tells who else is there", () => {
    render(<Live api={api} />);
    expect(screen.getByLabelText("Taajuus (MHz)")).toHaveValue("3.6850");
    expect(sent).toEqual([{ type: "join", frequency: 3685000 }]);
    expect(key()).toBeDisabled();

    receive({ type: "channel", frequency: 3685000, users: 3, holder: null });
    expect(screen.getByText("Taajuudella on 2 muuta.")).toBeInTheDocument();
    expect(key()).toBeEnabled();
    expect(screen.getByRole("img", { name: "Vastaanotto: pois" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lähetys: pois" })).toBeInTheDocument();
  });

  it("changes the frequency when a new one is written", () => {
    render(<Live api={api} />);
    const input = screen.getByLabelText("Taajuus (MHz)");

    fireEvent.change(input, { target: { value: "7,03" } });
    expect(sent.slice(1)).toEqual([{ type: "leave" }, { type: "join", frequency: 7030000 }]);
    expect(input).toHaveAttribute("aria-invalid", "false");

    // Something that is not a frequency takes the user off the frequency
    fireEvent.change(input, { target: { value: "99" } });
    expect(sent.slice(3)).toEqual([{ type: "leave" }]);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(key()).toBeDisabled();
  });

  it("disables the key and lights RX while someone else is keying", () => {
    render(<Live api={api} />);
    receive({ type: "channel", frequency: 3685000, users: 2, holder: "other" });

    expect(key()).toBeDisabled();
    expect(screen.getByRole("img", { name: "Vastaanotto: päällä" })).toBeInTheDocument();

    receive({ type: "channel", frequency: 3685000, users: 2, holder: null });
    expect(key()).toBeEnabled();
    expect(screen.getByRole("img", { name: "Vastaanotto: pois" })).toBeInTheDocument();
  });

  it("lights TX and sends the keying when the key is used", () => {
    render(<Live api={api} />);
    receive({ type: "channel", frequency: 3685000, users: 2, holder: null });
    sent = [];

    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByRole("img", { name: "Lähetys: päällä" })).toBeInTheDocument();
    fireEvent.keyUp(window, { code: "Space" });

    expect(sent.map(({ type, down }) => ({ type, down }))).toEqual([
      { type: "key", down: true },
      { type: "key", down: false }
    ]);
  });

  it("tells when there is no backend or no connection to it", () => {
    const { rerender } = render(<Live api={{ ...api, connected: null }} />);
    expect(screen.getByText(/osoitetta ole määritetty/)).toBeInTheDocument();
    expect(key()).toBeDisabled();

    rerender(<Live api={{ ...api, connected: false }} />);
    expect(screen.getByText(/Ei yhteyttä palvelimeen/)).toBeInTheDocument();
  });
});
