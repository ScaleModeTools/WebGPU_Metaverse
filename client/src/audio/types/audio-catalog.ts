import type {
  AudioBusNodeLike,
  AudioContextLike
} from "./audio-session-runtime";
import type {
  StrudelModuleLike,
  StrudelPatternLike
} from "./strudel-runtime";

export interface BackgroundMusicTrackDefinition {
  readonly buildPattern: (strudel: StrudelModuleLike) => StrudelPatternLike;
  readonly label: string;
}

export type BackgroundMusicTrackCatalog<TrackId extends string> = Readonly<
  Record<TrackId, BackgroundMusicTrackDefinition>
>;

export interface AudioCueVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AudioCueListenerSnapshot {
  readonly forward: AudioCueVector3Snapshot;
  readonly position: AudioCueVector3Snapshot;
  readonly up: AudioCueVector3Snapshot;
}

export interface AudioCueSpatialSnapshot {
  readonly listener: AudioCueListenerSnapshot;
  readonly maxDistanceMeters?: number;
  readonly position: AudioCueVector3Snapshot;
  readonly refDistanceMeters?: number;
  readonly rolloffFactor?: number;
}

export interface AudioCuePlaybackOptions {
  readonly spatial?: AudioCueSpatialSnapshot | null;
}

export interface AudioCueDefinition {
  readonly label: string;
  play(input: {
    readonly context: AudioContextLike;
    readonly options?: AudioCuePlaybackOptions;
    readonly sfxBus: AudioBusNodeLike;
  }): void;
}

export type AudioCueCatalog<CueId extends string> = Readonly<
  Record<CueId, AudioCueDefinition>
>;

export interface AudioContentCatalog<
  TrackId extends string,
  CueId extends string
> {
  readonly backgroundTracks: BackgroundMusicTrackCatalog<TrackId>;
  readonly cues: AudioCueCatalog<CueId>;
}
