import type {
  AffineAimTransform,
  AffineAimTransformFitDiagnosticsSnapshot,
  AffineAimTransformFitQuality,
  AffineAimTransformSnapshot,
  AudioChannelId,
  AudioSettingsSnapshot,
  Degrees,
  ExperienceCatalogEntrySnapshot,
  ExperienceId,
  GameplayInputModeId,
  HandTriggerCalibrationSnapshot,
  HandTriggerMetricSnapshot,
  BackgroundMusicEngine,
  CalibrationAnchorId,
  CoopBirdBehaviorState,
  CoopRoomClientCommand,
  DuckHuntCoopRoomWebTransportClientDatagram,
  DuckHuntCoopRoomWebTransportClientDatagramType,
  DuckHuntCoopRoomWebTransportClientMessage,
  DuckHuntCoopRoomWebTransportServerMessage,
  CoopRoomDirectorySnapshot,
  CoopRoomDirectorySnapshotInput,
  CoopRoundPhase,
  CoopRoomPhase,
  CoopRoomSnapshot,
  CoopPlayerShotOutcomeState,
  GameplaySessionMode,
  GameplayTickOwner,
  Milliseconds,
  MetaversePlayerId,
  MetaversePresenceMountedOccupancyKind,
  MetaversePresenceMountedOccupancySnapshot,
  MetaversePresenceMountedOccupantRoleId,
  MetaversePresencePoseSnapshot,
  MetaversePresenceWebTransportClientMessage,
  MetaversePresenceWebTransportServerMessage,
  MetaverseDriverVehicleControlIntentSnapshot,
  MetaverseRealtimeMountedOccupancySnapshot,
  MetaverseRealtimeWorldClientCommand,
  MetaverseRealtimeWorldWebTransportClientDatagram,
  MetaverseRealtimeWorldWebTransportClientDatagramType,
  MetaverseRealtimeWorldWebTransportClientMessage,
  MetaverseRealtimeWorldWebTransportServerMessage,
  MetaverseRealtimeVehicleSeatSnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseRealtimeWorldServerEventType,
  MetaverseVehicleId,
  MetaverseSessionSnapshot,
  NormalizedViewportScalar,
  NormalizedViewportPointInput,
  NormalizedViewportPoint,
  PlayerProfileSnapshot,
  PortalLaunchSelectionSnapshot,
  Radians,
  ReticleId,
  SoundEffectEngine,
  CoopVector3Snapshot,
  VehicleOrientationDescriptor,
  Username
} from "@webgpu-metaverse/shared";
import {
  affineAimTransformFitQualities,
  coopBirdBehaviorStates,
  coopRoundPhases,
  coopPlayerShotOutcomeStates,
  coopRoomClientCommandTypes,
  coopRoomPhases,
  createDegrees,
  createMilliseconds,
  createRadians,
  createUsername
} from "@webgpu-metaverse/shared";
import type { AssertTrue, IsEqual } from "./type-assertions";

type ExpectedCalibrationAnchorId =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "mid-right"
  | "mid-left"
  | "bottom-center";

type ExpectedReticleId = "default-ring" | "precision-ring";
type ExpectedAudioChannelId = "music" | "sfx";
type ExpectedBackgroundMusicEngine = "strudel-web";
type ExpectedGameplayInputModeId = "camera-thumb-trigger" | "mouse";
type ExpectedExperienceId = "duck-hunt";
type ExpectedGameplaySessionMode = "single-player" | "co-op";
type ExpectedGameplayTickOwner = "client" | "server";
type ExpectedSoundEffectEngine = "web-audio-api";
type ExpectedAffineAimTransformFitQuality = "stable" | "usable" | "degraded";
type ExpectedCoopRoundPhase = "combat" | "cooldown";
type ExpectedCoopRoomPhase =
  | "waiting-for-players"
  | "active"
  | "completed"
  | "failed";
type ExpectedCoopBirdBehaviorState = "glide" | "scatter" | "downed";
type ExpectedCoopPlayerShotOutcomeState = "miss" | "scatter" | "hit";
type ExpectedMetaversePresenceMountedOccupancyKind = "entry" | "seat";
type ExpectedMetaversePresenceMountedOccupantRoleId =
  | "driver"
  | "passenger"
  | "turret";
type ExpectedCoopRoomClientCommandType =
  | "join-room"
  | "set-player-ready"
  | "start-session"
  | "kick-player"
  | "leave-room"
  | "fire-shot"
  | "sync-player-presence";

type CalibrationAnchorIdMatches = AssertTrue<
  IsEqual<CalibrationAnchorId, ExpectedCalibrationAnchorId>
>;

type ReticleIdMatches = AssertTrue<IsEqual<ReticleId, ExpectedReticleId>>;
type AudioChannelIdMatches = AssertTrue<
  IsEqual<AudioChannelId, ExpectedAudioChannelId>
>;
type BackgroundMusicEngineMatches = AssertTrue<
  IsEqual<BackgroundMusicEngine, ExpectedBackgroundMusicEngine>
>;
type GameplayInputModeMatches = AssertTrue<
  IsEqual<GameplayInputModeId, ExpectedGameplayInputModeId>
>;
type ExperienceIdMatches = AssertTrue<IsEqual<ExperienceId, ExpectedExperienceId>>;
type GameplaySessionModeMatches = AssertTrue<
  IsEqual<GameplaySessionMode, ExpectedGameplaySessionMode>
>;
type GameplayTickOwnerMatches = AssertTrue<
  IsEqual<GameplayTickOwner, ExpectedGameplayTickOwner>
>;
type ExperienceCatalogEntryIdMatches = AssertTrue<
  IsEqual<ExperienceCatalogEntrySnapshot["id"], ExperienceId>
>;
type PortalLaunchSelectionUsesExperienceId = AssertTrue<
  IsEqual<PortalLaunchSelectionSnapshot["experienceId"], ExperienceId>
>;
type PortalLaunchSelectionUsesTickOwner = AssertTrue<
  IsEqual<PortalLaunchSelectionSnapshot["tickOwner"], GameplayTickOwner>
>;
type VehicleOrientationUsesForwardModelYaw = AssertTrue<
  IsEqual<VehicleOrientationDescriptor["forwardModelYawRadians"], number>
>;
type MetaversePresencePoseMountedOccupancyMatches = AssertTrue<
  IsEqual<
    MetaversePresencePoseSnapshot["mountedOccupancy"],
    MetaversePresenceMountedOccupancySnapshot | null
  >
>;
type MetaversePresenceMountedOccupancyKindMatches = AssertTrue<
  IsEqual<
    MetaversePresenceMountedOccupancyKind,
    ExpectedMetaversePresenceMountedOccupancyKind
  >
>;
type MetaversePresenceMountedOccupantRoleMatches = AssertTrue<
  IsEqual<
    MetaversePresenceMountedOccupantRoleId,
    ExpectedMetaversePresenceMountedOccupantRoleId
  >
>;
type MetaversePresenceMountedEnvironmentAssetIdIsString = AssertTrue<
  IsEqual<MetaversePresenceMountedOccupancySnapshot["environmentAssetId"], string>
>;
type MetaverseRealtimeWorldEventTypeMatches = AssertTrue<
  IsEqual<MetaverseRealtimeWorldEvent["type"], "world-snapshot">
>;
type MetaverseRealtimeWorldServerEventTypeMatches = AssertTrue<
  IsEqual<MetaverseRealtimeWorldServerEventType, "world-snapshot">
>;
type MetaverseRealtimeWorldUsesMetaversePlayerId = AssertTrue<
  IsEqual<MetaverseRealtimeWorldSnapshot["players"][number]["playerId"], MetaversePlayerId>
>;
type MetaverseRealtimeWorldUsesVehicleId = AssertTrue<
  IsEqual<MetaverseRealtimeWorldSnapshot["vehicles"][number]["vehicleId"], MetaverseVehicleId>
>;
type MetaverseRealtimeMountedOccupancyMatches = AssertTrue<
  IsEqual<
    MetaverseRealtimeWorldSnapshot["players"][number]["mountedOccupancy"],
    MetaverseRealtimeMountedOccupancySnapshot | null
  >
>;
type MetaverseRealtimeVehicleSeatRoleMatches = AssertTrue<
  IsEqual<
    MetaverseRealtimeVehicleSeatSnapshot["occupantRole"],
    ExpectedMetaversePresenceMountedOccupantRoleId
  >
>;
type MetaverseRealtimeTickOwnerMatches = AssertTrue<
  IsEqual<MetaverseRealtimeWorldSnapshot["tick"]["owner"], "server">
>;
type MetaverseRealtimeTickIntervalUsesMilliseconds = AssertTrue<
  IsEqual<MetaverseRealtimeWorldSnapshot["tick"]["tickIntervalMs"], Milliseconds>
>;
type MetaversePresenceWebTransportCommandTypeMatches = AssertTrue<
  IsEqual<
    Extract<
      MetaversePresenceWebTransportClientMessage,
      {
        readonly type: "presence-command-request";
      }
    >["command"]["type"],
    "join-presence" | "leave-presence" | "sync-presence"
  >
>;
type MetaversePresenceWebTransportServerMessageWrapsRosterEvent = AssertTrue<
  IsEqual<
    Extract<
      MetaversePresenceWebTransportServerMessage,
      {
        readonly type: "presence-server-event";
      }
    >["event"]["type"],
    "presence-roster"
  >
>;
type MetaverseRealtimeWorldWebTransportSnapshotRequestTypeMatches = AssertTrue<
  IsEqual<
    MetaverseRealtimeWorldWebTransportClientMessage["type"],
    "world-command-request" | "world-snapshot-request"
  >
>;
type MetaverseRealtimeWorldCommandTypeMatches = AssertTrue<
  IsEqual<
    MetaverseRealtimeWorldClientCommand["type"],
    "sync-driver-vehicle-control"
  >
>;
type MetaverseRealtimeWorldDriverControlIntentUsesStringAssetId = AssertTrue<
  IsEqual<
    MetaverseDriverVehicleControlIntentSnapshot["environmentAssetId"],
    string
  >
>;
type MetaverseRealtimeWorldWebTransportServerMessageWrapsWorldEvent = AssertTrue<
  IsEqual<
    Extract<
      MetaverseRealtimeWorldWebTransportServerMessage,
      {
        readonly type: "world-server-event";
      }
    >["event"]["type"],
    "world-snapshot"
  >
>;
type MetaverseRealtimeWorldWebTransportDatagramTypeMatches = AssertTrue<
  IsEqual<
    MetaverseRealtimeWorldWebTransportClientDatagramType,
    "world-driver-vehicle-control-datagram"
  >
>;
type MetaverseRealtimeWorldWebTransportDatagramWrapsDriverControl = AssertTrue<
  IsEqual<
    MetaverseRealtimeWorldWebTransportClientDatagram["command"]["type"],
    "sync-driver-vehicle-control"
  >
>;
type MetaverseSessionUsesExperienceId = AssertTrue<
  IsEqual<MetaverseSessionSnapshot["activeExperienceId"], ExperienceId | null>
>;
type MetaverseSessionAvailableIdsUseExperienceIds = AssertTrue<
  IsEqual<MetaverseSessionSnapshot["availableExperienceIds"][number], ExperienceId>
>;
type SoundEffectEngineMatches = AssertTrue<
  IsEqual<SoundEffectEngine, ExpectedSoundEffectEngine>
>;
type AffineAimTransformFitQualityMatches = AssertTrue<
  IsEqual<AffineAimTransformFitQuality, ExpectedAffineAimTransformFitQuality>
>;
type AffineAimTransformFitQualityCatalogMatches = AssertTrue<
  IsEqual<
    (typeof affineAimTransformFitQualities)[number],
    AffineAimTransformFitQuality
  >
>;
type CoopRoomPhaseMatches = AssertTrue<
  IsEqual<CoopRoomPhase, ExpectedCoopRoomPhase>
>;
type CoopRoundPhaseMatches = AssertTrue<
  IsEqual<CoopRoundPhase, ExpectedCoopRoundPhase>
>;
type CoopRoundPhaseCatalogMatches = AssertTrue<
  IsEqual<(typeof coopRoundPhases)[number], CoopRoundPhase>
>;
type CoopRoomPhaseCatalogMatches = AssertTrue<
  IsEqual<(typeof coopRoomPhases)[number], CoopRoomPhase>
>;
type CoopBirdBehaviorMatches = AssertTrue<
  IsEqual<CoopBirdBehaviorState, ExpectedCoopBirdBehaviorState>
>;
type CoopBirdBehaviorCatalogMatches = AssertTrue<
  IsEqual<(typeof coopBirdBehaviorStates)[number], CoopBirdBehaviorState>
>;
type CoopPlayerShotOutcomeMatches = AssertTrue<
  IsEqual<CoopPlayerShotOutcomeState, ExpectedCoopPlayerShotOutcomeState>
>;
type CoopPlayerShotOutcomeCatalogMatches = AssertTrue<
  IsEqual<
    (typeof coopPlayerShotOutcomeStates)[number],
    CoopPlayerShotOutcomeState
  >
>;
type CoopRoomClientCommandTypeMatches = AssertTrue<
  IsEqual<CoopRoomClientCommand["type"], ExpectedCoopRoomClientCommandType>
>;
type CoopRoomClientCommandCatalogMatches = AssertTrue<
  IsEqual<
    (typeof coopRoomClientCommandTypes)[number],
    CoopRoomClientCommand["type"]
  >
>;
type DuckHuntCoopRoomWebTransportCommandTypeMatches = AssertTrue<
  IsEqual<
    Extract<
      DuckHuntCoopRoomWebTransportClientMessage,
      {
        readonly type: "coop-room-command-request";
      }
    >["command"]["type"],
    CoopRoomClientCommand["type"]
  >
>;
type DuckHuntCoopRoomWebTransportServerMessageWrapsRoomEvent = AssertTrue<
  IsEqual<
    Extract<
      DuckHuntCoopRoomWebTransportServerMessage,
      {
        readonly type: "coop-room-server-event";
      }
    >["event"]["type"],
    "room-snapshot"
  >
>;
type DuckHuntCoopRoomWebTransportDatagramTypeMatches = AssertTrue<
  IsEqual<
    DuckHuntCoopRoomWebTransportClientDatagramType,
    "coop-room-player-presence-datagram"
  >
>;
type DuckHuntCoopRoomWebTransportDatagramWrapsPlayerPresence = AssertTrue<
  IsEqual<
    DuckHuntCoopRoomWebTransportClientDatagram["command"]["type"],
    "sync-player-presence"
  >
>;
type CoopRoomDirectoryServiceMatches = AssertTrue<
  IsEqual<CoopRoomDirectorySnapshot["service"], "webgpu-metaverse-server">
>;
type CoopRoomDirectoryInputServiceMatches = AssertTrue<
  IsEqual<
    CoopRoomDirectorySnapshotInput["service"],
    "webgpu-metaverse-server" | undefined
  >
>;

type PlayerProfileReticleUsesReticleId = AssertTrue<
  IsEqual<PlayerProfileSnapshot["selectedReticleId"], ReticleId>
>;
type PlayerProfileAudioUsesAudioSettings = AssertTrue<
  IsEqual<PlayerProfileSnapshot["audioSettings"], AudioSettingsSnapshot>
>;
type PlayerProfileAimCalibrationUsesSharedTransform = AssertTrue<
  IsEqual<PlayerProfileSnapshot["aimCalibration"], AffineAimTransformSnapshot | null>
>;
type PlayerProfileTriggerCalibrationUsesSharedSnapshot = AssertTrue<
  IsEqual<PlayerProfileSnapshot["triggerCalibration"], HandTriggerCalibrationSnapshot | null>
>;
type NormalizedPointXAxisUsesBrandedScalar = AssertTrue<
  IsEqual<NormalizedViewportPoint["x"], NormalizedViewportScalar>
>;
type NormalizedPointYAxisUsesBrandedScalar = AssertTrue<
  IsEqual<NormalizedViewportPoint["y"], NormalizedViewportScalar>
>;
type HandTriggerMetricAxisUsesDegrees = AssertTrue<
  IsEqual<HandTriggerMetricSnapshot["axisAngleDegrees"], Degrees>
>;
type HandTriggerCalibrationAxisUsesDegrees = AssertTrue<
  IsEqual<
    HandTriggerCalibrationSnapshot["pressedAxisAngleDegreesMax"],
    Degrees
  >
>;
type CreateMillisecondsReturnMatches = AssertTrue<
  IsEqual<ReturnType<typeof createMilliseconds>, Milliseconds>
>;
type CreateDegreesReturnMatches = AssertTrue<
  IsEqual<ReturnType<typeof createDegrees>, Degrees>
>;
type CreateRadiansReturnMatches = AssertTrue<
  IsEqual<ReturnType<typeof createRadians>, Radians>
>;
type CreateUsernameReturnMatches = AssertTrue<
  IsEqual<ReturnType<typeof createUsername>, Username | null>
>;
type SharedProjectUnclampedReturnMatches = AssertTrue<
  IsEqual<
    ReturnType<AffineAimTransform["projectUnclamped"]>,
    NormalizedViewportPointInput
  >
>;
type AffineAimTransformFitDiagnosticsSampleCountIsNumber = AssertTrue<
  IsEqual<AffineAimTransformFitDiagnosticsSnapshot["sampleCount"], number>
>;
type AffineAimTransformFitDiagnosticsQualityUsesFitQuality = AssertTrue<
  IsEqual<
    AffineAimTransformFitDiagnosticsSnapshot["quality"],
    AffineAimTransformFitQuality
  >
>;
type CoopRoomTickOwnerUsesServer = AssertTrue<
  IsEqual<CoopRoomSnapshot["tick"]["owner"], "server">
>;
type CoopRoomTickIntervalUsesMilliseconds = AssertTrue<
  IsEqual<CoopRoomSnapshot["tick"]["tickIntervalMs"], Milliseconds>
>;
type CoopRoomServerTimeUsesMilliseconds = AssertTrue<
  IsEqual<CoopRoomSnapshot["tick"]["serverTimeMs"], Milliseconds>
>;
type CoopRoomBirdHeadingUsesRadians = AssertTrue<
  IsEqual<CoopRoomSnapshot["birds"][number]["headingRadians"], Radians>
>;
type CoopRoomBirdPositionUsesWorldPoint = AssertTrue<
  IsEqual<CoopRoomSnapshot["birds"][number]["position"], CoopVector3Snapshot>
>;
type CoopRoomPlayerUsernameUsesSharedUsername = AssertTrue<
  IsEqual<CoopRoomSnapshot["players"][number]["username"], Username>
>;
type CoopRoomRequiredReadyCountUsesNumber = AssertTrue<
  IsEqual<CoopRoomSnapshot["session"]["requiredReadyPlayerCount"], number>
>;
type CoopRoomRoundNumberUsesNumber = AssertTrue<
  IsEqual<CoopRoomSnapshot["session"]["roundNumber"], number>
>;
type CoopRoomRoundPhaseUsesRoundPhase = AssertTrue<
  IsEqual<CoopRoomSnapshot["session"]["roundPhase"], CoopRoundPhase>
>;
type CoopRoomDirectoryEntryRoundPhaseUsesRoundPhase = AssertTrue<
  IsEqual<CoopRoomDirectorySnapshot["coOpRooms"][number]["roundPhase"], CoopRoundPhase>
>;
type CoopRoomLeaderPlayerUsesSharedId = AssertTrue<
  IsEqual<CoopRoomSnapshot["session"]["leaderPlayerId"], CoopRoomSnapshot["players"][number]["playerId"] | null>
>;
type CoopRoomDirectoryEntryUsesRoomPhase = AssertTrue<
  IsEqual<CoopRoomDirectorySnapshot["coOpRooms"][number]["phase"], CoopRoomPhase>
>;

export type SharedContractTypeTests =
  | CalibrationAnchorIdMatches
  | AudioChannelIdMatches
  | BackgroundMusicEngineMatches
  | GameplayInputModeMatches
  | ExperienceIdMatches
  | GameplaySessionModeMatches
  | GameplayTickOwnerMatches
  | ExperienceCatalogEntryIdMatches
  | PortalLaunchSelectionUsesExperienceId
  | PortalLaunchSelectionUsesTickOwner
  | MetaverseSessionUsesExperienceId
  | MetaverseSessionAvailableIdsUseExperienceIds
  | SoundEffectEngineMatches
  | AffineAimTransformFitQualityMatches
  | AffineAimTransformFitQualityCatalogMatches
  | CoopRoundPhaseMatches
  | CoopRoundPhaseCatalogMatches
  | CoopRoomPhaseMatches
  | CoopRoomPhaseCatalogMatches
  | CoopBirdBehaviorMatches
  | CoopBirdBehaviorCatalogMatches
  | CoopPlayerShotOutcomeMatches
  | CoopPlayerShotOutcomeCatalogMatches
  | CoopRoomClientCommandTypeMatches
  | CoopRoomClientCommandCatalogMatches
  | ReticleIdMatches
  | PlayerProfileReticleUsesReticleId
  | PlayerProfileAudioUsesAudioSettings
  | PlayerProfileAimCalibrationUsesSharedTransform
  | PlayerProfileTriggerCalibrationUsesSharedSnapshot
  | NormalizedPointXAxisUsesBrandedScalar
  | NormalizedPointYAxisUsesBrandedScalar
  | HandTriggerMetricAxisUsesDegrees
  | HandTriggerCalibrationAxisUsesDegrees
  | CreateMillisecondsReturnMatches
  | CreateDegreesReturnMatches
  | CreateRadiansReturnMatches
  | CreateUsernameReturnMatches
  | SharedProjectUnclampedReturnMatches
  | AffineAimTransformFitDiagnosticsSampleCountIsNumber
  | AffineAimTransformFitDiagnosticsQualityUsesFitQuality
  | CoopRoomTickOwnerUsesServer
  | CoopRoomTickIntervalUsesMilliseconds
  | CoopRoomServerTimeUsesMilliseconds
  | CoopRoomBirdHeadingUsesRadians
  | CoopRoomBirdPositionUsesWorldPoint
  | CoopRoomPlayerUsernameUsesSharedUsername
  | CoopRoomRequiredReadyCountUsesNumber
  | CoopRoomRoundNumberUsesNumber
  | CoopRoomRoundPhaseUsesRoundPhase
  | CoopRoomLeaderPlayerUsesSharedId
  | CoopRoomDirectoryEntryRoundPhaseUsesRoundPhase
  | CoopRoomDirectoryEntryUsesRoomPhase;
