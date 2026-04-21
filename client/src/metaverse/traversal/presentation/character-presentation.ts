import {
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot
} from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type { MetaverseCharacterPresentationSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import { freezeVector3, wrapRadians } from "../policies/surface-locomotion";
import type {
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";

interface TraversalCharacterPresentationInput {
  readonly animationCycleId?: number | null;
  readonly animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"];
  readonly config: MetaverseRuntimeConfig;
  readonly groundedBodySnapshot: MetaverseGroundedBodySnapshot | null;
  readonly groundedPresentationPosition?: PhysicsVector3Snapshot | null;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null;
  readonly mountedVehicleSnapshot: TraversalMountedVehicleSnapshot | null;
  readonly presentationYawRadians?: number | null;
  readonly swimSnapshot: SurfaceLocomotionSnapshot;
  readonly swimPresentationPosition?: PhysicsVector3Snapshot | null;
}

function createCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  animationCycleId?: number | null
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    ...(animationCycleId === null || animationCycleId === undefined
      ? {}
      : { animationCycleId }),
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
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  animationCycleId?: number | null
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    ...(animationCycleId === null || animationCycleId === undefined
      ? {}
      : { animationCycleId }),
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
  animationCycleId: number | null = null,
  yawRadians: number = bodySnapshot.yawRadians,
  position: PhysicsVector3Snapshot = bodySnapshot.position
): MetaverseCharacterPresentationSnapshot {
  return createCharacterPresentationSnapshot(
    position,
    yawRadians,
    animationVocabulary,
    animationCycleId
  );
}

function createSwimCharacterPresentationSnapshot(
  swimSnapshot: SurfaceLocomotionSnapshot,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  config: MetaverseRuntimeConfig,
  animationCycleId: number | null = null,
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
    moving ? "swim" : "swim-idle",
    animationCycleId
  );
}

export function createTraversalCharacterPresentationSnapshot({
  animationCycleId,
  animationVocabulary,
  config,
  groundedBodySnapshot,
  groundedPresentationPosition,
  locomotionMode,
  mountedOccupancyPresentationState,
  mountedVehicleSnapshot,
  presentationYawRadians,
  swimSnapshot,
  swimPresentationPosition
}: TraversalCharacterPresentationInput): MetaverseCharacterPresentationSnapshot | null {
  if (
    mountedVehicleSnapshot !== null &&
    mountedOccupancyPresentationState?.constrainToAnchor === true
  ) {
      return createFixedCharacterPresentationSnapshot(
        mountedVehicleSnapshot.position,
        mountedVehicleSnapshot.yawRadians,
        mountedOccupancyPresentationState.mountedCharacterAnimationVocabulary,
        animationCycleId
      );
  }

  if (locomotionMode === "grounded") {
    return groundedBodySnapshot === null
      ? null
      : createGroundedCharacterPresentationSnapshot(
          groundedBodySnapshot,
          animationVocabulary,
          animationCycleId ?? null,
          presentationYawRadians ?? groundedBodySnapshot.yawRadians,
          groundedPresentationPosition ?? groundedBodySnapshot.position
        );
  }

  if (locomotionMode === "swim") {
    return createSwimCharacterPresentationSnapshot(
      swimSnapshot,
      animationVocabulary,
      config,
      animationCycleId ?? null,
      presentationYawRadians ?? swimSnapshot.yawRadians,
      swimPresentationPosition ?? swimSnapshot.position
    );
  }

  return null;
}
