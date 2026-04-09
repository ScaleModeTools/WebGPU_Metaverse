import {
  gameplayInputModes,
  resolveGameplayInputMode,
  type GameplayInputModeId
} from "@webgpu-metaverse/shared";
import type { MetaverseEntryStepId } from "../../navigation";
import {
  metaverseControlModes,
  resolveMetaverseControlMode
} from "../../metaverse/config/metaverse-control-modes";
import type { MetaverseControlModeId } from "../../metaverse/types/metaverse-control-mode";
import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse/types/webgpu-capability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";

import { StageScreenLayout } from "./stage-screen-layout";

interface MainMenuStageScreenProps {
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly capabilityReasonLabel: string;
  readonly capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"];
  readonly inputMode: GameplayInputModeId;
  readonly metaverseControlMode: MetaverseControlModeId;
  readonly nextMetaverseStep: MetaverseEntryStepId | null;
  readonly onEnterMetaverse: () => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onMetaverseControlModeChange: (
    controlMode: MetaverseControlModeId
  ) => void;
  readonly onRecalibrationRequest: () => void;
}

function resolveEnterMetaverseLabel(
  capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"],
  nextMetaverseStep: MetaverseEntryStepId | null
): string {
  if (nextMetaverseStep === "metaverse") {
    return "Enter metaverse";
  }

  if (nextMetaverseStep === "calibration") {
    return "Continue to calibration";
  }

  if (nextMetaverseStep === "permissions") {
    return "Continue to webcam setup";
  }

  if (capabilityStatus === "checking") {
    return "Checking WebGPU support";
  }

  return "Metaverse unavailable";
}

export function MainMenuStageScreen({
  audioStatusLabel,
  calibrationQualityLabel,
  capabilityReasonLabel,
  capabilityStatus,
  inputMode,
  metaverseControlMode,
  nextMetaverseStep,
  onEnterMetaverse,
  onInputModeChange,
  onMetaverseControlModeChange,
  onRecalibrationRequest
}: MainMenuStageScreenProps) {
  const selectedInputMode = resolveGameplayInputMode(inputMode);
  const selectedMetaverseControlMode =
    resolveMetaverseControlMode(metaverseControlMode);
  const canEnterMetaverse = nextMetaverseStep !== null;

  return (
    <StageScreenLayout
      description="Set hub controls separately from experience gameplay input, keep WebGPU readiness explicit, and then enter the ocean shell."
      eyebrow="Pre-metaverse setup"
      title="Choose hub controls and experience input"
    >
      <div className="flex flex-wrap gap-2">
        <Badge>Hub: {selectedMetaverseControlMode.label}</Badge>
        <Badge>Duck Hunt: {selectedInputMode.label}</Badge>
        <Badge variant="secondary">{audioStatusLabel}</Badge>
        <Badge variant="outline">WebGPU {capabilityStatus}</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="rounded-[1.5rem] border-border/70 bg-muted/35">
          <CardHeader className="gap-3">
            <CardTitle>Control paths</CardTitle>
            <CardDescription>
              Hub controls now stay separate from Duck Hunt launch input. Mouse
              aim or camera thumb-trigger belong to the experience; keyboard or
              mouse flight belong to the hub.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Hub controls</p>
              <ToggleGroup
                className="w-full"
                onValueChange={(nextValue) => {
                  if (nextValue.length === 0) {
                    return;
                  }

                  onMetaverseControlModeChange(nextValue as MetaverseControlModeId);
                }}
                type="single"
                value={metaverseControlMode}
                variant="outline"
              >
                {metaverseControlModes.map((controlMode) => (
                  <ToggleGroupItem
                    className="flex-1"
                    key={controlMode.id}
                    value={controlMode.id}
                  >
                    {controlMode.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                {selectedMetaverseControlMode.description}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {selectedMetaverseControlMode.controlsSummary.map((instruction) => (
                  <div
                    className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground"
                    key={instruction}
                  >
                    {instruction}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">
                Duck Hunt launch input
              </p>
              <ToggleGroup
                className="w-full"
                onValueChange={(nextValue) => {
                  if (nextValue.length === 0) {
                    return;
                  }

                  onInputModeChange(nextValue as GameplayInputModeId);
                }}
                type="single"
                value={inputMode}
                variant="outline"
              >
                {gameplayInputModes.map((mode) => (
                  <ToggleGroupItem className="flex-1" key={mode.id} value={mode.id}>
                    {mode.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                {selectedInputMode.description}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {selectedInputMode.controlsSummary.map((instruction) => (
                  <div
                    className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground"
                    key={instruction}
                  >
                    {instruction}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-border/70 bg-muted/35">
          <CardHeader className="gap-3">
            <CardTitle>Hub readiness</CardTitle>
            <CardDescription>
              The ocean scene uses the same WebGPU renderer foundation as Duck
              Hunt, so capability still stays explicit before the hub starts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4">
                <p className="text-sm font-medium text-foreground">Capability</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {capabilityReasonLabel}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4">
                <p className="text-sm font-medium text-foreground">Duck Hunt setup</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedInputMode.requiresCalibration
                    ? calibrationQualityLabel
                    : "Not required while mouse aim is selected."}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              Duck Hunt launch details now live inside the in-world portal. Use
              this setup surface to pick hub controls, choose gameplay input,
              and keep camera setup optional instead of blocking the hub.
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                disabled={!canEnterMetaverse}
                onClick={onEnterMetaverse}
                type="button"
              >
                {resolveEnterMetaverseLabel(capabilityStatus, nextMetaverseStep)}
              </Button>

              {selectedInputMode.requiresCalibration ? (
                <Button
                  onClick={onRecalibrationRequest}
                  type="button"
                  variant="outline"
                >
                  Restart calibration
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </StageScreenLayout>
  );
}
