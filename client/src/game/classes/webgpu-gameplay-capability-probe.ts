import type { WebGpuGameplayCapabilitySnapshot } from "../types/webgpu-capability";

export class WebGpuGameplayCapabilityProbe {
  async probe(
    navigatorLike: Navigator | null | undefined
  ): Promise<WebGpuGameplayCapabilitySnapshot> {
    if (navigatorLike?.gpu === undefined) {
      return {
        status: "unsupported",
        reason: "navigator-gpu-missing"
      };
    }

    try {
      const adapter = await navigatorLike.gpu.requestAdapter();

      if (adapter === null) {
        return {
          status: "unsupported",
          reason: "adapter-unavailable"
        };
      }

      return {
        status: "supported",
        reason: "adapter-ready"
      };
    } catch {
      return {
        status: "unsupported",
        reason: "probe-failed"
      };
    }
  }
}
