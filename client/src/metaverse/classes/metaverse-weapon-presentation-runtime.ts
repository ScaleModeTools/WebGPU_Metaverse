import type {
  ReticleColor,
  ReticleId
} from "@webgpu-metaverse/shared";
import {
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  type MetaverseRealtimePlayerWeaponAimModeId,
  type MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { reticleManifest } from "@/assets/config/reticle-manifest";
import { weaponArchetypeManifest } from "@/assets/config/weapon-archetype-manifest";
import { weaponModuleManifest } from "@/assets/config/weapon-module-manifest";
import { resolveWeaponLoadout } from "@/assets/runtime/resolve-weapon-loadout";
import type { ResolvedWeaponLoadoutDescriptor } from "@/assets/types/weapon-builder-manifest";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseFlightInputSnapshot,
  MetaverseRuntimeConfig,
  MountedEnvironmentSnapshot,
  MetaverseWeaponHudSnapshot
} from "../types/metaverse-runtime";

interface ResolvedMetaverseWeaponPresentation {
  readonly loadout: ResolvedWeaponLoadoutDescriptor;
  readonly reticleColor: ReticleColor;
  readonly reticleId: ReticleId;
  readonly weaponId: string;
  readonly weaponLabel: string;
}

interface MetaverseWeaponPresentationRuntimeDependencies {
  readonly attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
}

interface AdvanceWeaponPresentationInput {
  readonly deltaSeconds: number;
  readonly flightInput: Pick<
    MetaverseFlightInputSnapshot,
    "primaryAction" | "secondaryAction"
  >;
  readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
}

const hiddenWeaponHudSnapshot = Object.freeze({
  adsTransitionMs: 0,
  aimMode: "hip-fire",
  reticleColor: "white",
  reticleId: "default-ring",
  reticleStyleId: "pistol-ring",
  visible: false,
  weaponId: null,
  weaponLabel: null
} satisfies MetaverseWeaponHudSnapshot);

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function moveToward(current: number, target: number, step: number): number {
  if (current === target) {
    return current;
  }

  if (current < target) {
    return Math.min(target, current + step);
  }

  return Math.max(target, current - step);
}

function normalizeTransitionMilliseconds(rawSeconds: number): number {
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(rawSeconds * 1000));
}

function createWeaponHudSnapshot(
  input: {
    readonly adsTransitionMs: number;
    readonly aimMode: MetaverseRealtimePlayerWeaponAimModeId;
    readonly reticleColor: ReticleColor;
    readonly reticleId: ReticleId;
    readonly reticleStyleId: string;
    readonly visible: boolean;
    readonly weaponId: string | null;
    readonly weaponLabel: string | null;
  }
): MetaverseWeaponHudSnapshot {
  return Object.freeze({
    adsTransitionMs: input.adsTransitionMs,
    aimMode: input.aimMode,
    reticleColor: input.reticleColor,
    reticleId: input.reticleId,
    reticleStyleId: input.reticleStyleId,
    visible: input.visible,
    weaponId: input.weaponId,
    weaponLabel: input.weaponLabel
  });
}

function doWeaponHudSnapshotsMatch(
  left: MetaverseWeaponHudSnapshot,
  right: MetaverseWeaponHudSnapshot
): boolean {
  return (
    left === right ||
    (left.adsTransitionMs === right.adsTransitionMs &&
      left.aimMode === right.aimMode &&
      left.reticleColor === right.reticleColor &&
      left.reticleId === right.reticleId &&
      left.reticleStyleId === right.reticleStyleId &&
      left.visible === right.visible &&
      left.weaponId === right.weaponId &&
      left.weaponLabel === right.weaponLabel)
  );
}

function doWeaponStateSnapshotsMatch(
  left: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  right: MetaverseRealtimePlayerWeaponStateSnapshot | null
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.aimMode === right.aimMode &&
      left.weaponId === right.weaponId)
  );
}

function resolveMetaverseWeaponPresentation(
  attachmentProofConfig: MetaverseAttachmentProofConfig | null | undefined
): ResolvedMetaverseWeaponPresentation | null {
  if (attachmentProofConfig === null || attachmentProofConfig === undefined) {
    return null;
  }

  const weaponDescriptor =
    weaponArchetypeManifest.archetypes.find(
      (weapon) => weapon.id === attachmentProofConfig.attachmentId
    ) ?? null;

  if (weaponDescriptor === null) {
    return null;
  }

  const equippedModules: (typeof weaponModuleManifest.modules)[number][] = [];

  for (const moduleProof of attachmentProofConfig.modules) {
    const moduleDescriptor =
      weaponModuleManifest.modules.find(
        (module) => module.id === moduleProof.moduleId
      ) ?? null;

    if (moduleDescriptor !== null) {
      equippedModules.push(moduleDescriptor);
    }
  }
  const loadout = resolveWeaponLoadout({
    equippedModules,
    weapon: weaponDescriptor
  });
  const reticleDescriptor =
    reticleManifest.reticles.find(
      (reticle) => reticle.id === loadout.aimProfile.defaultReticleId
    ) ?? null;

  return Object.freeze({
    loadout,
    reticleColor: reticleDescriptor?.color ?? "white",
    reticleId: loadout.aimProfile.defaultReticleId,
    weaponId: weaponDescriptor.id,
    weaponLabel: weaponDescriptor.label
  });
}

export class MetaverseWeaponPresentationRuntime {
  readonly #baseFieldOfViewDegrees: number;
  readonly #resolvedWeapon: ResolvedMetaverseWeaponPresentation | null;
  readonly #uiUpdateListeners = new Set<() => void>();

  #adsBlend = 0;
  #aimMode: MetaverseRealtimePlayerWeaponAimModeId = "hip-fire";
  #cameraFieldOfViewDegrees: number;
  #fireTriggerHeld = false;
  #hudSnapshot: MetaverseWeaponHudSnapshot = hiddenWeaponHudSnapshot;
  #weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null;

  constructor(
    config: Pick<MetaverseRuntimeConfig, "camera">,
    dependencies: MetaverseWeaponPresentationRuntimeDependencies = {}
  ) {
    this.#baseFieldOfViewDegrees = Number(config.camera.fieldOfViewDegrees);
    this.#cameraFieldOfViewDegrees = this.#baseFieldOfViewDegrees;
    this.#resolvedWeapon = resolveMetaverseWeaponPresentation(
      dependencies.attachmentProofConfig
    );
    this.#hudSnapshot = this.#createHudSnapshot(false, "hip-fire");
  }

  get cameraFieldOfViewDegrees(): number {
    return this.#cameraFieldOfViewDegrees;
  }

  get fireTriggerHeld(): boolean {
    return this.#fireTriggerHeld;
  }

  get hudSnapshot(): MetaverseWeaponHudSnapshot {
    return this.#hudSnapshot;
  }

  get weaponState(): MetaverseRealtimePlayerWeaponStateSnapshot | null {
    return this.#weaponState;
  }

  subscribeUiUpdates(listener: () => void): () => void {
    this.#uiUpdateListeners.add(listener);

    return () => {
      this.#uiUpdateListeners.delete(listener);
    };
  }

  reset(): void {
    this.#adsBlend = 0;
    this.#aimMode = "hip-fire";
    this.#cameraFieldOfViewDegrees = this.#baseFieldOfViewDegrees;
    this.#fireTriggerHeld = false;
    this.#syncPublishedState(false, "hip-fire");
  }

  advance({
    deltaSeconds,
    flightInput,
    mountedEnvironment
  }: AdvanceWeaponPresentationInput): void {
    const resolvedWeapon = this.#resolvedWeapon;
    const visible = resolvedWeapon !== null && mountedEnvironment === null;
    const targetAimMode: MetaverseRealtimePlayerWeaponAimModeId =
      visible && flightInput.secondaryAction ? "ads" : "hip-fire";
    const adsTransitionSeconds =
      resolvedWeapon?.loadout.stats.handling.adsTransitionSeconds ?? 0;
    const transitionStep =
      adsTransitionSeconds <= 0
        ? 1
        : clamp(deltaSeconds / adsTransitionSeconds, 0, 1);

    this.#aimMode = targetAimMode;
    this.#fireTriggerHeld = visible && flightInput.primaryAction;
    this.#adsBlend = moveToward(
      this.#adsBlend,
      targetAimMode === "ads" ? 1 : 0,
      transitionStep
    );
    this.#cameraFieldOfViewDegrees =
      resolvedWeapon === null
        ? this.#baseFieldOfViewDegrees
        : lerp(
            this.#baseFieldOfViewDegrees,
            resolvedWeapon.loadout.aimProfile.adsFovDegrees,
            this.#adsBlend
          );
    this.#syncPublishedState(visible, targetAimMode);
  }

  #createHudSnapshot(
    visible: boolean,
    aimMode: MetaverseRealtimePlayerWeaponAimModeId
  ): MetaverseWeaponHudSnapshot {
    const resolvedWeapon = this.#resolvedWeapon;

    if (resolvedWeapon === null) {
      return hiddenWeaponHudSnapshot;
    }

    return createWeaponHudSnapshot({
      adsTransitionMs: normalizeTransitionMilliseconds(
        resolvedWeapon.loadout.stats.handling.adsTransitionSeconds
      ),
      aimMode,
      reticleColor: resolvedWeapon.reticleColor,
      reticleId: resolvedWeapon.reticleId,
      reticleStyleId: resolvedWeapon.loadout.aimProfile.reticleStyleId,
      visible,
      weaponId: resolvedWeapon.weaponId,
      weaponLabel: resolvedWeapon.weaponLabel
    });
  }

  #syncPublishedState(
    visible: boolean,
    aimMode: MetaverseRealtimePlayerWeaponAimModeId
  ): void {
    const resolvedWeapon = this.#resolvedWeapon;
    const nextHudSnapshot = this.#createHudSnapshot(visible, aimMode);
    const nextWeaponState =
      visible && resolvedWeapon !== null
        ? createMetaverseRealtimePlayerWeaponStateSnapshot({
            aimMode,
            weaponId: resolvedWeapon.weaponId
          })
        : null;

    if (
      doWeaponHudSnapshotsMatch(this.#hudSnapshot, nextHudSnapshot) &&
      doWeaponStateSnapshotsMatch(this.#weaponState, nextWeaponState)
    ) {
      return;
    }

    this.#hudSnapshot = nextHudSnapshot;
    this.#weaponState = nextWeaponState;

    for (const listener of this.#uiUpdateListeners) {
      listener();
    }
  }
}
