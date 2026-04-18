import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncPresenceCommand,
  metaversePresenceAnimationVocabularyIds,
  metaversePresenceLocomotionModeIds,
  metaversePresenceMountedOccupancyKinds,
  metaversePresenceMountedOccupantRoleIds,
  type MetaversePresenceAnimationVocabularyId,
  type MetaversePresenceMountedOccupancyKind,
  type MetaversePresenceMountedOccupantRoleId,
  type MetaversePresenceCommand
} from "@webgpu-metaverse/shared/metaverse/presence";
import { createUsername } from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../classes/metaverse-authoritative-world-runtime.js";

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

function isUnknownPlayerError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.startsWith("Unknown metaverse player:")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVector3Input(
  value: unknown
): value is { readonly x: number; readonly y: number; readonly z: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number"
  );
}

function readStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  return value;
}

function readRecordField(
  value: unknown,
  fieldName: string
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected object field: ${fieldName}`);
  }

  return value;
}

function readNumberField(value: unknown, fieldName: string): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric field: ${fieldName}`);
  }

  return value;
}

function resolvePlayerId(rawPlayerId: string) {
  const playerId = createMetaversePlayerId(rawPlayerId);

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return playerId;
}

function parsePresencePose(poseBody: Record<string, unknown>) {
  if (!isVector3Input(poseBody.position)) {
    throw new Error("Expected position.x, position.y, and position.z numeric fields.");
  }

  const animationVocabulary =
    poseBody.animationVocabulary === undefined
      ? undefined
      : readStringField(poseBody.animationVocabulary, "animationVocabulary");
  const locomotionMode =
    poseBody.locomotionMode === undefined
      ? undefined
      : readStringField(poseBody.locomotionMode, "locomotionMode");
  const look =
    poseBody.look === undefined
      ? undefined
      : readRecordField(poseBody.look, "look");

  if (
    animationVocabulary !== undefined &&
    !metaversePresenceAnimationVocabularyIds.includes(
      animationVocabulary as MetaversePresenceAnimationVocabularyId
    )
  ) {
    throw new Error(`Unsupported animationVocabulary: ${animationVocabulary}`);
  }

  if (
    locomotionMode !== undefined &&
    !metaversePresenceLocomotionModeIds.includes(
      locomotionMode as typeof metaversePresenceLocomotionModeIds[number]
    )
  ) {
    throw new Error(`Unsupported locomotionMode: ${locomotionMode}`);
  }

  const mountedOccupancy =
    poseBody.mountedOccupancy === undefined
      ? undefined
      : poseBody.mountedOccupancy === null
        ? null
        : readRecordField(poseBody.mountedOccupancy, "mountedOccupancy");

  if (
    mountedOccupancy !== undefined &&
    mountedOccupancy !== null &&
    !metaversePresenceMountedOccupancyKinds.includes(
      readStringField(
        mountedOccupancy.occupancyKind,
        "mountedOccupancy.occupancyKind"
      ) as MetaversePresenceMountedOccupancyKind
    )
  ) {
    throw new Error(
      `Unsupported mountedOccupancy.occupancyKind: ${mountedOccupancy.occupancyKind}`
    );
  }

  if (
    mountedOccupancy !== undefined &&
    mountedOccupancy !== null &&
    !metaversePresenceMountedOccupantRoleIds.includes(
      readStringField(
        mountedOccupancy.occupantRole,
        "mountedOccupancy.occupantRole"
      ) as MetaversePresenceMountedOccupantRoleId
    )
  ) {
    throw new Error(
      `Unsupported mountedOccupancy.occupantRole: ${mountedOccupancy.occupantRole}`
    );
  }

  return {
    ...(animationVocabulary === undefined
      ? {}
      : {
          animationVocabulary:
            animationVocabulary as MetaversePresenceAnimationVocabularyId
        }),
    ...(locomotionMode === undefined
      ? {}
      : {
          locomotionMode:
            locomotionMode as typeof metaversePresenceLocomotionModeIds[number]
        }),
    ...(look === undefined
      ? {}
      : {
          look: {
            pitchRadians: readNumberField(look.pitchRadians, "look.pitchRadians"),
            yawRadians: readNumberField(look.yawRadians, "look.yawRadians")
          }
        }),
    ...(mountedOccupancy === undefined
      ? {}
      : mountedOccupancy === null
        ? {
            mountedOccupancy: null
          }
        : {
          mountedOccupancy: {
            environmentAssetId: readStringField(
              mountedOccupancy.environmentAssetId,
              "mountedOccupancy.environmentAssetId"
            ),
            entryId:
              mountedOccupancy.entryId === null
                ? null
                : readStringField(
                    mountedOccupancy.entryId,
                    "mountedOccupancy.entryId"
                  ),
            occupancyKind:
              mountedOccupancy.occupancyKind as MetaversePresenceMountedOccupancyKind,
            occupantRole:
              mountedOccupancy.occupantRole as MetaversePresenceMountedOccupantRoleId,
            seatId:
              mountedOccupancy.seatId === null
                ? null
                : readStringField(
                    mountedOccupancy.seatId,
                    "mountedOccupancy.seatId"
                  )
          }
        }),
    position: poseBody.position,
    ...(poseBody.stateSequence === undefined
      ? {}
      : {
          stateSequence: readNumberField(poseBody.stateSequence, "stateSequence")
        }),
    yawRadians: readNumberField(poseBody.yawRadians, "yawRadians")
  };
}

function parseJoinPresenceCommand(body: Record<string, unknown>) {
  const username = createUsername(readStringField(body.username, "username"));

  if (username === null) {
    throw new Error("Invalid username.");
  }

  return createMetaverseJoinPresenceCommand({
    characterId: readStringField(body.characterId, "characterId"),
    playerId: resolvePlayerId(readStringField(body.playerId, "playerId")),
    pose: parsePresencePose(readRecordField(body.pose, "pose")),
    username
  });
}

function parseLeavePresenceCommand(body: Record<string, unknown>) {
  return createMetaverseLeavePresenceCommand({
    playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
  });
}

function parseSyncPresenceCommand(body: Record<string, unknown>) {
  return createMetaverseSyncPresenceCommand({
    playerId: resolvePlayerId(readStringField(body.playerId, "playerId")),
    pose: parsePresencePose(readRecordField(body.pose, "pose"))
  });
}

function parsePresenceCommand(body: unknown): MetaversePresenceCommand {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body.");
  }

  const commandType = readStringField(body.type, "type");

  switch (commandType) {
    case "join-presence":
      return parseJoinPresenceCommand(body);
    case "leave-presence":
      return parseLeavePresenceCommand(body);
    case "sync-presence":
      return parseSyncPresenceCommand(body);
    default:
      throw new Error(`Unsupported metaverse presence command type: ${commandType}`);
  }
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

function isMetaversePresencePath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 2 &&
    segments[0] === "metaverse" &&
    segments[1] === "presence"
  );
}

function isMetaversePresenceCommandPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 3 &&
    segments[0] === "metaverse" &&
    segments[1] === "presence" &&
    segments[2] === "commands"
  );
}

export class MetaversePresenceHttpAdapter {
  readonly #metaverseAuthoritativeWorldRuntime: MetaverseAuthoritativeWorldRuntime;

  constructor(metaverseAuthoritativeWorldRuntime: MetaverseAuthoritativeWorldRuntime) {
    this.#metaverseAuthoritativeWorldRuntime = metaverseAuthoritativeWorldRuntime;
  }

  async handleRequest(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    requestUrl: URL,
    nowMs: number
  ): Promise<boolean> {
    if (request.method === "GET" && isMetaversePresencePath(requestUrl.pathname)) {
      try {
        const observerPlayerIdRaw = requestUrl.searchParams.get("playerId");
        const observerPlayerId =
          observerPlayerIdRaw === null
            ? undefined
            : resolvePlayerId(observerPlayerIdRaw);

        writeJson(
          response,
          200,
          this.#metaverseAuthoritativeWorldRuntime.readPresenceRosterEvent(
            nowMs,
            observerPlayerId
          )
        );
      } catch (error) {
        if (isUnknownPlayerError(error)) {
          writeJson(response, 409, {
            error: error.message
          });
          return true;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Invalid metaverse presence request."
        });
      }

      return true;
    }

    if (
      request.method === "POST" &&
      isMetaversePresenceCommandPath(requestUrl.pathname)
    ) {
      try {
        const body = await readJsonBody(request);
        const command = parsePresenceCommand(body);

        writeJson(
          response,
          200,
          this.#metaverseAuthoritativeWorldRuntime.acceptPresenceCommand(
            command,
            nowMs
          )
        );
      } catch (error) {
        if (isUnknownPlayerError(error)) {
          writeJson(response, 409, {
            error: error.message
          });
          return true;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Invalid metaverse presence command."
        });
      }

      return true;
    }

    return false;
  }
}
