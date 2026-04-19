import {
  shellDefaultCharacterPresentationProfile,
  type MetaverseCharacterPresentationProfileSnapshot
} from "./shell-default-character-presentation";

const metaverseCharacterPresentationProfiles = Object.freeze([
  shellDefaultCharacterPresentationProfile
]);

const metaverseCharacterPresentationProfilesById = new Map<
  string,
  MetaverseCharacterPresentationProfileSnapshot
>(
  metaverseCharacterPresentationProfiles.map((profile) => [
    profile.id,
    profile
  ])
);

export type {
  MetaverseCharacterPresentationProfileSnapshot
} from "./shell-default-character-presentation";
export { shellDefaultCharacterPresentationProfile } from "./shell-default-character-presentation";

export function readMetaverseCharacterPresentationProfile(
  profileId: string | null
): MetaverseCharacterPresentationProfileSnapshot | null {
  if (profileId === null) {
    return null;
  }

  return metaverseCharacterPresentationProfilesById.get(profileId) ?? null;
}
