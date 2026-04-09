import type {
  CoopBirdBehaviorState,
  CoopBirdId,
  CoopFireShotCommand,
  CoopJoinRoomCommand,
  CoopKickPlayerCommand,
  CoopLeaveRoomCommand,
  CoopPlayerId,
  CoopPlayerShotOutcomeState,
  CoopRoomClientCommand,
  CoopRoomServerEvent,
  CoopRoomSnapshot,
  CoopStartSessionCommand,
  CoopSyncPlayerPresenceCommand,
  CoopVector3Snapshot,
  Username
} from "@thumbshooter/shared";
import {
  createCoopRoomSnapshot,
  createCoopRoomSnapshotEvent
} from "@thumbshooter/shared";

import { coopRoomRuntimeConfig } from "../config/coop-room-runtime.js";
import type {
  CoopRoomBirdSeed,
  CoopRoomRuntimeConfig
} from "../types/coop-room-runtime.js";

interface PendingShotCommand {
  readonly aimDirection: CoopVector3Snapshot;
  readonly clientShotSequence: number;
  readonly origin: CoopVector3Snapshot;
  readonly playerId: CoopPlayerId;
}

interface CoopBirdRuntimeState {
  readonly birdId: CoopBirdId;
  readonly downedScale: number;
  readonly glideScale: number;
  readonly homeAltitudeVelocity: number;
  readonly homeAngularVelocity: number;
  readonly label: string;
  readonly orbitRadius: number;
  readonly radius: number;
  readonly scatterScale: number;
  readonly wingSpeed: number;
  altitude: number;
  altitudeVelocity: number;
  angularVelocity: number;
  azimuthRadians: number;
  behavior: CoopBirdBehaviorState;
  behaviorRemainingMs: number;
  downedVelocityX: number;
  downedVelocityY: number;
  downedVelocityZ: number;
  headingRadians: number;
  lastInteractionByPlayerId: CoopPlayerId | null;
  lastInteractionTick: number | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
  visible: boolean;
  wingPhase: number;
}

interface CoopRoundMovementConfig {
  readonly downedDriftSpeed: number;
  readonly downedDurationMs: number;
  readonly downedFallSpeed: number;
  readonly scatterAltitudeSpeed: number;
  readonly scatterAngularSpeed: number;
  readonly scatterDurationMs: number;
}

interface CoopRoundPlan {
  readonly birdSeeds: readonly CoopRoomBirdSeed[];
  readonly movement: CoopRoundMovementConfig;
  readonly passBirdCount: number;
  readonly reticleScatterRadius: number;
  readonly roundDurationMs: number;
  readonly shotScatterRadius: number;
}

interface CoopPlayerRuntimeState {
  readonly playerId: CoopPlayerId;
  connected: boolean;
  hitsLanded: number;
  lastAcknowledgedShotSequence: number;
  lastHitBirdId: CoopBirdId | null;
  lastOutcome: CoopPlayerShotOutcomeState | null;
  lastPresenceTick: number | null;
  lastPresenceSequence: number;
  lastQueuedShotSequence: number;
  lastSeenAtMs: number;
  lastShotTick: number | null;
  pitchRadians: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  ready: boolean;
  scatterEventsCaused: number;
  shotsFired: number;
  username: Username;
  weaponId: string;
  yawRadians: number;
  aimDirectionX: number;
  aimDirectionY: number;
  aimDirectionZ: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeNowMs(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.max(0, rawValue);
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function createWorldPositionFromOrbit(
  azimuthRadians: number,
  altitude: number,
  orbitRadius: number
): CoopVector3Snapshot {
  return Object.freeze({
    x: Math.sin(azimuthRadians) * orbitRadius,
    y: altitude,
    z: -Math.cos(azimuthRadians) * orbitRadius
  });
}

function computeFlightHeadingRadians(
  angularVelocity: number,
  altitudeVelocity: number,
  orbitRadius: number
): number {
  return Math.atan2(altitudeVelocity, angularVelocity * orbitRadius);
}

function syncBirdWorldPosition(birdState: CoopBirdRuntimeState): void {
  const worldPosition = createWorldPositionFromOrbit(
    birdState.azimuthRadians,
    birdState.altitude,
    birdState.orbitRadius
  );

  birdState.positionX = worldPosition.x;
  birdState.positionY = worldPosition.y;
  birdState.positionZ = worldPosition.z;
  birdState.headingRadians = computeFlightHeadingRadians(
    birdState.angularVelocity,
    birdState.altitudeVelocity,
    birdState.orbitRadius
  );
}

function createBirdRuntimeState(seed: CoopRoomBirdSeed): CoopBirdRuntimeState {
  const worldPosition = createWorldPositionFromOrbit(
    seed.spawn.azimuthRadians,
    seed.spawn.altitude,
    seed.orbitRadius
  );

  return {
    altitude: seed.spawn.altitude,
    altitudeVelocity: seed.glideVelocity.altitudeUnitsPerSecond,
    angularVelocity: seed.glideVelocity.azimuthRadiansPerSecond,
    azimuthRadians: seed.spawn.azimuthRadians,
    behavior: "glide",
    behaviorRemainingMs: 0,
    birdId: seed.birdId,
    downedScale: seed.scale * 0.82,
    downedVelocityX: 0,
    downedVelocityY: 0,
    downedVelocityZ: 0,
    glideScale: seed.scale,
    headingRadians: computeFlightHeadingRadians(
      seed.glideVelocity.azimuthRadiansPerSecond,
      seed.glideVelocity.altitudeUnitsPerSecond,
      seed.orbitRadius
    ),
    homeAltitudeVelocity: seed.glideVelocity.altitudeUnitsPerSecond,
    homeAngularVelocity: seed.glideVelocity.azimuthRadiansPerSecond,
    label: seed.label,
    lastInteractionByPlayerId: null,
    lastInteractionTick: null,
    orbitRadius: seed.orbitRadius,
    positionX: worldPosition.x,
    positionY: worldPosition.y,
    positionZ: worldPosition.z,
    radius: seed.radius,
    scale: seed.scale,
    scatterScale: seed.scale * 1.08,
    visible: true,
    wingPhase: 0,
    wingSpeed: seed.wingSpeed
  };
}

function resolveRoundBirdCount(
  roundNumber: number,
  config: CoopRoomRuntimeConfig
): number {
  const roundIndex = Math.max(0, Math.floor(roundNumber) - 1);
  const requestedBirdCount =
    config.rounds.initialBirdCount +
    roundIndex * config.rounds.birdCountIncreasePerRound;

  return Math.max(1, Math.min(config.birds.length, Math.floor(requestedBirdCount)));
}

function resolveRoundDurationMs(
  roundNumber: number,
  config: CoopRoomRuntimeConfig
): number {
  const roundIndex = Math.max(0, Math.floor(roundNumber) - 1);
  const durationReductionMs =
    roundIndex * Number(config.rounds.durationLossPerRoundMs);

  return Math.max(
    Number(config.rounds.minimumDurationMs),
    Number(config.rounds.initialDurationMs) - durationReductionMs
  );
}

function scaleFiniteValue(rawValue: number, scale: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return rawValue * scale;
}

function createRoundBirdSeed(
  seed: CoopRoomBirdSeed,
  birdSpeedScale: number
): CoopRoomBirdSeed {
  return {
    ...seed,
    glideVelocity: {
      altitudeUnitsPerSecond: scaleFiniteValue(
        seed.glideVelocity.altitudeUnitsPerSecond,
        birdSpeedScale
      ),
      azimuthRadiansPerSecond: scaleFiniteValue(
        seed.glideVelocity.azimuthRadiansPerSecond,
        birdSpeedScale
      )
    },
    wingSpeed: scaleFiniteValue(seed.wingSpeed, birdSpeedScale)
  };
}

function resolveRoundPlan(
  roundNumber: number,
  config: CoopRoomRuntimeConfig
): CoopRoundPlan {
  const roundIndex = Math.max(0, Math.floor(roundNumber) - 1);
  const birdSpeedScale = Math.max(
    0.1,
    1 + roundIndex * config.rounds.birdSpeedScalePerRound
  );
  const behaviorScale = Math.max(
    0.1,
    1 + roundIndex * config.rounds.behaviorSpeedScalePerRound
  );
  const tickIntervalMs = Math.max(1, Number(config.tickIntervalMs));
  const passBirdCount = resolveRoundBirdCount(roundNumber, config);
  const birdSeeds = config.birds
    .slice(0, passBirdCount)
    .map((seed) => createRoundBirdSeed(seed, birdSpeedScale));

  return {
    birdSeeds: Object.freeze(birdSeeds),
    movement: Object.freeze({
      downedDriftSpeed: config.movement.downedDriftSpeed * behaviorScale,
      downedDurationMs: Math.max(
        tickIntervalMs,
        Number(config.movement.downedDurationMs) / behaviorScale
      ),
      downedFallSpeed: config.movement.downedFallSpeed * behaviorScale,
      scatterAltitudeSpeed: config.movement.scatterAltitudeSpeed * behaviorScale,
      scatterAngularSpeed: config.movement.scatterAngularSpeed * behaviorScale,
      scatterDurationMs: Math.max(
        tickIntervalMs,
        Number(config.movement.scatterDurationMs) / behaviorScale
      )
    }),
    passBirdCount,
    reticleScatterRadius: config.reticleScatterRadius,
    roundDurationMs: resolveRoundDurationMs(roundNumber, config),
    shotScatterRadius: config.scatterRadius
  };
}

function restoreBirdGlideState(birdState: CoopBirdRuntimeState): void {
  birdState.behavior = "glide";
  birdState.behaviorRemainingMs = 0;
  birdState.angularVelocity = birdState.homeAngularVelocity;
  birdState.altitudeVelocity = birdState.homeAltitudeVelocity;
  birdState.scale = birdState.glideScale;
  syncBirdWorldPosition(birdState);
}

function settleBirdDownedState(birdState: CoopBirdRuntimeState): void {
  birdState.behaviorRemainingMs = 0;
  birdState.downedVelocityX = 0;
  birdState.downedVelocityY = 0;
  birdState.downedVelocityZ = 0;
}

function setBirdDowned(
  birdState: CoopBirdRuntimeState,
  playerId: CoopPlayerId,
  tick: number,
  movement: CoopRoundMovementConfig
): void {
  const tangentialVelocityX =
    Math.cos(birdState.azimuthRadians) *
    birdState.orbitRadius *
    birdState.angularVelocity;
  const tangentialVelocityZ =
    Math.sin(birdState.azimuthRadians) *
    birdState.orbitRadius *
    birdState.angularVelocity;
  const tangentialMagnitude = Math.hypot(
    tangentialVelocityX,
    tangentialVelocityZ
  );
  const driftScale =
    tangentialMagnitude <= 0.0001
      ? 0
      : movement.downedDriftSpeed / tangentialMagnitude;

  birdState.behavior = "downed";
  birdState.behaviorRemainingMs = movement.downedDurationMs;
  birdState.downedVelocityX = tangentialVelocityX * driftScale;
  birdState.downedVelocityY = -movement.downedFallSpeed;
  birdState.downedVelocityZ = tangentialVelocityZ * driftScale;
  birdState.scale = birdState.downedScale;
  birdState.lastInteractionByPlayerId = playerId;
  birdState.lastInteractionTick = tick;
}

function resolveScatterDirection(value: number, fallback: number): number {
  if (Math.abs(value) > 0.0001) {
    return Math.sign(value);
  }

  if (Math.abs(fallback) > 0.0001) {
    return Math.sign(fallback);
  }

  return 1;
}

function setBirdScatter(
  birdState: CoopBirdRuntimeState,
  playerId: CoopPlayerId,
  tick: number,
  shotAzimuthRadians: number,
  targetAltitude: number,
  movement: CoopRoundMovementConfig
): void {
  const azimuthDelta = wrapRadians(birdState.azimuthRadians - shotAzimuthRadians);
  const altitudeDelta = birdState.altitude - targetAltitude;

  birdState.behavior = "scatter";
  birdState.behaviorRemainingMs = movement.scatterDurationMs;
  birdState.angularVelocity =
    resolveScatterDirection(azimuthDelta, birdState.homeAngularVelocity) *
    movement.scatterAngularSpeed;
  birdState.altitudeVelocity =
    resolveScatterDirection(altitudeDelta, birdState.homeAltitudeVelocity) *
    movement.scatterAltitudeSpeed;
  birdState.scale = birdState.scatterScale;
  birdState.lastInteractionByPlayerId = playerId;
  birdState.lastInteractionTick = tick;
  syncBirdWorldPosition(birdState);
}

function createDistanceSquaredFromRay(
  origin: CoopVector3Snapshot,
  direction: CoopVector3Snapshot,
  pointX: number,
  pointY: number,
  pointZ: number
): {
  readonly distanceSquared: number;
  readonly rayDistance: number;
} {
  const offsetX = pointX - origin.x;
  const offsetY = pointY - origin.y;
  const offsetZ = pointZ - origin.z;
  const rayDistance = offsetX * direction.x + offsetY * direction.y + offsetZ * direction.z;

  if (rayDistance <= 0) {
    return {
      distanceSquared: Number.POSITIVE_INFINITY,
      rayDistance
    };
  }

  const nearestX = origin.x + direction.x * rayDistance;
  const nearestY = origin.y + direction.y * rayDistance;
  const nearestZ = origin.z + direction.z * rayDistance;
  const deltaX = pointX - nearestX;
  const deltaY = pointY - nearestY;
  const deltaZ = pointZ - nearestZ;

  return {
    distanceSquared: deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ,
    rayDistance
  };
}

function findNearestLiveBird(
  birdStates: readonly CoopBirdRuntimeState[],
  origin: CoopVector3Snapshot,
  direction: CoopVector3Snapshot,
  extraRadius: number
): CoopBirdRuntimeState | null {
  let nearestBird: CoopBirdRuntimeState | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const birdState of birdStates) {
    if (birdState.behavior === "downed") {
      continue;
    }

    const thresholdRadius = birdState.radius + extraRadius;
    const distanceToRay = createDistanceSquaredFromRay(
      origin,
      direction,
      birdState.positionX,
      birdState.positionY,
      birdState.positionZ
    );

    if (
      distanceToRay.distanceSquared > thresholdRadius * thresholdRadius ||
      distanceToRay.distanceSquared >= nearestDistanceSquared
    ) {
      continue;
    }

    nearestBird = birdState;
    nearestDistanceSquared = distanceToRay.distanceSquared;
  }

  return nearestBird;
}

function scatterBirdsNearShot(
  birdStates: readonly CoopBirdRuntimeState[],
  origin: CoopVector3Snapshot,
  direction: CoopVector3Snapshot,
  playerId: CoopPlayerId,
  tick: number,
  roundPlan: CoopRoundPlan,
  scatterRadius: number = roundPlan.shotScatterRadius,
  allowScatterRefresh = true
): number {
  let scatteredBirdCount = 0;
  const shotAzimuthRadians = Math.atan2(direction.x, -direction.z);

  for (const birdState of birdStates) {
    if (
      birdState.behavior === "downed" ||
      (!allowScatterRefresh && birdState.behavior === "scatter")
    ) {
      continue;
    }

    const thresholdRadius = birdState.radius + scatterRadius;
    const distanceToRay = createDistanceSquaredFromRay(
      origin,
      direction,
      birdState.positionX,
      birdState.positionY,
      birdState.positionZ
    );

    if (distanceToRay.distanceSquared > thresholdRadius * thresholdRadius) {
      continue;
    }

    const targetAltitude = origin.y + direction.y * Math.max(distanceToRay.rayDistance, 0);

    setBirdScatter(
      birdState,
      playerId,
      tick,
      shotAzimuthRadians,
      targetAltitude,
      roundPlan.movement
    );
    scatteredBirdCount += 1;
  }

  return scatteredBirdCount;
}

export class CoopRoomRuntime {
  readonly #birdStates: CoopBirdRuntimeState[];
  readonly #config: CoopRoomRuntimeConfig;
  readonly #pendingShots: PendingShotCommand[] = [];
  readonly #playerStates = new Map<CoopPlayerId, CoopPlayerRuntimeState>();
  #roundPlan: CoopRoundPlan;

  #lastAdvancedAtMs: number | null = null;
  #leaderPlayerId: CoopPlayerId | null = null;
  #phase: CoopRoomSnapshot["session"]["phase"] = "waiting-for-players";
  #roundDurationMs = 0;
  #roundNumber = 1;
  #roundPhase: CoopRoomSnapshot["session"]["roundPhase"] = "combat";
  #roundPhaseRemainingMs = 0;
  #snapshot: CoopRoomSnapshot;
  #teamHitsLanded = 0;
  #teamShotsFired = 0;
  #tick = 0;

  constructor(config: CoopRoomRuntimeConfig = coopRoomRuntimeConfig) {
    this.#config = config;
    this.#roundPlan = resolveRoundPlan(1, config);
    this.#birdStates = this.#roundPlan.birdSeeds.map((seed) =>
      createBirdRuntimeState(seed)
    );
    this.#roundDurationMs = this.#roundPlan.roundDurationMs;
    this.#roundPhaseRemainingMs = this.#roundDurationMs;
    this.#snapshot = this.#buildSnapshot();
  }

  get roomId(): CoopRoomRuntimeConfig["roomId"] {
    return this.#config.roomId;
  }

  get snapshot(): CoopRoomSnapshot {
    return this.#snapshot;
  }

  markPlayerSeen(playerId: CoopPlayerId, nowMs: number = Date.now()): void {
    this.#touchPlayer(playerId, nowMs);
  }

  advanceTo(nowMs: number): CoopRoomSnapshot {
    const safeNowMs = normalizeNowMs(nowMs);

    this.#pruneStalePlayers(safeNowMs);

    if (this.#lastAdvancedAtMs === null) {
      this.#lastAdvancedAtMs = safeNowMs;
      this.#snapshot = this.#buildSnapshot();
      return this.#snapshot;
    }

    while (this.#lastAdvancedAtMs + this.#config.tickIntervalMs <= safeNowMs) {
      this.#lastAdvancedAtMs += this.#config.tickIntervalMs;
      this.#advanceOneTick();
    }

    this.#snapshot = this.#buildSnapshot();

    return this.#snapshot;
  }

  acceptCommand(
    command: CoopRoomClientCommand,
    nowMs: number = Date.now()
  ): CoopRoomServerEvent {
    this.#assertRoom(command.roomId);

    if (command.type !== "join-room") {
      this.#touchPlayer(command.playerId, nowMs);
    }

    this.advanceTo(nowMs);

    switch (command.type) {
      case "join-room":
        this.#upsertPlayer(command, nowMs);
        break;
      case "set-player-ready":
        this.#setPlayerReady(command);
        break;
      case "start-session":
        this.#startSession(command);
        break;
      case "kick-player":
        this.#kickPlayer(command);
        break;
      case "leave-room":
        this.#leavePlayer(command);
        break;
      case "fire-shot":
        this.#queueShot(command);
        break;
      case "sync-player-presence":
        this.#syncPlayerPresence(command);
        break;
    }

    this.#snapshot = this.#buildSnapshot();

    return createCoopRoomSnapshotEvent(this.#snapshot);
  }

  #assertRoom(roomId: CoopRoomRuntimeConfig["roomId"]): void {
    if (roomId !== this.#config.roomId) {
      throw new Error(`Unknown co-op room: ${roomId}`);
    }
  }

  #upsertPlayer(command: CoopJoinRoomCommand, nowMs: number): void {
    const safeNowMs = normalizeNowMs(nowMs);
    const existingPlayer = this.#playerStates.get(command.playerId);

    if (existingPlayer !== undefined) {
      existingPlayer.connected = true;
      if (this.#phase === "waiting-for-players") {
        existingPlayer.ready = command.ready;
      }
      existingPlayer.lastSeenAtMs = safeNowMs;
      existingPlayer.username = command.username;
      return;
    }

    if (this.#playerStates.size >= this.#config.capacity) {
      throw new Error(`Co-op room ${this.#config.roomId} is full.`);
    }

    this.#playerStates.set(command.playerId, {
      aimDirectionX: 0,
      aimDirectionY: 0,
      aimDirectionZ: -1,
      connected: true,
      hitsLanded: 0,
      lastAcknowledgedShotSequence: 0,
      lastHitBirdId: null,
      lastOutcome: null,
      lastPresenceSequence: 0,
      lastPresenceTick: null,
      lastQueuedShotSequence: 0,
      lastSeenAtMs: safeNowMs,
      lastShotTick: null,
      pitchRadians: 0,
      playerId: command.playerId,
      positionX: this.#config.playerSpawnPosition.x,
      positionY: this.#config.playerSpawnPosition.y,
      positionZ: this.#config.playerSpawnPosition.z,
      ready: command.ready,
      scatterEventsCaused: 0,
      shotsFired: 0,
      username: command.username,
      weaponId: "semiautomatic-pistol",
      yawRadians: 0
    });

    if (this.#leaderPlayerId === null) {
      this.#leaderPlayerId = command.playerId;
    }
  }

  #setPlayerReady(
    command: Extract<CoopRoomClientCommand, { type: "set-player-ready" }>
  ): void {
    if (this.#phase !== "waiting-for-players") {
      throw new Error(
        "Co-op readiness can only change before the leader starts the session."
      );
    }

    const playerState = this.#playerStates.get(command.playerId);

    if (playerState === undefined) {
      throw new Error(`Unknown co-op player: ${command.playerId}`);
    }

    playerState.ready = command.ready;
  }

  #startSession(command: CoopStartSessionCommand): void {
    const playerState = this.#playerStates.get(command.playerId);

    if (playerState === undefined || !playerState.connected) {
      throw new Error(`Unknown co-op player: ${command.playerId}`);
    }

    if (this.#phase !== "waiting-for-players") {
      throw new Error("Co-op session is already active.");
    }

    if (this.#leaderPlayerId !== command.playerId) {
      throw new Error("Only the party leader can start the co-op session.");
    }

    if (!this.#canLeaderStartSession()) {
      throw new Error(
        `Need at least ${this.#config.requiredReadyPlayerCount} connected ready players, and every connected lobby player must be ready, before starting the co-op session.`
      );
    }

    this.#phase = "active";
    this.#startRound(1);
  }

  #kickPlayer(command: CoopKickPlayerCommand): void {
    if (this.#phase !== "waiting-for-players") {
      throw new Error("Players can only be removed while the co-op room is in the lobby.");
    }

    if (this.#leaderPlayerId !== command.playerId) {
      throw new Error("Only the party leader can remove players from the co-op room.");
    }

    if (command.playerId === command.targetPlayerId) {
      throw new Error("The party leader cannot remove themselves from the co-op room.");
    }

    if (!this.#playerStates.has(command.targetPlayerId)) {
      throw new Error(`Unknown co-op player: ${command.targetPlayerId}`);
    }

    this.#removePlayer(command.targetPlayerId);
  }

  #leavePlayer(command: CoopLeaveRoomCommand): void {
    const playerState = this.#playerStates.get(command.playerId);

    if (playerState === undefined) {
      return;
    }

    this.#removePlayer(command.playerId);
  }

  #removePlayer(playerId: CoopPlayerId): void {
    if (!this.#playerStates.has(playerId)) {
      return;
    }

    this.#dropPendingShotsForPlayer(playerId);
    this.#playerStates.delete(playerId);

    if (this.#leaderPlayerId === playerId) {
      this.#leaderPlayerId = this.#resolveNextLeaderPlayerId();
    }
  }

  #queueShot(command: CoopFireShotCommand): void {
    const playerState = this.#playerStates.get(command.playerId);

    if (playerState === undefined) {
      throw new Error(`Unknown co-op player: ${command.playerId}`);
    }

    if (
      this.#phase !== "active" ||
      this.#roundPhase !== "combat" ||
      !playerState.ready ||
      !playerState.connected
    ) {
      return;
    }

    if (
      command.clientShotSequence <= playerState.lastAcknowledgedShotSequence ||
      command.clientShotSequence <= playerState.lastQueuedShotSequence
    ) {
      return;
    }

    playerState.lastQueuedShotSequence = command.clientShotSequence;
    this.#pendingShots.push({
      aimDirection: command.aimDirection,
      clientShotSequence: command.clientShotSequence,
      origin: command.origin,
      playerId: command.playerId
    });
  }

  #syncPlayerPresence(command: CoopSyncPlayerPresenceCommand): void {
    const playerState = this.#playerStates.get(command.playerId);

    if (playerState === undefined) {
      throw new Error(`Unknown co-op player: ${command.playerId}`);
    }

    if (command.stateSequence <= playerState.lastPresenceSequence) {
      return;
    }

    playerState.aimDirectionX = command.aimDirection.x;
    playerState.aimDirectionY = command.aimDirection.y;
    playerState.aimDirectionZ = command.aimDirection.z;
    playerState.lastPresenceSequence = command.stateSequence;
    playerState.lastPresenceTick = this.#tick;
    playerState.pitchRadians = command.pitchRadians;
    playerState.positionX = command.position.x;
    playerState.positionY = command.position.y;
    playerState.positionZ = command.position.z;
    playerState.weaponId = command.weaponId;
    playerState.yawRadians = command.yawRadians;
  }

  #dropPendingShotsForPlayer(playerId: CoopPlayerId): void {
    for (let index = this.#pendingShots.length - 1; index >= 0; index -= 1) {
      if (this.#pendingShots[index]?.playerId === playerId) {
        this.#pendingShots.splice(index, 1);
      }
    }
  }

  #resolveNextLeaderPlayerId(): CoopPlayerId | null {
    for (const playerId of this.#playerStates.keys()) {
      return playerId;
    }

    return null;
  }

  #advanceOneTick(): void {
    this.#tick += 1;

    if (this.#phase !== "active") {
      return;
    }

    if (this.#roundPhase === "combat") {
      this.#processPendingShots();
      this.#scatterBirdsNearTrackedPlayers();
      this.#stepBirds(this.#config.tickIntervalMs);
      this.#roundPhaseRemainingMs = Math.max(
        0,
        this.#roundPhaseRemainingMs - Number(this.#config.tickIntervalMs)
      );

      if (this.#countRemainingBirds() === 0) {
        this.#beginRoundCooldown();
        return;
      }

      if (this.#roundPhaseRemainingMs === 0) {
        this.#failSession();
      }

      return;
    }

    this.#roundPhaseRemainingMs = Math.max(
      0,
      this.#roundPhaseRemainingMs - Number(this.#config.tickIntervalMs)
    );

    if (this.#roundPhaseRemainingMs === 0) {
      this.#startRound(this.#roundNumber + 1);
    }
  }

  #processPendingShots(): void {
    for (const pendingShot of this.#pendingShots.splice(0)) {
      const playerState = this.#playerStates.get(pendingShot.playerId);

      if (playerState === undefined || !playerState.connected) {
        continue;
      }

      if (pendingShot.clientShotSequence <= playerState.lastAcknowledgedShotSequence) {
        continue;
      }

      playerState.shotsFired += 1;
      playerState.lastAcknowledgedShotSequence = pendingShot.clientShotSequence;
      playerState.lastShotTick = this.#tick;
      playerState.lastOutcome = "miss";
      playerState.lastHitBirdId = null;
      this.#teamShotsFired += 1;

      const targetedBird = findNearestLiveBird(
        this.#birdStates,
        pendingShot.origin,
        pendingShot.aimDirection,
        this.#config.hitRadius
      );

      if (targetedBird !== null) {
        setBirdDowned(
          targetedBird,
          pendingShot.playerId,
          this.#tick,
          this.#roundPlan.movement
        );
        playerState.hitsLanded += 1;
        playerState.lastOutcome = "hit";
        playerState.lastHitBirdId = targetedBird.birdId;
        this.#teamHitsLanded += 1;
        continue;
      }

      const scatteredBirdCount = scatterBirdsNearShot(
        this.#birdStates,
        pendingShot.origin,
        pendingShot.aimDirection,
        pendingShot.playerId,
        this.#tick,
        this.#roundPlan
      );

      if (scatteredBirdCount > 0) {
        playerState.lastOutcome = "scatter";
        playerState.scatterEventsCaused += 1;
      }
    }
  }

  #scatterBirdsNearTrackedPlayers(): void {
    for (const playerState of this.#playerStates.values()) {
      if (
        !playerState.connected ||
        !playerState.ready ||
        playerState.lastPresenceTick === null ||
        this.#tick - playerState.lastPresenceTick > 2
      ) {
        continue;
      }

      scatterBirdsNearShot(
        this.#birdStates,
        {
          x: playerState.positionX,
          y: playerState.positionY,
          z: playerState.positionZ
        },
        {
          x: playerState.aimDirectionX,
          y: playerState.aimDirectionY,
          z: playerState.aimDirectionZ
        },
        playerState.playerId,
        this.#tick,
        this.#roundPlan,
        this.#roundPlan.reticleScatterRadius,
        false
      );
    }
  }

  #stepBirds(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    if (deltaSeconds <= 0) {
      return;
    }

    for (const birdState of this.#birdStates) {
      birdState.wingPhase += birdState.wingSpeed * deltaSeconds;

      if (birdState.behavior === "downed") {
        if (birdState.behaviorRemainingMs > 0) {
          birdState.behaviorRemainingMs = Math.max(
            0,
            birdState.behaviorRemainingMs - deltaMs
          );
          birdState.positionX += birdState.downedVelocityX * deltaSeconds;
          birdState.positionY += birdState.downedVelocityY * deltaSeconds;
          birdState.positionZ += birdState.downedVelocityZ * deltaSeconds;
          birdState.headingRadians = wrapRadians(
            birdState.headingRadians + deltaSeconds * 2.8
          );

          if (birdState.behaviorRemainingMs === 0) {
            settleBirdDownedState(birdState);
          }
        }

        continue;
      }

      birdState.azimuthRadians = wrapRadians(
        birdState.azimuthRadians + birdState.angularVelocity * deltaSeconds
      );
      birdState.altitude += birdState.altitudeVelocity * deltaSeconds;

      if (
        birdState.altitude < this.#config.birdAltitudeBounds.min ||
        birdState.altitude > this.#config.birdAltitudeBounds.max
      ) {
        birdState.altitudeVelocity *= -1;
        birdState.altitude = clamp(
          birdState.altitude,
          this.#config.birdAltitudeBounds.min,
          this.#config.birdAltitudeBounds.max
        );
      }

      syncBirdWorldPosition(birdState);

      if (birdState.behavior === "scatter") {
        birdState.behaviorRemainingMs = Math.max(
          0,
          birdState.behaviorRemainingMs - deltaMs
        );

        if (birdState.behaviorRemainingMs === 0) {
          restoreBirdGlideState(birdState);
        }
      }
    }
  }

  #countReadyPlayers(): number {
    let readyPlayerCount = 0;

    for (const playerState of this.#playerStates.values()) {
      if (playerState.connected && playerState.ready) {
        readyPlayerCount += 1;
      }
    }

    return readyPlayerCount;
  }

  #countConnectedPlayers(): number {
    let connectedPlayerCount = 0;

    for (const playerState of this.#playerStates.values()) {
      if (playerState.connected) {
        connectedPlayerCount += 1;
      }
    }

    return connectedPlayerCount;
  }

  #canLeaderStartSession(): boolean {
    const connectedPlayerCount = this.#countConnectedPlayers();
    const readyPlayerCount = this.#countReadyPlayers();

    return (
      connectedPlayerCount >= this.#config.requiredReadyPlayerCount &&
      readyPlayerCount === connectedPlayerCount
    );
  }

  #touchPlayer(playerId: CoopPlayerId, nowMs: number): void {
    const playerState = this.#playerStates.get(playerId);

    if (playerState === undefined) {
      throw new Error(`Unknown co-op player: ${playerId}`);
    }

    playerState.connected = true;
    playerState.lastSeenAtMs = normalizeNowMs(nowMs);
  }

  #pruneStalePlayers(nowMs: number): void {
    const playerTimeoutMs = Number(this.#config.playerInactivityTimeoutMs);

    if (playerTimeoutMs <= 0) {
      return;
    }

    for (const [playerId, playerState] of this.#playerStates.entries()) {
      if (nowMs - playerState.lastSeenAtMs <= playerTimeoutMs) {
        continue;
      }

      this.#removePlayer(playerId);
    }
  }

  #beginRoundCooldown(): void {
    this.#dropAllPendingShots();
    this.#roundPhase = "cooldown";
    this.#roundPhaseRemainingMs = Number(this.#config.rounds.cooldownDurationMs);
  }

  #failSession(): void {
    this.#dropAllPendingShots();
    this.#phase = "failed";
    this.#roundPhaseRemainingMs = 0;
  }

  #startRound(roundNumber: number): void {
    this.#dropAllPendingShots();
    this.#roundPlan = resolveRoundPlan(roundNumber, this.#config);
    this.#roundDurationMs = this.#roundPlan.roundDurationMs;
    this.#roundNumber = Math.max(1, Math.floor(roundNumber));
    this.#phase = "active";
    this.#roundPhase = "combat";
    this.#roundPhaseRemainingMs = this.#roundDurationMs;
    this.#resetBirdsForRound();
  }

  #dropAllPendingShots(): void {
    this.#pendingShots.length = 0;
  }

  #resetBirdsForRound(): void {
    this.#birdStates.splice(
      0,
      this.#birdStates.length,
      ...this.#roundPlan.birdSeeds.map((seed) => createBirdRuntimeState(seed))
    );
  }

  #countRemainingBirds(): number {
    let remainingBirdCount = 0;

    for (const birdState of this.#birdStates) {
      if (birdState.behavior !== "downed") {
        remainingBirdCount += 1;
      }
    }

    return remainingBirdCount;
  }

  #buildSnapshot(): CoopRoomSnapshot {
    const birdsRemaining = this.#countRemainingBirds();
    const birdsCleared = this.#roundPlan.passBirdCount - birdsRemaining;

    return createCoopRoomSnapshot({
      birds: this.#birdStates.map((birdState) => ({
        behavior: birdState.behavior,
        birdId: birdState.birdId,
        headingRadians: birdState.headingRadians,
        label: birdState.label,
        lastInteractionByPlayerId: birdState.lastInteractionByPlayerId,
        lastInteractionTick: birdState.lastInteractionTick,
        position: {
          x: birdState.positionX,
          y: birdState.positionY,
          z: birdState.positionZ
        },
        radius: birdState.radius,
        scale: birdState.scale,
        visible: birdState.visible,
        wingPhase: birdState.wingPhase
      })),
      capacity: this.#config.capacity,
      players: [...this.#playerStates.values()]
        .sort((leftPlayer, rightPlayer) =>
          leftPlayer.playerId.localeCompare(rightPlayer.playerId)
        )
        .map((playerState) => ({
          activity: {
            hitsLanded: playerState.hitsLanded,
            lastAcknowledgedShotSequence: playerState.lastAcknowledgedShotSequence,
            lastHitBirdId: playerState.lastHitBirdId,
            lastOutcome: playerState.lastOutcome,
            lastShotTick: playerState.lastShotTick,
            scatterEventsCaused: playerState.scatterEventsCaused,
            shotsFired: playerState.shotsFired
          },
          connected: playerState.connected,
          playerId: playerState.playerId,
          presence: {
            aimDirection: {
              x: playerState.aimDirectionX,
              y: playerState.aimDirectionY,
              z: playerState.aimDirectionZ
            },
            lastUpdatedTick: playerState.lastPresenceTick,
            pitchRadians: playerState.pitchRadians,
            position: {
              x: playerState.positionX,
              y: playerState.positionY,
              z: playerState.positionZ
            },
            stateSequence: playerState.lastPresenceSequence,
            weaponId: playerState.weaponId,
            yawRadians: playerState.yawRadians
          },
          ready: playerState.ready,
          username: playerState.username
        })),
      roomId: this.#config.roomId,
      session: {
        birdsCleared,
        birdsRemaining,
        leaderPlayerId: this.#leaderPlayerId,
        phase: this.#phase,
        roundDurationMs: this.#roundDurationMs,
        roundNumber: this.#roundNumber,
        roundPhase: this.#roundPhase,
        roundPhaseRemainingMs: this.#roundPhaseRemainingMs,
        requiredReadyPlayerCount: this.#config.requiredReadyPlayerCount,
        sessionId: this.#config.sessionId,
        teamHitsLanded: this.#teamHitsLanded,
        teamShotsFired: this.#teamShotsFired
      },
      tick: {
        currentTick: this.#tick,
        tickIntervalMs: this.#config.tickIntervalMs
      }
    });
  }
}
