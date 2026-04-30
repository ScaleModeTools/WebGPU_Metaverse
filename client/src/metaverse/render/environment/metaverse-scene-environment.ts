import { SkyMesh } from "three/addons/objects/SkyMesh.js";
import {
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardNodeMaterial,
  PlaneGeometry,
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
  positionWorld,
  pow,
} from "three/tsl";
import {
  resolveMetaverseWorldWaterRegionSurfaceHeightMeters,
  type MetaverseWorldPlacedWaterRegionSnapshot
} from "@webgpu-metaverse/shared";

import type { MetaverseRuntimeConfig } from "../../types/metaverse-runtime";

export interface MetaverseSceneEnvironmentRuntime {
  readonly backgroundColor: Color;
  readonly fog: FogExp2 | null;
  readonly hemisphereLight: HemisphereLight;
  readonly skyMesh: Mesh;
  readonly sunLight: DirectionalLight;
  readonly waterGroup: Group;
}

export interface MetaverseSceneEnvironmentRendererHost {
  toneMappingExposure?: number;
}

export interface MetaverseSceneEnvironmentConfig {
  readonly environment: MetaverseRuntimeConfig["environment"];
  readonly ocean: MetaverseRuntimeConfig["ocean"];
  readonly waterRegionSnapshots:
    readonly MetaverseWorldPlacedWaterRegionSnapshot[];
}

function toThreeColor(rgb: readonly [number, number, number]): Color {
  return new Color(rgb[0], rgb[1], rgb[2]);
}

function resolveSunDirection(
  config: MetaverseSceneEnvironmentConfig["environment"]
): Vector3 {
  const phi = ((90 - config.sunElevationDegrees) * Math.PI) / 180;
  const theta = (config.sunAzimuthDegrees * Math.PI) / 180;

  return new Vector3().setFromSphericalCoords(1, phi, theta).normalize();
}

function resolveSkyExposureScale(
  environment: MetaverseSceneEnvironmentConfig["environment"]
): number {
  const worldExposure = Math.max(0.001, environment.toneMappingExposure);
  const skyExposure = Math.max(0.001, environment.skyExposure);
  const curve = Math.max(0, environment.skyExposureCurve);

  return Math.pow(skyExposure / worldExposure, curve);
}

function applySkyExposureScale(
  sky: SkyMesh,
  config: MetaverseSceneEnvironmentConfig
): void {
  const skyColorNode = sky.material.colorNode;

  if (skyColorNode === null) {
    return;
  }

  sky.material.colorNode = skyColorNode.mul(
    float(resolveSkyExposureScale(config.environment))
  );
}

function createHemisphereLight(
  config: MetaverseSceneEnvironmentConfig
): HemisphereLight {
  const skyColor = toThreeColor(config.environment.horizonColor).lerp(
    toThreeColor(config.environment.sunColor),
    0.12
  );
  const groundColor = toThreeColor(config.environment.groundColor);
  const light = new HemisphereLight(skyColor, groundColor, 1.65);

  light.position.set(0, 1, 0);

  return light;
}

function createSunLight(config: MetaverseSceneEnvironmentConfig): DirectionalLight {
  const light = new DirectionalLight(
    toThreeColor(config.environment.sunColor),
    2.2
  );
  const sunDirection = resolveSunDirection(config.environment);

  light.position.set(
    -sunDirection.x * 120,
    -sunDirection.y * 120,
    -sunDirection.z * 120
  );
  light.target.position.set(0, 0, 0);
  light.target.updateMatrixWorld();

  return light;
}

function syncSkyMeshEnvironmentUniforms(
  sky: SkyMesh,
  config: MetaverseSceneEnvironmentConfig,
  sunDirection: Vector3
): void {
  sky.turbidity.value = config.environment.turbidity;
  sky.rayleigh.value = config.environment.rayleigh;
  sky.mieCoefficient.value = config.environment.mieCoefficient;
  sky.mieDirectionalG.value = config.environment.mieDirectionalG;
  sky.cloudCoverage.value = config.environment.cloudCoverage;
  sky.cloudDensity.value = config.environment.cloudDensity;
  sky.cloudElevation.value = config.environment.cloudElevation;
  sky.cloudScale.value = config.environment.cloudScale;
  sky.cloudSpeed.value = config.environment.cloudSpeed;
  sky.sunPosition.value.copy(sunDirection);
}

function createSkyLowerExtensionMesh(
  config: MetaverseSceneEnvironmentConfig,
  sunDirection: Vector3
): SkyMesh {
  const lowerSky = new SkyMesh();
  const mirroredSunDirection = new Vector3(
    sunDirection.x,
    -sunDirection.y,
    sunDirection.z
  );

  lowerSky.geometry.dispose();
  lowerSky.geometry = new SphereGeometry(
    1,
    48,
    12,
    0,
    Math.PI * 2,
    Math.PI * 0.5,
    Math.PI * 0.5
  ) as unknown as typeof lowerSky.geometry;
  lowerSky.name = "metaverse_scene_environment/sky_lower_extension";
  lowerSky.frustumCulled = false;
  lowerSky.renderOrder = 1;
  lowerSky.scale.setScalar(0.998);
  lowerSky.upUniform.value.set(0, -1, 0);
  syncSkyMeshEnvironmentUniforms(lowerSky, config, mirroredSunDirection);
  lowerSky.cloudCoverage.value = 0;
  lowerSky.cloudDensity.value = 0;
  applySkyExposureScale(lowerSky, config);

  return lowerSky;
}

function createSkyMesh(config: MetaverseSceneEnvironmentConfig): Mesh {
  const sky = new SkyMesh();
  const sunDirection = resolveSunDirection(config.environment);

  sky.geometry.dispose();
  sky.geometry = new SphereGeometry(1, 48, 24) as unknown as typeof sky.geometry;
  sky.name = "metaverse_scene_environment/sky";
  sky.frustumCulled = false;
  sky.scale.setScalar(Math.max(128, config.environment.domeRadius));
  syncSkyMeshEnvironmentUniforms(sky, config, sunDirection);
  applySkyExposureScale(sky, config);
  sky.add(createSkyLowerExtensionMesh(config, sunDirection));

  return sky;
}

function createWaterRegionSurfaceMesh(
  config: MetaverseSceneEnvironmentConfig,
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

function createWaterGroup(config: MetaverseSceneEnvironmentConfig): Group {
  const waterGroup = new Group();

  for (const waterRegion of config.waterRegionSnapshots) {
    waterGroup.add(createWaterRegionSurfaceMesh(config, waterRegion));
  }

  return waterGroup;
}

export function createMetaverseSceneEnvironment(
  config: MetaverseSceneEnvironmentConfig
): MetaverseSceneEnvironmentRuntime {
  return {
    backgroundColor: toThreeColor(config.environment.horizonColor),
    fog: config.environment.fogEnabled
      ? new FogExp2(
          toThreeColor(config.environment.fogColor),
          config.environment.fogDensity
        )
      : null,
    hemisphereLight: createHemisphereLight(config),
    skyMesh: createSkyMesh(config),
    sunLight: createSunLight(config),
    waterGroup: createWaterGroup(config)
  };
}

export function applyMetaverseSceneEnvironmentRendererTuning(
  renderer: MetaverseSceneEnvironmentRendererHost,
  environment: MetaverseSceneEnvironmentConfig["environment"]
): void {
  if ("toneMappingExposure" in renderer) {
    renderer.toneMappingExposure = environment.toneMappingExposure;
  }
}

export function syncMetaverseSceneEnvironmentToCamera(
  environmentRuntime: MetaverseSceneEnvironmentRuntime,
  cameraPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): void {
  environmentRuntime.skyMesh.position.set(
    cameraPosition.x,
    cameraPosition.y,
    cameraPosition.z
  );
}

export function disposeMetaverseSceneEnvironment(
  environmentRuntime: MetaverseSceneEnvironmentRuntime
): void {
  environmentRuntime.skyMesh.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    object.geometry.dispose();

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        material.dispose();
      }

      return;
    }

    object.material.dispose();
  });

  environmentRuntime.waterGroup.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    object.geometry.dispose();

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        material.dispose();
      }

      return;
    }

    object.material.dispose();
  });
}
