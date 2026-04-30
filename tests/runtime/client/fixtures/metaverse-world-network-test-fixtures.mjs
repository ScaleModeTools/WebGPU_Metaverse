import assert from "node:assert/strict";

import {
  createMetaverseRealtimeWorldEvent,
  createMetaverseSyncPlayerTraversalIntentCommand as createRawMetaverseSyncPlayerTraversalIntentCommand,
  createMetaverseVehicleId
} from "@webgpu-metaverse/shared";

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function createManualTimerScheduler() {
  const clearedHandles = new Set();
  const scheduledTasks = [];
  let nextHandle = 1;

  return Object.freeze({
    clearTimeout(handle) {
      clearedHandles.add(handle);
    },
    get clearedCount() {
      return clearedHandles.size;
    },
    get pendingTasks() {
      return scheduledTasks.filter((task) => !clearedHandles.has(task.handle));
    },
    runNext(delay) {
      const taskIndex = scheduledTasks.findIndex(
        (task) =>
          !clearedHandles.has(task.handle) &&
          (delay === undefined || task.delay === delay)
      );

      assert.notEqual(taskIndex, -1);

      const [task] = scheduledTasks.splice(taskIndex, 1);

      assert.notEqual(task, undefined);
      clearedHandles.add(task.handle);
      task.callback();
    },
    setTimeout(callback, delay) {
      const handle = nextHandle;

      nextHandle += 1;
      scheduledTasks.push({
        callback,
        delay,
        handle
      });

      return handle;
    }
  });
}

function createTraversalIntentInput(input) {
  if ("bodyControl" in input || "actionIntent" in input) {
    return {
      ...input,
      facing: input.facing ?? {
        pitchRadians: input.pitchRadians ?? 0,
        yawRadians:
          input.bodyYawRadians ??
          input.lookYawRadians ??
          input.yawRadians ??
          0
      }
    };
  }

  return {
    actionIntent: {
      kind:
        input.jump === true || (input.jumpActionSequence ?? 0) > 0
          ? "jump"
          : "none",
      pressed: input.jump === true,
      ...(input.jumpActionSequence === undefined
        ? {}
        : { sequence: input.jumpActionSequence })
    },
    bodyControl: {
      boost: input.boost,
      moveAxis: input.moveAxis,
      strafeAxis: input.strafeAxis,
      turnAxis: input.yawAxis ?? 0
    },
    facing: {
      pitchRadians: input.pitchRadians ?? 0,
      yawRadians:
        input.bodyYawRadians ??
        input.lookYawRadians ??
        input.yawRadians ??
        0
    },
    locomotionMode: input.locomotionMode ?? "grounded",
    sequence: input.sequence
  };
}

function createMetaverseSyncPlayerTraversalIntentCommand(input) {
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
        kind:
          nextIntent.jump === true || (nextIntent.jumpActionSequence ?? 0) > 0
            ? "jump"
            : "none",
        pressed: nextIntent.jump === true,
        ...(nextIntent.jumpActionSequence === undefined
          ? {}
          : { sequence: nextIntent.jumpActionSequence })
      },
      bodyControl: {
        boost: nextIntent.boost,
        moveAxis: nextIntent.moveAxis,
        strafeAxis: nextIntent.strafeAxis,
        turnAxis: nextIntent.yawAxis ?? 0
      },
      facing: normalizedFacing,
      locomotionMode: nextIntent.locomotionMode ?? "grounded",
      sequence: nextIntent.sequence
    }
  });
}

function createDefaultVehicleSnapshot({ vehicleX = 8 } = {}) {
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(vehicleId, null);

  return Object.freeze({
    angularVelocityRadiansPerSecond: 0,
    environmentAssetId: "metaverse-hub-skiff-v1",
    linearVelocity: Object.freeze({
      x: 0.5,
      y: 0,
      z: 0
    }),
    position: Object.freeze({
      x: vehicleX,
      y: 0.4,
      z: 12
    }),
    seats: Object.freeze([]),
    vehicleId,
    yawRadians: 0
  });
}

function createWorldEvent({
  combatMatch = null,
  authoritativeJumpActionSequence = 0,
  currentTick,
  groundedBody = Object.freeze({
    linearVelocity: Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    position: Object.freeze({
      x: 0,
      y: 1.62,
      z: 24
    }),
    yawRadians: 0
  }),
  includeDefaultVehicle = true,
  highestProcessedPlayerActionSequence = null,
  lastProcessedCombatActionSequence = 0,
  lastProcessedTraversalSequence,
  lastProcessedLookSequence = 0,
  lastProcessedWeaponSequence = 0,
  latestCombatActionReceipt = null,
  locomotionMode = "grounded",
  mountedOccupancy = undefined,
  playerCombat = null,
  playerCharacterId = "mesh2motion-humanoid-v1",
  playerId,
  playerStateSequence,
  recentPlayerActionReceipts = null,
  teamId = "red",
  serverTimeMs,
  snapshotSequence,
  tickIntervalMs = 50,
  username = "Harbor Pilot",
  vehicleX = 8,
  vehicles = null
}) {
  const resolvedLastProcessedTraversalSequence =
    lastProcessedTraversalSequence ?? snapshotSequence;
  const resolvedPlayerStateSequence = playerStateSequence ?? snapshotSequence;
  const resolvedVehicles =
    vehicles ??
    (includeDefaultVehicle
      ? Object.freeze([createDefaultVehicleSnapshot({ vehicleX })])
      : Object.freeze([]));

  return createMetaverseRealtimeWorldEvent({
    world: {
      ...(combatMatch === null
        ? {}
        : {
            combatMatch
          }),
    observerPlayer: {
      highestProcessedPlayerActionSequence:
          highestProcessedPlayerActionSequence ??
          lastProcessedCombatActionSequence,
        lastProcessedTraversalSequence: resolvedLastProcessedTraversalSequence,
        lastProcessedLookSequence,
        lastProcessedWeaponSequence,
        recentPlayerActionReceipts:
          recentPlayerActionReceipts ??
          (latestCombatActionReceipt === null
            ? []
            : [latestCombatActionReceipt]),
        playerId
      },
      players: [
        {
          characterId: playerCharacterId,
          ...(playerCombat === null
            ? {}
            : {
                combat: playerCombat
              }),
          groundedBody,
          locomotionMode,
          ...(mountedOccupancy === undefined
            ? {}
            : {
                mountedOccupancy
              }),
          playerId,
          teamId,
          ...(authoritativeJumpActionSequence > 0
            ? {
                traversalAuthority: {
                  lastConsumedActionKind: "jump",
                  lastConsumedActionSequence: authoritativeJumpActionSequence
                }
              }
            : {}),
          stateSequence: resolvedPlayerStateSequence,
          username
        }
      ],
      snapshotSequence,
      tick: {
        currentTick,
        serverTimeMs,
        tickIntervalMs
      },
      vehicles: resolvedVehicles
    }
  });
}

function readLocalPlayerSnapshot(worldEvent) {
  return Object.freeze({
    ...worldEvent.world.observerPlayer,
    traversalAuthority: worldEvent.world.players[0]?.traversalAuthority
  });
}

function createConnectedStatusSnapshot(
  playerId,
  connected = true,
  overrides = {}
) {
  return Object.freeze({
    connected,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId,
    state: connected ? "connected" : "connecting",
    ...overrides
  });
}

export {
  createConnectedStatusSnapshot,
  createManualTimerScheduler,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createTraversalIntentInput,
  createWorldEvent,
  flushAsyncWork,
  readLocalPlayerSnapshot
};
