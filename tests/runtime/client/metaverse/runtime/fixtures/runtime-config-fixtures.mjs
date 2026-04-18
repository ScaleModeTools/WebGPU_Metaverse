import {
  authoredWaterBayOpenWaterSpawn,
  authoredWaterBaySkiffBoardingGroundedSpawnPosition,
  authoredWaterBaySkiffBoardingYawRadians,
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../../../metaverse-authored-world-test-fixtures.mjs";

export const shippedWaterBayOpenWaterSpawn = authoredWaterBayOpenWaterSpawn;

export const shippedWaterBayCameraSpawn = Object.freeze({
  x: shippedWaterBayOpenWaterSpawn.x,
  y: shippedWaterBayOpenWaterSpawn.y + 1.62,
  z: shippedWaterBayOpenWaterSpawn.z
});

export const shippedWaterBaySkiffPlacement = authoredWaterBaySkiffPlacement;
export const shippedWaterBaySkiffYawRadians = authoredWaterBaySkiffYawRadians;

export function createOpenWaterSpawnRuntimeConfig(metaverseRuntimeConfig) {
  return {
    ...metaverseRuntimeConfig,
    camera: {
      ...metaverseRuntimeConfig.camera,
      initialYawRadians: 0,
      spawnPosition: shippedWaterBayCameraSpawn
    },
    groundedBody: {
      ...metaverseRuntimeConfig.groundedBody,
      spawnPosition: shippedWaterBayOpenWaterSpawn
    }
  };
}

export function createSkiffBoardingRuntimeConfig(metaverseRuntimeConfig) {
  return {
    ...metaverseRuntimeConfig,
    camera: {
      ...metaverseRuntimeConfig.camera,
      initialYawRadians: authoredWaterBaySkiffBoardingYawRadians,
      spawnPosition: {
        x: authoredWaterBaySkiffBoardingGroundedSpawnPosition.x,
        y: authoredWaterBaySkiffBoardingGroundedSpawnPosition.y + 1.62,
        z: authoredWaterBaySkiffBoardingGroundedSpawnPosition.z
      }
    },
    groundedBody: {
      ...metaverseRuntimeConfig.groundedBody,
      spawnPosition: authoredWaterBaySkiffBoardingGroundedSpawnPosition
    },
    portals: []
  };
}
