import type { NormalizedViewportPoint } from "@webgpu-metaverse/shared";
import {
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
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

import type { GameplayReticleVisualState } from "../types/gameplay-presentation";
import type {
  GameplayCameraSnapshot,
  GameplayRuntimeConfig
} from "../types/gameplay-runtime";
import type {
  LocalArenaEnemyBehaviorState,
  LocalArenaEnemyRenderState
} from "../types/local-arena-simulation";

export interface GameplaySceneCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

export interface GameplaySceneRendererHost {
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

type GameplayNodeMaterial = MeshBasicNodeMaterial | MeshStandardNodeMaterial;
type RgbColor = readonly [number, number, number];

interface EnemyMeshRuntime {
  behavior: LocalArenaEnemyBehaviorState | null;
  readonly anchorGroup: Group;
  readonly billboardGroup: Group;
  readonly bodyMaterial: MeshStandardNodeMaterial;
  readonly flightGroup: Group;
  readonly leftWingPivot: Group;
  readonly rightWingPivot: Group;
  readonly wingMaterial: MeshStandardNodeMaterial;
}

interface ProjectionRuntime {
  readonly forward: Vector3;
  readonly right: Vector3;
  readonly up: Vector3;
}

interface ReticleRuntime {
  visualState: GameplayReticleVisualState | null;
  readonly anchorGroup: Group;
  readonly billboardGroup: Group;
  readonly haloMaterial: MeshBasicNodeMaterial;
  readonly horizontalMaterial: MeshBasicNodeMaterial;
  readonly ringMaterial: MeshBasicNodeMaterial;
  readonly styleGroup: Group;
  readonly verticalMaterial: MeshBasicNodeMaterial;
}

function setMaterialColor(
  material: GameplayNodeMaterial,
  nextColor: RgbColor
): void {
  material.colorNode = color(nextColor[0], nextColor[1], nextColor[2]);
}

function setMaterialEmissive(
  material: MeshStandardNodeMaterial,
  nextColor: RgbColor,
  intensity: number
): void {
  material.emissiveNode = color(
    nextColor[0],
    nextColor[1],
    nextColor[2]
  ).mul(intensity);
}

function toThreeColor(rgb: RgbColor): Color {
  return new Color(rgb[0], rgb[1], rgb[2]);
}

function createProjectionRuntime(): ProjectionRuntime {
  return {
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3()
  };
}

function updateProjectionRuntime(
  camera: PerspectiveCamera,
  projectionRuntime: ProjectionRuntime
): void {
  camera.getWorldDirection(projectionRuntime.forward);
  projectionRuntime.right
    .crossVectors(projectionRuntime.forward, camera.up)
    .normalize();
  projectionRuntime.up
    .crossVectors(projectionRuntime.right, projectionRuntime.forward)
    .normalize();
}

function computeProjectionHalfHeight(
  camera: PerspectiveCamera,
  depthFromCamera: number
): number {
  return (
    Math.tan(MathUtils.degToRad(camera.fov * 0.5)) *
    Math.max(depthFromCamera, 0.001)
  );
}

function projectNormalizedPointToPlane(
  camera: PerspectiveCamera,
  projectionRuntime: ProjectionRuntime,
  normalizedX: number,
  normalizedY: number,
  depthFromCamera: number,
  target: Vector3
): void {
  const halfHeight = computeProjectionHalfHeight(camera, depthFromCamera);
  const halfWidth = halfHeight * camera.aspect;

  target
    .copy(camera.position)
    .addScaledVector(projectionRuntime.forward, depthFromCamera)
    .addScaledVector(projectionRuntime.right, (normalizedX * 2 - 1) * halfWidth)
    .addScaledVector(projectionRuntime.up, (1 - normalizedY * 2) * halfHeight);
}

export function createGameplayScene(
  config: GameplayRuntimeConfig,
  enemyStates: readonly LocalArenaEnemyRenderState[]
): {
  readonly camera: PerspectiveCamera;
  readonly scene: Scene;
  resetPresentation(): void;
  syncArenaPresentation(
    cameraSnapshot: GameplayCameraSnapshot,
    arenaEnemyStates: readonly LocalArenaEnemyRenderState[],
    aimPoint: NormalizedViewportPoint | null,
    reticleVisualState: GameplayReticleVisualState
  ): void;
  syncViewport(
    renderer: GameplaySceneRendererHost,
    canvasHost: GameplaySceneCanvasHost,
    devicePixelRatio: number
  ): void;
  updateReticleDrift(rotationZ: number): void;
} {
  const camera = new PerspectiveCamera(
    config.camera.fieldOfViewDegrees,
    1,
    config.camera.near,
    config.camera.far
  );
  const scene = new Scene();
  const projectionRuntime = createProjectionRuntime();
  const skyMesh = createSkyMesh(config);
  const oceanMesh = createOceanMesh(config);
  const reticleRuntime = createReticleRuntime(config);
  const enemyMeshes = createEnemyMeshes(config, enemyStates);

  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
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

  for (const enemyMesh of enemyMeshes) {
    scene.add(enemyMesh.anchorGroup);
  }

  return {
    camera,
    scene,
    resetPresentation() {
      reticleRuntime.anchorGroup.visible = false;
      reticleRuntime.visualState = null;

      for (const enemyMesh of enemyMeshes) {
        enemyMesh.anchorGroup.visible = true;
      }
    },
    syncArenaPresentation(
      cameraSnapshot,
      arenaEnemyStates,
      aimPoint,
      reticleVisualState
    ) {
      syncCamera(camera, cameraSnapshot);
      ensureEnemyMeshCount(enemyMeshes, arenaEnemyStates, scene, config);
      updateProjectionRuntime(camera, projectionRuntime);
      syncReticleGroup(
        reticleRuntime,
        camera,
        projectionRuntime,
        aimPoint,
        reticleVisualState,
        config
      );
      syncEnemyMeshes(
        enemyMeshes,
        arenaEnemyStates,
        camera,
        config
      );
    },
    syncViewport(renderer, canvasHost, devicePixelRatio) {
      const width = Math.max(1, canvasHost.clientWidth);
      const height = Math.max(1, canvasHost.clientHeight);

      renderer.setPixelRatio(devicePixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    },
    updateReticleDrift(rotationZ) {
      reticleRuntime.styleGroup.rotation.z = rotationZ;
    }
  };
}

function createHemisphereLight(config: GameplayRuntimeConfig): HemisphereLight {
  const light = new HemisphereLight(
    toThreeColor(config.environment.zenithColor),
    toThreeColor(config.ocean.farColor),
    1.8
  );

  light.position.set(0, 1, 0);

  return light;
}

function createSunLight(config: GameplayRuntimeConfig): DirectionalLight {
  const light = new DirectionalLight(
    toThreeColor(config.environment.sunColor),
    2.2
  );
  const { sunDirection } = config.environment;
  const sunOffset = new Vector3(
    -sunDirection.x * 80,
    -sunDirection.y * 80,
    -sunDirection.z * 80
  );

  light.position.copy(sunOffset);
  light.target.position.set(0, 0, 0);
  light.target.updateMatrixWorld();

  return light;
}

function syncCamera(
  camera: PerspectiveCamera,
  cameraSnapshot: GameplayCameraSnapshot
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

function createSkyMesh(config: GameplayRuntimeConfig): Mesh {
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

function createOceanMesh(config: GameplayRuntimeConfig): Mesh {
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

function createEnemyMeshes(
  config: GameplayRuntimeConfig,
  enemyStates: readonly LocalArenaEnemyRenderState[]
): EnemyMeshRuntime[] {
  return enemyStates.map((enemyState) => createEnemyMesh(config, enemyState));
}

function createEnemyMesh(
  config: GameplayRuntimeConfig,
  enemyState: LocalArenaEnemyRenderState
): EnemyMeshRuntime {
  const bodyGeometry = new SphereGeometry(0.5, 20, 16);
  const headGeometry = new SphereGeometry(0.5, 16, 12);
  const wingGeometry = new BoxGeometry(1, 1, 1);
  const tailGeometry = new BoxGeometry(1, 1, 1);
  const bodyDepth = config.enemies.bodySize.height * 0.92;
  const headRadius = config.enemies.bodySize.height * 0.48;
  const beakLength = config.enemies.bodySize.width * 0.3;
  const beakDepth = config.enemies.bodySize.height * 0.18;
  const wingDepth = config.enemies.wingSize.height * 2.8;

  const anchorGroup = new Group();
  const billboardGroup = new Group();
  const flightGroup = new Group();
  const bodyMaterial = new MeshStandardNodeMaterial({
    transparent: true
  });
  const wingMaterial = new MeshStandardNodeMaterial({
    transparent: true
  });
  const accentMaterial = new MeshStandardNodeMaterial();
  const bodyMesh = new Mesh(bodyGeometry, bodyMaterial);
  const headMesh = new Mesh(headGeometry, bodyMaterial);
  const beakMesh = new Mesh(
    new BoxGeometry(beakLength, beakDepth, beakDepth),
    accentMaterial
  );
  const leftWingPivot = new Group();
  const rightWingPivot = new Group();
  const leftWing = new Mesh(wingGeometry, wingMaterial);
  const rightWing = new Mesh(wingGeometry, wingMaterial);
  const tailMesh = new Mesh(tailGeometry, wingMaterial);

  bodyMesh.scale.set(
    config.enemies.bodySize.width,
    config.enemies.bodySize.height,
    bodyDepth
  );
  headMesh.scale.setScalar(headRadius);
  headMesh.position.set(config.enemies.bodySize.width * 0.42, headRadius * 0.2, 0);
  beakMesh.position.set(config.enemies.bodySize.width * 0.72, 0, 0);
  leftWing.scale.set(
    config.enemies.wingSize.width,
    config.enemies.wingSize.height,
    wingDepth
  );
  rightWing.scale.set(
    config.enemies.wingSize.width,
    config.enemies.wingSize.height,
    wingDepth
  );
  tailMesh.scale.set(
    config.enemies.bodySize.width * 0.3,
    config.enemies.bodySize.height * 0.52,
    config.enemies.bodySize.height * 0.32
  );
  leftWing.position.x = -config.enemies.wingSize.width * 0.42;
  rightWing.position.x = config.enemies.wingSize.width * 0.42;
  leftWingPivot.position.x = -config.enemies.bodySize.width * 0.1;
  rightWingPivot.position.x = config.enemies.bodySize.width * 0.1;
  tailMesh.position.x = -config.enemies.bodySize.width * 0.58;
  tailMesh.rotation.z = Math.PI * 0.16;

  setMaterialColor(accentMaterial, [0.98, 0.76, 0.29]);
  setMaterialEmissive(accentMaterial, [0.98, 0.74, 0.25], 0.05);
  accentMaterial.roughnessNode = float(0.32);
  accentMaterial.metalnessNode = float(0);
  leftWingPivot.add(leftWing);
  rightWingPivot.add(rightWing);
  flightGroup.add(
    bodyMesh,
    headMesh,
    beakMesh,
    leftWingPivot,
    rightWingPivot,
    tailMesh
  );
  billboardGroup.add(flightGroup);
  anchorGroup.add(billboardGroup);
  anchorGroup.position.set(0, 0, 0);
  anchorGroup.visible = enemyState.visible;

  const enemyMesh: EnemyMeshRuntime = {
    behavior: null,
    anchorGroup,
    billboardGroup,
    bodyMaterial,
    flightGroup,
    leftWingPivot,
    rightWingPivot,
    wingMaterial
  };

  applyEnemyBehaviorStyle(enemyMesh, enemyState.behavior, config);

  return enemyMesh;
}

function ensureEnemyMeshCount(
  enemyMeshes: EnemyMeshRuntime[],
  enemyStates: readonly LocalArenaEnemyRenderState[],
  scene: Scene,
  config: GameplayRuntimeConfig
): void {
  for (let index = enemyMeshes.length; index < enemyStates.length; index += 1) {
    const enemyMesh = createEnemyMesh(config, enemyStates[index]!);

    enemyMeshes.push(enemyMesh);
    scene.add(enemyMesh.anchorGroup);
  }
}

function createReticleRuntime(config: GameplayRuntimeConfig): ReticleRuntime {
  const anchorGroup = new Group();
  const billboardGroup = new Group();
  const styleGroup = new Group();
  const ringMaterial = new MeshBasicNodeMaterial({
    transparent: true
  });
  const horizontalMaterial = new MeshBasicNodeMaterial({
    transparent: true
  });
  const haloMaterial = new MeshBasicNodeMaterial({
    transparent: true
  });
  const verticalMaterial = new MeshBasicNodeMaterial({
    transparent: true
  });
  const ringMesh = new Mesh(
    new RingGeometry(
      config.reticle.innerRadius,
      config.reticle.outerRadius,
      64
    ),
    ringMaterial
  );
  const haloMesh = new Mesh(
    new RingGeometry(
      config.reticle.haloInnerRadius,
      config.reticle.haloOuterRadius,
      64
    ),
    haloMaterial
  );
  const horizontalBar = new Mesh(
    new PlaneGeometry(
      config.reticle.horizontalBarSize.width,
      config.reticle.horizontalBarSize.height
    ),
    horizontalMaterial
  );
  const verticalBar = new Mesh(
    new PlaneGeometry(
      config.reticle.verticalBarSize.width,
      config.reticle.verticalBarSize.height
    ),
    verticalMaterial
  );

  ringMaterial.depthWrite = false;
  ringMaterial.depthTest = false;
  haloMaterial.depthWrite = false;
  haloMaterial.depthTest = false;
  horizontalMaterial.depthWrite = false;
  horizontalMaterial.depthTest = false;
  verticalMaterial.depthWrite = false;
  verticalMaterial.depthTest = false;
  anchorGroup.visible = false;
  styleGroup.add(haloMesh, ringMesh, horizontalBar, verticalBar);
  billboardGroup.add(styleGroup);
  anchorGroup.add(billboardGroup);

  const reticleRuntime: ReticleRuntime = {
    visualState: null,
    anchorGroup,
    billboardGroup,
    haloMaterial,
    horizontalMaterial,
    ringMaterial,
    styleGroup,
    verticalMaterial
  };

  applyReticleVisualState(reticleRuntime, "neutral", config);

  return reticleRuntime;
}

function applyEnemyBehaviorStyle(
  enemyMesh: EnemyMeshRuntime,
  behavior: LocalArenaEnemyBehaviorState,
  config: GameplayRuntimeConfig
): void {
  enemyMesh.behavior = behavior;

  if (behavior === "downed") {
    setMaterialColor(enemyMesh.bodyMaterial, config.enemies.downedColor);
    setMaterialColor(enemyMesh.wingMaterial, config.enemies.downedColor);
    setMaterialEmissive(enemyMesh.bodyMaterial, config.enemies.downedColor, 0.08);
    setMaterialEmissive(enemyMesh.wingMaterial, config.enemies.downedColor, 0.05);
    enemyMesh.bodyMaterial.opacity = 0.88;
    enemyMesh.wingMaterial.opacity = 0.8;
    return;
  }

  if (behavior === "scatter") {
    setMaterialColor(enemyMesh.bodyMaterial, config.enemies.scatterColor);
    setMaterialColor(enemyMesh.wingMaterial, config.enemies.scatterColor);
    setMaterialEmissive(enemyMesh.bodyMaterial, config.enemies.scatterColor, 0.07);
    setMaterialEmissive(enemyMesh.wingMaterial, config.enemies.scatterColor, 0.04);
    enemyMesh.bodyMaterial.opacity = 0.98;
    enemyMesh.wingMaterial.opacity = 0.94;
    return;
  }

  setMaterialColor(enemyMesh.bodyMaterial, config.enemies.bodyColor);
  setMaterialColor(enemyMesh.wingMaterial, config.enemies.wingColor);
  setMaterialEmissive(enemyMesh.bodyMaterial, config.enemies.bodyColor, 0.03);
  setMaterialEmissive(enemyMesh.wingMaterial, config.enemies.wingColor, 0.02);
  enemyMesh.bodyMaterial.opacity = 0.96;
  enemyMesh.wingMaterial.opacity = 0.92;
}

function applyReticleVisualState(
  reticleRuntime: ReticleRuntime,
  visualState: Exclude<GameplayReticleVisualState, "hidden">,
  config: GameplayRuntimeConfig
): void {
  const style = config.reticle.stateStyles[visualState];

  reticleRuntime.visualState = visualState;
  setMaterialColor(reticleRuntime.ringMaterial, style.strokeColor);
  setMaterialColor(reticleRuntime.horizontalMaterial, style.strokeColor);
  setMaterialColor(reticleRuntime.verticalMaterial, style.strokeColor);
  setMaterialColor(reticleRuntime.haloMaterial, style.strokeColor);
  reticleRuntime.ringMaterial.opacity = style.strokeOpacity;
  reticleRuntime.horizontalMaterial.opacity = style.strokeOpacity * 0.84;
  reticleRuntime.verticalMaterial.opacity = style.strokeOpacity * 0.84;
  reticleRuntime.haloMaterial.opacity = style.haloOpacity;
}

function syncEnemyMeshes(
  enemyMeshes: readonly EnemyMeshRuntime[],
  enemyStates: readonly LocalArenaEnemyRenderState[],
  camera: PerspectiveCamera,
  config: GameplayRuntimeConfig
): void {
  for (let index = 0; index < enemyMeshes.length; index += 1) {
    const enemyMesh = enemyMeshes[index]!;
    const enemyState = enemyStates[index];

    if (enemyState === undefined) {
      enemyMesh.anchorGroup.visible = false;
      continue;
    }

    if (enemyMesh.behavior !== enemyState.behavior) {
      applyEnemyBehaviorStyle(enemyMesh, enemyState.behavior, config);
    }

    enemyMesh.anchorGroup.visible = enemyState.visible;
    enemyMesh.billboardGroup.quaternion.copy(camera.quaternion);

    const motionLift =
      Math.sin(enemyState.wingPhase * 0.5) * config.enemies.bodySize.height * 0.28;
    const wingSwing =
      Math.sin(enemyState.wingPhase) *
      config.enemies.wingSweepRadians *
      (enemyState.behavior === "downed" ? 0.18 : 1);
    const pitchRadians =
      enemyState.behavior === "downed"
        ? 0.52
        : enemyState.behavior === "scatter"
        ? -0.14
          : -0.08;

    enemyMesh.anchorGroup.position.set(
      enemyState.positionX,
      enemyState.positionY,
      enemyState.positionZ
    );
    enemyMesh.flightGroup.position.y = motionLift;
    enemyMesh.flightGroup.rotation.set(
      pitchRadians,
      0,
      enemyState.headingRadians
    );
    enemyMesh.flightGroup.scale.setScalar(enemyState.scale);
    enemyMesh.leftWingPivot.rotation.y = wingSwing;
    enemyMesh.rightWingPivot.rotation.y = -wingSwing;
  }
}

function syncReticleGroup(
  reticleRuntime: ReticleRuntime,
  camera: PerspectiveCamera,
  projectionRuntime: ProjectionRuntime,
  aimPoint: NormalizedViewportPoint | null,
  visualState: GameplayReticleVisualState,
  config: GameplayRuntimeConfig
): void {
  if (aimPoint === null || visualState === "hidden") {
    reticleRuntime.anchorGroup.visible = false;
    return;
  }

  reticleRuntime.anchorGroup.visible = true;
  reticleRuntime.billboardGroup.quaternion.copy(camera.quaternion);

  if (reticleRuntime.visualState !== visualState) {
    applyReticleVisualState(reticleRuntime, visualState, config);
  }

  const projectionScale = computeProjectionHalfHeight(camera, config.reticle.depth);
  const styleScale = config.reticle.stateStyles[visualState].scale;

  projectNormalizedPointToPlane(
    camera,
    projectionRuntime,
    aimPoint.x,
    aimPoint.y,
    config.reticle.depth,
    reticleRuntime.anchorGroup.position
  );
  reticleRuntime.styleGroup.scale.setScalar(projectionScale * styleScale);
}
