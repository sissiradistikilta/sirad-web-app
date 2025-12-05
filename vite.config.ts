import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
    }
  });
