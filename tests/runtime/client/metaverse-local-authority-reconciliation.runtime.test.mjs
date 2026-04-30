import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createGroundedBodySnapshot(position, yawRadians = 0) {
  return createMetaverseGroundedBodyRuntimeSnapshot({
    grounded: true,
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    position,
    yawRadians
  });
}

function createAuthoritativePlayerSnapshot({
  lastProcessedTraversalSequence,
  position,
  yawRadians
}) {
  return Object.freeze({
    groundedBody: createGroundedBodySnapshot(position, yawRadians),
    groundedSupport: null,
    lastProcessedTraversalSequence,
    look: Object.freeze({
      pitchRadians: 0,
      yawRadians
    }),
    locomotionMode: "grounded",
    mountedOccupancy: null,
    swimBody: null,
    traversalAuthority: createMetaverseTraversalAuthoritySnapshot()
  });
}

function createIssuedTraversalIntentSnapshot(sequence) {
  return Object.freeze({
    actionIntent: Object.freeze({
      kind: "none",
      pressed: false,
      sequence: 0
    }),
    bodyControl: Object.freeze({
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    }),
    facing: Object.freeze({
      pitchRadians: 0,
      yawRadians: 1
    }),
    locomotionMode: "grounded",
    sequence
  });
}

function createSyncInput({
  applyAuthoritativeUnmountedPose,
  authoritativePlayerSnapshot,
  localIssuedTraversalIntentSnapshot,
  localTraversalPose
}) {
  return Object.freeze({
    applyAuthoritativeUnmountedPose,
    authoritativePlayerSnapshot,
    authoritativeSnapshotAgeMs: 0,
    authoritativeSnapshotSequence: 1,
    authoritativeTick: 1,
    createLocalAuthorityPoseCorrectionSnapshot: () => null,
    convergenceMaxPositionStepMeters: 0.2,
    convergenceMaxYawStepRadians: 0.08,
    convergenceSettlePlanarDistanceMeters: 0.05,
    convergenceSettleVerticalDistanceMeters: 0.05,
    convergenceSettleYawRadians: 0.02,
    convergenceStartPlanarDistanceMeters: 0.1,
    convergenceStartVerticalDistanceMeters: 0.1,
    convergenceStartYawRadians: 0.05,
    forceSnap: false,
    localGrounded: true,
    localGroundedBodySnapshot: createGroundedBodySnapshot(
      localTraversalPose.position,
      localTraversalPose.yawRadians
    ),
    localIssuedTraversalIntentSnapshot,
    localSwimBodySnapshot: null,
    localTraversalPose,
    syncAuthoritativeLook: false
  });
}

test("MetaverseLocalAuthorityReconciliationState ignores stale authoritative poses until newer local traversal input is processed", async () => {
  const { MetaverseLocalAuthorityReconciliationState } =
    await clientLoader.load(
      "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
    );
  const reconciliationState = new MetaverseLocalAuthorityReconciliationState();
  const localTraversalPose = Object.freeze({
    linearVelocity: Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    locomotionMode: "grounded",
    position: Object.freeze({
      x: 3,
      y: 1,
      z: 0
    }),
    yawRadians: 1
  });
  const localIssuedTraversalIntentSnapshot =
    createIssuedTraversalIntentSnapshot(2);
  let appliedCorrectionCount = 0;
  const applyAuthoritativeUnmountedPose = () => {
    appliedCorrectionCount += 1;
  };

  const staleCorrectionApplied =
    reconciliationState.syncAuthoritativeLocalPlayerPose(
      createSyncInput({
        applyAuthoritativeUnmountedPose,
        authoritativePlayerSnapshot: createAuthoritativePlayerSnapshot({
          lastProcessedTraversalSequence: 1,
          position: {
            x: 0,
            y: 1,
            z: 0
          },
          yawRadians: 0
        }),
        localIssuedTraversalIntentSnapshot,
        localTraversalPose
      })
    );

  assert.equal(staleCorrectionApplied, false);
  assert.equal(appliedCorrectionCount, 0);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 0);

  const ackedCorrectionApplied =
    reconciliationState.syncAuthoritativeLocalPlayerPose(
      createSyncInput({
        applyAuthoritativeUnmountedPose,
        authoritativePlayerSnapshot: createAuthoritativePlayerSnapshot({
          lastProcessedTraversalSequence: 2,
          position: {
            x: 0,
            y: 1,
            z: 0
          },
          yawRadians: 0
        }),
        localIssuedTraversalIntentSnapshot,
        localTraversalPose
      })
    );

  assert.equal(ackedCorrectionApplied, true);
  assert.equal(appliedCorrectionCount, 1);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 1);
});
