import type {
  AudioCueCatalog,
  BackgroundMusicTrackCatalog
} from "../types/audio-catalog";
import type {
  AudioBusNodeLike,
  AudioContextLike,
  BackgroundMusicEngineLike
} from "../types/audio-session-runtime";

function readCueDefinition<CueId extends string>(
  cueCatalog: AudioCueCatalog<CueId>,
  cueId: CueId
) {
  const cueDefinition = cueCatalog[cueId];

  if (cueDefinition === undefined) {
    throw new Error(`Unknown audio cue id: ${cueId}`);
  }

  return cueDefinition;
}

function readTrackDefinition<TrackId extends string>(
  backgroundTracks: BackgroundMusicTrackCatalog<TrackId>,
  trackId: TrackId
) {
  const trackDefinition = backgroundTracks[trackId];

  if (trackDefinition === undefined) {
    throw new Error(`Unknown background track id: ${trackId}`);
  }

  return trackDefinition;
}

export function schedulePulse(
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

export async function initializeCatalogBackedBackgroundMusic<
  TrackId extends string
>({
  backgroundTracks,
  context,
  musicBus
}: {
  readonly backgroundTracks: BackgroundMusicTrackCatalog<TrackId>;
  readonly context: AudioContextLike;
  readonly musicBus: AudioBusNodeLike;
}): Promise<BackgroundMusicEngineLike<TrackId>> {
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
    playTrack(trackId: TrackId) {
      module.hush();
      readTrackDefinition(backgroundTracks, trackId).buildPattern(module).play();
    },
    stop() {
      module.hush();
    }
  };
}

export function playCatalogCue<CueId extends string>({
  context,
  cueCatalog,
  cueId,
  sfxBus
}: {
  readonly context: AudioContextLike;
  readonly cueCatalog: AudioCueCatalog<CueId>;
  readonly cueId: CueId;
  readonly sfxBus: AudioBusNodeLike;
}): void {
  readCueDefinition(cueCatalog, cueId).play({
    context,
    sfxBus
  });
}
