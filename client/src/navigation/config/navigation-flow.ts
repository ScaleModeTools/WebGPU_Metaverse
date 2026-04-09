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
      label: "Optional webcam permission for thumb-trigger mode",
      requiresPrevious: ["main-menu"]
    },
    {
      id: "calibration",
      label: "Optional nine-point calibration for thumb-trigger mode",
      requiresPrevious: ["permissions"]
    },
    {
      id: "metaverse",
      label: "Explore the ocean hub world and inspect experience portals",
      requiresPrevious: ["main-menu"]
    },
    {
      id: "gameplay",
      label: "Launch the selected experience",
      requiresPrevious: ["metaverse"]
    },
    {
      id: "unsupported",
      label: "Show a clear unsupported gameplay state"
    }
  ]
} as const satisfies NavigationFlow;
