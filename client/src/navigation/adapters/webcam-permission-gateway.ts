import type { WebcamPermissionSnapshot } from "../types/webcam-permission";

interface MediaStreamTrackLike {
  stop(): void;
}

interface MediaStreamLike {
  getTracks(): readonly MediaStreamTrackLike[];
}

interface MediaDevicesLike {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStreamLike>;
}

export class WebcamPermissionGateway {
  async request(
    mediaDevices: MediaDevicesLike | null | undefined
  ): Promise<WebcamPermissionSnapshot> {
    if (mediaDevices?.getUserMedia === undefined) {
      return {
        state: "unsupported",
        failureReason: "This browser does not expose webcam capture."
      };
    }

    try {
      const stream = await mediaDevices.getUserMedia({
        video: {
          facingMode: "user"
        }
      });

      stream.getTracks().forEach((track) => track.stop());

      return {
        state: "granted",
        failureReason: null
      };
    } catch (error) {
      return {
        state: "denied",
        failureReason:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera permission was denied by the browser."
            : "The webcam request did not complete successfully."
      };
    }
  }
}
