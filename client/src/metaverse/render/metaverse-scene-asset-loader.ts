import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import type { MetaverseSceneAssetLoader } from "./characters/metaverse-scene-interactive-presentation-state";

export function createDefaultMetaverseSceneAssetLoader(): MetaverseSceneAssetLoader {
  return new GLTFLoader() as MetaverseSceneAssetLoader;
}
