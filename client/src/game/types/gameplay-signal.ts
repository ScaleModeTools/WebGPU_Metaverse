import type { LocalArenaWeaponSnapshot } from "./local-arena-simulation";

export const gameplaySignalTypes = [
  "weapon-fired",
  "weapon-reloaded",
  "enemy-hit-confirmed"
] as const;

export type GameplaySignalType = (typeof gameplaySignalTypes)[number];

export type GameplaySignal =
  | {
      readonly type: "weapon-fired";
      readonly weaponId: LocalArenaWeaponSnapshot["weaponId"];
    }
  | {
      readonly type: "weapon-reloaded";
      readonly weaponId: LocalArenaWeaponSnapshot["weaponId"];
    }
  | {
      readonly enemyId: string;
      readonly type: "enemy-hit-confirmed";
    };
