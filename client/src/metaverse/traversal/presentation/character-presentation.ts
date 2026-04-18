import {
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot
} from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MetaverseCharacterPresentationSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import { shouldConstrainMountedOccupancyToAnchor } from "../../states/mounted-occupancy";
import { freezeVector3, wrapRadians } from "../policies/surface-locomotion";
import type {
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";

interface TraversalCharacterPresentationInput {
  readonly animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"];
  readonly config: MetaverseRuntimeConfig;
  readonly groundedBodySnapshot: MetaverseGroundedBodySnapshot | null;
  readonly groundedPresentationPosition?: PhysicsVector3Snapshot | null;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedVehicleSnapshot: TraversalMountedVehicleSnapshot | null;
  readonly presentationYawRadians?: number | null;
  readonly swimSnapshot: SurfaceLocomotionSnapshot;
  readonly swimPresentationPosition?: PhysicsVector3Snapshot | null;
}

function createCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"]
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    animationVocabulary,
    position: Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    yawRadians: wrapRadians(yawRadians)
  });
}

function createFixedCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"]
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    animationVocabulary,
    position: Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    yawRadians: wrapRadians(yawRadians)
  });
}

function createGroundedCharacterPresentationSnapshot(
  bodySnapshot: MetaverseGroundedBodySnapshot,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  yawRadians: number = bodySnapshot.yawRadians,
  position: PhysicsVector3Snapshot = bodySnapshot.position
): MetaverseCharacterPresentationSnapshot {
  return createCharacterPresentationSnapshot(position, yawRadians, animationVocabulary);
}

function createSwimCharacterPresentationSnapshot(
  swimSnapshot: SurfaceLocomotionSnapshot,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  config: MetaverseRuntimeConfig,
  yawRadians: number = swimSnapshot.yawRadians,
  position: PhysicsVector3Snapshot = swimSnapshot.position
): MetaverseCharacterPresentationSnapshot {
  const moving = animationVocabulary === "swim";

  return createCharacterPresentationSnapshot(
    freezeVector3(
      position.x,
      position.y -
        (moving
          ? config.bodyPresentation.swimMovingBodySubmersionDepthMeters
          : config.bodyPresentation.swimIdleBodySubmersionDepthMeters),
      position.z
    ),
    yawRadians,
    moving ? "swim" : "swim-idle"
  );
}

export function createTraversalCharacterPresentationSnapshot({
  animationVocabulary,
  config,
  groundedBodySnapshot,
  groundedPresentationPosition,
  locomotionMode,
  mountedVehicleSnapshot,
  presentationYawRadians,
  swimSnapshot,
  swimPresentationPosition
}: TraversalCharacterPresentationInput): MetaverseCharacterPresentationSnapshot | null {
  if (
    mountedVehicleSnapshot !== null &&
    shouldConstrainMountedOccupancyToAnchor(mountedVehicleSnapshot.occupancy)
  ) {
    const mountedAnimationVocabulary =
      mountedVehicleSnapshot.occupancy?.occupancyAnimationId === "standing"
        ? "idle"
        : mountedVehicleSnapshot.occupancy?.occupancyAnimationId ?? "seated";

    return createFixedCharacterPresentationSnapshot(
      mountedVehicleSnapshot.position,
      mountedVehicleSnapshot.yawRadians,
      mountedAnimationVocabulary
    );
  }

  if (locomotionMode === "grounded") {
    return groundedBodySnapshot === null
      ? null
      : createGroundedCharacterPresentationSnapshot(
          groundedBodySnapshot,
          animationVocabulary,
          presentationYawRadians ?? groundedBodySnapshot.yawRadians,
          groundedPresentationPosition ?? groundedBodySnapshot.position
        );
  }

  if (locomotionMode === "swim") {
    return createSwimCharacterPresentationSnapshot(
      swimSnapshot,
      animationVocabulary,
      config,
      presentationYawRadians ?? swimSnapshot.yawRadians,
      swimPresentationPosition ?? swimSnapshot.position
    );
  }

  return null;
}
