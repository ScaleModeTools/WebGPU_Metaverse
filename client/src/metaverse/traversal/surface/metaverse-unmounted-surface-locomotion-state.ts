import {
  MetaverseGroundedBodyRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierPhysicsRuntime
} from "@/physics";
import {
  metaverseRealtimeWorldCadenceConfig
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MetaverseCameraSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  createTraversalGroundedCameraPresentationSnapshot,
  createTraversalSwimCameraPresentationSnapshot
} from "../presentation/camera-presentation";
import { freezeVector3, toFiniteNumber, wrapRadians } from "../policies/surface-locomotion";
import {
  resolveAutomaticSurfaceLocomotionSnapshot,
  resolveSurfaceHeightMeters,
  resolveSurfaceSupportSnapshot,
  resolveWaterSurfaceHeightMeters
} from "../policies/surface-routing";
import {
  MetaverseFixedStepTraversalSimulation,
  type MetaverseGroundedTraversalStepResult,
  type MetaverseSwimTraversalStepResult
} from "../simulation/metaverse-fixed-step-traversal-simulation";
import type {
  MetaverseTraversalRuntimeDependencies,
  SurfaceLocomotionSnapshot
} from "../types/traversal";
import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type { MetaverseUnmountedTraversalStateSnapshot } from "@webgpu-metaverse/shared";

const authoritativeTraversalFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;

function createIdleGroundedBodyIntentSnapshot() {
  return Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    strafeAxis: 0,
    turnAxis: 0
  });
}

type SurfaceLocomotionDependencies = Pick<
  MetaverseTraversalRuntimeDependencies,
  | "readGroundedTraversalPlayerBlockers"
  | "resolveGroundedTraversalFilterPredicate"
  | "resolveWaterborneTraversalFilterPredicate"
  | "surfaceColliderSnapshots"
>;

interface EnterGroundedLocomotionInput {
  readonly linearVelocity?: PhysicsVector3Snapshot | null;
  readonly lookYawRadians: number;
  readonly position: PhysicsVector3Snapshot;
  readonly resolveGroundedPresentationPosition: () => PhysicsVector3Snapshot;
  readonly supportHeightMeters?: number | null;
  readonly traversalCameraPitchRadians: number;
  readonly yawRadians: number;
}

interface EnterSwimLocomotionInput {
  readonly linearVelocity?: PhysicsVector3Snapshot | null;
  readonly lookYawRadians: number;
  readonly position: PhysicsVector3Snapshot;
  readonly resolveSwimPresentationPosition: (
    swimSnapshot: SurfaceLocomotionSnapshot
  ) => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
  readonly yawRadians: number;
}

interface SyncAuthoritativeGroundedLocomotionInput {
  readonly grounded: boolean;
  readonly interaction?:
    | MetaverseGroundedBodyRuntime["snapshot"]["interaction"]
    | null;
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly lookYawRadians: number;
  readonly position: PhysicsVector3Snapshot;
  readonly positionBlendAlpha?: number;
  readonly resolveGroundedPresentationPosition: () => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
  readonly yawBlendAlpha?: number;
  readonly yawRadians: number;
}

interface SyncAuthoritativeSwimLocomotionInput {
  readonly lookYawRadians: number;
  readonly positionBlendAlpha?: number;
  readonly resolveSwimPresentationPosition: (
    swimSnapshot: SurfaceLocomotionSnapshot
  ) => PhysicsVector3Snapshot;
  readonly swimSnapshot: SurfaceLocomotionSnapshot;
  readonly traversalCameraPitchRadians: number;
  readonly yawBlendAlpha?: number;
}

interface SyncAutomaticSurfaceLocomotionInput {
  readonly currentLocomotionMode: MetaverseLocomotionModeId;
  readonly excludedOwnerEnvironmentAssetId?: string | null;
  readonly lookYawRadians: number;
  readonly position: PhysicsVector3Snapshot;
  readonly resolveGroundedPresentationPosition: () => PhysicsVector3Snapshot;
  readonly resolveSwimPresentationPosition: (
    swimSnapshot: SurfaceLocomotionSnapshot
  ) => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
  readonly yawRadians: number;
}

interface SyncAutomaticSurfaceLocomotionFromGroundedBodyInput {
  readonly currentLocomotionMode: MetaverseLocomotionModeId;
  readonly excludedOwnerEnvironmentAssetId?: string | null;
  readonly lookYawRadians: number;
  readonly resolveGroundedPresentationPosition: () => PhysicsVector3Snapshot;
  readonly resolveSwimPresentationPosition: (
    swimSnapshot: SurfaceLocomotionSnapshot
  ) => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
}

interface SyncGroundedCameraPresentationInput {
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly lookYawRadians: number;
  readonly resolveGroundedPresentationPosition: () => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
}

interface SyncSwimCameraPresentationInput {
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly lookYawRadians: number;
  readonly resolveSwimPresentationPosition: (
    swimSnapshot: SurfaceLocomotionSnapshot
  ) => PhysicsVector3Snapshot;
  readonly traversalCameraPitchRadians: number;
}

type AutomaticSurfaceTelemetrySnapshot = Readonly<{
  readonly automaticSurfaceSnapshot: ReturnType<
    typeof resolveAutomaticSurfaceLocomotionSnapshot
  >;
  readonly autostepHeightMeters: number | null;
}>;

export class MetaverseUnmountedSurfaceLocomotionState {
  readonly #config: MetaverseRuntimeConfig;
  readonly #dependencies: SurfaceLocomotionDependencies;
  readonly #fixedStepSimulation: MetaverseFixedStepTraversalSimulation;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #readMountedVehicleColliderHandle: () => RapierColliderHandle | null;

  #latestAutomaticSurfaceTelemetrySnapshot: AutomaticSurfaceTelemetrySnapshot;

  constructor(input: {
    readonly config: MetaverseRuntimeConfig;
    readonly dependencies: SurfaceLocomotionDependencies;
    readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
    readonly physicsRuntime: RapierPhysicsRuntime;
    readonly readMountedVehicleColliderHandle: () => RapierColliderHandle | null;
  }) {
    this.#config = input.config;
    this.#dependencies = input.dependencies;
    this.#groundedBodyRuntime = input.groundedBodyRuntime;
    this.#physicsRuntime = input.physicsRuntime;
    this.#readMountedVehicleColliderHandle =
      input.readMountedVehicleColliderHandle;
    this.#fixedStepSimulation = new MetaverseFixedStepTraversalSimulation(
      input.config,
      {
        physicsRuntime: input.physicsRuntime,
        readGroundedTraversalPlayerBlockers:
          input.dependencies.readGroundedTraversalPlayerBlockers,
        resolveGroundedTraversalFilterPredicate:
          input.dependencies.resolveGroundedTraversalFilterPredicate,
        resolveWaterborneTraversalFilterPredicate:
          input.dependencies.resolveWaterborneTraversalFilterPredicate,
        surfaceColliderSnapshots: input.dependencies.surfaceColliderSnapshots
      }
    );
    this.#latestAutomaticSurfaceTelemetrySnapshot =
      this.#createInitialAutomaticSurfaceTelemetrySnapshot();
  }

  get latestAutomaticSurfaceTelemetrySnapshot():
    AutomaticSurfaceTelemetrySnapshot {
    return this.#latestAutomaticSurfaceTelemetrySnapshot;
  }

  reset(): void {
    this.#fixedStepSimulation.dispose();
    this.#latestAutomaticSurfaceTelemetrySnapshot =
      this.#createInitialAutomaticSurfaceTelemetrySnapshot();
  }

  readCanonicalGroundedSpawnPosition(): PhysicsVector3Snapshot {
    return freezeVector3(
      this.#config.groundedBody.spawnPosition.x,
      this.#config.groundedBody.spawnPosition.y,
      this.#config.groundedBody.spawnPosition.z
    );
  }

  readSwimSnapshot(): SurfaceLocomotionSnapshot | null {
    return this.#fixedStepSimulation.readSwimSnapshot();
  }

  readGroundedTraversalExcludedColliders(): readonly RapierColliderHandle[] {
    const excludedColliders: RapierColliderHandle[] = [];
    const groundedColliderHandle = this.#groundedBodyRuntime.colliderHandle;

    if (groundedColliderHandle !== null) {
      excludedColliders.push(groundedColliderHandle);
    }

    const swimColliderHandle = this.#fixedStepSimulation.readSwimColliderHandle();

    if (swimColliderHandle !== null) {
      excludedColliders.push(swimColliderHandle);
    }

    const mountedVehicleColliderHandle = this.#readMountedVehicleColliderHandle();

    if (mountedVehicleColliderHandle !== null) {
      excludedColliders.push(mountedVehicleColliderHandle);
    }

    return excludedColliders;
  }

  readWaterborneTraversalExcludedColliders(
    colliderHandle: RapierColliderHandle
  ): readonly RapierColliderHandle[] {
    const excludedColliders = [...this.readGroundedTraversalExcludedColliders()];

    excludedColliders.push(colliderHandle);

    return excludedColliders;
  }

  readGroundedSupportHeightMeters(
    position: Pick<PhysicsVector3Snapshot, "x" | "z">,
    fallbackHeightMeters: number | null = null,
    maxSupportHeightMeters: number | null = null,
    preferredSupport: MetaverseUnmountedTraversalStateSnapshot["groundedSupport"] = null
  ): number | null {
    const localWaterSurfaceHeightMeters = this.readWaterSurfaceHeightMeters(
      position,
      this.#config.groundedBody.capsuleRadiusMeters
    );
    const resolvedSurfaceSupport = resolveSurfaceSupportSnapshot(
      this.#config,
      this.#dependencies.surfaceColliderSnapshots,
      position.x,
      position.z,
      null,
      maxSupportHeightMeters,
      preferredSupport
    );
    const resolvedSurfaceHeightMeters =
      resolvedSurfaceSupport?.supportHeightMeters ?? null;

    if (resolvedSurfaceHeightMeters === null) {
      return fallbackHeightMeters;
    }

    return fallbackHeightMeters !== null &&
      localWaterSurfaceHeightMeters !== null &&
      resolvedSurfaceHeightMeters <=
        localWaterSurfaceHeightMeters +
          this.#config.groundedBody.controllerOffsetMeters
      ? fallbackHeightMeters
      : resolvedSurfaceHeightMeters;
  }

  resolveGroundedSupportHeightMeters(
    position: PhysicsVector3Snapshot,
    fallbackHeightMeters: number | null = null,
    maxSupportHeightMeters: number | null = null
  ): number {
    const resolvedSupportHeightMeters =
      this.readGroundedSupportHeightMeters(
        position,
        fallbackHeightMeters,
        maxSupportHeightMeters
      );

    if (resolvedSupportHeightMeters === null) {
      return fallbackHeightMeters ?? position.y;
    }

    return resolvedSupportHeightMeters;
  }

  readWaterSurfaceHeightMeters(
    position: Pick<PhysicsVector3Snapshot, "x" | "z">,
    paddingMeters = 0
  ): number | null {
    return resolveWaterSurfaceHeightMeters(
      this.#config,
      position,
      paddingMeters
    );
  }

  resolveWaterSurfaceHeightMeters(
    position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
    paddingMeters = 0
  ): number {
    return (
      this.readWaterSurfaceHeightMeters(position, paddingMeters) ??
      toFiniteNumber(position.y, this.#config.camera.spawnPosition.y)
    );
  }

  resolveCurrentSwimSnapshot(): SurfaceLocomotionSnapshot {
    return (
      this.#fixedStepSimulation.readSwimSnapshot() ??
      this.#fixedStepSimulation.teleportSwimBodyRuntime(
        this.readCanonicalGroundedSpawnPosition(),
        this.#config.camera.initialYawRadians,
        (position, paddingMeters) =>
          this.resolveWaterSurfaceHeightMeters(position, paddingMeters)
      )
    );
  }

  advanceGroundedStep(input: {
    readonly deltaSeconds: number;
    readonly movementInput: MetaverseFlightInputSnapshot;
    readonly preferredLookYawRadians: number;
    readonly resolveGroundedPresentationPosition: (
      bodySnapshot: PhysicsVector3Snapshot
    ) => PhysicsVector3Snapshot;
    readonly traversalCameraPitchRadians: number;
    readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  }): MetaverseGroundedTraversalStepResult {
    const groundedStepResult = this.#fixedStepSimulation.advanceGroundedStep({
      deltaSeconds: input.deltaSeconds,
      groundedBodyRuntime: this.#groundedBodyRuntime,
      movementInput: input.movementInput,
      preferredLookYawRadians: input.preferredLookYawRadians,
      readGroundedTraversalExcludedColliders: () =>
        this.readGroundedTraversalExcludedColliders(),
      resolveGroundedPresentationPosition: (bodySnapshot) =>
        input.resolveGroundedPresentationPosition(bodySnapshot.position),
      traversalCameraPitchRadians: input.traversalCameraPitchRadians,
      traversalState: input.traversalState
    });

    this.#syncAutomaticSurfaceTelemetry(
      groundedStepResult.automaticSurfaceSnapshot,
      groundedStepResult.autostepHeightMeters
    );

    return groundedStepResult;
  }

  advanceSwimStep(input: {
    readonly deltaSeconds: number;
    readonly movementInput: MetaverseFlightInputSnapshot;
    readonly preferredLookYawRadians: number;
    readonly resolveSwimPresentationPosition: (
      swimSnapshot: SurfaceLocomotionSnapshot
    ) => PhysicsVector3Snapshot;
    readonly traversalCameraPitchRadians: number;
    readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  }): MetaverseSwimTraversalStepResult {
    const swimStepResult = this.#fixedStepSimulation.advanceSwimStep({
      deltaSeconds: input.deltaSeconds,
      movementInput: input.movementInput,
      preferredLookYawRadians: input.preferredLookYawRadians,
      readWaterSurfaceHeightMeters: (position, paddingMeters) =>
        this.resolveWaterSurfaceHeightMeters(position, paddingMeters),
      readWaterborneTraversalExcludedColliders: (swimColliderHandle) =>
        this.readWaterborneTraversalExcludedColliders(swimColliderHandle),
      traversalCameraPitchRadians: input.traversalCameraPitchRadians,
      traversalState: input.traversalState
    });

    this.#syncAutomaticSurfaceTelemetry(
      swimStepResult.automaticSurfaceSnapshot,
      null
    );

    return swimStepResult;
  }

  enterGroundedLocomotion(
    input: EnterGroundedLocomotionInput
  ): MetaverseCameraSnapshot | null {
    if (!this.#groundedBodyRuntime.isInitialized) {
      return null;
    }

    const groundedPosition = freezeVector3(
      input.position.x,
      input.supportHeightMeters ??
        this.resolveGroundedSupportHeightMeters(input.position),
      input.position.z
    );

    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#fixedStepSimulation.disposeSwimBodyRuntime();

    if (input.linearVelocity === undefined || input.linearVelocity === null) {
      this.#groundedBodyRuntime.teleport(groundedPosition, input.yawRadians);
      this.#physicsRuntime.stepSimulation(authoritativeTraversalFixedStepSeconds);
      this.#groundedBodyRuntime.advance(
        createIdleGroundedBodyIntentSnapshot(),
        authoritativeTraversalFixedStepSeconds,
        this.#dependencies.resolveGroundedTraversalFilterPredicate(
          this.readGroundedTraversalExcludedColliders()
        ),
        input.lookYawRadians
      );
    } else {
      this.#groundedBodyRuntime.syncAuthoritativeState({
        grounded: true,
        linearVelocity: freezeVector3(
          input.linearVelocity.x,
          0,
          input.linearVelocity.z
        ),
        position: groundedPosition,
        yawRadians: input.yawRadians
      });
    }

    return createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      input.traversalCameraPitchRadians,
      this.#config,
      input.lookYawRadians,
      input.resolveGroundedPresentationPosition()
    );
  }

  enterSwimLocomotion(input: EnterSwimLocomotionInput): MetaverseCameraSnapshot {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    const swimSnapshot = this.#fixedStepSimulation.teleportSwimBodyRuntime(
      input.position,
      input.yawRadians,
      (position, paddingMeters) =>
        this.resolveWaterSurfaceHeightMeters(position, paddingMeters),
      input.linearVelocity ?? null
    );

    return createTraversalSwimCameraPresentationSnapshot(
      swimSnapshot,
      input.traversalCameraPitchRadians,
      this.#config,
      input.lookYawRadians,
      input.resolveSwimPresentationPosition(swimSnapshot)
    );
  }

  syncAuthoritativeGroundedLocomotion(
    input: SyncAuthoritativeGroundedLocomotionInput
  ): MetaverseCameraSnapshot | null {
    if (!this.#groundedBodyRuntime.isInitialized) {
      return null;
    }

    const currentBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const positionBlendAlpha = Math.max(
      0,
      Math.min(1, toFiniteNumber(input.positionBlendAlpha ?? 1, 1))
    );
    const yawBlendAlpha = Math.max(
      0,
      Math.min(1, toFiniteNumber(input.yawBlendAlpha ?? 1, 1))
    );
    const blendedYawRadians = wrapRadians(
      currentBodySnapshot.yawRadians +
        wrapRadians(input.yawRadians - currentBodySnapshot.yawRadians) *
          yawBlendAlpha
    );
    const blendedPosition = freezeVector3(
      currentBodySnapshot.position.x +
        (input.position.x - currentBodySnapshot.position.x) *
          positionBlendAlpha,
      currentBodySnapshot.position.y +
        (input.position.y - currentBodySnapshot.position.y) *
          positionBlendAlpha,
      currentBodySnapshot.position.z +
        (input.position.z - currentBodySnapshot.position.z) *
          positionBlendAlpha
    );

    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#groundedBodyRuntime.syncAuthoritativeState({
      grounded: input.grounded,
      interaction: input.interaction ?? null,
      linearVelocity: input.linearVelocity,
      position: blendedPosition,
      yawRadians: blendedYawRadians
    });

    return createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      input.traversalCameraPitchRadians,
      this.#config,
      input.lookYawRadians,
      input.resolveGroundedPresentationPosition()
    );
  }

  syncAuthoritativeSwimLocomotion(
    input: SyncAuthoritativeSwimLocomotionInput
  ): MetaverseCameraSnapshot {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    const swimSnapshot = this.#fixedStepSimulation.syncAuthoritativeSwimLocomotion({
      positionBlendAlpha: input.positionBlendAlpha ?? 1,
      readWaterSurfaceHeightMeters: (position, paddingMeters) =>
        this.resolveWaterSurfaceHeightMeters(position, paddingMeters),
      swimSnapshot: input.swimSnapshot,
      yawBlendAlpha: input.yawBlendAlpha ?? 1,
    });

    return createTraversalSwimCameraPresentationSnapshot(
      swimSnapshot,
      input.traversalCameraPitchRadians,
      this.#config,
      input.lookYawRadians,
      input.resolveSwimPresentationPosition(swimSnapshot)
    );
  }

  syncAutomaticSurfaceLocomotion(input: SyncAutomaticSurfaceLocomotionInput): {
    readonly cameraSnapshot: MetaverseCameraSnapshot | null;
    readonly locomotionMode: "grounded" | "swim";
  } {
    const locomotionSnapshot = resolveAutomaticSurfaceLocomotionSnapshot(
      this.#config,
      this.#dependencies.surfaceColliderSnapshots,
      input.position,
      input.yawRadians,
      input.currentLocomotionMode === "grounded" ? "grounded" : "swim",
      input.excludedOwnerEnvironmentAssetId ?? null
    );
    const locomotionDecision = locomotionSnapshot.decision;

    this.#syncAutomaticSurfaceTelemetry(locomotionSnapshot, null);

    if (locomotionDecision.locomotionMode === "grounded") {
      return Object.freeze({
        cameraSnapshot: this.enterGroundedLocomotion({
          lookYawRadians: input.lookYawRadians,
          position: input.position,
          resolveGroundedPresentationPosition:
            input.resolveGroundedPresentationPosition,
          supportHeightMeters: locomotionDecision.supportHeightMeters,
          traversalCameraPitchRadians: input.traversalCameraPitchRadians,
          yawRadians: input.yawRadians
        }),
        locomotionMode: "grounded"
      });
    }

    return Object.freeze({
      cameraSnapshot: this.enterSwimLocomotion({
        lookYawRadians: input.lookYawRadians,
        position: input.position,
        resolveSwimPresentationPosition:
          input.resolveSwimPresentationPosition,
        traversalCameraPitchRadians: input.traversalCameraPitchRadians,
        yawRadians: input.yawRadians
      }),
      locomotionMode: "swim"
    });
  }

  syncAutomaticSurfaceLocomotionFromGroundedBody(
    input: SyncAutomaticSurfaceLocomotionFromGroundedBodyInput
  ): {
    readonly cameraSnapshot: MetaverseCameraSnapshot | null;
    readonly locomotionMode: "grounded" | "swim";
  } {
    if (!this.#groundedBodyRuntime.isInitialized) {
      return Object.freeze({
        cameraSnapshot: null,
        locomotionMode:
          input.currentLocomotionMode === "swim" ? "swim" : "grounded"
      });
    }

    const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const locomotionSnapshot = resolveAutomaticSurfaceLocomotionSnapshot(
      this.#config,
      this.#dependencies.surfaceColliderSnapshots,
      groundedBodySnapshot.position,
      groundedBodySnapshot.yawRadians,
      input.currentLocomotionMode === "grounded" ? "grounded" : "swim",
      input.excludedOwnerEnvironmentAssetId ?? null
    );
    const locomotionDecision = locomotionSnapshot.decision;

    this.#syncAutomaticSurfaceTelemetry(locomotionSnapshot, null);

    if (locomotionDecision.locomotionMode === "grounded") {
      return Object.freeze({
        cameraSnapshot: this.syncGroundedCameraPresentation({
          locomotionMode: "grounded",
          lookYawRadians: input.lookYawRadians,
          resolveGroundedPresentationPosition:
            input.resolveGroundedPresentationPosition,
          traversalCameraPitchRadians: input.traversalCameraPitchRadians
        }),
        locomotionMode: "grounded"
      });
    }

    return Object.freeze({
      cameraSnapshot: this.enterSwimLocomotion({
        linearVelocity: freezeVector3(
          groundedBodySnapshot.linearVelocity.x,
          0,
          groundedBodySnapshot.linearVelocity.z
        ),
        lookYawRadians: input.lookYawRadians,
        position: groundedBodySnapshot.position,
        resolveSwimPresentationPosition: input.resolveSwimPresentationPosition,
        traversalCameraPitchRadians: input.traversalCameraPitchRadians,
        yawRadians: groundedBodySnapshot.yawRadians
      }),
      locomotionMode: "swim"
    });
  }

  syncGroundedCameraPresentation(
    input: SyncGroundedCameraPresentationInput
  ): MetaverseCameraSnapshot | null {
    if (
      !this.#groundedBodyRuntime.isInitialized ||
      input.locomotionMode !== "grounded"
    ) {
      return null;
    }

    return createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      input.traversalCameraPitchRadians,
      this.#config,
      input.lookYawRadians,
      input.resolveGroundedPresentationPosition()
    );
  }

  syncSwimCameraPresentation(
    input: SyncSwimCameraPresentationInput
  ): MetaverseCameraSnapshot | null {
    if (input.locomotionMode !== "swim") {
      return null;
    }

    const swimSnapshot = this.#fixedStepSimulation.readSwimSnapshot();

    if (swimSnapshot === null) {
      return null;
    }

    return createTraversalSwimCameraPresentationSnapshot(
      swimSnapshot,
      input.traversalCameraPitchRadians,
      this.#config,
      input.lookYawRadians,
      input.resolveSwimPresentationPosition(swimSnapshot)
    );
  }

  #createInitialAutomaticSurfaceTelemetrySnapshot():
    AutomaticSurfaceTelemetrySnapshot {
    const groundedSpawnPosition = this.readCanonicalGroundedSpawnPosition();
    const automaticSurfaceSnapshot = resolveAutomaticSurfaceLocomotionSnapshot(
      this.#config,
      this.#dependencies.surfaceColliderSnapshots,
      groundedSpawnPosition,
      this.#config.camera.initialYawRadians,
      "grounded"
    );

    return Object.freeze({
      automaticSurfaceSnapshot: Object.freeze({
        ...automaticSurfaceSnapshot,
        debug: Object.freeze({
          ...automaticSurfaceSnapshot.debug,
          resolvedSupportHeightMeters:
            automaticSurfaceSnapshot.debug.resolvedSupportHeightMeters ??
            resolveSurfaceHeightMeters(
              this.#config,
              this.#dependencies.surfaceColliderSnapshots,
              groundedSpawnPosition.x,
              groundedSpawnPosition.z
            ) ??
            groundedSpawnPosition.y
        })
      }),
      autostepHeightMeters: null
    });
  }

  #syncAutomaticSurfaceTelemetry(
    automaticSurfaceSnapshot: ReturnType<typeof resolveAutomaticSurfaceLocomotionSnapshot>,
    autostepHeightMeters: number | null
  ): void {
    this.#latestAutomaticSurfaceTelemetrySnapshot = Object.freeze({
      automaticSurfaceSnapshot,
      autostepHeightMeters
    });
  }
}
