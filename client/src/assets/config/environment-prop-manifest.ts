import { createEnvironmentAssetId } from "../types/asset-id";
import { defineEnvironmentAssetManifest } from "../types/environment-asset-manifest";
import {
  defaultMountedVehicleCameraPolicyId,
  defaultMountedVehicleLookLimitPolicyId,
  defaultMountedVehicleOccupancyAnimationId
} from "../types/environment-seat";

export const metaverseHubCrateEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-crate-v1"
);

export const metaverseHubPushableCrateEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-pushable-crate-v1"
);

export const metaverseHubDockEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-dock-v1"
);

export const metaverseHubSkiffEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-skiff-v1"
);

export const metaverseHubDiveBoatEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-dive-boat-v1"
);

export const metaverseHubSkiffForwardModelYawRadians = Math.PI * 0.5;
export const metaverseHubDiveBoatForwardModelYawRadians = Math.PI * 0.5;

export const environmentPropManifest = defineEnvironmentAssetManifest([
  {
    id: metaverseHubCrateEnvironmentAssetId,
    label: "Metaverse hub crate",
    placement: "instanced",
    traversalAffordance: "blocker",
    physicsColliders: [
      {
        center: {
          x: 0,
          y: 0,
          z: 0
        },
        shape: "box",
        size: {
          x: 0.92,
          y: 0.92,
          z: 0.92
        },
        traversalAffordance: "blocker"
      }
    ],
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
          maxDistanceMeters: 18
        },
        {
          tier: "low",
          modelPath: "/models/metaverse/environment/metaverse-hub-crate-low.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    orientation: null,
    collider: null,
    collisionPath: null,
    entries: null,
    seats: null
  },
  {
    id: metaverseHubDockEnvironmentAssetId,
    label: "Metaverse hub dock",
    placement: "static",
    traversalAffordance: "support",
    physicsColliders: [
      {
        center: {
          x: 0,
          y: 0,
          z: 0
        },
        shape: "box",
        size: {
          x: 8.4,
          y: 0.34,
          z: 4.2
        },
        traversalAffordance: "support"
      }
    ],
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
          maxDistanceMeters: 28
        },
        {
          tier: "low",
          modelPath: "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    orientation: null,
    collider: null,
    collisionPath: null,
    entries: null,
    seats: null
  },
  {
    id: metaverseHubPushableCrateEnvironmentAssetId,
    label: "Metaverse hub pushable crate",
    placement: "dynamic",
    traversalAffordance: "pushable",
    physicsColliders: null,
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    orientation: null,
    collider: {
      center: {
        x: 0,
        y: 0,
        z: 0
      },
      shape: "box",
      size: {
        x: 0.92,
        y: 0.92,
        z: 0.92
      }
    },
    collisionPath: null,
    entries: null,
    seats: null
  },
  {
    id: metaverseHubSkiffEnvironmentAssetId,
    label: "Metaverse hub skiff",
    placement: "dynamic",
    traversalAffordance: "mount",
    physicsColliders: [
      {
        center: {
          x: 0,
          y: 0.28,
          z: 0
        },
        shape: "box",
        size: {
          x: 5.8,
          y: 0.56,
          z: 2.6
        },
        traversalAffordance: "blocker"
      },
      {
        center: {
          x: 0,
          y: 0.62,
          z: 0
        },
        shape: "box",
        size: {
          x: 5.2,
          y: 0.12,
          z: 2
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: 1.35,
          y: 0.94,
          z: 0
        },
        shape: "box",
        size: {
          x: 0.9,
          y: 0.18,
          z: 0.8
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: 1.72,
          y: 1.18,
          z: 0
        },
        shape: "box",
        size: {
          x: 0.62,
          y: 0.58,
          z: 0.84
        },
        traversalAffordance: "blocker"
      },
      {
        center: {
          x: 0,
          y: 0.92,
          z: -0.74
        },
        shape: "box",
        size: {
          x: 2.6,
          y: 0.16,
          z: 0.52
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: 0,
          y: 1.12,
          z: -0.88
        },
        shape: "box",
        size: {
          x: 2.6,
          y: 0.42,
          z: 0.24
        },
        traversalAffordance: "blocker"
      },
      {
        center: {
          x: 0,
          y: 0.92,
          z: 0.74
        },
        shape: "box",
        size: {
          x: 2.6,
          y: 0.16,
          z: 0.52
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: 0,
          y: 1.12,
          z: 0.88
        },
        shape: "box",
        size: {
          x: 2.6,
          y: 0.42,
          z: 0.24
        },
        traversalAffordance: "blocker"
      }
    ],
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-skiff.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    orientation: {
      forwardModelYawRadians: metaverseHubSkiffForwardModelYawRadians
    },
    collider: {
      center: {
        x: 0,
        y: 1.05,
        z: 0
      },
      shape: "box",
      size: {
        x: 6.2,
        y: 2.4,
        z: 3.2
      }
    },
    collisionPath: "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf",
    entries: [
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        dismountOffset: {
          x: 0,
          y: 0,
          z: 1.2
        },
        entryId: "deck-entry",
        entryNodeName: "deck_entry",
        label: "Board deck",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: "standing",
        occupantRole: "passenger"
      }
    ],
    seats: [
      {
        cameraPolicyId: defaultMountedVehicleCameraPolicyId,
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 1.1
        },
        label: "Take helm",
        lookLimitPolicyId: defaultMountedVehicleLookLimitPolicyId,
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.8
        },
        label: "Port bench front",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "port-bench-seat",
        seatNodeName: "port_bench_seat",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.8
        },
        label: "Port bench rear",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "port-bench-seat-rear",
        seatNodeName: "port_bench_rear_seat",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.8
        },
        label: "Starboard bench front",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "starboard-bench-seat",
        seatNodeName: "starboard_bench_seat",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.8
        },
        label: "Starboard bench rear",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "starboard-bench-seat-rear",
        seatNodeName: "starboard_bench_rear_seat",
        seatRole: "passenger"
      }
    ]
  },
  {
    id: metaverseHubDiveBoatEnvironmentAssetId,
    label: "Metaverse hub dive boat",
    placement: "dynamic",
    traversalAffordance: "mount",
    physicsColliders: [
      {
        center: {
          x: 0,
          y: 0.28,
          z: 0
        },
        shape: "box",
        size: {
          x: 10.8,
          y: 0.56,
          z: 3.6
        },
        traversalAffordance: "blocker"
      },
      {
        center: {
          x: 0,
          y: 0.64,
          z: 0
        },
        shape: "box",
        size: {
          x: 9.8,
          y: 0.12,
          z: 2.6
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: -4.2,
          y: 0.64,
          z: 0
        },
        shape: "box",
        size: {
          x: 1.6,
          y: 0.12,
          z: 2.2
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: 2.6,
          y: 0.96,
          z: 0.52
        },
        shape: "box",
        size: {
          x: 1.1,
          y: 0.16,
          z: 0.9
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: -0.3,
          y: 0.92,
          z: -1.02
        },
        shape: "box",
        size: {
          x: 5.8,
          y: 0.16,
          z: 0.56
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: -0.3,
          y: 1.14,
          z: -1.18
        },
        shape: "box",
        size: {
          x: 5.8,
          y: 0.46,
          z: 0.26
        },
        traversalAffordance: "blocker"
      },
      {
        center: {
          x: -0.3,
          y: 0.92,
          z: 1.02
        },
        shape: "box",
        size: {
          x: 5.8,
          y: 0.16,
          z: 0.56
        },
        traversalAffordance: "support"
      },
      {
        center: {
          x: -0.3,
          y: 1.14,
          z: 1.18
        },
        shape: "box",
        size: {
          x: 5.8,
          y: 0.46,
          z: 0.26
        },
        traversalAffordance: "blocker"
      },
      {
        center: {
          x: 3.15,
          y: 1.18,
          z: 0.45
        },
        shape: "box",
        size: {
          x: 0.9,
          y: 0.72,
          z: 0.92
        },
        traversalAffordance: "blocker"
      }
    ],
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-dive-boat.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    orientation: {
      forwardModelYawRadians: metaverseHubDiveBoatForwardModelYawRadians
    },
    collider: {
      center: {
        x: 0,
        y: 1.14,
        z: 0
      },
      shape: "box",
      size: {
        x: 11.6,
        y: 2.8,
        z: 4.2
      }
    },
    collisionPath: "/models/metaverse/environment/metaverse-hub-dive-boat-collision.gltf",
    entries: [
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        dismountOffset: {
          x: 0,
          y: 0,
          z: 1.3
        },
        entryId: "stern-port-entry",
        entryNodeName: "stern_port_entry",
        label: "Board port stern",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: "standing",
        occupantRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        dismountOffset: {
          x: 0,
          y: 0,
          z: 1.3
        },
        entryId: "stern-starboard-entry",
        entryNodeName: "stern_starboard_entry",
        label: "Board starboard stern",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: "standing",
        occupantRole: "passenger"
      }
    ],
    seats: [
      {
        cameraPolicyId: defaultMountedVehicleCameraPolicyId,
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 1.2
        },
        label: "Take helm",
        lookLimitPolicyId: defaultMountedVehicleLookLimitPolicyId,
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "helm-seat",
        seatNodeName: "helm_seat",
        seatRole: "driver"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.9
        },
        label: "Port bench A",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "port-bench-seat-a",
        seatNodeName: "port_bench_seat_a",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.9
        },
        label: "Port bench B",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "port-bench-seat-b",
        seatNodeName: "port_bench_seat_b",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.9
        },
        label: "Port bench C",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "port-bench-seat-c",
        seatNodeName: "port_bench_seat_c",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.9
        },
        label: "Starboard bench A",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "starboard-bench-seat-a",
        seatNodeName: "starboard_bench_seat_a",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.9
        },
        label: "Starboard bench B",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "starboard-bench-seat-b",
        seatNodeName: "starboard_bench_seat_b",
        seatRole: "passenger"
      },
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        directEntryEnabled: false,
        dismountOffset: {
          x: 0,
          y: 0,
          z: 0.9
        },
        label: "Starboard bench C",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: defaultMountedVehicleOccupancyAnimationId,
        seatId: "starboard-bench-seat-c",
        seatNodeName: "starboard_bench_seat_c",
        seatRole: "passenger"
      }
    ]
  }
] as const);
