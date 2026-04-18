import {
  normalizePlanarYawRadians
} from "@webgpu-metaverse/shared";
import {
  Quaternion,
  type Object3D,
  Vector3
} from "three/webgpu";

import type { MetaverseEnvironmentAssetProofConfig } from "../../types/proof";
import { wrapRadians } from "../policies/surface-locomotion";

export interface MountedCharacterSeatTransformSnapshot {
  readonly localPosition: Vector3;
  readonly localQuaternion: Quaternion;
}

export interface ResolveMountedCharacterSeatTransformInput {
  readonly characterAnchorGroup: Object3D;
  readonly characterSeatSocketNode: Object3D;
  readonly seatAnchorNode: Object3D;
}

const mountedCharacterAnchorOriginalPositionScratch = new Vector3();
const mountedCharacterAnchorOriginalQuaternionScratch = new Quaternion();
const mountedCharacterSeatSocketWorldPositionScratch = new Vector3();

export function createMountedCharacterSeatTransformSnapshot(): MountedCharacterSeatTransformSnapshot {
  return Object.freeze({
    localPosition: new Vector3(),
    localQuaternion: new Quaternion()
  });
}

export function resolveEnvironmentForwardModelYawRadians(
  environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "orientation"
  >
): number {
  return environmentAsset.orientation === null ||
    environmentAsset.orientation === undefined
    ? 0
    : normalizePlanarYawRadians(
        environmentAsset.orientation.forwardModelYawRadians
      );
}

export function resolveEnvironmentRenderYawFromSimulationYaw(
  environmentAsset: Pick<MetaverseEnvironmentAssetProofConfig, "orientation">,
  simulationYawRadians: number
): number {
  if (
    environmentAsset.orientation === null ||
    environmentAsset.orientation === undefined
  ) {
    return wrapRadians(simulationYawRadians);
  }

  return wrapRadians(
    resolveEnvironmentForwardModelYawRadians(environmentAsset) -
      simulationYawRadians
  );
}

export function resolveEnvironmentSimulationYawFromRenderYaw(
  environmentAsset: Pick<MetaverseEnvironmentAssetProofConfig, "orientation">,
  renderYawRadians: number
): number {
  if (
    environmentAsset.orientation === null ||
    environmentAsset.orientation === undefined
  ) {
    return wrapRadians(renderYawRadians);
  }

  return wrapRadians(
    resolveEnvironmentForwardModelYawRadians(environmentAsset) - renderYawRadians
  );
}

export function resolveMountedCharacterSeatTransform(
  input: ResolveMountedCharacterSeatTransformInput,
  target: MountedCharacterSeatTransformSnapshot
): MountedCharacterSeatTransformSnapshot {
  target.localQuaternion.identity();
  resolveMountedCharacterSeatLocalPosition(
    input.characterAnchorGroup,
    input.characterSeatSocketNode,
    input.seatAnchorNode,
    target.localQuaternion,
    target.localPosition
  );

  return target;
}

function resolveMountedCharacterSeatLocalPosition(
  characterAnchorGroup: Object3D,
  characterSeatSocketNode: Object3D,
  seatSocketNode: Object3D,
  localQuaternion: Quaternion,
  targetPosition: Vector3
): Vector3 {
  mountedCharacterAnchorOriginalPositionScratch.copy(characterAnchorGroup.position);
  mountedCharacterAnchorOriginalQuaternionScratch.copy(
    characterAnchorGroup.quaternion
  );

  characterAnchorGroup.position.set(0, 0, 0);
  characterAnchorGroup.quaternion.copy(localQuaternion);
  characterAnchorGroup.updateMatrixWorld(true);

  const mountedSeatSocketLocalPosition = seatSocketNode.worldToLocal(
    characterSeatSocketNode.getWorldPosition(
      mountedCharacterSeatSocketWorldPositionScratch
    )
  );

  targetPosition.set(
    -mountedSeatSocketLocalPosition.x,
    -mountedSeatSocketLocalPosition.y,
    -mountedSeatSocketLocalPosition.z
  );

  characterAnchorGroup.position.copy(mountedCharacterAnchorOriginalPositionScratch);
  characterAnchorGroup.quaternion.copy(
    mountedCharacterAnchorOriginalQuaternionScratch
  );
  characterAnchorGroup.updateMatrixWorld(true);

  return targetPosition;
}
