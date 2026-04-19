import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  resolveMetaverseWorldSurfaceScaleVector,
  type MetaverseWorldSurfaceScaleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

export interface MetaverseAuthoritativeCollisionTriMeshSnapshot {
  readonly indices: Uint32Array;
  readonly vertices: Float32Array;
}

interface GltfNodeDocument {
  readonly accessors?: readonly {
    readonly bufferView?: number;
    readonly byteOffset?: number;
    readonly componentType: number;
    readonly count: number;
    readonly type: string;
  }[];
  readonly bufferViews?: readonly {
    readonly buffer: number;
    readonly byteLength: number;
    readonly byteOffset?: number;
    readonly byteStride?: number;
  }[];
  readonly buffers?: readonly {
    readonly byteLength: number;
    readonly uri?: string;
  }[];
  readonly meshes?: readonly {
    readonly primitives?: readonly {
      readonly attributes?: {
        readonly POSITION?: number;
      };
      readonly indices?: number;
      readonly mode?: number;
    }[];
  }[];
  readonly nodes?: readonly {
    readonly children?: readonly number[];
    readonly matrix?: readonly number[];
    readonly mesh?: number;
    readonly rotation?: readonly [number, number, number, number];
    readonly scale?: readonly [number, number, number];
    readonly translation?: readonly [number, number, number];
  }[];
  readonly scene?: number;
  readonly scenes?: readonly {
    readonly nodes?: readonly number[];
  }[];
}

const gltfTrianglesDrawMode = 4;
const gltfFloatComponentType = 5126;
const baseCollisionMeshSnapshotsByPath = new Map<
  string,
  readonly MetaverseAuthoritativeCollisionTriMeshSnapshot[]
>();

function resolveCollisionAssetFilePath(collisionPath: string): string {
  const normalizedCollisionPath = collisionPath.startsWith("/")
    ? collisionPath.slice(1)
    : collisionPath;
  const candidatePaths = [
    resolve(process.cwd(), "client/public", normalizedCollisionPath),
    resolve(process.cwd(), "..", "client/public", normalizedCollisionPath)
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `Metaverse authoritative collision asset ${collisionPath} could not be resolved from the runtime workspace.`
  );
}

function parseGlbDocument(filePath: string): {
  readonly document: GltfNodeDocument;
  readonly embeddedBuffers: readonly Uint8Array[];
} {
  const bytes = readFileSync(filePath);
  const magic = bytes.subarray(0, 4).toString("utf8");

  if (magic !== "glTF") {
    throw new Error(`${filePath} is not a valid GLB file.`);
  }

  let offset = 12;
  let document: GltfNodeDocument | null = null;
  const embeddedBuffers: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > bytes.length) {
      throw new Error(`${filePath} contains a truncated GLB chunk.`);
    }

    const chunkBytes = bytes.subarray(chunkStart, chunkEnd);

    if (chunkType === 0x4e4f534a) {
      document = JSON.parse(chunkBytes.toString("utf8").trim()) as GltfNodeDocument;
    } else if (chunkType === 0x004e4942) {
      embeddedBuffers.push(chunkBytes);
    }

    offset = chunkEnd + (chunkLength % 4 === 0 ? 0 : 4 - (chunkLength % 4));
  }

  if (document === null) {
    throw new Error(`${filePath} did not contain a GLB JSON chunk.`);
  }

  return Object.freeze({
    document,
    embeddedBuffers: Object.freeze(embeddedBuffers)
  });
}

function loadGltfDocument(filePath: string): {
  readonly document: GltfNodeDocument;
  readonly embeddedBuffers: readonly Uint8Array[];
} {
  if (filePath.endsWith(".glb")) {
    return parseGlbDocument(filePath);
  }

  if (filePath.endsWith(".gltf")) {
    return Object.freeze({
      document: JSON.parse(readFileSync(filePath, "utf8")) as GltfNodeDocument,
      embeddedBuffers: Object.freeze([])
    });
  }

  throw new Error(
    `Metaverse authoritative collision asset ${filePath} must be a .gltf or .glb file.`
  );
}

function decodeDataUri(uri: string): Uint8Array {
  const separatorIndex = uri.indexOf(",");

  if (separatorIndex <= 0) {
    throw new Error("Metaverse authoritative collision asset buffer used an invalid data URI.");
  }

  const metadata = uri.slice(0, separatorIndex);
  const encodedPayload = uri.slice(separatorIndex + 1);

  return metadata.endsWith(";base64")
    ? Uint8Array.from(Buffer.from(encodedPayload, "base64"))
    : Uint8Array.from(Buffer.from(decodeURIComponent(encodedPayload), "utf8"));
}

function resolveBufferBytes(
  filePath: string,
  document: GltfNodeDocument,
  embeddedBuffers: readonly Uint8Array[]
): readonly Uint8Array[] {
  return Object.freeze(
    (document.buffers ?? []).map((buffer, bufferIndex) => {
      if (typeof buffer.uri === "string") {
        if (buffer.uri.startsWith("data:")) {
          return decodeDataUri(buffer.uri);
        }

        return Uint8Array.from(
          readFileSync(resolve(dirname(filePath), buffer.uri))
        );
      }

      const embeddedBuffer = embeddedBuffers[bufferIndex] ?? embeddedBuffers[0] ?? null;

      if (embeddedBuffer === null) {
        throw new Error(
          `Metaverse authoritative collision asset ${filePath} is missing binary data for buffer ${bufferIndex}.`
        );
      }

      return embeddedBuffer;
    })
  );
}

function createIdentityMatrix(): readonly number[] {
  return Object.freeze([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

function multiplyMatrix4(
  left: readonly number[],
  right: readonly number[]
): readonly number[] {
  const result = new Array<number>(16).fill(0);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;

      for (let index = 0; index < 4; index += 1) {
        value += left[index * 4 + row]! * right[column * 4 + index]!;
      }

      result[column * 4 + row] = value;
    }
  }

  return Object.freeze(result);
}

function createNodeMatrix(
  node: NonNullable<GltfNodeDocument["nodes"]>[number]
): readonly number[] {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return Object.freeze(node.matrix.map((value) => Number(value)));
  }

  const translation = node.translation ?? [0, 0, 0];
  const rotation = node.rotation ?? [0, 0, 0, 1];
  const scale = node.scale ?? [1, 1, 1];
  const [x, y, z, w] = rotation;
  const [scaleX, scaleY, scaleZ] = scale;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return Object.freeze([
    (1 - 2 * (yy + zz)) * scaleX,
    (2 * (xy + wz)) * scaleX,
    (2 * (xz - wy)) * scaleX,
    0,
    (2 * (xy - wz)) * scaleY,
    (1 - 2 * (xx + zz)) * scaleY,
    (2 * (yz + wx)) * scaleY,
    0,
    (2 * (xz + wy)) * scaleZ,
    (2 * (yz - wx)) * scaleZ,
    (1 - 2 * (xx + yy)) * scaleZ,
    0,
    translation[0] ?? 0,
    translation[1] ?? 0,
    translation[2] ?? 0,
    1
  ]);
}

function transformPoint(
  matrix: readonly number[],
  x: number,
  y: number,
  z: number
): readonly [number, number, number] {
  return Object.freeze([
    matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
    matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
    matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!
  ]);
}

function resolveAccessorComponentCount(type: string): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      throw new Error(`Unsupported glTF accessor type ${type} for collision meshes.`);
  }
}

function resolveAccessorComponentSize(componentType: number): number {
  switch (componentType) {
    case 5121:
      return 1;
    case 5123:
      return 2;
    case 5125:
    case 5126:
      return 4;
    default:
      throw new Error(
        `Unsupported glTF accessor component type ${componentType} for collision meshes.`
      );
  }
}

function readAccessorComponent(
  view: DataView,
  byteOffset: number,
  componentType: number
): number {
  switch (componentType) {
    case 5121:
      return view.getUint8(byteOffset);
    case 5123:
      return view.getUint16(byteOffset, true);
    case 5125:
      return view.getUint32(byteOffset, true);
    case 5126:
      return view.getFloat32(byteOffset, true);
    default:
      throw new Error(
        `Unsupported glTF accessor component type ${componentType} for collision meshes.`
      );
  }
}

function appendPrimitiveTriangles(
  document: GltfNodeDocument,
  bufferBytes: readonly Uint8Array[],
  primitive: NonNullable<
    NonNullable<NonNullable<GltfNodeDocument["meshes"]>[number]["primitives"]>[number]
  >,
  worldMatrix: readonly number[],
  targetVertices: number[],
  targetIndices: number[]
): void {
  if ((primitive.mode ?? gltfTrianglesDrawMode) !== gltfTrianglesDrawMode) {
    return;
  }

  const positionAccessorIndex = primitive.attributes?.POSITION ?? null;

  if (positionAccessorIndex === null) {
    return;
  }

  const positionAccessor = document.accessors?.[positionAccessorIndex] ?? null;

  if (
    positionAccessor === null ||
    positionAccessor.bufferView === undefined ||
    positionAccessor.componentType !== gltfFloatComponentType ||
    positionAccessor.type !== "VEC3"
  ) {
    throw new Error("Metaverse authoritative collision mesh requires a VEC3 float POSITION accessor.");
  }

  const positionBufferView =
    document.bufferViews?.[positionAccessor.bufferView] ?? null;

  if (positionBufferView === null) {
    throw new Error("Metaverse authoritative collision mesh is missing a POSITION buffer view.");
  }

  const positionBytes = bufferBytes[positionBufferView.buffer];

  if (positionBytes === undefined) {
    throw new Error("Metaverse authoritative collision mesh is missing a POSITION buffer.");
  }

  const positionComponentCount = resolveAccessorComponentCount(positionAccessor.type);
  const positionStride =
    positionBufferView.byteStride ??
    resolveAccessorComponentSize(positionAccessor.componentType) * positionComponentCount;
  const positionByteOffset =
    (positionBufferView.byteOffset ?? 0) + (positionAccessor.byteOffset ?? 0);
  const positionView = new DataView(
    positionBytes.buffer,
    positionBytes.byteOffset,
    positionBytes.byteLength
  );
  const vertexIndexOffset = targetVertices.length / 3;

  for (let vertexIndex = 0; vertexIndex < positionAccessor.count; vertexIndex += 1) {
    const componentByteOffset = positionByteOffset + vertexIndex * positionStride;
    const [x, y, z] = transformPoint(
      worldMatrix,
      readAccessorComponent(positionView, componentByteOffset, gltfFloatComponentType),
      readAccessorComponent(
        positionView,
        componentByteOffset + resolveAccessorComponentSize(gltfFloatComponentType),
        gltfFloatComponentType
      ),
      readAccessorComponent(
        positionView,
        componentByteOffset + resolveAccessorComponentSize(gltfFloatComponentType) * 2,
        gltfFloatComponentType
      )
    );

    targetVertices.push(x, y, z);
  }

  if (primitive.indices === undefined) {
    for (let vertexIndex = 0; vertexIndex < positionAccessor.count; vertexIndex += 1) {
      targetIndices.push(vertexIndexOffset + vertexIndex);
    }

    return;
  }

  const indexAccessor = document.accessors?.[primitive.indices] ?? null;

  if (indexAccessor === null || indexAccessor.bufferView === undefined) {
    throw new Error("Metaverse authoritative collision mesh is missing an index accessor.");
  }

  const indexBufferView = document.bufferViews?.[indexAccessor.bufferView] ?? null;

  if (indexBufferView === null) {
    throw new Error("Metaverse authoritative collision mesh is missing an index buffer view.");
  }

  const indexBytes = bufferBytes[indexBufferView.buffer];

  if (indexBytes === undefined) {
    throw new Error("Metaverse authoritative collision mesh is missing an index buffer.");
  }

  const indexStride =
    indexBufferView.byteStride ??
    resolveAccessorComponentSize(indexAccessor.componentType);
  const indexByteOffset =
    (indexBufferView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0);
  const indexView = new DataView(
    indexBytes.buffer,
    indexBytes.byteOffset,
    indexBytes.byteLength
  );

  for (let index = 0; index < indexAccessor.count; index += 1) {
    targetIndices.push(
      vertexIndexOffset +
        readAccessorComponent(
          indexView,
          indexByteOffset + index * indexStride,
          indexAccessor.componentType
        )
    );
  }
}

function appendNodeMeshTriangles(
  document: GltfNodeDocument,
  bufferBytes: readonly Uint8Array[],
  nodeIndex: number,
  parentWorldMatrix: readonly number[],
  targetVertices: number[],
  targetIndices: number[]
): void {
  const node = document.nodes?.[nodeIndex] ?? null;

  if (node === null) {
    return;
  }

  const worldMatrix = multiplyMatrix4(parentWorldMatrix, createNodeMatrix(node));
  const mesh = node.mesh === undefined ? null : document.meshes?.[node.mesh] ?? null;

  for (const primitive of mesh?.primitives ?? []) {
    appendPrimitiveTriangles(
      document,
      bufferBytes,
      primitive,
      worldMatrix,
      targetVertices,
      targetIndices
    );
  }

  for (const childNodeIndex of node.children ?? []) {
    appendNodeMeshTriangles(
      document,
      bufferBytes,
      childNodeIndex,
      worldMatrix,
      targetVertices,
      targetIndices
    );
  }
}

function loadBaseCollisionMeshSnapshots(
  collisionPath: string
): readonly MetaverseAuthoritativeCollisionTriMeshSnapshot[] {
  const cachedSnapshots = baseCollisionMeshSnapshotsByPath.get(collisionPath);

  if (cachedSnapshots !== undefined) {
    return cachedSnapshots;
  }

  const assetFilePath = resolveCollisionAssetFilePath(collisionPath);
  const { document, embeddedBuffers } = loadGltfDocument(assetFilePath);
  const bufferBytes = resolveBufferBytes(assetFilePath, document, embeddedBuffers);
  const rootNodeIndices =
    document.scenes?.[document.scene ?? 0]?.nodes ?? [];
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const rootNodeIndex of rootNodeIndices) {
    appendNodeMeshTriangles(
      document,
      bufferBytes,
      rootNodeIndex,
      createIdentityMatrix(),
      vertices,
      indices
    );
  }

  const snapshots =
    vertices.length === 0 || indices.length === 0
      ? Object.freeze([]) as readonly MetaverseAuthoritativeCollisionTriMeshSnapshot[]
      : Object.freeze([
          Object.freeze({
            indices: Uint32Array.from(indices),
            vertices: Float32Array.from(vertices)
          } satisfies MetaverseAuthoritativeCollisionTriMeshSnapshot)
        ]);

  baseCollisionMeshSnapshotsByPath.set(collisionPath, snapshots);

  return snapshots;
}

export function loadAuthoritativeCollisionTriMeshSnapshots(
  collisionPath: string,
  scale: MetaverseWorldSurfaceScaleSnapshot
): readonly MetaverseAuthoritativeCollisionTriMeshSnapshot[] {
  const baseSnapshots = loadBaseCollisionMeshSnapshots(collisionPath);
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(scale);

  if (
    Math.abs(scaleVector.x - 1) <= 0.000001 &&
    Math.abs(scaleVector.y - 1) <= 0.000001 &&
    Math.abs(scaleVector.z - 1) <= 0.000001
  ) {
    return baseSnapshots;
  }

  return Object.freeze(
    baseSnapshots.map((snapshot) => {
      const scaledVertices = new Float32Array(snapshot.vertices.length);

      for (let index = 0; index < snapshot.vertices.length; index += 3) {
        scaledVertices[index] = snapshot.vertices[index]! * scaleVector.x;
        scaledVertices[index + 1] = snapshot.vertices[index + 1]! * scaleVector.y;
        scaledVertices[index + 2] = snapshot.vertices[index + 2]! * scaleVector.z;
      }

      return Object.freeze({
        indices: snapshot.indices,
        vertices: scaledVertices
      } satisfies MetaverseAuthoritativeCollisionTriMeshSnapshot);
    })
  );
}
