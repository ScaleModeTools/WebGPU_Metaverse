import type { GameplayInputModeId } from "../gameplay-input-mode.js";
import type {
  GameplaySessionMode,
  GameplayTickOwner
} from "../experiences/duck-hunt/duck-hunt-room-contract.js";

import {
  readExperienceTickOwner,
  type ExperienceId
} from "./experience-catalog.js";

export interface PortalLaunchSelectionSnapshot {
  readonly experienceId: ExperienceId;
  readonly inputMode: GameplayInputModeId;
  readonly sessionMode: GameplaySessionMode;
  readonly tickOwner: GameplayTickOwner;
}

export interface PortalLaunchSelectionSnapshotInput {
  readonly experienceId: ExperienceId;
  readonly inputMode: GameplayInputModeId;
  readonly sessionMode: GameplaySessionMode;
}

export function createPortalLaunchSelectionSnapshot({
  experienceId,
  inputMode,
  sessionMode
}: PortalLaunchSelectionSnapshotInput): PortalLaunchSelectionSnapshot {
  return Object.freeze({
    experienceId,
    inputMode,
    sessionMode,
    tickOwner: readExperienceTickOwner(experienceId, sessionMode)
  });
}
