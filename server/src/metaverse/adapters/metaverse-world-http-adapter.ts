import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import {
  createMetaversePlayerId,
  metaversePresenceMountedOccupancyKinds,
  metaversePresenceMountedOccupantRoleIds,
  type MetaversePresenceMountedOccupancyKind,
  type MetaversePresenceMountedOccupancySnapshotInput,
  type MetaversePresenceMountedOccupantRoleId
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  metaversePlayerTraversalIntentLocomotionModeIds,
  type MetaversePlayerTraversalIntentLocomotionModeId,
  metaverseRealtimePlayerTraversalActionKindIds,
  type MetaverseRealtimePlayerTraversalActionKindId,
  type MetaverseRealtimeWorldClientCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseAuthoritativeWorldRuntimeOwner } from "../types/metaverse-authoritative-world-runtime-owner.js";

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

function readStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  return value;
}

function readNumberField(value: unknown, fieldName: string): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric field: ${fieldName}`);
  }

  return value;
}

function readBooleanField(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean field: ${fieldName}`);
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

function resolveObserverPlayerId(rawPlayerId: string | null) {
  if (rawPlayerId === null) {
    return undefined;
  }

  const playerId = createMetaversePlayerId(rawPlayerId);

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return playerId;
}

function resolvePlayerId(rawPlayerId: string) {
  const playerId = createMetaversePlayerId(rawPlayerId);

  if (playerId === null) {
    throw new Error("Invalid playerId.");
  }

  return playerId;
}

function isMetaverseWorldSnapshotPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 2 &&
    segments[0] === "metaverse" &&
    segments[1] === "world"
  );
}

function isMetaverseWorldCommandPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 3 &&
    segments[0] === "metaverse" &&
    segments[1] === "world" &&
    segments[2] === "commands"
  );
}

function parseWorldMountedOccupancy(
  rawMountedOccupancy: unknown,
  allowUndefined: boolean
): MetaversePresenceMountedOccupancySnapshotInput | null | undefined {
  if (rawMountedOccupancy === undefined) {
    return allowUndefined ? undefined : null;
  }

  if (rawMountedOccupancy === null) {
    return null;
  }

  const mountedOccupancy = readRecordField(
    rawMountedOccupancy,
    "mountedOccupancy"
  );

  if (
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
  };
}

function parseWorldTraversalIntent(intentBody: Record<string, unknown>) {
  const locomotionMode =
    intentBody.locomotionMode === undefined
      ? undefined
      : readStringField(intentBody.locomotionMode, "locomotionMode");

  if (
    locomotionMode !== undefined &&
    !metaversePlayerTraversalIntentLocomotionModeIds.includes(
      locomotionMode as MetaversePlayerTraversalIntentLocomotionModeId
    )
  ) {
    throw new Error(`Unsupported locomotionMode: ${locomotionMode}`);
  }

  return {
    ...(intentBody.inputSequence === undefined
      ? {}
      : {
          inputSequence: readNumberField(
            intentBody.inputSequence,
            "intent.inputSequence"
          )
        }),
    ...(locomotionMode === undefined
      ? {}
      : {
          locomotionMode:
            locomotionMode as MetaversePlayerTraversalIntentLocomotionModeId
        }),
    ...(intentBody.orientationSequence === undefined
      ? {}
      : {
          orientationSequence: readNumberField(
            intentBody.orientationSequence,
            "intent.orientationSequence"
          )
        }),
    ...(intentBody.bodyControl === undefined
      ? {}
      : {
          bodyControl: parseWorldTraversalBodyControl(
            intentBody.bodyControl,
            "intent.bodyControl"
          )
        }),
    ...(intentBody.facing === undefined
      ? {}
      : {
          facing: parseWorldLookIntent(
            readRecordField(intentBody.facing, "intent.facing")
          )
        }),
    ...(intentBody.actionIntent === undefined
      ? {}
      : {
          actionIntent: parseWorldTraversalActionIntent(
            intentBody.actionIntent,
            "intent.actionIntent"
          )
        })
  };
}

function parseWorldTraversalBodyControl(
  bodyControlBody: unknown,
  fieldName: string
) {
  if (
    typeof bodyControlBody !== "object" ||
    bodyControlBody === null ||
    Array.isArray(bodyControlBody)
  ) {
    throw new Error(`${fieldName} must be an object.`);
  }

  const bodyControl = bodyControlBody as Record<string, unknown>;

  return {
    ...(bodyControl.boost === undefined
      ? {}
      : {
          boost: readBooleanField(bodyControl.boost, `${fieldName}.boost`)
        }),
    ...(bodyControl.moveAxis === undefined
      ? {}
      : {
          moveAxis: readNumberField(bodyControl.moveAxis, `${fieldName}.moveAxis`)
        }),
    ...(bodyControl.strafeAxis === undefined
      ? {}
      : {
          strafeAxis: readNumberField(
            bodyControl.strafeAxis,
            `${fieldName}.strafeAxis`
          )
        }),
    ...(bodyControl.turnAxis === undefined
      ? {}
      : {
          turnAxis: readNumberField(bodyControl.turnAxis, `${fieldName}.turnAxis`)
        })
  };
}

function parseWorldTraversalActionIntent(
  actionIntentBody: unknown,
  fieldName: string
) {
  if (
    typeof actionIntentBody !== "object" ||
    actionIntentBody === null ||
    Array.isArray(actionIntentBody)
  ) {
    throw new Error(`${fieldName} must be an object.`);
  }

  const actionIntent = actionIntentBody as Record<string, unknown>;
  const actionKind =
    actionIntent.kind === undefined
      ? undefined
      : readStringField(actionIntent.kind, `${fieldName}.kind`);

  if (
    actionKind !== undefined &&
    !metaverseRealtimePlayerTraversalActionKindIds.includes(actionKind as never)
  ) {
    throw new Error(`Unsupported ${fieldName}.kind: ${actionKind}`);
  }

  return {
    ...(actionKind === undefined
      ? {}
      : { kind: actionKind as MetaverseRealtimePlayerTraversalActionKindId }),
    ...(actionIntent.pressed === undefined
      ? {}
      : {
          pressed: readBooleanField(actionIntent.pressed, `${fieldName}.pressed`)
        }),
    ...(actionIntent.sequence === undefined
      ? {}
      : {
          sequence: readNumberField(actionIntent.sequence, `${fieldName}.sequence`)
        })
  };
}

function parseWorldLookIntent(lookIntentBody: Record<string, unknown>) {
  return {
    ...(lookIntentBody.pitchRadians === undefined
      ? {}
      : {
          pitchRadians: readNumberField(
            lookIntentBody.pitchRadians,
            "lookIntent.pitchRadians"
          )
        }),
    ...(lookIntentBody.yawRadians === undefined
      ? {}
      : {
          yawRadians: readNumberField(
            lookIntentBody.yawRadians,
            "lookIntent.yawRadians"
          )
        })
  };
}

function parseWorldCommand(
  body: unknown
): MetaverseRealtimeWorldClientCommand {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body.");
  }

  const commandType = readStringField(body.type, "type");

  switch (commandType) {
    case "sync-mounted-occupancy":
      return createMetaverseSyncMountedOccupancyCommand({
        mountedOccupancy: parseWorldMountedOccupancy(
          body.mountedOccupancy,
          false
        ) ?? null,
        playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
      });
    case "sync-player-traversal-intent":
      return createMetaverseSyncPlayerTraversalIntentCommand({
        intent: parseWorldTraversalIntent(readRecordField(body.intent, "intent")),
        playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
      });
    case "sync-player-look-intent":
      return createMetaverseSyncPlayerLookIntentCommand({
        lookIntent: parseWorldLookIntent(
          readRecordField(body.lookIntent, "lookIntent")
        ),
        ...(body.lookSequence === undefined
          ? {}
          : {
              lookSequence: readNumberField(body.lookSequence, "lookSequence")
            }),
        playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
      });
    case "sync-driver-vehicle-control": {
      const controlIntentBody = readRecordField(body.controlIntent, "controlIntent");

      return createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: readBooleanField(
            controlIntentBody.boost,
            "controlIntent.boost"
          ),
          environmentAssetId: readStringField(
            controlIntentBody.environmentAssetId,
            "controlIntent.environmentAssetId"
          ),
          moveAxis: readNumberField(
            controlIntentBody.moveAxis,
            "controlIntent.moveAxis"
          ),
          strafeAxis: readNumberField(
            controlIntentBody.strafeAxis,
            "controlIntent.strafeAxis"
          ),
          yawAxis: readNumberField(
            controlIntentBody.yawAxis,
            "controlIntent.yawAxis"
          )
        },
        controlSequence: readNumberField(
          body.controlSequence,
          "controlSequence"
        ),
        playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
      });
    }
    default:
      throw new Error(
        `Unsupported metaverse realtime world command type: ${commandType}`
      );
  }
}

export class MetaverseWorldHttpAdapter {
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;

  constructor(runtime: MetaverseAuthoritativeWorldRuntimeOwner) {
    this.#runtime = runtime;
  }

  async handleRequest(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    requestUrl: URL,
    nowMs: number
  ): Promise<boolean> {
    if (
      !isMetaverseWorldSnapshotPath(requestUrl.pathname) &&
      !isMetaverseWorldCommandPath(requestUrl.pathname)
    ) {
      return false;
    }

    try {
      if (isMetaverseWorldSnapshotPath(requestUrl.pathname)) {
        if (request.method !== "GET") {
          writeJson(response, 405, {
            error: "Method not allowed."
          });
          return true;
        }

        writeJson(
          response,
          200,
          this.#runtime.readWorldEvent(
            nowMs,
            resolveObserverPlayerId(requestUrl.searchParams.get("playerId"))
          )
        );
        return true;
      }

      if (request.method !== "POST") {
        writeJson(response, 405, {
          error: "Method not allowed."
        });
        return true;
      }

      writeJson(
        response,
        200,
        this.#runtime.acceptWorldCommand(
          parseWorldCommand(await readJsonBody(request)),
          nowMs
        )
      );
    } catch (error) {
      writeJson(response, isUnknownPlayerError(error) ? 409 : 400, {
        error:
          error instanceof Error
            ? error.message
            : "Metaverse world request failed."
      });
    }

    return true;
  }
}
