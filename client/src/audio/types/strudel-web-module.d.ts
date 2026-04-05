declare module "@strudel/web/web.mjs" {
  export function initStrudel(options?: {
    audioContext?: AudioContext;
  }): Promise<unknown>;
}
