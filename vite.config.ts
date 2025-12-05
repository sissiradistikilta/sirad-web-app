/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from "vite";
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
      proxy: {
        "/hello": "http://localhost:4001"
      }
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./test/setup.ts",
      css: false,
      environmentOptions: {
        jsdom: {
          resources: "usable"
        }
      }
    }
  });
