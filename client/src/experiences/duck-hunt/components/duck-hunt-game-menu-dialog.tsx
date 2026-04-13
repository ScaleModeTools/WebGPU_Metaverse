import { gameMenuPlan } from "../config/duck-hunt-game-menu-plan";
import {
  gameplayInputModes,
  resolveGameplayInputMode,
  gameplaySessionModes,
  type GameplayInputModeId,
  type GameplaySessionMode
} from "@webgpu-metaverse/shared";
import {
  type GameplayDebugPanelMode,
} from "../types/duck-hunt-gameplay-presentation";
import { StableInlineText } from "@/components/text-stability";
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
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";

type SliderValue = [number];

const debugModeButtonLabels = ["Active", "Enable"] as const;
const audioStatusLabels = [
  "Awaiting user gesture",
  "Unlocking audio",
  "Audio unlock failed",
  "Audio unavailable",
  "Audio unlocked",
  "Audio unlocked, Strudel primed"
] as const;

interface DuckHuntGameMenuDialogProps {
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly gameplayStatusLabel: string;
  readonly inputMode: GameplayInputModeId;
  readonly musicVolume: SliderValue;
  readonly onDebugPanelModeChange: (mode: GameplayDebugPanelMode) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onReturnToMetaverseRequest: () => void;
  readonly sfxVolume: SliderValue;
  readonly onMusicVolumeChange: (nextValue: number) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly onRecalibrationRequest: () => void;
  readonly onSessionModeChange: (mode: GameplaySessionMode) => void;
  readonly onSfxVolumeChange: (nextValue: number) => void;
  readonly sessionMode: GameplaySessionMode;
  readonly showDebugControls: boolean;
}

export function DuckHuntGameMenuDialog({
  audioStatusLabel,
  calibrationQualityLabel,
  debugPanelMode,
  gameplayStatusLabel,
  inputMode,
  musicVolume,
  onDebugPanelModeChange,
  onInputModeChange,
  onReturnToMetaverseRequest,
  sfxVolume,
  onMusicVolumeChange,
  onOpenChange,
  open,
  onRecalibrationRequest,
  onSessionModeChange,
  onSfxVolumeChange,
  sessionMode,
  showDebugControls
}: DuckHuntGameMenuDialogProps) {
  const selectedInputMode = resolveGameplayInputMode(inputMode);
  const menuInsetClassName = "surface-game-inset rounded-xl p-3";
  const menuSeparatorClassName = "bg-[color:var(--game-border)]";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="surface-game-overlay max-w-[calc(100%-1.5rem)] gap-5 p-5 text-[color:var(--game-foreground)] ring-[color:var(--game-border)] shadow-[0_28px_90px_rgb(15_23_42/_0.32)] sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge>
              <StableInlineText text={gameplayStatusLabel} />
            </Badge>
            <Badge variant="secondary">
              <StableInlineText
                reserveTexts={audioStatusLabels}
                text={audioStatusLabel}
              />
            </Badge>
            <Badge variant="outline">
              Entry: {gameMenuPlan.entryActions.join(" / ")}
            </Badge>
          </div>
          <DialogTitle className="type-game-heading">In-game menu</DialogTitle>
          <DialogDescription className="type-game-body">
            Adjust the live arena session, return to the metaverse portal, or
            switch to a different control path.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-game-title">Controls</p>
                <p className="type-game-body">
                  {selectedInputMode.description}
                </p>
              </div>
              <Badge variant="outline">
                {gameMenuPlan.sections.find((section) => section.id === "controls")?.label}
              </Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {selectedInputMode.controlsSummary.map((instruction) => (
                <div
                  className={`${menuInsetClassName} type-game-body`}
                  key={instruction}
                >
                  {instruction}
                </div>
              ))}
            </div>
          </section>

          <Separator className={menuSeparatorClassName} />

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-game-title">Session mode</p>
                <p className="type-game-body">
                  Changing the authority model returns the session to the metaverse.
                </p>
              </div>
              <Badge variant="outline">Authority</Badge>
            </div>

            <ToggleGroup
              className="w-full"
              onValueChange={(nextValue) => {
                if (nextValue.length === 0) {
                  return;
                }

                onSessionModeChange(nextValue as GameplaySessionMode);
              }}
              type="single"
              value={sessionMode}
              variant="outline"
            >
              {gameplaySessionModes.map((mode) => (
                <ToggleGroupItem className="flex-1" key={mode} value={mode}>
                  {mode === "single-player" ? "Single player" : "Co-op"}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </section>

          <Separator className={menuSeparatorClassName} />

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-game-title">Input mode</p>
                <p className="type-game-body">
                  Changing the active input returns the session to the metaverse.
                </p>
              </div>
              <Badge variant="outline">
                {gameMenuPlan.sections.find((section) => section.id === "input")?.label}
              </Badge>
            </div>

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
          </section>

          <Separator className={menuSeparatorClassName} />

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-game-title">Audio mix</p>
                <p className="type-game-body">
                  Shell settings persist to the local player profile immediately.
                </p>
              </div>
              <Badge variant="outline">
                {gameMenuPlan.audioControls.join(" / ")}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className={`${menuInsetClassName} flex flex-col gap-3`}>
                <div className="flex items-center justify-between gap-3">
                  <Label
                    className="type-game-title text-[color:var(--game-foreground)]"
                    htmlFor="menu-music-volume"
                  >
                    Music volume
                  </Label>
                  <Badge variant="secondary">
                    <StableInlineText text={`${musicVolume[0]}%`} />
                  </Badge>
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

              <div className={`${menuInsetClassName} flex flex-col gap-3`}>
                <div className="flex items-center justify-between gap-3">
                  <Label
                    className="type-game-title text-[color:var(--game-foreground)]"
                    htmlFor="menu-sfx-volume"
                  >
                    SFX volume
                  </Label>
                  <Badge variant="secondary">
                    <StableInlineText text={`${sfxVolume[0]}%`} />
                  </Badge>
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

          {showDebugControls ? (
            <>
              <Separator className={menuSeparatorClassName} />

              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="type-game-title">Developer overlays</p>
                    <p className="type-game-body">
                      Development-only telemetry stays separate from the player HUD.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {gameMenuPlan.sections.find((section) => section.id === "debug")?.label}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {gameMenuPlan.debugModes.map((mode) => (
                    <div
                      className={menuInsetClassName}
                      key={mode.mode}
                    >
                      <p className="type-game-title">{mode.label}</p>
                      <p className="type-game-body mt-2">
                        {mode.description}
                      </p>
                      <Button
                        className="mt-3 w-full"
                        onClick={() => onDebugPanelModeChange(mode.mode)}
                        type="button"
                        variant={debugPanelMode === mode.mode ? "secondary" : "outline"}
                      >
                        <StableInlineText
                          reserveTexts={debugModeButtonLabels}
                          text={debugPanelMode === mode.mode ? "Active" : "Enable"}
                        />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <Separator className={menuSeparatorClassName} />
            </>
          ) : (
            <Separator className={menuSeparatorClassName} />
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="type-game-title">Calibration</p>
                <p className="type-game-body">
                  {selectedInputMode.requiresCalibration
                    ? `${gameMenuPlan.recalibrationAction.replaceAll("-", " ")} · ${calibrationQualityLabel}`
                    : "Mouse mode bypasses calibration and hand tracking."}
                </p>
              </div>
              <Badge variant="outline">
                {gameMenuPlan.sections.find((section) => section.id === "calibration")?.label}
              </Badge>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                onClick={onReturnToMetaverseRequest}
                type="button"
                variant="secondary"
              >
                Return to metaverse
              </Button>
              {selectedInputMode.requiresCalibration ? (
                <Button onClick={onRecalibrationRequest} type="button" variant="outline">
                  Restart nine-point calibration
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
