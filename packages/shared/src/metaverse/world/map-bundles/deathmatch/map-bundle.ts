import { stagingGroundMapBundle } from "../staging-ground/map-bundle.js";
import { compileMetaverseMapBundleSemanticWorld } from "../compile-metaverse-semantic-world.js";
import type { MetaverseMapBundleSnapshot } from "../metaverse-map-bundle.js";

const semanticWorld = Object.freeze({
  ...stagingGroundMapBundle.semanticWorld
});
const compiledWorld = compileMetaverseMapBundleSemanticWorld(semanticWorld);

export const deathmatchMapBundle = Object.freeze({
  ...stagingGroundMapBundle,
  compiledWorld,
  description:
    "Dedicated shell team-deathmatch bundle over the current semantic staging-ground slice with the Duck Hunt portal removed.",
  environmentAssets: compiledWorld.compatibilityEnvironmentAssets,
  label: "Deathmatch",
  launchVariations: Object.freeze([
    Object.freeze({
      description:
        "Boot the deathmatch shell instance into authoritative red-vs-blue team deathmatch.",
      experienceId: null,
      gameplayVariationId: "metaverse-shell-team-deathmatch-v1",
      label: "Shell Team Deathmatch",
      matchMode: "team-deathmatch",
      variationId: "shell-team-deathmatch",
      vehicleLayoutId: null,
      weaponLayoutId: "metaverse-tdm-pistol-rocket-layout"
    })
  ]),
  mapId: "deathmatch",
  sceneObjects: Object.freeze([])
} satisfies MetaverseMapBundleSnapshot);
