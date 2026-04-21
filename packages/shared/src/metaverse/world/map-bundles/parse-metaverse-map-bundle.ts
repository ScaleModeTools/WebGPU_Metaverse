import {
  experienceIds,
  type ExperienceId
} from "../../experience-catalog.js";
import {
  gameplaySessionModes,
  type GameplaySessionMode
} from "../../../experiences/duck-hunt/duck-hunt-room-contract.js";
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

import type {
  MetaverseMapBundleEnvironmentAssetSnapshot,
  MetaverseMapBundleLaunchVariationSnapshot,
  MetaverseMapBundlePlayerSpawnSelectionSnapshot,
  MetaverseMapBundlePlacementSnapshot,
  MetaverseMapBundlePresentationProfileIds,
  MetaverseMapBundleResourceSpawnSnapshot,
  MetaverseMapBundleSceneObjectCapabilitySnapshot,
  MetaverseMapBundleSceneObjectSnapshot,
  MetaverseMapBundleSnapshot,
  MetaverseMapPlayerSpawnTeamId,
  MetaverseMapBundleSpawnNodeSnapshot
} from "./metaverse-map-bundle.js";
import {
  defaultMetaverseMapBundlePlayerSpawnSelection,
  metaverseMapPlayerSpawnTeamIds
} from "./metaverse-map-bundle.js";

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
): GameplaySessionMode | null {
  if (value === null) {
    return null;
  }

  const sessionMode = readString(value, fieldName);

  if (!gameplaySessionModes.includes(sessionMode as GameplaySessionMode)) {
    throw new Error(`Unsupported gameplay session mode for ${fieldName}: ${sessionMode}`);
  }

  return sessionMode as GameplaySessionMode;
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

  return Object.freeze({
    assetId: readNullableString(resourceSpawn.assetId, `${fieldName}.assetId`),
    label: readString(resourceSpawn.label, `${fieldName}.label`),
    modeTags: Object.freeze(
      readArray(resourceSpawn.modeTags, `${fieldName}.modeTags`).map(
        (modeTag, modeTagIndex) =>
          readString(modeTag, `${fieldName}.modeTags[${modeTagIndex}]`)
      )
    ),
    position: readVector3(resourceSpawn.position, `${fieldName}.position`),
    resourceKind: readString(
      resourceSpawn.resourceKind,
      `${fieldName}.resourceKind`
    ),
    respawnCooldownMs:
      resourceSpawn.respawnCooldownMs === null
        ? null
        : readNumber(
            resourceSpawn.respawnCooldownMs,
            `${fieldName}.respawnCooldownMs`
          ),
    spawnId: readString(resourceSpawn.spawnId, `${fieldName}.spawnId`),
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
    sessionMode: readNullableSessionMode(
      launchVariation.sessionMode,
      `${fieldName}.sessionMode`
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

export function parseMetaverseMapBundleSnapshot(
  value: unknown
): MetaverseMapBundleSnapshot {
  const bundle = readRecord(value, "bundle");

  return Object.freeze({
    description: readString(bundle.description, "bundle.description"),
    environmentAssets: Object.freeze(
      readArray(bundle.environmentAssets, "bundle.environmentAssets").map(
        (environmentAsset, environmentAssetIndex) =>
          readEnvironmentAsset(
            environmentAsset,
            `bundle.environmentAssets[${environmentAssetIndex}]`
        )
      )
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
    resourceSpawns: Object.freeze(
      readArray(bundle.resourceSpawns, "bundle.resourceSpawns").map(
        (resourceSpawn, resourceSpawnIndex) =>
          readResourceSpawn(
            resourceSpawn,
            `bundle.resourceSpawns[${resourceSpawnIndex}]`
          )
      )
    ),
    sceneObjects: Object.freeze(
      readArray(bundle.sceneObjects, "bundle.sceneObjects").map(
        (sceneObject, sceneObjectIndex) =>
          readSceneObject(
            sceneObject,
            `bundle.sceneObjects[${sceneObjectIndex}]`
          )
      )
    ),
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
