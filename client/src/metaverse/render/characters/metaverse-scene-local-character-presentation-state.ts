import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseSemanticAimFrame } from "../../aim/metaverse-semantic-aim";
import {
  advanceLocalCharacterAnimation,
  syncLocalCharacterPresentation
} from "./metaverse-scene-local-character-presentation";
import {
  clearCharacterCombatDeathAnimation,
  triggerCharacterCombatPresentationEvent
} from "./metaverse-scene-character-animation";
import { MetaverseSceneHeldWeaponGripDebugState } from "./metaverse-scene-held-weapon-grip-debug-state";
import type {
  MetaverseRemoteCharacterPresentationDependencies
} from "./metaverse-scene-remote-character-presentations";
import type {
  MetaverseSceneCharacterProofRuntime,
  MetaverseSceneInteractivePresentationState
} from "./metaverse-scene-interactive-presentation-state";
import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "../environment/metaverse-scene-environment-proof-state";
import type {
  MetaverseSceneMountInteractionState
} from "../mounts/metaverse-scene-mount-interaction-state";
import type {
  MetaverseSceneMountedPresentationSnapshot
} from "../mounts/metaverse-scene-mounted-presentation-snapshot";
import type {
  MountedCharacterRuntime
} from "../mounts/metaverse-scene-mounts";
import type {
  MetaverseAttachmentProofRuntime
} from "../attachments/metaverse-scene-attachment-runtime";

import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseCombatPresentationEvent,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

interface MetaverseSceneLocalCharacterPresentationStateDependencies {
  readonly config: Pick<
    MetaverseRuntimeConfig,
    "bodyPresentation" | "orientation"
  >;
  readonly heldWeaponGripDebugState: MetaverseSceneHeldWeaponGripDebugState;
  readonly interactivePresentationState: Pick<
    MetaverseSceneInteractivePresentationState,
    "attachmentProofRuntime" | "characterProofRuntime" | "syncAttachmentMount"
  >;
  readonly localCharacterPresentationDependencies: Pick<
    MetaverseRemoteCharacterPresentationDependencies<
      MetaverseSceneCharacterProofRuntime,
      MetaverseAttachmentProofRuntime,
      MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >,
    | "captureHeldWeaponPoseRuntime"
    | "applyMountedAnchorTransform"
    | "prepareHeldWeaponPoseRuntime"
    | "restoreHeldWeaponPoseRuntime"
    | "syncHeldWeaponPose"
  >;
  readonly mountInteractionState: Pick<
    MetaverseSceneMountInteractionState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >,
    "readMountedCharacterRuntime" | "syncMountedCharacterRuntime"
  >;
}

export class MetaverseSceneLocalCharacterPresentationState {
  readonly #dependencies: MetaverseSceneLocalCharacterPresentationStateDependencies;

  constructor(
    dependencies: MetaverseSceneLocalCharacterPresentationStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  resetPresentation(): void {
    this.#dependencies.heldWeaponGripDebugState.reset();
    this.#dependencies.interactivePresentationState.syncAttachmentMount(null);
  }

  triggerCombatPresentationEvent(
    event: MetaverseCombatPresentationEvent
  ): void {
    const characterRuntime =
      this.#dependencies.interactivePresentationState.characterProofRuntime;

    if (characterRuntime === null) {
      return;
    }

    triggerCharacterCombatPresentationEvent(characterRuntime, event);
  }

  clearCombatDeathAnimation(): void {
    const characterRuntime =
      this.#dependencies.interactivePresentationState.characterProofRuntime;

    if (characterRuntime === null) {
      return;
    }

    clearCharacterCombatDeathAnimation(characterRuntime);
  }

  syncPresentation(
    nowMs: number,
    cameraSnapshot: MetaverseCameraSnapshot,
    deltaSeconds: number,
    characterPresentation: MetaverseCharacterPresentationSnapshot | null = null,
    mountedPresentationSnapshot: MetaverseSceneMountedPresentationSnapshot | null =
      null,
    weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null,
    weaponAdsBlend: number | null = null,
    semanticAimFrame: MetaverseSemanticAimFrame | null = null
  ): MetaverseCameraSnapshot {
    const {
      config,
      heldWeaponGripDebugState,
      interactivePresentationState,
      localCharacterPresentationDependencies,
      mountInteractionState
    } = this.#dependencies;
    const mountedEnvironment =
      mountedPresentationSnapshot?.mountedEnvironment ?? null;
    const mountedOccupancyPresentationState =
      mountedPresentationSnapshot?.mountedOccupancyPresentationState ?? null;

    if (interactivePresentationState.characterProofRuntime !== null) {
      advanceLocalCharacterAnimation(
        interactivePresentationState.characterProofRuntime,
        interactivePresentationState.attachmentProofRuntime,
        characterPresentation,
        weaponState,
        mountInteractionState.readMountedCharacterRuntime(),
        cameraSnapshot,
        deltaSeconds,
        config.orientation,
        localCharacterPresentationDependencies
      );
    }

    mountInteractionState.syncMountedCharacterRuntime(
      mountedEnvironment,
      mountedOccupancyPresentationState
    );
    const mountedCharacterRuntime = mountInteractionState.readMountedCharacterRuntime();
    interactivePresentationState.syncAttachmentMount(
      mountedOccupancyPresentationState,
      weaponState
    );

    if (interactivePresentationState.characterProofRuntime === null) {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: null,
        secondaryGripContactAvailable: false,
        heldMountSocketName: null,
        offHandGripAnchorAvailable: false,
        phase: "no-character-runtime",
        weaponState
      }, nowMs);

      return cameraSnapshot;
    }

    if (interactivePresentationState.attachmentProofRuntime === null) {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: null,
        secondaryGripContactAvailable: false,
        heldMountSocketName: null,
        offHandGripAnchorAvailable: false,
        phase: "no-attachment-runtime",
        weaponState
      }, nowMs);

      return syncLocalCharacterPresentation(
        interactivePresentationState.characterProofRuntime,
        null,
        mountedCharacterRuntime,
        cameraSnapshot,
        characterPresentation,
        config.bodyPresentation,
        weaponState,
        weaponAdsBlend,
        semanticAimFrame,
        localCharacterPresentationDependencies
      );
    }

    const { attachmentProofRuntime, characterProofRuntime } =
      interactivePresentationState;

    if (characterProofRuntime.heldWeaponPoseRuntime === null) {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: attachmentProofRuntime.activeMountKind,
        secondaryGripContactAvailable: false,
        heldMountSocketName: attachmentProofRuntime.heldMount.socketName,
        offHandGripAnchorAvailable:
          attachmentProofRuntime.offHandGripAnchorNode !== null,
        phase: "no-held-weapon-pose-runtime",
        weaponState
      }, nowMs);
    } else if (characterPresentation === null) {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: attachmentProofRuntime.activeMountKind,
        secondaryGripContactAvailable: false,
        heldMountSocketName: attachmentProofRuntime.heldMount.socketName,
        offHandGripAnchorAvailable:
          attachmentProofRuntime.offHandGripAnchorNode !== null,
        phase: "no-character-presentation",
        weaponState
      }, nowMs);
    } else if (mountedCharacterRuntime !== null) {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: attachmentProofRuntime.activeMountKind,
        secondaryGripContactAvailable: false,
        heldMountSocketName: attachmentProofRuntime.heldMount.socketName,
        offHandGripAnchorAvailable:
          attachmentProofRuntime.offHandGripAnchorNode !== null,
        phase: "mounted",
        weaponState
      }, nowMs);
    } else if (weaponState === null) {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: attachmentProofRuntime.activeMountKind,
        secondaryGripContactAvailable: false,
        heldMountSocketName: attachmentProofRuntime.heldMount.socketName,
        offHandGripAnchorAvailable:
          attachmentProofRuntime.offHandGripAnchorNode !== null,
        phase: "no-weapon-state",
        weaponState
      }, nowMs);
    } else if (attachmentProofRuntime.activeMountKind !== "held") {
      heldWeaponGripDebugState.recordSkippedFrame({
        adsBlend: weaponAdsBlend,
        attachmentMountKind: attachmentProofRuntime.activeMountKind,
        secondaryGripContactAvailable: false,
        heldMountSocketName: attachmentProofRuntime.heldMount.socketName,
        offHandGripAnchorAvailable:
          attachmentProofRuntime.offHandGripAnchorNode !== null,
        phase: "attachment-not-held",
        weaponState
      }, nowMs);
    }

    return syncLocalCharacterPresentation(
      characterProofRuntime,
      attachmentProofRuntime,
      mountedCharacterRuntime,
      cameraSnapshot,
      characterPresentation,
      config.bodyPresentation,
      weaponState,
      weaponAdsBlend,
      semanticAimFrame,
      localCharacterPresentationDependencies
    );
  }
}
