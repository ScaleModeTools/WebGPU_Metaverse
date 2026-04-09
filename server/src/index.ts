import {
  type IncomingMessage,
  type ServerResponse,
  createServer
} from "node:http";

import { DuckHuntCoopRoomHttpAdapter } from "./experiences/duck-hunt/adapters/duck-hunt-coop-room-http-adapter.js";
import { CoopRoomDirectory } from "./experiences/duck-hunt/classes/coop-room-directory.js";
import { MetaverseSessionHttpAdapter } from "./metaverse/adapters/metaverse-session-http-adapter.js";
import { MetaverseSessionRuntime } from "./metaverse/classes/metaverse-session-runtime.js";
import type { ServerRuntimeConfig } from "./types/server-runtime-config.js";

const runtimeConfig: ServerRuntimeConfig = {
  host: "127.0.0.1",
  port: 3210
};

const coopRoomDirectory = new CoopRoomDirectory();
const duckHuntCoopRoomHttpAdapter = new DuckHuntCoopRoomHttpAdapter(
  coopRoomDirectory
);
const metaverseSessionRuntime = new MetaverseSessionRuntime();
const metaverseSessionHttpAdapter = new MetaverseSessionHttpAdapter(
  metaverseSessionRuntime
);

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function writeCorsHeaders(
  response: ServerResponse<IncomingMessage>
): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-max-age", "86400");
}

function writeJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: unknown
): void {
  writeCorsHeaders(response);
  response.writeHead(statusCode, {
    "cache-control": "no-store, max-age=0",
    "content-type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(
    request.url ?? "/",
    `http://${runtimeConfig.host}:${runtimeConfig.port}`
  );
  const nowMs = Date.now();

  if (request.method === "OPTIONS") {
    writeCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (metaverseSessionHttpAdapter.handleRequest(request, response, requestUrl)) {
    return;
  }

  if (
    await duckHuntCoopRoomHttpAdapter.handleRequest(
      request,
      response,
      requestUrl,
      nowMs
    )
  ) {
    return;
  }

  writeJson(response, 404, {
    error: "Route not found."
  });
});

server.on("error", (error) => {
  if (isErrnoException(error) && error.code === "EADDRINUSE") {
    console.error(
      `WebGPU Metaverse server could not listen on http://${runtimeConfig.host}:${runtimeConfig.port} because the address is already in use.`
    );
    process.exit(1);
  }

  throw error;
});

server.listen(runtimeConfig.port, runtimeConfig.host, () => {
  console.log(
    `WebGPU Metaverse server listening on http://${runtimeConfig.host}:${runtimeConfig.port}`
  );
});
