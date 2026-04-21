import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";
import { clone as cloneSkinnedGroup } from "three/addons/utils/SkeletonUtils.js";

import {
  createHumanoidV2PistolLowerBodyActionsByVocabulary,
  createHumanoidV2PistolPoseRuntime,
  createHumanoidV2UpperBodyPistolPoseClip,
  type HumanoidV2PistolPoseRuntime,
  type MetaverseCharacterAnimationRuntimeLike
} from "./metaverse-scene-character-animation";

import type {
  MetaverseCharacterAnimationClipLoopMode,
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterProofConfig,
  MetaverseHumanoidV2PistolPoseId
} from "../../types/metaverse-runtime";
import { metaverseHumanoidV2PistolPoseIds } from "../../types/metaverse-runtime";

const humanoidV2GripSocketBlendAlpha = 0.72;
const humanoidV2PalmSocketBlendAlpha = 0.45;
const humanoidV2BackSocketLowerOffsetMeters = 0.02;
const humanoidV2BackSocketRearwardScale = 0.7;
const metaverseCharacterAnchorPosition = Object.freeze({
  x: 11,
  y: 0,
  z: -18
});
const metaverseCharacterProofAnchorRotationYRadians = Math.PI * 0.86;
const metaverseCharacterScaleBoundsMeters = Object.freeze({
  max: 2.4,
  min: 1.2
});

interface LoadedSceneAssetLike {
  readonly animations: readonly AnimationClip[];
  readonly scene: Group;
}

interface SceneAssetLoaderLike {
  loadAsync(path: string): Promise<LoadedSceneAssetLike>;
}

export interface MetaverseCharacterProofRuntimeNodeResolvers {
  readonly ensureSocketDebugMarker: (
    socketNode: Object3D,
    socketName: string
  ) => void;
  readonly findBoneNode: (
    characterScene: Group,
    boneName: string,
    label: string
  ) => Bone;
  readonly findOptionalNode: (scene: Group, nodeName: string) => Object3D | null;
  readonly findSocketNode: (
    characterScene: Group,
    socketName: string
  ) => Object3D;
  readonly upsertSyntheticSocketNode: (
    characterScene: Group,
    parentBone: Bone,
    socketName: string,
    localPosition: Vector3,
    showSocketDebug: boolean,
    localQuaternion?: Quaternion
  ) => Bone;
}

export interface LoadedMetaverseCharacterProofRuntime<
  THeldWeaponPoseRuntime
> extends MetaverseCharacterAnimationRuntimeLike {
  readonly characterId: string;
  readonly clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >;
  readonly clipLoopModesByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    MetaverseCharacterAnimationClipLoopMode
  >;
  readonly firstPersonHeadAnchorNodes: readonly Object3D[];
  readonly heldWeaponPoseRuntime: THeldWeaponPoseRuntime | null;
  readonly mixer: AnimationMixer;
  readonly scene: Group;
  readonly seatSocketNode: Object3D;
}

function ensureSkinnedMesh(characterScene: Group): void {
  let hasSkinnedMesh = false;

  characterScene.traverse((node) => {
    if ("isSkinnedMesh" in node && node.isSkinnedMesh === true) {
      hasSkinnedMesh = true;
    }
  });

  if (!hasSkinnedMesh) {
    throw new Error("Metaverse character proof slice requires at least one skinned mesh.");
  }
}

function synthesizeHumanoidV2PalmSockets(
  characterScene: Group,
  showSocketDebug: boolean,
  heldWeaponSolveDirectionEpsilon: number,
  nodeResolvers: Pick<
    MetaverseCharacterProofRuntimeNodeResolvers,
    "findBoneNode" | "findSocketNode" | "upsertSyntheticSocketNode"
  >
): void {
  const palmSocketDescriptors = [
    {
      gripSocketName: "grip_l_socket",
      knuckleBaseBoneNames: [
        "index_01_l",
        "middle_01_l",
        "ring_01_l",
        "pinky_01_l"
      ] as const,
      parentBoneName: "hand_l",
      sourceSocketName: "hand_l_socket",
      synthesizedSocketName: "palm_l_socket",
      thumbBaseBoneName: "thumb_01_l"
    },
    {
      gripSocketName: "grip_r_socket",
      knuckleBaseBoneNames: [
        "index_01_r",
        "middle_01_r",
        "ring_01_r",
        "pinky_01_r"
      ] as const,
      parentBoneName: "hand_r",
      sourceSocketName: "hand_r_socket",
      synthesizedSocketName: "palm_r_socket",
      thumbBaseBoneName: "thumb_01_r"
    }
  ] as const;

  for (const palmSocketDescriptor of palmSocketDescriptors) {
    const parentBone = nodeResolvers.findBoneNode(
      characterScene,
      palmSocketDescriptor.parentBoneName,
      "Metaverse humanoid_v2 palm socket synthesis"
    );
    const sourceSocketNode = nodeResolvers.findSocketNode(
      characterScene,
      palmSocketDescriptor.sourceSocketName
    );
    const knuckleBaseCentroid = new Vector3();

    for (const knuckleBaseBoneName of palmSocketDescriptor.knuckleBaseBoneNames) {
      const knuckleBaseBone = nodeResolvers.findBoneNode(
        characterScene,
        knuckleBaseBoneName,
        "Metaverse humanoid_v2 palm socket synthesis"
      );

      knuckleBaseCentroid.add(
        parentBone.worldToLocal(knuckleBaseBone.getWorldPosition(new Vector3()))
      );
    }

    knuckleBaseCentroid.multiplyScalar(
      1 / palmSocketDescriptor.knuckleBaseBoneNames.length
    );
    const thumbBaseLocalPosition = parentBone.worldToLocal(
      nodeResolvers
        .findBoneNode(
          characterScene,
          palmSocketDescriptor.thumbBaseBoneName,
          "Metaverse humanoid_v2 palm socket synthesis"
        )
        .getWorldPosition(new Vector3())
    );
    const palmForwardAxis = knuckleBaseCentroid.clone().normalize();

    if (palmForwardAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      throw new Error(
        `Metaverse humanoid_v2 palm socket synthesis requires ${palmSocketDescriptor.synthesizedSocketName} knuckle bases to stay offset from the hand root.`
      );
    }

    const palmUpAxis = thumbBaseLocalPosition.clone().sub(knuckleBaseCentroid);

    palmUpAxis.addScaledVector(
      palmForwardAxis,
      -palmUpAxis.dot(palmForwardAxis)
    );

    if (palmUpAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      throw new Error(
        `Metaverse humanoid_v2 palm socket synthesis requires ${palmSocketDescriptor.synthesizedSocketName} thumb basis to stay non-collinear with the knuckle line.`
      );
    }

    palmUpAxis.normalize();

    const palmSideAxis = palmForwardAxis.clone().cross(palmUpAxis);

    if (palmSideAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      throw new Error(
        `Metaverse humanoid_v2 palm socket synthesis requires ${palmSocketDescriptor.synthesizedSocketName} side basis to stay non-degenerate.`
      );
    }

    palmSideAxis.normalize();
    const correctedPalmUpAxis = palmSideAxis
      .clone()
      .cross(palmForwardAxis)
      .normalize();
    const palmLocalPosition = sourceSocketNode.position
      .clone()
      .lerp(knuckleBaseCentroid, humanoidV2PalmSocketBlendAlpha);
    const gripLocalPosition = sourceSocketNode.position
      .clone()
      .lerp(knuckleBaseCentroid, humanoidV2GripSocketBlendAlpha);
    const synthesizedHandQuaternion = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(
        palmForwardAxis,
        correctedPalmUpAxis,
        palmSideAxis
      )
    );

    nodeResolvers.upsertSyntheticSocketNode(
      characterScene,
      parentBone,
      palmSocketDescriptor.synthesizedSocketName,
      palmLocalPosition,
      showSocketDebug,
      synthesizedHandQuaternion
    );
    nodeResolvers.upsertSyntheticSocketNode(
      characterScene,
      parentBone,
      palmSocketDescriptor.gripSocketName,
      gripLocalPosition,
      showSocketDebug,
      synthesizedHandQuaternion
    );
  }
}

function synthesizeHumanoidV2BackSocket(
  characterScene: Group,
  showSocketDebug: boolean,
  nodeResolvers: Pick<
    MetaverseCharacterProofRuntimeNodeResolvers,
    "findBoneNode" | "upsertSyntheticSocketNode"
  >
): void {
  const spineBone = nodeResolvers.findBoneNode(
    characterScene,
    "spine_03",
    "Metaverse humanoid_v2 back socket synthesis"
  );
  const clavicleLBone = nodeResolvers.findBoneNode(
    characterScene,
    "clavicle_l",
    "Metaverse humanoid_v2 back socket synthesis"
  );
  const clavicleRBone = nodeResolvers.findBoneNode(
    characterScene,
    "clavicle_r",
    "Metaverse humanoid_v2 back socket synthesis"
  );
  const clavicleMidpointLocal = spineBone.worldToLocal(
    clavicleLBone
      .getWorldPosition(new Vector3())
      .add(clavicleRBone.getWorldPosition(new Vector3()))
      .multiplyScalar(0.5)
  );

  clavicleMidpointLocal.x = 0;
  clavicleMidpointLocal.y = Math.max(
    0.08,
    clavicleMidpointLocal.y - humanoidV2BackSocketLowerOffsetMeters
  );
  clavicleMidpointLocal.z =
    -Math.max(0.06, Math.abs(clavicleMidpointLocal.z) * humanoidV2BackSocketRearwardScale);

  nodeResolvers.upsertSyntheticSocketNode(
    characterScene,
    spineBone,
    "back_socket",
    clavicleMidpointLocal,
    showSocketDebug
  );
}

function synthesizeRuntimeSocketNodes(
  characterScene: Group,
  showSocketDebug: boolean,
  heldWeaponSolveDirectionEpsilon: number,
  nodeResolvers: Pick<
    MetaverseCharacterProofRuntimeNodeResolvers,
    "findBoneNode" | "findSocketNode" | "upsertSyntheticSocketNode"
  >
): void {
  characterScene.updateMatrixWorld(true);

  synthesizeHumanoidV2PalmSockets(
    characterScene,
    showSocketDebug,
    heldWeaponSolveDirectionEpsilon,
    nodeResolvers
  );
  synthesizeHumanoidV2BackSocket(
    characterScene,
    showSocketDebug,
    nodeResolvers
  );

  characterScene.updateMatrixWorld(true);
}

function cloneCharacterScene(scene: Group): Group {
  return cloneSkinnedGroup(scene) as Group;
}

function validateCharacterScale(
  characterScene: Group,
  label: string,
  warn: (message: string) => void
): void {
  const bounds = new Box3().setFromObject(characterScene);
  const size = bounds.getSize(new Vector3());

  if (size.y <= 0) {
    throw new Error(`Metaverse character ${label} produced an empty render bounds box.`);
  }

  if (
    size.y < metaverseCharacterScaleBoundsMeters.min ||
    size.y > metaverseCharacterScaleBoundsMeters.max
  ) {
    warn(
      `Metaverse character ${label} rendered at ${size.y.toFixed(2)}m tall; expected ${metaverseCharacterScaleBoundsMeters.min.toFixed(2)}-${metaverseCharacterScaleBoundsMeters.max.toFixed(2)}m.`
    );
  }
}

function configureCharacterActionLoopMode(
  action: AnimationAction,
  loopMode: MetaverseCharacterAnimationClipLoopMode
): void {
  if (loopMode === "once") {
    action.clampWhenFinished = true;
    action.setLoop(LoopOnce, 1);
    return;
  }

  action.clampWhenFinished = false;
  action.setLoop(LoopRepeat, Number.POSITIVE_INFINITY);
}

function createCharacterProofRuntime<THeldWeaponPoseRuntime>(
  characterId: string,
  skeletonId: MetaverseCharacterProofConfig["skeletonId"],
  characterScene: Group,
  clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >,
  clipLoopModesByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    MetaverseCharacterAnimationClipLoopMode
  >,
  humanoidV2PistolPoseClipsByPoseId:
    | ReadonlyMap<MetaverseHumanoidV2PistolPoseId, AnimationClip>
    | null,
  dependencies: {
    readonly createHeldWeaponPoseRuntime: (
      characterScene: Group
    ) => THeldWeaponPoseRuntime | null;
  } & Pick<
    MetaverseCharacterProofRuntimeNodeResolvers,
    "findOptionalNode" | "findSocketNode"
  >
): LoadedMetaverseCharacterProofRuntime<THeldWeaponPoseRuntime> {
  const anchorGroup = new Group();
  const firstPersonHeadAnchorNodes = Object.freeze(
    [
      dependencies.findSocketNode(characterScene, "head_socket"),
      dependencies.findOptionalNode(characterScene, "head"),
      dependencies.findOptionalNode(characterScene, "head_leaf"),
      dependencies.findOptionalNode(characterScene, "neck_01")
    ].filter((node): node is Object3D => node !== null)
  );
  const seatSocketNode = dependencies.findSocketNode(characterScene, "seat_socket");
  const mixer = new AnimationMixer(characterScene);
  const actionsByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >();

  anchorGroup.name = `metaverse_character/${characterId}`;
  anchorGroup.position.set(
    metaverseCharacterAnchorPosition.x,
    metaverseCharacterAnchorPosition.y,
    metaverseCharacterAnchorPosition.z
  );
  anchorGroup.rotation.y = metaverseCharacterProofAnchorRotationYRadians;
  anchorGroup.add(characterScene);
  anchorGroup.updateMatrixWorld(true);

  for (const [vocabulary, clip] of clipsByVocabulary) {
    const action = mixer.clipAction(clip);

    configureCharacterActionLoopMode(
      action,
      clipLoopModesByVocabulary.get(vocabulary) ?? "repeat"
    );
    actionsByVocabulary.set(vocabulary, action);
  }

  const idleAction = actionsByVocabulary.get("idle");
  const humanoidV2PistolLowerBodyActionsByVocabulary =
    humanoidV2PistolPoseClipsByPoseId !== null
      ? createHumanoidV2PistolLowerBodyActionsByVocabulary(
          mixer,
          clipsByVocabulary
        )
      : null;

  if (idleAction === undefined) {
    throw new Error(
      `Metaverse character ${characterId} requires an idle animation vocabulary.`
    );
  }

  idleAction.play();

  return {
    activeAnimationActionSetId: "full-body",
    activeAnimationCycleId: 0,
    activeAnimationVocabulary: "idle",
    actionsByVocabulary,
    anchorGroup,
    characterId,
    clipsByVocabulary,
    clipLoopModesByVocabulary,
    firstPersonHeadAnchorNodes,
    heldWeaponPoseRuntime: dependencies.createHeldWeaponPoseRuntime(characterScene),
    humanoidV2PistolLowerBodyActionsByVocabulary,
    humanoidV2PistolPoseRuntime:
      humanoidV2PistolPoseClipsByPoseId !== null
        ? createHumanoidV2PistolPoseRuntime(
            mixer,
            humanoidV2PistolPoseClipsByPoseId
          )
        : null,
    mixer,
    scene: characterScene,
    seatSocketNode,
    skeletonId
  };
}

export function cloneMetaverseCharacterProofRuntime<THeldWeaponPoseRuntime>(
  sourceRuntime: LoadedMetaverseCharacterProofRuntime<THeldWeaponPoseRuntime>,
  playerId: string,
  dependencies: {
    readonly createHeldWeaponPoseRuntime: (
      characterScene: Group
    ) => THeldWeaponPoseRuntime | null;
  } & Pick<
    MetaverseCharacterProofRuntimeNodeResolvers,
    "findOptionalNode" | "findSocketNode"
  >
): LoadedMetaverseCharacterProofRuntime<THeldWeaponPoseRuntime> {
  const clonedRuntime = createCharacterProofRuntime(
    sourceRuntime.characterId,
    sourceRuntime.skeletonId,
    cloneCharacterScene(sourceRuntime.scene),
    sourceRuntime.clipsByVocabulary,
    sourceRuntime.clipLoopModesByVocabulary,
    sourceRuntime.humanoidV2PistolPoseRuntime?.clipsByPoseId ?? null,
    dependencies
  );

  clonedRuntime.anchorGroup.name = `metaverse_character/${sourceRuntime.characterId}/${playerId}`;

  return clonedRuntime;
}

export async function loadMetaverseCharacterProofRuntime<
  THeldWeaponPoseRuntime
>(
  characterProofConfig: MetaverseCharacterProofConfig,
  dependencies: {
    readonly createHeldWeaponPoseRuntime: (
      characterScene: Group
    ) => THeldWeaponPoseRuntime | null;
    readonly createSceneAssetLoader: () => SceneAssetLoaderLike;
    readonly heldWeaponSolveDirectionEpsilon: number;
    readonly showSocketDebug: boolean;
    readonly warn: (message: string) => void;
  } & MetaverseCharacterProofRuntimeNodeResolvers
): Promise<LoadedMetaverseCharacterProofRuntime<THeldWeaponPoseRuntime>> {
  const sceneAssetLoader = dependencies.createSceneAssetLoader();
  const characterAsset = await sceneAssetLoader.loadAsync(characterProofConfig.modelPath);
  const animationAssetsByPath = new Map<string, LoadedSceneAssetLike>([
    [characterProofConfig.modelPath, characterAsset]
  ]);

  ensureSkinnedMesh(characterAsset.scene);

  for (const socketName of characterProofConfig.socketNames) {
    const socketNode = dependencies.findSocketNode(characterAsset.scene, socketName);

    if (dependencies.showSocketDebug) {
      dependencies.ensureSocketDebugMarker(socketNode, socketName);
    }
  }

  synthesizeRuntimeSocketNodes(
    characterAsset.scene,
    dependencies.showSocketDebug,
    dependencies.heldWeaponSolveDirectionEpsilon,
    dependencies
  );

  validateCharacterScale(
    characterAsset.scene,
    characterProofConfig.label,
    dependencies.warn
  );

  const clipsByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >();
  const clipLoopModesByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    MetaverseCharacterAnimationClipLoopMode
  >();

  for (const animationClipConfig of characterProofConfig.animationClips) {
    let animationAsset = animationAssetsByPath.get(animationClipConfig.sourcePath);

    if (animationAsset === undefined) {
      animationAsset = await sceneAssetLoader.loadAsync(animationClipConfig.sourcePath);
      animationAssetsByPath.set(animationClipConfig.sourcePath, animationAsset);
    }

    const clip = animationAsset.animations.find(
      (animation) => animation.name === animationClipConfig.clipName
    );

    if (clip === undefined) {
      throw new Error(
        `Metaverse character ${characterProofConfig.characterId} is missing animation ${animationClipConfig.clipName}.`
      );
    }

    if (clipsByVocabulary.has(animationClipConfig.vocabulary)) {
      throw new Error(
        `Metaverse character ${characterProofConfig.characterId} has duplicate animation vocabulary ${animationClipConfig.vocabulary}.`
      );
    }

    clipsByVocabulary.set(animationClipConfig.vocabulary, clip);
    clipLoopModesByVocabulary.set(
      animationClipConfig.vocabulary,
      animationClipConfig.loopMode ?? "repeat"
    );
  }

  let humanoidV2PistolPoseClipsByPoseId:
    | ReadonlyMap<MetaverseHumanoidV2PistolPoseId, AnimationClip>
    | null = null;

  if (
    characterProofConfig.humanoidV2PistolPoseProofConfig !== null &&
    characterProofConfig.humanoidV2PistolPoseProofConfig !== undefined
  ) {
    const pistolPoseProofConfig = characterProofConfig.humanoidV2PistolPoseProofConfig;

    try {
      let pistolAnimationAsset = animationAssetsByPath.get(
        pistolPoseProofConfig.sourcePath
      );

      if (pistolAnimationAsset === undefined) {
        pistolAnimationAsset = await sceneAssetLoader.loadAsync(
          pistolPoseProofConfig.sourcePath
        );
        animationAssetsByPath.set(
          pistolPoseProofConfig.sourcePath,
          pistolAnimationAsset
        );
      }

      const clipsByPoseId = new Map<
        MetaverseHumanoidV2PistolPoseId,
        AnimationClip
      >();
      let missingClipName: string | null = null;

      for (const poseId of metaverseHumanoidV2PistolPoseIds) {
        const clipName = pistolPoseProofConfig.clipNamesByPoseId[poseId];
        const clip = pistolAnimationAsset.animations.find(
          (animation) => animation.name === clipName
        );

        if (clip === undefined) {
          missingClipName = clipName;
          break;
        }

        clipsByPoseId.set(
          poseId,
          createHumanoidV2UpperBodyPistolPoseClip(clip)
        );
      }

      if (missingClipName === null) {
        humanoidV2PistolPoseClipsByPoseId = clipsByPoseId;
      } else {
        dependencies.warn(
          `Metaverse humanoid_v2 pistol pose overlay disabled because ${pistolPoseProofConfig.sourcePath} is missing ${missingClipName}.`
        );
      }
    } catch {
      dependencies.warn(
        `Metaverse humanoid_v2 pistol pose overlay disabled because ${pistolPoseProofConfig.sourcePath} could not load.`
      );
    }
  }

  return createCharacterProofRuntime(
    characterProofConfig.characterId,
    characterProofConfig.skeletonId,
    characterAsset.scene,
    clipsByVocabulary,
    clipLoopModesByVocabulary,
    humanoidV2PistolPoseClipsByPoseId,
    dependencies
  );
}
