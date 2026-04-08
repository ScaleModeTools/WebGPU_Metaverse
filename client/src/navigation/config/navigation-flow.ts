import type { NavigationFlow } from "../types/navigation-flow";

export const navigationFlow = {
  initialStep: "login",
  steps: [
    { id: "login", label: "Enter username" },
    {
      id: "permissions",
      label: "Grant webcam permission",
      requiresPrevious: ["login"]
    },
    {
      id: "calibration",
      label: "Capture nine-point calibration",
      requiresPrevious: ["permissions"]
    },
    {
      id: "main-menu",
      label: "Review settings and start the local arena"
    },
    {
      id: "gameplay",
      label: "Boot WebGPU gameplay",
      requiresPrevious: ["main-menu"]
    },
    {
      id: "unsupported",
      label: "Show a clear unsupported gameplay state"
    }
  ]
} as const satisfies NavigationFlow;
