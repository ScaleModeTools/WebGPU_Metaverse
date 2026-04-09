import type {
  Degrees,
  GameplaySessionMode,
  Milliseconds,
  PlayerProfile,
  Radians
} from "@webgpu-metaverse/shared";
import {
  gameplayInputModeIds,
  gameplaySessionModes
} from "@webgpu-metaverse/shared";
import type { GameplayInputModeId } from "@webgpu-metaverse/shared";

import type { MetaverseShellControllerAction } from "../../client/src/app/types/metaverse-shell-controller";
import {
  gameplayDebugPanelModes,
  gameplayRuntimeLifecycleStates,
  gameplayReticleVisualStates,
  localArenaEnemyBehaviorStates,
  localArenaTargetFeedbackStates,
  type FirstPlayableWeaponId,
  type GameplayDebugPanelMode,
  type GameplayHudSnapshot,
  type GameplayRuntimeConfig,
  type GameplayReticleVisualState,
  type GameplayTelemetrySnapshot,
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
} from "../../client/src/experiences/duck-hunt/index";
import type {
  HandTriggerGestureConfig,
  HandTriggerGestureSnapshot
} from "../../client/src/tracking/index";
import {
  duckHuntGameFoundationConfig as gameFoundationConfig
} from "../../client/src/experiences/duck-hunt/index";
import type { AssertTrue, IsAssignable, IsEqual } from "./type-assertions";

type MetaverseShellControllerActionType =
  MetaverseShellControllerAction["type"];

type ExpectedShellActionType =
  | "audioSnapshotChanged"
  | "bestScoreRaised"
  | "calibrationProgressRecorded"
  | "calibrationResetRequested"
  | "capabilityProbeStarted"
  | "capabilitySnapshotReceived"
  | "coopRoomIdDraftChanged"
  | "duckHuntControllerSchemeChanged"
  | "experienceLaunchRequested"
  | "globalBindingPresetChanged"
  | "gameplayDebugPanelModeChanged"
  | "gameplayExited"
  | "gameplayMenuSetOpen"
  | "inputModeChanged"
  | "loginRejected"
  | "metaverseControlModeChanged"
  | "metaverseControllerSchemeChanged"
  | "metaverseEntryRequested"
  | "metaverseReturnRequested"
  | "musicVolumeChanged"
  | "permissionRequestStarted"
  | "permissionResolved"
  | "profileCleared"
  | "profileConfirmed"
  | "profileEditRequested"
  | "sessionModeChanged"
  | "setupRequested"
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
type ExpectedGameplayInputModeId = "camera-thumb-trigger" | "mouse";
type ExpectedGameplaySessionMode = "single-player" | "co-op";
type ExpectedGameplaySessionPhase =
  | "active"
  | "completed"
  | "failed"
  | "waiting-for-players";

type ShellActionTypesMatch = AssertTrue<
  IsEqual<MetaverseShellControllerActionType, ExpectedShellActionType>
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
      MetaverseShellControllerAction,
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
type GameplaySessionModeMatches = AssertTrue<
  IsEqual<GameplaySessionMode, ExpectedGameplaySessionMode>
>;
type GameplaySessionModeCatalogMatches = AssertTrue<
  IsEqual<(typeof gameplaySessionModes)[number], GameplaySessionMode>
>;
type GameplayHudSessionModeMatches = AssertTrue<
  IsEqual<GameplayHudSnapshot["session"]["mode"], GameplaySessionMode>
>;
type SessionModeActionPayloadMatches = AssertTrue<
  IsEqual<
    Extract<
      MetaverseShellControllerAction,
      { readonly type: "sessionModeChanged" }
    >["sessionMode"],
    GameplaySessionMode
  >
>;
type GameplayTelemetryReticleStateMatches = AssertTrue<
  IsEqual<
    GameplayTelemetrySnapshot["reticleVisualState"],
    GameplayReticleVisualState
  >
>;
type GameplayTelemetrySessionPhaseMatches = AssertTrue<
  IsEqual<GameplayTelemetrySnapshot["sessionPhase"], ExpectedGameplaySessionPhase>
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
type CombatSessionRoundNumberIsNumber = AssertTrue<
  IsEqual<LocalCombatSessionSnapshot["roundNumber"], number>
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
      MetaverseShellControllerAction,
      { readonly type: "musicVolumeChanged" }
    >["sliderValue"],
    number
  >
>;
type GameplayMenuTogglePayloadIsBoolean = AssertTrue<
  IsEqual<
    Extract<
      MetaverseShellControllerAction,
      { readonly type: "gameplayMenuSetOpen" }
    >["open"],
    boolean
  >
>;
type CoopRoomDraftPayloadIsString = AssertTrue<
  IsEqual<
    Extract<
      MetaverseShellControllerAction,
      { readonly type: "coopRoomIdDraftChanged" }
    >["coopRoomIdDraft"],
    string
  >
>;
type ProfileConfirmedPayloadUsesPlayerProfile = AssertTrue<
  IsEqual<
    Extract<
      MetaverseShellControllerAction,
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
  | GameplaySessionModeMatches
  | GameplaySessionModeCatalogMatches
  | GameplayHudSessionModeMatches
  | SessionModeActionPayloadMatches
  | GameplayTelemetryReticleStateMatches
  | GameplayTelemetrySessionPhaseMatches
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
  | CoopRoomDraftPayloadIsString
  | ProfileConfirmedPayloadUsesPlayerProfile
  | GameplaySignalTypeMatches
  | GameplaySignalWeaponIdMatches;
