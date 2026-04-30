import type {
  MetaverseRealtimeEnvironmentBodySnapshot,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot
} from "@webgpu-metaverse/shared";
import {
  createMetaverseMountedOccupancyIdentityKey
} from "@webgpu-metaverse/shared";

import { metaverseLocalAuthorityReconciliationConfig } from "../config/metaverse-world-network";
import type { MountedEnvironmentSnapshot } from "../types/mounted";
import type {
  MetaverseRemoteEnvironmentBodyPresentationSnapshot,
  MetaverseRemoteVehiclePresentationSnapshot
} from "../types/presentation";
import type {
  AckedAuthoritativeLocalPlayerPose,
  ConsumedAckedAuthoritativeLocalPlayerSample
} from "../traversal/reconciliation/authoritative-local-player-reconciliation";
import type {
  AuthoritativeLocalPlayerPoseSyncOptions
} from "../traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state";

interface MetaverseAuthoritativeWorldSyncRemoteWorldRuntime {
  readonly remoteEnvironmentBodyPresentations:
    readonly MetaverseRemoteEnvironmentBodyPresentationSnapshot[];
  readonly remoteVehiclePresentations:
    readonly MetaverseRemoteVehiclePresentationSnapshot[];
  consumeFreshAckedAuthoritativeLocalPlayerSample?(
    maxAuthoritativeSnapshotAgeMs: number
  ): ConsumedAckedAuthoritativeLocalPlayerSample | null;
  consumeFreshAckedAuthoritativeLocalPlayerPose?(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null;
  readFreshAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimePlayerSnapshot | null;
  readFreshAuthoritativeVehicleSnapshot(
    environmentAssetId: string,
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeVehicleSnapshot | null;
  readFreshAuthoritativeEnvironmentBodySnapshots(
    maxAuthoritativeSnapshotAgeMs: number
  ): readonly MetaverseRealtimeEnvironmentBodySnapshot[];
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
    authoritativePlayerSnapshot:
      | AckedAuthoritativeLocalPlayerPose
      | ConsumedAckedAuthoritativeLocalPlayerSample,
    syncOptions?: AuthoritativeLocalPlayerPoseSyncOptions
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
  readonly dynamicEnvironmentPresentationRuntime: {
    syncRemoteVehiclePresentationPose(
      environmentAssetId: string,
      poseSnapshot: {
        readonly position: MetaverseRemoteVehiclePresentationSnapshot["position"];
        readonly yawRadians: number;
      }
    ): void;
    syncRemoteEnvironmentBodyPresentationPose(
      environmentAssetId: string,
      poseSnapshot: {
        readonly position:
          MetaverseRemoteEnvironmentBodyPresentationSnapshot["position"];
        readonly yawRadians: number;
      }
    ): void;
  };
  readonly environmentBodyCollisionRuntime: {
    beginAuthoritativeEnvironmentBodyCollisionSync(): void;
    syncAuthoritativeEnvironmentBodyCollisionPose(
      environmentAssetId: string,
      poseSnapshot: {
        readonly linearVelocity: MetaverseRealtimeEnvironmentBodySnapshot["linearVelocity"];
        readonly position: MetaverseRealtimeEnvironmentBodySnapshot["position"];
        readonly yawRadians: number;
      }
    ): void;
  };
  readonly readWallClockMs: () => number;
  readonly remoteWorldRuntime: MetaverseAuthoritativeWorldSyncRemoteWorldRuntime;
  readonly traversalRuntime: MetaverseAuthoritativeWorldSyncTraversalRuntime;
  readonly vehicleCollisionRuntime: {
    syncAuthoritativeVehicleCollisionPose(
      environmentAssetId: string,
      poseSnapshot: {
        readonly linearVelocity?: MetaverseRealtimeVehicleSnapshot["linearVelocity"] | null;
        readonly position: MetaverseRealtimeVehicleSnapshot["position"];
        readonly yawRadians: number;
      }
    ): void;
  };
}

export class MetaverseAuthoritativeWorldSync {
  readonly #authoritativePlayerMovementEnabled: boolean;
  readonly #dynamicEnvironmentPresentationRuntime:
    MetaverseAuthoritativeWorldSyncDependencies["dynamicEnvironmentPresentationRuntime"];
  readonly #environmentBodyCollisionRuntime:
    MetaverseAuthoritativeWorldSyncDependencies["environmentBodyCollisionRuntime"];
  readonly #readWallClockMs: () => number;
  readonly #remoteWorldRuntime: MetaverseAuthoritativeWorldSyncRemoteWorldRuntime;
  readonly #traversalRuntime: MetaverseAuthoritativeWorldSyncTraversalRuntime;
  readonly #vehicleCollisionRuntime:
    MetaverseAuthoritativeWorldSyncDependencies["vehicleCollisionRuntime"];

  #mountedEnvironmentAuthorityMismatchKey: string | null = null;
  #mountedEnvironmentAuthorityMismatchSinceMs: number | null = null;
  #pendingLocalSpawnBootstrap = true;

  constructor({
    authoritativePlayerMovementEnabled,
    dynamicEnvironmentPresentationRuntime,
    environmentBodyCollisionRuntime,
    readWallClockMs,
    remoteWorldRuntime,
    traversalRuntime,
    vehicleCollisionRuntime
  }: MetaverseAuthoritativeWorldSyncDependencies) {
    this.#authoritativePlayerMovementEnabled = authoritativePlayerMovementEnabled;
    this.#dynamicEnvironmentPresentationRuntime =
      dynamicEnvironmentPresentationRuntime;
    this.#environmentBodyCollisionRuntime = environmentBodyCollisionRuntime;
    this.#readWallClockMs = readWallClockMs;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
    this.#vehicleCollisionRuntime = vehicleCollisionRuntime;
  }

  reset(): void {
    this.#resetMountedEnvironmentAuthorityMismatch();
    this.armLocalSpawnBootstrap();
  }

  armLocalSpawnBootstrap(): void {
    this.#pendingLocalSpawnBootstrap = true;
  }

  #resetMountedEnvironmentAuthorityMismatch(): void {
    this.#mountedEnvironmentAuthorityMismatchKey = null;
    this.#mountedEnvironmentAuthorityMismatchSinceMs = null;
  }

  syncAuthoritativeWorldSnapshots(): void {
    this.#syncMountedOccupancyAuthorityFromWorldSnapshots();
    this.#syncVehicleAuthorityFromWorldSnapshots();
    this.#syncEnvironmentBodyAuthorityFromWorldSnapshots();
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

      this.#dynamicEnvironmentPresentationRuntime.syncRemoteVehiclePresentationPose(
        remoteVehiclePresentation.environmentAssetId,
        {
          position: remoteVehiclePresentation.position,
          yawRadians: remoteVehiclePresentation.yawRadians
        }
      );

      const authoritativeRemoteVehicleSnapshot =
        this.#remoteWorldRuntime.readFreshAuthoritativeVehicleSnapshot(
          remoteVehiclePresentation.environmentAssetId,
          metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
        );

      if (authoritativeRemoteVehicleSnapshot !== null) {
        this.#vehicleCollisionRuntime.syncAuthoritativeVehicleCollisionPose(
          remoteVehiclePresentation.environmentAssetId,
          {
            linearVelocity: authoritativeRemoteVehicleSnapshot.linearVelocity,
            position: authoritativeRemoteVehicleSnapshot.position,
            yawRadians: authoritativeRemoteVehicleSnapshot.yawRadians
          }
        );
      }
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

  #syncEnvironmentBodyAuthorityFromWorldSnapshots(): void {
    this.#environmentBodyCollisionRuntime.beginAuthoritativeEnvironmentBodyCollisionSync();
    for (const remoteEnvironmentBodyPresentation of this.#remoteWorldRuntime
      .remoteEnvironmentBodyPresentations) {
      this.#dynamicEnvironmentPresentationRuntime.syncRemoteEnvironmentBodyPresentationPose(
        remoteEnvironmentBodyPresentation.environmentAssetId,
        {
          position: remoteEnvironmentBodyPresentation.position,
          yawRadians: remoteEnvironmentBodyPresentation.yawRadians
        }
      );
    }

    const environmentBodySnapshots =
      this.#remoteWorldRuntime.readFreshAuthoritativeEnvironmentBodySnapshots(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    for (const environmentBodySnapshot of environmentBodySnapshots) {
      this.#environmentBodyCollisionRuntime.syncAuthoritativeEnvironmentBodyCollisionPose(
        environmentBodySnapshot.environmentAssetId,
        {
          linearVelocity: environmentBodySnapshot.linearVelocity,
          position: environmentBodySnapshot.position,
          yawRadians: environmentBodySnapshot.yawRadians
        }
      );
    }
  }

  #syncLocalPlayerAuthorityFromWorldSnapshots(): void {
    if (!this.#authoritativePlayerMovementEnabled) {
      return;
    }

    const authoritativeLocalPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    if (
      authoritativeLocalPlayerSnapshot?.locomotionMode === "mounted" ||
      authoritativeLocalPlayerSnapshot?.mountedOccupancy != null
    ) {
      return;
    }

    const authoritativeLocalPlayerPose =
      this.#remoteWorldRuntime.consumeFreshAckedAuthoritativeLocalPlayerSample?.(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      ) ??
      this.#remoteWorldRuntime.consumeFreshAckedAuthoritativeLocalPlayerPose?.(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      ) ??
      null;

    if (authoritativeLocalPlayerPose === null) {
      return;
    }

    const syncOptions = this.#pendingLocalSpawnBootstrap
      ? Object.freeze({
          forceSnap: true,
          intentionalDiscontinuityCause: "spawn",
          syncAuthoritativeLook: true
        } satisfies AuthoritativeLocalPlayerPoseSyncOptions)
      : undefined;

    this.#pendingLocalSpawnBootstrap = false;
    this.#traversalRuntime.syncAuthoritativeLocalPlayerPose(
      authoritativeLocalPlayerPose,
      syncOptions
    );
  }

  #syncMountedOccupancyAuthorityFromWorldSnapshots(): void {
    const authoritativeLocalPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    if (authoritativeLocalPlayerSnapshot === null) {
      this.#resetMountedEnvironmentAuthorityMismatch();
      return;
    }

    const localMountedOccupancyKey = createMetaverseMountedOccupancyIdentityKey(
      this.#traversalRuntime.mountedEnvironmentSnapshot
    );
    const authoritativeMountedOccupancyKey =
      createMetaverseMountedOccupancyIdentityKey(
        authoritativeLocalPlayerSnapshot.mountedOccupancy
      );

    if (localMountedOccupancyKey === authoritativeMountedOccupancyKey) {
      this.#resetMountedEnvironmentAuthorityMismatch();
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

    this.#resetMountedEnvironmentAuthorityMismatch();
  }
}
