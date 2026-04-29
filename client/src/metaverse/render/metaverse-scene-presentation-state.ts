import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseSceneCameraPresentationState } from "./camera/metaverse-scene-camera-presentation-state";
import type { MetaverseSceneLocalCharacterPresentationState } from "./characters/metaverse-scene-local-character-presentation-state";
import type { MetaverseSceneRemoteCharacterPresentationState } from "./characters/metaverse-scene-remote-character-presentation-state";
import type { MetaverseScenePresentationLifecycleState } from "./metaverse-scene-presentation-lifecycle-state";
import {
  createMetaverseSceneMountedPresentationSnapshot
} from "./mounts/metaverse-scene-mounted-presentation-snapshot";
import type {
  MetaverseSceneInteractionSnapshot
} from "./mounts/metaverse-scene-mounts";
import type { MetaverseScenePortalPresentationState } from "./portals/metaverse-scene-portal-presentation-state";
import type { MetaverseSemanticAimFrame } from "../aim/metaverse-semantic-aim";

import type {
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseCombatPresentationEvent,
  MetaverseRemoteCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";

interface MetaverseScenePresentationStateDependencies {
  readonly cameraPresentationState: MetaverseSceneCameraPresentationState;
  readonly lifecycleState: MetaverseScenePresentationLifecycleState;
  readonly localCharacterPresentationState: MetaverseSceneLocalCharacterPresentationState;
  readonly portalPresentationState: MetaverseScenePortalPresentationState;
  readonly remoteCharacterPresentationState: MetaverseSceneRemoteCharacterPresentationState;
}

export class MetaverseScenePresentationState {
  readonly #dependencies: MetaverseScenePresentationStateDependencies;

  constructor(dependencies: MetaverseScenePresentationStateDependencies) {
    this.#dependencies = dependencies;
  }

  async bootScenicEnvironment(): Promise<void> {
    await this.#dependencies.lifecycleState.bootScenicEnvironment();
  }

  async bootInteractivePresentation(): Promise<void> {
    await this.#dependencies.lifecycleState.bootInteractivePresentation();
  }

  async boot(): Promise<void> {
    await this.#dependencies.lifecycleState.boot();
  }

  resetPresentation(): void {
    this.#dependencies.lifecycleState.resetPresentation();
  }

  triggerCombatPresentationEvent(
    event: MetaverseCombatPresentationEvent,
    localPlayerId: string | null
  ): void {
    if (localPlayerId !== null && event.playerId === localPlayerId) {
      this.#dependencies.localCharacterPresentationState.triggerCombatPresentationEvent(
        event
      );
      return;
    }

    this.#dependencies.remoteCharacterPresentationState.triggerCombatPresentationEvent(
      event
    );
  }

  clearLocalCombatDeathAnimation(): void {
    this.#dependencies.localCharacterPresentationState.clearCombatDeathAnimation();
  }

  async prewarm(renderer: import("./camera/metaverse-scene-camera").MetaverseSceneRendererHost): Promise<void> {
    await this.#dependencies.lifecycleState.prewarm(renderer);
  }

  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    characterPresentation: MetaverseCharacterPresentationSnapshot | null = null,
    localWeaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null,
    localWeaponAdsBlend: number | null = null,
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[] = [],
    mountedEnvironment: MountedEnvironmentSnapshot | null = null,
    cameraFieldOfViewDegrees: number | null = null,
    localSemanticAimFrame: MetaverseSemanticAimFrame | null = null
  ): MetaverseSceneInteractionSnapshot {
    const {
      cameraPresentationState,
      localCharacterPresentationState,
      portalPresentationState,
      remoteCharacterPresentationState
    } = this.#dependencies;
    const mountedPresentationSnapshot =
      createMetaverseSceneMountedPresentationSnapshot(mountedEnvironment);
    const presentedCameraSnapshot = localCharacterPresentationState.syncPresentation(
      nowMs,
      cameraSnapshot,
      deltaSeconds,
      characterPresentation,
      mountedPresentationSnapshot,
      localWeaponState,
      localWeaponAdsBlend,
      localSemanticAimFrame
    );
    cameraPresentationState.syncPresentedCamera(
      presentedCameraSnapshot,
      nowMs,
      cameraFieldOfViewDegrees
    );
    remoteCharacterPresentationState.syncPresentation(
      remoteCharacterPresentations,
      deltaSeconds
    );
    portalPresentationState.syncPresentation(focusedPortal, nowMs);

    return cameraPresentationState.syncSceneInteractionSnapshot(
      presentedCameraSnapshot,
      mountedPresentationSnapshot
    );
  }
}
