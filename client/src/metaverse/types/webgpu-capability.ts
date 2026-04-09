export const webGpuMetaverseCapabilityStatuses = [
  "checking",
  "supported",
  "unsupported"
] as const;
export const webGpuMetaverseCapabilityReasons = [
  "pending",
  "adapter-ready",
  "navigator-gpu-missing",
  "adapter-unavailable",
  "probe-failed"
] as const;

export type WebGpuMetaverseCapabilityStatus =
  (typeof webGpuMetaverseCapabilityStatuses)[number];
export type WebGpuMetaverseCapabilityReason =
  (typeof webGpuMetaverseCapabilityReasons)[number];

export interface WebGpuMetaverseCapabilitySnapshot {
  readonly status: WebGpuMetaverseCapabilityStatus;
  readonly reason: WebGpuMetaverseCapabilityReason;
}
