import type { MetaverseGroundedBodyRuntime } from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MountedEnvironmentSnapshot } from "../../types/mounted";
import type { MetaverseCameraSnapshot } from "../../types/presentation";
import type { MountedEnvironmentAnchorSnapshot } from "../types/traversal";
import { freezeVector3 } from "../policies/surface-locomotion";
import type { LocalAuthorityPoseIntentionalDiscontinuityCause } from "../reconciliation/local-authority-pose-correction";
import { MetaverseUnmountedSurfaceLocomotionState } from "../surface/metaverse-unmounted-surface-locomotion-state";
import { MetaverseMountedVehicleTraversalState } from "./metaverse-mounted-vehicle-traversal-state";

interface MetaverseMountedTraversalTransitionStateDependencies {
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly mountedVehicleState: MetaverseMountedVehicleTraversalState;
  readonly noteIntentionalDiscontinuity: (
    cause: LocalAuthorityPoseIntentionalDiscontinuityCause
  ) => void;
  readonly readCameraSnapshot: () => MetaverseCameraSnapshot;
  readonly readLocomotionMode: () => MetaverseLocomotionModeId;
  readonly readMountedEnvironmentAnchorSnapshot: (
    mountedEnvironment: MountedEnvironmentSnapshot
  ) => MountedEnvironmentAnchorSnapshot | null;
  readonly readTraversalCameraPitchRadians: () => number;
  readonly readUnmountedLookYawRadians: () => number;
  readonly resolveGroundedPresentationPosition: () => import("@/physics").PhysicsVector3Snapshot;
  readonly resolveSwimPresentationPosition: (
    swimSnapshot: import("../types/traversal").SurfaceLocomotionSnapshot | null
  ) => import("@/physics").PhysicsVector3Snapshot;
  readonly setCameraSnapshot: (cameraSnapshot: MetaverseCameraSnapshot) => void;
  readonly setLocomotionMode: (locomotionMode: MetaverseLocomotionModeId) => void;
  readonly setTraversalCameraPitchRadians: (pitchRadians: number) => void;
  readonly surfaceLocomotionState: MetaverseUnmountedSurfaceLocomotionState;
  readonly syncCharacterPresentationSnapshot: () => void;
  readonly syncLocalTraversalAuthorityState: (advanceTick: boolean) => void;
}

export class MetaverseMountedTraversalTransitionState {
  readonly #dependencies: MetaverseMountedTraversalTransitionStateDependencies;

  constructor(
    dependencies: MetaverseMountedTraversalTransitionStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  syncMountedEnvironment(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    if (mountedEnvironment !== null) {
      if (
        mountedEnvironment.occupancyKind === "seat" &&
        mountedEnvironment.seatId !== null
      ) {
        this.occupySeat(
          mountedEnvironment.environmentAssetId,
          mountedEnvironment.seatId
        );
      } else if (
        mountedEnvironment.occupancyKind === "entry" &&
        mountedEnvironment.entryId !== null
      ) {
        this.boardEnvironment(
          mountedEnvironment.environmentAssetId,
          mountedEnvironment.entryId
        );
      } else {
        this.#dependencies.syncCharacterPresentationSnapshot();
      }

      return;
    }

    this.leaveMountedEnvironment();
  }

  boardEnvironment(
    environmentAssetId: string,
    requestedEntryId: string | null = null
  ): MountedEnvironmentSnapshot | null {
    const occupancyResult = this.#dependencies.mountedVehicleState.boardEnvironment(
      environmentAssetId,
      requestedEntryId,
      this.#dependencies.surfaceLocomotionState.readGroundedTraversalExcludedColliders()
    );

    if (!occupancyResult.occupied) {
      this.#dependencies.syncCharacterPresentationSnapshot();
      return this.#dependencies.mountedVehicleState.mountedEnvironmentSnapshot;
    }

    this.#dependencies.noteIntentionalDiscontinuity("mounted-boarding");
    this.#enterMountedOccupancyTraversalState();
    this.#dependencies.syncCharacterPresentationSnapshot();

    return this.#dependencies.mountedVehicleState.mountedEnvironmentSnapshot;
  }

  occupySeat(
    environmentAssetId: string,
    seatId: string
  ): MountedEnvironmentSnapshot | null {
    const occupancyResult = this.#dependencies.mountedVehicleState.occupySeat(
      environmentAssetId,
      seatId,
      this.#dependencies.surfaceLocomotionState.readGroundedTraversalExcludedColliders()
    );

    if (!occupancyResult.occupied) {
      this.#dependencies.syncCharacterPresentationSnapshot();
      return this.#dependencies.mountedVehicleState.mountedEnvironmentSnapshot;
    }

    this.#dependencies.noteIntentionalDiscontinuity("mounted-boarding");
    this.#enterMountedOccupancyTraversalState();
    this.#dependencies.syncCharacterPresentationSnapshot();

    return this.#dependencies.mountedVehicleState.mountedEnvironmentSnapshot;
  }

  leaveMountedEnvironment(): void {
    const previousMountedVehicleState =
      this.#dependencies.mountedVehicleState.mountedVehicleSnapshot;

    if (previousMountedVehicleState !== null) {
      this.#dependencies.noteIntentionalDiscontinuity("mounted-unboarding");
      const freeRoamMountedOccupancy =
        this.#dependencies.mountedVehicleState.keepsFreeRoam;

      this.#dependencies.mountedVehicleState.clear();
      const automaticSurfaceSyncResult = freeRoamMountedOccupancy
        ? this.#dependencies.surfaceLocomotionState
            .syncAutomaticSurfaceLocomotionFromGroundedBody({
              currentLocomotionMode: this.#dependencies.readLocomotionMode(),
              excludedOwnerEnvironmentAssetId: null,
              lookYawRadians: this.#dependencies.readUnmountedLookYawRadians(),
              resolveGroundedPresentationPosition: () =>
                this.#dependencies.resolveGroundedPresentationPosition(),
              resolveSwimPresentationPosition: (swimSnapshot) =>
                this.#dependencies.resolveSwimPresentationPosition(
                  swimSnapshot
                ),
              traversalCameraPitchRadians:
                this.#dependencies.readTraversalCameraPitchRadians()
            })
        : this.#dependencies.surfaceLocomotionState.syncAutomaticSurfaceLocomotion(
            {
              currentLocomotionMode: this.#dependencies.readLocomotionMode(),
              excludedOwnerEnvironmentAssetId:
                previousMountedVehicleState.environmentAssetId,
              lookYawRadians: this.#dependencies.readCameraSnapshot().yawRadians,
              position: previousMountedVehicleState.position,
              resolveGroundedPresentationPosition: () =>
                this.#dependencies.resolveGroundedPresentationPosition(),
              resolveSwimPresentationPosition: (swimSnapshot) =>
                this.#dependencies.resolveSwimPresentationPosition(
                  swimSnapshot
                ),
              traversalCameraPitchRadians:
                this.#dependencies.readTraversalCameraPitchRadians(),
              yawRadians: previousMountedVehicleState.yawRadians
            }
          );

      this.#dependencies.setLocomotionMode(
        automaticSurfaceSyncResult.locomotionMode
      );
      this.#dependencies.syncLocalTraversalAuthorityState(false);

      if (automaticSurfaceSyncResult.cameraSnapshot !== null) {
        this.#dependencies.setCameraSnapshot(
          automaticSurfaceSyncResult.cameraSnapshot
        );
      }
      this.#dependencies.syncCharacterPresentationSnapshot();
      return;
    }

    if (this.#dependencies.readLocomotionMode() === "mounted") {
      this.#dependencies.noteIntentionalDiscontinuity("mounted-unboarding");
      const cameraSnapshot = this.#dependencies.readCameraSnapshot();
      const automaticSurfaceSyncResult =
        this.#dependencies.surfaceLocomotionState.syncAutomaticSurfaceLocomotion({
          currentLocomotionMode: this.#dependencies.readLocomotionMode(),
          excludedOwnerEnvironmentAssetId: null,
          lookYawRadians: cameraSnapshot.yawRadians,
          position: freezeVector3(
            cameraSnapshot.position.x,
            this.#dependencies.surfaceLocomotionState.resolveWaterSurfaceHeightMeters(
              cameraSnapshot.position
            ),
            cameraSnapshot.position.z
          ),
          resolveGroundedPresentationPosition: () =>
            this.#dependencies.resolveGroundedPresentationPosition(),
          resolveSwimPresentationPosition: (swimSnapshot) =>
            this.#dependencies.resolveSwimPresentationPosition(swimSnapshot),
          traversalCameraPitchRadians:
            this.#dependencies.readTraversalCameraPitchRadians(),
          yawRadians: cameraSnapshot.yawRadians
        });

      this.#dependencies.setLocomotionMode(
        automaticSurfaceSyncResult.locomotionMode
      );
      this.#dependencies.syncLocalTraversalAuthorityState(false);

      if (automaticSurfaceSyncResult.cameraSnapshot !== null) {
        this.#dependencies.setCameraSnapshot(
          automaticSurfaceSyncResult.cameraSnapshot
        );
      }
    }

    this.#dependencies.syncCharacterPresentationSnapshot();
  }

  syncMountedVehiclePresentation(): void {
    const nextCameraSnapshot =
      this.#dependencies.mountedVehicleState.syncPresentation(
        this.#dependencies.readTraversalCameraPitchRadians()
      );

    if (nextCameraSnapshot !== null) {
      this.#dependencies.setCameraSnapshot(nextCameraSnapshot);
    }
  }

  #enterMountedOccupancyTraversalState(): void {
    const mountedEnvironment =
      this.#dependencies.mountedVehicleState.mountedEnvironmentSnapshot;
    const mountedVehicleSnapshot =
      this.#dependencies.mountedVehicleState.mountedVehicleSnapshot;

    if (mountedEnvironment === null || mountedVehicleSnapshot === null) {
      return;
    }

    if (this.#dependencies.mountedVehicleState.keepsFreeRoam) {
      const anchorSnapshot =
        this.#dependencies.readMountedEnvironmentAnchorSnapshot(
          mountedEnvironment
        );
      const groundedEntryPosition =
        anchorSnapshot?.position ?? mountedVehicleSnapshot.position;

      const groundedCameraSnapshot =
        this.#dependencies.surfaceLocomotionState.enterGroundedLocomotion({
          lookYawRadians: this.#dependencies.readUnmountedLookYawRadians(),
          position: groundedEntryPosition,
          resolveGroundedPresentationPosition: () =>
            this.#dependencies.resolveGroundedPresentationPosition(),
          supportHeightMeters:
            this.#dependencies.surfaceLocomotionState.resolveGroundedSupportHeightMeters(
              groundedEntryPosition,
              anchorSnapshot?.position.y ?? mountedVehicleSnapshot.position.y
            ),
          traversalCameraPitchRadians:
            this.#dependencies.readTraversalCameraPitchRadians(),
          yawRadians:
            anchorSnapshot?.yawRadians ?? mountedVehicleSnapshot.yawRadians
        });

      this.#dependencies.setLocomotionMode("grounded");
      this.#dependencies.syncLocalTraversalAuthorityState(false);

      if (groundedCameraSnapshot !== null) {
        this.#dependencies.setCameraSnapshot(groundedCameraSnapshot);
      }
      return;
    }

    this.#dependencies.setLocomotionMode("mounted");
    this.#dependencies.syncLocalTraversalAuthorityState(false);
    this.#dependencies.setTraversalCameraPitchRadians(
      this.#dependencies.readCameraSnapshot().pitchRadians
    );
    this.syncMountedVehiclePresentation();
  }
}
