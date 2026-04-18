import {
  clearMetaverseUnmountedTraversalPendingActions,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseUnmountedTraversalAction,
  resolveMetaverseTraversalKinematicActionSnapshot,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  metaverseRealtimeWorldCadenceConfig,
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { PhysicsVector3Snapshot, MetaverseGroundedBodyRuntime } from "@/physics";

import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type { MetaverseCameraSnapshot } from "../../types/presentation";
import type { ApplyAuthoritativeUnmountedPoseInput } from "../reconciliation/classes/metaverse-local-authority-reconciliation-state";
import type { LocalTraversalPoseSnapshot } from "../reconciliation/local-authority-pose-correction";
import type { MetaverseTraversalCharacterPresentationState } from "../presentation/metaverse-traversal-character-presentation-state";
import {
  advanceTraversalCameraPresentationPitchRadians,
  createTraversalGroundedCameraPresentationSnapshot,
  createTraversalSwimCameraPresentationSnapshot
} from "../presentation/camera-presentation";
import {
  clamp,
  freezeVector3,
  toFiniteNumber,
  wrapRadians
} from "../policies/surface-locomotion";
import type { MetaverseLocalTraversalAuthorityState } from "./metaverse-local-traversal-authority-state";
import type { MetaverseUnmountedSurfaceLocomotionState } from "../surface/metaverse-unmounted-surface-locomotion-state";
import type { SurfaceLocomotionSnapshot } from "../types/traversal";

const authoritativeTraversalFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;
const authoritativeTraversalFixedStepEpsilon = 0.000001;

interface MetaverseUnmountedTraversalMotionStateDependencies {
  readonly characterPresentationState: MetaverseTraversalCharacterPresentationState;
  readonly config: MetaverseRuntimeConfig;
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly localTraversalAuthorityState: MetaverseLocalTraversalAuthorityState;
  readonly readLocomotionMode: () => MetaverseLocomotionModeId;
  readonly readMountedOccupancyKeepsFreeRoam: () => boolean;
  readonly readMountedVehicleActive: () => boolean;
  readonly setLocomotionMode: (locomotionMode: MetaverseLocomotionModeId) => void;
  readonly surfaceLocomotionState: MetaverseUnmountedSurfaceLocomotionState;
  readonly syncLocalTraversalAuthorityState: (advanceTick: boolean) => void;
  readonly writeTraversalState: (
    traversalState: MetaverseUnmountedTraversalStateSnapshot
  ) => void;
}

export interface AdvanceUnmountedTraversalInput {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly deltaSeconds: number;
  readonly movementInput: MetaverseFlightInputSnapshot;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export interface AdvanceUnmountedTraversalResult {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export class MetaverseUnmountedTraversalMotionState {
  readonly #dependencies: MetaverseUnmountedTraversalMotionStateDependencies;

  #groundedLocomotionAccumulatorSeconds = 0;
  #swimLocomotionAccumulatorSeconds = 0;
  #traversalCameraPitchRadians: number;
  #unmountedLookYawRadians: number;

  constructor(dependencies: MetaverseUnmountedTraversalMotionStateDependencies) {
    this.#dependencies = dependencies;
    this.#traversalCameraPitchRadians =
      dependencies.config.camera.initialPitchRadians;
    this.#unmountedLookYawRadians =
      dependencies.config.camera.initialYawRadians;
  }

  get groundedPredictionSeconds(): number {
    return this.#groundedLocomotionAccumulatorSeconds;
  }

  get swimPredictionSeconds(): number {
    return this.#swimLocomotionAccumulatorSeconds;
  }

  get traversalCameraPitchRadians(): number {
    return this.#traversalCameraPitchRadians;
  }

  get unmountedLookYawRadians(): number {
    return this.#unmountedLookYawRadians;
  }

  reset(): void {
    this.#groundedLocomotionAccumulatorSeconds = 0;
    this.#swimLocomotionAccumulatorSeconds = 0;
    this.#traversalCameraPitchRadians =
      this.#dependencies.config.camera.initialPitchRadians;
    this.#unmountedLookYawRadians =
      this.#dependencies.config.camera.initialYawRadians;
  }

  clearGroundedPredictionAccumulator(
    traversalState: MetaverseUnmountedTraversalStateSnapshot
  ): MetaverseUnmountedTraversalStateSnapshot {
    this.#groundedLocomotionAccumulatorSeconds = 0;

    return clearMetaverseUnmountedTraversalPendingActions(traversalState);
  }

  clearSwimPredictionAccumulator(): void {
    this.#swimLocomotionAccumulatorSeconds = 0;
  }

  setTraversalCameraPitchRadians(pitchRadians: number): void {
    this.#traversalCameraPitchRadians = pitchRadians;
  }

  resolveLocalPredictedTraversalAction(): MetaverseTraversalActiveActionSnapshot {
    const locomotionMode = this.#dependencies.readLocomotionMode();

    if (!this.#dependencies.groundedBodyRuntime.isInitialized) {
      return Object.freeze({
        kind: "none",
        phase: "idle"
      });
    }

    const groundedBodySnapshot =
      this.#dependencies.groundedBodyRuntime.snapshot;

    return resolveMetaverseTraversalKinematicActionSnapshot({
      grounded: groundedBodySnapshot.grounded,
      locomotionMode: locomotionMode === "swim" ? "swim" : "grounded",
      mounted: locomotionMode === "mounted",
      verticalSpeedUnitsPerSecond:
        groundedBodySnapshot.verticalSpeedUnitsPerSecond
    });
  }

  readLocalTraversalPoseForReconciliation(): LocalTraversalPoseSnapshot | null {
    if (
      this.#dependencies.readMountedVehicleActive() ||
      this.#dependencies.readLocomotionMode() === "mounted"
    ) {
      return null;
    }

    if (this.#dependencies.readLocomotionMode() === "swim") {
      const swimSnapshot = this.#dependencies.surfaceLocomotionState.readSwimSnapshot();

      if (swimSnapshot === null) {
        return null;
      }

      return {
        locomotionMode: "swim",
        position: swimSnapshot.position,
        yawRadians: swimSnapshot.yawRadians
      };
    }

    if (!this.#dependencies.groundedBodyRuntime.isInitialized) {
      return null;
    }

    return {
      locomotionMode: "grounded",
      position: this.#dependencies.groundedBodyRuntime.snapshot.position,
      yawRadians: this.#dependencies.groundedBodyRuntime.snapshot.yawRadians
    };
  }

  applyAuthoritativeUnmountedPose({
    authoritativeGrounded,
    authoritativePlayerSnapshot,
    localTraversalPose
  }: ApplyAuthoritativeUnmountedPoseInput): MetaverseCameraSnapshot {
    const correctionLinearVelocity = authoritativePlayerSnapshot.linearVelocity;

    if (authoritativePlayerSnapshot.locomotionMode === "swim") {
      const cameraSnapshot =
        this.#dependencies.surfaceLocomotionState.syncAuthoritativeSwimLocomotion(
          {
            linearVelocity: correctionLinearVelocity,
            lookYawRadians: this.#unmountedLookYawRadians,
            position: authoritativePlayerSnapshot.position,
            positionBlendAlpha: 1,
            resolveSwimPresentationPosition: (swimSnapshot) =>
              this.resolveSwimPresentationPosition(swimSnapshot),
            traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
            yawBlendAlpha: 1,
            yawRadians: localTraversalPose.yawRadians
          }
        );
      this.#dependencies.setLocomotionMode("swim");

      return cameraSnapshot;
    }

    const groundedCameraSnapshot =
      this.#dependencies.surfaceLocomotionState.syncAuthoritativeGroundedLocomotion(
        {
          grounded: authoritativeGrounded,
          linearVelocity: correctionLinearVelocity,
          lookYawRadians: this.#unmountedLookYawRadians,
          position: authoritativePlayerSnapshot.position,
          positionBlendAlpha: 1,
          resolveGroundedPresentationPosition: () =>
            this.resolveGroundedPresentationPosition(),
          traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
          yawBlendAlpha: 1,
          yawRadians: localTraversalPose.yawRadians
        }
      );

    this.#dependencies.setLocomotionMode("grounded");

    return groundedCameraSnapshot ?? createTraversalGroundedCameraPresentationSnapshot(
      this.#dependencies.groundedBodyRuntime.snapshot,
      this.#traversalCameraPitchRadians,
      this.#dependencies.config,
      this.#unmountedLookYawRadians,
      this.resolveGroundedPresentationPosition()
    );
  }

  advanceGroundedLocomotion({
    cameraSnapshot,
    deltaSeconds,
    jumpPressedThisFrame,
    movementInput,
    traversalState
  }: AdvanceUnmountedTraversalInput & {
    readonly jumpPressedThisFrame: boolean;
  }): AdvanceUnmountedTraversalResult {
    let nextTraversalState = traversalState;

    if (jumpPressedThisFrame) {
      nextTraversalState = queueMetaverseUnmountedTraversalAction(
        nextTraversalState,
        {
          actionIntent: Object.freeze({
            kind: "jump",
            pressed: true,
            sequence:
              this.#dependencies.localTraversalAuthorityState.resolveNextPredictedGroundedTraversalActionSequence(
                {
                  actionPressedThisFrame: true,
                  localActiveTraversalAction:
                    this.resolveLocalPredictedTraversalAction(),
                  locomotionMode: this.#dependencies.readLocomotionMode(),
                  traversalState: nextTraversalState
                }
              )
          }),
          bufferSeconds: metaverseTraversalActionBufferSeconds
        }
      );
      this.#dependencies.writeTraversalState(nextTraversalState);
      this.#dependencies.syncLocalTraversalAuthorityState(false);
    }

    this.#advanceUnmountedLookYawRadians(
      movementInput,
      deltaSeconds,
      this.#dependencies.config.groundedBody.maxTurnSpeedRadiansPerSecond
    );
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#dependencies.config,
        deltaSeconds
      );
    this.#groundedLocomotionAccumulatorSeconds += Math.max(
      0,
      toFiniteNumber(deltaSeconds, 0)
    );

    while (
      this.#groundedLocomotionAccumulatorSeconds +
        authoritativeTraversalFixedStepEpsilon >=
        authoritativeTraversalFixedStepSeconds &&
      this.#dependencies.readLocomotionMode() === "grounded"
    ) {
      const groundedLocomotionResult = this.#dependencies.surfaceLocomotionState.advanceGroundedStep(
        {
          deltaSeconds: authoritativeTraversalFixedStepSeconds,
          movementInput,
          preferredLookYawRadians: this.#unmountedLookYawRadians,
          resolveGroundedPresentationPosition: (bodyPosition) => bodyPosition,
          traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
          traversalState: nextTraversalState
        }
      );
      nextTraversalState = groundedLocomotionResult.nextTraversalState;
      this.#dependencies.writeTraversalState(nextTraversalState);
      cameraSnapshot =
        this.#resolveGroundedLocomotionStepCameraSnapshot(groundedLocomotionResult);

      this.#groundedLocomotionAccumulatorSeconds = Math.max(
        0,
        this.#groundedLocomotionAccumulatorSeconds -
          authoritativeTraversalFixedStepSeconds
      );

      if (this.#dependencies.readLocomotionMode() !== "grounded") {
        nextTraversalState =
          this.clearGroundedPredictionAccumulator(nextTraversalState);
        return {
          cameraSnapshot,
          traversalState: nextTraversalState
        };
      }
    }

    return {
      cameraSnapshot: createTraversalGroundedCameraPresentationSnapshot(
        this.#dependencies.groundedBodyRuntime.snapshot,
        this.#traversalCameraPitchRadians,
        this.#dependencies.config,
        this.#unmountedLookYawRadians,
        this.resolveGroundedPresentationPosition()
      ),
      traversalState: nextTraversalState
    };
  }

  advanceSwimLocomotion({
    cameraSnapshot,
    deltaSeconds,
    movementInput,
    traversalState
  }: AdvanceUnmountedTraversalInput): AdvanceUnmountedTraversalResult {
    let nextTraversalState = traversalState;

    this.#advanceUnmountedLookYawRadians(
      movementInput,
      deltaSeconds,
      this.#dependencies.config.swim.maxTurnSpeedRadiansPerSecond
    );
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#dependencies.config,
        deltaSeconds
      );
    this.#swimLocomotionAccumulatorSeconds += Math.max(
      0,
      toFiniteNumber(deltaSeconds, 0)
    );

    while (
      this.#swimLocomotionAccumulatorSeconds +
        authoritativeTraversalFixedStepEpsilon >=
        authoritativeTraversalFixedStepSeconds &&
      this.#dependencies.readLocomotionMode() === "swim"
    ) {
      const swimLocomotionResult = this.#dependencies.surfaceLocomotionState.advanceSwimStep(
        {
          deltaSeconds: authoritativeTraversalFixedStepSeconds,
          movementInput,
          preferredLookYawRadians: this.#unmountedLookYawRadians,
          resolveSwimPresentationPosition: (swimSnapshot) =>
            this.resolveSwimPresentationPosition(swimSnapshot),
          traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
          traversalState: nextTraversalState
        }
      );
      nextTraversalState = swimLocomotionResult.nextTraversalState;
      this.#dependencies.writeTraversalState(nextTraversalState);
      cameraSnapshot = this.#resolveSwimLocomotionStepCameraSnapshot(
        cameraSnapshot,
        swimLocomotionResult
      );

      this.#swimLocomotionAccumulatorSeconds = Math.max(
        0,
        this.#swimLocomotionAccumulatorSeconds -
          authoritativeTraversalFixedStepSeconds
      );

      if (this.#dependencies.readLocomotionMode() !== "swim") {
        this.clearSwimPredictionAccumulator();
        return {
          cameraSnapshot,
          traversalState: nextTraversalState
        };
      }
    }

    const currentSwimSnapshot =
      this.#dependencies.surfaceLocomotionState.resolveCurrentSwimSnapshot();

    return {
      cameraSnapshot: createTraversalSwimCameraPresentationSnapshot(
        currentSwimSnapshot,
        this.#traversalCameraPitchRadians,
        this.#dependencies.config,
        this.#unmountedLookYawRadians,
        this.resolveSwimPresentationPosition(currentSwimSnapshot)
      ),
      traversalState: nextTraversalState
    };
  }

  resolveGroundedPresentationPosition(): PhysicsVector3Snapshot {
    return this.#dependencies.characterPresentationState.resolveGroundedPresentationPosition(
      this.#dependencies.groundedBodyRuntime.snapshot,
      this.#dependencies.groundedBodyRuntime.linearVelocitySnapshot,
      this.#groundedLocomotionAccumulatorSeconds,
      (position) =>
        this.#dependencies.surfaceLocomotionState.readGroundedSupportHeightMeters(
          position
        )
    );
  }

  resolveSwimPresentationPosition(
    swimSnapshot: SurfaceLocomotionSnapshot | null =
      this.#dependencies.surfaceLocomotionState.readSwimSnapshot()
  ): PhysicsVector3Snapshot {
    const resolvedSwimSnapshot =
      swimSnapshot ??
      this.#dependencies.surfaceLocomotionState.resolveCurrentSwimSnapshot();

    return this.#dependencies.characterPresentationState.resolveSwimPresentationPosition(
      resolvedSwimSnapshot,
      this.#swimLocomotionAccumulatorSeconds
    );
  }

  #advanceUnmountedLookYawRadians(
    movementInput: Pick<MetaverseFlightInputSnapshot, "yawAxis">,
    deltaSeconds: number,
    maxTurnSpeedRadiansPerSecond: number
  ): void {
    this.#unmountedLookYawRadians = wrapRadians(
      this.#unmountedLookYawRadians +
        clamp(toFiniteNumber(movementInput.yawAxis, 0), -1, 1) *
          Math.max(0, toFiniteNumber(maxTurnSpeedRadiansPerSecond, 0)) *
          deltaSeconds
    );
  }

  #resolveGroundedLocomotionStepCameraSnapshot(
    groundedLocomotionResult: ReturnType<
      MetaverseUnmountedSurfaceLocomotionState["advanceGroundedStep"]
    >
  ): MetaverseCameraSnapshot {
    if (groundedLocomotionResult.locomotionMode === "swim") {
      const groundedBodySnapshot = this.#dependencies.groundedBodyRuntime.snapshot;

      if (this.#dependencies.readMountedOccupancyKeepsFreeRoam()) {
        return createTraversalGroundedCameraPresentationSnapshot(
          groundedBodySnapshot,
          this.#traversalCameraPitchRadians,
          this.#dependencies.config,
          this.#unmountedLookYawRadians,
          groundedBodySnapshot.position
        );
      }

      const nextCameraSnapshot =
        this.#dependencies.surfaceLocomotionState.enterSwimLocomotion({
          lookYawRadians: this.#unmountedLookYawRadians,
          position: freezeVector3(
            groundedBodySnapshot.position.x,
            groundedLocomotionResult.waterlineHeightMeters,
            groundedBodySnapshot.position.z
          ),
          resolveSwimPresentationPosition: (swimSnapshot) =>
            this.resolveSwimPresentationPosition(swimSnapshot),
          traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
          yawRadians: groundedBodySnapshot.yawRadians
        });
      this.#dependencies.setLocomotionMode("swim");
      this.#dependencies.syncLocalTraversalAuthorityState(false);

      return nextCameraSnapshot;
    }

    this.#dependencies.syncLocalTraversalAuthorityState(true);

    return groundedLocomotionResult.cameraSnapshot;
  }

  #resolveSwimLocomotionStepCameraSnapshot(
    cameraSnapshot: MetaverseCameraSnapshot,
    swimLocomotionResult: ReturnType<
      MetaverseUnmountedSurfaceLocomotionState["advanceSwimStep"]
    >
  ): MetaverseCameraSnapshot {
    if (swimLocomotionResult.locomotionMode === "grounded") {
      const groundedCameraSnapshot =
        this.#dependencies.surfaceLocomotionState.enterGroundedLocomotion({
          lookYawRadians: this.#unmountedLookYawRadians,
          position: swimLocomotionResult.nextSwimSnapshot.position,
          resolveGroundedPresentationPosition: () =>
            this.resolveGroundedPresentationPosition(),
          supportHeightMeters: swimLocomotionResult.supportHeightMeters,
          traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
          yawRadians: swimLocomotionResult.nextSwimSnapshot.yawRadians
        });
      this.#dependencies.setLocomotionMode("grounded");
      this.#dependencies.syncLocalTraversalAuthorityState(false);

      return groundedCameraSnapshot ?? cameraSnapshot;
    }

    this.#dependencies.syncLocalTraversalAuthorityState(true);

    return swimLocomotionResult.cameraSnapshot;
  }
}
