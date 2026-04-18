import {
  metaverseWorldPlacedWaterRegions,
  resolveMetaverseUnmountedGroundedJumpSupport,
  type MetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared";

import type { MetaverseGroundedBodyRuntime } from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type { MetaverseTelemetrySnapshot } from "../../types/telemetry";
import {
  readMetaverseSurfacePolicyConfig
} from "../policies/surface-routing";
import type { MetaverseLocalTraversalAuthorityState } from "./metaverse-local-traversal-authority-state";
import type { MetaverseLocalAuthorityReconciliationState } from "../reconciliation/classes/metaverse-local-authority-reconciliation-state";
import type { MetaverseTraversalRuntimeDependencies } from "../types/traversal";
import type { MetaverseUnmountedSurfaceLocomotionState } from "../surface/metaverse-unmounted-surface-locomotion-state";

type LocalSurfaceRoutingTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"];
type LocalJumpGateTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"]["jumpDebug"];
type LocalReconciliationCorrectionSource =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastCorrectionSource"];

const metaverseWaterRegionSnapshots = metaverseWorldPlacedWaterRegions;
const localGroundedJumpSupportVerticalSpeedTolerance = 0.5;

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
        localGroundedJumpSupportVerticalSpeedTolerance,
      snapToGroundDistanceMeters:
        this.#dependencies.config.groundedBody.snapToGroundDistanceMeters,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(
        this.#dependencies.config
      ),
      waterRegionSnapshots: metaverseWaterRegionSnapshots
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
      blockerOverlap:
        this.#dependencies.surfaceLocomotionState.latestBlockerOverlap,
      decisionReason:
        this.#dependencies.surfaceLocomotionState
          .latestAutomaticSurfaceDecisionReason,
      jumpDebug: this.localGroundedJumpGateTelemetrySnapshot,
      locomotionMode: this.#dependencies.readLocomotionMode(),
      resolvedSupportHeightMeters:
        this.#dependencies.surfaceLocomotionState
          .latestResolvedSupportHeightMeters,
      stepSupportedProbeCount:
        this.#dependencies.surfaceLocomotionState
          .latestStepSupportedProbeCount,
      traversalAuthority: this.#readLocalTraversalAuthoritySnapshot()
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
