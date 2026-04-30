import type { LatestHandTrackingSnapshot } from "../../../tracking";
import type {
  LocalArenaEnemyRenderState
} from "./duck-hunt-local-arena-simulation";
import type {
  GameplayArenaHudSnapshot,
  GameplayCameraSnapshot,
  GameplayViewportSnapshot
} from "./duck-hunt-gameplay-runtime";

export interface GameplayArenaRuntime {
  readonly cameraSnapshot: GameplayCameraSnapshot;
  readonly enemyRenderStates: readonly LocalArenaEnemyRenderState[];
  readonly hudSnapshot: GameplayArenaHudSnapshot;
  advance: (
    trackingSnapshot: LatestHandTrackingSnapshot,
    nowMs?: number,
    viewportSnapshot?: GameplayViewportSnapshot
  ) => GameplayArenaHudSnapshot;
  restartSession: (trackingSnapshot?: LatestHandTrackingSnapshot) => void;
  reset: (trackingSnapshot?: LatestHandTrackingSnapshot) => void;
}
