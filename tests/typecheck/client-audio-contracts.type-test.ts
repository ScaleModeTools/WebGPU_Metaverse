import type {
  BackgroundMusicEngine,
  SoundEffectEngine
} from "@webgpu-metaverse/shared";

import { audioFoundationConfig } from "../../client/src/audio/config/audio-foundation";
import {
  metaverseAudioCueIds,
  metaverseAudioSessionConfig,
  metaverseAudioTrackIds,
  type MetaverseAudioCueId,
  type MetaverseAudioTrackId
} from "../../client/src/app/audio/index";
import type { AssertTrue, IsAssignable, IsEqual } from "./type-assertions";

type ExpectedAudioTrackId = "shell-attract-loop" | "birds-arena-loop";
type ExpectedAudioCueId =
  | "ui-confirm"
  | "ui-menu-open"
  | "ui-menu-close"
  | "calibration-shot"
  | "metaverse-pistol-shot"
  | "metaverse-rocket-launch"
  | "metaverse-rocket-explosion"
  | "metaverse-world-impact"
  | "metaverse-armor-hit"
  | "weapon-pistol-shot"
  | "weapon-reload"
  | "enemy-hit"
  | "enemy-scatter";

type AudioTrackIdMatches = AssertTrue<
  IsEqual<MetaverseAudioTrackId, ExpectedAudioTrackId>
>;
type AudioCueIdMatches = AssertTrue<
  IsEqual<MetaverseAudioCueId, ExpectedAudioCueId>
>;
type AudioTrackCatalogMatches = AssertTrue<
  IsEqual<(typeof metaverseAudioTrackIds)[number], MetaverseAudioTrackId>
>;
type AudioCueCatalogMatches = AssertTrue<
  IsEqual<(typeof metaverseAudioCueIds)[number], MetaverseAudioCueId>
>;
type UnlockPolicyIsFixedImplementationValue = AssertTrue<
  IsEqual<
    (typeof audioFoundationConfig)["runtime"]["unlockPolicy"],
    "first-user-gesture"
  >
>;
type StartPolicyIsFixedImplementationValue = AssertTrue<
  IsEqual<
    (typeof audioFoundationConfig)["music"]["startPolicy"],
    "shell-load-play-after-unlock"
  >
>;
type MusicEngineUsesSharedEngineContract = AssertTrue<
  IsEqual<
    (typeof audioFoundationConfig)["music"]["engine"],
    BackgroundMusicEngine
  >
>;
type SoundEffectsEngineUsesSharedEngineContract = AssertTrue<
  IsEqual<
    (typeof audioFoundationConfig)["soundEffects"]["engine"],
    SoundEffectEngine
  >
>;
type SessionInitialTrackUsesShellTrack = AssertTrue<
  IsEqual<
    (typeof metaverseAudioSessionConfig)["initialBackgroundTrackId"],
    "shell-attract-loop"
  >
>;
type SessionCatalogUsesTrackIds = AssertTrue<
  IsEqual<
    keyof (typeof metaverseAudioSessionConfig)["contentCatalog"]["backgroundTracks"],
    MetaverseAudioTrackId
  >
>;
type SessionCatalogUsesCueIds = AssertTrue<
  IsAssignable<
    keyof (typeof metaverseAudioSessionConfig)["contentCatalog"]["cues"],
    MetaverseAudioCueId
  >
>;

export type ClientAudioContractTypeTests =
  | AudioTrackIdMatches
  | AudioCueIdMatches
  | AudioTrackCatalogMatches
  | AudioCueCatalogMatches
  | UnlockPolicyIsFixedImplementationValue
  | StartPolicyIsFixedImplementationValue
  | MusicEngineUsesSharedEngineContract
  | SoundEffectsEngineUsesSharedEngineContract
  | SessionInitialTrackUsesShellTrack
  | SessionCatalogUsesTrackIds
  | SessionCatalogUsesCueIds;
