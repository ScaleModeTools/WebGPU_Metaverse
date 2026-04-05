import type { AudioBusNodeLike } from "./audio-session-runtime";

export interface StrudelPatternLike {
  attack(value: number): StrudelPatternLike;
  cpm(value: number): StrudelPatternLike;
  decay(value: number): StrudelPatternLike;
  delay(value: number): StrudelPatternLike;
  delayfeedback(value: number): StrudelPatternLike;
  delaytime(value: number): StrudelPatternLike;
  gain(value: number): StrudelPatternLike;
  lpf(value: number | string): StrudelPatternLike;
  pan(value: number): StrudelPatternLike;
  play(): void;
  release(value: number): StrudelPatternLike;
  room(value: number): StrudelPatternLike;
  roomsize(value: number): StrudelPatternLike;
  s(value: string): StrudelPatternLike;
  slow(value: number): StrudelPatternLike;
  sustain(value: number): StrudelPatternLike;
}

export interface StrudelDestinationNodeLike {
  connect(target: AudioBusNodeLike | AudioNode): void;
  disconnect(): void;
}

export interface StrudelSuperdoughControllerLike {
  readonly output: {
    readonly destinationGain: StrudelDestinationNodeLike | null;
  } | null;
}

export interface StrudelModuleLike {
  readonly getSuperdoughAudioController: () => StrudelSuperdoughControllerLike;
  readonly hush: () => void;
  readonly initStrudel: (options?: { audioContext?: AudioContext }) => Promise<void>;
  readonly note: (value: string) => StrudelPatternLike;
  readonly stack: (...patterns: StrudelPatternLike[]) => StrudelPatternLike;
}
