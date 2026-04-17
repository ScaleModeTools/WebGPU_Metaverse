import type {
  MetaverseWorldSurfaceAssetAuthoring,
  MetaverseWorldSurfaceColliderAuthoring,
  MetaverseWorldWaterRegionAuthoring,
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";

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

export const metaversePlaygroundRangeFloorEnvironmentAssetId =
  "metaverse-playground-range-floor-v1";
export const metaversePlaygroundRangeBarrierEnvironmentAssetId =
  "metaverse-playground-range-barrier-v1";
export const metaverseHubDockEnvironmentAssetId = "metaverse-hub-dock-v1";
export const metaverseHubPushableCrateEnvironmentAssetId =
  "metaverse-hub-pushable-crate-v1";
export const metaverseHubSkiffEnvironmentAssetId = "metaverse-hub-skiff-v1";
export const metaverseHubDiveBoatEnvironmentAssetId =
  "metaverse-hub-dive-boat-v1";

const metaversePlaygroundFloorTopHeightMeters = 0.6;
const metaverseHubDockPlacementHeightMeters = 0.43;

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

export const metaverseWorldSurfaceAssets = Object.freeze([
  Object.freeze({
    environmentAssetId: metaversePlaygroundRangeFloorEnvironmentAssetId,
    placement: "static",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(0, 0, 0),
        rotationYRadians: 0,
        scale: 1
      })
    ]),
    surfaceColliders: metaversePlaygroundRangeFloorSurfaceColliders
  }),
  Object.freeze({
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
    surfaceColliders: metaversePlaygroundRangeBarrierSurfaceColliders
  }),
  Object.freeze({
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
    surfaceColliders: metaverseHubDockSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubPushableCrateEnvironmentAssetId,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(-8, 0.46, 14),
        rotationYRadians: Math.PI * -0.08,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubPushableCrateSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubSkiffEnvironmentAssetId,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(58.5, 0.12, 0.5),
        rotationYRadians: Math.PI * 0.5,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubSkiffSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubDiveBoatEnvironmentAssetId,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(68.5, 0.16, 18),
        rotationYRadians: Math.PI * 0.52,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubDiveBoatSurfaceColliders
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
