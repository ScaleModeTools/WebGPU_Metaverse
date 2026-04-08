import type { StoredProfileHydrationResult } from "../../network";

import { ProfileSummaryCard } from "./profile-summary-card";

interface ShellStatusRailProps {
  readonly calibrationSampleCount: number;
  readonly calibrationQualityLabel: string;
  readonly calibrationStatusLabel: string;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly inputModeLabel: string;
  readonly reticleCatalogLabel: string;
  readonly username: string;
}

export function ShellStatusRail({
  calibrationSampleCount,
  calibrationQualityLabel,
  calibrationStatusLabel,
  hydrationSource,
  inputModeLabel,
  reticleCatalogLabel,
  username
}: ShellStatusRailProps) {
  return (
    <aside>
      <ProfileSummaryCard
        calibrationSampleCount={calibrationSampleCount}
        calibrationQualityLabel={calibrationQualityLabel}
        calibrationStatusLabel={calibrationStatusLabel}
        hydrationSource={hydrationSource}
        inputModeLabel={inputModeLabel}
        reticleCatalogLabel={reticleCatalogLabel}
        username={username}
      />
    </aside>
  );
}
