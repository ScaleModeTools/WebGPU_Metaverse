import { navigationFlow } from "../../navigation";
import type { NavigationStepId } from "../../navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ShellProgressHeaderProps {
  readonly audioStatusLabel: string;
  readonly capabilityReasonLabel: string;
  readonly currentStepId: NavigationStepId;
  readonly musicVolumeLabel: string;
  readonly runtimeLocks: readonly string[];
  readonly sfxVolumeLabel: string;
}

export function ShellProgressHeader({
  audioStatusLabel,
  capabilityReasonLabel,
  currentStepId,
  musicVolumeLabel,
  runtimeLocks,
  sfxVolumeLabel
}: ShellProgressHeaderProps) {
  const currentStepIndex = navigationFlow.steps.findIndex(
    (step) => step.id === currentStepId
  );

  return (
    <header className="rounded-[2rem] border border-border/70 bg-card/82 p-6 shadow-[0_24px_80px_rgb(15_23_42_/_0.14)] backdrop-blur-xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Badge>Milestone 3 local arena</Badge>
          <Badge variant="secondary">Local-first profile</Badge>
          <Badge variant="secondary">Worker-first tracking live</Badge>
          <Badge variant="outline">WebGPU gameplay live</Badge>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
                ThumbShooter
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                The first calibrated local arena loop is now live in the client
                shell.
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                This build now carries login, persistence, worker tracking,
                nine-point calibration, explicit WebGPU gating, the in-game
                menu, readable bird enemies, and the first semiautomatic local
                combat loop.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {runtimeLocks.map((runtimeLock) => (
                <Badge key={runtimeLock} variant="secondary">
                  {runtimeLock}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Session state</p>
              <Badge variant="outline">{audioStatusLabel}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Music
                </p>
                <p className="mt-2 text-2xl font-semibold">{musicVolumeLabel}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  SFX
                </p>
                <p className="mt-2 text-2xl font-semibold">{sfxVolumeLabel}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
              Capability: {capabilityReasonLabel}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {navigationFlow.steps.map((step, index) => {
            const isCurrent = step.id === currentStepId;
            const isComplete = currentStepIndex > -1 && index < currentStepIndex;

            return (
              <div
                className="rounded-[1.25rem] border border-border/70 bg-background/72 px-3 py-3"
                key={step.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge
                    variant={
                      isCurrent ? "default" : isComplete ? "secondary" : "outline"
                    }
                  >
                    {isCurrent ? "Current" : isComplete ? "Ready" : "Pending"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium">{step.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
