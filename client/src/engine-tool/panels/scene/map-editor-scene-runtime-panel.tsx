import { LifeBuoyIcon, PlusIcon, SparklesIcon, WavesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";

interface MapEditorSceneRuntimePanelProps {
  readonly onAddPlayerSpawn: () => void;
  readonly onAddSceneObject: () => void;
  readonly onAddWaterRegion: () => void;
  readonly project: MapEditorProjectSnapshot;
}

function SceneRuntimeSection({
  children,
  title
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function MapEditorSceneRuntimePanel({
  onAddPlayerSpawn,
  onAddSceneObject,
  onAddWaterRegion,
  project
}: MapEditorSceneRuntimePanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Button onClick={onAddPlayerSpawn} type="button" variant="outline">
          <LifeBuoyIcon data-icon="inline-start" />
          Add Spawn
        </Button>
        <Button onClick={onAddSceneObject} type="button" variant="outline">
          <SparklesIcon data-icon="inline-start" />
          Add Launch Object
        </Button>
        <Button onClick={onAddWaterRegion} type="button" variant="outline">
          <WavesIcon data-icon="inline-start" />
          Add Water Region
        </Button>
      </div>

      <Separator />

      <SceneRuntimeSection title="Player Spawns">
        {project.playerSpawnDrafts.map((spawnDraft) => (
          <div
            className="rounded-xl border border-border/70 bg-background/70 px-3 py-2"
            key={spawnDraft.spawnId}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {spawnDraft.label}{" "}
                <span className="text-xs font-normal uppercase tracking-[0.16em] text-muted-foreground">
                  {spawnDraft.teamId}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {spawnDraft.position.x.toFixed(1)}, {spawnDraft.position.y.toFixed(1)},{" "}
                {spawnDraft.position.z.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{spawnDraft.spawnId}</p>
          </div>
        ))}
      </SceneRuntimeSection>

      <SceneRuntimeSection title="Launch Objects">
        {project.sceneObjectDrafts.map((sceneObjectDraft) => (
          <div
            className="rounded-xl border border-border/70 bg-background/70 px-3 py-2"
            key={sceneObjectDraft.objectId}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{sceneObjectDraft.label}</span>
              <span className="text-xs text-muted-foreground">
                {sceneObjectDraft.position.x.toFixed(1)}, {sceneObjectDraft.position.y.toFixed(1)},{" "}
                {sceneObjectDraft.position.z.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sceneObjectDraft.launchTarget === null
                ? sceneObjectDraft.objectId
                : `${sceneObjectDraft.objectId} -> ${sceneObjectDraft.launchTarget.experienceId}`}
            </p>
          </div>
        ))}
      </SceneRuntimeSection>

      <SceneRuntimeSection title="Water Regions">
        {project.waterRegionDrafts.map((waterRegionDraft) => (
          <div
            className="rounded-xl border border-border/70 bg-background/70 px-3 py-2"
            key={waterRegionDraft.waterRegionId}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{waterRegionDraft.waterRegionId}</span>
              <span className="text-xs text-muted-foreground">
                {waterRegionDraft.size.x.toFixed(1)} x {waterRegionDraft.size.z.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Center {waterRegionDraft.center.x.toFixed(1)}, {waterRegionDraft.center.y.toFixed(1)},{" "}
              {waterRegionDraft.center.z.toFixed(1)}
            </p>
          </div>
        ))}
      </SceneRuntimeSection>

      <div className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
        Scene runtime surfaces are authored here first. Detailed editing still lives in the inspector while the viewport previews the same draft state.
      </div>
    </div>
  );
}
