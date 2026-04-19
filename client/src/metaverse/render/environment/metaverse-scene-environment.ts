import {
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
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
  min,
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
import {
  resolveMetaverseWorldWaterRegionFloorHeightMeters,
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

function createWaterRegionFloorMesh(
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): Mesh {
  const floorMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide
  });
  const floorEdgeBlend = smoothstep(
    0.02,
    0.16,
    min(min(uv().x, oneMinus(uv().x)), min(uv().y, oneMinus(uv().y)))
  );

  floorMaterial.colorNode = mix(
    color(0.58, 0.54, 0.42),
    color(0.36, 0.39, 0.35),
    floorEdgeBlend
  );
  floorMaterial.emissiveNode = color(0.03, 0.09, 0.12).mul(
    oneMinus(floorEdgeBlend).mul(0.28)
  );
  floorMaterial.roughnessNode = float(0.96);
  floorMaterial.metalnessNode = float(0.02);

  const floorMesh = new Mesh(
    new PlaneGeometry(waterRegion.halfExtents.x * 2, waterRegion.halfExtents.z * 2),
    floorMaterial
  );

  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.rotation.y = waterRegion.rotationYRadians;
  floorMesh.position.set(
    waterRegion.translation.x,
    resolveMetaverseWorldWaterRegionFloorHeightMeters(waterRegion),
    waterRegion.translation.z
  );

  return floorMesh;
}

function createWaterRegionSurfaceMesh(
  config: MetaverseRuntimeConfig,
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): Mesh {
  const oceanMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide,
    transparent: true
  });
  const shorelineBlend = smoothstep(
    0.015,
    0.12,
    min(min(uv().x, oneMinus(uv().x)), min(uv().y, oneMinus(uv().y)))
  );
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
  const waterDepthBlend = smoothstep(
    0.8,
    6,
    float(waterRegion.halfExtents.y * 2)
  );
  const viewDirection = cameraPosition.sub(positionWorld).normalize();
  const fresnel = pow(oneMinus(abs(dot(normalWorld, viewDirection))), 3);

  oceanMaterial.positionNode = positionLocal.add(vec3(0, 0, waveHeight));
  oceanMaterial.colorNode = mix(
    color(...config.ocean.nearColor),
    color(...config.ocean.farColor),
    depthBlend.mul(0.58).add(waterDepthBlend.mul(0.42))
  ).add(color(...config.environment.sunColor).mul(fresnel.mul(0.12)));
  oceanMaterial.emissiveNode = color(...config.ocean.emissiveColor).mul(
    fresnel.mul(0.48).add(abs(waveRipple).mul(0.03)).mul(shorelineBlend)
  );
  oceanMaterial.opacityNode = float(0.86).mul(shorelineBlend);
  oceanMaterial.roughnessNode = float(config.ocean.roughness);
  oceanMaterial.metalnessNode = float(0.02);

  const oceanMesh = new Mesh(
    new PlaneGeometry(
      waterRegion.halfExtents.x * 2,
      waterRegion.halfExtents.z * 2,
      config.ocean.segmentCount,
      config.ocean.segmentCount
    ),
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
    waterGroup.add(createWaterRegionFloorMesh(waterRegion));
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
