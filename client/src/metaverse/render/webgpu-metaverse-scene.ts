import {
  PerspectiveCamera,
  Scene
} from "three/webgpu";
import {
  createMetaverseSceneCamera,
  createMetaverseSceneCameraSnapshot,
  type MetaverseSceneCanvasHost,
  type MetaverseSceneRendererHost
} from "./camera/metaverse-scene-camera";
import { MetaverseSceneCameraPresentationState } from "./camera/metaverse-scene-camera-presentation-state";
import {
  MetaverseSceneInteractivePresentationState,
  type MetaverseSceneAssetLoader,
  type MetaverseSceneCharacterProofRuntime
} from "./characters/metaverse-scene-interactive-presentation-state";
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

import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentProofConfig,
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import { metaverseHumanoidV2PistolPoseIds } from "../types/metaverse-runtime";
import type { MountedEnvironmentAnchorSnapshot } from "../traversal/types/traversal";
export type {
  MetaverseSceneCanvasHost,
  MetaverseSceneRendererHost
} from "./camera/metaverse-scene-camera";
export type { MetaverseSceneAssetLoader as SceneAssetLoader } from "./characters/metaverse-scene-interactive-presentation-state";

interface MetaverseSceneDependencies {
  attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  characterProofConfig?: MetaverseCharacterProofConfig | null;
  environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  createSceneAssetLoader?: () => MetaverseSceneAssetLoader;
  showSocketDebug?: boolean;
  warn?: (message: string) => void;
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
  prewarm(renderer: MetaverseSceneRendererHost): Promise<void>;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    characterPresentation?: MetaverseCharacterPresentationSnapshot | null,
    remoteCharacterPresentations?: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    mountedEnvironment?: MountedEnvironmentSnapshot | null,
    cameraFieldOfViewDegrees?: number | null
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
      attachmentProofConfig: dependencies.attachmentProofConfig ?? null,
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
  const localCharacterPresentationState =
    new MetaverseSceneLocalCharacterPresentationState({
      config,
      interactivePresentationState,
      localCharacterPresentationDependencies:
        remoteCharacterPresentationDependencies,
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
    },
    async prewarm(renderer) {
      await presentationState.prewarm(renderer);
    },
    syncPresentation(
      cameraSnapshot,
      focusedPortal,
      nowMs,
      deltaSeconds,
      characterPresentation = null,
      remoteCharacterPresentations = [],
      mountedEnvironment = null,
      cameraFieldOfViewDegrees = null
    ) {
      return presentationState.syncPresentation(
        cameraSnapshot,
        focusedPortal,
        nowMs,
        deltaSeconds,
        characterPresentation,
        remoteCharacterPresentations,
        mountedEnvironment,
        cameraFieldOfViewDegrees
      );
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
