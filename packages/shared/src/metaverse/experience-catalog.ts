import type { GameplayInputModeId } from "../gameplay-input-mode.js";
import type {
  GameplaySessionMode,
  GameplayTickOwner
} from "../experiences/duck-hunt/duck-hunt-room-contract.js";

export const experienceIds = ["duck-hunt"] as const;

export type ExperienceId = (typeof experienceIds)[number];

export interface ExperienceCatalogEntrySnapshot {
  readonly defaultInputMode: GameplayInputModeId;
  readonly defaultSessionMode: GameplaySessionMode;
  readonly id: ExperienceId;
  readonly label: string;
  readonly portalSummary: string;
  readonly shortDescription: string;
  readonly supportedInputModes: readonly GameplayInputModeId[];
  readonly supportedSessionModes: readonly GameplaySessionMode[];
  readonly tickOwnerBySessionMode: Readonly<
    Record<GameplaySessionMode, GameplayTickOwner>
  >;
}

const duckHuntCatalogEntry = Object.freeze({
  defaultInputMode: "mouse",
  defaultSessionMode: "single-player",
  id: "duck-hunt",
  label: "Duck Hunt!",
  portalSummary:
    "Open-ocean target shooting with thumb-drop fire, WebGPU visuals, and co-op room sync.",
  shortDescription:
    "Hunt bright bird targets above the ocean. Single-player runs locally, while co-op rooms stay server-ticked.",
  supportedInputModes: ["camera-thumb-trigger", "mouse"],
  supportedSessionModes: ["single-player", "co-op"],
  tickOwnerBySessionMode: {
    "co-op": "server",
    "single-player": "client"
  }
} as const satisfies ExperienceCatalogEntrySnapshot);

const experienceCatalogEntries = [duckHuntCatalogEntry] as const;

export const experienceCatalog = Object.freeze(experienceCatalogEntries);

export function readExperienceCatalogEntry(
  experienceId: ExperienceId
): ExperienceCatalogEntrySnapshot {
  const catalogEntry = experienceCatalog.find((entry) => entry.id === experienceId);

  if (catalogEntry === undefined) {
    throw new Error(`Unknown experience id: ${experienceId}`);
  }

  return catalogEntry;
}

export function readExperienceTickOwner(
  experienceId: ExperienceId,
  sessionMode: GameplaySessionMode
): GameplayTickOwner {
  return readExperienceCatalogEntry(experienceId).tickOwnerBySessionMode[sessionMode];
}
