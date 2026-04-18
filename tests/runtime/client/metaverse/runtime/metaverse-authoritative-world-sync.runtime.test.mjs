import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createMountedSeatOccupancy({
  environmentAssetId = "metaverse-hub-skiff-v1",
  seatId = "driver-seat"
} = {}) {
  return Object.freeze({
    environmentAssetId,
    entryId: null,
    occupancyKind: "seat",
    occupantRole: "driver",
    seatId
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseAuthoritativeWorldSync forwards fresh authoritative local pose without owning traversal action sequence plumbing", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const authoritativeLocalPlayerPose = Object.freeze({
    inputSequence: 17,
    position: Object.freeze({
      x: 4,
      y: 1.6,
      z: -8
    }),
    yawRadians: 0.45
  });
  let syncedAuthoritativePose = null;

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteVehiclePresentations: Object.freeze([]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return authoritativeLocalPlayerPose;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeVehicleSnapshot() {
        return null;
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: null,
      boardEnvironment() {
        throw new Error("boardEnvironment should stay idle for local pose sync.");
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for local pose sync."
        );
      },
      occupySeat() {
        throw new Error("occupySeat should stay idle for local pose sync.");
      },
      syncAuthoritativeLocalPlayerPose(nextAuthoritativeLocalPlayerPose) {
        syncedAuthoritativePose = nextAuthoritativeLocalPlayerPose;
      },
      syncAuthoritativeVehiclePose() {
        throw new Error(
          "syncAuthoritativeVehiclePose should stay idle for local pose sync."
        );
      }
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();

  assert.deepEqual(
    syncedAuthoritativePose,
    authoritativeLocalPlayerPose
  );
});

test("MetaverseAuthoritativeWorldSync reconciles the locally mounted vehicle from fresh authoritative vehicle truth", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const localMountedOccupancy = createMountedSeatOccupancy();
  const authoritativeVehicleSyncCalls = [];

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteVehiclePresentations: Object.freeze([
        Object.freeze({
          environmentAssetId: "metaverse-hub-skiff-v1",
          position: Object.freeze({
            x: 18,
            y: 0.15,
            z: -12
          }),
          yawRadians: 0.1
        }),
        Object.freeze({
          environmentAssetId: "metaverse-hub-skiff-v2",
          position: Object.freeze({
            x: 33,
            y: 0.2,
            z: -4
          }),
          yawRadians: -0.25
        })
      ]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: localMountedOccupancy
        });
      },
      readFreshAuthoritativeVehicleSnapshot(environmentAssetId) {
        if (environmentAssetId !== "metaverse-hub-skiff-v1") {
          return null;
        }

        return Object.freeze({
          linearVelocity: Object.freeze({
            x: 1.5,
            y: 0,
            z: -0.25
          }),
          position: Object.freeze({
            x: 21,
            y: 0.18,
            z: -10
          }),
          yawRadians: 0.42
        });
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: localMountedOccupancy,
      boardEnvironment() {
        throw new Error("boardEnvironment should stay idle for vehicle sync.");
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for vehicle sync."
        );
      },
      occupySeat() {
        throw new Error("occupySeat should stay idle for vehicle sync.");
      },
      syncAuthoritativeLocalPlayerPose() {},
      syncAuthoritativeVehiclePose(environmentAssetId, poseSnapshot) {
        authoritativeVehicleSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      }
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();

  assert.deepEqual(authoritativeVehicleSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v2",
      poseSnapshot: Object.freeze({
        position: Object.freeze({
          x: 33,
          y: 0.2,
          z: -4
        }),
        yawRadians: -0.25
      })
    }),
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v1",
      poseSnapshot: Object.freeze({
        linearVelocity: Object.freeze({
          x: 1.5,
          y: 0,
          z: -0.25
        }),
        position: Object.freeze({
          x: 21,
          y: 0.18,
          z: -10
        }),
        yawRadians: 0.42
      })
    })
  ]);
});

test("MetaverseAuthoritativeWorldSync clears a rejected local mounted seat claim only after the mismatch hold elapses", async () => {
  const [
    { MetaverseAuthoritativeWorldSync },
    { metaverseLocalAuthorityReconciliationConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/metaverse-authoritative-world-sync.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-world-network.ts")
  ]);
  const localMountedOccupancy = createMountedSeatOccupancy();
  let wallClockMs = 1_100;
  let leaveMountedEnvironmentCallCount = 0;

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    readWallClockMs: () => wallClockMs,
    remoteWorldRuntime: {
      remoteVehiclePresentations: Object.freeze([]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeVehicleSnapshot() {
        return null;
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: localMountedOccupancy,
      boardEnvironment() {
        throw new Error(
          "boardEnvironment should stay idle for seat-claim rejection."
        );
      },
      leaveMountedEnvironment() {
        leaveMountedEnvironmentCallCount += 1;
      },
      occupySeat() {
        throw new Error(
          "occupySeat should stay idle for seat-claim rejection."
        );
      },
      syncAuthoritativeLocalPlayerPose() {},
      syncAuthoritativeVehiclePose() {}
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();
  assert.equal(leaveMountedEnvironmentCallCount, 0);

  wallClockMs +=
    metaverseLocalAuthorityReconciliationConfig.mountedOccupancyMismatchHoldMs - 1;
  worldSync.syncAuthoritativeWorldSnapshots();
  assert.equal(leaveMountedEnvironmentCallCount, 0);

  wallClockMs += 1;
  worldSync.syncAuthoritativeWorldSnapshots();
  assert.equal(leaveMountedEnvironmentCallCount, 1);
});
