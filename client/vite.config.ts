import type { IncomingMessage, ServerResponse } from "node:http";
import { connect } from "node:net";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type ProxyOptions } from "vite";
import wasm from "vite-plugin-wasm";

const localdevHttpServerHost = "127.0.0.1";
const localdevHttpServerPort = 3210;
const localdevHttpServerTarget =
  `http://${localdevHttpServerHost}:${localdevHttpServerPort}` as const;
const localdevHttpServerProbeTimeoutMs = 150;
const localdevHttpServerProbeFreshnessMs = 750;
const localdevUnavailableResponseBody = JSON.stringify({
  error:
    `WebGPU Metaverse dev server is not listening on ${localdevHttpServerTarget} yet. Wait for the managed server watcher to finish starting or restarting.`
});

let localdevHttpServerProbePromise: Promise<boolean> | null = null;
let localdevHttpServerProbeCheckedAtMs = 0;
let localdevHttpServerProbeAvailable = false;

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

function probeLocaldevHttpServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({
      host: localdevHttpServerHost,
      port: localdevHttpServerPort
    });
    let settled = false;

    const settle = (available: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.off("connect", handleConnect);
      socket.off("error", handleUnavailable);
      socket.off("timeout", handleUnavailable);
      socket.destroy();
      resolve(available);
    };
    const handleConnect = () => settle(true);
    const handleUnavailable = () => settle(false);

    socket.setTimeout(localdevHttpServerProbeTimeoutMs);
    socket.once("connect", handleConnect);
    socket.once("error", handleUnavailable);
    socket.once("timeout", handleUnavailable);
  });
}

async function isLocaldevHttpServerAvailable(): Promise<boolean> {
  const nowMs = Date.now();

  if (
    nowMs - localdevHttpServerProbeCheckedAtMs <
    localdevHttpServerProbeFreshnessMs
  ) {
    return localdevHttpServerProbeAvailable;
  }

  if (localdevHttpServerProbePromise !== null) {
    return localdevHttpServerProbePromise;
  }

  const probePromise = probeLocaldevHttpServer()
    .then((available) => {
      localdevHttpServerProbeAvailable = available;
      localdevHttpServerProbeCheckedAtMs = Date.now();

      return available;
    })
    .finally(() => {
      if (localdevHttpServerProbePromise === probePromise) {
        localdevHttpServerProbePromise = null;
      }
    });

  localdevHttpServerProbePromise = probePromise;

  return probePromise;
}

function writeLocaldevUnavailableResponse(response: ServerResponse): void {
  if (response.headersSent || response.writableEnded) {
    return;
  }

  response.writeHead(503, {
    "cache-control": "no-store, max-age=0",
    "content-type": "application/json"
  });
  response.end(localdevUnavailableResponseBody);
}

const bypassUnavailableLocaldevServer: ProxyOptions["bypass"] = async (
  request: IncomingMessage,
  response: ServerResponse | undefined
) => {
  if (response === undefined || await isLocaldevHttpServerAvailable()) {
    return undefined;
  }

  writeLocaldevUnavailableResponse(response);

  return request.url ?? "/";
};

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
        bypass: bypassUnavailableLocaldevServer,
        changeOrigin: true,
        target: localdevHttpServerTarget
      },
      "^/metaverse(?:/|$)": {
        bypass: bypassUnavailableLocaldevServer,
        changeOrigin: true,
        target: localdevHttpServerTarget
      }
    }
  },
  preview: {
    host: true,
    port: 4173
  }
});
