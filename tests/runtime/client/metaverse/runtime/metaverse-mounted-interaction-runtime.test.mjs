import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createMountedEnvironmentSnapshot({
  entryId = null,
  environmentAssetId = "harbor-skiff",
  occupancyKind = "seat",
  seatId = "driver-seat"
} = {}) {
  return Object.freeze({
    cameraPolicyId: "skiff-follow",
    controlRoutingPolicyId: "driver-only",
    directSeatTargets: Object.freeze([]),
    entryId,
    environmentAssetId,
    label: "Harbor Skiff",
    lookLimitPolicyId: "wide",
    occupancyAnimationId: "seated",
    occupancyKind,
    occupantLabel: "Driver",
    occupantRole: "driver",
    seatId,
    seatTargets: Object.freeze([])
  });
}

test("MetaverseMountedInteractionRuntime boards the focused mountable and syncs canonical mounted occupancy through the world seam", async () => {
  const { MetaverseMountedInteractionRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-mounted-interaction-runtime.ts"
  );
  const callLog = [];
  const mountedEnvironmentSnapshot = createMountedEnvironmentSnapshot({
    entryId: "port-entry",
    occupancyKind: "entry",
    seatId: null
  });
  const traversalRuntime = {
    mountedEnvironmentSnapshot: null,
    boardEnvironment(environmentAssetId, requestedEntryId) {
      callLog.push(`board:${environmentAssetId}:${requestedEntryId}`);
      this.mountedEnvironmentSnapshot = mountedEnvironmentSnapshot;
      return mountedEnvironmentSnapshot;
    },
    leaveMountedEnvironment() {
      callLog.push("leave");
      this.mountedEnvironmentSnapshot = null;
    },
    occupySeat(environmentAssetId, seatId) {
      callLog.push(`seat:${environmentAssetId}:${seatId}`);
      return null;
    }
  };
  const mountedInteractionRuntime = new MetaverseMountedInteractionRuntime({
    authoritativeWorldSync: {
      reset() {
        callLog.push("authority:reset");
      }
    },
    frameLoop: {
      focusedMountable: Object.freeze({
        boardingEntries: Object.freeze([]),
        directSeatTargets: Object.freeze([]),
        distanceFromCamera: 1.25,
        environmentAssetId: "harbor-skiff",
        label: "Harbor Skiff"
      }),
      mountedEnvironment: null
    },
    remoteWorldRuntime: {
      syncMountedOccupancy(nextMountedEnvironment) {
        callLog.push(`sync:${nextMountedEnvironment?.environmentAssetId ?? "none"}`);
        assert.equal(nextMountedEnvironment, mountedEnvironmentSnapshot);
      }
    },
    traversalRuntime
  });

  assert.equal(mountedInteractionRuntime.boardMountable("port-entry"), true);
  assert.deepEqual(callLog, [
    "authority:reset",
    "board:harbor-skiff:port-entry",
    "sync:harbor-skiff"
  ]);
});

test("MetaverseMountedInteractionRuntime resolves seat occupancy against mounted or focused mountables without leaving that routing in the shell runtime", async () => {
  const { MetaverseMountedInteractionRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-mounted-interaction-runtime.ts"
  );
  const callLog = [];
  const mountedEnvironmentSnapshot = createMountedEnvironmentSnapshot();
  const frameLoop = {
    focusedMountable: Object.freeze({
      boardingEntries: Object.freeze([]),
      directSeatTargets: Object.freeze([]),
      distanceFromCamera: 1.25,
      environmentAssetId: "focused-skiff",
      label: "Focused Skiff"
    }),
    mountedEnvironment: createMountedEnvironmentSnapshot({
      environmentAssetId: "mounted-skiff"
    })
  };
  const traversalRuntime = {
    mountedEnvironmentSnapshot,
    boardEnvironment() {
      callLog.push("board");
      return null;
    },
    leaveMountedEnvironment() {
      callLog.push("leave");
      this.mountedEnvironmentSnapshot = null;
    },
    occupySeat(environmentAssetId, seatId) {
      callLog.push(`seat:${environmentAssetId}:${seatId}`);
      this.mountedEnvironmentSnapshot = mountedEnvironmentSnapshot;
      return mountedEnvironmentSnapshot;
    }
  };
  const mountedInteractionRuntime = new MetaverseMountedInteractionRuntime({
    authoritativeWorldSync: {
      reset() {
        callLog.push("authority:reset");
      }
    },
    frameLoop,
    remoteWorldRuntime: {
      syncMountedOccupancy(nextMountedEnvironment) {
        callLog.push(`sync:${nextMountedEnvironment?.environmentAssetId ?? "none"}`);
      }
    },
    traversalRuntime
  });

  assert.equal(mountedInteractionRuntime.occupySeat("driver-seat"), true);
  assert.deepEqual(callLog, [
    "authority:reset",
    "seat:mounted-skiff:driver-seat",
    "sync:harbor-skiff"
  ]);

  callLog.length = 0;
  frameLoop.mountedEnvironment = null;

  assert.equal(mountedInteractionRuntime.occupySeat("passenger-seat"), true);
  assert.deepEqual(callLog, [
    "authority:reset",
    "seat:focused-skiff:passenger-seat",
    "sync:harbor-skiff"
  ]);

  callLog.length = 0;
  frameLoop.focusedMountable = null;

  assert.equal(mountedInteractionRuntime.occupySeat("observer-seat"), false);
  assert.deepEqual(callLog, []);
});

test("MetaverseMountedInteractionRuntime toggles between local board and leave without keeping mounted occupancy routing in WebGpuMetaverseRuntime", async () => {
  const { MetaverseMountedInteractionRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-mounted-interaction-runtime.ts"
  );
  const callLog = [];
  const frameLoop = {
    focusedMountable: Object.freeze({
      boardingEntries: Object.freeze([]),
      directSeatTargets: Object.freeze([]),
      distanceFromCamera: 1.25,
      environmentAssetId: "harbor-skiff",
      label: "Harbor Skiff"
    }),
    mountedEnvironment: null
  };
  const boardedSnapshot = createMountedEnvironmentSnapshot({
    entryId: "starboard-entry",
    occupancyKind: "entry",
    seatId: null
  });
  const traversalRuntime = {
    mountedEnvironmentSnapshot: null,
    boardEnvironment(environmentAssetId) {
      callLog.push(`board:${environmentAssetId}`);
      this.mountedEnvironmentSnapshot = boardedSnapshot;
      frameLoop.mountedEnvironment = boardedSnapshot;
      return boardedSnapshot;
    },
    leaveMountedEnvironment() {
      callLog.push("leave");
      this.mountedEnvironmentSnapshot = null;
      frameLoop.mountedEnvironment = null;
    },
    occupySeat(environmentAssetId, seatId) {
      callLog.push(`seat:${environmentAssetId}:${seatId}`);
      return null;
    }
  };
  const mountedInteractionRuntime = new MetaverseMountedInteractionRuntime({
    authoritativeWorldSync: {
      reset() {
        callLog.push("authority:reset");
      }
    },
    frameLoop,
    remoteWorldRuntime: {
      syncMountedOccupancy(nextMountedEnvironment) {
        callLog.push(`sync:${nextMountedEnvironment?.environmentAssetId ?? "none"}`);
      }
    },
    traversalRuntime
  });

  assert.equal(mountedInteractionRuntime.toggleMount(), true);
  assert.deepEqual(callLog, [
    "authority:reset",
    "board:harbor-skiff",
    "sync:harbor-skiff"
  ]);

  callLog.length = 0;

  assert.equal(mountedInteractionRuntime.toggleMount(), true);
  assert.deepEqual(callLog, [
    "authority:reset",
    "leave",
    "sync:none"
  ]);
});
