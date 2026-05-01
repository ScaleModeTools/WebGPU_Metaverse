import {
  ACESFilmicToneMapping,
  BackSide,
  BufferAttribute,
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Texture,
  Vector3,
  WebGPURenderer,
  type Camera,
  type Scene
} from "three/webgpu";
import {
  createMetaverseWeaponInstanceId
} from "@webgpu-metaverse/shared";
import {
  createMetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { createMetaverseRuntimeConfig } from "../../config/metaverse-runtime";
import {
  createMetaverseScene,
  type MetaverseSceneCanvasHost,
  type MetaverseSceneRendererHost
} from "../webgpu-metaverse-scene";
import {
  metaverseAttachmentProofConfig,
  metaverseCharacterProofConfig
} from "../../world/proof";
import {
  shellGoldenHourEnvironmentPresentationProfile
} from "../environment/profiles/shell-golden-hour-environment-presentation";
import type {
  MetaverseCameraSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";
import type { MetaverseSemanticAimFrame } from "../../aim/metaverse-semantic-aim";

interface MetaverseLaunchCinematicRendererHost
  extends MetaverseSceneRendererHost {
  compileAsync?(scene: Scene, camera: Camera): Promise<void>;
  dispose(): void;
  init(): Promise<void | MetaverseLaunchCinematicRendererHost>;
  render(scene: Scene, camera: Camera): void;
}

interface MetaverseLaunchCinematicRendererTuningHandle {
  outputColorSpace?: string;
  toneMapping?: number;
  toneMappingExposure?: number;
}

const metaverseLaunchCinematicPlayerId = "metaverse-launch-cinematic-player";
const metaverseLaunchCinematicCharacterPosition = Object.freeze({
  x: 0,
  y: 0,
  z: 0
});
const metaverseLaunchCinematicLookTargetHeightMeters = 0.96;
const metaverseLaunchCinematicScreenRightOffsetMeters = 1.26;
const metaverseLaunchCinematicBaseCamera = Object.freeze({
  height: 1.48,
  radius: 3.72,
  sideBias: -0.1,
  zBias: 0.98
});
const metaverseLaunchCinematicLaunchCamera = Object.freeze({
  height: 1.72,
  radius: 5.55,
  sideBias: -0.22,
  zBias: 1.06
});
const metaverseLaunchCinematicCameraOrbitSpeedRadiansPerSecond = 0.032;
const metaverseLaunchCinematicTerrainSizeMeters = 96;
const metaverseLaunchCinematicTerrainSegments = 112;
const metaverseLaunchCinematicTerrainElevationMeters = 4;
const metaverseLaunchCinematicSkyDomeRadiusMeters = 260;
const emptyMetaverseLaunchCinematicRemotePresentations = Object.freeze([]);
const emptyMetaverseLaunchCinematicCombatProjectiles = Object.freeze([]);

interface MutableMetaverseVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableMetaverseCameraSnapshot {
  lookDirection: MutableMetaverseVector3Snapshot;
  pitchRadians: number;
  position: MutableMetaverseVector3Snapshot;
  yawRadians: number;
}

interface MutableMetaverseCharacterPresentationSnapshot {
  animationPlaybackRateMultiplier: number;
  animationVocabulary: "idle";
  position: MutableMetaverseVector3Snapshot;
  yawRadians: number;
}

interface MutableMetaverseSemanticAimFrame {
  actorFacingYawRadians: number;
  adsBlend: number | null;
  aimMode: "hip-fire";
  cameraForwardWorld: MutableMetaverseVector3Snapshot;
  cameraRayOriginWorld: MutableMetaverseVector3Snapshot;
  pitchRadians: number;
  poseProfileId: typeof metaverseAttachmentProofConfig.holdProfile.poseProfileId;
  quality: "full_camera_ray";
  source: "local_camera";
  weaponId: string;
  yawRadians: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function lerp(leftValue: number, rightValue: number, alpha: number): number {
  return leftValue + (rightValue - leftValue) * alpha;
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

function createLaunchCinematicRenderer(
  canvas: HTMLCanvasElement
): MetaverseLaunchCinematicRendererHost {
  const renderer = new WebGPURenderer({
    alpha: true,
    antialias: true,
    canvas
  });
  const tuningHandle = renderer as MetaverseLaunchCinematicRendererHost &
    MetaverseLaunchCinematicRendererTuningHandle;

  tuningHandle.toneMapping = ACESFilmicToneMapping;
  tuningHandle.toneMappingExposure = 0.62;
  tuningHandle.outputColorSpace = SRGBColorSpace;

  return renderer;
}

function createLaunchCinematicRuntimeConfig(): MetaverseRuntimeConfig {
  const baseConfig = createMetaverseRuntimeConfig();
  const environmentPresentation = shellGoldenHourEnvironmentPresentationProfile;

  return Object.freeze({
    ...baseConfig,
    camera: Object.freeze({
      ...baseConfig.camera,
      far: 420,
      fieldOfViewDegrees: 34,
      spawnPosition: Object.freeze({
        x: -1.52,
        y: 1.48,
        z: 3.48
      })
    }),
    environment: Object.freeze({
      ...environmentPresentation.environment,
      cloudCoverage: 0.31,
      cloudDensity: 0.38,
      fogDensity: 0.0028,
      fogEnabled: true,
      skyExposure: 0.38,
      sunElevationDegrees: 18,
      toneMappingExposure: 0.58
    }),
    ocean: environmentPresentation.ocean,
    portals: Object.freeze([]),
    waterRegionSnapshots: Object.freeze([])
  });
}

function createLaunchCinematicWeaponState() {
  return createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "primary",
    aimMode: "hip-fire",
    slots: Object.freeze([
      Object.freeze({
        attachmentId: metaverseAttachmentProofConfig.attachmentId,
        equipped: true,
        slotId: "primary",
        weaponId: metaverseAttachmentProofConfig.attachmentId,
        weaponInstanceId: createMetaverseWeaponInstanceId(
          metaverseLaunchCinematicPlayerId,
          "primary",
          metaverseAttachmentProofConfig.attachmentId
        )
      })
    ]),
    weaponId: metaverseAttachmentProofConfig.attachmentId
  });
}

function createLaunchCinematicCharacterPresentation():
  MutableMetaverseCharacterPresentationSnapshot {
  return {
    animationPlaybackRateMultiplier: 0.82,
    animationVocabulary: "idle",
    position: {
      x: metaverseLaunchCinematicCharacterPosition.x,
      y: metaverseLaunchCinematicCharacterPosition.y,
      z: metaverseLaunchCinematicCharacterPosition.z
    },
    yawRadians: Math.PI
  };
}

function createLaunchCinematicAimFrame(): MutableMetaverseSemanticAimFrame {
  return {
    actorFacingYawRadians: Math.PI,
    adsBlend: 0,
    aimMode: "hip-fire",
    cameraForwardWorld: {
      x: 0,
      y: 0,
      z: 1
    },
    cameraRayOriginWorld: {
      x: 0,
      y: 1.24,
      z: 0
    },
    pitchRadians: 0,
    poseProfileId: metaverseAttachmentProofConfig.holdProfile.poseProfileId,
    quality: "full_camera_ray",
    source: "local_camera",
    weaponId: metaverseAttachmentProofConfig.attachmentId,
    yawRadians: Math.PI
  };
}

function createGrassTerrainMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    color: new Color(0.22, 0.38, 0.14),
    metalness: 0,
    roughness: 0.86
  });

  material.emissive = new Color(0.015, 0.035, 0.012);

  return material;
}

function createGrassTerrainGroup(): Group {
  const terrainGroup = new Group();
  const terrainGeometry = new PlaneGeometry(
    metaverseLaunchCinematicTerrainSizeMeters,
    metaverseLaunchCinematicTerrainSizeMeters,
    metaverseLaunchCinematicTerrainSegments,
    metaverseLaunchCinematicTerrainSegments
  );
  const positionAttribute = terrainGeometry.getAttribute("position");
  const rawHeights: number[] = [];
  let maxRawHeight = Number.NEGATIVE_INFINITY;
  let minRawHeight = Number.POSITIVE_INFINITY;

  for (
    let vertexIndex = 0;
    vertexIndex < positionAttribute.count;
    vertexIndex += 1
  ) {
    const x = positionAttribute.getX(vertexIndex);
    const y = positionAttribute.getY(vertexIndex);
    const distanceFromCenter = Math.hypot(x, y);
    const height =
      Math.sin(x * 0.16 + y * 0.1) * 0.8 +
      Math.sin(x * 0.045 - y * 0.085) * 1.1 +
      Math.cos(distanceFromCenter * 0.19) * 0.46;

    rawHeights.push(height);
    minRawHeight = Math.min(minRawHeight, height);
    maxRawHeight = Math.max(maxRawHeight, height);
  }

  const centerRawHeight = 0.46;
  const rawHeightRange = Math.max(0.000001, maxRawHeight - minRawHeight);
  const heightScale =
    metaverseLaunchCinematicTerrainElevationMeters / rawHeightRange;

  for (
    let vertexIndex = 0;
    vertexIndex < rawHeights.length;
    vertexIndex += 1
  ) {
    positionAttribute.setZ(
      vertexIndex,
      ((rawHeights[vertexIndex] ?? centerRawHeight) - centerRawHeight) *
        heightScale
    );
  }

  positionAttribute.needsUpdate = true;
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.computeVertexNormals();

  const terrainMesh = new Mesh(terrainGeometry, createGrassTerrainMaterial());

  terrainMesh.name = "metaverse_launch_cinematic/grass_terrain";
  terrainMesh.receiveShadow = true;
  terrainGroup.name = "metaverse_launch_cinematic/terrain";
  terrainGroup.add(terrainMesh);

  return terrainGroup;
}

function createLaunchSkyDome(): Mesh {
  const skyGeometry = new SphereGeometry(
    metaverseLaunchCinematicSkyDomeRadiusMeters,
    48,
    24
  );
  const positionAttribute = skyGeometry.getAttribute("position");
  const colors: number[] = [];
  const zenithColor = new Color(0.18, 0.34, 0.64);
  const horizonColor = new Color(0.98, 0.58, 0.34);
  const lowerColor = new Color(0.14, 0.17, 0.19);
  const mixedColor = new Color();

  for (
    let vertexIndex = 0;
    vertexIndex < positionAttribute.count;
    vertexIndex += 1
  ) {
    const normalizedHeight = clamp(
      (positionAttribute.getY(vertexIndex) /
        metaverseLaunchCinematicSkyDomeRadiusMeters +
        1) * 0.5,
      0,
      1
    );

    if (normalizedHeight < 0.48) {
      mixedColor.copy(lowerColor).lerp(horizonColor, normalizedHeight / 0.48);
    } else {
      mixedColor.copy(horizonColor).lerp(
        zenithColor,
        Math.pow((normalizedHeight - 0.48) / 0.52, 0.82)
      );
    }

    colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
  }

  skyGeometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3)
  );

  const skyMaterial = new MeshBasicNodeMaterial({
    depthWrite: false,
    side: BackSide,
    vertexColors: true
  });
  const skyMesh = new Mesh(skyGeometry, skyMaterial);

  skyMesh.frustumCulled = false;
  skyMesh.name = "metaverse_launch_cinematic/sky_dome";
  skyMesh.renderOrder = -1000;

  return skyMesh;
}

function hideDefaultRuntimeSky(scene: Scene): void {
  scene.traverse((object) => {
    if (object.name === "metaverse_scene_environment/sky") {
      object.visible = false;
    }
  });
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose();
    }
  }

  material.dispose();
}

function disposeSceneGraph(scene: Scene): void {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    object.geometry.dispose();

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        disposeMaterial(material);
      }

      return;
    }

    disposeMaterial(object.material);
  });
}

function createMutableCameraSnapshot(): MutableMetaverseCameraSnapshot {
  return {
    lookDirection: {
      x: 0,
      y: 0,
      z: -1
    },
    pitchRadians: 0,
    position: {
      x: 0,
      y: 0,
      z: 0
    },
    yawRadians: 0
  };
}

function syncCameraSnapshot(
  snapshot: MutableMetaverseCameraSnapshot,
  position: Vector3,
  target: Vector3,
  lookDirectionScratch: Vector3
): MetaverseCameraSnapshot {
  lookDirectionScratch.copy(target).sub(position).normalize();

  snapshot.lookDirection.x = lookDirectionScratch.x;
  snapshot.lookDirection.y = lookDirectionScratch.y;
  snapshot.lookDirection.z = lookDirectionScratch.z;
  snapshot.pitchRadians = Math.asin(clamp(lookDirectionScratch.y, -1, 1));
  snapshot.position.x = position.x;
  snapshot.position.y = position.y;
  snapshot.position.z = position.z;
  snapshot.yawRadians = wrapRadians(
    Math.atan2(lookDirectionScratch.x, -lookDirectionScratch.z)
  );

  return snapshot;
}

function resolveYawTowardCamera(cameraPosition: Vector3): number {
  return wrapRadians(
    Math.atan2(
      cameraPosition.x - metaverseLaunchCinematicCharacterPosition.x,
      -(cameraPosition.z - metaverseLaunchCinematicCharacterPosition.z)
    )
  );
}

function syncCameraTarget(
  target: Vector3,
  cameraPosition: Vector3
): Vector3 {
  const forwardX =
    metaverseLaunchCinematicCharacterPosition.x - cameraPosition.x;
  const forwardZ =
    metaverseLaunchCinematicCharacterPosition.z - cameraPosition.z;
  const forwardLength = Math.max(
    0.000001,
    Math.hypot(forwardX, forwardZ)
  );
  const rightX = -forwardZ / forwardLength;
  const rightZ = forwardX / forwardLength;

  target.set(
    metaverseLaunchCinematicCharacterPosition.x -
      rightX * metaverseLaunchCinematicScreenRightOffsetMeters,
    metaverseLaunchCinematicCharacterPosition.y +
      metaverseLaunchCinematicLookTargetHeightMeters,
    metaverseLaunchCinematicCharacterPosition.z -
      rightZ * metaverseLaunchCinematicScreenRightOffsetMeters
  );

  return target;
}

function syncAimFrame(
  aimFrame: MutableMetaverseSemanticAimFrame,
  cameraPosition: Vector3,
  characterYawRadians: number
): MetaverseSemanticAimFrame {
  const originX = metaverseLaunchCinematicCharacterPosition.x;
  const originY = metaverseLaunchCinematicCharacterPosition.y + 1.24;
  const originZ = metaverseLaunchCinematicCharacterPosition.z;
  const forwardX = cameraPosition.x - originX;
  const forwardY = cameraPosition.y - originY;
  const forwardZ = cameraPosition.z - originZ;
  const forwardLength = Math.max(
    0.000001,
    Math.hypot(forwardX, forwardY, forwardZ)
  );
  const normalizedForwardX = forwardX / forwardLength;
  const normalizedForwardY = forwardY / forwardLength;
  const normalizedForwardZ = forwardZ / forwardLength;

  aimFrame.actorFacingYawRadians = characterYawRadians;
  aimFrame.cameraForwardWorld.x = normalizedForwardX;
  aimFrame.cameraForwardWorld.y = normalizedForwardY;
  aimFrame.cameraForwardWorld.z = normalizedForwardZ;
  aimFrame.cameraRayOriginWorld.x = originX;
  aimFrame.cameraRayOriginWorld.y = originY;
  aimFrame.cameraRayOriginWorld.z = originZ;
  aimFrame.pitchRadians = Math.asin(clamp(normalizedForwardY, -1, 1));
  aimFrame.yawRadians = characterYawRadians;

  return aimFrame;
}

export class MetaverseLaunchCinematicRuntime {
  readonly #aimFrame = createLaunchCinematicAimFrame();
  readonly #cameraSnapshot = createMutableCameraSnapshot();
  readonly #cameraPositionScratch = new Vector3();
  readonly #cameraTargetScratch = new Vector3();
  readonly #characterPresentation =
    createLaunchCinematicCharacterPresentation();
  readonly #lookDirectionScratch = new Vector3();
  readonly #sceneRuntime = createMetaverseScene(
    createLaunchCinematicRuntimeConfig(),
    {
      attachmentProofConfig: metaverseAttachmentProofConfig,
      characterProofConfig: metaverseCharacterProofConfig,
      localPlayerId: metaverseLaunchCinematicPlayerId,
      warn: (message) => globalThis.console?.warn(message)
    }
  );
  readonly #skyDome = createLaunchSkyDome();
  readonly #terrainGroup = createGrassTerrainGroup();
  readonly #weaponState = createLaunchCinematicWeaponState();

  #booted = false;
  #disposed = false;
  #frameHandle: number | null = null;
  #launchBlend = 0;
  #launchBlendTarget = 0;
  #lastFrameMs: number | null = null;
  #renderer: MetaverseLaunchCinematicRendererHost | null = null;
  #startedAtMs: number | null = null;

  async start(canvas: HTMLCanvasElement): Promise<void> {
    if (this.#disposed || this.#renderer !== null) {
      return;
    }

    const renderer = createLaunchCinematicRenderer(canvas);

    this.#renderer = renderer;
    hideDefaultRuntimeSky(this.#sceneRuntime.scene);
    this.#sceneRuntime.scene.add(this.#skyDome, this.#terrainGroup);
    await renderer.init();

    if (this.#disposed) {
      renderer.dispose();
      return;
    }

    this.syncViewport(canvas);
    this.#scheduleNextFrame();

    try {
      await this.#sceneRuntime.bootInteractivePresentation();
      this.#booted = true;

      if (!this.#disposed) {
        await this.#sceneRuntime.prewarm(renderer);
      }
    } catch (error) {
      if (!this.#disposed) {
        throw error;
      }
    }
  }

  setLaunchPending(launchPending: boolean): void {
    this.#launchBlendTarget = launchPending ? 1 : 0;
  }

  syncViewport(canvasHost: MetaverseSceneCanvasHost): void {
    const renderer = this.#renderer;

    if (renderer === null || this.#disposed) {
      return;
    }

    this.#sceneRuntime.syncViewport(
      renderer,
      canvasHost,
      globalThis.window?.devicePixelRatio ?? 1
    );
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;

    if (this.#frameHandle !== null) {
      globalThis.window?.cancelAnimationFrame(this.#frameHandle);
      this.#frameHandle = null;
    }

    disposeSceneGraph(this.#sceneRuntime.scene);
    this.#renderer?.dispose();
    this.#renderer = null;
  }

  #scheduleNextFrame(): void {
    if (this.#disposed) {
      return;
    }

    const requestAnimationFrameImpl = globalThis.window?.requestAnimationFrame;

    if (typeof requestAnimationFrameImpl !== "function") {
      return;
    }

    this.#frameHandle = requestAnimationFrameImpl((nowMs) => {
      this.#frameHandle = null;
      this.#render(nowMs);
      this.#scheduleNextFrame();
    });
  }

  #render(nowMs: number): void {
    const renderer = this.#renderer;

    if (renderer === null || this.#disposed) {
      return;
    }

    if (this.#startedAtMs === null) {
      this.#startedAtMs = nowMs;
    }

    const previousFrameMs = this.#lastFrameMs ?? nowMs;
    const deltaSeconds = Math.min(
      0.05,
      Math.max(0, (nowMs - previousFrameMs) / 1000)
    );
    const ageSeconds = Math.max(0, (nowMs - this.#startedAtMs) / 1000);
    const launchBlendStep = Math.min(1, deltaSeconds * 3.4);

    this.#lastFrameMs = nowMs;
    this.#launchBlend = lerp(
      this.#launchBlend,
      this.#launchBlendTarget,
      launchBlendStep
    );

    const orbitAngle =
      -0.16 +
      ageSeconds * metaverseLaunchCinematicCameraOrbitSpeedRadiansPerSecond;
    const orbitSin = Math.sin(orbitAngle);
    const orbitCos = Math.cos(orbitAngle);
    const radius = lerp(
      metaverseLaunchCinematicBaseCamera.radius,
      metaverseLaunchCinematicLaunchCamera.radius,
      this.#launchBlend
    );
    const sideBias = lerp(
      metaverseLaunchCinematicBaseCamera.sideBias,
      metaverseLaunchCinematicLaunchCamera.sideBias,
      this.#launchBlend
    );
    const zBias = lerp(
      metaverseLaunchCinematicBaseCamera.zBias,
      metaverseLaunchCinematicLaunchCamera.zBias,
      this.#launchBlend
    );
    const cameraHeight =
      lerp(
        metaverseLaunchCinematicBaseCamera.height,
        metaverseLaunchCinematicLaunchCamera.height,
        this.#launchBlend
      ) + Math.sin(ageSeconds * 0.34) * 0.045;

    this.#cameraPositionScratch.set(
      orbitSin * radius + sideBias,
      cameraHeight,
      orbitCos * radius * zBias
    );

    const characterYawRadians = resolveYawTowardCamera(
      this.#cameraPositionScratch
    );

    this.#characterPresentation.yawRadians = characterYawRadians;

    const cameraSnapshot = syncCameraSnapshot(
      this.#cameraSnapshot,
      this.#cameraPositionScratch,
      syncCameraTarget(this.#cameraTargetScratch, this.#cameraPositionScratch),
      this.#lookDirectionScratch
    );

    this.#sceneRuntime.syncPresentation(
      cameraSnapshot,
      null,
      nowMs,
      deltaSeconds,
      this.#booted ? this.#characterPresentation : null,
      this.#booted ? this.#weaponState : null,
      0,
      emptyMetaverseLaunchCinematicRemotePresentations,
      null,
      34,
      this.#booted
        ? syncAimFrame(
            this.#aimFrame,
            this.#cameraPositionScratch,
            characterYawRadians
          )
        : null,
      emptyMetaverseLaunchCinematicCombatProjectiles
    );
    renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
  }
}
