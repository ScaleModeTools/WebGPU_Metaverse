import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  type MetaversePlayerId,
  type MetaverseRealtimePlayerSnapshot,
  type MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

import { metaverseLocalAuthorityReconciliationConfig } from "../config/metaverse-world-network";
import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseHudSnapshot,
  MetaverseMountedInteractionSnapshot
} from "../types/metaverse-runtime";
import {
  createMetaverseMountedInteractionHudSnapshot
} from "../states/metaverse-mounted-interaction-hud-snapshot";
import {
  createMetaverseMountedInteractionSnapshot
} from "../states/metaverse-mounted-interaction-snapshot";
import { MetaversePresenceRuntime } from "../classes/metaverse-presence-runtime";
import { MetaverseRemoteWorldRuntime } from "../classes/metaverse-remote-world-runtime";
import { MetaverseTraversalRuntime } from "../classes/metaverse-traversal-runtime";
import { MetaverseWeaponPresentationRuntime } from "../classes/metaverse-weapon-presentation-runtime";

interface MetaverseRendererTelemetrySource {
  readonly info?: {
    readonly render?: {
      readonly calls?: number;
      readonly drawCalls?: number;
      readonly triangles?: number;
    };
  };
}

interface MetaverseRuntimeHudPublisherDependencies {
  readonly devicePixelRatio: number;
  readonly initialControlMode: MetaverseControlModeId;
  readonly presenceRuntime: MetaversePresenceRuntime;
  readonly readNowMs: () => number;
  readonly remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly traversalRuntime: MetaverseTraversalRuntime;
  readonly weaponPresentationRuntime?: MetaverseWeaponPresentationRuntime;
}

interface PublishRuntimeHudSnapshotInput {
  readonly bootRendererInitialized: boolean;
  readonly bootScenePrewarmed: boolean;
  readonly cameraPhaseId: MetaverseHudSnapshot["cameraPhaseId"];
  readonly controlMode: MetaverseControlModeId;
  readonly failureReason: string | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly lifecycle: MetaverseHudSnapshot["lifecycle"];
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly renderedFrameCount: number;
  readonly renderer: MetaverseRendererTelemetrySource | null;
}

const metaverseUiUpdateIntervalMs = 16;
const metaverseRadarRangeMeters = 25;
const metaverseDamageIndicatorMaxAgeMs = 1_200;
const metaverseDamageIndicatorMaxEntries = 6;
const emptyCombatScoreboardSnapshot = Object.freeze({
  available: false,
  phase: null,
  scoreLimit: null,
  teams: Object.freeze([]),
  timeRemainingMs: null,
  winnerTeamId: null
} satisfies MetaverseHudSnapshot["combat"]["scoreboard"]);
const emptyInteractionSnapshot = Object.freeze({
  weaponResource: null
} satisfies MetaverseHudSnapshot["interaction"]);
const hiddenWeaponHudSnapshot = Object.freeze({
  adsTransitionMs: 0,
  aimMode: "hip-fire",
  reticleColor: "white",
  reticleId: "default-ring",
  reticleStyleId: "pistol-ring",
  visible: false,
  weaponId: null,
  weaponLabel: null
} satisfies MetaverseHudSnapshot["weapon"]);
const hiddenCombatHudSnapshot = Object.freeze({
  accuracyRatio: null,
  alive: true,
  ammoInMagazine: 0,
  ammoInReserve: 0,
  assists: 0,
  available: false,
  deaths: 0,
  damageIndicators: Object.freeze([]),
  enemyScore: null,
  friendlyFireEnabled: false,
  headshotKills: 0,
  health: 100,
  killFeed: Object.freeze([]),
  kills: 0,
  matchPhase: null,
  maxHealth: 100,
  reloadRemainingMs: 0,
  respawnRemainingMs: 0,
  scoreboard: emptyCombatScoreboardSnapshot,
  scoreLimit: null,
  shotsFired: 0,
  shotsHit: 0,
  spawnProtectionRemainingMs: 0,
  teamScore: null,
  timeRemainingMs: null,
  weaponId: null
} satisfies MetaverseHudSnapshot["combat"]);

function createEmptyRadarSnapshot(
  localTeamId: MetaverseHudSnapshot["radar"]["localTeamId"] = null
): MetaverseHudSnapshot["radar"] {
  return Object.freeze({
    available: false,
    enemyContacts: Object.freeze([]),
    friendlyContacts: Object.freeze([]),
    localTeamId,
    rangeMeters: metaverseRadarRangeMeters
  });
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function freezeRadarContactSnapshot(
  localYawRadians: number,
  localPosition: {
    readonly x: number;
    readonly z: number;
  },
  contactSnapshot: {
    readonly position: {
      readonly x: number;
      readonly z: number;
    };
    readonly teamId: MetaverseHudSnapshot["radar"]["enemyContacts"][number]["teamId"];
    readonly username: MetaverseHudSnapshot["radar"]["enemyContacts"][number]["username"];
  }
): MetaverseHudSnapshot["radar"]["enemyContacts"][number] | null {
  const deltaX = contactSnapshot.position.x - localPosition.x;
  const deltaZ = contactSnapshot.position.z - localPosition.z;
  const forwardX = Math.sin(localYawRadians);
  const forwardZ = -Math.cos(localYawRadians);
  const rightX = Math.cos(localYawRadians);
  const rightZ = Math.sin(localYawRadians);
  const rightOffset = deltaX * rightX + deltaZ * rightZ;
  const forwardOffset = deltaX * forwardX + deltaZ * forwardZ;
  const distanceMeters = Math.hypot(deltaX, deltaZ);

  if (distanceMeters > metaverseRadarRangeMeters) {
    return null;
  }

  return Object.freeze({
    clamped: false,
    distanceMeters,
    radarX: rightOffset / metaverseRadarRangeMeters,
    radarY: -forwardOffset / metaverseRadarRangeMeters,
    teamId: contactSnapshot.teamId,
    username: contactSnapshot.username
  });
}

function freezeDamageIndicatorSnapshot(
  localYawRadians: number,
  localPosition: {
    readonly x: number;
    readonly z: number;
  },
  sourcePosition: {
    readonly x: number;
    readonly z: number;
  } | null,
  damage: number,
  maxHealth: number,
  eventAgeMs: number,
  sequence: number
): MetaverseHudSnapshot["combat"]["damageIndicators"][number] | null {
  if (
    !Number.isFinite(eventAgeMs) ||
    eventAgeMs > metaverseDamageIndicatorMaxAgeMs
  ) {
    return null;
  }

  let directionX = 0;
  let directionY = -1;

  if (sourcePosition !== null) {
    const deltaX = sourcePosition.x - localPosition.x;
    const deltaZ = sourcePosition.z - localPosition.z;
    const forwardX = Math.sin(localYawRadians);
    const forwardZ = -Math.cos(localYawRadians);
    const rightX = Math.cos(localYawRadians);
    const rightZ = Math.sin(localYawRadians);
    const rightOffset = deltaX * rightX + deltaZ * rightZ;
    const forwardOffset = deltaX * forwardX + deltaZ * forwardZ;
    const distanceMeters = Math.hypot(deltaX, deltaZ);

    if (distanceMeters > 0.000001) {
      directionX = rightOffset / distanceMeters;
      directionY = -forwardOffset / distanceMeters;
    }
  }

  return Object.freeze({
    ageMs: eventAgeMs,
    damage,
    directionX,
    directionY,
    intensity: Math.max(
      0.2,
      clampUnit((damage / Math.max(1, maxHealth)) * 3.2)
    ),
    sequence
  });
}

function compareRadarContacts(
  leftContact: MetaverseHudSnapshot["radar"]["enemyContacts"][number],
  rightContact: MetaverseHudSnapshot["radar"]["enemyContacts"][number]
): number {
  if (leftContact.distanceMeters !== rightContact.distanceMeters) {
    return leftContact.distanceMeters - rightContact.distanceMeters;
  }

  return leftContact.username.localeCompare(rightContact.username);
}

function compareScoreboardPlayers(
  leftPlayer: MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number]["players"][number],
  rightPlayer: MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number]["players"][number]
): number {
  if (leftPlayer.kills !== rightPlayer.kills) {
    return rightPlayer.kills - leftPlayer.kills;
  }

  if (leftPlayer.assists !== rightPlayer.assists) {
    return rightPlayer.assists - leftPlayer.assists;
  }

  if (leftPlayer.deaths !== rightPlayer.deaths) {
    return leftPlayer.deaths - rightPlayer.deaths;
  }

  return leftPlayer.username.localeCompare(rightPlayer.username);
}

function compareScoreboardTeams(
  leftTeam: MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number],
  rightTeam: MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number],
  winnerTeamId: MetaverseHudSnapshot["combat"]["scoreboard"]["winnerTeamId"]
): number {
  if (winnerTeamId !== null) {
    if (leftTeam.teamId === winnerTeamId && rightTeam.teamId !== winnerTeamId) {
      return -1;
    }

    if (rightTeam.teamId === winnerTeamId && leftTeam.teamId !== winnerTeamId) {
      return 1;
    }
  }

  if (leftTeam.score !== rightTeam.score) {
    return rightTeam.score - leftTeam.score;
  }

  return leftTeam.teamId.localeCompare(rightTeam.teamId);
}

function createCombatScoreboardPlayerSnapshot(
  playerSnapshot: MetaverseRealtimePlayerSnapshot,
  localPlayerId: MetaversePlayerId
): MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number]["players"][number] {
  const combatSnapshot = playerSnapshot.combat;
  const shotsFired =
    combatSnapshot?.weaponStats.reduce(
      (totalShotsFired, weaponStats) => totalShotsFired + weaponStats.shotsFired,
      0
    ) ?? 0;
  const shotsHit =
    combatSnapshot?.weaponStats.reduce(
      (totalShotsHit, weaponStats) => totalShotsHit + weaponStats.shotsHit,
      0
    ) ?? 0;

  return Object.freeze({
    accuracyRatio:
      shotsFired > 0 ? Math.max(0, Math.min(1, shotsHit / shotsFired)) : null,
    alive: combatSnapshot?.alive ?? true,
    assists: combatSnapshot?.assists ?? 0,
    deaths: combatSnapshot?.deaths ?? 0,
    headshotKills: combatSnapshot?.headshotKills ?? 0,
    isLocalPlayer: playerSnapshot.playerId === localPlayerId,
    kills: combatSnapshot?.kills ?? 0,
    playerId: playerSnapshot.playerId,
    shotsFired,
    shotsHit,
    teamId: playerSnapshot.teamId,
    username: playerSnapshot.username
  });
}

function createCombatScoreboardSnapshot(
  worldSnapshot: MetaverseRealtimeWorldSnapshot,
  localPlayerId: MetaversePlayerId
): MetaverseHudSnapshot["combat"]["scoreboard"] {
  const matchSnapshot = worldSnapshot.combatMatch;

  if (matchSnapshot === null) {
    return emptyCombatScoreboardSnapshot;
  }

  const playersByTeamId = new Map<
    MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number]["teamId"],
    MetaverseRealtimePlayerSnapshot[]
  >();

  for (const playerSnapshot of worldSnapshot.players) {
    const teamPlayers = playersByTeamId.get(playerSnapshot.teamId);

    if (teamPlayers === undefined) {
      playersByTeamId.set(playerSnapshot.teamId, [playerSnapshot]);
    } else {
      teamPlayers.push(playerSnapshot);
    }
  }

  const scoreboardTeams = matchSnapshot.teams
    .map((teamSnapshot) => {
      const players = Object.freeze(
        (playersByTeamId.get(teamSnapshot.teamId) ?? [])
          .map((playerSnapshot) =>
            createCombatScoreboardPlayerSnapshot(playerSnapshot, localPlayerId)
          )
          .sort(compareScoreboardPlayers)
      );

      return Object.freeze({
        playerCount: players.length,
        players,
        score: teamSnapshot.score,
        teamId: teamSnapshot.teamId
      } satisfies MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number]);
    })
    .sort((leftTeam, rightTeam) =>
      compareScoreboardTeams(leftTeam, rightTeam, matchSnapshot.winnerTeamId)
    );

  return Object.freeze({
    available: true,
    phase: matchSnapshot.phase,
    scoreLimit: matchSnapshot.scoreLimit,
    teams: Object.freeze(scoreboardTeams),
    timeRemainingMs: Number(matchSnapshot.timeRemainingMs),
    winnerTeamId: matchSnapshot.winnerTeamId
  });
}

function readNearestWeaponResourceInteraction(input: {
  readonly localPlayerSnapshot: MetaverseRealtimePlayerSnapshot;
  readonly localPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly worldSnapshot: MetaverseRealtimeWorldSnapshot;
}): MetaverseHudSnapshot["interaction"]["weaponResource"] {
  if (
    input.mountedInteraction.mountedEnvironment !== null ||
    input.localPlayerSnapshot.combat?.alive === false
  ) {
    return null;
  }

  let nearestResource:
    | MetaverseHudSnapshot["interaction"]["weaponResource"]
    | null = null;
  const equippedWeaponIds = new Set(
    input.localPlayerSnapshot.weaponState?.slots
      .filter((slot) => slot.equipped)
      .map((slot) => slot.weaponId) ?? []
  );

  for (const resourceSpawn of input.worldSnapshot.resourceSpawns) {
    if (equippedWeaponIds.has(resourceSpawn.weaponId)) {
      continue;
    }

    const distanceMeters = Math.hypot(
      input.localPosition.x - resourceSpawn.position.x,
      input.localPosition.y - resourceSpawn.position.y,
      input.localPosition.z - resourceSpawn.position.z
    );

    if (
      distanceMeters > resourceSpawn.pickupRadiusMeters ||
      (nearestResource !== null &&
        distanceMeters >= nearestResource.distanceMeters)
    ) {
      continue;
    }

    nearestResource = Object.freeze({
      distanceMeters,
      weaponId: resourceSpawn.weaponId
    });
  }

  return nearestResource;
}

function createInteractionSnapshot(input: {
  readonly localPlayerSnapshot: MetaverseRealtimePlayerSnapshot | null;
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly traversalRuntime: MetaverseTraversalRuntime;
  readonly worldSnapshot: MetaverseRealtimeWorldSnapshot | null;
}): MetaverseHudSnapshot["interaction"] {
  const { localPlayerSnapshot, worldSnapshot } = input;

  if (localPlayerSnapshot === null || worldSnapshot === null) {
    return emptyInteractionSnapshot;
  }

  const localBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(localPlayerSnapshot);
  const localPosition =
    input.traversalRuntime.localTraversalPoseSnapshot?.position ??
    localBodySnapshot.position;
  const weaponResource = readNearestWeaponResourceInteraction({
    localPlayerSnapshot,
    localPosition,
    mountedInteraction: input.mountedInteraction,
    worldSnapshot
  });

  return weaponResource === null
    ? emptyInteractionSnapshot
    : Object.freeze({
        weaponResource
      });
}

function freezeHudSnapshot(
  lifecycle: MetaverseHudSnapshot["lifecycle"],
  failureReason: string | null,
  boot: MetaverseHudSnapshot["boot"],
  camera: MetaverseHudSnapshot["camera"],
  cameraPhaseId: MetaverseHudSnapshot["cameraPhaseId"],
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  mountedInteraction: MetaverseMountedInteractionSnapshot,
  interaction: MetaverseHudSnapshot["interaction"],
  controlMode: MetaverseHudSnapshot["controlMode"],
  combat: MetaverseHudSnapshot["combat"],
  locomotionMode: MetaverseHudSnapshot["locomotionMode"],
  presence: MetaverseHudSnapshot["presence"],
  radar: MetaverseHudSnapshot["radar"],
  telemetry: MetaverseHudSnapshot["telemetry"],
  transport: MetaverseHudSnapshot["transport"],
  weapon: MetaverseHudSnapshot["weapon"]
): MetaverseHudSnapshot {
  return Object.freeze({
    boot,
    camera,
    cameraPhaseId,
    combat,
    controlMode,
    failureReason,
    focusedPortal,
    lifecycle,
    locomotionMode,
    mountedInteraction,
    mountedInteractionHud:
      createMetaverseMountedInteractionHudSnapshot(mountedInteraction),
    interaction,
    presence,
    radar,
    telemetry,
    transport,
    weapon
  });
}

export class MetaverseRuntimeHudPublisher {
  readonly #devicePixelRatio: number;
  readonly #presenceRuntime: MetaversePresenceRuntime;
  readonly #readNowMs: () => number;
  readonly #remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly #traversalRuntime: MetaverseTraversalRuntime;
  readonly #weaponPresentationRuntime:
    | Pick<MetaverseWeaponPresentationRuntime, "hudSnapshot">
    | null;
  readonly #uiUpdateListeners = new Set<() => void>();

  #hudSnapshot: MetaverseHudSnapshot;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;

  constructor({
    devicePixelRatio,
    initialControlMode,
    presenceRuntime,
    readNowMs,
    remoteWorldRuntime,
    traversalRuntime,
    weaponPresentationRuntime
  }: MetaverseRuntimeHudPublisherDependencies) {
    this.#devicePixelRatio = devicePixelRatio;
    this.#presenceRuntime = presenceRuntime;
    this.#readNowMs = readNowMs;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
    this.#weaponPresentationRuntime = weaponPresentationRuntime ?? null;
    this.#hudSnapshot = freezeHudSnapshot(
      "idle",
      null,
      Object.freeze({
        authoritativeWorldConnected: false,
        phase: "idle",
        presenceJoined: false,
        rendererInitialized: false,
        scenePrewarmed: false
      }),
	      this.#traversalRuntime.cameraSnapshot,
      null,
	      null,
	      createMetaverseMountedInteractionSnapshot(null, null),
	      emptyInteractionSnapshot,
	      initialControlMode,
	      hiddenCombatHudSnapshot,
      this.#traversalRuntime.locomotionMode,
      this.#presenceRuntime.resolveHudSnapshot(),
      createEmptyRadarSnapshot(this.#presenceRuntime.localTeamId),
      this.#createTelemetrySnapshot({
        frameDeltaMs: 0,
        frameRate: 0,
        renderedFrameCount: 0,
        renderer: null
      }),
      this.#createTransportSnapshot(),
      this.#createWeaponSnapshot()
    );
  }

  get hudSnapshot(): MetaverseHudSnapshot {
    return this.#hudSnapshot;
  }

  subscribeUiUpdates(listener: () => void): () => void {
    this.#uiUpdateListeners.add(listener);

    return () => {
      this.#uiUpdateListeners.delete(listener);
    };
  }

  resetTelemetryState(): void {
    this.#lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  }

  publishSnapshot(
    input: PublishRuntimeHudSnapshotInput,
    forceUiUpdate: boolean,
    nowMs: number | null = null
  ): void {
    const resolvedNowMs = nowMs ?? this.#readNowMs();
    const presenceSnapshot = this.#presenceRuntime.resolveHudSnapshot();
    const worldSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeWorldSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );
    const localPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    this.#hudSnapshot = freezeHudSnapshot(
      input.lifecycle,
      input.failureReason,
      this.#createBootSnapshot(
        input.lifecycle,
        input.bootRendererInitialized,
        input.bootScenePrewarmed
      ),
      this.#traversalRuntime.cameraSnapshot,
      input.cameraPhaseId,
      input.focusedPortal,
      input.mountedInteraction,
      createInteractionSnapshot({
        localPlayerSnapshot,
        mountedInteraction: input.mountedInteraction,
        traversalRuntime: this.#traversalRuntime,
        worldSnapshot
      }),
      input.controlMode,
      this.#createCombatSnapshot(presenceSnapshot, worldSnapshot, localPlayerSnapshot),
      this.#traversalRuntime.locomotionMode,
      presenceSnapshot,
      this.#createRadarSnapshot(presenceSnapshot),
      this.#createTelemetrySnapshot({
        frameDeltaMs: input.frameDeltaMs,
        frameRate: input.frameRate,
        renderedFrameCount: input.renderedFrameCount,
        renderer: input.renderer
      }),
      this.#createTransportSnapshot(),
      this.#createWeaponSnapshot()
    );

    if (
      !forceUiUpdate &&
      resolvedNowMs - this.#lastUiUpdateAtMs < metaverseUiUpdateIntervalMs
    ) {
      return;
    }

    this.#lastUiUpdateAtMs = resolvedNowMs;

    for (const listener of this.#uiUpdateListeners) {
      listener();
    }
  }

  #createTelemetrySnapshot(input: {
    readonly frameDeltaMs: number;
    readonly frameRate: number;
    readonly renderedFrameCount: number;
    readonly renderer: MetaverseRendererTelemetrySource | null;
  }): MetaverseHudSnapshot["telemetry"] {
    const renderInfo = input.renderer?.info?.render;

    return Object.freeze({
      frameDeltaMs: input.frameDeltaMs,
      frameRate: input.frameRate,
      renderedFrameCount: input.renderedFrameCount,
      renderer: Object.freeze({
        active: input.renderer !== null,
        devicePixelRatio: this.#devicePixelRatio,
        drawCallCount: renderInfo?.drawCalls ?? renderInfo?.calls ?? 0,
        label: "WebGPU",
        triangleCount: renderInfo?.triangles ?? 0
      })
    });
  }

  #createBootSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    bootRendererInitialized: boolean,
    bootScenePrewarmed: boolean
  ): MetaverseHudSnapshot["boot"] {
    const presenceJoined = this.#presenceRuntime.isJoined;
    const authoritativeWorldConnected = this.#remoteWorldRuntime.isConnected;
    const presenceReady =
      !this.#presenceRuntime.connectionRequired || presenceJoined;
    const authoritativeWorldReady =
      !this.#remoteWorldRuntime.connectionRequired ||
      authoritativeWorldConnected;
    let phase: MetaverseHudSnapshot["boot"]["phase"];

    if (lifecycle === "failed") {
      phase = "failed";
    } else if (lifecycle === "idle") {
      phase = "idle";
    } else if (!bootRendererInitialized) {
      phase = "renderer-init";
    } else if (!bootScenePrewarmed) {
      phase = "scene-prewarm";
    } else if (!presenceReady) {
      phase = "presence-joining";
    } else if (!authoritativeWorldReady) {
      phase = "world-connecting";
    } else {
      phase = "ready";
    }

    return Object.freeze({
      authoritativeWorldConnected,
      phase,
      presenceJoined,
      rendererInitialized: bootRendererInitialized,
      scenePrewarmed: bootScenePrewarmed
    });
  }

  #createTransportSnapshot(): MetaverseHudSnapshot["transport"] {
    return Object.freeze({
      presenceReliable: this.#presenceRuntime.reliableTransportStatusSnapshot,
      worldDriverDatagram:
        this.#remoteWorldRuntime.driverVehicleControlDatagramStatusSnapshot,
      worldReliable: this.#remoteWorldRuntime.reliableTransportStatusSnapshot,
      worldSnapshotStream: this.#remoteWorldRuntime.snapshotStreamTelemetrySnapshot
    });
  }

  #createWeaponSnapshot(): MetaverseHudSnapshot["weapon"] {
    return this.#weaponPresentationRuntime?.hudSnapshot ?? hiddenWeaponHudSnapshot;
  }

	  #createCombatSnapshot(
	    presenceSnapshot: MetaverseHudSnapshot["presence"],
	    worldSnapshot: MetaverseRealtimeWorldSnapshot | null,
	    localPlayerSnapshot: MetaverseRealtimePlayerSnapshot | null
	  ): MetaverseHudSnapshot["combat"] {
    const combatSnapshot = localPlayerSnapshot?.combat ?? null;

    if (worldSnapshot === null || localPlayerSnapshot === null || combatSnapshot === null) {
      return hiddenCombatHudSnapshot;
    }

    const activeWeaponSnapshot = combatSnapshot.activeWeapon;
    const presentationWeaponId =
      this.#weaponPresentationRuntime?.hudSnapshot.visible === true
        ? this.#weaponPresentationRuntime.hudSnapshot.weaponId
        : null;
    const weaponInventory = combatSnapshot.weaponInventory ?? [];
    const displayedWeaponSnapshot =
      presentationWeaponId === null
        ? activeWeaponSnapshot
        : weaponInventory.find(
            (weaponSnapshot) => weaponSnapshot.weaponId === presentationWeaponId
          ) ??
          (activeWeaponSnapshot?.weaponId === presentationWeaponId
            ? activeWeaponSnapshot
            : null) ??
          activeWeaponSnapshot;
    const displayedWeaponStats =
      displayedWeaponSnapshot === null
        ? null
        : combatSnapshot.weaponStats.find(
            (weaponStats) =>
              weaponStats.weaponId === displayedWeaponSnapshot.weaponId
          ) ?? null;
    const localTeamId = localPlayerSnapshot.teamId ?? presenceSnapshot.localTeamId;
    const matchSnapshot = worldSnapshot.combatMatch;
    const localTeamSnapshot =
      localTeamId === null || matchSnapshot === null
        ? null
        : matchSnapshot.teams.find((teamSnapshot) => teamSnapshot.teamId === localTeamId) ??
          null;
    const enemyTeamSnapshot =
      localTeamId === null || matchSnapshot === null
        ? null
        : matchSnapshot.teams.find((teamSnapshot) => teamSnapshot.teamId !== localTeamId) ??
          null;
    const playerSnapshotById = new Map(
      worldSnapshot.players.map((playerSnapshot) => [
        playerSnapshot.playerId,
        playerSnapshot
      ])
    );
    const summarizePlayer = (playerId: typeof localPlayerSnapshot.playerId): string =>
      playerId === localPlayerSnapshot.playerId
        ? "You"
        : playerSnapshotById.get(playerId)?.username ?? playerId;
    const killFeed = Object.freeze(
      worldSnapshot.combatFeed.slice(-4).map((eventSnapshot) => {
        const eventAgeMs = Math.max(
          0,
          Number(worldSnapshot.tick.simulationTimeMs) - Number(eventSnapshot.timeMs)
        );

        switch (eventSnapshot.type) {
          case "damage":
            return Object.freeze({
              ageMs: eventAgeMs,
              local:
                eventSnapshot.attackerPlayerId === localPlayerSnapshot.playerId ||
                eventSnapshot.targetPlayerId === localPlayerSnapshot.playerId,
              sequence: eventSnapshot.sequence,
              summary: `${summarizePlayer(eventSnapshot.attackerPlayerId)} hit ${summarizePlayer(eventSnapshot.targetPlayerId)} for ${eventSnapshot.damage}`,
              type: eventSnapshot.type
            });
          case "kill":
            return Object.freeze({
              ageMs: eventAgeMs,
              local:
                eventSnapshot.attackerPlayerId === localPlayerSnapshot.playerId ||
                eventSnapshot.targetPlayerId === localPlayerSnapshot.playerId,
              sequence: eventSnapshot.sequence,
              summary:
                eventSnapshot.attackerPlayerId === eventSnapshot.targetPlayerId
                  ? `${summarizePlayer(eventSnapshot.targetPlayerId)} fell`
                  : eventSnapshot.attackerPlayerId === localPlayerSnapshot.playerId
                    ? `You killed ${summarizePlayer(eventSnapshot.targetPlayerId)}${eventSnapshot.headshot ? " (headshot)" : ""}`
                    : eventSnapshot.targetPlayerId === localPlayerSnapshot.playerId
                      ? `You were killed by ${summarizePlayer(eventSnapshot.attackerPlayerId)}${eventSnapshot.headshot ? " (headshot)" : ""}`
                      : `${summarizePlayer(eventSnapshot.targetPlayerId)} was killed by ${summarizePlayer(eventSnapshot.attackerPlayerId)}${eventSnapshot.headshot ? " (headshot)" : ""}`,
              type: eventSnapshot.type
            });
          case "spawn":
            return Object.freeze({
              ageMs: eventAgeMs,
              local: eventSnapshot.playerId === localPlayerSnapshot.playerId,
              sequence: eventSnapshot.sequence,
              summary: `${summarizePlayer(eventSnapshot.playerId)} spawned`,
              type: eventSnapshot.type
            });
        }
      })
    );
    const localBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(localPlayerSnapshot);
    const localDamagePosition =
      this.#traversalRuntime.localTraversalPoseSnapshot?.position ??
      localBodySnapshot.position;
    const localDamageYawRadians = this.#traversalRuntime.cameraSnapshot.yawRadians;
    const damageIndicatorSnapshots: MetaverseHudSnapshot["combat"]["damageIndicators"][number][] =
      [];

    for (
      let eventIndex = worldSnapshot.combatFeed.length - 1;
      eventIndex >= 0 &&
      damageIndicatorSnapshots.length < metaverseDamageIndicatorMaxEntries;
      eventIndex -= 1
    ) {
      const eventSnapshot = worldSnapshot.combatFeed[eventIndex];

      if (
        eventSnapshot === undefined ||
        eventSnapshot.type !== "damage" ||
        eventSnapshot.targetPlayerId !== localPlayerSnapshot.playerId
      ) {
        continue;
      }

      const eventAgeMs = Math.max(
        0,
        Number(worldSnapshot.tick.simulationTimeMs) - Number(eventSnapshot.timeMs)
      );
      const attackerPlayerSnapshot =
        playerSnapshotById.get(eventSnapshot.attackerPlayerId) ?? null;
      const attackerBodyPosition =
        attackerPlayerSnapshot === null
          ? null
          : readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
              attackerPlayerSnapshot
            ).position;
      const damageIndicatorSnapshot = freezeDamageIndicatorSnapshot(
        localDamageYawRadians,
        localDamagePosition,
        attackerBodyPosition,
        eventSnapshot.damage,
        combatSnapshot.maxHealth,
        eventAgeMs,
        eventSnapshot.sequence
      );

      if (damageIndicatorSnapshot !== null) {
        damageIndicatorSnapshots.push(damageIndicatorSnapshot);
      }
    }

    const damageIndicators = Object.freeze(damageIndicatorSnapshots);
    const shotsFired = displayedWeaponStats?.shotsFired ?? 0;
    const shotsHit = displayedWeaponStats?.shotsHit ?? 0;

    return Object.freeze({
      accuracyRatio:
        shotsFired > 0 ? Math.max(0, Math.min(1, shotsHit / shotsFired)) : null,
      alive: combatSnapshot.alive,
      ammoInMagazine: displayedWeaponSnapshot?.ammoInMagazine ?? 0,
      ammoInReserve: displayedWeaponSnapshot?.ammoInReserve ?? 0,
      assists: combatSnapshot.assists,
      available: true,
      deaths: combatSnapshot.deaths,
      damageIndicators,
      enemyScore: enemyTeamSnapshot?.score ?? null,
      friendlyFireEnabled: matchSnapshot?.friendlyFireEnabled ?? false,
      headshotKills: combatSnapshot.headshotKills,
      health: combatSnapshot.health,
      killFeed,
      kills: combatSnapshot.kills,
      matchPhase: matchSnapshot?.phase ?? null,
      maxHealth: combatSnapshot.maxHealth,
      reloadRemainingMs: Number(displayedWeaponSnapshot?.reloadRemainingMs ?? 0),
      respawnRemainingMs: Number(combatSnapshot.respawnRemainingMs),
      scoreboard: createCombatScoreboardSnapshot(
        worldSnapshot,
        localPlayerSnapshot.playerId
      ),
      scoreLimit: matchSnapshot?.scoreLimit ?? null,
      shotsFired,
      shotsHit,
      spawnProtectionRemainingMs: Number(combatSnapshot.spawnProtectionRemainingMs),
      teamScore: localTeamSnapshot?.score ?? null,
      timeRemainingMs:
        matchSnapshot === null ? null : Number(matchSnapshot.timeRemainingMs),
      weaponId: displayedWeaponSnapshot?.weaponId ?? null
    });
  }

  #createRadarSnapshot(
    presenceSnapshot: MetaverseHudSnapshot["presence"]
  ): MetaverseHudSnapshot["radar"] {
    const localPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );
    const localTeamId = localPlayerSnapshot?.teamId ?? presenceSnapshot.localTeamId;

    if (localPlayerSnapshot === null || localTeamId === null) {
      return createEmptyRadarSnapshot(localTeamId);
    }

    const localBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(localPlayerSnapshot);
    const localRadarPosition =
      this.#traversalRuntime.localTraversalPoseSnapshot?.position ??
      localBodySnapshot.position;
    const localRadarYawRadians = this.#traversalRuntime.cameraSnapshot.yawRadians;
    const remoteCharacterPresentations =
      this.#remoteWorldRuntime.remoteCharacterPresentations;
    const friendlyContacts = Object.freeze(
      remoteCharacterPresentations
        .filter((playerSnapshot) => playerSnapshot.teamId === localTeamId)
        .map((playerSnapshot) =>
          freezeRadarContactSnapshot(
            localRadarYawRadians,
            localRadarPosition,
            {
              position: playerSnapshot.presentation.position,
              teamId: playerSnapshot.teamId,
              username: playerSnapshot.username
            }
          )
        )
        .filter(
          (
            contact
          ): contact is NonNullable<typeof contact> => contact !== null
        )
        .sort(compareRadarContacts)
    );
    const enemyContacts = Object.freeze(
      remoteCharacterPresentations
        .filter((playerSnapshot) => playerSnapshot.teamId !== localTeamId)
        .map((playerSnapshot) =>
          freezeRadarContactSnapshot(
            localRadarYawRadians,
            localRadarPosition,
            {
              position: playerSnapshot.presentation.position,
              teamId: playerSnapshot.teamId,
              username: playerSnapshot.username
            }
          )
        )
        .filter(
          (
            contact
          ): contact is NonNullable<typeof contact> => contact !== null
        )
        .sort(compareRadarContacts)
    );

    return Object.freeze({
      available: true,
      enemyContacts,
      friendlyContacts,
      localTeamId,
      rangeMeters: metaverseRadarRangeMeters
    });
  }
}
