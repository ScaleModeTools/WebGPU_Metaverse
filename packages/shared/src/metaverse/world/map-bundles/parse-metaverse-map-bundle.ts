import {
  experienceIds,
  type ExperienceId
} from "../../experience-catalog.js";
import {
  metaverseMountedVehicleCameraPolicyIds,
  metaverseMountedVehicleControlRoutingPolicyIds,
  metaverseMountedVehicleOccupancyAnimationIds
} from "../../metaverse-mounted-vehicle-policies.js";
import {
  metaverseMountedLookLimitPolicyIds
} from "../../metaverse-player-look-constraints.js";
import {
  metaversePresenceMountedOccupantRoleIds
} from "../../metaverse-presence-contract.js";
import {
  metaverseWorldEnvironmentDynamicBodyKindIds,
  metaverseWorldEnvironmentTraversalAffordanceIds,
  metaverseWorldSurfacePlacementIds,
  metaverseWorldSurfaceTraversalAffordanceIds,
  type MetaverseWorldEnvironmentColliderAuthoring,
  type MetaverseWorldEnvironmentDynamicBodyAuthoring,
  type MetaverseWorldEnvironmentTraversalAffordanceId,
  type MetaverseWorldMountedEntryAuthoring,
  type MetaverseWorldMountedSeatAuthoring,
  type MetaverseWorldSurfaceColliderAuthoring,
  type MetaverseWorldSurfacePlacementId,
  type MetaverseWorldSurfaceScaleSnapshot,
  type MetaverseWorldSurfaceVector3Snapshot,
  type MetaverseWorldWaterRegionAuthoring
} from "../../metaverse-world-surface-query.js";
import { readMetaverseGameplayProfile } from "../metaverse-gameplay-profiles.js";
import {
  metaverseMatchModeIds,
  type MetaverseMatchModeId
} from "../../metaverse-match-mode.js";

import type {
  MetaverseMapBundleCompiledCollisionBoxSnapshot,
  MetaverseMapBundleCompiledCollisionHeightfieldSnapshot,
  MetaverseMapBundleCompiledCollisionTriMeshSnapshot,
  MetaverseMapBundleCompiledWorldSnapshot,
  MetaverseMapBundleEnvironmentAssetSnapshot,
  MetaverseMapBundleEnvironmentPresentationSnapshot,
  MetaverseMapBundleLaunchVariationSnapshot,
  MetaverseMapBundlePlayerSpawnSelectionSnapshot,
  MetaverseMapBundlePlacementSnapshot,
  MetaverseMapBundlePresentationProfileIds,
  MetaverseMapBundleResourceSpawnSnapshot,
  MetaverseMapBundleSceneObjectCapabilitySnapshot,
  MetaverseMapBundleSceneObjectSnapshot,
  MetaverseMapBundleSemanticConnectorSnapshot,
  MetaverseMapBundleSemanticEdgeSnapshot,
  MetaverseMapBundleSemanticGameplayVolumeKind,
  MetaverseMapBundleSemanticGameplayVolumeSnapshot,
  MetaverseMapBundleSemanticLightKind,
  MetaverseMapBundleSemanticLightSnapshot,
  MetaverseMapBundleSemanticMaterialDefinitionSnapshot,
  MetaverseMapBundleSemanticMaterialId,
  MetaverseMapBundleSemanticModuleSnapshot,
  MetaverseMapBundleSemanticPlanarLoopSnapshot,
  MetaverseMapBundleSemanticPlanarPointSnapshot,
  MetaverseMapBundleSemanticRegionSnapshot,
  MetaverseMapBundleSemanticStructureKind,
  MetaverseMapBundleSemanticStructureSnapshot,
  MetaverseMapBundleSemanticSurfaceSnapshot,
  MetaverseMapBundleSemanticTerrainMaterialLayerSnapshot,
  MetaverseMapBundleSemanticTerrainPatchSnapshot,
  MetaverseMapBundleSemanticWorldSnapshot,
  MetaverseMapBundleSnapshot,
  MetaverseMapPlayerSpawnTeamId,
  MetaverseMapBundleSpawnNodeSnapshot
} from "./metaverse-map-bundle.js";
import {
  defaultMetaverseMapBundlePlayerSpawnSelection,
  metaverseMapPlayerSpawnTeamIds
} from "./metaverse-map-bundle.js";
import {
  compileMetaverseMapBundleSemanticWorld,
  createDefaultMetaverseMapBundleCompiledWorld
} from "./compile-metaverse-semantic-world.js";

const semanticMaterialIds = [
  "alien-rock",
  "concrete",
  "glass",
  "metal",
  "terrain-ash",
  "terrain-basalt",
  "terrain-cliff",
  "terrain-dirt",
  "terrain-gravel",
  "terrain-grass",
  "terrain-moss",
  "terrain-rock",
  "terrain-sand",
  "terrain-snow",
  "team-blue",
  "team-red",
  "warning"
] as const satisfies readonly MetaverseMapBundleSemanticMaterialId[];

const semanticStructureKinds = [
  "bridge",
  "catwalk",
  "cover",
  "floor",
  "pad",
  "path",
  "ramp",
  "tower",
  "vehicle-bay",
  "wall"
] as const satisfies readonly MetaverseMapBundleSemanticStructureKind[];

const semanticGameplayVolumeKinds = [
  "combat-lane",
  "cover-volume",
  "kill-floor",
  "spawn-room",
  "team-zone",
  "vehicle-route"
] as const satisfies readonly MetaverseMapBundleSemanticGameplayVolumeKind[];

const semanticLightKinds = [
  "ambient",
  "area",
  "point",
  "spot",
  "sun"
] as const satisfies readonly MetaverseMapBundleSemanticLightKind[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  return value;
}

function readNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, fieldName);
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite numeric field: ${fieldName}`);
  }

  return value;
}

function readNumberWithDefault(
  value: unknown,
  fallback: number,
  fieldName: string
): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  return readNumber(value, fieldName);
}

function readUnitNumberWithDefault(
  value: unknown,
  fallback: number,
  fieldName: string
): number {
  const numberValue = readNumberWithDefault(value, fallback, fieldName);

  return Math.min(1, Math.max(0, numberValue));
}

function readClampedNumberWithDefault(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  fieldName: string
): number {
  const numberValue = readNumberWithDefault(value, fallback, fieldName);

  return Math.min(max, Math.max(min, numberValue));
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean field: ${fieldName}`);
  }

  return value;
}

function readRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected object field: ${fieldName}`);
  }

  return value;
}

function readArray(value: unknown, fieldName: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array field: ${fieldName}`);
  }

  return value;
}

function readExperienceId(
  value: unknown,
  fieldName: string
): ExperienceId {
  const experienceId = readString(value, fieldName);

  if (!experienceIds.includes(experienceId as ExperienceId)) {
    throw new Error(`Unsupported experience id for ${fieldName}: ${experienceId}`);
  }

  return experienceId as ExperienceId;
}

function readNullableExperienceId(
  value: unknown,
  fieldName: string
): ExperienceId | null {
  if (value === null) {
    return null;
  }

  return readExperienceId(value, fieldName);
}

function readNullableSessionMode(
  value: unknown,
  fieldName: string
): MetaverseMatchModeId | null {
  if (value === null) {
    return null;
  }

  const matchMode = readString(value, fieldName);

  if (!metaverseMatchModeIds.includes(matchMode as MetaverseMatchModeId)) {
    throw new Error(`Unsupported metaverse match mode for ${fieldName}: ${matchMode}`);
  }

  return matchMode as MetaverseMatchModeId;
}

function readVector3(
  value: unknown,
  fieldName: string
): MetaverseWorldSurfaceVector3Snapshot {
  const vector = readRecord(value, fieldName);

  return Object.freeze({
    x: readNumber(vector.x, `${fieldName}.x`),
    y: readNumber(vector.y, `${fieldName}.y`),
    z: readNumber(vector.z, `${fieldName}.z`)
  });
}

function readScale(
  value: unknown,
  fieldName: string
): MetaverseWorldSurfaceScaleSnapshot {
  if (typeof value === "number") {
    return readNumber(value, fieldName);
  }

  return readVector3(value, fieldName);
}

function readSurfaceCollider(
  value: unknown,
  fieldName: string
): MetaverseWorldSurfaceColliderAuthoring {
  const collider = readRecord(value, fieldName);
  const traversalAffordance = readString(
    collider.traversalAffordance,
    `${fieldName}.traversalAffordance`
  );

  if (
    !metaverseWorldSurfaceTraversalAffordanceIds.includes(
      traversalAffordance as MetaverseWorldSurfaceColliderAuthoring["traversalAffordance"]
    )
  ) {
    throw new Error(
      `Unsupported traversal affordance for ${fieldName}: ${traversalAffordance}`
    );
  }

  return Object.freeze({
    center: readVector3(collider.center, `${fieldName}.center`),
    size: readVector3(collider.size, `${fieldName}.size`),
    traversalAffordance:
      traversalAffordance as MetaverseWorldSurfaceColliderAuthoring["traversalAffordance"]
  });
}

function readEnvironmentCollider(
  value: unknown,
  fieldName: string
): MetaverseWorldEnvironmentColliderAuthoring {
  const collider = readRecord(value, fieldName);

  return Object.freeze({
    center: readVector3(collider.center, `${fieldName}.center`),
    size: readVector3(collider.size, `${fieldName}.size`)
  });
}

function readNullableEnvironmentCollider(
  value: unknown,
  fieldName: string
): MetaverseWorldEnvironmentColliderAuthoring | null {
  if (value === null) {
    return null;
  }

  return readEnvironmentCollider(value, fieldName);
}

function readEnvironmentDynamicBody(
  value: unknown,
  fieldName: string
): MetaverseWorldEnvironmentDynamicBodyAuthoring {
  const dynamicBody = readRecord(value, fieldName);
  const kind = readString(dynamicBody.kind, `${fieldName}.kind`);

  if (
    !metaverseWorldEnvironmentDynamicBodyKindIds.includes(
      kind as MetaverseWorldEnvironmentDynamicBodyAuthoring["kind"]
    )
  ) {
    throw new Error(
      `Unsupported dynamic body kind for ${fieldName}: ${kind}`
    );
  }

  return Object.freeze({
    additionalMass: readNumber(
      dynamicBody.additionalMass,
      `${fieldName}.additionalMass`
    ),
    angularDamping: readNumber(
      dynamicBody.angularDamping,
      `${fieldName}.angularDamping`
    ),
    gravityScale: readNumber(
      dynamicBody.gravityScale,
      `${fieldName}.gravityScale`
    ),
    kind: kind as MetaverseWorldEnvironmentDynamicBodyAuthoring["kind"],
    linearDamping: readNumber(
      dynamicBody.linearDamping,
      `${fieldName}.linearDamping`
    ),
    lockRotations: readBoolean(
      dynamicBody.lockRotations,
      `${fieldName}.lockRotations`
    )
  });
}

function readNullableEnvironmentDynamicBody(
  value: unknown,
  fieldName: string
): MetaverseWorldEnvironmentDynamicBodyAuthoring | null {
  if (value === null) {
    return null;
  }

  return readEnvironmentDynamicBody(value, fieldName);
}

function readEnvironmentTraversalAffordance(
  value: unknown,
  fieldName: string
): MetaverseWorldEnvironmentTraversalAffordanceId {
  const traversalAffordance = readString(value, fieldName);

  if (
    !metaverseWorldEnvironmentTraversalAffordanceIds.includes(
      traversalAffordance as MetaverseWorldEnvironmentTraversalAffordanceId
    )
  ) {
    throw new Error(
      `Unsupported environment traversal affordance for ${fieldName}: ${traversalAffordance}`
    );
  }

  return traversalAffordance as MetaverseWorldEnvironmentTraversalAffordanceId;
}

function readMountedOccupantRole(
  value: unknown,
  fieldName: string
): MetaverseWorldMountedSeatAuthoring["seatRole"] {
  const occupantRole = readString(value, fieldName);

  if (
    !metaversePresenceMountedOccupantRoleIds.includes(
      occupantRole as MetaverseWorldMountedSeatAuthoring["seatRole"]
    )
  ) {
    throw new Error(
      `Unsupported mounted occupant role for ${fieldName}: ${occupantRole}`
    );
  }

  return occupantRole as MetaverseWorldMountedSeatAuthoring["seatRole"];
}

function readMountedSeatAuthoring(
  value: unknown,
  fieldName: string
): MetaverseWorldMountedSeatAuthoring {
  const seat = readRecord(value, fieldName);
  const cameraPolicyId = readString(
    seat.cameraPolicyId,
    `${fieldName}.cameraPolicyId`
  );
  const controlRoutingPolicyId = readString(
    seat.controlRoutingPolicyId,
    `${fieldName}.controlRoutingPolicyId`
  );
  const lookLimitPolicyId = readString(
    seat.lookLimitPolicyId,
    `${fieldName}.lookLimitPolicyId`
  );
  const occupancyAnimationId = readString(
    seat.occupancyAnimationId,
    `${fieldName}.occupancyAnimationId`
  );

  if (
    !metaverseMountedVehicleCameraPolicyIds.includes(
      cameraPolicyId as MetaverseWorldMountedSeatAuthoring["cameraPolicyId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted seat camera policy for ${fieldName}: ${cameraPolicyId}`
    );
  }

  if (
    !metaverseMountedVehicleControlRoutingPolicyIds.includes(
      controlRoutingPolicyId as MetaverseWorldMountedSeatAuthoring["controlRoutingPolicyId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted seat control routing policy for ${fieldName}: ${controlRoutingPolicyId}`
    );
  }

  if (
    !metaverseMountedLookLimitPolicyIds.includes(
      lookLimitPolicyId as MetaverseWorldMountedSeatAuthoring["lookLimitPolicyId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted seat look limit policy for ${fieldName}: ${lookLimitPolicyId}`
    );
  }

  if (
    !metaverseMountedVehicleOccupancyAnimationIds.includes(
      occupancyAnimationId as MetaverseWorldMountedSeatAuthoring["occupancyAnimationId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted seat occupancy animation for ${fieldName}: ${occupancyAnimationId}`
    );
  }

  return Object.freeze({
    cameraPolicyId:
      cameraPolicyId as MetaverseWorldMountedSeatAuthoring["cameraPolicyId"],
    controlRoutingPolicyId:
      controlRoutingPolicyId as MetaverseWorldMountedSeatAuthoring["controlRoutingPolicyId"],
    directEntryEnabled: readBoolean(
      seat.directEntryEnabled,
      `${fieldName}.directEntryEnabled`
    ),
    label: readString(seat.label, `${fieldName}.label`),
    lookLimitPolicyId:
      lookLimitPolicyId as MetaverseWorldMountedSeatAuthoring["lookLimitPolicyId"],
    occupancyAnimationId:
      occupancyAnimationId as MetaverseWorldMountedSeatAuthoring["occupancyAnimationId"],
    seatId: readString(seat.seatId, `${fieldName}.seatId`),
    seatRole: readMountedOccupantRole(seat.seatRole, `${fieldName}.seatRole`)
  });
}

function readMountedEntryAuthoring(
  value: unknown,
  fieldName: string
): MetaverseWorldMountedEntryAuthoring {
  const entry = readRecord(value, fieldName);
  const cameraPolicyId = readString(
    entry.cameraPolicyId,
    `${fieldName}.cameraPolicyId`
  );
  const controlRoutingPolicyId = readString(
    entry.controlRoutingPolicyId,
    `${fieldName}.controlRoutingPolicyId`
  );
  const lookLimitPolicyId = readString(
    entry.lookLimitPolicyId,
    `${fieldName}.lookLimitPolicyId`
  );
  const occupancyAnimationId = readString(
    entry.occupancyAnimationId,
    `${fieldName}.occupancyAnimationId`
  );

  if (
    !metaverseMountedVehicleCameraPolicyIds.includes(
      cameraPolicyId as MetaverseWorldMountedEntryAuthoring["cameraPolicyId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted entry camera policy for ${fieldName}: ${cameraPolicyId}`
    );
  }

  if (
    !metaverseMountedVehicleControlRoutingPolicyIds.includes(
      controlRoutingPolicyId as MetaverseWorldMountedEntryAuthoring["controlRoutingPolicyId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted entry control routing policy for ${fieldName}: ${controlRoutingPolicyId}`
    );
  }

  if (
    !metaverseMountedLookLimitPolicyIds.includes(
      lookLimitPolicyId as MetaverseWorldMountedEntryAuthoring["lookLimitPolicyId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted entry look limit policy for ${fieldName}: ${lookLimitPolicyId}`
    );
  }

  if (
    !metaverseMountedVehicleOccupancyAnimationIds.includes(
      occupancyAnimationId as MetaverseWorldMountedEntryAuthoring["occupancyAnimationId"]
    )
  ) {
    throw new Error(
      `Unsupported mounted entry occupancy animation for ${fieldName}: ${occupancyAnimationId}`
    );
  }

  return Object.freeze({
    cameraPolicyId:
      cameraPolicyId as MetaverseWorldMountedEntryAuthoring["cameraPolicyId"],
    controlRoutingPolicyId:
      controlRoutingPolicyId as MetaverseWorldMountedEntryAuthoring["controlRoutingPolicyId"],
    entryId: readString(entry.entryId, `${fieldName}.entryId`),
    label: readString(entry.label, `${fieldName}.label`),
    lookLimitPolicyId:
      lookLimitPolicyId as MetaverseWorldMountedEntryAuthoring["lookLimitPolicyId"],
    occupancyAnimationId:
      occupancyAnimationId as MetaverseWorldMountedEntryAuthoring["occupancyAnimationId"],
    occupantRole: readMountedOccupantRole(
      entry.occupantRole,
      `${fieldName}.occupantRole`
    )
  });
}

function readPlacement(
  value: unknown,
  fieldName: string
): MetaverseMapBundlePlacementSnapshot {
  const placement = readRecord(value, fieldName);

  return Object.freeze({
    collisionEnabled: readBoolean(
      placement.collisionEnabled,
      `${fieldName}.collisionEnabled`
    ),
    isVisible: readBoolean(placement.isVisible, `${fieldName}.isVisible`),
    materialReferenceId: readNullableString(
      placement.materialReferenceId,
      `${fieldName}.materialReferenceId`
    ),
    notes: readString(placement.notes, `${fieldName}.notes`),
    placementId: readString(placement.placementId, `${fieldName}.placementId`),
    position: readVector3(placement.position, `${fieldName}.position`),
    rotationYRadians: readNumber(
      placement.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    scale: readScale(placement.scale, `${fieldName}.scale`)
  });
}

function readEnvironmentAsset(
  value: unknown,
  fieldName: string
): MetaverseMapBundleEnvironmentAssetSnapshot {
  const environmentAsset = readRecord(value, fieldName);
  const placementMode = readString(
    environmentAsset.placementMode,
    `${fieldName}.placementMode`
  );

  if (
    !metaverseWorldSurfacePlacementIds.includes(
      placementMode as MetaverseWorldSurfacePlacementId
    )
  ) {
    throw new Error(
      `Unsupported placement mode for ${fieldName}: ${placementMode}`
    );
  }

  return Object.freeze({
    assetId: readString(environmentAsset.assetId, `${fieldName}.assetId`),
    collisionPath: readNullableString(
      environmentAsset.collisionPath,
      `${fieldName}.collisionPath`
    ),
    collider: readNullableEnvironmentCollider(
      environmentAsset.collider,
      `${fieldName}.collider`
    ),
    dynamicBody: readNullableEnvironmentDynamicBody(
      environmentAsset.dynamicBody,
      `${fieldName}.dynamicBody`
    ),
    entries:
      environmentAsset.entries === undefined || environmentAsset.entries === null
        ? null
        : Object.freeze(
            readArray(environmentAsset.entries, `${fieldName}.entries`).map(
              (entry, entryIndex) =>
                readMountedEntryAuthoring(
                  entry,
                  `${fieldName}.entries[${entryIndex}]`
                )
            )
          ),
    placementMode: placementMode as MetaverseWorldSurfacePlacementId,
    placements: Object.freeze(
      readArray(environmentAsset.placements, `${fieldName}.placements`).map(
        (placement, placementIndex) =>
          readPlacement(placement, `${fieldName}.placements[${placementIndex}]`)
      )
    ),
    seats:
      environmentAsset.seats === undefined || environmentAsset.seats === null
        ? null
        : Object.freeze(
            readArray(environmentAsset.seats, `${fieldName}.seats`).map(
              (seat, seatIndex) =>
                readMountedSeatAuthoring(
                  seat,
                  `${fieldName}.seats[${seatIndex}]`
                )
            )
          ),
    surfaceColliders: Object.freeze(
      readArray(
        environmentAsset.surfaceColliders,
        `${fieldName}.surfaceColliders`
      ).map((collider, colliderIndex) =>
        readSurfaceCollider(
          collider,
          `${fieldName}.surfaceColliders[${colliderIndex}]`
        )
      )
    ),
    traversalAffordance: readEnvironmentTraversalAffordance(
      environmentAsset.traversalAffordance,
      `${fieldName}.traversalAffordance`
    )
  });
}

function readSpawnNode(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSpawnNodeSnapshot {
  const spawnNode = readRecord(value, fieldName);

  return Object.freeze({
    label: readString(spawnNode.label, `${fieldName}.label`),
    position: readVector3(spawnNode.position, `${fieldName}.position`),
    spawnId: readString(spawnNode.spawnId, `${fieldName}.spawnId`),
    teamId: readSpawnTeamId(spawnNode.teamId, `${fieldName}.teamId`),
    yawRadians: readNumber(spawnNode.yawRadians, `${fieldName}.yawRadians`)
  });
}

function readResourceSpawn(
  value: unknown,
  fieldName: string
): MetaverseMapBundleResourceSpawnSnapshot {
  const resourceSpawn = readRecord(value, fieldName);
  const resourceKind = readString(
    resourceSpawn.resourceKind,
    `${fieldName}.resourceKind`
  );

  if (resourceKind !== "weapon-pickup") {
    throw new Error(
      `Unsupported resource spawn kind for ${fieldName}: ${resourceKind}`
    );
  }

  const ammoGrantRounds = Math.trunc(
    readNumber(resourceSpawn.ammoGrantRounds, `${fieldName}.ammoGrantRounds`)
  );
  const pickupRadiusMeters = readNumber(
    resourceSpawn.pickupRadiusMeters,
    `${fieldName}.pickupRadiusMeters`
  );
  const respawnCooldownMs = readNumber(
    resourceSpawn.respawnCooldownMs,
    `${fieldName}.respawnCooldownMs`
  );

  if (ammoGrantRounds <= 0) {
    throw new Error(`${fieldName}.ammoGrantRounds must be greater than 0.`);
  }

  if (pickupRadiusMeters <= 0) {
    throw new Error(`${fieldName}.pickupRadiusMeters must be greater than 0.`);
  }

  if (respawnCooldownMs < 0) {
    throw new Error(`${fieldName}.respawnCooldownMs must be at or above 0.`);
  }

  return Object.freeze({
    ammoGrantRounds,
    assetId: readNullableString(resourceSpawn.assetId, `${fieldName}.assetId`),
    label: readString(resourceSpawn.label, `${fieldName}.label`),
    modeTags: Object.freeze(
      readArray(resourceSpawn.modeTags, `${fieldName}.modeTags`).map(
        (modeTag, modeTagIndex) =>
          readString(modeTag, `${fieldName}.modeTags[${modeTagIndex}]`)
      )
    ),
    pickupRadiusMeters,
    position: readVector3(resourceSpawn.position, `${fieldName}.position`),
    resourceKind,
    respawnCooldownMs,
    spawnId: readString(resourceSpawn.spawnId, `${fieldName}.spawnId`),
    weaponId: readString(resourceSpawn.weaponId, `${fieldName}.weaponId`),
    yawRadians: readNumber(resourceSpawn.yawRadians, `${fieldName}.yawRadians`)
  });
}

function readPresentationProfileIds(
  value: unknown,
  fieldName: string
): MetaverseMapBundlePresentationProfileIds {
  const profileIds = readRecord(value, fieldName);

  return Object.freeze({
    cameraProfileId: readNullableString(
      profileIds.cameraProfileId,
      `${fieldName}.cameraProfileId`
    ),
    characterPresentationProfileId: readNullableString(
      profileIds.characterPresentationProfileId,
      `${fieldName}.characterPresentationProfileId`
    ),
    environmentPresentationProfileId: readNullableString(
      profileIds.environmentPresentationProfileId,
      `${fieldName}.environmentPresentationProfileId`
    ),
    hudProfileId: readNullableString(
      profileIds.hudProfileId,
      `${fieldName}.hudProfileId`
    )
  });
}

function readGameplayProfileId(
  value: unknown,
  fieldName: string
): string {
  const gameplayProfileId = readString(value, fieldName);

  if (readMetaverseGameplayProfile(gameplayProfileId) === null) {
    throw new Error(
      `Unsupported metaverse gameplay profile for ${fieldName}: ${gameplayProfileId}`
    );
  }

  return gameplayProfileId;
}

function readRgbTuple(
  value: unknown,
  fieldName: string
): readonly [number, number, number] {
  const rawTuple = readArray(value, fieldName);

  if (rawTuple.length !== 3) {
    throw new Error(`Expected ${fieldName} to contain exactly 3 entries.`);
  }

  return Object.freeze([
    readNumber(rawTuple[0], `${fieldName}[0]`),
    readNumber(rawTuple[1], `${fieldName}[1]`),
    readNumber(rawTuple[2], `${fieldName}[2]`)
  ]);
}

function readEnvironmentPresentation(
  value: unknown,
  fieldName: string
): MetaverseMapBundleEnvironmentPresentationSnapshot {
  const presentation = readRecord(value, fieldName);
  const environment = readRecord(
    presentation.environment,
    `${fieldName}.environment`
  );
  const ocean = readRecord(presentation.ocean, `${fieldName}.ocean`);
  const waveFrequencies = readRecord(
    ocean.waveFrequencies,
    `${fieldName}.ocean.waveFrequencies`
  );
  const waveSpeeds = readRecord(ocean.waveSpeeds, `${fieldName}.ocean.waveSpeeds`);
  const toneMappingExposure = readNumber(
    environment.toneMappingExposure,
    `${fieldName}.environment.toneMappingExposure`
  );

  return Object.freeze({
    environment: Object.freeze({
      cloudCoverage: readNumber(
        environment.cloudCoverage,
        `${fieldName}.environment.cloudCoverage`
      ),
      cloudDensity: readNumber(
        environment.cloudDensity,
        `${fieldName}.environment.cloudDensity`
      ),
      cloudElevation: readNumber(
        environment.cloudElevation,
        `${fieldName}.environment.cloudElevation`
      ),
      cloudScale: readNumberWithDefault(
        environment.cloudScale,
        0.0002,
        `${fieldName}.environment.cloudScale`
      ),
      cloudSpeed: readNumberWithDefault(
        environment.cloudSpeed,
        0.0001,
        `${fieldName}.environment.cloudSpeed`
      ),
      domeRadius: readNumber(
        environment.domeRadius,
        `${fieldName}.environment.domeRadius`
      ),
      fogColor: readRgbTuple(
        environment.fogColor,
        `${fieldName}.environment.fogColor`
      ),
      fogDensity: readNumber(
        environment.fogDensity,
        `${fieldName}.environment.fogDensity`
      ),
      fogEnabled: readBoolean(
        environment.fogEnabled,
        `${fieldName}.environment.fogEnabled`
      ),
      groundColor: readRgbTuple(
        environment.groundColor ?? ocean.farColor ?? environment.fogColor,
        `${fieldName}.environment.groundColor`
      ),
      groundFalloff: readNumberWithDefault(
        environment.groundFalloff,
        1.2,
        `${fieldName}.environment.groundFalloff`
      ),
      horizonColor: readRgbTuple(
        environment.horizonColor ?? environment.fogColor,
        `${fieldName}.environment.horizonColor`
      ),
      horizonSoftness: readNumberWithDefault(
        environment.horizonSoftness,
        0.22,
        `${fieldName}.environment.horizonSoftness`
      ),
      mieCoefficient: readNumber(
        environment.mieCoefficient,
        `${fieldName}.environment.mieCoefficient`
      ),
      mieDirectionalG: readNumber(
        environment.mieDirectionalG,
        `${fieldName}.environment.mieDirectionalG`
      ),
      rayleigh: readNumber(
        environment.rayleigh,
        `${fieldName}.environment.rayleigh`
      ),
      skyExposure: readClampedNumberWithDefault(
        environment.skyExposure,
        toneMappingExposure,
        0.05,
        4,
        `${fieldName}.environment.skyExposure`
      ),
      skyExposureCurve: readClampedNumberWithDefault(
        environment.skyExposureCurve,
        1,
        0,
        4,
        `${fieldName}.environment.skyExposureCurve`
      ),
      sunAzimuthDegrees: readNumber(
        environment.sunAzimuthDegrees,
        `${fieldName}.environment.sunAzimuthDegrees`
      ),
      sunColor: readRgbTuple(
        environment.sunColor,
        `${fieldName}.environment.sunColor`
      ),
      sunElevationDegrees: readNumber(
        environment.sunElevationDegrees,
        `${fieldName}.environment.sunElevationDegrees`
      ),
      toneMappingExposure,
      turbidity: readNumber(
        environment.turbidity,
        `${fieldName}.environment.turbidity`
      )
    }),
    ocean: Object.freeze({
      emissiveColor: readRgbTuple(
        ocean.emissiveColor,
        `${fieldName}.ocean.emissiveColor`
      ),
      farColor: readRgbTuple(ocean.farColor, `${fieldName}.ocean.farColor`),
      height: readNumber(ocean.height, `${fieldName}.ocean.height`),
      nearColor: readRgbTuple(ocean.nearColor, `${fieldName}.ocean.nearColor`),
      planeDepth: readNumber(ocean.planeDepth, `${fieldName}.ocean.planeDepth`),
      planeWidth: readNumber(ocean.planeWidth, `${fieldName}.ocean.planeWidth`),
      roughness: readNumber(ocean.roughness, `${fieldName}.ocean.roughness`),
      segmentCount: readNumber(
        ocean.segmentCount,
        `${fieldName}.ocean.segmentCount`
      ),
      waveAmplitude: readNumber(
        ocean.waveAmplitude,
        `${fieldName}.ocean.waveAmplitude`
      ),
      waveFrequencies: Object.freeze({
        primary: readNumber(
          waveFrequencies.primary,
          `${fieldName}.ocean.waveFrequencies.primary`
        ),
        ripple: readNumber(
          waveFrequencies.ripple,
          `${fieldName}.ocean.waveFrequencies.ripple`
        ),
        secondary: readNumber(
          waveFrequencies.secondary,
          `${fieldName}.ocean.waveFrequencies.secondary`
        )
      }),
      waveSpeeds: Object.freeze({
        primary: readNumber(
          waveSpeeds.primary,
          `${fieldName}.ocean.waveSpeeds.primary`
        ),
        ripple: readNumber(
          waveSpeeds.ripple,
          `${fieldName}.ocean.waveSpeeds.ripple`
        ),
        secondary: readNumber(
          waveSpeeds.secondary,
          `${fieldName}.ocean.waveSpeeds.secondary`
        )
      })
    })
  });
}

function readSceneObjectCapability(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSceneObjectCapabilitySnapshot {
  const capability = readRecord(value, fieldName);
  const kind = readString(capability.kind, `${fieldName}.kind`);

  switch (kind) {
    case "launch-target":
      return Object.freeze({
        beamColor: readRgbTuple(capability.beamColor, `${fieldName}.beamColor`),
        experienceId: readExperienceId(
          capability.experienceId,
          `${fieldName}.experienceId`
        ),
        highlightRadius: readNumber(
          capability.highlightRadius,
          `${fieldName}.highlightRadius`
        ),
        interactionRadius: readNumber(
          capability.interactionRadius,
          `${fieldName}.interactionRadius`
        ),
        kind: "launch-target",
        ringColor: readRgbTuple(capability.ringColor, `${fieldName}.ringColor`)
      });
    default:
      throw new Error(`Unsupported scene object capability kind: ${kind}`);
  }
}

function readSceneObject(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSceneObjectSnapshot {
  const sceneObject = readRecord(value, fieldName);

  return Object.freeze({
    assetId: readNullableString(sceneObject.assetId, `${fieldName}.assetId`),
    capabilities: Object.freeze(
      readArray(sceneObject.capabilities, `${fieldName}.capabilities`).map(
        (capability, capabilityIndex) =>
          readSceneObjectCapability(
            capability,
            `${fieldName}.capabilities[${capabilityIndex}]`
          )
      )
    ),
    label: readString(sceneObject.label, `${fieldName}.label`),
    objectId: readString(sceneObject.objectId, `${fieldName}.objectId`),
    position: readVector3(sceneObject.position, `${fieldName}.position`),
    rotationYRadians: readNumber(
      sceneObject.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    scale: readNumber(sceneObject.scale, `${fieldName}.scale`)
  });
}

function readLaunchVariation(
  value: unknown,
  fieldName: string
): MetaverseMapBundleLaunchVariationSnapshot {
  const launchVariation = readRecord(value, fieldName);

  return Object.freeze({
    description: readString(
      launchVariation.description,
      `${fieldName}.description`
    ),
    experienceId: readNullableExperienceId(
      launchVariation.experienceId,
      `${fieldName}.experienceId`
    ),
    gameplayVariationId: readNullableString(
      launchVariation.gameplayVariationId,
      `${fieldName}.gameplayVariationId`
    ),
    label: readString(launchVariation.label, `${fieldName}.label`),
    matchMode: readNullableSessionMode(
      launchVariation.matchMode ?? launchVariation.sessionMode ?? null,
      `${fieldName}.matchMode`
    ),
    variationId: readString(
      launchVariation.variationId,
      `${fieldName}.variationId`
    ),
    vehicleLayoutId: readNullableString(
      launchVariation.vehicleLayoutId,
      `${fieldName}.vehicleLayoutId`
    ),
    weaponLayoutId: readNullableString(
      launchVariation.weaponLayoutId,
      `${fieldName}.weaponLayoutId`
    )
  });
}

function readSpawnTeamId(
  value: unknown,
  fieldName: string
): MetaverseMapPlayerSpawnTeamId {
  if (value === undefined || value === null) {
    return "neutral";
  }

  const teamId = readString(value, fieldName);

  if (!metaverseMapPlayerSpawnTeamIds.includes(teamId as MetaverseMapPlayerSpawnTeamId)) {
    throw new Error(`Unsupported spawn team id for ${fieldName}: ${teamId}`);
  }

  return teamId as MetaverseMapPlayerSpawnTeamId;
}

function readNullableSpawnTeamId(
  value: unknown,
  fieldName: string
): MetaverseMapPlayerSpawnTeamId | null {
  if (value === undefined || value === null) {
    return null;
  }

  return readSpawnTeamId(value, fieldName);
}

function readPlayerSpawnSelection(
  value: unknown,
  fieldName: string
): MetaverseMapBundlePlayerSpawnSelectionSnapshot {
  if (value === undefined || value === null) {
    return defaultMetaverseMapBundlePlayerSpawnSelection;
  }

  const playerSpawnSelection = readRecord(value, fieldName);
  const enemyAvoidanceRadiusMeters = readNumber(
    playerSpawnSelection.enemyAvoidanceRadiusMeters,
    `${fieldName}.enemyAvoidanceRadiusMeters`
  );
  const homeTeamBiasMeters = readNumber(
    playerSpawnSelection.homeTeamBiasMeters,
    `${fieldName}.homeTeamBiasMeters`
  );

  if (enemyAvoidanceRadiusMeters < 0) {
    throw new Error(
      `${fieldName}.enemyAvoidanceRadiusMeters must stay at or above 0.`
    );
  }

  if (homeTeamBiasMeters < 0) {
    throw new Error(`${fieldName}.homeTeamBiasMeters must stay at or above 0.`);
  }

  return Object.freeze({
    enemyAvoidanceRadiusMeters,
    homeTeamBiasMeters
  });
}

function readWaterRegion(
  value: unknown,
  fieldName: string
): MetaverseWorldWaterRegionAuthoring {
  const waterRegion = readRecord(value, fieldName);

  return Object.freeze({
    center: readVector3(waterRegion.center, `${fieldName}.center`),
    rotationYRadians: readNumber(
      waterRegion.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    size: readVector3(waterRegion.size, `${fieldName}.size`),
    waterRegionId: readString(
      waterRegion.waterRegionId,
      `${fieldName}.waterRegionId`
    )
  });
}

function readPlanarPoint(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticPlanarPointSnapshot {
  const point = readRecord(value, fieldName);

  return Object.freeze({
    x: readNumber(point.x, `${fieldName}.x`),
    z: readNumber(point.z, `${fieldName}.z`)
  });
}

function readPlanarLoop(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticPlanarLoopSnapshot {
  const pointsValue = Array.isArray(value)
    ? value
    : readRecord(value, fieldName).points;

  return Object.freeze({
    points: Object.freeze(
      readArray(pointsValue, `${fieldName}.points`).map((point, pointIndex) =>
        readPlanarPoint(point, `${fieldName}.points[${pointIndex}]`)
      )
    )
  });
}

function readSemanticGridRect(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticStructureSnapshot["grid"] {
  const grid = readRecord(value, fieldName);

  return Object.freeze({
    cellX: readNumber(grid.cellX, `${fieldName}.cellX`),
    cellZ: readNumber(grid.cellZ, `${fieldName}.cellZ`),
    cellsX: readNumber(grid.cellsX, `${fieldName}.cellsX`),
    cellsZ: readNumber(grid.cellsZ, `${fieldName}.cellsZ`),
    layer: readNumber(grid.layer, `${fieldName}.layer`)
  });
}

function createLegacyTerrainPatchGrid(
  sampleCountX: number,
  sampleCountZ: number
): MetaverseMapBundleSemanticTerrainPatchSnapshot["grid"] {
  return Object.freeze({
    cellX: Math.round(-(sampleCountX - 1) * 0.5),
    cellZ: Math.round(-(sampleCountZ - 1) * 0.5),
    cellsX: Math.max(1, sampleCountX),
    cellsZ: Math.max(1, sampleCountZ),
    layer: 0
  });
}

function readTerrainMaterialLayer(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticTerrainMaterialLayerSnapshot {
  const layer = readRecord(value, fieldName);

  return Object.freeze({
    layerId: readString(layer.layerId, `${fieldName}.layerId`),
    materialId: readSemanticMaterialId(layer.materialId, `${fieldName}.materialId`),
    weightSamples: Object.freeze(
      readArray(layer.weightSamples, `${fieldName}.weightSamples`).map(
        (weight, weightIndex) =>
          readNumber(weight, `${fieldName}.weightSamples[${weightIndex}]`)
      )
    )
  });
}

function readTerrainPatch(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticTerrainPatchSnapshot {
  const terrainPatch = readRecord(value, fieldName);

  return Object.freeze({
    grid: readSemanticGridRect(terrainPatch.grid, `${fieldName}.grid`),
    heightSamples: Object.freeze(
      readArray(terrainPatch.heightSamples, `${fieldName}.heightSamples`).map(
        (height, heightIndex) =>
          readNumber(height, `${fieldName}.heightSamples[${heightIndex}]`)
      )
    ),
    label: readString(terrainPatch.label, `${fieldName}.label`),
    materialLayers: Object.freeze(
      readArray(terrainPatch.materialLayers ?? [], `${fieldName}.materialLayers`).map(
        (layer, layerIndex) =>
          readTerrainMaterialLayer(
            layer,
            `${fieldName}.materialLayers[${layerIndex}]`
          )
      )
    ),
    origin: readVector3(terrainPatch.origin, `${fieldName}.origin`),
    rotationYRadians: readNumber(
      terrainPatch.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    sampleCountX: readNumber(
      terrainPatch.sampleCountX,
      `${fieldName}.sampleCountX`
    ),
    sampleCountZ: readNumber(
      terrainPatch.sampleCountZ,
      `${fieldName}.sampleCountZ`
    ),
    sampleSpacingMeters: readNumber(
      terrainPatch.sampleSpacingMeters,
      `${fieldName}.sampleSpacingMeters`
    ),
    terrainPatchId: readString(
      terrainPatch.terrainPatchId,
      `${fieldName}.terrainPatchId`
    ),
    waterLevelMeters:
      terrainPatch.waterLevelMeters === null ||
      terrainPatch.waterLevelMeters === undefined
        ? null
        : readNumber(
            terrainPatch.waterLevelMeters,
            `${fieldName}.waterLevelMeters`
          )
  });
}

function readLegacyTerrainChunkAsPatch(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticTerrainPatchSnapshot {
  const terrainChunk = readRecord(value, fieldName);
  const sampleCountX = readNumber(
    terrainChunk.sampleCountX,
    `${fieldName}.sampleCountX`
  );
  const sampleCountZ = readNumber(
    terrainChunk.sampleCountZ,
    `${fieldName}.sampleCountZ`
  );
  const chunkId = readString(terrainChunk.chunkId, `${fieldName}.chunkId`);
  const heights = Object.freeze(
    readArray(terrainChunk.heights, `${fieldName}.heights`).map(
      (height, heightIndex) =>
        readNumber(height, `${fieldName}.heights[${heightIndex}]`)
    )
  );

  return Object.freeze({
    grid: createLegacyTerrainPatchGrid(sampleCountX, sampleCountZ),
    heightSamples: heights,
    label: chunkId,
    materialLayers: Object.freeze([
      Object.freeze({
        layerId: `${chunkId}:terrain-grass`,
        materialId: "terrain-grass",
        weightSamples: Object.freeze(
          Array.from({ length: heights.length }, () => 1)
        )
      })
    ]),
    origin: readVector3(terrainChunk.origin, `${fieldName}.origin`),
    rotationYRadians: 0,
    sampleCountX,
    sampleCountZ,
    sampleSpacingMeters: readNumber(
      terrainChunk.sampleStrideMeters,
      `${fieldName}.sampleStrideMeters`
    ),
    terrainPatchId: chunkId,
    waterLevelMeters:
      terrainChunk.waterLevelMeters === null ||
      terrainChunk.waterLevelMeters === undefined
        ? null
        : readNumber(
            terrainChunk.waterLevelMeters,
            `${fieldName}.waterLevelMeters`
          )
  });
}

function readSemanticSurface(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticSurfaceSnapshot {
  const surface = readRecord(value, fieldName);
  const kind = readString(surface.kind, `${fieldName}.kind`);

  if (
    kind !== "flat-slab" &&
    kind !== "sloped-plane" &&
    kind !== "terrain-patch"
  ) {
    throw new Error(`Unsupported semantic surface kind for ${fieldName}: ${kind}`);
  }

  return Object.freeze({
    center: readVector3(surface.center, `${fieldName}.center`),
    elevation: readNumber(surface.elevation, `${fieldName}.elevation`),
    kind,
    label: readString(surface.label, `${fieldName}.label`),
    rotationYRadians: readNumber(
      surface.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    size: readVector3(surface.size, `${fieldName}.size`),
    slopeRiseMeters:
      surface.slopeRiseMeters === undefined
        ? 0
        : readNumber(surface.slopeRiseMeters, `${fieldName}.slopeRiseMeters`),
    surfaceId: readString(surface.surfaceId, `${fieldName}.surfaceId`),
    terrainPatchId: readNullableString(
      surface.terrainPatchId ?? surface.terrainChunkId ?? null,
      `${fieldName}.terrainPatchId`
    )
  });
}

function readSemanticRegion(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticRegionSnapshot {
  const region = readRecord(value, fieldName);
  const regionKind = readString(region.regionKind, `${fieldName}.regionKind`);

  if (
    regionKind !== "arena" &&
    regionKind !== "floor" &&
    regionKind !== "path" &&
    regionKind !== "roof"
  ) {
    throw new Error(`Unsupported semantic region kind for ${fieldName}: ${regionKind}`);
  }

  return Object.freeze({
    holes: Object.freeze(
      readArray(region.holes ?? [], `${fieldName}.holes`).map((hole, holeIndex) =>
        readPlanarLoop(hole, `${fieldName}.holes[${holeIndex}]`)
      )
    ),
    label: readString(region.label, `${fieldName}.label`),
    materialReferenceId: readNullableString(
      region.materialReferenceId ?? null,
      `${fieldName}.materialReferenceId`
    ),
    outerLoop: readPlanarLoop(region.outerLoop, `${fieldName}.outerLoop`),
    regionId: readString(region.regionId, `${fieldName}.regionId`),
    regionKind,
    surfaceId: readString(region.surfaceId, `${fieldName}.surfaceId`)
  });
}

function readSemanticEdge(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticEdgeSnapshot {
  const edge = readRecord(value, fieldName);
  const edgeKind = readString(edge.edgeKind, `${fieldName}.edgeKind`);

  if (
    edgeKind !== "curb" &&
    edgeKind !== "fence" &&
    edgeKind !== "rail" &&
    edgeKind !== "retaining-wall" &&
    edgeKind !== "wall"
  ) {
    throw new Error(`Unsupported semantic edge kind for ${fieldName}: ${edgeKind}`);
  }

  return Object.freeze({
    edgeId: readString(edge.edgeId, `${fieldName}.edgeId`),
    edgeKind,
    heightMeters: readNumber(edge.heightMeters, `${fieldName}.heightMeters`),
    label: readString(edge.label, `${fieldName}.label`),
    materialReferenceId: readNullableString(
      edge.materialReferenceId ?? null,
      `${fieldName}.materialReferenceId`
    ),
    path: Object.freeze(
      readArray(edge.path, `${fieldName}.path`).map((point, pointIndex) =>
        readPlanarPoint(point, `${fieldName}.path[${pointIndex}]`)
      )
    ),
    surfaceId: readString(edge.surfaceId, `${fieldName}.surfaceId`),
    thicknessMeters: readNumber(
      edge.thicknessMeters,
      `${fieldName}.thicknessMeters`
    )
  });
}

function readSemanticConnector(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticConnectorSnapshot {
  const connector = readRecord(value, fieldName);
  const connectorKind = readString(
    connector.connectorKind,
    `${fieldName}.connectorKind`
  );

  if (
    connectorKind !== "door" &&
    connectorKind !== "gate" &&
    connectorKind !== "ramp"
  ) {
    throw new Error(
      `Unsupported semantic connector kind for ${fieldName}: ${connectorKind}`
    );
  }

  return Object.freeze({
    center: readVector3(connector.center, `${fieldName}.center`),
    connectorId: readString(connector.connectorId, `${fieldName}.connectorId`),
    connectorKind,
    fromSurfaceId: readString(
      connector.fromSurfaceId,
      `${fieldName}.fromSurfaceId`
    ),
    label: readString(connector.label, `${fieldName}.label`),
    rotationYRadians: readNumber(
      connector.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    size: readVector3(connector.size, `${fieldName}.size`),
    toSurfaceId: readString(connector.toSurfaceId, `${fieldName}.toSurfaceId`)
  });
}

function readSemanticModule(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticModuleSnapshot {
  const module = readRecord(value, fieldName);
  const placementMode = readString(module.placementMode, `${fieldName}.placementMode`);

  if (
    !metaverseWorldSurfacePlacementIds.includes(
      placementMode as MetaverseWorldSurfacePlacementId
    )
  ) {
    throw new Error(
      `Unsupported placement mode for ${fieldName}.placementMode: ${placementMode}`
    );
  }

  return Object.freeze({
    assetId: readString(module.assetId, `${fieldName}.assetId`),
    collisionEnabled: readBoolean(
      module.collisionEnabled ?? true,
      `${fieldName}.collisionEnabled`
    ),
    collisionPath: readNullableString(
      module.collisionPath ?? null,
      `${fieldName}.collisionPath`
    ),
    collider: readNullableEnvironmentCollider(
      module.collider ?? null,
      `${fieldName}.collider`
    ),
    dynamicBody: readNullableEnvironmentDynamicBody(
      module.dynamicBody ?? null,
      `${fieldName}.dynamicBody`
    ),
    entries:
      module.entries === undefined || module.entries === null
        ? null
        : Object.freeze(
            readArray(module.entries, `${fieldName}.entries`).map(
              (entry, entryIndex) =>
                readMountedEntryAuthoring(
                  entry,
                  `${fieldName}.entries[${entryIndex}]`
                )
            )
          ),
    isVisible: readBoolean(module.isVisible ?? true, `${fieldName}.isVisible`),
    label: readString(module.label ?? module.moduleId, `${fieldName}.label`),
    materialReferenceId: readNullableString(
      module.materialReferenceId ?? null,
      `${fieldName}.materialReferenceId`
    ),
    moduleId: readString(module.moduleId, `${fieldName}.moduleId`),
    notes: readString(module.notes ?? "", `${fieldName}.notes`),
    placementMode: placementMode as MetaverseWorldSurfacePlacementId,
    position: readVector3(module.position, `${fieldName}.position`),
    rotationYRadians: readNumber(
      module.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    scale: readScale(module.scale, `${fieldName}.scale`),
    seats:
      module.seats === undefined || module.seats === null
        ? null
        : Object.freeze(
            readArray(module.seats, `${fieldName}.seats`).map((seat, seatIndex) =>
              readMountedSeatAuthoring(seat, `${fieldName}.seats[${seatIndex}]`)
            )
          ),
    surfaceColliders: Object.freeze(
      readArray(
        module.surfaceColliders ?? [],
        `${fieldName}.surfaceColliders`
      ).map((collider, colliderIndex) =>
        readSurfaceCollider(
          collider,
          `${fieldName}.surfaceColliders[${colliderIndex}]`
        )
      )
    ),
    traversalAffordance: readEnvironmentTraversalAffordance(
      module.traversalAffordance,
      `${fieldName}.traversalAffordance`
    )
  });
}

function readSemanticMaterialId(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticMaterialId {
  const materialId = readString(value, fieldName);

  if (!semanticMaterialIds.includes(materialId as MetaverseMapBundleSemanticMaterialId)) {
    throw new Error(`Unsupported semantic material id for ${fieldName}: ${materialId}`);
  }

  return materialId as MetaverseMapBundleSemanticMaterialId;
}

function readHexColor(value: unknown, fieldName: string): string {
  const color = readString(value, fieldName);

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`Expected #rrggbb color for ${fieldName}: ${color}`);
  }

  return color.toLowerCase();
}

function readNullableHexColor(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return readHexColor(value, fieldName);
}

function readNullableImageDataUrl(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  const dataUrl = readString(value, fieldName);

  if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    throw new Error(`Expected image data URL for ${fieldName}`);
  }

  return dataUrl;
}

function readSemanticMaterialDefinition(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticMaterialDefinitionSnapshot {
  const materialDefinition = readRecord(value, fieldName);

  return Object.freeze({
    accentColorHex: readNullableHexColor(
      materialDefinition.accentColorHex ?? null,
      `${fieldName}.accentColorHex`
    ),
    baseColorHex: readHexColor(
      materialDefinition.baseColorHex,
      `${fieldName}.baseColorHex`
    ),
    baseMaterialId: readSemanticMaterialId(
      materialDefinition.baseMaterialId,
      `${fieldName}.baseMaterialId`
    ),
    label: readString(
      materialDefinition.label ?? materialDefinition.materialId,
      `${fieldName}.label`
    ),
    materialId: readString(materialDefinition.materialId, `${fieldName}.materialId`),
    metalness: readUnitNumberWithDefault(
      materialDefinition.metalness,
      0.04,
      `${fieldName}.metalness`
    ),
    opacity: readUnitNumberWithDefault(
      materialDefinition.opacity,
      1,
      `${fieldName}.opacity`
    ),
    roughness: readUnitNumberWithDefault(
      materialDefinition.roughness,
      0.82,
      `${fieldName}.roughness`
    ),
    textureBrightness: readClampedNumberWithDefault(
      materialDefinition.textureBrightness,
      1,
      0,
      2,
      `${fieldName}.textureBrightness`
    ),
    textureContrast: readClampedNumberWithDefault(
      materialDefinition.textureContrast,
      1,
      0,
      2,
      `${fieldName}.textureContrast`
    ),
    textureImageDataUrl: readNullableImageDataUrl(
      materialDefinition.textureImageDataUrl ?? null,
      `${fieldName}.textureImageDataUrl`
    ),
    texturePatternStrength: readUnitNumberWithDefault(
      materialDefinition.texturePatternStrength,
      1,
      `${fieldName}.texturePatternStrength`
    ),
    textureRepeat: readClampedNumberWithDefault(
      materialDefinition.textureRepeat,
      1,
      0.25,
      32,
      `${fieldName}.textureRepeat`
    )
  });
}

function readSemanticMaterialDefinitions(
  value: unknown,
  fieldName: string
): readonly MetaverseMapBundleSemanticMaterialDefinitionSnapshot[] {
  const materialDefinitions = readArray(value, fieldName).map(
    (materialDefinition, materialDefinitionIndex) =>
      readSemanticMaterialDefinition(
        materialDefinition,
        `${fieldName}[${materialDefinitionIndex}]`
      )
  );
  const materialIds = new Set<string>();

  for (const materialDefinition of materialDefinitions) {
    if (semanticMaterialIds.includes(materialDefinition.materialId as MetaverseMapBundleSemanticMaterialId)) {
      throw new Error(
        `Custom semantic material id must not shadow a built-in material: ${materialDefinition.materialId}`
      );
    }

    if (materialIds.has(materialDefinition.materialId)) {
      throw new Error(
        `Duplicate semantic material definition id: ${materialDefinition.materialId}`
      );
    }

    materialIds.add(materialDefinition.materialId);
  }

  return Object.freeze(materialDefinitions);
}

function readSemanticStructureKind(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticStructureKind {
  const structureKind = readString(value, fieldName);

  if (!semanticStructureKinds.includes(structureKind as MetaverseMapBundleSemanticStructureKind)) {
    throw new Error(
      `Unsupported semantic structure kind for ${fieldName}: ${structureKind}`
    );
  }

  return structureKind as MetaverseMapBundleSemanticStructureKind;
}

function readSemanticStructure(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticStructureSnapshot {
  const structure = readRecord(value, fieldName);
  const traversalAffordance = readString(
    structure.traversalAffordance,
    `${fieldName}.traversalAffordance`
  );

  if (traversalAffordance !== "blocker" && traversalAffordance !== "support") {
    throw new Error(
      `Unsupported structure traversal affordance for ${fieldName}: ${traversalAffordance}`
    );
  }

  return Object.freeze({
    center: readVector3(structure.center, `${fieldName}.center`),
    grid: readSemanticGridRect(structure.grid, `${fieldName}.grid`),
    label: readString(structure.label, `${fieldName}.label`),
    materialId: readSemanticMaterialId(
      structure.materialId,
      `${fieldName}.materialId`
    ),
    materialReferenceId: readNullableString(
      structure.materialReferenceId ?? null,
      `${fieldName}.materialReferenceId`
    ),
    rotationYRadians: readNumber(
      structure.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    size: readVector3(structure.size, `${fieldName}.size`),
    structureId: readString(structure.structureId, `${fieldName}.structureId`),
    structureKind: readSemanticStructureKind(
      structure.structureKind,
      `${fieldName}.structureKind`
    ),
    traversalAffordance
  });
}

function readSemanticGameplayVolumeKind(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticGameplayVolumeKind {
  const volumeKind = readString(value, fieldName);

  if (!semanticGameplayVolumeKinds.includes(volumeKind as MetaverseMapBundleSemanticGameplayVolumeKind)) {
    throw new Error(
      `Unsupported semantic gameplay volume kind for ${fieldName}: ${volumeKind}`
    );
  }

  return volumeKind as MetaverseMapBundleSemanticGameplayVolumeKind;
}

function readSemanticGameplayVolume(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticGameplayVolumeSnapshot {
  const volume = readRecord(value, fieldName);

  return Object.freeze({
    center: readVector3(volume.center, `${fieldName}.center`),
    label: readString(volume.label, `${fieldName}.label`),
    priority: readNumber(volume.priority ?? 0, `${fieldName}.priority`),
    rotationYRadians: readNumber(
      volume.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    routePoints: Object.freeze(
      readArray(volume.routePoints ?? [], `${fieldName}.routePoints`).map(
        (point, pointIndex) =>
          readVector3(point, `${fieldName}.routePoints[${pointIndex}]`)
      )
    ),
    size: readVector3(volume.size, `${fieldName}.size`),
    tags: Object.freeze(
      readArray(volume.tags ?? [], `${fieldName}.tags`).map((tag, tagIndex) =>
        readString(tag, `${fieldName}.tags[${tagIndex}]`)
      )
    ),
    teamId: readNullableSpawnTeamId(volume.teamId ?? null, `${fieldName}.teamId`),
    volumeId: readString(volume.volumeId, `${fieldName}.volumeId`),
    volumeKind: readSemanticGameplayVolumeKind(
      volume.volumeKind,
      `${fieldName}.volumeKind`
    )
  });
}

function readSemanticLightKind(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticLightKind {
  const lightKind = readString(value, fieldName);

  if (!semanticLightKinds.includes(lightKind as MetaverseMapBundleSemanticLightKind)) {
    throw new Error(`Unsupported semantic light kind for ${fieldName}: ${lightKind}`);
  }

  return lightKind as MetaverseMapBundleSemanticLightKind;
}

function readSemanticLight(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticLightSnapshot {
  const light = readRecord(value, fieldName);

  return Object.freeze({
    color: readRgbTuple(light.color, `${fieldName}.color`),
    intensity: readNumber(light.intensity, `${fieldName}.intensity`),
    label: readString(light.label, `${fieldName}.label`),
    lightId: readString(light.lightId, `${fieldName}.lightId`),
    lightKind: readSemanticLightKind(light.lightKind, `${fieldName}.lightKind`),
    position: readVector3(light.position, `${fieldName}.position`),
    rangeMeters:
      light.rangeMeters === undefined || light.rangeMeters === null
        ? null
        : readNumber(light.rangeMeters, `${fieldName}.rangeMeters`),
    rotationYRadians: readNumber(
      light.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    target:
      light.target === undefined || light.target === null
        ? null
        : readVector3(light.target, `${fieldName}.target`)
  });
}

function readSemanticWorld(
  value: unknown,
  fieldName: string
): MetaverseMapBundleSemanticWorldSnapshot {
  const semanticWorld = readRecord(value, fieldName);
  const compatibilityAssetIds = readRecord(
    semanticWorld.compatibilityAssetIds ?? {},
    `${fieldName}.compatibilityAssetIds`
  );

  return Object.freeze({
    compatibilityAssetIds: Object.freeze({
      connectorAssetId: readNullableString(
        compatibilityAssetIds.connectorAssetId ?? null,
        `${fieldName}.compatibilityAssetIds.connectorAssetId`
      ),
      floorAssetId: readNullableString(
        compatibilityAssetIds.floorAssetId ?? null,
        `${fieldName}.compatibilityAssetIds.floorAssetId`
      ),
      wallAssetId: readNullableString(
        compatibilityAssetIds.wallAssetId ?? null,
        `${fieldName}.compatibilityAssetIds.wallAssetId`
      )
    }),
    connectors: Object.freeze(
      readArray(semanticWorld.connectors ?? [], `${fieldName}.connectors`).map(
        (connector, connectorIndex) =>
          readSemanticConnector(
            connector,
            `${fieldName}.connectors[${connectorIndex}]`
          )
      )
    ),
    edges: Object.freeze(
      readArray(semanticWorld.edges ?? [], `${fieldName}.edges`).map(
        (edge, edgeIndex) =>
          readSemanticEdge(edge, `${fieldName}.edges[${edgeIndex}]`)
      )
    ),
    gameplayVolumes: Object.freeze(
      readArray(
        semanticWorld.gameplayVolumes ?? [],
        `${fieldName}.gameplayVolumes`
      ).map((volume, volumeIndex) =>
        readSemanticGameplayVolume(
          volume,
          `${fieldName}.gameplayVolumes[${volumeIndex}]`
        )
      )
    ),
    lights: Object.freeze(
      readArray(semanticWorld.lights ?? [], `${fieldName}.lights`).map(
        (light, lightIndex) =>
          readSemanticLight(light, `${fieldName}.lights[${lightIndex}]`)
      )
    ),
    materialDefinitions: readSemanticMaterialDefinitions(
      semanticWorld.materialDefinitions ?? [],
      `${fieldName}.materialDefinitions`
    ),
    modules: Object.freeze(
      readArray(semanticWorld.modules ?? [], `${fieldName}.modules`).map(
        (module, moduleIndex) =>
          readSemanticModule(module, `${fieldName}.modules[${moduleIndex}]`)
      )
    ),
    regions: Object.freeze(
      readArray(semanticWorld.regions ?? [], `${fieldName}.regions`).map(
        (region, regionIndex) =>
          readSemanticRegion(region, `${fieldName}.regions[${regionIndex}]`)
      )
    ),
    surfaces: Object.freeze(
      readArray(semanticWorld.surfaces ?? [], `${fieldName}.surfaces`).map(
        (surface, surfaceIndex) =>
          readSemanticSurface(surface, `${fieldName}.surfaces[${surfaceIndex}]`)
      )
    ),
    structures: Object.freeze(
      readArray(semanticWorld.structures ?? [], `${fieldName}.structures`).map(
        (structure, structureIndex) =>
          readSemanticStructure(
            structure,
            `${fieldName}.structures[${structureIndex}]`
          )
      )
    ),
    terrainPatches: Object.freeze(
      [
        ...readArray(
          semanticWorld.terrainPatches ?? [],
          `${fieldName}.terrainPatches`
        ).map((terrainPatch, terrainPatchIndex) =>
          readTerrainPatch(
            terrainPatch,
            `${fieldName}.terrainPatches[${terrainPatchIndex}]`
          )
        ),
        ...readArray(
          semanticWorld.terrainChunks ?? [],
          `${fieldName}.terrainChunks`
        ).map((terrainChunk, terrainChunkIndex) =>
          readLegacyTerrainChunkAsPatch(
            terrainChunk,
            `${fieldName}.terrainChunks[${terrainChunkIndex}]`
          )
        )
      ]
    )
  });
}

function readCompiledCollisionBox(
  value: unknown,
  fieldName: string
): MetaverseMapBundleCompiledCollisionBoxSnapshot {
  const collisionBox = readRecord(value, fieldName);
  const ownerKind = readString(collisionBox.ownerKind, `${fieldName}.ownerKind`);
  const traversalAffordance = readString(
    collisionBox.traversalAffordance,
    `${fieldName}.traversalAffordance`
  );

  if (
    ownerKind !== "connector" &&
    ownerKind !== "edge" &&
    ownerKind !== "module" &&
    ownerKind !== "region" &&
    ownerKind !== "structure"
  ) {
    throw new Error(`Unsupported compiled owner kind for ${fieldName}: ${ownerKind}`);
  }

  if (traversalAffordance !== "blocker" && traversalAffordance !== "support") {
    throw new Error(
      `Unsupported compiled traversal affordance for ${fieldName}: ${traversalAffordance}`
    );
  }

  return Object.freeze({
    center: readVector3(collisionBox.center, `${fieldName}.center`),
    ownerId: readString(collisionBox.ownerId, `${fieldName}.ownerId`),
    ownerKind,
    rotationYRadians: readNumber(
      collisionBox.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    size: readVector3(collisionBox.size, `${fieldName}.size`),
    traversalAffordance
  });
}

function readNumberArray(
  value: unknown,
  fieldName: string
): readonly number[] {
  return Object.freeze(
    readArray(value, fieldName).map((entry, entryIndex) =>
      readNumber(entry, `${fieldName}[${entryIndex}]`)
    )
  );
}

function readCompiledCollisionTriMesh(
  value: unknown,
  fieldName: string
): MetaverseMapBundleCompiledCollisionTriMeshSnapshot {
  const triMesh = readRecord(value, fieldName);
  const ownerKind = readString(triMesh.ownerKind, `${fieldName}.ownerKind`);
  const traversalAffordance = readString(
    triMesh.traversalAffordance,
    `${fieldName}.traversalAffordance`
  );

  if (ownerKind !== "terrain-patch" && ownerKind !== "region") {
    throw new Error(`Unsupported compiled tri mesh owner kind for ${fieldName}: ${ownerKind}`);
  }

  if (traversalAffordance !== "blocker" && traversalAffordance !== "support") {
    throw new Error(
      `Unsupported compiled tri mesh traversal affordance for ${fieldName}: ${traversalAffordance}`
    );
  }

  return Object.freeze({
    indices: readNumberArray(triMesh.indices, `${fieldName}.indices`),
    ownerId: readString(triMesh.ownerId, `${fieldName}.ownerId`),
    ownerKind,
    rotationYRadians: readNumber(
      triMesh.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    translation: readVector3(triMesh.translation, `${fieldName}.translation`),
    traversalAffordance,
    vertices: readNumberArray(triMesh.vertices, `${fieldName}.vertices`)
  });
}

function readCompiledCollisionHeightfield(
  value: unknown,
  fieldName: string
): MetaverseMapBundleCompiledCollisionHeightfieldSnapshot {
  const heightfield = readRecord(value, fieldName);
  const ownerKind = readString(heightfield.ownerKind, `${fieldName}.ownerKind`);
  const traversalAffordance = readString(
    heightfield.traversalAffordance,
    `${fieldName}.traversalAffordance`
  );

  if (ownerKind !== "terrain-patch") {
    throw new Error(
      `Unsupported compiled heightfield owner kind for ${fieldName}: ${ownerKind}`
    );
  }

  if (traversalAffordance !== "support") {
    throw new Error(
      `Unsupported compiled heightfield traversal affordance for ${fieldName}: ${traversalAffordance}`
    );
  }

  return Object.freeze({
    heightSamples: readNumberArray(
      heightfield.heightSamples,
      `${fieldName}.heightSamples`
    ),
    ownerId: readString(heightfield.ownerId, `${fieldName}.ownerId`),
    ownerKind,
    rotationYRadians: readNumber(
      heightfield.rotationYRadians,
      `${fieldName}.rotationYRadians`
    ),
    sampleCountX: readNumber(
      heightfield.sampleCountX,
      `${fieldName}.sampleCountX`
    ),
    sampleCountZ: readNumber(
      heightfield.sampleCountZ,
      `${fieldName}.sampleCountZ`
    ),
    sampleSpacingMeters: readNumber(
      heightfield.sampleSpacingMeters,
      `${fieldName}.sampleSpacingMeters`
    ),
    translation: readVector3(heightfield.translation, `${fieldName}.translation`),
    traversalAffordance
  });
}

function readCompiledWorld(
  value: unknown,
  fieldName: string
): MetaverseMapBundleCompiledWorldSnapshot {
  const compiledWorld = readRecord(value, fieldName);

  return Object.freeze({
    chunkSizeMeters: readNumber(
      compiledWorld.chunkSizeMeters,
      `${fieldName}.chunkSizeMeters`
    ),
    chunks: Object.freeze(
      readArray(compiledWorld.chunks ?? [], `${fieldName}.chunks`).map(
        (chunk, chunkIndex) => {
          const chunkRecord = readRecord(chunk, `${fieldName}.chunks[${chunkIndex}]`);
          const collision = readRecord(
            chunkRecord.collision,
            `${fieldName}.chunks[${chunkIndex}].collision`
          );
          const navigation = readRecord(
            chunkRecord.navigation,
            `${fieldName}.chunks[${chunkIndex}].navigation`
          );
          const render = readRecord(
            chunkRecord.render,
            `${fieldName}.chunks[${chunkIndex}].render`
          );

          return Object.freeze({
            bounds: Object.freeze({
              center: readVector3(
                readRecord(
                  chunkRecord.bounds,
                  `${fieldName}.chunks[${chunkIndex}].bounds`
                ).center,
                `${fieldName}.chunks[${chunkIndex}].bounds.center`
              ),
              size: readVector3(
                readRecord(
                  chunkRecord.bounds,
                  `${fieldName}.chunks[${chunkIndex}].bounds`
                ).size,
                `${fieldName}.chunks[${chunkIndex}].bounds.size`
              )
            }),
            chunkId: readString(
              chunkRecord.chunkId,
              `${fieldName}.chunks[${chunkIndex}].chunkId`
            ),
            collision: Object.freeze({
              boxes: Object.freeze(
                readArray(collision.boxes ?? [], `${fieldName}.chunks[${chunkIndex}].collision.boxes`).map(
                  (box, boxIndex) =>
                    readCompiledCollisionBox(
                      box,
                      `${fieldName}.chunks[${chunkIndex}].collision.boxes[${boxIndex}]`
                  )
                )
              ),
              heightfields: Object.freeze(
                readArray(
                  collision.heightfields ?? [],
                  `${fieldName}.chunks[${chunkIndex}].collision.heightfields`
                ).map((heightfield, heightfieldIndex) =>
                  readCompiledCollisionHeightfield(
                    heightfield,
                    `${fieldName}.chunks[${chunkIndex}].collision.heightfields[${heightfieldIndex}]`
                  )
                )
              ),
              triMeshes: Object.freeze(
                readArray(
                  collision.triMeshes ?? [],
                  `${fieldName}.chunks[${chunkIndex}].collision.triMeshes`
                ).map((triMesh, triMeshIndex) =>
                  readCompiledCollisionTriMesh(
                    triMesh,
                    `${fieldName}.chunks[${chunkIndex}].collision.triMeshes[${triMeshIndex}]`
                  )
                )
              )
            }),
            navigation: Object.freeze({
              connectorIds: Object.freeze(
                readArray(
                  navigation.connectorIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].navigation.connectorIds`
                ).map((connectorId, connectorIndex) =>
                  readString(
                    connectorId,
                    `${fieldName}.chunks[${chunkIndex}].navigation.connectorIds[${connectorIndex}]`
                  )
                )
              ),
              gameplayVolumeIds: Object.freeze(
                readArray(
                  navigation.gameplayVolumeIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].navigation.gameplayVolumeIds`
                ).map((volumeId, volumeIndex) =>
                  readString(
                    volumeId,
                    `${fieldName}.chunks[${chunkIndex}].navigation.gameplayVolumeIds[${volumeIndex}]`
                  )
                )
              ),
              regionIds: Object.freeze(
                readArray(
                  navigation.regionIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].navigation.regionIds`
                ).map((regionId, regionIndex) =>
                  readString(
                    regionId,
                    `${fieldName}.chunks[${chunkIndex}].navigation.regionIds[${regionIndex}]`
                  )
                )
              ),
              surfaceIds: Object.freeze(
                readArray(
                  navigation.surfaceIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].navigation.surfaceIds`
                ).map((surfaceId, surfaceIndex) =>
                  readString(
                    surfaceId,
                    `${fieldName}.chunks[${chunkIndex}].navigation.surfaceIds[${surfaceIndex}]`
                  )
                )
              )
            }),
            render: Object.freeze({
              edgeIds: Object.freeze(
                readArray(
                  render.edgeIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.edgeIds`
                ).map((edgeId, edgeIndex) =>
                  readString(
                    edgeId,
                    `${fieldName}.chunks[${chunkIndex}].render.edgeIds[${edgeIndex}]`
                  )
                )
              ),
              instancedModuleAssetIds: Object.freeze(
                readArray(
                  render.instancedModuleAssetIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.instancedModuleAssetIds`
                ).map((assetId, assetIndex) =>
                  readString(
                    assetId,
                    `${fieldName}.chunks[${chunkIndex}].render.instancedModuleAssetIds[${assetIndex}]`
                  )
                )
              ),
              lightIds: Object.freeze(
                readArray(
                  render.lightIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.lightIds`
                ).map((lightId, lightIndex) =>
                  readString(
                    lightId,
                    `${fieldName}.chunks[${chunkIndex}].render.lightIds[${lightIndex}]`
                  )
                )
              ),
              regionIds: Object.freeze(
                readArray(
                  render.regionIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.regionIds`
                ).map((regionId, regionIndex) =>
                  readString(
                    regionId,
                    `${fieldName}.chunks[${chunkIndex}].render.regionIds[${regionIndex}]`
                  )
                )
              ),
              structureIds: Object.freeze(
                readArray(
                  render.structureIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.structureIds`
                ).map((structureId, structureIndex) =>
                  readString(
                    structureId,
                    `${fieldName}.chunks[${chunkIndex}].render.structureIds[${structureIndex}]`
                  )
                )
              ),
              terrainPatchIds: Object.freeze(
                readArray(
                  render.terrainPatchIds ?? render.terrainChunkIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.terrainPatchIds`
                ).map((terrainPatchId, terrainPatchIndex) =>
                  readString(
                    terrainPatchId,
                    `${fieldName}.chunks[${chunkIndex}].render.terrainPatchIds[${terrainPatchIndex}]`
                  )
                )
              ),
              transparentEntityIds: Object.freeze(
                readArray(
                  render.transparentEntityIds ?? [],
                  `${fieldName}.chunks[${chunkIndex}].render.transparentEntityIds`
                ).map((entityId, entityIndex) =>
                  readString(
                    entityId,
                    `${fieldName}.chunks[${chunkIndex}].render.transparentEntityIds[${entityIndex}]`
                  )
                )
              )
            })
          });
        }
      )
    ),
    compatibilityEnvironmentAssets: Object.freeze(
      readArray(
        compiledWorld.compatibilityEnvironmentAssets ?? [],
        `${fieldName}.compatibilityEnvironmentAssets`
      ).map((environmentAsset, environmentAssetIndex) =>
        readEnvironmentAsset(
          environmentAsset,
          `${fieldName}.compatibilityEnvironmentAssets[${environmentAssetIndex}]`
        )
      )
    )
  });
}

function createEmptySemanticWorld(): MetaverseMapBundleSemanticWorldSnapshot {
  return Object.freeze({
    compatibilityAssetIds: Object.freeze({
      connectorAssetId: null,
      floorAssetId: null,
      wallAssetId: null
    }),
    connectors: Object.freeze([]),
    edges: Object.freeze([]),
    gameplayVolumes: Object.freeze([]),
    lights: Object.freeze([]),
    materialDefinitions: Object.freeze([]),
    modules: Object.freeze([]),
    regions: Object.freeze([]),
    surfaces: Object.freeze([]),
    structures: Object.freeze([]),
    terrainPatches: Object.freeze([])
  });
}

export function parseMetaverseMapBundleSnapshot(
  value: unknown
): MetaverseMapBundleSnapshot {
  const bundle = readRecord(value, "bundle");
  const environmentAssets = Object.freeze(
    readArray(bundle.environmentAssets ?? [], "bundle.environmentAssets").map(
      (environmentAsset, environmentAssetIndex) =>
        readEnvironmentAsset(
          environmentAsset,
          `bundle.environmentAssets[${environmentAssetIndex}]`
        )
    )
  );
  const semanticWorld =
    bundle.semanticWorld === undefined || bundle.semanticWorld === null
      ? createEmptySemanticWorld()
      : readSemanticWorld(bundle.semanticWorld, "bundle.semanticWorld");
  const shouldCompileSemanticWorld =
    semanticWorld.modules.length > 0 ||
    semanticWorld.regions.length > 0 ||
    semanticWorld.edges.length > 0 ||
    semanticWorld.connectors.length > 0 ||
    semanticWorld.structures.length > 0 ||
    semanticWorld.gameplayVolumes.length > 0 ||
    semanticWorld.lights.length > 0 ||
    semanticWorld.terrainPatches.length > 0;
  const compiledWorld =
    shouldCompileSemanticWorld
      ? compileMetaverseMapBundleSemanticWorld(semanticWorld)
      : bundle.compiledWorld === undefined || bundle.compiledWorld === null
        ? createDefaultMetaverseMapBundleCompiledWorld(environmentAssets)
      : readCompiledWorld(bundle.compiledWorld, "bundle.compiledWorld");
  const resolvedEnvironmentAssets =
    compiledWorld.compatibilityEnvironmentAssets.length > 0
      ? compiledWorld.compatibilityEnvironmentAssets
      : environmentAssets;
  const resourceSpawns = Object.freeze(
    readArray(bundle.resourceSpawns, "bundle.resourceSpawns").map(
      (resourceSpawn, resourceSpawnIndex) =>
        readResourceSpawn(
          resourceSpawn,
          `bundle.resourceSpawns[${resourceSpawnIndex}]`
        )
    )
  );
  const resourceSpawnIds = new Set<string>();

  for (const resourceSpawn of resourceSpawns) {
    if (resourceSpawnIds.has(resourceSpawn.spawnId)) {
      throw new Error(
        `Metaverse map bundle resource spawn ids must be unique: ${resourceSpawn.spawnId}`
      );
    }

    resourceSpawnIds.add(resourceSpawn.spawnId);
  }

  return Object.freeze({
    compiledWorld,
    description: readString(bundle.description, "bundle.description"),
    environmentAssets: resolvedEnvironmentAssets,
    environmentPresentation:
      bundle.environmentPresentation === undefined ||
      bundle.environmentPresentation === null
        ? null
        : readEnvironmentPresentation(
            bundle.environmentPresentation,
            "bundle.environmentPresentation"
          ),
    gameplayProfileId: readGameplayProfileId(
      bundle.gameplayProfileId,
      "bundle.gameplayProfileId"
    ),
    label: readString(bundle.label, "bundle.label"),
    launchVariations: Object.freeze(
      readArray(bundle.launchVariations, "bundle.launchVariations").map(
        (launchVariation, launchVariationIndex) =>
          readLaunchVariation(
            launchVariation,
            `bundle.launchVariations[${launchVariationIndex}]`
          )
      )
    ),
    mapId: readString(bundle.mapId, "bundle.mapId"),
    playerSpawnNodes: Object.freeze(
      readArray(bundle.playerSpawnNodes, "bundle.playerSpawnNodes").map(
        (spawnNode, spawnNodeIndex) =>
          readSpawnNode(
            spawnNode,
            `bundle.playerSpawnNodes[${spawnNodeIndex}]`
        )
      )
    ),
    playerSpawnSelection: readPlayerSpawnSelection(
      bundle.playerSpawnSelection,
      "bundle.playerSpawnSelection"
    ),
    presentationProfileIds: readPresentationProfileIds(
      bundle.presentationProfileIds,
      "bundle.presentationProfileIds"
    ),
    resourceSpawns,
    sceneObjects: Object.freeze(
      readArray(bundle.sceneObjects, "bundle.sceneObjects").map(
        (sceneObject, sceneObjectIndex) =>
          readSceneObject(
            sceneObject,
            `bundle.sceneObjects[${sceneObjectIndex}]`
        )
      )
    ),
    semanticWorld,
    waterRegions: Object.freeze(
      readArray(bundle.waterRegions, "bundle.waterRegions").map(
        (waterRegion, waterRegionIndex) =>
          readWaterRegion(
            waterRegion,
            `bundle.waterRegions[${waterRegionIndex}]`
          )
      )
    )
  });
}
