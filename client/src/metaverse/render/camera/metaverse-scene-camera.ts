import { type Camera, PerspectiveCamera, Vector3 } from "three/webgpu";

import { createMetaverseCameraSnapshot } from "../../states/metaverse-flight";

import type {
  MetaverseCameraSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

export interface MetaverseSceneCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

export interface MetaverseSceneRendererHost {
  compileAsync?(scene: import("three/webgpu").Scene, camera: Camera): Promise<void>;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapRadians(rawValue: number): number {
  const turn = Math.PI * 2;
  let wrapped = rawValue % turn;

  if (wrapped <= -Math.PI) {
    wrapped += turn;
  } else if (wrapped > Math.PI) {
    wrapped -= turn;
  }

  return wrapped;
}

export function createMetaverseSceneCamera(
  config: MetaverseRuntimeConfig["camera"]
): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    config.fieldOfViewDegrees,
    1,
    config.near,
    config.far
  );

  syncMetaverseSceneCamera(camera, createMetaverseCameraSnapshot(config));

  return camera;
}

export function syncMetaverseSceneCamera(
  camera: PerspectiveCamera,
  cameraSnapshot: MetaverseCameraSnapshot,
  fieldOfViewDegrees: number | null = null
): void {
  if (
    fieldOfViewDegrees !== null &&
    Number.isFinite(fieldOfViewDegrees) &&
    Math.abs(camera.fov - fieldOfViewDegrees) > 0.000001
  ) {
    camera.fov = fieldOfViewDegrees;
    camera.updateProjectionMatrix();
  }

  camera.position.set(
    cameraSnapshot.position.x,
    cameraSnapshot.position.y,
    cameraSnapshot.position.z
  );
  camera.lookAt(
    cameraSnapshot.position.x + cameraSnapshot.lookDirection.x,
    cameraSnapshot.position.y + cameraSnapshot.lookDirection.y,
    cameraSnapshot.position.z + cameraSnapshot.lookDirection.z
  );
  camera.updateMatrixWorld(true);
}

export function createMetaverseSceneCameraSnapshot(
  camera: PerspectiveCamera
): MetaverseCameraSnapshot {
  const lookDirection = new Vector3();

  camera.getWorldDirection(lookDirection);

  return Object.freeze({
    lookDirection: Object.freeze({
      x: lookDirection.x,
      y: lookDirection.y,
      z: lookDirection.z
    }),
    pitchRadians: Math.asin(clamp(lookDirection.y, -1, 1)),
    position: Object.freeze({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    }),
    yawRadians: wrapRadians(Math.atan2(lookDirection.x, -lookDirection.z))
  });
}

export function syncMetaverseSceneViewport(
  camera: PerspectiveCamera,
  renderer: MetaverseSceneRendererHost,
  canvasHost: MetaverseSceneCanvasHost,
  devicePixelRatio: number,
  previousViewportWidth: number | null,
  previousViewportHeight: number | null
): {
  readonly height: number;
  readonly viewportChanged: boolean;
  readonly width: number;
} {
  const width = Math.max(1, canvasHost.clientWidth);
  const height = Math.max(1, canvasHost.clientHeight);
  const viewportChanged =
    previousViewportWidth !== null &&
    previousViewportHeight !== null &&
    (width !== previousViewportWidth || height !== previousViewportHeight);

  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return {
    height,
    viewportChanged,
    width
  };
}
