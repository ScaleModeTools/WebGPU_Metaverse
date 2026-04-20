import {
  clearMetaverseUnmountedTraversalPendingActions,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseUnmountedTraversalAction,
  resolveMetaverseGroundedJumpBodyTraversalActionSnapshot,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  metaverseRealtimeWorldCadenceConfig,
  createMetaverseGameplayTraversalIntentSnapshotInput,
  type MetaversePlayerTraversalIntentSnapshotInput
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
  createSurfaceLocomotionSnapshot,
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
  readonly traversalIntentInput?: MetaversePlayerTraversalIntentSnapshotInput | null;
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

  resolvePredictedTraversalIntentInput(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "pitchAxis" | "strafeAxis" | "yawAxis"
    >,
    deltaSeconds: number
  ): MetaversePlayerTraversalIntentSnapshotInput | null {
    const locomotionMode = this.#dependencies.readLocomotionMode();

    if (locomotionMode !== "grounded" && locomotionMode !== "swim") {
      return null;
    }

    return createMetaverseGameplayTraversalIntentSnapshotInput({
      boost: movementInput.boost,
      jump: movementInput.jump,
      locomotionMode,
      moveAxis: movementInput.moveAxis,
      pitchRadians: advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#dependencies.config,
        deltaSeconds
      ),
      strafeAxis: movementInput.strafeAxis,
      turnAxis: movementInput.yawAxis,
      yawRadians: this.#resolvePredictedLookYawRadians(
        movementInput,
        deltaSeconds,
        locomotionMode === "swim"
          ? this.#dependencies.config.swim.maxTurnSpeedRadiansPerSecond
          : this.#dependencies.config.groundedBody.maxTurnSpeedRadiansPerSecond
      )
    });
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

    if (locomotionMode !== "grounded") {
      return Object.freeze({
        kind: "none",
        phase: "idle"
      });
    }

    return resolveMetaverseGroundedJumpBodyTraversalActionSnapshot(
      groundedBodySnapshot.jumpBody
    );
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
        linearVelocity: swimSnapshot.linearVelocity,
        locomotionMode: "swim",
        position: swimSnapshot.position,
        yawRadians: swimSnapshot.yawRadians
      };
    }

    if (!this.#dependencies.groundedBodyRuntime.isInitialized) {
      return null;
    }

    return {
      linearVelocity: this.#dependencies.groundedBodyRuntime.snapshot.linearVelocity,
      locomotionMode: "grounded",
      position: this.#dependencies.groundedBodyRuntime.snapshot.position,
      yawRadians: this.#dependencies.groundedBodyRuntime.snapshot.yawRadians
    };
  }

  applyAuthoritativeUnmountedPose({
    authoritativeGrounded,
    authoritativePlayerSnapshot,
    localTraversalPose,
    positionBlendAlpha,
    yawBlendAlpha
  }: ApplyAuthoritativeUnmountedPoseInput): MetaverseCameraSnapshot {
    const correctionLinearVelocity = authoritativePlayerSnapshot.linearVelocity;

    if (authoritativePlayerSnapshot.locomotionMode === "swim") {
      const authoritativeSwimSnapshot =
        authoritativePlayerSnapshot.swimBody ??
        createSurfaceLocomotionSnapshot({
          linearVelocity: correctionLinearVelocity,
          position: authoritativePlayerSnapshot.position,
          yawRadians: authoritativePlayerSnapshot.yawRadians
        });
      const cameraSnapshot =
        this.#dependencies.surfaceLocomotionState.syncAuthoritativeSwimLocomotion(
          {
            lookYawRadians: this.#unmountedLookYawRadians,
            positionBlendAlpha,
            resolveSwimPresentationPosition: (swimSnapshot) =>
              this.resolveSwimPresentationPosition(swimSnapshot),
            swimSnapshot: authoritativeSwimSnapshot,
            traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
            yawBlendAlpha
          }
        );
      this.#dependencies.setLocomotionMode("swim");

      return cameraSnapshot;
    }

    const groundedCameraSnapshot =
      this.#dependencies.surfaceLocomotionState.syncAuthoritativeGroundedLocomotion(
        {
          grounded: authoritativeGrounded,
          interaction: authoritativePlayerSnapshot.groundedBody.interaction,
          linearVelocity: authoritativePlayerSnapshot.groundedBody.linearVelocity,
          lookYawRadians: this.#unmountedLookYawRadians,
          position: authoritativePlayerSnapshot.groundedBody.position,
          positionBlendAlpha,
          resolveGroundedPresentationPosition: () =>
            this.resolveGroundedPresentationPosition(),
          traversalCameraPitchRadians: this.#traversalCameraPitchRadians,
          yawBlendAlpha,
          yawRadians: authoritativePlayerSnapshot.groundedBody.yawRadians
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
    traversalIntentInput,
    traversalState
  }: AdvanceUnmountedTraversalInput & {
    readonly jumpPressedThisFrame: boolean;
  }): AdvanceUnmountedTraversalResult {
    let nextTraversalState = traversalState;
    const resolvedMovementInput =
      traversalIntentInput === null || traversalIntentInput === undefined
        ? movementInput
        : createMovementInputFromTraversalIntent(traversalIntentInput);

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

    this.#syncPredictedTraversalFacing(
      traversalIntentInput ?? null,
      movementInput,
      deltaSeconds,
      this.#dependencies.config.groundedBody.maxTurnSpeedRadiansPerSecond
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
          movementInput: resolvedMovementInput,
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
    traversalIntentInput,
    traversalState
  }: AdvanceUnmountedTraversalInput): AdvanceUnmountedTraversalResult {
    let nextTraversalState = traversalState;
    const resolvedMovementInput =
      traversalIntentInput === null || traversalIntentInput === undefined
        ? movementInput
        : createMovementInputFromTraversalIntent(traversalIntentInput);

    this.#syncPredictedTraversalFacing(
      traversalIntentInput ?? null,
      movementInput,
      deltaSeconds,
      this.#dependencies.config.swim.maxTurnSpeedRadiansPerSecond
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
          movementInput: resolvedMovementInput,
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
    this.#unmountedLookYawRadians = this.#resolvePredictedLookYawRadians(
      movementInput,
      deltaSeconds,
      maxTurnSpeedRadiansPerSecond
    );
  }

  #resolvePredictedLookYawRadians(
    movementInput: Pick<MetaverseFlightInputSnapshot, "yawAxis">,
    deltaSeconds: number,
    maxTurnSpeedRadiansPerSecond: number
  ): number {
    return wrapRadians(
      this.#unmountedLookYawRadians +
        clamp(toFiniteNumber(movementInput.yawAxis, 0), -1, 1) *
          Math.max(0, toFiniteNumber(maxTurnSpeedRadiansPerSecond, 0)) *
          deltaSeconds
    );
  }

  #syncPredictedTraversalFacing(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null,
    movementInput: Pick<MetaverseFlightInputSnapshot, "pitchAxis" | "yawAxis">,
    deltaSeconds: number,
    maxTurnSpeedRadiansPerSecond: number
  ): void {
    if (traversalIntentInput?.facing !== undefined) {
      this.#traversalCameraPitchRadians =
        traversalIntentInput.facing.pitchRadians ??
        this.#traversalCameraPitchRadians;
      this.#unmountedLookYawRadians = wrapRadians(
        traversalIntentInput.facing.yawRadians ?? this.#unmountedLookYawRadians
      );
      return;
    }

    this.#advanceUnmountedLookYawRadians(
      movementInput,
      deltaSeconds,
      maxTurnSpeedRadiansPerSecond
    );
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#dependencies.config,
        deltaSeconds
      );
  }

  #resolveGroundedLocomotionStepCameraSnapshot(
    groundedLocomotionResult: ReturnType<
      MetaverseUnmountedSurfaceLocomotionState["advanceGroundedStep"]
    >
  ): MetaverseCameraSnapshot {
    if (groundedLocomotionResult.transitionSnapshot.enteredSwim) {
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
          linearVelocity: freezeVector3(
            groundedBodySnapshot.linearVelocity.x,
            0,
            groundedBodySnapshot.linearVelocity.z
          ),
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
    if (swimLocomotionResult.transitionSnapshot.enteredGrounded) {
      const groundedEntryLinearVelocity =
        swimLocomotionResult.nextSwimSnapshot.linearVelocity ??
        freezeVector3(0, 0, 0);
      const groundedCameraSnapshot =
        this.#dependencies.surfaceLocomotionState.enterGroundedLocomotion({
          linearVelocity: freezeVector3(
            groundedEntryLinearVelocity.x,
            0,
            groundedEntryLinearVelocity.z
          ),
          lookYawRadians: this.#unmountedLookYawRadians,
          position: swimLocomotionResult.nextSwimSnapshot.position,
          resolveGroundedPresentationPosition: () =>
            this.resolveGroundedPresentationPosition(),
          supportHeightMeters:
            swimLocomotionResult.transitionSnapshot.positionYSource === "support"
              ? swimLocomotionResult.transitionSnapshot.positionYMeters
              : null,
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

function createMovementInputFromTraversalIntent(
  traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput
): MetaverseFlightInputSnapshot {
  return Object.freeze({
    boost: traversalIntentInput.bodyControl?.boost === true,
    jump:
      traversalIntentInput.actionIntent?.kind === "jump" &&
      traversalIntentInput.actionIntent.pressed === true,
    moveAxis: traversalIntentInput.bodyControl?.moveAxis ?? 0,
    primaryAction: false,
    pitchAxis: 0,
    secondaryAction: false,
    strafeAxis: traversalIntentInput.bodyControl?.strafeAxis ?? 0,
    yawAxis: traversalIntentInput.bodyControl?.turnAxis ?? 0
  });
}
