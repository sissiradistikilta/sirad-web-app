// @vitest-environment node
import { Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("the entry point of the server", () => {
  let server: Server | null = null;

  /** Starts the server as the start script does, with the given environment. */
  const start = async (environment: Record<string, string>) => {
    Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value));
    vi.resetModules();
    ({ server } = await import("./index"));
    if (!server.listening) await new Promise((resolve) => server?.once("listening", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)));
    server = null;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("starts the backend on the port of the environment, without the frontend", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const url = await start({ PORT: "0", ALLOWED_ORIGINS: "https://cw.sirad.fi" });

    expect(await (await fetch(`${url}/health`)).json()).toEqual({ status: "ok" });
    expect((await fetch(`${url}/`)).status).toBe(404);
    const allowed = await fetch(`${url}/hello`, { headers: { Origin: "https://cw.sirad.fi" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://cw.sirad.fi");
    await vi.waitFor(() => expect(info).toHaveBeenCalledTimes(2));
    expect(info.mock.calls.map(([line]) => line)).toEqual([
      "[server] Server is running at http://localhost:0",
      "[server] WebSocket API is at ws://localhost:0/ws"
    ]);
  });

  it("serves the frontend when asked to", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await start({ PORT: "0", SERVE_FRONTEND: "true" });

    await vi.waitFor(() => expect(info).toHaveBeenCalledTimes(3));
    expect(info.mock.calls.map(([line]) => line)[2]).toMatch(/^\[server\] Serving the frontend from .*dist$/);
  });
});
