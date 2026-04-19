import {
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians
} from "../../../metaverse-world-spawn-config.js";
import {
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions
} from "../../../metaverse-world-surface-authoring.js";
import { resolveMetaverseWorldSurfaceScaleVector } from "../../../metaverse-world-surface-query.js";
import { defaultMetaverseGameplayProfileId } from "../../metaverse-gameplay-profiles.js";
import type { MetaverseMapBundleSnapshot } from "../metaverse-map-bundle.js";

function createPlacementId(
  assetId: string,
  placementIndex: number
): string {
  return `${assetId}:placement:${placementIndex + 1}`;
}

function createRgbTuple(
  red: number,
  green: number,
  blue: number
): readonly [number, number, number] {
  return Object.freeze([red, green, blue]);
}

function resolveExportedSurfaceColliders(
  surfaceAsset: (typeof metaverseWorldSurfaceAssets)[number]
) {
  return surfaceAsset.collisionPath === null
    ? surfaceAsset.surfaceColliders
    : Object.freeze([]);
}

export const stagingGroundMapBundle = Object.freeze({
  description:
    "Shared staging-ground shell map bundle adapter over the current authored surface slice.",
  environmentAssets: Object.freeze(
    metaverseWorldSurfaceAssets
      .filter((surfaceAsset) => surfaceAsset.placements.length > 0)
      .map((surfaceAsset) =>
      Object.freeze({
        assetId: surfaceAsset.environmentAssetId,
        collisionPath: surfaceAsset.collisionPath,
        collider: surfaceAsset.collider,
        dynamicBody: surfaceAsset.dynamicBody,
        entries:
          "entries" in surfaceAsset ? surfaceAsset.entries ?? null : null,
        placementMode: surfaceAsset.placement,
        placements: Object.freeze(
          surfaceAsset.placements.map((placement, placementIndex) =>
            Object.freeze({
              collisionEnabled: true,
              isVisible: true,
              materialReferenceId: null,
              notes: "",
              placementId: createPlacementId(
                surfaceAsset.environmentAssetId,
                placementIndex
              ),
              position: placement.position,
              rotationYRadians: placement.rotationYRadians,
              scale: resolveMetaverseWorldSurfaceScaleVector(placement.scale)
            })
          )
        ),
        seats: "seats" in surfaceAsset ? surfaceAsset.seats ?? null : null,
        surfaceColliders: resolveExportedSurfaceColliders(surfaceAsset),
        traversalAffordance: surfaceAsset.traversalAffordance
      })
    )
  ),
  gameplayProfileId: defaultMetaverseGameplayProfileId,
  label: "Staging Ground",
  launchVariations: Object.freeze([
    Object.freeze({
      description: "Stay in the shell and preview the authored staging-ground map.",
      experienceId: null,
      gameplayVariationId: null,
      label: "Free Roam",
      sessionMode: null,
      variationId: "shell-free-roam",
      vehicleLayoutId: null,
      weaponLayoutId: null
    }),
    Object.freeze({
      description:
        "Launch the current Duck Hunt preview slice from this authored map variation.",
      experienceId: "duck-hunt",
      gameplayVariationId: "duck-hunt-standard-preview",
      label: "Duck Hunt Preview",
      sessionMode: "single-player",
      variationId: "duck-hunt-preview",
      vehicleLayoutId: "staging-ground-default-vehicle-layout",
      weaponLayoutId: "duck-hunt-default-pistol-layout"
    })
  ]),
  mapId: "staging-ground",
  playerSpawnNodes: Object.freeze([
    Object.freeze({
      label: "Default shell spawn",
      position: metaverseWorldGroundedSpawnPosition,
      spawnId: "shell-default-spawn",
      yawRadians: metaverseWorldInitialYawRadians
    })
  ]),
  presentationProfileIds: Object.freeze({
    cameraProfileId: "shell-default-camera",
    characterPresentationProfileId: "shell-default-character-presentation",
    environmentPresentationProfileId: "shell-default-environment-presentation",
    hudProfileId: "shell-default-hud"
  }),
  resourceSpawns: Object.freeze([]),
  sceneObjects: Object.freeze([
    Object.freeze({
      assetId: null,
      capabilities: Object.freeze([
        Object.freeze({
          beamColor: createRgbTuple(0.96, 0.81, 0.38),
          experienceId: "duck-hunt",
          highlightRadius: 34,
          interactionRadius: 18,
          kind: "launch-target",
          ringColor: createRgbTuple(0.96, 0.73, 0.25)
        })
      ]),
      label: "Duck Hunt!",
      objectId: "duck-hunt-launch-portal",
      position: Object.freeze({
        x: 0,
        y: 6,
        z: -34
      }),
      rotationYRadians: 0,
      scale: 1
    })
  ]),
  waterRegions: metaverseWorldWaterRegions
} satisfies MetaverseMapBundleSnapshot);
