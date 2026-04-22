import {
  createMetaverseGroundedBodyContactSnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  createMetaverseSurfaceTraversalDriveTargetSnapshot,
  type MetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseGroundedBodyRuntime } from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type { MetaverseTelemetrySnapshot } from "../../types/telemetry";
import {
  resolveAutomaticSurfaceLocomotionSnapshot,
  readMetaverseSurfacePolicyConfig
} from "../policies/surface-routing";
import type { MetaverseLocalTraversalAuthorityState } from "./metaverse-local-traversal-authority-state";
import type { MetaverseLocalAuthorityReconciliationState } from "../reconciliation/classes/metaverse-local-authority-reconciliation-state";
import type { AuthoritativeLocalPlayerPoseSnapshot } from "../reconciliation/classes/metaverse-local-authority-reconciliation-state";
import type { LocalTraversalPoseSnapshot } from "../reconciliation/local-authority-pose-correction";
import type {
  MetaverseIssuedTraversalIntentSnapshot,
  MetaverseTraversalRuntimeDependencies,
  SurfaceLocomotionSnapshot
} from "../types/traversal";
import type { MetaverseUnmountedSurfaceLocomotionState } from "../surface/metaverse-unmounted-surface-locomotion-state";

type LocalSurfaceRoutingTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"];
type LocalGroundedBodyTelemetrySnapshot =
  NonNullable<LocalSurfaceRoutingTelemetrySnapshot["groundedBody"]>;
type LocalGroundedJumpBodyTelemetrySnapshot =
  LocalGroundedBodyTelemetrySnapshot["jumpBody"];
type LocalReconciliationCorrectionSource =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastCorrectionSource"];
type LocalAuthorityPoseCorrectionSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"];

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
  snapshot: MetaverseIssuedTraversalIntentSnapshot | null
): NonNullable<
  NonNullable<LocalAuthorityPoseCorrectionSnapshot>["local"]["issuedTraversalIntent"]
> | null {
  if (snapshot === null) {
    return null;
  }

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

function freezeGroundedJumpBodyTelemetrySnapshot(
  snapshot: {
    readonly grounded: boolean;
    readonly jumpGroundContactGraceSecondsRemaining: number;
    readonly jumpReady: boolean;
    readonly jumpSnapSuppressionActive: boolean;
    readonly verticalSpeedUnitsPerSecond: number;
  }
): LocalGroundedJumpBodyTelemetrySnapshot {
  return Object.freeze({
    grounded: snapshot.grounded,
    jumpGroundContactGraceSecondsRemaining:
      snapshot.jumpGroundContactGraceSecondsRemaining,
    jumpReady: snapshot.jumpReady,
    jumpSnapSuppressionActive: snapshot.jumpSnapSuppressionActive,
    verticalSpeedUnitsPerSecond: snapshot.verticalSpeedUnitsPerSecond
  });
}

function freezeGroundedBodyContactTelemetrySnapshot(snapshot: {
  readonly appliedMovementDelta?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly blockedPlanarMovement?: boolean;
  readonly blockedVerticalMovement?: boolean;
  readonly desiredMovementDelta?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly supportingContactDetected: boolean;
}) {
  return createMetaverseGroundedBodyContactSnapshot(snapshot);
}

function freezeGroundedBodyDriveTargetTelemetrySnapshot(snapshot: {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly movementMagnitude: number;
  readonly strafeAxis: number;
  readonly targetForwardSpeedUnitsPerSecond: number;
  readonly targetPlanarSpeedUnitsPerSecond: number;
  readonly targetStrafeSpeedUnitsPerSecond: number;
}) {
  return createMetaverseSurfaceTraversalDriveTargetSnapshot(snapshot);
}

function freezeGroundedBodyInteractionTelemetrySnapshot(snapshot: {
  readonly applyImpulsesToDynamicBodies: boolean;
}) {
  return createMetaverseGroundedBodyInteractionSnapshot(snapshot);
}

function freezeGroundedBodyTelemetrySnapshot(snapshot: {
  readonly contact: {
    readonly appliedMovementDelta?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly blockedPlanarMovement?: boolean;
    readonly blockedVerticalMovement?: boolean;
    readonly desiredMovementDelta?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly supportingContactDetected: boolean;
  };
  readonly driveTarget: {
    readonly boost: boolean;
    readonly moveAxis: number;
    readonly movementMagnitude: number;
    readonly strafeAxis: number;
    readonly targetForwardSpeedUnitsPerSecond: number;
    readonly targetPlanarSpeedUnitsPerSecond: number;
    readonly targetStrafeSpeedUnitsPerSecond: number;
  };
  readonly interaction: {
    readonly applyImpulsesToDynamicBodies: boolean;
  };
  readonly jumpBody: {
    readonly grounded: boolean;
    readonly jumpGroundContactGraceSecondsRemaining: number;
    readonly jumpReady: boolean;
    readonly jumpSnapSuppressionActive: boolean;
    readonly verticalSpeedUnitsPerSecond: number;
  };
}): LocalGroundedBodyTelemetrySnapshot {
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
  snapshot: SurfaceLocomotionSnapshot
): NonNullable<
  NonNullable<LocalAuthorityPoseCorrectionSnapshot>["authoritative"]["swimBody"]
> {
  return createMetaverseSurfaceDriveBodyRuntimeSnapshot(snapshot);
}

interface MetaverseTraversalTelemetryStateDependencies {
  readonly config: MetaverseRuntimeConfig;
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly localAuthorityReconciliationState: MetaverseLocalAuthorityReconciliationState;
  readonly localTraversalAuthorityState: MetaverseLocalTraversalAuthorityState;
  readonly readLocomotionMode: () => MetaverseLocomotionModeId;
  readonly surfaceColliderSnapshots:
    MetaverseTraversalRuntimeDependencies["surfaceColliderSnapshots"];
  readonly surfaceLocomotionState: MetaverseUnmountedSurfaceLocomotionState;
}

export class MetaverseTraversalTelemetryState {
  readonly #dependencies: MetaverseTraversalTelemetryStateDependencies;

  #localReconciliationCorrectionCount = 0;
  #mountedVehicleAuthorityCorrectionCount = 0;
  #lastLocalReconciliationCorrectionSource: LocalReconciliationCorrectionSource =
    "none";

  constructor(dependencies: MetaverseTraversalTelemetryStateDependencies) {
    this.#dependencies = dependencies;
  }

  get authoritativeCorrectionTelemetrySnapshot() {
    return this.#dependencies.localAuthorityReconciliationState
      .authoritativeCorrectionTelemetrySnapshot;
  }

  get lastLocalAuthorityPoseCorrectionDetail() {
    return this.#dependencies.localAuthorityReconciliationState
      .lastLocalAuthorityPoseCorrectionDetail;
  }

  get lastLocalAuthorityPoseCorrectionSnapshot():
    LocalAuthorityPoseCorrectionSnapshot {
    return this.#dependencies.localAuthorityReconciliationState
      .lastLocalAuthorityPoseCorrectionSnapshot;
  }

  get lastLocalAuthorityPoseCorrectionReason() {
    return this.#dependencies.localAuthorityReconciliationState
      .lastLocalAuthorityPoseCorrectionReason;
  }

  get lastLocalReconciliationCorrectionSource(): LocalReconciliationCorrectionSource {
    return this.#lastLocalReconciliationCorrectionSource;
  }

  get localAuthorityPoseCorrectionCount(): number {
    return this.#dependencies.localAuthorityReconciliationState
      .localAuthorityPoseCorrectionCount;
  }

  get localAuthorityPoseConvergenceEpisodeCount(): number {
    return this.#dependencies.localAuthorityReconciliationState
      .localAuthorityPoseConvergenceEpisodeCount;
  }

  get localAuthorityPoseConvergenceStepCount(): number {
    return this.#dependencies.localAuthorityReconciliationState
      .localAuthorityPoseConvergenceStepCount;
  }

  get localReconciliationCorrectionCount(): number {
    return this.#localReconciliationCorrectionCount;
  }

  get mountedVehicleAuthorityCorrectionCount(): number {
    return this.#mountedVehicleAuthorityCorrectionCount;
  }

  get surfaceRoutingLocalTelemetrySnapshot(): LocalSurfaceRoutingTelemetrySnapshot {
    const automaticSurfaceTelemetrySnapshot =
      this.#dependencies.surfaceLocomotionState
        .latestAutomaticSurfaceTelemetrySnapshot;
    const automaticSurfaceDebug =
      automaticSurfaceTelemetrySnapshot.automaticSurfaceSnapshot.debug;
    const localSwimSnapshot =
      this.#dependencies.readLocomotionMode() === "swim"
        ? this.#dependencies.surfaceLocomotionState.readSwimSnapshot()
        : null;

    return Object.freeze({
      autostepHeightMeters: automaticSurfaceTelemetrySnapshot.autostepHeightMeters,
      blockingAffordanceDetected:
        automaticSurfaceDebug.blockingAffordanceDetected,
      decisionReason: automaticSurfaceDebug.reason,
      groundedBody:
        this.#dependencies.groundedBodyRuntime.isInitialized &&
        this.#dependencies.readLocomotionMode() === "grounded"
          ? freezeGroundedBodyTelemetrySnapshot({
              contact:
                this.#dependencies.groundedBodyRuntime.snapshot.contact ?? {
                  supportingContactDetected:
                    this.#dependencies.groundedBodyRuntime.snapshot.grounded
                },
              driveTarget: this.#dependencies.groundedBodyRuntime.snapshot
                .driveTarget,
              interaction: this.#dependencies.groundedBodyRuntime.snapshot
                .interaction,
              jumpBody: this.#dependencies.groundedBodyRuntime.snapshot.jumpBody
            })
          : null,
      locomotionMode: this.#dependencies.readLocomotionMode(),
      resolvedSupportHeightMeters:
        automaticSurfaceDebug.resolvedSupportHeightMeters,
      swimBody:
        localSwimSnapshot === null
          ? null
          : freezeSwimBodyTelemetrySnapshot(localSwimSnapshot),
      supportingAffordanceSampleCount:
        automaticSurfaceDebug.supportingAffordanceSampleCount,
      traversalAuthority: this.#readLocalTraversalAuthoritySnapshot()
    });
  }

  createLocalAuthorityPoseCorrectionSnapshot({
    authoritativePlayerSnapshot,
    localGroundedBodySnapshot,
    localIssuedTraversalIntentSnapshot,
    localSwimBodySnapshot,
    localTraversalPose
  }: {
    readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
    readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
    readonly localIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null;
    readonly localSwimBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["swimBody"] | null;
    readonly localTraversalPose: LocalTraversalPoseSnapshot;
  }): NonNullable<LocalAuthorityPoseCorrectionSnapshot> {
    const localLinearVelocity =
      localTraversalPose.locomotionMode === "swim"
        ? localSwimBodySnapshot?.linearVelocity ??
          Object.freeze({ x: 0, y: 0, z: 0 })
        : localGroundedBodySnapshot?.linearVelocity ??
          Object.freeze({ x: 0, y: 0, z: 0 });
    const authoritativeSwimSnapshot =
      authoritativePlayerSnapshot.locomotionMode === "swim"
        ? authoritativePlayerSnapshot.swimBody
        : null;
    const authoritativeActiveBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        authoritativePlayerSnapshot
      );
    const authoritativeSurfaceRoutingPosition =
      authoritativeActiveBodySnapshot.position;
    const authoritativeSurfaceRoutingYawRadians =
      authoritativeActiveBodySnapshot.yawRadians;
    const authoritativeSurfaceRouting =
      resolveAutomaticSurfaceLocomotionSnapshot(
        this.#dependencies.config,
        this.#dependencies.surfaceColliderSnapshots,
        authoritativeSurfaceRoutingPosition,
        authoritativeSurfaceRoutingYawRadians,
        authoritativePlayerSnapshot.locomotionMode === "swim"
          ? "swim"
          : "grounded"
      );

    return Object.freeze({
      authoritative: Object.freeze({
        groundedBody:
          authoritativePlayerSnapshot.locomotionMode === "grounded" &&
          authoritativePlayerSnapshot.groundedBody != null
            ? freezeGroundedBodyTelemetrySnapshot(
                authoritativePlayerSnapshot.groundedBody
              )
            : null,
        lastProcessedTraversalSequence:
          authoritativePlayerSnapshot.lastProcessedTraversalSequence ?? 0,
        linearVelocity: freezeVector3Snapshot(
          authoritativeActiveBodySnapshot.linearVelocity
        ),
        locomotionMode: authoritativePlayerSnapshot.locomotionMode,
        position: freezeVector3Snapshot(authoritativeActiveBodySnapshot.position),
        swimBody:
          authoritativeSwimSnapshot === null
            ? null
            : freezeSwimBodyTelemetrySnapshot(authoritativeSwimSnapshot),
        surfaceRouting: Object.freeze({
          blockingAffordanceDetected:
            authoritativeSurfaceRouting.debug.blockingAffordanceDetected,
          decisionReason: authoritativeSurfaceRouting.debug.reason,
          resolvedSupportHeightMeters:
            authoritativeSurfaceRouting.debug.resolvedSupportHeightMeters,
          supportingAffordanceSampleCount:
            authoritativeSurfaceRouting.debug.supportingAffordanceSampleCount
        })
      }),
      local: Object.freeze({
        groundedBody:
          localTraversalPose.locomotionMode === "grounded" &&
          localGroundedBodySnapshot !== null
            ? freezeGroundedBodyTelemetrySnapshot({
                contact:
                  localGroundedBodySnapshot.contact ?? {
                    supportingContactDetected:
                      localGroundedBodySnapshot.grounded
                  },
                driveTarget: localGroundedBodySnapshot.driveTarget,
                interaction: localGroundedBodySnapshot.interaction,
                jumpBody: localGroundedBodySnapshot.jumpBody
              })
            : null,
        issuedTraversalIntent: freezeIssuedTraversalIntentSnapshot(
          localIssuedTraversalIntentSnapshot
        ),
        linearVelocity: freezeVector3Snapshot(localLinearVelocity),
        locomotionMode: localTraversalPose.locomotionMode,
        position: freezeVector3Snapshot(localTraversalPose.position),
        swimBody:
          localSwimBodySnapshot === null
            ? null
            : freezeSwimBodyTelemetrySnapshot(localSwimBodySnapshot),
        surfaceRouting: this.surfaceRoutingLocalTelemetrySnapshot
      })
    });
  }

  recordLocalAuthorityConvergence({
    episodeStarted
  }: {
    readonly episodeStarted: boolean;
  }): void {
    this.#localReconciliationCorrectionCount += 1;
    this.#lastLocalReconciliationCorrectionSource =
      episodeStarted
        ? "local-authority-convergence-episode"
        : "local-authority-convergence-step";
  }

  recordMountedVehicleAuthorityCorrection(): void {
    this.#localReconciliationCorrectionCount += 1;
    this.#mountedVehicleAuthorityCorrectionCount += 1;
    this.#lastLocalReconciliationCorrectionSource =
      "mounted-vehicle-authority";
  }

  reset(): void {
    this.#localReconciliationCorrectionCount = 0;
    this.#mountedVehicleAuthorityCorrectionCount = 0;
    this.#lastLocalReconciliationCorrectionSource = "none";
    this.#dependencies.localAuthorityReconciliationState.reset();
  }

  #readLocalTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
    return this.#dependencies.localTraversalAuthorityState.snapshot;
  }
}
