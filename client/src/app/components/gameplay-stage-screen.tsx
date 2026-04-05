import { viewportOverlayPlan } from "../../ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface GameplayStageScreenProps {
  readonly audioStatusLabel: string;
  readonly onOpenMenu: () => void;
  readonly selectedReticleLabel: string;
  readonly username: string;
  readonly weaponLabel: string;
}

export function GameplayStageScreen({
  audioStatusLabel,
  onOpenMenu,
  selectedReticleLabel,
  username,
  weaponLabel
}: GameplayStageScreenProps) {
  return (
    <Card className="relative min-h-[36rem] overflow-hidden rounded-[2rem] border-border/70 bg-card/88 shadow-[0_28px_90px_rgb(15_23_42_/_0.2)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(56_189_248_/_0.16),_transparent_32%),linear-gradient(135deg,_rgb(15_23_42_/_0.88),_rgb(30_41_59_/_0.94))]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgb(255_255_255_/_0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.04)_1px,transparent_1px)] [background-size:3rem_3rem]" />

      <div className="relative flex h-full flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
            <div className="flex flex-wrap gap-2">
              <Badge>{`Instructions: ${viewportOverlayPlan.instructionsPlacement}`}</Badge>
              <Badge variant="secondary">{`HUD: ${viewportOverlayPlan.hudPlacement}`}</Badge>
              <Badge variant="outline">{audioStatusLabel}</Badge>
            </div>
            <p className="mt-4 text-sm text-white/82">
              The live arena is not running yet. This shell keeps the viewport,
              reticle lane, and menu entry path ready for milestone 2.
            </p>
          </div>

          <Button onClick={onOpenMenu} type="button" variant="secondary">
            Open menu
          </Button>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          <div className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-white/10" />
          <div className="relative flex size-24 items-center justify-center rounded-full border border-white/20 bg-white/6 backdrop-blur-sm">
            <div className="size-12 rounded-full border-2 border-white" />
            <div className="absolute h-px w-7 bg-white" />
            <div className="absolute h-7 w-px bg-white" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
            <p className="text-sm font-medium text-white">Player</p>
            <p className="mt-2 text-2xl font-semibold text-white">{username}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
            <p className="text-sm font-medium text-white">Reticle</p>
            <p className="mt-2 text-sm text-white/82">{selectedReticleLabel}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
            <p className="text-sm font-medium text-white">Weapon lock</p>
            <p className="mt-2 text-sm text-white/82">{weaponLabel}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
