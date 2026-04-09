import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const strudelBrowserEntrypoint = fileURLToPath(
  new URL("../node_modules/@strudel/web/web.mjs", import.meta.url)
);
const strudelOptimizeDeps = [
  "@strudel/core",
  "@strudel/mini",
  "@strudel/tonal",
  "@strudel/transpiler",
  "@strudel/web",
  "@strudel/web/web.mjs",
  "@strudel/webaudio"
] as const;

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              maxSize: 240 * 1024,
              name: "strudel",
              test: /node_modules[\\/](?:@strudel|superdough)[\\/]/
            },
            {
              maxSize: 280 * 1024,
              name: "three",
              test: /node_modules[\\/]three[\\/]/
            }
          ]
        }
      }
    }
  },
  optimizeDeps: {
    exclude: [...strudelOptimizeDeps]
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@mediapipe/tasks-vision": fileURLToPath(
        new URL("../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs", import.meta.url)
      ),
      "@strudel/web/web.mjs": strudelBrowserEntrypoint,
      "@webgpu-metaverse/shared": fileURLToPath(
        new URL("../packages/shared/src/index.ts", import.meta.url)
      )
    },
    dedupe: ["react", "react-dom"]
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/experiences": {
        changeOrigin: true,
        target: "http://127.0.0.1:3210"
      },
      "/metaverse": {
        changeOrigin: true,
        target: "http://127.0.0.1:3210"
      }
    }
  },
  preview: {
    host: true,
    port: 4173
  }
});
