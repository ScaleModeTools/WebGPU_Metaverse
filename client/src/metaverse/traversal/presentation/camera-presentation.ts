import {
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot
} from "@/physics";

import {
  advanceMetaversePitchRadians,
  advanceMetaverseYawRadians,
  directionFromYawPitch
} from "../../states/metaverse-flight";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type { MetaverseCameraSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import { wrapRadians } from "../policies/surface-locomotion";
import type {
  MountedEnvironmentAnchorSnapshot,
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";

export function advanceTraversalCameraPresentationPitchRadians(
  pitchRadians: number,
  movementInput: Pick<MetaverseFlightInputSnapshot, "pitchAxis">,
  config: MetaverseRuntimeConfig,
  deltaSeconds: number
): number {
  return advanceMetaversePitchRadians(
    pitchRadians,
    movementInput.pitchAxis,
    config.orientation,
    deltaSeconds
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createMountedAnchorCameraPresentationSnapshot(
  anchorSnapshot: MountedEnvironmentAnchorSnapshot,
  eyeHeightMeters: number,
  yawRadians: number,
  pitchRadians: number,
  followDistanceMeters: number
): MetaverseCameraSnapshot {
  return createTraversalSurfaceCameraPresentationSnapshot(
    anchorSnapshot.position,
    eyeHeightMeters,
    yawRadians,
    pitchRadians,
    followDistanceMeters
  );
}

export function advanceTraversalMountedOccupancyLookYawRadians(
  yawOffsetRadians: number,
  movementInput: Pick<MetaverseFlightInputSnapshot, "yawAxis">,
  mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null,
  config: Pick<MetaverseRuntimeConfig, "orientation">,
  deltaSeconds: number
): number {
  if (
    mountedOccupancyPresentationState === null ||
    mountedOccupancyPresentationState.usesVehicleFollowCamera ||
    deltaSeconds <= 0
  ) {
    return 0;
  }

  const nextYawOffsetRadians = advanceMetaverseYawRadians(
    yawOffsetRadians,
    movementInput.yawAxis,
    config.orientation,
    deltaSeconds
  );

  return clamp(
    nextYawOffsetRadians,
    -mountedOccupancyPresentationState.lookConstraintBounds.maxYawOffsetRadians,
    mountedOccupancyPresentationState.lookConstraintBounds.maxYawOffsetRadians
  );
}

export function clampTraversalMountedOccupancyPitchRadians(
  pitchRadians: number,
  mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null
): number {
  if (mountedOccupancyPresentationState === null) {
    return pitchRadians;
  }

  return clamp(
    pitchRadians,
    mountedOccupancyPresentationState.lookConstraintBounds.minPitchRadians,
    mountedOccupancyPresentationState.lookConstraintBounds.maxPitchRadians
  );
}

export function createTraversalSurfaceCameraPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  eyeHeightMeters: number,
  yawRadians: number,
  pitchRadians: number,
  forwardOffsetMeters = 0
): MetaverseCameraSnapshot {
  const lookDirection = directionFromYawPitch(yawRadians, pitchRadians);
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);

  return Object.freeze({
    lookDirection,
    pitchRadians,
    position: Object.freeze({
      x: position.x + forwardX * forwardOffsetMeters,
      y: position.y + eyeHeightMeters,
      z: position.z + forwardZ * forwardOffsetMeters
    }),
    yawRadians: wrapRadians(yawRadians)
  });
}

export function createTraversalGroundedCameraPresentationSnapshot(
  bodySnapshot: MetaverseGroundedBodySnapshot,
  pitchRadians: number,
  config: MetaverseRuntimeConfig,
  yawRadians: number = bodySnapshot.yawRadians,
  position: PhysicsVector3Snapshot = bodySnapshot.position
): MetaverseCameraSnapshot {
  return createTraversalSurfaceCameraPresentationSnapshot(
    position,
    bodySnapshot.eyeHeightMeters,
    yawRadians,
    pitchRadians,
    config.bodyPresentation.groundedFirstPersonForwardOffsetMeters
  );
}

export function createTraversalSwimCameraPresentationSnapshot(
  swimSnapshot: SurfaceLocomotionSnapshot,
  pitchRadians: number,
  config: MetaverseRuntimeConfig,
  yawRadians: number = swimSnapshot.yawRadians,
  position: PhysicsVector3Snapshot = swimSnapshot.position
): MetaverseCameraSnapshot {
  return createTraversalSurfaceCameraPresentationSnapshot(
    position,
    config.swim.cameraEyeHeightMeters +
      config.bodyPresentation.swimThirdPersonHeightOffsetMeters,
    yawRadians,
    pitchRadians,
    -config.bodyPresentation.swimThirdPersonFollowDistanceMeters
  );
}

export function createTraversalMountedVehicleCameraPresentationSnapshot(
  mountedVehicleSnapshot: TraversalMountedVehicleSnapshot,
  pitchRadians: number,
  config: MetaverseRuntimeConfig,
  mountedEnvironmentAnchorSnapshot: MountedEnvironmentAnchorSnapshot | null,
  mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null,
  lookYawOffsetRadians = 0
): MetaverseCameraSnapshot {
  if (
    mountedOccupancyPresentationState?.usesMountedAnchorCamera === true &&
    mountedEnvironmentAnchorSnapshot !== null
  ) {
    return createMountedAnchorCameraPresentationSnapshot(
      mountedEnvironmentAnchorSnapshot,
      config.skiff.cameraHeightOffsetMeters,
      wrapRadians(mountedEnvironmentAnchorSnapshot.yawRadians + lookYawOffsetRadians),
      pitchRadians,
      -config.skiff.cameraFollowDistanceMeters * 0.72
    );
  }

  return createTraversalSurfaceCameraPresentationSnapshot(
    mountedVehicleSnapshot.position,
    config.skiff.cameraEyeHeightMeters + config.skiff.cameraHeightOffsetMeters,
    mountedVehicleSnapshot.yawRadians,
    pitchRadians,
    -config.skiff.cameraFollowDistanceMeters
  );
}
