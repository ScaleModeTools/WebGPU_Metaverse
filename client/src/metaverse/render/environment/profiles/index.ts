import {
  shellDefaultEnvironmentPresentationProfile,
  type MetaverseEnvironmentPresentationProfileSnapshot
} from "./shell-default-environment-presentation";
import { shellGoldenHourEnvironmentPresentationProfile } from "./shell-golden-hour-environment-presentation";

const metaverseEnvironmentPresentationProfiles = Object.freeze([
  shellDefaultEnvironmentPresentationProfile,
  shellGoldenHourEnvironmentPresentationProfile
]);

const metaverseEnvironmentPresentationProfilesById = new Map<
  string,
  MetaverseEnvironmentPresentationProfileSnapshot
>(
  metaverseEnvironmentPresentationProfiles.map((profile) => [profile.id, profile])
);

export type { MetaverseEnvironmentPresentationProfileSnapshot } from "./shell-default-environment-presentation";
export { shellDefaultEnvironmentPresentationProfile } from "./shell-default-environment-presentation";
export { shellGoldenHourEnvironmentPresentationProfile } from "./shell-golden-hour-environment-presentation";

export function listMetaverseEnvironmentPresentationProfiles(): readonly MetaverseEnvironmentPresentationProfileSnapshot[] {
  return metaverseEnvironmentPresentationProfiles;
}

export function readMetaverseEnvironmentPresentationProfile(
  profileId: string | null
): MetaverseEnvironmentPresentationProfileSnapshot | null {
  if (profileId === null) {
    return null;
  }

  return metaverseEnvironmentPresentationProfilesById.get(profileId) ?? null;
}
