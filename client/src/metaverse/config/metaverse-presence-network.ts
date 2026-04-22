import {
  createMetaversePlayerId,
  createMilliseconds,
  createUsername,
  type MetaversePlayerId,
  type MetaversePlayerTeamId,
  type Username
} from "@webgpu-metaverse/shared";

import {
  MetaversePresenceClient,
  createRealtimeReliableTransportStatusSnapshot,
  createNativeWebTransportBrowserFactory,
  createMetaversePresenceHttpTransport,
  createMetaversePresenceWebTransportTransport,
  type MetaversePresenceClientConfig
} from "@/network";
import { createWebTransportHttpFallbackInvoker } from "@/network/adapters/webtransport-http-fallback";

export interface MetaverseLocalPlayerIdentity {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly teamId?: MetaversePlayerTeamId;
  readonly username: Username;
}

function normalizePlayerIdSegment(rawValue: string): string {
  const normalizedValue = rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue.length === 0 ? "player" : normalizedValue;
}

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

function resolveMetaversePresenceWebTransportUrl(): string | null {
  const configuredUrl =
    import.meta.env?.VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL?.trim();

  if (configuredUrl === undefined || configuredUrl.length === 0) {
    return null;
  }

  return configuredUrl;
}

function resolveMetaversePresenceWebTransportServerCertificateSha256():
  | string
  | null {
  const configuredHash =
    import.meta.env?.VITE_METAVERSE_PRESENCE_WEBTRANSPORT_SERVER_CERT_SHA256?.trim();

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

export const metaversePresencePath = "/metaverse/presence" as const;

export const metaversePresenceClientConfig = {
  defaultPollIntervalMs: createMilliseconds(150),
  presencePath: metaversePresencePath,
  serverOrigin: resolveMetaverseServerOrigin()
} as const satisfies MetaversePresenceClientConfig;

export function createMetaversePresenceClient(): MetaversePresenceClient {
  const preferredTransportMode = resolveMetaverseRealtimeTransportMode();
  const localdevWebTransportBootStatus = resolveLocaldevWebTransportBootStatus();
  const localdevWebTransportBootError = resolveLocaldevWebTransportBootError();
  const webTransportUrl = resolveMetaversePresenceWebTransportUrl();
  const browserWebTransportAvailable = hasBrowserWebTransportApi();
  const shouldUseWebTransport =
    preferredTransportMode === "webtransport-preferred" &&
    webTransportUrl !== null &&
    browserWebTransportAvailable;
  const webTransportFactory = shouldUseWebTransport
    ? createNativeWebTransportBrowserFactory({
        serverCertificateSha256Hex:
          resolveMetaversePresenceWebTransportServerCertificateSha256()
      })
    : null;

  const httpTransport = createMetaversePresenceHttpTransport(
    metaversePresenceClientConfig
  );
  const transportFailover = shouldUseWebTransport
    ? createWebTransportHttpFallbackInvoker(
        createMetaversePresenceWebTransportTransport(
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

  return new MetaversePresenceClient(metaversePresenceClientConfig, {
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
          pollRosterSnapshot(
            playerId: Parameters<typeof httpTransport.pollRosterSnapshot>[0]
          ) {
            return transportFailover!.invoke((transport) =>
              transport.pollRosterSnapshot(playerId)
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

export function createMetaverseLocalPlayerIdentity(
  username: string,
  characterId: string
): MetaverseLocalPlayerIdentity {
  const resolvedUsername = createUsername(username);

  if (resolvedUsername === null) {
    throw new Error("Metaverse local player identity requires a valid username.");
  }

  const randomSuffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  const playerId = createMetaversePlayerId(
    `${normalizePlayerIdSegment(username)}-${randomSuffix}`
  );

  if (playerId === null) {
    throw new Error("Unable to create a metaverse player id.");
  }

  const normalizedCharacterId = characterId.trim();

  if (normalizedCharacterId.length === 0) {
    throw new Error("Metaverse local player identity requires a character id.");
  }

  return Object.freeze({
    characterId: normalizedCharacterId,
    playerId,
    username: resolvedUsername
  });
}
