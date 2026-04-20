import {
  createMetaverseUnmountedTraversalStateSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import { createRadians } from "@webgpu-metaverse/shared";
import type {
  MetaversePlayerTraversalIntentSnapshot,
  MetaversePlayerTraversalIntentSnapshotInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseGroundedBodyRuntime, PhysicsVector3Snapshot } from "@/physics";

import { defaultMetaverseLocomotionMode } from "../../config/metaverse-locomotion-modes";
import {
  advanceMetaverseCameraSnapshot
} from "../../states/metaverse-flight";
import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot
} from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import { MetaverseTraversalCharacterPresentationState } from "../presentation/metaverse-traversal-character-presentation-state";
import {
  clamp,
  toFiniteNumber
} from "../policies/surface-locomotion";
import {
  MetaverseLocalAuthorityReconciliationState,
  type AuthoritativeLocalPlayerPoseSnapshot
} from "../reconciliation/classes/metaverse-local-authority-reconciliation-state";
import type { ConsumedAckedAuthoritativeLocalPlayerSample } from "../reconciliation/authoritative-local-player-reconciliation";
import type {
  LocalTraversalPoseSnapshot,
  PredictedLocalReconciliationSample
} from "../reconciliation/local-authority-pose-correction";
import type { MetaverseUnmountedSurfaceLocomotionState } from "../surface/metaverse-unmounted-surface-locomotion-state";
import type { TraversalMountedVehicleSnapshot } from "../types/traversal";
import { MetaverseLocalTraversalAuthorityState } from "./metaverse-local-traversal-authority-state";
import { MetaverseTraversalTelemetryState } from "./metaverse-traversal-telemetry-state";
import { MetaverseUnmountedTraversalMotionState } from "./metaverse-unmounted-traversal-motion-state";

const localPlayerAuthoritativeConvergenceStartPlanarDistanceMeters = 1.25;
const localPlayerAuthoritativeConvergenceStartVerticalDistanceMeters = 1.5;
const localPlayerAuthoritativeConvergenceStartYawRadians = 0.12;
const localPlayerAuthoritativeConvergenceSettlePlanarDistanceMeters = 0.05;
const localPlayerAuthoritativeConvergenceSettleVerticalDistanceMeters = 0.05;
const localPlayerAuthoritativeConvergenceSettleYawRadians = 0.02;
const localPlayerAuthoritativeConvergenceMaxPositionStepMeters = 0.2;
const localPlayerAuthoritativeConvergenceMaxYawStepRadians = 0.08;

type AuthoritativeLocalPlayerReconciliationInput =
  | AuthoritativeLocalPlayerPoseSnapshot
  | ConsumedAckedAuthoritativeLocalPlayerSample;

function resolveMovementInputMagnitude(
  movementInput: Pick<MetaverseFlightInputSnapshot, "moveAxis" | "strafeAxis">
): number {
  return Math.hypot(
    clamp(toFiniteNumber(movementInput.moveAxis, 0), -1, 1),
    clamp(toFiniteNumber(movementInput.strafeAxis, 0), -1, 1)
  );
}

function isConsumedAckedAuthoritativeLocalPlayerSample(
  input: AuthoritativeLocalPlayerReconciliationInput
): input is ConsumedAckedAuthoritativeLocalPlayerSample {
  return "pose" in input;
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let wrappedValue = rawValue;

  while (wrappedValue > Math.PI) {
    wrappedValue -= Math.PI * 2;
  }

  while (wrappedValue <= -Math.PI) {
    wrappedValue += Math.PI * 2;
  }

  return wrappedValue;
}

function offsetVector3(
  basePosition: PhysicsVector3Snapshot,
  deltaPosition: PhysicsVector3Snapshot
): PhysicsVector3Snapshot {
  return Object.freeze({
    x: basePosition.x + deltaPosition.x,
    y: basePosition.y + deltaPosition.y,
    z: basePosition.z + deltaPosition.z
  });
}

function createAckResidualApplicationSnapshot(
  authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot,
  matchedLocalSample: PredictedLocalReconciliationSample,
  currentLocalTraversalPose: LocalTraversalPoseSnapshot
): AuthoritativeLocalPlayerPoseSnapshot {
  const authoritativeActiveBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
      authoritativePlayerSnapshot
    );
  const residualPosition = Object.freeze({
    x:
      authoritativeActiveBodySnapshot.position.x -
      matchedLocalSample.pose.position.x,
    y:
      authoritativeActiveBodySnapshot.position.y -
      matchedLocalSample.pose.position.y,
    z:
      authoritativeActiveBodySnapshot.position.z -
      matchedLocalSample.pose.position.z
  });
  const residualYawRadians = wrapRadians(
    authoritativeActiveBodySnapshot.yawRadians -
      matchedLocalSample.pose.yawRadians
  );
  const applicationPosition = offsetVector3(
    currentLocalTraversalPose.position,
    residualPosition
  );
  const applicationYawRadians = wrapRadians(
    currentLocalTraversalPose.yawRadians + residualYawRadians
  );
  const applicationYaw = createRadians(applicationYawRadians);

  if (authoritativePlayerSnapshot.locomotionMode === "swim") {
    return Object.freeze({
      ...authoritativePlayerSnapshot,
      position: applicationPosition,
      swimBody:
        authoritativePlayerSnapshot.swimBody === null
          ? null
            : Object.freeze({
              ...authoritativePlayerSnapshot.swimBody,
              position: applicationPosition,
              yawRadians: applicationYaw
            }),
      yawRadians: applicationYaw
    });
  }

  return Object.freeze({
    ...authoritativePlayerSnapshot,
    groundedBody: Object.freeze({
      ...authoritativePlayerSnapshot.groundedBody,
      position: applicationPosition,
      yawRadians: applicationYaw
    }),
    position: applicationPosition,
    yawRadians: applicationYaw
  });
}

interface MetaverseUnmountedTraversalOrchestrationStateDependencies {
  readonly characterPresentationState: MetaverseTraversalCharacterPresentationState;
  readonly config: MetaverseRuntimeConfig;
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly localAuthorityReconciliationState: MetaverseLocalAuthorityReconciliationState;
  readonly localTraversalAuthorityState: MetaverseLocalTraversalAuthorityState;
  readonly readLocomotionMode: () => MetaverseLocomotionModeId;
  readonly readMountedOccupancyPresentationState:
    () => MetaverseMountedOccupancyPresentationStateSnapshot | null;
  readonly readMountedVehicleSnapshot: () => TraversalMountedVehicleSnapshot | null;
  readonly readTraversalState: () => MetaverseUnmountedTraversalStateSnapshot;
  readonly resolveGroundedPresentationPosition: () => PhysicsVector3Snapshot;
  readonly resolveSwimPresentationPosition: () => PhysicsVector3Snapshot;
  readonly setLocomotionMode: (locomotionMode: MetaverseLocomotionModeId) => void;
  readonly surfaceLocomotionState: MetaverseUnmountedSurfaceLocomotionState;
  readonly syncLocalTraversalAuthorityState: (advanceTick: boolean) => void;
  readonly telemetryState: MetaverseTraversalTelemetryState;
  readonly unmountedTraversalMotionState: MetaverseUnmountedTraversalMotionState;
  readonly writeLocomotionModeRaw: (
    locomotionMode: MetaverseLocomotionModeId
  ) => void;
  readonly writeTraversalState: (
    traversalState: MetaverseUnmountedTraversalStateSnapshot
  ) => void;
}

export class MetaverseUnmountedTraversalOrchestrationState {
  readonly #dependencies: MetaverseUnmountedTraversalOrchestrationStateDependencies;

  #lastJumpInputPressed = false;
  #latestMovementInputMagnitude = 0;

  constructor(
    dependencies: MetaverseUnmountedTraversalOrchestrationStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  get characterPresentationSnapshot():
    | MetaverseCharacterPresentationSnapshot
    | null {
    return this.#dependencies.characterPresentationState.snapshot;
  }

  get localTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
    return this.#dependencies.localTraversalAuthorityState.snapshot;
  }

  get localTraversalPoseSnapshot(): LocalTraversalPoseSnapshot | null {
    return this.#dependencies.unmountedTraversalMotionState.readLocalTraversalPoseForReconciliation();
  }

  captureJumpPressedThisFrame(
    movementInput: MetaverseFlightInputSnapshot,
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null = null
  ): boolean {
    const movementMagnitudeInput =
      traversalIntentInput?.bodyControl === undefined
        ? movementInput
        : {
            moveAxis: traversalIntentInput.bodyControl.moveAxis ?? 0,
            strafeAxis: traversalIntentInput.bodyControl.strafeAxis ?? 0
          };
    this.#latestMovementInputMagnitude =
      resolveMovementInputMagnitude(movementMagnitudeInput);
    const jumpInputPressed =
      traversalIntentInput?.actionIntent?.kind === "jump"
        ? traversalIntentInput.actionIntent.pressed === true
        : movementInput.jump === true;
    const jumpPressedThisFrame = jumpInputPressed && !this.#lastJumpInputPressed;

    this.#lastJumpInputPressed = jumpInputPressed;

    return jumpPressedThisFrame;
  }

  clearGroundedPredictionAccumulator(): void {
    this.#dependencies.writeTraversalState(
      this.#dependencies.unmountedTraversalMotionState.clearGroundedPredictionAccumulator(
        this.#dependencies.readTraversalState()
      )
    );
  }

  reset(): void {
    this.#dependencies.characterPresentationState.clear();
    this.#dependencies.writeLocomotionModeRaw(defaultMetaverseLocomotionMode);
    this.#dependencies.surfaceLocomotionState.reset();
    this.#dependencies.unmountedTraversalMotionState.reset();
    this.#dependencies.telemetryState.reset();
    this.#latestMovementInputMagnitude = 0;
    this.#dependencies.writeTraversalState(
      createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode:
          defaultMetaverseLocomotionMode === "swim" ? "swim" : "grounded"
      })
    );
    this.#dependencies.localTraversalAuthorityState.reset();
    this.#lastJumpInputPressed = false;
  }

  syncIssuedTraversalIntentSnapshot(
    traversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null
  ): void {
    this.#dependencies.localTraversalAuthorityState
      .syncIssuedTraversalIntentSnapshot(traversalIntentSnapshot, {
        localActiveTraversalAction:
          this.#dependencies.unmountedTraversalMotionState.resolveLocalPredictedTraversalAction(),
        locomotionMode: this.#dependencies.readLocomotionMode(),
        traversalState: this.#dependencies.readTraversalState()
      });
  }

  boot(cameraSnapshot: MetaverseCameraSnapshot): MetaverseCameraSnapshot {
    const groundedCameraSnapshot =
      this.#dependencies.surfaceLocomotionState.enterGroundedLocomotion({
        lookYawRadians: cameraSnapshot.yawRadians,
        position: Object.freeze({
          x: this.#dependencies.config.groundedBody.spawnPosition.x,
          y: this.#dependencies.config.groundedBody.spawnPosition.y,
          z: this.#dependencies.config.groundedBody.spawnPosition.z
        }),
        resolveGroundedPresentationPosition: () =>
          this.#dependencies.resolveGroundedPresentationPosition(),
        supportHeightMeters: null,
        traversalCameraPitchRadians:
          this.#dependencies.unmountedTraversalMotionState.traversalCameraPitchRadians,
        yawRadians: cameraSnapshot.yawRadians
      });

    let nextCameraSnapshot = cameraSnapshot;

    if (groundedCameraSnapshot !== null) {
      this.#dependencies.setLocomotionMode("grounded");
      this.#dependencies.syncLocalTraversalAuthorityState(false);
      nextCameraSnapshot = groundedCameraSnapshot;
    }

    const automaticSurfaceSyncResult =
      this.#dependencies.surfaceLocomotionState.syncAutomaticSurfaceLocomotion({
        currentLocomotionMode: this.#dependencies.readLocomotionMode(),
        excludedOwnerEnvironmentAssetId: null,
        lookYawRadians: nextCameraSnapshot.yawRadians,
        position: this.#dependencies.groundedBodyRuntime.snapshot.position,
        resolveGroundedPresentationPosition: () =>
          this.#dependencies.resolveGroundedPresentationPosition(),
        resolveSwimPresentationPosition: () =>
          this.#dependencies.resolveSwimPresentationPosition(),
        traversalCameraPitchRadians:
          this.#dependencies.unmountedTraversalMotionState.traversalCameraPitchRadians,
        yawRadians: this.#dependencies.groundedBodyRuntime.snapshot.yawRadians
      });

    this.#dependencies.setLocomotionMode(
      automaticSurfaceSyncResult.locomotionMode
    );
    this.#dependencies.syncLocalTraversalAuthorityState(false);

    if (automaticSurfaceSyncResult.cameraSnapshot !== null) {
      nextCameraSnapshot = automaticSurfaceSyncResult.cameraSnapshot;
    }

    this.syncCharacterPresentationSnapshot();

    return nextCameraSnapshot;
  }

  advance(
    cameraSnapshot: MetaverseCameraSnapshot,
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number,
    jumpPressedThisFrame: boolean,
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null = null
  ): MetaverseCameraSnapshot {
    if (this.#dependencies.readLocomotionMode() === "grounded") {
      const groundedAdvanceResult =
        this.#dependencies.unmountedTraversalMotionState.advanceGroundedLocomotion(
          {
            cameraSnapshot,
            deltaSeconds,
            jumpPressedThisFrame,
            movementInput,
            traversalIntentInput,
            traversalState: this.#dependencies.readTraversalState()
          }
        );
      this.#dependencies.writeTraversalState(groundedAdvanceResult.traversalState);

      return groundedAdvanceResult.cameraSnapshot;
    }

    if (this.#dependencies.readLocomotionMode() === "swim") {
      this.clearGroundedPredictionAccumulator();
      const swimAdvanceResult =
        this.#dependencies.unmountedTraversalMotionState.advanceSwimLocomotion({
          cameraSnapshot,
          deltaSeconds,
          movementInput,
          traversalIntentInput,
          traversalState: this.#dependencies.readTraversalState()
        });
      this.#dependencies.writeTraversalState(swimAdvanceResult.traversalState);

      return swimAdvanceResult.cameraSnapshot;
    }

    this.clearGroundedPredictionAccumulator();

    return advanceMetaverseCameraSnapshot(
      cameraSnapshot,
      movementInput,
      this.#dependencies.config,
      deltaSeconds
    );
  }

  syncAuthoritativeLocalPlayerPose(
    cameraSnapshot: MetaverseCameraSnapshot,
    authoritativePlayerInput: AuthoritativeLocalPlayerReconciliationInput
  ): MetaverseCameraSnapshot {
    let authoritativeSample: ConsumedAckedAuthoritativeLocalPlayerSample | null =
      null;
    let authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;

    if (
      isConsumedAckedAuthoritativeLocalPlayerSample(authoritativePlayerInput)
    ) {
      authoritativeSample = authoritativePlayerInput;
      authoritativePlayerSnapshot = authoritativePlayerInput.pose;
    } else {
      authoritativePlayerSnapshot = authoritativePlayerInput;
    }
    const currentLocalTraversalPose =
      this.#dependencies.unmountedTraversalMotionState.readLocalTraversalPoseForReconciliation();

    if (currentLocalTraversalPose === null) {
      return cameraSnapshot;
    }

    const matchedPredictedLocalSample =
      authoritativeSample === null
        ? null
        : this.#dependencies.unmountedTraversalMotionState
            .readPredictedLocalReconciliationSample({
              authoritativeSnapshotAgeMs:
                authoritativeSample.authoritativeSnapshotAgeMs,
              authoritativeTick: authoritativeSample.authoritativeTick,
              lastProcessedInputSequence:
                authoritativeSample.lastProcessedInputSequence,
              lastProcessedTraversalOrientationSequence:
                authoritativeSample.lastProcessedTraversalOrientationSequence,
              receivedAtWallClockMs: authoritativeSample.receivedAtWallClockMs
            });
    const localTraversalPose =
      matchedPredictedLocalSample?.pose ?? currentLocalTraversalPose;
    const localGroundedBodySnapshot =
      matchedPredictedLocalSample !== null
        ? matchedPredictedLocalSample.groundedBody
        : localTraversalPose.locomotionMode === "grounded" &&
            this.#dependencies.groundedBodyRuntime.isInitialized
          ? this.#dependencies.groundedBodyRuntime.snapshot
          : null;
    const localSwimBodySnapshot =
      matchedPredictedLocalSample !== null
        ? matchedPredictedLocalSample.swimBody
        : localTraversalPose.locomotionMode === "swim"
          ? this.#dependencies.surfaceLocomotionState.readSwimSnapshot()
          : null;
    const localIssuedTraversalIntentSnapshot =
      matchedPredictedLocalSample !== null
        ? matchedPredictedLocalSample.issuedTraversalIntent
        : this.#dependencies.localTraversalAuthorityState
            .latestIssuedTraversalIntentSnapshot;
    const authoritativePlayerApplicationSnapshot =
      matchedPredictedLocalSample === null
        ? authoritativePlayerSnapshot
        : createAckResidualApplicationSnapshot(
            authoritativePlayerSnapshot,
            matchedPredictedLocalSample,
            currentLocalTraversalPose
          );
    const nextCameraSnapshot = { current: cameraSnapshot };
    const appliedCorrection =
      this.#dependencies.localAuthorityReconciliationState
        .syncAuthoritativeLocalPlayerPose({
          applyAuthoritativeUnmountedPose: (input) =>
            (nextCameraSnapshot.current =
              this.#dependencies.unmountedTraversalMotionState.applyAuthoritativeUnmountedPose(
                input
              )),
          authoritativePlayerSnapshot,
          authoritativePlayerApplicationSnapshot,
          authoritativeSnapshotAgeMs:
            authoritativeSample?.authoritativeSnapshotAgeMs ?? null,
          authoritativeSnapshotSequence:
            authoritativeSample?.snapshotSequence ?? null,
          authoritativeTick: authoritativeSample?.authoritativeTick ?? null,
          createLocalAuthorityPoseCorrectionSnapshot: (input) =>
            this.#dependencies.telemetryState
              .createLocalAuthorityPoseCorrectionSnapshot({
                ...input,
                localGroundedBodySnapshot,
                localIssuedTraversalIntentSnapshot,
                localSwimBodySnapshot
              }),
          convergenceMaxPositionStepMeters:
            localPlayerAuthoritativeConvergenceMaxPositionStepMeters,
          convergenceMaxYawStepRadians:
            localPlayerAuthoritativeConvergenceMaxYawStepRadians,
          convergenceSettlePlanarDistanceMeters:
            localPlayerAuthoritativeConvergenceSettlePlanarDistanceMeters,
          convergenceSettleVerticalDistanceMeters:
            localPlayerAuthoritativeConvergenceSettleVerticalDistanceMeters,
          convergenceSettleYawRadians:
            localPlayerAuthoritativeConvergenceSettleYawRadians,
          convergenceStartPlanarDistanceMeters:
            localPlayerAuthoritativeConvergenceStartPlanarDistanceMeters,
          convergenceStartVerticalDistanceMeters:
            localPlayerAuthoritativeConvergenceStartVerticalDistanceMeters,
          convergenceStartYawRadians:
            localPlayerAuthoritativeConvergenceStartYawRadians,
          localGroundedBodySnapshot,
          localSwimBodySnapshot,
          localGrounded: localGroundedBodySnapshot?.grounded ?? null,
          localTraversalApplicationPose: currentLocalTraversalPose,
          localTraversalPose,
        });

    if (!appliedCorrection) {
      return nextCameraSnapshot.current;
    }

    this.#dependencies.telemetryState.recordLocalAuthorityConvergence({
      episodeStarted:
        this.#dependencies.localAuthorityReconciliationState
          .lastLocalAuthorityPoseConvergenceEpisodeStarted
    });
    this.#dependencies.syncLocalTraversalAuthorityState(false);
    this.syncCharacterPresentationSnapshot();

    return nextCameraSnapshot.current;
  }

  syncCharacterPresentationSnapshot(deltaSeconds = 0): void {
    const groundedSpawnPosition =
      this.#dependencies.surfaceLocomotionState.readCanonicalGroundedSpawnPosition();
    this.#dependencies.characterPresentationState.sync({
      deltaSeconds,
      groundedBodySnapshot: this.#dependencies.groundedBodyRuntime.isInitialized
        ? this.#dependencies.groundedBodyRuntime.snapshot
        : null,
      groundedPredictionSeconds:
        this.#dependencies.unmountedTraversalMotionState.groundedPredictionSeconds,
      groundedSpawnPosition,
      latestMovementInputMagnitude: this.#latestMovementInputMagnitude,
      locomotionMode: this.#dependencies.readLocomotionMode(),
      mountedOccupancyPresentationState:
        this.#dependencies.readMountedOccupancyPresentationState(),
      mountedVehicleSnapshot: this.#dependencies.readMountedVehicleSnapshot(),
      presentationYawRadians:
        this.#dependencies.readMountedVehicleSnapshot() === null
          ? this.#dependencies.unmountedTraversalMotionState.unmountedLookYawRadians
          : null,
      readGroundedSupportHeightMeters: (position) =>
        this.#dependencies.surfaceLocomotionState.readGroundedSupportHeightMeters(
          position
        ),
      swimPredictionSeconds:
        this.#dependencies.unmountedTraversalMotionState.swimPredictionSeconds,
      swimSnapshot: this.#dependencies.surfaceLocomotionState.readSwimSnapshot(),
      waterSurfaceHeightMeters:
        this.#dependencies.surfaceLocomotionState.resolveWaterSurfaceHeightMeters(
          groundedSpawnPosition
        )
    });
  }
}
