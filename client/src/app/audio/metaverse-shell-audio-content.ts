import type { AudioContentCatalog } from "../../audio";
import { schedulePulse } from "../../audio";

export const metaverseShellBackgroundTrackId = "shell-attract-loop" as const;

export const metaverseShellAudioCueIds = [
  "ui-confirm",
  "ui-menu-open",
  "ui-menu-close",
  "calibration-shot"
] as const;

export type MetaverseShellAudioCueId =
  (typeof metaverseShellAudioCueIds)[number];

export const metaverseShellAudioContentCatalog = {
  backgroundTracks: {
    [metaverseShellBackgroundTrackId]: {
      label: "WebGPU Metaverse attract loop",
      buildPattern: (strudel) =>
        strudel
          .stack(
            strudel
              .note("<e3,g3,b3> <c3,e3,g3> <a2,c3,e3> <b2,d3,g3>")
              .s("sine")
              .attack(1.1)
              .release(2.4)
              .gain(0.11)
              .room(0.68)
              .roomsize(5)
              .lpf(1800)
              .slow(2),
            strudel
              .note("<~ g5 ~ ~ ~ e5 ~ ~> <~ a5 ~ ~ ~ g5 ~ ~>")
              .s("triangle")
              .gain(0.045)
              .release(0.9)
              .delay(0.42)
              .delaytime(0.6)
              .delayfeedback(0.4)
              .room(0.42)
              .lpf(2400)
              .slow(4),
            strudel
              .note("<e2 ~ ~ ~ ~ ~ b1 ~> <c2 ~ ~ ~ ~ ~ g1 ~>")
              .s("sine")
              .gain(0.075)
              .room(0.16)
              .lpf(320)
              .slow(4)
          )
          .slow(2)
          .cpm(62)
    }
  },
  cues: {
    "ui-confirm": {
      label: "UI confirm",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          660,
          0.12,
          "triangle",
          0.09,
          990
        );
      }
    },
    "ui-menu-open": {
      label: "UI menu open",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          330,
          0.14,
          "sawtooth",
          0.06,
          660
        );
        schedulePulse(
          browserContext,
          destinationBus,
          now + 0.05,
          660,
          0.11,
          "triangle",
          0.04
        );
      }
    },
    "ui-menu-close": {
      label: "UI menu close",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          740,
          0.16,
          "triangle",
          0.05,
          280
        );
      }
    },
    "calibration-shot": {
      label: "Calibration shot",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          240,
          0.07,
          "square",
          0.09,
          105
        );
      }
    }
  }
} as const satisfies AudioContentCatalog<
  typeof metaverseShellBackgroundTrackId,
  MetaverseShellAudioCueId
>;
