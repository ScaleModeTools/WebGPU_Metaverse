import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createRealtimeWorldSnapshot } from "../../metaverse-runtime-test-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

async function createPresentationState() {
  const [{ MetaverseRemoteWorldPresentationState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/remote-world/metaverse-remote-world-presentation-state.ts"
      ),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);

  return new MetaverseRemoteWorldPresentationState(metaverseRuntimeConfig);
}

function createSampledFrame({
  alpha = 0,
  baseSnapshot,
  extrapolationSeconds = 0,
  nextSnapshot = null
}) {
  return Object.freeze({
    alpha,
    baseSnapshot,
    extrapolationSeconds,
    nextSnapshot
  });
}

test("MetaverseRemoteWorldPresentationState interpolates remote character, vehicle, and environment-body presentation from authoritative samples", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const baseSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    environmentBodyX: 4,
    environmentBodyYawRadians: -0.2,
    includeEnvironmentBody: true,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: -0.3,
    remoteLookYawRadians: 0.2,
    remotePlayerAngularVelocityRadiansPerSecond: 1,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleX: 8,
    yawRadians: 0
  });
  const nextSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    environmentBodyX: 7,
    environmentBodyYawRadians: 0.2,
    includeEnvironmentBody: true,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: 0.1,
    remoteLookYawRadians: 0.6,
    remotePlayerId,
    remotePlayerX: 11,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 2,
    vehicleX: 11,
    yawRadians: 0.2
  });

  const extrapolationMs = presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    remoteCharacterRootFrame: createSampledFrame({
      alpha: 1,
      baseSnapshot,
      nextSnapshot
    }),
    sampledFrame: createSampledFrame({
      alpha: 0.5,
      baseSnapshot,
      nextSnapshot
    })
  });

  assert.equal(extrapolationMs, 0);
  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.poseSyncMode,
    "runtime-server-sampled"
  );
  assert.ok(
    Math.abs(
      presentationState.remoteCharacterPresentations[0]?.presentation.position.x -
        11
    ) < 0.000001
  );
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.pitchRadians ?? 0) +
        0.1
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.yawRadians ?? 0) -
        0.4
    ) < 0.000001
  );
  assert.equal(presentationState.remoteVehiclePresentations.length, 1);
  assert.ok(
    Math.abs(
      presentationState.remoteVehiclePresentations[0]?.position.x - 9.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      presentationState.remoteVehiclePresentations[0]?.yawRadians - 0.1
    ) < 0.000001
  );
  assert.equal(presentationState.remoteEnvironmentBodyPresentations.length, 1);
  assert.ok(
    Math.abs(
      presentationState.remoteEnvironmentBodyPresentations[0]?.position.x - 5.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      presentationState.remoteEnvironmentBodyPresentations[0]?.yawRadians
    ) < 0.000001
  );
});

test("MetaverseRemoteWorldPresentationState keeps remote character root on freshest authority while sampled look stays smoothed", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const latestSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: -0.25,
    remoteLookYawRadians: 0.4,
    remotePlayerAngularVelocityRadiansPerSecond: 1,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.06,
    localPlayerId,
    remoteCharacterRootFrame: createSampledFrame({
      baseSnapshot: latestSnapshot
    }),
    sampledFrame: createSampledFrame({
      baseSnapshot: latestSnapshot,
      extrapolationSeconds: 0.06
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation.position.x,
    8
  );
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.look.pitchRadians,
    -0.25
  );
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.look.yawRadians,
    0.4
  );
});

test("MetaverseRemoteWorldPresentationState derives remote grounded walk pose from authoritative observed traversal input", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-dock-runner-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Dock Runner");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const idleSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLinearVelocity: {
      x: 0.1,
      y: 0,
      z: 0
    },
    remoteLocomotionMode: "grounded",
    remoteObservedMoveAxis: 0,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: idleSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "idle"
  );

  const walkSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLinearVelocity: {
      x: 0.1,
      y: 0,
      z: 0
    },
    remoteLocomotionMode: "grounded",
    remoteObservedMoveAxis: 1,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 2,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: walkSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "walk"
  );
});

test("MetaverseRemoteWorldPresentationState orients unmounted remote character presentation from authoritative observed facing", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-lookout-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Lookout");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const facingSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLinearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    remoteLocomotionMode: "grounded",
    remoteLookPitchRadians: 0,
    remoteLookYawRadians: 0,
    remoteObservedFacingPitchRadians: -0.35,
    remoteObservedFacingYawRadians: Math.PI * 0.5,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: facingSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.presentation
        .yawRadians ?? 0) -
        Math.PI * 0.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.pitchRadians ?? 0) +
        0.35
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.yawRadians ?? 0) -
        Math.PI * 0.5
    ) < 0.000001
  );
  assert.ok(presentationState.remoteCharacterPresentations[0]?.aimCamera);
});

test("MetaverseRemoteWorldPresentationState derives remote jump presentation from authoritative jump state", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const risingSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        animationVocabulary: "idle",
        characterId: "metaverse-mannequin-v1",
        jumpAuthorityState: "grounded",
        linearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        username: localUsername,
        yawRadians: 0
      },
      {
        animationVocabulary: "idle",
        characterId: "metaverse-mannequin-v1",
        jumpDebug: {
          resolvedActionSequence: 2,
          resolvedActionState: "accepted"
        },
        jumpAuthorityState: "rising",
        linearVelocity: {
          x: 0,
          y: 3.4,
          z: 0
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        position: {
          x: 8,
          y: 0.7,
          z: 18
        },
        username: remoteUsername,
        yawRadians: 0
      }
    ],
    snapshotSequence: 2,
    tick: {
      currentTick: 11,
      serverTimeMs: 1_050,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: risingSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "jump-up"
  );
  assert.ok(
    (presentationState.remoteCharacterPresentations[0]?.presentation.position.y ??
      0) > 0.45
  );
});

test("MetaverseRemoteWorldPresentationState reuses owner snapshots and drops stale remote entities across samples", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: createRealtimeWorldSnapshot({
        currentTick: 10,
        environmentBodyX: 4,
        includeEnvironmentBody: true,
        localPlayerId,
        localUsername,
        remotePlayerAngularVelocityRadiansPerSecond: 1,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: 1_000,
        snapshotSequence: 1,
        vehicleX: 8,
        yawRadians: 0
      })
    })
  });

  const initialCharacterPresentations =
    presentationState.remoteCharacterPresentations;
  const initialVehiclePresentations =
    presentationState.remoteVehiclePresentations;
  const initialEnvironmentBodyPresentations =
    presentationState.remoteEnvironmentBodyPresentations;
  const initialCharacterPresentation =
    initialCharacterPresentations[0] ?? null;
  const initialCharacterPosition =
    initialCharacterPresentation?.presentation.position ?? null;
  const initialVehiclePresentation =
    initialVehiclePresentations[0] ?? null;
  const initialVehiclePosition =
    initialVehiclePresentation?.position ?? null;
  const initialEnvironmentBodyPresentation =
    initialEnvironmentBodyPresentations[0] ?? null;
  const initialEnvironmentBodyPosition =
    initialEnvironmentBodyPresentation?.position ?? null;

  assert.notEqual(initialCharacterPresentation, null);
  assert.notEqual(initialCharacterPosition, null);
  assert.notEqual(initialVehiclePresentation, null);
  assert.notEqual(initialVehiclePosition, null);
  assert.notEqual(initialEnvironmentBodyPresentation, null);
  assert.notEqual(initialEnvironmentBodyPosition, null);

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.06,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: createRealtimeWorldSnapshot({
        currentTick: 11,
        environmentBodyX: 4,
        includeEnvironmentBody: true,
        localPlayerId,
        localUsername,
        remotePlayerAngularVelocityRadiansPerSecond: 1,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: 1_060,
        snapshotSequence: 2,
        vehicleX: 8,
        yawRadians: 0
      }),
      extrapolationSeconds: 0.06
    })
  });

  assert.strictEqual(
    presentationState.remoteCharacterPresentations,
    initialCharacterPresentations
  );
  assert.strictEqual(
    presentationState.remoteCharacterPresentations[0],
    initialCharacterPresentation
  );
  assert.strictEqual(
    presentationState.remoteCharacterPresentations[0]?.presentation.position,
    initialCharacterPosition
  );
  assert.strictEqual(
    presentationState.remoteVehiclePresentations,
    initialVehiclePresentations
  );
  assert.strictEqual(
    presentationState.remoteVehiclePresentations[0],
    initialVehiclePresentation
  );
  assert.strictEqual(
    presentationState.remoteVehiclePresentations[0]?.position,
    initialVehiclePosition
  );
  assert.strictEqual(
    presentationState.remoteEnvironmentBodyPresentations,
    initialEnvironmentBodyPresentations
  );
  assert.strictEqual(
    presentationState.remoteEnvironmentBodyPresentations[0],
    initialEnvironmentBodyPresentation
  );
  assert.strictEqual(
    presentationState.remoteEnvironmentBodyPresentations[0]?.position,
    initialEnvironmentBodyPosition
  );

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: createRealtimeWorldSnapshot({
        currentTick: 12,
        includeEnvironmentBody: false,
        includeRemotePlayer: false,
        includeVehicle: false,
        localPlayerId,
        localUsername,
        remotePlayerId,
        remotePlayerX: 11,
        remoteUsername,
        serverTimeMs: 1_100,
        snapshotSequence: 3,
        vehicleX: 11
      })
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 0);
  assert.equal(presentationState.remoteVehiclePresentations.length, 0);
  assert.equal(presentationState.remoteEnvironmentBodyPresentations.length, 0);
});
