import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import type {
  EnvironmentAssetDescriptor,
  EnvironmentEntryDescriptor,
  EnvironmentProceduralBoxLodDescriptor,
  EnvironmentRenderLodGroup,
  EnvironmentSeatDescriptor
} from "@/assets/types/environment-asset-manifest";
import {
  normalizePlanarYawRadians,
  readMetaverseWorldMountedEntryAuthoring,
  readMetaverseWorldMountedSeatAuthoring
} from "@webgpu-metaverse/shared";
import type {
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentDynamicBodyProofConfig,
  MetaverseEnvironmentEntryProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentPhysicsColliderProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
  MetaverseEnvironmentProofConfig,
  MetaverseEnvironmentSeatProofConfig
} from "@/metaverse/types/metaverse-runtime";

import { loadMetaverseMapBundle } from "../map-bundles";
import { resolveDefaultMetaverseWorldBundleId } from "../bundle-registry";
import { metaverseCharacterProofConfig } from "./metaverse-character-proof-config";

function isEnvironmentProceduralBoxLodDescriptor(
  lod: EnvironmentRenderLodGroup["lods"][number]
): lod is EnvironmentProceduralBoxLodDescriptor {
  return "kind" in lod && lod.kind === "procedural-box";
}

function resolveEnvironmentLods(
  renderModel: EnvironmentRenderLodGroup
): readonly MetaverseEnvironmentLodProofConfig[] {
  if (renderModel.lods.length === 0) {
    throw new Error("Metaverse environment asset manifest requires at least one LOD entry.");
  }

  const resolvedLods = renderModel.lods.map((lod) => {
    if (isEnvironmentProceduralBoxLodDescriptor(lod)) {
      return Object.freeze({
        kind: lod.kind,
        materialPreset: lod.materialPreset,
        maxDistanceMeters: lod.maxDistanceMeters,
        size: Object.freeze({
          x: lod.size.x,
          y: lod.size.y,
          z: lod.size.z
        }),
        tier: lod.tier
      });
    }

    return Object.freeze({
      maxDistanceMeters: lod.maxDistanceMeters,
      modelPath: lod.modelPath,
      tier: lod.tier
    });
  });

  return Object.freeze(resolvedLods);
}

function resolveEnvironmentCollider(
  collider:
    | {
        readonly center: { readonly x: number; readonly y: number; readonly z: number };
        readonly size: { readonly x: number; readonly y: number; readonly z: number };
      }
    | null
): MetaverseEnvironmentColliderProofConfig | null {
  if (collider === null) {
    return null;
  }

  return Object.freeze({
    center: Object.freeze({
      x: collider.center.x,
      y: collider.center.y,
      z: collider.center.z
    }),
    shape: "box",
    size: Object.freeze({
      x: collider.size.x,
      y: collider.size.y,
      z: collider.size.z
    })
  });
}

function resolveEnvironmentDynamicBody(
  dynamicBody:
    | {
        readonly additionalMass: number;
        readonly angularDamping: number;
        readonly gravityScale: number;
        readonly kind: "dynamic-rigid-body";
        readonly linearDamping: number;
        readonly lockRotations: boolean;
      }
    | null
): MetaverseEnvironmentDynamicBodyProofConfig | null {
  if (dynamicBody === null) {
    return null;
  }

  return Object.freeze({
    additionalMass: dynamicBody.additionalMass,
    angularDamping: dynamicBody.angularDamping,
    gravityScale: dynamicBody.gravityScale,
    kind: dynamicBody.kind,
    linearDamping: dynamicBody.linearDamping,
    lockRotations: dynamicBody.lockRotations
  });
}

function resolveSharedEnvironmentPhysicsColliders(
  colliders: readonly {
    readonly center: { readonly x: number; readonly y: number; readonly z: number };
    readonly size: { readonly x: number; readonly y: number; readonly z: number };
    readonly traversalAffordance: "support" | "blocker";
  }[]
): readonly MetaverseEnvironmentPhysicsColliderProofConfig[] {
  return Object.freeze(
    colliders.map((collider) =>
      Object.freeze({
        center: Object.freeze({
          x: collider.center.x,
          y: collider.center.y,
          z: collider.center.z
        }),
        shape: "box",
        size: Object.freeze({
          x: collider.size.x,
          y: collider.size.y,
          z: collider.size.z
        }),
        traversalAffordance: collider.traversalAffordance
      })
    )
  );
}

function environmentVector3sMatch(
  actual: { readonly x: number; readonly y: number; readonly z: number },
  expected: { readonly x: number; readonly y: number; readonly z: number },
  tolerance = 0.000001
): boolean {
  return (
    Math.abs(actual.x - expected.x) <= tolerance &&
    Math.abs(actual.y - expected.y) <= tolerance &&
    Math.abs(actual.z - expected.z) <= tolerance
  );
}

function assertProceduralBoxColliderMatchesVisualBounds(
  environmentDescriptor: EnvironmentAssetDescriptor,
  bundleEnvironmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    never
  > & {
    readonly surfaceColliders: readonly {
      readonly center: { readonly x: number; readonly y: number; readonly z: number };
      readonly size: { readonly x: number; readonly y: number; readonly z: number };
      readonly traversalAffordance: "support" | "blocker";
    }[];
    readonly traversalAffordance: "support" | "blocker" | "mount";
  }
): void {
  if (
    environmentDescriptor.dynamicBody != null ||
    environmentDescriptor.collisionPath !== null ||
    environmentDescriptor.traversalAffordance === "mount"
  ) {
    return;
  }

  if (
    !environmentDescriptor.renderModel.lods.every(
      isEnvironmentProceduralBoxLodDescriptor
    )
  ) {
    return;
  }

  const [firstProceduralLod] = environmentDescriptor.renderModel.lods;

  if (firstProceduralLod === undefined) {
    return;
  }

  for (const lod of environmentDescriptor.renderModel.lods) {
    if (
      !environmentVector3sMatch(lod.size, firstProceduralLod.size)
    ) {
      throw new Error(
        `Metaverse procedural box asset ${environmentDescriptor.label} requires every procedural LOD to share the same size.`
      );
    }
  }

  if (bundleEnvironmentAsset.surfaceColliders.length !== 1) {
    throw new Error(
      `Metaverse procedural box asset ${environmentDescriptor.label} requires exactly one exact-match surface collider.`
    );
  }

  const [surfaceCollider] = bundleEnvironmentAsset.surfaceColliders;

  if (
    surfaceCollider === undefined ||
    !environmentVector3sMatch(surfaceCollider.size, firstProceduralLod.size)
  ) {
    throw new Error(
      `Metaverse procedural box asset ${environmentDescriptor.label} requires collider size to match render size exactly.`
    );
  }

  const expectedCenter = {
    x: 0,
    y: firstProceduralLod.size.y * 0.5,
    z: 0
  };

  if (!environmentVector3sMatch(surfaceCollider.center, expectedCenter)) {
    throw new Error(
      `Metaverse procedural box asset ${environmentDescriptor.label} requires collider center to match render bounds exactly.`
    );
  }

  if (
    surfaceCollider.traversalAffordance !==
    environmentDescriptor.traversalAffordance
  ) {
    throw new Error(
      `Metaverse procedural box asset ${environmentDescriptor.label} requires collider affordance to match the asset affordance.`
    );
  }
}

function resolveEnvironmentSeats(
  seats: readonly EnvironmentSeatDescriptor[] | null
): readonly MetaverseEnvironmentSeatProofConfig[] | null {
  if (seats === null) {
    return null;
  }

  return Object.freeze(
    seats.map((seat) =>
      Object.freeze({
        cameraPolicyId: seat.cameraPolicyId,
        controlRoutingPolicyId: seat.controlRoutingPolicyId,
        directEntryEnabled: seat.directEntryEnabled,
        dismountOffset: Object.freeze({
          x: seat.dismountOffset.x,
          y: seat.dismountOffset.y,
          z: seat.dismountOffset.z
        }),
        label: seat.label,
        lookLimitPolicyId: seat.lookLimitPolicyId,
        occupancyAnimationId: seat.occupancyAnimationId,
        seatId: seat.seatId,
        seatNodeName: seat.seatNodeName,
        seatRole: seat.seatRole
      })
    )
  );
}

function resolveEnvironmentEntries(
  entries: readonly EnvironmentEntryDescriptor[] | null
): readonly MetaverseEnvironmentEntryProofConfig[] | null {
  if (entries === null) {
    return null;
  }

  return Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        cameraPolicyId: entry.cameraPolicyId,
        controlRoutingPolicyId: entry.controlRoutingPolicyId,
        dismountOffset: Object.freeze({
          x: entry.dismountOffset.x,
          y: entry.dismountOffset.y,
          z: entry.dismountOffset.z
        }),
        entryId: entry.entryId,
        entryNodeName: entry.entryNodeName,
        label: entry.label,
        lookLimitPolicyId: entry.lookLimitPolicyId,
        occupancyAnimationId: entry.occupancyAnimationId,
        occupantRole: entry.occupantRole
      })
    )
  );
}

function assertSharedMountedSeatAuthoringMatchesEnvironmentDescriptor(
  environmentDescriptor: Pick<EnvironmentAssetDescriptor, "id" | "label" | "seats">,
  sharedSurfaceAsset: Pick<MetaverseEnvironmentAssetProofConfig, never> & {
    readonly seats?: readonly import("@webgpu-metaverse/shared").MetaverseWorldMountedSeatAuthoring[] | null;
  }
): void {
  const descriptorSeats = environmentDescriptor.seats;
  const sharedSeats = sharedSurfaceAsset.seats ?? null;

  if (descriptorSeats === null && sharedSeats === null) {
    return;
  }

  if (descriptorSeats === null || sharedSeats === null) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} mounted seat authoring drifted from shared world truth.`
    );
  }

  if (descriptorSeats.length !== sharedSeats.length) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} mounted seat count drifted from shared world truth.`
    );
  }

  for (const descriptorSeat of descriptorSeats) {
    const sharedSeat = readMetaverseWorldMountedSeatAuthoring(
      sharedSurfaceAsset,
      descriptorSeat.seatId
    );

    if (
      sharedSeat === null ||
      sharedSeat.cameraPolicyId !== descriptorSeat.cameraPolicyId ||
      sharedSeat.controlRoutingPolicyId !== descriptorSeat.controlRoutingPolicyId ||
      sharedSeat.directEntryEnabled !== descriptorSeat.directEntryEnabled ||
      sharedSeat.label !== descriptorSeat.label ||
      sharedSeat.lookLimitPolicyId !== descriptorSeat.lookLimitPolicyId ||
      sharedSeat.occupancyAnimationId !== descriptorSeat.occupancyAnimationId ||
      sharedSeat.seatRole !== descriptorSeat.seatRole
    ) {
      throw new Error(
        `Metaverse environment asset ${environmentDescriptor.label} mounted seat ${descriptorSeat.seatId} drifted from shared world truth.`
      );
    }
  }
}

function assertSharedMountedEntryAuthoringMatchesEnvironmentDescriptor(
  environmentDescriptor: Pick<EnvironmentAssetDescriptor, "entries" | "id" | "label">,
  sharedSurfaceAsset: Pick<MetaverseEnvironmentAssetProofConfig, never> & {
    readonly entries?: readonly import("@webgpu-metaverse/shared").MetaverseWorldMountedEntryAuthoring[] | null;
  }
): void {
  const descriptorEntries = environmentDescriptor.entries;
  const sharedEntries = sharedSurfaceAsset.entries ?? null;

  if (descriptorEntries === null && sharedEntries === null) {
    return;
  }

  if (descriptorEntries === null || sharedEntries === null) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} mounted entry authoring drifted from shared world truth.`
    );
  }

  if (descriptorEntries.length !== sharedEntries.length) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} mounted entry count drifted from shared world truth.`
    );
  }

  for (const descriptorEntry of descriptorEntries) {
    const sharedEntry = readMetaverseWorldMountedEntryAuthoring(
      sharedSurfaceAsset,
      descriptorEntry.entryId
    );

    if (
      sharedEntry === null ||
      sharedEntry.cameraPolicyId !== descriptorEntry.cameraPolicyId ||
      sharedEntry.controlRoutingPolicyId !== descriptorEntry.controlRoutingPolicyId ||
      sharedEntry.label !== descriptorEntry.label ||
      sharedEntry.lookLimitPolicyId !== descriptorEntry.lookLimitPolicyId ||
      sharedEntry.occupancyAnimationId !== descriptorEntry.occupancyAnimationId ||
      sharedEntry.occupantRole !== descriptorEntry.occupantRole
    ) {
      throw new Error(
        `Metaverse environment asset ${environmentDescriptor.label} mounted entry ${descriptorEntry.entryId} drifted from shared world truth.`
      );
    }
  }
}

function resolveEnvironmentOrientation(
  orientation: EnvironmentAssetDescriptor["orientation"]
): MetaverseEnvironmentAssetProofConfig["orientation"] {
  if (orientation === null) {
    return null;
  }

  if (!Number.isFinite(orientation.forwardModelYawRadians)) {
    throw new Error(
      "Metaverse vehicle orientation metadata requires a finite forward model yaw."
    );
  }

  return Object.freeze({
    forwardModelYawRadians: normalizePlanarYawRadians(
      orientation.forwardModelYawRadians
    )
  });
}

function resolveMetaverseEnvironmentAssetProofConfig(
  bundleEnvironmentAsset: {
    readonly collisionPath: string | null;
    readonly collider: {
      readonly center: { readonly x: number; readonly y: number; readonly z: number };
      readonly size: { readonly x: number; readonly y: number; readonly z: number };
    } | null;
    readonly dynamicBody: {
      readonly additionalMass: number;
      readonly angularDamping: number;
      readonly gravityScale: number;
      readonly kind: "dynamic-rigid-body";
      readonly linearDamping: number;
      readonly lockRotations: boolean;
    } | null;
    readonly entries?: readonly import("@webgpu-metaverse/shared").MetaverseWorldMountedEntryAuthoring[] | null;
    readonly placementMode: "dynamic" | "instanced" | "static";
    readonly seats?: readonly import("@webgpu-metaverse/shared").MetaverseWorldMountedSeatAuthoring[] | null;
    readonly surfaceColliders: readonly {
      readonly center: { readonly x: number; readonly y: number; readonly z: number };
      readonly size: { readonly x: number; readonly y: number; readonly z: number };
      readonly traversalAffordance: "support" | "blocker";
    }[];
    readonly traversalAffordance: "support" | "blocker" | "mount";
  },
  environmentDescriptor: EnvironmentAssetDescriptor,
  placements: readonly MetaverseEnvironmentPlacementProofConfig[],
  characterProofConfig: MetaverseCharacterProofConfig
): MetaverseEnvironmentAssetProofConfig {
  if (placements.length === 0) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} requires at least one placement.`
    );
  }

  if (bundleEnvironmentAsset.placementMode !== environmentDescriptor.placement) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} placement drifted from shared world authoring.`
    );
  }

  if (
    bundleEnvironmentAsset.traversalAffordance !==
    environmentDescriptor.traversalAffordance
  ) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} traversal affordance drifted from shared world authoring.`
    );
  }

  assertSharedMountedSeatAuthoringMatchesEnvironmentDescriptor(
    environmentDescriptor,
    bundleEnvironmentAsset
  );
  assertSharedMountedEntryAuthoringMatchesEnvironmentDescriptor(
    environmentDescriptor,
    bundleEnvironmentAsset
  );

  const sharedCollider = resolveEnvironmentCollider(bundleEnvironmentAsset.collider);
  const sharedDynamicBody = resolveEnvironmentDynamicBody(
    bundleEnvironmentAsset.dynamicBody
  );
  const usesCollisionMeshSurfaceSupport =
    bundleEnvironmentAsset.collisionPath !== null && sharedDynamicBody === null;
  const sharedPhysicsColliders = usesCollisionMeshSurfaceSupport
    ? null
    : resolveSharedEnvironmentPhysicsColliders(
        bundleEnvironmentAsset.surfaceColliders
      );

  assertProceduralBoxColliderMatchesVisualBounds(
    environmentDescriptor,
    bundleEnvironmentAsset
  );

  if (bundleEnvironmentAsset.traversalAffordance === "mount") {
    if (environmentDescriptor.placement !== "dynamic") {
      throw new Error(
        `Metaverse environment asset ${environmentDescriptor.label} may only use mount affordance on dynamic placement.`
      );
    }
  } else if (
    environmentDescriptor.seats !== null ||
    environmentDescriptor.entries !== null
  ) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} cannot expose mount metadata without mount affordance.`
    );
  }

  if (environmentDescriptor.placement === "dynamic") {
    if (bundleEnvironmentAsset.collider === null) {
      throw new Error(
        `Metaverse dynamic environment asset ${environmentDescriptor.label} requires collider metadata.`
      );
    }

    if (bundleEnvironmentAsset.traversalAffordance === "mount") {
      if (sharedDynamicBody !== null) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} cannot combine mount affordance with an authored dynamic body.`
        );
      }

      if (
        sharedPhysicsColliders !== null &&
        sharedPhysicsColliders.length === 0
      ) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires physics colliders for hull and deck collision.`
        );
      }

      if (
        sharedPhysicsColliders !== null &&
        !sharedPhysicsColliders.some(
          (collider) => collider.traversalAffordance === "support"
        )
      ) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires at least one support collider for boarding surfaces.`
        );
      }

      if (environmentDescriptor.seats === null || environmentDescriptor.seats.length === 0) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires seat metadata.`
        );
      }

      if (environmentDescriptor.orientation === null) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires vehicle orientation metadata.`
        );
      }

      const seatIds = new Set<string>();
      const entryIds = new Set<string>();
      let directEntrySeatCount = 0;

      for (const seat of environmentDescriptor.seats) {
        if (seatIds.has(seat.seatId)) {
          throw new Error(
            `Metaverse dynamic environment asset ${environmentDescriptor.label} has duplicate seat id ${seat.seatId}.`
          );
        }

        seatIds.add(seat.seatId);

        if (seat.directEntryEnabled) {
          directEntrySeatCount += 1;
        }
      }

      for (const entry of environmentDescriptor.entries ?? []) {
        if (entryIds.has(entry.entryId)) {
          throw new Error(
            `Metaverse dynamic environment asset ${environmentDescriptor.label} has duplicate entry id ${entry.entryId}.`
          );
        }

        entryIds.add(entry.entryId);
      }

      if (
        directEntrySeatCount === 0 &&
        (environmentDescriptor.entries === null ||
          environmentDescriptor.entries.length === 0)
      ) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires a direct seat or boarding entry.`
        );
      }

      if (!characterProofConfig.socketNames.includes("seat_socket")) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires character socket seat_socket.`
        );
      }
    } else if (
      environmentDescriptor.seats !== null ||
      environmentDescriptor.entries !== null
    ) {
      throw new Error(
        `Metaverse non-mounted dynamic environment asset ${environmentDescriptor.label} cannot expose mount metadata.`
      );
    }

    if (environmentDescriptor.renderModel.lods.length !== 1) {
      throw new Error(
        `Metaverse dynamic environment asset ${environmentDescriptor.label} must stay single-LOD until seat switching is implemented.`
      );
    }
  }

  return Object.freeze({
    collisionPath: bundleEnvironmentAsset.collisionPath,
    collider: sharedCollider,
    dynamicBody: sharedDynamicBody,
    entries: resolveEnvironmentEntries(environmentDescriptor.entries),
    environmentAssetId: environmentDescriptor.id,
    label: environmentDescriptor.label,
    lods: resolveEnvironmentLods(environmentDescriptor.renderModel),
    orientation: resolveEnvironmentOrientation(environmentDescriptor.orientation),
    placement: environmentDescriptor.placement,
    placements,
    physicsColliders: sharedPhysicsColliders,
    seats: resolveEnvironmentSeats(environmentDescriptor.seats),
    traversalAffordance: bundleEnvironmentAsset.traversalAffordance
  });
}

export function loadMetaverseEnvironmentProofConfig(
  bundleId: string,
  characterProofConfig: MetaverseCharacterProofConfig = metaverseCharacterProofConfig
): MetaverseEnvironmentProofConfig {
  const loadedBundle = loadMetaverseMapBundle(bundleId);
  const assets = loadedBundle.bundle.environmentAssets.map((environmentAsset) => {
    const environmentDescriptor = environmentPropManifest.environmentAssets.find(
      (entry) => entry.id === environmentAsset.assetId
    );

    if (environmentDescriptor === undefined) {
      throw new Error(
        `Metaverse environment manifest is missing ${environmentAsset.assetId}.`
      );
    }

    const placements = Object.freeze(
      environmentAsset.placements.map((placement) =>
        Object.freeze({
          position: Object.freeze({
            x: placement.position.x,
            y: placement.position.y,
            z: placement.position.z
          }),
          rotationYRadians: placement.rotationYRadians,
          scale: placement.scale
        } satisfies MetaverseEnvironmentPlacementProofConfig)
      )
    );

    return resolveMetaverseEnvironmentAssetProofConfig(
      environmentAsset,
      environmentDescriptor,
      placements,
      characterProofConfig
    );
  });

  if (!assets.some((asset) => asset.placement === "instanced")) {
    throw new Error("Metaverse environment proof slice requires one instanced asset family.");
  }

  if (!assets.some((asset) => asset.placement === "static")) {
    throw new Error("Metaverse environment proof slice requires one static asset family.");
  }

  if (!assets.some((asset) => asset.lods.length >= 2)) {
    throw new Error("Metaverse environment proof slice requires at least one multi-tier LOD asset.");
  }

  if (!assets.some((asset) => asset.placement === "dynamic")) {
    throw new Error("Metaverse environment proof slice requires one dynamic mountable asset.");
  }

  return Object.freeze({
    assets: Object.freeze(assets)
  });
}

export const metaverseEnvironmentProofConfig = loadMetaverseEnvironmentProofConfig(
  resolveDefaultMetaverseWorldBundleId(),
  metaverseCharacterProofConfig
);
