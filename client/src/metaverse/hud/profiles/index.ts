import { shellDefaultHudProfile, type MetaverseHudProfileSnapshot } from "./shell-default-hud-profile";

const metaverseHudProfiles = Object.freeze([shellDefaultHudProfile]);

const metaverseHudProfilesById = new Map<string, MetaverseHudProfileSnapshot>(
  metaverseHudProfiles.map((profile) => [profile.id, profile])
);

export type { MetaverseHudProfileSnapshot } from "./shell-default-hud-profile";
export { shellDefaultHudProfile } from "./shell-default-hud-profile";

export function readMetaverseHudProfile(
  profileId: string | null
): MetaverseHudProfileSnapshot | null {
  if (profileId === null) {
    return null;
  }

  return metaverseHudProfilesById.get(profileId) ?? null;
}
