import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import type {
  CoopFireShotCommand,
  CoopJoinRoomCommand,
  CoopKickPlayerCommand,
  CoopLeaveRoomCommand,
  CoopRoomClientCommand,
  CoopRoomDirectoryEntrySnapshotInput,
  CoopRoomId,
  CoopSetPlayerReadyCommand,
  CoopStartSessionCommand,
  CoopSyncPlayerPresenceCommand
} from "@webgpu-metaverse/shared";
import {
  createCoopFireShotCommand,
  createCoopJoinRoomCommand,
  createCoopKickPlayerCommand,
  createCoopLeaveRoomCommand,
  createCoopPlayerId,
  createCoopRoomDirectorySnapshot,
  createCoopRoomId,
  createCoopRoomSnapshotEvent,
  createCoopSetPlayerReadyCommand,
  createCoopStartSessionCommand,
  createCoopSyncPlayerPresenceCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import { CoopRoomDirectory } from "../classes/coop-room-directory.js";

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

function isUnknownRoomError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.startsWith("Unknown co-op room:")
  );
}

function isUnknownPlayerError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.startsWith("Unknown co-op player:")
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

function readBooleanField(
  value: unknown,
  fieldName: string
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean field: ${fieldName}`);
  }

  return value;
}

function readNumberField(value: unknown, fieldName: string): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric field: ${fieldName}`);
  }

  return value;
}

function readStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  return value;
}

function resolveRoomId(rawRoomId: string): CoopRoomId {
  const roomId = createCoopRoomId(rawRoomId);

  if (roomId === null) {
    throw new Error(`Invalid co-op room id: ${rawRoomId}`);
  }

  return roomId;
}

function resolvePlayerId(rawPlayerId: string): ReturnType<typeof createCoopPlayerId> {
  return createCoopPlayerId(rawPlayerId);
}

function parseJoinRoomCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopJoinRoomCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );
  const username = createUsername(readStringField(body.username, "username"));

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  if (username === null) {
    throw new Error("Invalid username.");
  }

  return createCoopJoinRoomCommand({
    playerId,
    ready:
      body.ready === undefined ? false : readBooleanField(body.ready, "ready"),
    roomId,
    username
  });
}

function parseSetPlayerReadyCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopSetPlayerReadyCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return createCoopSetPlayerReadyCommand({
    playerId,
    ready: readBooleanField(body.ready, "ready"),
    roomId
  });
}

function parseStartSessionCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopStartSessionCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return createCoopStartSessionCommand({
    playerId,
    roomId
  });
}

function parseKickPlayerCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopKickPlayerCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );
  const targetPlayerId = createCoopPlayerId(
    readStringField(body.targetPlayerId, "targetPlayerId")
  );

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  if (targetPlayerId === null) {
    throw new Error("Invalid targetPlayerId.");
  }

  return createCoopKickPlayerCommand({
    playerId,
    roomId,
    targetPlayerId
  });
}

function parseLeaveRoomCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopLeaveRoomCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return createCoopLeaveRoomCommand({
    playerId,
    roomId
  });
}

function parseFireShotCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopFireShotCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  if (!isVector3Input(body.origin)) {
    throw new Error("Expected origin.x, origin.y, and origin.z numeric fields.");
  }

  if (!isVector3Input(body.aimDirection)) {
    throw new Error(
      "Expected aimDirection.x, aimDirection.y, and aimDirection.z numeric fields."
    );
  }

  return createCoopFireShotCommand({
    aimDirection: body.aimDirection,
    clientShotSequence: readNumberField(
      body.clientShotSequence,
      "clientShotSequence"
    ),
    origin: body.origin,
    playerId,
    roomId
  });
}

function parseSyncPlayerPresenceCommand(
  body: Record<string, unknown>,
  roomId: CoopRoomId
): CoopSyncPlayerPresenceCommand {
  const playerId = createCoopPlayerId(
    readStringField(body.playerId, "playerId")
  );

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  if (!isVector3Input(body.position)) {
    throw new Error("Expected position.x, position.y, and position.z numeric fields.");
  }

  if (!isVector3Input(body.aimDirection)) {
    throw new Error(
      "Expected aimDirection.x, aimDirection.y, and aimDirection.z numeric fields."
    );
  }

  return createCoopSyncPlayerPresenceCommand({
    aimDirection: body.aimDirection,
    pitchRadians: readNumberField(body.pitchRadians, "pitchRadians"),
    playerId,
    position: body.position,
    roomId,
    stateSequence: readNumberField(body.stateSequence, "stateSequence"),
    weaponId: readStringField(body.weaponId, "weaponId"),
    yawRadians: readNumberField(body.yawRadians, "yawRadians")
  });
}

function parseCoopRoomCommand(
  body: unknown,
  roomId: CoopRoomId
): CoopRoomClientCommand {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body.");
  }

  const commandType = readStringField(body.type, "type");

  switch (commandType) {
    case "join-room":
      return parseJoinRoomCommand(body, roomId);
    case "set-player-ready":
      return parseSetPlayerReadyCommand(body, roomId);
    case "start-session":
      return parseStartSessionCommand(body, roomId);
    case "kick-player":
      return parseKickPlayerCommand(body, roomId);
    case "leave-room":
      return parseLeaveRoomCommand(body, roomId);
    case "fire-shot":
      return parseFireShotCommand(body, roomId);
    case "sync-player-presence":
      return parseSyncPlayerPresenceCommand(body, roomId);
    default:
      throw new Error(`Unsupported co-op command type: ${commandType}`);
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

function isDuckHuntDirectoryPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 4 &&
    segments[0] === "experiences" &&
    segments[1] === "duck-hunt" &&
    segments[2] === "coop" &&
    segments[3] === "rooms"
  );
}

function matchDuckHuntRoomPath(
  pathname: string
): {
  readonly isCommandPath: boolean;
  readonly rawRoomId: string;
} | null {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  if (
    segments.length === 5 &&
    segments[0] === "experiences" &&
    segments[1] === "duck-hunt" &&
    segments[2] === "coop" &&
    segments[3] === "rooms"
  ) {
    return {
      isCommandPath: false,
      rawRoomId: segments[4]!
    };
  }

  if (
    segments.length === 6 &&
    segments[0] === "experiences" &&
    segments[1] === "duck-hunt" &&
    segments[2] === "coop" &&
    segments[3] === "rooms" &&
    segments[5] === "commands"
  ) {
    return {
      isCommandPath: true,
      rawRoomId: segments[4]!
    };
  }

  return null;
}

export class DuckHuntCoopRoomHttpAdapter {
  readonly #coopRoomDirectory: CoopRoomDirectory;

  constructor(coopRoomDirectory: CoopRoomDirectory) {
    this.#coopRoomDirectory = coopRoomDirectory;
  }

  async handleRequest(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    requestUrl: URL,
    nowMs: number
  ): Promise<boolean> {
    const matchedDuckHuntRoomPath = matchDuckHuntRoomPath(requestUrl.pathname);

    if (request.method === "GET" && isDuckHuntDirectoryPath(requestUrl.pathname)) {
      const roomSnapshots = this.#coopRoomDirectory.listRoomSnapshots(nowMs);
      const directoryEntries: CoopRoomDirectoryEntrySnapshotInput[] =
        roomSnapshots.map((roomSnapshot) => ({
          birdsRemaining: roomSnapshot.session.birdsRemaining,
          capacity: roomSnapshot.capacity,
          connectedPlayerCount: roomSnapshot.players.filter(
            (playerSnapshot) => playerSnapshot.connected
          ).length,
          phase: roomSnapshot.session.phase,
          readyPlayerCount: roomSnapshot.players.filter(
            (playerSnapshot) => playerSnapshot.connected && playerSnapshot.ready
          ).length,
          roundNumber: roomSnapshot.session.roundNumber,
          roundPhase: roomSnapshot.session.roundPhase,
          roundPhaseRemainingMs: roomSnapshot.session.roundPhaseRemainingMs,
          requiredReadyPlayerCount: roomSnapshot.session.requiredReadyPlayerCount,
          roomId: roomSnapshot.roomId,
          sessionId: roomSnapshot.session.sessionId,
          tick: roomSnapshot.tick.currentTick
        }));

      writeJson(
        response,
        200,
        createCoopRoomDirectorySnapshot({
          coOpRooms: directoryEntries
        })
      );
      return true;
    }

    if (
      matchedDuckHuntRoomPath !== null &&
      request.method === "GET" &&
      !matchedDuckHuntRoomPath.isCommandPath
    ) {
      try {
        const roomId = resolveRoomId(matchedDuckHuntRoomPath.rawRoomId);
        const observerPlayerIdRaw = requestUrl.searchParams.get("playerId");
        const resolvedObserverPlayerId =
          observerPlayerIdRaw === null
            ? undefined
            : resolvePlayerId(observerPlayerIdRaw);

        if (observerPlayerIdRaw !== null && resolvedObserverPlayerId === null) {
          throw new Error("Invalid playerId.");
        }

        writeJson(
          response,
          200,
          createCoopRoomSnapshotEvent(
            this.#coopRoomDirectory.advanceRoom(
              roomId,
              nowMs,
              resolvedObserverPlayerId ?? undefined
            )
          )
        );
      } catch (error) {
        if (isUnknownRoomError(error)) {
          writeJson(response, 404, {
            error: error.message
          });
          return true;
        }

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
              : "Invalid co-op room request."
        });
      }

      return true;
    }

    if (
      matchedDuckHuntRoomPath !== null &&
      request.method === "POST" &&
      matchedDuckHuntRoomPath.isCommandPath
    ) {
      try {
        const roomId = resolveRoomId(matchedDuckHuntRoomPath.rawRoomId);
        const body = await readJsonBody(request);
        const command = parseCoopRoomCommand(body, roomId);
        const commandResult = this.#coopRoomDirectory.acceptCommand(command, nowMs);

        writeJson(response, 200, commandResult);
      } catch (error) {
        if (isUnknownRoomError(error)) {
          writeJson(response, 404, {
            error: error.message
          });
          return true;
        }

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
              : "Invalid co-op room command."
        });
      }

      return true;
    }

    return false;
  }
}
