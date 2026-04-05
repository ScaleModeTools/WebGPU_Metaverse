import type { AudioMixSnapshot } from "@thumbshooter/shared";

import { audioFoundationConfig } from "../config/audio-foundation";
import { buildBackgroundMusicTrack } from "../config/background-music-tracks";
import type { AudioCueId, AudioTrackId } from "../types/audio-foundation";
import type {
  AudioBusNodeLike,
  AudioContextLike,
  BackgroundMusicEngineLike,
  BrowserAudioSessionDependencies
} from "../types/audio-session-runtime";
import type { AudioSessionSnapshot } from "../types/audio-session";

interface WindowWithWebkitAudioContext extends Window {
  readonly webkitAudioContext?: typeof AudioContext;
}

function freezeAudioSessionSnapshot(
  snapshot: AudioSessionSnapshot
): AudioSessionSnapshot {
  return Object.freeze({
    backgroundTrackId: snapshot.backgroundTrackId,
    unlockState: snapshot.unlockState,
    backgroundMusicState: snapshot.backgroundMusicState,
    mix: Object.freeze({
      musicVolume: snapshot.mix.musicVolume,
      sfxVolume: snapshot.mix.sfxVolume
    }),
    lastCueId: snapshot.lastCueId,
    failureReason: snapshot.failureReason
  });
}

function createInitialSnapshot(): AudioSessionSnapshot {
  return freezeAudioSessionSnapshot({
    backgroundTrackId: audioFoundationConfig.music.shellTrack,
    unlockState: "locked",
    backgroundMusicState: "idle",
    mix: audioFoundationConfig.defaultMix,
    lastCueId: null,
    failureReason: null
  });
}

function createBrowserAudioContext(): AudioContext | null {
  const browserWindow = window as WindowWithWebkitAudioContext;
  const AudioContextConstructor =
    globalThis.AudioContext ?? browserWindow.webkitAudioContext;

  if (AudioContextConstructor === undefined) {
    return null;
  }

  return new AudioContextConstructor();
}

function createGainBus(
  context: AudioContextLike,
  initialGain: number
): AudioBusNodeLike {
  return new GainNode(context as AudioContext, {
    gain: initialGain
  });
}

function schedulePulse(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  frequency: number,
  durationSeconds: number,
  type: OscillatorType,
  peakGain: number,
  sweepTargetFrequency?: number
): void {
  const oscillator = new OscillatorNode(context, {
    frequency,
    type
  });
  const envelope = new GainNode(context, {
    gain: 0.0001
  });

  oscillator.connect(envelope);
  envelope.connect(destination);

  envelope.gain.setValueAtTime(0.0001, startTime);
  envelope.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + durationSeconds
  );

  if (sweepTargetFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      sweepTargetFrequency,
      startTime + durationSeconds
    );
  }

  oscillator.start(startTime);
  oscillator.stop(startTime + durationSeconds + 0.03);
}

function playBrowserCue({
  context,
  cueId,
  sfxBus
}: {
  readonly context: AudioContextLike;
  readonly cueId: AudioCueId;
  readonly sfxBus: AudioBusNodeLike;
}): void {
  const browserContext = context as AudioContext;
  const destinationBus = sfxBus as GainNode;
  const now = browserContext.currentTime + 0.01;

  switch (cueId) {
    case "ui-confirm":
      schedulePulse(browserContext, destinationBus, now, 660, 0.12, "triangle", 0.09, 990);
      break;
    case "ui-menu-open":
      schedulePulse(browserContext, destinationBus, now, 330, 0.14, "sawtooth", 0.06, 660);
      schedulePulse(browserContext, destinationBus, now + 0.05, 660, 0.11, "triangle", 0.04);
      break;
    case "ui-menu-close":
      schedulePulse(browserContext, destinationBus, now, 740, 0.16, "triangle", 0.05, 280);
      break;
    case "calibration-shot":
    case "weapon-pistol-shot":
      schedulePulse(browserContext, destinationBus, now, 240, 0.08, "square", 0.12, 95);
      break;
    case "weapon-reload":
      schedulePulse(browserContext, destinationBus, now, 460, 0.1, "triangle", 0.05, 320);
      schedulePulse(browserContext, destinationBus, now + 0.08, 420, 0.14, "triangle", 0.04, 220);
      break;
    case "enemy-hit":
      schedulePulse(browserContext, destinationBus, now, 180, 0.09, "square", 0.05, 120);
      break;
    case "enemy-scatter":
      schedulePulse(browserContext, destinationBus, now, 280, 0.1, "sawtooth", 0.04, 520);
      schedulePulse(browserContext, destinationBus, now + 0.06, 360, 0.1, "sawtooth", 0.03, 660);
      break;
  }
}

async function initializeBrowserBackgroundMusic(
  {
    context,
    musicBus
  }: {
    readonly context: AudioContextLike;
    readonly musicBus: AudioBusNodeLike;
  }
): Promise<BackgroundMusicEngineLike> {
  const module = await import("@strudel/web/web.mjs");

  await module.initStrudel({
    audioContext: context as AudioContext
  });

  const outputNode = module.getSuperdoughAudioController().output?.destinationGain;

  if (outputNode === null || outputNode === undefined) {
    throw new Error("Strudel did not expose a routable background music output.");
  }

  outputNode.disconnect();
  outputNode.connect(musicBus);

  return {
    playTrack(trackId: AudioTrackId) {
      module.hush();
      buildBackgroundMusicTrack(trackId, module).play();
    },
    stop() {
      module.hush();
    }
  };
}

const defaultBrowserAudioSessionDependencies: BrowserAudioSessionDependencies = {
  createAudioContext: createBrowserAudioContext,
  createGainBus,
  initializeBackgroundMusic: initializeBrowserBackgroundMusic,
  playCue: playBrowserCue
};

export class BrowserAudioSession {
  #audioContext: AudioContextLike | null = null;
  #backgroundMusicEngine: BackgroundMusicEngineLike | null = null;
  #masterGain: AudioBusNodeLike | null = null;
  #musicGain: AudioBusNodeLike | null = null;
  #playingTrackId: AudioTrackId | null = null;
  #sfxGain: AudioBusNodeLike | null = null;
  #snapshot = createInitialSnapshot();
  #unlockPromise: Promise<AudioSessionSnapshot> | null = null;
  #strudelPrimePromise: Promise<void> | null = null;
  readonly #dependencies: BrowserAudioSessionDependencies;

  constructor(
    dependencies: BrowserAudioSessionDependencies = defaultBrowserAudioSessionDependencies
  ) {
    this.#dependencies = dependencies;
  }

  get snapshot(): AudioSessionSnapshot {
    return this.#snapshot;
  }

  syncBackgroundTrack(trackId: AudioTrackId | null): AudioSessionSnapshot {
    this.#snapshot = freezeAudioSessionSnapshot({
      ...this.#snapshot,
      backgroundTrackId: trackId
    });

    return this.#syncBackgroundTrackPlayback();
  }

  syncMix(mix: AudioMixSnapshot): AudioSessionSnapshot {
    if (this.#musicGain !== null) {
      this.#musicGain.gain.value = Number(mix.musicVolume);
    }

    if (this.#sfxGain !== null) {
      this.#sfxGain.gain.value = Number(mix.sfxVolume);
    }

    this.#snapshot = freezeAudioSessionSnapshot({
      ...this.#snapshot,
      mix
    });

    return this.#snapshot;
  }

  async unlock(): Promise<AudioSessionSnapshot> {
    if (this.#snapshot.unlockState === "unlocked") {
      return this.#snapshot;
    }

    if (this.#unlockPromise !== null) {
      return this.#unlockPromise;
    }

    this.#unlockPromise = this.#unlockInternal();
    return this.#unlockPromise;
  }

  playCue(cueId: AudioCueId): AudioSessionSnapshot {
    if (
      this.#audioContext === null ||
      this.#sfxGain === null ||
      this.#audioContext.state !== "running"
    ) {
      return this.#snapshot;
    }

    this.#dependencies.playCue({
      context: this.#audioContext,
      cueId,
      sfxBus: this.#sfxGain
    });

    this.#snapshot = freezeAudioSessionSnapshot({
      ...this.#snapshot,
      lastCueId: cueId
    });

    return this.#snapshot;
  }

  async #unlockInternal(): Promise<AudioSessionSnapshot> {
    this.#snapshot = freezeAudioSessionSnapshot({
      ...this.#snapshot,
      unlockState: "unlocking",
      failureReason: null
    });

    const audioContext = this.#ensureAudioGraph();

    if (audioContext === null) {
      this.#snapshot = freezeAudioSessionSnapshot({
        ...this.#snapshot,
        unlockState: "unsupported",
        failureReason: "AudioContext is unavailable in this browser."
      });
      this.#unlockPromise = null;
      return this.#snapshot;
    }

    try {
      await audioContext.resume();
      await this.#primeBackgroundMusicEngine(audioContext);

      this.#snapshot = freezeAudioSessionSnapshot({
        ...this.#snapshot,
        unlockState: "unlocked",
        failureReason:
          this.#snapshot.backgroundMusicState === "failed"
            ? this.#snapshot.failureReason
            : null
      });
      this.#syncBackgroundTrackPlayback();
      this.#unlockPromise = null;
      return this.#snapshot;
    } catch (error) {
      this.#snapshot = freezeAudioSessionSnapshot({
        ...this.#snapshot,
        unlockState: "failed",
        backgroundMusicState: "failed",
        failureReason:
          error instanceof Error
            ? error.message
            : "Audio unlock failed unexpectedly."
      });
      this.#unlockPromise = null;
      return this.#snapshot;
    }
  }

  #ensureAudioGraph(): AudioContextLike | null {
    if (this.#audioContext !== null) {
      return this.#audioContext;
    }

    const audioContext = this.#dependencies.createAudioContext();

    if (audioContext === null) {
      return null;
    }

    this.#audioContext = audioContext;
    this.#masterGain = this.#dependencies.createGainBus(audioContext, 0.95);
    this.#musicGain = this.#dependencies.createGainBus(
      audioContext,
      Number(this.#snapshot.mix.musicVolume)
    );
    this.#sfxGain = this.#dependencies.createGainBus(
      audioContext,
      Number(this.#snapshot.mix.sfxVolume)
    );

    this.#musicGain.connect(this.#masterGain);
    this.#sfxGain.connect(this.#masterGain);
    this.#masterGain.connect(audioContext.destination);

    return audioContext;
  }

  async #primeBackgroundMusicEngine(audioContext: AudioContextLike): Promise<void> {
    if (this.#musicGain === null) {
      throw new Error("The shared music bus was unavailable during audio boot.");
    }

    if (this.#strudelPrimePromise !== null) {
      return this.#strudelPrimePromise;
    }

    this.#snapshot = freezeAudioSessionSnapshot({
      ...this.#snapshot,
      backgroundMusicState: "priming",
      failureReason: null
    });

    this.#strudelPrimePromise = this.#dependencies
      .initializeBackgroundMusic({
        context: audioContext,
        musicBus: this.#musicGain
      })
      .then((backgroundMusicEngine) => {
        this.#backgroundMusicEngine = backgroundMusicEngine;
        this.#snapshot = freezeAudioSessionSnapshot({
          ...this.#snapshot,
          backgroundMusicState: "primed"
        });
      })
      .catch((error: unknown) => {
        this.#snapshot = freezeAudioSessionSnapshot({
          ...this.#snapshot,
          backgroundMusicState: "failed",
          failureReason:
            error instanceof Error
              ? error.message
              : "Unable to initialize the background music engine."
        });
      });

    return this.#strudelPrimePromise;
  }

  #syncBackgroundTrackPlayback(): AudioSessionSnapshot {
    if (
      this.#snapshot.unlockState !== "unlocked" ||
      this.#backgroundMusicEngine === null
    ) {
      return this.#snapshot;
    }

    if (this.#snapshot.backgroundTrackId === null) {
      if (this.#playingTrackId === null) {
        return this.#snapshot;
      }

      this.#backgroundMusicEngine.stop();
      this.#playingTrackId = null;
      return this.#snapshot;
    }

    if (this.#playingTrackId === this.#snapshot.backgroundTrackId) {
      return this.#snapshot;
    }

    try {
      this.#backgroundMusicEngine.playTrack(this.#snapshot.backgroundTrackId);
      this.#playingTrackId = this.#snapshot.backgroundTrackId;
      this.#snapshot = freezeAudioSessionSnapshot({
        ...this.#snapshot,
        backgroundMusicState: "primed",
        failureReason: null
      });
    } catch (error) {
      this.#playingTrackId = null;
      this.#snapshot = freezeAudioSessionSnapshot({
        ...this.#snapshot,
        backgroundMusicState: "failed",
        failureReason:
          error instanceof Error
            ? error.message
            : "Unable to switch the background music track."
      });
    }

    return this.#snapshot;
  }
}
