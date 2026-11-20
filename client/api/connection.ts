/** How long to wait before connecting again, in milliseconds: longer after each failed attempt. */
export const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 15000];
/** How often the connection is checked with a ping, in milliseconds. */
export const PING_INTERVAL = 25000;
/** How long the answer to a ping is waited for, in milliseconds. */
export const PONG_TIMEOUT = 10000;

/** A message of the WebSocket API: a JSON object with a type. */
export interface ApiMessage {
  type: string;
  [key: string]: unknown;
}

/** The address of the WebSocket API of a backend, e.g. https://api.sirad.fi -> wss://api.sirad.fi/ws. */
export function toSocketUrl(apiUrl: string) {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * A connection to the backend that is kept open: when it is lost, it is opened again.
 *
 * A connection can die without the browser noticing, e.g. when the network changes. That is why
 * the connection is checked with a ping every now and then, and opened again if there is no answer.
 */
class ApiConnection {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private closed = false;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private pongTimer: number | null = null;

  /**
   * @param url The address of the WebSocket API.
   * @param onChange Called when the connection is opened or lost.
   * @param onMessage Called with each message of the backend, except the answers to the pings.
   */
  constructor(
    private readonly url: string,
    private readonly onChange: (connected: boolean) => void,
    private readonly onMessage: (message: ApiMessage) => void = () => undefined
  ) {
    this.connect();
  }

  /** Sends a message to the backend. Returns false if there is no connection: the message is then lost. */
  send(message: ApiMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  /** Closes the connection for good. */
  close() {
    this.closed = true;
    this.clearTimers();
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private connect() {
    if (this.closed) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.retry();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (socket !== this.socket) return;
      this.attempts = 0;
      this.onChange(true);
      this.pingTimer = window.setInterval(() => this.ping(socket), PING_INTERVAL);
    };
    socket.onmessage = (event) => {
      if (socket !== this.socket) return;

      let message: ApiMessage;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (typeof message !== "object" || message === null || typeof message.type !== "string") return;

      if (message.type === "pong") {
        if (this.pongTimer !== null) window.clearTimeout(this.pongTimer);
        this.pongTimer = null;
        return;
      }
      this.onMessage(message);
    };
    socket.onclose = () => {
      if (socket !== this.socket) return;
      this.socket = null;
      this.clearTimers();
      this.onChange(false);
      this.retry();
    };
    // An error is followed by a close, which is where the connection is opened again
    socket.onerror = () => undefined;
  }

  private ping(socket: WebSocket) {
    if (socket !== this.socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ type: "ping" }));
    if (this.pongTimer === null) this.pongTimer = window.setTimeout(() => socket.close(), PONG_TIMEOUT);
  }

  private retry() {
    if (this.closed || this.reconnectTimer !== null) return;

    const delay = RECONNECT_DELAYS[Math.min(this.attempts, RECONNECT_DELAYS.length - 1)];
    this.attempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearTimers() {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    if (this.pongTimer !== null) window.clearTimeout(this.pongTimer);
    this.pingTimer = null;
    this.pongTimer = null;
  }
}

export default ApiConnection;
