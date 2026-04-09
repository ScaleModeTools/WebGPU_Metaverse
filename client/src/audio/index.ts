export { audioFoundationConfig } from "./config/audio-foundation";
export { BrowserAudioSession } from "./classes/browser-audio-session";
export {
  initializeCatalogBackedBackgroundMusic,
  playCatalogCue,
  schedulePulse
} from "./services/procedural-browser-audio";
export {
  audioSessionUnlockStates,
  backgroundMusicRuntimeStates
} from "./types/audio-session";
export type {
  AudioContentCatalog,
  AudioCueCatalog,
  AudioCueDefinition,
  BackgroundMusicTrackCatalog,
  BackgroundMusicTrackDefinition
} from "./types/audio-catalog";
export type {
  AudioFoundationConfig
} from "./types/audio-foundation";
export type {
  AudioBusNodeLike,
  AudioContextLike,
  BrowserAudioSessionDependencies
} from "./types/audio-session-runtime";
export type {
  BrowserAudioSessionConfig
} from "./classes/browser-audio-session";
export type {
  AudioSessionSnapshot,
  AudioSessionUnlockState,
  BackgroundMusicRuntimeState
} from "./types/audio-session";
