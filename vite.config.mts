import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

process.env.BASE_HREF ??= "/";
if (!process.env.BASE_HREF.endsWith("/")) {
  process.env.BASE_HREF += "/";
}

// https://vitejs.dev/config/
export default () =>
  defineConfig({
    root: "client",
    base: process.env.BASE_HREF,
    plugins: [react({})],
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
      setupFiles: fileURLToPath(new URL("./test/setup.ts", import.meta.url)),
      css: false,
      environmentOptions: {
        jsdom: {
          resources: "usable"
        }
      }
    }
  });
