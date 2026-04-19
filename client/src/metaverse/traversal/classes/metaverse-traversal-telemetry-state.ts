import {
  resolveMetaverseUnmountedGroundedJumpSupport,
  type MetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared";
import type {
  MetaversePlayerTraversalIntentSnapshot
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
import type { MetaverseTraversalRuntimeDependencies } from "../types/traversal";
import type { MetaverseUnmountedSurfaceLocomotionState } from "../surface/metaverse-unmounted-surface-locomotion-state";

type LocalSurfaceRoutingTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"];
type LocalJumpGateTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"]["jumpDebug"];
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
  snapshot: MetaversePlayerTraversalIntentSnapshot | null
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
    inputSequence: snapshot.inputSequence,
    locomotionMode: snapshot.locomotionMode
  });
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

type SwimVelocitySnapshot = {
  readonly linearVelocity?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
};

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

  get localGroundedJumpGateTelemetrySnapshot(): LocalJumpGateTelemetrySnapshot {
    if (
      !this.#dependencies.groundedBodyRuntime.isInitialized ||
      this.#dependencies.readLocomotionMode() !== "grounded"
    ) {
      return Object.freeze({
        groundedBodyGrounded: null,
        groundedBodyJumpReady: null,
        surfaceJumpSupported: null,
        supported: null,
        verticalSpeedUnitsPerSecond: null
      });
    }

    const groundedBodySnapshot =
      this.#dependencies.groundedBodyRuntime.snapshot;
    const groundedJumpSupport = resolveMetaverseUnmountedGroundedJumpSupport({
      controllerOffsetMeters:
        this.#dependencies.config.groundedBody.controllerOffsetMeters,
      groundedBodySnapshot,
      jumpSupportVerticalSpeedTolerance:
        this.#dependencies.config.traversal
          .groundedJumpSupportVerticalSpeedTolerance,
      snapToGroundDistanceMeters:
        this.#dependencies.config.groundedBody.snapToGroundDistanceMeters,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(
        this.#dependencies.config
      ),
      waterRegionSnapshots: this.#dependencies.config.waterRegionSnapshots
    });

    return Object.freeze({
      groundedBodyGrounded: groundedBodySnapshot.grounded,
      groundedBodyJumpReady: groundedBodySnapshot.jumpReady,
      surfaceJumpSupported: groundedJumpSupport.surfaceJumpSupported,
      supported: groundedJumpSupport.groundedJumpSupported,
      verticalSpeedUnitsPerSecond:
        groundedBodySnapshot.verticalSpeedUnitsPerSecond
    });
  }

  get localReconciliationCorrectionCount(): number {
    return this.#localReconciliationCorrectionCount;
  }

  get mountedVehicleAuthorityCorrectionCount(): number {
    return this.#mountedVehicleAuthorityCorrectionCount;
  }

  get surfaceRoutingLocalTelemetrySnapshot(): LocalSurfaceRoutingTelemetrySnapshot {
    return Object.freeze({
      autostepHeightMeters:
        this.#dependencies.surfaceLocomotionState.latestAutostepHeightMeters,
      blockingAffordanceDetected:
        this.#dependencies.surfaceLocomotionState
          .latestBlockingAffordanceDetected,
      decisionReason:
        this.#dependencies.surfaceLocomotionState
          .latestAutomaticSurfaceDecisionReason,
      jumpDebug: this.localGroundedJumpGateTelemetrySnapshot,
      locomotionMode: this.#dependencies.readLocomotionMode(),
      resolvedSupportHeightMeters:
        this.#dependencies.surfaceLocomotionState
          .latestResolvedSupportHeightMeters,
      supportingAffordanceSampleCount:
        this.#dependencies.surfaceLocomotionState
          .latestSupportingAffordanceSampleCount,
      traversalAuthority: this.#readLocalTraversalAuthoritySnapshot()
    });
  }

  createLocalAuthorityPoseCorrectionSnapshot({
    authoritativePlayerSnapshot,
    localTraversalPose
  }: {
    readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
    readonly localTraversalPose: LocalTraversalPoseSnapshot;
  }): NonNullable<LocalAuthorityPoseCorrectionSnapshot> {
    const localSwimLinearVelocity =
      (
        this.#dependencies.surfaceLocomotionState.readSwimSnapshot() as
          | SwimVelocitySnapshot
          | null
      )?.linearVelocity ?? Object.freeze({ x: 0, y: 0, z: 0 });
    const localLinearVelocity =
      localTraversalPose.locomotionMode === "swim"
        ? localSwimLinearVelocity
        : this.#dependencies.groundedBodyRuntime.isInitialized
          ? this.#dependencies.groundedBodyRuntime.linearVelocitySnapshot
          : Object.freeze({ x: 0, y: 0, z: 0 });
    const authoritativeSurfaceRouting =
      resolveAutomaticSurfaceLocomotionSnapshot(
        this.#dependencies.config,
        this.#dependencies.surfaceColliderSnapshots,
        authoritativePlayerSnapshot.position,
        authoritativePlayerSnapshot.yawRadians,
        authoritativePlayerSnapshot.locomotionMode === "swim"
          ? "swim"
          : "grounded"
      );

    return Object.freeze({
      authoritative: Object.freeze({
        lastProcessedInputSequence:
          authoritativePlayerSnapshot.lastProcessedInputSequence,
        linearVelocity: freezeVector3Snapshot(
          authoritativePlayerSnapshot.linearVelocity
        ),
        locomotionMode: authoritativePlayerSnapshot.locomotionMode,
        position: freezeVector3Snapshot(authoritativePlayerSnapshot.position),
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
        issuedTraversalIntent: freezeIssuedTraversalIntentSnapshot(
          this.#dependencies.localTraversalAuthorityState
            .latestIssuedTraversalIntentSnapshot
        ),
        linearVelocity: freezeVector3Snapshot(localLinearVelocity),
        locomotionMode: localTraversalPose.locomotionMode,
        position: freezeVector3Snapshot(localTraversalPose.position),
        surfaceRouting: this.surfaceRoutingLocalTelemetrySnapshot
      })
    });
  }

  recordLocalAuthoritySnap(): void {
    this.#localReconciliationCorrectionCount += 1;
    this.#lastLocalReconciliationCorrectionSource = "local-authority-snap";
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
