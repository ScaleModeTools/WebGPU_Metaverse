import {
  createMetaversePlayerId,
  createMilliseconds,
  resolveMetaversePlayerTeamId,
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
import {
  defaultMetaverseNetworkRoomId,
  metaverseServerOrigin
} from "./metaverse-world-network";

export interface MetaverseLocalPlayerIdentity {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly teamId?: MetaversePlayerTeamId;
  readonly username: Username;
}

const metaverseLocalPlayerIdStorageKey =
  "webgpu-metaverse:local-player-id" as const;

let cachedMetaverseLocalPlayerId: MetaversePlayerId | null | undefined;

function normalizePlayerIdSegment(rawValue: string): string {
  const normalizedValue = rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue.length === 0 ? "player" : normalizedValue;
}

function readStoredMetaverseLocalPlayerId(): MetaversePlayerId | null {
  if (cachedMetaverseLocalPlayerId !== undefined) {
    return cachedMetaverseLocalPlayerId;
  }

  try {
    const storedPlayerId =
      globalThis.sessionStorage?.getItem(metaverseLocalPlayerIdStorageKey) ??
      null;

    cachedMetaverseLocalPlayerId =
      storedPlayerId === null ? null : createMetaversePlayerId(storedPlayerId);
  } catch {
    cachedMetaverseLocalPlayerId = null;
  }

  return cachedMetaverseLocalPlayerId;
}

function storeMetaverseLocalPlayerId(playerId: MetaversePlayerId): void {
  cachedMetaverseLocalPlayerId = playerId;

  try {
    globalThis.sessionStorage?.setItem(
      metaverseLocalPlayerIdStorageKey,
      playerId
    );
  } catch {
    // Ignore session storage unavailability and keep the in-memory identity.
  }
}

function resolveMetaverseLocalPlayerId(username: string): MetaversePlayerId {
  const storedPlayerId = readStoredMetaverseLocalPlayerId();

  if (storedPlayerId !== null) {
    return storedPlayerId;
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

  storeMetaverseLocalPlayerId(playerId);

  return playerId;
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

export function resolveMetaversePresencePath(roomId = defaultMetaverseNetworkRoomId): string {
  return `/metaverse/rooms/${roomId}/presence`;
}

export function createMetaversePresenceClientConfig(
  roomId = defaultMetaverseNetworkRoomId
): MetaversePresenceClientConfig {
  return Object.freeze({
    defaultPollIntervalMs: createMilliseconds(150),
    presencePath: resolveMetaversePresencePath(roomId),
    roomId,
    serverOrigin: metaverseServerOrigin
  });
}

export const metaversePresenceClientConfig = createMetaversePresenceClientConfig();

export function createMetaversePresenceClient(
  roomId = defaultMetaverseNetworkRoomId
): MetaversePresenceClient {
  const presenceClientConfig = createMetaversePresenceClientConfig(roomId);
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
    presenceClientConfig
  );
  const transportFailover = shouldUseWebTransport
    ? createWebTransportHttpFallbackInvoker(
        createMetaversePresenceWebTransportTransport(
          {
            roomId,
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

  return new MetaversePresenceClient(presenceClientConfig, {
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

  const playerId = resolveMetaverseLocalPlayerId(username);

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

export function createMetaverseTeamDeathmatchLocalPlayerIdentity(
  username: string,
  characterId: string
): MetaverseLocalPlayerIdentity {
  const identity = createMetaverseLocalPlayerIdentity(username, characterId);

  return Object.freeze({
    ...identity,
    teamId: resolveMetaversePlayerTeamId(identity.playerId)
  });
}

export function resolveMetaverseLocalPlayerIdForUsername(
  username: string
): MetaversePlayerId {
  return resolveMetaverseLocalPlayerId(username);
}
