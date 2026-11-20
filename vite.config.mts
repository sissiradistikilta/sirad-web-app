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
      __LIVE_ENABLED__: JSON.stringify(process.env.LIVE_ENABLED === "true"),
      // The start of the hash of the commit the build was made of. It is given in the previews of pull requests.
      __COMMIT__: JSON.stringify((process.env.COMMIT_SHA ?? "").slice(0, 6))
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
      coverage: {
        // The whole frontend and backend, also the files that no test touches
        include: ["**/*.{ts,tsx}", "../server/**/*.ts"],
        exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts", "**/node_modules/**"],
        allowExternal: true,
        reporter: ["text", "html"],
        reportsDirectory: "../coverage",
        thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 }
      },
      environmentOptions: {
        jsdom: {
          resources: "usable"
        }
      }
    }
  });
