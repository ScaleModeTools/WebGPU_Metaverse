import { createMilliseconds } from "@webgpu-metaverse/shared";

import {
  MetaverseWorldClient,
  createMetaverseWorldHttpTransport,
  createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport,
  createMetaverseWorldWebTransportTransport,
  type MetaverseWorldClientConfig
} from "@/network";
import { createWebTransportHttpFallbackInvoker } from "@/network/adapters/webtransport-http-fallback";

function resolveMetaverseServerOrigin(): string {
  const configuredOrigin = import.meta.env?.VITE_SERVER_ORIGIN?.trim();

  if (configuredOrigin !== undefined && configuredOrigin.length > 0) {
    return configuredOrigin;
  }

  const browserOrigin = globalThis.window?.location.origin;

  if (browserOrigin === undefined) {
    return "http://127.0.0.1:3210";
  }

  return browserOrigin;
}

function resolveMetaverseRealtimeTransportMode():
  | "http"
  | "webtransport-preferred" {
  const configuredMode = import.meta.env?.VITE_METAVERSE_REALTIME_TRANSPORT?.trim();

  return configuredMode === "webtransport-preferred"
    ? "webtransport-preferred"
    : "http";
}

function resolveMetaverseWorldWebTransportUrl(): string | null {
  const configuredUrl =
    import.meta.env?.VITE_METAVERSE_WORLD_WEBTRANSPORT_URL?.trim();

  if (configuredUrl === undefined || configuredUrl.length === 0) {
    return null;
  }

  return configuredUrl;
}

export const metaverseWorldPath = "/metaverse/world" as const;
export const metaverseWorldCommandPath = "/metaverse/world/commands" as const;

export const metaverseWorldClientConfig = {
  defaultCommandIntervalMs: createMilliseconds(50),
  defaultPollIntervalMs: createMilliseconds(150),
  maxBufferedSnapshots: 12,
  serverOrigin: resolveMetaverseServerOrigin(),
  worldCommandPath: metaverseWorldCommandPath,
  worldPath: metaverseWorldPath
} as const satisfies MetaverseWorldClientConfig;

export const metaverseRemoteWorldSamplingConfig = Object.freeze({
  clockOffsetCorrectionAlpha: 0.2,
  clockOffsetMaxStepMs: 32,
  interpolationDelayMs: 225,
  maxExtrapolationMs: 120
});

export function createMetaverseWorldClient(): MetaverseWorldClient {
  const preferredTransportMode = resolveMetaverseRealtimeTransportMode();
  const webTransportUrl = resolveMetaverseWorldWebTransportUrl();
  const shouldUseWebTransport =
    preferredTransportMode === "webtransport-preferred" &&
    webTransportUrl !== null &&
    typeof (
      globalThis as typeof globalThis & {
        readonly WebTransport?: unknown;
      }
    ).WebTransport === "function";

  const httpTransport = createMetaverseWorldHttpTransport(
    metaverseWorldClientConfig
  );
  const driverVehicleControlDatagramTransport = shouldUseWebTransport
    ? createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport(
        {
          webTransportUrl
        }
      )
    : null;

  return new MetaverseWorldClient(metaverseWorldClientConfig, {
    ...(driverVehicleControlDatagramTransport === null
      ? {}
      : {
          driverVehicleControlDatagramTransport
        }),
    transport: shouldUseWebTransport
      ? (() => {
          const transportFailover = createWebTransportHttpFallbackInvoker(
            createMetaverseWorldWebTransportTransport({
              webTransportUrl
            }),
            httpTransport
          );

          return Object.freeze({
            dispose() {
              transportFailover.dispose();
            },
            pollWorldSnapshot(
              playerId: Parameters<typeof httpTransport.pollWorldSnapshot>[0]
            ) {
              return transportFailover.invoke((transport) =>
                transport.pollWorldSnapshot(playerId)
              );
            },
            sendCommand(
              command: Parameters<typeof httpTransport.sendCommand>[0],
              options?: Parameters<typeof httpTransport.sendCommand>[1]
            ) {
              return transportFailover.invoke((transport) =>
                transport.sendCommand(command, options)
              );
            }
          });
        })()
      : httpTransport
  });
}
