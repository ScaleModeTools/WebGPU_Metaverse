import {
  resolveMetaverseMountedOccupantRoleLookConstraintBounds,
  resolveMetaverseMountedLookConstraintBounds,
  shouldKeepMetaverseMountedOccupancyFreeRoam,
  type MetaverseMountedLookConstraintBounds
} from "@webgpu-metaverse/shared";
import type {
  MetaverseWorldMountedOccupancyPolicySnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type { MetaverseCharacterPresentationSnapshot } from "../types/presentation";

type MountedOccupancyPolicySnapshot = Pick<
  MetaverseWorldMountedOccupancyPolicySnapshot,
  "occupancyKind" | "occupantRole"
>;

type MountedOccupancyPresentationPolicySnapshot =
  Pick<
    MetaverseWorldMountedOccupancyPolicySnapshot,
    "occupancyKind" | "occupantRole"
  > &
    Partial<
      Pick<
        MetaverseWorldMountedOccupancyPolicySnapshot,
        "cameraPolicyId" | "lookLimitPolicyId" | "occupancyAnimationId"
      >
    >;

type MountedCharacterAnimationVocabulary = Extract<
  MetaverseCharacterPresentationSnapshot["animationVocabulary"],
  "idle" | "seated"
>;

export interface MetaverseMountedOccupancyPresentationStateSnapshot {
  readonly constrainToAnchor: boolean;
  readonly holsterHeldAttachment: boolean;
  readonly keepFreeRoam: boolean;
  readonly lookConstraintBounds: MetaverseMountedLookConstraintBounds;
  readonly mountedCharacterAnimationVocabulary: MountedCharacterAnimationVocabulary;
  readonly usesMountedAnchorCamera: boolean;
  readonly usesVehicleFollowCamera: boolean;
}

function resolveMountedCharacterAnimationVocabulary(
  occupancyAnimationId:
    | MountedOccupancyPresentationPolicySnapshot["occupancyAnimationId"]
    | undefined
): MountedCharacterAnimationVocabulary {
  return occupancyAnimationId === "standing" ? "idle" : "seated";
}

function resolveMountedLookConstraintBounds(
  occupancy: MountedOccupancyPresentationPolicySnapshot
): MetaverseMountedLookConstraintBounds {
  if (occupancy.lookLimitPolicyId !== undefined) {
    return resolveMetaverseMountedLookConstraintBounds(
      occupancy.lookLimitPolicyId
    );
  }

  return resolveMetaverseMountedOccupantRoleLookConstraintBounds(
    occupancy.occupantRole
  );
}

function resolveUsesVehicleFollowCamera(
  occupancy: MountedOccupancyPresentationPolicySnapshot
): boolean {
  if (occupancy.cameraPolicyId !== undefined) {
    return occupancy.cameraPolicyId === "vehicle-follow";
  }

  return occupancy.occupancyKind === "seat";
}

export function resolveMetaverseMountedOccupancyPresentationStateSnapshot(
  occupancy: MountedOccupancyPresentationPolicySnapshot | null | undefined
): MetaverseMountedOccupancyPresentationStateSnapshot | null {
  if (occupancy === null || occupancy === undefined) {
    return null;
  }

  const keepFreeRoam = shouldKeepMetaverseMountedOccupancyFreeRoam(occupancy);
  const constrainToAnchor = !keepFreeRoam;
  const usesVehicleFollowCamera = resolveUsesVehicleFollowCamera(occupancy);

  return Object.freeze({
    constrainToAnchor,
    holsterHeldAttachment: constrainToAnchor,
    keepFreeRoam,
    lookConstraintBounds: resolveMountedLookConstraintBounds(occupancy),
    mountedCharacterAnimationVocabulary:
      resolveMountedCharacterAnimationVocabulary(
        occupancy.occupancyAnimationId
      ),
    usesMountedAnchorCamera:
      constrainToAnchor && usesVehicleFollowCamera === false,
    usesVehicleFollowCamera
  });
}

export function shouldKeepMountedOccupancyFreeRoam(
  occupancy: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return shouldKeepMetaverseMountedOccupancyFreeRoam(occupancy);
}

export function shouldConstrainMountedOccupancyToAnchor(
  occupancy: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return (
    occupancy !== null &&
    occupancy !== undefined &&
    !shouldKeepMetaverseMountedOccupancyFreeRoam(occupancy)
  );
}

export function shouldHolsterHeldAttachmentWhileMounted(
  mountedEnvironment: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return shouldConstrainMountedOccupancyToAnchor(mountedEnvironment);
}
