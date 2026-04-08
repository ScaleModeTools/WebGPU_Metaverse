import { gameFoundationConfig } from "../../game/config/game-foundation";
import type { WebcamPermissionState } from "../../navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

import { StageScreenLayout } from "./stage-screen-layout";

interface PermissionStageScreenProps {
  readonly capabilityReasonLabel: string;
  readonly capabilityStatus: string;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly onRequestPermission: () => void;
}

export function PermissionStageScreen({
  capabilityReasonLabel,
  capabilityStatus,
  permissionError,
  permissionState,
  onRequestPermission
}: PermissionStageScreenProps) {
  return (
    <StageScreenLayout
      description="Mouse mode skips this step. Enable webcam access only when you want thumb-shooter tracking and firing."
      eyebrow="Optional camera setup"
      title="Enable webcam for thumb-shooter mode"
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge>{`Permission: ${permissionState}`}</Badge>
            <Badge variant="secondary">{`WebGPU: ${capabilityStatus}`}</Badge>
          </div>

          <div className="rounded-[1.5rem] border border-border/70 bg-muted/35 p-5">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                ThumbShooter requests a user-facing webcam stream and releases it
                immediately after the permission boundary succeeds. The
                worker-owned Hand Landmarker boots lazily on the calibration
                screen.
              </p>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                {capabilityReasonLabel}
              </div>
              {permissionError !== null ? (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  {permissionError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={permissionState === "requesting"}
              onClick={onRequestPermission}
              type="button"
            >
              {permissionState === "requesting"
                ? "Requesting permission"
                : "Enable webcam for thumb-shooter"}
            </Button>
          </div>
        </div>

        <Card className="rounded-[1.5rem] border-border/70 bg-muted/35">
          <CardHeader>
            <CardTitle>Capability policy</CardTitle>
            <CardDescription>
              Gameplay stays WebGPU-only. Unsupported clients fail into a clear
              route instead of silently downgrading.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
              Renderer target: {gameFoundationConfig.renderer.target}
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
              Import surface: {gameFoundationConfig.renderer.threeImportSurface}
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
              Fallback policy: {gameFoundationConfig.runtime.webGpuFallbackPolicy}
            </div>
          </CardContent>
        </Card>
      </div>
    </StageScreenLayout>
  );
}
