import type {
  MetaverseMapBundleSceneObjectLaunchTargetCapabilitySnapshot,
  MetaverseMapBundleSceneObjectSnapshot,
  MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type { MetaversePortalConfig } from "../../types/runtime-config";

function isLaunchTargetCapability(
  capability: MetaverseMapBundleSceneObjectSnapshot["capabilities"][number]
): capability is MetaverseMapBundleSceneObjectLaunchTargetCapabilitySnapshot {
  return capability.kind === "launch-target";
}

export function readMetaverseMapBundleLaunchTargetCapability(
  sceneObject: MetaverseMapBundleSceneObjectSnapshot
): MetaverseMapBundleSceneObjectLaunchTargetCapabilitySnapshot | null {
  return (
    sceneObject.capabilities.find(isLaunchTargetCapability) ?? null
  );
}

export function resolveMetaversePortalConfigsFromBundle(
  bundle: MetaverseMapBundleSnapshot
): readonly MetaversePortalConfig[] {
  return Object.freeze(
    bundle.sceneObjects.flatMap((sceneObject) => {
      const launchTargetCapability =
        readMetaverseMapBundleLaunchTargetCapability(sceneObject);

      if (launchTargetCapability === null) {
        return [];
      }

      return [
        Object.freeze({
          beamColor: launchTargetCapability.beamColor,
          experienceId: launchTargetCapability.experienceId,
          highlightRadius: launchTargetCapability.highlightRadius,
          interactionRadius: launchTargetCapability.interactionRadius,
          label: sceneObject.label,
          position: sceneObject.position,
          ringColor: launchTargetCapability.ringColor
        } satisfies MetaversePortalConfig)
      ];
    })
  );
}
