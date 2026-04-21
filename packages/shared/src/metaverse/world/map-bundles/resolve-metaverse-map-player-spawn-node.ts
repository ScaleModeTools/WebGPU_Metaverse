import type {
  MetaverseWorldSurfaceVector3Snapshot
} from "../../metaverse-world-surface-query.js";
import type { MetaversePlayerTeamId } from "../../metaverse-player-team.js";

import type {
  MetaverseMapBundlePlayerSpawnSelectionSnapshot,
  MetaverseMapBundleSpawnNodeSnapshot,
  MetaverseMapPlayerSpawnTeamId
} from "./metaverse-map-bundle.js";

export interface MetaverseMapOccupiedPlayerSpawnSnapshot {
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly teamId: MetaversePlayerTeamId;
}

export interface ResolveMetaverseMapPlayerSpawnNodeInput {
  readonly occupiedPlayerSnapshots:
    readonly MetaverseMapOccupiedPlayerSpawnSnapshot[];
  readonly playerId?: string | null;
  readonly playerSpawnNodes: readonly MetaverseMapBundleSpawnNodeSnapshot[];
  readonly playerSpawnSelection: MetaverseMapBundlePlayerSpawnSelectionSnapshot;
  readonly playerTeamId: MetaversePlayerTeamId;
}

interface MetaverseMapPlayerSpawnCandidate {
  readonly enemyClearanceMeters: number;
  readonly nearestEnemyDistanceMeters: number;
  readonly node: MetaverseMapBundleSpawnNodeSnapshot;
  readonly occupiedClearanceMeters: number;
  readonly safeFromEnemies: boolean;
  readonly score: number;
  readonly teamPreferenceRank: number;
}

const spawnDistanceFallbackMeters = 10_000;

function readPlanarDistanceMeters(
  position: MetaverseWorldSurfaceVector3Snapshot,
  target: MetaverseWorldSurfaceVector3Snapshot
): number {
  return Math.hypot(position.x - target.x, position.z - target.z);
}

function readNearestEnemyDistanceMeters(
  node: MetaverseMapBundleSpawnNodeSnapshot,
  occupiedPlayerSnapshots: readonly MetaverseMapOccupiedPlayerSpawnSnapshot[],
  playerTeamId: MetaversePlayerTeamId
): number {
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;

  for (const occupiedPlayerSnapshot of occupiedPlayerSnapshots) {
    if (occupiedPlayerSnapshot.teamId === playerTeamId) {
      continue;
    }

    nearestDistanceMeters = Math.min(
      nearestDistanceMeters,
      readPlanarDistanceMeters(node.position, occupiedPlayerSnapshot.position)
    );
  }

  return nearestDistanceMeters;
}

function readNearestOccupiedDistanceMeters(
  node: MetaverseMapBundleSpawnNodeSnapshot,
  occupiedPlayerSnapshots: readonly MetaverseMapOccupiedPlayerSpawnSnapshot[]
): number {
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;

  for (const occupiedPlayerSnapshot of occupiedPlayerSnapshots) {
    nearestDistanceMeters = Math.min(
      nearestDistanceMeters,
      readPlanarDistanceMeters(node.position, occupiedPlayerSnapshot.position)
    );
  }

  return nearestDistanceMeters;
}

function readEnemyClearanceMeters(
  nearestEnemyDistanceMeters: number
): number {
  return Number.isFinite(nearestEnemyDistanceMeters)
    ? nearestEnemyDistanceMeters
    : spawnDistanceFallbackMeters;
}

function readOccupiedClearanceMeters(
  nearestOccupiedDistanceMeters: number
): number {
  return Number.isFinite(nearestOccupiedDistanceMeters)
    ? nearestOccupiedDistanceMeters
    : spawnDistanceFallbackMeters;
}

function readTeamPreferenceRank(
  spawnTeamId: MetaverseMapPlayerSpawnTeamId,
  playerTeamId: MetaversePlayerTeamId
): number {
  if (spawnTeamId === playerTeamId) {
    return 2;
  }

  if (spawnTeamId === "neutral") {
    return 1;
  }

  return 0;
}

function compareSpawnCandidates(
  leftCandidate: MetaverseMapPlayerSpawnCandidate,
  rightCandidate: MetaverseMapPlayerSpawnCandidate
): number {
  if (leftCandidate.score !== rightCandidate.score) {
    return rightCandidate.score - leftCandidate.score;
  }

  if (
    leftCandidate.teamPreferenceRank !== rightCandidate.teamPreferenceRank
  ) {
    return (
      rightCandidate.teamPreferenceRank - leftCandidate.teamPreferenceRank
    );
  }

  if (
    leftCandidate.occupiedClearanceMeters !==
    rightCandidate.occupiedClearanceMeters
  ) {
    return (
      rightCandidate.occupiedClearanceMeters -
      leftCandidate.occupiedClearanceMeters
    );
  }

  if (
    leftCandidate.enemyClearanceMeters !== rightCandidate.enemyClearanceMeters
  ) {
    return (
      rightCandidate.enemyClearanceMeters - leftCandidate.enemyClearanceMeters
    );
  }

  return 0;
}

function hashPlayerSpawnSeed(playerId: string): number {
  let hash = 0;

  for (let index = 0; index < playerId.length; index += 1) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(index)) | 0;
  }

  return hash;
}

function resolveTiedSpawnCandidateIndex(
  playerId: string | null | undefined,
  candidateCount: number
): number {
  if (
    playerId === null ||
    playerId === undefined ||
    playerId.length === 0 ||
    candidateCount <= 1
  ) {
    return 0;
  }

  return Math.abs(hashPlayerSpawnSeed(playerId)) % candidateCount;
}

export function resolveMetaverseMapPlayerSpawnNode({
  occupiedPlayerSnapshots,
  playerId,
  playerSpawnNodes,
  playerSpawnSelection,
  playerTeamId
}: ResolveMetaverseMapPlayerSpawnNodeInput):
  | MetaverseMapBundleSpawnNodeSnapshot
  | null {
  if (playerSpawnNodes.length === 0) {
    return null;
  }

  const spawnCandidates = playerSpawnNodes
    .map((node) => {
      const nearestEnemyDistanceMeters = readNearestEnemyDistanceMeters(
        node,
        occupiedPlayerSnapshots,
        playerTeamId
      );
      const nearestOccupiedDistanceMeters = readNearestOccupiedDistanceMeters(
        node,
        occupiedPlayerSnapshots
      );
      const enemyClearanceMeters = readEnemyClearanceMeters(
        nearestEnemyDistanceMeters
      );
      const occupiedClearanceMeters = readOccupiedClearanceMeters(
        nearestOccupiedDistanceMeters
      );
      const teamPreferenceRank = readTeamPreferenceRank(node.teamId, playerTeamId);
      const homeTeamBiasMeters =
        node.teamId === playerTeamId
          ? playerSpawnSelection.homeTeamBiasMeters
          : 0;
      const safeFromEnemies =
        nearestEnemyDistanceMeters >=
        playerSpawnSelection.enemyAvoidanceRadiusMeters;

      return Object.freeze({
        enemyClearanceMeters,
        nearestEnemyDistanceMeters,
        node,
        occupiedClearanceMeters,
        safeFromEnemies,
        score: enemyClearanceMeters + homeTeamBiasMeters,
        teamPreferenceRank
      } satisfies MetaverseMapPlayerSpawnCandidate);
    })
    .sort((leftCandidate, rightCandidate) => {
      const priorityDelta = compareSpawnCandidates(
        leftCandidate,
        rightCandidate
      );

      return priorityDelta !== 0
        ? priorityDelta
        : leftCandidate.node.spawnId.localeCompare(rightCandidate.node.spawnId);
    });
  const effectiveSpawnCandidates =
    spawnCandidates.filter((candidate) => candidate.safeFromEnemies);
  const prioritizedSpawnCandidates =
    effectiveSpawnCandidates.length > 0
      ? effectiveSpawnCandidates
      : spawnCandidates;
  const highestPriorityCandidate = prioritizedSpawnCandidates[0] ?? null;

  if (highestPriorityCandidate === null) {
    return null;
  }

  const tiedHighestPriorityCandidates = prioritizedSpawnCandidates.filter(
    (candidate) =>
      compareSpawnCandidates(candidate, highestPriorityCandidate) === 0
  );
  const resolvedSpawnCandidate =
    tiedHighestPriorityCandidates[
      resolveTiedSpawnCandidateIndex(playerId, tiedHighestPriorityCandidates.length)
    ] ?? highestPriorityCandidate;

  return resolvedSpawnCandidate.node;
}
