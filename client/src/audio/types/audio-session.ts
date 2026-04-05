import type { AudioMixSnapshot } from "@thumbshooter/shared";

import type { AudioCueId } from "./audio-foundation";

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

export interface AudioSessionSnapshot {
  readonly unlockState: AudioSessionUnlockState;
  readonly backgroundMusicState: BackgroundMusicRuntimeState;
  readonly mix: AudioMixSnapshot;
  readonly lastCueId: AudioCueId | null;
  readonly failureReason: string | null;
}
