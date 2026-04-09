import type { GameplaySignal } from "../types/duck-hunt-gameplay-signal";
import type { AudioContentCatalog } from "../../../audio";
import { schedulePulse } from "../../../audio";

export const duckHuntBackgroundTrackId = "birds-arena-loop" as const;

export const duckHuntAudioCueIds = [
  "weapon-pistol-shot",
  "weapon-reload",
  "enemy-hit",
  "enemy-scatter"
] as const;

export type DuckHuntAudioCueId = (typeof duckHuntAudioCueIds)[number];

export const duckHuntAudioContentCatalog = {
  backgroundTracks: {
    [duckHuntBackgroundTrackId]: {
      label: "Birds arena loop",
      buildPattern: (strudel) =>
        strudel
          .stack(
            strudel
              .note("<[e3 ~ g3 ~ a3 ~ g3 ~] [e3 ~ a3 ~ b3 ~ a3 ~]>")
              .s("square")
              .gain(0.082)
              .decay(0.12)
              .sustain(0.08)
              .release(0.16)
              .lpf(1650),
            strudel
              .note("<[~ b4 ~ ~ g4 ~ ~ ~] [~ a4 ~ ~ e4 ~ ~ ~]>")
              .s("triangle")
              .gain(0.03)
              .delay(0.24)
              .delaytime(0.375)
              .delayfeedback(0.32)
              .room(0.28)
              .lpf(2000)
              .slow(2),
            strudel
              .note("<[e2 ~ e2 ~ a1 ~ a1 ~] [d2 ~ d2 ~ b1 ~ b1 ~]>")
              .s("triangle")
              .gain(0.095)
              .lpf(360)
              .room(0.14),
            strudel
              .note("~ ~ e5? ~ ~ ~ g5? ~")
              .s("sine")
              .gain(0.017)
              .release(0.32)
              .pan(0.65)
              .delay(0.18)
              .delaytime(0.25)
              .delayfeedback(0.22)
              .lpf(2200)
              .slow(4)
          )
          .cpm(92)
    }
  },
  cues: {
    "weapon-pistol-shot": {
      label: "Semiautomatic pistol shot",
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
    },
    "weapon-reload": {
      label: "Weapon reload",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          460,
          0.1,
          "triangle",
          0.05,
          320
        );
        schedulePulse(
          browserContext,
          destinationBus,
          now + 0.08,
          420,
          0.14,
          "triangle",
          0.04,
          220
        );
      }
    },
    "enemy-hit": {
      label: "Enemy hit",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          180,
          0.08,
          "square",
          0.06,
          120
        );
        schedulePulse(
          browserContext,
          destinationBus,
          now + 0.045,
          260,
          0.07,
          "triangle",
          0.035,
          180
        );
      }
    },
    "enemy-scatter": {
      label: "Enemy scatter",
      play({ context, sfxBus }) {
        const browserContext = context as AudioContext;
        const destinationBus = sfxBus as GainNode;
        const now = browserContext.currentTime + 0.01;

        schedulePulse(
          browserContext,
          destinationBus,
          now,
          280,
          0.08,
          "sawtooth",
          0.03,
          520
        );
        schedulePulse(
          browserContext,
          destinationBus,
          now + 0.06,
          360,
          0.08,
          "sawtooth",
          0.025,
          660
        );
      }
    }
  }
} as const satisfies AudioContentCatalog<
  typeof duckHuntBackgroundTrackId,
  DuckHuntAudioCueId
>;

export function resolveDuckHuntGameplaySignalCue(
  signal: GameplaySignal
): DuckHuntAudioCueId | null {
  switch (signal.type) {
    case "enemy-hit-confirmed":
      return "enemy-hit";
    case "weapon-fired":
      return signal.weaponId === "semiautomatic-pistol"
        ? "weapon-pistol-shot"
        : null;
    case "weapon-reloaded":
      return "weapon-reload";
  }
}
