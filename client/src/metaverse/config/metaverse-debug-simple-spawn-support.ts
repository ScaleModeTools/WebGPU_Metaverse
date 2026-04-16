import type { MetaverseWorldPlacedSurfaceColliderSnapshot } from "@webgpu-metaverse/shared";

function freezeVector3(x: number, y: number, z: number) {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

const identityQuaternion = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  w: 1
});

export const metaverseDebugSimpleSpawnSupportCollider = Object.freeze({
  halfExtents: freezeVector3(10, 0.3, 10),
  ownerEnvironmentAssetId: null,
  rotation: identityQuaternion,
  rotationYRadians: 0,
  translation: freezeVector3(-8.2, 0.3, -14.8),
  traversalAffordance: "support"
} satisfies MetaverseWorldPlacedSurfaceColliderSnapshot);
