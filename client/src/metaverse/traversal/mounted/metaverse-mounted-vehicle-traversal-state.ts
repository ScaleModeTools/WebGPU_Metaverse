import type { RapierColliderHandle } from "@/physics";

import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type { MountedEnvironmentSnapshot } from "../../types/mounted";
import type { MetaverseEnvironmentAssetProofConfig } from "../../types/proof";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  advanceTraversalCameraPresentationPitchRadians,
  advanceTraversalMountedOccupancyLookYawRadians,
  clampTraversalMountedOccupancyPitchRadians,
  createTraversalMountedVehicleCameraPresentationSnapshot
} from "../presentation/camera-presentation";
import {
  resolveMetaverseMountedOccupancyPresentationStateSnapshot,
  type MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import {
  createMountedVehicleRuntimeContext,
  didMountedVehiclePoseChange,
  resolveMountedEnvironmentSnapshot,
  resolveMountedVehicleControlIntent,
  resolveRoutedDriverVehicleControlIntentSnapshot
} from "./mounted-vehicle-runtime-context";
import type {
  MetaverseTraversalRuntimeDependencies,
  RoutedDriverVehicleControlIntentSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";
import type { MetaverseCameraSnapshot } from "../../types/presentation";
import { MetaverseVehicleRuntime } from "../../vehicles";

type MountableEnvironmentConfig = Pick<
  MetaverseEnvironmentAssetProofConfig,
  "collider" | "entries" | "environmentAssetId" | "label" | "seats"
>;

type MountedTraversalDependencies = Pick<
  MetaverseTraversalRuntimeDependencies,
  | "physicsRuntime"
  | "readDynamicEnvironmentCollisionPose"
  | "readMountedEnvironmentAnchorSnapshot"
  | "readMountableEnvironmentConfig"
  | "resolveWaterborneTraversalFilterPredicate"
  | "setDynamicEnvironmentPose"
  | "surfaceColliderSnapshots"
>;

export interface MountedVehicleAuthoritativeSyncResult {
  readonly applied: boolean;
  readonly keepsFreeRoam: boolean;
  readonly nextMountedVehicleSnapshot: TraversalMountedVehicleSnapshot | null;
  readonly poseChanged: boolean;
  readonly previousMountedVehicleSnapshot: TraversalMountedVehicleSnapshot | null;
  readonly presentationCameraSnapshot: MetaverseCameraSnapshot | null;
}

export interface MountedVehicleAdvanceResult {
  readonly cameraSnapshot: MetaverseCameraSnapshot | null;
  readonly traversalCameraPitchRadians: number;
}

export interface MountedVehicleOccupancyResult {
  readonly mountedEnvironmentSnapshot: MountedEnvironmentSnapshot | null;
  readonly occupied: boolean;
}

export class MetaverseMountedVehicleTraversalState {
  readonly #config: MetaverseRuntimeConfig;
  readonly #dependencies: MountedTraversalDependencies;

  #mountedEnvironmentConfig: MountableEnvironmentConfig | null = null;
  #mountedOccupancyLookYawRadians = 0;
  #mountedVehicleRuntime: MetaverseVehicleRuntime | null = null;
  #routedDriverVehicleControlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null =
    null;

  constructor(
    config: MetaverseRuntimeConfig,
    dependencies: MountedTraversalDependencies
  ) {
    this.#config = config;
    this.#dependencies = dependencies;
  }

  get colliderHandle(): RapierColliderHandle | null {
    return this.#mountedVehicleRuntime?.colliderHandle ?? null;
  }

  get keepsFreeRoam(): boolean {
    return this.mountedOccupancyPresentationState?.keepFreeRoam === true;
  }

  get mountedEnvironmentSnapshot(): MountedEnvironmentSnapshot | null {
    if (
      this.#mountedVehicleRuntime === null ||
      this.#mountedEnvironmentConfig === null
    ) {
      return null;
    }

    return resolveMountedEnvironmentSnapshot(
      this.#mountedEnvironmentConfig,
      this.#mountedVehicleRuntime.snapshot
    );
  }

  get mountedVehicleSnapshot(): TraversalMountedVehicleSnapshot | null {
    return this.#mountedVehicleRuntime?.snapshot ?? null;
  }

  get mountedOccupancyPresentationState():
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null {
    return resolveMetaverseMountedOccupancyPresentationStateSnapshot(
      this.#mountedVehicleRuntime?.snapshot.occupancy ?? null
    );
  }

  get occupancy(): TraversalMountedVehicleSnapshot["occupancy"] {
    return this.#mountedVehicleRuntime?.snapshot.occupancy ?? null;
  }

  get routedDriverVehicleControlIntentSnapshot():
    | RoutedDriverVehicleControlIntentSnapshot
    | null {
    return this.#routedDriverVehicleControlIntentSnapshot;
  }

  clear(): void {
    this.#mountedVehicleRuntime?.clearOccupancy();
    this.#mountedVehicleRuntime?.dispose();
    this.#mountedEnvironmentConfig = null;
    this.#mountedOccupancyLookYawRadians = 0;
    this.#mountedVehicleRuntime = null;
    this.#routedDriverVehicleControlIntentSnapshot = null;
  }

  resetLookState(): void {
    this.#mountedOccupancyLookYawRadians = 0;
  }

  boardEnvironment(
    environmentAssetId: string,
    requestedEntryId: string | null,
    excludedColliders: readonly RapierColliderHandle[]
  ): MountedVehicleOccupancyResult {
    const mountedVehicleRuntimeContext =
      this.#ensureMountedVehicleRuntime(environmentAssetId, excludedColliders);

    if (mountedVehicleRuntimeContext === null) {
      return {
        mountedEnvironmentSnapshot: this.mountedEnvironmentSnapshot,
        occupied: false
      };
    }

    const { mountableEnvironmentConfig, mountedVehicleRuntime } =
      mountedVehicleRuntimeContext;
    const occupiedRuntime =
      requestedEntryId !== null
        ? mountedVehicleRuntime.occupyEntry(requestedEntryId)
        : mountableEnvironmentConfig.entries?.[0] !== undefined
          ? mountedVehicleRuntime.occupyEntry(
              mountableEnvironmentConfig.entries[0].entryId
            )
          : (() => {
              const directSeat =
                mountableEnvironmentConfig.seats?.find(
                  (seat) => seat.directEntryEnabled
                ) ?? null;

              return directSeat === null
                ? null
                : mountedVehicleRuntime.occupySeat(directSeat.seatId);
            })();

    if (occupiedRuntime === null) {
      return {
        mountedEnvironmentSnapshot: this.mountedEnvironmentSnapshot,
        occupied: false
      };
    }

    this.resetLookState();

    return {
      mountedEnvironmentSnapshot: this.mountedEnvironmentSnapshot,
      occupied: true
    };
  }

  occupySeat(
    environmentAssetId: string,
    seatId: string,
    excludedColliders: readonly RapierColliderHandle[]
  ): MountedVehicleOccupancyResult {
    const mountedVehicleRuntimeContext =
      this.#ensureMountedVehicleRuntime(environmentAssetId, excludedColliders);

    if (mountedVehicleRuntimeContext === null) {
      return {
        mountedEnvironmentSnapshot: this.mountedEnvironmentSnapshot,
        occupied: false
      };
    }

    const occupiedSeatRuntime =
      mountedVehicleRuntimeContext.mountedVehicleRuntime.occupySeat(seatId);

    if (occupiedSeatRuntime === null) {
      return {
        mountedEnvironmentSnapshot: this.mountedEnvironmentSnapshot,
        occupied: false
      };
    }

    this.resetLookState();

    return {
      mountedEnvironmentSnapshot: this.mountedEnvironmentSnapshot,
      occupied: true
    };
  }

  syncPresentation(
    traversalCameraPitchRadians: number
  ): MetaverseCameraSnapshot | null {
    const mountedVehicleSnapshot = this.#mountedVehicleRuntime?.snapshot;

    if (mountedVehicleSnapshot === undefined) {
      return null;
    }

    this.#dependencies.setDynamicEnvironmentPose(
      mountedVehicleSnapshot.environmentAssetId,
      {
        position: mountedVehicleSnapshot.position,
        yawRadians: mountedVehicleSnapshot.yawRadians
      }
    );
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedOccupancyPresentationState =
      this.mountedOccupancyPresentationState;
    const mountedEnvironmentAnchorSnapshot =
      mountedEnvironment === null
        ? null
        : this.#dependencies.readMountedEnvironmentAnchorSnapshot(
            mountedEnvironment
          );

    return createTraversalMountedVehicleCameraPresentationSnapshot(
      mountedVehicleSnapshot,
      traversalCameraPitchRadians,
      this.#config,
      mountedEnvironmentAnchorSnapshot,
      mountedOccupancyPresentationState,
      this.#mountedOccupancyLookYawRadians
    );
  }

  advance(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number,
    traversalCameraPitchRadians: number
  ): MountedVehicleAdvanceResult {
    const mountedVehicleRuntime = this.#mountedVehicleRuntime;

    if (mountedVehicleRuntime === null) {
      return {
        cameraSnapshot: null,
        traversalCameraPitchRadians
      };
    }

    const mountedVehicleState = mountedVehicleRuntime.snapshot;
    const mountedOccupancyPresentationState =
      this.mountedOccupancyPresentationState;
    const nextTraversalCameraPitchRadians =
      clampTraversalMountedOccupancyPitchRadians(
        advanceTraversalCameraPresentationPitchRadians(
          traversalCameraPitchRadians,
          movementInput,
          this.#config,
          deltaSeconds
        ),
        mountedOccupancyPresentationState
      );
    this.#mountedOccupancyLookYawRadians =
      advanceTraversalMountedOccupancyLookYawRadians(
        this.#mountedOccupancyLookYawRadians,
        movementInput,
        mountedOccupancyPresentationState,
        this.#config,
        deltaSeconds
      );
    const mountedVehicleLocomotionInput = resolveMountedVehicleControlIntent(
      mountedVehicleState,
      movementInput
    );

    this.#routedDriverVehicleControlIntentSnapshot =
      resolveRoutedDriverVehicleControlIntentSnapshot(
        mountedVehicleState,
        mountedVehicleLocomotionInput
      );

    const mountedVehicleSnapshot = mountedVehicleRuntime.advance(
      mountedVehicleLocomotionInput,
      this.#config.skiff,
      deltaSeconds,
      this.#config.movement.worldRadius
    );
    this.#dependencies.setDynamicEnvironmentPose(
      mountedVehicleSnapshot.environmentAssetId,
      {
        position: mountedVehicleSnapshot.position,
        yawRadians: mountedVehicleSnapshot.yawRadians
      }
    );
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedEnvironmentAnchorSnapshot =
      mountedEnvironment === null
        ? null
        : this.#dependencies.readMountedEnvironmentAnchorSnapshot(
            mountedEnvironment
          );

    return {
      cameraSnapshot: createTraversalMountedVehicleCameraPresentationSnapshot(
        mountedVehicleSnapshot,
        nextTraversalCameraPitchRadians,
        this.#config,
        mountedEnvironmentAnchorSnapshot,
        mountedOccupancyPresentationState,
        this.#mountedOccupancyLookYawRadians
      ),
      traversalCameraPitchRadians: nextTraversalCameraPitchRadians
    };
  }

  syncAuthoritativeVehiclePose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly linearVelocity?: import("@/physics").PhysicsVector3Snapshot | null;
      readonly position: import("@/physics").PhysicsVector3Snapshot;
      readonly yawRadians: number;
    },
    traversalCameraPitchRadians: number
  ): MountedVehicleAuthoritativeSyncResult {
    const mountedVehicleRuntime = this.#mountedVehicleRuntime;

    if (
      mountedVehicleRuntime === null ||
      this.#mountedEnvironmentConfig?.environmentAssetId !== environmentAssetId
    ) {
      this.#dependencies.setDynamicEnvironmentPose(environmentAssetId, poseSnapshot);

      return {
        applied: false,
        keepsFreeRoam: false,
        nextMountedVehicleSnapshot: null,
        poseChanged: false,
        presentationCameraSnapshot: null,
        previousMountedVehicleSnapshot: null
      };
    }

    const previousMountedVehicleSnapshot = mountedVehicleRuntime.snapshot;

    mountedVehicleRuntime.syncAuthoritativePose(poseSnapshot);

    const nextMountedVehicleSnapshot = mountedVehicleRuntime.snapshot;
    const keepsFreeRoam = this.keepsFreeRoam;

    if (keepsFreeRoam) {
      this.#dependencies.setDynamicEnvironmentPose(
        nextMountedVehicleSnapshot.environmentAssetId,
        {
          position: nextMountedVehicleSnapshot.position,
          yawRadians: nextMountedVehicleSnapshot.yawRadians
        }
      );
    }

    return {
      applied: true,
      keepsFreeRoam,
      nextMountedVehicleSnapshot,
      poseChanged: didMountedVehiclePoseChange(
        previousMountedVehicleSnapshot,
        nextMountedVehicleSnapshot
      ),
      presentationCameraSnapshot: keepsFreeRoam
        ? null
        : this.syncPresentation(traversalCameraPitchRadians),
      previousMountedVehicleSnapshot
    };
  }

  #ensureMountedVehicleRuntime(
    environmentAssetId: string,
    excludedColliders: readonly RapierColliderHandle[]
  ) {
    if (
      this.#mountedVehicleRuntime !== null &&
      this.#mountedEnvironmentConfig !== null &&
      this.#mountedEnvironmentConfig.environmentAssetId === environmentAssetId
    ) {
      return {
        mountableEnvironmentConfig: this.#mountedEnvironmentConfig,
        mountedVehicleRuntime: this.#mountedVehicleRuntime
      };
    }

    this.clear();
    const mountedVehicleRuntimeContext = createMountedVehicleRuntimeContext({
      config: this.#config,
      environmentAssetId,
      excludedColliders,
      physicsRuntime: this.#dependencies.physicsRuntime,
      readDynamicEnvironmentCollisionPose:
        this.#dependencies.readDynamicEnvironmentCollisionPose,
      readMountableEnvironmentConfig:
        this.#dependencies.readMountableEnvironmentConfig,
      resolveWaterborneTraversalFilterPredicate:
        this.#dependencies.resolveWaterborneTraversalFilterPredicate,
      surfaceColliderSnapshots: this.#dependencies.surfaceColliderSnapshots
    });

    if (mountedVehicleRuntimeContext === null) {
      return null;
    }

    this.#mountedVehicleRuntime = mountedVehicleRuntimeContext.mountedVehicleRuntime;
    this.#mountedEnvironmentConfig =
      mountedVehicleRuntimeContext.mountableEnvironmentConfig;

    return mountedVehicleRuntimeContext;
  }
}
