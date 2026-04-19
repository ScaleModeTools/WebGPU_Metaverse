import type {
  MetaverseWorldEnvironmentColliderAuthoring,
  MetaverseWorldEnvironmentDynamicBodyAuthoring,
  MetaverseWorldMountedEntryAuthoring,
  MetaverseWorldMountedSeatAuthoring,
  MetaverseWorldSurfaceAssetAuthoring,
  MetaverseWorldSurfaceColliderAuthoring,
  MetaverseWorldWaterRegionAuthoring,
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import {
  defaultMetaverseMountedLookLimitPolicyId
} from "./metaverse-player-look-constraints.js";
import {
  defaultMetaverseMountedVehicleCameraPolicyId,
  defaultMetaverseMountedVehicleOccupancyAnimationId
} from "./metaverse-mounted-vehicle-policies.js";

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

function freezeCollider(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number
): MetaverseWorldEnvironmentColliderAuthoring {
  return Object.freeze({
    center: freezeVector3(x, y, z),
    size: freezeVector3(width, height, depth)
  });
}

function freezeDynamicBody(
  config: {
    readonly additionalMass: number;
    readonly angularDamping: number;
    readonly gravityScale: number;
    readonly linearDamping: number;
    readonly lockRotations: boolean;
  }
): MetaverseWorldEnvironmentDynamicBodyAuthoring {
  return Object.freeze({
    additionalMass: Number.isFinite(config.additionalMass)
      ? Math.max(0, config.additionalMass)
      : 0,
    angularDamping: Number.isFinite(config.angularDamping)
      ? Math.max(0, config.angularDamping)
      : 0,
    gravityScale: Number.isFinite(config.gravityScale)
      ? Math.max(0, config.gravityScale)
      : 1,
    kind: "dynamic-rigid-body",
    linearDamping: Number.isFinite(config.linearDamping)
      ? Math.max(0, config.linearDamping)
      : 0,
    lockRotations: config.lockRotations
  });
}

function freezeMountedSeat(
  seat: MetaverseWorldMountedSeatAuthoring
): MetaverseWorldMountedSeatAuthoring {
  return Object.freeze({
    cameraPolicyId: seat.cameraPolicyId,
    controlRoutingPolicyId: seat.controlRoutingPolicyId,
    directEntryEnabled: seat.directEntryEnabled,
    label: seat.label,
    lookLimitPolicyId: seat.lookLimitPolicyId,
    occupancyAnimationId: seat.occupancyAnimationId,
    seatId: seat.seatId,
    seatRole: seat.seatRole
  });
}

function freezeMountedEntry(
  entry: MetaverseWorldMountedEntryAuthoring
): MetaverseWorldMountedEntryAuthoring {
  return Object.freeze({
    cameraPolicyId: entry.cameraPolicyId,
    controlRoutingPolicyId: entry.controlRoutingPolicyId,
    entryId: entry.entryId,
    label: entry.label,
    lookLimitPolicyId: entry.lookLimitPolicyId,
    occupancyAnimationId: entry.occupancyAnimationId,
    occupantRole: entry.occupantRole
  });
}

export const metaversePlaygroundRangeFloorEnvironmentAssetId =
  "metaverse-playground-range-floor-v1";
export const metaversePlaygroundRangeBarrierEnvironmentAssetId =
  "metaverse-playground-range-barrier-v1";
export const metaverseBuilderFloorTileEnvironmentAssetId =
  "metaverse-builder-floor-tile-v1";
export const metaverseBuilderWallTileEnvironmentAssetId =
  "metaverse-builder-wall-tile-v1";
export const metaverseBuilderStepTileEnvironmentAssetId =
  "metaverse-builder-step-tile-v1";
export const metaverseBuilderBlockTileEnvironmentAssetId =
  "metaverse-builder-block-tile-v1";
export const metaverseHubDockEnvironmentAssetId = "metaverse-hub-dock-v1";
export const metaverseHubPushableCrateEnvironmentAssetId =
  "metaverse-hub-pushable-crate-v1";
export const metaverseHubSkiffEnvironmentAssetId = "metaverse-hub-skiff-v1";
export const metaverseHubDiveBoatEnvironmentAssetId =
  "metaverse-hub-dive-boat-v1";

const metaversePlaygroundFloorTopHeightMeters = 0.6;
const metaverseHubDockPlacementHeightMeters = 0.43;
const metaverseHubDockCollisionPath =
  "/models/metaverse/environment/metaverse-hub-dock-high.gltf";
const metaverseHubSkiffCollisionPath =
  "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf";
const metaverseHubDiveBoatCollisionPath =
  "/models/metaverse/environment/metaverse-hub-dive-boat-collision.gltf";

const metaversePlaygroundRangeFloorSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, metaversePlaygroundFloorTopHeightMeters * 0.5, 0),
    size: freezeVector3(72, metaversePlaygroundFloorTopHeightMeters, 82),
    traversalAffordance: "support"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaversePlaygroundRangeBarrierSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 1.6, 0),
    size: freezeVector3(8.5, 3.2, 1.4),
    traversalAffordance: "blocker"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseBuilderFloorTileSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0.25, 0),
    size: freezeVector3(4, 0.5, 4),
    traversalAffordance: "support"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseBuilderWallTileSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 2, 0),
    size: freezeVector3(4, 4, 0.5),
    traversalAffordance: "blocker"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseBuilderStepTileSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0.5, 0),
    size: freezeVector3(4, 1, 4),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 1.02, 0),
    size: freezeVector3(4, 0.08, 4),
    traversalAffordance: "support"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseBuilderBlockTileSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 2, 0),
    size: freezeVector3(4, 4, 4),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 4.02, 0),
    size: freezeVector3(4, 0.08, 4),
    traversalAffordance: "support"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseHubDockSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0, 0),
    size: freezeVector3(8.4, 0.34, 4.2),
    traversalAffordance: "support"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseHubPushableCrateSurfaceColliders = Object.freeze(
  []
) as readonly MetaverseWorldSurfaceColliderAuthoring[];

const metaverseHubSkiffSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0.28, 0),
    size: freezeVector3(5.8, 0.56, 2.6),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 0.62, 0),
    size: freezeVector3(5.2, 0.12, 2),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(1.35, 0.94, 0),
    size: freezeVector3(0.9, 0.18, 0.8),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(1.72, 1.18, 0),
    size: freezeVector3(0.62, 0.58, 0.84),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 0.92, -0.74),
    size: freezeVector3(2.6, 0.16, 0.52),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(0, 1.12, -0.88),
    size: freezeVector3(2.6, 0.42, 0.24),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 0.92, 0.74),
    size: freezeVector3(2.6, 0.16, 0.52),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(0, 1.12, 0.88),
    size: freezeVector3(2.6, 0.42, 0.24),
    traversalAffordance: "blocker"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseHubSkiffEntries = Object.freeze([
  freezeMountedEntry({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    entryId: "deck-entry",
    label: "Board deck",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupantRole: "passenger"
  })
] satisfies readonly MetaverseWorldMountedEntryAuthoring[]);

const metaverseHubSkiffSeats = Object.freeze([
  freezeMountedSeat({
    cameraPolicyId: defaultMetaverseMountedVehicleCameraPolicyId,
    controlRoutingPolicyId: "vehicle-surface-drive",
    directEntryEnabled: true,
    label: "Take helm",
    lookLimitPolicyId: defaultMetaverseMountedLookLimitPolicyId,
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "driver-seat",
    seatRole: "driver"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Port bench front",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "port-bench-seat",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Port bench rear",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "port-bench-seat-rear",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Starboard bench front",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "starboard-bench-seat",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Starboard bench rear",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "starboard-bench-seat-rear",
    seatRole: "passenger"
  })
] satisfies readonly MetaverseWorldMountedSeatAuthoring[]);

const metaverseHubDiveBoatSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0.28, 0),
    size: freezeVector3(10.8, 0.56, 3.6),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 0.64, 0),
    size: freezeVector3(9.8, 0.12, 2.6),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(-4.2, 0.64, 0),
    size: freezeVector3(1.6, 0.12, 2.2),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(2.6, 0.96, 0.52),
    size: freezeVector3(1.1, 0.16, 0.9),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(-0.3, 0.92, -1.02),
    size: freezeVector3(5.8, 0.16, 0.56),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(-0.3, 1.14, -1.18),
    size: freezeVector3(5.8, 0.46, 0.26),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(-0.3, 0.92, 1.02),
    size: freezeVector3(5.8, 0.16, 0.56),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(-0.3, 1.14, 1.18),
    size: freezeVector3(5.8, 0.46, 0.26),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(3.15, 1.18, 0.45),
    size: freezeVector3(0.9, 0.72, 0.92),
    traversalAffordance: "blocker"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

const metaverseHubDiveBoatEntries = Object.freeze([
  freezeMountedEntry({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    entryId: "stern-port-entry",
    label: "Board port stern",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupantRole: "passenger"
  }),
  freezeMountedEntry({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    entryId: "stern-starboard-entry",
    label: "Board starboard stern",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupantRole: "passenger"
  })
] satisfies readonly MetaverseWorldMountedEntryAuthoring[]);

const metaverseHubDiveBoatSeats = Object.freeze([
  freezeMountedSeat({
    cameraPolicyId: defaultMetaverseMountedVehicleCameraPolicyId,
    controlRoutingPolicyId: "vehicle-surface-drive",
    directEntryEnabled: true,
    label: "Take helm",
    lookLimitPolicyId: defaultMetaverseMountedLookLimitPolicyId,
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "helm-seat",
    seatRole: "driver"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Port bench A",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "port-bench-seat-a",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Port bench B",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "port-bench-seat-b",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Port bench C",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "port-bench-seat-c",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Starboard bench A",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "starboard-bench-seat-a",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Starboard bench B",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "starboard-bench-seat-b",
    seatRole: "passenger"
  }),
  freezeMountedSeat({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directEntryEnabled: false,
    label: "Starboard bench C",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: defaultMetaverseMountedVehicleOccupancyAnimationId,
    seatId: "starboard-bench-seat-c",
    seatRole: "passenger"
  })
] satisfies readonly MetaverseWorldMountedSeatAuthoring[]);

export const metaverseWorldSurfaceAssets = Object.freeze([
  Object.freeze({
    collisionPath: null,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaversePlaygroundRangeFloorEnvironmentAssetId,
    placement: "static",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(0, 0, 0),
        rotationYRadians: 0,
        scale: 1
      })
    ]),
    surfaceColliders: metaversePlaygroundRangeFloorSurfaceColliders,
    traversalAffordance: "support"
  }),
  Object.freeze({
    collisionPath: null,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaversePlaygroundRangeBarrierEnvironmentAssetId,
    placement: "instanced",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(0, 0, -33),
        rotationYRadians: 0,
        scale: 1.8
      }),
      Object.freeze({
        position: freezeVector3(-19, 0, -25),
        rotationYRadians: Math.PI * 0.5,
        scale: 1.2
      }),
      Object.freeze({
        position: freezeVector3(19, 0, -25),
        rotationYRadians: Math.PI * 0.5,
        scale: 1.2
      }),
      Object.freeze({
        position: freezeVector3(-11.5, 0, -5),
        rotationYRadians: 0,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(11.5, 0, -8.5),
        rotationYRadians: 0,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(0, 0, -14.5),
        rotationYRadians: 0,
        scale: 0.9
      })
    ]),
    surfaceColliders: metaversePlaygroundRangeBarrierSurfaceColliders,
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    collisionPath: null,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
    placement: "instanced",
    placements: Object.freeze([]),
    surfaceColliders: metaverseBuilderFloorTileSurfaceColliders,
    traversalAffordance: "support"
  }),
  Object.freeze({
    collisionPath: null,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaverseBuilderWallTileEnvironmentAssetId,
    placement: "instanced",
    placements: Object.freeze([]),
    surfaceColliders: metaverseBuilderWallTileSurfaceColliders,
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    collisionPath: null,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaverseBuilderStepTileEnvironmentAssetId,
    placement: "instanced",
    placements: Object.freeze([]),
    surfaceColliders: metaverseBuilderStepTileSurfaceColliders,
    traversalAffordance: "support"
  }),
  Object.freeze({
    collisionPath: null,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaverseBuilderBlockTileEnvironmentAssetId,
    placement: "instanced",
    placements: Object.freeze([]),
    surfaceColliders: metaverseBuilderBlockTileSurfaceColliders,
    traversalAffordance: "support"
  }),
  Object.freeze({
    collisionPath: metaverseHubDockCollisionPath,
    collider: null,
    dynamicBody: null,
    environmentAssetId: metaverseHubDockEnvironmentAssetId,
    placement: "static",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(39.5, metaverseHubDockPlacementHeightMeters, 10),
        rotationYRadians: 0,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(47.9, metaverseHubDockPlacementHeightMeters, 10),
        rotationYRadians: 0,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubDockSurfaceColliders,
    traversalAffordance: "support"
  }),
  Object.freeze({
    collisionPath: null,
    collider: freezeCollider(0, 0, 0, 0.92, 0.92, 0.92),
    dynamicBody: freezeDynamicBody({
      additionalMass: 12,
      angularDamping: 10,
      gravityScale: 1,
      linearDamping: 4.5,
      lockRotations: true
    }),
    environmentAssetId: metaverseHubPushableCrateEnvironmentAssetId,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(-8, 0.46, 14),
        rotationYRadians: Math.PI * -0.08,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubPushableCrateSurfaceColliders,
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    collisionPath: metaverseHubSkiffCollisionPath,
    collider: freezeCollider(0, 1.05, 0, 6.2, 2.4, 3.2),
    dynamicBody: null,
    environmentAssetId: metaverseHubSkiffEnvironmentAssetId,
    entries: metaverseHubSkiffEntries,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(58.5, 0.12, 0.5),
        rotationYRadians: Math.PI * 0.5,
        scale: 1
      })
    ]),
    seats: metaverseHubSkiffSeats,
    surfaceColliders: metaverseHubSkiffSurfaceColliders,
    traversalAffordance: "mount"
  }),
  Object.freeze({
    collisionPath: metaverseHubDiveBoatCollisionPath,
    collider: freezeCollider(0, 1.62, 0, 11.6, 3.8, 4.2),
    dynamicBody: null,
    environmentAssetId: metaverseHubDiveBoatEnvironmentAssetId,
    entries: metaverseHubDiveBoatEntries,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(68.5, 0.16, 18),
        rotationYRadians: Math.PI * 0.52,
        scale: 1
      })
    ]),
    seats: metaverseHubDiveBoatSeats,
    surfaceColliders: metaverseHubDiveBoatSurfaceColliders,
    traversalAffordance: "mount"
  })
] satisfies readonly MetaverseWorldSurfaceAssetAuthoring[]);

export const metaverseWorldWaterRegions = Object.freeze([
  Object.freeze({
    center: freezeVector3(66, -3.6, 10),
    rotationYRadians: 0,
    size: freezeVector3(56, 7.2, 46),
    waterRegionId: "metaverse-playground-water-bay-v1"
  })
] satisfies readonly MetaverseWorldWaterRegionAuthoring[]);
