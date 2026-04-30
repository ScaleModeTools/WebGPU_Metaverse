import type { Milliseconds, Radians } from "../unit-measurements.js";
import { createMilliseconds, createRadians } from "../unit-measurements.js";
import {
  createMetaversePresenceVector3Snapshot,
  type MetaversePlayerId,
  type MetaversePresenceVector3Snapshot,
  type MetaversePresenceVector3SnapshotInput
} from "./metaverse-presence-contract.js";
import type { MetaversePlayerTeamId } from "./metaverse-player-team.js";
import {
  isMetaverseWeaponSlotId,
  type MetaverseWeaponSlotId
} from "./metaverse-weapon-loadout.js";
import {
  metaverseGroundedBodyTraversalCoreConfig
} from "./metaverse-authoritative-traversal-config.js";
import {
  resolveMetaverseGroundedBodyColliderTranslationSnapshot
} from "./metaverse-grounded-body-contract.js";
import {
  metaverseTraversalActionResolutionStateIds,
  type MetaverseTraversalActionResolutionStateId
} from "./metaverse-traversal-contract.js";
import type {
  MetaverseWorldSurfaceTraversalAffordanceId
} from "./metaverse-world-surface-query.js";

export const metaverseCombatMatchPhaseIds = [
  "waiting-for-players",
  "active",
  "completed"
] as const;

export const metaverseCombatProjectileResolutionIds = [
  "active",
  "hit-player",
  "hit-world",
  "expired"
] as const;

export const metaverseCombatEventKindIds = [
  "hitscan-resolved",
  "projectile-spawned",
  "projectile-resolved"
] as const;

export const metaverseCombatEventHitscanHitKindIds = [
  "miss",
  "player",
  "world"
] as const;

export const metaverseCombatFeedEventTypeIds = [
  "spawn",
  "damage",
  "kill"
] as const;

export const metaversePlayerActionKindIds = [
  "fire-weapon",
  "interact-weapon-resource",
  "jump",
  "switch-active-weapon-slot"
] as const;

export const metaversePlayerActionReceiptStatusIds = [
  "accepted",
  "rejected"
] as const;

export const metaversePlayerActionFireWeaponRejectionReasonIds = [
  "match-inactive",
  "player-dead",
  "spawn-protected",
  "mounted",
  "reloading",
  "cooldown",
  "out-of-ammo",
  "invalid-direction",
  "invalid-origin",
  "inactive-weapon",
  "no-combat-profile",
  "unknown-weapon"
] as const;

export const metaversePlayerActionSwitchWeaponSlotRejectionReasonIds = [
  "unknown-slot",
  "unequipped-slot",
  "stale-weapon-state"
] as const;

export const metaversePlayerActionInteractWeaponResourceRejectionReasonIds = [
  "match-inactive",
  "player-dead",
  "mounted",
  "no-active-weapon",
  "last-weapon",
  "no-resource",
  "ammo-full",
  "unknown-weapon",
  "stale-weapon-state"
] as const;

export const metaverseCombatHitZoneIds = [
  "body",
  "head"
] as const;

export const metaverseCombatHurtRegionIds = [
  "head",
  "upper_torso",
  "lower_torso",
  "pelvis",
  "upper_leg_l",
  "lower_leg_l",
  "foot_l",
  "upper_leg_r",
  "lower_leg_r",
  "foot_r"
] as const;

export const metaverseCombatShotResolutionFinalReasonIds = [
  "hit-player",
  "hit-world",
  "miss-no-hurtbox",
  "hit-world-before-player",
  "blocked-by-firing-reference-los",
  "rejected-missing-origin",
  "rejected-missing-direction",
  "rejected-invalid-origin",
  "rejected-invalid-direction"
] as const;

export const metaverseCombatWeaponFireModeIds = [
  "semi",
  "burst",
  "auto"
] as const;

export const metaverseCombatWeaponDeliveryModelIds = [
  "hitscan",
  "projectile"
] as const;

export const metaverseCombatWeaponPresentationDeliveryModelIds = [
  "hitscan-tracer",
  "authoritative-projectile"
] as const;

export const metaverseCombatWeaponAuthoredSocketRoleIds = [
  "grip.primary",
  "grip.secondary",
  "projectile.muzzle",
  "projectile.exhaust",
  "hazard.backblast_cone",
  "body.shoulder_contact"
] as const;

export type MetaverseCombatMatchPhaseId =
  (typeof metaverseCombatMatchPhaseIds)[number];
export type MetaverseCombatProjectileResolutionId =
  (typeof metaverseCombatProjectileResolutionIds)[number];
export type MetaverseCombatEventKindId =
  (typeof metaverseCombatEventKindIds)[number];
export type MetaverseCombatEventHitscanHitKindId =
  (typeof metaverseCombatEventHitscanHitKindIds)[number];
export type MetaverseCombatFeedEventTypeId =
  (typeof metaverseCombatFeedEventTypeIds)[number];
export type MetaversePlayerActionKindId =
  (typeof metaversePlayerActionKindIds)[number];
export type MetaversePlayerActionReceiptStatusId =
  (typeof metaversePlayerActionReceiptStatusIds)[number];
export type MetaversePlayerActionFireWeaponRejectionReasonId =
  (typeof metaversePlayerActionFireWeaponRejectionReasonIds)[number];
export type MetaversePlayerActionSwitchWeaponSlotRejectionReasonId =
  (typeof metaversePlayerActionSwitchWeaponSlotRejectionReasonIds)[number];
export type MetaversePlayerActionInteractWeaponResourceRejectionReasonId =
  (typeof metaversePlayerActionInteractWeaponResourceRejectionReasonIds)[number];
export type MetaverseCombatHitZoneId =
  (typeof metaverseCombatHitZoneIds)[number];
export type MetaverseCombatHurtRegionId =
  (typeof metaverseCombatHurtRegionIds)[number];
export type MetaverseCombatShotResolutionFinalReasonId =
  (typeof metaverseCombatShotResolutionFinalReasonIds)[number];
export type MetaverseCombatWeaponFireModeId =
  (typeof metaverseCombatWeaponFireModeIds)[number];
export type MetaverseCombatWeaponDeliveryModelId =
  (typeof metaverseCombatWeaponDeliveryModelIds)[number];
export type MetaverseCombatWeaponPresentationDeliveryModelId =
  (typeof metaverseCombatWeaponPresentationDeliveryModelIds)[number];
export type MetaverseCombatWeaponAuthoredSocketRoleId =
  (typeof metaverseCombatWeaponAuthoredSocketRoleIds)[number];

export type MetaverseCombatActionKindId = MetaversePlayerActionKindId;
export type MetaverseCombatActionReceiptStatusId =
  MetaversePlayerActionReceiptStatusId;
export type MetaverseCombatActionRejectionReasonId =
  | MetaversePlayerActionFireWeaponRejectionReasonId
  | MetaversePlayerActionSwitchWeaponSlotRejectionReasonId
  | MetaversePlayerActionInteractWeaponResourceRejectionReasonId;

export const metaverseCombatActionKindIds = metaversePlayerActionKindIds;
export const metaverseCombatActionReceiptStatusIds =
  metaversePlayerActionReceiptStatusIds;
export const metaverseCombatActionRejectionReasonIds = [
  ...metaversePlayerActionFireWeaponRejectionReasonIds,
  ...metaversePlayerActionSwitchWeaponSlotRejectionReasonIds,
  ...metaversePlayerActionInteractWeaponResourceRejectionReasonIds
] as const;

export interface MetaverseCombatWeaponAccuracySnapshot {
  readonly adsAffectsAccuracy: boolean;
  readonly bloomDegrees: number;
  readonly gravityUnitsPerSecondSquared: number;
  readonly projectileLifetimeMs: Milliseconds;
  readonly projectileVelocityMetersPerSecond: number;
  readonly spreadDegrees: number;
}

export interface MetaverseCombatWeaponAccuracySnapshotInput {
  readonly adsAffectsAccuracy?: boolean;
  readonly bloomDegrees?: number;
  readonly gravityUnitsPerSecondSquared?: number;
  readonly projectileLifetimeMs?: number;
  readonly projectileVelocityMetersPerSecond?: number;
  readonly spreadDegrees?: number;
}

export interface MetaverseCombatWeaponDamageSnapshot {
  readonly body: number;
  readonly head: number;
  readonly pelletsPerShot: number;
}

export interface MetaverseCombatWeaponDamageSnapshotInput {
  readonly body?: number;
  readonly head?: number;
  readonly pelletsPerShot?: number;
}

export interface MetaverseCombatWeaponAreaDamageSnapshot {
  readonly affectsOwner: boolean;
  readonly affectsTeammates: boolean;
  readonly innerRadiusMeters: number;
  readonly lineOfSightRequired: boolean;
  readonly maxDamage: number;
  readonly minDamage: number;
  readonly outerRadiusMeters: number;
}

export interface MetaverseCombatWeaponAreaDamageSnapshotInput {
  readonly affectsOwner?: boolean;
  readonly affectsTeammates?: boolean;
  readonly innerRadiusMeters?: number;
  readonly lineOfSightRequired?: boolean;
  readonly maxDamage?: number;
  readonly minDamage?: number;
  readonly outerRadiusMeters?: number;
}

export interface MetaverseCombatWeaponFiringOriginOffsetSnapshot {
  readonly forwardMeters: number;
  readonly rightMeters: number;
  readonly upMeters: number;
}

export interface MetaverseCombatWeaponFiringOriginOffsetSnapshotInput {
  readonly forwardMeters?: number;
  readonly rightMeters?: number;
  readonly upMeters?: number;
}

export interface MetaverseCombatWeaponAuthoredSocketRotationSnapshot {
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MetaverseCombatWeaponAuthoredSocketRotationSnapshotInput {
  readonly w?: number;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
}

export interface MetaverseCombatWeaponAuthoredSocketFrameSnapshot<
  Role extends MetaverseCombatWeaponAuthoredSocketRoleId =
    MetaverseCombatWeaponAuthoredSocketRoleId
> {
  readonly forwardMeters: number;
  readonly rightMeters: number;
  readonly role: Role;
  readonly rotation: MetaverseCombatWeaponAuthoredSocketRotationSnapshot;
  readonly source: "weapon-manifest-socket";
  readonly upMeters: number;
}

export interface MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput<
  Role extends MetaverseCombatWeaponAuthoredSocketRoleId =
    MetaverseCombatWeaponAuthoredSocketRoleId
> {
  readonly forwardMeters?: number;
  readonly rightMeters?: number;
  readonly role?: Role;
  readonly rotation?: MetaverseCombatWeaponAuthoredSocketRotationSnapshotInput;
  readonly source?: "weapon-manifest-socket";
  readonly upMeters?: number;
}

export type MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot =
  MetaverseCombatWeaponAuthoredSocketFrameSnapshot<"projectile.muzzle">;

export type MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshotInput =
  MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput<"projectile.muzzle">;

export type MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot =
  MetaverseCombatWeaponAuthoredSocketFrameSnapshot<"grip.primary">;

export type MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshotInput =
  MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput<"grip.primary">;

export interface MetaverseCombatWeaponProjectilePresentationSnapshot {
  readonly authoredMuzzleFromGrip: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly authoredSocketFrames: readonly MetaverseCombatWeaponAuthoredSocketFrameSnapshot[];
  readonly objectLocalMuzzleFrame: MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot;
  readonly objectLocalPrimaryGripFrame: MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot;
  readonly primaryGripAnchorOffset: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly primaryGripRole: "grip.primary";
  readonly muzzleRole: "projectile.muzzle";
  readonly semanticLaunchOriginOffset: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
}

export interface MetaverseCombatWeaponProjectilePresentationSnapshotInput {
  readonly authoredMuzzleFromGrip?: MetaverseCombatWeaponFiringOriginOffsetSnapshotInput;
  readonly authoredSocketFrames?: readonly MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput[];
  readonly objectLocalMuzzleFrame?: MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshotInput;
  readonly objectLocalPrimaryGripFrame?: MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshotInput;
  readonly primaryGripAnchorOffset?: MetaverseCombatWeaponFiringOriginOffsetSnapshotInput;
  readonly semanticLaunchOriginOffset?: MetaverseCombatWeaponFiringOriginOffsetSnapshotInput;
}

export interface MetaverseCombatSemanticWeaponTipFrameInput {
  readonly actorBodyPosition: MetaversePresenceVector3SnapshotInput;
  readonly actorBodyYawRadians: number;
  readonly aimYawInfluence?: number;
  readonly authoredMuzzleFromGrip?: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly firingOriginOffset: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly objectLocalMuzzleFrame?:
    | MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot
    | null;
  readonly objectLocalPrimaryGripFrame?:
    | MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot
    | null;
  readonly primaryGripAnchorOffset?: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly semanticAimForward: MetaversePresenceVector3SnapshotInput;
  readonly semanticLaunchOriginOffset?: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
}

export interface MetaverseCombatSemanticWeaponTipFrameSnapshot {
  readonly aimForwardWorld: MetaversePresenceVector3Snapshot;
  readonly aimRightWorld: MetaversePresenceVector3Snapshot;
  readonly objectLocalMuzzleFrame:
    | MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot
    | null;
  readonly objectLocalPrimaryGripFrame:
    | MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot
    | null;
  readonly originWorld: MetaversePresenceVector3Snapshot;
  readonly primaryGripAnchorOffset: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly primaryGripWorld: MetaversePresenceVector3Snapshot;
  readonly authoredMuzzleFromGrip: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly semanticLaunchOriginOffset: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly source: "shared-semantic-weapon-tip";
  readonly worldUp: MetaversePresenceVector3Snapshot;
}

export interface MetaverseCombatWeaponMagazineSnapshot {
  readonly magazineCapacity: number;
  readonly reloadDurationMs: Milliseconds;
  readonly reserveCapacity: number;
}

export interface MetaverseCombatWeaponMagazineSnapshotInput {
  readonly magazineCapacity?: number;
  readonly reloadDurationMs?: number;
  readonly reserveCapacity?: number;
}

export interface MetaverseCombatWeaponRecoilPresentationSnapshot {
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
}

export interface MetaverseCombatWeaponRecoilPresentationSnapshotInput {
  readonly yawDegrees?: number;
  readonly pitchDegrees?: number;
}

export interface MetaverseCombatWeaponBurstSnapshot {
  readonly roundIntervalMs: Milliseconds;
  readonly roundsPerBurst: number;
}

export interface MetaverseCombatWeaponBurstSnapshotInput {
  readonly roundIntervalMs?: number;
  readonly roundsPerBurst?: number;
}

export interface MetaverseCombatWeaponProfileSnapshot {
  readonly accuracy: MetaverseCombatWeaponAccuracySnapshot;
  readonly areaDamage: MetaverseCombatWeaponAreaDamageSnapshot | null;
  readonly burst: MetaverseCombatWeaponBurstSnapshot | null;
  readonly damage: MetaverseCombatWeaponDamageSnapshot;
  readonly deliveryModel: MetaverseCombatWeaponDeliveryModelId;
  readonly fireMode: MetaverseCombatWeaponFireModeId;
  readonly firingOriginOffset: MetaverseCombatWeaponFiringOriginOffsetSnapshot;
  readonly firingOriginHeightMeters: number;
  readonly magazine: MetaverseCombatWeaponMagazineSnapshot;
  readonly presentationDeliveryModel: MetaverseCombatWeaponPresentationDeliveryModelId;
  readonly projectilePresentation: MetaverseCombatWeaponProjectilePresentationSnapshot;
  readonly recoilPresentation: MetaverseCombatWeaponRecoilPresentationSnapshot;
  readonly roundsPerMinute: number;
  readonly weaponId: string;
}

export interface MetaverseCombatWeaponProfileSnapshotInput {
  readonly areaDamage?: MetaverseCombatWeaponAreaDamageSnapshotInput | null;
  readonly burst?: MetaverseCombatWeaponBurstSnapshotInput | null;
  readonly damage: MetaverseCombatWeaponDamageSnapshotInput;
  readonly deliveryModel?: MetaverseCombatWeaponDeliveryModelId;
  readonly fireMode: MetaverseCombatWeaponFireModeId;
  readonly firingOriginOffset?: MetaverseCombatWeaponFiringOriginOffsetSnapshotInput;
  readonly firingOriginHeightMeters?: number;
  readonly magazine: MetaverseCombatWeaponMagazineSnapshotInput;
  readonly presentationDeliveryModel?: MetaverseCombatWeaponPresentationDeliveryModelId;
  readonly projectilePresentation?: MetaverseCombatWeaponProjectilePresentationSnapshotInput;
  readonly recoilPresentation: MetaverseCombatWeaponRecoilPresentationSnapshotInput;
  readonly roundsPerMinute: number;
  readonly weaponId: string;
  readonly accuracy?: MetaverseCombatWeaponAccuracySnapshotInput;
}

export interface MetaverseCombatTeamSnapshot {
  readonly playerIds: readonly MetaversePlayerId[];
  readonly score: number;
  readonly teamId: MetaversePlayerTeamId;
}

export interface MetaverseCombatTeamSnapshotInput {
  readonly playerIds?: readonly MetaversePlayerId[];
  readonly score?: number;
  readonly teamId: MetaversePlayerTeamId;
}

export interface MetaverseCombatDamageLedgerEntrySnapshot {
  readonly attackerPlayerId: MetaversePlayerId;
  readonly totalDamage: number;
}

export interface MetaverseCombatDamageLedgerEntrySnapshotInput {
  readonly attackerPlayerId: MetaversePlayerId;
  readonly totalDamage?: number;
}

export interface MetaverseCombatWeaponStatsSnapshot {
  readonly shotsFired: number;
  readonly shotsHit: number;
  readonly weaponId: string;
}

export interface MetaverseCombatWeaponStatsSnapshotInput {
  readonly shotsFired?: number;
  readonly shotsHit?: number;
  readonly weaponId: string;
}

export interface MetaverseCombatPlayerWeaponSnapshot {
  readonly ammoInMagazine: number;
  readonly ammoInReserve: number;
  readonly reloadRemainingMs: Milliseconds;
  readonly weaponId: string;
}

export interface MetaverseCombatPlayerWeaponSnapshotInput {
  readonly ammoInMagazine?: number;
  readonly ammoInReserve?: number;
  readonly reloadRemainingMs?: number;
  readonly weaponId: string;
}

export interface MetaversePlayerCombatSnapshot {
  readonly activeWeapon: MetaverseCombatPlayerWeaponSnapshot | null;
  readonly alive: boolean;
  readonly assists: number;
  readonly damageLedger: readonly MetaverseCombatDamageLedgerEntrySnapshot[];
  readonly deaths: number;
  readonly headshotKills: number;
  readonly health: number;
  readonly kills: number;
  readonly maxHealth: number;
  readonly respawnRemainingMs: Milliseconds;
  readonly spawnProtectionRemainingMs: Milliseconds;
  readonly weaponInventory: readonly MetaverseCombatPlayerWeaponSnapshot[];
  readonly weaponStats: readonly MetaverseCombatWeaponStatsSnapshot[];
}

export interface MetaversePlayerCombatSnapshotInput {
  readonly activeWeapon?: MetaverseCombatPlayerWeaponSnapshotInput | null;
  readonly alive?: boolean;
  readonly assists?: number;
  readonly damageLedger?:
    readonly MetaverseCombatDamageLedgerEntrySnapshotInput[];
  readonly deaths?: number;
  readonly headshotKills?: number;
  readonly health?: number;
  readonly kills?: number;
  readonly maxHealth?: number;
  readonly respawnRemainingMs?: number;
  readonly spawnProtectionRemainingMs?: number;
  readonly weaponInventory?: readonly MetaverseCombatPlayerWeaponSnapshotInput[];
  readonly weaponStats?: readonly MetaverseCombatWeaponStatsSnapshotInput[];
}

export interface MetaverseCombatMatchSnapshot {
  readonly assistDamageThreshold: number;
  readonly completedAtTimeMs: Milliseconds | null;
  readonly friendlyFireEnabled: boolean;
  readonly mode: "team-deathmatch";
  readonly phase: MetaverseCombatMatchPhaseId;
  readonly respawnDelayMs: Milliseconds;
  readonly scoreLimit: number;
  readonly teams: readonly MetaverseCombatTeamSnapshot[];
  readonly timeLimitMs: Milliseconds;
  readonly timeRemainingMs: Milliseconds;
  readonly winnerTeamId: MetaversePlayerTeamId | null;
}

export interface MetaverseCombatMatchSnapshotInput {
  readonly assistDamageThreshold?: number;
  readonly completedAtTimeMs?: number | null;
  readonly friendlyFireEnabled?: boolean;
  readonly mode?: "team-deathmatch";
  readonly phase?: MetaverseCombatMatchPhaseId;
  readonly respawnDelayMs?: number;
  readonly scoreLimit?: number;
  readonly teams?: readonly MetaverseCombatTeamSnapshotInput[];
  readonly timeLimitMs?: number;
  readonly timeRemainingMs?: number;
  readonly winnerTeamId?: MetaversePlayerTeamId | null;
}

export interface MetaverseCombatAimSnapshot {
  readonly pitchRadians: Radians;
  readonly rayForwardWorld: MetaversePresenceVector3Snapshot | null;
  readonly rayOriginWorld: MetaversePresenceVector3Snapshot | null;
  readonly yawRadians: Radians;
}

export interface MetaverseCombatAimSnapshotInput {
  readonly pitchRadians?: number;
  readonly rayForwardWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly rayOriginWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly yawRadians?: number;
}

export interface MetaverseFireWeaponPlayerActionSnapshot {
  readonly actionSequence: number;
  readonly aimMode: "ads" | "hip-fire";
  readonly aimSnapshot: MetaverseCombatAimSnapshot;
  readonly issuedAtAuthoritativeTimeMs: Milliseconds;
  readonly kind: "fire-weapon";
  readonly weaponId: string;
}

export interface MetaverseFireWeaponPlayerActionSnapshotInput {
  readonly actionSequence?: number;
  readonly aimMode?: "ads" | "hip-fire";
  readonly aimSnapshot?: MetaverseCombatAimSnapshotInput;
  readonly issuedAtAuthoritativeTimeMs?: number;
  readonly weaponId: string;
}

export interface MetaverseJumpPlayerActionSnapshot {
  readonly actionSequence: number;
  readonly issuedAtAuthoritativeTimeMs: Milliseconds;
  readonly kind: "jump";
}

export interface MetaverseJumpPlayerActionSnapshotInput {
  readonly actionSequence?: number;
  readonly issuedAtAuthoritativeTimeMs?: number;
}

export interface MetaverseSwitchActiveWeaponSlotPlayerActionSnapshot {
  readonly actionSequence: number;
  readonly intendedWeaponInstanceId: string | null;
  readonly issuedAtAuthoritativeTimeMs: Milliseconds;
  readonly kind: "switch-active-weapon-slot";
  readonly requestedActiveSlotId: MetaverseWeaponSlotId;
}

export interface MetaverseSwitchActiveWeaponSlotPlayerActionSnapshotInput {
  readonly actionSequence?: number;
  readonly intendedWeaponInstanceId?: string | null;
  readonly issuedAtAuthoritativeTimeMs?: number;
  readonly requestedActiveSlotId: MetaverseWeaponSlotId;
}

export interface MetaverseInteractWeaponResourcePlayerActionSnapshot {
  readonly actionSequence: number;
  readonly intendedWeaponInstanceId: string | null;
  readonly issuedAtAuthoritativeTimeMs: Milliseconds;
  readonly kind: "interact-weapon-resource";
  readonly requestedActiveSlotId: MetaverseWeaponSlotId | null;
}

export interface MetaverseInteractWeaponResourcePlayerActionSnapshotInput {
  readonly actionSequence?: number;
  readonly intendedWeaponInstanceId?: string | null;
  readonly issuedAtAuthoritativeTimeMs?: number;
  readonly requestedActiveSlotId?: MetaverseWeaponSlotId | null;
}

export type MetaversePlayerActionSnapshot =
  | MetaverseFireWeaponPlayerActionSnapshot
  | MetaverseInteractWeaponResourcePlayerActionSnapshot
  | MetaverseJumpPlayerActionSnapshot
  | MetaverseSwitchActiveWeaponSlotPlayerActionSnapshot;

export type MetaversePlayerActionSnapshotInput =
  | ({
      readonly kind: "fire-weapon";
    } & MetaverseFireWeaponPlayerActionSnapshotInput)
  | ({
      readonly kind: "jump";
    } & MetaverseJumpPlayerActionSnapshotInput)
  | ({
      readonly kind: "interact-weapon-resource";
    } & MetaverseInteractWeaponResourcePlayerActionSnapshotInput)
  | ({
      readonly kind: "switch-active-weapon-slot";
    } & MetaverseSwitchActiveWeaponSlotPlayerActionSnapshotInput);

export interface MetaverseIssuePlayerActionCommand {
  readonly action: MetaversePlayerActionSnapshot;
  readonly playerId: MetaversePlayerId;
  readonly type: "issue-player-action";
}

export interface MetaverseIssuePlayerActionCommandInput {
  readonly action: MetaversePlayerActionSnapshotInput;
  readonly playerId: MetaversePlayerId;
}

interface MetaversePlayerActionReceiptCommon {
  readonly actionSequence: number;
  readonly kind: MetaversePlayerActionKindId;
  readonly processedAtTimeMs: Milliseconds;
}

export interface MetaverseFireWeaponPlayerActionReceiptSnapshot
  extends MetaversePlayerActionReceiptCommon {
  readonly kind: "fire-weapon";
  readonly rejectionReason: MetaversePlayerActionFireWeaponRejectionReasonId | null;
  readonly sourceProjectileId: string | null;
  readonly status: MetaversePlayerActionReceiptStatusId;
  readonly weaponId: string;
}

export interface MetaverseJumpPlayerActionReceiptSnapshot
  extends MetaversePlayerActionReceiptCommon {
  readonly kind: "jump";
  readonly resolutionState: MetaverseTraversalActionResolutionStateId;
}

export interface MetaverseSwitchActiveWeaponSlotPlayerActionReceiptSnapshot
  extends MetaversePlayerActionReceiptCommon {
  readonly activeSlotId: MetaverseWeaponSlotId | null;
  readonly intendedWeaponInstanceId: string | null;
  readonly kind: "switch-active-weapon-slot";
  readonly rejectionReason:
    | MetaversePlayerActionSwitchWeaponSlotRejectionReasonId
    | null;
  readonly requestedActiveSlotId: MetaverseWeaponSlotId;
  readonly status: MetaversePlayerActionReceiptStatusId;
  readonly weaponId: string | null;
  readonly weaponInstanceId: string | null;
}

export interface MetaverseInteractWeaponResourcePlayerActionReceiptSnapshot
  extends MetaversePlayerActionReceiptCommon {
  readonly activeSlotId: MetaverseWeaponSlotId | null;
  readonly droppedWeaponId: string | null;
  readonly intendedWeaponInstanceId: string | null;
  readonly kind: "interact-weapon-resource";
  readonly pickedUpWeaponId: string | null;
  readonly rejectionReason:
    | MetaversePlayerActionInteractWeaponResourceRejectionReasonId
    | null;
  readonly requestedActiveSlotId: MetaverseWeaponSlotId | null;
  readonly status: MetaversePlayerActionReceiptStatusId;
  readonly weaponId: string | null;
  readonly weaponInstanceId: string | null;
}

export type MetaversePlayerActionReceiptSnapshot =
  | MetaverseFireWeaponPlayerActionReceiptSnapshot
  | MetaverseInteractWeaponResourcePlayerActionReceiptSnapshot
  | MetaverseJumpPlayerActionReceiptSnapshot
  | MetaverseSwitchActiveWeaponSlotPlayerActionReceiptSnapshot;

export type MetaverseCombatActionReceiptSnapshot =
  MetaverseFireWeaponPlayerActionReceiptSnapshot;

export type MetaversePlayerActionReceiptSnapshotInput =
  | ({
      readonly actionSequence?: number;
      readonly kind?: "fire-weapon";
      readonly processedAtTimeMs?: number;
      readonly rejectionReason?:
        | MetaversePlayerActionFireWeaponRejectionReasonId
        | null;
      readonly sourceProjectileId?: string | null;
      readonly status?: MetaversePlayerActionReceiptStatusId;
      readonly weaponId: string;
    })
  | ({
      readonly actionSequence?: number;
      readonly kind: "jump";
      readonly processedAtTimeMs?: number;
      readonly resolutionState?: MetaverseTraversalActionResolutionStateId;
    })
  | ({
      readonly actionSequence?: number;
      readonly activeSlotId?: MetaverseWeaponSlotId | null;
      readonly droppedWeaponId?: string | null;
      readonly intendedWeaponInstanceId?: string | null;
      readonly kind: "interact-weapon-resource";
      readonly pickedUpWeaponId?: string | null;
      readonly processedAtTimeMs?: number;
      readonly rejectionReason?:
        | MetaversePlayerActionInteractWeaponResourceRejectionReasonId
        | null;
      readonly requestedActiveSlotId?: MetaverseWeaponSlotId | null;
      readonly status?: MetaversePlayerActionReceiptStatusId;
      readonly weaponId?: string | null;
      readonly weaponInstanceId?: string | null;
    })
  | ({
      readonly actionSequence?: number;
      readonly activeSlotId?: MetaverseWeaponSlotId | null;
      readonly intendedWeaponInstanceId?: string | null;
      readonly kind: "switch-active-weapon-slot";
      readonly processedAtTimeMs?: number;
      readonly rejectionReason?:
        | MetaversePlayerActionSwitchWeaponSlotRejectionReasonId
        | null;
      readonly requestedActiveSlotId: MetaverseWeaponSlotId;
      readonly status?: MetaversePlayerActionReceiptStatusId;
      readonly weaponId?: string | null;
      readonly weaponInstanceId?: string | null;
    });

export type MetaverseCombatActionReceiptSnapshotInput =
  Extract<
    MetaversePlayerActionReceiptSnapshotInput,
    {
      readonly kind?: "fire-weapon";
    }
  >;

export interface MetaverseCombatProjectileSnapshot {
  readonly direction: MetaversePresenceVector3Snapshot;
  readonly ownerPlayerId: MetaversePlayerId | null;
  readonly position: MetaversePresenceVector3Snapshot;
  readonly projectileId: string;
  readonly resolution: MetaverseCombatProjectileResolutionId;
  readonly resolvedAtTimeMs: Milliseconds | null;
  readonly sourceActionSequence: number;
  readonly spawnedAtTimeMs: Milliseconds;
  readonly velocityMetersPerSecond: number;
  readonly weaponId: string;
}

export interface MetaverseCombatProjectileSnapshotInput {
  readonly direction: MetaversePresenceVector3SnapshotInput;
  readonly expiresAtTimeMs?: number;
  readonly ownerPlayerId?: MetaversePlayerId | null;
  readonly position: MetaversePresenceVector3SnapshotInput;
  readonly projectileId: string;
  readonly resolution?: MetaverseCombatProjectileResolutionId;
  readonly resolvedAtTimeMs?: number | null;
  readonly resolvedHitZone?: MetaverseCombatHitZoneId | null;
  readonly resolvedPlayerId?: MetaversePlayerId | null;
  readonly sourceActionSequence?: number;
  readonly spawnedAtTimeMs?: number;
  readonly velocityMetersPerSecond?: number;
  readonly weaponId: string;
}

export interface MetaverseCombatImpactSurfaceSnapshot {
  readonly ownerEnvironmentAssetId: string | null;
  readonly traversalAffordance: MetaverseWorldSurfaceTraversalAffordanceId | null;
}

export interface MetaverseCombatImpactSurfaceSnapshotInput {
  readonly ownerEnvironmentAssetId?: string | null;
  readonly traversalAffordance?: MetaverseWorldSurfaceTraversalAffordanceId | null;
}

export interface MetaverseCombatEventHitscanSnapshot {
  readonly finalReason: MetaverseCombatShotResolutionFinalReasonId;
  readonly hitKind: MetaverseCombatEventHitscanHitKindId;
  readonly hitNormalWorld: MetaversePresenceVector3Snapshot | null;
  readonly hitPointWorld: MetaversePresenceVector3Snapshot | null;
  readonly hitSurface: MetaverseCombatImpactSurfaceSnapshot | null;
  readonly regionId: MetaverseCombatHurtRegionId | null;
  readonly targetPlayerId: MetaversePlayerId | null;
}

export interface MetaverseCombatEventHitscanSnapshotInput {
  readonly finalReason?: MetaverseCombatShotResolutionFinalReasonId;
  readonly hitKind?: MetaverseCombatEventHitscanHitKindId;
  readonly hitNormalWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly hitPointWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly hitSurface?: MetaverseCombatImpactSurfaceSnapshotInput | null;
  readonly regionId?: MetaverseCombatHurtRegionId | null;
  readonly targetPlayerId?: MetaversePlayerId | null;
}

export interface MetaverseCombatEventProjectileSnapshot {
  readonly hitZone: MetaverseCombatHitZoneId | null;
  readonly impactNormalWorld: MetaversePresenceVector3Snapshot | null;
  readonly impactPointWorld: MetaversePresenceVector3Snapshot | null;
  readonly impactSurface: MetaverseCombatImpactSurfaceSnapshot | null;
  readonly resolutionKind: MetaverseCombatProjectileResolutionId | null;
  readonly targetPlayerId: MetaversePlayerId | null;
}

export interface MetaverseCombatEventProjectileSnapshotInput {
  readonly hitZone?: MetaverseCombatHitZoneId | null;
  readonly impactNormalWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly impactPointWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly impactSurface?: MetaverseCombatImpactSurfaceSnapshotInput | null;
  readonly resolutionKind?: MetaverseCombatProjectileResolutionId | null;
  readonly targetPlayerId?: MetaversePlayerId | null;
}

export interface MetaverseCombatEventSnapshot {
  readonly actionSequence: number;
  readonly activeSlotId: MetaverseWeaponSlotId | null;
  readonly aimTargetWorld: MetaversePresenceVector3Snapshot | null;
  readonly cameraRayForwardWorld: MetaversePresenceVector3Snapshot | null;
  readonly cameraRayOriginWorld: MetaversePresenceVector3Snapshot | null;
  readonly eventKind: MetaverseCombatEventKindId;
  readonly eventSequence: number;
  readonly hitscan: MetaverseCombatEventHitscanSnapshot | null;
  readonly launchDirectionWorld: MetaversePresenceVector3Snapshot | null;
  readonly playerId: MetaversePlayerId;
  readonly presentationDeliveryModel: MetaverseCombatWeaponPresentationDeliveryModelId;
  readonly projectile: MetaverseCombatEventProjectileSnapshot | null;
  readonly projectileId: string | null;
  readonly semanticMuzzleWorld: MetaversePresenceVector3Snapshot | null;
  readonly shotId: string;
  readonly timeMs: Milliseconds;
  readonly weaponId: string;
  readonly weaponInstanceId: string | null;
}

export interface MetaverseCombatEventSnapshotInput {
  readonly actionSequence?: number;
  readonly activeSlotId?: MetaverseWeaponSlotId | null;
  readonly aimTargetWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly cameraRayForwardWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly cameraRayOriginWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly eventKind: MetaverseCombatEventKindId;
  readonly eventSequence?: number;
  readonly hitscan?: MetaverseCombatEventHitscanSnapshotInput | null;
  readonly launchDirectionWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly playerId: MetaversePlayerId;
  readonly presentationDeliveryModel?: MetaverseCombatWeaponPresentationDeliveryModelId;
  readonly projectile?: MetaverseCombatEventProjectileSnapshotInput | null;
  readonly projectileId?: string | null;
  readonly semanticMuzzleWorld?: MetaversePresenceVector3SnapshotInput | null;
  readonly shotId?: string;
  readonly timeMs?: number;
  readonly weaponId: string;
  readonly weaponInstanceId?: string | null;
}

export interface MetaverseCombatSpawnFeedEventSnapshot {
  readonly playerId: MetaversePlayerId;
  readonly sequence: number;
  readonly teamId: MetaversePlayerTeamId;
  readonly timeMs: Milliseconds;
  readonly type: "spawn";
}

export interface MetaverseCombatSpawnFeedEventSnapshotInput {
  readonly playerId: MetaversePlayerId;
  readonly sequence?: number;
  readonly teamId: MetaversePlayerTeamId;
  readonly timeMs?: number;
}

export interface MetaverseCombatDamageFeedEventSnapshot {
  readonly attackerPlayerId: MetaversePlayerId;
  readonly damage: number;
  readonly hitZone: MetaverseCombatHitZoneId;
  readonly sequence: number;
  readonly sourceActionSequence: number;
  readonly sourceProjectileId: string | null;
  readonly targetPlayerId: MetaversePlayerId;
  readonly timeMs: Milliseconds;
  readonly type: "damage";
  readonly weaponId: string;
}

export interface MetaverseCombatDamageFeedEventSnapshotInput {
  readonly attackerPlayerId: MetaversePlayerId;
  readonly damage?: number;
  readonly hitZone?: MetaverseCombatHitZoneId;
  readonly sequence?: number;
  readonly sourceActionSequence: number;
  readonly sourceProjectileId?: string | null;
  readonly targetPlayerId: MetaversePlayerId;
  readonly timeMs?: number;
  readonly weaponId: string;
}

export interface MetaverseCombatKillFeedEventSnapshot {
  readonly assisterPlayerIds: readonly MetaversePlayerId[];
  readonly attackerPlayerId: MetaversePlayerId;
  readonly headshot: boolean;
  readonly sequence: number;
  readonly sourceActionSequence: number;
  readonly sourceProjectileId: string | null;
  readonly targetPlayerId: MetaversePlayerId;
  readonly targetTeamId: MetaversePlayerTeamId;
  readonly timeMs: Milliseconds;
  readonly type: "kill";
  readonly weaponId: string;
}

export interface MetaverseCombatKillFeedEventSnapshotInput {
  readonly assisterPlayerIds?: readonly MetaversePlayerId[];
  readonly attackerPlayerId: MetaversePlayerId;
  readonly headshot?: boolean;
  readonly sequence?: number;
  readonly sourceActionSequence: number;
  readonly sourceProjectileId?: string | null;
  readonly targetPlayerId: MetaversePlayerId;
  readonly targetTeamId: MetaversePlayerTeamId;
  readonly timeMs?: number;
  readonly weaponId: string;
}

export type MetaverseCombatFeedEventSnapshot =
  | MetaverseCombatDamageFeedEventSnapshot
  | MetaverseCombatKillFeedEventSnapshot
  | MetaverseCombatSpawnFeedEventSnapshot;

export type MetaverseCombatFeedEventSnapshotInput =
  | ({
      readonly type: "spawn";
    } & MetaverseCombatSpawnFeedEventSnapshotInput)
  | ({
      readonly type: "damage";
    } & MetaverseCombatDamageFeedEventSnapshotInput)
  | ({
      readonly type: "kill";
    } & MetaverseCombatKillFeedEventSnapshotInput);

export interface MetaverseCombatSphereSnapshot {
  readonly center: MetaversePresenceVector3Snapshot;
  readonly radiusMeters: number;
}

export interface MetaverseCombatCapsuleSnapshot {
  readonly end: MetaversePresenceVector3Snapshot;
  readonly radiusMeters: number;
  readonly start: MetaversePresenceVector3Snapshot;
}

export interface MetaverseCombatCapsuleHurtRegionSnapshot {
  readonly capsule: MetaverseCombatCapsuleSnapshot;
  readonly hitZone: MetaverseCombatHitZoneId;
  readonly regionId: MetaverseCombatHurtRegionId;
  readonly shape: "capsule";
}

export interface MetaverseCombatSphereHurtRegionSnapshot {
  readonly hitZone: MetaverseCombatHitZoneId;
  readonly regionId: MetaverseCombatHurtRegionId;
  readonly shape: "sphere";
  readonly sphere: MetaverseCombatSphereSnapshot;
}

export type MetaverseCombatHurtRegionSnapshot =
  | MetaverseCombatCapsuleHurtRegionSnapshot
  | MetaverseCombatSphereHurtRegionSnapshot;

export interface MetaversePlayerCombatHurtVolumesSnapshot {
  readonly bodyCapsule: MetaverseCombatCapsuleSnapshot;
  readonly headSphere: MetaverseCombatSphereSnapshot;
  readonly regions: readonly MetaverseCombatHurtRegionSnapshot[];
}

export interface MetaversePlayerCombatHurtVolumeConfig {
  readonly bodyBottomInsetMeters: number;
  readonly bodyTopInsetMeters: number;
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly headCenterHeightMeters: number;
  readonly headRadiusMeters: number;
}

export interface MetaversePlayerCombatHurtVolumeInput {
  readonly activeBodyYawRadians?: number;
  readonly activeBodyPosition: MetaversePresenceVector3SnapshotInput;
  readonly config?: Partial<MetaversePlayerCombatHurtVolumeConfig>;
}

export interface MetaverseCombatHitResolutionSnapshot {
  readonly distanceMeters: number;
  readonly hitZone: MetaverseCombatHitZoneId;
  readonly point: MetaversePresenceVector3Snapshot;
  readonly regionId: MetaverseCombatHurtRegionId;
}

export interface MetaverseCombatClosestHurtVolumePointSnapshot {
  readonly distanceMeters: number;
  readonly hitZone: MetaverseCombatHitZoneId;
  readonly point: MetaversePresenceVector3Snapshot;
  readonly regionId: MetaverseCombatHurtRegionId;
}

const defaultCombatWeaponAccuracy = Object.freeze({
  adsAffectsAccuracy: false,
  bloomDegrees: 0,
  gravityUnitsPerSecondSquared: 0,
  projectileLifetimeMs: createMilliseconds(2_000),
  projectileVelocityMetersPerSecond: 900,
  spreadDegrees: 0
} satisfies MetaverseCombatWeaponAccuracySnapshot);

const defaultCombatWeaponDeliveryModel: MetaverseCombatWeaponDeliveryModelId =
  "projectile";
const defaultCombatWeaponFiringOriginHeightMeters = 1.62;
const defaultCombatWeaponFiringOriginOffset = Object.freeze({
  forwardMeters: 0,
  rightMeters: 0,
  upMeters: defaultCombatWeaponFiringOriginHeightMeters
} satisfies MetaverseCombatWeaponFiringOriginOffsetSnapshot);
const defaultCombatWeaponAuthoredSocketRotation = Object.freeze({
  w: 1,
  x: 0,
  y: 0,
  z: 0
} satisfies MetaverseCombatWeaponAuthoredSocketRotationSnapshot);
const defaultCombatWeaponObjectLocalPrimaryGripFrame = Object.freeze({
  forwardMeters: 0,
  rightMeters: 0,
  role: "grip.primary",
  rotation: defaultCombatWeaponAuthoredSocketRotation,
  source: "weapon-manifest-socket",
  upMeters: 0
} satisfies MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot);
const defaultCombatWeaponObjectLocalMuzzleFrame = Object.freeze({
  forwardMeters: 0,
  rightMeters: 0,
  role: "projectile.muzzle",
  rotation: defaultCombatWeaponAuthoredSocketRotation,
  source: "weapon-manifest-socket",
  upMeters: 0
} satisfies MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot);

const defaultCombatMatchTeams = Object.freeze([
  Object.freeze({
    playerIds: Object.freeze([]),
    score: 0,
    teamId: "red"
  } satisfies MetaverseCombatTeamSnapshotInput),
  Object.freeze({
    playerIds: Object.freeze([]),
    score: 0,
    teamId: "blue"
  } satisfies MetaverseCombatTeamSnapshotInput)
] satisfies readonly MetaverseCombatTeamSnapshotInput[]);

export const defaultMetaversePlayerCombatHurtVolumeConfig = Object.freeze({
  bodyBottomInsetMeters: 0,
  bodyTopInsetMeters: 0.22,
  capsuleHalfHeightMeters:
    metaverseGroundedBodyTraversalCoreConfig.capsuleHalfHeightMeters,
  capsuleRadiusMeters:
    metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters,
  headCenterHeightMeters:
    metaverseGroundedBodyTraversalCoreConfig.capsuleHalfHeightMeters +
    metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters * 0.82,
  headRadiusMeters: 0.18
} satisfies MetaversePlayerCombatHurtVolumeConfig);

function normalizeFiniteNumber(rawValue: number | undefined, fallback = 0): number {
  return Number.isFinite(rawValue) ? rawValue ?? fallback : fallback;
}

function normalizeFiniteNonNegativeNumber(
  rawValue: number | undefined,
  fallback = 0
): number {
  const normalizedValue = normalizeFiniteNumber(rawValue ?? fallback, fallback);

  return normalizedValue <= 0 ? 0 : normalizedValue;
}

function normalizeFiniteNonNegativeInteger(
  rawValue: number | undefined,
  fallback = 0
): number {
  return Math.floor(normalizeFiniteNonNegativeNumber(rawValue, fallback));
}

function normalizeFiniteInteger(
  rawValue: number | undefined,
  fallback = 0
): number {
  return Math.trunc(normalizeFiniteNumber(rawValue ?? fallback, fallback));
}

function normalizeIdentifier(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return normalizedValue;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  label: string
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeIdentifier(value, label);
}

function clampToUnitRange(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < -1) {
    return -1;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function normalizeTimeMs(rawValue: number | null | undefined): Milliseconds | null {
  if (rawValue === null) {
    return null;
  }

  return createMilliseconds(normalizeFiniteNonNegativeNumber(rawValue));
}

function normalizeProjectileResolution(
  value: string | undefined
): MetaverseCombatProjectileResolutionId {
  return metaverseCombatProjectileResolutionIds.includes(
    value as MetaverseCombatProjectileResolutionId
  )
    ? (value as MetaverseCombatProjectileResolutionId)
    : "active";
}

function normalizePlayerActionReceiptStatus(
  value: string | undefined
): MetaversePlayerActionReceiptStatusId {
  return metaversePlayerActionReceiptStatusIds.includes(
    value as MetaversePlayerActionReceiptStatusId
  )
    ? (value as MetaversePlayerActionReceiptStatusId)
    : "rejected";
}

function normalizePlayerActionFireWeaponRejectionReason(
  value: string | null | undefined
): MetaversePlayerActionFireWeaponRejectionReasonId | null {
  if (value === null || value === undefined) {
    return null;
  }

  return metaversePlayerActionFireWeaponRejectionReasonIds.includes(
    value as MetaversePlayerActionFireWeaponRejectionReasonId
  )
    ? (value as MetaversePlayerActionFireWeaponRejectionReasonId)
    : null;
}

function normalizePlayerActionSwitchWeaponSlotRejectionReason(
  value: string | null | undefined
): MetaversePlayerActionSwitchWeaponSlotRejectionReasonId | null {
  if (value === null || value === undefined) {
    return null;
  }

  return metaversePlayerActionSwitchWeaponSlotRejectionReasonIds.includes(
    value as MetaversePlayerActionSwitchWeaponSlotRejectionReasonId
  )
    ? (value as MetaversePlayerActionSwitchWeaponSlotRejectionReasonId)
    : null;
}

function normalizePlayerActionInteractWeaponResourceRejectionReason(
  value: string | null | undefined
): MetaversePlayerActionInteractWeaponResourceRejectionReasonId | null {
  if (value === null || value === undefined) {
    return null;
  }

  return metaversePlayerActionInteractWeaponResourceRejectionReasonIds.includes(
    value as MetaversePlayerActionInteractWeaponResourceRejectionReasonId
  )
    ? (value as MetaversePlayerActionInteractWeaponResourceRejectionReasonId)
    : null;
}

function normalizeCombatEventKind(
  value: string | undefined
): MetaverseCombatEventKindId {
  return metaverseCombatEventKindIds.includes(
    value as MetaverseCombatEventKindId
  )
    ? (value as MetaverseCombatEventKindId)
    : "hitscan-resolved";
}

function normalizeCombatEventHitscanHitKind(
  value: string | undefined
): MetaverseCombatEventHitscanHitKindId {
  return metaverseCombatEventHitscanHitKindIds.includes(
    value as MetaverseCombatEventHitscanHitKindId
  )
    ? (value as MetaverseCombatEventHitscanHitKindId)
    : "miss";
}

function normalizeHitZone(
  value: string | null | undefined,
  fallback: MetaverseCombatHitZoneId | null = null
): MetaverseCombatHitZoneId | null {
  if (value === null || value === undefined) {
    return fallback;
  }

  return metaverseCombatHitZoneIds.includes(value as MetaverseCombatHitZoneId)
    ? (value as MetaverseCombatHitZoneId)
    : fallback;
}

function normalizeHurtRegionId(
  value: string | null | undefined,
  fallback: MetaverseCombatHurtRegionId | null = null
): MetaverseCombatHurtRegionId | null {
  if (value === null || value === undefined) {
    return fallback;
  }

  return metaverseCombatHurtRegionIds.includes(
    value as MetaverseCombatHurtRegionId
  )
    ? (value as MetaverseCombatHurtRegionId)
    : fallback;
}

function normalizeShotResolutionFinalReason(
  value: string | undefined
): MetaverseCombatShotResolutionFinalReasonId {
  return metaverseCombatShotResolutionFinalReasonIds.includes(
    value as MetaverseCombatShotResolutionFinalReasonId
  )
    ? (value as MetaverseCombatShotResolutionFinalReasonId)
    : "miss-no-hurtbox";
}

function normalizeMatchPhase(
  value: string | undefined
): MetaverseCombatMatchPhaseId {
  return metaverseCombatMatchPhaseIds.includes(value as MetaverseCombatMatchPhaseId)
    ? (value as MetaverseCombatMatchPhaseId)
    : "waiting-for-players";
}

function normalizeWeaponFireMode(
  value: string | undefined
): MetaverseCombatWeaponFireModeId {
  return metaverseCombatWeaponFireModeIds.includes(
    value as MetaverseCombatWeaponFireModeId
  )
    ? (value as MetaverseCombatWeaponFireModeId)
    : "semi";
}

function normalizeWeaponDeliveryModel(
  value: string | undefined
): MetaverseCombatWeaponDeliveryModelId {
  return metaverseCombatWeaponDeliveryModelIds.includes(
    value as MetaverseCombatWeaponDeliveryModelId
  )
    ? (value as MetaverseCombatWeaponDeliveryModelId)
    : defaultCombatWeaponDeliveryModel;
}

function normalizeWeaponPresentationDeliveryModel(
  value: string | undefined,
  deliveryModel: MetaverseCombatWeaponDeliveryModelId
): MetaverseCombatWeaponPresentationDeliveryModelId {
  return metaverseCombatWeaponPresentationDeliveryModelIds.includes(
    value as MetaverseCombatWeaponPresentationDeliveryModelId
  )
    ? (value as MetaverseCombatWeaponPresentationDeliveryModelId)
    : deliveryModel === "hitscan"
      ? "hitscan-tracer"
      : "authoritative-projectile";
}

function normalizeTraversalActionResolutionState(
  value: string | undefined
): MetaverseTraversalActionResolutionStateId {
  return metaverseTraversalActionResolutionStateIds.includes(
    value as MetaverseTraversalActionResolutionStateId
  )
    ? (value as MetaverseTraversalActionResolutionStateId)
    : "none";
}

function createVector3Snapshot(
  input: MetaversePresenceVector3SnapshotInput
): MetaversePresenceVector3Snapshot {
  return createMetaversePresenceVector3Snapshot({
    x: normalizeFiniteNumber(input.x),
    y: normalizeFiniteNumber(input.y),
    z: normalizeFiniteNumber(input.z)
  });
}

function normalizeUnitVector3(
  input: MetaversePresenceVector3SnapshotInput
): { readonly x: number; readonly y: number; readonly z: number } | null {
  const x = normalizeFiniteNumber(input.x);
  const y = normalizeFiniteNumber(input.y);
  const z = normalizeFiniteNumber(input.z);
  const length = Math.sqrt(x * x + y * y + z * z);

  if (length <= 0.000001) {
    return null;
  }

  return Object.freeze({
    x: x / length,
    y: y / length,
    z: z / length
  });
}

function normalizeUnitPlanarVector(input: {
  readonly x: number;
  readonly z: number;
}): { readonly x: number; readonly z: number } | null {
  const length = Math.sqrt(input.x * input.x + input.z * input.z);

  if (length <= 0.000001) {
    return null;
  }

  return Object.freeze({
    x: input.x / length,
    z: input.z / length
  });
}

function addMetaverseCombatWeaponFiringOriginOffsets(
  left: MetaverseCombatWeaponFiringOriginOffsetSnapshot,
  right: MetaverseCombatWeaponFiringOriginOffsetSnapshot
): MetaverseCombatWeaponFiringOriginOffsetSnapshot {
  return createMetaverseCombatWeaponFiringOriginOffsetSnapshot({
    forwardMeters: left.forwardMeters + right.forwardMeters,
    rightMeters: left.rightMeters + right.rightMeters,
    upMeters: left.upMeters + right.upMeters
  });
}

function subtractMetaverseCombatWeaponFiringOriginOffsets(
  left: MetaverseCombatWeaponFiringOriginOffsetSnapshot,
  right: MetaverseCombatWeaponFiringOriginOffsetSnapshot
): MetaverseCombatWeaponFiringOriginOffsetSnapshot {
  return createMetaverseCombatWeaponFiringOriginOffsetSnapshot({
    forwardMeters: left.forwardMeters - right.forwardMeters,
    rightMeters: left.rightMeters - right.rightMeters,
    upMeters: left.upMeters - right.upMeters
  });
}

function createMetaverseCombatWeaponMuzzleFromGripOffset(
  primaryGripFrame:
    | MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot
    | null
    | undefined,
  muzzleFrame:
    | MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot
    | null
    | undefined
): MetaverseCombatWeaponFiringOriginOffsetSnapshot {
  if (primaryGripFrame === null || primaryGripFrame === undefined) {
    return createMetaverseCombatWeaponFiringOriginOffsetSnapshot({
      forwardMeters: 0,
      rightMeters: 0,
      upMeters: 0
    });
  }

  if (muzzleFrame === null || muzzleFrame === undefined) {
    return createMetaverseCombatWeaponFiringOriginOffsetSnapshot({
      forwardMeters: 0,
      rightMeters: 0,
      upMeters: 0
    });
  }

  return createMetaverseCombatWeaponFiringOriginOffsetSnapshot({
    forwardMeters: muzzleFrame.forwardMeters - primaryGripFrame.forwardMeters,
    rightMeters: muzzleFrame.rightMeters - primaryGripFrame.rightMeters,
    upMeters: muzzleFrame.upMeters - primaryGripFrame.upMeters
  });
}

export function resolveMetaverseCombatSemanticWeaponTipOrigin(
  input: MetaverseCombatSemanticWeaponTipFrameInput
): MetaversePresenceVector3Snapshot {
  return resolveMetaverseCombatSemanticWeaponTipFrame(input).originWorld;
}

export function resolveMetaverseCombatSemanticWeaponTipFrame(
  input: MetaverseCombatSemanticWeaponTipFrameInput
): MetaverseCombatSemanticWeaponTipFrameSnapshot {
  const bodyPosition = createVector3Snapshot(input.actorBodyPosition);
  const actorBodyYawRadians = normalizeFiniteNumber(input.actorBodyYawRadians);
  const bodyForward = Object.freeze({
    x: Math.sin(actorBodyYawRadians),
    z: -Math.cos(actorBodyYawRadians)
  });
  const bodyRight = Object.freeze({
    x: Math.cos(actorBodyYawRadians),
    z: Math.sin(actorBodyYawRadians)
  });
  const semanticAimForward =
    normalizeUnitVector3(input.semanticAimForward) ??
    Object.freeze({
      x: bodyForward.x,
      y: 0,
      z: bodyForward.z
    });
  const aimYawForward =
    normalizeUnitPlanarVector({
      x: semanticAimForward.x,
      z: semanticAimForward.z
    }) ?? bodyForward;
  const aimRight = Object.freeze({
    x: -aimYawForward.z,
    z: aimYawForward.x
  });
  const aimYawInfluence = Math.max(
    0,
    Math.min(1, normalizeFiniteNumber(input.aimYawInfluence, 1))
  );
  const blendedRight =
    normalizeUnitPlanarVector({
      x:
        bodyRight.x * (1 - aimYawInfluence) +
        aimRight.x * aimYawInfluence,
      z:
        bodyRight.z * (1 - aimYawInfluence) +
        aimRight.z * aimYawInfluence
    }) ?? bodyRight;
  const authoredMuzzleFromGrip =
    input.authoredMuzzleFromGrip ??
    createMetaverseCombatWeaponMuzzleFromGripOffset(
      input.objectLocalPrimaryGripFrame,
      input.objectLocalMuzzleFrame
    );
  const primaryGripAnchorOffset =
    input.primaryGripAnchorOffset ??
    (input.semanticLaunchOriginOffset === undefined
      ? input.firingOriginOffset
      : subtractMetaverseCombatWeaponFiringOriginOffsets(
          input.semanticLaunchOriginOffset,
          authoredMuzzleFromGrip
        ));
  const semanticLaunchOriginOffset =
    addMetaverseCombatWeaponFiringOriginOffsets(
      primaryGripAnchorOffset,
      authoredMuzzleFromGrip
    );
  const primaryGripWorld = createMetaversePresenceVector3Snapshot({
    x:
      bodyPosition.x +
      blendedRight.x * primaryGripAnchorOffset.rightMeters +
      semanticAimForward.x * primaryGripAnchorOffset.forwardMeters,
    y:
      bodyPosition.y +
      primaryGripAnchorOffset.upMeters +
      semanticAimForward.y * primaryGripAnchorOffset.forwardMeters,
    z:
      bodyPosition.z +
      blendedRight.z * primaryGripAnchorOffset.rightMeters +
      semanticAimForward.z * primaryGripAnchorOffset.forwardMeters
  });
  const originWorld = createMetaversePresenceVector3Snapshot({
    x:
      primaryGripWorld.x +
      blendedRight.x * authoredMuzzleFromGrip.rightMeters +
      semanticAimForward.x * authoredMuzzleFromGrip.forwardMeters,
    y:
      primaryGripWorld.y +
      authoredMuzzleFromGrip.upMeters +
      semanticAimForward.y * authoredMuzzleFromGrip.forwardMeters,
    z:
      primaryGripWorld.z +
      blendedRight.z * authoredMuzzleFromGrip.rightMeters +
      semanticAimForward.z * authoredMuzzleFromGrip.forwardMeters
  });

  return Object.freeze({
    aimForwardWorld: createMetaversePresenceVector3Snapshot({
      x: semanticAimForward.x,
      y: semanticAimForward.y,
      z: semanticAimForward.z
    }),
    aimRightWorld: createMetaversePresenceVector3Snapshot({
      x: blendedRight.x,
      y: 0,
      z: blendedRight.z
    }),
    objectLocalMuzzleFrame: input.objectLocalMuzzleFrame ?? null,
    objectLocalPrimaryGripFrame: input.objectLocalPrimaryGripFrame ?? null,
    originWorld,
    primaryGripAnchorOffset:
      createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
        primaryGripAnchorOffset
      ),
    primaryGripWorld,
    authoredMuzzleFromGrip: createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
      authoredMuzzleFromGrip
    ),
    semanticLaunchOriginOffset,
    source: "shared-semantic-weapon-tip",
    worldUp: createMetaversePresenceVector3Snapshot({
      x: 0,
      y: 1,
      z: 0
    })
  });
}

function createNullableAimRayVectorSnapshot(
  input: MetaversePresenceVector3SnapshotInput | null | undefined
): MetaversePresenceVector3Snapshot | null {
  if (input === null || input === undefined) {
    return null;
  }

  return Object.freeze({
    x: Number(input.x),
    y: Number(input.y),
    z: Number(input.z)
  });
}

function createNullableVector3Snapshot(
  input: MetaversePresenceVector3SnapshotInput | null | undefined
): MetaversePresenceVector3Snapshot | null {
  if (input === null || input === undefined) {
    return null;
  }

  return createVector3Snapshot(input);
}

export function createMetaverseCombatAimSnapshot(
  input: MetaverseCombatAimSnapshotInput = {}
): MetaverseCombatAimSnapshot {
  return Object.freeze({
    pitchRadians: createRadians(normalizeFiniteNumber(input.pitchRadians ?? 0)),
    rayForwardWorld: createNullableAimRayVectorSnapshot(input.rayForwardWorld),
    rayOriginWorld: createNullableAimRayVectorSnapshot(input.rayOriginWorld),
    yawRadians: createRadians(normalizeFiniteNumber(input.yawRadians ?? 0))
  });
}

function createPointOnSegment(
  start: MetaversePresenceVector3Snapshot,
  end: MetaversePresenceVector3Snapshot,
  alpha: number
): MetaversePresenceVector3Snapshot {
  const t = Math.max(0, Math.min(1, alpha));

  return createVector3Snapshot({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t
  });
}

function createYawedHurtVolumePoint(
  origin: MetaversePresenceVector3Snapshot,
  yawSin: number,
  yawCos: number,
  localX: number,
  worldY: number,
  localZ: number
): MetaversePresenceVector3Snapshot {
  return createVector3Snapshot({
    x: origin.x + localX * yawCos - localZ * yawSin,
    y: worldY,
    z: origin.z + localX * yawSin + localZ * yawCos
  });
}

function readDot(
  left: Pick<MetaversePresenceVector3Snapshot, "x" | "y" | "z">,
  right: Pick<MetaversePresenceVector3Snapshot, "x" | "y" | "z">
): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function subtractVectors(
  left: Pick<MetaversePresenceVector3Snapshot, "x" | "y" | "z">,
  right: Pick<MetaversePresenceVector3Snapshot, "x" | "y" | "z">
): MetaversePresenceVector3Snapshot {
  return createVector3Snapshot({
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z
  });
}

function readLengthSquared(
  value: Pick<MetaversePresenceVector3Snapshot, "x" | "y" | "z">
): number {
  return readDot(value, value);
}

function readSegmentSphereIntersectionDistance(
  segmentStart: MetaversePresenceVector3Snapshot,
  segmentEnd: MetaversePresenceVector3Snapshot,
  sphere: MetaverseCombatSphereSnapshot
): number | null {
  const segmentDirection = subtractVectors(segmentEnd, segmentStart);
  const originToCenter = subtractVectors(segmentStart, sphere.center);
  const a = readLengthSquared(segmentDirection);

  if (a <= 0.000001) {
    return null;
  }

  const b = 2 * readDot(segmentDirection, originToCenter);
  const c =
    readLengthSquared(originToCenter) - sphere.radiusMeters * sphere.radiusMeters;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  const t =
    t1 >= 0 && t1 <= 1 ? t1 : t2 >= 0 && t2 <= 1 ? t2 : null;

  if (t === null) {
    return null;
  }

  return Math.sqrt(a) * t;
}

function readSegmentCapsuleIntersectionDistance(
  segmentStart: MetaversePresenceVector3Snapshot,
  segmentEnd: MetaversePresenceVector3Snapshot,
  capsule: MetaverseCombatCapsuleSnapshot
): number | null {
  const segmentDirection = subtractVectors(segmentEnd, segmentStart);
  const capsuleAxis = subtractVectors(capsule.end, capsule.start);
  const segmentLengthSquared = readLengthSquared(segmentDirection);
  const capsuleAxisLengthSquared = readLengthSquared(capsuleAxis);

  if (segmentLengthSquared <= 0.000001) {
    return null;
  }

  const segmentLength = Math.sqrt(segmentLengthSquared);
  const candidateDistances: number[] = [];
  const startSphereDistance = readSegmentSphereIntersectionDistance(
    segmentStart,
    segmentEnd,
    Object.freeze({
      center: capsule.start,
      radiusMeters: capsule.radiusMeters
    })
  );

  if (startSphereDistance !== null) {
    candidateDistances.push(startSphereDistance);
  }

  const endSphereDistance = readSegmentSphereIntersectionDistance(
    segmentStart,
    segmentEnd,
    Object.freeze({
      center: capsule.end,
      radiusMeters: capsule.radiusMeters
    })
  );

  if (endSphereDistance !== null) {
    candidateDistances.push(endSphereDistance);
  }

  if (capsuleAxisLengthSquared > 0.000001) {
    const startToAxisStart = subtractVectors(segmentStart, capsule.start);
    const axisProjectionScale = 1 / capsuleAxisLengthSquared;
    const startProjection =
      readDot(startToAxisStart, capsuleAxis) * axisProjectionScale;
    const directionProjection =
      readDot(segmentDirection, capsuleAxis) * axisProjectionScale;
    const radialStart = subtractVectors(
      startToAxisStart,
      createVector3Snapshot({
        x: capsuleAxis.x * startProjection,
        y: capsuleAxis.y * startProjection,
        z: capsuleAxis.z * startProjection
      })
    );
    const radialDirection = subtractVectors(
      segmentDirection,
      createVector3Snapshot({
        x: capsuleAxis.x * directionProjection,
        y: capsuleAxis.y * directionProjection,
        z: capsuleAxis.z * directionProjection
      })
    );
    const a = readLengthSquared(radialDirection);
    const b = 2 * readDot(radialDirection, radialStart);
    const c =
      readLengthSquared(radialStart) -
      capsule.radiusMeters * capsule.radiusMeters;

    if (a > 0.000001) {
      const discriminant = b * b - 4 * a * c;

      if (discriminant >= 0) {
        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / (2 * a);
        const t2 = (-b + sqrtDiscriminant) / (2 * a);

        for (const t of [t1, t2]) {
          if (t < 0 || t > 1) {
            continue;
          }

          const axisAlpha = startProjection + directionProjection * t;

          if (axisAlpha >= 0 && axisAlpha <= 1) {
            candidateDistances.push(segmentLength * t);
          }
        }
      }
    }
  }

  if (candidateDistances.length === 0) {
    return null;
  }

  return Math.min(...candidateDistances);
}

function resolveClosestPointOnSphere(
  point: MetaversePresenceVector3Snapshot,
  sphere: MetaverseCombatSphereSnapshot
): {
  readonly distanceMeters: number;
  readonly point: MetaversePresenceVector3Snapshot;
} {
  const centerToPoint = subtractVectors(point, sphere.center);
  const centerDistanceMeters = Math.sqrt(readLengthSquared(centerToPoint));
  const radiusMeters = Math.max(0, sphere.radiusMeters);

  if (centerDistanceMeters <= radiusMeters || centerDistanceMeters <= 0.000001) {
    return Object.freeze({
      distanceMeters: 0,
      point
    });
  }

  const surfaceScale = radiusMeters / centerDistanceMeters;
  const closestPoint = createVector3Snapshot({
    x: sphere.center.x + centerToPoint.x * surfaceScale,
    y: sphere.center.y + centerToPoint.y * surfaceScale,
    z: sphere.center.z + centerToPoint.z * surfaceScale
  });

  return Object.freeze({
    distanceMeters: centerDistanceMeters - radiusMeters,
    point: closestPoint
  });
}

function resolveClosestPointOnCapsule(
  point: MetaversePresenceVector3Snapshot,
  capsule: MetaverseCombatCapsuleSnapshot
): {
  readonly distanceMeters: number;
  readonly point: MetaversePresenceVector3Snapshot;
} {
  const capsuleAxis = subtractVectors(capsule.end, capsule.start);
  const axisLengthSquared = readLengthSquared(capsuleAxis);
  const startToPoint = subtractVectors(point, capsule.start);
  const axisAlpha =
    axisLengthSquared <= 0.000001
      ? 0
      : Math.max(
          0,
          Math.min(1, readDot(startToPoint, capsuleAxis) / axisLengthSquared)
        );
  const axisPoint = createPointOnSegment(
    capsule.start,
    capsule.end,
    axisAlpha
  );
  const axisPointToPoint = subtractVectors(point, axisPoint);
  const axisDistanceMeters = Math.sqrt(readLengthSquared(axisPointToPoint));
  const radiusMeters = Math.max(0, capsule.radiusMeters);

  if (axisDistanceMeters <= radiusMeters || axisDistanceMeters <= 0.000001) {
    return Object.freeze({
      distanceMeters: 0,
      point
    });
  }

  const surfaceScale = radiusMeters / axisDistanceMeters;
  const closestPoint = createVector3Snapshot({
    x: axisPoint.x + axisPointToPoint.x * surfaceScale,
    y: axisPoint.y + axisPointToPoint.y * surfaceScale,
    z: axisPoint.z + axisPointToPoint.z * surfaceScale
  });

  return Object.freeze({
    distanceMeters: axisDistanceMeters - radiusMeters,
    point: closestPoint
  });
}

function createMetaverseCombatWeaponAreaDamageSnapshot(
  input: MetaverseCombatWeaponAreaDamageSnapshotInput | null | undefined
): MetaverseCombatWeaponAreaDamageSnapshot | null {
  if (input === null || input === undefined) {
    return null;
  }

  const innerRadiusMeters = normalizeFiniteNonNegativeNumber(
    input.innerRadiusMeters
  );
  const outerRadiusMeters = Math.max(
    innerRadiusMeters,
    normalizeFiniteNonNegativeNumber(input.outerRadiusMeters)
  );
  const maxDamage = normalizeFiniteNonNegativeNumber(input.maxDamage);
  const minDamage = Math.min(
    maxDamage,
    normalizeFiniteNonNegativeNumber(input.minDamage)
  );

  return Object.freeze({
    affectsOwner: input.affectsOwner === true,
    affectsTeammates: input.affectsTeammates === true,
    innerRadiusMeters,
    lineOfSightRequired: input.lineOfSightRequired !== false,
    maxDamage,
    minDamage,
    outerRadiusMeters
  });
}

function createMetaverseCombatWeaponBurstSnapshot(
  input: MetaverseCombatWeaponBurstSnapshotInput | null | undefined,
  fireMode: MetaverseCombatWeaponFireModeId
): MetaverseCombatWeaponBurstSnapshot | null {
  if (fireMode !== "burst") {
    return null;
  }

  return Object.freeze({
    roundIntervalMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input?.roundIntervalMs, 90)
    ),
    roundsPerBurst: Math.max(
      2,
      normalizeFiniteNonNegativeInteger(input?.roundsPerBurst, 3)
    )
  });
}

function createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
  input: MetaverseCombatWeaponFiringOriginOffsetSnapshotInput | undefined
): MetaverseCombatWeaponFiringOriginOffsetSnapshot {
  return Object.freeze({
    forwardMeters: normalizeFiniteNumber(
      input?.forwardMeters,
      defaultCombatWeaponFiringOriginOffset.forwardMeters
    ),
    rightMeters: normalizeFiniteNumber(
      input?.rightMeters,
      defaultCombatWeaponFiringOriginOffset.rightMeters
    ),
    upMeters: normalizeFiniteNonNegativeNumber(
      input?.upMeters,
      defaultCombatWeaponFiringOriginOffset.upMeters
    )
  });
}

function normalizeWeaponAuthoredSocketRole(
  value: string | undefined,
  fallback: MetaverseCombatWeaponAuthoredSocketRoleId
): MetaverseCombatWeaponAuthoredSocketRoleId {
  return metaverseCombatWeaponAuthoredSocketRoleIds.includes(
    value as MetaverseCombatWeaponAuthoredSocketRoleId
  )
    ? (value as MetaverseCombatWeaponAuthoredSocketRoleId)
    : fallback;
}

function createMetaverseCombatWeaponAuthoredSocketRotationSnapshot(
  input:
    | MetaverseCombatWeaponAuthoredSocketRotationSnapshotInput
    | undefined
): MetaverseCombatWeaponAuthoredSocketRotationSnapshot {
  return Object.freeze({
    w: normalizeFiniteNumber(
      input?.w,
      defaultCombatWeaponAuthoredSocketRotation.w
    ),
    x: normalizeFiniteNumber(
      input?.x,
      defaultCombatWeaponAuthoredSocketRotation.x
    ),
    y: normalizeFiniteNumber(
      input?.y,
      defaultCombatWeaponAuthoredSocketRotation.y
    ),
    z: normalizeFiniteNumber(
      input?.z,
      defaultCombatWeaponAuthoredSocketRotation.z
    )
  });
}

function createMetaverseCombatWeaponAuthoredSocketFrameSnapshot<
  Role extends MetaverseCombatWeaponAuthoredSocketRoleId
>(
  input:
    | MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput<Role>
    | undefined,
  role: Role,
  fallback: MetaverseCombatWeaponAuthoredSocketFrameSnapshot<Role>
): MetaverseCombatWeaponAuthoredSocketFrameSnapshot<Role> {
  return Object.freeze({
    forwardMeters: normalizeFiniteNumber(
      input?.forwardMeters,
      fallback.forwardMeters
    ),
    rightMeters: normalizeFiniteNumber(
      input?.rightMeters,
      fallback.rightMeters
    ),
    role,
    rotation: createMetaverseCombatWeaponAuthoredSocketRotationSnapshot(
      input?.rotation ?? fallback.rotation
    ),
    source: "weapon-manifest-socket",
    upMeters: normalizeFiniteNumber(
      input?.upMeters,
      fallback.upMeters
    )
  });
}

function readMetaverseCombatWeaponAuthoredSocketFrameInput<
  Role extends MetaverseCombatWeaponAuthoredSocketRoleId
>(
  frames:
    | readonly MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput[]
    | undefined,
  role: Role
): MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput<Role> | undefined {
  return frames?.find((frame) => frame.role === role) as
    | MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput<Role>
    | undefined;
}

function createMetaverseCombatWeaponAuthoredSocketFramesSnapshot(input: {
  readonly authoredSocketFrames?:
    | readonly MetaverseCombatWeaponAuthoredSocketFrameSnapshotInput[]
    | undefined;
  readonly objectLocalMuzzleFrame: MetaverseCombatWeaponObjectLocalMuzzleFrameSnapshot;
  readonly objectLocalPrimaryGripFrame: MetaverseCombatWeaponObjectLocalPrimaryGripFrameSnapshot;
}): readonly MetaverseCombatWeaponAuthoredSocketFrameSnapshot[] {
  const framesByRole = new Map<
    MetaverseCombatWeaponAuthoredSocketRoleId,
    MetaverseCombatWeaponAuthoredSocketFrameSnapshot
  >();

  framesByRole.set(
    input.objectLocalPrimaryGripFrame.role,
    input.objectLocalPrimaryGripFrame
  );
  framesByRole.set(input.objectLocalMuzzleFrame.role, input.objectLocalMuzzleFrame);

  for (const frameInput of input.authoredSocketFrames ?? []) {
    const role = normalizeWeaponAuthoredSocketRole(frameInput.role, "grip.primary");
    const fallback =
      role === "projectile.muzzle"
        ? input.objectLocalMuzzleFrame
        : role === "grip.primary"
          ? input.objectLocalPrimaryGripFrame
          : ({
              forwardMeters: 0,
              rightMeters: 0,
              role,
              rotation: defaultCombatWeaponAuthoredSocketRotation,
              source: "weapon-manifest-socket",
              upMeters: 0
            } satisfies MetaverseCombatWeaponAuthoredSocketFrameSnapshot);

    framesByRole.set(
      role,
      createMetaverseCombatWeaponAuthoredSocketFrameSnapshot(
        frameInput,
        role,
        fallback
      )
    );
  }

  return Object.freeze([...framesByRole.values()]);
}

function createMetaverseCombatWeaponProjectilePresentationSnapshot(
  input:
    | MetaverseCombatWeaponProjectilePresentationSnapshotInput
    | undefined,
  semanticLaunchOriginOffsetFallback: MetaverseCombatWeaponFiringOriginOffsetSnapshot
): MetaverseCombatWeaponProjectilePresentationSnapshot {
  const primaryGripFrameInput =
    input?.objectLocalPrimaryGripFrame ??
    readMetaverseCombatWeaponAuthoredSocketFrameInput(
      input?.authoredSocketFrames,
      "grip.primary"
    );
  const muzzleFrameInput =
    input?.objectLocalMuzzleFrame ??
    readMetaverseCombatWeaponAuthoredSocketFrameInput(
      input?.authoredSocketFrames,
      "projectile.muzzle"
    );
  const objectLocalPrimaryGripFrame =
    createMetaverseCombatWeaponAuthoredSocketFrameSnapshot(
      primaryGripFrameInput,
      "grip.primary",
      defaultCombatWeaponObjectLocalPrimaryGripFrame
    );
  const objectLocalMuzzleFrame =
    createMetaverseCombatWeaponAuthoredSocketFrameSnapshot(
      muzzleFrameInput,
      "projectile.muzzle",
      defaultCombatWeaponObjectLocalMuzzleFrame
    );
  const authoredMuzzleFromGrip =
    createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
      input?.authoredMuzzleFromGrip ??
        createMetaverseCombatWeaponMuzzleFromGripOffset(
          objectLocalPrimaryGripFrame,
          objectLocalMuzzleFrame
        )
    );
  const primaryGripAnchorOffset =
    createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
      input?.primaryGripAnchorOffset ??
        subtractMetaverseCombatWeaponFiringOriginOffsets(
          input?.semanticLaunchOriginOffset === undefined
            ? semanticLaunchOriginOffsetFallback
            : createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
                input.semanticLaunchOriginOffset
              ),
          authoredMuzzleFromGrip
        )
    );
  const semanticLaunchOriginOffset =
    input?.semanticLaunchOriginOffset === undefined
      ? addMetaverseCombatWeaponFiringOriginOffsets(
          primaryGripAnchorOffset,
          authoredMuzzleFromGrip
        )
      : createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
          input.semanticLaunchOriginOffset
        );

  return Object.freeze({
    authoredMuzzleFromGrip,
    authoredSocketFrames:
      createMetaverseCombatWeaponAuthoredSocketFramesSnapshot({
        authoredSocketFrames: input?.authoredSocketFrames,
        objectLocalMuzzleFrame,
        objectLocalPrimaryGripFrame
      }),
    objectLocalMuzzleFrame,
    objectLocalPrimaryGripFrame,
    primaryGripAnchorOffset,
    primaryGripRole: "grip.primary",
    muzzleRole: "projectile.muzzle",
    semanticLaunchOriginOffset
  });
}

export function createMetaverseCombatWeaponProfileSnapshot(
  input: MetaverseCombatWeaponProfileSnapshotInput
): MetaverseCombatWeaponProfileSnapshot {
  const deliveryModel = normalizeWeaponDeliveryModel(input.deliveryModel);
  const fireMode = normalizeWeaponFireMode(input.fireMode);
  const firingOriginOffset = createMetaverseCombatWeaponFiringOriginOffsetSnapshot(
    input.firingOriginOffset
  );

  return Object.freeze({
    accuracy: Object.freeze({
      adsAffectsAccuracy:
        input.accuracy?.adsAffectsAccuracy ??
        defaultCombatWeaponAccuracy.adsAffectsAccuracy,
      bloomDegrees: normalizeFiniteNonNegativeNumber(
        input.accuracy?.bloomDegrees,
        defaultCombatWeaponAccuracy.bloomDegrees
      ),
      gravityUnitsPerSecondSquared: normalizeFiniteNumber(
        input.accuracy?.gravityUnitsPerSecondSquared ??
          defaultCombatWeaponAccuracy.gravityUnitsPerSecondSquared
      ),
      projectileLifetimeMs: createMilliseconds(
        normalizeFiniteNonNegativeNumber(
          input.accuracy?.projectileLifetimeMs,
          Number(defaultCombatWeaponAccuracy.projectileLifetimeMs)
        )
      ),
      projectileVelocityMetersPerSecond: normalizeFiniteNonNegativeNumber(
        input.accuracy?.projectileVelocityMetersPerSecond,
        defaultCombatWeaponAccuracy.projectileVelocityMetersPerSecond
      ),
      spreadDegrees: normalizeFiniteNonNegativeNumber(
        input.accuracy?.spreadDegrees,
        defaultCombatWeaponAccuracy.spreadDegrees
      )
    }),
    areaDamage: createMetaverseCombatWeaponAreaDamageSnapshot(input.areaDamage),
    burst: createMetaverseCombatWeaponBurstSnapshot(input.burst, fireMode),
    damage: Object.freeze({
      body: normalizeFiniteNonNegativeNumber(input.damage.body, 0),
      head: normalizeFiniteNonNegativeNumber(input.damage.head, 0),
      pelletsPerShot: normalizeFiniteNonNegativeInteger(
        input.damage.pelletsPerShot,
        1
      )
    }),
    deliveryModel,
    fireMode,
    firingOriginOffset,
    firingOriginHeightMeters: normalizeFiniteNonNegativeNumber(
      input.firingOriginHeightMeters,
      defaultCombatWeaponFiringOriginHeightMeters
    ),
    magazine: Object.freeze({
      magazineCapacity: normalizeFiniteNonNegativeInteger(
        input.magazine.magazineCapacity,
        1
      ),
      reloadDurationMs: createMilliseconds(
        normalizeFiniteNonNegativeNumber(input.magazine.reloadDurationMs)
      ),
      reserveCapacity: normalizeFiniteNonNegativeInteger(
        input.magazine.reserveCapacity
      )
    }),
    presentationDeliveryModel: normalizeWeaponPresentationDeliveryModel(
      input.presentationDeliveryModel,
      deliveryModel
    ),
    projectilePresentation:
      createMetaverseCombatWeaponProjectilePresentationSnapshot(
        input.projectilePresentation,
        firingOriginOffset
      ),
    recoilPresentation: Object.freeze({
      pitchDegrees: normalizeFiniteNonNegativeNumber(
        input.recoilPresentation.pitchDegrees
      ),
      yawDegrees: normalizeFiniteNonNegativeNumber(
        input.recoilPresentation.yawDegrees
      )
    }),
    roundsPerMinute: normalizeFiniteNonNegativeNumber(input.roundsPerMinute),
    weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
  }) as MetaverseCombatWeaponProfileSnapshot;
}

export function createMetaverseCombatWeaponStatsSnapshot(
  input: MetaverseCombatWeaponStatsSnapshotInput
): MetaverseCombatWeaponStatsSnapshot {
  return Object.freeze({
    shotsFired: normalizeFiniteNonNegativeInteger(input.shotsFired),
    shotsHit: normalizeFiniteNonNegativeInteger(input.shotsHit),
    weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
  });
}

export function createMetaverseCombatPlayerWeaponSnapshot(
  input: MetaverseCombatPlayerWeaponSnapshotInput
): MetaverseCombatPlayerWeaponSnapshot {
  return Object.freeze({
    ammoInMagazine: normalizeFiniteNonNegativeInteger(input.ammoInMagazine),
    ammoInReserve: normalizeFiniteNonNegativeInteger(input.ammoInReserve),
    reloadRemainingMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.reloadRemainingMs)
    ),
    weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
  });
}

export function createMetaverseCombatDamageLedgerEntrySnapshot(
  input: MetaverseCombatDamageLedgerEntrySnapshotInput
): MetaverseCombatDamageLedgerEntrySnapshot {
  return Object.freeze({
    attackerPlayerId: input.attackerPlayerId,
    totalDamage: normalizeFiniteNonNegativeNumber(input.totalDamage)
  });
}

export function createMetaversePlayerCombatSnapshot(
  input: MetaversePlayerCombatSnapshotInput = {}
): MetaversePlayerCombatSnapshot {
  const maxHealth = normalizeFiniteNonNegativeNumber(input.maxHealth, 100);
  const normalizedHealth = Math.min(
    maxHealth,
    normalizeFiniteNonNegativeNumber(input.health, maxHealth)
  );

  return Object.freeze({
    activeWeapon:
      input.activeWeapon === null
        ? null
        : input.activeWeapon === undefined
          ? null
          : createMetaverseCombatPlayerWeaponSnapshot(input.activeWeapon),
    alive: input.alive ?? normalizedHealth > 0,
    assists: normalizeFiniteNonNegativeInteger(input.assists),
    damageLedger: Object.freeze(
      (input.damageLedger ?? []).map(
        createMetaverseCombatDamageLedgerEntrySnapshot
      )
    ),
    deaths: normalizeFiniteNonNegativeInteger(input.deaths),
    headshotKills: normalizeFiniteNonNegativeInteger(input.headshotKills),
    health: normalizedHealth,
    kills: normalizeFiniteInteger(input.kills),
    maxHealth,
    respawnRemainingMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.respawnRemainingMs)
    ),
    spawnProtectionRemainingMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.spawnProtectionRemainingMs)
    ),
    weaponInventory: Object.freeze(
      (input.weaponInventory ?? []).map(createMetaverseCombatPlayerWeaponSnapshot)
    ),
    weaponStats: Object.freeze(
      (input.weaponStats ?? []).map(createMetaverseCombatWeaponStatsSnapshot)
    )
  });
}

export function createMetaverseCombatTeamSnapshot(
  input: MetaverseCombatTeamSnapshotInput
): MetaverseCombatTeamSnapshot {
  return Object.freeze({
    playerIds: Object.freeze([...(input.playerIds ?? [])]),
    score: normalizeFiniteInteger(input.score),
    teamId: input.teamId
  });
}

export function createMetaverseCombatMatchSnapshot(
  input: MetaverseCombatMatchSnapshotInput = {}
): MetaverseCombatMatchSnapshot {
  return Object.freeze({
    assistDamageThreshold: normalizeFiniteNonNegativeNumber(
      input.assistDamageThreshold,
      50
    ),
    completedAtTimeMs: normalizeTimeMs(input.completedAtTimeMs),
    friendlyFireEnabled: input.friendlyFireEnabled === true,
    mode: input.mode ?? "team-deathmatch",
    phase: normalizeMatchPhase(input.phase),
    respawnDelayMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.respawnDelayMs, 3_000)
    ),
    scoreLimit: normalizeFiniteNonNegativeInteger(input.scoreLimit, 50),
    teams: Object.freeze(
      (input.teams ?? defaultCombatMatchTeams).map(createMetaverseCombatTeamSnapshot)
    ),
    timeLimitMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.timeLimitMs, 600_000)
    ),
    timeRemainingMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.timeRemainingMs, 600_000)
    ),
    winnerTeamId: input.winnerTeamId ?? null
  });
}

export function createMetaversePlayerActionReceiptSnapshot(
  input: MetaversePlayerActionReceiptSnapshotInput
): MetaversePlayerActionReceiptSnapshot {
  const processedAtTimeMs = createMilliseconds(
    normalizeFiniteNonNegativeNumber(input.processedAtTimeMs)
  );
  const actionSequence = normalizeFiniteNonNegativeInteger(input.actionSequence);

  if (input.kind === "jump") {
    return Object.freeze({
      actionSequence,
      kind: "jump",
      processedAtTimeMs,
      resolutionState: normalizeTraversalActionResolutionState(
        input.resolutionState
      )
    });
  }

  if (input.kind === "interact-weapon-resource") {
    const status = normalizePlayerActionReceiptStatus(input.status);
    const rejectionReason =
      status === "rejected"
        ? normalizePlayerActionInteractWeaponResourceRejectionReason(
            input.rejectionReason
          )
        : null;

    return Object.freeze({
      actionSequence,
      activeSlotId: isMetaverseWeaponSlotId(input.activeSlotId)
        ? input.activeSlotId
        : null,
      droppedWeaponId: normalizeOptionalIdentifier(
        input.droppedWeaponId,
        "Metaverse interact weapon resource droppedWeaponId"
      ),
      intendedWeaponInstanceId: normalizeOptionalIdentifier(
        input.intendedWeaponInstanceId,
        "Metaverse interact weapon resource intendedWeaponInstanceId"
      ),
      kind: "interact-weapon-resource",
      pickedUpWeaponId: normalizeOptionalIdentifier(
        input.pickedUpWeaponId,
        "Metaverse interact weapon resource pickedUpWeaponId"
      ),
      processedAtTimeMs,
      rejectionReason,
      requestedActiveSlotId: isMetaverseWeaponSlotId(input.requestedActiveSlotId)
        ? input.requestedActiveSlotId
        : null,
      status,
      weaponId: normalizeOptionalIdentifier(
        input.weaponId,
        "Metaverse interact weapon resource weaponId"
      ),
      weaponInstanceId: normalizeOptionalIdentifier(
        input.weaponInstanceId,
        "Metaverse interact weapon resource weaponInstanceId"
      )
    });
  }

  if (input.kind === "switch-active-weapon-slot") {
    const status = normalizePlayerActionReceiptStatus(input.status);
    const rejectionReason =
      status === "rejected"
        ? normalizePlayerActionSwitchWeaponSlotRejectionReason(
            input.rejectionReason
          )
        : null;

    return Object.freeze({
      actionSequence,
      activeSlotId: isMetaverseWeaponSlotId(input.activeSlotId)
        ? input.activeSlotId
        : null,
      intendedWeaponInstanceId: normalizeOptionalIdentifier(
        input.intendedWeaponInstanceId,
        "Metaverse switch weapon slot intendedWeaponInstanceId"
      ),
      kind: "switch-active-weapon-slot",
      processedAtTimeMs,
      rejectionReason,
      requestedActiveSlotId: isMetaverseWeaponSlotId(input.requestedActiveSlotId)
        ? input.requestedActiveSlotId
        : "primary",
      status,
      weaponId: normalizeOptionalIdentifier(
        input.weaponId,
        "Metaverse switch weapon slot weaponId"
      ),
      weaponInstanceId: normalizeOptionalIdentifier(
        input.weaponInstanceId,
        "Metaverse switch weapon slot weaponInstanceId"
      )
    });
  }

  const status = normalizePlayerActionReceiptStatus(input.status);
  const rejectionReason =
    status === "rejected"
      ? normalizePlayerActionFireWeaponRejectionReason(input.rejectionReason)
      : null;

  return Object.freeze({
    actionSequence,
    kind: "fire-weapon",
    processedAtTimeMs,
    rejectionReason,
    sourceProjectileId:
      status === "accepted"
        ? normalizeOptionalIdentifier(
            input.sourceProjectileId,
            "Metaverse combat projectileId"
          )
        : null,
    status,
    weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
  });
}

export function createMetaverseCombatActionReceiptSnapshot(
  input: MetaverseCombatActionReceiptSnapshotInput
): MetaverseCombatActionReceiptSnapshot {
  return createMetaversePlayerActionReceiptSnapshot({
    ...(input.actionSequence === undefined
      ? {}
      : {
          actionSequence: input.actionSequence
        }),
    kind: "fire-weapon",
    ...(input.processedAtTimeMs === undefined
      ? {}
      : {
          processedAtTimeMs: input.processedAtTimeMs
        }),
    ...(input.rejectionReason === undefined
      ? {}
      : {
          rejectionReason: input.rejectionReason
        }),
    ...(input.sourceProjectileId === undefined
      ? {}
      : {
          sourceProjectileId: input.sourceProjectileId
        }),
    ...(input.status === undefined
      ? {}
      : {
          status: input.status
        }),
    weaponId: input.weaponId
  }) as MetaverseCombatActionReceiptSnapshot;
}

function createMetaverseCombatEventHitscanSnapshot(
  input: MetaverseCombatEventHitscanSnapshotInput | null | undefined
): MetaverseCombatEventHitscanSnapshot | null {
  if (input === null || input === undefined) {
    return null;
  }

  return Object.freeze({
    finalReason: normalizeShotResolutionFinalReason(input.finalReason),
    hitKind: normalizeCombatEventHitscanHitKind(input.hitKind),
    hitNormalWorld: createNullableVector3Snapshot(input.hitNormalWorld),
    hitPointWorld: createNullableVector3Snapshot(input.hitPointWorld),
    hitSurface: createMetaverseCombatImpactSurfaceSnapshot(input.hitSurface),
    regionId: normalizeHurtRegionId(input.regionId, null),
    targetPlayerId: normalizeOptionalIdentifier(
      input.targetPlayerId,
      "Metaverse combat hitscan targetPlayerId"
    ) as MetaversePlayerId | null
  });
}

function createMetaverseCombatImpactSurfaceSnapshot(
  input: MetaverseCombatImpactSurfaceSnapshotInput | null | undefined
): MetaverseCombatImpactSurfaceSnapshot | null {
  if (input === null || input === undefined) {
    return null;
  }

  return Object.freeze({
    ownerEnvironmentAssetId: normalizeOptionalIdentifier(
      input.ownerEnvironmentAssetId,
      "Metaverse combat impact ownerEnvironmentAssetId"
    ),
    traversalAffordance: input.traversalAffordance ?? null
  });
}

function createMetaverseCombatEventProjectileSnapshot(
  input: MetaverseCombatEventProjectileSnapshotInput | null | undefined
): MetaverseCombatEventProjectileSnapshot | null {
  if (input === null || input === undefined) {
    return null;
  }

  return Object.freeze({
    hitZone: normalizeHitZone(input.hitZone, null),
    impactNormalWorld: createNullableVector3Snapshot(input.impactNormalWorld),
    impactPointWorld: createNullableVector3Snapshot(input.impactPointWorld),
    impactSurface: createMetaverseCombatImpactSurfaceSnapshot(input.impactSurface),
    resolutionKind: normalizeProjectileResolution(input.resolutionKind ?? undefined),
    targetPlayerId: normalizeOptionalIdentifier(
      input.targetPlayerId,
      "Metaverse combat projectile targetPlayerId"
    ) as MetaversePlayerId | null
  });
}

export function createMetaverseCombatEventSnapshot(
  input: MetaverseCombatEventSnapshotInput
): MetaverseCombatEventSnapshot {
  const playerId = normalizeIdentifier(
    input.playerId,
    "Metaverse combat event playerId"
  ) as MetaversePlayerId;
  const actionSequence = normalizeFiniteNonNegativeInteger(
    input.actionSequence
  );
  const weaponId = normalizeIdentifier(
    input.weaponId,
    "Metaverse combat event weaponId"
  );
  const shotId = normalizeIdentifier(
    input.shotId ?? `${playerId}:${actionSequence}`,
    "Metaverse combat event shotId"
  );

  return Object.freeze({
    actionSequence,
    activeSlotId: isMetaverseWeaponSlotId(input.activeSlotId)
      ? input.activeSlotId
      : null,
    aimTargetWorld: createNullableVector3Snapshot(input.aimTargetWorld),
    cameraRayForwardWorld: createNullableVector3Snapshot(
      input.cameraRayForwardWorld
    ),
    cameraRayOriginWorld: createNullableVector3Snapshot(
      input.cameraRayOriginWorld
    ),
    eventKind: normalizeCombatEventKind(input.eventKind),
    eventSequence: normalizeFiniteNonNegativeInteger(input.eventSequence),
    hitscan: createMetaverseCombatEventHitscanSnapshot(input.hitscan),
    launchDirectionWorld: createNullableVector3Snapshot(
      input.launchDirectionWorld
    ),
    playerId,
    presentationDeliveryModel: normalizeWeaponPresentationDeliveryModel(
      input.presentationDeliveryModel,
      input.presentationDeliveryModel === "authoritative-projectile"
        ? "projectile"
        : "hitscan"
    ),
    projectile: createMetaverseCombatEventProjectileSnapshot(input.projectile),
    projectileId: normalizeOptionalIdentifier(
      input.projectileId,
      "Metaverse combat event projectileId"
    ),
    semanticMuzzleWorld: createNullableVector3Snapshot(
      input.semanticMuzzleWorld
    ),
    shotId,
    timeMs: createMilliseconds(normalizeFiniteNonNegativeNumber(input.timeMs)),
    weaponId,
    weaponInstanceId: normalizeOptionalIdentifier(
      input.weaponInstanceId,
      "Metaverse combat event weaponInstanceId"
    )
  });
}

export function createMetaverseCombatProjectileSnapshot(
  input: MetaverseCombatProjectileSnapshotInput
): MetaverseCombatProjectileSnapshot {
  return Object.freeze({
    direction: createVector3Snapshot({
      x: clampToUnitRange(input.direction.x),
      y: clampToUnitRange(input.direction.y),
      z: clampToUnitRange(input.direction.z)
    }),
    ownerPlayerId: normalizeOptionalIdentifier(
      input.ownerPlayerId,
      "Metaverse combat projectile ownerPlayerId"
    ) as MetaversePlayerId | null,
    position: createVector3Snapshot(input.position),
    projectileId: normalizeIdentifier(
      input.projectileId,
      "Metaverse combat projectileId"
    ),
    resolution: normalizeProjectileResolution(input.resolution),
    resolvedAtTimeMs:
      input.resolvedAtTimeMs === null || input.resolvedAtTimeMs === undefined
        ? null
        : createMilliseconds(
            normalizeFiniteNonNegativeNumber(input.resolvedAtTimeMs)
          ),
    sourceActionSequence: normalizeFiniteNonNegativeInteger(
      input.sourceActionSequence
    ),
    spawnedAtTimeMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.spawnedAtTimeMs)
    ),
    velocityMetersPerSecond: normalizeFiniteNonNegativeNumber(
      input.velocityMetersPerSecond
    ),
    weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
  });
}

export function createMetaverseCombatFeedEventSnapshot(
  input: MetaverseCombatFeedEventSnapshotInput
): MetaverseCombatFeedEventSnapshot {
  switch (input.type) {
    case "spawn":
      return Object.freeze({
        playerId: input.playerId,
        sequence: normalizeFiniteNonNegativeInteger(input.sequence),
        teamId: input.teamId,
        timeMs: createMilliseconds(normalizeFiniteNonNegativeNumber(input.timeMs)),
        type: "spawn"
      });
    case "damage":
      return Object.freeze({
        attackerPlayerId: input.attackerPlayerId,
        damage: normalizeFiniteNonNegativeNumber(input.damage),
        hitZone: normalizeHitZone(input.hitZone, "body") ?? "body",
        sequence: normalizeFiniteNonNegativeInteger(input.sequence),
        sourceActionSequence: normalizeFiniteNonNegativeInteger(
          input.sourceActionSequence
        ),
        sourceProjectileId: normalizeOptionalIdentifier(
          input.sourceProjectileId,
          "Metaverse combat projectileId"
        ),
        targetPlayerId: input.targetPlayerId,
        timeMs: createMilliseconds(normalizeFiniteNonNegativeNumber(input.timeMs)),
        type: "damage",
        weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
      });
    case "kill":
      return Object.freeze({
        assisterPlayerIds: Object.freeze([...(input.assisterPlayerIds ?? [])]),
        attackerPlayerId: input.attackerPlayerId,
        headshot: input.headshot === true,
        sequence: normalizeFiniteNonNegativeInteger(input.sequence),
        sourceActionSequence: normalizeFiniteNonNegativeInteger(
          input.sourceActionSequence
        ),
        sourceProjectileId: normalizeOptionalIdentifier(
          input.sourceProjectileId,
          "Metaverse combat projectileId"
        ),
        targetPlayerId: input.targetPlayerId,
        targetTeamId: input.targetTeamId,
        timeMs: createMilliseconds(normalizeFiniteNonNegativeNumber(input.timeMs)),
        type: "kill",
        weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
      });
    default: {
      const exhaustiveInput: never = input;

      throw new Error(
        `Unsupported metaverse combat feed event type: ${exhaustiveInput}`
      );
    }
  }
}

export function createMetaverseFireWeaponPlayerActionSnapshot(
  input: MetaverseFireWeaponPlayerActionSnapshotInput
): MetaverseFireWeaponPlayerActionSnapshot {
  return Object.freeze({
    actionSequence: normalizeFiniteNonNegativeInteger(input.actionSequence),
    aimMode: input.aimMode === "ads" ? "ads" : "hip-fire",
    aimSnapshot: createMetaverseCombatAimSnapshot(input.aimSnapshot),
    issuedAtAuthoritativeTimeMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.issuedAtAuthoritativeTimeMs)
    ),
    kind: "fire-weapon",
    weaponId: normalizeIdentifier(input.weaponId, "Metaverse combat weaponId")
  });
}

export function createMetaverseJumpPlayerActionSnapshot(
  input: MetaverseJumpPlayerActionSnapshotInput = {}
): MetaverseJumpPlayerActionSnapshot {
  return Object.freeze({
    actionSequence: normalizeFiniteNonNegativeInteger(input.actionSequence),
    issuedAtAuthoritativeTimeMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.issuedAtAuthoritativeTimeMs)
    ),
    kind: "jump"
  });
}

export function createMetaverseSwitchActiveWeaponSlotPlayerActionSnapshot(
  input: MetaverseSwitchActiveWeaponSlotPlayerActionSnapshotInput
): MetaverseSwitchActiveWeaponSlotPlayerActionSnapshot {
  return Object.freeze({
    actionSequence: normalizeFiniteNonNegativeInteger(input.actionSequence),
    intendedWeaponInstanceId: normalizeOptionalIdentifier(
      input.intendedWeaponInstanceId,
      "Metaverse switch weapon slot intendedWeaponInstanceId"
    ),
    issuedAtAuthoritativeTimeMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.issuedAtAuthoritativeTimeMs)
    ),
    kind: "switch-active-weapon-slot",
    requestedActiveSlotId: isMetaverseWeaponSlotId(input.requestedActiveSlotId)
      ? input.requestedActiveSlotId
      : "primary"
  });
}

export function createMetaverseInteractWeaponResourcePlayerActionSnapshot(
  input: MetaverseInteractWeaponResourcePlayerActionSnapshotInput = {}
): MetaverseInteractWeaponResourcePlayerActionSnapshot {
  return Object.freeze({
    actionSequence: normalizeFiniteNonNegativeInteger(input.actionSequence),
    intendedWeaponInstanceId: normalizeOptionalIdentifier(
      input.intendedWeaponInstanceId,
      "Metaverse interact weapon resource intendedWeaponInstanceId"
    ),
    issuedAtAuthoritativeTimeMs: createMilliseconds(
      normalizeFiniteNonNegativeNumber(input.issuedAtAuthoritativeTimeMs)
    ),
    kind: "interact-weapon-resource",
    requestedActiveSlotId: isMetaverseWeaponSlotId(input.requestedActiveSlotId)
      ? input.requestedActiveSlotId
      : null
  });
}

export function createMetaversePlayerActionSnapshot(
  input: MetaversePlayerActionSnapshotInput
): MetaversePlayerActionSnapshot {
  switch (input.kind) {
    case "jump":
      return createMetaverseJumpPlayerActionSnapshot(input);
    case "fire-weapon":
      return createMetaverseFireWeaponPlayerActionSnapshot(input);
    case "interact-weapon-resource":
      return createMetaverseInteractWeaponResourcePlayerActionSnapshot(input);
    case "switch-active-weapon-slot":
      return createMetaverseSwitchActiveWeaponSlotPlayerActionSnapshot(input);
    default: {
      const exhaustiveInput: never = input;

      throw new Error(
        `Unsupported metaverse player action kind: ${exhaustiveInput}`
      );
    }
  }
}

export function createMetaverseIssuePlayerActionCommand(
  input: MetaverseIssuePlayerActionCommandInput
): MetaverseIssuePlayerActionCommand {
  return Object.freeze({
    action: createMetaversePlayerActionSnapshot(input.action),
    playerId: input.playerId,
    type: "issue-player-action"
  });
}

export function createMetaversePlayerCombatHurtVolumes(
  input: MetaversePlayerCombatHurtVolumeInput
): MetaversePlayerCombatHurtVolumesSnapshot {
  const config = Object.freeze({
    ...defaultMetaversePlayerCombatHurtVolumeConfig,
    ...(input.config ?? {})
  });
  const activeBodyRootPosition = createVector3Snapshot(input.activeBodyPosition);
  const activeBodyYawRadians = createRadians(
    normalizeFiniteNumber(input.activeBodyYawRadians ?? 0)
  );
  const yawSin = Math.sin(activeBodyYawRadians);
  const yawCos = Math.cos(activeBodyYawRadians);
  const capsuleCenterPosition =
    resolveMetaverseGroundedBodyColliderTranslationSnapshot(
      {
        capsuleHalfHeightMeters: config.capsuleHalfHeightMeters,
        capsuleRadiusMeters: config.capsuleRadiusMeters
      },
      activeBodyRootPosition
    );
  const bodyStartHeight =
    capsuleCenterPosition.y -
    Math.max(
      0,
      config.capsuleHalfHeightMeters - config.bodyBottomInsetMeters
    );
  const bodyEndHeight =
    capsuleCenterPosition.y +
    Math.max(0, config.capsuleHalfHeightMeters - config.bodyTopInsetMeters);
  const bodyHeight = Math.max(0.1, bodyEndHeight - bodyStartHeight);
  const legSideOffsetMeters = Math.max(0.22, config.capsuleRadiusMeters * 0.82);
  const upperLegRadiusMeters = Math.max(0.08, config.capsuleRadiusMeters * 0.42);
  const lowerLegRadiusMeters = Math.max(0.07, config.capsuleRadiusMeters * 0.36);
  const footRadiusMeters = Math.max(0.065, config.capsuleRadiusMeters * 0.24);
  const pelvisRadiusMeters = Math.max(0.18, config.capsuleRadiusMeters * 0.72);
  const lowerTorsoRadiusMeters = Math.max(
    0.16,
    config.capsuleRadiusMeters * 0.68
  );
  const upperTorsoRadiusMeters = Math.max(
    0.15,
    config.capsuleRadiusMeters * 0.62
  );
  const headSphere = Object.freeze({
    center: createVector3Snapshot({
      x: capsuleCenterPosition.x,
      y: capsuleCenterPosition.y + config.headCenterHeightMeters,
      z: capsuleCenterPosition.z
    }),
    radiusMeters: Math.max(0.05, config.headRadiusMeters)
  });
  const bodyCapsule = Object.freeze({
    end: createVector3Snapshot({
      x: capsuleCenterPosition.x,
      y: bodyEndHeight,
      z: capsuleCenterPosition.z
    }),
    radiusMeters: Math.max(0.05, config.capsuleRadiusMeters),
    start: createVector3Snapshot({
      x: capsuleCenterPosition.x,
      y: bodyStartHeight,
      z: capsuleCenterPosition.z
    })
  });
  const createCapsule = (
    xOffsetMeters: number,
    startAlpha: number,
    endAlpha: number,
    radiusMeters: number,
    zOffsetMeters = 0
  ): MetaverseCombatCapsuleSnapshot =>
    Object.freeze({
      end: createYawedHurtVolumePoint(
        capsuleCenterPosition,
        yawSin,
        yawCos,
        xOffsetMeters,
        bodyStartHeight + bodyHeight * endAlpha,
        zOffsetMeters
      ),
      radiusMeters,
      start: createYawedHurtVolumePoint(
        capsuleCenterPosition,
        yawSin,
        yawCos,
        xOffsetMeters,
        bodyStartHeight + bodyHeight * startAlpha,
        zOffsetMeters
      )
    });
  const upperTorsoEndHeight = Math.max(
    bodyEndHeight,
    headSphere.center.y - headSphere.radiusMeters - 0.04
  );
  const lowerBodyBottomHeight =
    bodyStartHeight - Math.max(0.05, config.capsuleRadiusMeters);
  const createCapsuleBetweenHeights = (
    xOffsetMeters: number,
    startY: number,
    endY: number,
    radiusMeters: number,
    zOffsetMeters = 0
  ): MetaverseCombatCapsuleSnapshot =>
    Object.freeze({
      end: createYawedHurtVolumePoint(
        capsuleCenterPosition,
        yawSin,
        yawCos,
        xOffsetMeters,
        endY,
        zOffsetMeters
      ),
      radiusMeters,
      start: createYawedHurtVolumePoint(
        capsuleCenterPosition,
        yawSin,
        yawCos,
        xOffsetMeters,
        startY,
        zOffsetMeters
      )
    });
  const createCapsuleRegion = (
    regionId: MetaverseCombatHurtRegionId,
    capsule: MetaverseCombatCapsuleSnapshot
  ): MetaverseCombatCapsuleHurtRegionSnapshot =>
    Object.freeze({
      capsule,
      hitZone: "body",
      regionId,
      shape: "capsule"
    });
  const leftLegOffsetMeters = -legSideOffsetMeters;
  const rightLegOffsetMeters = legSideOffsetMeters;
  const footForwardOffsetMeters = -Math.max(
    0.08,
    config.capsuleRadiusMeters * 0.35
  );
  const regions = Object.freeze([
    Object.freeze({
      hitZone: "head",
      regionId: "head",
      shape: "sphere",
      sphere: headSphere
    } satisfies MetaverseCombatSphereHurtRegionSnapshot),
    createCapsuleRegion(
      "upper_torso",
      createCapsuleBetweenHeights(
        0,
        bodyStartHeight + bodyHeight * 0.62,
        upperTorsoEndHeight,
        upperTorsoRadiusMeters
      )
    ),
    createCapsuleRegion(
      "lower_torso",
      createCapsule(0, 0.38, 0.68, lowerTorsoRadiusMeters)
    ),
    createCapsuleRegion(
      "pelvis",
      createCapsule(0, 0.16, 0.4, pelvisRadiusMeters)
    ),
    createCapsuleRegion(
      "upper_leg_l",
      createCapsuleBetweenHeights(
        leftLegOffsetMeters,
        lowerBodyBottomHeight + bodyHeight * 0.44,
        lowerBodyBottomHeight + bodyHeight * 0.62,
        upperLegRadiusMeters
      )
    ),
    createCapsuleRegion(
      "lower_leg_l",
      createCapsuleBetweenHeights(
        leftLegOffsetMeters,
        lowerBodyBottomHeight + bodyHeight * 0.16,
        lowerBodyBottomHeight + bodyHeight * 0.32,
        lowerLegRadiusMeters
      )
    ),
    createCapsuleRegion(
      "foot_l",
      createCapsuleBetweenHeights(
        leftLegOffsetMeters,
        lowerBodyBottomHeight + bodyHeight * 0.02,
        lowerBodyBottomHeight + bodyHeight * 0.075,
        footRadiusMeters,
        footForwardOffsetMeters
      )
    ),
    createCapsuleRegion(
      "upper_leg_r",
      createCapsuleBetweenHeights(
        rightLegOffsetMeters,
        lowerBodyBottomHeight + bodyHeight * 0.44,
        lowerBodyBottomHeight + bodyHeight * 0.62,
        upperLegRadiusMeters
      )
    ),
    createCapsuleRegion(
      "lower_leg_r",
      createCapsuleBetweenHeights(
        rightLegOffsetMeters,
        lowerBodyBottomHeight + bodyHeight * 0.16,
        lowerBodyBottomHeight + bodyHeight * 0.32,
        lowerLegRadiusMeters
      )
    ),
    createCapsuleRegion(
      "foot_r",
      createCapsuleBetweenHeights(
        rightLegOffsetMeters,
        lowerBodyBottomHeight + bodyHeight * 0.02,
        lowerBodyBottomHeight + bodyHeight * 0.075,
        footRadiusMeters,
        footForwardOffsetMeters
      )
    )
  ] satisfies readonly MetaverseCombatHurtRegionSnapshot[]);

  return Object.freeze({
    bodyCapsule,
    headSphere,
    regions
  });
}

export function resolveMetaverseCombatHitForSegment(
  segmentStart: MetaversePresenceVector3SnapshotInput,
  segmentEnd: MetaversePresenceVector3SnapshotInput,
  hurtVolumes: MetaversePlayerCombatHurtVolumesSnapshot
): MetaverseCombatHitResolutionSnapshot | null {
  const normalizedSegmentStart = createVector3Snapshot(segmentStart);
  const normalizedSegmentEnd = createVector3Snapshot(segmentEnd);
  const segmentLength = Math.sqrt(
    readLengthSquared(subtractVectors(normalizedSegmentEnd, normalizedSegmentStart))
  );

  let closestHit:
    | Pick<
        MetaverseCombatHitResolutionSnapshot,
        "distanceMeters" | "hitZone" | "regionId"
      >
    | null = null;

  for (const region of hurtVolumes.regions) {
    const distanceMeters =
      region.shape === "sphere"
        ? readSegmentSphereIntersectionDistance(
            normalizedSegmentStart,
            normalizedSegmentEnd,
            region.sphere
          )
        : readSegmentCapsuleIntersectionDistance(
            normalizedSegmentStart,
            normalizedSegmentEnd,
            region.capsule
          );

    if (distanceMeters === null) {
      continue;
    }

    if (closestHit === null || distanceMeters < closestHit.distanceMeters) {
      closestHit = Object.freeze({
        distanceMeters,
        hitZone: region.hitZone,
        regionId: region.regionId
      });
    }
  }

  if (closestHit === null) {
    return null;
  }

  const segmentAlpha =
    segmentLength <= 0.000001 ? 0 : closestHit.distanceMeters / segmentLength;

  return Object.freeze({
    distanceMeters: closestHit.distanceMeters,
    hitZone: closestHit.hitZone,
    point: createPointOnSegment(
      normalizedSegmentStart,
      normalizedSegmentEnd,
      segmentAlpha
    ),
    regionId: closestHit.regionId
  });
}

export function resolveMetaverseCombatClosestHurtVolumePoint(
  point: MetaversePresenceVector3SnapshotInput,
  hurtVolumes: MetaversePlayerCombatHurtVolumesSnapshot
): MetaverseCombatClosestHurtVolumePointSnapshot | null {
  const normalizedPoint = createVector3Snapshot(point);
  let closestPoint: MetaverseCombatClosestHurtVolumePointSnapshot | null = null;

  for (const region of hurtVolumes.regions) {
    const regionClosestPoint =
      region.shape === "sphere"
        ? resolveClosestPointOnSphere(normalizedPoint, region.sphere)
        : resolveClosestPointOnCapsule(normalizedPoint, region.capsule);

    if (
      closestPoint !== null &&
      regionClosestPoint.distanceMeters >= closestPoint.distanceMeters
    ) {
      continue;
    }

    closestPoint = Object.freeze({
      distanceMeters: regionClosestPoint.distanceMeters,
      hitZone: region.hitZone,
      point: regionClosestPoint.point,
      regionId: region.regionId
    });
  }

  return closestPoint;
}

export const metaverseCombatWeaponProfiles = Object.freeze([
  createMetaverseCombatWeaponProfileSnapshot({
    accuracy: {
      adsAffectsAccuracy: false,
      bloomDegrees: 0,
      gravityUnitsPerSecondSquared: 0,
      projectileLifetimeMs: 2_000,
      projectileVelocityMetersPerSecond: 900,
      spreadDegrees: 0
    },
    damage: {
      body: 24,
      head: 42
    },
    deliveryModel: "hitscan",
    fireMode: "semi",
    firingOriginOffset: {
      forwardMeters: 0.55,
      rightMeters: 0.18,
      upMeters: 1.42
    },
    firingOriginHeightMeters: 1.62,
    magazine: {
      magazineCapacity: 12,
      reloadDurationMs: 1_450,
      reserveCapacity: 48
    },
    presentationDeliveryModel: "hitscan-tracer",
    projectilePresentation: {
      objectLocalPrimaryGripFrame: {
        forwardMeters: 0.079,
        rightMeters: 0,
        upMeters: -0.048
      },
      objectLocalMuzzleFrame: {
        forwardMeters: 0.312,
        rightMeters: 0,
        upMeters: 0.03
      },
      primaryGripAnchorOffset: {
        forwardMeters: 0.317,
        rightMeters: 0.18,
        upMeters: 1.342
      },
      authoredMuzzleFromGrip: {
        forwardMeters: 0.233,
        rightMeters: 0,
        upMeters: 0.078
      },
      semanticLaunchOriginOffset: {
        forwardMeters: 0.55,
        rightMeters: 0.18,
        upMeters: 1.42
      }
    },
    recoilPresentation: {
      pitchDegrees: 1.2,
      yawDegrees: 0.55
    },
    roundsPerMinute: 420,
    weaponId: "metaverse-service-pistol-v2"
  }),
  createMetaverseCombatWeaponProfileSnapshot({
    accuracy: {
      adsAffectsAccuracy: false,
      bloomDegrees: 0,
      gravityUnitsPerSecondSquared: 0,
      projectileLifetimeMs: 2_000,
      projectileVelocityMetersPerSecond: 900,
      spreadDegrees: 0.8
    },
    damage: {
      body: 18,
      head: 24
    },
    deliveryModel: "hitscan",
    fireMode: "auto",
    firingOriginOffset: {
      forwardMeters: 0.7,
      rightMeters: 0.14,
      upMeters: 1.42
    },
    firingOriginHeightMeters: 1.62,
    magazine: {
      magazineCapacity: 32,
      reloadDurationMs: 1_900,
      reserveCapacity: 160
    },
    presentationDeliveryModel: "hitscan-tracer",
    projectilePresentation: {
      objectLocalPrimaryGripFrame: {
        forwardMeters: 0.07,
        rightMeters: 0,
        upMeters: -0.02
      },
      objectLocalMuzzleFrame: {
        forwardMeters: 0.68,
        rightMeters: 0,
        upMeters: 0.04
      },
      primaryGripAnchorOffset: {
        forwardMeters: 0.06,
        rightMeters: 0.14,
        upMeters: 1.36
      },
      authoredMuzzleFromGrip: {
        forwardMeters: 0.61,
        rightMeters: 0,
        upMeters: 0.06
      },
      semanticLaunchOriginOffset: {
        forwardMeters: 0.7,
        rightMeters: 0.14,
        upMeters: 1.42
      }
    },
    recoilPresentation: {
      pitchDegrees: 1.8,
      yawDegrees: 0.9
    },
    roundsPerMinute: 780,
    weaponId: "metaverse-compact-smg-v1"
  }),
  createMetaverseCombatWeaponProfileSnapshot({
    accuracy: {
      adsAffectsAccuracy: false,
      bloomDegrees: 0,
      gravityUnitsPerSecondSquared: 0,
      projectileLifetimeMs: 2_000,
      projectileVelocityMetersPerSecond: 900,
      spreadDegrees: 0
    },
    burst: {
      roundIntervalMs: 90,
      roundsPerBurst: 3
    },
    damage: {
      body: 15,
      head: 24
    },
    deliveryModel: "hitscan",
    fireMode: "burst",
    firingOriginOffset: {
      forwardMeters: 0.82,
      rightMeters: 0.14,
      upMeters: 1.43
    },
    firingOriginHeightMeters: 1.62,
    magazine: {
      magazineCapacity: 36,
      reloadDurationMs: 2_100,
      reserveCapacity: 108
    },
    presentationDeliveryModel: "hitscan-tracer",
    projectilePresentation: {
      objectLocalPrimaryGripFrame: {
        forwardMeters: 0.08,
        rightMeters: 0,
        upMeters: -0.02
      },
      objectLocalMuzzleFrame: {
        forwardMeters: 0.82,
        rightMeters: 0,
        upMeters: 0.05
      },
      primaryGripAnchorOffset: {
        forwardMeters: 0.08,
        rightMeters: 0.14,
        upMeters: 1.36
      },
      authoredMuzzleFromGrip: {
        forwardMeters: 0.74,
        rightMeters: 0,
        upMeters: 0.07
      },
      semanticLaunchOriginOffset: {
        forwardMeters: 0.82,
        rightMeters: 0.14,
        upMeters: 1.43
      }
    },
    recoilPresentation: {
      pitchDegrees: 1.25,
      yawDegrees: 0.6
    },
    roundsPerMinute: 720,
    weaponId: "metaverse-battle-rifle-v1"
  }),
  createMetaverseCombatWeaponProfileSnapshot({
    accuracy: {
      adsAffectsAccuracy: false,
      bloomDegrees: 0,
      gravityUnitsPerSecondSquared: 0,
      projectileLifetimeMs: 2_000,
      projectileVelocityMetersPerSecond: 900,
      spreadDegrees: 5.8
    },
    damage: {
      body: 11,
      head: 13,
      pelletsPerShot: 12
    },
    deliveryModel: "hitscan",
    fireMode: "semi",
    firingOriginOffset: {
      forwardMeters: 0.86,
      rightMeters: 0.14,
      upMeters: 1.42
    },
    firingOriginHeightMeters: 1.62,
    magazine: {
      magazineCapacity: 12,
      reloadDurationMs: 6_600,
      reserveCapacity: 36
    },
    presentationDeliveryModel: "hitscan-tracer",
    projectilePresentation: {
      objectLocalPrimaryGripFrame: {
        forwardMeters: 0.08,
        rightMeters: 0,
        upMeters: -0.025
      },
      objectLocalMuzzleFrame: {
        forwardMeters: 0.92,
        rightMeters: 0,
        upMeters: 0.045
      },
      primaryGripAnchorOffset: {
        forwardMeters: 0.08,
        rightMeters: 0.14,
        upMeters: 1.35
      },
      authoredMuzzleFromGrip: {
        forwardMeters: 0.84,
        rightMeters: 0,
        upMeters: 0.07
      },
      semanticLaunchOriginOffset: {
        forwardMeters: 0.86,
        rightMeters: 0.14,
        upMeters: 1.42
      }
    },
    recoilPresentation: {
      pitchDegrees: 5.5,
      yawDegrees: 1.2
    },
    roundsPerMinute: 80,
    weaponId: "metaverse-breacher-shotgun-v1"
  }),
  createMetaverseCombatWeaponProfileSnapshot({
    accuracy: {
      adsAffectsAccuracy: false,
      bloomDegrees: 0,
      gravityUnitsPerSecondSquared: 0,
      projectileLifetimeMs: 2_000,
      projectileVelocityMetersPerSecond: 900,
      spreadDegrees: 0.04
    },
    damage: {
      body: 92,
      head: 180
    },
    deliveryModel: "hitscan",
    fireMode: "semi",
    firingOriginOffset: {
      forwardMeters: 0.96,
      rightMeters: 0.14,
      upMeters: 1.43
    },
    firingOriginHeightMeters: 1.62,
    magazine: {
      magazineCapacity: 5,
      reloadDurationMs: 2_750,
      reserveCapacity: 25
    },
    presentationDeliveryModel: "hitscan-tracer",
    projectilePresentation: {
      objectLocalPrimaryGripFrame: {
        forwardMeters: 0.08,
        rightMeters: 0,
        upMeters: -0.02
      },
      objectLocalMuzzleFrame: {
        forwardMeters: 1.05,
        rightMeters: 0,
        upMeters: 0.05
      },
      primaryGripAnchorOffset: {
        forwardMeters: 0.09,
        rightMeters: 0.14,
        upMeters: 1.35
      },
      authoredMuzzleFromGrip: {
        forwardMeters: 0.97,
        rightMeters: 0,
        upMeters: 0.07
      },
      semanticLaunchOriginOffset: {
        forwardMeters: 0.96,
        rightMeters: 0.14,
        upMeters: 1.43
      }
    },
    recoilPresentation: {
      pitchDegrees: 3.9,
      yawDegrees: 0.42
    },
    roundsPerMinute: 46,
    weaponId: "metaverse-longshot-sniper-v1"
  }),
  createMetaverseCombatWeaponProfileSnapshot({
    accuracy: {
      adsAffectsAccuracy: false,
      bloomDegrees: 0,
      gravityUnitsPerSecondSquared: 0,
      projectileLifetimeMs: 6_000,
      projectileVelocityMetersPerSecond: 70,
      spreadDegrees: 0
    },
    areaDamage: {
      affectsOwner: false,
      affectsTeammates: false,
      innerRadiusMeters: 2,
      lineOfSightRequired: true,
      maxDamage: 100,
      minDamage: 20,
      outerRadiusMeters: 6
    },
    damage: {
      body: 180,
      head: 180
    },
    deliveryModel: "projectile",
    fireMode: "semi",
    firingOriginOffset: {
      forwardMeters: 0.95,
      rightMeters: 0.1,
      upMeters: 1.34
    },
    firingOriginHeightMeters: 1.44,
    magazine: {
      magazineCapacity: 2,
      reloadDurationMs: 3_600,
      reserveCapacity: 6
    },
    presentationDeliveryModel: "authoritative-projectile",
    projectilePresentation: {
      authoredSocketFrames: [
        {
          forwardMeters: -0.19,
          rightMeters: 0,
          role: "projectile.exhaust",
          upMeters: 0.08
        },
        {
          forwardMeters: -0.42,
          rightMeters: 0,
          role: "hazard.backblast_cone",
          upMeters: 0.08
        },
        {
          forwardMeters: 0.02,
          rightMeters: -0.075,
          role: "body.shoulder_contact",
          upMeters: 0.06
        }
      ],
      objectLocalPrimaryGripFrame: {
        forwardMeters: 0.18,
        rightMeters: 0,
        upMeters: -0.01
      },
      objectLocalMuzzleFrame: {
        forwardMeters: 1.01,
        rightMeters: 0,
        upMeters: 0.08
      },
      primaryGripAnchorOffset: {
        forwardMeters: 0.12,
        rightMeters: 0.1,
        upMeters: 1.25
      },
      authoredMuzzleFromGrip: {
        forwardMeters: 0.83,
        rightMeters: 0,
        upMeters: 0.09
      },
      semanticLaunchOriginOffset: {
        forwardMeters: 0.95,
        rightMeters: 0.1,
        upMeters: 1.34
      }
    },
    recoilPresentation: {
      pitchDegrees: 8,
      yawDegrees: 1.5
    },
    roundsPerMinute: 42,
    weaponId: "metaverse-rocket-launcher-v1"
  })
] satisfies readonly MetaverseCombatWeaponProfileSnapshot[]);

const metaverseCombatWeaponProfileById = new Map(
  metaverseCombatWeaponProfiles.map((profile) => [profile.weaponId, profile])
);

export function readMetaverseCombatWeaponProfile(
  weaponId: string
): MetaverseCombatWeaponProfileSnapshot {
  const weaponProfile = metaverseCombatWeaponProfileById.get(weaponId) ?? null;

  if (weaponProfile === null) {
    throw new Error(`Unknown metaverse combat weapon profile: ${weaponId}`);
  }

  return weaponProfile;
}

export function tryReadMetaverseCombatWeaponProfile(
  weaponId: string
): MetaverseCombatWeaponProfileSnapshot | null {
  return metaverseCombatWeaponProfileById.get(weaponId) ?? null;
}
