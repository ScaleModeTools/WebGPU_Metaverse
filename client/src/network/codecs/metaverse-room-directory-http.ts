import type {
  MetaverseJoinRoomRequest,
  MetaverseMatchModeId,
  MetaverseNextMatchRequest,
  MetaverseQuickJoinRoomRequest,
  MetaverseRoomAssignmentSnapshot,
  MetaverseRoomAssignmentSnapshotInput,
  MetaverseRoomDirectorySnapshot,
  MetaverseRoomDirectorySnapshotInput,
  MetaverseRoomId
} from "@webgpu-metaverse/shared";
import {
  createMetaverseRoomAssignmentSnapshot,
  createMetaverseRoomDirectorySnapshot
} from "@webgpu-metaverse/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveMetaverseRoomDirectoryUrl(
  serverOrigin: string,
  roomCollectionPath: string,
  matchMode?: MetaverseMatchModeId
): string {
  const directoryUrl = new URL(roomCollectionPath, serverOrigin);

  if (matchMode !== undefined) {
    directoryUrl.searchParams.set("matchMode", matchMode);
  }

  return directoryUrl.toString();
}

export function resolveMetaverseRoomQuickJoinUrl(
  serverOrigin: string,
  roomCollectionPath: string
): string {
  return new URL(`${roomCollectionPath}/quick-join`, serverOrigin).toString();
}

export function resolveMetaverseRoomJoinUrl(
  serverOrigin: string,
  roomCollectionPath: string,
  roomId: MetaverseRoomId
): string {
  return new URL(`${roomCollectionPath}/${roomId}/join`, serverOrigin).toString();
}

export function resolveMetaverseRoomNextMatchUrl(
  serverOrigin: string,
  roomCollectionPath: string,
  roomId: MetaverseRoomId
): string {
  return new URL(
    `${roomCollectionPath}/${roomId}/next-match`,
    serverOrigin
  ).toString();
}

export function serializeMetaverseQuickJoinRoomRequest(
  request: MetaverseQuickJoinRoomRequest
): string {
  return JSON.stringify(request);
}

export function serializeMetaverseJoinRoomRequest(
  request: MetaverseJoinRoomRequest
): string {
  return JSON.stringify(request);
}

export function serializeMetaverseNextMatchRequest(
  request: MetaverseNextMatchRequest
): string {
  return JSON.stringify(request);
}

export function parseMetaverseRoomDirectorySnapshot(
  payload: unknown
): MetaverseRoomDirectorySnapshot {
  if (!isRecord(payload) || !Array.isArray(payload.rooms)) {
    throw new Error("Metaverse room directory response was invalid.");
  }

  return createMetaverseRoomDirectorySnapshot(
    payload as unknown as MetaverseRoomDirectorySnapshotInput
  );
}

export function parseMetaverseRoomAssignmentSnapshot(
  payload: unknown
): MetaverseRoomAssignmentSnapshot {
  if (
    !isRecord(payload) ||
    typeof payload.bundleId !== "string" ||
    typeof payload.launchVariationId !== "string" ||
    typeof payload.matchMode !== "string" ||
    typeof payload.roomId !== "string" ||
    typeof payload.roomSessionId !== "string"
  ) {
    throw new Error("Metaverse room assignment response was invalid.");
  }

  return createMetaverseRoomAssignmentSnapshot(
    payload as unknown as MetaverseRoomAssignmentSnapshotInput
  );
}

export function parseMetaverseRoomErrorMessage(
  payload: unknown,
  fallbackMessage: string
): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    const normalizedMessage = payload.error.trim();

    if (normalizedMessage.length > 0) {
      return normalizedMessage;
    }
  }

  return fallbackMessage;
}
