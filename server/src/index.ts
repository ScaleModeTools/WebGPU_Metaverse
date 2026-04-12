import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
  type IncomingMessage,
  type ServerResponse,
  createServer
} from "node:http";
import { dirname } from "node:path";

import { DuckHuntCoopRoomWebTransportDatagramAdapter } from "./experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-datagram-adapter.js";
import { DuckHuntCoopRoomHttpAdapter } from "./experiences/duck-hunt/adapters/duck-hunt-coop-room-http-adapter.js";
import { DuckHuntCoopRoomWebTransportAdapter } from "./experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-adapter.js";
import { CoopRoomDirectory } from "./experiences/duck-hunt/classes/coop-room-directory.js";
import {
  createLocaldevWebTransportClientFailureEnvFileContents,
  createLocaldevWebTransportClientEnvFileContents,
  LocaldevWebTransportServer,
  resolveLocaldevWebTransportServerConfigFromEnvironment,
  verifyLocaldevWebTransportServerHandshake
} from "./adapters/localdev-webtransport-server.js";
import { MetaversePresenceHttpAdapter } from "./metaverse/adapters/metaverse-presence-http-adapter.js";
import { MetaversePresenceWebTransportAdapter } from "./metaverse/adapters/metaverse-presence-webtransport-adapter.js";
import { MetaverseRealtimeWorldWebTransportDatagramAdapter } from "./metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.js";
import { MetaverseWorldHttpAdapter } from "./metaverse/adapters/metaverse-world-http-adapter.js";
import { MetaverseWorldWebTransportAdapter } from "./metaverse/adapters/metaverse-world-webtransport-adapter.js";
import { MetaverseAuthoritativeWorldRuntime } from "./metaverse/classes/metaverse-authoritative-world-runtime.js";
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
const duckHuntCoopRoomWebTransportAdapter = new DuckHuntCoopRoomWebTransportAdapter(
  coopRoomDirectory
);
const duckHuntCoopRoomWebTransportDatagramAdapter =
  new DuckHuntCoopRoomWebTransportDatagramAdapter(coopRoomDirectory);
const metaverseAuthoritativeWorldRuntime = new MetaverseAuthoritativeWorldRuntime();
const metaversePresenceHttpAdapter = new MetaversePresenceHttpAdapter(
  metaverseAuthoritativeWorldRuntime
);
const metaversePresenceWebTransportAdapter =
  new MetaversePresenceWebTransportAdapter(metaverseAuthoritativeWorldRuntime);
const metaverseWorldHttpAdapter = new MetaverseWorldHttpAdapter(
  metaverseAuthoritativeWorldRuntime
);
const metaverseWorldWebTransportAdapter = new MetaverseWorldWebTransportAdapter(
  metaverseAuthoritativeWorldRuntime
);
const metaverseRealtimeWorldWebTransportDatagramAdapter =
  new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    metaverseAuthoritativeWorldRuntime
  );
const metaverseSessionRuntime = new MetaverseSessionRuntime();
const metaverseSessionHttpAdapter = new MetaverseSessionHttpAdapter(
  metaverseSessionRuntime
);
const resolvedLocaldevWebTransportConfig =
  resolveLocaldevWebTransportServerConfigFromEnvironment(process.env);
const localdevClientEnvFilePath = resolveOptionalEnvValue(
  process.env.WEBGPU_METAVERSE_LOCALDEV_CLIENT_ENV_FILE
);
const localdevReadyFilePath = resolveOptionalEnvValue(
  process.env.WEBGPU_METAVERSE_LOCALDEV_READY_FILE
);
const localdevWebTransportBootStatus = resolveOptionalEnvValue(
  process.env.WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_BOOT_STATUS
);
const localdevWebTransportBootError = resolveOptionalEnvValue(
  process.env.WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_BOOT_ERROR
);

let localdevWebTransportServer: LocaldevWebTransportServer | null = null;
let shuttingDown = false;

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function resolveOptionalEnvValue(rawValue: string | undefined): string | null {
  const trimmedValue = rawValue?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0
    ? null
    : trimmedValue;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function removeOptionalFile(filePath: string | null): void {
  if (filePath === null) {
    return;
  }

  rmSync(filePath, {
    force: true
  });
}

function writeOptionalFile(filePath: string | null, contents: string): void {
  if (filePath === null) {
    return;
  }

  mkdirSync(dirname(filePath), {
    recursive: true
  });
  writeFileSync(filePath, contents, "utf8");
}

function publishLocaldevReadyFile(): void {
  writeOptionalFile(localdevReadyFilePath, "ready\n");
}

function publishLocaldevClientEnvFile(contents: string | null): void {
  if (contents === null) {
    removeOptionalFile(localdevClientEnvFilePath);
    return;
  }

  writeOptionalFile(localdevClientEnvFilePath, contents);
}

function stopLocaldevWebTransportServer(): void {
  try {
    localdevWebTransportServer?.stop();
  } catch (error) {
    console.error(
      "WebGPU Metaverse localdev WebTransport shutdown failed.",
      error
    );
  } finally {
    localdevWebTransportServer = null;
  }
}

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

async function shutdownServer(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopLocaldevWebTransportServer();

  try {
    await closeHttpServer();
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ERR_SERVER_NOT_RUNNING") {
      console.error(
        `WebGPU Metaverse server shutdown failed after ${signal}.`,
        error
      );
      process.exitCode = 1;
    }
  }

  process.exit(process.exitCode ?? 0);
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
    await metaversePresenceHttpAdapter.handleRequest(
      request,
      response,
      requestUrl,
      nowMs
    )
  ) {
    return;
  }

  if (
    await metaverseWorldHttpAdapter.handleRequest(
      request,
      response,
      requestUrl,
      nowMs
    )
  ) {
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

process.on("SIGINT", () => {
  void shutdownServer("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdownServer("SIGTERM");
});

server.listen(runtimeConfig.port, runtimeConfig.host, () => {
  console.log(
    `WebGPU Metaverse server listening on http://${runtimeConfig.host}:${runtimeConfig.port}`
  );

  void (async () => {
    if (resolvedLocaldevWebTransportConfig === null) {
      publishLocaldevClientEnvFile(
        localdevWebTransportBootStatus === "self-check-failed" &&
          localdevWebTransportBootError !== null
          ? createLocaldevWebTransportClientFailureEnvFileContents({
              errorMessage: localdevWebTransportBootError
            })
          : null
      );
      publishLocaldevReadyFile();
      return;
    }

    try {
      localdevWebTransportServer = new LocaldevWebTransportServer(
        resolvedLocaldevWebTransportConfig.serverConfig,
        {
          duckHuntDatagramAdapter: duckHuntCoopRoomWebTransportDatagramAdapter,
          duckHuntReliableAdapter: duckHuntCoopRoomWebTransportAdapter,
          metaversePresenceReliableAdapter: metaversePresenceWebTransportAdapter,
          metaverseWorldDatagramAdapter:
            metaverseRealtimeWorldWebTransportDatagramAdapter,
          metaverseWorldReliableAdapter: metaverseWorldWebTransportAdapter
        }
      );

      const webTransportAddress = await localdevWebTransportServer.start();
      await verifyLocaldevWebTransportServerHandshake({
        certificateSha256Hex:
          resolvedLocaldevWebTransportConfig.certificateSha256Hex,
        host: resolvedLocaldevWebTransportConfig.selfCheckHost,
        port: webTransportAddress.port
      });
      publishLocaldevClientEnvFile(
        createLocaldevWebTransportClientEnvFileContents({
          certificateSha256Hex:
            resolvedLocaldevWebTransportConfig.certificateSha256Hex,
          host: resolvedLocaldevWebTransportConfig.clientHost,
          port: webTransportAddress.port
        })
      );
      console.log(
        `WebGPU Metaverse localdev WebTransport listening on https://${resolvedLocaldevWebTransportConfig.clientHost}:${webTransportAddress.port} (bound on ${webTransportAddress.host}:${webTransportAddress.port})`
      );
    } catch (error) {
      publishLocaldevClientEnvFile(
        createLocaldevWebTransportClientFailureEnvFileContents({
          errorMessage: resolveErrorMessage(
            error,
            "Localdev WebTransport startup failed before the host became usable."
          )
        })
      );
      console.error(
        "WebGPU Metaverse localdev WebTransport could not start or pass its self-check. Continuing with HTTP-only localdev boot.",
        error
      );

      stopLocaldevWebTransportServer();
    } finally {
      publishLocaldevReadyFile();
    }
  })().catch((error) => {
    publishLocaldevClientEnvFile(null);
    publishLocaldevReadyFile();
    console.error(
      "WebGPU Metaverse localdev startup artifact publication failed.",
      error
    );
  });
});
