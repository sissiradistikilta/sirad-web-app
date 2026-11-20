import { IncomingMessage, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

import Channels, { isFrequency } from "./channels";

export const SOCKET_PATH = "/ws";
/** The largest message a client can send, in bytes. The messages of the API are small. */
export const MAX_MESSAGE_SIZE = 1024;
/** How often it is checked that the clients are still there, in milliseconds. */
export const HEARTBEAT_INTERVAL = 30000;

export interface SocketOptions {
  /** The origins that may connect, e.g. https://cw.sirad.fi. Any origin may connect if none are given. */
  allowedOrigins?: string[];
  heartbeatInterval?: number;
}

/** The origins of a comma separated list, e.g. of the environment variable ALLOWED_ORIGINS. */
export function parseOrigins(list: string | undefined) {
  return (list ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]) {
  return allowedOrigins.length === 0 || (origin !== undefined && allowedOrigins.includes(origin));
}

/**
 * The WebSocket API. The messages are JSON objects with a type.
 *
 * - The server greets a new client with "hello" and answers a "ping" with a "pong".
 * - Live keying: a client goes to a frequency with "join" (frequency in hertz) and leaves it with "leave".
 *   The presses and releases of its key are "key" messages (down, and the time t in milliseconds on the
 *   clock of the client), which are passed on to the others on the frequency. The server tells about the
 *   frequency with "channel" messages: how many there are on it and who is keying (see Channels).
 */
export function createSocketServer(server: Server, options: SocketOptions = {}) {
  const { allowedOrigins = [], heartbeatInterval = HEARTBEAT_INTERVAL } = options;
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_SIZE });
  const channels = new Channels<WebSocket>((client, message) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  });
  const alive = new WeakSet<WebSocket>();

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname !== SOCKET_PATH || !isAllowedOrigin(request.headers.origin, allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => sockets.emit("connection", client, request));
  });

  sockets.on("connection", (client: WebSocket) => {
    alive.add(client);
    client.on("pong", () => alive.add(client));
    client.on("error", () => client.terminate());
    client.on("close", () => channels.leave(client));
    client.on("message", (data) => {
      let message: { type?: unknown; frequency?: unknown; down?: unknown; t?: unknown } | null;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (typeof message !== "object" || message === null) return;

      if (message.type === "ping") {
        client.send(JSON.stringify({ type: "pong" }));
      } else if (message.type === "join") {
        if (isFrequency(message.frequency)) channels.join(client, message.frequency);
      } else if (message.type === "leave") {
        channels.leave(client);
      } else if (message.type === "key") {
        if (typeof message.down === "boolean" && typeof message.t === "number" && Number.isFinite(message.t)) {
          channels.key(client, message.down, message.t);
        }
      }
    });
    client.send(JSON.stringify({ type: "hello" }));
  });

  // A client that has gone without closing the connection is noticed when it does not answer a ping
  const heartbeat = setInterval(() => {
    sockets.clients.forEach((client) => {
      if (!alive.has(client)) {
        client.terminate();
        return;
      }
      alive.delete(client);
      client.ping();
    });
  }, heartbeatInterval);

  sockets.on("close", () => clearInterval(heartbeat));
  server.on("close", () => sockets.close());

  return sockets;
}
