import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Backend, BrowserWebSocket, startBackend } from "../../test/backend";
import ApiConnection, { ApiMessage, toSocketUrl } from "../api/connection";

// These tests run the real backend, and the frontend connects to it over a real WebSocket.

/** The address of the page of the tests, which the browser tells the backend as the origin of the connection. */
const ORIGIN = window.location.origin;
const FAST = { reconnectDelays: [50], pingInterval: 60, pongTimeout: 200 };

// The backend is really running: on a busy machine things can take a while
vi.setConfig({ testTimeout: 15000 });
const waitFor = (check: () => void) => vi.waitFor(check, { timeout: 5000 });

describe("the connection to the backend", () => {
  let backend: Backend | null = null;
  let connection: ApiConnection | null = null;
  let changes: boolean[];
  let messages: ApiMessage[];

  const connect = (url: string, options = FAST) => {
    changes = [];
    messages = [];
    connection = new ApiConnection(
      toSocketUrl(url),
      (connected) => changes.push(connected),
      (message) => messages.push(message),
      options
    );
    return connection;
  };

  beforeEach(() => {
    vi.stubGlobal("WebSocket", BrowserWebSocket);
  });

  afterEach(async () => {
    connection?.close();
    connection = null;
    await backend?.stop();
    backend = null;
    vi.unstubAllGlobals();
  });

  it("opens, and the backend greets the client", async () => {
    backend = await startBackend();
    connect(backend.url);

    await waitFor(() => expect(messages).toEqual([{ type: "hello" }]));
    expect(changes).toEqual([true]);
  });

  it("is allowed from the address of the frontend, when the backend allows only some addresses", async () => {
    backend = await startBackend({ allowedOrigins: [ORIGIN] });
    connect(backend.url);

    await waitFor(() => expect(changes).toEqual([true]));
  });

  it("is refused from other addresses, and stays closed", async () => {
    backend = await startBackend({ allowedOrigins: ["https://cw.sirad.fi"] });
    connect(backend.url);

    // Time for several attempts
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(changes).toEqual([]);
    expect(messages).toEqual([]);
  });

  it("stays open over the pings that check it", async () => {
    backend = await startBackend();
    connect(backend.url);
    await waitFor(() => expect(changes).toEqual([true]));

    // Several pings, each of which the backend has to answer for the connection to stay
    await new Promise((resolve) => setTimeout(resolve, FAST.pingInterval * 5 + FAST.pongTimeout));
    expect(changes).toEqual([true]);
    // The answers to the pings are not messages for the app
    expect(messages).toEqual([{ type: "hello" }]);
  });

  it("is opened again when the backend comes back", async () => {
    backend = await startBackend();
    const { port } = backend;
    connect(backend.url);
    await waitFor(() => expect(changes).toEqual([true]));

    await backend.stop();
    backend = null;
    await waitFor(() => expect(changes).toEqual([true, false]));

    // The backend is down for a while: the attempts fail
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changes).toEqual([true, false]);

    backend = await startBackend({ port });
    await waitFor(() => expect(changes).toEqual([true, false, true]));
    expect(messages).toEqual([{ type: "hello" }, { type: "hello" }]);
  });

  it("sends messages to the backend and gets its answers", async () => {
    backend = await startBackend();
    const opened = connect(backend.url);
    expect(opened.send({ type: "join", frequency: 3685000 })).toBe(false);
    await waitFor(() => expect(changes).toEqual([true]));

    expect(opened.send({ type: "join", frequency: 3685000 })).toBe(true);
    await waitFor(() =>
      expect(messages).toContainEqual({ type: "channel", frequency: 3685000, users: 1, holder: null })
    );
  });

  it("does not open again after it is closed", async () => {
    backend = await startBackend();
    const opened = connect(backend.url);
    await waitFor(() => expect(changes).toEqual([true]));

    opened.close();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changes).toEqual([true]);
    expect(opened.send({ type: "leave" })).toBe(false);
  });
});
