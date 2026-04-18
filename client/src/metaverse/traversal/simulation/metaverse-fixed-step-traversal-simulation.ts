import {
  MetaverseSurfaceDriveBodyRuntime,
  type MetaverseGroundedBodyRuntime,
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierPhysicsRuntime
} from "@/physics";
import {
  metaverseWorldPlacedWaterRegions,
  prepareMetaverseUnmountedTraversalStep,
  resolveMetaverseUnmountedTraversalStep,
  type MetaverseTraversalStateResolutionSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared";

import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type { MetaverseCameraSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  createTraversalGroundedCameraPresentationSnapshot,
  createTraversalSwimCameraPresentationSnapshot
} from "../presentation/camera-presentation";
import {
  freezeVector3,
  toFiniteNumber,
  wrapRadians
} from "../policies/surface-locomotion";
import { readMetaverseSurfacePolicyConfig } from "../policies/surface-routing";
import type {
  MetaverseTraversalRuntimeDependencies,
  SurfaceLocomotionSnapshot
} from "../types/traversal";

const metaverseFixedStepSimulationWaterRegionSnapshots =
  metaverseWorldPlacedWaterRegions;

export interface MetaverseGroundedTraversalStepResult {
  readonly automaticSurfaceSnapshot: MetaverseTraversalStateResolutionSnapshot;
  readonly autostepHeightMeters: number | null;
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly locomotionMode: "grounded" | "swim";
  readonly nextTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly supportHeightMeters: number | null;
  readonly waterlineHeightMeters: number;
}

export interface MetaverseSwimTraversalStepResult {
  readonly automaticSurfaceSnapshot: MetaverseTraversalStateResolutionSnapshot;
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly locomotionMode: "grounded" | "swim";
  readonly nextSwimSnapshot: SurfaceLocomotionSnapshot;
  readonly nextTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly supportHeightMeters: number | null;
}

interface MetaverseGroundedTraversalStepInput {
  readonly deltaSeconds: number;
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly movementInput: MetaverseFlightInputSnapshot;
  readonly preferredLookYawRadians: number;
  readonly readGroundedTraversalExcludedColliders: () => readonly RapierColliderHandle[];
  readonly resolveGroundedPresentationPosition: (
    bodySnapshot: MetaverseGroundedBodySnapshot
  ) => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

interface MetaverseSwimTraversalStepInput {
  readonly deltaSeconds: number;
  readonly movementInput: MetaverseFlightInputSnapshot;
  readonly preferredLookYawRadians: number;
  readonly readWaterSurfaceHeightMeters: (
    position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
    paddingMeters?: number
  ) => number;
  readonly readWaterborneTraversalExcludedColliders: (
    swimColliderHandle: RapierColliderHandle
  ) => readonly RapierColliderHandle[];
  readonly traversalCameraPitchRadians: number;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

type FixedStepTraversalDependencies = Pick<
  MetaverseTraversalRuntimeDependencies,
  | "physicsRuntime"
  | "resolveGroundedTraversalFilterPredicate"
  | "resolveWaterborneTraversalFilterPredicate"
  | "surfaceColliderSnapshots"
>;

export class MetaverseFixedStepTraversalSimulation {
  readonly #config: MetaverseRuntimeConfig;
  readonly #dependencies: FixedStepTraversalDependencies;

  #swimBodyRuntime: MetaverseSurfaceDriveBodyRuntime | null = null;

  constructor(
    config: MetaverseRuntimeConfig,
    dependencies: FixedStepTraversalDependencies
  ) {
    this.#config = config;
    this.#dependencies = dependencies;
  }

  dispose(): void {
    this.#swimBodyRuntime?.dispose();
    this.#swimBodyRuntime = null;
  }

  disposeSwimBodyRuntime(): void {
    this.#swimBodyRuntime?.dispose();
    this.#swimBodyRuntime = null;
  }

  readSwimColliderHandle(): RapierColliderHandle | null {
    return this.#swimBodyRuntime?.colliderHandle ?? null;
  }

  readSwimSnapshot(): SurfaceLocomotionSnapshot | null {
    return this.#swimBodyRuntime?.snapshot ?? null;
  }

  ensureSwimBodyRuntime(
    readWaterSurfaceHeightMeters: (
      position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
      paddingMeters?: number
    ) => number
  ): MetaverseSurfaceDriveBodyRuntime {
    if (this.#swimBodyRuntime !== null) {
      return this.#swimBodyRuntime;
    }

    const groundedSpawnPosition = freezeVector3(
      this.#config.groundedBody.spawnPosition.x,
      this.#config.groundedBody.spawnPosition.y,
      this.#config.groundedBody.spawnPosition.z
    );
    const spawnPosition = freezeVector3(
      groundedSpawnPosition.x,
      readWaterSurfaceHeightMeters(groundedSpawnPosition),
      groundedSpawnPosition.z
    );

    this.#swimBodyRuntime = new MetaverseSurfaceDriveBodyRuntime(
      {
        controllerOffsetMeters: this.#config.groundedBody.controllerOffsetMeters,
        shape: Object.freeze({
          halfHeightMeters: this.#config.groundedBody.capsuleHalfHeightMeters,
          kind: "capsule",
          radiusMeters: this.#config.groundedBody.capsuleRadiusMeters
        }),
        spawnPosition,
        spawnYawRadians: this.#config.camera.initialYawRadians,
        worldRadius: this.#config.movement.worldRadius
      },
      this.#dependencies.physicsRuntime
    );

    return this.#swimBodyRuntime;
  }

  teleportSwimBodyRuntime(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    readWaterSurfaceHeightMeters: (
      position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
      paddingMeters?: number
    ) => number
  ): SurfaceLocomotionSnapshot {
    const swimBodyRuntime = this.ensureSwimBodyRuntime(readWaterSurfaceHeightMeters);

    swimBodyRuntime.teleport(
      freezeVector3(
        position.x,
        readWaterSurfaceHeightMeters(position),
        position.z
      ),
      yawRadians
    );

    return swimBodyRuntime.snapshot;
  }

  syncAuthoritativeSwimLocomotion(input: {
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly positionBlendAlpha?: number;
    readonly readWaterSurfaceHeightMeters: (
      position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
      paddingMeters?: number
    ) => number;
    readonly yawBlendAlpha?: number;
    readonly yawRadians: number;
  }): SurfaceLocomotionSnapshot {
    const swimBodyRuntime = this.ensureSwimBodyRuntime(
      input.readWaterSurfaceHeightMeters
    );
    const currentSwimSnapshot = swimBodyRuntime.snapshot;
    const positionBlendAlpha = Math.max(
      0,
      Math.min(1, toFiniteNumber(input.positionBlendAlpha ?? 1, 1))
    );
    const yawBlendAlpha = Math.max(
      0,
      Math.min(1, toFiniteNumber(input.yawBlendAlpha ?? 1, 1))
    );
    const blendedYawRadians = wrapRadians(
      currentSwimSnapshot.yawRadians +
        wrapRadians(input.yawRadians - currentSwimSnapshot.yawRadians) *
          yawBlendAlpha
    );

    swimBodyRuntime.syncAuthoritativeState({
      linearVelocity: input.linearVelocity,
      position: freezeVector3(
        currentSwimSnapshot.position.x +
          (input.position.x - currentSwimSnapshot.position.x) *
            positionBlendAlpha,
        input.readWaterSurfaceHeightMeters(input.position),
        currentSwimSnapshot.position.z +
          (input.position.z - currentSwimSnapshot.position.z) *
            positionBlendAlpha
      ),
      yawRadians: blendedYawRadians
    });

    return swimBodyRuntime.snapshot;
  }

  advanceGroundedStep({
    deltaSeconds,
    groundedBodyRuntime,
    movementInput,
    preferredLookYawRadians,
    readGroundedTraversalExcludedColliders,
    resolveGroundedPresentationPosition,
    traversalCameraPitchRadians,
    traversalState
  }: MetaverseGroundedTraversalStepInput): MetaverseGroundedTraversalStepResult {
    const currentBodySnapshot = groundedBodyRuntime.snapshot;
    const surfacePolicyConfig = readMetaverseSurfacePolicyConfig(this.#config);
    const groundedTraversalStep = prepareMetaverseUnmountedTraversalStep({
      bodyControl: Object.freeze({
        boost: movementInput.boost,
        moveAxis: movementInput.moveAxis,
        strafeAxis: movementInput.strafeAxis,
        turnAxis: toFiniteNumber(movementInput.yawAxis, 0)
      }),
      deltaSeconds,
      groundedBodyConfig: Object.freeze({
        controllerOffsetMeters:
          this.#config.groundedBody.controllerOffsetMeters,
        maxTurnSpeedRadiansPerSecond:
          this.#config.groundedBody.maxTurnSpeedRadiansPerSecond,
        snapToGroundDistanceMeters:
          this.#config.groundedBody.snapToGroundDistanceMeters
      }),
      groundedBodySnapshot: currentBodySnapshot,
      jumpSupportVerticalSpeedTolerance: 0.5,
      preferredLookYawRadians,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots,
      surfacePolicyConfig,
      swimBodySnapshot: null,
      traversalState,
      waterRegionSnapshots: metaverseFixedStepSimulationWaterRegionSnapshots
    });

    if (groundedTraversalStep.locomotionMode !== "grounded") {
      throw new Error(
        "prepareMetaverseUnmountedTraversalStep returned a swim step while grounded"
      );
    }

    groundedBodyRuntime.setAutostepEnabled(
      groundedTraversalStep.autostepHeightMeters !== null,
      groundedTraversalStep.autostepHeightMeters ??
        this.#config.groundedBody.stepHeightMeters
    );
    this.#dependencies.physicsRuntime.stepSimulation(deltaSeconds);

    const bodySnapshot = groundedBodyRuntime.advance(
      groundedTraversalStep.bodyIntent,
      deltaSeconds,
      this.#dependencies.resolveGroundedTraversalFilterPredicate(
        readGroundedTraversalExcludedColliders()
      ),
      preferredLookYawRadians
    );

    const locomotionOutcome = resolveMetaverseUnmountedTraversalStep({
      groundedBodySnapshot: bodySnapshot,
      preparedTraversalStep: groundedTraversalStep,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots,
      surfacePolicyConfig,
      swimBodySnapshot: null,
      waterRegionSnapshots: metaverseFixedStepSimulationWaterRegionSnapshots
    });

    return Object.freeze({
      automaticSurfaceSnapshot: locomotionOutcome.automaticSurfaceSnapshot,
      autostepHeightMeters: groundedTraversalStep.autostepHeightMeters,
      cameraSnapshot: createTraversalGroundedCameraPresentationSnapshot(
        bodySnapshot,
        traversalCameraPitchRadians,
        this.#config,
        preferredLookYawRadians,
        resolveGroundedPresentationPosition(bodySnapshot)
      ),
      locomotionMode: locomotionOutcome.locomotionMode,
      nextTraversalState: locomotionOutcome.traversalState,
      supportHeightMeters: locomotionOutcome.supportHeightMeters,
      waterlineHeightMeters: locomotionOutcome.waterlineHeightMeters
    });
  }

  advanceSwimStep({
    deltaSeconds,
    movementInput,
    preferredLookYawRadians,
    readWaterSurfaceHeightMeters,
    readWaterborneTraversalExcludedColliders,
    traversalCameraPitchRadians,
    traversalState
  }: MetaverseSwimTraversalStepInput): MetaverseSwimTraversalStepResult {
    const swimBodyRuntime = this.ensureSwimBodyRuntime(
      readWaterSurfaceHeightMeters
    );
    const preparedTraversalStep = prepareMetaverseUnmountedTraversalStep({
      bodyControl: Object.freeze({
        boost: movementInput.boost,
        moveAxis: movementInput.moveAxis,
        strafeAxis: movementInput.strafeAxis,
        turnAxis: toFiniteNumber(movementInput.yawAxis, 0)
      }),
      deltaSeconds,
      groundedBodyConfig: Object.freeze({
        controllerOffsetMeters:
          this.#config.groundedBody.controllerOffsetMeters,
        maxTurnSpeedRadiansPerSecond:
          this.#config.groundedBody.maxTurnSpeedRadiansPerSecond,
        snapToGroundDistanceMeters:
          this.#config.groundedBody.snapToGroundDistanceMeters
      }),
      groundedBodySnapshot: null,
      jumpSupportVerticalSpeedTolerance: 0.5,
      preferredLookYawRadians,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(this.#config),
      swimBodySnapshot: swimBodyRuntime.snapshot,
      traversalState,
      waterRegionSnapshots: metaverseFixedStepSimulationWaterRegionSnapshots
    });

    if (preparedTraversalStep.locomotionMode !== "swim") {
      throw new Error(
        "prepareMetaverseUnmountedTraversalStep returned a grounded step while swimming"
      );
    }

    const nextSwimSnapshot = swimBodyRuntime.advance(
      Object.freeze({
        boost: preparedTraversalStep.bodyControl.boost,
        moveAxis: preparedTraversalStep.bodyControl.moveAxis,
        strafeAxis: preparedTraversalStep.bodyControl.strafeAxis,
        yawAxis: preparedTraversalStep.bodyControl.turnAxis
      }),
      this.#config.swim,
      deltaSeconds,
      preparedTraversalStep.waterlineHeightMeters,
      preferredLookYawRadians,
      this.#dependencies.resolveWaterborneTraversalFilterPredicate(
        null,
        readWaterborneTraversalExcludedColliders(swimBodyRuntime.colliderHandle)
      ),
      Object.freeze({
        surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots
      })
    );

    const locomotionOutcome = resolveMetaverseUnmountedTraversalStep({
      groundedBodySnapshot: null,
      preparedTraversalStep,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(this.#config),
      swimBodySnapshot: nextSwimSnapshot,
      waterRegionSnapshots: metaverseFixedStepSimulationWaterRegionSnapshots
    });

    return Object.freeze({
      automaticSurfaceSnapshot: locomotionOutcome.automaticSurfaceSnapshot,
      cameraSnapshot: createTraversalSwimCameraPresentationSnapshot(
        nextSwimSnapshot,
        traversalCameraPitchRadians,
        this.#config,
        preferredLookYawRadians,
        nextSwimSnapshot.position
      ),
      locomotionMode: locomotionOutcome.locomotionMode,
      nextSwimSnapshot,
      nextTraversalState: locomotionOutcome.traversalState,
      supportHeightMeters: locomotionOutcome.supportHeightMeters
    });
  }
}
