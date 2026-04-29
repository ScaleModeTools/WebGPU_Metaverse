import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakeHudPublisherDependencies,
  createFakeRenderedCamera,
  createPublishInput
} from "./fixtures/metaverse-runtime-hud-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeHudTelemetryState tracks camera snap and local reconciliation telemetry behind the HUD seam", async () => {
  const { MetaverseRuntimeHudTelemetryState } = await clientLoader.load(
    "/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"
  );
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionDetail =
    Object.freeze({
      authoritativeGrounded: true,
      authoritativeSnapshotAgeMs: 36,
      authoritativeSnapshotSequence: 8,
      authoritativeTick: 16,
      bodyStateDivergence: true,
      convergenceEpisodeStarted: true,
      convergenceEpisodeStartIntentionalDiscontinuityCause:
        "mounted-unboarding",
      convergenceEpisodeStartHistoricalLocalSampleMatched: false,
      convergenceEpisodeStartHistoricalLocalSampleSelectionReason:
        "earliest-after-authoritative-time",
      convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs: 6,
      convergenceEpisodeStartPlanarMagnitudeMeters: 1.2,
      convergenceEpisodeStartReason: "gross-body-divergence",
      convergenceEpisodeStartVerticalMagnitudeMeters: 0.3,
      convergenceEpisodeStartYawMagnitudeRadians: 0.2,
      groundedBodyStateDivergence: true,
      lastProcessedTraversalSequence: 31,
      localGrounded: false,
      planarMagnitudeMeters: 1.2,
      planarVelocityMagnitudeUnitsPerSecond: 2.8,
      verticalMagnitudeMeters: 0.3,
      verticalVelocityMagnitudeUnitsPerSecond: 0.7
    });
  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionSnapshot =
    Object.freeze({
      authoritative: Object.freeze({
        groundedBody: null,
        lastProcessedTraversalSequence: 31,
        linearVelocity: Object.freeze({
          x: 2.4,
          y: 0,
          z: -0.7
        }),
        locomotionMode: "swim",
        position: Object.freeze({
          x: 1.1,
          y: 0.8,
          z: -4.2
        }),
        swimBody: Object.freeze({
          angularVelocityRadiansPerSecond: 0,
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            blockedPlanarMovement: true,
            desiredMovementDelta: Object.freeze({ x: 0, y: 0, z: -0.7 })
          }),
          driveTarget: Object.freeze({
            boost: true,
            moveAxis: 1,
            movementMagnitude: 1,
            strafeAxis: -0.25,
            targetForwardSpeedUnitsPerSecond: 5.8,
            targetPlanarSpeedUnitsPerSecond: 5.98,
            targetStrafeSpeedUnitsPerSecond: -1.45
          }),
          forwardSpeedUnitsPerSecond: 2.4,
          linearVelocity: Object.freeze({
            x: 2.4,
            y: 0,
            z: -0.7
          }),
          planarSpeedUnitsPerSecond: 2.5,
          position: Object.freeze({
            x: 1.1,
            y: 0.8,
            z: -4.2
          }),
          strafeSpeedUnitsPerSecond: -0.3,
          yawRadians: 0.25
        }),
        surfaceRouting: Object.freeze({
          blockingAffordanceDetected: false,
          decisionReason: "capability-transition-validated",
          resolvedSupportHeightMeters: null,
          supportingAffordanceSampleCount: 0
        })
      }),
      local: Object.freeze({
        groundedBody: null,
        issuedTraversalIntent: Object.freeze({
          actionIntent: Object.freeze({
            kind: "none",
            pressed: false,
            sequence: 0
          }),
          bodyControl: Object.freeze({
            boost: true,
            moveAxis: 1,
            strafeAxis: -0.25,
            turnAxis: 0.5
          }),
          sequence: 25,
          locomotionMode: "swim"
        }),
        linearVelocity: Object.freeze({
          x: 2.2,
          y: 0,
          z: -0.5
        }),
        locomotionMode: "grounded",
        position: Object.freeze({
          x: 0.4,
          y: 1.1,
          z: -3.6
        }),
        swimBody: null,
        surfaceRouting: Object.freeze({
          autostepHeightMeters: 0.2,
          blockingAffordanceDetected: false,
          decisionReason: "capability-maintained",
          groundedBody: null,
          locomotionMode: "grounded",
          resolvedSupportHeightMeters: 0.6,
          supportingAffordanceSampleCount: 2,
          traversalAuthority: Object.freeze({
            currentActionKind: "none",
            currentActionPhase: "idle",
            currentActionSequence: 0,
            lastConsumedActionSequence: 0,
            lastRejectedActionReason: "none",
            lastRejectedActionSequence: 0,
            phaseStartedAtTick: 0
          })
        })
      })
    });
  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionReason =
    "gross-body-divergence";
  dependencies.traversalRuntime.lastLocalReconciliationCorrectionSource =
    "local-authority-convergence-episode";
  dependencies.traversalRuntime.localAuthorityPoseCorrectionCount = 1;
  dependencies.traversalRuntime.localReconciliationCorrectionCount = 1;
  renderedCamera.position.x = 0.4;
  nowMs = 250;

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  const telemetrySnapshot = telemetryState.createSnapshot(
    nowMs,
    createPublishInput()
  );

  assert.equal(
    telemetrySnapshot.worldSnapshot.cameraPresentation.renderedSnap.totalCount,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.cameraPresentation.renderedSnap
      .recentCountPast5Seconds,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .recentCorrectionCountPast5Seconds,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .recentLocalAuthorityPoseCorrectionCountPast5Seconds,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation.lastCorrectionSource,
    "local-authority-convergence-episode"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .lastLocalAuthorityPoseCorrectionReason,
    "gross-body-divergence"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "mounted-unboarding"
  );
  assert.deepEqual(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .lastLocalAuthorityPoseCorrectionSnapshot,
    {
      authoritative: {
        groundedBody: null,
        lastProcessedTraversalSequence: 31,
        linearVelocity: {
          x: 2.4,
          y: 0,
          z: -0.7
        },
        locomotionMode: "swim",
        position: {
          x: 1.1,
          y: 0.8,
          z: -4.2
        },
        swimBody: {
          angularVelocityRadiansPerSecond: 0,
          contact: {
            appliedMovementDelta: {
              x: 0,
              y: 0,
              z: 0
            },
            blockedPlanarMovement: true,
            desiredMovementDelta: {
              x: 0,
              y: 0,
              z: -0.7
            }
          },
          driveTarget: {
            boost: true,
            moveAxis: 1,
            movementMagnitude: 1,
            strafeAxis: -0.25,
            targetForwardSpeedUnitsPerSecond: 5.8,
            targetPlanarSpeedUnitsPerSecond: 5.98,
            targetStrafeSpeedUnitsPerSecond: -1.45
          },
          forwardSpeedUnitsPerSecond: 2.4,
          linearVelocity: {
            x: 2.4,
            y: 0,
            z: -0.7
          },
          planarSpeedUnitsPerSecond: 2.5,
          position: {
            x: 1.1,
            y: 0.8,
            z: -4.2
          },
          strafeSpeedUnitsPerSecond: -0.3,
          yawRadians: 0.25
        },
        surfaceRouting: {
          blockingAffordanceDetected: false,
          decisionReason: "capability-transition-validated",
          resolvedSupportHeightMeters: null,
          supportingAffordanceSampleCount: 0
        }
      },
      local: {
        groundedBody: null,
        issuedTraversalIntent: {
          actionIntent: {
            kind: "none",
            pressed: false,
            sequence: 0
          },
          bodyControl: {
            boost: true,
            moveAxis: 1,
            strafeAxis: -0.25,
            turnAxis: 0.5
          },
          sequence: 25,
          locomotionMode: "swim"
        },
        linearVelocity: {
          x: 2.2,
          y: 0,
          z: -0.5
        },
        locomotionMode: "grounded",
        position: {
          x: 0.4,
          y: 1.1,
          z: -3.6
        },
        swimBody: null,
        surfaceRouting: {
          autostepHeightMeters: 0.2,
          blockingAffordanceDetected: false,
          decisionReason: "capability-maintained",
          groundedBody: null,
          locomotionMode: "grounded",
          resolvedSupportHeightMeters: 0.6,
          swimBody: null,
          supportingAffordanceSampleCount: 2,
          traversalAuthority: {
            currentActionKind: "none",
            currentActionPhase: "idle",
            currentActionSequence: 0,
            lastConsumedActionSequence: 0,
            lastRejectedActionReason: "none",
            lastRejectedActionSequence: 0,
            phaseStartedAtTick: 0
          }
        }
      }
    }
  );
  assert.equal(telemetrySnapshot.renderer.drawCallCount, 7);
  assert.equal(telemetrySnapshot.renderer.triangleCount, 42);
  assert.equal(telemetrySnapshot.worldSnapshot.datagramSendFailureCount, 3);
});

test("MetaverseRuntimeHudTelemetryState carries authoritative local-player grounded jump body through HUD telemetry", async () => {
  const [{ MetaverseRuntimeHudTelemetryState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  dependencies.config = metaverseRuntimeConfig;
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () =>
      Object.freeze({
        groundedBody: Object.freeze({
          angularVelocityRadiansPerSecond: 0,
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            blockedPlanarMovement: false,
            blockedVerticalMovement: false,
            desiredMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            supportingContactDetected: false
          }),
          driveTarget: Object.freeze({
            boost: false,
            moveAxis: 0,
            movementMagnitude: 0,
            strafeAxis: 0,
            targetForwardSpeedUnitsPerSecond: 0,
            targetPlanarSpeedUnitsPerSecond: 0,
            targetStrafeSpeedUnitsPerSecond: 0
          }),
          linearVelocity: Object.freeze({
            x: 0,
            y: 4.2,
            z: 0
          }),
          interaction: Object.freeze({
            applyImpulsesToDynamicBodies: false
          }),
          jumpBody: Object.freeze({
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0.12,
            jumpReady: false,
            jumpSnapSuppressionActive: true,
            verticalSpeedUnitsPerSecond: 4.2
          }),
          position: Object.freeze({
            x: 0,
            y: 0.6,
            z: 0
          }),
          yawRadians: 0
        }),
        jumpDebug: Object.freeze({
          pendingActionSequence: 9,
          pendingActionBufferAgeMs: 48,
          resolvedActionSequence: 8,
          resolvedActionState: "accepted"
        }),
        lastProcessedTraversalSequence: 8,
        locomotionMode: "grounded",
        position: Object.freeze({
          x: 0,
          y: 0.6,
          z: 0
        }),
        traversalAuthority: Object.freeze({
          currentActionKind: "jump",
          currentActionPhase: "rising",
          currentActionSequence: 8,
          lastConsumedActionSequence: 8,
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 24
        }),
        yawRadians: 0
      });

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  const telemetrySnapshot = telemetryState.createSnapshot(
    nowMs,
    createPublishInput()
  );

  assert.deepEqual(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .groundedBody?.jumpBody,
    {
      grounded: false,
      jumpGroundContactGraceSecondsRemaining: 0.12,
      jumpReady: false,
      jumpSnapSuppressionActive: true,
      verticalSpeedUnitsPerSecond: 4.2
    }
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .jumpDebug.pendingActionSequence,
    9
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .jumpDebug.resolvedActionState,
    "accepted"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .swimBody,
    null
  );
});

test("MetaverseRuntimeHudTelemetryState resolves authoritative swim telemetry from the shared swim-body owner", async () => {
  const [{ MetaverseRuntimeHudTelemetryState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  dependencies.config = metaverseRuntimeConfig;
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () =>
      Object.freeze({
        groundedBody: Object.freeze({
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            blockedPlanarMovement: false,
            blockedVerticalMovement: false,
            desiredMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            supportingContactDetected: true
          }),
          driveTarget: Object.freeze({
            boost: true,
            moveAxis: 1,
            movementMagnitude: 1,
            strafeAxis: 0,
            targetForwardSpeedUnitsPerSecond: 14.88,
            targetPlanarSpeedUnitsPerSecond: 14.88,
            targetStrafeSpeedUnitsPerSecond: 0
          }),
          interaction: Object.freeze({
            applyImpulsesToDynamicBodies: true
          }),
          jumpBody: Object.freeze({
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0,
            jumpReady: false,
            jumpSnapSuppressionActive: false,
            verticalSpeedUnitsPerSecond: -6.53
          })
        }),
        jumpDebug: Object.freeze({
          pendingActionSequence: 55,
          pendingActionBufferAgeMs: 20,
          resolvedActionSequence: 55,
          resolvedActionState: "accepted"
        }),
        lastProcessedTraversalSequence: 12,
        linearVelocity: Object.freeze({
          x: 9,
          y: 0,
          z: 9
        }),
        locomotionMode: "swim",
        position: Object.freeze({
          x: 99,
          y: 50,
          z: 99
        }),
        swimBody: Object.freeze({
          angularVelocityRadiansPerSecond: 0.2,
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 1, y: 0, z: -3 }),
            blockedPlanarMovement: false,
            desiredMovementDelta: Object.freeze({ x: 1, y: 0, z: -3 })
          }),
          driveTarget: Object.freeze({
            boost: false,
            moveAxis: 0.75,
            movementMagnitude: 0.75,
            strafeAxis: 0.1,
            targetForwardSpeedUnitsPerSecond: 3,
            targetPlanarSpeedUnitsPerSecond: 3.2,
            targetStrafeSpeedUnitsPerSecond: 0.4
          }),
          forwardSpeedUnitsPerSecond: 3,
          linearVelocity: Object.freeze({
            x: 1,
            y: 0,
            z: -3
          }),
          planarSpeedUnitsPerSecond: 3.2,
          position: Object.freeze({
            x: 1,
            y: 0,
            z: -3
          }),
          strafeSpeedUnitsPerSecond: 0.4,
          yawRadians: 0.25
        }),
        traversalAuthority: Object.freeze({
          currentActionKind: "none",
          currentActionPhase: "idle",
          currentActionSequence: 0,
          lastConsumedActionSequence: 0,
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 0
        }),
        yawRadians: 1.2
      });

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  const telemetrySnapshot = telemetryState.createSnapshot(
    nowMs,
    createPublishInput()
  );

  assert.deepEqual(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .swimBody?.position,
    {
      x: 1,
      y: 0,
      z: -3
    }
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .surfaceRouting.decisionReason,
    "capability-maintained"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .groundedBody,
    null
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .jumpDebug.pendingActionSequence,
    null
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .correctionPlanarMagnitudeMeters,
    Math.hypot(1, -3)
  );
});

test("MetaverseRuntimeHudTelemetryState publishes authoritative combat action receipt telemetry from the room snapshot", async () => {
  const [{ MetaverseRuntimeHudTelemetryState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  dependencies.config = metaverseRuntimeConfig;
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () =>
      Object.freeze({
        combat: Object.freeze({
          activeWeapon: Object.freeze({
            ammoInMagazine: 10,
            ammoInReserve: 48,
            reloadRemainingMs: 0,
            weaponId: "metaverse-service-pistol-v2"
          }),
          alive: true,
          assists: 0,
          damageLedger: Object.freeze([]),
          deaths: 0,
          headshotKills: 0,
          health: 100,
          kills: 0,
          maxHealth: 100,
          respawnRemainingMs: 0,
          spawnProtectionRemainingMs: 0,
          weaponStats: Object.freeze([])
        }),
        jumpDebug: Object.freeze({
          pendingActionSequence: 0,
          pendingActionBufferAgeMs: null,
          resolvedActionSequence: 0,
          resolvedActionState: "none"
        }),
        groundedBody: Object.freeze({
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            blockedPlanarMovement: false,
            blockedVerticalMovement: false,
            desiredMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            supportingContactDetected: true
          }),
          driveTarget: Object.freeze({
            boost: false,
            moveAxis: 0,
            movementMagnitude: 0,
            strafeAxis: 0,
            targetForwardSpeedUnitsPerSecond: 0,
            targetPlanarSpeedUnitsPerSecond: 0,
            targetStrafeSpeedUnitsPerSecond: 0
          }),
          interaction: Object.freeze({
            applyImpulsesToDynamicBodies: false
          }),
          jumpBody: Object.freeze({
            grounded: true,
            jumpGroundContactGraceSecondsRemaining: 0,
            jumpReady: true,
            jumpSnapSuppressionActive: false,
            verticalSpeedUnitsPerSecond: 0
          }),
          linearVelocity: Object.freeze({
            x: 0,
            y: 0,
            z: 0
          }),
          position: Object.freeze({
            x: 0,
            y: 1.62,
            z: 0
          }),
          yawRadians: 0
        }),
        lastProcessedTraversalSequence: 12,
        highestProcessedPlayerActionSequence: 8,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        position: Object.freeze({
          x: 0,
          y: 1.62,
          z: 0
        }),
        traversalAuthority: Object.freeze({
          currentActionKind: "none",
          currentActionPhase: "idle",
          currentActionSequence: 0,
          lastConsumedActionSequence: 0,
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 0
        }),
        recentPlayerActionReceipts: Object.freeze([
          Object.freeze({
            actionSequence: 8,
            kind: "fire-weapon",
            processedAtTimeMs: 1_250,
            rejectionReason: null,
            sourceProjectileId: "combat-projectile-8",
            status: "accepted",
            weaponId: "metaverse-service-pistol-v2"
          })
        ]),
        latestShotResolutionTelemetry: Object.freeze({
          actionSequence: 8,
          candidatePlayerHit: null,
          finalReason: "hit-player",
          firingReferenceOriginWorld: Object.freeze({ x: 0, y: 1.62, z: 0 }),
          lineOfSightBlocked: false,
          lineOfSightBlockerDistanceMeters: null,
          lineOfSightBlockerKind: null,
          lineOfSightBlockerPoint: null,
          lineOfSightChecked: true,
          processedAtTimeMs: 1_250,
          rayForwardWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
          rayOriginWorld: Object.freeze({ x: 0, y: 1.62, z: 0 }),
          rewindSource: "current",
          selectedPlayerHit: null,
          weaponId: "metaverse-service-pistol-v2",
          worldHitColliderKind: null,
          worldHitDistanceMeters: null,
          worldHitPoint: null
        }),
        yawRadians: 0
      });

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  const telemetrySnapshot = telemetryState.createSnapshot(
    nowMs,
    createPublishInput()
  );

  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .combatAction.highestProcessedPlayerActionSequence,
    8
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .combatAction.status,
    "accepted"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .combatAction.sourceProjectileId,
    "combat-projectile-8"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .combatAction.shotResolution?.finalReason,
    "hit-player"
  );
});
