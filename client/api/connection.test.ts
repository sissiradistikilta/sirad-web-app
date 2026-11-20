import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ApiConnection, { PING_INTERVAL, PONG_TIMEOUT, RECONNECT_DELAYS, toSocketUrl } from "./connection";

class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1];

describe("toSocketUrl", () => {
  it("uses a secure socket for a secure address", () => {
    expect(toSocketUrl("https://api.sirad.fi")).toBe("wss://api.sirad.fi/ws");
    expect(toSocketUrl("https://api.sirad.fi/")).toBe("wss://api.sirad.fi/ws");
  });

  it("uses a plain socket for a plain address", () => {
    expect(toSocketUrl("http://localhost:4001")).toBe("ws://localhost:4001/ws");
  });

  it("keeps a path in the address", () => {
    expect(toSocketUrl("https://example.com/api/")).toBe("wss://example.com/api/ws");
  });
});

describe("ApiConnection", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    onChange.mockClear();
    vi.stubGlobal("WebSocket", FakeSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tells when the connection opens and when it is lost", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    expect(latest().url).toBe("ws://localhost:4001/ws");
    expect(onChange).not.toHaveBeenCalled();

    latest().open();
    expect(onChange).toHaveBeenLastCalledWith(true);

    latest().close();
    expect(onChange).toHaveBeenLastCalledWith(false);
    connection.close();
  });

  it("connects again after the connection is lost, waiting longer each time", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    latest().close();
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    expect(FakeSocket.instances).toHaveLength(2);

    latest().close();
    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(RECONNECT_DELAYS[1] - RECONNECT_DELAYS[0]);
    expect(FakeSocket.instances).toHaveLength(3);

    // A connection that opens starts the waiting from the beginning
    latest().open();
    latest().close();
    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    expect(FakeSocket.instances).toHaveLength(4);
    connection.close();
  });

  it("checks the connection with a ping and reconnects if there is no answer", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    const socket = latest();
    socket.open();

    vi.advanceTimersByTime(PING_INTERVAL);
    expect(socket.sent).toEqual([JSON.stringify({ type: "ping" })]);

    // An answer in time keeps the connection
    socket.onmessage?.({ data: JSON.stringify({ type: "pong" }) });
    vi.advanceTimersByTime(PONG_TIMEOUT);
    expect(onChange).toHaveBeenLastCalledWith(true);

    // No answer: the connection is considered lost
    vi.advanceTimersByTime(PING_INTERVAL - PONG_TIMEOUT);
    expect(socket.sent).toHaveLength(2);
    vi.advanceTimersByTime(PONG_TIMEOUT);
    expect(onChange).toHaveBeenLastCalledWith(false);

    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    expect(FakeSocket.instances).toHaveLength(2);
    connection.close();
  });

  it("sends messages when connected and passes on the messages of the backend", () => {
    const onMessage = vi.fn();
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange, onMessage);
    expect(connection.send({ type: "join", frequency: 3685000 })).toBe(false);

    latest().open();
    expect(connection.send({ type: "join", frequency: 3685000 })).toBe(true);
    expect(latest().sent).toEqual([JSON.stringify({ type: "join", frequency: 3685000 })]);

    latest().onmessage?.({ data: JSON.stringify({ type: "key", down: true, t: 1 }) });
    latest().onmessage?.({ data: JSON.stringify({ type: "pong" }) });
    latest().onmessage?.({ data: "not json" });
    expect(onMessage.mock.calls).toEqual([[{ type: "key", down: true, t: 1 }]]);
    connection.close();
  });

  it("tries again later if a connection cannot even be started", () => {
    let fail = true;
    vi.stubGlobal(
      "WebSocket",
      class extends FakeSocket {
        constructor(url: string) {
          if (fail) throw new Error("not allowed");
          super(url);
        }
      }
    );
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    expect(FakeSocket.instances).toHaveLength(0);

    fail = false;
    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    expect(FakeSocket.instances).toHaveLength(1);
    latest().open();
    expect(onChange.mock.calls).toEqual([[true]]);
    connection.close();
  });

  it("does not tell about a lost connection when an attempt to connect fails", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    latest().onerror?.();
    latest().close();
    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    latest().close();

    expect(onChange).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(2);
    connection.close();
  });

  it("uses the timing it is given", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange, undefined, {
      reconnectDelays: [10],
      pingInterval: 100,
      pongTimeout: 20
    });
    latest().open();
    vi.advanceTimersByTime(100);
    expect(latest().sent).toHaveLength(1);
    vi.advanceTimersByTime(20);
    expect(onChange).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(10);
    expect(FakeSocket.instances).toHaveLength(2);
    connection.close();
  });

  it("ignores what an old connection still tells after a new one was opened", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    const old = latest();
    old.open();
    old.close();
    vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    onChange.mockClear();

    old.onopen?.();
    old.onmessage?.({ data: JSON.stringify({ type: "hello" }) });
    old.onclose?.();
    expect(onChange).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(2);
    connection.close();
  });

  it("does not connect again after it is closed", () => {
    const connection = new ApiConnection("ws://localhost:4001/ws", onChange);
    latest().open();
    onChange.mockClear();

    connection.close();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});
