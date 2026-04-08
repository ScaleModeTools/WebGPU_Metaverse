import type {
  AffineAimTransform,
  AffineAimTransformFitDiagnosticsSnapshot,
  AffineAimTransformFitQuality,
  AffineAimTransformSnapshot,
  AudioChannelId,
  AudioSettingsSnapshot,
  Degrees,
  GameplayInputModeId,
  HandTriggerCalibrationSnapshot,
  HandTriggerMetricSnapshot,
  BackgroundMusicEngine,
  CalibrationAnchorId,
  Milliseconds,
  NormalizedViewportScalar,
  NormalizedViewportPointInput,
  NormalizedViewportPoint,
  PlayerProfileSnapshot,
  Radians,
  ReticleId,
  SoundEffectEngine,
  Username
} from "@thumbshooter/shared";
import {
  affineAimTransformFitQualities,
  createDegrees,
  createMilliseconds,
  createRadians,
  createUsername
} from "@thumbshooter/shared";
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
type ExpectedGameplayInputModeId = "camera-thumb-shooter" | "mouse";
type ExpectedSoundEffectEngine = "web-audio-api";
type ExpectedAffineAimTransformFitQuality = "stable" | "usable" | "degraded";

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

export type SharedContractTypeTests =
  | CalibrationAnchorIdMatches
  | AudioChannelIdMatches
  | BackgroundMusicEngineMatches
  | GameplayInputModeMatches
  | SoundEffectEngineMatches
  | AffineAimTransformFitQualityMatches
  | AffineAimTransformFitQualityCatalogMatches
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
  | AffineAimTransformFitDiagnosticsQualityUsesFitQuality;
