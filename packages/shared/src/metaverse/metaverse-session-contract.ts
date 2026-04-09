import type {
  GameplaySessionMode,
  GameplayTickOwner
} from "../experiences/duck-hunt/duck-hunt-room-contract.js";

import type { ExperienceId } from "./experience-catalog.js";

export interface MetaverseSessionSnapshot {
  readonly activeExperienceId: ExperienceId | null;
  readonly availableExperienceIds: readonly ExperienceId[];
  readonly selectedSessionMode: GameplaySessionMode | null;
  readonly tickOwner: GameplayTickOwner;
}

export interface MetaverseSessionSnapshotInput {
  readonly activeExperienceId?: ExperienceId | null;
  readonly availableExperienceIds: readonly ExperienceId[];
  readonly selectedSessionMode?: GameplaySessionMode | null;
  readonly tickOwner: GameplayTickOwner;
}

export function createMetaverseSessionSnapshot({
  activeExperienceId = null,
  availableExperienceIds,
  selectedSessionMode = null,
  tickOwner
}: MetaverseSessionSnapshotInput): MetaverseSessionSnapshot {
  return Object.freeze({
    activeExperienceId,
    availableExperienceIds: Object.freeze([...availableExperienceIds]),
    selectedSessionMode,
    tickOwner
  });
}
