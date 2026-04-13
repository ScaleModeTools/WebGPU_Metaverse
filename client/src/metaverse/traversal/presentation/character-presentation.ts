import {
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot
} from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type {
  MetaverseCharacterPresentationSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";
import { shouldConstrainMountedOccupancyToAnchor } from "../../states/mounted-occupancy";
import { freezeVector3, wrapRadians } from "../policies/surface-locomotion";
import type {
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";

const metaverseWalkAnimationSpeedThresholdUnitsPerSecond = 0.75;
const metaverseJumpUpAnimationVerticalSpeedThresholdUnitsPerSecond = 0.35;
const metaverseJumpDownAnimationVerticalSpeedThresholdUnitsPerSecond = -0.35;

interface TraversalCharacterPresentationInput {
  readonly config: MetaverseRuntimeConfig;
  readonly groundedBodySnapshot: MetaverseGroundedBodySnapshot | null;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedVehicleSnapshot: TraversalMountedVehicleSnapshot | null;
  readonly swimSnapshot: SurfaceLocomotionSnapshot;
}

function createCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  planarSpeedUnitsPerSecond: number,
  movingVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"] = "walk",
  idleVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"] = "idle"
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    animationVocabulary:
      planarSpeedUnitsPerSecond >=
      metaverseWalkAnimationSpeedThresholdUnitsPerSecond
        ? movingVocabulary
        : idleVocabulary,
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
  bodySnapshot: MetaverseGroundedBodySnapshot
): MetaverseCharacterPresentationSnapshot {
  if (!bodySnapshot.grounded) {
    return createFixedCharacterPresentationSnapshot(
      bodySnapshot.position,
      bodySnapshot.yawRadians,
      bodySnapshot.verticalSpeedUnitsPerSecond >
        metaverseJumpUpAnimationVerticalSpeedThresholdUnitsPerSecond
        ? "jump-up"
        : bodySnapshot.verticalSpeedUnitsPerSecond <
            metaverseJumpDownAnimationVerticalSpeedThresholdUnitsPerSecond
          ? "jump-down"
          : "jump-mid"
    );
  }

  return createCharacterPresentationSnapshot(
    bodySnapshot.position,
    bodySnapshot.yawRadians,
    bodySnapshot.planarSpeedUnitsPerSecond
  );
}

function createSwimCharacterPresentationSnapshot(
  swimSnapshot: SurfaceLocomotionSnapshot,
  config: MetaverseRuntimeConfig
): MetaverseCharacterPresentationSnapshot {
  const moving =
    swimSnapshot.planarSpeedUnitsPerSecond >=
    metaverseWalkAnimationSpeedThresholdUnitsPerSecond;

  return createCharacterPresentationSnapshot(
    freezeVector3(
      swimSnapshot.position.x,
      swimSnapshot.position.y -
        (moving
          ? config.bodyPresentation.swimMovingBodySubmersionDepthMeters
          : config.bodyPresentation.swimIdleBodySubmersionDepthMeters),
      swimSnapshot.position.z
    ),
    swimSnapshot.yawRadians,
    swimSnapshot.planarSpeedUnitsPerSecond,
    "swim",
    "swim-idle"
  );
}

export function createTraversalCharacterPresentationSnapshot({
  config,
  groundedBodySnapshot,
  locomotionMode,
  mountedVehicleSnapshot,
  swimSnapshot
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
      : createGroundedCharacterPresentationSnapshot(groundedBodySnapshot);
  }

  if (locomotionMode === "swim") {
    return createSwimCharacterPresentationSnapshot(swimSnapshot, config);
  }

  return null;
}
