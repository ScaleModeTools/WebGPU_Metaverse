import { BundleGroup, type Object3D } from "three/webgpu";

export function markMetaverseSceneBundleGroupsDirty(object: Object3D): void {
  object.traverse((node) => {
    if ("isBundleGroup" in node && node.isBundleGroup === true) {
      (node as BundleGroup).needsUpdate = true;
    }
  });
}
