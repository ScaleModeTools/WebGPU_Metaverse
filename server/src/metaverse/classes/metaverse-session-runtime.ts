import {
  createMetaverseSessionSnapshot,
  experienceCatalog,
  readExperienceCatalogEntry,
  type ExperienceId,
  type MetaverseSessionSnapshot
} from "@thumbshooter/shared";

export interface MetaverseSessionRuntimeConfig {
  readonly availableExperienceIds?: readonly ExperienceId[];
}

function resolveAvailableExperienceIds(
  availableExperienceIds: readonly ExperienceId[]
): readonly ExperienceId[] {
  for (const experienceId of availableExperienceIds) {
    readExperienceCatalogEntry(experienceId);
  }

  return Object.freeze([...availableExperienceIds]);
}

export class MetaverseSessionRuntime {
  readonly #availableExperienceIds: readonly ExperienceId[];

  constructor(
    config: MetaverseSessionRuntimeConfig = {}
  ) {
    this.#availableExperienceIds = resolveAvailableExperienceIds(
      config.availableExperienceIds ?? experienceCatalog.map((entry) => entry.id)
    );
  }

  readSessionSnapshot(): MetaverseSessionSnapshot {
    return createMetaverseSessionSnapshot({
      activeExperienceId: null,
      availableExperienceIds: this.#availableExperienceIds,
      selectedSessionMode: null,
      tickOwner: "server"
    });
  }
}
