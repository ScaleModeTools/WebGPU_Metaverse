import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import {
  createMetaverseJoinRoomRequest,
  createMetaverseNextMatchRequest,
  createMetaversePlayerId,
  createMetaverseRoomId,
  createMetaverseQuickJoinRoomRequest,
  metaverseMatchModeIds,
  type MetaverseJoinRoomRequest,
  type MetaverseMatchModeId,
  type MetaverseNextMatchRequest,
  type MetaverseQuickJoinRoomRequest
} from "@webgpu-metaverse/shared";

import type { MetaverseRoomDirectoryOwner } from "../types/metaverse-room-directory-owner.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJsonBody(
  request: IncomingMessage
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  return value;
}

function readOptionalStringField(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Expected optional string field.");
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? null : normalizedValue;
}

function resolveMetaverseMatchMode(rawValue: string): MetaverseMatchModeId {
  if (!metaverseMatchModeIds.includes(rawValue as MetaverseMatchModeId)) {
    throw new Error(`Unsupported metaverse match mode: ${rawValue}`);
  }

  return rawValue as MetaverseMatchModeId;
}

function resolveMetaverseRoomId(rawValue: string) {
  const roomId = createMetaverseRoomId(rawValue);

  if (roomId === null) {
    throw new Error(`Invalid metaverse room id: ${rawValue}`);
  }

  return roomId;
}

function resolveMetaversePlayerId(rawValue: string) {
  const playerId = createMetaversePlayerId(rawValue);

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return playerId;
}

function resolveRoomDirectoryMatchMode(
  requestUrl: URL
): MetaverseMatchModeId | undefined {
  const rawMatchMode = requestUrl.searchParams.get("matchMode");

  if (rawMatchMode === null) {
    return undefined;
  }

  return resolveMetaverseMatchMode(rawMatchMode);
}

function parseQuickJoinRequest(body: unknown): MetaverseQuickJoinRoomRequest {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body.");
  }

  return createMetaverseQuickJoinRoomRequest({
    bundleId: readOptionalStringField(body.bundleId),
    launchVariationId: readOptionalStringField(body.launchVariationId),
    matchMode: resolveMetaverseMatchMode(
      readStringField(body.matchMode, "matchMode")
    ),
    playerId: resolveMetaversePlayerId(
      readStringField(body.playerId, "playerId")
    )
  });
}

function parseJoinRoomRequest(body: unknown): MetaverseJoinRoomRequest {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body.");
  }

  return createMetaverseJoinRoomRequest({
    bundleId: readOptionalStringField(body.bundleId),
    launchVariationId: readOptionalStringField(body.launchVariationId),
    playerId: resolveMetaversePlayerId(
      readStringField(body.playerId, "playerId")
    )
  });
}

function parseNextMatchRequest(body: unknown): MetaverseNextMatchRequest {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body.");
  }

  return createMetaverseNextMatchRequest({
    playerId: resolveMetaversePlayerId(
      readStringField(body.playerId, "playerId")
    )
  });
}

function isMetaverseRoomDirectoryPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return segments.length === 2 && segments[0] === "metaverse" && segments[1] === "rooms";
}

function isMetaverseQuickJoinPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 3 &&
    segments[0] === "metaverse" &&
    segments[1] === "rooms" &&
    segments[2] === "quick-join"
  );
}

function resolveJoinedRoomId(pathname: string) {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  if (
    segments.length !== 4 ||
    segments[0] !== "metaverse" ||
    segments[1] !== "rooms" ||
    segments[3] !== "join"
  ) {
    return null;
  }

  return resolveMetaverseRoomId(segments[2] ?? "");
}

function resolveNextMatchRoomId(pathname: string) {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  if (
    segments.length !== 4 ||
    segments[0] !== "metaverse" ||
    segments[1] !== "rooms" ||
    segments[3] !== "next-match"
  ) {
    return null;
  }

  return resolveMetaverseRoomId(segments[2] ?? "");
}

function isUnknownRoomError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("Unknown metaverse room:");
}

function isRoomConflictError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message.includes(" is full.") ||
      error.message.includes(" is not ready for the next match.") ||
      error.message.startsWith("Metaverse player "))
  );
}

export class MetaverseRoomHttpAdapter {
  readonly #roomDirectory: MetaverseRoomDirectoryOwner;

  constructor(roomDirectory: MetaverseRoomDirectoryOwner) {
    this.#roomDirectory = roomDirectory;
  }

  async handleRequest(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    requestUrl: URL,
    nowMs: number
  ): Promise<boolean> {
    if (request.method === "GET" && isMetaverseRoomDirectoryPath(requestUrl.pathname)) {
      try {
        writeJson(
          response,
          200,
          this.#roomDirectory.listRoomDirectorySnapshot(
            nowMs,
            resolveRoomDirectoryMatchMode(requestUrl)
          )
        );
      } catch (error) {
        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Invalid metaverse room directory request."
        });
      }

      return true;
    }

    if (request.method === "POST" && isMetaverseQuickJoinPath(requestUrl.pathname)) {
      try {
        const requestBody = parseQuickJoinRequest(await readJsonBody(request));

        writeJson(
          response,
          200,
          this.#roomDirectory.quickJoinRoom(requestBody, nowMs)
        );
      } catch (error) {
        if (isRoomConflictError(error)) {
          writeJson(response, 409, {
            error: error.message
          });
          return true;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Metaverse room quick join failed."
        });
      }

      return true;
    }

    const joinedRoomId = resolveJoinedRoomId(requestUrl.pathname);

    if (request.method === "POST" && joinedRoomId !== null) {
      try {
        const requestBody = parseJoinRoomRequest(await readJsonBody(request));

        writeJson(
          response,
          200,
          this.#roomDirectory.joinRoom(joinedRoomId, requestBody, nowMs)
        );
      } catch (error) {
        if (isUnknownRoomError(error) || isRoomConflictError(error)) {
          writeJson(response, 409, {
            error: error.message
          });
          return true;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Metaverse room join failed."
        });
      }

      return true;
    }

    const nextMatchRoomId = resolveNextMatchRoomId(requestUrl.pathname);

    if (request.method === "POST" && nextMatchRoomId !== null) {
      try {
        const requestBody = parseNextMatchRequest(await readJsonBody(request));

        writeJson(
          response,
          200,
          this.#roomDirectory.requestNextMatch(
            nextMatchRoomId,
            requestBody,
            nowMs
          )
        );
      } catch (error) {
        if (isUnknownRoomError(error) || isRoomConflictError(error)) {
          writeJson(response, 409, {
            error: error.message
          });
          return true;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Metaverse next match failed."
        });
      }

      return true;
    }

    return false;
  }
}
