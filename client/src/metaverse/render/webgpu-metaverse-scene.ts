import {
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3
} from "three/webgpu";
import type {
  MetaverseCombatProjectileSnapshot,
  MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared";
import {
  createMetaverseSceneCamera,
  createMetaverseSceneCameraSnapshot,
  type MetaverseSceneCanvasHost,
  type MetaverseSceneRendererHost
} from "./camera/metaverse-scene-camera";
import { MetaverseSceneCameraPresentationState } from "./camera/metaverse-scene-camera-presentation-state";
import { MetaverseSceneCombatFxState } from "./combat/metaverse-scene-combat-fx-state";
import {
  MetaverseSceneInteractivePresentationState,
  type MetaverseSceneAssetLoader,
  type MetaverseSceneCharacterProofRuntime
} from "./characters/metaverse-scene-interactive-presentation-state";
import { MetaverseSceneHeldWeaponGripDebugState } from "./characters/metaverse-scene-held-weapon-grip-debug-state";
import { syncHumanoidV2HeldWeaponPose } from "./characters/metaverse-scene-held-weapon-pose";
import { MetaverseSceneLocalCharacterPresentationState } from "./characters/metaverse-scene-local-character-presentation-state";
import { MetaverseSceneRemoteCharacterPresentationState } from "./characters/metaverse-scene-remote-character-presentation-state";
import { createMetaverseSceneRemoteCharacterPresentationDependencies } from "./characters/metaverse-scene-remote-character-presentation-dependencies";
import {
  MetaverseSceneEnvironmentProofState,
  type DynamicEnvironmentPoseSnapshot,
  type MetaverseMountableEnvironmentDynamicAssetRuntime
} from "./environment/metaverse-scene-environment-proof-state";
import {
  type MetaverseSceneInteractionSnapshot
} from "./mounts/metaverse-scene-mounts";
import { createMountedEnvironmentSnapshot } from "./mounts/metaverse-scene-mount-snapshots";
import { resolveMountableEnvironmentRuntimeById } from "./mounts/metaverse-scene-mount-runtime-resolution";
import { MetaverseSceneMountInteractionState } from "./mounts/metaverse-scene-mount-interaction-state";
import { createDefaultMetaverseSceneAssetLoader } from "./metaverse-scene-asset-loader";
import { markMetaverseSceneBundleGroupsDirty } from "./metaverse-scene-bundle-groups";
import {
  createMetaverseAttachmentRuntimeNodeResolvers,
  createMetaverseCharacterProofRuntimeNodeResolvers,
  createMetaverseHeldWeaponPoseRuntimeNodeResolvers,
  findMetaverseSceneNamedNode
} from "./metaverse-scene-proof-node-resolvers";
import { MetaverseScenePresentationLifecycleState } from "./metaverse-scene-presentation-lifecycle-state";
import { MetaverseScenePresentationState } from "./metaverse-scene-presentation-state";
import { MetaverseSceneScenicState } from "./metaverse-scene-scenic-state";
import { MetaverseScenePortalPresentationState } from "./portals/metaverse-scene-portal-presentation-state";
import type { MetaverseSemanticAimFrame } from "../aim/metaverse-semantic-aim";

import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentProofConfig,
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaverseCombatPresentationEvent,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseLocalHeldWeaponGripTelemetrySnapshot,
  MetaverseRenderedWeaponMuzzleFrame,
  MetaverseRenderedWeaponMuzzleQuery,
  MountedEnvironmentSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import type { MountedEnvironmentAnchorSnapshot } from "../traversal/types/traversal";
export type {
  MetaverseSceneCanvasHost,
  MetaverseSceneRendererHost
} from "./camera/metaverse-scene-camera";
export type { MetaverseSceneAssetLoader as SceneAssetLoader } from "./characters/metaverse-scene-interactive-presentation-state";

interface MetaverseSceneDependencies {
  attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  attachmentProofConfigs?:
    | readonly MetaverseAttachmentProofConfig[]
    | null
    | undefined;
  characterProofConfig?: MetaverseCharacterProofConfig | null;
  environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  createSceneAssetLoader?: () => MetaverseSceneAssetLoader;
  showSocketDebug?: boolean;
  localPlayerId?: string | null;
  warn?: (message: string) => void;
}

function resolveMetaverseSceneAttachmentProofConfigs(
  dependencies: Pick<
    MetaverseSceneDependencies,
    "attachmentProofConfig" | "attachmentProofConfigs"
  >
): readonly MetaverseAttachmentProofConfig[] {
  if (dependencies.attachmentProofConfigs !== undefined) {
    return dependencies.attachmentProofConfigs ?? [];
  }

  return dependencies.attachmentProofConfig === null ||
    dependencies.attachmentProofConfig === undefined
    ? []
    : [dependencies.attachmentProofConfig];
}

export function createMetaverseScene(
  config: MetaverseRuntimeConfig,
  dependencies: MetaverseSceneDependencies = {}
): {
  readonly camera: PerspectiveCamera;
  readonly scene: Scene;
  boot(): Promise<void>;
  bootInteractivePresentation(): Promise<void>;
  bootScenicEnvironment(): Promise<void>;
  resetPresentation(): void;
  clearLocalCombatDeathAnimation(): void;
  triggerCombatPresentationEvent(
    event: MetaverseCombatPresentationEvent
  ): void;
  prewarm(renderer: MetaverseSceneRendererHost): Promise<void>;
  readLocalHeldWeaponGripTelemetrySnapshot(
    nowMs: number
  ): MetaverseLocalHeldWeaponGripTelemetrySnapshot;
  readLocalWeaponProjectileMuzzleWorldPosition(
    weaponId: string
  ): { readonly x: number; readonly y: number; readonly z: number } | null;
  readLocalWeaponProjectileMuzzleFrame(weaponId: string): {
    readonly forwardWorld: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly originWorld: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  } | null;
  readRenderedWeaponMuzzleFrame(
    query: MetaverseRenderedWeaponMuzzleQuery
  ): MetaverseRenderedWeaponMuzzleFrame | null;
  syncCombatProjectiles(
    combatProjectiles: readonly MetaverseCombatProjectileSnapshot[],
    nowMs: number
  ): void;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    characterPresentation?: MetaverseCharacterPresentationSnapshot | null,
    localWeaponState?: MetaverseRealtimePlayerWeaponStateSnapshot | null,
    localWeaponAdsBlend?: number | null,
    remoteCharacterPresentations?: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    mountedEnvironment?: MountedEnvironmentSnapshot | null,
    cameraFieldOfViewDegrees?: number | null,
    localSemanticAimFrame?: MetaverseSemanticAimFrame | null,
    combatProjectiles?: readonly MetaverseCombatProjectileSnapshot[]
  ): MetaverseSceneInteractionSnapshot;
  readDynamicEnvironmentPose(
    environmentAssetId: string
  ): DynamicEnvironmentPoseSnapshot | null;
  readMountedEnvironmentAnchorSnapshot(
    mountedEnvironment: MountedEnvironmentSnapshot
  ): MountedEnvironmentAnchorSnapshot | null;
  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: DynamicEnvironmentPoseSnapshot | null
  ): void;
  syncViewport(
    renderer: MetaverseSceneRendererHost,
    canvasHost: MetaverseSceneCanvasHost,
    devicePixelRatio: number
  ): void;
  resolveBoardFocusedMountable(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedEntryId?: string | null
  ): MountedEnvironmentSnapshot | null;
  resolveSeatOccupancy(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedSeatId: string
  ): MountedEnvironmentSnapshot | null;
} {
  const camera = createMetaverseSceneCamera(config.camera);
  const scene = new Scene();
  const scenicState = new MetaverseSceneScenicState({
    camera,
    config,
    scene
  });
  const createSceneAssetLoader =
    dependencies.createSceneAssetLoader ?? createDefaultMetaverseSceneAssetLoader;
  const attachmentProofConfigs =
    resolveMetaverseSceneAttachmentProofConfigs(dependencies);
  const localPlayerId = dependencies.localPlayerId ?? null;
  const localProjectileMuzzleForwardWorldScratch = new Vector3();
  const localProjectileMuzzleWorldPositionScratch = new Vector3();
  const localProjectileMuzzleWorldQuaternionScratch = new Quaternion();
  let presentationRenderFrame = 0;

  function resolveMountedEnvironmentRuntime(
    environmentAssetId: string
  ): MetaverseMountableEnvironmentDynamicAssetRuntime | null {
    return resolveMountableEnvironmentRuntimeById(
      environmentProofState.runtime,
      environmentAssetId
    );
  }

  const attachmentRuntimeNodeResolvers =
    createMetaverseAttachmentRuntimeNodeResolvers();
  const characterProofRuntimeNodeResolvers =
    createMetaverseCharacterProofRuntimeNodeResolvers();
  const heldWeaponPoseRuntimeNodeResolvers =
    createMetaverseHeldWeaponPoseRuntimeNodeResolvers();

  const interactivePresentationState = new MetaverseSceneInteractivePresentationState(
    {
      attachmentProofConfigs,
      attachmentRuntimeNodeResolvers,
      characterProofConfig: dependencies.characterProofConfig ?? null,
      characterProofRuntimeNodeResolvers,
      createSceneAssetLoader,
      heldWeaponPoseRuntimeNodeResolvers,
      scene,
      showSocketDebug: dependencies.showSocketDebug ?? false,
      warn:
        dependencies.warn ?? ((message) => globalThis.console?.warn(message))
    }
  );
  const mountInteractionState =
    new MetaverseSceneMountInteractionState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >({
      focusProbeForwardMeters:
        config.bodyPresentation.swimThirdPersonFollowDistanceMeters,
      readCharacterProofRuntime: () =>
        interactivePresentationState.characterProofRuntime,
      readEnvironmentProofRuntime: () => environmentProofState.runtime,
      resolveMountedEnvironmentRuntime,
      resolveMountedEnvironmentSnapshot: createMountedEnvironmentSnapshot
    });

  const remoteCharacterPresentationDependencies =
    createMetaverseSceneRemoteCharacterPresentationDependencies({
      attachmentRuntimeNodeResolvers,
      characterProofRuntimeNodeResolvers,
      heldWeaponPoseRuntimeNodeResolvers,
      resolveMountedEnvironmentRuntime
    });

  function createCurrentCameraSnapshot(): MetaverseCameraSnapshot {
    return createMetaverseSceneCameraSnapshot(camera);
  }

  const environmentProofState = new MetaverseSceneEnvironmentProofState({
    createSceneAssetLoader,
    environmentProofConfig: dependencies.environmentProofConfig ?? null,
    findNamedNode: findMetaverseSceneNamedNode,
    markSceneBundleGroupsDirty: () =>
      markMetaverseSceneBundleGroupsDirty(scene),
    readCurrentCameraSnapshot: createCurrentCameraSnapshot,
    scene,
    showSocketDebug: dependencies.showSocketDebug ?? false
  });
  const portalPresentationState = new MetaverseScenePortalPresentationState({
    portalMeshes: scenicState.portalMeshes
  });
  const heldWeaponGripDebugState = new MetaverseSceneHeldWeaponGripDebugState();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const localCharacterPresentationState =
    new MetaverseSceneLocalCharacterPresentationState({
      config,
      heldWeaponGripDebugState,
      interactivePresentationState,
      localCharacterPresentationDependencies: {
        applyMountedAnchorTransform:
          remoteCharacterPresentationDependencies.applyMountedAnchorTransform,
        captureHeldWeaponPoseRuntime:
          remoteCharacterPresentationDependencies.captureHeldWeaponPoseRuntime,
        prepareHeldWeaponPoseRuntime:
          remoteCharacterPresentationDependencies.prepareHeldWeaponPoseRuntime,
        restoreHeldWeaponPoseRuntime:
          remoteCharacterPresentationDependencies.restoreHeldWeaponPoseRuntime,
        syncHeldWeaponPose: (
          characterRuntime,
          heldWeaponPoseRuntime,
          attachmentRuntime,
          aimState,
          weaponState,
          bodyPresentation
        ) =>
          syncHumanoidV2HeldWeaponPose(
            characterRuntime,
            heldWeaponPoseRuntime,
            attachmentRuntime,
            aimState,
            weaponState,
            bodyPresentation,
            heldWeaponGripDebugState
          )
      },
      mountInteractionState
    });
  const remoteCharacterPresentationState =
    new MetaverseSceneRemoteCharacterPresentationState({
      config,
      interactivePresentationState,
      remoteCharacterPresentationDependencies,
      scene
    });
  const cameraPresentationState = new MetaverseSceneCameraPresentationState({
    camera,
    environmentProofState,
    mountInteractionState
  });
  const lifecycleState = new MetaverseScenePresentationLifecycleState({
    camera,
    cameraPresentationState,
    createCurrentCameraSnapshot,
    environmentProofState,
    interactivePresentationState,
    localCharacterPresentationState,
    mountInteractionState,
    portalPresentationState,
    remoteCharacterPresentationState,
    scene
  });
  const presentationState = new MetaverseScenePresentationState({
    cameraPresentationState,
    lifecycleState,
    localCharacterPresentationState,
    portalPresentationState,
    remoteCharacterPresentationState
  });

  return {
    camera,
    scene,
    async boot() {
      await presentationState.boot();
    },
    bootInteractivePresentation: () =>
      presentationState.bootInteractivePresentation(),
    bootScenicEnvironment: () => presentationState.bootScenicEnvironment(),
    resetPresentation() {
      presentationState.resetPresentation();
      combatFxState.reset();
    },
    clearLocalCombatDeathAnimation() {
      presentationState.clearLocalCombatDeathAnimation();
    },
    triggerCombatPresentationEvent(event) {
      presentationState.triggerCombatPresentationEvent(event, localPlayerId);
      combatFxState.triggerCombatPresentationEvent(event);
    },
    async prewarm(renderer) {
      await presentationState.prewarm(renderer);
    },
    readLocalHeldWeaponGripTelemetrySnapshot(nowMs) {
      return heldWeaponGripDebugState.readSnapshot(nowMs);
    },
    readLocalWeaponProjectileMuzzleWorldPosition(weaponId) {
      const attachmentProofRuntime =
        interactivePresentationState.attachmentProofRuntimesByAttachmentId.get(
          weaponId
        ) ?? null;
      const muzzleSocketNode =
        attachmentProofRuntime?.socketNodesByRole.get("projectile.muzzle") ??
        null;

      if (muzzleSocketNode === null) {
        return null;
      }

      muzzleSocketNode.updateWorldMatrix(true, false);
      muzzleSocketNode.getWorldPosition(localProjectileMuzzleWorldPositionScratch);

      return Object.freeze({
        x: localProjectileMuzzleWorldPositionScratch.x,
        y: localProjectileMuzzleWorldPositionScratch.y,
        z: localProjectileMuzzleWorldPositionScratch.z
      });
    },
    readLocalWeaponProjectileMuzzleFrame(weaponId) {
      const attachmentProofRuntime =
        interactivePresentationState.attachmentProofRuntimesByAttachmentId.get(
          weaponId
        ) ?? null;
      const muzzleSocketNode =
        attachmentProofRuntime?.socketNodesByRole.get("projectile.muzzle") ??
        null;

      if (muzzleSocketNode === null) {
        return null;
      }

      muzzleSocketNode.updateWorldMatrix(true, false);
      muzzleSocketNode.getWorldPosition(localProjectileMuzzleWorldPositionScratch);
      muzzleSocketNode.getWorldQuaternion(localProjectileMuzzleWorldQuaternionScratch);
      localProjectileMuzzleForwardWorldScratch
        .set(1, 0, 0)
        .applyQuaternion(localProjectileMuzzleWorldQuaternionScratch)
        .normalize();

      return Object.freeze({
        forwardWorld: Object.freeze({
          x: localProjectileMuzzleForwardWorldScratch.x,
          y: localProjectileMuzzleForwardWorldScratch.y,
          z: localProjectileMuzzleForwardWorldScratch.z
        }),
        originWorld: Object.freeze({
          x: localProjectileMuzzleWorldPositionScratch.x,
          y: localProjectileMuzzleWorldPositionScratch.y,
          z: localProjectileMuzzleWorldPositionScratch.z
        })
      });
    },
    readRenderedWeaponMuzzleFrame(query) {
      if (localPlayerId !== null && query.playerId === localPlayerId) {
        const attachmentProofRuntime =
          interactivePresentationState.attachmentProofRuntimesByAttachmentId.get(
            query.weaponId
          ) ?? null;
        const muzzleSocketNode =
          attachmentProofRuntime?.socketNodesByRole.get(query.role) ?? null;

        if (muzzleSocketNode === null) {
          return null;
        }

        muzzleSocketNode.updateWorldMatrix(true, false);
        muzzleSocketNode.getWorldPosition(
          localProjectileMuzzleWorldPositionScratch
        );
        muzzleSocketNode.getWorldQuaternion(
          localProjectileMuzzleWorldQuaternionScratch
        );
        localProjectileMuzzleForwardWorldScratch
          .set(1, 0, 0)
          .applyQuaternion(localProjectileMuzzleWorldQuaternionScratch)
          .normalize();

        return Object.freeze({
          forwardWorld: Object.freeze({
            x: localProjectileMuzzleForwardWorldScratch.x,
            y: localProjectileMuzzleForwardWorldScratch.y,
            z: localProjectileMuzzleForwardWorldScratch.z
          }),
          originWorld: Object.freeze({
            x: localProjectileMuzzleWorldPositionScratch.x,
            y: localProjectileMuzzleWorldPositionScratch.y,
            z: localProjectileMuzzleWorldPositionScratch.z
          }),
          playerId: query.playerId,
          sampledAtRenderFrame: presentationRenderFrame,
          source: "rendered-projectile-muzzle" as const,
          weaponId: query.weaponId,
          weaponInstanceId: query.weaponInstanceId ?? null
        });
      }

      return remoteCharacterPresentationState.readRenderedWeaponMuzzleFrame(
        query,
        presentationRenderFrame
      );
    },
    syncCombatProjectiles(combatProjectiles, nowMs) {
      combatFxState.syncProjectiles(combatProjectiles, nowMs);
    },
    syncPresentation(
      cameraSnapshot,
      focusedPortal,
      nowMs,
      deltaSeconds,
      characterPresentation = null,
      localWeaponState = null,
      localWeaponAdsBlend = null,
      remoteCharacterPresentations = [],
      mountedEnvironment = null,
      cameraFieldOfViewDegrees = null,
      localSemanticAimFrame = null,
      combatProjectiles = []
    ) {
      const interactionSnapshot = presentationState.syncPresentation(
        cameraSnapshot,
        focusedPortal,
        nowMs,
        deltaSeconds,
        characterPresentation,
        localWeaponState,
        localWeaponAdsBlend,
        remoteCharacterPresentations,
        mountedEnvironment,
        cameraFieldOfViewDegrees,
        localSemanticAimFrame
      );

      presentationRenderFrame += 1;
      if (combatProjectiles.length > 0) {
        combatFxState.syncProjectiles(combatProjectiles, nowMs);
      }
      scenicState.syncCameraRelativeEnvironment();

      return interactionSnapshot;
    },
    readDynamicEnvironmentPose(environmentAssetId) {
      return environmentProofState.readDynamicEnvironmentPose(
        environmentAssetId
      );
    },
    readMountedEnvironmentAnchorSnapshot(mountedEnvironment) {
      return environmentProofState.readMountedEnvironmentAnchorSnapshot(
        mountedEnvironment
      );
    },
    setDynamicEnvironmentPose(environmentAssetId, poseSnapshot) {
      environmentProofState.setDynamicEnvironmentPose(
        environmentAssetId,
        poseSnapshot
      );
    },
    syncViewport(renderer, canvasHost, devicePixelRatio) {
      scenicState.syncViewport(renderer, canvasHost, devicePixelRatio);
    },
    resolveBoardFocusedMountable(cameraSnapshot, requestedEntryId = null) {
      return mountInteractionState.resolveBoardFocusedMountable(
        cameraSnapshot,
        requestedEntryId
      );
    },
    resolveSeatOccupancy(cameraSnapshot, requestedSeatId) {
      return mountInteractionState.resolveSeatOccupancy(
        cameraSnapshot,
        requestedSeatId
      );
    }
  };
}
