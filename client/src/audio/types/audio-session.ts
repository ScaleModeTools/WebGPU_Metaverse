import type { AudioMixSnapshot } from "@thumbshooter/shared";

export const audioSessionUnlockStates = [
  "locked",
  "unlocking",
  "unlocked",
  "unsupported",
  "failed"
] as const;
export const backgroundMusicRuntimeStates = [
  "idle",
  "priming",
  "primed",
  "failed"
] as const;

export type AudioSessionUnlockState = (typeof audioSessionUnlockStates)[number];
export type BackgroundMusicRuntimeState =
  (typeof backgroundMusicRuntimeStates)[number];

export interface AudioSessionSnapshot<
  TrackId extends string = string,
  CueId extends string = string
> {
  readonly backgroundTrackId: TrackId | null;
  readonly unlockState: AudioSessionUnlockState;
  readonly backgroundMusicState: BackgroundMusicRuntimeState;
  readonly mix: AudioMixSnapshot;
  readonly lastCueId: CueId | null;
  readonly failureReason: string | null;
}
