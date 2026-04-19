import { MOUSE, PerspectiveCamera } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createMapEditorViewportOrbitControls(
  camera: PerspectiveCamera,
  canvasElement: HTMLCanvasElement
): OrbitControls {
  const controls = new OrbitControls(camera, canvasElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.minDistance = 4;
  controls.maxDistance = 480;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.mouseButtons.LEFT = MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = MOUSE.PAN;

  return controls;
}

export function frameMapEditorViewportCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  centerX: number,
  centerZ: number,
  span: number
): void {
  const paddedSpan = Math.max(20, span * 1.3);
  const halfSpan = paddedSpan * 0.5;
  const verticalFieldOfViewRadians = (camera.fov * Math.PI) / 180;
  const horizontalFieldOfViewRadians =
    2 *
    Math.atan(
      Math.tan(verticalFieldOfViewRadians * 0.5) * Math.max(0.1, camera.aspect)
    );
  const fitRadius = Math.hypot(halfSpan, halfSpan);
  const fitDistance =
    fitRadius /
    Math.tan(
      Math.max(
        0.2,
        Math.min(verticalFieldOfViewRadians, horizontalFieldOfViewRadians) * 0.5
      )
    );
  const cameraDistance = fitDistance * 1.18 + 10;
  const cameraDirection = {
    x: 0.72,
    y: 0.8,
    z: 0.96
  } as const;
  const cameraDirectionLength = Math.hypot(
    cameraDirection.x,
    cameraDirection.y,
    cameraDirection.z
  );

  controls.target.set(centerX, 0, centerZ);
  camera.position.set(
    centerX +
      (cameraDirection.x / cameraDirectionLength) * cameraDistance,
    (cameraDirection.y / cameraDirectionLength) * cameraDistance,
    centerZ +
      (cameraDirection.z / cameraDirectionLength) * cameraDistance
  );
  camera.lookAt(controls.target);
  controls.update();
}
