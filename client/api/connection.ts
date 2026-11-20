/** How long to wait before connecting again, in milliseconds: longer after each failed attempt. */
export const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 15000];
/** How often the connection is checked with a ping, in milliseconds. */
export const PING_INTERVAL = 25000;
/** How long the answer to a ping is waited for, in milliseconds. */
export const PONG_TIMEOUT = 10000;

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
   */
  constructor(
    private readonly url: string,
    private readonly onChange: (connected: boolean) => void
  ) {
    this.connect();
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
      if (String(event.data).includes('"pong"') && this.pongTimer !== null) {
        window.clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
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
