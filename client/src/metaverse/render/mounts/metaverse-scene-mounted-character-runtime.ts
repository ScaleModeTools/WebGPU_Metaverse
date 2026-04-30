import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import {
  createMountedCharacterSeatTransformSnapshot,
  resolveMountedCharacterSeatTransform
} from "../../traversal/presentation/mount-presentation";
import type {
  MetaverseSceneMountedCharacterPresentationRuntime,
  MetaverseSceneMountableEnvironmentRuntime,
  MountedCharacterRuntime,
  MountedEnvironmentSelectionReference,
  ResolvedMountedEnvironmentSelection
} from "./metaverse-scene-mounts";
import {
  resolveMetaverseSceneMountedSelectionSnapshot
} from "./metaverse-scene-mount-snapshots";

const mountedCharacterSeatTransformScratch =
  createMountedCharacterSeatTransformSnapshot();

export function mountCharacterOnEnvironmentAsset<
  TCharacterRuntime extends MetaverseSceneMountedCharacterPresentationRuntime,
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  characterProofRuntime: TCharacterRuntime,
  environmentAsset: TEnvironmentRuntime,
  occupiedSelection: ResolvedMountedEnvironmentSelection
): MountedCharacterRuntime<TEnvironmentRuntime> {
  const previousParent = characterProofRuntime.anchorGroup.parent;

  if (previousParent === null) {
    throw new Error("Metaverse character proof slice cannot mount without a parent anchor.");
  }

  const previousPosition = characterProofRuntime.anchorGroup.position.clone();
  const previousQuaternion = characterProofRuntime.anchorGroup.quaternion.clone();
  const previousScale = characterProofRuntime.anchorGroup.scale.clone();

  occupiedSelection.anchorGroup.add(characterProofRuntime.anchorGroup);

  const mountTransform = resolveMountedCharacterSeatTransform(
    {
      characterAnchorGroup: characterProofRuntime.anchorGroup,
      characterSeatSocketNode: characterProofRuntime.seatSocketNode,
      seatAnchorNode: occupiedSelection.anchorGroup
    },
    mountedCharacterSeatTransformScratch
  );
  const mountedCharacterRuntime = {
    cameraPolicyId: occupiedSelection.cameraPolicyId,
    controlRoutingPolicyId: occupiedSelection.controlRoutingPolicyId,
    entryId: occupiedSelection.entryId,
    environmentAsset,
    lookLimitPolicyId: occupiedSelection.lookLimitPolicyId,
    occupancyAnimationId: occupiedSelection.occupancyAnimationId,
    occupancyKind: occupiedSelection.occupancyKind,
    occupiedAnchorGroup: occupiedSelection.anchorGroup,
    occupantLabel: occupiedSelection.occupantLabel,
    occupantRole: occupiedSelection.occupantRole,
    previousParent,
    previousPosition,
    previousQuaternion,
    previousScale,
    seatId: occupiedSelection.seatId
  } as const satisfies MountedCharacterRuntime<TEnvironmentRuntime>;

  characterProofRuntime.anchorGroup.position.copy(mountTransform.localPosition);
  characterProofRuntime.anchorGroup.quaternion.copy(mountTransform.localQuaternion);
  characterProofRuntime.anchorGroup.scale.copy(mountedCharacterRuntime.previousScale);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);

  return mountedCharacterRuntime;
}

export function dismountCharacterFromEnvironmentAsset<
  TCharacterRuntime extends MetaverseSceneMountedCharacterPresentationRuntime,
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  characterProofRuntime: TCharacterRuntime,
  mountedCharacterRuntime: MountedCharacterRuntime<TEnvironmentRuntime>
): void {
  mountedCharacterRuntime.previousParent.add(characterProofRuntime.anchorGroup);
  characterProofRuntime.anchorGroup.position.copy(mountedCharacterRuntime.previousPosition);
  characterProofRuntime.anchorGroup.quaternion.copy(
    mountedCharacterRuntime.previousQuaternion
  );
  characterProofRuntime.anchorGroup.scale.copy(mountedCharacterRuntime.previousScale);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}

export function syncMountedCharacterRuntimeFromSelectionReference<
  TCharacterRuntime extends MetaverseSceneMountedCharacterPresentationRuntime,
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  characterProofRuntime: TCharacterRuntime,
  mountedCharacterRuntime: MountedCharacterRuntime<TEnvironmentRuntime> | null,
  mountedEnvironment: MountedEnvironmentSelectionReference | null | undefined,
  mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null
    | undefined,
  resolveMountedEnvironmentRuntime: (
    environmentAssetId: string
  ) => TEnvironmentRuntime | null
): MountedCharacterRuntime<TEnvironmentRuntime> | null {
  if (mountedOccupancyPresentationState?.constrainToAnchor !== true) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  if (mountedEnvironment === null || mountedEnvironment === undefined) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  const mountedSelectionSnapshot =
    resolveMetaverseSceneMountedSelectionSnapshot(
      mountedEnvironment,
      resolveMountedEnvironmentRuntime
    );

  if (mountedSelectionSnapshot === null) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  const mountTargetChanged =
    mountedCharacterRuntime === null ||
    mountedCharacterRuntime.environmentAsset.environmentAssetId !==
      mountedSelectionSnapshot.mountedEnvironment.environmentAssetId ||
    mountedCharacterRuntime.entryId !== mountedSelectionSnapshot.mountedEnvironment.entryId ||
    mountedCharacterRuntime.seatId !== mountedSelectionSnapshot.mountedEnvironment.seatId;

  if (!mountTargetChanged) {
    return mountedCharacterRuntime;
  }

  if (mountedCharacterRuntime !== null) {
    dismountCharacterFromEnvironmentAsset(
      characterProofRuntime,
      mountedCharacterRuntime
    );
  }

  return mountCharacterOnEnvironmentAsset(
    characterProofRuntime,
    mountedSelectionSnapshot.environmentAsset,
    mountedSelectionSnapshot.occupiedSelection
  );
}

export function applyCharacterMountedAnchorTransform<
  TCharacterRuntime extends MetaverseSceneMountedCharacterPresentationRuntime,
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  characterProofRuntime: TCharacterRuntime,
  mountedCharacterRuntime: MountedCharacterRuntime<TEnvironmentRuntime>
): void {
  characterProofRuntime.anchorGroup.scale.copy(mountedCharacterRuntime.previousScale);
  const mountTransform = resolveMountedCharacterSeatTransform(
    {
      characterAnchorGroup: characterProofRuntime.anchorGroup,
      characterSeatSocketNode: characterProofRuntime.seatSocketNode,
      seatAnchorNode: mountedCharacterRuntime.occupiedAnchorGroup
    },
    mountedCharacterSeatTransformScratch
  );
  characterProofRuntime.anchorGroup.position.copy(mountTransform.localPosition);
  characterProofRuntime.anchorGroup.quaternion.copy(mountTransform.localQuaternion);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}
