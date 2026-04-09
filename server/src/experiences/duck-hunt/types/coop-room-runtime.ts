import type {
  CoopBirdId,
  CoopRoomId,
  CoopSessionId,
  Milliseconds
} from "@thumbshooter/shared";

export interface CoopRoomBirdSeed {
  readonly birdId: CoopBirdId;
  readonly glideVelocity: {
    readonly altitudeUnitsPerSecond: number;
    readonly azimuthRadiansPerSecond: number;
  };
  readonly label: string;
  readonly orbitRadius: number;
  readonly radius: number;
  readonly scale: number;
  readonly spawn: {
    readonly altitude: number;
    readonly azimuthRadians: number;
  };
  readonly wingSpeed: number;
}

export interface CoopRoomRuntimeConfig {
  readonly birdAltitudeBounds: {
    readonly max: number;
    readonly min: number;
  };
  readonly birds: readonly CoopRoomBirdSeed[];
  readonly capacity: number;
  readonly hitRadius: number;
  readonly movement: {
    readonly downedDriftSpeed: number;
    readonly downedDurationMs: Milliseconds;
    readonly downedFallSpeed: number;
    readonly scatterAltitudeSpeed: number;
    readonly scatterAngularSpeed: number;
    readonly scatterDurationMs: Milliseconds;
  };
  readonly playerSpawnPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly playerInactivityTimeoutMs: Milliseconds;
  readonly rounds: {
    readonly behaviorSpeedScalePerRound: number;
    readonly birdCountIncreasePerRound: number;
    readonly birdSpeedScalePerRound: number;
    readonly cooldownDurationMs: Milliseconds;
    readonly durationLossPerRoundMs: Milliseconds;
    readonly initialBirdCount: number;
    readonly initialDurationMs: Milliseconds;
    readonly minimumDurationMs: Milliseconds;
  };
  readonly requiredReadyPlayerCount: number;
  readonly reticleScatterRadius: number;
  readonly roomId: CoopRoomId;
  readonly scatterRadius: number;
  readonly sessionId: CoopSessionId;
  readonly tickIntervalMs: Milliseconds;
}
