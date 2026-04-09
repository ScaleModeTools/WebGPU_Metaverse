import type { AudioMixSnapshot } from "@thumbshooter/shared";

import {
  initializeCatalogBackedBackgroundMusic,
  playCatalogCue
} from "../services/procedural-browser-audio";
import type { AudioContentCatalog } from "../types/audio-catalog";
import type { AudioFoundationConfig } from "../types/audio-foundation";
import type {
  AudioBusNodeLike,
  AudioContextLike,
  BackgroundMusicEngineLike,
  BrowserAudioSessionDependencies
} from "../types/audio-session-runtime";
import type { AudioSessionSnapshot } from "../types/audio-session";

export interface BrowserAudioSessionConfig<
  TrackId extends string = string,
  CueId extends string = string
> {
  readonly contentCatalog: AudioContentCatalog<TrackId, CueId>;
  readonly foundation: AudioFoundationConfig;
  readonly initialBackgroundTrackId: TrackId | null;
}

interface WindowWithWebkitAudioContext extends Window {
  readonly webkitAudioContext?: typeof AudioContext;
}

function freezeAudioSessionSnapshot<
  TrackId extends string,
  CueId extends string
>(
  snapshot: AudioSessionSnapshot<TrackId, CueId>
): AudioSessionSnapshot<TrackId, CueId> {
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

function createInitialSnapshot<TrackId extends string, CueId extends string>(
  config: BrowserAudioSessionConfig<TrackId, CueId>
): AudioSessionSnapshot<TrackId, CueId> {
  return freezeAudioSessionSnapshot<TrackId, CueId>({
    backgroundTrackId: config.initialBackgroundTrackId,
    unlockState: "locked",
    backgroundMusicState: "idle",
    mix: config.foundation.defaultMix,
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

function createDefaultBrowserAudioSessionDependencies<
  TrackId extends string,
  CueId extends string
>(
  contentCatalog: AudioContentCatalog<TrackId, CueId>
): BrowserAudioSessionDependencies<TrackId, CueId> {
  return {
    createAudioContext: createBrowserAudioContext,
    createGainBus,
    initializeBackgroundMusic({ context, musicBus }) {
      return initializeCatalogBackedBackgroundMusic({
        backgroundTracks: contentCatalog.backgroundTracks,
        context,
        musicBus
      });
    },
    playCue({ context, cueId, sfxBus }) {
      playCatalogCue({
        context,
        cueCatalog: contentCatalog.cues,
        cueId,
        sfxBus
      });
    }
  };
}

export class BrowserAudioSession<
  TrackId extends string = string,
  CueId extends string = string
> {
  #audioContext: AudioContextLike | null = null;
  #backgroundMusicEngine: BackgroundMusicEngineLike<TrackId> | null = null;
  #masterGain: AudioBusNodeLike | null = null;
  #musicGain: AudioBusNodeLike | null = null;
  #playingTrackId: TrackId | null = null;
  #sfxGain: AudioBusNodeLike | null = null;
  #snapshot: AudioSessionSnapshot<TrackId, CueId>;
  #unlockPromise: Promise<AudioSessionSnapshot<TrackId, CueId>> | null = null;
  #strudelPrimePromise: Promise<void> | null = null;
  readonly #dependencies: BrowserAudioSessionDependencies<TrackId, CueId>;

  constructor(
    config: BrowserAudioSessionConfig<TrackId, CueId>,
    dependencies: BrowserAudioSessionDependencies<TrackId, CueId> =
      createDefaultBrowserAudioSessionDependencies(config.contentCatalog)
  ) {
    this.#dependencies = dependencies;
    this.#snapshot = createInitialSnapshot(config);
  }

  get snapshot(): AudioSessionSnapshot<TrackId, CueId> {
    return this.#snapshot;
  }

  syncBackgroundTrack(
    trackId: TrackId | null
  ): AudioSessionSnapshot<TrackId, CueId> {
    this.#snapshot = freezeAudioSessionSnapshot({
      ...this.#snapshot,
      backgroundTrackId: trackId
    });

    return this.#syncBackgroundTrackPlayback();
  }

  syncMix(mix: AudioMixSnapshot): AudioSessionSnapshot<TrackId, CueId> {
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

  async unlock(): Promise<AudioSessionSnapshot<TrackId, CueId>> {
    if (this.#snapshot.unlockState === "unlocked") {
      return this.#snapshot;
    }

    if (this.#unlockPromise !== null) {
      return this.#unlockPromise;
    }

    this.#unlockPromise = this.#unlockInternal();
    return this.#unlockPromise;
  }

  playCue(cueId: CueId): AudioSessionSnapshot<TrackId, CueId> {
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

  async #unlockInternal(): Promise<AudioSessionSnapshot<TrackId, CueId>> {
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

  #syncBackgroundTrackPlayback(): AudioSessionSnapshot<TrackId, CueId> {
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
