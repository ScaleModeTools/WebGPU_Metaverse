export const webGpuGameplayCapabilityStatuses = [
  "checking",
  "supported",
  "unsupported"
] as const;
export const webGpuGameplayCapabilityReasons = [
  "pending",
  "adapter-ready",
  "navigator-gpu-missing",
  "adapter-unavailable",
  "probe-failed"
] as const;

export type WebGpuGameplayCapabilityStatus =
  (typeof webGpuGameplayCapabilityStatuses)[number];
export type WebGpuGameplayCapabilityReason =
  (typeof webGpuGameplayCapabilityReasons)[number];

export interface WebGpuGameplayCapabilitySnapshot {
  readonly status: WebGpuGameplayCapabilityStatus;
  readonly reason: WebGpuGameplayCapabilityReason;
}
