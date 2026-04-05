import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  WebGPURenderer
} from "three/webgpu";
import { color, mix, uv } from "three/tsl";

import { gameplayRuntimeConfig } from "../config/gameplay-runtime";
import type {
  GameplayHudSnapshot,
  GameplayRuntimeConfig
} from "../types/gameplay-runtime";
import type { LatestHandTrackingSnapshot } from "../types/hand-tracking";
import { LocalArenaSimulation } from "./local-arena-simulation";

interface GameplayTrackingSource {
  readonly latestPose: LatestHandTrackingSnapshot;
}

interface GameplayRendererHost {
  init(): Promise<void>;
  render(scene: Scene, camera: OrthographicCamera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
}

interface GameplayCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

interface EnemyMeshRuntime {
  readonly bodyMaterial: MeshBasicNodeMaterial;
  readonly group: Group;
  readonly leftWingPivot: Group;
  readonly rightWingPivot: Group;
  readonly wingMaterial: MeshBasicNodeMaterial;
}

interface GameplayRuntimeDependencies {
  readonly cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
  readonly createRenderer?: (
    canvas: HTMLCanvasElement
  ) => GameplayRendererHost;
  readonly devicePixelRatio?: number;
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
}

function createDefaultRenderer(canvas: HTMLCanvasElement): GameplayRendererHost {
  return new WebGPURenderer({
    alpha: true,
    antialias: true,
    canvas
  });
}

function freezeHudSnapshot(
  lifecycle: GameplayHudSnapshot["lifecycle"],
  failureReason: string | null,
  arenaHudSnapshot: LocalArenaSimulation["hudSnapshot"]
): GameplayHudSnapshot {
  return Object.freeze({
    aimPoint: arenaHudSnapshot.aimPoint,
    arena: arenaHudSnapshot.arena,
    failureReason,
    lifecycle,
    targetFeedback: arenaHudSnapshot.targetFeedback,
    trackingState: arenaHudSnapshot.trackingState,
    weapon: arenaHudSnapshot.weapon
  });
}

function readNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function setMaterialColor(
  material: MeshBasicNodeMaterial,
  nextColor: readonly [number, number, number]
): void {
  material.colorNode = color(nextColor[0], nextColor[1], nextColor[2]);
}

export class WebGpuGameplayRuntime {
  readonly #arenaSimulation: LocalArenaSimulation;
  readonly #camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  readonly #config: GameplayRuntimeConfig;
  readonly #createRenderer: (canvas: HTMLCanvasElement) => GameplayRendererHost;
  readonly #devicePixelRatio: number;
  readonly #requestAnimationFrame: typeof globalThis.requestAnimationFrame;
  readonly #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  readonly #scene = new Scene();
  readonly #trackingSource: GameplayTrackingSource;
  readonly #backgroundMesh: Mesh;
  readonly #enemyMeshes: EnemyMeshRuntime[] = [];
  readonly #reticleGroup = new Group();

  #animationFrameHandle = 0;
  #animationStartAtMs = 0;
  #canvasHost: GameplayCanvasHost | null = null;
  #hudSnapshot: GameplayHudSnapshot;
  #renderer: GameplayRendererHost | null = null;

  constructor(
    trackingSource: GameplayTrackingSource,
    arenaSimulation: LocalArenaSimulation,
    config: GameplayRuntimeConfig = gameplayRuntimeConfig,
    dependencies: GameplayRuntimeDependencies = {}
  ) {
    this.#arenaSimulation = arenaSimulation;
    this.#config = config;
    this.#trackingSource = trackingSource;
    this.#createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    this.#devicePixelRatio = dependencies.devicePixelRatio ?? window.devicePixelRatio;
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? window.requestAnimationFrame;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? window.cancelAnimationFrame;

    this.#camera.position.z = 5;
    this.#backgroundMesh = this.#createBackgroundMesh();
    this.#scene.add(this.#backgroundMesh);
    this.#scene.add(this.#reticleGroup);
    this.#createReticleMeshes();
    this.#createEnemyMeshes();
    this.#hudSnapshot = freezeHudSnapshot("idle", null, this.#arenaSimulation.hudSnapshot);
  }

  get hudSnapshot(): GameplayHudSnapshot {
    return this.#hudSnapshot;
  }

  async start(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined = window.navigator
  ): Promise<GameplayHudSnapshot> {
    this.dispose();
    this.#arenaSimulation.reset();

    if (navigatorLike?.gpu === undefined) {
      this.#hudSnapshot = freezeHudSnapshot(
        "failed",
        "WebGPU is unavailable for the gameplay runtime.",
        this.#arenaSimulation.hudSnapshot
      );
      throw new Error(
        this.#hudSnapshot.failureReason ??
          "WebGPU is unavailable for the gameplay runtime."
      );
    }

    this.#hudSnapshot = freezeHudSnapshot(
      "booting",
      null,
      this.#arenaSimulation.hudSnapshot
    );
    this.#canvasHost = canvas;
    this.#renderer = this.#createRenderer(canvas);
    await this.#renderer.init();
    this.#animationStartAtMs = readNowMs();
    this.#syncViewport();
    this.#syncArenaFrame(this.#animationStartAtMs);
    this.#hudSnapshot = freezeHudSnapshot(
      "running",
      null,
      this.#arenaSimulation.hudSnapshot
    );
    this.#queueNextFrame();

    return this.#hudSnapshot;
  }

  dispose(): void {
    if (this.#animationFrameHandle !== 0) {
      this.#cancelAnimationFrame(this.#animationFrameHandle);
      this.#animationFrameHandle = 0;
    }

    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvasHost = null;
    this.#reticleGroup.visible = false;
    this.#animationStartAtMs = 0;
    this.#arenaSimulation.reset();

    for (const enemyMesh of this.#enemyMeshes) {
      enemyMesh.group.visible = true;
    }

    if (this.#hudSnapshot.lifecycle !== "failed") {
      this.#hudSnapshot = freezeHudSnapshot(
        "idle",
        null,
        this.#arenaSimulation.hudSnapshot
      );
    }
  }

  #createBackgroundMesh(): Mesh {
    const backgroundMaterial = new MeshBasicNodeMaterial();

    backgroundMaterial.colorNode = mix(
      color(...this.#config.background.lowerColor),
      color(...this.#config.background.upperColor),
      uv().y
    );

    return new Mesh(new PlaneGeometry(2, 2), backgroundMaterial);
  }

  #createEnemyMeshes(): void {
    for (const enemyState of this.#arenaSimulation.enemyRenderStates) {
      const group = new Group();
      const bodyMaterial = new MeshBasicNodeMaterial({
        transparent: true
      });
      const wingMaterial = new MeshBasicNodeMaterial({
        transparent: true
      });
      const bodyMesh = new Mesh(
        new PlaneGeometry(
          this.#config.enemies.bodySize.width,
          this.#config.enemies.bodySize.height
        ),
        bodyMaterial
      );
      const leftWingPivot = new Group();
      const rightWingPivot = new Group();
      const leftWing = new Mesh(
        new PlaneGeometry(
          this.#config.enemies.wingSize.width,
          this.#config.enemies.wingSize.height
        ),
        wingMaterial
      );
      const rightWing = new Mesh(
        new PlaneGeometry(
          this.#config.enemies.wingSize.width,
          this.#config.enemies.wingSize.height
        ),
        wingMaterial
      );

      setMaterialColor(bodyMaterial, this.#config.enemies.bodyColor);
      setMaterialColor(wingMaterial, this.#config.enemies.wingColor);
      bodyMaterial.opacity = 0.95;
      wingMaterial.opacity = 0.92;

      leftWing.position.x = -this.#config.enemies.wingSize.width * 0.38;
      rightWing.position.x = this.#config.enemies.wingSize.width * 0.38;
      leftWingPivot.position.x = -this.#config.enemies.bodySize.width * 0.18;
      rightWingPivot.position.x = this.#config.enemies.bodySize.width * 0.18;

      leftWingPivot.add(leftWing);
      rightWingPivot.add(rightWing);
      group.add(bodyMesh, leftWingPivot, rightWingPivot);
      group.position.set(
        this.#toWorldX(enemyState.positionX),
        this.#toWorldY(enemyState.positionY),
        0.04
      );
      group.scale.setScalar(enemyState.scale);
      group.visible = enemyState.visible;

      this.#enemyMeshes.push({
        bodyMaterial,
        group,
        leftWingPivot,
        rightWingPivot,
        wingMaterial
      });
      this.#scene.add(group);
    }
  }

  #createReticleMeshes(): void {
    const reticleMaterial = new MeshBasicNodeMaterial({
      transparent: true
    });
    const horizontalMaterial = new MeshBasicNodeMaterial({
      transparent: true
    });
    const verticalMaterial = new MeshBasicNodeMaterial({
      transparent: true
    });

    reticleMaterial.colorNode = color(...this.#config.reticle.strokeColor);
    horizontalMaterial.colorNode = color(...this.#config.reticle.strokeColor);
    verticalMaterial.colorNode = color(...this.#config.reticle.strokeColor);

    const ringMesh = new Mesh(
      new RingGeometry(
        this.#config.reticle.innerRadius,
        this.#config.reticle.outerRadius,
        64
      ),
      reticleMaterial
    );
    const horizontalBar = new Mesh(
      new PlaneGeometry(
        this.#config.reticle.horizontalBarSize.width,
        this.#config.reticle.horizontalBarSize.height
      ),
      horizontalMaterial
    );
    const verticalBar = new Mesh(
      new PlaneGeometry(
        this.#config.reticle.verticalBarSize.width,
        this.#config.reticle.verticalBarSize.height
      ),
      verticalMaterial
    );

    this.#reticleGroup.visible = false;
    this.#reticleGroup.add(ringMesh, horizontalBar, verticalBar);
  }

  #queueNextFrame(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    this.#animationFrameHandle = this.#requestAnimationFrame(() => {
      this.#animationFrameHandle = 0;
      this.#renderFrame();
      this.#queueNextFrame();
    });
  }

  #renderFrame(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    const nowMs = readNowMs();

    this.#syncViewport();
    this.#syncArenaFrame(nowMs);
    this.#reticleGroup.rotation.z =
      Math.sin(((nowMs - this.#animationStartAtMs) / 1000) * 1.4) * 0.03;
    this.#renderer.render(this.#scene, this.#camera);
  }

  #syncArenaFrame(nowMs: number): void {
    const arenaHudSnapshot = this.#arenaSimulation.advance(
      this.#trackingSource.latestPose,
      nowMs
    );

    this.#syncReticleFromArena(arenaHudSnapshot.aimPoint);
    this.#syncEnemiesFromArena();
    this.#hudSnapshot = freezeHudSnapshot("running", null, arenaHudSnapshot);
  }

  #syncEnemiesFromArena(): void {
    const enemyStates = this.#arenaSimulation.enemyRenderStates;

    for (let index = 0; index < this.#enemyMeshes.length; index += 1) {
      const enemyMesh = this.#enemyMeshes[index]!;
      const enemyState = enemyStates[index];

      if (enemyState === undefined) {
        enemyMesh.group.visible = false;
        continue;
      }

      if (enemyState.behavior === "downed") {
        setMaterialColor(enemyMesh.bodyMaterial, this.#config.enemies.downedColor);
        setMaterialColor(enemyMesh.wingMaterial, this.#config.enemies.downedColor);
        enemyMesh.bodyMaterial.opacity = 0.82;
        enemyMesh.wingMaterial.opacity = 0.78;
      } else if (enemyState.behavior === "scatter") {
        setMaterialColor(enemyMesh.bodyMaterial, this.#config.enemies.scatterColor);
        setMaterialColor(enemyMesh.wingMaterial, this.#config.enemies.scatterColor);
        enemyMesh.bodyMaterial.opacity = 0.96;
        enemyMesh.wingMaterial.opacity = 0.94;
      } else {
        setMaterialColor(enemyMesh.bodyMaterial, this.#config.enemies.bodyColor);
        setMaterialColor(enemyMesh.wingMaterial, this.#config.enemies.wingColor);
        enemyMesh.bodyMaterial.opacity = 0.95;
        enemyMesh.wingMaterial.opacity = 0.92;
      }

      enemyMesh.group.visible = enemyState.visible;
      enemyMesh.group.position.set(
        this.#toWorldX(enemyState.positionX),
        this.#toWorldY(enemyState.positionY),
        0.04
      );
      enemyMesh.group.rotation.z = enemyState.headingRadians;
      enemyMesh.group.scale.setScalar(enemyState.scale);
      enemyMesh.leftWingPivot.rotation.z =
        Math.sin(enemyState.wingPhase) * this.#config.enemies.wingSweepRadians;
      enemyMesh.rightWingPivot.rotation.z =
        -Math.sin(enemyState.wingPhase) * this.#config.enemies.wingSweepRadians;
    }
  }

  #syncReticleFromArena(aimPoint: GameplayHudSnapshot["aimPoint"]): void {
    if (aimPoint === null) {
      this.#reticleGroup.visible = false;
      return;
    }

    this.#reticleGroup.visible = true;
    this.#reticleGroup.position.set(
      this.#toWorldX(aimPoint.x),
      this.#toWorldY(aimPoint.y),
      0.1
    );
  }

  #syncViewport(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    const width = Math.max(1, this.#canvasHost.clientWidth);
    const height = Math.max(1, this.#canvasHost.clientHeight);
    const aspect = width / height;

    this.#renderer.setPixelRatio(this.#devicePixelRatio);
    this.#renderer.setSize(width, height, false);
    this.#camera.left = -aspect;
    this.#camera.right = aspect;
    this.#camera.top = 1;
    this.#camera.bottom = -1;
    this.#camera.updateProjectionMatrix();
    this.#backgroundMesh.scale.set(aspect, 1, 1);
  }

  #toWorldX(normalizedX: number): number {
    return (normalizedX * 2 - 1) * this.#camera.right;
  }

  #toWorldY(normalizedY: number): number {
    return 1 - normalizedY * 2;
  }
}
