import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

process.env.BASE_HREF ??= "/";
if (!process.env.BASE_HREF.endsWith("/")) {
  process.env.BASE_HREF += "/";
}

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) =>
  defineConfig({
    root: "client",
    base: process.env.BASE_HREF,
    plugins: [react({})],
    define: {
      // The address of the backend, e.g. https://api.sirad.fi. In development the backend is the local one.
      __API_URL__: JSON.stringify(process.env.API_URL ?? (mode === "development" ? "http://localhost:4001" : "")),
      // Whether live keying, and with it the connection to the backend, is in use
      __LIVE_ENABLED__: JSON.stringify(process.env.LIVE_ENABLED === "true")
    },
    build: {
      outDir: "../dist",
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          entryFileNames: `[name].js`,
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`
        }
      }
    },
    server: {
      host: "localhost",
      port: 4000,
      strictPort: true,
      // ngrok sends its own Host header; Vite blocks unknown hosts by default.
      allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.io"],
      proxy: {
        "/hello": "http://localhost:4001"
      }
    },
    test: {
      globals: true,
      environment: "jsdom",
      // The root is the frontend; the tests of the backend are next to it
      include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)", "../server/**/*.test.ts"],
      setupFiles: fileURLToPath(new URL("./test/setup.ts", import.meta.url)),
      css: false,
      environmentOptions: {
        jsdom: {
          resources: "usable"
        }
      }
    }
  });
