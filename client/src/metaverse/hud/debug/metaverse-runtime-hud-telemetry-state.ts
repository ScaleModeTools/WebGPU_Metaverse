import { type Camera, Vector3 } from "three/webgpu";
import type {
  MetaverseGroundedBodyContactSnapshot,
  MetaverseGroundedBodyInteractionSnapshot,
  MetaverseGroundedJumpBodySnapshot,
  MetaverseSurfaceDriveBodyRuntimeSnapshot,
  MetaverseSurfaceTraversalDriveTargetSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaversePlayerActionReceiptSnapshot
} from "@webgpu-metaverse/shared";

import {
  metaverseLocalAuthorityReconciliationConfig,
  metaverseRemoteWorldSamplingConfig,
  metaverseWorldClientConfig
} from "../../config/metaverse-world-network";
import { MetaverseEnvironmentPhysicsRuntime } from "../../classes/metaverse-environment-physics-runtime";
import { MetaverseRemoteWorldRuntime } from "../../classes/metaverse-remote-world-runtime";
import { MetaverseTraversalRuntime } from "../../classes/metaverse-traversal-runtime";
import { resolveAutomaticSurfaceLocomotionSnapshot } from "../../traversal/policies/surface-routing";
import type {
  MetaverseHudSnapshot,
  MetaverseRuntimeConfig,
  MetaverseTelemetrySnapshot,
  MetaverseVector3Snapshot
} from "../../types/metaverse-runtime";

export interface MetaverseRendererTelemetrySource {
  readonly info?: {
    readonly render?: {
      readonly calls?: number;
      readonly drawCalls?: number;
      readonly triangles?: number;
    };
  };
}

interface CreateTelemetrySnapshotInput {
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly renderedFrameCount: number;
  readonly renderer: MetaverseRendererTelemetrySource | null;
}

interface MetaverseRuntimeHudTelemetryStateDependencies {
  readonly config: MetaverseRuntimeConfig;
  readonly devicePixelRatio: number;
  readonly environmentPhysicsRuntime: MetaverseEnvironmentPhysicsRuntime;
  readonly readLocalHeldWeaponGripTelemetrySnapshot: (
    nowMs: number
  ) => MetaverseTelemetrySnapshot["localHeldWeaponGrip"];
  readonly readProjectilePresentationTelemetrySnapshots?: (() =>
    MetaverseTelemetrySnapshot["projectilePresentation"]) | null | undefined;
  readonly remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly traversalRuntime: MetaverseTraversalRuntime;
}

const metaverseRecentLocalReconciliationWindowMs = 5_000;
const metaverseRenderedCameraLargeSnapLookAngleThresholdRadians = 0.075;
const metaverseRenderedCameraLargeSnapPlanarThresholdMeters = 0.12;
const metaverseRenderedCameraLargeSnapVerticalThresholdMeters = 0.08;
const renderedCameraLookDirectionScratch = new Vector3();

type LocalReconciliationCorrectionSource = Exclude<
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastCorrectionSource"],
  "none"
>;
type RenderedCameraOffsetTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["cameraPresentation"]["renderedOffset"];

interface LocalReconciliationEventSnapshot {
  readonly atMs: number;
  readonly source: LocalReconciliationCorrectionSource;
}

interface RenderedCameraOffsetDeltaEventSnapshot {
  readonly atMs: number;
  readonly large: boolean;
  readonly lookAngleRadians: number;
  readonly planarMagnitudeMeters: number;
  readonly verticalMagnitudeMeters: number;
}

function readLatestFireWeaponActionReceipt(
  recentPlayerActionReceipts:
    | readonly MetaversePlayerActionReceiptSnapshot[]
    | null
    | undefined
): Extract<
  MetaversePlayerActionReceiptSnapshot,
  {
    readonly kind: "fire-weapon";
  }
> | null {
  if (recentPlayerActionReceipts == null) {
    return null;
  }

  for (let index = recentPlayerActionReceipts.length - 1; index >= 0; index -= 1) {
    const receiptSnapshot = recentPlayerActionReceipts[index];

    if (receiptSnapshot?.kind === "fire-weapon") {
      return receiptSnapshot;
    }
  }

  return null;
}

function freezeGroundedJumpBodyTelemetrySnapshot(
  snapshot: MetaverseGroundedJumpBodySnapshot
): MetaverseGroundedJumpBodySnapshot {
  return Object.freeze({
    grounded: snapshot.grounded,
    jumpGroundContactGraceSecondsRemaining:
      snapshot.jumpGroundContactGraceSecondsRemaining,
    jumpReady: snapshot.jumpReady,
    jumpSnapSuppressionActive: snapshot.jumpSnapSuppressionActive,
    verticalSpeedUnitsPerSecond: snapshot.verticalSpeedUnitsPerSecond
  });
}

function freezeGroundedBodyContactTelemetrySnapshot(
  snapshot: MetaverseGroundedBodyContactSnapshot
): MetaverseGroundedBodyContactSnapshot {
  return Object.freeze({
    appliedMovementDelta: Object.freeze({
      x: snapshot.appliedMovementDelta.x,
      y: snapshot.appliedMovementDelta.y,
      z: snapshot.appliedMovementDelta.z
    }),
    blockedPlanarMovement: snapshot.blockedPlanarMovement,
    blockedVerticalMovement: snapshot.blockedVerticalMovement,
    desiredMovementDelta: Object.freeze({
      x: snapshot.desiredMovementDelta.x,
      y: snapshot.desiredMovementDelta.y,
      z: snapshot.desiredMovementDelta.z
    }),
    supportingContactDetected: snapshot.supportingContactDetected
  });
}

function freezeGroundedBodyDriveTargetTelemetrySnapshot(
  snapshot: MetaverseSurfaceTraversalDriveTargetSnapshot
): MetaverseSurfaceTraversalDriveTargetSnapshot {
  return Object.freeze({
    boost: snapshot.boost,
    moveAxis: snapshot.moveAxis,
    movementMagnitude: snapshot.movementMagnitude,
    strafeAxis: snapshot.strafeAxis,
    targetForwardSpeedUnitsPerSecond:
      snapshot.targetForwardSpeedUnitsPerSecond,
    targetPlanarSpeedUnitsPerSecond:
      snapshot.targetPlanarSpeedUnitsPerSecond,
    targetStrafeSpeedUnitsPerSecond:
      snapshot.targetStrafeSpeedUnitsPerSecond
  });
}

function freezeGroundedBodyInteractionTelemetrySnapshot(
  snapshot: MetaverseGroundedBodyInteractionSnapshot
): MetaverseGroundedBodyInteractionSnapshot {
  return Object.freeze({
    applyImpulsesToDynamicBodies: snapshot.applyImpulsesToDynamicBodies
  });
}

function freezeGroundedBodyTelemetrySnapshot(
  snapshot:
    | NonNullable<
        MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"]["groundedBody"]
      >
    | NonNullable<
        MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeLocalPlayer"]["groundedBody"]
      >
    | NonNullable<
        NonNullable<
          MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"]
        >["local"]["groundedBody"]
      >
    | NonNullable<
        NonNullable<
          MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"]
        >["authoritative"]["groundedBody"]
      >
): NonNullable<
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"]["groundedBody"]
> {
  return Object.freeze({
    contact: freezeGroundedBodyContactTelemetrySnapshot(snapshot.contact),
    driveTarget: freezeGroundedBodyDriveTargetTelemetrySnapshot(
      snapshot.driveTarget
    ),
    interaction: freezeGroundedBodyInteractionTelemetrySnapshot(
      snapshot.interaction
    ),
    jumpBody: freezeGroundedJumpBodyTelemetrySnapshot(snapshot.jumpBody)
  });
}

function freezeSwimBodyTelemetrySnapshot(
  snapshot: MetaverseSurfaceDriveBodyRuntimeSnapshot
): NonNullable<
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeLocalPlayer"]["swimBody"]
> {
  return Object.freeze({
    angularVelocityRadiansPerSecond:
      snapshot.angularVelocityRadiansPerSecond,
    contact: Object.freeze({
      appliedMovementDelta: freezeVector3Snapshot(
        snapshot.contact.appliedMovementDelta
      ),
      blockedPlanarMovement: snapshot.contact.blockedPlanarMovement,
      desiredMovementDelta: freezeVector3Snapshot(
        snapshot.contact.desiredMovementDelta
      )
    }),
    driveTarget: freezeGroundedBodyDriveTargetTelemetrySnapshot(
      snapshot.driveTarget
    ),
    forwardSpeedUnitsPerSecond: snapshot.forwardSpeedUnitsPerSecond,
    linearVelocity: freezeVector3Snapshot(snapshot.linearVelocity),
    planarSpeedUnitsPerSecond: snapshot.planarSpeedUnitsPerSecond,
    position: freezeVector3Snapshot(snapshot.position),
    strafeSpeedUnitsPerSecond: snapshot.strafeSpeedUnitsPerSecond,
    yawRadians: snapshot.yawRadians
  });
}

function freezeRendererTelemetrySnapshot(
  snapshot: MetaverseTelemetrySnapshot["renderer"]
): MetaverseTelemetrySnapshot["renderer"] {
  return Object.freeze({
    active: snapshot.active,
    devicePixelRatio: snapshot.devicePixelRatio,
    drawCallCount: snapshot.drawCallCount,
    label: snapshot.label,
    triangleCount: snapshot.triangleCount
  });
}

function freezeNullableVector3Snapshot(
  snapshot: MetaverseVector3Snapshot | null
): MetaverseVector3Snapshot | null {
  if (snapshot === null) {
    return null;
  }

  return Object.freeze({
    x: snapshot.x,
    y: snapshot.y,
    z: snapshot.z
  });
}

function freezeLocalHeldWeaponGripTelemetrySnapshot(
  snapshot: MetaverseTelemetrySnapshot["localHeldWeaponGrip"]
): MetaverseTelemetrySnapshot["localHeldWeaponGrip"] {
  return Object.freeze({
    adsBlend: snapshot.adsBlend,
    adsAnchorPoseActive: snapshot.adsAnchorPoseActive,
    adsAnchorPositionErrorMeters: snapshot.adsAnchorPositionErrorMeters,
    adsAppliedGripDeltaMeters: snapshot.adsAppliedGripDeltaMeters,
    adsGripDeltaClamped: snapshot.adsGripDeltaClamped,
    adsPositionalWeight: snapshot.adsPositionalWeight,
    aimMode: snapshot.aimMode,
    aimSource: snapshot.aimSource,
    aimSourceQuality: snapshot.aimSourceQuality,
    attachmentMountKind: snapshot.attachmentMountKind,
    actualWeaponForwardWorld: freezeNullableVector3Snapshot(
      snapshot.actualWeaponForwardWorld
    ),
    degradedFrameCount: snapshot.degradedFrameCount,
    deprecatedAimPoseActive: snapshot.deprecatedAimPoseActive,
    desiredWeaponForwardWorld: freezeNullableVector3Snapshot(
      snapshot.desiredWeaponForwardWorld
    ),
    gripTargetSolveFailureReason: snapshot.gripTargetSolveFailureReason,
    secondaryGripContactAvailable: snapshot.secondaryGripContactAvailable,
    heldMountSocketName: snapshot.heldMountSocketName,
    lastDegradedAgeMs: snapshot.lastDegradedAgeMs,
    lastDegradedReason: snapshot.lastDegradedReason,
    mainHandGripErrorMeters: snapshot.mainHandGripErrorMeters,
    mainHandGripSocketComparisonErrorMeters:
      snapshot.mainHandGripSocketComparisonErrorMeters,
    mainHandAngularErrorRadians: snapshot.mainHandAngularErrorRadians,
    mainHandContactFrameId: snapshot.mainHandContactFrameId,
    mainHandMaxReachMeters: snapshot.mainHandMaxReachMeters,
    mainHandPalmSocketComparisonErrorMeters:
      snapshot.mainHandPalmSocketComparisonErrorMeters,
    mainHandPoleAngleRadians: snapshot.mainHandPoleAngleRadians,
    mainHandPostPoleBiasErrorMeters:
      snapshot.mainHandPostPoleBiasErrorMeters,
    mainHandReachClampDeltaMeters: snapshot.mainHandReachClampDeltaMeters,
    mainHandReachSlackMeters: snapshot.mainHandReachSlackMeters,
    mainHandSolveErrorMeters: snapshot.mainHandSolveErrorMeters,
    mainHandSocket: snapshot.mainHandSocket,
    mainHandTargetDistanceMeters: snapshot.mainHandTargetDistanceMeters,
    mainHandWeaponSocketRole: snapshot.mainHandWeaponSocketRole,
    mainHandWristCorrectionRadians: snapshot.mainHandWristCorrectionRadians,
    legacyFullBodyAimFallbackActive: snapshot.legacyFullBodyAimFallbackActive,
    legacyPistolShootOverlayActive: snapshot.legacyPistolShootOverlayActive,
    legacyUpperBodyAimOverlayActive: snapshot.legacyUpperBodyAimOverlayActive,
    muzzleAimAngularErrorRadians: snapshot.muzzleAimAngularErrorRadians,
    offHandAngularErrorRadians: snapshot.offHandAngularErrorRadians,
    offHandContactFrameId: snapshot.offHandContactFrameId,
    offHandFinalErrorMeters: snapshot.offHandFinalErrorMeters,
    offHandGripMounted: snapshot.offHandGripMounted,
    offHandInitialSolveErrorMeters: snapshot.offHandInitialSolveErrorMeters,
    offHandPoleAngleRadians: snapshot.offHandPoleAngleRadians,
    offHandPreSolveErrorMeters: snapshot.offHandPreSolveErrorMeters,
    offHandRefinementPassCount: snapshot.offHandRefinementPassCount,
    offHandSocket: snapshot.offHandSocket,
    offHandGripAnchorAvailable: snapshot.offHandGripAnchorAvailable,
    offHandTargetKind: snapshot.offHandTargetKind,
    offHandWeaponSocketRole: snapshot.offHandWeaponSocketRole,
    offHandWristCorrectionRadians: snapshot.offHandWristCorrectionRadians,
    phase: snapshot.phase,
    poseProfileId: snapshot.poseProfileId,
    supportPalmFade: snapshot.supportPalmFade,
    supportPalmHintActive: snapshot.supportPalmHintActive,
    stability: snapshot.stability,
    weaponId: snapshot.weaponId,
    weaponStatePresent: snapshot.weaponStatePresent,
    worstMainHandGripErrorMeters: snapshot.worstMainHandGripErrorMeters,
    worstOffHandFinalErrorMeters: snapshot.worstOffHandFinalErrorMeters
  });
}

function freezeProjectilePresentationDebugSnapshots(
  snapshots: MetaverseTelemetrySnapshot["projectilePresentation"]
): MetaverseTelemetrySnapshot["projectilePresentation"] {
  return Object.freeze(
    snapshots.map((snapshot) =>
      Object.freeze({
        actionSequence: snapshot.actionSequence,
        actorId: snapshot.actorId,
        cameraRayToVisualSegmentAngleRadians:
          snapshot.cameraRayToVisualSegmentAngleRadians,
        deliveryModel: snapshot.deliveryModel,
        drainTimeRenderedMuzzleWorld: freezeNullableVector3Snapshot(
          snapshot.drainTimeRenderedMuzzleWorld
        ),
        endpointRayDistanceMeters: snapshot.endpointRayDistanceMeters,
        endpointRayPerpendicularErrorMeters:
          snapshot.endpointRayPerpendicularErrorMeters,
        eventCameraRayForwardWorld: freezeNullableVector3Snapshot(
          snapshot.eventCameraRayForwardWorld
        ),
        finiteEndpointPolicy: snapshot.finiteEndpointPolicy,
        firstProjectileSnapshotWorld: freezeNullableVector3Snapshot(
          snapshot.firstProjectileSnapshotWorld
        ),
        hitscanHitKind: snapshot.hitscanHitKind,
        muzzleToSemanticTipDeltaMeters:
          snapshot.muzzleToSemanticTipDeltaMeters,
        muzzleToEndpointDistanceMeters:
          snapshot.muzzleToEndpointDistanceMeters,
        muzzleForwardToVisualSegmentAngleRadians:
          snapshot.muzzleForwardToVisualSegmentAngleRadians,
        postSyncFireActionMuzzleWorld: freezeNullableVector3Snapshot(
          snapshot.postSyncFireActionMuzzleWorld
        ),
        postSyncFireActionToDrainTimeMuzzleDeltaMeters:
          snapshot.postSyncFireActionToDrainTimeMuzzleDeltaMeters,
        projectileId: snapshot.projectileId,
        renderedMuzzleCapturedAt: snapshot.renderedMuzzleCapturedAt,
        renderedMuzzleForwardWorld: freezeNullableVector3Snapshot(
          snapshot.renderedMuzzleForwardWorld
        ),
        renderedMuzzleWorld: freezeNullableVector3Snapshot(
          snapshot.renderedMuzzleWorld
        ),
        renderedToServerDeltaMeters: snapshot.renderedToServerDeltaMeters,
        semanticTipToFirstSnapshotDeltaMeters:
          snapshot.semanticTipToFirstSnapshotDeltaMeters,
        semanticTipWorld: freezeNullableVector3Snapshot(snapshot.semanticTipWorld),
        serverProjectileOriginWorld: freezeNullableVector3Snapshot(
          snapshot.serverProjectileOriginWorld
        ),
        sharedObjectLocalMuzzleFrame:
          snapshot.sharedObjectLocalMuzzleFrame === null
            ? null
            : Object.freeze({
                forwardMeters:
                  snapshot.sharedObjectLocalMuzzleFrame.forwardMeters,
                rightMeters: snapshot.sharedObjectLocalMuzzleFrame.rightMeters,
                role: snapshot.sharedObjectLocalMuzzleFrame.role,
                rotation: Object.freeze({
                  w: snapshot.sharedObjectLocalMuzzleFrame.rotation.w,
                  x: snapshot.sharedObjectLocalMuzzleFrame.rotation.x,
                  y: snapshot.sharedObjectLocalMuzzleFrame.rotation.y,
                  z: snapshot.sharedObjectLocalMuzzleFrame.rotation.z
                }),
                source: snapshot.sharedObjectLocalMuzzleFrame.source,
                upMeters: snapshot.sharedObjectLocalMuzzleFrame.upMeters
              }),
        tracerSuppressedReason: snapshot.tracerSuppressedReason,
        tracerStartSource: snapshot.tracerStartSource,
        visualEndWorld: freezeNullableVector3Snapshot(snapshot.visualEndWorld),
        visualEndpointSource: snapshot.visualEndpointSource,
        visualSegmentDirectionWorld: freezeNullableVector3Snapshot(
          snapshot.visualSegmentDirectionWorld
        ),
        visualStartWorld: freezeNullableVector3Snapshot(snapshot.visualStartWorld),
        weaponId: snapshot.weaponId,
        weaponInstanceId: snapshot.weaponInstanceId
      })
    )
  );
}

function freezeOptionalVector3Snapshot(
  snapshot: MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeLocalPlayer"]["position"]
): MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeLocalPlayer"]["position"] {
  if (snapshot === null) {
    return null;
  }

  return Object.freeze({
    x: snapshot.x,
    y: snapshot.y,
    z: snapshot.z
  });
}

function freezeVector3Snapshot(snapshot: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}) {
  return Object.freeze({
    x: snapshot.x,
    y: snapshot.y,
    z: snapshot.z
  });
}

function freezeIssuedTraversalIntentSnapshot(
  snapshot:
    | NonNullable<
        MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["issuedTraversalIntent"]
      >
    | NonNullable<
        NonNullable<
          MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"]
        >["local"]["issuedTraversalIntent"]
      >
): NonNullable<
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["issuedTraversalIntent"]
> {
  return Object.freeze({
    actionIntent: Object.freeze({
      ...snapshot.actionIntent
    }),
    bodyControl: Object.freeze({
      ...snapshot.bodyControl
    }),
    sequence: snapshot.sequence,
    locomotionMode: snapshot.locomotionMode
  });
}

function freezeLocalAuthorityPoseCorrectionSnapshot(
  snapshot: MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"]
): MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"] {
  if (snapshot === null) {
    return null;
  }

  return Object.freeze({
    authoritative: Object.freeze({
      groundedBody:
        snapshot.authoritative.groundedBody == null
          ? null
          : freezeGroundedBodyTelemetrySnapshot(
              snapshot.authoritative.groundedBody
            ),
      lastProcessedTraversalSequence: snapshot.authoritative.lastProcessedTraversalSequence,
      linearVelocity: freezeVector3Snapshot(
        snapshot.authoritative.linearVelocity
      ),
      locomotionMode: snapshot.authoritative.locomotionMode,
      position: freezeVector3Snapshot(snapshot.authoritative.position),
      swimBody:
        snapshot.authoritative.swimBody == null
          ? null
          : freezeSwimBodyTelemetrySnapshot(snapshot.authoritative.swimBody),
      surfaceRouting: Object.freeze({
        blockingAffordanceDetected:
          snapshot.authoritative.surfaceRouting.blockingAffordanceDetected,
        decisionReason: snapshot.authoritative.surfaceRouting.decisionReason,
        resolvedSupportHeightMeters:
          snapshot.authoritative.surfaceRouting.resolvedSupportHeightMeters,
        supportingAffordanceSampleCount:
          snapshot.authoritative.surfaceRouting.supportingAffordanceSampleCount
      })
    }),
    local: Object.freeze({
      groundedBody:
        snapshot.local.groundedBody == null
          ? null
          : freezeGroundedBodyTelemetrySnapshot(snapshot.local.groundedBody),
      issuedTraversalIntent:
        snapshot.local.issuedTraversalIntent === null
          ? null
          : freezeIssuedTraversalIntentSnapshot(
              snapshot.local.issuedTraversalIntent
            ),
      linearVelocity: freezeVector3Snapshot(snapshot.local.linearVelocity),
      locomotionMode: snapshot.local.locomotionMode,
      position: freezeVector3Snapshot(snapshot.local.position),
      swimBody:
        snapshot.local.swimBody == null
          ? null
          : freezeSwimBodyTelemetrySnapshot(snapshot.local.swimBody),
      surfaceRouting: Object.freeze({
        autostepHeightMeters: snapshot.local.surfaceRouting.autostepHeightMeters,
        blockingAffordanceDetected:
          snapshot.local.surfaceRouting.blockingAffordanceDetected,
        decisionReason: snapshot.local.surfaceRouting.decisionReason,
        groundedBody:
          snapshot.local.surfaceRouting.groundedBody == null
            ? null
            : freezeGroundedBodyTelemetrySnapshot(
                snapshot.local.surfaceRouting.groundedBody
              ),
        locomotionMode: snapshot.local.surfaceRouting.locomotionMode,
        resolvedSupportHeightMeters:
          snapshot.local.surfaceRouting.resolvedSupportHeightMeters,
        swimBody:
          snapshot.local.surfaceRouting.swimBody == null
            ? null
            : freezeSwimBodyTelemetrySnapshot(
                snapshot.local.surfaceRouting.swimBody
              ),
        supportingAffordanceSampleCount:
          snapshot.local.surfaceRouting.supportingAffordanceSampleCount,
        traversalAuthority: Object.freeze({
          currentActionKind:
            snapshot.local.surfaceRouting.traversalAuthority.currentActionKind,
          currentActionPhase:
            snapshot.local.surfaceRouting.traversalAuthority.currentActionPhase,
          currentActionSequence:
            snapshot.local.surfaceRouting.traversalAuthority.currentActionSequence,
          lastConsumedActionSequence:
            snapshot.local.surfaceRouting.traversalAuthority
              .lastConsumedActionSequence,
          lastRejectedActionReason:
            snapshot.local.surfaceRouting.traversalAuthority
              .lastRejectedActionReason,
          lastRejectedActionSequence:
            snapshot.local.surfaceRouting.traversalAuthority
              .lastRejectedActionSequence,
          phaseStartedAtTick:
            snapshot.local.surfaceRouting.traversalAuthority.phaseStartedAtTick
        })
      })
    })
  });
}

function clampUnitInterval(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function resolveLookAngleRadians(
  referenceLookDirection: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  renderedLookDirection: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): number {
  const referenceMagnitude = Math.hypot(
    referenceLookDirection.x,
    referenceLookDirection.y,
    referenceLookDirection.z
  );
  const renderedMagnitude = Math.hypot(
    renderedLookDirection.x,
    renderedLookDirection.y,
    renderedLookDirection.z
  );

  if (referenceMagnitude <= 0.000001 || renderedMagnitude <= 0.000001) {
    return 0;
  }

  return Math.acos(
    clampUnitInterval(
      (referenceLookDirection.x * renderedLookDirection.x +
        referenceLookDirection.y * renderedLookDirection.y +
        referenceLookDirection.z * renderedLookDirection.z) /
        (referenceMagnitude * renderedMagnitude)
    )
  );
}

function createRenderedCameraOffsetTelemetrySnapshot(
  referenceCameraSnapshot: MetaverseHudSnapshot["camera"],
  renderedCamera: Camera
): RenderedCameraOffsetTelemetrySnapshot {
  renderedCamera.getWorldDirection(renderedCameraLookDirectionScratch);

  return Object.freeze({
    lookAngleRadians: resolveLookAngleRadians(
      referenceCameraSnapshot.lookDirection,
      renderedCameraLookDirectionScratch
    ),
    planarMagnitudeMeters: Math.hypot(
      renderedCamera.position.x - referenceCameraSnapshot.position.x,
      renderedCamera.position.z - referenceCameraSnapshot.position.z
    ),
    verticalMagnitudeMeters: Math.abs(
      renderedCamera.position.y - referenceCameraSnapshot.position.y
    )
  });
}

function createRenderedCameraOffsetDeltaTelemetrySnapshot(
  previousOffset: RenderedCameraOffsetTelemetrySnapshot,
  nextOffset: RenderedCameraOffsetTelemetrySnapshot
): RenderedCameraOffsetTelemetrySnapshot {
  return Object.freeze({
    lookAngleRadians: Math.abs(
      nextOffset.lookAngleRadians - previousOffset.lookAngleRadians
    ),
    planarMagnitudeMeters: Math.abs(
      nextOffset.planarMagnitudeMeters - previousOffset.planarMagnitudeMeters
    ),
    verticalMagnitudeMeters: Math.abs(
      nextOffset.verticalMagnitudeMeters - previousOffset.verticalMagnitudeMeters
    )
  });
}

function isLargeRenderedCameraSnap(
  offsetDeltaSnapshot: RenderedCameraOffsetTelemetrySnapshot
): boolean {
  return (
    offsetDeltaSnapshot.planarMagnitudeMeters >=
      metaverseRenderedCameraLargeSnapPlanarThresholdMeters ||
    offsetDeltaSnapshot.verticalMagnitudeMeters >=
      metaverseRenderedCameraLargeSnapVerticalThresholdMeters ||
    offsetDeltaSnapshot.lookAngleRadians >=
      metaverseRenderedCameraLargeSnapLookAngleThresholdRadians
  );
}

function freezeTelemetrySnapshot(
  snapshot: MetaverseTelemetrySnapshot
): MetaverseTelemetrySnapshot {
  return Object.freeze({
    frameDeltaMs: snapshot.frameDeltaMs,
    frameRate: snapshot.frameRate,
    localHeldWeaponGrip: freezeLocalHeldWeaponGripTelemetrySnapshot(
      snapshot.localHeldWeaponGrip
    ),
    projectilePresentation: freezeProjectilePresentationDebugSnapshots(
      snapshot.projectilePresentation
    ),
    renderedFrameCount: snapshot.renderedFrameCount,
    renderer: freezeRendererTelemetrySnapshot(snapshot.renderer),
    worldCadence: Object.freeze({
      authoritativeTickIntervalMs: snapshot.worldCadence.authoritativeTickIntervalMs,
      localAuthoritativeFreshnessMaxAgeMs:
        snapshot.worldCadence.localAuthoritativeFreshnessMaxAgeMs,
      maxExtrapolationMs: snapshot.worldCadence.maxExtrapolationMs,
      remoteInterpolationDelayMs:
        snapshot.worldCadence.remoteInterpolationDelayMs,
      worldPollIntervalMs: snapshot.worldCadence.worldPollIntervalMs
    }),
    worldSnapshot: Object.freeze({
      bufferDepth: snapshot.worldSnapshot.bufferDepth,
      cameraPresentation: Object.freeze({
        renderedOffset: Object.freeze({
          lookAngleRadians:
            snapshot.worldSnapshot.cameraPresentation.renderedOffset
              .lookAngleRadians,
          planarMagnitudeMeters:
            snapshot.worldSnapshot.cameraPresentation.renderedOffset
              .planarMagnitudeMeters,
          verticalMagnitudeMeters:
            snapshot.worldSnapshot.cameraPresentation.renderedOffset
              .verticalMagnitudeMeters
        }),
        renderedSnap: Object.freeze({
          lastAgeMs:
            snapshot.worldSnapshot.cameraPresentation.renderedSnap.lastAgeMs,
          maxLookAngleRadiansPast5Seconds:
            snapshot.worldSnapshot.cameraPresentation.renderedSnap
              .maxLookAngleRadiansPast5Seconds,
          maxPlanarMagnitudeMetersPast5Seconds:
            snapshot.worldSnapshot.cameraPresentation.renderedSnap
              .maxPlanarMagnitudeMetersPast5Seconds,
          maxVerticalMagnitudeMetersPast5Seconds:
            snapshot.worldSnapshot.cameraPresentation.renderedSnap
              .maxVerticalMagnitudeMetersPast5Seconds,
          recentCountPast5Seconds:
            snapshot.worldSnapshot.cameraPresentation.renderedSnap
              .recentCountPast5Seconds,
          totalCount:
            snapshot.worldSnapshot.cameraPresentation.renderedSnap.totalCount
        })
      }),
      clockOffsetEstimateMs: snapshot.worldSnapshot.clockOffsetEstimateMs,
      currentExtrapolationMs: snapshot.worldSnapshot.currentExtrapolationMs,
      datagramSendFailureCount:
        snapshot.worldSnapshot.datagramSendFailureCount,
      extrapolatedFramePercent:
        snapshot.worldSnapshot.extrapolatedFramePercent,
      localReconciliation: Object.freeze({
        lastLocalAuthorityPoseCorrectionDetail: Object.freeze({
          authoritativeSnapshotAgeMs:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.authoritativeSnapshotAgeMs,
          authoritativeSnapshotSequence:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .authoritativeSnapshotSequence,
          authoritativeTick:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.authoritativeTick,
          authoritativeGrounded:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.authoritativeGrounded,
          bodyStateDivergence:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.bodyStateDivergence,
          convergenceEpisodeStarted:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStarted,
          convergenceEpisodeStartIntentionalDiscontinuityCause:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartIntentionalDiscontinuityCause,
          convergenceEpisodeStartHistoricalLocalSampleMatched:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartHistoricalLocalSampleMatched,
          convergenceEpisodeStartHistoricalLocalSampleSelectionReason:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartHistoricalLocalSampleSelectionReason,
          convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs,
          convergenceEpisodeStartPlanarMagnitudeMeters:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartPlanarMagnitudeMeters,
          convergenceEpisodeStartReason:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartReason,
          convergenceEpisodeStartVerticalMagnitudeMeters:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartVerticalMagnitudeMeters,
          convergenceEpisodeStartYawMagnitudeRadians:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .convergenceEpisodeStartYawMagnitudeRadians,
          groundedBodyStateDivergence:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .groundedBodyStateDivergence,
          lastProcessedTraversalSequence:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .lastProcessedTraversalSequence,
          localGrounded:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.localGrounded,
          planarMagnitudeMeters:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.planarMagnitudeMeters,
          planarVelocityMagnitudeUnitsPerSecond:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .planarVelocityMagnitudeUnitsPerSecond,
          verticalMagnitudeMeters:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail.verticalMagnitudeMeters,
          verticalVelocityMagnitudeUnitsPerSecond:
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionDetail
              .verticalVelocityMagnitudeUnitsPerSecond
        }),
        lastLocalAuthorityPoseCorrectionSnapshot:
          freezeLocalAuthorityPoseCorrectionSnapshot(
            snapshot.worldSnapshot.localReconciliation
              .lastLocalAuthorityPoseCorrectionSnapshot
          ),
        lastLocalAuthorityPoseCorrectionReason:
          snapshot.worldSnapshot.localReconciliation
            .lastLocalAuthorityPoseCorrectionReason,
        lastCorrectionAgeMs:
          snapshot.worldSnapshot.localReconciliation.lastCorrectionAgeMs,
        lastCorrectionSource:
          snapshot.worldSnapshot.localReconciliation.lastCorrectionSource,
        localAuthorityPoseCorrectionCount:
          snapshot.worldSnapshot.localReconciliation
            .localAuthorityPoseCorrectionCount,
        localAuthorityPoseConvergenceEpisodeCount:
          snapshot.worldSnapshot.localReconciliation
            .localAuthorityPoseConvergenceEpisodeCount,
        localAuthorityPoseConvergenceStepCount:
          snapshot.worldSnapshot.localReconciliation
            .localAuthorityPoseConvergenceStepCount,
        mountedVehicleAuthorityCorrectionCount:
          snapshot.worldSnapshot.localReconciliation
            .mountedVehicleAuthorityCorrectionCount,
        recentCorrectionCountPast5Seconds:
          snapshot.worldSnapshot.localReconciliation
            .recentCorrectionCountPast5Seconds,
        recentLocalAuthorityPoseCorrectionCountPast5Seconds:
          snapshot.worldSnapshot.localReconciliation
            .recentLocalAuthorityPoseCorrectionCountPast5Seconds,
        recentLocalAuthorityPoseConvergenceEpisodeCountPast5Seconds:
          snapshot.worldSnapshot.localReconciliation
            .recentLocalAuthorityPoseConvergenceEpisodeCountPast5Seconds,
        recentLocalAuthorityPoseConvergenceStepCountPast5Seconds:
          snapshot.worldSnapshot.localReconciliation
            .recentLocalAuthorityPoseConvergenceStepCountPast5Seconds,
        recentMountedVehicleAuthorityCorrectionCountPast5Seconds:
          snapshot.worldSnapshot.localReconciliation
            .recentMountedVehicleAuthorityCorrectionCountPast5Seconds,
        totalCorrectionCount:
          snapshot.worldSnapshot.localReconciliation.totalCorrectionCount
      }),
      localReconciliationCorrectionCount:
        snapshot.worldSnapshot.localReconciliationCorrectionCount,
      surfaceRouting: Object.freeze({
        authoritativeCorrection: Object.freeze({
          applied: snapshot.worldSnapshot.surfaceRouting.authoritativeCorrection.applied,
          locomotionMismatch:
            snapshot.worldSnapshot.surfaceRouting.authoritativeCorrection
              .locomotionMismatch,
          planarMagnitudeMeters:
            snapshot.worldSnapshot.surfaceRouting.authoritativeCorrection
              .planarMagnitudeMeters,
          verticalMagnitudeMeters:
            snapshot.worldSnapshot.surfaceRouting.authoritativeCorrection
              .verticalMagnitudeMeters
        }),
        authoritativeLocalPlayer: Object.freeze({
          combatAction: Object.freeze({
            actionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.actionSequence,
            kind:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.kind,
            highestProcessedPlayerActionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.highestProcessedPlayerActionSequence,
            processedAtTimeMs:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.processedAtTimeMs,
            sourceProjectileId:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.sourceProjectileId,
            rejectionReason:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.rejectionReason,
            shotResolution:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.shotResolution,
            status:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.status,
            weaponId:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .combatAction.weaponId
          }),
          correctionPlanarMagnitudeMeters:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .correctionPlanarMagnitudeMeters,
          correctionVerticalMagnitudeMeters:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .correctionVerticalMagnitudeMeters,
          groundedBody:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .groundedBody == null
              ? null
              : freezeGroundedBodyTelemetrySnapshot(
                  snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                    .groundedBody
                ),
          jumpDebug: Object.freeze({
            pendingActionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .jumpDebug.pendingActionSequence,
            pendingActionBufferAgeMs:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .jumpDebug.pendingActionBufferAgeMs,
            resolvedActionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .jumpDebug.resolvedActionSequence,
            resolvedActionState:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .jumpDebug.resolvedActionState,
          }),
          lastProcessedTraversalSequence:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .lastProcessedTraversalSequence,
          locomotionMismatch:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .locomotionMismatch,
          locomotionMode:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .locomotionMode,
          swimBody:
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
              .swimBody == null
              ? null
              : freezeSwimBodyTelemetrySnapshot(
                  snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                    .swimBody
                ),
          position: freezeOptionalVector3Snapshot(
            snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer.position
          ),
          traversalAuthority: Object.freeze({
            currentActionKind:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.currentActionKind,
            currentActionPhase:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.currentActionPhase,
            currentActionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.currentActionSequence,
            lastConsumedActionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.lastConsumedActionSequence,
            lastRejectedActionReason:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.lastRejectedActionReason,
            lastRejectedActionSequence:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.lastRejectedActionSequence,
            phaseStartedAtTick:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .traversalAuthority.phaseStartedAtTick
          }),
          surfaceRouting: Object.freeze({
            blockingAffordanceDetected:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .surfaceRouting.blockingAffordanceDetected,
            decisionReason:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .surfaceRouting.decisionReason,
            resolvedSupportHeightMeters:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .surfaceRouting.resolvedSupportHeightMeters,
            supportingAffordanceSampleCount:
              snapshot.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
                .surfaceRouting.supportingAffordanceSampleCount
          })
        }),
        issuedTraversalIntent:
          snapshot.worldSnapshot.surfaceRouting.issuedTraversalIntent === null
            ? null
            : freezeIssuedTraversalIntentSnapshot(
                snapshot.worldSnapshot.surfaceRouting.issuedTraversalIntent
              ),
        local: Object.freeze({
          autostepHeightMeters:
            snapshot.worldSnapshot.surfaceRouting.local.autostepHeightMeters,
          blockingAffordanceDetected:
            snapshot.worldSnapshot.surfaceRouting.local
              .blockingAffordanceDetected,
          decisionReason: snapshot.worldSnapshot.surfaceRouting.local.decisionReason,
          groundedBody:
            snapshot.worldSnapshot.surfaceRouting.local.groundedBody == null
              ? null
              : freezeGroundedBodyTelemetrySnapshot(
                  snapshot.worldSnapshot.surfaceRouting.local.groundedBody
                ),
          locomotionMode:
            snapshot.worldSnapshot.surfaceRouting.local.locomotionMode,
          resolvedSupportHeightMeters:
            snapshot.worldSnapshot.surfaceRouting.local.resolvedSupportHeightMeters,
          swimBody:
            snapshot.worldSnapshot.surfaceRouting.local.swimBody == null
              ? null
              : freezeSwimBodyTelemetrySnapshot(
                  snapshot.worldSnapshot.surfaceRouting.local.swimBody
                ),
          supportingAffordanceSampleCount:
            snapshot.worldSnapshot.surfaceRouting.local
              .supportingAffordanceSampleCount,
          traversalAuthority: Object.freeze({
            currentActionKind:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .currentActionKind,
            currentActionPhase:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .currentActionPhase,
            currentActionSequence:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .currentActionSequence,
            lastConsumedActionSequence:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .lastConsumedActionSequence,
            lastRejectedActionReason:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .lastRejectedActionReason,
            lastRejectedActionSequence:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .lastRejectedActionSequence,
            phaseStartedAtTick:
              snapshot.worldSnapshot.surfaceRouting.local.traversalAuthority
                .phaseStartedAtTick
          })
        })
      }),
      latestSimulationAgeMs: snapshot.worldSnapshot.latestSimulationAgeMs,
      latestSnapshotUpdateRateHz:
        snapshot.worldSnapshot.latestSnapshotUpdateRateHz
    })
  });
}

export class MetaverseRuntimeHudTelemetryState {
  readonly #config: MetaverseRuntimeConfig;
  readonly #devicePixelRatio: number;
  readonly #environmentPhysicsRuntime: MetaverseEnvironmentPhysicsRuntime;
  readonly #readLocalHeldWeaponGripTelemetrySnapshot: (
    nowMs: number
  ) => MetaverseTelemetrySnapshot["localHeldWeaponGrip"];
  readonly #readProjectilePresentationTelemetrySnapshots: () =>
    MetaverseTelemetrySnapshot["projectilePresentation"];
  readonly #remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly #traversalRuntime: MetaverseTraversalRuntime;

  #lastLocalReconciliationAtMs: number | null = null;
  #lastObservedLocalReconciliationTotalCount = 0;
  #lastRenderedCameraOffsetSnapshot: RenderedCameraOffsetTelemetrySnapshot | null =
    null;
  #lastRenderedCameraSnapAtMs: number | null = null;
  #recentLocalReconciliationEvents: LocalReconciliationEventSnapshot[] = [];
  #recentRenderedCameraOffsetDeltaEvents: RenderedCameraOffsetDeltaEventSnapshot[] =
    [];
  #renderedCameraSnapCount = 0;

  constructor({
    config,
    devicePixelRatio,
    environmentPhysicsRuntime,
    readLocalHeldWeaponGripTelemetrySnapshot,
    readProjectilePresentationTelemetrySnapshots,
    remoteWorldRuntime,
    traversalRuntime
  }: MetaverseRuntimeHudTelemetryStateDependencies) {
    this.#config = config;
    this.#devicePixelRatio = devicePixelRatio;
    this.#environmentPhysicsRuntime = environmentPhysicsRuntime;
    this.#readLocalHeldWeaponGripTelemetrySnapshot =
      readLocalHeldWeaponGripTelemetrySnapshot;
    this.#readProjectilePresentationTelemetrySnapshots =
      readProjectilePresentationTelemetrySnapshots ?? (() => Object.freeze([]));
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
  }

  reset(): void {
    this.#lastLocalReconciliationAtMs = null;
    this.#lastObservedLocalReconciliationTotalCount = 0;
    this.#lastRenderedCameraOffsetSnapshot = null;
    this.#lastRenderedCameraSnapAtMs = null;
    this.#recentLocalReconciliationEvents = [];
    this.#recentRenderedCameraOffsetDeltaEvents = [];
    this.#renderedCameraSnapCount = 0;
  }

  trackFrame(
    nowMs: number,
    referenceCameraSnapshot: MetaverseHudSnapshot["camera"],
    renderedCamera: Camera
  ): void {
    this.#trackLocalReconciliationTelemetry(nowMs);
    this.#trackRenderedCameraPresentationTelemetry(
      nowMs,
      referenceCameraSnapshot,
      renderedCamera
    );
  }

  createSnapshot(
    nowMs: number,
    input: CreateTelemetrySnapshotInput
  ): MetaverseHudSnapshot["telemetry"] {
    const renderInfo = input.renderer?.info?.render;
    const worldSamplingTelemetry =
      this.#remoteWorldRuntime.samplingTelemetrySnapshot;

    return freezeTelemetrySnapshot({
      frameDeltaMs: input.frameDeltaMs,
      frameRate: input.frameRate,
      localHeldWeaponGrip: this.#readLocalHeldWeaponGripTelemetrySnapshot(nowMs),
      projectilePresentation:
        this.#readProjectilePresentationTelemetrySnapshots(),
      renderedFrameCount: input.renderedFrameCount,
      renderer: {
        active: input.renderer !== null,
        devicePixelRatio: this.#devicePixelRatio,
        drawCallCount: renderInfo?.drawCalls ?? renderInfo?.calls ?? 0,
        label: "WebGPU",
        triangleCount: renderInfo?.triangles ?? 0
      },
      worldCadence: {
        authoritativeTickIntervalMs:
          this.#remoteWorldRuntime.latestAuthoritativeTickIntervalMs,
        localAuthoritativeFreshnessMaxAgeMs:
          metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs,
        maxExtrapolationMs: metaverseRemoteWorldSamplingConfig.maxExtrapolationMs,
        remoteInterpolationDelayMs:
          metaverseRemoteWorldSamplingConfig.interpolationDelayMs,
        worldPollIntervalMs:
          this.#remoteWorldRuntime.currentPollIntervalMs ??
          Number(metaverseWorldClientConfig.defaultPollIntervalMs)
      },
      worldSnapshot: {
        bufferDepth: worldSamplingTelemetry.bufferDepth,
        cameraPresentation:
          this.#createCameraPresentationTelemetrySnapshot(nowMs),
        clockOffsetEstimateMs: worldSamplingTelemetry.clockOffsetEstimateMs,
        currentExtrapolationMs: worldSamplingTelemetry.currentExtrapolationMs,
        datagramSendFailureCount:
          worldSamplingTelemetry.datagramSendFailureCount,
        extrapolatedFramePercent:
          worldSamplingTelemetry.extrapolatedFramePercent,
        localReconciliation:
          this.#createLocalReconciliationTelemetrySnapshot(nowMs),
        localReconciliationCorrectionCount:
          this.#traversalRuntime.localReconciliationCorrectionCount,
        surfaceRouting: this.#createSurfaceRoutingTelemetrySnapshot(),
        latestSimulationAgeMs: worldSamplingTelemetry.latestSimulationAgeMs,
        latestSnapshotUpdateRateHz:
          worldSamplingTelemetry.latestSnapshotUpdateRateHz
      }
    });
  }

  #createSurfaceRoutingTelemetrySnapshot():
    MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"] {
    const issuedTraversalIntent =
      this.#traversalRuntime.latestIssuedTraversalIntentSnapshot;
    const authoritativeLocalPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );
    const localTraversalPose = this.#traversalRuntime.localTraversalPoseSnapshot;
    const localLocomotionMode = this.#traversalRuntime.locomotionMode;
    const authoritativeActiveBodySnapshot =
      authoritativeLocalPlayerSnapshot === null
        ? null
        : readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
            authoritativeLocalPlayerSnapshot
          );
    const authoritativeLocalPlayerCorrectionPlanarMagnitudeMeters =
      authoritativeActiveBodySnapshot !== null && localTraversalPose !== null
        ? Math.hypot(
            authoritativeActiveBodySnapshot.position.x -
              localTraversalPose.position.x,
            authoritativeActiveBodySnapshot.position.z -
              localTraversalPose.position.z
          )
        : null;
    const authoritativeLocalPlayerCorrectionVerticalMagnitudeMeters =
      authoritativeActiveBodySnapshot !== null && localTraversalPose !== null
        ? Math.abs(
            authoritativeActiveBodySnapshot.position.y -
              localTraversalPose.position.y
          )
        : null;
    const authoritativeLocalPlayerGroundedBodyActive =
      authoritativeLocalPlayerSnapshot?.locomotionMode === "grounded";
    const latestFireWeaponActionReceipt =
      authoritativeLocalPlayerSnapshot === null
        ? null
        : readLatestFireWeaponActionReceipt(
            authoritativeLocalPlayerSnapshot.recentPlayerActionReceipts
          );
    const authoritativeLocalPlayerSurfaceRouting =
      authoritativeLocalPlayerSnapshot !== null &&
      authoritativeActiveBodySnapshot !== null &&
      (authoritativeLocalPlayerSnapshot.locomotionMode === "grounded" ||
        authoritativeLocalPlayerSnapshot.locomotionMode === "swim")
        ? resolveAutomaticSurfaceLocomotionSnapshot(
            this.#config,
            this.#environmentPhysicsRuntime.surfaceColliderSnapshots,
            authoritativeActiveBodySnapshot.position,
            authoritativeActiveBodySnapshot.yawRadians,
            authoritativeLocalPlayerSnapshot.locomotionMode
          )
        : null;

    return Object.freeze({
      authoritativeCorrection:
        this.#traversalRuntime.authoritativeCorrectionTelemetrySnapshot,
      authoritativeLocalPlayer: Object.freeze({
        combatAction: Object.freeze({
          actionSequence: latestFireWeaponActionReceipt?.actionSequence ?? null,
          kind: latestFireWeaponActionReceipt?.kind ?? null,
          highestProcessedPlayerActionSequence:
            authoritativeLocalPlayerSnapshot
              ?.highestProcessedPlayerActionSequence ?? null,
          processedAtTimeMs:
            latestFireWeaponActionReceipt == null
              ? null
              : Number(latestFireWeaponActionReceipt.processedAtTimeMs),
          sourceProjectileId:
            latestFireWeaponActionReceipt?.sourceProjectileId ?? null,
          rejectionReason:
            latestFireWeaponActionReceipt?.rejectionReason ?? null,
          shotResolution:
            authoritativeLocalPlayerSnapshot?.latestShotResolutionTelemetry ?? null,
          status: latestFireWeaponActionReceipt?.status ?? null,
          weaponId: latestFireWeaponActionReceipt?.weaponId ?? null
        }),
        correctionPlanarMagnitudeMeters:
          authoritativeLocalPlayerCorrectionPlanarMagnitudeMeters,
        correctionVerticalMagnitudeMeters:
          authoritativeLocalPlayerCorrectionVerticalMagnitudeMeters,
        groundedBody:
          !authoritativeLocalPlayerGroundedBodyActive ||
          authoritativeLocalPlayerSnapshot?.groundedBody == null
            ? null
            : freezeGroundedBodyTelemetrySnapshot(
                authoritativeLocalPlayerSnapshot.groundedBody
              ),
        jumpDebug: Object.freeze({
          pendingActionSequence:
            !authoritativeLocalPlayerGroundedBodyActive ||
            authoritativeLocalPlayerSnapshot === null
              ? null
              : authoritativeLocalPlayerSnapshot.jumpDebug
                  .pendingActionSequence,
          pendingActionBufferAgeMs:
            !authoritativeLocalPlayerGroundedBodyActive
              ? null
              : authoritativeLocalPlayerSnapshot?.jumpDebug
                  .pendingActionBufferAgeMs ??
            null,
          resolvedActionSequence:
            !authoritativeLocalPlayerGroundedBodyActive ||
            authoritativeLocalPlayerSnapshot === null
              ? null
              : authoritativeLocalPlayerSnapshot.jumpDebug
                  .resolvedActionSequence,
          resolvedActionState:
            !authoritativeLocalPlayerGroundedBodyActive
              ? null
              : authoritativeLocalPlayerSnapshot?.jumpDebug.resolvedActionState ??
            null
        }),
        lastProcessedTraversalSequence:
          authoritativeLocalPlayerSnapshot?.lastProcessedTraversalSequence ?? null,
        locomotionMismatch:
          authoritativeLocalPlayerSnapshot?.locomotionMode !== undefined &&
          authoritativeLocalPlayerSnapshot.locomotionMode !== localLocomotionMode,
        locomotionMode: authoritativeLocalPlayerSnapshot?.locomotionMode ?? null,
        swimBody:
          authoritativeLocalPlayerSnapshot?.swimBody == null
            ? null
            : freezeSwimBodyTelemetrySnapshot(
                authoritativeLocalPlayerSnapshot.swimBody
              ),
        position:
          authoritativeActiveBodySnapshot === null
            ? null
            : Object.freeze({
                x: authoritativeActiveBodySnapshot.position.x,
                y: authoritativeActiveBodySnapshot.position.y,
                z: authoritativeActiveBodySnapshot.position.z
              }),
        traversalAuthority: Object.freeze({
          currentActionKind:
            authoritativeLocalPlayerSnapshot?.traversalAuthority
              .currentActionKind ?? null,
          currentActionPhase:
            authoritativeLocalPlayerSnapshot?.traversalAuthority
              .currentActionPhase ?? null,
          currentActionSequence:
            authoritativeLocalPlayerSnapshot === null
              ? null
              : authoritativeLocalPlayerSnapshot.traversalAuthority
                  .currentActionSequence,
          lastConsumedActionSequence:
            authoritativeLocalPlayerSnapshot === null
              ? null
              : authoritativeLocalPlayerSnapshot.traversalAuthority
                  .lastConsumedActionSequence,
          lastRejectedActionReason:
            authoritativeLocalPlayerSnapshot?.traversalAuthority
              .lastRejectedActionReason ?? null,
          lastRejectedActionSequence:
            authoritativeLocalPlayerSnapshot === null
              ? null
              : authoritativeLocalPlayerSnapshot.traversalAuthority
                  .lastRejectedActionSequence,
          phaseStartedAtTick:
            authoritativeLocalPlayerSnapshot === null
              ? null
              : authoritativeLocalPlayerSnapshot.traversalAuthority
                  .phaseStartedAtTick
        }),
        surfaceRouting: Object.freeze({
          blockingAffordanceDetected:
            authoritativeLocalPlayerSurfaceRouting?.debug
              .blockingAffordanceDetected ?? null,
          decisionReason:
            authoritativeLocalPlayerSurfaceRouting?.debug.reason ?? null,
          resolvedSupportHeightMeters:
            authoritativeLocalPlayerSurfaceRouting?.debug
              .resolvedSupportHeightMeters ?? null,
          supportingAffordanceSampleCount:
            authoritativeLocalPlayerSurfaceRouting?.debug
              .supportingAffordanceSampleCount ?? null
        })
      }),
      issuedTraversalIntent:
        issuedTraversalIntent === null
          ? null
          : Object.freeze({
              actionIntent: issuedTraversalIntent.actionIntent,
              bodyControl: issuedTraversalIntent.bodyControl,
              sequence: issuedTraversalIntent.sequence,
              locomotionMode: issuedTraversalIntent.locomotionMode
            }),
      local: this.#traversalRuntime.surfaceRoutingLocalTelemetrySnapshot
    });
  }

  #trackLocalReconciliationTelemetry(nowMs: number): void {
    const totalCorrectionCount =
      this.#traversalRuntime.localReconciliationCorrectionCount;
    const correctionCountDelta =
      totalCorrectionCount - this.#lastObservedLocalReconciliationTotalCount;
    const correctionSource =
      this.#traversalRuntime.lastLocalReconciliationCorrectionSource;

    if (correctionCountDelta > 0 && correctionSource !== "none") {
      for (
        let correctionIndex = 0;
        correctionIndex < correctionCountDelta;
        correctionIndex += 1
      ) {
        this.#recentLocalReconciliationEvents.push({
          atMs: nowMs,
          source: correctionSource
        });
      }

      this.#lastLocalReconciliationAtMs = nowMs;
    }

    this.#lastObservedLocalReconciliationTotalCount = totalCorrectionCount;
    this.#pruneRecentLocalReconciliationEvents(nowMs);
  }

  #pruneRecentLocalReconciliationEvents(nowMs: number): void {
    const oldestIncludedEventAtMs =
      nowMs - metaverseRecentLocalReconciliationWindowMs;

    while (
      this.#recentLocalReconciliationEvents[0]?.atMs !== undefined &&
      this.#recentLocalReconciliationEvents[0].atMs < oldestIncludedEventAtMs
    ) {
      this.#recentLocalReconciliationEvents.shift();
    }
  }

  #trackRenderedCameraPresentationTelemetry(
    nowMs: number,
    referenceCameraSnapshot: MetaverseHudSnapshot["camera"],
    renderedCamera: Camera
  ): void {
    const renderedCameraOffsetSnapshot =
      createRenderedCameraOffsetTelemetrySnapshot(
        referenceCameraSnapshot,
        renderedCamera
      );

    if (this.#lastRenderedCameraOffsetSnapshot !== null) {
      const renderedCameraOffsetDeltaSnapshot =
        createRenderedCameraOffsetDeltaTelemetrySnapshot(
          this.#lastRenderedCameraOffsetSnapshot,
          renderedCameraOffsetSnapshot
        );
      const large = isLargeRenderedCameraSnap(renderedCameraOffsetDeltaSnapshot);

      if (
        renderedCameraOffsetDeltaSnapshot.planarMagnitudeMeters > 0.000001 ||
        renderedCameraOffsetDeltaSnapshot.verticalMagnitudeMeters > 0.000001 ||
        renderedCameraOffsetDeltaSnapshot.lookAngleRadians > 0.000001
      ) {
        this.#recentRenderedCameraOffsetDeltaEvents.push({
          atMs: nowMs,
          large,
          lookAngleRadians:
            renderedCameraOffsetDeltaSnapshot.lookAngleRadians,
          planarMagnitudeMeters:
            renderedCameraOffsetDeltaSnapshot.planarMagnitudeMeters,
          verticalMagnitudeMeters:
            renderedCameraOffsetDeltaSnapshot.verticalMagnitudeMeters
        });
      }

      if (large) {
        this.#renderedCameraSnapCount += 1;
        this.#lastRenderedCameraSnapAtMs = nowMs;
      }
    }

    this.#lastRenderedCameraOffsetSnapshot = renderedCameraOffsetSnapshot;
    this.#pruneRecentRenderedCameraOffsetDeltaEvents(nowMs);
  }

  #pruneRecentRenderedCameraOffsetDeltaEvents(nowMs: number): void {
    const oldestIncludedEventAtMs =
      nowMs - metaverseRecentLocalReconciliationWindowMs;

    while (
      this.#recentRenderedCameraOffsetDeltaEvents[0]?.atMs !== undefined &&
      this.#recentRenderedCameraOffsetDeltaEvents[0].atMs <
        oldestIncludedEventAtMs
    ) {
      this.#recentRenderedCameraOffsetDeltaEvents.shift();
    }
  }

  #createLocalReconciliationTelemetrySnapshot(
    nowMs: number
  ): MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"] {
    let recentLocalAuthorityPoseCorrectionCountPast5Seconds = 0;
    let recentLocalAuthorityPoseConvergenceEpisodeCountPast5Seconds = 0;
    let recentLocalAuthorityPoseConvergenceStepCountPast5Seconds = 0;
    let recentMountedVehicleAuthorityCorrectionCountPast5Seconds = 0;

    for (const correctionEvent of this.#recentLocalReconciliationEvents) {
      switch (correctionEvent.source) {
        case "local-authority-convergence-episode":
          recentLocalAuthorityPoseCorrectionCountPast5Seconds += 1;
          recentLocalAuthorityPoseConvergenceEpisodeCountPast5Seconds += 1;
          break;
        case "local-authority-convergence-step":
          recentLocalAuthorityPoseCorrectionCountPast5Seconds += 1;
          recentLocalAuthorityPoseConvergenceStepCountPast5Seconds += 1;
          break;
        case "mounted-vehicle-authority":
          recentMountedVehicleAuthorityCorrectionCountPast5Seconds += 1;
          break;
      }
    }

    return Object.freeze({
      lastLocalAuthorityPoseCorrectionDetail:
        this.#traversalRuntime.lastLocalAuthorityPoseCorrectionDetail,
      lastLocalAuthorityPoseCorrectionSnapshot:
        this.#traversalRuntime.lastLocalAuthorityPoseCorrectionSnapshot,
      lastLocalAuthorityPoseCorrectionReason:
        this.#traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      lastCorrectionAgeMs:
        this.#lastLocalReconciliationAtMs === null
          ? null
          : Math.max(0, nowMs - this.#lastLocalReconciliationAtMs),
      lastCorrectionSource:
        this.#traversalRuntime.lastLocalReconciliationCorrectionSource,
      localAuthorityPoseCorrectionCount:
        this.#traversalRuntime.localAuthorityPoseCorrectionCount,
      localAuthorityPoseConvergenceEpisodeCount:
        this.#traversalRuntime.localAuthorityPoseConvergenceEpisodeCount,
      localAuthorityPoseConvergenceStepCount:
        this.#traversalRuntime.localAuthorityPoseConvergenceStepCount,
      mountedVehicleAuthorityCorrectionCount:
        this.#traversalRuntime.mountedVehicleAuthorityCorrectionCount,
      recentCorrectionCountPast5Seconds:
        this.#recentLocalReconciliationEvents.length,
      recentLocalAuthorityPoseCorrectionCountPast5Seconds,
      recentLocalAuthorityPoseConvergenceEpisodeCountPast5Seconds,
      recentLocalAuthorityPoseConvergenceStepCountPast5Seconds,
      recentMountedVehicleAuthorityCorrectionCountPast5Seconds,
      totalCorrectionCount:
        this.#traversalRuntime.localReconciliationCorrectionCount
    });
  }

  #createCameraPresentationTelemetrySnapshot(
    nowMs: number
  ): MetaverseTelemetrySnapshot["worldSnapshot"]["cameraPresentation"] {
    let maxLookAngleRadiansPast5Seconds = 0;
    let maxPlanarMagnitudeMetersPast5Seconds = 0;
    let maxVerticalMagnitudeMetersPast5Seconds = 0;
    let recentCountPast5Seconds = 0;

    for (const offsetDeltaEvent of this.#recentRenderedCameraOffsetDeltaEvents) {
      maxLookAngleRadiansPast5Seconds = Math.max(
        maxLookAngleRadiansPast5Seconds,
        offsetDeltaEvent.lookAngleRadians
      );
      maxPlanarMagnitudeMetersPast5Seconds = Math.max(
        maxPlanarMagnitudeMetersPast5Seconds,
        offsetDeltaEvent.planarMagnitudeMeters
      );
      maxVerticalMagnitudeMetersPast5Seconds = Math.max(
        maxVerticalMagnitudeMetersPast5Seconds,
        offsetDeltaEvent.verticalMagnitudeMeters
      );

      if (offsetDeltaEvent.large) {
        recentCountPast5Seconds += 1;
      }
    }

    return Object.freeze({
      renderedOffset:
        this.#lastRenderedCameraOffsetSnapshot ??
        Object.freeze({
          lookAngleRadians: 0,
          planarMagnitudeMeters: 0,
          verticalMagnitudeMeters: 0
        }),
      renderedSnap: Object.freeze({
        lastAgeMs:
          this.#lastRenderedCameraSnapAtMs === null
            ? null
            : Math.max(0, nowMs - this.#lastRenderedCameraSnapAtMs),
        maxLookAngleRadiansPast5Seconds,
        maxPlanarMagnitudeMetersPast5Seconds,
        maxVerticalMagnitudeMetersPast5Seconds,
        recentCountPast5Seconds,
        totalCount: this.#renderedCameraSnapCount
      })
    });
  }
}
