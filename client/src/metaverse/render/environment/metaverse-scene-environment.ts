import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  SphereGeometry
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
  positionWorld,
  pow,
  smoothstep,
  vec3
} from "three/tsl";
import {
  resolveMetaverseWorldWaterRegionSurfaceHeightMeters,
  type MetaverseWorldPlacedWaterRegionSnapshot
} from "@webgpu-metaverse/shared";

import type { MetaverseRuntimeConfig } from "../../types/metaverse-runtime";

export interface MetaverseSceneEnvironmentRuntime {
  readonly backgroundColor: Color;
  readonly fog: FogExp2;
  readonly hemisphereLight: HemisphereLight;
  readonly skyMesh: Mesh;
  readonly sunLight: DirectionalLight;
  readonly waterGroup: Group;
}

function toThreeColor(rgb: readonly [number, number, number]): Color {
  return new Color(rgb[0], rgb[1], rgb[2]);
}

function createHemisphereLight(config: MetaverseRuntimeConfig): HemisphereLight {
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

  light.position.set(
    -sunDirection.x * 120,
    -sunDirection.y * 120,
    -sunDirection.z * 120
  );
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

function createWaterRegionSurfaceMesh(
  config: MetaverseRuntimeConfig,
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): Mesh {
  const oceanMaterial = new MeshStandardNodeMaterial();
  const viewDirection = cameraPosition.sub(positionWorld).normalize();
  const fresnel = pow(oneMinus(abs(dot(normalWorld, viewDirection))), 3);

  oceanMaterial.colorNode = mix(
    color(...config.ocean.nearColor),
    color(...config.ocean.farColor),
    float(0.4)
  ).add(color(...config.environment.sunColor).mul(fresnel.mul(0.08)));
  oceanMaterial.emissiveNode = color(...config.ocean.emissiveColor).mul(
    fresnel.mul(0.18).add(float(0.04))
  );
  oceanMaterial.roughnessNode = float(Math.max(config.ocean.roughness, 0.28));
  oceanMaterial.metalnessNode = float(0.01);

  const oceanMesh = new Mesh(
    new PlaneGeometry(waterRegion.halfExtents.x * 2, waterRegion.halfExtents.z * 2),
    oceanMaterial
  );

  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.rotation.y = waterRegion.rotationYRadians;
  oceanMesh.position.set(
    waterRegion.translation.x,
    resolveMetaverseWorldWaterRegionSurfaceHeightMeters(waterRegion),
    waterRegion.translation.z
  );

  return oceanMesh;
}

function createWaterGroup(config: MetaverseRuntimeConfig): Group {
  const waterGroup = new Group();

  for (const waterRegion of config.waterRegionSnapshots) {
    waterGroup.add(createWaterRegionSurfaceMesh(config, waterRegion));
  }

  return waterGroup;
}

export function createMetaverseSceneEnvironment(
  config: MetaverseRuntimeConfig
): MetaverseSceneEnvironmentRuntime {
  return {
    backgroundColor: toThreeColor(config.environment.horizonColor),
    fog: new FogExp2(
      toThreeColor(config.environment.fogColor),
      config.environment.fogDensity
    ),
    hemisphereLight: createHemisphereLight(config),
    skyMesh: createSkyMesh(config),
    sunLight: createSunLight(config),
    waterGroup: createWaterGroup(config)
  };
}
