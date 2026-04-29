import {
  AVATAR_BONE_ALIAS,
  AVATAR_BONE_GROUPS,
  AVATAR_BONE_NAMES,
  AVATAR_BONE_PARENT,
  AVATAR_FINGER_CHAINS,
  AVATAR_NON_WEIGHTED_DRIVERS,
  AVATAR_WEIGHTED_JOINTS,
  type AvatarBoneGroupName,
  type AvatarBoneName
} from "./humanoid-v2-avatar-rig";

export const skeletonIds = ["humanoid_v2"] as const;

export type SkeletonId = (typeof skeletonIds)[number];

export const humanoidV2BoneNames = AVATAR_BONE_NAMES;

export type HumanoidV2BoneName = AvatarBoneName;

export type SkeletonBoneName<TSkeletonId extends SkeletonId> = HumanoidV2BoneName;

export const socketIds = [
  "hand_r_socket",
  "hand_l_socket",
  "head_socket",
  "hip_socket",
  "seat_socket"
] as const;

export type SocketId = (typeof socketIds)[number];

export const humanoidV2BoneParentByName = Object.freeze(AVATAR_BONE_PARENT);

export const humanoidV2BoneAliasByName = Object.freeze(AVATAR_BONE_ALIAS);

export const humanoidV2WeightedJointNames = AVATAR_WEIGHTED_JOINTS;

export const humanoidV2NonWeightedDriverNames = AVATAR_NON_WEIGHTED_DRIVERS;

export const humanoidV2FingerChainsBySide = Object.freeze(AVATAR_FINGER_CHAINS);

export const humanoidV2BoneGroups = Object.freeze(AVATAR_BONE_GROUPS);

export type HumanoidV2BoneGroupName = AvatarBoneGroupName;

export const humanoidV2SocketParentById = Object.freeze({
  hand_r_socket: "hand_r",
  hand_l_socket: "hand_l",
  head_socket: "head",
  hip_socket: "pelvis",
  seat_socket: "pelvis"
} as const satisfies Readonly<Record<SocketId, HumanoidV2BoneName>>);

export interface SkeletonSocketLocalTransform {
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly quaternion: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  };
}

export const humanoidV2SocketLocalTransformsById = Object.freeze({
  hand_r_socket: Object.freeze({
    position: Object.freeze({ x: 0, y: 0.08, z: 0 }),
    quaternion: Object.freeze({
      x: 0,
      y: 0,
      z: 0.7071067811865476,
      w: 0.7071067811865476
    })
  }),
  hand_l_socket: Object.freeze({
    position: Object.freeze({ x: 0, y: 0.08, z: 0 }),
    quaternion: Object.freeze({ x: 0, y: 0, z: 0, w: 1 })
  }),
  head_socket: Object.freeze({
    position: Object.freeze({ x: 0, y: 0.12, z: 0 }),
    quaternion: Object.freeze({ x: 0, y: 0, z: 0, w: 1 })
  }),
  hip_socket: Object.freeze({
    position: Object.freeze({ x: 0.18, y: -0.08, z: -0.08 }),
    quaternion: Object.freeze({ x: 0, y: 0, z: 0, w: 1 })
  }),
  seat_socket: Object.freeze({
    position: Object.freeze({ x: 0, y: 0, z: -0.08 }),
    quaternion: Object.freeze({ x: 0, y: 0, z: 0, w: 1 })
  })
} as const satisfies Readonly<Record<SocketId, SkeletonSocketLocalTransform>>);

export type SkeletonBoneParentByName<TSkeletonId extends SkeletonId> = Readonly<
  Record<SkeletonBoneName<TSkeletonId>, SkeletonBoneName<TSkeletonId> | null>
>;

export type SkeletonSocketParentById<TSkeletonId extends SkeletonId> = Readonly<
  Record<SocketId, SkeletonBoneName<TSkeletonId>>
>;

export type SkeletonSocketLocalTransformsById = Readonly<
  Record<SocketId, SkeletonSocketLocalTransform>
>;

export const skeletonBoneNamesById = Object.freeze({
  humanoid_v2: humanoidV2BoneNames
} as const satisfies {
  readonly [TSkeletonId in SkeletonId]: readonly SkeletonBoneName<TSkeletonId>[];
});

export const skeletonBoneParentByNameById = Object.freeze({
  humanoid_v2: humanoidV2BoneParentByName
} as const satisfies {
  readonly [TSkeletonId in SkeletonId]: SkeletonBoneParentByName<TSkeletonId>;
});

export const skeletonSocketParentById = Object.freeze({
  humanoid_v2: humanoidV2SocketParentById
} as const satisfies {
  readonly [TSkeletonId in SkeletonId]: SkeletonSocketParentById<TSkeletonId>;
});

export const skeletonSocketLocalTransformsById = Object.freeze({
  humanoid_v2: humanoidV2SocketLocalTransformsById
} as const satisfies {
  readonly [TSkeletonId in SkeletonId]: SkeletonSocketLocalTransformsById;
});
