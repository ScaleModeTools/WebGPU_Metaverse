import type { NavigationFlow } from "../types/navigation-flow";

export const navigationFlow = {
  initialStep: "login",
  steps: [
    { id: "login", label: "Enter username" },
    {
      id: "main-menu",
      label: "Review profile, choose input, and launch gameplay",
      requiresPrevious: ["login"]
    },
    {
      id: "permissions",
      label: "Optional webcam permission for thumb-shooter mode",
      requiresPrevious: ["main-menu"]
    },
    {
      id: "calibration",
      label: "Optional nine-point calibration for thumb-shooter mode",
      requiresPrevious: ["permissions"]
    },
    {
      id: "gameplay",
      label: "Start local arena gameplay",
      requiresPrevious: ["main-menu"]
    },
    {
      id: "unsupported",
      label: "Show a clear unsupported gameplay state"
    }
  ]
} as const satisfies NavigationFlow;
