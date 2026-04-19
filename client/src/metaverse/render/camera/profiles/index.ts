import {
  shellDefaultCameraProfile,
  type MetaverseCameraProfileSnapshot
} from "./shell-default-camera-profile";

const metaverseCameraProfiles = Object.freeze([shellDefaultCameraProfile]);

const metaverseCameraProfilesById = new Map<
  string,
  MetaverseCameraProfileSnapshot
>(metaverseCameraProfiles.map((profile) => [profile.id, profile]));

export type { MetaverseCameraProfileSnapshot } from "./shell-default-camera-profile";
export { shellDefaultCameraProfile } from "./shell-default-camera-profile";

export function readMetaverseCameraProfile(
  profileId: string | null
): MetaverseCameraProfileSnapshot | null {
  if (profileId === null) {
    return null;
  }

  return metaverseCameraProfilesById.get(profileId) ?? null;
}
