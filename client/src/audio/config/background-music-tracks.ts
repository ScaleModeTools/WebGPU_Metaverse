import type { AudioTrackId } from "../types/audio-foundation";
import type {
  StrudelModuleLike,
  StrudelPatternLike
} from "../types/strudel-runtime";

interface BackgroundMusicTrackDefinition {
  readonly buildPattern: (strudel: StrudelModuleLike) => StrudelPatternLike;
  readonly label: string;
}

const backgroundMusicTrackCatalog = {
  "shell-attract-loop": {
    label: "Shell attract loop",
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
  },
  "birds-arena-loop": {
    label: "Birds arena loop",
    buildPattern: (strudel) =>
      strudel
        .stack(
          strudel
            .note("<[e3 ~ g3 ~ a3 ~ g3 ~] [e3 ~ a3 ~ b3 ~ a3 ~]>")
            .s("square")
            .gain(0.1)
            .decay(0.14)
            .sustain(0.12)
            .release(0.18)
            .lpf(1900),
          strudel
            .note("<[~ b4 ~ ~ g4 ~ ~ ~] [~ a4 ~ ~ e4 ~ ~ ~]>")
            .s("triangle")
            .gain(0.04)
            .delay(0.24)
            .delaytime(0.375)
            .delayfeedback(0.32)
            .room(0.28)
            .lpf(2100)
            .slow(2),
          strudel
            .note("<[e2 ~ e2 ~ a1 ~ a1 ~] [d2 ~ d2 ~ b1 ~ b1 ~]>")
            .s("triangle")
            .gain(0.12)
            .lpf(420)
            .room(0.14),
          strudel
            .note("~ ~ e5? ~ ~ ~ g5? ~")
            .s("sine")
            .gain(0.03)
            .release(0.45)
            .pan(0.65)
            .delay(0.18)
            .delaytime(0.25)
            .delayfeedback(0.22)
            .lpf(2500)
            .slow(4)
        )
        .cpm(96)
  }
} as const satisfies Record<AudioTrackId, BackgroundMusicTrackDefinition>;

export function buildBackgroundMusicTrack(
  trackId: AudioTrackId,
  strudel: StrudelModuleLike
): StrudelPatternLike {
  return backgroundMusicTrackCatalog[trackId].buildPattern(strudel);
}
