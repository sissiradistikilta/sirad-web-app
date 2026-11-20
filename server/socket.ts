import { IncomingMessage, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

export const SOCKET_PATH = "/ws";
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
 * The WebSocket API. For now a client can only connect and check that the connection is alive:
 * the server greets a new client with a "hello" message and answers a "ping" with a "pong".
 */
export function createSocketServer(server: Server, options: SocketOptions = {}) {
  const { allowedOrigins = [], heartbeatInterval = HEARTBEAT_INTERVAL } = options;
  const sockets = new WebSocketServer({ noServer: true });
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
    client.on("message", (data) => {
      let message: { type?: unknown };
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (message?.type === "ping") client.send(JSON.stringify({ type: "pong" }));
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
