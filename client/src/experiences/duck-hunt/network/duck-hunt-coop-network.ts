import {
  createCoopRoomId,
  createMilliseconds,
  type CoopRoomId
} from "@webgpu-metaverse/shared";

import {
  CoopRoomClient,
  CoopRoomDirectoryClient,
  createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport,
  createCoopRoomHttpTransport,
  createCoopRoomWebTransportTransport,
  type CoopRoomClientConfig,
  type CoopRoomDirectoryClientConfig
} from "../../../network";
import { createWebTransportHttpFallbackInvoker } from "../../../network/adapters/webtransport-http-fallback";

function requireDuckHuntCoopRoomId(rawValue: string): CoopRoomId {
  const roomId = createCoopRoomId(rawValue);

  if (roomId === null) {
    throw new Error(`Invalid Duck Hunt co-op room id: ${rawValue}`);
  }

  return roomId;
}

function resolveDuckHuntServerOrigin(): string {
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

function resolveDuckHuntCoopTransportMode():
  | "http"
  | "webtransport-preferred" {
  const configuredMode = import.meta.env?.VITE_DUCK_HUNT_COOP_TRANSPORT?.trim();

  return configuredMode === "webtransport-preferred"
    ? "webtransport-preferred"
    : "http";
}

function resolveDuckHuntCoopWebTransportUrl(): string | null {
  const configuredUrl =
    import.meta.env?.VITE_DUCK_HUNT_COOP_WEBTRANSPORT_URL?.trim();

  if (configuredUrl === undefined || configuredUrl.length === 0) {
    return null;
  }

  return configuredUrl;
}

export const duckHuntCoopRoomCollectionPath =
  "/experiences/duck-hunt/coop/rooms" as const;
export const duckHuntRoomDirectoryRefreshIntervalMs = 3_000;
export const defaultDuckHuntCoopRoomId =
  requireDuckHuntCoopRoomId("co-op-harbor");

export const duckHuntCoopRoomClientConfig = {
  defaultPollIntervalMs: createMilliseconds(75),
  roomCollectionPath: duckHuntCoopRoomCollectionPath,
  roomId: defaultDuckHuntCoopRoomId,
  serverOrigin: resolveDuckHuntServerOrigin()
} as const satisfies CoopRoomClientConfig;

export const duckHuntCoopRoomDirectoryClientConfig = {
  roomCollectionPath: duckHuntCoopRoomCollectionPath,
  serverOrigin: resolveDuckHuntServerOrigin()
} as const satisfies CoopRoomDirectoryClientConfig;

export function createDuckHuntCoopRoomClient(
  roomId: CoopRoomId = defaultDuckHuntCoopRoomId
): CoopRoomClient {
  const preferredTransportMode = resolveDuckHuntCoopTransportMode();
  const webTransportUrl = resolveDuckHuntCoopWebTransportUrl();
  const shouldUseWebTransport =
    preferredTransportMode === "webtransport-preferred" &&
    webTransportUrl !== null &&
    typeof (
      globalThis as typeof globalThis & {
        readonly WebTransport?: unknown;
      }
    ).WebTransport === "function";

  const httpTransport = createCoopRoomHttpTransport({
    ...duckHuntCoopRoomClientConfig,
    roomId
  });
  const playerPresenceDatagramTransport = shouldUseWebTransport
    ? createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport({
        webTransportUrl
      })
    : null;

  return new CoopRoomClient({
    ...duckHuntCoopRoomClientConfig,
    roomId
  }, {
    ...(playerPresenceDatagramTransport === null
      ? {}
      : {
          playerPresenceDatagramTransport
        }),
    transport: shouldUseWebTransport
      ? (() => {
          const transportFailover = createWebTransportHttpFallbackInvoker(
            createCoopRoomWebTransportTransport({
              roomId,
              webTransportUrl
            }),
            httpTransport
          );

          return Object.freeze({
            dispose() {
              transportFailover.dispose();
            },
            pollRoomSnapshot(
              playerId: Parameters<typeof httpTransport.pollRoomSnapshot>[0]
            ) {
              return transportFailover.invoke((transport) =>
                transport.pollRoomSnapshot(playerId)
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

export function createDuckHuntCoopRoomDirectoryClient(): CoopRoomDirectoryClient {
  return new CoopRoomDirectoryClient(duckHuntCoopRoomDirectoryClientConfig);
}

export function createSuggestedDuckHuntCoopRoomIdDraft(): string {
  const suffix =
    globalThis.crypto?.randomUUID?.().slice(0, 6) ??
    Math.random().toString(36).slice(2, 8);

  return `duck-hunt-${suffix}`;
}

export function resolveDuckHuntCoopRoomIdDraft(
  roomIdDraft: string
): CoopRoomId | null {
  return createCoopRoomId(roomIdDraft);
}

export function resolveDuckHuntGameplayCoopRoomId(
  roomIdDraft: string
): CoopRoomId {
  return resolveDuckHuntCoopRoomIdDraft(roomIdDraft) ?? defaultDuckHuntCoopRoomId;
}
