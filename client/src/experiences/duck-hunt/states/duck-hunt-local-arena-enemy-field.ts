export {
  countDownedEnemies,
  createEnemyField,
  resetEnemyField,
  summarizeEnemyField
} from "./duck-hunt-local-arena-enemy-field-state";
export {
  applyReticleScatter,
  findNearestEnemyState,
  scatterEnemiesFromShot
} from "./duck-hunt-local-arena-enemy-field-targeting";
export {
  setEnemyDowned,
  stepEnemyField
} from "./duck-hunt-local-arena-enemy-field-motion";
export type {
  LocalArenaEnemyRuntimeState
} from "../types/duck-hunt-local-arena-enemy-field";
