import {
  Bone,
  Group,
  Quaternion,
  Vector3,
  type Object3D
} from "three/webgpu";

import type { MetaverseAttachmentRuntimeNodeResolvers } from "./attachments/metaverse-scene-attachment-runtime";
import type { MetaverseCharacterProofRuntimeNodeResolvers } from "./characters/metaverse-scene-character-proof-runtime";
import type { MetaverseHeldWeaponPoseRuntimeNodeResolvers } from "./characters/metaverse-scene-held-weapon-pose";

function isBoneNode(node: Object3D | undefined): node is Bone {
  return node !== undefined && "isBone" in node && node.isBone === true;
}

export function findMetaverseSceneBoneNode(
  characterScene: Group,
  boneName: string,
  label: string
): Bone {
  const boneNode = characterScene.getObjectByName(boneName);

  if (!isBoneNode(boneNode)) {
    throw new Error(`${label} is missing required bone ${boneName}.`);
  }

  return boneNode;
}

export function findMetaverseSceneSocketNode(
  characterScene: Group,
  socketName: string
): Object3D {
  const socketNode = characterScene.getObjectByName(socketName);

  if (!isBoneNode(socketNode)) {
    throw new Error(`Metaverse character is missing required socket bone: ${socketName}`);
  }

  return socketNode;
}

export function upsertMetaverseSceneSyntheticSocketNode(
  characterScene: Group,
  parentBone: Bone,
  socketName: string,
  localPosition: Vector3,
  localQuaternion?: Quaternion
): Bone {
  const existingSocketNode = characterScene.getObjectByName(socketName);
  const socketNode = (() => {
    if (existingSocketNode === undefined) {
      const syntheticSocketNode = new Bone();

      syntheticSocketNode.name = socketName;
      parentBone.add(syntheticSocketNode);

      return syntheticSocketNode;
    }

    if (!isBoneNode(existingSocketNode)) {
      throw new Error(`Metaverse character socket ${socketName} must stay a bone.`);
    }

    if (existingSocketNode.parent !== parentBone) {
      throw new Error(
        `Metaverse character socket ${socketName} must stay parented to ${parentBone.name}.`
      );
    }

    return existingSocketNode;
  })();

  socketNode.position.copy(localPosition);
  if (localQuaternion === undefined) {
    socketNode.quaternion.identity();
  } else {
    socketNode.quaternion.copy(localQuaternion);
  }
  socketNode.scale.setScalar(1);

  return socketNode;
}

export function findMetaverseSceneNamedNode(
  scene: Group,
  nodeName: string,
  label: string
): Object3D {
  const node = scene.getObjectByName(nodeName);

  if (node === undefined) {
    throw new Error(`${label} is missing required node ${nodeName}.`);
  }

  return node;
}

export function findOptionalMetaverseSceneNode(
  scene: Group,
  nodeName: string
): Object3D | null {
  return scene.getObjectByName(nodeName) ?? null;
}

function isGroupNode(node: Object3D | undefined): node is Group {
  return node !== undefined && "isGroup" in node && node.isGroup === true;
}

export function findMetaverseSceneGroupNode(
  scene: Group,
  nodeName: string,
  label: string
): Group {
  const node = scene.getObjectByName(nodeName);

  if (!isGroupNode(node)) {
    throw new Error(`${label} is missing required group ${nodeName}.`);
  }

  return node;
}

export function createMetaverseAttachmentRuntimeNodeResolvers(): MetaverseAttachmentRuntimeNodeResolvers {
  return {
    findGroupNode: findMetaverseSceneGroupNode,
    findNamedNode: findMetaverseSceneNamedNode,
    findSocketNode: findMetaverseSceneSocketNode
  };
}

export function createMetaverseCharacterProofRuntimeNodeResolvers(): MetaverseCharacterProofRuntimeNodeResolvers {
  return {
    findBoneNode: findMetaverseSceneBoneNode,
    findOptionalNode: findOptionalMetaverseSceneNode,
    findSocketNode: findMetaverseSceneSocketNode,
    upsertSyntheticSocketNode: upsertMetaverseSceneSyntheticSocketNode
  };
}

export function createMetaverseHeldWeaponPoseRuntimeNodeResolvers(): MetaverseHeldWeaponPoseRuntimeNodeResolvers {
  return {
    findBoneNode: findMetaverseSceneBoneNode,
    findSocketNode: findMetaverseSceneSocketNode
  };
}
