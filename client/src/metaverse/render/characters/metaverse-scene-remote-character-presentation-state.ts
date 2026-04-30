import { Quaternion, Vector3, type Scene } from "three/webgpu";

import type {
  MetaverseRemoteCharacterPresentationDependencies,
  MetaverseRemoteCharacterPresentationRuntimeState
} from "./metaverse-scene-remote-character-presentations";
import {
  syncRemoteCharacterPresentations
} from "./metaverse-scene-remote-character-presentations";
import {
  clearCharacterCombatDeathPresentation,
  triggerCharacterCombatPresentationEvent
} from "./metaverse-scene-character-animation";
import type {
  MetaverseSceneCharacterProofRuntime,
  MetaverseSceneInteractivePresentationState
} from "./metaverse-scene-interactive-presentation-state";
import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "../environment/metaverse-scene-environment-proof-state";
import type {
  MountedCharacterRuntime
} from "../mounts/metaverse-scene-mounts";
import type { MetaverseAttachmentProofRuntime } from "../attachments/metaverse-scene-attachment-runtime";

import type {
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseCombatPresentationEvent,
  MetaverseRenderedWeaponMuzzleFrame,
  MetaverseRenderedWeaponMuzzleQuery,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

interface MetaverseSceneRemoteCharacterPresentationStateDependencies {
  readonly config: Pick<
    MetaverseRuntimeConfig,
    "bodyPresentation" | "orientation"
  >;
  readonly interactivePresentationState: Pick<
    MetaverseSceneInteractivePresentationState,
    "attachmentProofRuntimesByAttachmentId" | "characterProofRuntime"
  >;
  readonly remoteCharacterPresentationDependencies: MetaverseRemoteCharacterPresentationDependencies<
    MetaverseSceneCharacterProofRuntime,
    MetaverseAttachmentProofRuntime,
    MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>,
    MetaverseMountableEnvironmentDynamicAssetRuntime
  >;
  readonly scene: Scene;
}

export class MetaverseSceneRemoteCharacterPresentationState {
  readonly #dependencies: MetaverseSceneRemoteCharacterPresentationStateDependencies;
  readonly #muzzleForwardWorldScratch = new Vector3();
  readonly #muzzleWorldPositionScratch = new Vector3();
  readonly #muzzleWorldQuaternionScratch = new Quaternion();
  readonly #remoteCharacterRuntimesByPlayerId = new Map<
    string,
    MetaverseRemoteCharacterPresentationRuntimeState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseAttachmentProofRuntime,
      MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>
    >
  >();

  constructor(
    dependencies: MetaverseSceneRemoteCharacterPresentationStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  resetPresentation(): void {
    for (const remoteCharacterRuntime of this.#remoteCharacterRuntimesByPlayerId.values()) {
      clearCharacterCombatDeathPresentation(
        remoteCharacterRuntime.characterRuntime
      );
      remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
        remoteCharacterRuntime.characterRuntime.anchorGroup
      );
    }

    this.#remoteCharacterRuntimesByPlayerId.clear();
  }

  triggerCombatPresentationEvent(
    event: MetaverseCombatPresentationEvent
  ): void {
    const remoteCharacterRuntime = this.#remoteCharacterRuntimesByPlayerId.get(
      event.playerId
    );

    if (remoteCharacterRuntime === undefined) {
      return;
    }

    triggerCharacterCombatPresentationEvent(
      remoteCharacterRuntime.characterRuntime,
      event
    );
  }

  readRenderedWeaponMuzzleFrame(
    query: MetaverseRenderedWeaponMuzzleQuery,
    sampledAtRenderFrame: number
  ): MetaverseRenderedWeaponMuzzleFrame | null {
    const remoteCharacterRuntime = this.#remoteCharacterRuntimesByPlayerId.get(
      query.playerId
    );
    const attachmentRuntime =
      remoteCharacterRuntime?.attachmentRuntime ?? null;

    if (
      attachmentRuntime === null ||
      attachmentRuntime.attachmentId !== query.weaponId
    ) {
      return null;
    }

    const muzzleSocketNode =
      attachmentRuntime.socketNodesByRole.get(query.role) ?? null;

    if (muzzleSocketNode === null) {
      return null;
    }

    muzzleSocketNode.updateWorldMatrix(true, false);
    muzzleSocketNode.getWorldPosition(this.#muzzleWorldPositionScratch);
    muzzleSocketNode.getWorldQuaternion(this.#muzzleWorldQuaternionScratch);
    this.#muzzleForwardWorldScratch
      .set(1, 0, 0)
      .applyQuaternion(this.#muzzleWorldQuaternionScratch)
      .normalize();

    return Object.freeze({
      forwardWorld: Object.freeze({
        x: this.#muzzleForwardWorldScratch.x,
        y: this.#muzzleForwardWorldScratch.y,
        z: this.#muzzleForwardWorldScratch.z
      }),
      originWorld: Object.freeze({
        x: this.#muzzleWorldPositionScratch.x,
        y: this.#muzzleWorldPositionScratch.y,
        z: this.#muzzleWorldPositionScratch.z
      }),
      playerId: query.playerId,
      sampledAtRenderFrame,
      source: "rendered-projectile-muzzle" as const,
      weaponId: query.weaponId,
      weaponInstanceId: query.weaponInstanceId ?? null
    });
  }

  syncPresentation(
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    nowMs: number,
    deltaSeconds: number
  ): void {
    syncRemoteCharacterPresentations(
      this.#dependencies.scene,
      this.#dependencies.interactivePresentationState.characterProofRuntime,
      this.#dependencies.interactivePresentationState
        .attachmentProofRuntimesByAttachmentId,
      this.#dependencies.config,
      this.#remoteCharacterRuntimesByPlayerId,
      remoteCharacterPresentations,
      deltaSeconds,
      nowMs,
      this.#dependencies.remoteCharacterPresentationDependencies
    );
  }
}
