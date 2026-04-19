import type { NavigationFlow } from "../types/navigation-flow";

export const navigationFlow = {
  initialStep: "main-menu",
  steps: [
    {
      id: "main-menu",
      label: "Review shell options, choose input, and launch gameplay"
    },
    {
      id: "tool",
      label: "Open the full-screen map editor suite from the dev shell"
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
