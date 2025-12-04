import express, { json } from "express";
import path from "path";
import cors from "cors";

import hello from "./hello";
import robots from "./robots";

const app = express();
const port = process.env.PORT || 4001;
const root = path.resolve("./dist");
const devMode = process.env.TS_NODE_DEV === "true";

// Middlewares
app.use(cors());
app.use(json());

// Controllers
app.get("/hello", hello);
app.get("/robots.txt", robots);

if (devMode) {
  console.info("[server] Skipping static file server + SPA router for development mode");
  console.info(
    "[server] Please use frontend mode Vite development server for frontend development at http://localhost:4000"
  );
} else {
  // Server static files
  app.use(express.static(root, { index: false }));

  // SPA controller (e.g. serve index.html for all unknown paths)
  app.use((req, res) => {
    res.sendFile(path.join(root, "index.html"));
  });
}

// Start listening
app.listen(port, () => {
  console.info(`[server] Server is running at http://localhost:${port}`);
});
