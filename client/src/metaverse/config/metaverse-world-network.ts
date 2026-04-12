import { createMilliseconds } from "@webgpu-metaverse/shared";

import {
  MetaverseWorldClient,
  createRealtimeDatagramTransportStatusSnapshot,
  createRealtimeReliableTransportStatusSnapshot,
  createNativeWebTransportBrowserFactory,
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

function resolveMetaverseWorldWebTransportServerCertificateSha256():
  | string
  | null {
  const configuredHash =
    import.meta.env?.VITE_METAVERSE_WORLD_WEBTRANSPORT_SERVER_CERT_SHA256?.trim();

  if (configuredHash === undefined || configuredHash.length === 0) {
    return null;
  }

  return configuredHash;
}

function resolveLocaldevWebTransportBootStatus():
  | "self-check-failed"
  | null {
  const configuredStatus =
    import.meta.env?.VITE_LOCALDEV_WEBTRANSPORT_BOOT_STATUS?.trim();

  return configuredStatus === "self-check-failed"
    ? "self-check-failed"
    : null;
}

function resolveLocaldevWebTransportBootError(): string | null {
  const configuredError =
    import.meta.env?.VITE_LOCALDEV_WEBTRANSPORT_BOOT_ERROR?.trim();

  if (configuredError === undefined || configuredError.length === 0) {
    return null;
  }

  return configuredError;
}

function hasBrowserWebTransportApi(): boolean {
  return typeof (
    globalThis as typeof globalThis & {
      readonly WebTransport?: unknown;
    }
  ).WebTransport === "function";
}

function isLocalhostWebTransportUrl(rawUrl: string | null): boolean {
  if (rawUrl === null) {
    return false;
  }

  try {
    const parsedUrl = new URL(rawUrl);

    return (
      parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

export const metaverseWorldPath = "/metaverse/world" as const;
export const metaverseWorldCommandPath = "/metaverse/world/commands" as const;

export const metaverseWorldClientConfig = {
  defaultCommandIntervalMs: createMilliseconds(50),
  defaultPollIntervalMs: createMilliseconds(50),
  maxBufferedSnapshots: 12,
  serverOrigin: resolveMetaverseServerOrigin(),
  worldCommandPath: metaverseWorldCommandPath,
  worldPath: metaverseWorldPath
} as const satisfies MetaverseWorldClientConfig;

export const metaverseRemoteWorldSamplingConfig = Object.freeze({
  clockOffsetCorrectionAlpha: 0.2,
  clockOffsetMaxStepMs: 32,
  interpolationDelayMs: 100,
  maxExtrapolationMs: 90
});

export const metaverseLocalMountedVehicleReconciliationConfig = Object.freeze({
  maxAuthoritativeSnapshotAgeMs: 90
});

export function createMetaverseWorldClient(): MetaverseWorldClient {
  const preferredTransportMode = resolveMetaverseRealtimeTransportMode();
  const localdevWebTransportBootStatus = resolveLocaldevWebTransportBootStatus();
  const localdevWebTransportBootError = resolveLocaldevWebTransportBootError();
  const webTransportUrl = resolveMetaverseWorldWebTransportUrl();
  const browserWebTransportAvailable = hasBrowserWebTransportApi();
  const shouldUseWebTransport =
    preferredTransportMode === "webtransport-preferred" &&
    webTransportUrl !== null &&
    browserWebTransportAvailable;
  const webTransportFactory = shouldUseWebTransport
    ? createNativeWebTransportBrowserFactory({
        serverCertificateSha256Hex:
          resolveMetaverseWorldWebTransportServerCertificateSha256()
      })
    : null;

  const httpTransport = createMetaverseWorldHttpTransport(
    metaverseWorldClientConfig
  );
  const transportFailover = shouldUseWebTransport
    ? createWebTransportHttpFallbackInvoker(
        createMetaverseWorldWebTransportTransport(
          {
            webTransportUrl
          },
          webTransportFactory === null
            ? {}
            : {
                webTransportFactory
              }
        ),
        httpTransport
      )
    : null;
  const driverVehicleControlDatagramTransport = shouldUseWebTransport
    ? createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport(
        {
          webTransportUrl
        },
        webTransportFactory === null
          ? {}
          : {
              webTransportFactory
            }
      )
    : null;

  return new MetaverseWorldClient(metaverseWorldClientConfig, {
    ...(driverVehicleControlDatagramTransport === null
      ? {}
      : {
          driverVehicleControlDatagramTransport
        }),
    resolveDriverVehicleControlDatagramTransportStatusSnapshot: (context) => {
      if (preferredTransportMode !== "webtransport-preferred") {
        return createRealtimeDatagramTransportStatusSnapshot({
          activeTransport: null,
          browserWebTransportAvailable,
          enabled: true,
          lastTransportError: null,
          preference: preferredTransportMode,
          state: "unavailable",
          webTransportConfigured: false,
          webTransportStatus: "not-requested"
        });
      }

      if (webTransportUrl === null) {
        return createRealtimeDatagramTransportStatusSnapshot({
          activeTransport: null,
          browserWebTransportAvailable,
          enabled: true,
          lastTransportError:
            localdevWebTransportBootStatus === "self-check-failed"
              ? localdevWebTransportBootError
              : null,
          preference: preferredTransportMode,
          state: "unavailable",
          webTransportConfigured: false,
          webTransportStatus:
            localdevWebTransportBootStatus === "self-check-failed"
              ? "localdev-self-check-failed"
              : "unconfigured"
        });
      }

      if (!browserWebTransportAvailable) {
        return createRealtimeDatagramTransportStatusSnapshot({
          activeTransport: null,
          browserWebTransportAvailable,
          enabled: true,
          lastTransportError: null,
          preference: preferredTransportMode,
          state: "unavailable",
          webTransportConfigured: true,
          webTransportStatus: "browser-api-missing"
        });
      }

      if (!context.datagramTransportAvailable) {
        return createRealtimeDatagramTransportStatusSnapshot({
          activeTransport: null,
          browserWebTransportAvailable,
          enabled: true,
          lastTransportError: null,
          preference: preferredTransportMode,
          state: "unavailable",
          webTransportConfigured: true,
          webTransportStatus: "active"
        });
      }

      if (context.usingReliableFallback) {
        return createRealtimeDatagramTransportStatusSnapshot({
          activeTransport: "reliable-command-fallback",
          browserWebTransportAvailable,
          enabled: true,
          lastTransportError: context.lastTransportError,
          preference: preferredTransportMode,
          state: "degraded-to-reliable",
          webTransportConfigured: true,
          webTransportStatus: "runtime-fallback"
        });
      }

      return createRealtimeDatagramTransportStatusSnapshot({
        activeTransport: "webtransport-datagram",
        browserWebTransportAvailable,
        enabled: true,
        lastTransportError: context.lastTransportError,
        preference: preferredTransportMode,
        state: "active",
        webTransportConfigured: true,
        webTransportStatus: "active"
      });
    },
    resolveReliableTransportStatusSnapshot: () => {
      if (preferredTransportMode !== "webtransport-preferred") {
        return createRealtimeReliableTransportStatusSnapshot({
          activeTransport: "http",
          browserWebTransportAvailable,
          enabled: true,
          fallbackActive: false,
          lastTransportError: null,
          preference: preferredTransportMode,
          webTransportConfigured: false,
          webTransportStatus: "not-requested"
        });
      }

      if (webTransportUrl === null) {
        return createRealtimeReliableTransportStatusSnapshot({
          activeTransport: "http",
          browserWebTransportAvailable,
          enabled: true,
          fallbackActive: false,
          lastTransportError:
            localdevWebTransportBootStatus === "self-check-failed"
              ? localdevWebTransportBootError
              : null,
          preference: preferredTransportMode,
          webTransportConfigured: false,
          webTransportStatus:
            localdevWebTransportBootStatus === "self-check-failed"
              ? "localdev-self-check-failed"
              : "unconfigured"
        });
      }

      if (!browserWebTransportAvailable) {
        return createRealtimeReliableTransportStatusSnapshot({
          activeTransport: "http",
          browserWebTransportAvailable,
          enabled: true,
          fallbackActive: false,
          lastTransportError: null,
          preference: preferredTransportMode,
          webTransportConfigured: true,
          webTransportStatus: "browser-api-missing"
        });
      }

      if (transportFailover?.usingFallback) {
        return createRealtimeReliableTransportStatusSnapshot({
          activeTransport: "http",
          browserWebTransportAvailable,
          enabled: true,
          fallbackActive: true,
          lastTransportError: transportFailover.lastFallbackError,
          preference: preferredTransportMode,
          webTransportConfigured: true,
          webTransportStatus:
            !transportFailover.hasPrimaryTransportSucceeded &&
            isLocalhostWebTransportUrl(webTransportUrl)
              ? "localdev-host-unavailable"
              : "runtime-fallback"
        });
      }

      return createRealtimeReliableTransportStatusSnapshot({
        activeTransport: transportFailover?.hasPrimaryTransportSucceeded
          ? "webtransport"
          : null,
        browserWebTransportAvailable,
        enabled: true,
        fallbackActive: false,
        lastTransportError: null,
        preference: preferredTransportMode,
        webTransportConfigured: true,
        webTransportStatus: "active"
      });
    },
    transport: shouldUseWebTransport
      ? Object.freeze({
          dispose() {
            transportFailover?.dispose();
          },
          pollWorldSnapshot(
            playerId: Parameters<typeof httpTransport.pollWorldSnapshot>[0]
          ) {
            return transportFailover!.invoke((transport) =>
              transport.pollWorldSnapshot(playerId)
            );
          },
          sendCommand(
            command: Parameters<typeof httpTransport.sendCommand>[0],
            options?: Parameters<typeof httpTransport.sendCommand>[1]
          ) {
            return transportFailover!.invoke((transport) =>
              transport.sendCommand(command, options)
            );
          }
        })
      : httpTransport
  });
}
