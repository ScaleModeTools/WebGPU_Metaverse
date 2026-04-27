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
  readonly equippedWeaponId?: string | null | undefined;
}

interface AdvanceWeaponPresentationInput {
  readonly deltaSeconds: number;
  readonly flightInput: Pick<
    MetaverseFlightInputSnapshot,
    "primaryAction" | "primaryActionPressedCount" | "secondaryAction"
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

function resolveAdsFieldOfViewDegrees(
  baseFieldOfViewDegrees: number,
  adsFieldOfViewDegrees: number
): number {
  if (!Number.isFinite(adsFieldOfViewDegrees) || adsFieldOfViewDegrees <= 0) {
    return baseFieldOfViewDegrees;
  }

  return Math.min(baseFieldOfViewDegrees, adsFieldOfViewDegrees);
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
  readonly #equippedWeapon: ResolvedMetaverseWeaponPresentation | null;
  readonly #uiUpdateListeners = new Set<() => void>();

  #adsLatched = false;
  #adsBlend = 0;
  #aimMode: MetaverseRealtimePlayerWeaponAimModeId = "hip-fire";
  #cameraFieldOfViewDegrees: number;
  #firePressedThisFrame = false;
  #fireTriggerHeld = false;
  #hudSnapshot: MetaverseWeaponHudSnapshot = hiddenWeaponHudSnapshot;
  #secondaryActionHeld = false;
  #weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null;

  constructor(
    config: Pick<MetaverseRuntimeConfig, "camera">,
    dependencies: MetaverseWeaponPresentationRuntimeDependencies = {}
  ) {
    this.#baseFieldOfViewDegrees = Number(config.camera.fieldOfViewDegrees);
    this.#cameraFieldOfViewDegrees = this.#baseFieldOfViewDegrees;
    const resolvedWeapon = resolveMetaverseWeaponPresentation(
      dependencies.attachmentProofConfig
    );
    const equippedWeaponId =
      dependencies.equippedWeaponId === undefined
        ? resolvedWeapon?.weaponId ?? null
        : dependencies.equippedWeaponId;

    this.#equippedWeapon =
      resolvedWeapon !== null && equippedWeaponId === resolvedWeapon.weaponId
        ? resolvedWeapon
        : null;
    this.#hudSnapshot = this.#createHudSnapshot(false, "hip-fire");
  }

  get cameraFieldOfViewDegrees(): number {
    return this.#cameraFieldOfViewDegrees;
  }

  get adsBlend(): number {
    return this.#adsBlend;
  }

  get fireTriggerHeld(): boolean {
    return this.#fireTriggerHeld;
  }

  get firePressedThisFrame(): boolean {
    return this.#firePressedThisFrame;
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
    this.#adsLatched = false;
    this.#adsBlend = 0;
    this.#aimMode = "hip-fire";
    this.#cameraFieldOfViewDegrees = this.#baseFieldOfViewDegrees;
    this.#firePressedThisFrame = false;
    this.#fireTriggerHeld = false;
    this.#secondaryActionHeld = false;
    this.#syncPublishedState(false, "hip-fire");
  }

  advance({
    deltaSeconds,
    flightInput,
    mountedEnvironment
  }: AdvanceWeaponPresentationInput): void {
    const equippedWeapon = this.#equippedWeapon;
    const visible = equippedWeapon !== null && mountedEnvironment === null;
    const primaryActionPressedThisFrame =
      visible &&
      (flightInput.primaryActionPressedCount > 0 ||
        (flightInput.primaryAction && !this.#fireTriggerHeld));
    const secondaryActionPressedThisFrame =
      flightInput.secondaryAction && !this.#secondaryActionHeld;

    this.#secondaryActionHeld = flightInput.secondaryAction;

    if (!visible) {
      this.#adsLatched = false;
    } else if (secondaryActionPressedThisFrame) {
      this.#adsLatched = !this.#adsLatched;
    }

    const targetAimMode: MetaverseRealtimePlayerWeaponAimModeId =
      visible && this.#adsLatched ? "ads" : "hip-fire";
    const adsTransitionSeconds =
      equippedWeapon?.loadout.stats.handling.adsTransitionSeconds ?? 0;
    const transitionStep =
      adsTransitionSeconds <= 0
        ? 1
        : clamp(deltaSeconds / adsTransitionSeconds, 0, 1);

    this.#aimMode = targetAimMode;
    this.#firePressedThisFrame = primaryActionPressedThisFrame;
    this.#fireTriggerHeld = visible && flightInput.primaryAction;
    this.#adsBlend = moveToward(
      this.#adsBlend,
      targetAimMode === "ads" ? 1 : 0,
      transitionStep
    );
    this.#cameraFieldOfViewDegrees =
      equippedWeapon === null
        ? this.#baseFieldOfViewDegrees
        : lerp(
            this.#baseFieldOfViewDegrees,
            resolveAdsFieldOfViewDegrees(
              this.#baseFieldOfViewDegrees,
              equippedWeapon.loadout.aimProfile.adsFovDegrees
            ),
            this.#adsBlend
          );
    this.#syncPublishedState(visible, targetAimMode);
  }

  #createHudSnapshot(
    visible: boolean,
    aimMode: MetaverseRealtimePlayerWeaponAimModeId
  ): MetaverseWeaponHudSnapshot {
    const resolvedWeapon = this.#equippedWeapon;

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
    const resolvedWeapon = this.#equippedWeapon;
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
