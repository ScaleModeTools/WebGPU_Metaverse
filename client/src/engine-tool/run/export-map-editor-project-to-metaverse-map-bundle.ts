import type {
  MetaverseMapBundleEnvironmentAssetSnapshot,
  MetaverseMapBundleLaunchVariationSnapshot,
  MetaverseMapBundleSceneObjectSnapshot,
  MetaverseMapBundleSnapshot,
  MetaverseMapBundleSpawnNodeSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import type { EnvironmentPhysicsBoxColliderDescriptor } from "@/assets/types/environment-asset-manifest";
import type {
  MapEditorPlacementDraftSnapshot,
  MapEditorProjectSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import { loadMetaverseMapBundle } from "@/metaverse/world/map-bundles";

function toReadonlyRgbTuple(
  hexColor: string
): readonly [number, number, number] {
  const normalizedColor = hexColor.trim();

  if (!/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return Object.freeze([1, 1, 1]);
  }

  return Object.freeze([
    Number.parseInt(normalizedColor.slice(1, 3), 16) / 255,
    Number.parseInt(normalizedColor.slice(3, 5), 16) / 255,
    Number.parseInt(normalizedColor.slice(5, 7), 16) / 255
  ]);
}

function resolveSurfaceColliders(
  physicsColliders: readonly EnvironmentPhysicsBoxColliderDescriptor[] | null
): MetaverseMapBundleEnvironmentAssetSnapshot["surfaceColliders"] {
  if (physicsColliders === null) {
    return Object.freeze([]);
  }

  return Object.freeze(
    physicsColliders.map((collider) =>
      Object.freeze({
        center: Object.freeze({
          x: collider.center.x,
          y: collider.center.y,
          z: collider.center.z
        }),
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

function resolveCollider(
  collider: (typeof environmentPropManifest.environmentAssets)[number]["collider"]
): MetaverseMapBundleEnvironmentAssetSnapshot["collider"] {
  if (collider === null) {
    return null;
  }

  return Object.freeze({
    center: Object.freeze({
      x: collider.center.x,
      y: collider.center.y,
      z: collider.center.z
    }),
    size: Object.freeze({
      x: collider.size.x,
      y: collider.size.y,
      z: collider.size.z
    })
  });
}

function resolveDynamicBody(
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
    | undefined
): MetaverseMapBundleEnvironmentAssetSnapshot["dynamicBody"] {
  if (dynamicBody == null) {
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

function resolvePrimaryEnvironmentModelPath(
  environmentAsset: (typeof environmentPropManifest.environmentAssets)[number]
): string | null {
  for (const lod of environmentAsset.renderModel.lods) {
    if ("modelPath" in lod) {
      return lod.modelPath;
    }
  }

  return null;
}

function resolveCollisionPath(
  environmentAsset: (typeof environmentPropManifest.environmentAssets)[number]
): string | null {
  return environmentAsset.collisionPath ?? resolvePrimaryEnvironmentModelPath(environmentAsset);
}

function resolveEnvironmentEntries(
  environmentAsset: (typeof environmentPropManifest.environmentAssets)[number]
): MetaverseMapBundleEnvironmentAssetSnapshot["entries"] {
  if (environmentAsset.entries === null) {
    return null;
  }

  return Object.freeze(
    environmentAsset.entries.map((entry) =>
      Object.freeze({
        cameraPolicyId: entry.cameraPolicyId,
        controlRoutingPolicyId: entry.controlRoutingPolicyId,
        entryId: entry.entryId,
        label: entry.label,
        lookLimitPolicyId: entry.lookLimitPolicyId,
        occupancyAnimationId: entry.occupancyAnimationId,
        occupantRole: entry.occupantRole
      })
    )
  );
}

function resolveEnvironmentSeats(
  environmentAsset: (typeof environmentPropManifest.environmentAssets)[number]
): MetaverseMapBundleEnvironmentAssetSnapshot["seats"] {
  if (environmentAsset.seats === null) {
    return null;
  }

  return Object.freeze(
    environmentAsset.seats.map((seat) =>
      Object.freeze({
        cameraPolicyId: seat.cameraPolicyId,
        controlRoutingPolicyId: seat.controlRoutingPolicyId,
        directEntryEnabled: seat.directEntryEnabled,
        label: seat.label,
        lookLimitPolicyId: seat.lookLimitPolicyId,
        occupancyAnimationId: seat.occupancyAnimationId,
        seatId: seat.seatId,
        seatRole: seat.seatRole
      })
    )
  );
}

function freezePlacement(
  placementDraft: MapEditorPlacementDraftSnapshot
) {
  return Object.freeze({
    collisionEnabled: placementDraft.collisionEnabled,
    isVisible: placementDraft.isVisible,
    materialReferenceId: placementDraft.materialReferenceId,
    notes: placementDraft.notes,
    placementId: placementDraft.placementId,
    position: Object.freeze({
      x: placementDraft.position.x,
      y: placementDraft.position.y,
      z: placementDraft.position.z
    }),
    rotationYRadians: placementDraft.rotationYRadians,
    scale: Object.freeze({
      x: placementDraft.scale.x,
      y: placementDraft.scale.y,
      z: placementDraft.scale.z
    })
  });
}

function resolveEnvironmentAssets(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[]
): readonly MetaverseMapBundleEnvironmentAssetSnapshot[] {
  return Object.freeze(
    environmentPropManifest.environmentAssets.flatMap((environmentAsset) => {
      const placements = placementDrafts
        .filter((placementDraft) => placementDraft.assetId === environmentAsset.id)
        .map(freezePlacement);

      if (placements.length === 0) {
        return [];
      }

      const dynamicBody =
        "dynamicBody" in environmentAsset
          ? resolveDynamicBody(environmentAsset.dynamicBody)
          : null;

      return [
        Object.freeze({
          assetId: environmentAsset.id,
          collisionPath: resolveCollisionPath(environmentAsset),
          collider: resolveCollider(environmentAsset.collider),
          dynamicBody,
          entries: resolveEnvironmentEntries(environmentAsset),
          placementMode: environmentAsset.placement,
          placements: Object.freeze(placements),
          seats: resolveEnvironmentSeats(environmentAsset),
          surfaceColliders:
            environmentAsset.collisionPath !== null &&
            dynamicBody === null
              ? Object.freeze([])
              : resolveSurfaceColliders(environmentAsset.physicsColliders),
          traversalAffordance: environmentAsset.traversalAffordance
        } satisfies MetaverseMapBundleEnvironmentAssetSnapshot)
      ];
    })
  );
}

function resolvePlayerSpawnNodes(
  project: MapEditorProjectSnapshot
): readonly MetaverseMapBundleSpawnNodeSnapshot[] {
  return Object.freeze(
    project.playerSpawnDrafts.map((spawnDraft) =>
      Object.freeze({
        label: spawnDraft.label,
        position: Object.freeze({
          x: spawnDraft.position.x,
          y: spawnDraft.position.y,
          z: spawnDraft.position.z
        }),
        spawnId: spawnDraft.spawnId,
        teamId: spawnDraft.teamId,
        yawRadians: spawnDraft.yawRadians
      } satisfies MetaverseMapBundleSpawnNodeSnapshot)
    )
  );
}

function resolveSceneObjects(
  project: MapEditorProjectSnapshot
): readonly MetaverseMapBundleSceneObjectSnapshot[] {
  return Object.freeze(
    project.sceneObjectDrafts.map((sceneObjectDraft) =>
      Object.freeze({
        assetId: sceneObjectDraft.assetId,
        capabilities:
          sceneObjectDraft.launchTarget === null
            ? Object.freeze([])
            : Object.freeze([
                Object.freeze({
                  beamColor: toReadonlyRgbTuple(
                    sceneObjectDraft.launchTarget.beamColorHex
                  ),
                  experienceId: sceneObjectDraft.launchTarget.experienceId,
                  highlightRadius: sceneObjectDraft.launchTarget.highlightRadius,
                  interactionRadius:
                    sceneObjectDraft.launchTarget.interactionRadius,
                  kind: "launch-target" as const,
                  ringColor: toReadonlyRgbTuple(
                    sceneObjectDraft.launchTarget.ringColorHex
                  )
                })
              ]),
        label: sceneObjectDraft.label,
        objectId: sceneObjectDraft.objectId,
        position: Object.freeze({
          x: sceneObjectDraft.position.x,
          y: sceneObjectDraft.position.y,
          z: sceneObjectDraft.position.z
        }),
        rotationYRadians: sceneObjectDraft.rotationYRadians,
        scale: sceneObjectDraft.scale
      } satisfies MetaverseMapBundleSceneObjectSnapshot)
    )
  );
}

function resolveLaunchVariations(
  project: MapEditorProjectSnapshot
): readonly MetaverseMapBundleLaunchVariationSnapshot[] {
  return Object.freeze(
    project.launchVariationDrafts.map((launchVariationDraft) =>
      Object.freeze({
        description: launchVariationDraft.description,
        experienceId: launchVariationDraft.experienceId,
        gameplayVariationId: launchVariationDraft.gameplayVariationId,
        label: launchVariationDraft.label,
        sessionMode: launchVariationDraft.sessionMode,
        variationId: launchVariationDraft.variationId,
        vehicleLayoutId: launchVariationDraft.vehicleLayoutId,
        weaponLayoutId: launchVariationDraft.weaponLayoutId
      } satisfies MetaverseMapBundleLaunchVariationSnapshot)
    )
  );
}

export function exportMapEditorProjectToMetaverseMapBundle(
  project: MapEditorProjectSnapshot
): MetaverseMapBundleSnapshot {
  const loadedBundle = loadMetaverseMapBundle(project.bundleId);

  return Object.freeze({
    description: project.description,
    environmentAssets: resolveEnvironmentAssets(project.placementDrafts),
    gameplayProfileId: project.gameplayProfileId,
    label: project.bundleLabel,
    launchVariations: resolveLaunchVariations(project),
    mapId: project.bundleId,
    playerSpawnNodes: resolvePlayerSpawnNodes(project),
    playerSpawnSelection: Object.freeze({
      enemyAvoidanceRadiusMeters:
        project.playerSpawnSelectionDraft.enemyAvoidanceRadiusMeters,
      homeTeamBiasMeters: project.playerSpawnSelectionDraft.homeTeamBiasMeters
    }),
    presentationProfileIds: Object.freeze({
      cameraProfileId: project.cameraProfileId,
      characterPresentationProfileId: project.characterPresentationProfileId,
      environmentPresentationProfileId:
        project.environmentPresentationProfileId,
      hudProfileId: project.hudProfileId
    }),
    resourceSpawns: loadedBundle.bundle.resourceSpawns,
    sceneObjects: resolveSceneObjects(project),
    waterRegions: Object.freeze(
      project.waterRegionDrafts.map((waterRegionDraft) =>
        Object.freeze({
          center: Object.freeze({
            x: waterRegionDraft.center.x,
            y: waterRegionDraft.center.y,
            z: waterRegionDraft.center.z
          }),
          rotationYRadians: waterRegionDraft.rotationYRadians,
          size: Object.freeze({
            x: waterRegionDraft.size.x,
            y: waterRegionDraft.size.y,
            z: waterRegionDraft.size.z
          }),
          waterRegionId: waterRegionDraft.waterRegionId
        })
      )
    )
  });
}
