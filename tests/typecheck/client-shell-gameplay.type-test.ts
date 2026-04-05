import type { PlayerProfile } from "@thumbshooter/shared";

import type { FirstPlayableWeaponId } from "../../client/src/game/types/game-foundation";
import type {
  GameplaySignal,
  GameplaySignalType
} from "../../client/src/game/types/gameplay-signal";
import type { ThumbShooterShellControllerAction } from "../../client/src/app/types/thumbshooter-shell-controller";
import type { AssertTrue, IsEqual } from "./type-assertions";

type ThumbShooterShellControllerActionType =
  ThumbShooterShellControllerAction["type"];

type ExpectedShellActionType =
  | "audioSnapshotChanged"
  | "bestScoreRaised"
  | "calibrationProgressRecorded"
  | "calibrationResetRequested"
  | "capabilityProbeStarted"
  | "capabilitySnapshotReceived"
  | "gameplayExited"
  | "gameplayMenuAutoOpened"
  | "gameplayMenuSetOpen"
  | "loginRejected"
  | "musicVolumeChanged"
  | "permissionRequestStarted"
  | "permissionResolved"
  | "profileCleared"
  | "profileConfirmed"
  | "profileEditRequested"
  | "sfxVolumeChanged"
  | "usernameDraftChanged";

type ShellActionTypesMatch = AssertTrue<
  IsEqual<ThumbShooterShellControllerActionType, ExpectedShellActionType>
>;
type MusicVolumePayloadIsNumber = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "musicVolumeChanged" }
    >["sliderValue"],
    number
  >
>;
type GameplayMenuTogglePayloadIsBoolean = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "gameplayMenuSetOpen" }
    >["open"],
    boolean
  >
>;
type ProfileConfirmedPayloadUsesPlayerProfile = AssertTrue<
  IsEqual<
    Extract<
      ThumbShooterShellControllerAction,
      { readonly type: "profileConfirmed" }
    >["profile"],
    PlayerProfile
  >
>;
type GameplaySignalTypeMatches = AssertTrue<
  IsEqual<GameplaySignalType, "weapon-fired">
>;
type GameplaySignalWeaponIdMatches = AssertTrue<
  IsEqual<GameplaySignal["weaponId"], FirstPlayableWeaponId>
>;

export type ClientShellGameplayTypeTests =
  | ShellActionTypesMatch
  | MusicVolumePayloadIsNumber
  | GameplayMenuTogglePayloadIsBoolean
  | ProfileConfirmedPayloadUsesPlayerProfile
  | GameplaySignalTypeMatches
  | GameplaySignalWeaponIdMatches;
