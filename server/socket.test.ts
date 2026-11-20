// @vitest-environment node
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { createSocketServer, isAllowedOrigin, parseOrigins } from "./socket";

describe("parseOrigins", () => {
  it("splits a comma separated list", () => {
    expect(parseOrigins("https://cw.sirad.fi, http://localhost:4000")).toEqual([
      "https://cw.sirad.fi",
      "http://localhost:4000"
    ]);
  });

  it("is empty when nothing is given", () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins(" ")).toEqual([]);
  });
});

describe("isAllowedOrigin", () => {
  it("allows everything when no origins are listed", () => {
    expect(isAllowedOrigin("https://anything.example", [])).toBe(true);
    expect(isAllowedOrigin(undefined, [])).toBe(true);
  });

  it("allows only the listed origins", () => {
    const allowed = ["https://cw.sirad.fi"];
    expect(isAllowedOrigin("https://cw.sirad.fi", allowed)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", allowed)).toBe(false);
    expect(isAllowedOrigin(undefined, allowed)).toBe(false);
  });
});

describe("createSocketServer", () => {
  let server: Server;
  let address: string;

  beforeEach(async () => {
    server = createServer();
    createSocketServer(server, { allowedOrigins: ["https://cw.sirad.fi"] });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    address = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  /** Connects and collects the given number of messages, or the error of a refused connection. */
  const connect = (path: string, origin: string, messages: number, send?: string) =>
    new Promise<string[]>((resolve, reject) => {
      const received: string[] = [];
      const socket = new WebSocket(`${address}${path}`, { origin });
      socket.on("message", (data) => {
        received.push(String(data));
        if (received.length === 1 && send) socket.send(send);
        if (received.length === messages) {
          socket.close();
          resolve(received);
        }
      });
      socket.on("error", reject);
    });

  it("greets a client and answers a ping", async () => {
    const received = await connect("/ws", "https://cw.sirad.fi", 2, JSON.stringify({ type: "ping" }));
    expect(received.map((message) => JSON.parse(message))).toEqual([{ type: "hello" }, { type: "pong" }]);
  });

  it("passes the keying of a client on to the others on the same frequency", async () => {
    const open = (name: string) =>
      new Promise<{ socket: WebSocket; messages: { type: string }[] }>((resolve) => {
        const messages: { type: string }[] = [];
        const socket = new WebSocket(`${address}/ws`, { origin: "https://cw.sirad.fi" });
        socket.on("message", (data) => {
          messages.push(JSON.parse(String(data)));
          if (messages.length === 1) socket.send(JSON.stringify({ type: "join", frequency: 3685000, name }));
          // The first message about the frequency tells that the client is on it
          if (messages.length === 2) resolve({ socket, messages });
        });
      });
    const sender = await open("sender");
    const listener = await open("listener");

    const heard = new Promise<void>((resolve) => {
      listener.socket.on("message", () => {
        if (listener.messages.filter(({ type }) => type === "key").length === 2) resolve();
      });
    });
    sender.socket.send(JSON.stringify({ type: "key", down: true, t: 10 }));
    sender.socket.send(JSON.stringify({ type: "key", down: false, t: 110 }));
    await heard;

    expect(listener.messages.filter(({ type }) => type !== "hello" && type !== "channel")).toEqual([
      { type: "key", down: true, t: 10 },
      { type: "key", down: false, t: 110 }
    ]);
    expect(listener.messages).toContainEqual({ type: "channel", frequency: 3685000, users: 2, holder: "other" });
    expect(sender.messages.some(({ type }) => type === "key")).toBe(false);
    sender.socket.close();
    listener.socket.close();
  });

  it("refuses an origin that is not allowed", async () => {
    await expect(connect("/ws", "https://evil.example", 1)).rejects.toThrow("403");
  });

  it("refuses other paths", async () => {
    await expect(connect("/other", "https://cw.sirad.fi", 1)).rejects.toThrow("403");
  });
});
