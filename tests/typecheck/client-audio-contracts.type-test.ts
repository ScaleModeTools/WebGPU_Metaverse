import { audioFoundationConfig } from "../../client/src/audio/config/audio-foundation";
import {
  audioCueIds,
  audioTrackIds,
  type AudioCueId,
  type AudioFoundationConfig,
  type AudioTrackId
} from "../../client/src/audio/types/audio-foundation";
import type { AssertTrue, IsAssignable, IsEqual } from "./type-assertions";

type ExpectedAudioTrackId = "shell-attract-loop" | "birds-arena-loop";
type ExpectedAudioCueId =
  | "ui-confirm"
  | "ui-menu-open"
  | "ui-menu-close"
  | "calibration-shot"
  | "weapon-pistol-shot"
  | "weapon-reload"
  | "enemy-hit"
  | "enemy-scatter";

type AudioTrackIdMatches = AssertTrue<
  IsEqual<AudioTrackId, ExpectedAudioTrackId>
>;
type AudioCueIdMatches = AssertTrue<IsEqual<AudioCueId, ExpectedAudioCueId>>;
type AudioTrackCatalogMatches = AssertTrue<
  IsEqual<(typeof audioTrackIds)[number], AudioTrackId>
>;
type AudioCueCatalogMatches = AssertTrue<
  IsEqual<(typeof audioCueIds)[number], AudioCueId>
>;
type AudioConfigMatchesPublicContract = AssertTrue<
  IsAssignable<typeof audioFoundationConfig, AudioFoundationConfig>
>;
type ShellTrackUsesTrackId = AssertTrue<
  IsEqual<
    (typeof audioFoundationConfig)["music"]["shellTrack"],
    "shell-attract-loop"
  >
>;
type GameplayTrackUsesTrackId = AssertTrue<
  IsEqual<
    (typeof audioFoundationConfig)["music"]["gameplayTrack"],
    "birds-arena-loop"
  >
>;
type CueCatalogUsesReadonlyCueIds = AssertTrue<
  IsAssignable<
    (typeof audioFoundationConfig)["soundEffects"]["cueIds"],
    readonly AudioCueId[]
  >
>;

export type ClientAudioContractTypeTests =
  | AudioTrackIdMatches
  | AudioCueIdMatches
  | AudioTrackCatalogMatches
  | AudioCueCatalogMatches
  | AudioConfigMatchesPublicContract
  | ShellTrackUsesTrackId
  | GameplayTrackUsesTrackId
  | CueCatalogUsesReadonlyCueIds;
