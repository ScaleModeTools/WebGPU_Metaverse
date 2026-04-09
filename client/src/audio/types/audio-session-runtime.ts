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

export interface BackgroundMusicEngineLike<TrackId extends string = string> {
  playTrack(trackId: TrackId): void;
  stop(): void;
}

export interface BrowserAudioSessionDependencies<
  TrackId extends string = string,
  CueId extends string = string
> {
  createAudioContext: () => AudioContextLike | null;
  createGainBus: (
    context: AudioContextLike,
    initialGain: number
  ) => AudioBusNodeLike;
  initializeBackgroundMusic: (input: {
    readonly context: AudioContextLike;
    readonly musicBus: AudioBusNodeLike;
  }) => Promise<BackgroundMusicEngineLike<TrackId>>;
  playCue: (input: {
    readonly context: AudioContextLike;
    readonly cueId: CueId;
    readonly sfxBus: AudioBusNodeLike;
  }) => void;
}
