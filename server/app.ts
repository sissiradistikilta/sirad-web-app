import express, { json } from "express";
import { createServer } from "http";
import path from "path";
import cors from "cors";

import hello from "./hello";
import robots from "./robots";
import { createSocketServer, SocketOptions } from "./socket";

export interface AppOptions extends SocketOptions {
  /**
   * A folder of a build of the frontend to serve. The frontend is deployed separately, but the server
   * can still serve it, e.g. to try the whole app locally. Nothing is served if this is not given.
   */
  frontend?: string;
}

/** The backend: the HTTP API and the WebSocket API on the same server, which is not listening yet. */
export function createApp(options: AppOptions = {}) {
  const { allowedOrigins = [], frontend } = options;
  const app = express();
  const server = createServer(app);

  // Middlewares
  app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined));
  app.use(json());

  // Controllers
  app.get("/health", (request, response) => {
    response.send({ status: "ok" });
  });
  app.get("/hello", hello);
  app.get("/robots.txt", robots);

  if (frontend) {
    // Server static files
    app.use(express.static(frontend, { index: false }));

    // SPA controller (e.g. serve index.html for all unknown paths)
    app.use((req, res) => {
      res.sendFile(path.join(frontend, "index.html"));
    });
  }

  // WebSocket API
  const sockets = createSocketServer(server, options);

  return { app, server, sockets };
}
