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
  readonly hasAimCalibration: boolean;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly reticleCatalogLabel: string;
  readonly username: string;
}

export function ProfileSummaryCard({
  calibrationSampleCount,
  hasAimCalibration,
  hydrationSource,
  reticleCatalogLabel,
  username
}: ProfileSummaryCardProps) {
  return (
    <Card className="rounded-[2rem] border-border/70 bg-card/82 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Profile summary</CardTitle>
        <CardDescription>
          Local-first state that the arena loop still builds on instead of
          replacing.
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
          Aim calibration: {hasAimCalibration ? "ready" : "pending"}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Reticle catalog: {reticleCatalogLabel}
        </div>
      </CardContent>
    </Card>
  );
}
