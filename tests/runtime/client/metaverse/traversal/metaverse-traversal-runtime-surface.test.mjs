import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { authoredWaterBayOpenWaterSpawn } from "../../../metaverse-authored-world-test-fixtures.mjs";
import {
  createTraversalFixtureContext,
  freezeVector3,
  translateSyntheticWaterBayVector3
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

const forwardTravelInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 1,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 0
});

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime does not eject vertically across shipped shoreline support seams", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createShippedTraversalHarness();

  try {
    traversalRuntime.boot();

    let sawSwim = false;

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);

      if (traversalRuntime.locomotionMode === "swim") {
        sawSwim = true;
        continue;
      }

      if (sawSwim) {
        break;
      }
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");

    let maximumVerticalDeltaMeters = 0;
    let previousY = traversalRuntime.cameraSnapshot.position.y;

    for (let frame = 0; frame < 36; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
      maximumVerticalDeltaMeters = Math.max(
        maximumVerticalDeltaMeters,
        Math.abs(traversalRuntime.cameraSnapshot.position.y - previousY)
      );
      previousY = traversalRuntime.cameraSnapshot.position.y;
      assert.equal(traversalRuntime.locomotionMode, "grounded");
    }

    assert.ok(maximumVerticalDeltaMeters < 0.18);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime exits swim onto low step-eligible support and holds grounded after entry", async () => {
  const { config, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, -0.02, 18)
          )
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    for (let frame = 0; frame < 20; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "swim");

    for (let frame = 0; frame < 180; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);

      if (traversalRuntime.locomotionMode === "grounded") {
        break;
      }
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(
      traversalRuntime.cameraSnapshot.position.y >
        config.ocean.height + config.swim.cameraEyeHeightMeters
    );

    for (let frame = 0; frame < 12; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          ...forwardTravelInput,
          moveAxis: 0
        }),
        1 / 60
      );
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps low authored support walkable while grounded autostep is locally gated", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.1, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 24)
        }),
        Object.freeze({
          halfExtents: freezeVector3(3, 0.17, 2),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0.08, 20)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "grounded");

    for (let frame = 0; frame < 36; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(groundedBodyRuntime.snapshot.position.y > 0.2);
    assert.ok(groundedBodyRuntime.snapshot.position.z < 21.9);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps tall support blocked while grounded without jump assistance", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.1, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 24)
        }),
        Object.freeze({
          halfExtents: freezeVector3(3, 0.46, 2),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 20)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "grounded");

    for (let frame = 0; frame < 36; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(groundedBodyRuntime.snapshot.position.y < 0.12);
    assert.ok(groundedBodyRuntime.snapshot.position.z > 22);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime lands on reachable tall support when jump carry clears the lip", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.1, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 24)
        }),
        Object.freeze({
          halfExtents: freezeVector3(3, 0.46, 2),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 20)
        })
      ]
    });

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    let landedOnTallSupport = false;

    for (let frame = 0; frame < 96; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          ...forwardTravelInput,
          jump: frame === 0
        }),
        1 / 60
      );

      landedOnTallSupport ||=
        traversalRuntime.locomotionMode === "grounded" &&
        groundedBodyRuntime.snapshot.grounded &&
        groundedBodyRuntime.snapshot.position.y > 0.4 &&
        groundedBodyRuntime.snapshot.position.z < 22;

      if (landedOnTallSupport) {
        break;
      }
    }

    assert.equal(landedOnTallSupport, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime still exits swim when a blocker sits off the dock entry line", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, -0.02, 18)
          )
        }),
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0.68, 0, 18)
          )
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);

      if (traversalRuntime.locomotionMode === "grounded") {
        break;
      }
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime blocks swim exit when blocker-affordance shoreline overlap sits on the path", async () => {
  const dockHarness =
    await fixtureContext.createOpenWaterTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, -0.02, 18)
          )
        })
      ]
    });
  const blockedHarness =
    await fixtureContext.createOpenWaterTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, -0.02, 18)
          )
        }),
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, 0, 21.7)
          )
        })
      ]
    });

  try {
    dockHarness.traversalRuntime.boot();
    blockedHarness.traversalRuntime.boot();

    assert.equal(dockHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(blockedHarness.traversalRuntime.locomotionMode, "swim");

    const dockExitFrame = fixtureContext.resolveGroundedEntryFrame(
      dockHarness.traversalRuntime
    );
    const blockedExitFrame = fixtureContext.resolveGroundedEntryFrame(
      blockedHarness.traversalRuntime
    );

    assert.notEqual(dockExitFrame, null);
    assert.equal(blockedExitFrame, null);
    assert.equal(blockedHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      (blockedHarness.traversalRuntime.characterPresentationSnapshot?.position.z ??
        0) > authoredWaterBayOpenWaterSpawn.z - 1.9
    );
  } finally {
    dockHarness.groundedBodyRuntime.dispose();
    blockedHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps swim mode and collides against low blocker-affordance water objects", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.45, 0.12, 0.45),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, 0.02, 18)
          )
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(fixtureContext.resolveGroundedEntryFrame(traversalRuntime), null);
    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.ok(
      (traversalRuntime.characterPresentationSnapshot?.position.z ?? 0) >
        authoredWaterBayOpenWaterSpawn.z - 5.25
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps tall waterborne support in swim mode when it exceeds step height", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: translateSyntheticWaterBayVector3(
            freezeVector3(0, 0, 18)
          )
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    let enteredGrounded = false;

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
      enteredGrounded ||= traversalRuntime.locomotionMode === "grounded";
    }

    assert.equal(enteredGrounded, false);
    assert.equal(traversalRuntime.locomotionMode, "swim");
  } finally {
    groundedBodyRuntime.dispose();
  }
});
