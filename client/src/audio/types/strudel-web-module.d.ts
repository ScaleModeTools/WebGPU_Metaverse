declare module "@strudel/web/web.mjs" {
  export function getSuperdoughAudioController(): import("./strudel-runtime").StrudelSuperdoughControllerLike;
  export function hush(): void;
  export function initStrudel(options?: {
    audioContext?: AudioContext;
  }): Promise<void>;
  export function note(
    value: string
  ): import("./strudel-runtime").StrudelPatternLike;
  export function stack(
    ...patterns: import("./strudel-runtime").StrudelPatternLike[]
  ): import("./strudel-runtime").StrudelPatternLike;
}
