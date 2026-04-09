import type {
  AudioMixSnapshot,
  BackgroundMusicEngine,
  SoundEffectEngine
} from "@thumbshooter/shared";

export interface AudioFoundationConfig {
  readonly defaultMix: AudioMixSnapshot;
  readonly music: {
    readonly engine: BackgroundMusicEngine;
    readonly licenseConstraint: "agpl-open-source-required";
    readonly mode: "procedural-reactive-bgm";
    readonly startPolicy: "shell-load-play-after-unlock";
  };
  readonly runtime: {
    readonly graphOwnership: "single-shared-audio-context";
    readonly settingsPersistence: "player-profile";
    readonly unlockPolicy: "first-user-gesture";
  };
  readonly soundEffects: {
    readonly engine: SoundEffectEngine;
    readonly synthesisStrategy: "typed-procedural-cues";
  };
}
