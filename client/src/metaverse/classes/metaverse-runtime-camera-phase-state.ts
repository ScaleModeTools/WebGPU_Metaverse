import { resolveMetaverseWorldSurfaceScaleVector } from "@webgpu-metaverse/shared/metaverse/world";

import { createMetaverseCameraSnapshot, directionFromYawPitch } from "../states/metaverse-flight";
import type { FocusedExperiencePortalSnapshot } from "../types/mounted";
import type { MetaverseCameraSnapshot, MetaverseEnvironmentProofConfig } from "../types/metaverse-runtime";
import type { MetaversePortalConfig, MetaverseRuntimeConfig } from "../types/runtime-config";
import type {
  MetaverseRuntimeCameraPhaseConfig,
  MetaverseRuntimeCameraPhasePresentationSnapshot,
  MetaverseRuntimeCameraPhaseStateSnapshot
} from "../types/metaverse-runtime-camera-phase";

interface MetaverseRuntimeCameraPhaseStateDependencies {
  readonly cameraConfig: MetaverseRuntimeConfig["camera"];
  readonly config: MetaverseRuntimeCameraPhaseConfig;
  readonly environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly portals: readonly MetaversePortalConfig[];
}

interface MetaverseRuntimeCameraPhaseResolutionInput {
  readonly liveCameraSnapshot: MetaverseCameraSnapshot;
  readonly liveFocusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly nowMs: number;
  readonly presenceReady: boolean;
  readonly worldReady: boolean;
}

interface Bounds3 {
  maxX: number;
  maxY: number;
  maxZ: number;
  minX: number;
  minY: number;
  minZ: number;
}

function freezePresentationSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  focusedPortal: FocusedExperiencePortalSnapshot | null
): MetaverseRuntimeCameraPhasePresentationSnapshot {
  return Object.freeze({
    cameraSnapshot,
    focusedPortal
  });
}

function freezeStateSnapshot(
  phaseId: MetaverseRuntimeCameraPhaseStateSnapshot["phaseId"],
  presentationSnapshot: MetaverseRuntimeCameraPhasePresentationSnapshot | null,
  blocked: boolean
): MetaverseRuntimeCameraPhaseStateSnapshot {
  return Object.freeze({
    blocksMovementInput: blocked,
    hidesLocalCharacter: blocked,
    phaseId,
    presentationSnapshot,
    suppressesInteractionFocus: blocked
  });
}

function freezeCameraSnapshot(
  x: number,
  y: number,
  z: number,
  yawRadians: number,
  pitchRadians: number
): MetaverseCameraSnapshot {
  return Object.freeze({
    lookDirection: directionFromYawPitch(yawRadians, pitchRadians),
    pitchRadians,
    position: Object.freeze({
      x,
      y,
      z
    }),
    yawRadians
  });
}

function createBounds3(
  x: number,
  y: number,
  z: number
): Bounds3 {
  return {
    maxX: x,
    maxY: y,
    maxZ: z,
    minX: x,
    minY: y,
    minZ: z
  };
}

function includePoint(bounds: Bounds3, x: number, y: number, z: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}

function includeBox(
  bounds: Bounds3,
  centerX: number,
  centerY: number,
  centerZ: number,
  halfExtentX: number,
  halfExtentY: number,
  halfExtentZ: number
): void {
  includePoint(
    bounds,
    centerX - halfExtentX,
    centerY - halfExtentY,
    centerZ - halfExtentZ
  );
  includePoint(
    bounds,
    centerX + halfExtentX,
    centerY + halfExtentY,
    centerZ + halfExtentZ
  );
}

function resolveEntryPreviewPresentationSnapshot({
  cameraConfig,
  config,
  environmentProofConfig,
  portals
}: MetaverseRuntimeCameraPhaseStateDependencies):
  | MetaverseRuntimeCameraPhasePresentationSnapshot
  | null {
  if (!config.entryPreview.enabled) {
    return null;
  }

  const spawnPosition = cameraConfig.spawnPosition;
  const bounds = createBounds3(
    spawnPosition.x,
    spawnPosition.y,
    spawnPosition.z
  );

  for (const portal of portals) {
    includePoint(bounds, portal.position.x, portal.position.y, portal.position.z);
  }

  for (const environmentAsset of environmentProofConfig?.assets ?? []) {
    const collider = environmentAsset.collider;

    for (const placement of environmentAsset.placements) {
      includePoint(
        bounds,
        placement.position.x,
        placement.position.y,
        placement.position.z
      );

      if (collider === null) {
        continue;
      }

      const scaleVector = resolveMetaverseWorldSurfaceScaleVector(
        placement.scale
      );
      includeBox(
        bounds,
        placement.position.x + collider.center.x * scaleVector.x,
        placement.position.y + collider.center.y * scaleVector.y,
        placement.position.z + collider.center.z * scaleVector.z,
        Math.abs(collider.size.x * scaleVector.x) * 0.5,
        Math.abs(collider.size.y * scaleVector.y) * 0.5,
        Math.abs(collider.size.z * scaleVector.z) * 0.5
      );
    }
  }

  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerY = (bounds.minY + bounds.maxY) * 0.5;
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const horizontalSpan = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
  const verticalSpan = Math.max(bounds.maxY - bounds.minY, 1);
  const yawRadians = cameraConfig.initialYawRadians;
  const pitchRadians = config.entryPreview.pitchRadians;
  const lookDirection = directionFromYawPitch(yawRadians, pitchRadians);
  const desiredCameraHeight = Math.max(
    bounds.maxY + config.entryPreview.minHeightMeters,
    centerY + verticalSpan * 0.5 + config.entryPreview.minHeightMeters
  );
  const heightDistance = Math.max(
    0,
    (desiredCameraHeight - centerY) / Math.max(0.1, -lookDirection.y)
  );
  const distanceMeters = Math.max(
    config.entryPreview.minDistanceMeters,
    horizontalSpan * config.entryPreview.framingPadding,
    heightDistance
  );

  return freezePresentationSnapshot(
    freezeCameraSnapshot(
      centerX - lookDirection.x * distanceMeters,
      centerY - lookDirection.y * distanceMeters,
      centerZ - lookDirection.z * distanceMeters,
      yawRadians,
      pitchRadians
    ),
    null
  );
}

export class MetaverseRuntimeCameraPhaseState {
  readonly #config: MetaverseRuntimeCameraPhaseConfig;
  readonly #entryPreviewPresentationSnapshot:
    | MetaverseRuntimeCameraPhasePresentationSnapshot
    | null;

  #deathCameraSnapshot: MetaverseCameraSnapshot | null = null;
  #entryPreviewLiveReadyAtMs: number | null = null;
  #entryPreviewStartedAtMs: number | null = null;
  #gameplayControlLocked = false;
  #respawnControlLocked = false;

  constructor(dependencies: MetaverseRuntimeCameraPhaseStateDependencies) {
    this.#config = dependencies.config;
    this.#entryPreviewPresentationSnapshot =
      resolveEntryPreviewPresentationSnapshot(dependencies);
  }

  get entryPreviewEnabled(): boolean {
    return this.#entryPreviewPresentationSnapshot !== null;
  }

  reset(): void {
    this.#deathCameraSnapshot = null;
    this.#entryPreviewLiveReadyAtMs = null;
    this.#entryPreviewStartedAtMs = null;
    this.#gameplayControlLocked = false;
    this.#respawnControlLocked = false;
  }

  startEntryPreview(nowMs: number): void {
    if (!this.entryPreviewEnabled) {
      return;
    }

    this.#entryPreviewStartedAtMs = nowMs;
    this.#entryPreviewLiveReadyAtMs = null;
  }

  markEntryPreviewLiveReady(nowMs: number): void {
    if (!this.entryPreviewEnabled || this.#entryPreviewStartedAtMs === null) {
      return;
    }

    this.#entryPreviewLiveReadyAtMs = nowMs;
  }

  setDeathCameraSnapshot(snapshot: MetaverseCameraSnapshot | null): void {
    this.#deathCameraSnapshot = snapshot;
  }

  setGameplayControlLocked(locked: boolean): void {
    this.#gameplayControlLocked = locked;
  }

  setRespawnControlLocked(locked: boolean): void {
    this.#respawnControlLocked = locked;
  }

  resolveBootPresentationSnapshot(
    nowMs: number
  ): MetaverseRuntimeCameraPhasePresentationSnapshot | null {
    if (!this.#isEntryPreviewActive(nowMs)) {
      return null;
    }

    return this.#entryPreviewPresentationSnapshot;
  }

  resolveRuntimeCameraPhaseState({
    liveCameraSnapshot,
    liveFocusedPortal,
    nowMs,
    presenceReady,
    worldReady
  }: MetaverseRuntimeCameraPhaseResolutionInput): MetaverseRuntimeCameraPhaseStateSnapshot {
    if (this.#deathCameraSnapshot !== null) {
      return freezeStateSnapshot(
        "death-hold",
        freezePresentationSnapshot(this.#deathCameraSnapshot, null),
        true
      );
    }

    if (this.#respawnControlLocked) {
      return freezeStateSnapshot(
        "respawn-wait",
        freezePresentationSnapshot(liveCameraSnapshot, null),
        true
      );
    }

    const entryPreviewPresentationSnapshot =
      this.resolveBootPresentationSnapshot(nowMs);

    if (entryPreviewPresentationSnapshot !== null) {
      return freezeStateSnapshot(
        "entry-preview",
        entryPreviewPresentationSnapshot,
        true
      );
    }

    if (!presenceReady || !worldReady || this.#gameplayControlLocked) {
      return freezeStateSnapshot(
        "spawn-wait",
        freezePresentationSnapshot(liveCameraSnapshot, null),
        true
      );
    }

    return freezeStateSnapshot(
      "live",
      freezePresentationSnapshot(liveCameraSnapshot, liveFocusedPortal),
      false
    );
  }

  #isEntryPreviewActive(nowMs: number): boolean {
    if (
      this.#entryPreviewPresentationSnapshot === null ||
      this.#entryPreviewStartedAtMs === null
    ) {
      return false;
    }

    if (this.#entryPreviewLiveReadyAtMs === null) {
      return true;
    }

    return (
      nowMs - this.#entryPreviewLiveReadyAtMs <
      this.#config.entryPreview.minimumDwellMs
    );
  }
}
