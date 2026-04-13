import type {
  MetaverseLocomotionModeDefinition,
  MetaverseLocomotionModeId
} from "../types/metaverse-locomotion-mode";

export const defaultMetaverseLocomotionMode: MetaverseLocomotionModeId =
  "grounded";

export const metaverseLocomotionModes = [
  {
    id: "grounded",
    label: "Grounded",
    description:
      "Use a capsule-backed grounded body on solid support. Camera height derives from the body, and the mannequin follows the same runtime truth.",
    controlsSummary: [
      "W/S forward and backward, A/D strafe",
      "Move mouse to turn and look",
      "Space jumps through up, mid-air, and down phases",
      "Shift boosts grounded speed"
    ]
  },
  {
    id: "swim",
    label: "Swim",
    description:
      "Stay waterborne at the ocean surface with a third-person follow camera. Swim keeps character-facing movement active without switching back to fly.",
    controlsSummary: [
      "W/S forward and backward, A/D strafe",
      "Move mouse to turn and look",
      "Boost adds a stronger swim stroke instead of flight drift"
    ]
  },
  {
    id: "fly",
    label: "Fly",
    description:
      "Keep the original free-flight hub camera. This stays available as the fallback traversal path while grounded embodiment is proving out.",
    controlsSummary: [
      "Preserves the current camera-truth fly path",
      "Keeps full altitude freedom over the hub",
      "Useful for fast portal and environment inspection"
    ]
  },
  {
    id: "mounted",
    label: "Mounted",
    description:
      "Mounted locomotion is runtime-owned. The current hub mount drives yaw, camera, and propulsion until you dismount.",
    controlsSummary: [
      "W/S forward and backward, A/D turn",
      "Move mouse to steer mount yaw and camera pitch",
      "Dismount returns control to the current surface state"
    ]
  }
] as const satisfies readonly MetaverseLocomotionModeDefinition[];

export function resolveMetaverseLocomotionMode(
  locomotionMode: MetaverseLocomotionModeId
): MetaverseLocomotionModeDefinition {
  return (
    metaverseLocomotionModes.find((candidate) => candidate.id === locomotionMode) ??
    metaverseLocomotionModes[0]
  );
}
