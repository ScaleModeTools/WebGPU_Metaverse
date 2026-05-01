import type { AudioContentCatalog } from "../../audio";
import {
  createAudioCueDestination,
  scheduleNoiseBurst,
  schedulePulse
} from "../../audio";

export const metaverseCombatAudioCueIds = [
  "metaverse-pistol-shot",
  "metaverse-rocket-launch",
  "metaverse-weapon-reload",
  "metaverse-rocket-explosion",
  "metaverse-world-impact",
  "metaverse-armor-hit",
  "metaverse-respawn-countdown",
  "metaverse-respawn-countdown-ready",
  "metaverse-footstep-left",
  "metaverse-footstep-right"
] as const;

export type MetaverseCombatAudioCueId =
  (typeof metaverseCombatAudioCueIds)[number];

const metaverseRespawnCountdownFrequencyHz = 660;
const metaverseRespawnCountdownReadyFrequencyHz =
  metaverseRespawnCountdownFrequencyHz * 2 ** (7 / 12);

function scheduleRespawnCountdownBeep(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  frequencyHz: number
): void {
  schedulePulse(
    context,
    destination,
    startTime,
    frequencyHz,
    0.09,
    "sine",
    0.072
  );
  schedulePulse(
    context,
    destination,
    startTime + 0.006,
    frequencyHz * 2,
    0.055,
    "triangle",
    0.024
  );
}

export const metaverseCombatAudioContentCatalog = {
  backgroundTracks: {},
  cues: {
    "metaverse-pistol-shot": {
      label: "Metaverse pistol shot",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.032,
          0.24,
          3800,
          "highpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          92,
          0.13,
          "triangle",
          0.18,
          54
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.004,
          214,
          0.075,
          "square",
          0.12,
          118
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.009,
          1280,
          0.045,
          "sawtooth",
          0.052,
          470
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.018,
          0.105,
          0.075,
          720,
          "bandpass"
        );
      }
    },
    "metaverse-rocket-launch": {
      label: "Metaverse rocket launch",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.16,
          0.2,
          420,
          "lowpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          72,
          0.24,
          "sawtooth",
          0.18,
          38
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.035,
          138,
          0.18,
          "triangle",
          0.1,
          82
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.055,
          0.22,
          0.11,
          900,
          "bandpass"
        );
      }
    },
    "metaverse-weapon-reload": {
      label: "Metaverse weapon reload",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.006;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.028,
          0.052,
          1900,
          "highpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.012,
          320,
          0.052,
          "triangle",
          0.034,
          210
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.082,
          0.044,
          0.07,
          820,
          "bandpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.096,
          220,
          0.08,
          "triangle",
          0.052,
          130
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.18,
          0.032,
          0.058,
          2600,
          "highpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.188,
          540,
          0.048,
          "square",
          0.024,
          360
        );
      }
    },
    "metaverse-rocket-explosion": {
      label: "Metaverse rocket explosion",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.22,
          0.34,
          260,
          "lowpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          48,
          0.34,
          "triangle",
          0.28,
          26
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.018,
          96,
          0.16,
          "sawtooth",
          0.16,
          42
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.08,
          0.3,
          0.12,
          640,
          "bandpass"
        );
      }
    },
    "metaverse-world-impact": {
      label: "Metaverse world impact",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.006;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.06,
          0.075,
          560,
          "bandpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          118,
          0.08,
          "triangle",
          0.045,
          72
        );
      }
    },
    "metaverse-armor-hit": {
      label: "Metaverse armor hit",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.006;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.026,
          0.024,
          3200,
          "highpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          760,
          0.038,
          "triangle",
          0.026,
          560
        );
        schedulePulse(
          browserContext,
          destination,
          now + 0.012,
          1480,
          0.028,
          "sine",
          0.012,
          1060
        );
      }
    },
    "metaverse-respawn-countdown": {
      label: "Metaverse respawn countdown",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleRespawnCountdownBeep(
          browserContext,
          destination,
          now,
          metaverseRespawnCountdownFrequencyHz
        );
      }
    },
    "metaverse-respawn-countdown-ready": {
      label: "Metaverse respawn countdown ready",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleRespawnCountdownBeep(
          browserContext,
          destination,
          now,
          metaverseRespawnCountdownReadyFrequencyHz
        );
      }
    },
    "metaverse-footstep-left": {
      label: "Metaverse left footstep",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.044,
          0.36,
          460,
          "lowpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          74,
          0.058,
          "triangle",
          0.23,
          42
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.017,
          0.04,
          0.18,
          900,
          "bandpass"
        );
      }
    },
    "metaverse-footstep-right": {
      label: "Metaverse right footstep",
      play({ context, options, sfxBus }) {
        const browserContext = context as AudioContext;
        const destination = createAudioCueDestination({
          context,
          ...(options === undefined ? {} : { options }),
          sfxBus
        });
        const now = browserContext.currentTime + 0.004;

        scheduleNoiseBurst(
          browserContext,
          destination,
          now,
          0.042,
          0.34,
          520,
          "lowpass"
        );
        schedulePulse(
          browserContext,
          destination,
          now,
          84,
          0.054,
          "triangle",
          0.215,
          48
        );
        scheduleNoiseBurst(
          browserContext,
          destination,
          now + 0.018,
          0.038,
          0.17,
          1060,
          "bandpass"
        );
      }
    }
  }
} as const satisfies AudioContentCatalog<never, MetaverseCombatAudioCueId>;
