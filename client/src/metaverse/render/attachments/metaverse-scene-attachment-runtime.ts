import {
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseAttachmentProofConfig } from "../../types/metaverse-runtime";
import type {
  HeldObjectHoldProfileDescriptor,
  HeldObjectSocketRoleId
} from "@/assets/types/held-object-authoring-manifest";
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
  readonly attachmentSocketRole: HeldObjectSocketRoleId;
  readonly localQuaternion: Quaternion;
  readonly localPosition: Vector3;
  readonly socketName: MetaverseAttachmentProofConfig["heldMount"]["socketName"];
}

export interface MetaverseAttachmentOffHandGripRuntime {
  readonly localPosition: Vector3;
  readonly localQuaternion: Quaternion;
}

export interface MetaverseAttachmentAimBasisOffsetRuntime {
  readonly across: number;
  readonly forward: number;
  readonly up: number;
}

export type MetaverseAttachmentOffHandTargetKind =
  | "none"
  | "support-palm-hint"
  | "secondary-grip";

export interface MetaverseAttachmentProofRuntime {
  activeMountKind: "held" | "mounted-holster" | null;
  readonly attachmentId: string;
  readonly attachmentRoot: Group;
  readonly heldAdsCameraTargetOffset: MetaverseAttachmentAimBasisOffsetRuntime | null;
  readonly heldGripLocalAimQuaternion: Quaternion;
  readonly heldGripToAdsCameraAnchorLocalPosition: Vector3 | null;
  readonly heldGripToForwardReferenceLocalPosition: Vector3;
  readonly heldGripToTriggerMarkerLocalPosition: Vector3 | null;
  readonly heldGripSocketNode: Object3D;
  readonly heldMount: MetaverseAttachmentMountRuntime;
  readonly heldTriggerMarkerNode: Object3D | null;
  readonly holdProfile: HeldObjectHoldProfileDescriptor;
  readonly mountedHolsterMount: MetaverseAttachmentMountRuntime | null;
  readonly offHandGripMount: MetaverseAttachmentOffHandGripRuntime | null;
  readonly offHandGripAnchorNode: Object3D | null;
  readonly offHandTargetKind: MetaverseAttachmentOffHandTargetKind;
  readonly presentationGroup: Group;
  readonly socketNodesByRole: ReadonlyMap<HeldObjectSocketRoleId, Object3D>;
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

function resolveAttachmentSocketNodesByRole(
  holdProfile: HeldObjectHoldProfileDescriptor,
  attachmentScene: Group,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findNamedNode">
): ReadonlyMap<HeldObjectSocketRoleId, Object3D> {
  const socketNodesByRole = new Map<HeldObjectSocketRoleId, Object3D>();

  for (const socket of holdProfile.sockets) {
    if (socketNodesByRole.has(socket.role)) {
      throw new Error(
        `Metaverse attachment ${holdProfile.poseProfileId} has duplicate semantic socket role ${socket.role}.`
      );
    }

    const nodeName = socket.nodeName.trim();

    if (nodeName.length === 0) {
      throw new Error(
        `Metaverse attachment ${holdProfile.poseProfileId} requires semantic socket ${socket.role} to have a node name.`
      );
    }

    socketNodesByRole.set(
      socket.role,
      nodeResolvers.findNamedNode(
        attachmentScene,
        nodeName,
        `Metaverse attachment semantic socket ${socket.role}`
      )
    );
  }

  return socketNodesByRole;
}

function resolveRequiredAttachmentSocketNodeByRole(
  socketNodesByRole: ReadonlyMap<HeldObjectSocketRoleId, Object3D>,
  socketRole: HeldObjectSocketRoleId,
  label: string
): Object3D {
  const socketNode = socketNodesByRole.get(socketRole);

  if (socketNode === undefined) {
    throw new Error(`Metaverse attachment requires semantic socket ${socketRole} for ${label}.`);
  }

  return socketNode;
}

function resolveOptionalAttachmentSocketNodeByRole(
  socketNodesByRole: ReadonlyMap<HeldObjectSocketRoleId, Object3D>,
  socketRole: HeldObjectSocketRoleId | null | undefined
): Object3D | null {
  if (socketRole === null || socketRole === undefined) {
    return null;
  }

  return socketNodesByRole.get(socketRole) ?? null;
}

function resolveAttachmentAdsReferenceRole(
  holdProfile: HeldObjectHoldProfileDescriptor
): HeldObjectSocketRoleId | null {
  if (
    holdProfile.adsPolicy === "none" ||
    holdProfile.adsPolicy === "third_person_hint_only"
  ) {
    return null;
  }

  return holdProfile.adsReferenceRole ?? "camera.ads_anchor";
}

function resolveAttachmentOffHandTargetKind(
  holdProfile: HeldObjectHoldProfileDescriptor,
  offHandGripAnchorNode: Object3D | null
): MetaverseAttachmentOffHandTargetKind {
  switch (holdProfile.offhandPolicy) {
    case "none":
    case "animation_event_controlled":
      return "none";
    case "optional_support_palm":
      return offHandGripAnchorNode === null ? "none" : "support-palm-hint";
    case "optional_secondary_grip":
      return offHandGripAnchorNode === null ? "none" : "secondary-grip";
    case "required_support_grip":
    case "required_two_hand":
      if (offHandGripAnchorNode === null) {
        throw new Error(
          `Metaverse attachment ${holdProfile.poseProfileId} requires an authored off-hand support grip.`
        );
      }

      return "secondary-grip";
  }
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
  heldUpReferenceNode: Object3D,
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
  const localUpDirection = resolveAttachmentNodeLocalPositionFromGrip(
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
  attachmentSocketRole: HeldObjectSocketRoleId,
  attachmentSocketNode: Object3D,
  attachmentScene: Group,
  heldWeaponSolveDirectionEpsilon: number
): {
  readonly localPosition: Vector3;
  readonly localQuaternion: Quaternion;
} {
  const { localPosition, localQuaternion } = resolveAttachmentNodeLocalTransform(
    attachmentScene,
    attachmentSocketNode
  );

  if (localPosition.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    throw new Error(
      `Metaverse attachment mount requires ${attachmentSocketRole} to stay offset from the attachment root.`
    );
  }

  return {
    localPosition,
    localQuaternion
  };
}

function resolveAttachmentNodeLocalTransform(
  attachmentRoot: Group,
  attachmentNode: Object3D
): {
  readonly localPosition: Vector3;
  readonly localQuaternion: Quaternion;
} {
  attachmentRoot.updateMatrixWorld(true);
  const attachmentRootWorldQuaternion =
    attachmentRoot.getWorldQuaternion(new Quaternion());

  return {
    localPosition: attachmentRoot.worldToLocal(
      attachmentNode.getWorldPosition(new Vector3())
    ),
    localQuaternion: attachmentRootWorldQuaternion
      .invert()
      .multiply(attachmentNode.getWorldQuaternion(new Quaternion()))
      .normalize()
  };
}

export function createAttachmentMountRuntime(
  mountConfig: MetaverseAttachmentProofConfig["heldMount"],
  socketNodesByRole: ReadonlyMap<HeldObjectSocketRoleId, Object3D>,
  attachmentScene: Group,
  heldWeaponSolveDirectionEpsilon: number
): MetaverseAttachmentMountRuntime {
  const attachmentSocketNode = resolveRequiredAttachmentSocketNodeByRole(
    socketNodesByRole,
    mountConfig.attachmentSocketRole,
    "attachment mount"
  );
  const attachmentSocketTransform = resolveAttachmentSocketLocalTransform(
    mountConfig.attachmentSocketRole,
    attachmentSocketNode,
    attachmentScene,
    heldWeaponSolveDirectionEpsilon
  );
  const localQuaternion = attachmentSocketTransform.localQuaternion.clone().invert();

  return {
    attachmentSocketRole: mountConfig.attachmentSocketRole,
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
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findSocketNode">,
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null
): void {
  const attachmentSlot =
    weaponState?.slots?.find(
      (slot) =>
        slot.equipped &&
        (slot.attachmentId === attachmentRuntime.attachmentId ||
          slot.weaponId === attachmentRuntime.attachmentId)
    ) ??
    (weaponState !== null &&
    weaponState.weaponId === attachmentRuntime.attachmentId
      ? {
          attachmentId: attachmentRuntime.attachmentId,
          equipped: true,
          slotId: weaponState.activeSlotId ?? "primary",
          weaponId: weaponState.weaponId,
          weaponInstanceId: `${weaponState.weaponId}:legacy`
        }
      : null);
  const isActiveAttachment =
    attachmentSlot !== null &&
    weaponState !== null &&
    weaponState.weaponId === attachmentSlot.weaponId &&
    (weaponState.activeSlotId === null ||
      weaponState.activeSlotId === undefined ||
      weaponState.activeSlotId === attachmentSlot.slotId);

  if (attachmentSlot === null) {
    if (attachmentRuntime.attachmentRoot.parent === null) {
      applyAttachmentMountRuntime(
        attachmentRuntime,
        characterProofRuntime,
        attachmentRuntime.heldMount,
        nodeResolvers
      );
    }

    attachmentRuntime.activeMountKind = null;
    attachmentRuntime.attachmentRoot.visible = false;
    return;
  }

  if (!isActiveAttachment && attachmentRuntime.mountedHolsterMount === null) {
    attachmentRuntime.activeMountKind = null;
    attachmentRuntime.attachmentRoot.visible = false;
    return;
  }

  const nextMountKind: MetaverseAttachmentProofRuntime["activeMountKind"] =
    (!isActiveAttachment ||
      mountedOccupancyPresentationState?.holsterHeldAttachment === true) &&
    attachmentRuntime.mountedHolsterMount !== null
      ? "mounted-holster"
      : "held";
  attachmentRuntime.attachmentRoot.visible = true;

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
    attachmentSocketRole: sourceRuntime.attachmentSocketRole,
    localPosition: sourceRuntime.localPosition.clone(),
    localQuaternion: sourceRuntime.localQuaternion.clone(),
    socketName: sourceRuntime.socketName
  };
}

export function cloneMetaverseAttachmentOffHandGripRuntime(
  sourceRuntime: MetaverseAttachmentOffHandGripRuntime
): MetaverseAttachmentOffHandGripRuntime {
  return {
    localPosition: sourceRuntime.localPosition.clone(),
    localQuaternion: sourceRuntime.localQuaternion.clone()
  };
}

function cloneAttachmentSocketNodesByRole(
  sourceRuntime: MetaverseAttachmentProofRuntime,
  characterProofRuntime: CharacterRuntimeLike,
  nodeResolvers: Pick<MetaverseAttachmentRuntimeNodeResolvers, "findNamedNode">,
  cloneLabel: string
): ReadonlyMap<HeldObjectSocketRoleId, Object3D> {
  const socketNodesByRole = new Map<HeldObjectSocketRoleId, Object3D>();

  for (const [role, node] of sourceRuntime.socketNodesByRole) {
    socketNodesByRole.set(
      role,
      nodeResolvers.findNamedNode(characterProofRuntime.scene, node.name, cloneLabel)
    );
  }

  return socketNodesByRole;
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
    attachmentId: sourceRuntime.attachmentId,
    attachmentRoot: nodeResolvers.findGroupNode(
      characterProofRuntime.scene,
      sourceRuntime.attachmentRoot.name,
      cloneLabel
    ),
    heldAdsCameraTargetOffset:
      sourceRuntime.heldAdsCameraTargetOffset === null
        ? null
        : {
            across: sourceRuntime.heldAdsCameraTargetOffset.across,
            forward: sourceRuntime.heldAdsCameraTargetOffset.forward,
            up: sourceRuntime.heldAdsCameraTargetOffset.up
          },
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
    holdProfile: sourceRuntime.holdProfile,
    mountedHolsterMount:
      sourceRuntime.mountedHolsterMount === null
        ? null
        : cloneMetaverseAttachmentMountRuntime(sourceRuntime.mountedHolsterMount),
    offHandGripMount:
      sourceRuntime.offHandGripMount === null
        ? null
        : cloneMetaverseAttachmentOffHandGripRuntime(
            sourceRuntime.offHandGripMount
          ),
    offHandGripAnchorNode:
      sourceRuntime.offHandGripAnchorNode === null
        ? null
        : nodeResolvers.findNamedNode(
            characterProofRuntime.scene,
            sourceRuntime.offHandGripAnchorNode.name,
            cloneLabel
          ),
    offHandTargetKind: sourceRuntime.offHandTargetKind,
    presentationGroup: nodeResolvers.findGroupNode(
      characterProofRuntime.scene,
      sourceRuntime.presentationGroup.name,
      cloneLabel
    ),
    socketNodesByRole: cloneAttachmentSocketNodesByRole(
      sourceRuntime,
      characterProofRuntime,
      nodeResolvers,
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
  const socketNodesByRole = resolveAttachmentSocketNodesByRole(
    attachmentProofConfig.holdProfile,
    attachmentAsset.scene,
    dependencies
  );

  for (const moduleProofConfig of attachmentProofConfig.modules) {
    const moduleSocketNode = resolveRequiredAttachmentSocketNodeByRole(
      socketNodesByRole,
      moduleProofConfig.socketRole,
      `module ${moduleProofConfig.moduleId}`
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
    socketNodesByRole,
    attachmentAsset.scene,
    dependencies.heldWeaponSolveDirectionEpsilon
  );
  const heldGripSocketNode = resolveRequiredAttachmentSocketNodeByRole(
    socketNodesByRole,
    attachmentProofConfig.heldMount.attachmentSocketRole,
    "held grip"
  );
  const heldForwardReferenceNode = resolveRequiredAttachmentSocketNodeByRole(
    socketNodesByRole,
    "basis.forward",
    "held forward basis"
  );
  const heldUpReferenceNode = resolveRequiredAttachmentSocketNodeByRole(
    socketNodesByRole,
    "basis.up",
    "held up basis"
  );
  const adsReferenceRole = resolveAttachmentAdsReferenceRole(
    attachmentProofConfig.holdProfile
  );
  const heldAdsCameraAnchorNode =
    adsReferenceRole === null
      ? null
      : resolveRequiredAttachmentSocketNodeByRole(
          socketNodesByRole,
          adsReferenceRole,
          "ADS camera anchor"
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
          socketNodesByRole,
          attachmentAsset.scene,
          dependencies.heldWeaponSolveDirectionEpsilon
        );
  const heldTriggerMarkerNode = resolveOptionalAttachmentSocketNodeByRole(
    socketNodesByRole,
    "trigger.index"
  );
  const heldGripToTriggerMarkerLocalPosition =
    heldTriggerMarkerNode === null
      ? null
      : resolveAttachmentNodeLocalPositionFromGrip(
          heldGripSocketNode,
          heldTriggerMarkerNode
        );

  attachmentRoot.name = `metaverse_attachment/${attachmentProofConfig.attachmentId}`;
  attachmentPresentationGroup.name = `${attachmentRoot.name}/presentation`;
  attachmentPresentationGroup.add(attachmentAsset.scene);
  attachmentRoot.add(attachmentPresentationGroup);
  attachmentRoot.updateMatrixWorld(true);

  const resolvedOffHandGripAnchorNode = resolveOptionalAttachmentSocketNodeByRole(
    socketNodesByRole,
    "grip.secondary"
  );
  const offHandTargetKind = resolveAttachmentOffHandTargetKind(
    attachmentProofConfig.holdProfile,
    resolvedOffHandGripAnchorNode
  );
  const offHandGripAnchorNode =
    offHandTargetKind === "none" ? null : resolvedOffHandGripAnchorNode;

  const offHandGripMount =
    offHandGripAnchorNode === null || offHandTargetKind === "none"
      ? null
      : resolveAttachmentNodeLocalTransform(
          attachmentRoot,
          offHandGripAnchorNode
        );
  const attachmentRuntime: MetaverseAttachmentProofRuntime = {
    activeMountKind: null,
    attachmentId: attachmentProofConfig.attachmentId,
    attachmentRoot,
    heldAdsCameraTargetOffset:
      attachmentProofConfig.heldMount.adsCameraTargetOffset === null ||
      attachmentProofConfig.heldMount.adsCameraTargetOffset === undefined
        ? null
        : {
            across: attachmentProofConfig.heldMount.adsCameraTargetOffset.across,
            forward: attachmentProofConfig.heldMount.adsCameraTargetOffset.forward,
            up: attachmentProofConfig.heldMount.adsCameraTargetOffset.up
          },
    heldGripLocalAimQuaternion,
    heldGripToAdsCameraAnchorLocalPosition,
    heldGripToForwardReferenceLocalPosition,
    heldGripToTriggerMarkerLocalPosition,
    heldGripSocketNode,
    heldMount,
    heldTriggerMarkerNode,
    holdProfile: attachmentProofConfig.holdProfile,
    mountedHolsterMount,
    offHandGripMount,
    offHandGripAnchorNode,
    offHandTargetKind,
    presentationGroup: attachmentPresentationGroup,
    socketNodesByRole
  };

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    characterProofRuntime,
    null,
    dependencies,
    null
  );

  return attachmentRuntime;
}
