import type { WebcamPermissionState } from "./shell-navigation";

export interface WebcamPermissionSnapshot {
  readonly state: WebcamPermissionState;
  readonly failureReason: string | null;
}
