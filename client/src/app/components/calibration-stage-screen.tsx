import { gameFoundationConfig } from "../../game";
import type { CalibrationShellState } from "../../navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { StageScreenLayout } from "./stage-screen-layout";

interface CalibrationStageScreenProps {
  readonly calibrationStatus: CalibrationShellState;
  readonly onContinue: () => void;
  readonly storedCalibrationCount: number;
}

export function CalibrationStageScreen({
  calibrationStatus,
  onContinue,
  storedCalibrationCount
}: CalibrationStageScreenProps) {
  return (
    <StageScreenLayout
      description="Milestone 1 stops at the calibration shell. The affine fit and live hand capture remain the next bounded slice."
      eyebrow="Stage 3"
      title="Calibration shell placeholder"
    >
      <div className="flex flex-wrap gap-2">
        <Badge>{`Shell status: ${calibrationStatus}`}</Badge>
        <Badge variant="secondary">
          {storedCalibrationCount > 0
            ? `${storedCalibrationCount} stored samples detected`
            : "No stored calibration samples yet"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {gameFoundationConfig.calibration.anchors.map((anchor) => (
          <div
            className="rounded-xl border border-border/70 bg-muted/30 px-4 py-4"
            key={anchor.id}
          >
            <p className="text-sm font-medium">{anchor.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {anchor.normalizedTarget.x.toFixed(1)}, {anchor.normalizedTarget.y.toFixed(1)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onContinue} type="button">
          Continue to gameplay shell
        </Button>
        <Badge variant="outline">
          Transform model: {gameFoundationConfig.calibration.transformModel}
        </Badge>
      </div>
    </StageScreenLayout>
  );
}
