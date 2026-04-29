import type {
  MetaverseCombatAimSnapshotInput,
  MetaverseCombatMatchPhaseId,
  MetaversePlayerActionReceiptSnapshot,
  MetaversePlayerCombatSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";
import {
  readMetaverseCombatWeaponProfile
} from "@webgpu-metaverse/shared";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";

import type { MetaverseWorldClientRuntime } from "@/network";

interface MetaverseFireWeaponActionPolicyDependencies {
  readonly readEstimatedServerTimeMs: (localWallClockMs: number) => number;
  readonly readLocalPlayerId: () => MetaversePlayerId | null;
  readonly readWallClockMs: () => number;
  readonly readWorldClient: () => MetaverseWorldClientRuntime | null;
}

function resolveMillisecondsPerShot(weaponId: string): number | null {
  try {
    const weaponProfile = readMetaverseCombatWeaponProfile(weaponId);

    if (weaponProfile.roundsPerMinute <= 0) {
      return null;
    }

    return 60_000 / weaponProfile.roundsPerMinute;
  } catch {
    return null;
  }
}

function readLatestLocalPlayerWorldSnapshot(
  worldSnapshot: MetaverseRealtimeWorldSnapshot,
  playerId: MetaversePlayerId
): {
  readonly combat: MetaversePlayerCombatSnapshot | null;
  readonly combatMatchPhase: MetaverseCombatMatchPhaseId | null;
  readonly highestProcessedPlayerActionSequence: number;
  readonly mountedOccupancy:
    | MetaverseRealtimeWorldSnapshot["players"][number]["mountedOccupancy"]
    | null;
  readonly recentPlayerActionReceipts:
    readonly MetaversePlayerActionReceiptSnapshot[];
} | null {
  const observerPlayerSnapshot = worldSnapshot.observerPlayer;
  const playerSnapshot =
    worldSnapshot.players.find(
      (candidatePlayerSnapshot) => candidatePlayerSnapshot.playerId === playerId
    ) ?? null;

  if (
    observerPlayerSnapshot === null ||
    observerPlayerSnapshot.playerId !== playerId ||
    playerSnapshot === null
  ) {
    return null;
  }

  return Object.freeze({
    combat: playerSnapshot.combat,
    combatMatchPhase: worldSnapshot.combatMatch?.phase ?? null,
    highestProcessedPlayerActionSequence:
      observerPlayerSnapshot.highestProcessedPlayerActionSequence,
    mountedOccupancy: playerSnapshot.mountedOccupancy ?? null,
    recentPlayerActionReceipts: observerPlayerSnapshot.recentPlayerActionReceipts
  });
}

interface PendingLocalFireAttempt {
  readonly actionSequence: number;
  readonly issuedAtAuthoritativeTimeMs: number;
}

interface PendingLocalWeaponSwitch {
  readonly actionSequence: number;
}

export class MetaverseFireWeaponActionPolicy {
  readonly #readEstimatedServerTimeMs:
    MetaverseFireWeaponActionPolicyDependencies["readEstimatedServerTimeMs"];
  readonly #readLocalPlayerId:
    MetaverseFireWeaponActionPolicyDependencies["readLocalPlayerId"];
  readonly #readWallClockMs:
    MetaverseFireWeaponActionPolicyDependencies["readWallClockMs"];
  readonly #readWorldClient:
    MetaverseFireWeaponActionPolicyDependencies["readWorldClient"];

  readonly #pendingLocalFireAttemptsByWeaponId = new Map<
    string,
    PendingLocalFireAttempt[]
  >();
  readonly #pendingLocalWeaponSwitchesByWeaponId = new Map<
    string,
    PendingLocalWeaponSwitch[]
  >();

  constructor(dependencies: MetaverseFireWeaponActionPolicyDependencies) {
    this.#readEstimatedServerTimeMs = dependencies.readEstimatedServerTimeMs;
    this.#readLocalPlayerId = dependencies.readLocalPlayerId;
    this.#readWallClockMs = dependencies.readWallClockMs;
    this.#readWorldClient = dependencies.readWorldClient;
  }

  registerPendingFireAction(input: {
    readonly actionSequence: number;
    readonly issuedAtAuthoritativeTimeMs: number;
    readonly weaponId: string;
  }): void {
    const pendingFireAttempts =
      this.#pendingLocalFireAttemptsByWeaponId.get(input.weaponId) ?? [];

    pendingFireAttempts.push({
      actionSequence: Math.max(0, Math.trunc(input.actionSequence)),
      issuedAtAuthoritativeTimeMs: Number(input.issuedAtAuthoritativeTimeMs)
    });
    this.#pendingLocalFireAttemptsByWeaponId.set(
      input.weaponId,
      pendingFireAttempts
    );
  }

  registerPendingWeaponSwitchAction(input: {
    readonly actionSequence: number;
    readonly weaponId: string;
  }): void {
    const pendingWeaponSwitches =
      this.#pendingLocalWeaponSwitchesByWeaponId.get(input.weaponId) ?? [];

    pendingWeaponSwitches.push({
      actionSequence: Math.max(0, Math.trunc(input.actionSequence))
    });
    this.#pendingLocalWeaponSwitchesByWeaponId.set(
      input.weaponId,
      pendingWeaponSwitches
    );
  }

  createFireWeaponAction(input: {
    readonly aimMode?: "ads" | "hip-fire";
    readonly aimSnapshot: MetaverseCombatAimSnapshotInput;
    readonly weaponId: string;
  }): {
    readonly aimMode?: "ads" | "hip-fire";
    readonly aimSnapshot: MetaverseCombatAimSnapshotInput;
    readonly issuedAtAuthoritativeTimeMs: number;
    readonly weaponId: string;
  } | null {
    const issuedAtAuthoritativeTimeMs = Math.max(
      0,
      this.#readEstimatedServerTimeMs(this.#readWallClockMs())
    );
    const worldClient = this.#readWorldClient();
    const playerId = this.#readLocalPlayerId();

    if (worldClient === null || playerId === null) {
      return null;
    }

    const millisecondsPerShot = resolveMillisecondsPerShot(input.weaponId);

    if (millisecondsPerShot === null) {
      return null;
    }

    const latestWorldSnapshot =
      worldClient.worldSnapshotBuffer[worldClient.worldSnapshotBuffer.length - 1] ??
      null;

    if (latestWorldSnapshot !== null) {
      const localPlayerSnapshot = readLatestLocalPlayerWorldSnapshot(
        latestWorldSnapshot,
        playerId
      );

      if (localPlayerSnapshot !== null) {
        this.#retirePendingLocalActions(localPlayerSnapshot);

        if (
          localPlayerSnapshot.combatMatchPhase !== null &&
          localPlayerSnapshot.combatMatchPhase !== "active"
        ) {
          return null;
        }

        if (localPlayerSnapshot.mountedOccupancy !== null) {
          return null;
        }

        const combatSnapshot = localPlayerSnapshot.combat;

        if (combatSnapshot !== null) {
          const pendingWeaponSwitch =
            this.#hasPendingWeaponSwitch(input.weaponId);
          const weaponInventory = combatSnapshot.weaponInventory ?? [];
          const selectedWeapon =
            combatSnapshot.activeWeapon?.weaponId === input.weaponId
              ? combatSnapshot.activeWeapon
              : weaponInventory.find(
                  (weaponSnapshot) => weaponSnapshot.weaponId === input.weaponId
                ) ?? null;

          if (
            !combatSnapshot.alive ||
            Number(combatSnapshot.spawnProtectionRemainingMs) > 0 ||
            (selectedWeapon === null && !pendingWeaponSwitch) ||
            (selectedWeapon !== null &&
              combatSnapshot.activeWeapon?.weaponId !== input.weaponId &&
              !pendingWeaponSwitch) ||
            (selectedWeapon !== null &&
              (Number(selectedWeapon.reloadRemainingMs) > 0 ||
                selectedWeapon.ammoInMagazine <= 0))
          ) {
            return null;
          }
        }

        const latestAcceptedFireReceipt =
          localPlayerSnapshot.recentPlayerActionReceipts
            .toReversed()
            .find(
              (receiptSnapshot) =>
                receiptSnapshot.kind === "fire-weapon" &&
                receiptSnapshot.status === "accepted" &&
                receiptSnapshot.weaponId === input.weaponId
            ) ?? null;

        if (
          millisecondsPerShot !== null &&
          latestAcceptedFireReceipt !== null &&
          issuedAtAuthoritativeTimeMs -
            Number(latestAcceptedFireReceipt.processedAtTimeMs) +
            0.0001 <
            millisecondsPerShot
        ) {
          return null;
        }

        const latestPendingFireAttempt =
          this.#readLatestPendingFireAttempt(input.weaponId);

        if (
          latestPendingFireAttempt !== null &&
          issuedAtAuthoritativeTimeMs -
            latestPendingFireAttempt.issuedAtAuthoritativeTimeMs +
            0.0001 <
            millisecondsPerShot
        ) {
          return null;
        }
      }
    }

    return Object.freeze({
      ...(input.aimMode === undefined
        ? {}
        : {
            aimMode: input.aimMode
          }),
      aimSnapshot: input.aimSnapshot,
      issuedAtAuthoritativeTimeMs,
      weaponId: input.weaponId
    });
  }

  #readLatestPendingFireAttempt(
    weaponId: string
  ): PendingLocalFireAttempt | null {
    const pendingFireAttempts =
      this.#pendingLocalFireAttemptsByWeaponId.get(weaponId) ?? [];

    return pendingFireAttempts[pendingFireAttempts.length - 1] ?? null;
  }

  #hasPendingWeaponSwitch(weaponId: string): boolean {
    return (
      (this.#pendingLocalWeaponSwitchesByWeaponId.get(weaponId)?.length ?? 0) > 0
    );
  }

  #retirePendingLocalActions(localPlayerSnapshot: {
    readonly highestProcessedPlayerActionSequence: number;
    readonly recentPlayerActionReceipts:
      readonly MetaversePlayerActionReceiptSnapshot[];
  }): void {
    const acknowledgedActionSequences = new Set(
      localPlayerSnapshot.recentPlayerActionReceipts.map(
        (receiptSnapshot) => receiptSnapshot.actionSequence
      )
    );

    for (const [
      weaponId,
      pendingFireAttempts
    ] of this.#pendingLocalFireAttemptsByWeaponId) {
      const retainedFireAttempts = pendingFireAttempts.filter(
        (pendingFireAttempt) =>
          pendingFireAttempt.actionSequence >
            localPlayerSnapshot.highestProcessedPlayerActionSequence &&
          !acknowledgedActionSequences.has(pendingFireAttempt.actionSequence)
      );

      if (retainedFireAttempts.length === 0) {
        this.#pendingLocalFireAttemptsByWeaponId.delete(weaponId);
        continue;
      }

      this.#pendingLocalFireAttemptsByWeaponId.set(
        weaponId,
        retainedFireAttempts
      );
    }

    for (const [
      weaponId,
      pendingWeaponSwitches
    ] of this.#pendingLocalWeaponSwitchesByWeaponId) {
      const retainedWeaponSwitches = pendingWeaponSwitches.filter(
        (pendingWeaponSwitch) =>
          pendingWeaponSwitch.actionSequence >
            localPlayerSnapshot.highestProcessedPlayerActionSequence &&
          !acknowledgedActionSequences.has(pendingWeaponSwitch.actionSequence)
      );

      if (retainedWeaponSwitches.length === 0) {
        this.#pendingLocalWeaponSwitchesByWeaponId.delete(weaponId);
        continue;
      }

      this.#pendingLocalWeaponSwitchesByWeaponId.set(
        weaponId,
        retainedWeaponSwitches
      );
    }
  }
}
