import type { AudioCueId, AudioTrackId } from "./audio-foundation";

export interface AudioBusGainLike {
  value: number;
}

export interface AudioBusNodeLike {
  readonly gain: AudioBusGainLike;
  connect(target: AudioBusNodeLike | AudioDestinationNodeLike): void;
}

export interface AudioDestinationNodeLike {}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioDestinationNodeLike;
  readonly state: string;
  resume(): Promise<void>;
}

export interface BackgroundMusicEngineLike {
  playTrack(trackId: AudioTrackId): void;
  stop(): void;
}

export interface BrowserAudioSessionDependencies {
  createAudioContext: () => AudioContextLike | null;
  createGainBus: (
    context: AudioContextLike,
    initialGain: number
  ) => AudioBusNodeLike;
  initializeBackgroundMusic: (input: {
    readonly context: AudioContextLike;
    readonly musicBus: AudioBusNodeLike;
  }) => Promise<BackgroundMusicEngineLike>;
  playCue: (input: {
    readonly context: AudioContextLike;
    readonly cueId: AudioCueId;
    readonly sfxBus: AudioBusNodeLike;
  }) => void;
}
