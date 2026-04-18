import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createFlatGroundSurfaceColliderSnapshot,
  createTraversalFixtureContext
} from "./fixtures/traversal-test-fixtures.mjs";

const idleInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 0,
  pitchAxis: 0,
  strafeAxis: 0,
  yawAxis: 0
});

const forwardTravelInput = Object.freeze({
  boost: false,
  moveAxis: 1,
  pitchAxis: 0,
  yawAxis: 0
});

let fixtureContext;

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime derives startup support telemetry from the grounded spawn owner instead of the camera spawn", async () => {
  const { groundedSpawnPosition, traversalRuntime } =
    await fixtureContext.createGroundedSpawnOwnedTraversalHarness();

  assert.equal(
    traversalRuntime.surfaceRoutingLocalTelemetrySnapshot.resolvedSupportHeightMeters,
    groundedSpawnPosition.y
  );

  traversalRuntime.reset();

  assert.equal(
    traversalRuntime.surfaceRoutingLocalTelemetrySnapshot.resolvedSupportHeightMeters,
    groundedSpawnPosition.y
  );
});

test("MetaverseTraversalRuntime stays grounded at the canonical floor spawn while idle outside authored water regions", async () => {
  const { groundedSpawnPosition, traversalRuntime } =
    await fixtureContext.createGroundedSpawnOwnedTraversalHarness();

  traversalRuntime.boot();

  for (let frame = 0; frame < 20; frame += 1) {
    traversalRuntime.advance(idleInput, 1 / 60);
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(
      traversalRuntime.surfaceRoutingLocalTelemetrySnapshot.decisionReason,
      "capability-maintained"
    );
    assert.equal(
      traversalRuntime.surfaceRoutingLocalTelemetrySnapshot.resolvedSupportHeightMeters,
      groundedSpawnPosition.y
    );
  }
});

test("MetaverseTraversalRuntime resolves grounded support from local surface colliders", async () => {
  const { config, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(
      traversalRuntime.cameraSnapshot.position.y >
        config.groundedBody.eyeHeightMeters
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime anchors the grounded first-person camera at capsule eye height", async () => {
  const metaverseRuntimeConfig =
    await fixtureContext.loadMetaverseRuntimeConfig();
  const { config, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      config: {
        camera: {
          ...metaverseRuntimeConfig.camera,
          initialYawRadians: 0
        }
      },
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.advance(forwardTravelInput, 1 / 60);

    assert.ok(
      config.bodyPresentation.groundedFirstPersonForwardOffsetMeters > 0.04
    );
    assert.ok(
      Math.abs(
        traversalRuntime.cameraSnapshot.position.x -
          groundedBodyRuntime.snapshot.position.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        traversalRuntime.cameraSnapshot.position.y -
          (groundedBodyRuntime.snapshot.position.y +
            groundedBodyRuntime.snapshot.eyeHeightMeters)
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        traversalRuntime.cameraSnapshot.position.z -
          (groundedBodyRuntime.snapshot.position.z -
            config.bodyPresentation.groundedFirstPersonForwardOffsetMeters)
      ) < 0.000001
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.position.z <
        groundedBodyRuntime.snapshot.position.z
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});
