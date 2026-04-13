import type { ExperienceId } from "@webgpu-metaverse/shared";

import type { MetaverseVector3Snapshot } from "./metaverse-runtime";

export interface MetaverseBootCinematicShotConfig {
  readonly durationMs: number;
  readonly highlightPortalExperienceId: ExperienceId | null;
  readonly id: string;
  readonly pitchRadians: number;
  readonly position: MetaverseVector3Snapshot;
  readonly requiresEnvironment: boolean;
  readonly yawRadians: number;
}

export interface MetaverseBootCinematicConfig {
  readonly enabled: boolean;
  readonly minimumDwellMs: number;
  readonly shots: readonly MetaverseBootCinematicShotConfig[];
}
