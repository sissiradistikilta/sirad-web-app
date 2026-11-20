import express, { json } from "express";
import { createServer } from "http";
import path from "path";
import cors from "cors";

import hello from "./hello";
import robots from "./robots";
import { createSocketServer, parseOrigins, SOCKET_PATH } from "./socket";

const app = express();
const server = createServer(app);
const port = process.env.PORT || 4001;
const root = path.resolve("./dist");
// The frontend is deployed separately. The server can still serve a build of it, e.g. to try the whole app locally.
const serveFrontend = process.env.SERVE_FRONTEND === "true";
const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);

// Middlewares
app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined));
app.use(json());

// Controllers
app.get("/health", (request, response) => {
  response.send({ status: "ok" });
});
app.get("/hello", hello);
app.get("/robots.txt", robots);

if (serveFrontend) {
  // Server static files
  app.use(express.static(root, { index: false }));

  // SPA controller (e.g. serve index.html for all unknown paths)
  app.use((req, res) => {
    res.sendFile(path.join(root, "index.html"));
  });
}

// WebSocket API
createSocketServer(server, { allowedOrigins });

// Start listening
server.listen(port, () => {
  console.info(`[server] Server is running at http://localhost:${port}`);
  console.info(`[server] WebSocket API is at ws://localhost:${port}${SOCKET_PATH}`);
  if (serveFrontend) console.info(`[server] Serving the frontend from ${root}`);
});
