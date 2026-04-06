import type { GameplayHudSnapshot } from "../types/gameplay-runtime";
import type { GameplayReticleVisualState } from "../types/gameplay-presentation";

export function resolveGameplayReticleVisualState(
  hudSnapshot: GameplayHudSnapshot
): GameplayReticleVisualState {
  if (hudSnapshot.aimPoint === null) {
    return hudSnapshot.trackingState === "tracked"
      ? "hidden"
      : "tracking-unavailable";
  }

  if (hudSnapshot.targetFeedback.state === "hit") {
    return "hit";
  }

  if (hudSnapshot.weapon.readiness === "reloading") {
    return "reloading";
  }

  if (hudSnapshot.weapon.readiness === "reload-required") {
    return "reload-required";
  }

  if (hudSnapshot.session.phase !== "active") {
    return "round-paused";
  }

  if (hudSnapshot.targetFeedback.state === "targeted") {
    return "targeted";
  }

  return "neutral";
}
