export const metaversePlayerTeamIds = [
  "red",
  "blue"
] as const;

export type MetaversePlayerTeamId = (typeof metaversePlayerTeamIds)[number];

export function isMetaversePlayerTeamId(
  value: string
): value is MetaversePlayerTeamId {
  return metaversePlayerTeamIds.includes(value as MetaversePlayerTeamId);
}

export function createMetaversePlayerTeamId(
  rawValue: string | null | undefined
): MetaversePlayerTeamId | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  return isMetaversePlayerTeamId(normalizedValue)
    ? normalizedValue
    : null;
}

export function resolveMetaversePlayerTeamId(
  playerId: string
): MetaversePlayerTeamId {
  let hash = 0;

  for (let index = 0; index < playerId.length; index += 1) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(index)) | 0;
  }

  return (hash & 1) === 0 ? "red" : "blue";
}

export function normalizeMetaversePlayerTeamId(
  teamId: string | null | undefined,
  playerId: string
): MetaversePlayerTeamId {
  return createMetaversePlayerTeamId(teamId) ?? resolveMetaversePlayerTeamId(playerId);
}
