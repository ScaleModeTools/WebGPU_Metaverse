import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseBuilderFloorTileEnvironmentAssetId,
  resolveMetaverseGroundedBodyColliderTranslationSnapshot,
  resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset,
  readMetaverseWorldSurfaceAssetAuthoring,
  resolveMetaverseWorldPlacedSurfaceColliders
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createServerWorkspaceRapierPhysicsAddon } from "../../fixtures/server-workspace-rapier-test-fixtures.mjs";
import { MetaverseAuthoritativeDynamicCuboidBodyRuntime } from "../../../../../server/dist/metaverse/classes/metaverse-authoritative-dynamic-cuboid-body-runtime.js";
import { MetaverseAuthoritativeGroundedBodyRuntime } from "../../../../../server/dist/metaverse/classes/metaverse-authoritative-grounded-body-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../../../../server/dist/metaverse/classes/metaverse-authoritative-rapier-physics-runtime.js";

let clientLoader;

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function assertApprox(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function assertGroundedBodyParity(
  localSnapshot,
  authoritativeSnapshot,
  label,
  tolerances = {}
) {
  const {
    compareBlockedPlanarMovement = true,
    compareBlockedVerticalMovement = true,
    compareLinearVelocity = true,
    linearVelocityTolerance = 0.2,
    positionXTolerance = 0.02,
    positionYTolerance = 0.02,
    positionZTolerance = 0.02,
    verticalSpeedTolerance = 0.2,
    yawTolerance = 0.0001
  } = tolerances;

  assertApprox(
    localSnapshot.position.x,
    authoritativeSnapshot.position.x,
    positionXTolerance,
    `${label} position.x`
  );
  assertApprox(
    localSnapshot.position.y,
    authoritativeSnapshot.position.y,
    positionYTolerance,
    `${label} position.y`
  );
  assertApprox(
    localSnapshot.position.z,
    authoritativeSnapshot.position.z,
    positionZTolerance,
    `${label} position.z`
  );
  if (compareLinearVelocity) {
    assertApprox(
      localSnapshot.linearVelocity.x,
      authoritativeSnapshot.linearVelocity.x,
      linearVelocityTolerance,
      `${label} linearVelocity.x`
    );
    assertApprox(
      localSnapshot.linearVelocity.y,
      authoritativeSnapshot.linearVelocity.y,
      linearVelocityTolerance,
      `${label} linearVelocity.y`
    );
    assertApprox(
      localSnapshot.linearVelocity.z,
      authoritativeSnapshot.linearVelocity.z,
      linearVelocityTolerance,
      `${label} linearVelocity.z`
    );
  }
  assertApprox(
    localSnapshot.yawRadians,
    authoritativeSnapshot.yawRadians,
    yawTolerance,
    `${label} yawRadians`
  );
  assert.equal(
    localSnapshot.contact.supportingContactDetected,
    authoritativeSnapshot.contact.supportingContactDetected,
    `${label} support contact`
  );
  if (compareBlockedPlanarMovement) {
    assert.equal(
      localSnapshot.contact.blockedPlanarMovement,
      authoritativeSnapshot.contact.blockedPlanarMovement,
      `${label} blocked planar movement`
    );
  }
  if (compareBlockedVerticalMovement) {
    assert.equal(
      localSnapshot.contact.blockedVerticalMovement,
      authoritativeSnapshot.contact.blockedVerticalMovement,
      `${label} blocked vertical movement`
    );
  }
  assert.equal(
    localSnapshot.jumpBody.grounded,
    authoritativeSnapshot.jumpBody.grounded,
    `${label} grounded`
  );
  assert.equal(
    localSnapshot.jumpBody.jumpReady,
    authoritativeSnapshot.jumpBody.jumpReady,
    `${label} jumpReady`
  );
  assert.equal(
    localSnapshot.jumpBody.jumpSnapSuppressionActive,
    authoritativeSnapshot.jumpBody.jumpSnapSuppressionActive,
    `${label} jumpSnapSuppressionActive`
  );
  assertApprox(
    localSnapshot.jumpBody.verticalSpeedUnitsPerSecond,
    authoritativeSnapshot.jumpBody.verticalSpeedUnitsPerSecond,
    verticalSpeedTolerance,
    `${label} jump vertical speed`
  );
  assert.equal(
    localSnapshot.driveTarget.boost,
    authoritativeSnapshot.driveTarget.boost,
    `${label} driveTarget.boost`
  );
  assertApprox(
    localSnapshot.driveTarget.moveAxis,
    authoritativeSnapshot.driveTarget.moveAxis,
    0.0001,
    `${label} driveTarget.moveAxis`
  );
  assertApprox(
    localSnapshot.driveTarget.strafeAxis,
    authoritativeSnapshot.driveTarget.strafeAxis,
    0.0001,
    `${label} driveTarget.strafeAxis`
  );
}

function assertDynamicCuboidBodyParity(
  localSnapshot,
  authoritativeSnapshot,
  label,
  tolerances = {}
) {
  const {
    linearVelocityTolerance = 0.000001,
    positionTolerance = 0.000001,
    yawTolerance = 0.000001
  } = tolerances;

  assertApprox(
    localSnapshot.position.x,
    authoritativeSnapshot.position.x,
    positionTolerance,
    `${label} position.x`
  );
  assertApprox(
    localSnapshot.position.y,
    authoritativeSnapshot.position.y,
    positionTolerance,
    `${label} position.y`
  );
  assertApprox(
    localSnapshot.position.z,
    authoritativeSnapshot.position.z,
    positionTolerance,
    `${label} position.z`
  );
  assertApprox(
    localSnapshot.linearVelocity.x,
    authoritativeSnapshot.linearVelocity.x,
    linearVelocityTolerance,
    `${label} linearVelocity.x`
  );
  assertApprox(
    localSnapshot.linearVelocity.y,
    authoritativeSnapshot.linearVelocity.y,
    linearVelocityTolerance,
    `${label} linearVelocity.y`
  );
  assertApprox(
    localSnapshot.linearVelocity.z,
    authoritativeSnapshot.linearVelocity.z,
    linearVelocityTolerance,
    `${label} linearVelocity.z`
  );
  assertApprox(
    localSnapshot.yawRadians,
    authoritativeSnapshot.yawRadians,
    yawTolerance,
    `${label} yawRadians`
  );
}

function createDefaultGroundedBodyConfig(spawnPosition) {
  return Object.freeze({
    accelerationCurveExponent: 1.2,
    accelerationUnitsPerSecondSquared: 18,
    airborneMovementDampingFactor: 0.4,
    baseSpeedUnitsPerSecond: 4.5,
    boostCurveExponent: 1.1,
    boostMultiplier: 1.25,
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.02,
    decelerationUnitsPerSecondSquared: 24,
    dragCurveExponent: 1.45,
    eyeHeightMeters: 1.62,
    gravityUnitsPerSecond: 18,
    jumpGroundContactGraceSeconds: 0.1,
    jumpImpulseUnitsPerSecond: 6.8,
    maxSlopeClimbAngleRadians: Math.PI * 0.26,
    maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
    minSlopeSlideAngleRadians: Math.PI * 0.34,
    snapToGroundDistanceMeters: 0.22,
    spawnPosition,
    stepHeightMeters: 0.28,
    stepWidthMeters: 0.2,
    worldRadius: 10
  });
}

function createSteppedSupportCourseColliders() {
  const builderFloorTileSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaverseBuilderFloorTileEnvironmentAssetId
  );

  assert.notEqual(
    builderFloorTileSurfaceAsset,
    null,
    "builder floor tile surface asset should resolve"
  );

  return Object.freeze(
    [
      freezeVector3(0, -0.5, 28),
      freezeVector3(0, -0.5, 24),
      freezeVector3(0, -0.3, 20),
      freezeVector3(0, -0.1, 16),
      freezeVector3(0, 0.1, 12),
      freezeVector3(0, 0.1, 8),
      freezeVector3(0, 0.1, 4)
    ].flatMap((position) =>
      resolveMetaverseWorldPlacedSurfaceColliders({
        environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
        placements: Object.freeze([
          Object.freeze({
            position,
            rotationYRadians: 0,
            scale: 1
          })
        ]),
        surfaceColliders: builderFloorTileSurfaceAsset.surfaceColliders
      })
    )
  );
}

function createAuthoredDynamicBodyConfig(environmentAssetId) {
  const surfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    environmentAssetId
  );

  assert.notEqual(surfaceAsset, null, `${environmentAssetId} should resolve`);

  const dynamicBodyConfig =
    resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset(
      surfaceAsset
    );

  assert.notEqual(
    dynamicBodyConfig,
    null,
    `${environmentAssetId} should expose one fully authored dynamic-body placement`
  );

  return dynamicBodyConfig;
}

async function createGroundedBodyAuthorityParityHarness({
  config,
  dynamicBodyConfigs = [],
  interactionSnapshot = null,
  initialYawRadians = 0,
  remoteTraversalBlockerRootPositions = [],
  colliders
}) {
  const {
    MetaverseDynamicCuboidBodyRuntime,
    MetaverseGroundedBodyRuntime,
    RapierPhysicsRuntime
  } =
    await clientLoader.load("/src/physics/index.ts");
  const localPhysicsRuntime = new RapierPhysicsRuntime({
    createDebugHelper() {
      return null;
    },
    createPhysicsAddon: createServerWorkspaceRapierPhysicsAddon
  });
  const authoritativePhysicsRuntime =
    new MetaverseAuthoritativeRapierPhysicsRuntime();

  await localPhysicsRuntime.init();

  const localColliderHandles = [];
  const authoritativeColliderHandles = [];

  for (const collider of colliders) {
    localColliderHandles.push(
      localPhysicsRuntime.createFixedCuboidCollider(
        collider.halfExtents,
        collider.translation,
        collider.rotation
      )
    );
    authoritativeColliderHandles.push(
      authoritativePhysicsRuntime.createCuboidCollider(
        collider.halfExtents,
        collider.translation,
        collider.rotation
      )
    );
  }

  for (const blockerRootPosition of remoteTraversalBlockerRootPositions) {
    localColliderHandles.push(
      localPhysicsRuntime.createCapsuleCollider(
        config.capsuleHalfHeightMeters,
        config.capsuleRadiusMeters,
        resolveMetaverseGroundedBodyColliderTranslationSnapshot(
          config,
          blockerRootPosition
        )
      )
    );
  }

  const localGroundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    config,
    localPhysicsRuntime
  );
  const authoritativeGroundedBodyRuntime =
    new MetaverseAuthoritativeGroundedBodyRuntime(
      config,
      authoritativePhysicsRuntime
    );

  if (interactionSnapshot !== null) {
    localGroundedBodyRuntime.syncInteractionSnapshot(interactionSnapshot);
    authoritativeGroundedBodyRuntime.syncInteractionSnapshot(
      interactionSnapshot
    );
  }
  const localDynamicBodyRuntimes = [];
  const authoritativeDynamicBodyRuntimes = [];
  const authoritativeTraversalBlockerRuntimes =
    remoteTraversalBlockerRootPositions.map((blockerRootPosition) =>
      new MetaverseAuthoritativeGroundedBodyRuntime(
        Object.freeze({
          ...config,
          spawnPosition: blockerRootPosition
        }),
        authoritativePhysicsRuntime
      )
    );

  for (const dynamicBodyConfig of dynamicBodyConfigs) {
    const localDynamicBodyRuntime = new MetaverseDynamicCuboidBodyRuntime(
      dynamicBodyConfig,
      localPhysicsRuntime
    );
    const authoritativeDynamicBodyRuntime =
      new MetaverseAuthoritativeDynamicCuboidBodyRuntime(
        dynamicBodyConfig,
        authoritativePhysicsRuntime
      );

    await localDynamicBodyRuntime.init();
    localDynamicBodyRuntime.syncSnapshot();
    authoritativeDynamicBodyRuntime.syncSnapshot();
    localDynamicBodyRuntimes.push(localDynamicBodyRuntime);
    authoritativeDynamicBodyRuntimes.push(authoritativeDynamicBodyRuntime);
  }

  await localGroundedBodyRuntime.init(initialYawRadians);
  localGroundedBodyRuntime.teleport(config.spawnPosition, initialYawRadians);
  authoritativeGroundedBodyRuntime.teleport(
    config.spawnPosition,
    initialYawRadians
  );
  for (const [blockerIndex, authoritativeTraversalBlockerRuntime] of
    authoritativeTraversalBlockerRuntimes.entries()) {
    authoritativeTraversalBlockerRuntime.teleport(
      remoteTraversalBlockerRootPositions[blockerIndex],
      0
    );
  }

  return Object.freeze({
    advance(intentSnapshot, deltaSeconds) {
      localPhysicsRuntime.stepSimulation(deltaSeconds);
      authoritativePhysicsRuntime.stepSimulation(deltaSeconds);

      const localSnapshot = localGroundedBodyRuntime.advance(
        intentSnapshot,
        deltaSeconds
      );
      const authoritativeSnapshot = authoritativeGroundedBodyRuntime.advance(
        intentSnapshot,
        deltaSeconds
      );
      const dynamicBodySnapshots = localDynamicBodyRuntimes.map(
        (localDynamicBodyRuntime, dynamicBodyIndex) =>
          Object.freeze({
            authoritativeSnapshot:
              authoritativeDynamicBodyRuntimes[dynamicBodyIndex]?.syncSnapshot(),
            localSnapshot: localDynamicBodyRuntime.syncSnapshot()
          })
      );

      return Object.freeze({
        authoritativeSnapshot,
        dynamicBodySnapshots,
        localSnapshot
      });
    },
    config,
    dispose() {
      for (const dynamicBodyRuntime of localDynamicBodyRuntimes) {
        dynamicBodyRuntime.dispose();
      }
      localGroundedBodyRuntime.dispose();

      for (const colliderHandle of localColliderHandles) {
        localPhysicsRuntime.removeCollider(colliderHandle);
      }

      for (const dynamicBodyRuntime of authoritativeDynamicBodyRuntimes) {
        dynamicBodyRuntime.dispose();
      }
      for (const authoritativeTraversalBlockerRuntime of authoritativeTraversalBlockerRuntimes) {
        authoritativeTraversalBlockerRuntime.dispose();
      }
      authoritativeGroundedBodyRuntime.dispose();

      for (const colliderHandle of authoritativeColliderHandles) {
        authoritativePhysicsRuntime.removeCollider(colliderHandle);
      }
    }
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("client grounded capsule stays aligned with authoritative grounded body truth through move turn and jump phases", async () => {
  const harness = await createGroundedBodyAuthorityParityHarness({
    colliders: [
      Object.freeze({
        halfExtents: freezeVector3(8, 0.5, 8),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.5, 0)
      })
    ],
    config: createDefaultGroundedBodyConfig(freezeVector3(0, 0, 3))
  });
  let sawAirborneStep = false;

  try {
    const script = [
      Object.freeze({
        deltaSeconds: 1 / 60,
        frames: 18,
        intent: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        })
      }),
      Object.freeze({
        deltaSeconds: 1 / 60,
        frames: 18,
        intent: Object.freeze({
          boost: true,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0.35,
          turnAxis: 0.45
        })
      }),
      Object.freeze({
        deltaSeconds: 1 / 60,
        frames: 1,
        intent: Object.freeze({
          boost: true,
          jump: true,
          moveAxis: 1,
          strafeAxis: 0.35,
          turnAxis: 0.45
        })
      }),
      Object.freeze({
        deltaSeconds: 1 / 60,
        frames: 30,
        intent: Object.freeze({
          boost: true,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0.35,
          turnAxis: 0.45
        })
      })
    ];
    let stepIndex = 0;

    for (const segment of script) {
      for (let frame = 0; frame < segment.frames; frame += 1) {
        const { authoritativeSnapshot, localSnapshot } = harness.advance(
          segment.intent,
          segment.deltaSeconds
        );

        stepIndex += 1;
        sawAirborneStep ||= localSnapshot.grounded === false;
        assertGroundedBodyParity(
          localSnapshot,
          authoritativeSnapshot,
          `script step ${stepIndex}`
        );
      }
    }

    assert.equal(sawAirborneStep, true);
  } finally {
    harness.dispose();
  }
});

test("client grounded capsule climbs the same low step as authoritative body truth", async () => {
  const harness = await createGroundedBodyAuthorityParityHarness({
    colliders: [
      Object.freeze({
        halfExtents: freezeVector3(8, 0.5, 8),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.5, 0)
      }),
      Object.freeze({
        halfExtents: freezeVector3(2.5, 0.17, 2.5),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, 0, 0)
      })
    ],
    config: createDefaultGroundedBodyConfig(freezeVector3(0, 0, 4))
  });

  try {
    let finalLocalSnapshot = null;
    let finalAuthoritativeSnapshot = null;
    let maxPlanarPositionDelta = 0;
    let maxVerticalPositionDelta = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      const steppedSnapshots = harness.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        }),
        1 / 60
      );

      finalLocalSnapshot = steppedSnapshots.localSnapshot;
      finalAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
      maxPlanarPositionDelta = Math.max(
        maxPlanarPositionDelta,
        Math.hypot(
          finalLocalSnapshot.position.x - finalAuthoritativeSnapshot.position.x,
          finalLocalSnapshot.position.z - finalAuthoritativeSnapshot.position.z
        )
      );
      maxVerticalPositionDelta = Math.max(
        maxVerticalPositionDelta,
        Math.abs(
          finalLocalSnapshot.position.y - finalAuthoritativeSnapshot.position.y
        )
      );

      assert.equal(
        finalLocalSnapshot.grounded,
        finalAuthoritativeSnapshot.grounded,
        `step climb frame ${frame + 1} grounded`
      );
      assert.equal(
        finalLocalSnapshot.contact.supportingContactDetected,
        finalAuthoritativeSnapshot.contact.supportingContactDetected,
        `step climb frame ${frame + 1} support contact`
      );
      assertApprox(
        finalLocalSnapshot.yawRadians,
        finalAuthoritativeSnapshot.yawRadians,
        0.0001,
        `step climb frame ${frame + 1} yawRadians`
      );
    }

    assert.notEqual(finalLocalSnapshot, null);
    assert.notEqual(finalAuthoritativeSnapshot, null);
    assert.ok(
      maxPlanarPositionDelta <= 0.135,
      `expected maxPlanarPositionDelta ${maxPlanarPositionDelta} to stay within 0.135`
    );
    assert.ok(
      maxVerticalPositionDelta <= 0.12,
      `expected maxVerticalPositionDelta ${maxVerticalPositionDelta} to stay within 0.12`
    );
    assert.ok(finalLocalSnapshot.position.y > 0.1);
    assert.ok(finalAuthoritativeSnapshot.position.y > 0.1);
    assert.ok(finalLocalSnapshot.position.z < 2.2);
    assert.ok(finalAuthoritativeSnapshot.position.z < 2.2);
  } finally {
    harness.dispose();
  }
});

test("client grounded capsule stops on the same tall blocker boundary as authoritative body truth", async () => {
  const harness = await createGroundedBodyAuthorityParityHarness({
    colliders: [
      Object.freeze({
        halfExtents: freezeVector3(8, 0.5, 8),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.5, 0)
      }),
      Object.freeze({
        halfExtents: freezeVector3(0.46, 0.46, 0.46),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, 0, 0.4)
      })
    ],
    config: createDefaultGroundedBodyConfig(freezeVector3(0, 0, 3))
  });
  let sawLocalBlockedPlanarMovement = false;
  let sawAuthoritativeBlockedPlanarMovement = false;

  try {
    let finalLocalSnapshot = null;
    let finalAuthoritativeSnapshot = null;

    for (let frame = 0; frame < 180; frame += 1) {
      const steppedSnapshots = harness.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        }),
        1 / 60
      );

      finalLocalSnapshot = steppedSnapshots.localSnapshot;
      finalAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
      sawLocalBlockedPlanarMovement ||=
        finalLocalSnapshot.contact.blockedPlanarMovement === true;
      sawAuthoritativeBlockedPlanarMovement ||=
        finalAuthoritativeSnapshot.contact.blockedPlanarMovement === true;
      assertGroundedBodyParity(
        finalLocalSnapshot,
        finalAuthoritativeSnapshot,
        `blocker frame ${frame + 1}`,
        Object.freeze({
          compareBlockedPlanarMovement: false,
          compareBlockedVerticalMovement: false,
          compareLinearVelocity: false,
          linearVelocityTolerance: 0.3,
          positionXTolerance: 0.03,
          positionYTolerance: 0.03,
          positionZTolerance: 0.04,
          verticalSpeedTolerance: 0.3
        })
      );
    }

    assert.notEqual(finalLocalSnapshot, null);
    assert.notEqual(finalAuthoritativeSnapshot, null);
    assert.equal(sawLocalBlockedPlanarMovement, true);
    assert.equal(sawAuthoritativeBlockedPlanarMovement, true);
    assert.ok(finalLocalSnapshot.position.y < 0.05);
    assert.ok(finalAuthoritativeSnapshot.position.y < 0.05);
    assert.ok(finalLocalSnapshot.position.z > 0.7);
    assert.ok(finalAuthoritativeSnapshot.position.z > 0.7);
  } finally {
    harness.dispose();
  }
});

test("client grounded capsule stays aligned with authoritative dynamic-body truth through an authored pushable-crate course", async () => {
  const crateConfig = createAuthoredDynamicBodyConfig(
    metaverseHubPushableCrateEnvironmentAssetId
  );
  const harness = await createGroundedBodyAuthorityParityHarness({
    colliders: [
      Object.freeze({
        halfExtents: freezeVector3(36, 0.3, 41),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, 0.3, 0)
      })
    ],
    config: Object.freeze({
      ...createDefaultGroundedBodyConfig(
        freezeVector3(
          crateConfig.spawnPosition.x,
          0.6,
          crateConfig.spawnPosition.z + 6
        )
      ),
      worldRadius: 40
    }),
    dynamicBodyConfigs: [crateConfig],
    interactionSnapshot: Object.freeze({
      applyImpulsesToDynamicBodies: true
    })
  });
  let finalDynamicBodySnapshots = null;
  let finalLocalSnapshot = null;
  let finalAuthoritativeSnapshot = null;
  let sawCrateMotion = false;

  try {
    for (let frame = 0; frame < 180; frame += 1) {
      const steppedSnapshots = harness.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        }),
        1 / 60
      );

      finalDynamicBodySnapshots = steppedSnapshots.dynamicBodySnapshots;
      finalLocalSnapshot = steppedSnapshots.localSnapshot;
      finalAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
      assertGroundedBodyParity(
        finalLocalSnapshot,
        finalAuthoritativeSnapshot,
        `crate collision frame ${frame + 1}`
      );
      assert.equal(
        finalDynamicBodySnapshots.length,
        1,
        "expected one dynamic body parity snapshot"
      );
      assertDynamicCuboidBodyParity(
        finalDynamicBodySnapshots[0].localSnapshot,
        finalDynamicBodySnapshots[0].authoritativeSnapshot,
        `crate body frame ${frame + 1}`
      );
      sawCrateMotion ||=
        Math.abs(
          finalDynamicBodySnapshots[0].localSnapshot.position.z -
            crateConfig.spawnPosition.z
        ) > 0.01;
    }

    assert.notEqual(finalDynamicBodySnapshots, null);
    assert.notEqual(finalLocalSnapshot, null);
    assert.notEqual(finalAuthoritativeSnapshot, null);
    assert.ok(
      sawCrateMotion,
      "expected authored pushable crate motion once dynamic-body impulses are enabled"
    );
    assert.ok(
      finalLocalSnapshot.position.z < crateConfig.spawnPosition.z - 0.5
    );
    assert.ok(
      finalAuthoritativeSnapshot.position.z < crateConfig.spawnPosition.z - 0.5
    );
  } finally {
    harness.dispose();
  }
});

test("client grounded capsule stays aligned with authoritative remote-player blocker truth", async () => {
  const blockerRootPosition = freezeVector3(0, 0, 0.5);
  const harness = await createGroundedBodyAuthorityParityHarness({
    colliders: [
      Object.freeze({
        halfExtents: freezeVector3(8, 0.5, 8),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.5, 0)
      })
    ],
    config: Object.freeze({
      ...createDefaultGroundedBodyConfig(freezeVector3(0, 0, 5)),
      worldRadius: 20
    }),
    remoteTraversalBlockerRootPositions: [blockerRootPosition]
  });
  let finalLocalSnapshot = null;
  let finalAuthoritativeSnapshot = null;

  try {
    for (let frame = 0; frame < 120; frame += 1) {
      const steppedSnapshots = harness.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        }),
        1 / 60
      );

      finalLocalSnapshot = steppedSnapshots.localSnapshot;
      finalAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
      assertGroundedBodyParity(
        finalLocalSnapshot,
        finalAuthoritativeSnapshot,
        `remote blocker frame ${frame + 1}`
      );
    }

    const requiredRemoteBlockerClearanceMeters =
      harness.config.capsuleRadiusMeters * 2 +
      harness.config.controllerOffsetMeters;

    assert.notEqual(finalLocalSnapshot, null);
    assert.notEqual(finalAuthoritativeSnapshot, null);
    assertApprox(
      finalLocalSnapshot.position.z,
      blockerRootPosition.z + requiredRemoteBlockerClearanceMeters,
      0.05,
      "local remote-player blocker clearance"
    );
    assertApprox(
      finalAuthoritativeSnapshot.position.z,
      blockerRootPosition.z + requiredRemoteBlockerClearanceMeters,
      0.05,
      "authoritative remote-player blocker clearance"
    );
    assert.ok(
      Math.hypot(
        finalLocalSnapshot.linearVelocity.x,
        finalLocalSnapshot.linearVelocity.z
      ) < 0.05
    );
    assert.ok(
      Math.hypot(
        finalAuthoritativeSnapshot.linearVelocity.x,
        finalAuthoritativeSnapshot.linearVelocity.z
      ) < 0.05
    );
  } finally {
    harness.dispose();
  }
});

test("client grounded capsule stays aligned with authoritative remote-player blocker truth under rapid tap-heavy contact", async () => {
  const blockerRootPosition = freezeVector3(0, 0, 0.5);
  const harness = await createGroundedBodyAuthorityParityHarness({
    colliders: [
      Object.freeze({
        halfExtents: freezeVector3(8, 0.5, 8),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.5, 0)
      })
    ],
    config: Object.freeze({
      ...createDefaultGroundedBodyConfig(freezeVector3(0, 0, 5)),
      worldRadius: 20
    }),
    remoteTraversalBlockerRootPositions: [blockerRootPosition]
  });
  let finalLocalSnapshot = null;
  let finalAuthoritativeSnapshot = null;
  let maxLateralSlideMeters = 0;
  let minimumLocalPlanarBlockerDistance = Number.POSITIVE_INFINITY;
  let minimumAuthoritativePlanarBlockerDistance = Number.POSITIVE_INFINITY;
  const tapHeavyContactScript = [
    Object.freeze({
      frames: 22,
      intent: Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      })
    }),
    ...Array.from({ length: 5 }, (_, cycleIndex) =>
      Object.freeze({
        cycleIndex,
        frames: 3,
        intent: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: cycleIndex % 2 === 0 ? -1 : 1,
          turnAxis: cycleIndex % 2 === 0 ? -0.45 : 0.45
        })
      })
    ),
    ...Array.from({ length: 5 }, (_, cycleIndex) =>
      Object.freeze({
        cycleIndex,
        frames: 2,
        intent: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          strafeAxis: cycleIndex % 2 === 0 ? 1 : -1,
          turnAxis: cycleIndex % 2 === 0 ? 0.3 : -0.3
        })
      })
    )
  ];
  let stepIndex = 0;

  try {
    for (const segment of tapHeavyContactScript) {
      for (let frame = 0; frame < segment.frames; frame += 1) {
        const steppedSnapshots = harness.advance(segment.intent, 1 / 60);

        finalLocalSnapshot = steppedSnapshots.localSnapshot;
        finalAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
        maxLateralSlideMeters = Math.max(
          maxLateralSlideMeters,
          Math.abs(finalLocalSnapshot.position.x - blockerRootPosition.x),
          Math.abs(finalAuthoritativeSnapshot.position.x - blockerRootPosition.x)
        );
        minimumLocalPlanarBlockerDistance = Math.min(
          minimumLocalPlanarBlockerDistance,
          Math.hypot(
            finalLocalSnapshot.position.x - blockerRootPosition.x,
            finalLocalSnapshot.position.z - blockerRootPosition.z
          )
        );
        minimumAuthoritativePlanarBlockerDistance = Math.min(
          minimumAuthoritativePlanarBlockerDistance,
          Math.hypot(
            finalAuthoritativeSnapshot.position.x - blockerRootPosition.x,
            finalAuthoritativeSnapshot.position.z - blockerRootPosition.z
          )
        );
        stepIndex += 1;
        assertGroundedBodyParity(
          finalLocalSnapshot,
          finalAuthoritativeSnapshot,
          `remote blocker tap frame ${stepIndex}`,
          Object.freeze({
            compareBlockedPlanarMovement: false,
            linearVelocityTolerance: 0.24,
            positionXTolerance: 0.03,
            positionYTolerance: 0.02,
            positionZTolerance: 0.03
          })
        );
      }
    }

    const requiredRemoteBlockerClearanceMeters =
      harness.config.capsuleRadiusMeters * 2 +
      harness.config.controllerOffsetMeters;

    assert.notEqual(finalLocalSnapshot, null);
    assert.notEqual(finalAuthoritativeSnapshot, null);
    assert.ok(
      maxLateralSlideMeters > 0.15,
      `expected tap-heavy blocker contact to create lateral slide, received ${maxLateralSlideMeters}`
    );
    assert.ok(
      minimumLocalPlanarBlockerDistance >
        requiredRemoteBlockerClearanceMeters - 0.08,
      `expected local blocker contact to keep clearance, received ${minimumLocalPlanarBlockerDistance}`
    );
    assert.ok(
      minimumAuthoritativePlanarBlockerDistance >
        requiredRemoteBlockerClearanceMeters - 0.08,
      `expected authoritative blocker contact to keep clearance, received ${minimumAuthoritativePlanarBlockerDistance}`
    );
  } finally {
    harness.dispose();
  }
});

test("client grounded capsule matches authoritative body truth through the full authored stair ascent and descent course", async () => {
  const stairColliders = createSteppedSupportCourseColliders();
  const ascentConfig = Object.freeze({
    ...createDefaultGroundedBodyConfig(freezeVector3(0, 0, 28)),
    worldRadius: 40
  });
  const descentConfig = Object.freeze({
    ...createDefaultGroundedBodyConfig(freezeVector3(0, 0.6, 8)),
    worldRadius: 40
  });
  const ascentHarness = await createGroundedBodyAuthorityParityHarness({
    colliders: stairColliders,
    config: ascentConfig
  });
  const descentHarness = await createGroundedBodyAuthorityParityHarness({
    colliders: stairColliders,
    config: descentConfig,
    initialYawRadians: Math.PI
  });

  try {
    let ascentLocalSnapshot = null;
    let ascentAuthoritativeSnapshot = null;
    let maxAscentPlanarDelta = 0;
    let maxAscentVerticalDelta = 0;

    for (let frame = 0; frame < 144; frame += 1) {
      const steppedSnapshots = ascentHarness.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        }),
        1 / 60
      );

      ascentLocalSnapshot = steppedSnapshots.localSnapshot;
      ascentAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
      maxAscentPlanarDelta = Math.max(
        maxAscentPlanarDelta,
        Math.hypot(
          ascentLocalSnapshot.position.x - ascentAuthoritativeSnapshot.position.x,
          ascentLocalSnapshot.position.z - ascentAuthoritativeSnapshot.position.z
        )
      );
      maxAscentVerticalDelta = Math.max(
        maxAscentVerticalDelta,
        Math.abs(
          ascentLocalSnapshot.position.y - ascentAuthoritativeSnapshot.position.y
        )
      );
      assertGroundedBodyParity(
        ascentLocalSnapshot,
        ascentAuthoritativeSnapshot,
        `stair ascent frame ${frame + 1}`
      );
    }

    assert.notEqual(ascentLocalSnapshot, null);
    assert.notEqual(ascentAuthoritativeSnapshot, null);
    assert.equal(maxAscentPlanarDelta, 0);
    assert.equal(maxAscentVerticalDelta, 0);
    assert.ok(ascentLocalSnapshot.position.y > 0.35);
    assert.ok(ascentAuthoritativeSnapshot.position.y > 0.35);
    assert.ok(ascentLocalSnapshot.position.z < 18.25);
    assert.ok(ascentAuthoritativeSnapshot.position.z < 18.25);

    let descentLocalSnapshot = null;
    let descentAuthoritativeSnapshot = null;
    let maxDescentPlanarDelta = 0;
    let maxDescentVerticalDelta = 0;

    for (let frame = 0; frame < 144; frame += 1) {
      const steppedSnapshots = descentHarness.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        }),
        1 / 60
      );

      descentLocalSnapshot = steppedSnapshots.localSnapshot;
      descentAuthoritativeSnapshot = steppedSnapshots.authoritativeSnapshot;
      maxDescentPlanarDelta = Math.max(
        maxDescentPlanarDelta,
        Math.hypot(
          descentLocalSnapshot.position.x - descentAuthoritativeSnapshot.position.x,
          descentLocalSnapshot.position.z - descentAuthoritativeSnapshot.position.z
        )
      );
      maxDescentVerticalDelta = Math.max(
        maxDescentVerticalDelta,
        Math.abs(
          descentLocalSnapshot.position.y - descentAuthoritativeSnapshot.position.y
        )
      );
      assertGroundedBodyParity(
        descentLocalSnapshot,
        descentAuthoritativeSnapshot,
        `stair descent frame ${frame + 1}`
      );
    }

    assert.notEqual(descentLocalSnapshot, null);
    assert.notEqual(descentAuthoritativeSnapshot, null);
    assert.equal(maxDescentPlanarDelta, 0);
    assert.equal(maxDescentVerticalDelta, 0);
    assert.ok(descentLocalSnapshot.position.y < 0.45);
    assert.ok(descentAuthoritativeSnapshot.position.y < 0.45);
    assert.ok(descentLocalSnapshot.position.z > 17.5);
    assert.ok(descentAuthoritativeSnapshot.position.z > 17.5);
  } finally {
    ascentHarness.dispose();
    descentHarness.dispose();
  }
});
