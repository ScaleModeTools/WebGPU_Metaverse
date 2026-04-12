import {
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaversePresencePlayerSnapshot,
  createMetaversePresencePoseSnapshot,
  createMetaversePresenceRosterEvent,
  createMetaversePresenceRosterSnapshot,
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldSnapshot,
  createMetaverseVehicleId,
  type MetaverseRealtimeWorldClientCommand,
  type MetaverseJoinPresenceCommand,
  type MetaverseLeavePresenceCommand,
  type MetaversePlayerId,
  type MetaversePresenceCommand,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot,
  type MetaverseRealtimeMountedOccupancySnapshotInput,
  type MetaverseRealtimeWorldEvent,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseSyncDriverVehicleControlCommand,
  type MetaverseSyncPresenceCommand
} from "@webgpu-metaverse/shared";

import { metaverseAuthoritativeWorldRuntimeConfig } from "../config/metaverse-authoritative-world-runtime.js";
import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";

interface MetaversePlayerWorldRuntimeState {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly username: MetaversePresencePlayerSnapshot["username"];
  animationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  lastPoseAtMs: number | null;
  lastSeenAtMs: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MetaverseMountedOccupancyRuntimeState | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  stateSequence: number;
  yawRadians: number;
}

interface MetaverseMountedOccupancyRuntimeState {
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>;
}

interface MetaverseVehicleSeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
  occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

interface MetaverseVehicleWorldRuntimeState {
  readonly environmentAssetId: string;
  readonly seatsById: Map<string, MetaverseVehicleSeatRuntimeState>;
  readonly vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>;
  angularVelocityRadiansPerSecond: number;
  forwardSpeedUnitsPerSecond: number;
  lastPoseAtMs: number | null;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  strafeSpeedUnitsPerSecond: number;
  yawRadians: number;
}

interface MetaverseDriverVehicleControlRuntimeState {
  readonly environmentAssetId: string;
  boost: boolean;
  controlSequence: number;
  moveAxis: number;
  strafeAxis: number;
  yawAxis: number;
}

const metaverseAuthoritativeVehicleSurfaceDriveConfig = Object.freeze({
  accelerationCurveExponent: 1.08,
  accelerationUnitsPerSecondSquared: 12,
  baseSpeedUnitsPerSecond: 10.5,
  boostCurveExponent: 1.02,
  boostMultiplier: 1.55,
  decelerationUnitsPerSecondSquared: 14,
  dragCurveExponent: 1.3,
  maxTurnSpeedRadiansPerSecond: 0.95,
  worldRadius: 110
});

function sortPlayerIds(leftPlayerId: MetaversePlayerId, rightPlayerId: MetaversePlayerId): number {
  if (leftPlayerId < rightPlayerId) {
    return -1;
  }

  if (leftPlayerId > rightPlayerId) {
    return 1;
  }

  return 0;
}

function sortVehicleIds(
  leftVehicleId: MetaverseVehicleWorldRuntimeState["vehicleId"],
  rightVehicleId: MetaverseVehicleWorldRuntimeState["vehicleId"]
): number {
  if (leftVehicleId < rightVehicleId) {
    return -1;
  }

  if (leftVehicleId > rightVehicleId) {
    return 1;
  }

  return 0;
}

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, nowMs);
}

function isOlderPresenceUpdate(
  currentStateSequence: number,
  nextPose: MetaversePresencePoseSnapshot
): boolean {
  return nextPose.stateSequence < currentStateSequence;
}

function computeSecondsBetween(
  previousTimeMs: number | null,
  nowMs: number
): number | null {
  if (previousTimeMs === null) {
    return null;
  }

  const deltaSeconds = (nowMs - previousTimeMs) / 1_000;

  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return null;
  }

  return deltaSeconds;
}

function normalizeAngularDeltaRadians(rawValue: number): number {
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

function clampAxis(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.min(1, Math.max(-1, rawValue));
}

function clamp01(rawValue: number): number {
  return Math.min(1, Math.max(0, rawValue));
}

function shapeSignedAxis(value: number, exponent: number): number {
  const sanitizedValue = clampAxis(value);
  const magnitude = Math.pow(
    clamp01(Math.abs(sanitizedValue)),
    Math.max(0.1, exponent)
  );

  return Math.sign(sanitizedValue) * magnitude;
}

function resolveBoostMultiplier(
  boost: boolean,
  movementMagnitude: number
): number {
  if (!boost) {
    return 1;
  }

  const shapedBoostAmount = Math.pow(
    clamp01(Math.abs(movementMagnitude)),
    Math.max(
      0.1,
      metaverseAuthoritativeVehicleSurfaceDriveConfig.boostCurveExponent
    )
  );

  return (
    1 +
    (metaverseAuthoritativeVehicleSurfaceDriveConfig.boostMultiplier - 1) *
      shapedBoostAmount
  );
}

function resolveShapedDragScale(currentSpeedUnitsPerSecond: number): number {
  const normalizedSpeed = clamp01(
    Math.abs(currentSpeedUnitsPerSecond) /
      Math.max(
        0.001,
        metaverseAuthoritativeVehicleSurfaceDriveConfig.baseSpeedUnitsPerSecond
      )
  );

  return Math.max(
    0.18,
    Math.pow(
      normalizedSpeed,
      Math.max(
        0.1,
        metaverseAuthoritativeVehicleSurfaceDriveConfig.dragCurveExponent
      )
    )
  );
}

function createMountedOccupancyRuntimeState(
  mountedOccupancy: MetaversePresenceMountedOccupancySnapshot,
  vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>
): MetaverseMountedOccupancyRuntimeState {
  return Object.freeze({
    entryId: mountedOccupancy.entryId,
    environmentAssetId: mountedOccupancy.environmentAssetId,
    occupancyKind: mountedOccupancy.occupancyKind,
    occupantRole: mountedOccupancy.occupantRole,
    seatId: mountedOccupancy.seatId,
    vehicleId
  });
}

export class MetaverseAuthoritativeWorldRuntime {
  readonly #config: MetaverseAuthoritativeWorldRuntimeConfig;
  readonly #driverVehicleControlsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseDriverVehicleControlRuntimeState
  >();
  readonly #playersById = new Map<MetaversePlayerId, MetaversePlayerWorldRuntimeState>();
  readonly #vehicleIdsByEnvironmentAssetId = new Map<
    string,
    NonNullable<ReturnType<typeof createMetaverseVehicleId>>
  >();
  readonly #vehiclesById = new Map<
    NonNullable<ReturnType<typeof createMetaverseVehicleId>>,
    MetaverseVehicleWorldRuntimeState
  >();

  #currentTick = 0;
  #lastAdvancedAtMs: number | null = null;
  #nextVehicleOrdinal = 1;
  #snapshotSequence = 0;

  constructor(config: Partial<MetaverseAuthoritativeWorldRuntimeConfig> = {}) {
    this.#config = {
      playerInactivityTimeoutMs:
        config.playerInactivityTimeoutMs ??
        metaverseAuthoritativeWorldRuntimeConfig.playerInactivityTimeoutMs,
      tickIntervalMs:
        config.tickIntervalMs ??
        metaverseAuthoritativeWorldRuntimeConfig.tickIntervalMs
    };
  }

  readPresenceRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    const worldSnapshot = this.readWorldSnapshot(nowMs, observerPlayerId);

    return createMetaversePresenceRosterSnapshot({
      players: worldSnapshot.players.map((playerSnapshot) =>
        createMetaversePresencePlayerSnapshot({
          characterId: playerSnapshot.characterId,
          playerId: playerSnapshot.playerId,
          pose: createMetaversePresencePoseSnapshot({
            animationVocabulary: playerSnapshot.animationVocabulary,
            locomotionMode: playerSnapshot.locomotionMode,
            mountedOccupancy:
              playerSnapshot.mountedOccupancy === null
                ? null
                : {
                    environmentAssetId:
                      playerSnapshot.mountedOccupancy.environmentAssetId,
                    entryId: playerSnapshot.mountedOccupancy.entryId,
                    occupancyKind: playerSnapshot.mountedOccupancy.occupancyKind,
                    occupantRole: playerSnapshot.mountedOccupancy.occupantRole,
                    seatId: playerSnapshot.mountedOccupancy.seatId
                  },
            position: playerSnapshot.position,
            stateSequence: playerSnapshot.stateSequence,
            yawRadians: playerSnapshot.yawRadians
          }),
          username: playerSnapshot.username
        })
      ),
      snapshotSequence: worldSnapshot.snapshotSequence,
      tickIntervalMs: Number(worldSnapshot.tick.tickIntervalMs)
    });
  }

  readPresenceRosterEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    return createMetaversePresenceRosterEvent(
      this.readPresenceRosterSnapshot(nowMs, observerPlayerId)
    );
  }

  readWorldSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#advanceToTime(normalizedNowMs);
    this.#pruneInactivePlayers(normalizedNowMs);

    if (
      observerPlayerId !== undefined &&
      !this.#playersById.has(observerPlayerId)
    ) {
      throw new Error(`Unknown metaverse player: ${observerPlayerId}`);
    }

    if (observerPlayerId !== undefined) {
      this.#recordObserverHeartbeat(observerPlayerId, normalizedNowMs);
    }

    const players = [...this.#playersById.values()]
      .sort((leftPlayer, rightPlayer) =>
        sortPlayerIds(leftPlayer.playerId, rightPlayer.playerId)
      )
      .map((playerRuntime) => ({
        animationVocabulary: playerRuntime.animationVocabulary,
        characterId: playerRuntime.characterId,
        linearVelocity: {
          x: playerRuntime.linearVelocityX,
          y: playerRuntime.linearVelocityY,
          z: playerRuntime.linearVelocityZ
        },
        locomotionMode: playerRuntime.locomotionMode,
        ...(playerRuntime.mountedOccupancy === null
          ? {}
          : playerRuntime.mountedOccupancy.occupancyKind === "entry"
            ? {
                mountedOccupancy: {
                  entryId: playerRuntime.mountedOccupancy.entryId,
                  environmentAssetId:
                    playerRuntime.mountedOccupancy.environmentAssetId,
                  occupancyKind: playerRuntime.mountedOccupancy.occupancyKind,
                  occupantRole: playerRuntime.mountedOccupancy.occupantRole,
                  seatId: playerRuntime.mountedOccupancy.seatId,
                  vehicleId: playerRuntime.mountedOccupancy.vehicleId
                } satisfies MetaverseRealtimeMountedOccupancySnapshotInput
              }
            : {}),
        playerId: playerRuntime.playerId,
        position: {
          x: playerRuntime.positionX,
          y: playerRuntime.positionY,
          z: playerRuntime.positionZ
        },
        stateSequence: playerRuntime.stateSequence,
        username: playerRuntime.username,
        yawRadians: playerRuntime.yawRadians
      }));
    const vehicles = [...this.#vehiclesById.values()]
      .sort((leftVehicle, rightVehicle) =>
        sortVehicleIds(leftVehicle.vehicleId, rightVehicle.vehicleId)
      )
      .map((vehicleRuntime) => ({
        angularVelocityRadiansPerSecond:
          vehicleRuntime.angularVelocityRadiansPerSecond,
        environmentAssetId: vehicleRuntime.environmentAssetId,
        linearVelocity: {
          x: vehicleRuntime.linearVelocityX,
          y: vehicleRuntime.linearVelocityY,
          z: vehicleRuntime.linearVelocityZ
        },
        position: {
          x: vehicleRuntime.positionX,
          y: vehicleRuntime.positionY,
          z: vehicleRuntime.positionZ
        },
        seats: [...vehicleRuntime.seatsById.values()]
          .sort((leftSeat, rightSeat) =>
            leftSeat.seatId.localeCompare(rightSeat.seatId)
          )
          .map((seatRuntime) => ({
            occupantPlayerId: seatRuntime.occupantPlayerId,
            occupantRole: seatRuntime.occupantRole,
            seatId: seatRuntime.seatId
          })),
        vehicleId: vehicleRuntime.vehicleId,
        yawRadians: vehicleRuntime.yawRadians
      }));

    return createMetaverseRealtimeWorldSnapshot({
      players,
      snapshotSequence: this.#snapshotSequence,
      tick: {
        currentTick: this.#currentTick,
        serverTimeMs: normalizedNowMs,
        tickIntervalMs: Number(this.#config.tickIntervalMs)
      },
      vehicles
    });
  }

  readWorldEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldEvent {
    return createMetaverseRealtimeWorldEvent({
      world: this.readWorldSnapshot(nowMs, observerPlayerId)
    });
  }

  acceptPresenceCommand(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#advanceToTime(normalizedNowMs);
    this.#pruneInactivePlayers(normalizedNowMs);

    switch (command.type) {
      case "join-presence":
        this.#acceptJoinCommand(command, normalizedNowMs);
        break;
      case "leave-presence":
        this.#acceptLeaveCommand(command);
        break;
      case "sync-presence":
        this.#acceptSyncCommand(command, normalizedNowMs);
        break;
      default: {
        const exhaustiveCommand: never = command;

        throw new Error(
          `Unsupported metaverse presence command type: ${exhaustiveCommand}`
        );
      }
    }

    return this.readPresenceRosterEvent(normalizedNowMs);
  }

  acceptWorldCommand(
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): MetaverseRealtimeWorldEvent {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#advanceToTime(normalizedNowMs);
    this.#pruneInactivePlayers(normalizedNowMs);

    if (command.type === "sync-driver-vehicle-control") {
      this.#acceptSyncDriverVehicleControlCommand(command, normalizedNowMs);
    } else {
      throw new Error(
        `Unsupported metaverse realtime world command type: ${command.type}`
      );
    }

    return this.readWorldEvent(normalizedNowMs);
  }

  #acceptJoinCommand(
    command: MetaverseJoinPresenceCommand,
    nowMs: number
  ): void {
    const nextPose = createMetaversePresencePoseSnapshot(command.pose);
    const currentPlayer = this.#playersById.get(command.playerId);

    if (
      currentPlayer !== undefined &&
      isOlderPresenceUpdate(currentPlayer.stateSequence, nextPose)
    ) {
      currentPlayer.lastSeenAtMs = nowMs;
      return;
    }

    const playerRuntime =
      currentPlayer ??
      this.#createPlayerRuntimeState(
        command.playerId,
        command.characterId,
        command.username,
        nowMs
      );

    playerRuntime.lastSeenAtMs = nowMs;
    this.#applyPlayerPose(playerRuntime, nextPose, nowMs);
    this.#playersById.set(command.playerId, playerRuntime);
    this.#snapshotSequence += 1;
  }

  #acceptLeaveCommand(command: MetaverseLeavePresenceCommand): void {
    const playerRuntime = this.#playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    this.#clearDriverVehicleControl(command.playerId);
    this.#clearPlayerVehicleOccupancy(command.playerId);
    this.#playersById.delete(command.playerId);
    this.#snapshotSequence += 1;
  }

  #acceptSyncCommand(
    command: MetaverseSyncPresenceCommand,
    nowMs: number
  ): void {
    const playerRuntime = this.#playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    const nextPose = createMetaversePresencePoseSnapshot(command.pose);

    playerRuntime.lastSeenAtMs = nowMs;

    if (isOlderPresenceUpdate(playerRuntime.stateSequence, nextPose)) {
      return;
    }

    this.#applyPlayerPose(playerRuntime, nextPose, nowMs);
    this.#snapshotSequence += 1;
  }

  #acceptSyncDriverVehicleControlCommand(
    command: MetaverseSyncDriverVehicleControlCommand,
    nowMs: number
  ): void {
    const playerRuntime = this.#playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    const normalizedCommand =
      createMetaverseSyncDriverVehicleControlCommand(command);
    const mountedOccupancy = playerRuntime.mountedOccupancy;

    if (
      mountedOccupancy === null ||
      mountedOccupancy.occupancyKind !== "seat" ||
      mountedOccupancy.occupantRole !== "driver" ||
      mountedOccupancy.environmentAssetId !==
        normalizedCommand.controlIntent.environmentAssetId
    ) {
      return;
    }

    const existingControlState =
      this.#driverVehicleControlsByPlayerId.get(command.playerId);

    if (
      existingControlState !== undefined &&
      normalizedCommand.controlSequence <= existingControlState.controlSequence
    ) {
      return;
    }

    this.#driverVehicleControlsByPlayerId.set(command.playerId, {
      boost: normalizedCommand.controlIntent.boost,
      controlSequence: normalizedCommand.controlSequence,
      environmentAssetId: normalizedCommand.controlIntent.environmentAssetId,
      moveAxis: normalizedCommand.controlIntent.moveAxis,
      strafeAxis: normalizedCommand.controlIntent.strafeAxis,
      yawAxis: normalizedCommand.controlIntent.yawAxis
    });
    playerRuntime.lastSeenAtMs = nowMs;
  }

  #createPlayerRuntimeState(
    playerId: MetaversePlayerId,
    characterId: string,
    username: MetaversePresencePlayerSnapshot["username"],
    nowMs: number
  ): MetaversePlayerWorldRuntimeState {
    return {
      animationVocabulary: "idle",
      characterId,
      lastPoseAtMs: null,
      lastSeenAtMs: nowMs,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      locomotionMode: "grounded",
      mountedOccupancy: null,
      playerId,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      stateSequence: 0,
      username,
      yawRadians: 0
    };
  }

  #applyPlayerPose(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number
  ): void {
    this.#clearPlayerVehicleOccupancy(playerRuntime.playerId);

    playerRuntime.animationVocabulary = nextPose.animationVocabulary;
    playerRuntime.locomotionMode = nextPose.locomotionMode;
    playerRuntime.stateSequence = nextPose.stateSequence;
    playerRuntime.mountedOccupancy = this.#resolveMountedOccupancyRuntimeState(
      nextPose.mountedOccupancy
    );

    if (playerRuntime.mountedOccupancy === null) {
      this.#clearDriverVehicleControl(playerRuntime.playerId);
      this.#applyPlayerWorldPoseFromPresence(playerRuntime, nextPose, nowMs);
      return;
    }

    if (playerRuntime.mountedOccupancy.occupantRole !== "driver") {
      this.#clearDriverVehicleControl(playerRuntime.playerId);
    }

    playerRuntime.positionX = nextPose.position.x;
    playerRuntime.positionY = nextPose.position.y;
    playerRuntime.positionZ = nextPose.position.z;
    playerRuntime.yawRadians = nextPose.yawRadians;

    const vehicleRuntime = this.#syncVehicleOccupancyAndInitialPoseFromPlayer(
      playerRuntime,
      playerRuntime.mountedOccupancy,
      nowMs
    );

    this.#syncMountedPlayerPoseFromVehicle(playerRuntime, vehicleRuntime, nowMs);
  }

  #resolveMountedOccupancyRuntimeState(
    mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null
  ): MetaverseMountedOccupancyRuntimeState | null {
    if (mountedOccupancy === null) {
      return null;
    }

    return createMountedOccupancyRuntimeState(
      mountedOccupancy,
      this.#resolveVehicleId(mountedOccupancy.environmentAssetId)
    );
  }

  #applyPlayerWorldPoseFromPresence(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number
  ): void {
    const deltaSeconds = computeSecondsBetween(playerRuntime.lastPoseAtMs, nowMs);
    const previousPositionX = playerRuntime.positionX;
    const previousPositionY = playerRuntime.positionY;
    const previousPositionZ = playerRuntime.positionZ;

    playerRuntime.positionX = nextPose.position.x;
    playerRuntime.positionY = nextPose.position.y;
    playerRuntime.positionZ = nextPose.position.z;
    playerRuntime.yawRadians = nextPose.yawRadians;

    if (deltaSeconds === null) {
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
    } else {
      playerRuntime.linearVelocityX =
        (playerRuntime.positionX - previousPositionX) / deltaSeconds;
      playerRuntime.linearVelocityY =
        (playerRuntime.positionY - previousPositionY) / deltaSeconds;
      playerRuntime.linearVelocityZ =
        (playerRuntime.positionZ - previousPositionZ) / deltaSeconds;
    }

    playerRuntime.lastPoseAtMs = nowMs;
  }

  #syncVehicleOccupancyAndInitialPoseFromPlayer(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    mountedOccupancy: MetaverseMountedOccupancyRuntimeState,
    nowMs: number
  ): MetaverseVehicleWorldRuntimeState {
    const vehicleRuntime = this.#ensureVehicleRuntime(
      mountedOccupancy.environmentAssetId,
      mountedOccupancy.vehicleId
    );

    if (mountedOccupancy.occupancyKind === "seat" && mountedOccupancy.seatId !== null) {
      const seatRuntime = this.#ensureVehicleSeatRuntime(
        vehicleRuntime,
        mountedOccupancy.seatId,
        mountedOccupancy.occupantRole
      );

      seatRuntime.occupantPlayerId = playerRuntime.playerId;
      seatRuntime.occupantRole = mountedOccupancy.occupantRole;
    }

    if (vehicleRuntime.lastPoseAtMs === null) {
      vehicleRuntime.angularVelocityRadiansPerSecond = 0;
      vehicleRuntime.forwardSpeedUnitsPerSecond = 0;
      vehicleRuntime.linearVelocityX = 0;
      vehicleRuntime.linearVelocityY = 0;
      vehicleRuntime.linearVelocityZ = 0;
      vehicleRuntime.positionX = playerRuntime.positionX;
      vehicleRuntime.positionY = playerRuntime.positionY;
      vehicleRuntime.positionZ = playerRuntime.positionZ;
      vehicleRuntime.strafeSpeedUnitsPerSecond = 0;
      vehicleRuntime.yawRadians = playerRuntime.yawRadians;
      vehicleRuntime.lastPoseAtMs = nowMs;
    }

    return vehicleRuntime;
  }

  #syncMountedPlayerPoseFromVehicle(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    vehicleRuntime: MetaverseVehicleWorldRuntimeState,
    nowMs: number
  ): void {
    playerRuntime.positionX = vehicleRuntime.positionX;
    playerRuntime.positionY = vehicleRuntime.positionY;
    playerRuntime.positionZ = vehicleRuntime.positionZ;
    playerRuntime.yawRadians = vehicleRuntime.yawRadians;
    playerRuntime.linearVelocityX = vehicleRuntime.linearVelocityX;
    playerRuntime.linearVelocityY = vehicleRuntime.linearVelocityY;
    playerRuntime.linearVelocityZ = vehicleRuntime.linearVelocityZ;
    playerRuntime.lastPoseAtMs = nowMs;
  }

  #ensureVehicleRuntime(
    environmentAssetId: string,
    vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>
  ): MetaverseVehicleWorldRuntimeState {
    const existingVehicleRuntime = this.#vehiclesById.get(vehicleId);

    if (existingVehicleRuntime !== undefined) {
      return existingVehicleRuntime;
    }

    const vehicleRuntime: MetaverseVehicleWorldRuntimeState = {
      angularVelocityRadiansPerSecond: 0,
      environmentAssetId,
      forwardSpeedUnitsPerSecond: 0,
      lastPoseAtMs: null,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      seatsById: new Map(),
      strafeSpeedUnitsPerSecond: 0,
      vehicleId,
      yawRadians: 0
    };

    this.#vehiclesById.set(vehicleId, vehicleRuntime);

    return vehicleRuntime;
  }

  #ensureVehicleSeatRuntime(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState,
    seatId: string,
    occupantRole: MetaversePresenceMountedOccupantRoleId
  ): MetaverseVehicleSeatRuntimeState {
    const existingSeatRuntime = vehicleRuntime.seatsById.get(seatId);

    if (existingSeatRuntime !== undefined) {
      return existingSeatRuntime;
    }

    const seatRuntime: MetaverseVehicleSeatRuntimeState = {
      occupantPlayerId: null,
      occupantRole,
      seatId
    };

    vehicleRuntime.seatsById.set(seatId, seatRuntime);

    return seatRuntime;
  }

  #resolveVehicleId(
    environmentAssetId: string
  ): NonNullable<ReturnType<typeof createMetaverseVehicleId>> {
    const existingVehicleId =
      this.#vehicleIdsByEnvironmentAssetId.get(environmentAssetId);

    if (existingVehicleId !== undefined) {
      return existingVehicleId;
    }

    const preferredVehicleId =
      createMetaverseVehicleId(environmentAssetId) ??
      createMetaverseVehicleId(`metaverse-vehicle-${this.#nextVehicleOrdinal}`);

    if (preferredVehicleId === null) {
      throw new Error(
        `Metaverse authoritative world could not resolve a vehicle id for ${environmentAssetId}.`
      );
    }

    this.#nextVehicleOrdinal += 1;
    this.#vehicleIdsByEnvironmentAssetId.set(environmentAssetId, preferredVehicleId);

    return preferredVehicleId;
  }

  #clearPlayerVehicleOccupancy(playerId: MetaversePlayerId): void {
    for (const vehicleRuntime of this.#vehiclesById.values()) {
      for (const seatRuntime of vehicleRuntime.seatsById.values()) {
        if (seatRuntime.occupantPlayerId === playerId) {
          seatRuntime.occupantPlayerId = null;
        }
      }
    }
  }

  #clearDriverVehicleControl(playerId: MetaversePlayerId): void {
    this.#driverVehicleControlsByPlayerId.delete(playerId);
  }

  #recordObserverHeartbeat(
    observerPlayerId: MetaversePlayerId,
    nowMs: number
  ): void {
    const observerRuntime = this.#playersById.get(observerPlayerId);

    if (observerRuntime === undefined) {
      return;
    }

    observerRuntime.lastSeenAtMs = nowMs;
  }

  #pruneInactivePlayers(nowMs: number): void {
    const timeoutMs = Number(this.#config.playerInactivityTimeoutMs);
    let prunedPlayer = false;

    for (const [playerId, playerRuntime] of this.#playersById) {
      if (nowMs - playerRuntime.lastSeenAtMs <= timeoutMs) {
        continue;
      }

      this.#clearDriverVehicleControl(playerId);
      this.#clearPlayerVehicleOccupancy(playerId);
      this.#playersById.delete(playerId);
      prunedPlayer = true;
    }

    if (prunedPlayer) {
      this.#snapshotSequence += 1;
    }
  }

  #advanceToTime(nowMs: number): void {
    if (this.#lastAdvancedAtMs === null) {
      this.#lastAdvancedAtMs = nowMs;
      return;
    }

    const tickIntervalMs = Number(this.#config.tickIntervalMs);

    if (!Number.isFinite(tickIntervalMs) || tickIntervalMs <= 0) {
      return;
    }

    let advancedTick = false;
    const tickIntervalSeconds = tickIntervalMs / 1_000;

    while (this.#lastAdvancedAtMs + tickIntervalMs <= nowMs) {
      this.#lastAdvancedAtMs += tickIntervalMs;
      this.#advanceVehicleRuntimes(tickIntervalSeconds, this.#lastAdvancedAtMs);
      this.#syncMountedPlayerWorldStateFromVehicles(this.#lastAdvancedAtMs);
      this.#currentTick += 1;
      advancedTick = true;
    }

    if (advancedTick) {
      this.#snapshotSequence += 1;
    }
  }

  #advanceVehicleRuntimes(deltaSeconds: number, nowMs: number): void {
    for (const vehicleRuntime of this.#vehiclesById.values()) {
      if (vehicleRuntime.lastPoseAtMs === null) {
        continue;
      }

      const driverControlState =
        this.#resolveDriverVehicleControlRuntimeState(vehicleRuntime);

      this.#advanceVehicleRuntime(vehicleRuntime, driverControlState, deltaSeconds);
      vehicleRuntime.lastPoseAtMs = nowMs;
    }
  }

  #resolveDriverVehicleControlRuntimeState(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState
  ): MetaverseDriverVehicleControlRuntimeState | null {
    for (const seatRuntime of vehicleRuntime.seatsById.values()) {
      if (
        seatRuntime.occupantPlayerId === null ||
        seatRuntime.occupantRole !== "driver"
      ) {
        continue;
      }

      const playerRuntime = this.#playersById.get(seatRuntime.occupantPlayerId);

      if (
        playerRuntime === undefined ||
        playerRuntime.mountedOccupancy === null ||
        playerRuntime.mountedOccupancy.occupancyKind !== "seat" ||
        playerRuntime.mountedOccupancy.vehicleId !== vehicleRuntime.vehicleId
      ) {
        continue;
      }

      const driverControlState = this.#driverVehicleControlsByPlayerId.get(
        seatRuntime.occupantPlayerId
      );

      if (
        driverControlState === undefined ||
        driverControlState.environmentAssetId !== vehicleRuntime.environmentAssetId
      ) {
        return null;
      }

      return driverControlState;
    }

    return null;
  }

  #advanceVehicleRuntime(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState,
    driverControlState: MetaverseDriverVehicleControlRuntimeState | null,
    deltaSeconds: number
  ): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const yawAxis = clampAxis(driverControlState?.yawAxis ?? 0);
    const nextYawRadians = wrapRadians(
      vehicleRuntime.yawRadians +
        yawAxis *
          metaverseAuthoritativeVehicleSurfaceDriveConfig.maxTurnSpeedRadiansPerSecond *
          deltaSeconds
    );
    const moveAxis = clampAxis(driverControlState?.moveAxis ?? 0);
    const strafeAxis = clampAxis(driverControlState?.strafeAxis ?? 0);
    const movementMagnitude = clamp01(Math.hypot(moveAxis, strafeAxis));
    const boostScale = resolveBoostMultiplier(
      driverControlState?.boost === true,
      movementMagnitude
    );
    const targetForwardSpeedUnitsPerSecond =
      metaverseAuthoritativeVehicleSurfaceDriveConfig.baseSpeedUnitsPerSecond *
      shapeSignedAxis(
        moveAxis,
        metaverseAuthoritativeVehicleSurfaceDriveConfig.accelerationCurveExponent
      ) *
      boostScale;
    const targetStrafeSpeedUnitsPerSecond =
      metaverseAuthoritativeVehicleSurfaceDriveConfig.baseSpeedUnitsPerSecond *
      shapeSignedAxis(
        strafeAxis,
        metaverseAuthoritativeVehicleSurfaceDriveConfig.accelerationCurveExponent
      ) *
      boostScale;
    const resolveAxisSpeedUnitsPerSecond = (
      currentSpeedUnitsPerSecond: number,
      targetAxisSpeedUnitsPerSecond: number,
      axisInput: number
    ): number =>
      axisInput === 0
        ? (() => {
            const speedDelta =
              metaverseAuthoritativeVehicleSurfaceDriveConfig.decelerationUnitsPerSecondSquared *
              resolveShapedDragScale(currentSpeedUnitsPerSecond) *
              deltaSeconds;

            if (
              Math.abs(
                targetAxisSpeedUnitsPerSecond - currentSpeedUnitsPerSecond
              ) <= speedDelta
            ) {
              return 0;
            }

            return (
              currentSpeedUnitsPerSecond -
              Math.sign(currentSpeedUnitsPerSecond) * speedDelta
            );
          })()
        : (() => {
            const speedDelta =
              metaverseAuthoritativeVehicleSurfaceDriveConfig.accelerationUnitsPerSecondSquared *
              Math.max(
                0.2,
                Math.abs(
                  shapeSignedAxis(
                    axisInput,
                    metaverseAuthoritativeVehicleSurfaceDriveConfig.accelerationCurveExponent
                  )
                )
              ) *
              deltaSeconds;

            if (
              Math.abs(
                targetAxisSpeedUnitsPerSecond - currentSpeedUnitsPerSecond
              ) <= speedDelta
            ) {
              return targetAxisSpeedUnitsPerSecond;
            }

            return (
              currentSpeedUnitsPerSecond +
              Math.sign(
                targetAxisSpeedUnitsPerSecond - currentSpeedUnitsPerSecond
              ) *
                speedDelta
            );
          })();
    const nextForwardSpeedUnitsPerSecond = resolveAxisSpeedUnitsPerSecond(
      vehicleRuntime.forwardSpeedUnitsPerSecond,
      targetForwardSpeedUnitsPerSecond,
      moveAxis
    );
    const nextStrafeSpeedUnitsPerSecond = resolveAxisSpeedUnitsPerSecond(
      vehicleRuntime.strafeSpeedUnitsPerSecond,
      targetStrafeSpeedUnitsPerSecond,
      strafeAxis
    );
    const forwardX = Math.sin(nextYawRadians);
    const forwardZ = -Math.cos(nextYawRadians);
    const rightX = Math.cos(nextYawRadians);
    const rightZ = Math.sin(nextYawRadians);
    const unclampedPositionX =
      vehicleRuntime.positionX +
      (forwardX * nextForwardSpeedUnitsPerSecond +
        rightX * nextStrafeSpeedUnitsPerSecond) *
        deltaSeconds;
    const unclampedPositionZ =
      vehicleRuntime.positionZ +
      (forwardZ * nextForwardSpeedUnitsPerSecond +
        rightZ * nextStrafeSpeedUnitsPerSecond) *
        deltaSeconds;
    const radialDistance = Math.hypot(unclampedPositionX, unclampedPositionZ);
    const radiusScale =
      radialDistance <= metaverseAuthoritativeVehicleSurfaceDriveConfig.worldRadius
        ? 1
        : metaverseAuthoritativeVehicleSurfaceDriveConfig.worldRadius /
          Math.max(1, radialDistance);
    const nextPositionX = unclampedPositionX * radiusScale;
    const nextPositionZ = unclampedPositionZ * radiusScale;
    const deltaX = nextPositionX - vehicleRuntime.positionX;
    const deltaZ = nextPositionZ - vehicleRuntime.positionZ;
    const previousYawRadians = vehicleRuntime.yawRadians;

    vehicleRuntime.positionX = nextPositionX;
    vehicleRuntime.positionZ = nextPositionZ;
    vehicleRuntime.yawRadians = nextYawRadians;
    vehicleRuntime.linearVelocityX = deltaX / deltaSeconds;
    vehicleRuntime.linearVelocityY = 0;
    vehicleRuntime.linearVelocityZ = deltaZ / deltaSeconds;
    vehicleRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(nextYawRadians - previousYawRadians) /
      deltaSeconds;
    vehicleRuntime.forwardSpeedUnitsPerSecond =
      (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds;
    vehicleRuntime.strafeSpeedUnitsPerSecond =
      (deltaX * rightX + deltaZ * rightZ) / deltaSeconds;
  }

  #syncMountedPlayerWorldStateFromVehicles(nowMs: number): void {
    for (const playerRuntime of this.#playersById.values()) {
      const mountedOccupancy = playerRuntime.mountedOccupancy;

      if (mountedOccupancy === null) {
        continue;
      }

      const vehicleRuntime = this.#vehiclesById.get(mountedOccupancy.vehicleId);

      if (vehicleRuntime === undefined) {
        continue;
      }

      this.#syncMountedPlayerPoseFromVehicle(playerRuntime, vehicleRuntime, nowMs);
    }
  }
}
