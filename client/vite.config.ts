import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

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
const physicsOptimizeDeps = ["@dimforge/rapier3d"] as const;
const clientOptimizeDepEntries = [
  "index.html",
  "src/metaverse/index.ts",
  "src/engine-tool/routes/game-playlists-stage-screen.tsx",
  "src/engine-tool/routes/map-editor-stage-screen.tsx",
  "src/experiences/duck-hunt/components/duck-hunt-gameplay-stage-screen.tsx"
];

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
    // Lazy stage roots need cold-start scanning so first navigation does not
    // invalidate already-served optimized React dependency URLs.
    entries: clientOptimizeDepEntries,
    exclude: [...strudelOptimizeDeps, ...physicsOptimizeDeps]
  },
  plugins: [react(), wasm(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@mediapipe/tasks-vision": fileURLToPath(
        new URL("../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs", import.meta.url)
      ),
      "@strudel/web/web.mjs": strudelBrowserEntrypoint,
      "@webgpu-metaverse/shared": fileURLToPath(
        new URL("../packages/shared/src", import.meta.url)
      )
    },
    dedupe: ["react", "react-dom"]
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "^/experiences(?:/|$)": {
        changeOrigin: true,
        target: "http://127.0.0.1:3210"
      },
      "^/metaverse(?:/|$)": {
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
