import type {
  AudioCueCatalog,
  AudioCuePlaybackOptions,
  AudioCueSpatialSnapshot,
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

export function scheduleNoiseBurst(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  durationSeconds: number,
  peakGain: number,
  filterFrequency: number,
  filterType: BiquadFilterType = "bandpass"
): void {
  const sampleCount = Math.max(
    1,
    Math.ceil(context.sampleRate * durationSeconds)
  );
  const noiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);

  for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
    channel[sampleIndex] = Math.random() * 2 - 1;
  }

  const source = new AudioBufferSourceNode(context, {
    buffer: noiseBuffer
  });
  const filter = new BiquadFilterNode(context, {
    frequency: filterFrequency,
    type: filterType
  });
  const envelope = new GainNode(context, {
    gain: 0.0001
  });

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);

  envelope.gain.setValueAtTime(0.0001, startTime);
  envelope.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.006);
  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + durationSeconds
  );

  source.start(startTime);
  source.stop(startTime + durationSeconds + 0.03);
}

function setAudioParamValue(
  param: AudioParam | undefined,
  value: number,
  time: number
): boolean {
  if (param === undefined) {
    return false;
  }

  param.setValueAtTime(value, time);
  return true;
}

function syncListenerPosition(
  listener: AudioListener,
  spatial: AudioCueSpatialSnapshot,
  time: number
): void {
  const listenerWithAutomation = listener as AudioListener & {
    readonly forwardX?: AudioParam;
    readonly forwardY?: AudioParam;
    readonly forwardZ?: AudioParam;
    readonly positionX?: AudioParam;
    readonly positionY?: AudioParam;
    readonly positionZ?: AudioParam;
    readonly upX?: AudioParam;
    readonly upY?: AudioParam;
    readonly upZ?: AudioParam;
  };
  const wrotePosition =
    setAudioParamValue(
      listenerWithAutomation.positionX,
      spatial.listener.position.x,
      time
    ) &&
    setAudioParamValue(
      listenerWithAutomation.positionY,
      spatial.listener.position.y,
      time
    ) &&
    setAudioParamValue(
      listenerWithAutomation.positionZ,
      spatial.listener.position.z,
      time
    );
  const wroteOrientation =
    setAudioParamValue(
      listenerWithAutomation.forwardX,
      spatial.listener.forward.x,
      time
    ) &&
    setAudioParamValue(
      listenerWithAutomation.forwardY,
      spatial.listener.forward.y,
      time
    ) &&
    setAudioParamValue(
      listenerWithAutomation.forwardZ,
      spatial.listener.forward.z,
      time
    ) &&
    setAudioParamValue(listenerWithAutomation.upX, spatial.listener.up.x, time) &&
    setAudioParamValue(listenerWithAutomation.upY, spatial.listener.up.y, time) &&
    setAudioParamValue(listenerWithAutomation.upZ, spatial.listener.up.z, time);
  const legacyListener = listener as AudioListener & {
    setOrientation?(
      forwardX: number,
      forwardY: number,
      forwardZ: number,
      upX: number,
      upY: number,
      upZ: number
    ): void;
    setPosition?(x: number, y: number, z: number): void;
  };

  if (!wrotePosition) {
    legacyListener.setPosition?.(
      spatial.listener.position.x,
      spatial.listener.position.y,
      spatial.listener.position.z
    );
  }

  if (!wroteOrientation) {
    legacyListener.setOrientation?.(
      spatial.listener.forward.x,
      spatial.listener.forward.y,
      spatial.listener.forward.z,
      spatial.listener.up.x,
      spatial.listener.up.y,
      spatial.listener.up.z
    );
  }
}

function normalizePositiveFiniteNumber(
  value: number | undefined,
  fallback: number
): number {
  if (!Number.isFinite(value ?? fallback)) {
    return fallback;
  }

  return Math.max(0.001, value ?? fallback);
}

export function createAudioCueDestination({
  context,
  options,
  sfxBus
}: {
  readonly context: AudioContextLike;
  readonly options?: AudioCuePlaybackOptions;
  readonly sfxBus: AudioBusNodeLike;
}): AudioNode {
  const destinationBus = sfxBus as GainNode;
  const spatial = options?.spatial ?? null;

  if (spatial === null) {
    return destinationBus;
  }

  const browserContext = context as AudioContext;
  const now = browserContext.currentTime;

  syncListenerPosition(browserContext.listener, spatial, now);

  const panner = new PannerNode(browserContext, {
    distanceModel: "inverse",
    maxDistance: normalizePositiveFiniteNumber(
      spatial.maxDistanceMeters,
      72
    ),
    panningModel: "HRTF",
    refDistance: normalizePositiveFiniteNumber(
      spatial.refDistanceMeters,
      1.25
    ),
    rolloffFactor: normalizePositiveFiniteNumber(spatial.rolloffFactor, 1.2)
  });

  panner.positionX.setValueAtTime(spatial.position.x, now);
  panner.positionY.setValueAtTime(spatial.position.y, now);
  panner.positionZ.setValueAtTime(spatial.position.z, now);
  panner.connect(destinationBus);

  return panner;
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
  options,
  sfxBus
}: {
  readonly context: AudioContextLike;
  readonly cueCatalog: AudioCueCatalog<CueId>;
  readonly cueId: CueId;
  readonly options?: AudioCuePlaybackOptions;
  readonly sfxBus: AudioBusNodeLike;
}): void {
  readCueDefinition(cueCatalog, cueId).play({
    context,
    ...(options === undefined ? {} : { options }),
    sfxBus
  });
}
