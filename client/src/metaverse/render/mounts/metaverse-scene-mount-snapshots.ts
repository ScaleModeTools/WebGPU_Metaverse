import { Object3D, Quaternion, Vector3 } from "three/webgpu";

import type {
  FocusedMountableSnapshot,
  MetaverseCameraSnapshot,
  MetaverseVector3Snapshot,
  MountableBoardingEntrySnapshot,
  MountableSeatSelectionSnapshot,
  MountedEnvironmentSnapshot
} from "../../types/metaverse-runtime";
import type { MountedEnvironmentAnchorSnapshot } from "../../traversal/types/traversal";
import type {
  MountedEnvironmentSelectionReference,
  MetaverseSceneDynamicEnvironmentRuntime,
  MetaverseSceneEnvironmentProofRuntime,
  MetaverseSceneInteractionSnapshot,
  MetaverseSceneMountableEnvironmentRuntime,
  ResolvedMountedEnvironmentSelection
} from "./metaverse-scene-mounts";
import {
  resolveFocusedMountableEnvironmentRuntime,
  resolveMountedEnvironmentSelectionByRequest
} from "./metaverse-scene-mount-runtime-resolution";

const mountedEnvironmentAnchorForwardScratch = new Vector3();
const mountedEnvironmentAnchorPositionScratch = new Vector3();
const mountedEnvironmentAnchorQuaternionScratch = new Quaternion();

function resolveDirectSeatTargetSnapshots(
  environmentAsset: MetaverseSceneMountableEnvironmentRuntime
): readonly MountableSeatSelectionSnapshot[] {
  return Object.freeze(
    environmentAsset.seats
      .filter((seat) => seat.seat.directEntryEnabled)
      .map((seat) =>
        Object.freeze({
          label: seat.seat.label,
          seatId: seat.seat.seatId,
          seatRole: seat.seat.seatRole
        })
      )
  );
}

function resolveSeatTargetSnapshots(
  environmentAsset: MetaverseSceneMountableEnvironmentRuntime
): readonly MountableSeatSelectionSnapshot[] {
  return Object.freeze(
    environmentAsset.seats.map((seat) =>
      Object.freeze({
        label: seat.seat.label,
        seatId: seat.seat.seatId,
        seatRole: seat.seat.seatRole
      })
    )
  );
}

function resolveBoardingEntrySnapshots(
  environmentAsset: MetaverseSceneMountableEnvironmentRuntime
): readonly MountableBoardingEntrySnapshot[] {
  return Object.freeze(
    (environmentAsset.entries ?? []).map((entry) =>
      Object.freeze({
        entryId: entry.entry.entryId,
        label: entry.entry.label
      })
    )
  );
}

function resolveMetaverseYawFromObjectQuaternion(object: Object3D): number {
  const forward = mountedEnvironmentAnchorForwardScratch
    .set(0, 0, -1)
    .applyQuaternion(
      object.getWorldQuaternion(mountedEnvironmentAnchorQuaternionScratch)
    )
    .normalize();

  return Math.atan2(forward.x, -forward.z);
}

export function createMetaverseSceneInteractionSnapshot(
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null
): MetaverseSceneInteractionSnapshot {
  return Object.freeze({
    focusedMountable,
    mountedEnvironment
  });
}

export function resolveFocusedMountableSnapshot<
  TDynamicEnvironmentRuntime extends MetaverseSceneDynamicEnvironmentRuntime
>(
  environmentProofRuntime:
    | MetaverseSceneEnvironmentProofRuntime<TDynamicEnvironmentRuntime>
    | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null,
  cameraSnapshot: MetaverseCameraSnapshot,
  focusProbeForwardMeters: number
): FocusedMountableSnapshot | null {
  if (environmentProofRuntime === null || mountedEnvironment !== null) {
    return null;
  }

  const focusedEnvironment = resolveFocusedMountableEnvironmentRuntime(
    environmentProofRuntime,
    cameraSnapshot,
    focusProbeForwardMeters
  );

  if (focusedEnvironment === null) {
    return null;
  }

  return Object.freeze({
    boardingEntries: resolveBoardingEntrySnapshots(
      focusedEnvironment.environmentAsset
    ),
    distanceFromCamera: focusedEnvironment.distanceFromCamera,
    directSeatTargets: resolveDirectSeatTargetSnapshots(
      focusedEnvironment.environmentAsset
    ),
    environmentAssetId: focusedEnvironment.environmentAsset.environmentAssetId,
    label: focusedEnvironment.environmentAsset.label
  });
}

export function resolveMountedEnvironmentSelectionFromSnapshot<
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  environmentAsset: TEnvironmentRuntime,
  mountedEnvironment: MountedEnvironmentSelectionReference
): ResolvedMountedEnvironmentSelection | null {
  if (
    mountedEnvironment.occupancyKind === "seat" &&
    mountedEnvironment.seatId !== null
  ) {
    return resolveMountedEnvironmentSelectionByRequest(environmentAsset, {
      requestedSeatId: mountedEnvironment.seatId
    });
  }

  if (
    mountedEnvironment.occupancyKind === "entry" &&
    mountedEnvironment.entryId !== null
  ) {
    return resolveMountedEnvironmentSelectionByRequest(environmentAsset, {
      requestedEntryId: mountedEnvironment.entryId
    });
  }

  return null;
}

export function createMountedEnvironmentSnapshot<
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  environmentAsset: TEnvironmentRuntime,
  occupiedSelection: Omit<ResolvedMountedEnvironmentSelection, "anchorGroup">
): MountedEnvironmentSnapshot {
  return Object.freeze({
    cameraPolicyId: occupiedSelection.cameraPolicyId,
    controlRoutingPolicyId: occupiedSelection.controlRoutingPolicyId,
    directSeatTargets: resolveDirectSeatTargetSnapshots(environmentAsset),
    entryId: occupiedSelection.entryId,
    environmentAssetId: environmentAsset.environmentAssetId,
    label: environmentAsset.label,
    lookLimitPolicyId: occupiedSelection.lookLimitPolicyId,
    occupancyAnimationId: occupiedSelection.occupancyAnimationId,
    occupancyKind: occupiedSelection.occupancyKind,
    occupantLabel: occupiedSelection.occupantLabel,
    occupantRole: occupiedSelection.occupantRole,
    seatTargets: resolveSeatTargetSnapshots(environmentAsset),
    seatId: occupiedSelection.seatId
  });
}

export function resolveMountedEnvironmentAnchorSnapshot<
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  environmentAsset: TEnvironmentRuntime,
  mountedEnvironment: MountedEnvironmentSnapshot,
  dependencies: {
    readonly createPositionSnapshot: (
      x: number,
      y: number,
      z: number
    ) => MetaverseVector3Snapshot;
    readonly syncDynamicEnvironmentSimulationPose: (
      environmentAsset: TEnvironmentRuntime
    ) => void;
  }
): MountedEnvironmentAnchorSnapshot | null {
  const occupiedSelection = resolveMountedEnvironmentSelectionFromSnapshot(
    environmentAsset,
    mountedEnvironment
  );

  if (occupiedSelection === null) {
    return null;
  }

  dependencies.syncDynamicEnvironmentSimulationPose(environmentAsset);
  environmentAsset.anchorGroup.updateMatrixWorld(true);
  const anchorWorldPosition = occupiedSelection.anchorGroup.getWorldPosition(
    mountedEnvironmentAnchorPositionScratch
  );

  return Object.freeze({
    position: dependencies.createPositionSnapshot(
      anchorWorldPosition.x,
      anchorWorldPosition.y,
      anchorWorldPosition.z
    ),
    yawRadians: resolveMetaverseYawFromObjectQuaternion(
      occupiedSelection.anchorGroup
    )
  });
}
