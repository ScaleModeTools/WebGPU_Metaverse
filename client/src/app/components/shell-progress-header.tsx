import { StableInlineText } from "@/components/text-stability";
import { Badge } from "@/components/ui/badge";

const audioStatusLabels = [
  "Awaiting user gesture",
  "Unlocking audio",
  "Audio unlock failed",
  "Audio unavailable",
  "Audio unlocked",
  "Audio unlocked, Strudel primed"
] as const;

interface ShellProgressHeaderProps {
  readonly audioStatusLabel: string;
  readonly capabilityReasonLabel: string;
  readonly musicVolumeLabel: string;
  readonly runtimeLocks: readonly string[];
  readonly sfxVolumeLabel: string;
}

export function ShellProgressHeader({
  audioStatusLabel,
  capabilityReasonLabel,
  musicVolumeLabel,
  runtimeLocks,
  sfxVolumeLabel
}: ShellProgressHeaderProps) {
  return (
    <header className="rounded-[2rem] border border-border/70 bg-card/82 p-6 shadow-[0_24px_80px_rgb(15_23_42_/_0.14)] backdrop-blur-xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Badge>Ocean metaverse shell live</Badge>
          <Badge variant="secondary">Mouse enters immediately</Badge>
          <Badge variant="secondary">Camera setup still optional</Badge>
          <Badge variant="outline">WebGPU required</Badge>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="type-kicker">
                WebGPU Metaverse
              </p>
              <h1 className="type-display max-w-4xl">
                Login confirms the local profile, setup prepares the controller
                path, and the ocean hub launches named experiences.
              </h1>
              <p className="type-lead max-w-3xl">
                Mouse players can enter the metaverse without touching webcam
                permissions. Thumb-trigger setup stays explicit whenever you
                want worker tracking, webcam permission, and nine-point
                calibration before a portal launch.
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
              <p className="type-label">Session state</p>
              <Badge variant="outline">
                <StableInlineText
                  reserveTexts={audioStatusLabels}
                  text={audioStatusLabel}
                />
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                <p className="type-caption">
                  Music
                </p>
                <p className="type-metric mt-2">
                  <StableInlineText text={musicVolumeLabel} />
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                <p className="type-caption">
                  SFX
                </p>
                <p className="type-metric mt-2">
                  <StableInlineText text={sfxVolumeLabel} />
                </p>
              </div>
            </div>
            <div className="type-body-muted rounded-xl border border-border/70 bg-background/70 px-3 py-3">
              Capability: {capabilityReasonLabel}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
