import type { NormalizedViewportPoint } from "@thumbshooter/shared";
import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RingGeometry,
  Scene
} from "three/webgpu";
import { color, mix, uv } from "three/tsl";

import type {
  GameplayReticleVisualState
} from "../types/gameplay-presentation";
import type { GameplayRuntimeConfig } from "../types/gameplay-runtime";
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

interface EnemyMeshRuntime {
  behavior: LocalArenaEnemyBehaviorState | null;
  readonly bodyMaterial: MeshBasicNodeMaterial;
  readonly group: Group;
  readonly leftWingPivot: Group;
  readonly rightWingPivot: Group;
  readonly wingMaterial: MeshBasicNodeMaterial;
}

interface ReticleRuntime {
  visualState: GameplayReticleVisualState | null;
  readonly group: Group;
  readonly haloMaterial: MeshBasicNodeMaterial;
  readonly horizontalMaterial: MeshBasicNodeMaterial;
  readonly ringMaterial: MeshBasicNodeMaterial;
  readonly verticalMaterial: MeshBasicNodeMaterial;
}

function setMaterialColor(
  material: MeshBasicNodeMaterial,
  nextColor: readonly [number, number, number]
): void {
  material.colorNode = color(nextColor[0], nextColor[1], nextColor[2]);
}

function toWorldX(camera: OrthographicCamera, normalizedX: number): number {
  return (normalizedX * 2 - 1) * camera.right;
}

function toWorldY(normalizedY: number): number {
  return 1 - normalizedY * 2;
}

export function createGameplayScene(
  config: GameplayRuntimeConfig,
  enemyStates: readonly LocalArenaEnemyRenderState[]
): {
  readonly camera: OrthographicCamera;
  readonly scene: Scene;
  resetPresentation(): void;
  syncArenaPresentation(
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
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const scene = new Scene();
  const backgroundMesh = createBackgroundMesh(config);
  const reticleRuntime = createReticleRuntime(config);
  const enemyMeshes = createEnemyMeshes(config, enemyStates, camera);

  camera.position.z = 5;
  scene.add(backgroundMesh);
  scene.add(reticleRuntime.group);

  for (const enemyMesh of enemyMeshes) {
    scene.add(enemyMesh.group);
  }

  return {
    camera,
    scene,
    resetPresentation() {
      reticleRuntime.group.visible = false;
      reticleRuntime.visualState = null;

      for (const enemyMesh of enemyMeshes) {
        enemyMesh.group.visible = true;
      }
    },
    syncArenaPresentation(arenaEnemyStates, aimPoint, reticleVisualState) {
      syncReticleGroup(
        reticleRuntime,
        camera,
        aimPoint,
        reticleVisualState,
        config
      );
      syncEnemyMeshes(enemyMeshes, arenaEnemyStates, camera, config);
    },
    syncViewport(renderer, canvasHost, devicePixelRatio) {
      const width = Math.max(1, canvasHost.clientWidth);
      const height = Math.max(1, canvasHost.clientHeight);
      const aspect = width / height;

      renderer.setPixelRatio(devicePixelRatio);
      renderer.setSize(width, height, false);
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      backgroundMesh.scale.set(aspect, 1, 1);
    },
    updateReticleDrift(rotationZ) {
      reticleRuntime.group.rotation.z = rotationZ;
    }
  };
}

function createBackgroundMesh(config: GameplayRuntimeConfig): Mesh {
  const backgroundMaterial = new MeshBasicNodeMaterial();

  backgroundMaterial.colorNode = mix(
    color(...config.background.lowerColor),
    color(...config.background.upperColor),
    uv().y
  );

  return new Mesh(new PlaneGeometry(2, 2), backgroundMaterial);
}

function createEnemyMeshes(
  config: GameplayRuntimeConfig,
  enemyStates: readonly LocalArenaEnemyRenderState[],
  camera: OrthographicCamera
): EnemyMeshRuntime[] {
  return enemyStates.map((enemyState) => {
    const group = new Group();
    const bodyMaterial = new MeshBasicNodeMaterial({
      transparent: true
    });
    const wingMaterial = new MeshBasicNodeMaterial({
      transparent: true
    });
    const bodyMesh = new Mesh(
      new PlaneGeometry(
        config.enemies.bodySize.width,
        config.enemies.bodySize.height
      ),
      bodyMaterial
    );
    const leftWingPivot = new Group();
    const rightWingPivot = new Group();
    const leftWing = new Mesh(
      new PlaneGeometry(
        config.enemies.wingSize.width,
        config.enemies.wingSize.height
      ),
      wingMaterial
    );
    const rightWing = new Mesh(
      new PlaneGeometry(
        config.enemies.wingSize.width,
        config.enemies.wingSize.height
      ),
      wingMaterial
    );

    setMaterialColor(bodyMaterial, config.enemies.bodyColor);
    setMaterialColor(wingMaterial, config.enemies.wingColor);
    bodyMaterial.opacity = 0.95;
    wingMaterial.opacity = 0.92;

    leftWing.position.x = -config.enemies.wingSize.width * 0.38;
    rightWing.position.x = config.enemies.wingSize.width * 0.38;
    leftWingPivot.position.x = -config.enemies.bodySize.width * 0.18;
    rightWingPivot.position.x = config.enemies.bodySize.width * 0.18;

    leftWingPivot.add(leftWing);
    rightWingPivot.add(rightWing);
    group.add(bodyMesh, leftWingPivot, rightWingPivot);
    group.position.set(
      toWorldX(camera, enemyState.positionX),
      toWorldY(enemyState.positionY),
      0.04
    );
    group.scale.setScalar(enemyState.scale);
    group.visible = enemyState.visible;
    const enemyMesh: EnemyMeshRuntime = {
      behavior: null,
      bodyMaterial,
      group,
      leftWingPivot,
      rightWingPivot,
      wingMaterial
    };

    applyEnemyBehaviorStyle(enemyMesh, enemyState.behavior, config);

    return enemyMesh;
  });
}

function createReticleRuntime(config: GameplayRuntimeConfig): ReticleRuntime {
  const group = new Group();
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

  group.visible = false;
  group.add(haloMesh, ringMesh, horizontalBar, verticalBar);

  const reticleRuntime: ReticleRuntime = {
    visualState: null,
    group,
    haloMaterial,
    horizontalMaterial,
    ringMaterial,
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
    enemyMesh.bodyMaterial.opacity = 0.82;
    enemyMesh.wingMaterial.opacity = 0.78;
    return;
  }

  if (behavior === "scatter") {
    setMaterialColor(enemyMesh.bodyMaterial, config.enemies.scatterColor);
    setMaterialColor(enemyMesh.wingMaterial, config.enemies.scatterColor);
    enemyMesh.bodyMaterial.opacity = 0.96;
    enemyMesh.wingMaterial.opacity = 0.94;
    return;
  }

  setMaterialColor(enemyMesh.bodyMaterial, config.enemies.bodyColor);
  setMaterialColor(enemyMesh.wingMaterial, config.enemies.wingColor);
  enemyMesh.bodyMaterial.opacity = 0.95;
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
  reticleRuntime.group.scale.setScalar(style.scale);
  reticleRuntime.ringMaterial.opacity = style.strokeOpacity;
  reticleRuntime.horizontalMaterial.opacity = style.strokeOpacity * 0.84;
  reticleRuntime.verticalMaterial.opacity = style.strokeOpacity * 0.84;
  reticleRuntime.haloMaterial.opacity = style.haloOpacity;
}

function syncEnemyMeshes(
  enemyMeshes: readonly EnemyMeshRuntime[],
  enemyStates: readonly LocalArenaEnemyRenderState[],
  camera: OrthographicCamera,
  config: GameplayRuntimeConfig
): void {
  for (let index = 0; index < enemyMeshes.length; index += 1) {
    const enemyMesh = enemyMeshes[index]!;
    const enemyState = enemyStates[index];

    if (enemyState === undefined) {
      enemyMesh.group.visible = false;
      continue;
    }

    if (enemyMesh.behavior !== enemyState.behavior) {
      applyEnemyBehaviorStyle(enemyMesh, enemyState.behavior, config);
    }

    enemyMesh.group.visible = enemyState.visible;
    enemyMesh.group.position.set(
      toWorldX(camera, enemyState.positionX),
      toWorldY(enemyState.positionY),
      0.04
    );
    enemyMesh.group.rotation.z = enemyState.headingRadians;
    enemyMesh.group.scale.setScalar(enemyState.scale);
    enemyMesh.leftWingPivot.rotation.z =
      Math.sin(enemyState.wingPhase) * config.enemies.wingSweepRadians;
    enemyMesh.rightWingPivot.rotation.z =
      -Math.sin(enemyState.wingPhase) * config.enemies.wingSweepRadians;
  }
}

function syncReticleGroup(
  reticleRuntime: ReticleRuntime,
  camera: OrthographicCamera,
  aimPoint: NormalizedViewportPoint | null,
  visualState: GameplayReticleVisualState,
  config: GameplayRuntimeConfig
): void {
  if (aimPoint === null || visualState === "hidden") {
    reticleRuntime.group.visible = false;
    return;
  }

  reticleRuntime.group.visible = true;

  if (reticleRuntime.visualState !== visualState) {
    applyReticleVisualState(reticleRuntime, visualState, config);
  }

  reticleRuntime.group.position.set(
    toWorldX(camera, aimPoint.x),
    toWorldY(aimPoint.y),
    0.1
  );
}
