import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

interface ProfileSummaryCardProps {
  readonly calibrationSampleCount: number;
  readonly hydrationSource: string;
  readonly reticleCatalogLabel: string;
  readonly username: string;
}

export function ProfileSummaryCard({
  calibrationSampleCount,
  hydrationSource,
  reticleCatalogLabel,
  username
}: ProfileSummaryCardProps) {
  return (
    <Card className="rounded-[2rem] border-border/70 bg-card/82 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Profile summary</CardTitle>
        <CardDescription>
          Local-first state that milestone 2 can extend instead of replacing.
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
          Reticle catalog: {reticleCatalogLabel}
        </div>
      </CardContent>
    </Card>
  );
}
