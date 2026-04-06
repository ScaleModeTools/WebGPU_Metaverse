import { gameMenuPlan } from "../config/game-menu-plan";
import type { GameplayDebugPanelMode } from "../../game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type SliderValue = [number];

interface GameMenuDialogProps {
  readonly open: boolean;
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly gameplayStatusLabel: string;
  readonly musicVolume: SliderValue;
  readonly onDebugPanelModeChange: (mode: GameplayDebugPanelMode) => void;
  readonly sfxVolume: SliderValue;
  readonly onMusicVolumeChange: (nextValue: number) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSfxVolumeChange: (nextValue: number) => void;
}

export function GameMenuDialog({
  open,
  audioStatusLabel,
  calibrationQualityLabel,
  debugPanelMode,
  gameplayStatusLabel,
  musicVolume,
  onDebugPanelModeChange,
  sfxVolume,
  onMusicVolumeChange,
  onOpenChange,
  onRecalibrationRequest,
  onSfxVolumeChange
}: GameMenuDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-[calc(100%-1.5rem)] gap-5 sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge>{gameplayStatusLabel}</Badge>
            <Badge variant="secondary">{audioStatusLabel}</Badge>
            <Badge variant="outline">
              Entry: {gameMenuPlan.entryActions.join(" / ")}
            </Badge>
          </div>
          <DialogTitle>In-game menu</DialogTitle>
          <DialogDescription>
            The calibrated local arena loop is live with bird scatter, local
            hit reactions, and the first semiautomatic pistol reset rhythm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Controls</p>
                <p className="text-sm text-muted-foreground">
                  Live calibrated aim, semiautomatic trigger reset, and local
                  enemy reactions are all active in the arena loop.
                </p>
              </div>
              <Badge variant="outline">{gameMenuPlan.sections[0]?.label}</Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {gameMenuPlan.controlsSummary.map((instruction) => (
                <div
                  className="rounded-xl border border-border/70 bg-muted/30 px-3 py-3 text-sm text-muted-foreground"
                  key={instruction}
                >
                  {instruction}
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Audio mix</p>
                <p className="text-sm text-muted-foreground">
                  Shell settings persist to the local player profile immediately.
                </p>
              </div>
              <Badge variant="outline">
                {gameMenuPlan.audioControls.join(" / ")}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="menu-music-volume">Music volume</Label>
                  <Badge variant="secondary">{musicVolume[0]}%</Badge>
                </div>
                <Slider
                  id="menu-music-volume"
                  max={100}
                  min={0}
                  onValueChange={(nextValue) =>
                    onMusicVolumeChange(nextValue[0] ?? musicVolume[0])
                  }
                  step={1}
                  value={musicVolume}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="menu-sfx-volume">SFX volume</Label>
                  <Badge variant="secondary">{sfxVolume[0]}%</Badge>
                </div>
                <Slider
                  id="menu-sfx-volume"
                  max={100}
                  min={0}
                  onValueChange={(nextValue) =>
                    onSfxVolumeChange(nextValue[0] ?? sfxVolume[0])
                  }
                  step={1}
                  value={sfxVolume}
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Debug view</p>
                <p className="text-sm text-muted-foreground">
                  Sampled telemetry stays optional and shell-owned instead of
                  leaking into the gameplay loop.
                </p>
              </div>
              <Badge variant="outline">{gameMenuPlan.sections[2]?.label}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {gameMenuPlan.debugModes.map((mode) => (
                <div
                  className="rounded-xl border border-border/70 bg-muted/30 p-3"
                  key={mode.mode}
                >
                  <p className="text-sm font-medium text-foreground">{mode.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {mode.description}
                  </p>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => onDebugPanelModeChange(mode.mode)}
                    type="button"
                    variant={debugPanelMode === mode.mode ? "secondary" : "outline"}
                  >
                    {debugPanelMode === mode.mode ? "Active" : "Enable"}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Calibration</p>
              <p className="text-sm text-muted-foreground">
                {gameMenuPlan.recalibrationAction.replaceAll("-", " ")} ·{" "}
                {calibrationQualityLabel}
              </p>
            </div>

            <Button onClick={onRecalibrationRequest} variant="outline">
              Restart nine-point calibration
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
