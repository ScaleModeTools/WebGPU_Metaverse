import type {
  ReticleColor,
  ReticleId
} from "@webgpu-metaverse/shared";
import {
  createMetaverseWeaponInstanceId,
  readMetaverseWeaponLayout,
  tryReadMetaverseCombatWeaponProfile,
  type MetaverseWeaponSlotId
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

interface ResolvedMetaverseWeaponPresentationSlot {
  readonly weapon: ResolvedMetaverseWeaponPresentation;
  readonly slotId: MetaverseWeaponSlotId;
  readonly weaponInstanceId: string;
}

export interface MetaverseWeaponSlotSwitchIntentSnapshot {
  readonly intendedWeaponId: string;
  readonly intendedWeaponInstanceId: string;
  readonly requestedActiveSlotId: MetaverseWeaponSlotId;
}

interface MetaverseWeaponCameraFieldOfViewTransition {
  readonly rangeDegrees: number;
  readonly targetFieldOfViewDegrees: number;
  readonly transitionSeconds: number;
}

interface MetaverseWeaponPresentationRuntimeDependencies {
  readonly attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  readonly attachmentProofConfigs?:
    | readonly MetaverseAttachmentProofConfig[]
    | null
    | undefined;
  readonly equippedWeaponId?: string | null | undefined;
  readonly weaponLayoutId?: string | null | undefined;
}

interface AdvanceWeaponPresentationInput {
  readonly deltaSeconds: number;
  readonly flightInput: Pick<
    MetaverseFlightInputSnapshot,
    | "primaryAction"
    | "primaryActionPressedCount"
    | "secondaryAction"
    | "weaponSwitchPressedCount"
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

const cameraFieldOfViewEpsilonDegrees = 0.0001;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
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

function createCameraFieldOfViewTransition(input: {
  readonly baseFieldOfViewDegrees: number;
  readonly currentFieldOfViewDegrees: number;
  readonly referenceFieldOfViewDegrees: number;
  readonly targetFieldOfViewDegrees: number;
  readonly transitionSeconds: number;
}): MetaverseWeaponCameraFieldOfViewTransition {
  return Object.freeze({
    rangeDegrees: Math.max(
      Math.abs(input.baseFieldOfViewDegrees - input.referenceFieldOfViewDegrees),
      Math.abs(input.currentFieldOfViewDegrees - input.targetFieldOfViewDegrees)
    ),
    targetFieldOfViewDegrees: input.targetFieldOfViewDegrees,
    transitionSeconds: input.transitionSeconds
  });
}

function advanceCameraFieldOfViewDegrees(
  currentFieldOfViewDegrees: number,
  transition: MetaverseWeaponCameraFieldOfViewTransition,
  deltaSeconds: number
): number {
  if (
    Math.abs(
      currentFieldOfViewDegrees - transition.targetFieldOfViewDegrees
    ) <= cameraFieldOfViewEpsilonDegrees
  ) {
    return transition.targetFieldOfViewDegrees;
  }

  if (transition.transitionSeconds <= 0 || transition.rangeDegrees <= 0) {
    return transition.targetFieldOfViewDegrees;
  }

  return moveToward(
    currentFieldOfViewDegrees,
    transition.targetFieldOfViewDegrees,
    transition.rangeDegrees *
      clamp(deltaSeconds / transition.transitionSeconds, 0, 1)
  );
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
      left.activeSlotId === right.activeSlotId &&
      left.aimMode === right.aimMode &&
      left.weaponId === right.weaponId &&
      left.slots.length === right.slots.length &&
      left.slots.every((leftSlot, slotIndex) => {
        const rightSlot = right.slots[slotIndex] ?? null;

        return (
          rightSlot !== null &&
          leftSlot.attachmentId === rightSlot.attachmentId &&
          leftSlot.equipped === rightSlot.equipped &&
          leftSlot.slotId === rightSlot.slotId &&
          leftSlot.weaponId === rightSlot.weaponId &&
          leftSlot.weaponInstanceId === rightSlot.weaponInstanceId
        );
      }))
  );
}

function doWeaponPresentationSlotsMatch(
  left: readonly ResolvedMetaverseWeaponPresentationSlot[],
  right: readonly ResolvedMetaverseWeaponPresentationSlot[]
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((leftSlot, slotIndex) => {
        const rightSlot = right[slotIndex] ?? null;

        return (
          rightSlot !== null &&
          leftSlot.slotId === rightSlot.slotId &&
          leftSlot.weapon.weaponId === rightSlot.weapon.weaponId &&
          leftSlot.weaponInstanceId === rightSlot.weaponInstanceId
        );
      }))
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

function resolveMetaverseWeaponPresentationAttachmentProofConfigs(
  dependencies: Pick<
    MetaverseWeaponPresentationRuntimeDependencies,
    "attachmentProofConfig" | "attachmentProofConfigs"
  >
): readonly MetaverseAttachmentProofConfig[] {
  if (dependencies.attachmentProofConfigs !== undefined) {
    return dependencies.attachmentProofConfigs ?? [];
  }

  return dependencies.attachmentProofConfig === null ||
    dependencies.attachmentProofConfig === undefined
    ? []
    : [dependencies.attachmentProofConfig];
}

function resolveWeaponPresentationSlots(input: {
  readonly equippedWeaponId?: string | null | undefined;
  readonly resolvedWeapons: readonly ResolvedMetaverseWeaponPresentation[];
  readonly weaponLayoutId?: string | null | undefined;
}): {
  readonly activeSlotId: MetaverseWeaponSlotId | null;
  readonly slots: readonly ResolvedMetaverseWeaponPresentationSlot[];
} {
  const weaponLayout = readMetaverseWeaponLayout(input.weaponLayoutId ?? null);

  if (weaponLayout !== null) {
    const slots = Object.freeze(
      weaponLayout.slots.flatMap((layoutSlot) => {
        if (!layoutSlot.equipped) {
          return [];
        }

        const weapon =
          input.resolvedWeapons.find(
            (resolvedWeapon) =>
              resolvedWeapon.weaponId === layoutSlot.weaponId
          ) ?? null;

        return weapon === null
          ? []
          : [
              Object.freeze({
                slotId: layoutSlot.slotId,
                weapon,
                weaponInstanceId: createMetaverseWeaponInstanceId(
                  "local",
                  layoutSlot.slotId,
                  layoutSlot.weaponId
                )
              })
            ];
      })
    );
    const overrideSlot =
      input.equippedWeaponId === null || input.equippedWeaponId === undefined
        ? null
        : slots.find((slot) => slot.weapon.weaponId === input.equippedWeaponId) ??
          null;
    const activeSlotId =
      overrideSlot?.slotId ??
      slots.find((slot) => slot.slotId === weaponLayout.activeSlotId)?.slotId ??
      slots[0]?.slotId ??
      null;

    return {
      activeSlotId,
      slots
    };
  }

  const equippedWeaponId =
    input.equippedWeaponId === undefined
      ? input.resolvedWeapons[0]?.weaponId ?? null
      : input.equippedWeaponId;
  const weapon =
    equippedWeaponId === null
      ? null
      : input.resolvedWeapons.find((candidate) => candidate.weaponId === equippedWeaponId) ??
        null;

  return {
    activeSlotId: weapon === null ? null : "primary",
    slots:
      weapon === null
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              slotId: "primary",
              weapon,
              weaponInstanceId: createMetaverseWeaponInstanceId(
                "local",
                "primary",
                weapon.weaponId
              )
            })
          ])
  };
}

export class MetaverseWeaponPresentationRuntime {
  readonly #baseFieldOfViewDegrees: number;
  readonly #resolvedWeaponsById: ReadonlyMap<string, ResolvedMetaverseWeaponPresentation>;
  readonly #uiUpdateListeners = new Set<() => void>();

  #activeSlotId: MetaverseWeaponSlotId | null = null;
  #adsLatched = false;
  #adsBlend = 0;
  #cameraFieldOfViewDegrees: number;
  #cameraFieldOfViewTransitionOverride: MetaverseWeaponCameraFieldOfViewTransition | null =
    null;
  #combatPresentationSuppressed = false;
  #firePressedThisFrame = false;
  #fireTriggerHeld = false;
  #hudSnapshot: MetaverseWeaponHudSnapshot = hiddenWeaponHudSnapshot;
  #pendingSlotSwitchIntent: MetaverseWeaponSlotSwitchIntentSnapshot | null = null;
  #secondaryActionHeld = false;
  #weaponSlots: readonly ResolvedMetaverseWeaponPresentationSlot[] = Object.freeze([]);
  #weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null;

  constructor(
    config: Pick<MetaverseRuntimeConfig, "camera">,
    dependencies: MetaverseWeaponPresentationRuntimeDependencies = {}
  ) {
    this.#baseFieldOfViewDegrees = Number(config.camera.fieldOfViewDegrees);
    this.#cameraFieldOfViewDegrees = this.#baseFieldOfViewDegrees;
    const resolvedWeapons = resolveMetaverseWeaponPresentationAttachmentProofConfigs(
      dependencies
    )
      .map((attachmentProofConfig) =>
        resolveMetaverseWeaponPresentation(attachmentProofConfig)
      )
      .filter(
        (
          weaponPresentation
        ): weaponPresentation is ResolvedMetaverseWeaponPresentation =>
          weaponPresentation !== null
      );
    this.#resolvedWeaponsById = new Map(
      resolvedWeapons.map((weaponPresentation) => [
        weaponPresentation.weaponId,
        weaponPresentation
      ])
    );
    const resolvedLoadout = resolveWeaponPresentationSlots({
      equippedWeaponId: dependencies.equippedWeaponId,
      resolvedWeapons,
      weaponLayoutId: dependencies.weaponLayoutId
    });

    this.#weaponSlots = resolvedLoadout.slots;
    this.#activeSlotId = resolvedLoadout.activeSlotId;
    this.#hudSnapshot = this.#createHudSnapshot(false, "hip-fire");
  }

  get #activeSlot(): ResolvedMetaverseWeaponPresentationSlot | null {
    return this.#activeSlotId === null
      ? null
      : this.#weaponSlots.find((slot) => slot.slotId === this.#activeSlotId) ??
          null;
  }

  get #activeWeapon(): ResolvedMetaverseWeaponPresentation | null {
    return this.#activeSlot?.weapon ?? null;
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

  consumeSlotSwitchIntent(): MetaverseWeaponSlotSwitchIntentSnapshot | null {
    const switchIntent = this.#pendingSlotSwitchIntent;

    this.#pendingSlotSwitchIntent = null;

    return switchIntent;
  }

  syncAuthoritativeWeaponState(
    weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null
  ): void {
    if (weaponState === null) {
      return;
    }

    const nextSlots = Object.freeze(
      weaponState.slots.flatMap((slot) => {
        if (!slot.equipped) {
          return [];
        }

        const resolvedWeapon =
          this.#resolvedWeaponsById.get(slot.weaponId) ??
          this.#resolvedWeaponsById.get(slot.attachmentId) ??
          null;

        return resolvedWeapon === null
          ? []
          : [
              Object.freeze({
                slotId: slot.slotId,
                weapon: resolvedWeapon,
                weaponInstanceId: slot.weaponInstanceId
              })
            ];
      })
    );

    if (nextSlots.length === 0) {
      return;
    }

    const nextActiveSlotId =
      nextSlots.find((slot) => slot.slotId === weaponState.activeSlotId)
        ?.slotId ??
      nextSlots.find((slot) => slot.weapon.weaponId === weaponState.weaponId)
        ?.slotId ??
      nextSlots[0]?.slotId ??
      null;

    if (
      this.#activeSlotId === nextActiveSlotId &&
      doWeaponPresentationSlotsMatch(this.#weaponSlots, nextSlots)
    ) {
      return;
    }

    const previousWeapon = this.#activeWeapon;
    const previousWeaponId = previousWeapon?.weaponId ?? null;

    this.#weaponSlots = nextSlots;
    this.#activeSlotId = nextActiveSlotId;
    this.#pendingSlotSwitchIntent = null;

    if (previousWeaponId !== this.#activeWeapon?.weaponId) {
      this.#adsLatched = false;
      this.#adsBlend = 0;
      this.#beginWeaponSwitchCameraZoomOut(previousWeapon);
    }
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
    this.#cameraFieldOfViewDegrees = this.#baseFieldOfViewDegrees;
    this.#cameraFieldOfViewTransitionOverride = null;
    this.#firePressedThisFrame = false;
    this.#fireTriggerHeld = false;
    this.#pendingSlotSwitchIntent = null;
    this.#secondaryActionHeld = false;
    this.#syncPublishedState(false, "hip-fire");
  }

  setCombatPresentationSuppressed(suppressed: boolean): void {
    if (this.#combatPresentationSuppressed === suppressed) {
      return;
    }

    this.#combatPresentationSuppressed = suppressed;

    if (suppressed) {
      this.reset();
    }
  }

  advance({
    deltaSeconds,
    flightInput,
    mountedEnvironment
  }: AdvanceWeaponPresentationInput): void {
    if (flightInput.weaponSwitchPressedCount > 0) {
      this.#toggleActiveWeaponSlot();
    }

    const equippedWeapon = this.#activeWeapon;
    const visible =
      equippedWeapon !== null &&
      mountedEnvironment === null &&
      !this.#combatPresentationSuppressed;
    const canActiveWeaponFire =
      equippedWeapon !== null &&
      tryReadMetaverseCombatWeaponProfile(equippedWeapon.weaponId) !== null;
    const primaryActionPressedThisFrame =
      visible &&
      canActiveWeaponFire &&
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

    this.#firePressedThisFrame = primaryActionPressedThisFrame;
    this.#fireTriggerHeld = visible && canActiveWeaponFire && flightInput.primaryAction;
    this.#adsBlend = moveToward(
      this.#adsBlend,
      targetAimMode === "ads" ? 1 : 0,
      transitionStep
    );
    this.#advanceCameraFieldOfView(
      equippedWeapon,
      targetAimMode,
      deltaSeconds
    );
    this.#syncPublishedState(visible, targetAimMode);
  }

  #advanceCameraFieldOfView(
    equippedWeapon: ResolvedMetaverseWeaponPresentation | null,
    targetAimMode: MetaverseRealtimePlayerWeaponAimModeId,
    deltaSeconds: number
  ): void {
    const cameraTransitionOverride =
      this.#cameraFieldOfViewTransitionOverride;
    const cameraTransition =
      targetAimMode === "ads" || cameraTransitionOverride === null
        ? this.#createActiveWeaponCameraFieldOfViewTransition(
            equippedWeapon,
            targetAimMode
          )
        : cameraTransitionOverride;

    if (targetAimMode === "ads") {
      this.#cameraFieldOfViewTransitionOverride = null;
    }

    this.#cameraFieldOfViewDegrees = advanceCameraFieldOfViewDegrees(
      this.#cameraFieldOfViewDegrees,
      cameraTransition,
      deltaSeconds
    );

    if (
      cameraTransitionOverride !== null &&
      cameraTransition === cameraTransitionOverride &&
      Math.abs(
        this.#cameraFieldOfViewDegrees -
          cameraTransitionOverride.targetFieldOfViewDegrees
      ) <= cameraFieldOfViewEpsilonDegrees
    ) {
      this.#cameraFieldOfViewTransitionOverride = null;
    }
  }

  #createActiveWeaponCameraFieldOfViewTransition(
    equippedWeapon: ResolvedMetaverseWeaponPresentation | null,
    targetAimMode: MetaverseRealtimePlayerWeaponAimModeId
  ): MetaverseWeaponCameraFieldOfViewTransition {
    const adsFieldOfViewDegrees =
      equippedWeapon === null
        ? this.#baseFieldOfViewDegrees
        : resolveAdsFieldOfViewDegrees(
            this.#baseFieldOfViewDegrees,
            equippedWeapon.loadout.aimProfile.adsFovDegrees
          );

    return createCameraFieldOfViewTransition({
      baseFieldOfViewDegrees: this.#baseFieldOfViewDegrees,
      currentFieldOfViewDegrees: this.#cameraFieldOfViewDegrees,
      referenceFieldOfViewDegrees: adsFieldOfViewDegrees,
      targetFieldOfViewDegrees:
        equippedWeapon !== null && targetAimMode === "ads"
          ? adsFieldOfViewDegrees
          : this.#baseFieldOfViewDegrees,
      transitionSeconds:
        equippedWeapon?.loadout.stats.handling.adsTransitionSeconds ?? 0
    });
  }

  #beginWeaponSwitchCameraZoomOut(
    outgoingWeapon: ResolvedMetaverseWeaponPresentation | null
  ): void {
    if (
      outgoingWeapon === null ||
      Math.abs(this.#cameraFieldOfViewDegrees - this.#baseFieldOfViewDegrees) <=
        cameraFieldOfViewEpsilonDegrees
    ) {
      this.#cameraFieldOfViewTransitionOverride = null;
      return;
    }

    const outgoingAdsFieldOfViewDegrees = resolveAdsFieldOfViewDegrees(
      this.#baseFieldOfViewDegrees,
      outgoingWeapon.loadout.aimProfile.adsFovDegrees
    );

    this.#cameraFieldOfViewTransitionOverride =
      createCameraFieldOfViewTransition({
        baseFieldOfViewDegrees: this.#baseFieldOfViewDegrees,
        currentFieldOfViewDegrees: this.#cameraFieldOfViewDegrees,
        referenceFieldOfViewDegrees: outgoingAdsFieldOfViewDegrees,
        targetFieldOfViewDegrees: this.#baseFieldOfViewDegrees,
        transitionSeconds:
          outgoingWeapon.loadout.stats.handling.adsTransitionSeconds
      });
  }

  #toggleActiveWeaponSlot(): void {
    if (this.#weaponSlots.length <= 1) {
      return;
    }

    const currentSlotIndex = Math.max(
      0,
      this.#weaponSlots.findIndex((slot) => slot.slotId === this.#activeSlotId)
    );
    const nextSlot =
      this.#weaponSlots[(currentSlotIndex + 1) % this.#weaponSlots.length] ?? null;

    if (nextSlot === null || nextSlot.slotId === this.#activeSlotId) {
      return;
    }

    const previousWeapon = this.#activeWeapon;

    this.#activeSlotId = nextSlot.slotId;
    this.#pendingSlotSwitchIntent = Object.freeze({
      intendedWeaponId: nextSlot.weapon.weaponId,
      intendedWeaponInstanceId: nextSlot.weaponInstanceId,
      requestedActiveSlotId: nextSlot.slotId
    });
    this.#adsLatched = false;
    this.#adsBlend = 0;
    this.#beginWeaponSwitchCameraZoomOut(previousWeapon);
  }

  #createHudSnapshot(
    visible: boolean,
    aimMode: MetaverseRealtimePlayerWeaponAimModeId
  ): MetaverseWeaponHudSnapshot {
    const resolvedWeapon = this.#activeWeapon;

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
    const activeSlot = this.#activeSlot;
    const resolvedWeapon = activeSlot?.weapon ?? null;
    const nextHudSnapshot = this.#createHudSnapshot(visible, aimMode);
    const nextWeaponState =
      visible && resolvedWeapon !== null && activeSlot !== null
        ? createMetaverseRealtimePlayerWeaponStateSnapshot({
            activeSlotId: activeSlot.slotId,
            aimMode,
            slots: this.#weaponSlots.map((slot) => ({
              attachmentId: slot.weapon.weaponId,
              equipped: true,
              slotId: slot.slotId,
              weaponId: slot.weapon.weaponId,
              weaponInstanceId: slot.weaponInstanceId
            })),
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
