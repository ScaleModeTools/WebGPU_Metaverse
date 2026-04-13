import type { FormEvent } from "react";

import type { GameplayInputModeId } from "@webgpu-metaverse/shared";

import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse/types/webgpu-capability";
import type { MetaverseEntryStepId } from "../../navigation";
import { StableInlineText } from "@/components/text-stability";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ShellEntryStageScreenProps {
  readonly capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"];
  readonly hasConfirmedProfile: boolean;
  readonly hasStoredProfile: boolean;
  readonly inputMode: GameplayInputModeId;
  readonly loginError: string | null;
  readonly nextMetaverseStep: MetaverseEntryStepId | null;
  readonly onClearProfile: () => void;
  readonly onEditProfile: () => void;
  readonly onEnterMetaverse: () => void;
  readonly onRequestPermission: () => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly setUsernameDraft: (value: string) => void;
  readonly usernameDraft: string;
}

const profileSubmitLabels = [
  "Resume local profile",
  "Create local profile"
] as const;
const launchActionLabels = [
  "Start",
  "Camera setup",
  "Calibration",
  "Checking WebGPU",
  "Metaverse unavailable"
] as const;

function resolveLaunchActionLabel(
  capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"],
  nextMetaverseStep: MetaverseEntryStepId | null
): string {
  if (nextMetaverseStep === "metaverse") {
    return "Start";
  }

  if (nextMetaverseStep === "permissions") {
    return "Camera setup";
  }

  if (nextMetaverseStep === "calibration") {
    return "Calibration";
  }

  if (capabilityStatus === "checking") {
    return "Checking WebGPU";
  }

  return "Metaverse unavailable";
}

function resolveStageDescription(
  hasConfirmedProfile: boolean,
  nextMetaverseStep: MetaverseEntryStepId | null
): string {
  if (!hasConfirmedProfile) {
    return "Choose a username to continue.";
  }

  if (nextMetaverseStep === "permissions") {
    return "Camera setup is ready when you want it.";
  }

  if (nextMetaverseStep === "calibration") {
    return "Calibration is available before launch.";
  }

  return "Start the hub or open optional setup.";
}

export function ShellEntryStageScreen({
  capabilityStatus,
  hasConfirmedProfile,
  hasStoredProfile,
  inputMode,
  loginError,
  nextMetaverseStep,
  onClearProfile,
  onEditProfile,
  onEnterMetaverse,
  onRequestPermission,
  onRecalibrationRequest,
  onSubmit,
  setUsernameDraft,
  usernameDraft
}: ShellEntryStageScreenProps) {
  const profileSubmitLabel = hasStoredProfile
    ? "Resume local profile"
    : "Create local profile";
  const launchActionLabel = resolveLaunchActionLabel(
    capabilityStatus,
    nextMetaverseStep
  );
  const canLaunch = nextMetaverseStep !== null;
  const showRecalibrationButton =
    hasConfirmedProfile &&
    inputMode === "camera-thumb-trigger" &&
    nextMetaverseStep === "metaverse";
  const onPrimaryAction =
    nextMetaverseStep === "permissions"
      ? onRequestPermission
      : nextMetaverseStep === "calibration"
        ? onRecalibrationRequest
        : onEnterMetaverse;

  return (
    <section className="relative overflow-x-hidden bg-game-stage text-game-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgb(125_211_252/0.16),transparent_26%),radial-gradient(circle_at_80%_20%,rgb(251_146_60/0.12),transparent_18%),linear-gradient(180deg,rgb(2_6_23/0.26),transparent_42%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-4xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-xl flex-col gap-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="type-game-banner">WebGPU Metaverse</p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-game-foreground sm:text-5xl">
              {hasConfirmedProfile ? "Ready." : "Start."}
            </h1>
            <p className="max-w-md text-sm leading-6 text-game-muted sm:text-base">
              {resolveStageDescription(hasConfirmedProfile, nextMetaverseStep)}
            </p>
          </div>

          <Card className="surface-game-overlay rounded-[1.75rem] text-game-foreground shadow-[0_24px_90px_rgb(2_6_23_/_0.36)]">
            <CardHeader className="gap-2">
              <CardTitle className="font-heading text-2xl font-semibold tracking-tight text-game-foreground">
                {hasConfirmedProfile
                  ? usernameDraft
                  : hasStoredProfile
                    ? "Resume profile"
                    : "Create profile"}
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-game-muted">
                {hasConfirmedProfile
                  ? "Primary actions only."
                  : "Local profile only."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {hasConfirmedProfile ? (
                <>
                  <Button
                    className="w-full"
                    disabled={!canLaunch}
                    onClick={onPrimaryAction}
                    size="lg"
                    type="button"
                  >
                    <StableInlineText
                      reserveTexts={launchActionLabels}
                      text={launchActionLabel}
                    />
                  </Button>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {showRecalibrationButton ? (
                      <Button
                        className="w-full"
                        onClick={onRecalibrationRequest}
                        size="lg"
                        type="button"
                        variant="outline"
                      >
                        Recalibrate
                      </Button>
                    ) : null}
                    <Button
                      className="w-full"
                      onClick={onEditProfile}
                      size="lg"
                      type="button"
                      variant="outline"
                    >
                      Change name
                    </Button>
                    <Button
                      className="w-full"
                      onClick={onClearProfile}
                      size="lg"
                      type="button"
                      variant="outline"
                    >
                      Clear local profile
                    </Button>
                  </div>
                </>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                  <div className="flex flex-col gap-2">
                    <Label className="text-game-foreground" htmlFor="login-username">
                      Username
                    </Label>
                    <Input
                      aria-invalid={loginError !== null}
                      autoComplete="nickname"
                      className="h-11"
                      id="login-username"
                      onChange={(event) => setUsernameDraft(event.target.value)}
                      placeholder="Enter username"
                      value={usernameDraft}
                    />
                    {loginError !== null ? (
                      <div className="surface-game-danger rounded-xl px-3 py-3 text-sm leading-6">
                        {loginError}
                      </div>
                    ) : null}
                  </div>

                  <Button className="w-full" size="lg" type="submit">
                    <StableInlineText
                      reserveTexts={profileSubmitLabels}
                      text={profileSubmitLabel}
                    />
                  </Button>

                  {hasStoredProfile ? (
                    <Button
                      className="w-full"
                      onClick={onClearProfile}
                      size="lg"
                      type="button"
                      variant="outline"
                    >
                      Clear local profile
                    </Button>
                  ) : null}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
