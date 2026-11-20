// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { AppOptions, createApp } from "./app";

describe("createApp", () => {
  let stop: (() => Promise<void>) | null = null;
  let folder: string | null = null;

  const start = async (options: AppOptions = {}) => {
    const { server, sockets } = createApp(options);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    stop = () =>
      new Promise<void>((resolve) => {
        sockets.clients.forEach((client) => client.terminate());
        server.close(() => resolve());
        server.closeAllConnections();
      });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  afterEach(async () => {
    await stop?.();
    stop = null;
    if (folder) rmSync(folder, { recursive: true, force: true });
    folder = null;
    delete process.env.ROBOTS_ALLOW_ALL;
  });

  it("answers the health check", async () => {
    const url = await start();
    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers hello", async () => {
    const url = await start();
    expect(await (await fetch(`${url}/hello`)).json()).toEqual({ hello: "World" });
  });

  it("keeps the robots away unless they are allowed", async () => {
    const url = await start();
    const response = await fetch(`${url}/robots.txt`);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("User-agent: *\nDisallow: /");

    process.env.ROBOTS_ALLOW_ALL = "true";
    expect(await (await fetch(`${url}/robots.txt`)).text()).toBe("User-agent: *\nAllow: /");
  });

  it("does not serve the frontend by default", async () => {
    const url = await start();
    expect((await fetch(`${url}/`)).status).toBe(404);
    expect((await fetch(`${url}/index.js`)).status).toBe(404);
  });

  it("serves a build of the frontend when it is given, with the page for every unknown path", async () => {
    folder = mkdtempSync(path.join(tmpdir(), "sirad-frontend-"));
    writeFileSync(path.join(folder, "index.html"), "<title>SiRad Web</title>");
    writeFileSync(path.join(folder, "index.js"), "console.log('app');");
    const url = await start({ frontend: folder });

    expect(await (await fetch(`${url}/index.js`)).text()).toBe("console.log('app');");
    expect(await (await fetch(`${url}/`)).text()).toBe("<title>SiRad Web</title>");
    expect(await (await fetch(`${url}/some/page`)).text()).toBe("<title>SiRad Web</title>");
    // The API is still there
    expect(await (await fetch(`${url}/health`)).json()).toEqual({ status: "ok" });
  });

  it("allows any address to use the API when none are listed", async () => {
    const url = await start();
    const response = await fetch(`${url}/hello`, { headers: { Origin: "https://anything.example" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("allows only the listed addresses to use the API", async () => {
    const url = await start({ allowedOrigins: ["https://cw.sirad.fi"] });

    const allowed = await fetch(`${url}/hello`, { headers: { Origin: "https://cw.sirad.fi" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://cw.sirad.fi");

    const other = await fetch(`${url}/hello`, { headers: { Origin: "https://evil.example" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("has the WebSocket API on the same server, with the same allowed addresses", async () => {
    const url = (await start({ allowedOrigins: ["https://cw.sirad.fi"] })).replace("http", "ws");
    const connect = (origin: string) =>
      new Promise<string>((resolve) => {
        const socket = new WebSocket(`${url}/ws`, { origin });
        socket.on("message", (data) => {
          socket.close();
          resolve(String(data));
        });
        socket.on("error", (error) => resolve(error.message));
      });

    expect(await connect("https://cw.sirad.fi")).toBe(JSON.stringify({ type: "hello" }));
    expect(await connect("https://evil.example")).toContain("403");
  });
});
