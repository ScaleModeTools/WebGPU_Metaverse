import type {
  MetaversePlayerId,
  MetaversePresenceCommand,
  MetaversePresenceRosterEvent,
  MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimeWorldClientCommand,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { MetaverseAuthoritativeWorldRuntime } from "./metaverse-authoritative-world-runtime.js";
import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";
import type { MetaverseAuthoritativeWorldRuntimeOwner } from "../types/metaverse-authoritative-world-runtime-owner.js";
import { resolveDefaultAuthoritativeMetaverseMapBundleId } from "../world/map-bundles/load-authoritative-metaverse-map-bundle.js";

export class MetaverseAuthoritativeWorldRuntimeHost
  implements MetaverseAuthoritativeWorldRuntimeOwner {
  readonly #config: Partial<MetaverseAuthoritativeWorldRuntimeConfig>;

  #activeBundleId: string;
  #runtime: MetaverseAuthoritativeWorldRuntime;

  constructor(
    config: Partial<MetaverseAuthoritativeWorldRuntimeConfig> = {},
    bundleId = resolveDefaultAuthoritativeMetaverseMapBundleId()
  ) {
    this.#config = {
      ...config
    };
    this.#activeBundleId = bundleId;
    this.#runtime = new MetaverseAuthoritativeWorldRuntime(
      this.#config,
      bundleId
    );
  }

  get activeBundleId(): string {
    return this.#activeBundleId;
  }

  get tickIntervalMs(): number {
    return this.#runtime.tickIntervalMs;
  }

  activateBundle(bundleId: string): void {
    this.#activeBundleId = bundleId;
    this.#runtime = new MetaverseAuthoritativeWorldRuntime(this.#config, bundleId);
  }

  readPresenceRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    return this.#runtime.readPresenceRosterSnapshot(nowMs, observerPlayerId);
  }

  readPresenceRosterEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    return this.#runtime.readPresenceRosterEvent(nowMs, observerPlayerId);
  }

  readWorldSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    return this.#runtime.readWorldSnapshot(nowMs, observerPlayerId);
  }

  advanceToTime(nowMs: number): void {
    this.#runtime.advanceToTime(nowMs);
  }

  readWorldEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldEvent {
    return this.#runtime.readWorldEvent(nowMs, observerPlayerId);
  }

  acceptPresenceCommand(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    return this.#runtime.acceptPresenceCommand(command, nowMs);
  }

  acceptWorldCommand(
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): MetaverseRealtimeWorldEvent {
    return this.#runtime.acceptWorldCommand(command, nowMs);
  }
}
