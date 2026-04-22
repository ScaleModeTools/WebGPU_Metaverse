import type {
  MetaverseDriverVehicleControlIntentSnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncDriverVehicleControlCommandInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseDriverVehicleControlIntentSnapshot,
  createMetaverseSyncDriverVehicleControlCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseRealtimeWorldLatestWinsDatagramTransport } from "../types/metaverse-realtime-world-latest-wins-datagram-transport";
import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";
import { MetaverseWorldLatestWinsCommandLane } from "./metaverse-world-latest-wins-command-lane";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type PendingDriverVehicleControlCommand = ReturnType<
  typeof createMetaverseSyncDriverVehicleControlCommand
>;

interface TimedYawAxisCompressionState {
  accumulatedDurationMs: number;
  accumulatedYawAxisDurationMs: number;
  lastSampleAtMs: number | null;
  lastYawAxis: number;
}

interface MetaverseWorldDriverControlSyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly latestWinsDatagramTransport: MetaverseRealtimeWorldLatestWinsDatagramTransport | null;
  readonly notifyUpdates: () => void;
  readonly readPlayerId: () => MetaversePlayerId | null;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly readWallClockMs: () => number;
  readonly resolveCommandDelayMs: () => number;
  readonly sendReliableCommand: (
    command: PendingDriverVehicleControlCommand
  ) => Promise<MetaverseRealtimeWorldEvent>;
  readonly setTimeout: typeof globalThis.setTimeout;
}

function clampNormalizedAxis(value: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(-1, value))
    : 0;
}

function createTimedYawAxisCompressionState(): TimedYawAxisCompressionState {
  return {
    accumulatedDurationMs: 0,
    accumulatedYawAxisDurationMs: 0,
    lastSampleAtMs: null,
    lastYawAxis: 0
  };
}

function driverVehicleControlIntentsMatch(
  leftIntent: MetaverseDriverVehicleControlIntentSnapshot | null,
  rightIntent: MetaverseDriverVehicleControlIntentSnapshot
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.boost === rightIntent.boost &&
    leftIntent.environmentAssetId === rightIntent.environmentAssetId &&
    leftIntent.moveAxis === rightIntent.moveAxis &&
    leftIntent.strafeAxis === rightIntent.strafeAxis &&
    leftIntent.yawAxis === rightIntent.yawAxis
  );
}

export interface MetaverseWorldDriverControlDatagramStatusContext {
  readonly datagramTransportAvailable: boolean;
  readonly hasSuccessfulDatagramSend: boolean;
  readonly lastTransportError: string | null;
  readonly usingReliableFallback: boolean;
}

export class MetaverseWorldDriverControlSync {
  readonly #applyWorldAccessError: MetaverseWorldDriverControlSyncDependencies["applyWorldAccessError"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #commandLane: MetaverseWorldLatestWinsCommandLane<PendingDriverVehicleControlCommand>;
  readonly #notifyUpdates: () => void;
  readonly #readPlayerId: MetaverseWorldDriverControlSyncDependencies["readPlayerId"];
  readonly #readStatusSnapshot: MetaverseWorldDriverControlSyncDependencies["readStatusSnapshot"];
  readonly #readWallClockMs: () => number;
  readonly #resolveCommandDelayMs: () => number;
  readonly #sendReliableCommand: MetaverseWorldDriverControlSyncDependencies["sendReliableCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #acceptWorldEvent: MetaverseWorldDriverControlSyncDependencies["acceptWorldEvent"];

  #commandSyncHandle: TimeoutHandle | null = null;
  #commandSyncInFlight = false;
  readonly #driverVehicleControlYawCompressionState =
    createTimedYawAxisCompressionState();
  #lastDriverVehicleControlIntent: MetaverseDriverVehicleControlIntentSnapshot | null =
    null;
  #nextDriverVehicleControlSequence = 0;
  #pendingDriverVehicleControlCommand: PendingDriverVehicleControlCommand | null =
    null;

  constructor(dependencies: MetaverseWorldDriverControlSyncDependencies) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#clearTimeout = dependencies.clearTimeout;
    this.#notifyUpdates = dependencies.notifyUpdates;
    this.#readPlayerId = dependencies.readPlayerId;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#readWallClockMs = dependencies.readWallClockMs;
    this.#resolveCommandDelayMs = dependencies.resolveCommandDelayMs;
    this.#sendReliableCommand = dependencies.sendReliableCommand;
    this.#setTimeout = dependencies.setTimeout;
    const latestWinsDatagramTransport = dependencies.latestWinsDatagramTransport;
    this.#commandLane = new MetaverseWorldLatestWinsCommandLane({
      clearTimeout: this.#clearTimeout,
      onStateChange: () => {
        this.#notifyUpdates();
      },
      recoveryDelayMs: this.#resolveCommandDelayMs(),
      sendDatagram:
        latestWinsDatagramTransport === null
          ? null
          : async (command) =>
              latestWinsDatagramTransport.sendDriverVehicleControlDatagram(command),
      setTimeout: this.#setTimeout
    });
  }

  get datagramStatusContext(): MetaverseWorldDriverControlDatagramStatusContext {
    return Object.freeze({
      datagramTransportAvailable: this.#commandLane.datagramTransportAvailable,
      hasSuccessfulDatagramSend: this.#commandLane.hasSuccessfulDatagramSend,
      lastTransportError: this.#commandLane.lastTransportError,
      usingReliableFallback: this.#commandLane.usingReliableFallback
    });
  }

  get failureCount(): number {
    return this.#commandLane.failureCount;
  }

  get supportsDatagrams(): boolean {
    return this.#commandLane.supportsDatagrams;
  }

  syncDriverVehicleControl(
    commandInput: MetaverseSyncDriverVehicleControlCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#lastDriverVehicleControlIntent = null;
      this.#pendingDriverVehicleControlCommand = null;
      this.#resetTimedYawAxisCompressionState(
        this.#driverVehicleControlYawCompressionState
      );
      this.#cancelScheduledCommandSync();
      return;
    }

    const nextControlIntent = createMetaverseDriverVehicleControlIntentSnapshot(
      commandInput.controlIntent
    );

    if (
      driverVehicleControlIntentsMatch(
        this.#lastDriverVehicleControlIntent,
        nextControlIntent
      )
    ) {
      return;
    }

    if (this.#pendingDriverVehicleControlCommand === null) {
      this.#resetTimedYawAxisCompressionState(
        this.#driverVehicleControlYawCompressionState
      );
    }

    this.#captureTimedYawAxisSample(
      this.#driverVehicleControlYawCompressionState,
      nextControlIntent.yawAxis
    );
    this.#lastDriverVehicleControlIntent = nextControlIntent;
    this.#nextDriverVehicleControlSequence += 1;
    this.#pendingDriverVehicleControlCommand =
      createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: nextControlIntent,
        controlSequence: this.#nextDriverVehicleControlSequence,
        playerId: commandInput.playerId
      });

    if (this.#readStatusSnapshot().connected) {
      this.#scheduleCommandSync(this.#resolveCommandDelayMs());
    }
  }

  syncConnection(): void {
    if (this.#pendingDriverVehicleControlCommand !== null) {
      this.#scheduleCommandSync(0);
    }
  }

  dispose(): void {
    this.#cancelScheduledCommandSync();
    this.#commandLane.dispose();
  }

  #scheduleCommandSync(delayMs: number): void {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      statusSnapshot.state === "disposed" ||
      playerId === null ||
      !statusSnapshot.connected ||
      this.#pendingDriverVehicleControlCommand === null ||
      this.#commandSyncInFlight ||
      this.#commandSyncHandle !== null
    ) {
      return;
    }

    this.#commandSyncHandle = this.#setTimeout(() => {
      this.#commandSyncHandle = null;
      void this.#flushCommandSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledCommandSync(): void {
    if (this.#commandSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#commandSyncHandle);
    this.#commandSyncHandle = null;
  }

  async #flushCommandSync(): Promise<void> {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected ||
      this.#pendingDriverVehicleControlCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#createCompressedDriverVehicleControlCommand(
      this.#pendingDriverVehicleControlCommand
    );

    this.#pendingDriverVehicleControlCommand = null;
    this.#commandSyncInFlight = true;

    try {
      const worldEvent = await this.#sendDriverVehicleControlCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#acceptWorldEvent(playerId, worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(error, "Metaverse world command failed.");
    } finally {
      this.#commandSyncInFlight = false;

      if (
        this.#readStatusSnapshot().state !== "disposed" &&
        this.#readStatusSnapshot().connected &&
        this.#pendingDriverVehicleControlCommand !== null
      ) {
        this.#scheduleCommandSync(0);
      }
    }
  }

  #resetTimedYawAxisCompressionState(
    state: TimedYawAxisCompressionState
  ): void {
    state.accumulatedDurationMs = 0;
    state.accumulatedYawAxisDurationMs = 0;
    state.lastSampleAtMs = null;
    state.lastYawAxis = 0;
  }

  #accumulateTimedYawAxisDurationUntilNow(
    state: TimedYawAxisCompressionState
  ): void {
    const nowMs = this.#readWallClockMs();

    if (!Number.isFinite(nowMs) || state.lastSampleAtMs === null) {
      return;
    }

    const elapsedMs = Math.max(0, nowMs - state.lastSampleAtMs);

    state.accumulatedDurationMs += elapsedMs;
    state.accumulatedYawAxisDurationMs += state.lastYawAxis * elapsedMs;
    state.lastSampleAtMs = nowMs;
  }

  #captureTimedYawAxisSample(
    state: TimedYawAxisCompressionState,
    yawAxis: number
  ): void {
    this.#accumulateTimedYawAxisDurationUntilNow(state);
    state.lastYawAxis = clampNormalizedAxis(yawAxis);

    if (state.lastSampleAtMs !== null) {
      return;
    }

    const nowMs = this.#readWallClockMs();

    state.lastSampleAtMs = Number.isFinite(nowMs) ? nowMs : null;
  }

  #consumeTimedYawAxisAverage(
    state: TimedYawAxisCompressionState,
    fallbackYawAxis: number
  ): number {
    this.#accumulateTimedYawAxisDurationUntilNow(state);

    if (state.accumulatedDurationMs <= 0) {
      const normalizedFallbackYawAxis = clampNormalizedAxis(fallbackYawAxis);

      this.#resetTimedYawAxisCompressionState(state);
      return normalizedFallbackYawAxis;
    }

    const averagedYawAxis = clampNormalizedAxis(
      state.accumulatedYawAxisDurationMs / state.accumulatedDurationMs
    );

    this.#resetTimedYawAxisCompressionState(state);
    return averagedYawAxis;
  }

  #createCompressedDriverVehicleControlCommand(
    command: PendingDriverVehicleControlCommand
  ): PendingDriverVehicleControlCommand {
    return createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        ...command.controlIntent,
        yawAxis: this.#consumeTimedYawAxisAverage(
          this.#driverVehicleControlYawCompressionState,
          command.controlIntent.yawAxis
        )
      },
      controlSequence: command.controlSequence,
      playerId: command.playerId
    });
  }

  async #sendDriverVehicleControlCommand(
    command: PendingDriverVehicleControlCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    const datagramResult = await this.#commandLane.send(
      command,
      "Metaverse driver vehicle control datagram send failed."
    );

    if (datagramResult === "datagram" || datagramResult === "superseded") {
      return null;
    }

    return this.#sendReliableCommand(command);
  }
}
