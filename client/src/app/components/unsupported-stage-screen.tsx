import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { StageScreenLayout } from "./stage-screen-layout";

interface UnsupportedStageScreenProps {
  readonly capabilityReasonLabel: string;
  readonly onEditProfile: () => void;
  readonly onRetry: () => void;
}

export function UnsupportedStageScreen({
  capabilityReasonLabel,
  onEditProfile,
  onRetry
}: UnsupportedStageScreenProps) {
  return (
    <StageScreenLayout
      description="Gameplay mode is intentionally blocked here. The client shell stays usable, but the gameplay runtime never downgrades behind your back."
      eyebrow="Unsupported"
      title="WebGPU gameplay unavailable"
    >
      <div className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 p-5">
        <div className="flex flex-col gap-3">
          <Badge variant="destructive">Stop-ship fallback gate active</Badge>
          <p className="text-sm text-destructive">{capabilityReasonLabel}</p>
          <p className="text-sm text-muted-foreground">
            Unsupported clients can stay in the shell flow, but gameplay mode is
            not allowed to degrade into WebGL or another renderer path.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onRetry} type="button" variant="outline">
          Retry WebGPU probe
        </Button>
        <Button onClick={onEditProfile} type="button">
          Back to login
        </Button>
      </div>
    </StageScreenLayout>
  );
}
