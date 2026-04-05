import type {
  AudioMixSnapshot,
  BackgroundMusicEngine,
  SoundEffectEngine
} from "@thumbshooter/shared";

export const audioUnlockPolicies = ["first-user-gesture"] as const;
export const backgroundMusicStartPolicies = [
  "shell-load-play-after-unlock"
] as const;
export const audioTrackIds = [
  "shell-attract-loop",
  "birds-arena-loop"
] as const;
export const audioCueIds = [
  "ui-confirm",
  "ui-menu-open",
  "ui-menu-close",
  "calibration-shot",
  "weapon-pistol-shot",
  "weapon-reload",
  "enemy-hit",
  "enemy-scatter"
] as const;

export type AudioUnlockPolicy = (typeof audioUnlockPolicies)[number];
export type BackgroundMusicStartPolicy =
  (typeof backgroundMusicStartPolicies)[number];
export type AudioTrackId = (typeof audioTrackIds)[number];
export type AudioCueId = (typeof audioCueIds)[number];

export interface AudioFoundationConfig {
  readonly runtime: {
    readonly unlockPolicy: AudioUnlockPolicy;
    readonly graphOwnership: "single-shared-audio-context";
    readonly settingsPersistence: "player-profile";
  };
  readonly music: {
    readonly engine: BackgroundMusicEngine;
    readonly mode: "procedural-reactive-bgm";
    readonly startPolicy: BackgroundMusicStartPolicy;
    readonly shellTrack: AudioTrackId;
    readonly gameplayTrack: AudioTrackId;
    readonly licenseConstraint: "agpl-open-source-required";
  };
  readonly soundEffects: {
    readonly engine: SoundEffectEngine;
    readonly synthesisStrategy: "typed-procedural-cues";
    readonly cueIds: readonly AudioCueId[];
  };
  readonly defaultMix: AudioMixSnapshot;
}
