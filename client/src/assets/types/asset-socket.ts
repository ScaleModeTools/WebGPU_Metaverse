export const skeletonIds = ["humanoid_v1"] as const;

export type SkeletonId = (typeof skeletonIds)[number];

export const humanoidV1BoneNames = [
  "humanoid_root",
  "hips",
  "spine",
  "chest",
  "neck"
] as const;

export type HumanoidV1BoneName = (typeof humanoidV1BoneNames)[number];

export const socketIds = [
  "hand_r_socket",
  "hand_l_socket",
  "head_socket",
  "hip_socket",
  "seat_socket"
] as const;

export type SocketId = (typeof socketIds)[number];

export const humanoidV1BoneParentByName = Object.freeze({
  humanoid_root: null,
  hips: "humanoid_root",
  spine: "hips",
  chest: "spine",
  neck: "chest"
} as const satisfies Readonly<
  Record<HumanoidV1BoneName, HumanoidV1BoneName | null>
>);

export const humanoidV1SocketParentById = Object.freeze({
  hand_r_socket: "chest",
  hand_l_socket: "chest",
  head_socket: "neck",
  hip_socket: "hips",
  seat_socket: "hips"
} as const satisfies Readonly<Record<SocketId, HumanoidV1BoneName>>);
