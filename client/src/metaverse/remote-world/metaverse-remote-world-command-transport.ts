import type {
  MetaverseCombatAimSnapshotInput,
  MetaverseWeaponSlotId
} from "@webgpu-metaverse/shared";
import type {
  MetaversePlayerTraversalIntentSnapshotInput,
  MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type {
  MetaverseCameraSnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";
import type { MetaverseLocalPlayerIdentity } from "../classes/metaverse-presence-runtime";
import type {
  MetaverseIssuedTraversalIntentInputSnapshot,
  RoutedDriverVehicleControlIntentSnapshot
} from "../traversal/types/traversal";
import type { MetaverseWorldClientRuntime } from "@/network";
import { MetaverseFireWeaponActionPolicy } from "./metaverse-fire-weapon-action-policy";

interface MetaverseRemoteWorldCommandTransportDependencies {
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly readEstimatedServerTimeMs: (localWallClockMs: number) => number;
  readonly readWallClockMs: () => number;
  readonly readWorldClient: () => MetaverseWorldClientRuntime | null;
}

export class MetaverseRemoteWorldCommandTransport {
  readonly #fireWeaponActionPolicy: MetaverseFireWeaponActionPolicy;
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #readEstimatedServerTimeMs: (localWallClockMs: number) => number;
  readonly #readWallClockMs: () => number;
  readonly #readWorldClient: () => MetaverseWorldClientRuntime | null;

  constructor({
    localPlayerIdentity,
    readEstimatedServerTimeMs,
    readWallClockMs,
    readWorldClient
  }: MetaverseRemoteWorldCommandTransportDependencies) {
    this.#fireWeaponActionPolicy = new MetaverseFireWeaponActionPolicy({
      readEstimatedServerTimeMs,
      readLocalPlayerId: () => this.#localPlayerIdentity?.playerId ?? null,
      readWallClockMs,
      readWorldClient
    });
    this.#localPlayerIdentity = localPlayerIdentity;
    this.#readEstimatedServerTimeMs = readEstimatedServerTimeMs;
    this.#readWallClockMs = readWallClockMs;
    this.#readWorldClient = readWorldClient;
  }

  syncLocalDriverVehicleControl(
    controlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null
  ): void {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      return;
    }

    if (controlIntentSnapshot === null) {
      worldClient.syncDriverVehicleControl(null);
      return;
    }

    worldClient.syncDriverVehicleControl({
      controlIntent: {
        boost: controlIntentSnapshot.controlIntent.boost,
        environmentAssetId: controlIntentSnapshot.environmentAssetId,
        moveAxis: controlIntentSnapshot.controlIntent.moveAxis,
        strafeAxis: controlIntentSnapshot.controlIntent.strafeAxis,
        yawAxis: controlIntentSnapshot.controlIntent.yawAxis
      },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  syncMountedOccupancy(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      return;
    }

    worldClient.syncMountedOccupancy({
      mountedOccupancy:
        mountedEnvironment === null
          ? null
          : {
              environmentAssetId: mountedEnvironment.environmentAssetId,
              entryId: mountedEnvironment.entryId,
              occupancyKind: mountedEnvironment.occupancyKind,
              occupantRole: mountedEnvironment.occupantRole,
              seatId: mountedEnvironment.seatId
            },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  syncLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): MetaverseIssuedTraversalIntentInputSnapshot | null {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      worldClient?.syncPlayerTraversalIntent(null);
      return null;
    }

    if (traversalIntentInput === null) {
      worldClient.syncPlayerTraversalIntent(null);
      return null;
    }

    return worldClient.syncPlayerTraversalIntent({
      intent: traversalIntentInput,
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  previewLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): MetaverseIssuedTraversalIntentInputSnapshot | null {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      return null;
    }

    if (traversalIntentInput === null) {
      return null;
    }

    return worldClient.previewPlayerTraversalIntent({
      intent: traversalIntentInput,
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  syncLocalPlayerLook(
    lookSnapshot:
      | Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">
      | null
  ): void {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      worldClient?.syncPlayerLookIntent(null);
      return;
    }

    if (lookSnapshot === null) {
      worldClient.syncPlayerLookIntent(null);
      return;
    }

    worldClient.syncPlayerLookIntent({
      lookIntent: {
        pitchRadians: lookSnapshot.pitchRadians,
        yawRadians: lookSnapshot.yawRadians
      },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  syncLocalPlayerWeaponState(
    weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null
  ): void {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      worldClient?.syncPlayerWeaponState?.(null);
      return;
    }

    worldClient.syncPlayerWeaponState?.({
      playerId: this.#localPlayerIdentity.playerId,
      requestedActiveSlotId: weaponState?.activeSlotId ?? null,
      weaponState
    });
  }

  fireWeapon(input: {
    readonly aimMode?: "ads" | "hip-fire";
    readonly aimSnapshot: MetaverseCombatAimSnapshotInput;
    readonly weaponId: string;
  }): {
    readonly actionSequence: number;
    readonly issuedAtAuthoritativeTimeMs: number;
    readonly weaponId: string;
  } | null {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      return null;
    }

    const fireWeaponAction =
      this.#fireWeaponActionPolicy.createFireWeaponAction(input);

    if (fireWeaponAction === null) {
      return null;
    }

    if (worldClient.issuePlayerAction === undefined) {
      return null;
    }

    const actionSequence = worldClient.issuePlayerAction({
      action: {
        ...(fireWeaponAction.aimMode === undefined
          ? {}
          : {
              aimMode: fireWeaponAction.aimMode
            }),
        aimSnapshot: fireWeaponAction.aimSnapshot,
        issuedAtAuthoritativeTimeMs:
          fireWeaponAction.issuedAtAuthoritativeTimeMs,
        kind: "fire-weapon",
        weaponId: fireWeaponAction.weaponId
      },
      playerId: this.#localPlayerIdentity.playerId
    });

    if (actionSequence === null || actionSequence === undefined) {
      return null;
    }

    this.#fireWeaponActionPolicy.registerPendingFireAction({
      actionSequence,
      issuedAtAuthoritativeTimeMs:
        fireWeaponAction.issuedAtAuthoritativeTimeMs,
      weaponId: fireWeaponAction.weaponId
    });

    return Object.freeze({
      actionSequence,
      issuedAtAuthoritativeTimeMs:
        fireWeaponAction.issuedAtAuthoritativeTimeMs,
      weaponId: fireWeaponAction.weaponId
    });
  }

  switchActiveWeaponSlot(input: {
    readonly intendedWeaponId?: string | null;
    readonly intendedWeaponInstanceId?: string | null;
    readonly requestedActiveSlotId: MetaverseWeaponSlotId;
  }): {
    readonly actionSequence: number;
    readonly requestedActiveSlotId: MetaverseWeaponSlotId;
  } | null {
    const worldClient = this.#readWorldClient();

    if (
      worldClient === null ||
      this.#localPlayerIdentity === null ||
      worldClient.issuePlayerAction === undefined
    ) {
      return null;
    }

    const actionSequence = worldClient.issuePlayerAction({
      action: {
        ...(input.intendedWeaponInstanceId === undefined ||
        input.intendedWeaponInstanceId === null
          ? {}
          : {
              intendedWeaponInstanceId: input.intendedWeaponInstanceId
            }),
        issuedAtAuthoritativeTimeMs: this.#readEstimatedServerTimeMs(
          this.#readWallClockMs()
        ),
        kind: "switch-active-weapon-slot",
        requestedActiveSlotId: input.requestedActiveSlotId
      },
      playerId: this.#localPlayerIdentity.playerId
    });

    if (actionSequence === null || actionSequence === undefined) {
      return null;
    }

    if (input.intendedWeaponId !== undefined && input.intendedWeaponId !== null) {
      this.#fireWeaponActionPolicy.registerPendingWeaponSwitchAction({
        actionSequence,
        weaponId: input.intendedWeaponId
      });
    }

    return Object.freeze({
      actionSequence,
      requestedActiveSlotId: input.requestedActiveSlotId
    });
  }
}
