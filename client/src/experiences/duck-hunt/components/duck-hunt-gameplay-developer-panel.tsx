import type { GameplayTelemetrySnapshot } from "../types/duck-hunt-gameplay-presentation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

interface DuckHuntGameplayDeveloperPanelProps {
  readonly gameplayTelemetry: GameplayTelemetrySnapshot;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function DuckHuntGameplayDeveloperPanel({
  gameplayTelemetry
}: DuckHuntGameplayDeveloperPanelProps) {
  const metrics = [
    {
      label: "FPS",
      value: gameplayTelemetry.frameRate.toFixed(1)
    },
    {
      label: "Renderer",
      value: gameplayTelemetry.renderer.label
    },
    {
      label: "Draw calls",
      value: formatCount(gameplayTelemetry.renderer.drawCallCount)
    },
    {
      label: "Triangles",
      value: formatCount(gameplayTelemetry.renderer.triangleCount)
    },
    {
      label: "DPR",
      value: gameplayTelemetry.renderer.devicePixelRatio.toFixed(2)
    }
  ] as const;

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-30 w-56">
      <Card
        className="gap-3 border-border/70 bg-card/90 shadow-lg backdrop-blur-md"
        size="sm"
      >
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="type-caption">
            Developer
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs">
          {metrics.map((metric) => (
            <div className="flex items-baseline justify-between gap-3" key={metric.label}>
              <span className="type-detail-muted">{metric.label}</span>
              <span className="type-detail font-medium">{metric.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
