import type {
  PhysicsVector3Snapshot
} from "../../types/metaverse-authoritative-rapier.js";

export interface MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot {
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativePlayerActiveBodyPoseRuntimeState {
  readonly groundedBodyRuntime: {
    readonly snapshot: Pick<
      MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot,
      "position" | "yawRadians"
    >;
  };
  readonly locomotionMode: string;
  readonly swimBodyRuntime: {
    readonly snapshot: Pick<
      MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot,
      "position" | "yawRadians"
    >;
  };
}

export interface MetaverseAuthoritativePlayerActiveBodyKinematicRuntimeState {
  readonly groundedBodyRuntime: {
    readonly snapshot: MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot;
  };
  readonly locomotionMode: string;
  readonly swimBodyRuntime: {
    readonly snapshot: MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot;
  };
}

function readActiveBodyPoseSnapshot(
  playerRuntime: MetaverseAuthoritativePlayerActiveBodyPoseRuntimeState
): Pick<
  MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot,
  "position" | "yawRadians"
> {
  if (playerRuntime.locomotionMode === "swim") {
    return playerRuntime.swimBodyRuntime.snapshot;
  }

  return playerRuntime.groundedBodyRuntime.snapshot;
}

export function readMetaverseAuthoritativePlayerActiveBodyPositionSnapshot(
  playerRuntime: MetaverseAuthoritativePlayerActiveBodyPoseRuntimeState
): PhysicsVector3Snapshot {
  return readActiveBodyPoseSnapshot(playerRuntime).position;
}

export function readMetaverseAuthoritativePlayerActiveBodyYawRadians(
  playerRuntime: MetaverseAuthoritativePlayerActiveBodyPoseRuntimeState
): number {
  return readActiveBodyPoseSnapshot(playerRuntime).yawRadians;
}

export function readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(
  playerRuntime: MetaverseAuthoritativePlayerActiveBodyKinematicRuntimeState
): MetaverseAuthoritativePlayerActiveBodyKinematicSnapshot {
  if (playerRuntime.locomotionMode === "swim") {
    return playerRuntime.swimBodyRuntime.snapshot;
  }

  return playerRuntime.groundedBodyRuntime.snapshot;
}
