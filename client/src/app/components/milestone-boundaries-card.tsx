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
          Still intentionally excluded after the first playable local arena
          milestone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Server-authoritative gameplay
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Multiplayer and network sync
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Automatic weapons
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          Off-screen reload behavior
        </div>
      </CardContent>
    </Card>
  );
}
