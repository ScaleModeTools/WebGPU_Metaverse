import {
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3
} from "three/webgpu";

import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot
} from "@/physics";
import type {
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentPlacementProofConfig
} from "../types/metaverse-runtime";

export interface MetaversePlacedCuboidColliderSnapshot {
  readonly halfExtents: PhysicsVector3Snapshot;
  readonly rotation: PhysicsQuaternionSnapshot;
  readonly translation: PhysicsVector3Snapshot;
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
  const scaledCenterX = localCenter.x * placement.scale;
  const scaledCenterY = localCenter.y * placement.scale;
  const scaledCenterZ = localCenter.z * placement.scale;
  const sine = Math.sin(placement.rotationYRadians);
  const cosine = Math.cos(placement.rotationYRadians);

  return freezeVector3(
    placement.position.x + scaledCenterX * cosine + scaledCenterZ * sine,
    placement.position.y + scaledCenterY,
    placement.position.z - scaledCenterX * sine + scaledCenterZ * cosine
  );
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
    for (const collider of environmentAsset.physicsColliders) {
      colliders.push(
        Object.freeze({
          halfExtents: freezeVector3(
            Math.abs(collider.size.x * placement.scale) * 0.5,
            Math.abs(collider.size.y * placement.scale) * 0.5,
            Math.abs(collider.size.z * placement.scale) * 0.5
          ),
          rotation: createPlacementQuaternion(placement.rotationYRadians),
          translation: applyPlacementToLocalCenter(collider.center, placement)
        })
      );
    }
  }

  return Object.freeze(colliders);
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
    new Vector3(placement.scale, placement.scale, placement.scale)
  );
}

export function resolvePlacedCollisionTriMeshes(
  environmentAsset: MetaverseEnvironmentAssetProofConfig,
  collisionScene: Group
): readonly MetaverseTriMeshColliderSnapshot[] {
  if (
    environmentAsset.placement === "dynamic" ||
    environmentAsset.physicsColliders !== null
  ) {
    return Object.freeze([]);
  }

  collisionScene.updateMatrixWorld(true);

  const meshColliders = environmentAsset.placements.map((placement) => {
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
