import type {
  MetaversePlayerId,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared";

import type {
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRemoteVehiclePresentationSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import { MetaverseRemoteCharacterPresentationOwner } from "../traversal/presentation/remote-character-presentation";
import { MetaverseRemoteVehiclePresentationOwner } from "../traversal/presentation/remote-vehicle-presentation";
import {
  indexMetaverseWorldPlayersByPlayerId,
  indexMetaverseWorldVehiclesByVehicleId,
  type MetaverseRemoteWorldSampledFrame
} from "./metaverse-remote-world-sampling";

interface MetaverseRemoteWorldPresentationSampleInput {
  readonly deltaSeconds: number;
  readonly localPlayerId: MetaversePlayerId;
  readonly sampledFrame: MetaverseRemoteWorldSampledFrame;
}

const emptyRealtimePlayerSnapshots: readonly MetaverseRealtimePlayerSnapshot[] =
  Object.freeze([]);
const emptyRealtimeVehicleSnapshots: readonly MetaverseRealtimeVehicleSnapshot[] =
  Object.freeze([]);

export class MetaverseRemoteWorldPresentationState {
  readonly #nextPlayerSnapshotsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRealtimePlayerSnapshot
  >();
  readonly #nextVehicleSnapshotsByVehicleId = new Map<
    MetaverseVehicleId,
    MetaverseRealtimeVehicleSnapshot
  >();
  readonly #presentationConfig: Pick<
    MetaverseRuntimeConfig,
    "bodyPresentation" | "groundedBody"
  >;
  readonly #remoteCharacterPresentationsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRemoteCharacterPresentationOwner
  >();
  readonly #remoteVehiclePresentationsByEnvironmentAssetId = new Map<
    string,
    MetaverseRemoteVehiclePresentationOwner
  >();
  readonly #remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
    [];
  readonly #remoteVehiclePresentations: MetaverseRemoteVehiclePresentationSnapshot[] =
    [];

  #sampleEpoch = 0;

  constructor(
    presentationConfig: Pick<
      MetaverseRuntimeConfig,
      "bodyPresentation" | "groundedBody"
    >
  ) {
    this.#presentationConfig = presentationConfig;
  }

  get remoteCharacterPresentations():
    | readonly MetaverseRemoteCharacterPresentationSnapshot[] {
    return this.#remoteCharacterPresentations;
  }

  get remoteVehiclePresentations():
    | readonly MetaverseRemoteVehiclePresentationSnapshot[] {
    return this.#remoteVehiclePresentations;
  }

  clear(): void {
    this.#sampleEpoch += 1;
    this.#nextPlayerSnapshotsByPlayerId.clear();
    this.#nextVehicleSnapshotsByVehicleId.clear();
    this.#remoteCharacterPresentationsByPlayerId.clear();
    this.#remoteVehiclePresentationsByEnvironmentAssetId.clear();
    this.#remoteCharacterPresentations.length = 0;
    this.#remoteVehiclePresentations.length = 0;
  }

  syncAuthoritativeSample({
    deltaSeconds,
    localPlayerId,
    sampledFrame
  }: MetaverseRemoteWorldPresentationSampleInput): number {
    const { alpha, baseSnapshot, extrapolationSeconds, nextSnapshot } =
      sampledFrame;
    const sampleEpoch = this.#sampleEpoch + 1;

    this.#sampleEpoch = sampleEpoch;
    indexMetaverseWorldPlayersByPlayerId(
      nextSnapshot?.players ?? emptyRealtimePlayerSnapshots,
      this.#nextPlayerSnapshotsByPlayerId
    );
    this.#remoteCharacterPresentations.length = 0;

    for (const basePlayer of baseSnapshot.players) {
      if (basePlayer.playerId === localPlayerId) {
        continue;
      }

      const nextPlayer =
        this.#nextPlayerSnapshotsByPlayerId.get(basePlayer.playerId) ?? null;
      let remoteCharacterPresentation =
        this.#remoteCharacterPresentationsByPlayerId.get(basePlayer.playerId);

      if (remoteCharacterPresentation === undefined) {
        remoteCharacterPresentation =
          new MetaverseRemoteCharacterPresentationOwner(
            basePlayer,
            this.#presentationConfig
          );
        this.#remoteCharacterPresentationsByPlayerId.set(
          basePlayer.playerId,
          remoteCharacterPresentation
        );
      }

      remoteCharacterPresentation.syncAuthoritativeSample({
        alpha,
        basePlayer,
        deltaSeconds,
        extrapolationSeconds,
        nextPlayer,
        sampleEpoch
      });
      this.#remoteCharacterPresentations.push(
        remoteCharacterPresentation.presentationSnapshot
      );
    }

    for (const [playerId, remoteCharacterPresentation] of this
      .#remoteCharacterPresentationsByPlayerId) {
      if (remoteCharacterPresentation.sampleEpoch === sampleEpoch) {
        continue;
      }

      this.#remoteCharacterPresentationsByPlayerId.delete(playerId);
    }

    indexMetaverseWorldVehiclesByVehicleId(
      nextSnapshot?.vehicles ?? emptyRealtimeVehicleSnapshots,
      this.#nextVehicleSnapshotsByVehicleId
    );
    this.#remoteVehiclePresentations.length = 0;

    for (const baseVehicle of baseSnapshot.vehicles) {
      const nextVehicle =
        this.#nextVehicleSnapshotsByVehicleId.get(baseVehicle.vehicleId) ?? null;
      let remoteVehiclePresentation =
        this.#remoteVehiclePresentationsByEnvironmentAssetId.get(
          baseVehicle.environmentAssetId
        );

      if (remoteVehiclePresentation === undefined) {
        remoteVehiclePresentation = new MetaverseRemoteVehiclePresentationOwner(
          baseVehicle
        );
        this.#remoteVehiclePresentationsByEnvironmentAssetId.set(
          baseVehicle.environmentAssetId,
          remoteVehiclePresentation
        );
      }

      remoteVehiclePresentation.syncAuthoritativeSample({
        alpha,
        baseVehicle,
        deltaSeconds,
        extrapolationSeconds,
        nextVehicle,
        sampleEpoch
      });
      this.#remoteVehiclePresentations.push(
        remoteVehiclePresentation.presentationSnapshot
      );
    }

    for (const [
      environmentAssetId,
      remoteVehiclePresentation
    ] of this.#remoteVehiclePresentationsByEnvironmentAssetId) {
      if (remoteVehiclePresentation.sampleEpoch === sampleEpoch) {
        continue;
      }

      this.#remoteVehiclePresentationsByEnvironmentAssetId.delete(
        environmentAssetId
      );
    }

    return extrapolationSeconds * 1000;
  }
}
