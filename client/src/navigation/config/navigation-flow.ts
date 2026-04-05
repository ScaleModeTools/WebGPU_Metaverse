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
      label: "Review calibration shell",
      requiresPrevious: ["permissions"]
    },
    {
      id: "gameplay",
      label: "Open the gameplay shell",
      requiresPrevious: ["calibration"]
    },
    {
      id: "unsupported",
      label: "Show a clear unsupported gameplay state"
    }
  ]
} as const satisfies NavigationFlow;
