import type {
  MetaverseCombatAimSnapshotInput,
  MetaverseRealtimePlayerWeaponAimModeId,
  MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared";

import type { HeldObjectPoseProfileId } from "@/assets/types/held-object-authoring-manifest";
import type {
  MetaverseCameraSnapshot,
  MetaverseVector3Snapshot
} from "../types/presentation";

export type MetaverseLocalHeldWeaponAimSourceId =
  | "local_camera"
  | "remote_replicated";

export type MetaverseLocalHeldWeaponAimSourceQualityId =
  | "full_camera_ray"
  | "replicated_pitch_yaw"
  | "last_known_replicated";

export interface MetaverseSemanticAimFrame {
  readonly actorFacingYawRadians: number;
  readonly adsBlend: number | null;
  readonly aimMode: MetaverseRealtimePlayerWeaponAimModeId | null;
  readonly cameraForwardWorld: MetaverseVector3Snapshot;
  readonly cameraRayOriginWorld: MetaverseVector3Snapshot;
  readonly pitchRadians: number;
  readonly poseProfileId: HeldObjectPoseProfileId | null;
  readonly quality: MetaverseLocalHeldWeaponAimSourceQualityId;
  readonly source: MetaverseLocalHeldWeaponAimSourceId;
  readonly weaponId: string | null;
  readonly yawRadians: number;
}

export interface MetaverseSemanticAimAttachmentInput {
  readonly attachmentId: string;
  readonly holdProfile: {
    readonly poseProfileId: HeldObjectPoseProfileId;
  };
}

function normalizeAimMode(
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null
): MetaverseRealtimePlayerWeaponAimModeId | null {
  return weaponState?.aimMode ?? null;
}

function normalizeWeaponId(
  attachmentRuntime: MetaverseSemanticAimAttachmentInput | null,
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null
): string | null {
  return weaponState?.weaponId ?? attachmentRuntime?.attachmentId ?? null;
}

function normalizePoseProfileId(
  attachmentRuntime: MetaverseSemanticAimAttachmentInput | null
): HeldObjectPoseProfileId | null {
  return attachmentRuntime?.holdProfile.poseProfileId ?? null;
}

function readFiniteVector3(
  input: MetaverseVector3Snapshot
): MetaverseVector3Snapshot | null {
  if (
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.y) ||
    !Number.isFinite(input.z)
  ) {
    return null;
  }

  return {
    x: input.x,
    y: input.y,
    z: input.z
  };
}

function readNormalizedVector3(
  input: MetaverseVector3Snapshot
): MetaverseVector3Snapshot | null {
  const finiteInput = readFiniteVector3(input);

  if (finiteInput === null) {
    return null;
  }

  const length = Math.hypot(finiteInput.x, finiteInput.y, finiteInput.z);

  if (!Number.isFinite(length) || length <= 0.000001) {
    return null;
  }

  return {
    x: finiteInput.x / length,
    y: finiteInput.y / length,
    z: finiteInput.z / length
  };
}

function createZeroVector3Snapshot(): MetaverseVector3Snapshot {
  return {
    x: 0,
    y: 0,
    z: 0
  };
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function createMetaverseSemanticAimFrameFromCameraSnapshot(input: {
  readonly actorFacingYawRadians?: number;
  readonly adsBlend?: number | null;
  readonly attachmentRuntime?: MetaverseSemanticAimAttachmentInput | null;
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly quality: Extract<
    MetaverseLocalHeldWeaponAimSourceQualityId,
    "full_camera_ray" | "replicated_pitch_yaw" | "last_known_replicated"
  >;
  readonly source: MetaverseLocalHeldWeaponAimSourceId;
  readonly weaponState?: MetaverseRealtimePlayerWeaponStateSnapshot | null;
}): MetaverseSemanticAimFrame {
  const weaponState = input.weaponState ?? null;
  const attachmentRuntime = input.attachmentRuntime ?? null;
  const pitchRadians = Number.isFinite(input.cameraSnapshot.pitchRadians)
    ? input.cameraSnapshot.pitchRadians
    : 0;
  const yawRadians = Number.isFinite(input.cameraSnapshot.yawRadians)
    ? input.cameraSnapshot.yawRadians
    : 0;

  return {
    actorFacingYawRadians:
      input.actorFacingYawRadians ?? yawRadians,
    adsBlend: input.adsBlend ?? null,
    aimMode: normalizeAimMode(weaponState),
    cameraForwardWorld:
      readNormalizedVector3(input.cameraSnapshot.lookDirection) ??
      createZeroVector3Snapshot(),
    cameraRayOriginWorld:
      readFiniteVector3(input.cameraSnapshot.position) ??
      createZeroVector3Snapshot(),
    pitchRadians,
    poseProfileId: normalizePoseProfileId(attachmentRuntime),
    quality: input.quality,
    source: input.source,
    weaponId: normalizeWeaponId(attachmentRuntime, weaponState),
    yawRadians
  };
}

export function createMetaverseFireAimSnapshotFromSemanticAimFrame(
  aimFrame: Pick<
    MetaverseSemanticAimFrame,
    | "cameraForwardWorld"
    | "cameraRayOriginWorld"
    | "pitchRadians"
    | "yawRadians"
  >
): MetaverseCombatAimSnapshotInput | null {
  const rayForwardWorld = readNormalizedVector3(aimFrame.cameraForwardWorld);
  const rayOriginWorld = readFiniteVector3(aimFrame.cameraRayOriginWorld);

  if (rayForwardWorld === null || rayOriginWorld === null) {
    return null;
  }

  return {
    pitchRadians: Number.isFinite(aimFrame.pitchRadians)
      ? aimFrame.pitchRadians
      : Math.asin(clampUnit(rayForwardWorld.y)),
    rayForwardWorld,
    rayOriginWorld,
    yawRadians: Number.isFinite(aimFrame.yawRadians)
      ? aimFrame.yawRadians
      : Math.atan2(rayForwardWorld.x, -rayForwardWorld.z)
  };
}

export function createMetaverseLookSyncIntentFromSemanticAimFrame(
  aimFrame: Pick<MetaverseSemanticAimFrame, "pitchRadians" | "yawRadians">
): {
  readonly pitchRadians: number;
  readonly yawRadians: number;
} {
  return {
    pitchRadians: Number.isFinite(aimFrame.pitchRadians)
      ? aimFrame.pitchRadians
      : 0,
    yawRadians: Number.isFinite(aimFrame.yawRadians) ? aimFrame.yawRadians : 0
  };
}
