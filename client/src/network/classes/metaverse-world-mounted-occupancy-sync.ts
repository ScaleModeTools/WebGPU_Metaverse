import type {
  MetaversePlayerId,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncMountedOccupancyCommandInput
} from "@webgpu-metaverse/shared";
import { createMetaverseSyncMountedOccupancyCommand } from "@webgpu-metaverse/shared";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type PendingMountedOccupancyCommand = ReturnType<
  typeof createMetaverseSyncMountedOccupancyCommand
>;

interface MetaverseWorldMountedOccupancySyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly sendReliableCommand: (
    command: PendingMountedOccupancyCommand
  ) => Promise<MetaverseRealtimeWorldEvent>;
}

export class MetaverseWorldMountedOccupancySync {
  readonly #acceptWorldEvent: MetaverseWorldMountedOccupancySyncDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldMountedOccupancySyncDependencies["applyWorldAccessError"];
  readonly #readStatusSnapshot: MetaverseWorldMountedOccupancySyncDependencies["readStatusSnapshot"];
  readonly #sendReliableCommand: MetaverseWorldMountedOccupancySyncDependencies["sendReliableCommand"];

  #queuedReliableCommandPromise: Promise<void> = Promise.resolve();

  constructor(dependencies: MetaverseWorldMountedOccupancySyncDependencies) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#sendReliableCommand = dependencies.sendReliableCommand;
  }

  syncMountedOccupancy(
    commandInput: MetaverseSyncMountedOccupancyCommandInput
  ): void {
    this.#enqueueReliableCommand(
      createMetaverseSyncMountedOccupancyCommand(commandInput),
      "Metaverse mounted occupancy sync failed."
    );
  }

  #enqueueReliableCommand(
    command: PendingMountedOccupancyCommand,
    fallbackMessage: string
  ): void {
    const queuedCommandPromise = this.#queuedReliableCommandPromise
      .catch(() => undefined)
      .then(async () => {
        if (this.#readStatusSnapshot().state === "disposed") {
          return;
        }

        this.#acceptWorldEvent(
          command.playerId,
          await this.#sendReliableCommand(command)
        );
      })
      .catch((error: unknown) => {
        this.#applyWorldAccessError(error, fallbackMessage);
      });

    this.#queuedReliableCommandPromise = queuedCommandPromise;
  }
}
