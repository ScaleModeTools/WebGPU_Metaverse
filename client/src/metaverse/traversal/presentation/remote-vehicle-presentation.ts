import type { MetaverseRealtimeVehicleSnapshot } from "@webgpu-metaverse/shared";

import type {
  MetaverseRemoteVehiclePresentationSnapshot
} from "../../types/metaverse-runtime";

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableRemoteVehiclePresentationSnapshot {
  environmentAssetId: string;
  position: MutableVector3Snapshot;
  yawRadians: number;
}

export interface RemoteVehiclePresentationAuthoritativeSample {
  readonly alpha: number;
  readonly baseVehicle: MetaverseRealtimeVehicleSnapshot;
  readonly deltaSeconds: number;
  readonly extrapolationSeconds: number;
  readonly nextVehicle: MetaverseRealtimeVehicleSnapshot | null;
  readonly sampleEpoch: number;
}

const remoteVehiclePresentationInterpolationRatePerSecond = 16;
const remoteVehiclePresentationTeleportSnapDistanceMeters = 3.5;
const remoteVehiclePresentationYawSnapRadians = 0.75;

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

function resolveRemoteVehiclePresentationInterpolationAlpha(
  deltaSeconds: number
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  return (
    1 - Math.exp(-remoteVehiclePresentationInterpolationRatePerSecond * deltaSeconds)
  );
}

function sampleRemoteVehiclePositionComponent(
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

function sampleRemoteVehicleYawRadians(
  baseVehicle: MetaverseRealtimeVehicleSnapshot,
  nextVehicle: MetaverseRealtimeVehicleSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  if (nextVehicle !== null) {
    return lerpWrappedRadians(
      baseVehicle.yawRadians,
      nextVehicle.yawRadians,
      alpha
    );
  }

  if (extrapolationSeconds <= 0) {
    return baseVehicle.yawRadians;
  }

  return wrapRadians(
    baseVehicle.yawRadians +
      baseVehicle.angularVelocityRadiansPerSecond * extrapolationSeconds
  );
}

export class MetaverseRemoteVehiclePresentationOwner {
  readonly #snapshot: MutableRemoteVehiclePresentationSnapshot;

  #sampleEpoch = 0;

  constructor(vehicleSnapshot: MetaverseRealtimeVehicleSnapshot) {
    this.#snapshot = {
      environmentAssetId: vehicleSnapshot.environmentAssetId,
      position: createMutableVector3(),
      yawRadians: vehicleSnapshot.yawRadians
    };
  }

  get presentationSnapshot(): MetaverseRemoteVehiclePresentationSnapshot {
    return this.#snapshot;
  }

  get sampleEpoch(): number {
    return this.#sampleEpoch;
  }

  syncAuthoritativeSample({
    alpha,
    baseVehicle,
    deltaSeconds,
    extrapolationSeconds,
    nextVehicle,
    sampleEpoch
  }: RemoteVehiclePresentationAuthoritativeSample): void {
    const interpolationAlpha =
      resolveRemoteVehiclePresentationInterpolationAlpha(deltaSeconds);
    const previousVehiclePresentationSampled = this.#sampleEpoch > 0;
    const previousVehiclePositionX = this.#snapshot.position.x;
    const previousVehiclePositionY = this.#snapshot.position.y;
    const previousVehiclePositionZ = this.#snapshot.position.z;
    const previousVehicleYawRadians = this.#snapshot.yawRadians;
    const sampledVehiclePositionX = sampleRemoteVehiclePositionComponent(
      baseVehicle.position.x,
      baseVehicle.linearVelocity.x,
      nextVehicle?.position.x ?? null,
      alpha,
      extrapolationSeconds
    );
    const sampledVehiclePositionY = sampleRemoteVehiclePositionComponent(
      baseVehicle.position.y,
      baseVehicle.linearVelocity.y,
      nextVehicle?.position.y ?? null,
      alpha,
      extrapolationSeconds
    );
    const sampledVehiclePositionZ = sampleRemoteVehiclePositionComponent(
      baseVehicle.position.z,
      baseVehicle.linearVelocity.z,
      nextVehicle?.position.z ?? null,
      alpha,
      extrapolationSeconds
    );
    const sampledVehicleYawRadians = sampleRemoteVehicleYawRadians(
      baseVehicle,
      nextVehicle,
      alpha,
      extrapolationSeconds
    );
    const vehiclePositionDeltaX =
      sampledVehiclePositionX -
      (previousVehiclePresentationSampled
        ? previousVehiclePositionX
        : sampledVehiclePositionX);
    const vehiclePositionDeltaY =
      sampledVehiclePositionY -
      (previousVehiclePresentationSampled
        ? previousVehiclePositionY
        : sampledVehiclePositionY);
    const vehiclePositionDeltaZ =
      sampledVehiclePositionZ -
      (previousVehiclePresentationSampled
        ? previousVehiclePositionZ
        : sampledVehiclePositionZ);
    const vehiclePositionDistance = Math.hypot(
      vehiclePositionDeltaX,
      vehiclePositionDeltaY,
      vehiclePositionDeltaZ
    );
    const vehicleYawDistance = Math.abs(
      wrapRadians(
        sampledVehicleYawRadians -
          (previousVehiclePresentationSampled
            ? previousVehicleYawRadians
            : sampledVehicleYawRadians)
      )
    );

    this.#snapshot.environmentAssetId = baseVehicle.environmentAssetId;
    if (
      !previousVehiclePresentationSampled ||
      interpolationAlpha <= 0 ||
      vehiclePositionDistance >=
        remoteVehiclePresentationTeleportSnapDistanceMeters ||
      vehicleYawDistance >= remoteVehiclePresentationYawSnapRadians
    ) {
      writeMutableVector3(
        this.#snapshot.position,
        sampledVehiclePositionX,
        sampledVehiclePositionY,
        sampledVehiclePositionZ
      );
      this.#snapshot.yawRadians = sampledVehicleYawRadians;
    } else {
      writeMutableVector3(
        this.#snapshot.position,
        lerp(previousVehiclePositionX, sampledVehiclePositionX, interpolationAlpha),
        lerp(previousVehiclePositionY, sampledVehiclePositionY, interpolationAlpha),
        lerp(previousVehiclePositionZ, sampledVehiclePositionZ, interpolationAlpha)
      );
      this.#snapshot.yawRadians = lerpWrappedRadians(
        previousVehicleYawRadians,
        sampledVehicleYawRadians,
        interpolationAlpha
      );
    }
    this.#sampleEpoch = sampleEpoch;
  }
}
