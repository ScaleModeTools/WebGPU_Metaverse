import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaversePlayerId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  FakeMetaverseWorldClient,
  createRealtimeWorldSnapshot
} from "../../metaverse-runtime-test-fixtures.mjs";

let clientLoader;

class FakeAuthoritativeServerClock {
  #clockOffsetEstimateMs = 0;
  #lastObservedServerTimeMs = null;

  observeServerTime(serverTimeMs, localWallClockMs) {
    if (
      this.#lastObservedServerTimeMs !== null &&
      serverTimeMs <= this.#lastObservedServerTimeMs
    ) {
      return;
    }

    this.#lastObservedServerTimeMs = serverTimeMs;
    this.#clockOffsetEstimateMs = serverTimeMs - localWallClockMs;
  }

  readEstimatedServerTimeMs(localWallClockMs) {
    return localWallClockMs + this.#clockOffsetEstimateMs;
  }
}

async function createAuthoritativeSnapshotHarness({
  latestPlayerInputSequence = 0,
  latestPlayerLookSequence = 0,
  latestPlayerTraversalOrientationSequence = 0,
  localPlayerId,
  readWallClockMs,
  worldSnapshots
}) {
  const { MetaverseRemoteWorldAuthoritativeSnapshotState } =
    await clientLoader.load(
      "/src/metaverse/remote-world/metaverse-remote-world-authoritative-snapshot-state.ts"
    );
  const fakeWorldClient = new FakeMetaverseWorldClient(worldSnapshots);

  fakeWorldClient.latestPlayerInputSequence = latestPlayerInputSequence;
  fakeWorldClient.latestPlayerLookSequence = latestPlayerLookSequence;
  fakeWorldClient.latestPlayerTraversalOrientationSequence =
    latestPlayerTraversalOrientationSequence;

  return {
    authoritativeSnapshotState: new MetaverseRemoteWorldAuthoritativeSnapshotState(
      {
        authoritativeServerClock: new FakeAuthoritativeServerClock(),
        readLatestPlayerInputSequence: () => fakeWorldClient.latestPlayerInputSequence,
        readLatestPlayerTraversalOrientationSequence: () =>
          fakeWorldClient.latestPlayerTraversalOrientationSequence,
        readLocalPlayerId: () => localPlayerId,
        readWallClockMs,
        readWorldSnapshotBuffer: () => fakeWorldClient.worldSnapshotBuffer
      }
    ),
    fakeWorldClient
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState refreshes latest authoritative vehicle lookups when the latest snapshot changes", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 8,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 8,
          yawRadians: 0
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    8
  );

  fakeWorldClient.publishWorldSnapshotBuffer([
    createRealtimeWorldSnapshot({
      currentTick: 11,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 12,
      remoteUsername,
      serverTimeMs: 1_050,
      snapshotSequence: 2,
      vehicleX: 12,
      yawRadians: 0.2
    })
  ]);
  currentWallClockMs = 1_050;

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    12
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState returns the latest authoritative vehicle snapshot only while it remains fresh", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0
        }),
        createRealtimeWorldSnapshot({
          currentTick: 11,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 12,
          remoteUsername,
          serverTimeMs: 1_150,
          snapshotSequence: 2,
          vehicleX: 12,
          yawRadians: 0
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    12
  );

  currentWallClockMs = 1_500;

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    ),
    null
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState preserves the latest authoritative local processed-input ack and freshness gate", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localLastProcessedInputSequence: 4,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0
        }),
        createRealtimeWorldSnapshot({
          currentTick: 11,
          localLastProcessedInputSequence: 6,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 12,
          remoteUsername,
          serverTimeMs: 1_150,
          snapshotSequence: 2,
          vehicleX: 12,
          yawRadians: 0
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedInputSequence,
    6
  );
  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedInputSequence,
    6
  );

  fakeWorldClient.latestPlayerInputSequence = 7;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120),
    null
  );

  currentWallClockMs = 1_500;

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(120),
    null
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState ignores look-sequence drift but waits for traversal orientation ack", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerInputSequence: 6,
      latestPlayerLookSequence: 5,
      latestPlayerTraversalOrientationSequence: 2,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localLastProcessedInputSequence: 6,
          localLastProcessedLookSequence: 4,
          localLastProcessedTraversalOrientationSequence: 1,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0.2
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedLookSequence,
    4
  );
  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120),
    null
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  fakeWorldClient.latestPlayerTraversalOrientationSequence = 1;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedInputSequence,
    6
  );
  assert.notEqual(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  fakeWorldClient.latestPlayerLookSequence = 4;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedLookSequence,
    4
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState keeps acked authoritative local player poses raw for local authority sync", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerInputSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localAnimationVocabulary: "swim",
          localJumpAuthorityState: "none",
          localLastAcceptedJumpActionSequence: 0,
          localLastProcessedInputSequence: 6,
          localLastProcessedJumpActionSequence: 0,
          localLinearVelocity: {
            x: 0,
            y: 0,
            z: -6
          },
          localLocomotionMode: "swim",
          localPlayerId,
          localPlayerY: 0,
          localPlayerZ: 24,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10
        }),
        createRealtimeWorldSnapshot({
          currentTick: 11,
          localAnimationVocabulary: "jump-up",
          localJumpAuthorityState: "rising",
          localLastAcceptedJumpActionSequence: 2,
          localLastProcessedInputSequence: 6,
          localLastProcessedJumpActionSequence: 2,
          localLinearVelocity: {
            x: 0,
            y: 4,
            z: -6
          },
          localLocomotionMode: "grounded",
          localPlayerId,
          localPlayerY: 1.1,
          localPlayerZ: 23.7,
          localUsername,
          remotePlayerId,
          remotePlayerX: 12,
          remoteUsername,
          serverTimeMs: 1_050,
          snapshotSequence: 2,
          vehicleX: 12
        })
      ]
    });

  const ackedLocalPlayerPose =
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(120);

  assert.notEqual(ackedLocalPlayerPose, null);
  assert.equal(ackedLocalPlayerPose.position.z, 23.7);
  assert.equal(ackedLocalPlayerPose.traversalAuthority.currentActionKind, "jump");
  assert.equal(
    ackedLocalPlayerPose.traversalAuthority.currentActionPhase,
    "rising"
  );
  assert.equal(ackedLocalPlayerPose.traversalAuthority.currentActionSequence, 2);
  assert.equal(
    ackedLocalPlayerPose.traversalAuthority.lastConsumedActionSequence,
    2
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState preserves the shared swim body owner on acked local swim authority", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerInputSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localAnimationVocabulary: "swim",
          localLastProcessedInputSequence: 6,
          localLinearVelocity: {
            x: 1,
            y: 0,
            z: -6
          },
          localLocomotionMode: "swim",
          localPlayerId,
          localPlayerX: 4,
          localPlayerY: 0,
          localPlayerZ: 18,
          localYawRadians: 0.25,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0.25
        })
      ]
    });

  const ackedLocalPlayerPose =
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(120);

  assert.notEqual(ackedLocalPlayerPose, null);
  assert.deepEqual(ackedLocalPlayerPose.swimBody?.linearVelocity, {
    x: 1,
    y: 0,
    z: -6
  });
  assert.deepEqual(ackedLocalPlayerPose.swimBody?.position, {
    x: 4,
    y: 0,
    z: 18
  });
  assert.equal(ackedLocalPlayerPose.swimBody?.yawRadians, 0.25);
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState reads acked grounded yaw from the active body owner", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerInputSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localGroundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
            grounded: true,
            linearVelocity: {
              x: 2,
              y: 0,
              z: -1
            },
            position: {
              x: 6,
              y: 0.25,
              z: 22
            },
            yawRadians: 0.75
          }),
          localLastProcessedInputSequence: 6,
          localLinearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          localLocomotionMode: "grounded",
          localPlayerId,
          localPlayerX: 4,
          localPlayerY: 0,
          localPlayerZ: 18,
          localYawRadians: 0.25,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10
        })
      ]
    });

  const ackedLocalPlayerPose =
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(120);

  assert.notEqual(ackedLocalPlayerPose, null);
  assert.deepEqual(ackedLocalPlayerPose.position, {
    x: 6,
    y: 0.25,
    z: 22
  });
  assert.deepEqual(ackedLocalPlayerPose.linearVelocity, {
    x: 2,
    y: 0,
    z: -1
  });
  assert.equal(ackedLocalPlayerPose.yawRadians, 0.75);
  assert.equal(ackedLocalPlayerPose.groundedBody.yawRadians, 0.75);
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState consumes each fresh acked authoritative local player pose once even when unchanged raw authority is republished", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const initialWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localAnimationVocabulary: "idle",
    localJumpAuthorityState: "grounded",
    localLastAcceptedJumpActionSequence: 0,
    localLastProcessedInputSequence: 6,
    localLastProcessedJumpActionSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });
  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerInputSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [initialWorldSnapshot]
    });

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  const unchangedLocalPlayerWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 12,
    localAnimationVocabulary: "idle",
    localJumpAuthorityState: "grounded",
    localLastAcceptedJumpActionSequence: 0,
    localLastProcessedInputSequence: 6,
    localLastProcessedJumpActionSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 15,
    remoteUsername,
    serverTimeMs: 1_080,
    snapshotSequence: 2,
    vehicleX: 15
  });

  fakeWorldClient.publishWorldSnapshotBuffer([
    initialWorldSnapshot,
    unchangedLocalPlayerWorldSnapshot
  ]);
  currentWallClockMs = 1_080;

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  const movedLocalPlayerWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 13,
    localAnimationVocabulary: "idle",
    localJumpAuthorityState: "grounded",
    localLastAcceptedJumpActionSequence: 0,
    localLastProcessedInputSequence: 6,
    localLastProcessedJumpActionSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.4,
    localUsername,
    remotePlayerId,
    remotePlayerX: 16,
    remoteUsername,
    serverTimeMs: 1_110,
    snapshotSequence: 3,
    vehicleX: 16
  });

  fakeWorldClient.publishWorldSnapshotBuffer([
    unchangedLocalPlayerWorldSnapshot,
    movedLocalPlayerWorldSnapshot
  ]);
  currentWallClockMs = 1_110;

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.4
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState does not redeliver local authority for body-state-only changes", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;
  const bodyPosition = {
    x: 0,
    y: 0.6,
    z: 23.7
  };

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const initialWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localGroundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
      grounded: true,
      linearVelocity: {
        x: 0,
        y: 0,
        z: -6
      },
      position: bodyPosition,
      yawRadians: 0
    }),
    localJumpAuthorityState: "grounded",
    localLastProcessedInputSequence: 6,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });
  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerInputSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [initialWorldSnapshot]
    });

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );

  const bodyStateOnlyWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localGroundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
      contact: {
        blockedPlanarMovement: true,
        blockedVerticalMovement: false,
        supportingContactDetected: true
      },
      grounded: true,
      interaction: {
        applyImpulsesToDynamicBodies: true
      },
      linearVelocity: {
        x: 0,
        y: 0,
        z: -6
      },
      position: bodyPosition,
      yawRadians: 0
    }),
    localJumpAuthorityState: "grounded",
    localLastProcessedInputSequence: 6,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });

  fakeWorldClient.publishWorldSnapshotBuffer([bodyStateOnlyWorldSnapshot]);

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );
});
