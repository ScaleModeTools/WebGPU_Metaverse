import type {
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot
} from "@webgpu-metaverse/shared";

import { metaverseLocalAuthorityReconciliationConfig } from "../config/metaverse-world-network";
import type { MountedEnvironmentSnapshot } from "../types/mounted";
import type { MetaverseRemoteVehiclePresentationSnapshot } from "../types/presentation";
import type { AckedAuthoritativeLocalPlayerPose } from "../traversal/reconciliation/authoritative-local-player-reconciliation";

type MountedOccupancyAuthoritySnapshot = {
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: "entry" | "seat";
  readonly seatId: string | null;
};

interface MetaverseAuthoritativeWorldSyncRemoteWorldRuntime {
  readonly remoteVehiclePresentations:
    readonly MetaverseRemoteVehiclePresentationSnapshot[];
  consumeFreshAckedAuthoritativeLocalPlayerPose(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null;
  readFreshAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimePlayerSnapshot | null;
  readFreshAuthoritativeVehicleSnapshot(
    environmentAssetId: string,
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeVehicleSnapshot | null;
}

interface MetaverseAuthoritativeWorldSyncTraversalRuntime {
  readonly mountedEnvironmentSnapshot: MountedEnvironmentSnapshot | null;
  boardEnvironment(
    environmentAssetId: string,
    requestedEntryId?: string | null
  ): MountedEnvironmentSnapshot | null;
  leaveMountedEnvironment(): void;
  occupySeat(
    environmentAssetId: string,
    seatId: string
  ): MountedEnvironmentSnapshot | null;
  syncAuthoritativeLocalPlayerPose(
    authoritativePlayerSnapshot: AckedAuthoritativeLocalPlayerPose
  ): void;
  syncAuthoritativeVehiclePose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly linearVelocity?: MetaverseRealtimeVehicleSnapshot["linearVelocity"] | null;
      readonly position: MetaverseRealtimeVehicleSnapshot["position"];
      readonly yawRadians: number;
    }
  ): void;
}

interface MetaverseAuthoritativeWorldSyncDependencies {
  readonly authoritativePlayerMovementEnabled: boolean;
  readonly readWallClockMs: () => number;
  readonly remoteWorldRuntime: MetaverseAuthoritativeWorldSyncRemoteWorldRuntime;
  readonly traversalRuntime: MetaverseAuthoritativeWorldSyncTraversalRuntime;
}

function createMountedOccupancyAuthorityKey(
  mountedOccupancy: MountedOccupancyAuthoritySnapshot | null | undefined
): string | null {
  if (mountedOccupancy === null || mountedOccupancy === undefined) {
    return null;
  }

  return `${mountedOccupancy.environmentAssetId}:${mountedOccupancy.occupancyKind}:${mountedOccupancy.seatId ?? ""}:${mountedOccupancy.entryId ?? ""}`;
}

export class MetaverseAuthoritativeWorldSync {
  readonly #authoritativePlayerMovementEnabled: boolean;
  readonly #readWallClockMs: () => number;
  readonly #remoteWorldRuntime: MetaverseAuthoritativeWorldSyncRemoteWorldRuntime;
  readonly #traversalRuntime: MetaverseAuthoritativeWorldSyncTraversalRuntime;

  #mountedEnvironmentAuthorityMismatchKey: string | null = null;
  #mountedEnvironmentAuthorityMismatchSinceMs: number | null = null;

  constructor({
    authoritativePlayerMovementEnabled,
    readWallClockMs,
    remoteWorldRuntime,
    traversalRuntime
  }: MetaverseAuthoritativeWorldSyncDependencies) {
    this.#authoritativePlayerMovementEnabled = authoritativePlayerMovementEnabled;
    this.#readWallClockMs = readWallClockMs;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
  }

  reset(): void {
    this.#mountedEnvironmentAuthorityMismatchKey = null;
    this.#mountedEnvironmentAuthorityMismatchSinceMs = null;
  }

  syncAuthoritativeWorldSnapshots(): void {
    this.#syncMountedOccupancyAuthorityFromWorldSnapshots();
    this.#syncVehicleAuthorityFromWorldSnapshots();
    this.#syncLocalPlayerAuthorityFromWorldSnapshots();
  }

  #syncVehicleAuthorityFromWorldSnapshots(): void {
    const mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;
    const localMountedEnvironmentAssetId =
      mountedEnvironment?.environmentAssetId ?? null;

    for (const remoteVehiclePresentation of this.#remoteWorldRuntime
      .remoteVehiclePresentations) {
      if (
        localMountedEnvironmentAssetId !== null &&
        remoteVehiclePresentation.environmentAssetId ===
          localMountedEnvironmentAssetId
      ) {
        continue;
      }

      this.#traversalRuntime.syncAuthoritativeVehiclePose(
        remoteVehiclePresentation.environmentAssetId,
        {
          position: remoteVehiclePresentation.position,
          yawRadians: remoteVehiclePresentation.yawRadians
        }
      );
    }

    if (localMountedEnvironmentAssetId === null) {
      return;
    }

    const localMountedVehicleAuthority =
      this.#remoteWorldRuntime.readFreshAuthoritativeVehicleSnapshot(
        localMountedEnvironmentAssetId,
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    if (localMountedVehicleAuthority === null) {
      return;
    }

    this.#traversalRuntime.syncAuthoritativeVehiclePose(
      localMountedEnvironmentAssetId,
      {
        linearVelocity: localMountedVehicleAuthority.linearVelocity,
        position: localMountedVehicleAuthority.position,
        yawRadians: localMountedVehicleAuthority.yawRadians
      }
    );
  }

  #syncLocalPlayerAuthorityFromWorldSnapshots(): void {
    if (!this.#authoritativePlayerMovementEnabled) {
      return;
    }

    const authoritativeLocalPlayerPose =
      this.#remoteWorldRuntime.consumeFreshAckedAuthoritativeLocalPlayerPose(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    if (authoritativeLocalPlayerPose === null) {
      return;
    }

    this.#traversalRuntime.syncAuthoritativeLocalPlayerPose(
      authoritativeLocalPlayerPose
    );
  }

  #syncMountedOccupancyAuthorityFromWorldSnapshots(): void {
    const authoritativeLocalPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    if (authoritativeLocalPlayerSnapshot === null) {
      this.reset();
      return;
    }

    const localMountedOccupancyKey = createMountedOccupancyAuthorityKey(
      this.#traversalRuntime.mountedEnvironmentSnapshot
    );
    const authoritativeMountedOccupancyKey = createMountedOccupancyAuthorityKey(
      authoritativeLocalPlayerSnapshot.mountedOccupancy
    );

    if (localMountedOccupancyKey === authoritativeMountedOccupancyKey) {
      this.reset();
      return;
    }

    const mismatchKey = `${localMountedOccupancyKey ?? "unmounted"}=>${authoritativeMountedOccupancyKey ?? "unmounted"}`;
    const wallClockMs = this.#readWallClockMs();

    if (this.#mountedEnvironmentAuthorityMismatchKey !== mismatchKey) {
      this.#mountedEnvironmentAuthorityMismatchKey = mismatchKey;
      this.#mountedEnvironmentAuthorityMismatchSinceMs = wallClockMs;
      return;
    }

    if (
      this.#mountedEnvironmentAuthorityMismatchSinceMs === null ||
      wallClockMs - this.#mountedEnvironmentAuthorityMismatchSinceMs <
        metaverseLocalAuthorityReconciliationConfig.mountedOccupancyMismatchHoldMs
    ) {
      return;
    }

    const authoritativeMountedOccupancy =
      authoritativeLocalPlayerSnapshot.mountedOccupancy;

    if (authoritativeMountedOccupancy === null) {
      this.#traversalRuntime.leaveMountedEnvironment();
    } else if (
      authoritativeMountedOccupancy.occupancyKind === "seat" &&
      authoritativeMountedOccupancy.seatId !== null
    ) {
      this.#traversalRuntime.occupySeat(
        authoritativeMountedOccupancy.environmentAssetId,
        authoritativeMountedOccupancy.seatId
      );
    } else if (
      authoritativeMountedOccupancy.occupancyKind === "entry" &&
      authoritativeMountedOccupancy.entryId !== null
    ) {
      this.#traversalRuntime.boardEnvironment(
        authoritativeMountedOccupancy.environmentAssetId,
        authoritativeMountedOccupancy.entryId
      );
    }

    this.reset();
  }
}
