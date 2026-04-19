import { resolveMetaverseWorldSurfaceScaleVector } from "@webgpu-metaverse/shared/metaverse/world";
import { Group, Matrix4, Mesh, Quaternion, Vector3 } from "three/webgpu";

import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot
} from "@/physics";
import type {
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentPhysicsColliderProofConfig,
  MetaverseEnvironmentPlacementProofConfig
} from "../types/metaverse-runtime";

export interface MetaversePlacedCuboidColliderSnapshot {
  readonly shape?: "box" | "trimesh";
  readonly ownerEnvironmentAssetId: string | null;
  readonly rotationYRadians: number;
  readonly traversalAffordance:
    MetaverseEnvironmentPhysicsColliderProofConfig["traversalAffordance"];
  readonly halfExtents: PhysicsVector3Snapshot;
  readonly indices?: Uint32Array;
  readonly rotation: PhysicsQuaternionSnapshot;
  readonly translation: PhysicsVector3Snapshot;
  readonly vertices?: Float32Array;
}

export interface MetaverseTriMeshColliderSnapshot {
  readonly indices: Uint32Array;
  readonly vertices: Float32Array;
}

const identityQuaternion = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  w: 1
} satisfies PhysicsQuaternionSnapshot);

function freezeVector3(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

function freezeQuaternion(
  x: number,
  y: number,
  z: number,
  w: number
): PhysicsQuaternionSnapshot {
  const magnitude = Math.hypot(x, y, z, w);

  if (magnitude <= 0.000001) {
    return identityQuaternion;
  }

  return Object.freeze({
    x: x / magnitude,
    y: y / magnitude,
    z: z / magnitude,
    w: w / magnitude
  });
}

function createPlacementQuaternion(
  rotationYRadians: number
): PhysicsQuaternionSnapshot {
  const halfAngle = rotationYRadians * 0.5;

  return freezeQuaternion(0, Math.sin(halfAngle), 0, Math.cos(halfAngle));
}

function applyPlacementToLocalCenter(
  localCenter: MetaverseEnvironmentColliderProofConfig["center"],
  placement: MetaverseEnvironmentPlacementProofConfig
): PhysicsVector3Snapshot {
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);
  const scaledCenterX = localCenter.x * scaleVector.x;
  const scaledCenterY = localCenter.y * scaleVector.y;
  const scaledCenterZ = localCenter.z * scaleVector.z;
  const sine = Math.sin(placement.rotationYRadians);
  const cosine = Math.cos(placement.rotationYRadians);

  return freezeVector3(
    placement.position.x + scaledCenterX * cosine + scaledCenterZ * sine,
    placement.position.y + scaledCenterY,
    placement.position.z - scaledCenterX * sine + scaledCenterZ * cosine
  );
}

function createDynamicPosePlacement(
  environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "placement" | "placements"
  >,
  poseSnapshot: {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }
): MetaverseEnvironmentPlacementProofConfig | null {
  if (
    environmentAsset.placement !== "dynamic" ||
    environmentAsset.placements.length !== 1
  ) {
    return null;
  }

  const authoredPlacement = environmentAsset.placements[0]!;

  return Object.freeze({
    position: freezeVector3(
      poseSnapshot.position.x,
      poseSnapshot.position.y,
      poseSnapshot.position.z
    ),
    rotationYRadians: poseSnapshot.yawRadians,
    scale: authoredPlacement.scale
  });
}

export function resolvePlacedCuboidColliders(
  environmentAsset: MetaverseEnvironmentAssetProofConfig
): readonly MetaversePlacedCuboidColliderSnapshot[] {
  if (
    environmentAsset.placement === "dynamic" ||
    environmentAsset.physicsColliders === null
  ) {
    return Object.freeze([]);
  }

  const colliders: MetaversePlacedCuboidColliderSnapshot[] = [];

  for (const placement of environmentAsset.placements) {
    const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);

    for (const collider of environmentAsset.physicsColliders) {
      colliders.push(
        Object.freeze({
          halfExtents: freezeVector3(
            Math.abs(collider.size.x * scaleVector.x) * 0.5,
            Math.abs(collider.size.y * scaleVector.y) * 0.5,
            Math.abs(collider.size.z * scaleVector.z) * 0.5
          ),
          ownerEnvironmentAssetId: environmentAsset.environmentAssetId,
          rotationYRadians: placement.rotationYRadians,
          rotation: createPlacementQuaternion(placement.rotationYRadians),
          shape: "box",
          translation: applyPlacementToLocalCenter(collider.center, placement),
          traversalAffordance: collider.traversalAffordance
        })
      );
    }
  }

  return Object.freeze(colliders);
}

export function resolveDynamicEnvironmentCuboidColliders(
  environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "environmentAssetId" | "physicsColliders" | "placement" | "placements"
  >,
  poseSnapshot: {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }
): readonly MetaversePlacedCuboidColliderSnapshot[] {
  const dynamicPlacement = createDynamicPosePlacement(
    environmentAsset,
    poseSnapshot
  );

  if (
    dynamicPlacement === null ||
    environmentAsset.physicsColliders === null
  ) {
    return Object.freeze([]);
  }

  return Object.freeze(
    environmentAsset.physicsColliders.map((collider) => {
      const scaleVector = resolveMetaverseWorldSurfaceScaleVector(
        dynamicPlacement.scale
      );

      return Object.freeze({
        halfExtents: freezeVector3(
          Math.abs(collider.size.x * scaleVector.x) * 0.5,
          Math.abs(collider.size.y * scaleVector.y) * 0.5,
          Math.abs(collider.size.z * scaleVector.z) * 0.5
        ),
        ownerEnvironmentAssetId: environmentAsset.environmentAssetId,
        rotationYRadians: dynamicPlacement.rotationYRadians,
        rotation: createPlacementQuaternion(dynamicPlacement.rotationYRadians),
        shape: "box",
        translation: applyPlacementToLocalCenter(
          collider.center,
          dynamicPlacement
        ),
        traversalAffordance: collider.traversalAffordance
      });
    })
  );
}

function appendMeshTriangles(
  targetVertices: number[],
  targetIndices: number[],
  mesh: Mesh,
  placementMatrix: Matrix4
): void {
  const geometry = mesh.geometry;
  const positionAttribute = geometry.getAttribute("position");

  if (positionAttribute === undefined || positionAttribute.itemSize !== 3) {
    return;
  }

  const transformMatrix = new Matrix4()
    .copy(placementMatrix)
    .multiply(mesh.matrixWorld);
  const transformedVertex = new Vector3();
  const vertexIndexOffset = targetVertices.length / 3;

  for (let index = 0; index < positionAttribute.count; index += 1) {
    transformedVertex
      .set(
        positionAttribute.getX(index),
        positionAttribute.getY(index),
        positionAttribute.getZ(index)
      )
      .applyMatrix4(transformMatrix);
    targetVertices.push(
      transformedVertex.x,
      transformedVertex.y,
      transformedVertex.z
    );
  }

  if (geometry.index !== null) {
    for (let index = 0; index < geometry.index.count; index += 1) {
      targetIndices.push(vertexIndexOffset + geometry.index.getX(index));
    }

    return;
  }

  for (let index = 0; index < positionAttribute.count; index += 1) {
    targetIndices.push(vertexIndexOffset + index);
  }
}

function createPlacementMatrix(
  placement: MetaverseEnvironmentPlacementProofConfig
): Matrix4 {
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);

  return new Matrix4().compose(
    new Vector3(
      placement.position.x,
      placement.position.y,
      placement.position.z
    ),
    new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      placement.rotationYRadians
    ),
    new Vector3(scaleVector.x, scaleVector.y, scaleVector.z)
  );
}

function resolveCollisionTriMeshesForPlacements(
  placements: readonly MetaverseEnvironmentPlacementProofConfig[],
  collisionScene: Group
): readonly MetaverseTriMeshColliderSnapshot[] {
  collisionScene.updateMatrixWorld(true);

  const meshColliders = placements.map((placement) => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const placementMatrix = createPlacementMatrix(placement);

    collisionScene.traverse((node) => {
      if ("isMesh" in node && node.isMesh === true) {
        appendMeshTriangles(vertices, indices, node as Mesh, placementMatrix);
      }
    });

    return Object.freeze({
      indices: Uint32Array.from(indices),
      vertices: Float32Array.from(vertices)
    });
  });

  return Object.freeze(
    meshColliders.filter(
      (collider) => collider.vertices.length > 0 && collider.indices.length > 0
    )
  );
}

export function resolveScaledCollisionTriMeshes(
  scale: MetaverseEnvironmentPlacementProofConfig["scale"],
  collisionScene: Group
): readonly MetaverseTriMeshColliderSnapshot[] {
  return resolveCollisionTriMeshesForPlacements(
    Object.freeze([
      Object.freeze({
        position: freezeVector3(0, 0, 0),
        rotationYRadians: 0,
        scale
      } satisfies MetaverseEnvironmentPlacementProofConfig)
    ]),
    collisionScene
  );
}

export function resolvePlacedCollisionTriMeshes(
  environmentAsset: MetaverseEnvironmentAssetProofConfig,
  collisionScene: Group
): readonly MetaverseTriMeshColliderSnapshot[] {
  if (environmentAsset.placement === "dynamic") {
    return Object.freeze([]);
  }

  return resolveCollisionTriMeshesForPlacements(
    environmentAsset.placements,
    collisionScene
  );
}

export function resolveDynamicCollisionTriMeshes(
  environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "placement" | "placements"
  >,
  collisionScene: Group
): readonly MetaverseTriMeshColliderSnapshot[] {
  if (
    environmentAsset.placement !== "dynamic" ||
    environmentAsset.placements.length !== 1
  ) {
    return Object.freeze([]);
  }

  return resolveCollisionTriMeshesForPlacements(
    Object.freeze([
      Object.freeze({
        position: freezeVector3(0, 0, 0),
        rotationYRadians: 0,
        scale: environmentAsset.placements[0]!.scale
      } satisfies MetaverseEnvironmentPlacementProofConfig)
    ]),
    collisionScene
  );
}
