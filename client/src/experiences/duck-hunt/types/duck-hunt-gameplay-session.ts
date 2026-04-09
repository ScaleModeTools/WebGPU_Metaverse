import type {
  Milliseconds,
  CoopVector3Snapshot,
  CoopPlayerId,
  CoopPlayerShotOutcomeState,
  CoopRoundPhase,
  CoopRoomId,
  CoopRoomPhase,
  CoopRoomSnapshot,
  CoopSessionId,
  Username
} from "@webgpu-metaverse/shared";
import { createCoopSessionId, createMilliseconds } from "@webgpu-metaverse/shared";

import type {
  LocalCombatSessionPhase,
  LocalCombatSessionSnapshot
} from "./duck-hunt-local-combat-session";

export interface SinglePlayerGameplaySessionSnapshot
  extends LocalCombatSessionSnapshot {
  readonly mode: "single-player";
}

export interface CoopGameplaySessionPlayerSnapshot {
  readonly aimDirection: CoopVector3Snapshot;
  readonly connected: boolean;
  readonly hitsLanded: number;
  readonly isLeader: boolean;
  readonly isLocalPlayer: boolean;
  readonly lastPresenceTick: number | null;
  readonly lastOutcome: CoopPlayerShotOutcomeState | null;
  readonly pitchRadians: number;
  readonly playerId: CoopPlayerId;
  readonly position: CoopVector3Snapshot;
  readonly ready: boolean;
  readonly scatterEventsCaused: number;
  readonly shotsFired: number;
  readonly username: Username;
  readonly weaponId: string;
  readonly yawRadians: number;
}

export interface CoopGameplaySessionSnapshot {
  readonly birdsCleared: number;
  readonly birdsRemaining: number;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly leaderPlayerId: CoopPlayerId | null;
  readonly localPlayerCanStart: boolean;
  readonly localPlayerIsLeader: boolean;
  readonly mode: "co-op";
  readonly phase: CoopRoomPhase;
  readonly playerCount: number;
  readonly players: readonly CoopGameplaySessionPlayerSnapshot[];
  readonly roundDurationMs: Milliseconds;
  readonly roundNumber: number;
  readonly roundPhase: CoopRoundPhase;
  readonly roundPhaseRemainingMs: Milliseconds;
  readonly readyPlayerCount: number;
  readonly requiredReadyPlayerCount: number;
  readonly roomId: CoopRoomId;
  readonly sessionId: CoopSessionId;
  readonly teamHitsLanded: number;
  readonly teamShotsFired: number;
}

export type GameplaySessionSnapshot =
  | SinglePlayerGameplaySessionSnapshot
  | CoopGameplaySessionSnapshot;

export type GameplaySessionPhase =
  | LocalCombatSessionPhase
  | CoopRoomPhase;

function freezeCoopGameplaySessionPlayerSnapshot(
  playerSnapshot: CoopGameplaySessionPlayerSnapshot
): CoopGameplaySessionPlayerSnapshot {
  return Object.freeze({
    aimDirection: playerSnapshot.aimDirection,
    connected: playerSnapshot.connected,
    hitsLanded: playerSnapshot.hitsLanded,
    isLeader: playerSnapshot.isLeader,
    isLocalPlayer: playerSnapshot.isLocalPlayer,
    lastPresenceTick: playerSnapshot.lastPresenceTick,
    lastOutcome: playerSnapshot.lastOutcome,
    pitchRadians: playerSnapshot.pitchRadians,
    playerId: playerSnapshot.playerId,
    position: playerSnapshot.position,
    ready: playerSnapshot.ready,
    scatterEventsCaused: playerSnapshot.scatterEventsCaused,
    shotsFired: playerSnapshot.shotsFired,
    username: playerSnapshot.username,
    weaponId: playerSnapshot.weaponId,
    yawRadians: playerSnapshot.yawRadians
  });
}

export function createSinglePlayerGameplaySessionSnapshot(
  sessionSnapshot: LocalCombatSessionSnapshot
): SinglePlayerGameplaySessionSnapshot {
  return Object.freeze({
    hitsThisSession: sessionSnapshot.hitsThisSession,
    killsThisSession: sessionSnapshot.killsThisSession,
    mode: "single-player",
    phase: sessionSnapshot.phase,
    restartReady: sessionSnapshot.restartReady,
    roundDurationMs: sessionSnapshot.roundDurationMs,
    roundNumber: sessionSnapshot.roundNumber,
    roundTimeRemainingMs: sessionSnapshot.roundTimeRemainingMs,
    score: sessionSnapshot.score,
    streak: sessionSnapshot.streak
  });
}

export function createPendingCoopGameplaySessionSnapshot(
  roomId: CoopRoomId
): CoopGameplaySessionSnapshot {
  const pendingSessionId = createCoopSessionId(`${roomId}-pending`);

  if (pendingSessionId === null) {
    throw new Error(`Unable to create a pending co-op session id for ${roomId}.`);
  }

  return Object.freeze({
    birdsCleared: 0,
    birdsRemaining: 0,
    capacity: 0,
    connectedPlayerCount: 0,
    leaderPlayerId: null,
    localPlayerCanStart: false,
    localPlayerIsLeader: false,
    mode: "co-op",
    phase: "waiting-for-players",
    playerCount: 0,
    players: Object.freeze([]),
    roundDurationMs: createMilliseconds(0),
    roundNumber: 1,
    roundPhase: "combat",
    roundPhaseRemainingMs: createMilliseconds(0),
    readyPlayerCount: 0,
    requiredReadyPlayerCount: 0,
    roomId,
    sessionId: pendingSessionId,
    teamHitsLanded: 0,
    teamShotsFired: 0
  });
}

export function createCoopGameplaySessionSnapshot(
  roomSnapshot: CoopRoomSnapshot,
  localPlayerId: CoopPlayerId
): CoopGameplaySessionSnapshot {
  let connectedPlayerCount = 0;
  let readyPlayerCount = 0;
  const leaderPlayerId = roomSnapshot.session.leaderPlayerId ?? null;
  const localPlayerIsLeader = leaderPlayerId === localPlayerId;

  const players = roomSnapshot.players.map((playerSnapshot) => {
    if (playerSnapshot.connected) {
      connectedPlayerCount += 1;
    }

    if (playerSnapshot.connected && playerSnapshot.ready) {
      readyPlayerCount += 1;
    }

    return freezeCoopGameplaySessionPlayerSnapshot({
      aimDirection: playerSnapshot.presence.aimDirection,
      connected: playerSnapshot.connected,
      hitsLanded: playerSnapshot.activity.hitsLanded,
      isLeader: playerSnapshot.playerId === leaderPlayerId,
      isLocalPlayer: playerSnapshot.playerId === localPlayerId,
      lastPresenceTick: playerSnapshot.presence.lastUpdatedTick,
      lastOutcome: playerSnapshot.activity.lastOutcome,
      pitchRadians: playerSnapshot.presence.pitchRadians,
      playerId: playerSnapshot.playerId,
      position: playerSnapshot.presence.position,
      ready: playerSnapshot.ready,
      scatterEventsCaused: playerSnapshot.activity.scatterEventsCaused,
      shotsFired: playerSnapshot.activity.shotsFired,
      username: playerSnapshot.username,
      weaponId: playerSnapshot.presence.weaponId,
      yawRadians: playerSnapshot.presence.yawRadians
    });
  });

  const allConnectedPlayersReady =
    connectedPlayerCount > 0 && readyPlayerCount === connectedPlayerCount;

  return Object.freeze({
    birdsCleared: roomSnapshot.session.birdsCleared,
    birdsRemaining: roomSnapshot.session.birdsRemaining,
    capacity: roomSnapshot.capacity,
    connectedPlayerCount,
    leaderPlayerId,
    localPlayerCanStart:
      roomSnapshot.session.phase === "waiting-for-players" &&
      localPlayerIsLeader &&
      readyPlayerCount >= roomSnapshot.session.requiredReadyPlayerCount &&
      allConnectedPlayersReady,
    localPlayerIsLeader,
    mode: "co-op",
    phase: roomSnapshot.session.phase,
    playerCount: roomSnapshot.players.length,
    players: Object.freeze(players),
    roundDurationMs: roomSnapshot.session.roundDurationMs,
    roundNumber: roomSnapshot.session.roundNumber,
    roundPhase: roomSnapshot.session.roundPhase,
    roundPhaseRemainingMs: roomSnapshot.session.roundPhaseRemainingMs,
    readyPlayerCount,
    requiredReadyPlayerCount: roomSnapshot.session.requiredReadyPlayerCount,
    roomId: roomSnapshot.roomId,
    sessionId: roomSnapshot.session.sessionId,
    teamHitsLanded: roomSnapshot.session.teamHitsLanded,
    teamShotsFired: roomSnapshot.session.teamShotsFired
  });
}
