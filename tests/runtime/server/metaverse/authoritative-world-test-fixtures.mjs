import assert from "node:assert/strict";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseSyncPlayerTraversalIntentCommand as createRawMetaverseSyncPlayerTraversalIntentCommand,
  createMilliseconds,
  metaverseWorldGroundedSpawnPosition
} from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { MetaverseAuthoritativeWorldRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import {
  authoredGroundedSpawnYawRadians
} from "../../metaverse-authored-world-test-fixtures.mjs";

export const shippedGroundedSpawnSupportHeightMeters =
  metaverseWorldGroundedSpawnPosition.y;

export function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

export function readPlayerActiveBodySnapshot(playerSnapshot) {
  return readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    requireValue(playerSnapshot, "playerSnapshot")
  );
}

export function readPrimaryPlayerActiveBodySnapshot(worldSnapshot) {
  return readPlayerActiveBodySnapshot(worldSnapshot.players[0]);
}

export function createAuthoritativeRuntime(launchVariationId = null) {
  return new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  }, undefined, launchVariationId);
}

export function joinSurfacePlayer(runtime, playerId, username, poseOverrides = {}) {
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: shippedGroundedSpawnSupportHeightMeters,
          z: metaverseWorldGroundedSpawnPosition.z
        },
        stateSequence: 1,
        yawRadians: authoredGroundedSpawnYawRadians,
        ...poseOverrides
      },
      username
    }),
    0
  );
}

export function createMetaverseSyncPlayerTraversalIntentCommand(input) {
  const nextIntent = input.intent;
  const normalizedFacing =
    nextIntent.facing ?? {
      pitchRadians: nextIntent.pitchRadians ?? 0,
      yawRadians:
        nextIntent.bodyYawRadians ??
        nextIntent.lookYawRadians ??
        nextIntent.yawRadians ??
        0
    };

  if ("bodyControl" in nextIntent || "actionIntent" in nextIntent) {
    return createRawMetaverseSyncPlayerTraversalIntentCommand({
      ...input,
      intent: {
        ...nextIntent,
        facing: normalizedFacing
      }
    });
  }

  return createRawMetaverseSyncPlayerTraversalIntentCommand({
    ...input,
    intent: {
      actionIntent: {
        kind: nextIntent.jump === true ? "jump" : "none",
        pressed: nextIntent.jump === true,
        ...(nextIntent.jumpActionSequence === undefined
          ? {}
          : { sequence: nextIntent.jumpActionSequence })
      },
      bodyControl: {
        boost: nextIntent.boost,
        moveAxis: nextIntent.moveAxis,
        strafeAxis: nextIntent.strafeAxis,
        turnAxis: nextIntent.yawAxis
      },
      facing: normalizedFacing,
      locomotionMode: nextIntent.locomotionMode,
      sequence: nextIntent.sequence
    }
  });
}
