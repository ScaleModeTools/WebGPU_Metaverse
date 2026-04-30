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
  createMetaverseRoomId,
  metaverseWeaponSlotIds,
  type MetaverseWeaponSlotId
} from "@webgpu-metaverse/shared";
import {
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerWeaponStateCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  metaversePlayerTraversalIntentLocomotionModeIds,
  type MetaversePlayerTraversalIntentLocomotionModeId,
  metaverseRealtimePlayerWeaponAimModeIds,
  type MetaverseRealtimePlayerWeaponAimModeId,
  type MetaverseRealtimePlayerWeaponStateSnapshotInput,
  metaverseRealtimePlayerTraversalActionKindIds,
  type MetaverseRealtimePlayerTraversalActionKindId,
  type MetaverseRealtimeWorldClientCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  createMetaverseIssuePlayerActionCommand
} from "@webgpu-metaverse/shared/metaverse";

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

function readOptionalVector3Field(
  value: unknown,
  fieldName: string
): { readonly x: number; readonly y: number; readonly z: number } | null {
  if (value === undefined || value === null) {
    return null;
  }

  const vector = readRecordField(value, fieldName);

  return {
    x: readNumberField(vector.x, `${fieldName}.x`),
    y: readNumberField(vector.y, `${fieldName}.y`),
    z: readNumberField(vector.z, `${fieldName}.z`)
  };
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

function resolveMetaverseWorldSnapshotRoomId(pathname: string) {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  if (
    segments.length !== 4 ||
    segments[0] !== "metaverse" ||
    segments[1] !== "rooms" ||
    segments[3] !== "world"
  ) {
    return null;
  }

  const roomId = createMetaverseRoomId(segments[2] ?? "");

  if (roomId === null) {
    throw new Error(`Invalid metaverse room id: ${segments[2] ?? ""}`);
  }

  return roomId;
}

function resolveMetaverseWorldCommandRoomId(pathname: string) {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  if (
    segments.length !== 5 ||
    segments[0] !== "metaverse" ||
    segments[1] !== "rooms" ||
    segments[3] !== "world" ||
    segments[4] !== "commands"
  ) {
    return null;
  }

  const roomId = createMetaverseRoomId(segments[2] ?? "");

  if (roomId === null) {
    throw new Error(`Invalid metaverse room id: ${segments[2] ?? ""}`);
  }

  return roomId;
}

function isUnknownRoomError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("Unknown metaverse room:");
}

function isRoomBindingError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.startsWith("Metaverse player ") &&
    error.message.includes(" is not bound to room ")
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
    ...(locomotionMode === undefined
      ? {}
      : {
          locomotionMode:
            locomotionMode as MetaversePlayerTraversalIntentLocomotionModeId
        }),
    ...(intentBody.sequence === undefined
      ? {}
      : {
          sequence: readNumberField(intentBody.sequence, "intent.sequence")
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

function parseWorldTraversalPendingIntentSamples(
  pendingIntentSamplesBody: unknown,
  fieldName: string
) {
  if (!Array.isArray(pendingIntentSamplesBody)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return pendingIntentSamplesBody.map((intentBody, intentIndex) =>
    parseWorldTraversalIntent(
      readRecordField(intentBody, `${fieldName}[${intentIndex}]`)
    )
  );
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

function parseWorldPlayerWeaponState(
  weaponStateBody: unknown
): MetaverseRealtimePlayerWeaponStateSnapshotInput | null {
  if (weaponStateBody === null) {
    return null;
  }

  const weaponState = readRecordField(weaponStateBody, "weaponState");
  const aimMode =
    weaponState.aimMode === undefined
      ? undefined
      : readStringField(weaponState.aimMode, "weaponState.aimMode");

  if (
    aimMode !== undefined &&
    !metaverseRealtimePlayerWeaponAimModeIds.includes(
      aimMode as MetaverseRealtimePlayerWeaponAimModeId
    )
  ) {
    throw new Error(`Unsupported weaponState.aimMode: ${aimMode}`);
  }

  const activeSlotId =
    weaponState.activeSlotId === undefined || weaponState.activeSlotId === null
      ? undefined
      : readStringField(weaponState.activeSlotId, "weaponState.activeSlotId");

  if (
    activeSlotId !== undefined &&
    !metaverseWeaponSlotIds.includes(activeSlotId as MetaverseWeaponSlotId)
  ) {
    throw new Error(`Unsupported weaponState.activeSlotId: ${activeSlotId}`);
  }

  if (!Array.isArray(weaponState.slots)) {
    throw new Error("Expected array field: weaponState.slots");
  }

  if (weaponState.slots.length === 0) {
    throw new Error("weaponState.slots must not be empty.");
  }

  const slots = weaponState.slots.map((slotBody, slotIndex) => {
    const slot = readRecordField(slotBody, `weaponState.slots[${slotIndex}]`);
    const slotId = readStringField(
      slot.slotId,
      `weaponState.slots[${slotIndex}].slotId`
    );

    if (!metaverseWeaponSlotIds.includes(slotId as MetaverseWeaponSlotId)) {
      throw new Error(
        `Unsupported weaponState.slots[${slotIndex}].slotId: ${slotId}`
      );
    }

    return {
      ...(slot.attachmentId === undefined
        ? {}
        : {
            attachmentId: readStringField(
              slot.attachmentId,
              `weaponState.slots[${slotIndex}].attachmentId`
            )
          }),
      ...(slot.equipped === undefined
        ? {}
        : {
            equipped: readBooleanField(
              slot.equipped,
              `weaponState.slots[${slotIndex}].equipped`
            )
          }),
      slotId: slotId as MetaverseWeaponSlotId,
      weaponId: readStringField(
        slot.weaponId,
        `weaponState.slots[${slotIndex}].weaponId`
      ),
      ...(slot.weaponInstanceId === undefined
        ? {}
        : {
            weaponInstanceId: readStringField(
              slot.weaponInstanceId,
              `weaponState.slots[${slotIndex}].weaponInstanceId`
            )
          })
    };
  });

  return {
    ...(activeSlotId === undefined
      ? {}
      : { activeSlotId: activeSlotId as MetaverseWeaponSlotId }),
    ...(aimMode === undefined
      ? {}
      : { aimMode: aimMode as MetaverseRealtimePlayerWeaponAimModeId }),
    slots,
    weaponId: readStringField(weaponState.weaponId, "weaponState.weaponId")
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
    case "issue-player-action": {
      const action = readRecordField(body.action, "action");
      const actionKind = readStringField(action.kind, "action.kind");

      switch (actionKind) {
        case "fire-weapon":
          return createMetaverseIssuePlayerActionCommand({
            action: {
              actionSequence: readNumberField(
                action.actionSequence,
                "action.actionSequence"
              ),
              ...(action.aimMode === undefined
                ? {}
                : {
                    aimMode: readStringField(action.aimMode, "action.aimMode") as
                      | "ads"
                      | "hip-fire"
                  }),
              aimSnapshot: {
                pitchRadians: readNumberField(
                  readRecordField(action.aimSnapshot, "action.aimSnapshot")
                    .pitchRadians,
                  "action.aimSnapshot.pitchRadians"
                ),
                rayForwardWorld: readOptionalVector3Field(
                  readRecordField(action.aimSnapshot, "action.aimSnapshot")
                    .rayForwardWorld,
                  "action.aimSnapshot.rayForwardWorld"
                ),
                rayOriginWorld: readOptionalVector3Field(
                  readRecordField(action.aimSnapshot, "action.aimSnapshot")
                    .rayOriginWorld,
                  "action.aimSnapshot.rayOriginWorld"
                ),
                yawRadians: readNumberField(
                  readRecordField(action.aimSnapshot, "action.aimSnapshot")
                    .yawRadians,
                  "action.aimSnapshot.yawRadians"
                )
              },
              issuedAtAuthoritativeTimeMs: readNumberField(
                action.issuedAtAuthoritativeTimeMs,
                "action.issuedAtAuthoritativeTimeMs"
              ),
              kind: "fire-weapon",
              weaponId: readStringField(action.weaponId, "action.weaponId")
            },
            playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
          });
        case "jump":
          return createMetaverseIssuePlayerActionCommand({
            action: {
              actionSequence: readNumberField(
                action.actionSequence,
                "action.actionSequence"
              ),
              issuedAtAuthoritativeTimeMs: readNumberField(
                action.issuedAtAuthoritativeTimeMs,
                "action.issuedAtAuthoritativeTimeMs"
              ),
              kind: "jump"
            },
            playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
          });
        case "interact-weapon-resource": {
          const requestedActiveSlotId =
            action.requestedActiveSlotId === undefined ||
            action.requestedActiveSlotId === null
              ? null
              : readStringField(
                  action.requestedActiveSlotId,
                  "action.requestedActiveSlotId"
                );

          if (
            requestedActiveSlotId !== null &&
            !metaverseWeaponSlotIds.includes(
              requestedActiveSlotId as MetaverseWeaponSlotId
            )
          ) {
            throw new Error(
              `Unsupported action.requestedActiveSlotId: ${requestedActiveSlotId}`
            );
          }

          return createMetaverseIssuePlayerActionCommand({
            action: {
              actionSequence: readNumberField(
                action.actionSequence,
                "action.actionSequence"
              ),
              ...(action.intendedWeaponInstanceId === undefined ||
              action.intendedWeaponInstanceId === null
                ? {}
                : {
                    intendedWeaponInstanceId: readStringField(
                      action.intendedWeaponInstanceId,
                      "action.intendedWeaponInstanceId"
                    )
                  }),
              issuedAtAuthoritativeTimeMs: readNumberField(
                action.issuedAtAuthoritativeTimeMs,
                "action.issuedAtAuthoritativeTimeMs"
              ),
              kind: "interact-weapon-resource",
              requestedActiveSlotId:
                requestedActiveSlotId as MetaverseWeaponSlotId | null
            },
            playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
          });
        }
        case "switch-active-weapon-slot": {
          const requestedActiveSlotId = readStringField(
            action.requestedActiveSlotId,
            "action.requestedActiveSlotId"
          );

          if (
            !metaverseWeaponSlotIds.includes(
              requestedActiveSlotId as MetaverseWeaponSlotId
            )
          ) {
            throw new Error(
              `Unsupported action.requestedActiveSlotId: ${requestedActiveSlotId}`
            );
          }

          return createMetaverseIssuePlayerActionCommand({
            action: {
              actionSequence: readNumberField(
                action.actionSequence,
                "action.actionSequence"
              ),
              ...(action.intendedWeaponInstanceId === undefined ||
              action.intendedWeaponInstanceId === null
                ? {}
                : {
                    intendedWeaponInstanceId: readStringField(
                      action.intendedWeaponInstanceId,
                      "action.intendedWeaponInstanceId"
                    )
                  }),
              issuedAtAuthoritativeTimeMs: readNumberField(
                action.issuedAtAuthoritativeTimeMs,
                "action.issuedAtAuthoritativeTimeMs"
              ),
              kind: "switch-active-weapon-slot",
              requestedActiveSlotId:
                requestedActiveSlotId as MetaverseWeaponSlotId
            },
            playerId: resolvePlayerId(readStringField(body.playerId, "playerId"))
          });
        }
        default:
          throw new Error(`Unsupported action.kind: ${actionKind}`);
      }
    }
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
        ...(body.pendingIntentSamples === undefined
          ? {}
          : {
              pendingIntentSamples: parseWorldTraversalPendingIntentSamples(
                body.pendingIntentSamples,
                "pendingIntentSamples"
              )
            }),
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
    case "sync-player-weapon-state":
      if (
        body.requestedActiveSlotId !== undefined &&
        body.requestedActiveSlotId !== null &&
        !metaverseWeaponSlotIds.includes(
          readStringField(body.requestedActiveSlotId, "requestedActiveSlotId") as
            MetaverseWeaponSlotId
        )
      ) {
        throw new Error(
          `Unsupported requestedActiveSlotId: ${body.requestedActiveSlotId}`
        );
      }

      return createMetaverseSyncPlayerWeaponStateCommand({
        playerId: resolvePlayerId(readStringField(body.playerId, "playerId")),
        ...(body.requestedActiveSlotId === undefined ||
        body.requestedActiveSlotId === null
          ? {}
          : {
              requestedActiveSlotId: readStringField(
                body.requestedActiveSlotId,
                "requestedActiveSlotId"
              ) as MetaverseWeaponSlotId
            }),
        weaponSequence: readNumberField(body.weaponSequence, "weaponSequence"),
        weaponState: parseWorldPlayerWeaponState(body.weaponState)
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
    const snapshotRoomId = resolveMetaverseWorldSnapshotRoomId(requestUrl.pathname);
    const commandRoomId = resolveMetaverseWorldCommandRoomId(requestUrl.pathname);

    if (snapshotRoomId === null && commandRoomId === null) {
      return false;
    }

    try {
      if (snapshotRoomId !== null) {
        if (request.method !== "GET") {
          writeJson(response, 405, {
            error: "Method not allowed."
          });
          return true;
        }

        writeJson(
          response,
          200,
          this.#roomDirectory.readWorldEvent(
            snapshotRoomId,
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

      if (commandRoomId === null) {
        writeJson(response, 400, {
          error: "Invalid metaverse world command route."
        });
        return true;
      }

      const command = parseWorldCommand(await readJsonBody(request));

      this.#roomDirectory.acceptWorldCommand(commandRoomId, command, nowMs);
      writeJson(
        response,
        200,
        this.#roomDirectory.readWorldEvent(commandRoomId, nowMs, command.playerId)
      );
    } catch (error) {
      writeJson(
        response,
        isUnknownPlayerError(error) ||
          isUnknownRoomError(error) ||
          isRoomBindingError(error)
          ? 409
          : 400,
        {
        error:
          error instanceof Error
            ? error.message
            : "Metaverse world request failed."
        }
      );
    }

    return true;
  }
}
