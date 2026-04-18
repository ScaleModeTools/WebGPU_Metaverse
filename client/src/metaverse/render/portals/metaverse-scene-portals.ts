import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  SphereGeometry,
  TorusGeometry
} from "three/webgpu";
import { color, float, uniform } from "three/tsl";

import type {
  FocusedExperiencePortalSnapshot,
  MetaversePortalConfig
} from "../../types/metaverse-runtime";

interface MutableNodeValue<TValue> {
  value: TValue;
}

export interface PortalMeshRuntime {
  readonly anchorGroup: Group;
  readonly beamEmissiveStrengthNode: MutableNodeValue<number>;
  readonly beamMaterial: MeshStandardNodeMaterial;
  readonly beamOpacityNode: MutableNodeValue<number>;
  readonly experienceId: MetaversePortalConfig["experienceId"];
  readonly ringEmissiveStrengthNode: MutableNodeValue<number>;
  readonly ringMaterial: MeshStandardNodeMaterial;
  readonly rotorGroup: Group;
}

export interface PortalSharedRenderResources {
  readonly baseGeometry: CylinderGeometry;
  readonly beamGeometry: CylinderGeometry;
  readonly beaconGeometry: SphereGeometry;
  readonly innerHaloGeometry: TorusGeometry;
  readonly ringGeometry: TorusGeometry;
  readonly supportMaterial: MeshStandardNodeMaterial;
}

function toThreeColor(rgb: readonly [number, number, number]): Color {
  return new Color(rgb[0], rgb[1], rgb[2]);
}

export function createPortalSharedRenderResources(): PortalSharedRenderResources {
  const supportMaterial = new MeshStandardNodeMaterial();

  supportMaterial.colorNode = color(0.18, 0.23, 0.29);
  supportMaterial.emissiveNode = color(0.06, 0.09, 0.12);
  supportMaterial.roughnessNode = float(0.36);
  supportMaterial.metalnessNode = float(0.12);

  return {
    baseGeometry: new CylinderGeometry(4.4, 6.2, 1.2, 32),
    beamGeometry: new CylinderGeometry(1.2, 2.1, 9.4, 24),
    beaconGeometry: new SphereGeometry(0.72, 18, 12),
    innerHaloGeometry: new TorusGeometry(3.7, 0.08, 16, 40),
    ringGeometry: new TorusGeometry(4.9, 0.44, 20, 48),
    supportMaterial
  };
}

export function createPortalMeshRuntime(
  portalConfig: MetaversePortalConfig,
  sharedRenderResources: PortalSharedRenderResources
): PortalMeshRuntime {
  const anchorGroup = new Group();
  const rotorGroup = new Group();
  const ringMaterial = new MeshStandardNodeMaterial();
  const beamMaterial = new MeshStandardNodeMaterial({
    transparent: true
  });
  const ringColorNode = uniform(toThreeColor(portalConfig.ringColor));
  const beamColorNode = uniform(toThreeColor(portalConfig.beamColor));
  const ringEmissiveStrengthNode = uniform(0.24);
  const beamEmissiveStrengthNode = uniform(0.34);
  const beamOpacityNode = uniform(0.76);
  const portalNamePrefix = `metaverse_portal/${portalConfig.experienceId}`;
  const baseMesh = new Mesh(
    sharedRenderResources.baseGeometry,
    sharedRenderResources.supportMaterial
  );
  const ringMesh = new Mesh(sharedRenderResources.ringGeometry, ringMaterial);
  const innerHaloMesh = new Mesh(
    sharedRenderResources.innerHaloGeometry,
    beamMaterial
  );
  const beamMesh = new Mesh(sharedRenderResources.beamGeometry, beamMaterial);
  const beaconMesh = new Mesh(sharedRenderResources.beaconGeometry, ringMaterial);

  anchorGroup.name = portalNamePrefix;
  rotorGroup.name = `${portalNamePrefix}/rotor`;
  baseMesh.name = `${portalNamePrefix}/base`;
  ringMesh.name = `${portalNamePrefix}/ring`;
  innerHaloMesh.name = `${portalNamePrefix}/inner-halo`;
  beamMesh.name = `${portalNamePrefix}/beam`;
  beaconMesh.name = `${portalNamePrefix}/beacon`;

  ringMaterial.colorNode = ringColorNode;
  ringMaterial.emissiveNode = ringColorNode.mul(ringEmissiveStrengthNode);
  ringMaterial.roughnessNode = float(0.18);
  ringMaterial.metalnessNode = float(0.08);
  beamMaterial.colorNode = beamColorNode;
  beamMaterial.emissiveNode = beamColorNode.mul(beamEmissiveStrengthNode);
  beamMaterial.roughnessNode = float(0.3);
  beamMaterial.metalnessNode = float(0);
  beamMaterial.opacityNode = beamOpacityNode;

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
    beamEmissiveStrengthNode,
    beamMaterial,
    beamOpacityNode,
    experienceId: portalConfig.experienceId,
    ringEmissiveStrengthNode,
    ringMaterial,
    rotorGroup
  };
}

export function syncPortalPresentation(
  portalRuntime: PortalMeshRuntime,
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  nowMs: number
): void {
  const isFocused = focusedPortal?.experienceId === portalRuntime.experienceId;
  const pulse = 0.85 + Math.sin(nowMs * 0.004) * 0.08;
  const focusBoost = isFocused ? 1.45 : 1;

  portalRuntime.rotorGroup.rotation.y = nowMs * 0.00032;
  portalRuntime.rotorGroup.position.y = Math.sin(nowMs * 0.0024) * 0.2;
  portalRuntime.anchorGroup.scale.setScalar(isFocused ? 1.06 : 1);
  portalRuntime.ringEmissiveStrengthNode.value = 0.22 * pulse * focusBoost;
  portalRuntime.beamEmissiveStrengthNode.value = 0.28 * pulse * focusBoost;
  portalRuntime.beamOpacityNode.value = isFocused ? 0.92 : 0.76;
}
