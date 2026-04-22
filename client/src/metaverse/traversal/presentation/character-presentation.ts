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

const groundedWalkAnimationPlaybackRateMultiplier = 3;

function sanitizeAnimationPlaybackRateMultiplier(
  value: number | null | undefined
): number {
  if (!Number.isFinite(value) || value === undefined || value === null) {
    return 1;
  }

  return Math.max(0.01, value);
}

export function resolveCharacterAnimationPlaybackRateMultiplier({
  animationVocabulary,
  boost,
  config,
  locomotionMode
}: {
  readonly animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"];
  readonly boost: boolean;
  readonly config: Pick<MetaverseRuntimeConfig, "groundedBody">;
  readonly locomotionMode: MetaverseLocomotionModeId;
}): number {
  if (locomotionMode !== "grounded" || animationVocabulary !== "walk") {
    return 1;
  }

  return sanitizeAnimationPlaybackRateMultiplier(
    groundedWalkAnimationPlaybackRateMultiplier *
      (boost ? Math.max(1, config.groundedBody.boostMultiplier) : 1)
  );
}

function createCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  animationCycleId?: number | null,
  animationPlaybackRateMultiplier: number = 1
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    ...(animationCycleId === null || animationCycleId === undefined
      ? {}
      : { animationCycleId }),
    animationPlaybackRateMultiplier:
      sanitizeAnimationPlaybackRateMultiplier(animationPlaybackRateMultiplier),
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
  animationCycleId?: number | null,
  animationPlaybackRateMultiplier: number = 1
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    ...(animationCycleId === null || animationCycleId === undefined
      ? {}
      : { animationCycleId }),
    animationPlaybackRateMultiplier:
      sanitizeAnimationPlaybackRateMultiplier(animationPlaybackRateMultiplier),
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
  animationPlaybackRateMultiplier: number = 1,
  yawRadians: number = bodySnapshot.yawRadians,
  position: PhysicsVector3Snapshot = bodySnapshot.position
): MetaverseCharacterPresentationSnapshot {
  return createCharacterPresentationSnapshot(
    position,
    yawRadians,
    animationVocabulary,
    animationCycleId,
    animationPlaybackRateMultiplier
  );
}

function createSwimCharacterPresentationSnapshot(
  swimSnapshot: SurfaceLocomotionSnapshot,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  config: MetaverseRuntimeConfig,
  animationCycleId: number | null = null,
  animationPlaybackRateMultiplier: number = 1,
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
    animationCycleId,
    animationPlaybackRateMultiplier
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
        animationCycleId,
        1
      );
  }

  if (locomotionMode === "grounded") {
    return groundedBodySnapshot === null
      ? null
      : createGroundedCharacterPresentationSnapshot(
          groundedBodySnapshot,
          animationVocabulary,
          animationCycleId ?? null,
          resolveCharacterAnimationPlaybackRateMultiplier({
            animationVocabulary,
            boost: groundedBodySnapshot.driveTarget.boost,
            config,
            locomotionMode
          }),
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
      1,
      presentationYawRadians ?? swimSnapshot.yawRadians,
      swimPresentationPosition ?? swimSnapshot.position
    );
  }

  return null;
}
