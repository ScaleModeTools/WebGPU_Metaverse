import type {
  AudioContentCatalog,
  BrowserAudioSession,
  BrowserAudioSessionConfig
} from "../../audio";
import { audioFoundationConfig } from "../../audio";
import {
  duckHuntAudioContentCatalog,
  duckHuntAudioCueIds,
  duckHuntBackgroundTrackId
} from "../../experiences/duck-hunt/audio";
import {
  metaverseCombatAudioContentCatalog,
  metaverseCombatAudioCueIds
} from "../../metaverse/audio";

import {
  metaverseShellAudioContentCatalog,
  metaverseShellAudioCueIds,
  metaverseShellBackgroundTrackId
} from "./metaverse-shell-audio-content";

export const metaverseAudioTrackIds = [
  metaverseShellBackgroundTrackId,
  duckHuntBackgroundTrackId
] as const;

export const metaverseAudioCueIds = [
  ...metaverseShellAudioCueIds,
  ...metaverseCombatAudioCueIds,
  ...duckHuntAudioCueIds
] as const;

export type MetaverseAudioTrackId =
  (typeof metaverseAudioTrackIds)[number];
export type MetaverseAudioCueId = (typeof metaverseAudioCueIds)[number];
export type MetaverseAudioSession = BrowserAudioSession<
  MetaverseAudioTrackId,
  MetaverseAudioCueId
>;

export const metaverseAudioContentCatalog = {
  backgroundTracks: {
    ...metaverseShellAudioContentCatalog.backgroundTracks,
    ...metaverseCombatAudioContentCatalog.backgroundTracks,
    ...duckHuntAudioContentCatalog.backgroundTracks
  },
  cues: {
    ...metaverseShellAudioContentCatalog.cues,
    ...metaverseCombatAudioContentCatalog.cues,
    ...duckHuntAudioContentCatalog.cues
  }
} as const satisfies AudioContentCatalog<
  MetaverseAudioTrackId,
  MetaverseAudioCueId
>;

export const metaverseAudioSessionConfig = {
  contentCatalog: metaverseAudioContentCatalog,
  foundation: audioFoundationConfig,
  initialBackgroundTrackId: metaverseShellBackgroundTrackId
} as const satisfies BrowserAudioSessionConfig<
  MetaverseAudioTrackId,
  MetaverseAudioCueId
>;
