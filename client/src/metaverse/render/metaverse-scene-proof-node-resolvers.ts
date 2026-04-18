import {
  Bone,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Object3D
} from "three/webgpu";
import { color } from "three/tsl";

import type { MetaverseAttachmentRuntimeNodeResolvers } from "./attachments/metaverse-scene-attachment-runtime";
import type { MetaverseCharacterProofRuntimeNodeResolvers } from "./characters/metaverse-scene-character-proof-runtime";
import type { MetaverseHeldWeaponPoseRuntimeNodeResolvers } from "./characters/metaverse-scene-held-weapon-pose";

const socketDebugMarkerColors = {
  back_socket: [1, 0.72, 0.26],
  grip_l_socket: [0.18, 0.82, 1],
  grip_r_socket: [1, 0.52, 0.4],
  hand_l_socket: [0.28, 0.72, 1],
  hand_r_socket: [1, 0.42, 0.34],
  head_socket: [1, 0.92, 0.34],
  hip_socket: [0.45, 1, 0.56],
  palm_l_socket: [0.28, 0.9, 1],
  palm_r_socket: [1, 0.6, 0.48],
  seat_socket: [0.62, 0.96, 0.96]
} as const satisfies Readonly<Record<string, readonly [number, number, number]>>;

function createSocketDebugMarker(socketName: string): Mesh {
  const material = new MeshBasicNodeMaterial();
  const markerColor =
    socketDebugMarkerColors[socketName as keyof typeof socketDebugMarkerColors];

  if (markerColor === undefined) {
    throw new Error(
      `Metaverse character proof slice is missing a debug color for ${socketName}.`
    );
  }

  material.colorNode = color(...markerColor);
  material.depthWrite = false;

  const marker = new Mesh(new SphereGeometry(0.08, 12, 10), material);

  marker.name = `socket_debug/${socketName}`;

  return marker;
}

export function ensureMetaverseSceneSocketDebugMarker(
  socketNode: Object3D,
  socketName: string
): void {
  if (socketNode.getObjectByName(`socket_debug/${socketName}`) !== undefined) {
    return;
  }

  socketNode.add(createSocketDebugMarker(socketName));
}

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
  showSocketDebug: boolean,
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

  if (showSocketDebug) {
    ensureMetaverseSceneSocketDebugMarker(socketNode, socketName);
  }

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
    ensureSocketDebugMarker: ensureMetaverseSceneSocketDebugMarker,
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
