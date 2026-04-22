import {
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";

import type { MetaverseAttachmentProofConfig } from "../../types/metaverse-runtime";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";

interface SceneAssetLoaderLike {
  loadAsync(path: string): Promise<{
    readonly scene: Group;
  }>;
}

interface CharacterRuntimeLike {
  readonly scene: Group;
}

export interface MetaverseAttachmentMountRuntime {
  readonly localQuaternion: Quaternion;
  readonly localPosition: Vector3;
  readonly socketName: MetaverseAttachmentProofConfig["heldMount"]["socketName"];
}

export interface MetaverseAttachmentProofRuntime {
  activeMountKind: "held" | "mounted-holster" | null;
  readonly attachmentRoot: Group;
  readonly heldGripLocalAimQuaternion: Quaternion;
  readonly heldGripToAdsCameraAnchorLocalPosition: Vector3 | null;
  readonly heldGripToForwardReferenceLocalPosition: Vector3;
  readonly heldGripToTriggerMarkerLocalPosition: Vector3 | null;
  readonly heldGripSocketNode: Object3D;
  readonly heldMount: MetaverseAttachmentMountRuntime;
  readonly heldTriggerMarkerNode: Object3D | null;
  implicitOffHandGripLocalPosition: Vector3 | null;
  implicitOffHandGripLocalQuaternion: Quaternion | null;
  readonly mountedHolsterMount: MetaverseAttachmentMountRuntime | null;
  readonly offHandSupportNode: Object3D | null;
  readonly presentationGroup: Group;
}

export interface MetaverseAttachmentRuntimeNodeResolvers {
  readonly findGroupNode: (scene: Group, nodeName: string, label: string) => Group;
  readonly findNamedNode: (
    scene: Group,
    nodeName: string,
    label: string
  ) => Object3D;
  readonly findSocketNode: (
    characterScene: Group,
    socketName: string
  ) => Object3D;
}

function resolveHeldForwardReferenceNode(
  mountConfig: MetaverseAttachmentProofConfig["heldMount"],
  attachmentScene: Group,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findNamedNode">
): Object3D {
  if (
    mountConfig.forwardReferenceNodeName !== null &&
    mountConfig.forwardReferenceNodeName !== undefined
  ) {
    return nodeResolvers.findNamedNode(
      attachmentScene,
      mountConfig.forwardReferenceNodeName,
      "Metaverse attachment forward reference"
    );
  }

  const attachmentSocketNode = nodeResolvers.findNamedNode(
    attachmentScene,
    mountConfig.attachmentSocketNodeName,
    "Metaverse attachment mount"
  );
  const forwardReferenceNode = new Group();

  forwardReferenceNode.name = "metaverse_attachment_forward_reference";
  forwardReferenceNode.position.set(1, 0, 0);
  attachmentSocketNode.add(forwardReferenceNode);

  return forwardReferenceNode;
}

function resolveOptionalAttachmentNode(
  nodeName: string | null | undefined,
  attachmentScene: Group,
  label: string,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findNamedNode">
): Object3D | null {
  if (nodeName === null || nodeName === undefined) {
    return null;
  }

  return nodeResolvers.findNamedNode(attachmentScene, nodeName, label);
}

function resolveAttachmentNodeLocalPositionFromGrip(
  heldGripSocketNode: Object3D,
  attachmentNode: Object3D
): Vector3 {
  return heldGripSocketNode
    .worldToLocal(attachmentNode.getWorldPosition(new Vector3()))
    .clone();
}

function resolveHeldGripLocalAimQuaternion(
  heldGripSocketNode: Object3D,
  heldForwardReferenceNode: Object3D,
  heldUpReferenceNode: Object3D | null,
  heldWeaponSolveDirectionEpsilon: number
): {
  readonly gripLocalAimQuaternion: Quaternion;
  readonly gripToForwardReferenceLocalPosition: Vector3;
} {
  const gripToForwardReferenceLocalPosition =
    resolveAttachmentNodeLocalPositionFromGrip(
      heldGripSocketNode,
      heldForwardReferenceNode
    );

  if (
    gripToForwardReferenceLocalPosition.lengthSq() <=
    heldWeaponSolveDirectionEpsilon
  ) {
    throw new Error(
      "Metaverse attachment held forward reference must stay offset from the grip socket."
    );
  }

  const localForwardDirection = gripToForwardReferenceLocalPosition.clone().normalize();
  const localUpDirection =
    heldUpReferenceNode === null
      ? new Vector3(0, 1, 0).applyQuaternion(
          heldGripSocketNode
            .getWorldQuaternion(new Quaternion())
            .invert()
            .multiply(heldForwardReferenceNode.getWorldQuaternion(new Quaternion()))
        )
      : resolveAttachmentNodeLocalPositionFromGrip(
          heldGripSocketNode,
          heldUpReferenceNode
        );

  localUpDirection.addScaledVector(
    localForwardDirection,
    -localUpDirection.dot(localForwardDirection)
  );

  if (localUpDirection.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    localUpDirection.set(0, 0, 1);
    localUpDirection.addScaledVector(
      localForwardDirection,
      -localUpDirection.dot(localForwardDirection)
    );
  }

  if (localUpDirection.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    throw new Error(
      "Metaverse attachment held up reference must define a stable basis against the grip socket."
    );
  }

  localUpDirection.normalize();
  const localAcrossDirection = localForwardDirection.clone().cross(localUpDirection);

  if (localAcrossDirection.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    throw new Error(
      "Metaverse attachment held aim basis must produce a valid across direction."
    );
  }

  localAcrossDirection.normalize();
  localUpDirection.copy(localAcrossDirection).cross(localForwardDirection).normalize();

  return {
    gripLocalAimQuaternion: new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(
        localForwardDirection,
        localUpDirection,
        localAcrossDirection
      )
    ),
    gripToForwardReferenceLocalPosition
  };
}

function resolveAttachmentSocketLocalTransform(
  attachmentSocketNodeName: MetaverseAttachmentProofConfig["heldMount"]["attachmentSocketNodeName"],
  attachmentScene: Group,
  heldWeaponSolveDirectionEpsilon: number,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findNamedNode">
): {
  readonly localPosition: Vector3;
  readonly localQuaternion: Quaternion;
} {
  attachmentScene.updateMatrixWorld(true);

  const attachmentSocketNode = nodeResolvers.findNamedNode(
    attachmentScene,
    attachmentSocketNodeName,
    "Metaverse attachment mount"
  );
  const sceneWorldQuaternion = attachmentScene.getWorldQuaternion(new Quaternion());
  const localPosition = attachmentScene.worldToLocal(
    attachmentSocketNode.getWorldPosition(new Vector3())
  );
  const localQuaternion = sceneWorldQuaternion
    .invert()
    .multiply(attachmentSocketNode.getWorldQuaternion(new Quaternion()))
    .normalize();

  if (localPosition.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    throw new Error(
      `Metaverse attachment mount requires ${attachmentSocketNodeName} to stay offset from the attachment root.`
    );
  }

  return {
    localPosition,
    localQuaternion
  };
}

export function createAttachmentMountRuntime(
  mountConfig: MetaverseAttachmentProofConfig["heldMount"],
  attachmentScene: Group,
  heldWeaponSolveDirectionEpsilon: number,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findNamedNode">
): MetaverseAttachmentMountRuntime {
  const attachmentSocketTransform = resolveAttachmentSocketLocalTransform(
    mountConfig.attachmentSocketNodeName,
    attachmentScene,
    heldWeaponSolveDirectionEpsilon,
    nodeResolvers
  );
  const localQuaternion = attachmentSocketTransform.localQuaternion.clone().invert();

  return {
    localPosition: attachmentSocketTransform.localPosition
      .clone()
      .applyQuaternion(localQuaternion)
      .multiplyScalar(-1),
    localQuaternion,
    socketName: mountConfig.socketName
  };
}

export function applyAttachmentMountRuntime<
  TCharacterRuntime extends CharacterRuntimeLike
>(
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  characterProofRuntime: TCharacterRuntime,
  mountRuntime: MetaverseAttachmentMountRuntime,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findSocketNode">
): void {
  const socketNode = nodeResolvers.findSocketNode(
    characterProofRuntime.scene,
    mountRuntime.socketName
  );

  if (attachmentRuntime.attachmentRoot.parent !== socketNode) {
    attachmentRuntime.attachmentRoot.parent?.remove(attachmentRuntime.attachmentRoot);
    socketNode.add(attachmentRuntime.attachmentRoot);
  }

  attachmentRuntime.attachmentRoot.position.copy(mountRuntime.localPosition);
  attachmentRuntime.attachmentRoot.quaternion.copy(mountRuntime.localQuaternion);
  attachmentRuntime.presentationGroup.position.set(0, 0, 0);
  attachmentRuntime.attachmentRoot.updateMatrixWorld(true);
}

export function syncAttachmentProofRuntimeMount<
  TCharacterRuntime extends CharacterRuntimeLike
>(
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  characterProofRuntime: TCharacterRuntime,
  mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findSocketNode">
): void {
  const nextMountKind =
    mountedOccupancyPresentationState?.holsterHeldAttachment === true &&
    attachmentRuntime.mountedHolsterMount !== null
      ? "mounted-holster"
      : "held";

  if (attachmentRuntime.activeMountKind === nextMountKind) {
    return;
  }

  applyAttachmentMountRuntime(
    attachmentRuntime,
    characterProofRuntime,
    nextMountKind === "mounted-holster"
      ? attachmentRuntime.mountedHolsterMount ?? attachmentRuntime.heldMount
      : attachmentRuntime.heldMount,
    nodeResolvers
  );
  attachmentRuntime.activeMountKind = nextMountKind;
}

export function cloneMetaverseAttachmentMountRuntime(
  sourceRuntime: MetaverseAttachmentMountRuntime
): MetaverseAttachmentMountRuntime {
  return {
    localPosition: sourceRuntime.localPosition.clone(),
    localQuaternion: sourceRuntime.localQuaternion.clone(),
    socketName: sourceRuntime.socketName
  };
}

export function cloneMetaverseAttachmentProofRuntime<
  TCharacterRuntime extends CharacterRuntimeLike
>(
  sourceRuntime: MetaverseAttachmentProofRuntime,
  characterProofRuntime: TCharacterRuntime,
  nodeResolvers: Pick<
    MetaverseAttachmentRuntimeNodeResolvers,
    "findGroupNode" | "findNamedNode"
  >
): MetaverseAttachmentProofRuntime {
  const cloneLabel = "Metaverse attachment proof clone";

  return {
    activeMountKind: null,
    attachmentRoot: nodeResolvers.findGroupNode(
      characterProofRuntime.scene,
      sourceRuntime.attachmentRoot.name,
      cloneLabel
    ),
    heldGripLocalAimQuaternion: sourceRuntime.heldGripLocalAimQuaternion.clone(),
    heldGripToAdsCameraAnchorLocalPosition:
      sourceRuntime.heldGripToAdsCameraAnchorLocalPosition?.clone() ?? null,
    heldGripToForwardReferenceLocalPosition:
      sourceRuntime.heldGripToForwardReferenceLocalPosition.clone(),
    heldGripToTriggerMarkerLocalPosition:
      sourceRuntime.heldGripToTriggerMarkerLocalPosition?.clone() ?? null,
    heldGripSocketNode: nodeResolvers.findNamedNode(
      characterProofRuntime.scene,
      sourceRuntime.heldGripSocketNode.name,
      cloneLabel
    ),
    heldMount: cloneMetaverseAttachmentMountRuntime(sourceRuntime.heldMount),
    heldTriggerMarkerNode:
      sourceRuntime.heldTriggerMarkerNode === null
        ? null
        : nodeResolvers.findNamedNode(
            characterProofRuntime.scene,
            sourceRuntime.heldTriggerMarkerNode.name,
            cloneLabel
          ),
    implicitOffHandGripLocalPosition: null,
    implicitOffHandGripLocalQuaternion: null,
    mountedHolsterMount:
      sourceRuntime.mountedHolsterMount === null
        ? null
        : cloneMetaverseAttachmentMountRuntime(sourceRuntime.mountedHolsterMount),
    offHandSupportNode:
      sourceRuntime.offHandSupportNode === null
        ? null
        : nodeResolvers.findNamedNode(
            characterProofRuntime.scene,
            sourceRuntime.offHandSupportNode.name,
            cloneLabel
          ),
    presentationGroup: nodeResolvers.findGroupNode(
      characterProofRuntime.scene,
      sourceRuntime.presentationGroup.name,
      cloneLabel
    )
  };
}

export async function loadMetaverseAttachmentProofRuntime<
  TCharacterRuntime extends CharacterRuntimeLike
>(
  attachmentProofConfig: MetaverseAttachmentProofConfig,
  characterProofRuntime: TCharacterRuntime,
  dependencies: {
    readonly createSceneAssetLoader: () => SceneAssetLoaderLike;
    readonly heldWeaponSolveDirectionEpsilon: number;
  } & MetaverseAttachmentRuntimeNodeResolvers
): Promise<MetaverseAttachmentProofRuntime> {
  const sceneAssetLoader = dependencies.createSceneAssetLoader();
  const attachmentAsset = await sceneAssetLoader.loadAsync(
    attachmentProofConfig.modelPath
  );

  for (const moduleProofConfig of attachmentProofConfig.modules) {
    const moduleSocketNode = dependencies.findNamedNode(
      attachmentAsset.scene,
      moduleProofConfig.socketNodeName,
      "Metaverse attachment module socket"
    );
    const moduleAsset = await sceneAssetLoader.loadAsync(moduleProofConfig.modelPath);

    moduleAsset.scene.name = [
      "metaverse_attachment_module",
      attachmentProofConfig.attachmentId,
      moduleProofConfig.moduleId
    ].join("/");
    moduleAsset.scene.position.set(0, 0, 0);
    moduleAsset.scene.quaternion.identity();
    moduleSocketNode.add(moduleAsset.scene);
  }

  const attachmentRoot = new Group();
  const attachmentPresentationGroup = new Group();
  const heldMount = createAttachmentMountRuntime(
    attachmentProofConfig.heldMount,
    attachmentAsset.scene,
    dependencies.heldWeaponSolveDirectionEpsilon,
    dependencies
  );
  const heldGripSocketNode = dependencies.findNamedNode(
    attachmentAsset.scene,
    attachmentProofConfig.heldMount.attachmentSocketNodeName,
    "Metaverse attachment mount"
  );
  const heldForwardReferenceNode = resolveHeldForwardReferenceNode(
    attachmentProofConfig.heldMount,
    attachmentAsset.scene,
    dependencies
  );
  const heldUpReferenceNode = resolveOptionalAttachmentNode(
    attachmentProofConfig.heldMount.upReferenceNodeName,
    attachmentAsset.scene,
    "Metaverse attachment up reference",
    dependencies
  );
  const heldAdsCameraAnchorNode = resolveOptionalAttachmentNode(
    attachmentProofConfig.heldMount.adsCameraAnchorNodeName,
    attachmentAsset.scene,
    "Metaverse attachment ADS camera anchor",
    dependencies
  );
  attachmentAsset.scene.updateMatrixWorld(true);
  const {
    gripLocalAimQuaternion: heldGripLocalAimQuaternion,
    gripToForwardReferenceLocalPosition: heldGripToForwardReferenceLocalPosition
  } = resolveHeldGripLocalAimQuaternion(
    heldGripSocketNode,
    heldForwardReferenceNode,
    heldUpReferenceNode,
    dependencies.heldWeaponSolveDirectionEpsilon
  );
  const heldGripToAdsCameraAnchorLocalPosition =
    heldAdsCameraAnchorNode === null
      ? null
      : resolveAttachmentNodeLocalPositionFromGrip(
          heldGripSocketNode,
          heldAdsCameraAnchorNode
        );
  const mountedHolsterMount =
    attachmentProofConfig.mountedHolsterMount === null
      ? null
      : createAttachmentMountRuntime(
          attachmentProofConfig.mountedHolsterMount,
          attachmentAsset.scene,
          dependencies.heldWeaponSolveDirectionEpsilon,
          dependencies
        );
  const heldTriggerMarkerNode =
    attachmentProofConfig.heldMount.triggerMarkerNodeName === null ||
    attachmentProofConfig.heldMount.triggerMarkerNodeName === undefined
      ? null
      : dependencies.findNamedNode(
          attachmentAsset.scene,
          attachmentProofConfig.heldMount.triggerMarkerNodeName,
          "Metaverse attachment trigger marker"
        );
  const heldGripToTriggerMarkerLocalPosition =
    heldTriggerMarkerNode === null
      ? null
      : resolveAttachmentNodeLocalPositionFromGrip(
          heldGripSocketNode,
          heldTriggerMarkerNode
        );
  const heldOffHandSupportPointId =
    attachmentProofConfig.heldMount.offHandSupportPointId ?? null;
  let offHandSupportNode: Object3D | null = null;

  attachmentRoot.name = `metaverse_attachment/${attachmentProofConfig.attachmentId}`;
  attachmentPresentationGroup.name = `${attachmentRoot.name}/presentation`;
  attachmentPresentationGroup.add(attachmentAsset.scene);
  for (const supportPoint of attachmentProofConfig.supportPoints ?? []) {
    const supportPointNode =
      supportPoint.authoringNodeName === null
        ? null
        : dependencies.findNamedNode(
            attachmentAsset.scene,
            supportPoint.authoringNodeName,
            "Metaverse attachment support point"
          );

    if (supportPointNode !== null) {
      if (heldOffHandSupportPointId === supportPoint.supportPointId) {
        offHandSupportNode = supportPointNode;
      }

      continue;
    }

    const supportPointAnchor = new Group();

    supportPointAnchor.name = [
      "metaverse_attachment_support_point",
      attachmentProofConfig.attachmentId,
      supportPoint.supportPointId
    ].join("/");
    supportPointAnchor.position.set(
      supportPoint.localPosition.x,
      supportPoint.localPosition.y,
      supportPoint.localPosition.z
    );
    attachmentPresentationGroup.add(supportPointAnchor);

    if (heldOffHandSupportPointId === supportPoint.supportPointId) {
      offHandSupportNode = supportPointAnchor;
    }
  }
  attachmentRoot.add(attachmentPresentationGroup);

  if (heldOffHandSupportPointId !== null && offHandSupportNode === null) {
    throw new Error(
      `Metaverse attachment ${attachmentProofConfig.attachmentId} is missing held off-hand support point ${heldOffHandSupportPointId}.`
    );
  }

  const attachmentRuntime: MetaverseAttachmentProofRuntime = {
    activeMountKind: null,
    attachmentRoot,
    heldGripLocalAimQuaternion,
    heldGripToAdsCameraAnchorLocalPosition,
    heldGripToForwardReferenceLocalPosition,
    heldGripToTriggerMarkerLocalPosition,
    heldGripSocketNode,
    heldMount,
    heldTriggerMarkerNode,
    implicitOffHandGripLocalPosition: null,
    implicitOffHandGripLocalQuaternion: null,
    mountedHolsterMount,
    offHandSupportNode,
    presentationGroup: attachmentPresentationGroup
  };

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    characterProofRuntime,
    null,
    dependencies
  );

  return attachmentRuntime;
}
