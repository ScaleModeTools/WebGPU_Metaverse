import type {
  Degrees,
  Milliseconds,
  PlayerProfile,
  Radians
} from "@thumbshooter/shared";

import type { ThumbShooterShellControllerAction } from "../../client/src/app/types/thumbshooter-shell-controller";
import {
  gameplayInputModeIds,
  gameFoundationConfig,
  gameplayDebugPanelModes,
  gameplayRuntimeLifecycleStates,
  gameplayReticleVisualStates,
  localArenaEnemyBehaviorStates,
  localArenaTargetFeedbackStates,
  type FirstPlayableWeaponId,
  type GameplayDebugPanelMode,
  type GameplayHudSnapshot,
  type GameplayInputModeId,
  type GameplayRuntimeConfig,
  type GameplayReticleVisualState,
  type GameplayTelemetrySnapshot,
  type HandTriggerGestureConfig,
  type HandTriggerGestureSnapshot,
  type GameplayRuntimeLifecycleState,
  type GameplaySignal,
  type GameplaySignalType,
  type LocalArenaEnemyRenderState,
  type LocalArenaEnemyBehaviorState,
  type LocalCombatSessionSnapshot,
  type LocalArenaTargetFeedbackState,
  type TriggerGestureMode,
  type WeaponDefinition,
  type WeaponReadinessState,
  type WeaponReloadRule,
  type WeaponReloadState,
  weaponReadinessStates,
  weaponReloadStates
} from "../../client/src/game/index";
import type { AssertTrue, IsAssignable, IsEqual } from "./type-assertions";

type ThumbShooterShellControllerActionType =
  ThumbShooterShellControllerAction["type"];

type ExpectedShellActionType =
  | "audioSnapshotChanged"
  | "bestScoreRaised"
  | "calibrationProgressRecorded"
  | "calibrationResetRequested"
  | "capabilityProbeStarted"
  | "capabilitySnapshotReceived"
  | "gameplayStartRequested"
  | "gameplayExited"
  | "gameplayDebugPanelModeChanged"
  | "gameplayMenuSetOpen"
  | "inputModeChanged"
  | "loginRejected"
  | "mainMenuRequested"
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
type ExpectedGameplayInputModeId = "camera-thumb-shooter" | "mouse";

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
type FoundationFirstPlayableWeaponUsesWeaponId = AssertTrue<
  IsEqual<
    (typeof gameFoundationConfig)["weapon"]["firstPlayableWeapon"],
    FirstPlayableWeaponId
  >
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
type GameplayInputModeMatches = AssertTrue<
  IsEqual<GameplayInputModeId, ExpectedGameplayInputModeId>
>;
type GameplayInputModeCatalogMatches = AssertTrue<
  IsEqual<(typeof gameplayInputModeIds)[number], GameplayInputModeId>
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
type FoundationReloadRulesUseWeaponReloadRule = AssertTrue<
  IsAssignable<
    (typeof gameFoundationConfig)["weapon"]["supportedReloadRules"],
    readonly WeaponReloadRule[]
  >
>;
type GameplayHudReloadRuleMatches = AssertTrue<
  IsEqual<GameplayHudSnapshot["weapon"]["reload"]["rule"], WeaponReloadRule>
>;
type FoundationTriggerModesUseTriggerGestureMode = AssertTrue<
  IsAssignable<
    (typeof gameFoundationConfig)["weapon"]["supportedTriggerModes"],
    readonly TriggerGestureMode[]
  >
>;
type HandTrackingExecutionModelIsFixedImplementationValue = AssertTrue<
  IsEqual<
    (typeof gameFoundationConfig)["runtime"]["handTrackingExecutionModel"],
    "worker-first"
  >
>;
type RendererTargetIsFixedImplementationValue = AssertTrue<
  IsEqual<(typeof gameFoundationConfig)["renderer"]["target"], "webgpu">
>;
type InputTrackerIsFixedImplementationValue = AssertTrue<
  IsEqual<
    (typeof gameFoundationConfig)["input"]["tracker"],
    "mediapipe-hand-landmarker"
  >
>;
type PrototypeScatterStateIsFixedImplementationValue = AssertTrue<
  IsEqual<(typeof gameFoundationConfig)["prototype"]["supportsScatterState"], true>
>;
type WeaponCadenceUsesMilliseconds = AssertTrue<
  IsEqual<WeaponDefinition["cadence"]["shotIntervalMs"], Milliseconds>
>;
type WeaponReloadDurationUsesMilliseconds = AssertTrue<
  IsEqual<WeaponDefinition["reload"]["durationMs"], Milliseconds>
>;
type GameplayHudWeaponCooldownUsesMilliseconds = AssertTrue<
  IsEqual<GameplayHudSnapshot["weapon"]["cooldownRemainingMs"], Milliseconds>
>;
type GameplayHudReloadRemainingUsesMilliseconds = AssertTrue<
  IsEqual<
    GameplayHudSnapshot["weapon"]["reload"]["reloadRemainingMs"],
    Milliseconds
  >
>;
type CombatSessionDurationUsesMilliseconds = AssertTrue<
  IsEqual<LocalCombatSessionSnapshot["roundDurationMs"], Milliseconds>
>;
type CombatSessionRemainingUsesMilliseconds = AssertTrue<
  IsEqual<LocalCombatSessionSnapshot["roundTimeRemainingMs"], Milliseconds>
>;
type TriggerConfigPressAxisUsesDegrees = AssertTrue<
  IsEqual<HandTriggerGestureConfig["pressAxisAngleDegrees"], Degrees>
>;
type TriggerSnapshotAxisUsesDegrees = AssertTrue<
  IsEqual<HandTriggerGestureSnapshot["axisAngleDegrees"], Degrees>
>;
type EnemyHeadingUsesRadians = AssertTrue<
  IsEqual<LocalArenaEnemyRenderState["headingRadians"], Radians>
>;
type GameplayWingSweepUsesRadians = AssertTrue<
  IsEqual<GameplayRuntimeConfig["enemies"]["wingSweepRadians"], Radians>
>;
type WeaponDefinitionClipCapacityIsNumber = AssertTrue<
  IsEqual<WeaponDefinition["reload"]["clipCapacity"], number>
>;
type WeaponDefinitionTriggerModeMatchesFoundation = AssertTrue<
  IsEqual<WeaponDefinition["triggerMode"], TriggerGestureMode>
>;
type WeaponDefinitionTriggerGestureUsesHandTriggerConfig = AssertTrue<
  IsEqual<WeaponDefinition["triggerGesture"], HandTriggerGestureConfig>
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
  | FoundationFirstPlayableWeaponUsesWeaponId
  | GameplayDebugPanelModeMatches
  | GameplayDebugPanelModeCatalogMatches
  | GameplayDebugActionModeMatches
  | GameplayReticleVisualStateMatches
  | GameplayReticleVisualStateCatalogMatches
  | GameplayInputModeMatches
  | GameplayInputModeCatalogMatches
  | GameplayTelemetryReticleStateMatches
  | WeaponReadinessMatches
  | WeaponReadinessCatalogMatches
  | GameplayHudWeaponReadinessMatches
  | WeaponReloadStateMatches
  | WeaponReloadStateCatalogMatches
  | GameplayHudReloadStateMatches
  | WeaponReloadRuleMatches
  | FoundationReloadRulesUseWeaponReloadRule
  | GameplayHudReloadRuleMatches
  | FoundationTriggerModesUseTriggerGestureMode
  | HandTrackingExecutionModelIsFixedImplementationValue
  | RendererTargetIsFixedImplementationValue
  | InputTrackerIsFixedImplementationValue
  | PrototypeScatterStateIsFixedImplementationValue
  | WeaponCadenceUsesMilliseconds
  | WeaponReloadDurationUsesMilliseconds
  | GameplayHudWeaponCooldownUsesMilliseconds
  | GameplayHudReloadRemainingUsesMilliseconds
  | CombatSessionDurationUsesMilliseconds
  | CombatSessionRemainingUsesMilliseconds
  | TriggerConfigPressAxisUsesDegrees
  | TriggerSnapshotAxisUsesDegrees
  | EnemyHeadingUsesRadians
  | GameplayWingSweepUsesRadians
  | WeaponDefinitionClipCapacityIsNumber
  | WeaponDefinitionTriggerModeMatchesFoundation
  | WeaponDefinitionTriggerGestureUsesHandTriggerConfig
  | WeaponDefinitionSpreadFieldIsNumber
  | MusicVolumePayloadIsNumber
  | GameplayMenuTogglePayloadIsBoolean
  | ProfileConfirmedPayloadUsesPlayerProfile
  | GameplaySignalTypeMatches
  | GameplaySignalWeaponIdMatches;
