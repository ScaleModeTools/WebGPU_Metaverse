import {
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot
} from "@/physics";

import {
  advanceMetaversePitchRadians,
  advanceMetaverseYawRadians,
  directionFromYawPitch
} from "../../states/metaverse-flight";
import type { MetaverseFlightInputSnapshot } from "../../types/metaverse-control-mode";
import type {
  MetaverseCameraSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";
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

function resolveMountedLookLimitBounds(
  lookLimitPolicyId: NonNullable<
    TraversalMountedVehicleSnapshot["occupancy"]
  >["lookLimitPolicyId"],
  config: MetaverseRuntimeConfig
): {
  readonly maxYawOffsetRadians: number;
  readonly maxPitchRadians: number;
  readonly minPitchRadians: number;
} {
  switch (lookLimitPolicyId) {
    case "driver-forward":
      return Object.freeze({
        maxYawOffsetRadians: 0,
        maxPitchRadians: config.orientation.maxPitchRadians,
        minPitchRadians: config.orientation.minPitchRadians
      });
    case "passenger-bench":
      return Object.freeze({
        maxYawOffsetRadians: Math.PI * 0.45,
        maxPitchRadians: 0.42,
        minPitchRadians: -0.42
      });
    case "turret-arc":
      return Object.freeze({
        maxYawOffsetRadians: Math.PI * 0.6,
        maxPitchRadians: 0.55,
        minPitchRadians: -0.5
      });
  }
}

function createMountedAnchorCameraPresentationSnapshot(
  anchorSnapshot: MountedEnvironmentAnchorSnapshot,
  eyeHeightMeters: number,
  yawRadians: number,
  pitchRadians: number,
  followDistanceMeters: number
): MetaverseCameraSnapshot {
  return createSurfaceCameraPresentationSnapshot(
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
  mountedVehicleSnapshot: TraversalMountedVehicleSnapshot,
  config: MetaverseRuntimeConfig,
  deltaSeconds: number
): number {
  const occupancy = mountedVehicleSnapshot.occupancy;

  if (
    occupancy === null ||
    occupancy.cameraPolicyId === "vehicle-follow" ||
    deltaSeconds <= 0
  ) {
    return 0;
  }

  const lookLimitBounds = resolveMountedLookLimitBounds(
    occupancy.lookLimitPolicyId,
    config
  );
  const nextYawOffsetRadians = advanceMetaverseYawRadians(
    yawOffsetRadians,
    movementInput.yawAxis,
    config.orientation,
    deltaSeconds
  );

  return clamp(
    nextYawOffsetRadians,
    -lookLimitBounds.maxYawOffsetRadians,
    lookLimitBounds.maxYawOffsetRadians
  );
}

export function clampTraversalMountedOccupancyPitchRadians(
  pitchRadians: number,
  mountedVehicleSnapshot: TraversalMountedVehicleSnapshot,
  config: MetaverseRuntimeConfig
): number {
  const occupancy = mountedVehicleSnapshot.occupancy;

  if (occupancy === null) {
    return pitchRadians;
  }

  const lookLimitBounds = resolveMountedLookLimitBounds(
    occupancy.lookLimitPolicyId,
    config
  );

  return clamp(
    pitchRadians,
    lookLimitBounds.minPitchRadians,
    lookLimitBounds.maxPitchRadians
  );
}

function createSurfaceCameraPresentationSnapshot(
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
  return createSurfaceCameraPresentationSnapshot(
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
  return createSurfaceCameraPresentationSnapshot(
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
  lookYawOffsetRadians = 0
): MetaverseCameraSnapshot {
  const occupancy = mountedVehicleSnapshot.occupancy;

  if (
    occupancy !== null &&
    occupancy.cameraPolicyId !== "vehicle-follow" &&
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

  return createSurfaceCameraPresentationSnapshot(
    mountedVehicleSnapshot.position,
    config.skiff.cameraEyeHeightMeters + config.skiff.cameraHeightOffsetMeters,
    mountedVehicleSnapshot.yawRadians,
    pitchRadians,
    -config.skiff.cameraFollowDistanceMeters
  );
}
