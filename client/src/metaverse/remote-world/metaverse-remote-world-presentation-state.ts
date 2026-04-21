import type {
  MetaverseRealtimeEnvironmentBodySnapshot,
  MetaversePlayerId,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared";

import type {
  MetaverseRemoteEnvironmentBodyPresentationSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRemoteVehiclePresentationSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import { MetaverseRemoteCharacterPresentationOwner } from "../traversal/presentation/remote-character-presentation";
import { MetaverseRemoteEnvironmentBodyPresentationOwner } from "../traversal/presentation/remote-environment-body-presentation";
import { MetaverseRemoteVehiclePresentationOwner } from "../traversal/presentation/remote-vehicle-presentation";
import {
  indexMetaverseWorldEnvironmentBodiesByEnvironmentAssetId,
  indexMetaverseWorldPlayersByPlayerId,
  indexMetaverseWorldVehiclesByVehicleId,
  type MetaverseRemoteWorldSampledFrame
} from "./metaverse-remote-world-sampling";

interface MetaverseRemoteWorldPresentationSampleInput {
  readonly deltaSeconds: number;
  readonly localPlayerId: MetaversePlayerId;
  readonly remoteCharacterRootFrame?: MetaverseRemoteWorldSampledFrame;
  readonly sampledFrame: MetaverseRemoteWorldSampledFrame;
}

const emptyRealtimePlayerSnapshots: readonly MetaverseRealtimePlayerSnapshot[] =
  Object.freeze([]);
const emptyRealtimeVehicleSnapshots: readonly MetaverseRealtimeVehicleSnapshot[] =
  Object.freeze([]);
const emptyRealtimeEnvironmentBodySnapshots:
  readonly MetaverseRealtimeEnvironmentBodySnapshot[] = Object.freeze([]);

export class MetaverseRemoteWorldPresentationState {
  readonly #nextEnvironmentBodySnapshotsByEnvironmentAssetId = new Map<
    string,
    MetaverseRealtimeEnvironmentBodySnapshot
  >();
  readonly #remoteCharacterRootNextPlayerSnapshotsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRealtimePlayerSnapshot
  >();
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
  readonly #remoteEnvironmentBodyPresentationsByEnvironmentAssetId = new Map<
    string,
    MetaverseRemoteEnvironmentBodyPresentationOwner
  >();
  readonly #remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
    [];
  readonly #remoteVehiclePresentations: MetaverseRemoteVehiclePresentationSnapshot[] =
    [];
  readonly #remoteEnvironmentBodyPresentations:
    MetaverseRemoteEnvironmentBodyPresentationSnapshot[] = [];

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

  get remoteEnvironmentBodyPresentations():
    | readonly MetaverseRemoteEnvironmentBodyPresentationSnapshot[] {
    return this.#remoteEnvironmentBodyPresentations;
  }

  clear(): void {
    this.#sampleEpoch += 1;
    this.#nextEnvironmentBodySnapshotsByEnvironmentAssetId.clear();
    this.#nextPlayerSnapshotsByPlayerId.clear();
    this.#remoteCharacterRootNextPlayerSnapshotsByPlayerId.clear();
    this.#nextVehicleSnapshotsByVehicleId.clear();
    this.#remoteCharacterPresentationsByPlayerId.clear();
    this.#remoteVehiclePresentationsByEnvironmentAssetId.clear();
    this.#remoteEnvironmentBodyPresentationsByEnvironmentAssetId.clear();
    this.#remoteCharacterPresentations.length = 0;
    this.#remoteVehiclePresentations.length = 0;
    this.#remoteEnvironmentBodyPresentations.length = 0;
  }

  syncAuthoritativeSample({
    deltaSeconds,
    localPlayerId,
    remoteCharacterRootFrame,
    sampledFrame
  }: MetaverseRemoteWorldPresentationSampleInput): number {
    const { alpha, baseSnapshot, extrapolationSeconds, nextSnapshot } =
      sampledFrame;
    const resolvedRemoteCharacterRootFrame =
      remoteCharacterRootFrame ?? sampledFrame;
    const {
      alpha: remoteCharacterRootAlpha,
      baseSnapshot: remoteCharacterRootBaseSnapshot,
      extrapolationSeconds: remoteCharacterRootExtrapolationSeconds,
      nextSnapshot: remoteCharacterRootNextSnapshot
    } = resolvedRemoteCharacterRootFrame;
    const sampleEpoch = this.#sampleEpoch + 1;

    this.#sampleEpoch = sampleEpoch;
    indexMetaverseWorldPlayersByPlayerId(
      nextSnapshot?.players ?? emptyRealtimePlayerSnapshots,
      this.#nextPlayerSnapshotsByPlayerId
    );
    this.#remoteCharacterPresentations.length = 0;
    indexMetaverseWorldPlayersByPlayerId(
      remoteCharacterRootNextSnapshot?.players ?? emptyRealtimePlayerSnapshots,
      this.#remoteCharacterRootNextPlayerSnapshotsByPlayerId
    );

    for (const basePlayer of baseSnapshot.players) {
      if (basePlayer.playerId === localPlayerId) {
        continue;
      }

      const nextPlayer =
        this.#nextPlayerSnapshotsByPlayerId.get(basePlayer.playerId) ?? null;
      const remoteCharacterRootBasePlayer =
        remoteCharacterRootBaseSnapshot.players.find(
          (playerSnapshot) => playerSnapshot.playerId === basePlayer.playerId
        ) ?? basePlayer;
      const remoteCharacterRootNextPlayer =
        this.#remoteCharacterRootNextPlayerSnapshotsByPlayerId.get(
          basePlayer.playerId
        ) ?? null;
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
        remoteCharacterRootAlpha,
        remoteCharacterRootBasePlayer,
        remoteCharacterRootExtrapolationSeconds,
        remoteCharacterRootNextPlayer,
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

    indexMetaverseWorldEnvironmentBodiesByEnvironmentAssetId(
      nextSnapshot?.environmentBodies ?? emptyRealtimeEnvironmentBodySnapshots,
      this.#nextEnvironmentBodySnapshotsByEnvironmentAssetId
    );
    this.#remoteEnvironmentBodyPresentations.length = 0;

    for (const baseEnvironmentBody of baseSnapshot.environmentBodies) {
      const nextEnvironmentBody =
        this.#nextEnvironmentBodySnapshotsByEnvironmentAssetId.get(
          baseEnvironmentBody.environmentAssetId
        ) ?? null;
      let remoteEnvironmentBodyPresentation =
        this.#remoteEnvironmentBodyPresentationsByEnvironmentAssetId.get(
          baseEnvironmentBody.environmentAssetId
        );

      if (remoteEnvironmentBodyPresentation === undefined) {
        remoteEnvironmentBodyPresentation =
          new MetaverseRemoteEnvironmentBodyPresentationOwner(baseEnvironmentBody);
        this.#remoteEnvironmentBodyPresentationsByEnvironmentAssetId.set(
          baseEnvironmentBody.environmentAssetId,
          remoteEnvironmentBodyPresentation
        );
      }

      remoteEnvironmentBodyPresentation.syncAuthoritativeSample({
        alpha,
        baseEnvironmentBody,
        deltaSeconds,
        extrapolationSeconds,
        nextEnvironmentBody,
        sampleEpoch
      });
      this.#remoteEnvironmentBodyPresentations.push(
        remoteEnvironmentBodyPresentation.presentationSnapshot
      );
    }

    for (const [
      environmentAssetId,
      remoteEnvironmentBodyPresentation
    ] of this.#remoteEnvironmentBodyPresentationsByEnvironmentAssetId) {
      if (remoteEnvironmentBodyPresentation.sampleEpoch === sampleEpoch) {
        continue;
      }

      this.#remoteEnvironmentBodyPresentationsByEnvironmentAssetId.delete(
        environmentAssetId
      );
    }

    return extrapolationSeconds * 1000;
  }
}
