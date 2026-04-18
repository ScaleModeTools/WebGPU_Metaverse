import type { MetaversePlayerTraversalIntentSnapshot } from "@webgpu-metaverse/shared/metaverse/realtime";

import type {
  MetaverseCameraSnapshot,
  MetaverseFlightInputSnapshot,
  MetaverseHudSnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";
import type { MetaverseLocalPlayerIdentity } from "../classes/metaverse-presence-runtime";
import type { RoutedDriverVehicleControlIntentSnapshot } from "../traversal/types/traversal";
import type { MetaverseWorldClientRuntime } from "@/network";

interface MetaverseRemoteWorldCommandTransportDependencies {
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly readWorldClient: () => MetaverseWorldClientRuntime | null;
}

export class MetaverseRemoteWorldCommandTransport {
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #readWorldClient: () => MetaverseWorldClientRuntime | null;

  constructor({
    localPlayerIdentity,
    readWorldClient
  }: MetaverseRemoteWorldCommandTransportDependencies) {
    this.#localPlayerIdentity = localPlayerIdentity;
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
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "strafeAxis" | "yawAxis"
    >,
    traversalFacing: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
  ): MetaversePlayerTraversalIntentSnapshot | null {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      worldClient?.syncPlayerTraversalIntent(null);
      return null;
    }

    if (locomotionMode !== "grounded" && locomotionMode !== "swim") {
      worldClient.syncPlayerTraversalIntent(null);
      return null;
    }

    return worldClient.syncPlayerTraversalIntent({
      intent: {
        actionIntent: this.#createTraversalActionIntentSnapshot(
          locomotionMode,
          movementInput.jump
        ),
        bodyControl: {
          boost: movementInput.boost,
          moveAxis: movementInput.moveAxis,
          strafeAxis: movementInput.strafeAxis,
          turnAxis: movementInput.yawAxis
        },
        facing: {
          pitchRadians: traversalFacing.pitchRadians,
          yawRadians: traversalFacing.yawRadians
        },
        locomotionMode
      },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  previewLocalTraversalIntent(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "strafeAxis" | "yawAxis"
    >,
    traversalFacing: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
  ): MetaversePlayerTraversalIntentSnapshot | null {
    const worldClient = this.#readWorldClient();

    if (worldClient === null || this.#localPlayerIdentity === null) {
      return null;
    }

    if (locomotionMode !== "grounded" && locomotionMode !== "swim") {
      return null;
    }

    return worldClient.previewPlayerTraversalIntent({
      intent: {
        actionIntent: this.#createTraversalActionIntentSnapshot(
          locomotionMode,
          movementInput.jump
        ),
        bodyControl: {
          boost: movementInput.boost,
          moveAxis: movementInput.moveAxis,
          strafeAxis: movementInput.strafeAxis,
          turnAxis: movementInput.yawAxis
        },
        facing: {
          pitchRadians: traversalFacing.pitchRadians,
          yawRadians: traversalFacing.yawRadians
        },
        locomotionMode
      },
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

  #createTraversalActionIntentSnapshot(
    locomotionMode: MetaverseHudSnapshot["locomotionMode"],
    jumpPressed: boolean
  ): {
    readonly kind: "none" | "jump";
    readonly pressed: boolean;
  } {
    if (locomotionMode !== "grounded") {
      return Object.freeze({
        kind: "none",
        pressed: false
      });
    }

    return Object.freeze({
      kind: jumpPressed ? "jump" : "none",
      pressed: jumpPressed
    });
  }
}
