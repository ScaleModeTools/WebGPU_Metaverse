import type { LocalArenaWeaponSnapshot } from "./local-arena-simulation";

export const gameplaySignalTypes = ["weapon-fired"] as const;

export type GameplaySignalType = (typeof gameplaySignalTypes)[number];

export type GameplaySignal = {
  readonly type: "weapon-fired";
  readonly weaponId: LocalArenaWeaponSnapshot["weaponId"];
};
