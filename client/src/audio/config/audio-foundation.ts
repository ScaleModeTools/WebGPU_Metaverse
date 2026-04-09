import { AudioSettings } from "@thumbshooter/shared";

import type { AudioFoundationConfig } from "../types/audio-foundation";

export const audioFoundationConfig = {
  runtime: {
    unlockPolicy: "first-user-gesture",
    graphOwnership: "single-shared-audio-context",
    settingsPersistence: "player-profile"
  },
  music: {
    engine: "strudel-web",
    mode: "procedural-reactive-bgm",
    startPolicy: "shell-load-play-after-unlock",
    licenseConstraint: "agpl-open-source-required"
  },
  soundEffects: {
    engine: "web-audio-api",
    synthesisStrategy: "typed-procedural-cues"
  },
  defaultMix: AudioSettings.create().snapshot.mix
} as const satisfies AudioFoundationConfig;
