export const skeletonIds = ["humanoid_v2"] as const;

export type SkeletonId = (typeof skeletonIds)[number];

export const humanoidV2BoneNames = [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "head",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r"
] as const;

export type HumanoidV2BoneName = (typeof humanoidV2BoneNames)[number];

export type SkeletonBoneName<TSkeletonId extends SkeletonId> = HumanoidV2BoneName;

export const socketIds = [
  "hand_r_socket",
  "hand_l_socket",
  "head_socket",
  "hip_socket",
  "seat_socket"
] as const;

export type SocketId = (typeof socketIds)[number];

export const humanoidV2BoneParentByName = Object.freeze({
  root: null,
  pelvis: "root",
  spine_01: "pelvis",
  spine_02: "spine_01",
  spine_03: "spine_02",
  neck_01: "spine_03",
  head: "neck_01",
  clavicle_l: "spine_03",
  upperarm_l: "clavicle_l",
  lowerarm_l: "upperarm_l",
  hand_l: "lowerarm_l",
  clavicle_r: "spine_03",
  upperarm_r: "clavicle_r",
  lowerarm_r: "upperarm_r",
  hand_r: "lowerarm_r",
  thigh_l: "pelvis",
  calf_l: "thigh_l",
  foot_l: "calf_l",
  ball_l: "foot_l",
  thigh_r: "pelvis",
  calf_r: "thigh_r",
  foot_r: "calf_r",
  ball_r: "foot_r"
} as const satisfies Readonly<
  Record<HumanoidV2BoneName, HumanoidV2BoneName | null>
>);

export const humanoidV2SocketParentById = Object.freeze({
  hand_r_socket: "hand_r",
  hand_l_socket: "hand_l",
  head_socket: "head",
  hip_socket: "pelvis",
  seat_socket: "pelvis"
} as const satisfies Readonly<Record<SocketId, HumanoidV2BoneName>>);

export type SkeletonBoneParentByName<TSkeletonId extends SkeletonId> = Readonly<
  Record<SkeletonBoneName<TSkeletonId>, SkeletonBoneName<TSkeletonId> | null>
>;

export type SkeletonSocketParentById<TSkeletonId extends SkeletonId> = Readonly<
  Record<SocketId, SkeletonBoneName<TSkeletonId>>
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
