import { Vector3 } from "three/webgpu";

import type { MetaverseCameraSnapshot } from "../../types/metaverse-runtime";
import type {
  FocusedMountableEnvironmentRuntime,
  MetaverseSceneDynamicEnvironmentRuntime,
  MetaverseSceneEnvironmentProofRuntime,
  MetaverseSceneMountableEnvironmentRuntime,
  ResolvedMountedEnvironmentSelection
} from "./metaverse-scene-mounts";
import { isMetaverseSceneMountableEnvironmentRuntime } from "./metaverse-scene-mounts";

const mountableFocusHeightLeewayMeters = 0.12;

export function resolveFocusedMountableEnvironmentRuntime<
  TDynamicEnvironmentRuntime extends MetaverseSceneDynamicEnvironmentRuntime
>(
  environmentProofRuntime: MetaverseSceneEnvironmentProofRuntime<TDynamicEnvironmentRuntime>,
  cameraSnapshot: MetaverseCameraSnapshot,
  focusProbeForwardMeters = 0
): FocusedMountableEnvironmentRuntime<
  TDynamicEnvironmentRuntime & MetaverseSceneMountableEnvironmentRuntime
> | null {
  let nearestEnvironmentAsset:
    | FocusedMountableEnvironmentRuntime<
        TDynamicEnvironmentRuntime & MetaverseSceneMountableEnvironmentRuntime
      >
    | null = null;

  for (const environmentAsset of environmentProofRuntime.dynamicAssets) {
    if (!isMetaverseSceneMountableEnvironmentRuntime(environmentAsset)) {
      continue;
    }

    const localCameraPosition = environmentAsset.anchorGroup.worldToLocal(
      new Vector3(
        cameraSnapshot.position.x,
        cameraSnapshot.position.y,
        cameraSnapshot.position.z
      )
    );
    const halfExtentX = environmentAsset.collider.size.x * 0.5;
    const halfExtentY =
      environmentAsset.collider.size.y * 0.5 + mountableFocusHeightLeewayMeters;
    const halfExtentZ = environmentAsset.collider.size.z * 0.5;
    let focusLocalPosition = localCameraPosition;
    let offsetX = Math.abs(
      focusLocalPosition.x - environmentAsset.collider.center.x
    );
    let offsetY = Math.abs(
      focusLocalPosition.y - environmentAsset.collider.center.y
    );
    let offsetZ = Math.abs(
      focusLocalPosition.z - environmentAsset.collider.center.z
    );

    if (
      offsetX > halfExtentX ||
      offsetY > halfExtentY ||
      offsetZ > halfExtentZ
    ) {
      if (focusProbeForwardMeters <= 0) {
        continue;
      }

      focusLocalPosition = environmentAsset.anchorGroup.worldToLocal(
        new Vector3(
          cameraSnapshot.position.x +
            cameraSnapshot.lookDirection.x * focusProbeForwardMeters,
          cameraSnapshot.position.y +
            cameraSnapshot.lookDirection.y * focusProbeForwardMeters,
          cameraSnapshot.position.z +
            cameraSnapshot.lookDirection.z * focusProbeForwardMeters
        )
      );
      offsetX = Math.abs(
        focusLocalPosition.x - environmentAsset.collider.center.x
      );
      offsetY = Math.abs(
        focusLocalPosition.y - environmentAsset.collider.center.y
      );
      offsetZ = Math.abs(
        focusLocalPosition.z - environmentAsset.collider.center.z
      );

      if (
        offsetX > halfExtentX ||
        offsetY > halfExtentY ||
        offsetZ > halfExtentZ
      ) {
        continue;
      }
    }

    const distanceFromCamera = Math.hypot(
      focusLocalPosition.x - environmentAsset.collider.center.x,
      focusLocalPosition.y - environmentAsset.collider.center.y,
      focusLocalPosition.z - environmentAsset.collider.center.z
    );

    if (
      nearestEnvironmentAsset === null ||
      distanceFromCamera < nearestEnvironmentAsset.distanceFromCamera
    ) {
      nearestEnvironmentAsset = {
        distanceFromCamera,
        environmentAsset
      };
    }
  }

  return nearestEnvironmentAsset;
}

export function resolveMountableEnvironmentRuntimeById<
  TDynamicEnvironmentRuntime extends MetaverseSceneDynamicEnvironmentRuntime
>(
  environmentProofRuntime:
    | MetaverseSceneEnvironmentProofRuntime<TDynamicEnvironmentRuntime>
    | null,
  environmentAssetId: string
): (TDynamicEnvironmentRuntime & MetaverseSceneMountableEnvironmentRuntime) | null {
  if (environmentProofRuntime === null) {
    return null;
  }

  for (const environmentAsset of environmentProofRuntime.dynamicAssets) {
    if (
      environmentAsset.environmentAssetId === environmentAssetId &&
      isMetaverseSceneMountableEnvironmentRuntime(environmentAsset)
    ) {
      return environmentAsset;
    }
  }

  return null;
}

export function resolveMountedEnvironmentSelectionByRequest<
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
>(
  environmentAsset: TEnvironmentRuntime,
  {
    requestedEntryId = null,
    requestedSeatId = null
  }: {
    readonly requestedEntryId?: string | null;
    readonly requestedSeatId?: string | null;
  } = {}
): ResolvedMountedEnvironmentSelection | null {
  if (requestedSeatId !== null) {
    const occupiedSeat =
      environmentAsset.seats.find((seat) => seat.seat.seatId === requestedSeatId) ??
      null;

    return occupiedSeat === null
      ? null
      : {
          anchorGroup: occupiedSeat.anchorGroup,
          cameraPolicyId: occupiedSeat.seat.cameraPolicyId,
          controlRoutingPolicyId: occupiedSeat.seat.controlRoutingPolicyId,
          entryId: null,
          lookLimitPolicyId: occupiedSeat.seat.lookLimitPolicyId,
          occupancyAnimationId: occupiedSeat.seat.occupancyAnimationId,
          occupancyKind: "seat",
          occupantLabel: occupiedSeat.seat.label,
          occupantRole: occupiedSeat.seat.seatRole,
          seatId: occupiedSeat.seat.seatId
        };
  }

  if (requestedEntryId !== null) {
    const occupiedEntry =
      environmentAsset.entries?.find(
        (entry) => entry.entry.entryId === requestedEntryId
      ) ?? null;

    return occupiedEntry === null
      ? null
      : {
          anchorGroup: occupiedEntry.anchorGroup,
          cameraPolicyId: occupiedEntry.entry.cameraPolicyId,
          controlRoutingPolicyId: occupiedEntry.entry.controlRoutingPolicyId,
          entryId: occupiedEntry.entry.entryId,
          lookLimitPolicyId: occupiedEntry.entry.lookLimitPolicyId,
          occupancyAnimationId: occupiedEntry.entry.occupancyAnimationId,
          occupancyKind: "entry",
          occupantLabel: occupiedEntry.entry.label,
          occupantRole: occupiedEntry.entry.occupantRole,
          seatId: null
        };
  }

  const defaultEntry = environmentAsset.entries?.[0] ?? null;

  if (defaultEntry !== null) {
    return {
      anchorGroup: defaultEntry.anchorGroup,
      cameraPolicyId: defaultEntry.entry.cameraPolicyId,
      controlRoutingPolicyId: defaultEntry.entry.controlRoutingPolicyId,
      entryId: defaultEntry.entry.entryId,
      lookLimitPolicyId: defaultEntry.entry.lookLimitPolicyId,
      occupancyAnimationId: defaultEntry.entry.occupancyAnimationId,
      occupancyKind: "entry",
      occupantLabel: defaultEntry.entry.label,
      occupantRole: defaultEntry.entry.occupantRole,
      seatId: null
    };
  }

  const directSeat =
    environmentAsset.seats.find((seat) => seat.seat.directEntryEnabled) ?? null;

  return directSeat === null
    ? null
    : {
        anchorGroup: directSeat.anchorGroup,
        cameraPolicyId: directSeat.seat.cameraPolicyId,
        controlRoutingPolicyId: directSeat.seat.controlRoutingPolicyId,
        entryId: null,
        lookLimitPolicyId: directSeat.seat.lookLimitPolicyId,
        occupancyAnimationId: directSeat.seat.occupancyAnimationId,
        occupancyKind: "seat",
        occupantLabel: directSeat.seat.label,
        occupantRole: directSeat.seat.seatRole,
        seatId: directSeat.seat.seatId
      };
}
