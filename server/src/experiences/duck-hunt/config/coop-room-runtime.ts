import {
  createCoopBirdId,
  createCoopRoomId,
  createCoopSessionId,
  createRadians,
  createMilliseconds,
  type CoopRoomId
} from "@thumbshooter/shared";

import type { CoopRoomRuntimeConfig } from "../types/coop-room-runtime.js";

function requireCoopRoomId(rawValue: string) {
  const roomId = createCoopRoomId(rawValue);

  if (roomId === null) {
    throw new Error(`Invalid co-op room id: ${rawValue}`);
  }

  return roomId;
}

function requireCoopSessionId(rawValue: string) {
  const sessionId = createCoopSessionId(rawValue);

  if (sessionId === null) {
    throw new Error(`Invalid co-op session id: ${rawValue}`);
  }

  return sessionId;
}

function requireCoopBirdId(rawValue: string) {
  const birdId = createCoopBirdId(rawValue);

  if (birdId === null) {
    throw new Error(`Invalid co-op bird id: ${rawValue}`);
  }

  return birdId;
}

const defaultCoopRoomId = requireCoopRoomId("co-op-harbor");
const roomSessionBootSequence = `${Date.now()}`.padStart(13, "0");

const baseCoopRoomRuntimeConfig = {
  birdAltitudeBounds: {
    min: 4.5,
    max: 18.5
  },
  birds: [
    {
      birdId: requireCoopBirdId("shared-bird-1"),
      glideVelocity: {
        altitudeUnitsPerSecond: 0.42,
        azimuthRadiansPerSecond: 0.24
      },
      label: "Shared Bird 1",
      orbitRadius: 32,
      radius: 1.35,
      scale: 1.1,
      spawn: {
        altitude: 9.2,
        azimuthRadians: createRadians(-0.42)
      },
      wingSpeed: 6.4
    },
    {
      birdId: requireCoopBirdId("shared-bird-2"),
      glideVelocity: {
        altitudeUnitsPerSecond: -0.36,
        azimuthRadiansPerSecond: -0.18
      },
      label: "Shared Bird 2",
      orbitRadius: 36,
      radius: 1.3,
      scale: 1.03,
      spawn: {
        altitude: 11.8,
        azimuthRadians: createRadians(0.28)
      },
      wingSpeed: 5.8
    },
    {
      birdId: requireCoopBirdId("shared-bird-3"),
      glideVelocity: {
        altitudeUnitsPerSecond: 0.28,
        azimuthRadiansPerSecond: 0.27
      },
      label: "Shared Bird 3",
      orbitRadius: 30,
      radius: 1.28,
      scale: 1.08,
      spawn: {
        altitude: 7.6,
        azimuthRadians: createRadians(-0.86)
      },
      wingSpeed: 6.9
    },
    {
      birdId: requireCoopBirdId("shared-bird-4"),
      glideVelocity: {
        altitudeUnitsPerSecond: 0.24,
        azimuthRadiansPerSecond: -0.23
      },
      label: "Shared Bird 4",
      orbitRadius: 34,
      radius: 1.32,
      scale: 1.05,
      spawn: {
        altitude: 10.4,
        azimuthRadians: createRadians(0.74)
      },
      wingSpeed: 6.1
    }
  ],
  capacity: 4,
  hitRadius: 0.42,
  movement: {
    downedDriftSpeed: 2.8,
    downedDurationMs: createMilliseconds(960),
    downedFallSpeed: 5.6,
    scatterAltitudeSpeed: 3.2,
    scatterAngularSpeed: 0.78,
    scatterDurationMs: createMilliseconds(820)
  },
  playerSpawnPosition: {
    x: 0,
    y: 1.35,
    z: 0
  },
  playerInactivityTimeoutMs: createMilliseconds(10_000),
  rounds: {
    behaviorSpeedScalePerRound: 0.08,
    birdCountIncreasePerRound: 1,
    birdSpeedScalePerRound: 0.1,
    cooldownDurationMs: createMilliseconds(3_000),
    durationLossPerRoundMs: createMilliseconds(1_000),
    initialBirdCount: 2,
    initialDurationMs: createMilliseconds(25_000),
    minimumDurationMs: createMilliseconds(12_000)
  },
  requiredReadyPlayerCount: 2,
  reticleScatterRadius: 0.72,
  scatterRadius: 5.2,
  tickIntervalMs: createMilliseconds(50)
} as const satisfies Omit<CoopRoomRuntimeConfig, "roomId" | "sessionId">;

function normalizeSessionOrdinal(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 1;
  }

  return Math.max(1, Math.floor(rawValue));
}

function createRoomSessionId(
  roomId: CoopRoomId,
  sessionOrdinal: number
) {
  return requireCoopSessionId(
    `${roomId}-session-${roomSessionBootSequence}-${normalizeSessionOrdinal(
      sessionOrdinal
    )}`
  );
}

export function createCoopRoomRuntimeConfig(
  roomId: CoopRoomId = defaultCoopRoomId,
  sessionOrdinal = 1
): CoopRoomRuntimeConfig {
  return {
    ...baseCoopRoomRuntimeConfig,
    roomId,
    sessionId: createRoomSessionId(roomId, sessionOrdinal)
  };
}

export const coopRoomRuntimeConfig = createCoopRoomRuntimeConfig();
