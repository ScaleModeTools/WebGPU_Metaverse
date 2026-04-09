import {
  BackSide,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from "three/webgpu";
import {
  abs,
  cameraPosition,
  color,
  dot,
  float,
  mix,
  normalWorld,
  oneMinus,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  time,
  uv,
  vec3
} from "three/tsl";

import type {
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaversePortalConfig,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";

export interface MetaverseSceneCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

export interface MetaverseSceneRendererHost {
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

interface PortalMeshRuntime {
  readonly anchorGroup: Group;
  readonly beamMaterial: MeshStandardNodeMaterial;
  readonly experienceId: MetaversePortalConfig["experienceId"];
  readonly ringMaterial: MeshStandardNodeMaterial;
  readonly rotorGroup: Group;
  readonly supportMaterial: MeshStandardNodeMaterial;
}

function toThreeColor(rgb: readonly [number, number, number]): Color {
  return new Color(rgb[0], rgb[1], rgb[2]);
}

function syncCamera(
  camera: PerspectiveCamera,
  cameraSnapshot: MetaverseCameraSnapshot
): void {
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

function createHemisphereLight(
  config: MetaverseRuntimeConfig
): HemisphereLight {
  const light = new HemisphereLight(
    toThreeColor(config.environment.zenithColor),
    toThreeColor(config.ocean.farColor),
    1.8
  );

  light.position.set(0, 1, 0);

  return light;
}

function createSunLight(config: MetaverseRuntimeConfig): DirectionalLight {
  const light = new DirectionalLight(
    toThreeColor(config.environment.sunColor),
    2.2
  );
  const { sunDirection } = config.environment;
  const sunOffset = new Vector3(
    -sunDirection.x * 120,
    -sunDirection.y * 120,
    -sunDirection.z * 120
  );

  light.position.copy(sunOffset);
  light.target.position.set(0, 0, 0);
  light.target.updateMatrixWorld();

  return light;
}

function createSkyMesh(config: MetaverseRuntimeConfig): Mesh {
  const skyMaterial = new MeshBasicNodeMaterial({
    side: BackSide
  });
  const sunDirection = vec3(
    config.environment.sunDirection.x,
    config.environment.sunDirection.y,
    config.environment.sunDirection.z
  ).normalize();
  const horizonBlend = smoothstep(-0.15, 0.85, normalWorld.y);
  const sunAmount = dot(normalWorld, sunDirection).max(0);
  const sunHalo = pow(sunAmount, 18).mul(0.36);
  const sunDisc = pow(sunAmount, 120).mul(0.92);

  skyMaterial.colorNode = mix(
    color(...config.environment.horizonColor),
    color(...config.environment.zenithColor),
    horizonBlend
  ).add(color(...config.environment.sunColor).mul(sunHalo.add(sunDisc)));
  skyMaterial.depthWrite = false;

  return new Mesh(
    new SphereGeometry(config.environment.domeRadius, 48, 24),
    skyMaterial
  );
}

function createOceanMesh(config: MetaverseRuntimeConfig): Mesh {
  const oceanMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide
  });
  const wavePrimary = sin(
    positionLocal.x
      .mul(config.ocean.waveFrequencies.primary)
      .add(time.mul(config.ocean.waveSpeeds.primary))
  );
  const waveSecondary = sin(
    positionLocal.y
      .mul(config.ocean.waveFrequencies.secondary)
      .add(time.mul(config.ocean.waveSpeeds.secondary))
  );
  const waveRipple = sin(
    positionLocal.x
      .add(positionLocal.y)
      .mul(config.ocean.waveFrequencies.ripple)
      .add(time.mul(config.ocean.waveSpeeds.ripple))
  );
  const waveHeight = wavePrimary
    .mul(0.56)
    .add(waveSecondary.mul(0.34))
    .add(waveRipple.mul(0.18))
    .mul(config.ocean.waveAmplitude);
  const depthBlend = smoothstep(0.08, 1, uv().y);
  const viewDirection = cameraPosition.sub(positionWorld).normalize();
  const fresnel = pow(oneMinus(abs(dot(normalWorld, viewDirection))), 3);

  oceanMaterial.positionNode = positionLocal.add(vec3(0, 0, waveHeight));
  oceanMaterial.colorNode = mix(
    color(...config.ocean.nearColor),
    color(...config.ocean.farColor),
    depthBlend
  ).add(color(...config.environment.sunColor).mul(fresnel.mul(0.12)));
  oceanMaterial.emissiveNode = color(...config.ocean.emissiveColor).mul(
    fresnel.mul(0.48).add(abs(waveRipple).mul(0.03))
  );
  oceanMaterial.roughnessNode = float(config.ocean.roughness);
  oceanMaterial.metalnessNode = float(0.02);

  const oceanMesh = new Mesh(
    new PlaneGeometry(
      config.ocean.planeWidth,
      config.ocean.planeDepth,
      config.ocean.segmentCount,
      config.ocean.segmentCount
    ),
    oceanMaterial
  );

  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = config.ocean.height;

  return oceanMesh;
}

function createPortalMeshRuntime(portalConfig: MetaversePortalConfig): PortalMeshRuntime {
  const anchorGroup = new Group();
  const rotorGroup = new Group();
  const supportMaterial = new MeshStandardNodeMaterial();
  const ringMaterial = new MeshStandardNodeMaterial();
  const beamMaterial = new MeshStandardNodeMaterial({
    transparent: true
  });
  const baseMesh = new Mesh(new CylinderGeometry(4.4, 6.2, 1.2, 32), supportMaterial);
  const ringMesh = new Mesh(new TorusGeometry(4.9, 0.44, 20, 48), ringMaterial);
  const innerHaloMesh = new Mesh(
    new TorusGeometry(3.7, 0.08, 16, 40),
    beamMaterial
  );
  const beamMesh = new Mesh(new CylinderGeometry(1.2, 2.1, 9.4, 24), beamMaterial);
  const beaconMesh = new Mesh(new SphereGeometry(0.72, 18, 12), ringMaterial);

  supportMaterial.colorNode = color(0.18, 0.23, 0.29);
  supportMaterial.emissiveNode = color(0.06, 0.09, 0.12);
  supportMaterial.roughnessNode = float(0.36);
  supportMaterial.metalnessNode = float(0.12);
  ringMaterial.colorNode = color(...portalConfig.ringColor);
  ringMaterial.emissiveNode = color(...portalConfig.ringColor).mul(0.24);
  ringMaterial.roughnessNode = float(0.18);
  ringMaterial.metalnessNode = float(0.08);
  beamMaterial.colorNode = color(...portalConfig.beamColor);
  beamMaterial.emissiveNode = color(...portalConfig.beamColor).mul(0.34);
  beamMaterial.roughnessNode = float(0.3);
  beamMaterial.metalnessNode = float(0);
  beamMaterial.opacity = 0.76;

  baseMesh.position.y = 0.3;
  ringMesh.position.y = 5.4;
  ringMesh.rotation.y = Math.PI * 0.08;
  innerHaloMesh.position.y = 5.4;
  innerHaloMesh.rotation.y = Math.PI * 0.08;
  beamMesh.position.y = 5.2;
  beaconMesh.position.y = 10.6;

  rotorGroup.add(ringMesh, innerHaloMesh, beamMesh, beaconMesh);
  anchorGroup.add(baseMesh, rotorGroup);
  anchorGroup.position.set(
    portalConfig.position.x,
    portalConfig.position.y,
    portalConfig.position.z
  );

  return {
    anchorGroup,
    beamMaterial,
    experienceId: portalConfig.experienceId,
    ringMaterial,
    rotorGroup,
    supportMaterial
  };
}

function syncPortalPresentation(
  portalRuntime: PortalMeshRuntime,
  portalConfig: MetaversePortalConfig,
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  nowMs: number
): void {
  const isFocused = focusedPortal?.experienceId === portalRuntime.experienceId;
  const pulse = 0.85 + Math.sin(nowMs * 0.004) * 0.08;
  const focusBoost = isFocused ? 1.45 : 1;
  const ringColor = portalConfig.ringColor;
  const beamColor = portalConfig.beamColor;

  portalRuntime.rotorGroup.rotation.y = nowMs * 0.00032;
  portalRuntime.rotorGroup.position.y = Math.sin(nowMs * 0.0024) * 0.2;
  portalRuntime.anchorGroup.scale.setScalar(isFocused ? 1.06 : 1);
  portalRuntime.ringMaterial.colorNode = color(...ringColor);
  portalRuntime.ringMaterial.emissiveNode = color(...ringColor).mul(
    0.22 * pulse * focusBoost
  );
  portalRuntime.beamMaterial.colorNode = color(...beamColor);
  portalRuntime.beamMaterial.emissiveNode = color(...beamColor).mul(
    0.28 * pulse * focusBoost
  );
  portalRuntime.beamMaterial.opacity = isFocused ? 0.92 : 0.76;
}

export function createMetaverseScene(config: MetaverseRuntimeConfig): {
  readonly camera: PerspectiveCamera;
  readonly scene: Scene;
  resetPresentation(): void;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number
  ): void;
  syncViewport(
    renderer: MetaverseSceneRendererHost,
    canvasHost: MetaverseSceneCanvasHost,
    devicePixelRatio: number
  ): void;
} {
  const camera = new PerspectiveCamera(
    config.camera.fieldOfViewDegrees,
    1,
    config.camera.near,
    config.camera.far
  );
  const scene = new Scene();
  const skyMesh = createSkyMesh(config);
  const oceanMesh = createOceanMesh(config);
  const portalMeshes = config.portals.map((portalConfig) =>
    createPortalMeshRuntime(portalConfig)
  );

  camera.position.set(
    config.camera.spawnPosition.x,
    config.camera.spawnPosition.y,
    config.camera.spawnPosition.z
  );
  camera.lookAt(0, config.camera.spawnPosition.y, -1);
  camera.updateMatrixWorld(true);

  scene.background = toThreeColor(config.environment.horizonColor);
  scene.fog = new FogExp2(
    toThreeColor(config.environment.fogColor),
    config.environment.fogDensity
  );
  scene.add(
    createHemisphereLight(config),
    createSunLight(config),
    skyMesh,
    oceanMesh
  );

  for (const portalMesh of portalMeshes) {
    scene.add(portalMesh.anchorGroup);
  }

  return {
    camera,
    scene,
    resetPresentation() {
      for (const portalMesh of portalMeshes) {
        portalMesh.anchorGroup.scale.setScalar(1);
      }
    },
    syncPresentation(cameraSnapshot, focusedPortal, nowMs) {
      syncCamera(camera, cameraSnapshot);

      for (const portalMesh of portalMeshes) {
        const portalConfig = config.portals.find(
          (portal) => portal.experienceId === portalMesh.experienceId
        );

        if (portalConfig === undefined) {
          continue;
        }

        syncPortalPresentation(portalMesh, portalConfig, focusedPortal, nowMs);
      }
    },
    syncViewport(renderer, canvasHost, devicePixelRatio) {
      const width = Math.max(1, canvasHost.clientWidth);
      const height = Math.max(1, canvasHost.clientHeight);

      renderer.setPixelRatio(devicePixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }
  };
}
