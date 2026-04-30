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
  traversalSequence = 0
}) {
  return Object.freeze({
    groundedBody: null,
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
    traversalSequence
  });
}

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory prefers a unique exact traversal sample id before time fallback", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const olderSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 401,
    localWallClockMs: 4_000,
    positionX: 1,
    traversalSequence: 17
  });
  const exactSampleIdMatch = createPredictedLocalReconciliationSample({
    localPredictionTick: 402,
    localWallClockMs: 4_016,
    positionX: 2,
    traversalSequence: 18
  });
  const newerSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 403,
    localWallClockMs: 4_032,
    positionX: 3,
    traversalSequence: 19
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newerSample, exactSampleIdMatch, olderSample],
      {
        authoritativeSnapshotAgeMs: 8,
        authoritativeTraversalSampleId: 18,
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

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory uses authoritative time inside a repeated ack bucket", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const oldestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 101,
    localWallClockMs: 1_000,
    positionX: 1,
    traversalSequence: 22
  });
  const coincidentalTickSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 102,
    localWallClockMs: 1_016,
    positionX: 2,
    traversalSequence: 22
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 103,
    localWallClockMs: 1_032,
    positionX: 3,
    traversalSequence: 22
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newestSample, coincidentalTickSample, oldestSample],
      {
        authoritativeSnapshotAgeMs: 31,
        authoritativeTraversalSampleId: 22,
        receivedAtWallClockMs: 1_035
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

test("resolvePredictedLocalReconciliationSampleFromMatchingHistory uses authoritative time inside a repeated traversal sequence bucket", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromMatchingHistory
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const oldestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 111,
    localWallClockMs: 1_100,
    positionX: 1,
    traversalSequence: 24
  });
  const expectedTimeMatchedSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 112,
    localWallClockMs: 1_116,
    positionX: 2,
    traversalSequence: 24
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 113,
    localWallClockMs: 1_132,
    positionX: 3,
    traversalSequence: 24
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromMatchingHistory(
      [newestSample, expectedTimeMatchedSample, oldestSample],
      {
        authoritativeSnapshotAgeMs: 14,
        authoritativeTraversalSampleId: 24,
        receivedAtWallClockMs: 1_132
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, expectedTimeMatchedSample);
  assert.equal(
    matchedSample.selectionReason,
    "latest-at-or-before-authoritative-time"
  );
  assert.equal(matchedSample.timeDeltaMs, -2);
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

test("resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor binds the first repeated sequence ack to the oldest local sample", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const oldestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 101,
    localWallClockMs: 1_000,
    positionX: 1,
    traversalSequence: 31
  });
  const middleSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 102,
    localWallClockMs: 1_033,
    positionX: 2,
    traversalSequence: 31
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 103,
    localWallClockMs: 1_066,
    positionX: 3,
    traversalSequence: 31
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor(
      [newestSample, middleSample, oldestSample],
      {
        authoritativeSnapshotAgeMs: 0,
        authoritativeTick: 50,
        lastProcessedTraversalSequence: 31,
        previousCursor: null,
        receivedAtWallClockMs: 1_066
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, oldestSample);
  assert.equal(matchedSample.selectionReason, "authoritative-tick-cursor");
  assert.equal(matchedSample.timeDeltaMs, null);
});

test("resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor advances through repeated sequence samples by authoritative tick", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const firstSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 101,
    localWallClockMs: 1_000,
    positionX: 1,
    traversalSequence: 32
  });
  const skippedSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 102,
    localWallClockMs: 1_033,
    positionX: 2,
    traversalSequence: 32
  });
  const expectedSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 103,
    localWallClockMs: 1_066,
    positionX: 3,
    traversalSequence: 32
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 104,
    localWallClockMs: 1_099,
    positionX: 4,
    traversalSequence: 32
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor(
      [newestSample, expectedSample, skippedSample, firstSample],
      {
        authoritativeSnapshotAgeMs: 0,
        authoritativeTick: 52,
        lastProcessedTraversalSequence: 32,
        previousCursor: {
          authoritativeTick: 50,
          localPredictionTick: 101,
          traversalSequence: 32
        },
        receivedAtWallClockMs: 1_099
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, expectedSample);
  assert.equal(matchedSample.selectionReason, "authoritative-tick-cursor");
});

test("resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor resets to oldest sample on a new traversal sequence", async () => {
  const {
    resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor
  } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-unmounted-traversal-motion-state.ts"
  );
  const oldestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 201,
    localWallClockMs: 2_000,
    positionX: 1,
    traversalSequence: 34
  });
  const newestSample = createPredictedLocalReconciliationSample({
    localPredictionTick: 202,
    localWallClockMs: 2_033,
    positionX: 2,
    traversalSequence: 34
  });

  const matchedSample =
    resolvePredictedLocalReconciliationSampleFromAuthoritativeTickCursor(
      [newestSample, oldestSample],
      {
        authoritativeSnapshotAgeMs: 0,
        authoritativeTick: 60,
        lastProcessedTraversalSequence: 34,
        previousCursor: {
          authoritativeTick: 59,
          localPredictionTick: 109,
          traversalSequence: 33
        },
        receivedAtWallClockMs: 2_033
      }
    );

  assert.notEqual(matchedSample, null);
  assert.equal(matchedSample.sample, oldestSample);
  assert.equal(matchedSample.selectionReason, "authoritative-tick-cursor");
});
