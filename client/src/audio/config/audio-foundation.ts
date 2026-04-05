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
    shellTrack: "shell-attract-loop",
    gameplayTrack: "birds-arena-loop",
    licenseConstraint: "agpl-open-source-required"
  },
  soundEffects: {
    engine: "web-audio-api",
    synthesisStrategy: "typed-procedural-cues",
    cueIds: [
      "ui-confirm",
      "ui-menu-open",
      "ui-menu-close",
      "calibration-shot",
      "weapon-pistol-shot",
      "weapon-reload",
      "enemy-hit",
      "enemy-scatter"
    ]
  },
  defaultMix: AudioSettings.create().snapshot.mix
} as const satisfies AudioFoundationConfig;
