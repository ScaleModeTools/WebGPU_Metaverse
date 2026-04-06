import type { PlayerProfile } from "@thumbshooter/shared";

import type { ThumbShooterShellControllerAction } from "../../client/src/app/types/thumbshooter-shell-controller";
import {
  gameplayDebugPanelModes,
  gameplayRuntimeLifecycleStates,
  gameplayReticleVisualStates,
  localArenaEnemyBehaviorStates,
  localArenaTargetFeedbackStates,
  type FirstPlayableWeaponId,
  type GameplayDebugPanelMode,
  type GameplayHudSnapshot,
  type GameplayReticleVisualState,
  type GameplayTelemetrySnapshot,
  type GameplayRuntimeLifecycleState,
  type GameplaySignal,
  type GameplaySignalType,
  type LocalArenaEnemyBehaviorState,
  type LocalArenaTargetFeedbackState,
  type TriggerGestureMode,
  type WeaponDefinition,
  type WeaponReadinessState,
  type WeaponReloadRule,
  type WeaponReloadState,
  weaponReadinessStates,
  weaponReloadRules,
  weaponReloadStates
} from "../../client/src/game/index";
import type { AssertTrue, IsEqual } from "./type-assertions";

type ThumbShooterShellControllerActionType =
  ThumbShooterShellControllerAction["type"];

type ExpectedShellActionType =
  | "audioSnapshotChanged"
  | "bestScoreRaised"
  | "calibrationProgressRecorded"
  | "calibrationResetRequested"
  | "capabilityProbeStarted"
  | "capabilitySnapshotReceived"
  | "gameplayExited"
  | "gameplayDebugPanelModeChanged"
  | "gameplayMenuAutoOpened"
  | "gameplayMenuSetOpen"
  | "loginRejected"
  | "musicVolumeChanged"
  | "permissionRequestStarted"
  | "permissionResolved"
  | "profileCleared"
  | "profileConfirmed"
  | "profileEditRequested"
  | "sfxVolumeChanged"
  | "usernameDraftChanged";
type ExpectedGameplayRuntimeLifecycleState =
  | "idle"
  | "booting"
  | "running"
  | "failed";
type ExpectedLocalArenaEnemyBehaviorState =
  | "glide"
  | "scatter"
  | "downed";
type ExpectedLocalArenaTargetFeedbackState =
  | "tracking-lost"
  | "offscreen"
  | "clear"
  | "targeted"
  | "hit"
  | "miss";
type ExpectedWeaponReadinessState =
  | "ready"
  | "tracking-unavailable"
  | "round-paused"
  | "trigger-reset-required"
  | "cooldown"
  | "reload-required"
  | "reloading";
type ExpectedWeaponReloadState = "full" | "blocked" | "reloading";
type ExpectedWeaponReloadRule = "reticle-offscreen";
type ExpectedGameplayDebugPanelMode =
  | "hidden"
  | "telemetry"
  | "aim-inspector";
type ExpectedGameplayReticleVisualState =
  | "hidden"
  | "tracking-unavailable"
  | "neutral"
  | "targeted"
  | "hit"
  | "reload-required"
  | "reloading"
  | "round-paused";

type ShellActionTypesMatch = AssertTrue<
  IsEqual<ThumbShooterShellControllerActionType, ExpectedShellActionType>
>;
type GameplayRuntimeLifecycleMatches = AssertTrue<
  IsEqual<
    GameplayRuntimeLifecycleState,
    ExpectedGameplayRuntimeLifecycleState
  >
>;
type GameplayRuntimeLifecycleCatalogMatches = AssertTrue<
  IsEqual<
    (typeof gameplayRuntimeLifecycleStates)[number],
    GameplayRuntimeLifecycleState
  >
>;
type GameplayHudLifecycleUsesRuntimeLifecycle = AssertTrue<
  IsEqual<GameplayHudSnapshot["lifecycle"], GameplayRuntimeLifecycleState>
>;
type LocalArenaEnemyBehaviorMatches = AssertTrue<
  IsEqual<
    LocalArenaEnemyBehaviorState,
    ExpectedLocalArenaEnemyBehaviorState
  >
>;
type LocalArenaEnemyBehaviorCatalogMatches = AssertTrue<
  IsEqual<
    (typeof localArenaEnemyBehaviorStates)[number],
    LocalArenaEnemyBehaviorState
  >
>;
type LocalArenaTargetFeedbackMatches = AssertTrue<
  IsEqual<
    LocalArenaTargetFeedbackState,
    ExpectedLocalArenaTargetFeedbackState
  >
>;
type LocalArenaTargetFeedbackCatalogMatches = AssertTrue<
  IsEqual<
    (typeof localArenaTargetFeedbackStates)[number],
    LocalArenaTargetFeedbackState
  >
>;
type GameplayHudFeedbackUsesTargetFeedbackState = AssertTrue<
  IsEqual<
    GameplayHudSnapshot["targetFeedback"]["state"],
    LocalArenaTargetFeedbackState
  >
>;
type GameplayHudWeaponUsesFirstPlayableWeaponId = AssertTrue<
  IsEqual<GameplayHudSnapshot["weapon"]["weaponId"], FirstPlayableWeaponId>
>;
type GameplayDebugPanelModeMatches = AssertTrue<
  IsEqual<GameplayDebugPanelMode, ExpectedGameplayDebugPanelMode>
>;
type GameplayDebugPanelModeCatalogMatches = AssertTrue<
  IsEqual<(typeof gameplayDebugPanelModes)[number], GameplayDebugPanelMode>
>;
type GameplayDebugActionModeMatches = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "gameplayDebugPanelModeChanged" }
    >["mode"],
    GameplayDebugPanelMode
  >
>;
type GameplayReticleVisualStateMatches = AssertTrue<
  IsEqual<GameplayReticleVisualState, ExpectedGameplayReticleVisualState>
>;
type GameplayReticleVisualStateCatalogMatches = AssertTrue<
  IsEqual<
    (typeof gameplayReticleVisualStates)[number],
    GameplayReticleVisualState
  >
>;
type GameplayTelemetryReticleStateMatches = AssertTrue<
  IsEqual<
    GameplayTelemetrySnapshot["reticleVisualState"],
    GameplayReticleVisualState
  >
>;
type WeaponReadinessMatches = AssertTrue<
  IsEqual<WeaponReadinessState, ExpectedWeaponReadinessState>
>;
type WeaponReadinessCatalogMatches = AssertTrue<
  IsEqual<(typeof weaponReadinessStates)[number], WeaponReadinessState>
>;
type GameplayHudWeaponReadinessMatches = AssertTrue<
  IsEqual<GameplayHudSnapshot["weapon"]["readiness"], WeaponReadinessState>
>;
type WeaponReloadStateMatches = AssertTrue<
  IsEqual<WeaponReloadState, ExpectedWeaponReloadState>
>;
type WeaponReloadStateCatalogMatches = AssertTrue<
  IsEqual<(typeof weaponReloadStates)[number], WeaponReloadState>
>;
type GameplayHudReloadStateMatches = AssertTrue<
  IsEqual<GameplayHudSnapshot["weapon"]["reload"]["state"], WeaponReloadState>
>;
type WeaponReloadRuleMatches = AssertTrue<
  IsEqual<WeaponReloadRule, ExpectedWeaponReloadRule>
>;
type WeaponReloadRuleCatalogMatches = AssertTrue<
  IsEqual<(typeof weaponReloadRules)[number], WeaponReloadRule>
>;
type GameplayHudReloadRuleMatches = AssertTrue<
  IsEqual<GameplayHudSnapshot["weapon"]["reload"]["rule"], WeaponReloadRule>
>;
type WeaponDefinitionClipCapacityIsNumber = AssertTrue<
  IsEqual<WeaponDefinition["reload"]["clipCapacity"], number>
>;
type WeaponDefinitionTriggerModeMatchesFoundation = AssertTrue<
  IsEqual<WeaponDefinition["triggerMode"], TriggerGestureMode>
>;
type WeaponDefinitionSpreadFieldIsNumber = AssertTrue<
  IsEqual<WeaponDefinition["spread"]["sprayGrowthPerShot"], number>
>;
type MusicVolumePayloadIsNumber = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "musicVolumeChanged" }
    >["sliderValue"],
    number
  >
>;
type GameplayMenuTogglePayloadIsBoolean = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "gameplayMenuSetOpen" }
    >["open"],
    boolean
  >
>;
type ProfileConfirmedPayloadUsesPlayerProfile = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "profileConfirmed" }
    >["profile"],
    PlayerProfile
  >
>;
type GameplaySignalTypeMatches = AssertTrue<
  IsEqual<
    GameplaySignalType,
    "weapon-fired" | "weapon-reloaded" | "enemy-hit-confirmed"
  >
>;
type GameplaySignalWeaponIdMatches = AssertTrue<
  IsEqual<
    Extract<
      GameplaySignal,
      { readonly type: "weapon-fired" | "weapon-reloaded" }
    >["weaponId"],
    FirstPlayableWeaponId
  >
>;

export type ClientShellGameplayTypeTests =
  | ShellActionTypesMatch
  | GameplayRuntimeLifecycleMatches
  | GameplayRuntimeLifecycleCatalogMatches
  | GameplayHudLifecycleUsesRuntimeLifecycle
  | LocalArenaEnemyBehaviorMatches
  | LocalArenaEnemyBehaviorCatalogMatches
  | LocalArenaTargetFeedbackMatches
  | LocalArenaTargetFeedbackCatalogMatches
  | GameplayHudFeedbackUsesTargetFeedbackState
  | GameplayHudWeaponUsesFirstPlayableWeaponId
  | GameplayDebugPanelModeMatches
  | GameplayDebugPanelModeCatalogMatches
  | GameplayDebugActionModeMatches
  | GameplayReticleVisualStateMatches
  | GameplayReticleVisualStateCatalogMatches
  | GameplayTelemetryReticleStateMatches
  | WeaponReadinessMatches
  | WeaponReadinessCatalogMatches
  | GameplayHudWeaponReadinessMatches
  | WeaponReloadStateMatches
  | WeaponReloadStateCatalogMatches
  | GameplayHudReloadStateMatches
  | WeaponReloadRuleMatches
  | WeaponReloadRuleCatalogMatches
  | GameplayHudReloadRuleMatches
  | WeaponDefinitionClipCapacityIsNumber
  | WeaponDefinitionTriggerModeMatchesFoundation
  | WeaponDefinitionSpreadFieldIsNumber
  | MusicVolumePayloadIsNumber
  | GameplayMenuTogglePayloadIsBoolean
  | ProfileConfirmedPayloadUsesPlayerProfile
  | GameplaySignalTypeMatches
  | GameplaySignalWeaponIdMatches;
