import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function MilestoneBoundariesCard() {
  return (
    <Card className="rounded-[2rem] border-border/70 bg-card/82 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Milestone boundaries</CardTitle>
        <CardDescription>
          Intentionally excluded from this unattended pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Live hand tracking worker
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Arena runtime and birds behavior
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Weapon fire and reload loop
        </div>
      </CardContent>
    </Card>
  );
}
