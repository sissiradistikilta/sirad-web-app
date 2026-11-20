import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AudioContextMock } from "../../test/audio-context-mock";
import { Backend, BrowserWebSocket, openStation, startBackend } from "../../test/backend";
import App from "../App";

// The whole frontend against the real backend: what a user sees when the backend is there, and when it is not.

const FREQUENCY = 3685000;
const RELEASE_DELAY = 120;
const FAST = { reconnectDelays: [50] };

// The backend and the frontends are really running: on a busy machine things can take a while
configure({ asyncUtilTimeout: 5000 });

const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("the app with the backend", () => {
  let backend: Backend;

  const start = () =>
    startBackend({ allowedOrigins: [window.location.origin], channels: { releaseDelay: RELEASE_DELAY } });
  const renderApp = () => render(<App apiUrl={backend.url} connection={FAST} live />);
  const openLive = async () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Live" }));
    await screen.findByText("Taajuudella ei ole muita.");
  };
  const key = () => screen.getByRole("button", { name: "Sähkötysavain" });
  const lamp = (name: string) => screen.getByRole("img", { name });

  beforeEach(async () => {
    AudioContextMock.instances = [];
    vi.stubGlobal("WebSocket", BrowserWebSocket);
    backend = await start();
  });

  afterEach(async () => {
    cleanup();
    await backend.stop();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("shows with the light whether there is a connection to the backend", async () => {
    renderApp();
    expect(screen.getByRole("status", { name: "Ei yhteyttä palvelimeen" })).toBeInTheDocument();
    await screen.findByRole("status", { name: "Yhteys palvelimeen" });
    const { port } = backend;

    await backend.stop();
    await screen.findByRole("status", { name: "Ei yhteyttä palvelimeen" });

    backend = await startBackend({ port });
    await screen.findByRole("status", { name: "Yhteys palvelimeen" });
  });

  it("does not connect to the backend when live keying is not in use", async () => {
    render(<App apiUrl={backend.url} connection={FAST} live={false} />);

    await sleep(150);
    expect(backend.connections()).toBe(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Live" })).not.toBeInTheDocument();
  });

  it("stays without a connection when the backend does not allow the address of the frontend", async () => {
    await backend.stop();
    backend = await startBackend({ allowedOrigins: ["https://cw.sirad.fi"] });
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Live" }));

    await sleep(200);
    expect(screen.getByRole("status", { name: "Ei yhteyttä palvelimeen" })).toBeInTheDocument();
    expect(screen.getByText(/Ei yhteyttä palvelimeen. Yhteyttä yritetään uudelleen/)).toBeInTheDocument();
    expect(key()).toBeDisabled();
    expect(backend.connections()).toBe(0);
  });

  it("tells in the Live mode who else is on the frequency", async () => {
    await openLive();
    expect(key()).toBeEnabled();

    const station = await openStation(backend, FREQUENCY);
    await screen.findByText("Taajuudella on yksi muu.");
    const another = await openStation(backend, FREQUENCY);
    await screen.findByText("Taajuudella on 2 muuta.");

    station.close();
    another.close();
    await screen.findByText("Taajuudella ei ole muita.");
  });

  it("lights RX and disables the key while someone else is keying", async () => {
    await openLive();
    const station = await openStation(backend, FREQUENCY);
    await screen.findByText("Taajuudella on yksi muu.");

    station.key(true, 1000);
    await waitFor(() => expect(lamp("Vastaanotto: päällä")).toBeInTheDocument());
    expect(key()).toBeDisabled();
    expect(lamp("Lähetys: pois")).toBeInTheDocument();
    expect(screen.getByText(/Taajuudella sähkötetään/)).toBeInTheDocument();

    // The space bar does nothing meanwhile
    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.keyUp(window, { code: "Space" });
    await sleep(60);
    expect(station.messages.some(({ type }) => type === "key")).toBe(false);

    station.key(false, 1100);
    await waitFor(() => expect(lamp("Vastaanotto: pois")).toBeInTheDocument());
    expect(key()).toBeEnabled();
    station.close();
  });

  it("sends the keying of the user to the others and lights TX", async () => {
    await openLive();
    const station = await openStation(backend, FREQUENCY);
    await screen.findByText("Taajuudella on yksi muu.");

    fireEvent.keyDown(window, { code: "Space" });
    expect(lamp("Lähetys: päällä")).toBeInTheDocument();
    expect(key()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(station.messages).toContainEqual(expect.objectContaining({ type: "key", down: true })));
    expect(station.messages).toContainEqual({ type: "channel", frequency: FREQUENCY, users: 2, holder: "other" });

    fireEvent.keyUp(window, { code: "Space" });
    await waitFor(() => expect(station.messages).toContainEqual(expect.objectContaining({ type: "key", down: false })));
    // TX stays lit for a moment after the key is released
    expect(lamp("Lähetys: päällä")).toBeInTheDocument();
    await waitFor(() => expect(lamp("Lähetys: pois")).toBeInTheDocument());
    expect(station.messages[station.messages.length - 1]).toEqual({
      type: "channel",
      frequency: FREQUENCY,
      users: 2,
      holder: null
    });

    // The times of the press and the release are those of the user
    const [down, up] = station.messages.filter(({ type }) => type === "key");
    expect(Number(up.t)).toBeGreaterThanOrEqual(Number(down.t));
    station.close();
  });

  it("moves to the frequency that is written", async () => {
    await openLive();
    const station = await openStation(backend, 7030000);

    fireEvent.change(screen.getByLabelText("Taajuus (MHz)"), { target: { value: "7.03" } });
    await screen.findByText("Taajuudella on yksi muu.");
    await waitFor(() =>
      expect(station.messages).toContainEqual({ type: "channel", frequency: 7030000, users: 2, holder: null })
    );

    fireEvent.change(screen.getByLabelText("Taajuus (MHz)"), { target: { value: "7.031" } });
    await screen.findByText("Taajuudella ei ole muita.");
    await waitFor(() =>
      expect(station.messages[station.messages.length - 1]).toEqual({
        type: "channel",
        frequency: 7030000,
        users: 1,
        holder: null
      })
    );
    station.close();
  });

  it("opens the Live mode from the address and comes back to the frequency after the backend was away", async () => {
    window.history.replaceState(null, "", "#live");
    renderApp();
    await screen.findByText("Taajuudella ei ole muita.");
    const { port } = backend;

    await backend.stop();
    await screen.findByText(/Ei yhteyttä palvelimeen. Yhteyttä yritetään uudelleen/);
    expect(key()).toBeDisabled();

    backend = await startBackend({ port });
    await screen.findByText("Taajuudella ei ole muita.");
    expect(key()).toBeEnabled();
  });
});
