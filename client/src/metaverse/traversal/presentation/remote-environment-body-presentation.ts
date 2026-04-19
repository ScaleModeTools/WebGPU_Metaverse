import type { MetaverseRealtimeEnvironmentBodySnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseRemoteEnvironmentBodyPresentationSnapshot } from "../../types/presentation";

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableRemoteEnvironmentBodyPresentationSnapshot {
  environmentAssetId: string;
  position: MutableVector3Snapshot;
  yawRadians: number;
}

export interface RemoteEnvironmentBodyPresentationAuthoritativeSample {
  readonly alpha: number;
  readonly baseEnvironmentBody: MetaverseRealtimeEnvironmentBodySnapshot;
  readonly deltaSeconds: number;
  readonly extrapolationSeconds: number;
  readonly nextEnvironmentBody: MetaverseRealtimeEnvironmentBodySnapshot | null;
  readonly sampleEpoch: number;
}

const remoteEnvironmentBodyPresentationInterpolationRatePerSecond = 16;
const remoteEnvironmentBodyPresentationTeleportSnapDistanceMeters = 3.5;
const remoteEnvironmentBodyPresentationYawSnapRadians = 0.75;

function createMutableVector3(): MutableVector3Snapshot {
  return {
    x: 0,
    y: 0,
    z: 0
  };
}

function writeMutableVector3(
  target: MutableVector3Snapshot,
  x: number,
  y: number,
  z: number
): MutableVector3Snapshot {
  target.x = x;
  target.y = y;
  target.z = z;

  return target;
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function wrapRadians(rawValue: number): number {
  let normalizedValue = rawValue;

  while (normalizedValue > Math.PI) {
    normalizedValue -= Math.PI * 2;
  }

  while (normalizedValue <= -Math.PI) {
    normalizedValue += Math.PI * 2;
  }

  return normalizedValue;
}

function lerpWrappedRadians(
  startRadians: number,
  endRadians: number,
  alpha: number
): number {
  return wrapRadians(
    startRadians + wrapRadians(endRadians - startRadians) * alpha
  );
}

function resolveRemoteEnvironmentBodyPresentationInterpolationAlpha(
  deltaSeconds: number
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  return (
    1 -
    Math.exp(
      -remoteEnvironmentBodyPresentationInterpolationRatePerSecond *
        deltaSeconds
    )
  );
}

function sampleRemoteEnvironmentBodyPositionComponent(
  basePosition: number,
  baseLinearVelocity: number,
  nextPosition: number | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  if (nextPosition !== null) {
    return lerp(basePosition, nextPosition, alpha);
  }

  if (extrapolationSeconds <= 0) {
    return basePosition;
  }

  return basePosition + baseLinearVelocity * extrapolationSeconds;
}

function sampleRemoteEnvironmentBodyYawRadians(
  baseEnvironmentBody: MetaverseRealtimeEnvironmentBodySnapshot,
  nextEnvironmentBody: MetaverseRealtimeEnvironmentBodySnapshot | null,
  alpha: number
): number {
  if (nextEnvironmentBody !== null) {
    return lerpWrappedRadians(
      baseEnvironmentBody.yawRadians,
      nextEnvironmentBody.yawRadians,
      alpha
    );
  }

  return baseEnvironmentBody.yawRadians;
}

export class MetaverseRemoteEnvironmentBodyPresentationOwner {
  readonly #snapshot: MutableRemoteEnvironmentBodyPresentationSnapshot;

  #sampleEpoch = 0;

  constructor(environmentBodySnapshot: MetaverseRealtimeEnvironmentBodySnapshot) {
    this.#snapshot = {
      environmentAssetId: environmentBodySnapshot.environmentAssetId,
      position: createMutableVector3(),
      yawRadians: environmentBodySnapshot.yawRadians
    };
  }

  get presentationSnapshot(): MetaverseRemoteEnvironmentBodyPresentationSnapshot {
    return this.#snapshot;
  }

  get sampleEpoch(): number {
    return this.#sampleEpoch;
  }

  syncAuthoritativeSample({
    alpha,
    baseEnvironmentBody,
    deltaSeconds,
    extrapolationSeconds,
    nextEnvironmentBody,
    sampleEpoch
  }: RemoteEnvironmentBodyPresentationAuthoritativeSample): void {
    const interpolationAlpha =
      resolveRemoteEnvironmentBodyPresentationInterpolationAlpha(deltaSeconds);
    const previousEnvironmentBodyPresentationSampled = this.#sampleEpoch > 0;
    const previousEnvironmentBodyPositionX = this.#snapshot.position.x;
    const previousEnvironmentBodyPositionY = this.#snapshot.position.y;
    const previousEnvironmentBodyPositionZ = this.#snapshot.position.z;
    const previousEnvironmentBodyYawRadians = this.#snapshot.yawRadians;
    const sampledEnvironmentBodyPositionX =
      sampleRemoteEnvironmentBodyPositionComponent(
        baseEnvironmentBody.position.x,
        baseEnvironmentBody.linearVelocity.x,
        nextEnvironmentBody?.position.x ?? null,
        alpha,
        extrapolationSeconds
      );
    const sampledEnvironmentBodyPositionY =
      sampleRemoteEnvironmentBodyPositionComponent(
        baseEnvironmentBody.position.y,
        baseEnvironmentBody.linearVelocity.y,
        nextEnvironmentBody?.position.y ?? null,
        alpha,
        extrapolationSeconds
      );
    const sampledEnvironmentBodyPositionZ =
      sampleRemoteEnvironmentBodyPositionComponent(
        baseEnvironmentBody.position.z,
        baseEnvironmentBody.linearVelocity.z,
        nextEnvironmentBody?.position.z ?? null,
        alpha,
        extrapolationSeconds
      );
    const sampledEnvironmentBodyYawRadians =
      sampleRemoteEnvironmentBodyYawRadians(
        baseEnvironmentBody,
        nextEnvironmentBody,
        alpha
      );
    const environmentBodyPositionDeltaX =
      sampledEnvironmentBodyPositionX -
      (previousEnvironmentBodyPresentationSampled
        ? previousEnvironmentBodyPositionX
        : sampledEnvironmentBodyPositionX);
    const environmentBodyPositionDeltaY =
      sampledEnvironmentBodyPositionY -
      (previousEnvironmentBodyPresentationSampled
        ? previousEnvironmentBodyPositionY
        : sampledEnvironmentBodyPositionY);
    const environmentBodyPositionDeltaZ =
      sampledEnvironmentBodyPositionZ -
      (previousEnvironmentBodyPresentationSampled
        ? previousEnvironmentBodyPositionZ
        : sampledEnvironmentBodyPositionZ);
    const environmentBodyPositionDistance = Math.hypot(
      environmentBodyPositionDeltaX,
      environmentBodyPositionDeltaY,
      environmentBodyPositionDeltaZ
    );
    const environmentBodyYawDistance = Math.abs(
      wrapRadians(
        sampledEnvironmentBodyYawRadians -
          (previousEnvironmentBodyPresentationSampled
            ? previousEnvironmentBodyYawRadians
            : sampledEnvironmentBodyYawRadians)
      )
    );

    this.#snapshot.environmentAssetId = baseEnvironmentBody.environmentAssetId;
    if (
      !previousEnvironmentBodyPresentationSampled ||
      interpolationAlpha <= 0 ||
      environmentBodyPositionDistance >=
        remoteEnvironmentBodyPresentationTeleportSnapDistanceMeters ||
      environmentBodyYawDistance >= remoteEnvironmentBodyPresentationYawSnapRadians
    ) {
      writeMutableVector3(
        this.#snapshot.position,
        sampledEnvironmentBodyPositionX,
        sampledEnvironmentBodyPositionY,
        sampledEnvironmentBodyPositionZ
      );
      this.#snapshot.yawRadians = sampledEnvironmentBodyYawRadians;
    } else {
      writeMutableVector3(
        this.#snapshot.position,
        lerp(
          previousEnvironmentBodyPositionX,
          sampledEnvironmentBodyPositionX,
          interpolationAlpha
        ),
        lerp(
          previousEnvironmentBodyPositionY,
          sampledEnvironmentBodyPositionY,
          interpolationAlpha
        ),
        lerp(
          previousEnvironmentBodyPositionZ,
          sampledEnvironmentBodyPositionZ,
          interpolationAlpha
        )
      );
      this.#snapshot.yawRadians = lerpWrappedRadians(
        previousEnvironmentBodyYawRadians,
        sampledEnvironmentBodyYawRadians,
        interpolationAlpha
      );
    }

    this.#sampleEpoch = sampleEpoch;
  }
}
