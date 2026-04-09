import type { StoredProfileHydrationResult } from "../../network";

import { ProfileSummaryCard } from "./profile-summary-card";

interface ShellStatusRailProps {
  readonly calibrationSampleCount: number;
  readonly calibrationQualityLabel: string;
  readonly calibrationStatusLabel: string;
  readonly gameplayInputModeLabel: string;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly metaverseControlModeLabel: string;
  readonly reticleCatalogLabel: string;
  readonly username: string;
}

export function ShellStatusRail({
  calibrationSampleCount,
  calibrationQualityLabel,
  calibrationStatusLabel,
  gameplayInputModeLabel,
  hydrationSource,
  metaverseControlModeLabel,
  reticleCatalogLabel,
  username
}: ShellStatusRailProps) {
  return (
    <aside>
      <ProfileSummaryCard
        calibrationSampleCount={calibrationSampleCount}
        calibrationQualityLabel={calibrationQualityLabel}
        calibrationStatusLabel={calibrationStatusLabel}
        gameplayInputModeLabel={gameplayInputModeLabel}
        hydrationSource={hydrationSource}
        metaverseControlModeLabel={metaverseControlModeLabel}
        reticleCatalogLabel={reticleCatalogLabel}
        username={username}
      />
    </aside>
  );
}
