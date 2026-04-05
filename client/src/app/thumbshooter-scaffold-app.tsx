import { useState } from "react";

import { reticleManifest } from "../assets";
import { audioFoundationConfig } from "../audio";
import { gameFoundationConfig } from "../game";
import { profileStoragePlan } from "../network";
import { navigationFlow } from "../navigation";
import { gameMenuPlan, viewportOverlayPlan } from "../ui";
import { Badge } from "@/components/ui/badge";
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
import { Slider } from "@/components/ui/slider";

type SliderValue = [number];

interface SummaryCardProps {
  readonly title: string;
  readonly items: readonly string[];
}

const toPercent = (value: number): string => `${Math.round(value)}%`;
const toSliderValue = (value: number): SliderValue => [
  Math.round(Number(value) * 100)
];

function SummaryCard({ title, items }: SummaryCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li
              className="rounded-lg border border-border/60 bg-background/45 px-3 py-2"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ThumbShooterScaffoldApp() {
  const [username, setUsername] = useState("ScaleModeTools");
  const [musicVolume, setMusicVolume] = useState<SliderValue>(
    toSliderValue(audioFoundationConfig.defaultMix.musicVolume)
  );
  const [sfxVolume, setSfxVolume] = useState<SliderValue>(
    toSliderValue(audioFoundationConfig.defaultMix.sfxVolume)
  );

  const runtimeLocks = [
    `Renderer: ${gameFoundationConfig.renderer.target}`,
    `Imports: ${gameFoundationConfig.renderer.threeImportSurface}`,
    `Shaders: ${gameFoundationConfig.renderer.shaderAuthoringModel}`,
    `Tracking: ${gameFoundationConfig.runtime.handTrackingExecutionModel}`,
    `Transport: ${gameFoundationConfig.runtime.handTrackingTransport}`,
    `Fallback: ${gameFoundationConfig.runtime.webGpuFallbackPolicy}`,
    `Calibration: ${gameFoundationConfig.calibration.transformModel}`,
    `Weapon: ${gameFoundationConfig.weapon.firstPlayableWeapon}`,
    `BGM: ${audioFoundationConfig.music.engine}`,
    `SFX: ${audioFoundationConfig.soundEffects.engine}`
  ] as const;

  const sections = [
    {
      title: "Navigation",
      items: navigationFlow.steps.map((step) => `${step.id}: ${step.label}`)
    },
    {
      title: "Calibration",
      items: gameFoundationConfig.calibration.anchors.map(
        (anchor) => `${anchor.id}: ${anchor.label}`
      )
    },
    {
      title: "Menu",
      items: [
        ...gameMenuPlan.sections.map((section) => section.label),
        `Instructions: ${viewportOverlayPlan.instructionsPlacement}`,
        `HUD: ${viewportOverlayPlan.hudPlacement}`
      ]
    },
    {
      title: "Storage",
      items: [
        profileStoragePlan.usernameStorageKey,
        profileStoragePlan.profileStorageKey,
        profileStoragePlan.calibrationStorageKey
      ]
    }
  ] as const;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-border/60 bg-card/76 p-6 shadow-[0_30px_90px_rgb(0_0_0_/_0.24)] backdrop-blur-xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge>radix-nova</Badge>
              <Badge variant="secondary">React + Vite</Badge>
              <Badge variant="outline">WebGPU shell</Badge>
              <Badge variant="outline">Type-first contracts</Badge>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
                ThumbShooter Scaffold
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Small shell, strict contracts, clear runtime locks.
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                The scaffold stays intentionally lean: one preview shell for
                profile state, menu controls, and the core runtime decisions the
                real build will honor.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {runtimeLocks.map((runtimeLock) => (
                <Badge key={runtimeLock} variant="secondary">
                  {runtimeLock}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Local Preview</CardTitle>
                  <CardDescription>
                    Username plus mix state, kept local-first.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="preview-username">Username</Label>
                    <Input
                      id="preview-username"
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Enter username"
                      value={username}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                        Music
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {toPercent(musicVolume[0])}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                        SFX
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {toPercent(sfxVolume[0])}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Label htmlFor="music-volume">Music volume</Label>
                    <Slider
                      id="music-volume"
                      max={100}
                      min={0}
                      onValueChange={(nextValue) =>
                        setMusicVolume([nextValue[0] ?? musicVolume[0]])
                      }
                      step={1}
                      value={musicVolume}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <Label htmlFor="sfx-volume">SFX volume</Label>
                    <Slider
                      id="sfx-volume"
                      max={100}
                      min={0}
                      onValueChange={(nextValue) =>
                        setSfxVolume([nextValue[0] ?? sfxVolume[0]])
                      }
                      step={1}
                      value={sfxVolume}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => setUsername("ScaleModeTools")}>
                      Reset preview
                    </Button>
                    <Badge variant="outline">{username}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Build Surface</CardTitle>
                  <CardDescription>
                    The first real loop stays constrained and inspectable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <div className="rounded-lg border border-border/60 bg-background/45 px-3 py-2">
                    Controls: {gameMenuPlan.controlsSummary.join(" / ")}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/45 px-3 py-2">
                    Reticles:{" "}
                    {reticleManifest.reticles.map((reticle) => reticle.label).join(" / ")}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/45 px-3 py-2">
                    Audio cues: {audioFoundationConfig.soundEffects.cueIds.join(", ")}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/45 px-3 py-2">
                    Menu sections:{" "}
                    {gameMenuPlan.sections.map((section) => section.label).join(" / ")}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => (
            <SummaryCard
              items={section.items}
              key={section.title}
              title={section.title}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
