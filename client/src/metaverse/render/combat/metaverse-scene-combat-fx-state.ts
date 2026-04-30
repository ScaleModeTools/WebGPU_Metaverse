import type {
  MetaverseCombatProjectileSnapshot
} from "@webgpu-metaverse/shared";
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Scene,
  SphereGeometry,
  Vector3
} from "three/webgpu";
import { color } from "three/tsl";

import type {
  MetaverseCombatPresentationEvent
} from "../../types/metaverse-runtime";

type MetaverseFxVector3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

interface ActiveProjectileVisual {
  birthBridgeConsumed: boolean;
  readonly birthOrigin: Vector3;
  readonly birthTarget: Vector3;
  readonly body: Mesh;
  readonly group: Group;
  readonly trail: Mesh;
  birthStartedAtMs: number | null;
}

interface TransientFxVisual {
  readonly expiresAtMs: number;
  readonly group: Group;
  readonly kind: "explosion" | "impact" | "muzzle";
  readonly startedAtMs: number;
}

interface TransientTracerFxVisual {
  readonly body: Mesh;
  readonly direction: Vector3;
  readonly distanceMeters: number;
  readonly expiresAtMs: number;
  readonly glow: Mesh;
  readonly group: Group;
  readonly kind: "tracer";
  readonly segmentMeters: number;
  readonly startedAtMs: number;
  readonly start: Vector3;
}

interface TransientRocketLaunchFxVisual {
  readonly body: Mesh;
  readonly direction: Vector3;
  readonly distanceMeters: number;
  readonly expiresAtMs: number;
  readonly group: Group;
  readonly kind: "rocket-launch";
  readonly projectileId: string | null;
  readonly startedAtMs: number;
  readonly start: Vector3;
  readonly trail: Mesh;
}

const rocketWeaponId = "metaverse-rocket-launcher-v1";
const metaverseCombatFxVisualKeyTtlMs = 5_000;
const rocketProjectileSnapshotSelfHealBridgeWindowMs = 180;
const rocketProjectileVisualBirthDurationMs = 80;
const rocketLaunchTransientDurationMs = 120;
const rocketLaunchTransientMaxDistanceMeters = 5.8;
const rocketLaunchTransientMinDistanceMeters = 1.1;
const rocketLaunchTransientTrailMeters = 1.05;
const pistolTracerMetersPerSecond = 280;
const pistolTracerMaxDurationMs = 145;
const pistolTracerMinDurationMs = 72;
const pistolTracerMaxSegmentMeters = 5.5;
const pistolWorldImpactSurfaceLiftMeters = 0.035;
const tempStart = new Vector3();
const tempEnd = new Vector3();
const tempMidpoint = new Vector3();
const tempDirection = new Vector3();
const tempRocketRenderPosition = new Vector3();
const yAxis = new Vector3(0, 1, 0);

function createBasicMaterial(
  rgb: readonly [number, number, number],
  options: { readonly depthTest?: boolean } = {}
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();

  material.colorNode = color(rgb[0], rgb[1], rgb[2]);
  material.depthTest = options.depthTest ?? true;
  material.depthWrite = false;

  return material;
}

function readFiniteVector(input: MetaverseFxVector3 | null | undefined): Vector3 | null {
  if (
    input === null ||
    input === undefined ||
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.y) ||
    !Number.isFinite(input.z)
  ) {
    return null;
  }

  return new Vector3(input.x, input.y, input.z);
}

function setCylinderBetween(
  mesh: Mesh,
  start: Vector3,
  end: Vector3,
  radiusScale = 1
): void {
  tempDirection.copy(end).sub(start);
  const length = tempDirection.length();

  if (length <= 0.000001) {
    mesh.visible = false;
    return;
  }

  mesh.visible = true;
  tempDirection.multiplyScalar(1 / length);
  tempMidpoint.copy(start).add(end).multiplyScalar(0.5);
  mesh.position.copy(tempMidpoint);
  mesh.quaternion.setFromUnitVectors(yAxis, tempDirection);
  mesh.scale.set(radiusScale, length, radiusScale);
}

function createRocketProjectileVisual(): ActiveProjectileVisual {
  const group = new Group();
  const body = new Mesh(
    new SphereGeometry(0.085, 12, 8),
    createBasicMaterial([1, 0.76, 0.26])
  );
  const trail = new Mesh(
    new CylinderGeometry(0.028, 0.005, 1, 8),
    createBasicMaterial([0.95, 0.28, 0.08])
  );

  group.name = "metaverse_combat_fx/rocket_projectile";
  body.name = "metaverse_combat_fx/rocket_projectile/body";
  trail.name = "metaverse_combat_fx/rocket_projectile/trail";
  group.add(trail, body);

  return {
    birthBridgeConsumed: false,
    birthOrigin: new Vector3(),
    birthStartedAtMs: null,
    birthTarget: new Vector3(),
    body,
    group,
    trail
  };
}

export class MetaverseSceneCombatFxState {
  readonly #activeProjectilesById = new Map<string, ActiveProjectileVisual>();
  readonly #consumedVisualKeys = new Map<string, number>();
  readonly #launchBridgeOriginsByProjectileId = new Map<string, Vector3>();
  readonly #projectileSnapshotSelfHealBridgeExpiresAtById = new Map<
    string,
    number
  >();
  readonly #projectileImpactVisualIds = new Set<string>();
  readonly #rocketLaunchVisualIds = new Set<string>();
  readonly #scene: Scene;
  readonly #transientFx: (
    | TransientFxVisual
    | TransientTracerFxVisual
    | TransientRocketLaunchFxVisual
  )[] = [];

  constructor(input: { readonly scene: Scene }) {
    this.#scene = input.scene;
  }

  reset(): void {
    for (const projectileVisual of this.#activeProjectilesById.values()) {
      this.#scene.remove(projectileVisual.group);
    }

    for (const transientVisual of this.#transientFx) {
      this.#scene.remove(transientVisual.group);
    }

    this.#activeProjectilesById.clear();
    this.#consumedVisualKeys.clear();
    this.#launchBridgeOriginsByProjectileId.clear();
    this.#projectileSnapshotSelfHealBridgeExpiresAtById.clear();
    this.#projectileImpactVisualIds.clear();
    this.#rocketLaunchVisualIds.clear();
    this.#transientFx.length = 0;
  }

  triggerCombatPresentationEvent(event: MetaverseCombatPresentationEvent): void {
    if (event.kind === "projectile-impact") {
      if (
        event.projectileId !== null &&
        event.projectileId !== undefined &&
        this.#projectileImpactVisualIds.has(event.projectileId)
      ) {
        return;
      }

      if (
        event.visualKey !== null &&
        event.visualKey !== undefined &&
        !this.#consumeVisualKey(event.visualKey, event.startedAtMs)
      ) {
        return;
      }

      const origin = readFiniteVector(event.originWorld);

      if (origin !== null) {
        if (event.projectileId !== null && event.projectileId !== undefined) {
          this.#projectileImpactVisualIds.add(event.projectileId);
        }

        this.#spawnExplosion(origin, event.startedAtMs);
      }

      return;
    }

    if (event.kind !== "shot") {
      return;
    }

    if (
      event.visualKey !== null &&
      event.visualKey !== undefined &&
      !this.#consumeVisualKey(event.visualKey, event.startedAtMs)
    ) {
      return;
    }

    const origin = readFiniteVector(event.originWorld);

    if (origin === null) {
      return;
    }

    const shotFx = event.shotFx ?? null;

    if (shotFx === null) {
      return;
    }

    if (shotFx === "rocket-muzzle") {
      if (event.projectileId !== null && event.projectileId !== undefined) {
        if (this.#rocketLaunchVisualIds.has(event.projectileId)) {
          return;
        }

        this.#rocketLaunchVisualIds.add(event.projectileId);
        const bridgeExpiresAtMs =
          this.#projectileSnapshotSelfHealBridgeExpiresAtById.get(
            event.projectileId
          ) ?? null;
        const launchBridgeAllowed =
          bridgeExpiresAtMs === null || event.startedAtMs <= bridgeExpiresAtMs;

        if (launchBridgeAllowed) {
          this.#launchBridgeOriginsByProjectileId.set(
            event.projectileId,
            origin.clone()
          );
        }

        const activeProjectileVisual =
          this.#activeProjectilesById.get(event.projectileId) ?? null;

        if (activeProjectileVisual !== null && launchBridgeAllowed) {
          activeProjectileVisual.birthStartedAtMs = event.startedAtMs;
          activeProjectileVisual.birthBridgeConsumed = true;
          activeProjectileVisual.birthOrigin.copy(origin);
          activeProjectileVisual.birthTarget.copy(
            activeProjectileVisual.body.position
          );
          activeProjectileVisual.body.position.copy(origin);
        }

        if (!launchBridgeAllowed) {
          return;
        }
      }

      if (
        event.projectileId === null ||
        event.projectileId === undefined ||
        this.#activeProjectilesById.get(event.projectileId) === undefined
      ) {
        const launchDirection = readFiniteVector(event.directionWorld);
        const launchEnd = readFiniteVector(event.endWorld);

        this.#spawnRocketLaunchProjectile(
          origin,
          launchDirection,
          launchEnd,
          event.startedAtMs,
          event.projectileId ?? null
        );
      }

      this.#spawnMuzzleFlash(origin, event.startedAtMs, 0.22, [1, 0.42, 0.08]);
      return;
    }

    if (shotFx === "pistol-world-impact") {
      this.#spawnPistolWorldImpact(origin, event.startedAtMs);
      return;
    }

    const explicitEnd = readFiniteVector(event.endWorld);
    const direction = readFiniteVector(event.directionWorld);

    if (
      explicitEnd === null &&
      (direction === null || direction.lengthSq() <= 0.000001)
    ) {
      return;
    }

    tempStart.copy(origin);
    if (explicitEnd !== null) {
      tempEnd.copy(explicitEnd);
    } else if (direction !== null) {
      direction.normalize();
      tempEnd.copy(origin).add(direction.multiplyScalar(48));
    }
    this.#spawnMuzzleFlash(origin, event.startedAtMs, 0.08, [0.95, 0.74, 0.28]);
    this.#spawnTracer(tempStart, tempEnd, event.startedAtMs);
  }

  syncProjectiles(
    projectiles: readonly MetaverseCombatProjectileSnapshot[],
    nowMs: number
  ): void {
    const activeProjectileIds = new Set<string>();

    for (const projectile of projectiles) {
      if (projectile.weaponId !== rocketWeaponId) {
        continue;
      }

      if (projectile.resolution === "active") {
        activeProjectileIds.add(projectile.projectileId);
        this.#syncActiveRocketProjectile(projectile, nowMs);
        continue;
      }

      this.#removeProjectile(projectile.projectileId);
    }

    for (const projectileId of this.#activeProjectilesById.keys()) {
      if (!activeProjectileIds.has(projectileId)) {
        this.#removeProjectile(projectileId);
      }
    }

    this.#syncTransientFx(nowMs);
  }

  #consumeVisualKey(visualKey: string, nowMs: number): boolean {
    for (const [candidateKey, expiresAtMs] of this.#consumedVisualKeys) {
      if (nowMs >= expiresAtMs) {
        this.#consumedVisualKeys.delete(candidateKey);
      }
    }

    if (this.#consumedVisualKeys.has(visualKey)) {
      return false;
    }

    this.#consumedVisualKeys.set(
      visualKey,
      nowMs + metaverseCombatFxVisualKeyTtlMs
    );
    return true;
  }

  #syncActiveRocketProjectile(
    projectile: MetaverseCombatProjectileSnapshot,
    nowMs: number
  ): void {
    let projectileVisual =
      this.#activeProjectilesById.get(projectile.projectileId) ?? null;

      if (projectileVisual === null) {
        projectileVisual = createRocketProjectileVisual();
      this.#activeProjectilesById.set(projectile.projectileId, projectileVisual);
      const createdFrom = this.#rocketLaunchVisualIds.has(projectile.projectileId)
        ? "launch-event"
        : "snapshot-self-heal";
      if (createdFrom === "snapshot-self-heal") {
        this.#projectileSnapshotSelfHealBridgeExpiresAtById.set(
          projectile.projectileId,
          nowMs + rocketProjectileSnapshotSelfHealBridgeWindowMs
        );
      }
      this.#scene.add(projectileVisual.group);
      this.#removeRocketLaunchProjectile(projectile.projectileId);
    }

    const position = new Vector3(
      projectile.position.x,
      projectile.position.y,
      projectile.position.z
    );
    const direction = new Vector3(
      projectile.direction.x,
      projectile.direction.y,
      projectile.direction.z
    );

    if (!projectileVisual.birthBridgeConsumed) {
      const launchOrigin =
        this.#launchBridgeOriginsByProjectileId.get(projectile.projectileId) ??
        null;
      const bridgeExpiresAtMs =
        this.#projectileSnapshotSelfHealBridgeExpiresAtById.get(
          projectile.projectileId
        ) ?? null;
      const bridgeWindowExpired =
        bridgeExpiresAtMs !== null && nowMs > bridgeExpiresAtMs;

      if (
        launchOrigin !== null &&
        launchOrigin.distanceToSquared(position) > 0.0001
      ) {
        projectileVisual.birthStartedAtMs = nowMs;
        projectileVisual.birthOrigin.copy(launchOrigin);
        projectileVisual.birthTarget.copy(position);
        projectileVisual.birthBridgeConsumed = true;
      } else if (launchOrigin !== null || bridgeWindowExpired) {
        projectileVisual.birthBridgeConsumed = true;
      }
    }

    if (direction.lengthSq() <= 0.000001) {
      direction.set(0, 0, -1);
    } else {
      direction.normalize();
    }

    tempRocketRenderPosition.copy(position);

    if (projectileVisual.birthStartedAtMs !== null) {
      const birthAlpha = Math.max(
        0,
        Math.min(
          1,
          (nowMs - projectileVisual.birthStartedAtMs) /
            rocketProjectileVisualBirthDurationMs
        )
      );

      tempRocketRenderPosition
        .copy(projectileVisual.birthOrigin)
        .lerp(projectileVisual.birthTarget, birthAlpha);

      if (birthAlpha >= 1) {
        projectileVisual.birthStartedAtMs = null;
      }
    }

    projectileVisual.body.position.copy(tempRocketRenderPosition);
    tempStart.copy(tempRocketRenderPosition).addScaledVector(direction, -0.72);
    tempEnd.copy(tempRocketRenderPosition).addScaledVector(direction, -0.1);
    setCylinderBetween(projectileVisual.trail, tempStart, tempEnd, 1);
  }

  #removeProjectile(projectileId: string): void {
    const projectileVisual = this.#activeProjectilesById.get(projectileId) ?? null;

    if (projectileVisual === null) {
      return;
    }

    this.#activeProjectilesById.delete(projectileId);
    this.#launchBridgeOriginsByProjectileId.delete(projectileId);
    this.#projectileSnapshotSelfHealBridgeExpiresAtById.delete(projectileId);
    this.#scene.remove(projectileVisual.group);
  }

  #spawnExplosion(position: Vector3, nowMs: number): void {
    const group = new Group();
    const core = new Mesh(
      new SphereGeometry(0.55, 16, 10),
      createBasicMaterial([1, 0.36, 0.08])
    );
    const shock = new Mesh(
      new SphereGeometry(1.25, 18, 10),
      createBasicMaterial([1, 0.82, 0.22])
    );

    group.name = "metaverse_combat_fx/rocket_explosion";
    core.name = "metaverse_combat_fx/rocket_explosion/core";
    shock.name = "metaverse_combat_fx/rocket_explosion/shock";
    group.position.copy(position);
    group.add(shock, core);
    this.#scene.add(group);
    this.#transientFx.push({
      expiresAtMs: nowMs + 420,
      group,
      kind: "explosion",
      startedAtMs: nowMs
    });
  }

  #spawnMuzzleFlash(
    position: Vector3,
    nowMs: number,
    radius: number,
    colorRgb: readonly [number, number, number]
  ): void {
    const group = new Group();
    const flash = new Mesh(
      new SphereGeometry(radius, 10, 6),
      createBasicMaterial(colorRgb)
    );

    group.name = "metaverse_combat_fx/muzzle_flash";
    flash.name = "metaverse_combat_fx/muzzle_flash/core";
    group.position.copy(position);
    group.add(flash);
    this.#scene.add(group);
    this.#transientFx.push({
      expiresAtMs: nowMs + 96,
      group,
      kind: "muzzle",
      startedAtMs: nowMs
    });
  }

  #spawnPistolWorldImpact(position: Vector3, nowMs: number): void {
    const group = new Group();
    const core = new Mesh(
      new SphereGeometry(0.055, 8, 5),
      createBasicMaterial([1, 0.74, 0.24], { depthTest: false })
    );
    const dust = new Mesh(
      new SphereGeometry(0.12, 8, 5),
      createBasicMaterial([0.78, 0.58, 0.34], { depthTest: false })
    );

    group.name = "metaverse_combat_fx/pistol_world_impact";
    core.name = "metaverse_combat_fx/pistol_world_impact/core";
    dust.name = "metaverse_combat_fx/pistol_world_impact/dust";
    group.position
      .copy(position)
      .addScaledVector(yAxis, pistolWorldImpactSurfaceLiftMeters);
    group.add(dust, core);
    this.#scene.add(group);
    this.#transientFx.push({
      expiresAtMs: nowMs + 170,
      group,
      kind: "impact",
      startedAtMs: nowMs
    });
  }

  #spawnRocketLaunchProjectile(
    start: Vector3,
    directionInput: Vector3 | null,
    endInput: Vector3 | null,
    nowMs: number,
    projectileId: string | null
  ): void {
    const direction =
      directionInput === null || directionInput.lengthSq() <= 0.000001
        ? endInput === null
          ? null
          : endInput.clone().sub(start)
        : directionInput.clone();

    if (direction === null || direction.lengthSq() <= 0.000001) {
      return;
    }

    direction.normalize();
    const endpointDistance =
      endInput === null
        ? null
        : Math.max(0, endInput.clone().sub(start).dot(direction));
    const distanceMeters = Math.max(
      rocketLaunchTransientMinDistanceMeters,
      Math.min(
        rocketLaunchTransientMaxDistanceMeters,
        endpointDistance ?? rocketLaunchTransientMaxDistanceMeters
      )
    );
    const group = new Group();
    const body = new Mesh(
      new SphereGeometry(0.07, 12, 8),
      createBasicMaterial([1, 0.78, 0.28], { depthTest: false })
    );
    const trail = new Mesh(
      new CylinderGeometry(0.035, 0.006, 1, 10),
      createBasicMaterial([1, 0.34, 0.08], { depthTest: false })
    );

    if (projectileId !== null) {
      this.#removeRocketLaunchProjectile(projectileId);
    }

    group.name = "metaverse_combat_fx/rocket_launch_projectile";
    body.name = "metaverse_combat_fx/rocket_launch_projectile/body";
    trail.name = "metaverse_combat_fx/rocket_launch_projectile/trail";
    group.add(trail, body);
    this.#scene.add(group);

    const rocketLaunchVisual = {
      body,
      direction,
      distanceMeters,
      expiresAtMs: nowMs + rocketLaunchTransientDurationMs,
      group,
      kind: "rocket-launch",
      projectileId,
      startedAtMs: nowMs,
      start: start.clone(),
      trail
    } satisfies TransientRocketLaunchFxVisual;

    this.#syncRocketLaunchFx(rocketLaunchVisual, nowMs);
    this.#transientFx.push(rocketLaunchVisual);
  }

  #removeRocketLaunchProjectile(projectileId: string): void {
    for (let index = this.#transientFx.length - 1; index >= 0; index -= 1) {
      const transientVisual = this.#transientFx[index];

      if (
        transientVisual !== undefined &&
        transientVisual.kind === "rocket-launch" &&
        transientVisual.projectileId === projectileId
      ) {
        this.#scene.remove(transientVisual.group);
        this.#transientFx.splice(index, 1);
      }
    }
  }

  #spawnTracer(start: Vector3, end: Vector3, nowMs: number): void {
    const group = new Group();
    const direction = end.clone().sub(start);
    const distanceMeters = direction.length();

    if (distanceMeters <= 0.000001) {
      return;
    }

    direction.multiplyScalar(1 / distanceMeters);

    const body = new Mesh(
      new CylinderGeometry(0.014, 0.004, 1, 16),
      createBasicMaterial([1, 0.88, 0.38], { depthTest: false })
    );
    const glow = new Mesh(
      new CylinderGeometry(0.04, 0.008, 1, 16),
      createBasicMaterial([1, 0.52, 0.12], { depthTest: false })
    );
    const durationMs = Math.max(
      pistolTracerMinDurationMs,
      Math.min(
        pistolTracerMaxDurationMs,
        (distanceMeters / pistolTracerMetersPerSecond) * 1_000
      )
    );
    const segmentMeters = Math.max(
      0.7,
      Math.min(pistolTracerMaxSegmentMeters, distanceMeters * 0.32)
    );

    group.name = "metaverse_combat_fx/pistol_tracer";
    body.name = "metaverse_combat_fx/pistol_tracer/body";
    glow.name = "metaverse_combat_fx/pistol_tracer/glow";
    group.add(glow, body);
    this.#scene.add(group);

    const tracerVisual = {
      body,
      direction,
      distanceMeters,
      expiresAtMs: nowMs + durationMs,
      glow,
      group,
      kind: "tracer",
      segmentMeters,
      startedAtMs: nowMs,
      start: start.clone()
    } satisfies TransientTracerFxVisual;

    this.#syncTracerFx(tracerVisual, nowMs);
    this.#transientFx.push(tracerVisual);
  }

  #syncRocketLaunchFx(
    transientVisual: TransientRocketLaunchFxVisual,
    nowMs: number
  ): void {
    const durationMs = Math.max(
      1,
      transientVisual.expiresAtMs - transientVisual.startedAtMs
    );
    const ageAlpha = Math.max(
      0,
      Math.min(1, (nowMs - transientVisual.startedAtMs) / durationMs)
    );
    const headDistance = Math.min(
      transientVisual.distanceMeters,
      Math.max(0.16, transientVisual.distanceMeters * ageAlpha)
    );
    const tailDistance = Math.max(
      0,
      headDistance - rocketLaunchTransientTrailMeters
    );

    transientVisual.body.position
      .copy(transientVisual.start)
      .addScaledVector(transientVisual.direction, headDistance);
    tempStart
      .copy(transientVisual.start)
      .addScaledVector(transientVisual.direction, tailDistance);
    tempEnd.copy(transientVisual.body.position);
    setCylinderBetween(transientVisual.trail, tempStart, tempEnd, 1);
  }

  #syncTracerFx(
    transientVisual: TransientTracerFxVisual,
    nowMs: number
  ): void {
    const durationMs = Math.max(
      1,
      transientVisual.expiresAtMs - transientVisual.startedAtMs
    );
    const ageAlpha = Math.max(
      0,
      Math.min(1, (nowMs - transientVisual.startedAtMs) / durationMs)
    );
    const headDistance = Math.min(
      transientVisual.distanceMeters,
      Math.max(
        transientVisual.distanceMeters * ageAlpha,
        Math.min(transientVisual.distanceMeters, transientVisual.segmentMeters * 0.25)
      )
    );
    const tailDistance = Math.max(
      0,
      headDistance - transientVisual.segmentMeters
    );

    tempStart
      .copy(transientVisual.start)
      .addScaledVector(transientVisual.direction, tailDistance);
    tempEnd
      .copy(transientVisual.start)
      .addScaledVector(transientVisual.direction, headDistance);
    setCylinderBetween(transientVisual.body, tempStart, tempEnd, 1);
    setCylinderBetween(transientVisual.glow, tempStart, tempEnd, 1);
  }

  #syncTransientFx(nowMs: number): void {
    for (let index = this.#transientFx.length - 1; index >= 0; index -= 1) {
      const transientVisual = this.#transientFx[index];

      if (transientVisual === undefined) {
        continue;
      }

      if (nowMs >= transientVisual.expiresAtMs) {
        this.#scene.remove(transientVisual.group);
        this.#transientFx.splice(index, 1);
        continue;
      }

      if (transientVisual.kind === "tracer") {
        this.#syncTracerFx(transientVisual, nowMs);
        continue;
      }

      if (transientVisual.kind === "rocket-launch") {
        this.#syncRocketLaunchFx(transientVisual, nowMs);
        continue;
      }

      const durationMs = Math.max(
        1,
        transientVisual.expiresAtMs - transientVisual.startedAtMs
      );
      const ageAlpha = Math.max(
        0,
        Math.min(1, (nowMs - transientVisual.startedAtMs) / durationMs)
      );
      const scale =
        transientVisual.kind === "explosion"
          ? 0.35 + ageAlpha * 1.35
          : transientVisual.kind === "impact"
            ? 0.6 + ageAlpha * 0.9
          : 1 + ageAlpha * 0.2;

      transientVisual.group.scale.setScalar(scale);
    }
  }
}
