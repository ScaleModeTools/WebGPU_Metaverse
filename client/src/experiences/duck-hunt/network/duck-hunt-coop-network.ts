import {
  createCoopRoomId,
  createMilliseconds,
  type CoopRoomId
} from "@thumbshooter/shared";

import {
  CoopRoomClient,
  CoopRoomDirectoryClient,
  type CoopRoomClientConfig,
  type CoopRoomDirectoryClientConfig
} from "../../../network";

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
  return new CoopRoomClient({
    ...duckHuntCoopRoomClientConfig,
    roomId
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
