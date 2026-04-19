import type {
  MetaverseMountedInteractionSnapshot,
  MountedEnvironmentSnapshot
} from "../types/mounted";

interface MetaverseMountedInteractionAuthoritySync {
  reset(): void;
}

interface MetaverseMountedInteractionFrameLoop {
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
}

interface MetaverseMountedInteractionRemoteWorldRuntime {
  syncMountedOccupancy(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void;
}

interface MetaverseMountedInteractionTraversalRuntime {
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
}

interface MetaverseMountedInteractionRuntimeDependencies {
  readonly authoritativeWorldSync: MetaverseMountedInteractionAuthoritySync;
  readonly frameLoop: MetaverseMountedInteractionFrameLoop;
  readonly remoteWorldRuntime: MetaverseMountedInteractionRemoteWorldRuntime;
  readonly traversalRuntime: MetaverseMountedInteractionTraversalRuntime;
}

export class MetaverseMountedInteractionRuntime {
  readonly #authoritativeWorldSync: MetaverseMountedInteractionAuthoritySync;
  readonly #frameLoop: MetaverseMountedInteractionFrameLoop;
  readonly #remoteWorldRuntime: MetaverseMountedInteractionRemoteWorldRuntime;
  readonly #traversalRuntime: MetaverseMountedInteractionTraversalRuntime;

  constructor({
    authoritativeWorldSync,
    frameLoop,
    remoteWorldRuntime,
    traversalRuntime
  }: MetaverseMountedInteractionRuntimeDependencies) {
    this.#authoritativeWorldSync = authoritativeWorldSync;
    this.#frameLoop = frameLoop;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
  }

  boardMountable(entryId: string | null = null): boolean {
    const focusedMountable = this.#frameLoop.mountedInteraction.focusedMountable;

    if (focusedMountable === null) {
      return false;
    }

    this.#authoritativeWorldSync.reset();
    this.#traversalRuntime.boardEnvironment(
      focusedMountable.environmentAssetId,
      entryId
    );
    this.#syncMountedOccupancy();

    return true;
  }

  occupySeat(seatId: string): boolean {
    const environmentAssetId =
      this.#frameLoop.mountedInteraction.seatTargetEnvironmentAssetId;

    if (environmentAssetId === null) {
      return false;
    }

    this.#authoritativeWorldSync.reset();
    this.#traversalRuntime.occupySeat(environmentAssetId, seatId);
    this.#syncMountedOccupancy();

    return true;
  }

  leaveMountedEnvironment(): void {
    this.#authoritativeWorldSync.reset();
    this.#traversalRuntime.leaveMountedEnvironment();
    this.#syncMountedOccupancy();
  }

  toggleMount(): boolean {
    if (this.#frameLoop.mountedInteraction.mountedEnvironment === null) {
      return this.boardMountable();
    }

    this.leaveMountedEnvironment();
    return true;
  }

  #syncMountedOccupancy(): void {
    this.#remoteWorldRuntime.syncMountedOccupancy(
      this.#traversalRuntime.mountedEnvironmentSnapshot
    );
  }
}
