import type { StoredProfileHydrationResult } from "../../network";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

interface ProfileSummaryCardProps {
  readonly calibrationSampleCount: number;
  readonly calibrationQualityLabel: string;
  readonly calibrationStatusLabel: string;
  readonly gameplayInputModeLabel: string;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly metaverseControlModeLabel: string;
  readonly reticleCatalogLabel: string;
  readonly username: string;
}

export function ProfileSummaryCard({
  calibrationSampleCount,
  calibrationQualityLabel,
  calibrationStatusLabel,
  gameplayInputModeLabel,
  hydrationSource,
  metaverseControlModeLabel,
  reticleCatalogLabel,
  username
}: ProfileSummaryCardProps) {
  return (
    <Card className="rounded-[2rem] border-border/70 bg-card/82 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Profile summary</CardTitle>
        <CardDescription>
          Current local player state for the menu and arena session.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Username: {username}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Hydration source: {hydrationSource}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Calibration samples: {calibrationSampleCount}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Aim calibration: {calibrationStatusLabel}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Calibration quality: {calibrationQualityLabel}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Duck Hunt input: {gameplayInputModeLabel}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Hub controls: {metaverseControlModeLabel}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Reticle catalog: {reticleCatalogLabel}
        </div>
      </CardContent>
    </Card>
  );
}
