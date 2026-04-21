import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createPredictedLocalReconciliationSample({
  localPredictionTick,
  localWallClockMs,
  positionX,
  traversalSampleId = 0
}) {
  return Object.freeze({
    groundedBody: null,
    inputSequence: 8,
    issuedTraversalIntent: null,
    localGrounded: true,
    localPredictionTick,
    localWallClockMs,
    pose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(positionX, 0, 24),
      yawRadians: 0
    }),
    swimBody: null,
    traversalSampleId,
    traversalOrientationSequence: 5
  });
}

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory prefers an exact traversal sample id before tick or time fallback", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const olderSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 401,
    localWallClockMs: 4_000,
    positionX: 1,
    traversalSampleId: 17
  });
  const exactSampleIdMatch = createPredictedLocalReconciliationSample({
    localPredictionTick: 402,
    localWallClockMs: 4_016,
    positionX: 2,
    traversalSampleId: 18
  });
  const newerSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 403,
    localWallClockMs: 4_032,
    positionX: 3,
    traversalSampleId: 19
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newerSample, exactSampleIdMatch, olderSample],
      {
        authoritativeSnapshotAgeMs: 8,
        authoritativeTraversalSampleId: 18,
        authoritativeTick: 999,
        receivedAtWallClockMs: 4_040
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, exactSampleIdMatch);
  assert.equal(matchedSample.selectionReason, "exact-traversal-sample-id");
  assert.equal(matchedSample.timeDeltaMs, null);
});

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory prefers an exact authoritative tick match inside a repeated ack bucket", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const oldestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 101,
    localWallClockMs: 1_000,
    positionX: 1
  });
  const exactTickSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 102,
    localWallClockMs: 1_016,
    positionX: 2
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 103,
    localWallClockMs: 1_032,
    positionX: 3
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newestSample, exactTickSample, oldestSample],
      {
        authoritativeSnapshotAgeMs: 10,
        authoritativeTraversalSampleId: null,
        authoritativeTick: 102,
        receivedAtWallClockMs: 1_040
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, exactTickSample);
  assert.equal(matchedSample.selectionReason, "exact-authoritative-tick");
  assert.equal(matchedSample.timeDeltaMs, null);
});

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory prefers the latest sample at or before the authoritative target time over a nearer future sample", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const oldestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 201,
    localWallClockMs: 2_000,
    positionX: 1
  });
  const futureButNearerSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 202,
    localWallClockMs: 2_016,
    positionX: 2
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 203,
    localWallClockMs: 2_032,
    positionX: 3
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newestSample, futureButNearerSample, oldestSample],
      {
        authoritativeSnapshotAgeMs: 30,
        authoritativeTraversalSampleId: null,
        authoritativeTick: null,
        receivedAtWallClockMs: 2_034
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, oldestSample);
  assert.equal(
    matchedSample.selectionReason,
    "latest-at-or-before-authoritative-time"
  );
  assert.equal(matchedSample.timeDeltaMs, -4);
});

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory falls forward only when every matching sample is newer than the authoritative target time", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const olderFutureSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 301,
    localWallClockMs: 3_000,
    positionX: 1
  });
  const newerFutureSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 302,
    localWallClockMs: 3_016,
    positionX: 2
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newerFutureSample, olderFutureSample],
      {
        authoritativeSnapshotAgeMs: 20,
        authoritativeTraversalSampleId: null,
        authoritativeTick: null,
        receivedAtWallClockMs: 2_990
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, olderFutureSample);
  assert.equal(
    matchedSample.selectionReason,
    "earliest-after-authoritative-time"
  );
  assert.equal(matchedSample.timeDeltaMs, 30);
});
