import type {
  AffineAimTransformSnapshot,
  AudioChannelId,
  AudioSettingsSnapshot,
  BackgroundMusicEngine,
  CalibrationAnchorId,
  NormalizedViewportScalar,
  NormalizedViewportPoint,
  PlayerProfileSnapshot,
  ReticleId,
  SoundEffectEngine,
  Username
} from "@thumbshooter/shared";
import { createUsername } from "@thumbshooter/shared";
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
type ExpectedSoundEffectEngine = "web-audio-api";

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
type SoundEffectEngineMatches = AssertTrue<
  IsEqual<SoundEffectEngine, ExpectedSoundEffectEngine>
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
type NormalizedPointXAxisUsesBrandedScalar = AssertTrue<
  IsEqual<NormalizedViewportPoint["x"], NormalizedViewportScalar>
>;
type NormalizedPointYAxisUsesBrandedScalar = AssertTrue<
  IsEqual<NormalizedViewportPoint["y"], NormalizedViewportScalar>
>;
type CreateUsernameReturnMatches = AssertTrue<
  IsEqual<ReturnType<typeof createUsername>, Username | null>
>;

export type SharedContractTypeTests =
  | CalibrationAnchorIdMatches
  | AudioChannelIdMatches
  | BackgroundMusicEngineMatches
  | SoundEffectEngineMatches
  | ReticleIdMatches
  | PlayerProfileReticleUsesReticleId
  | PlayerProfileAudioUsesAudioSettings
  | PlayerProfileAimCalibrationUsesSharedTransform
  | NormalizedPointXAxisUsesBrandedScalar
  | NormalizedPointYAxisUsesBrandedScalar
  | CreateUsernameReturnMatches;
