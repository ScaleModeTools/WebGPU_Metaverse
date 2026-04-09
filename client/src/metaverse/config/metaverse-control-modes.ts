import type {
  MetaverseControlModeDefinition,
  MetaverseControlModeId
} from "../types/metaverse-control-mode";

export const defaultMetaverseControlMode: MetaverseControlModeId = "keyboard";

export const metaverseControlModes = [
  {
    id: "keyboard",
    label: "Keyboard",
    description:
      "Drive the hub with digital keyboard controls. W/S move, A/D pan, Q/E tilt, and Shift boosts.",
    controlsSummary: [
      "W forward, S backward",
      "A pan left, D pan right",
      "Q tilt down, E tilt up",
      "Hold Shift to boost"
    ]
  },
  {
    id: "mouse",
    label: "Mouse",
    description:
      "Use edge-based mouse steering instead of pointer lock. Left and right click move, viewport edges pan and tilt, and Mouse Button 4 boosts.",
    controlsSummary: [
      "Left click forward, right click backward",
      "Move toward left and right edges to pan",
      "Move toward top and bottom edges to tilt",
      "Hold Mouse Button 4 to boost"
    ]
  }
] as const satisfies readonly MetaverseControlModeDefinition[];

export function resolveMetaverseControlMode(
  controlMode: MetaverseControlModeId
): MetaverseControlModeDefinition {
  return (
    metaverseControlModes.find((candidate) => candidate.id === controlMode) ??
    metaverseControlModes[0]
  );
}
