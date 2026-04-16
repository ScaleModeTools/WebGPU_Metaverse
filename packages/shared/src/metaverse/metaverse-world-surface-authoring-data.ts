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

export const metaverseHubCrateEnvironmentAssetId = "metaverse-hub-crate-v1";
export const metaverseHubDockEnvironmentAssetId = "metaverse-hub-dock-v1";
export const metaverseHubPushableCrateEnvironmentAssetId =
  "metaverse-hub-pushable-crate-v1";
export const metaverseHubShorelineEnvironmentAssetId =
  "metaverse-hub-shoreline-v1";
export const metaverseHubSkiffEnvironmentAssetId = "metaverse-hub-skiff-v1";
export const metaverseHubDiveBoatEnvironmentAssetId =
  "metaverse-hub-dive-boat-v1";

const metaverseHubSpawnDockLiftMeters = 0.45;
const metaverseHubDockPlacementHeightMeters =
  -0.02 + metaverseHubSpawnDockLiftMeters;

const metaverseHubCrateSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0, 0),
    size: freezeVector3(0.92, 0.92, 0.92),
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

const metaverseHubShorelineSurfaceColliders = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, 0.09, 3.05),
    size: freezeVector3(2.8, 0.18, 3.2),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(0, 0.14, 0.25),
    size: freezeVector3(8.2, 0.28, 5.8),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(-2.6, 0.21, 1.6),
    size: freezeVector3(2.2, 0.42, 2.6),
    traversalAffordance: "support"
  }),
  Object.freeze({
    center: freezeVector3(3.35, 0.72, 0.2),
    size: freezeVector3(0.9, 1.44, 5),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(-3.65, 0.62, -0.85),
    size: freezeVector3(0.78, 1.24, 2.8),
    traversalAffordance: "blocker"
  }),
  Object.freeze({
    center: freezeVector3(0, 0.68, -2.7),
    size: freezeVector3(6.6, 1.36, 0.8),
    traversalAffordance: "blocker"
  })
] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);

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
    environmentAssetId: metaverseHubDockEnvironmentAssetId,
    placement: "static",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(
          -12.719107213690513,
          metaverseHubDockPlacementHeightMeters,
          -16.075801705270205
        ),
        rotationYRadians: Math.PI * 0.06,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(
          -4.467894307569528,
          metaverseHubDockPlacementHeightMeters,
          -17.64980474779029
        ),
        rotationYRadians: Math.PI * 0.06,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(
          -11.932105692430468,
          metaverseHubDockPlacementHeightMeters,
          -11.950195252209712
        ),
        rotationYRadians: Math.PI * 0.06,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(
          -3.680892786309485,
          metaverseHubDockPlacementHeightMeters,
          -13.524198294729798
        ),
        rotationYRadians: Math.PI * 0.06,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubDockSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubCrateEnvironmentAssetId,
    placement: "instanced",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(-9.5, 0, -10.5),
        rotationYRadians: Math.PI * 0.08,
        scale: 1
      }),
      Object.freeze({
        position: freezeVector3(-8, 0, -12.2),
        rotationYRadians: Math.PI * 0.17,
        scale: 0.96
      }),
      Object.freeze({
        position: freezeVector3(-6.4, 0, -11),
        rotationYRadians: Math.PI * 0.28,
        scale: 1.08
      }),
      Object.freeze({
        position: freezeVector3(-7.1, 0, -8.8),
        rotationYRadians: Math.PI * -0.12,
        scale: 0.92
      })
    ]),
    surfaceColliders: metaverseHubCrateSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubPushableCrateEnvironmentAssetId,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(-3.8, 0.46, -14.4),
        rotationYRadians: Math.PI * 0.04,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubPushableCrateSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubShorelineEnvironmentAssetId,
    placement: "static",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(-8.45, 0, -26.2),
        rotationYRadians: Math.PI * 0.02,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubShorelineSurfaceColliders
  }),
  Object.freeze({
    environmentAssetId: metaverseHubSkiffEnvironmentAssetId,
    placement: "dynamic",
    placements: Object.freeze([
      Object.freeze({
        position: freezeVector3(12.2, 0.12, -13.8),
        rotationYRadians: Math.PI * 0.86,
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
        position: freezeVector3(22.4, 0.16, -16.2),
        rotationYRadians: Math.PI * 0.88,
        scale: 1
      })
    ]),
    surfaceColliders: metaverseHubDiveBoatSurfaceColliders
  })
] satisfies readonly MetaverseWorldSurfaceAssetAuthoring[]);

export const metaverseWorldWaterRegions = Object.freeze([
  Object.freeze({
    center: freezeVector3(0, -3.6, -18),
    rotationYRadians: 0,
    size: freezeVector3(180, 7.2, 200),
    waterRegionId: "metaverse-hub-harbor-water-v1"
  })
] satisfies readonly MetaverseWorldWaterRegionAuthoring[]);
