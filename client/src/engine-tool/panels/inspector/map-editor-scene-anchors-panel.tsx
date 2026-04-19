import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";

function resolveFiniteNumber(value: string): number | null {
  const nextValue = Number(value);

  return Number.isFinite(nextValue) ? nextValue : null;
}

interface MapEditorSceneAnchorsPanelProps {
  readonly onUpdatePlayerSpawn: (
    spawnId: string,
    update: (draft: MapEditorPlayerSpawnDraftSnapshot) => MapEditorPlayerSpawnDraftSnapshot
  ) => void;
  readonly onUpdateSceneObject: (
    objectId: string,
    update: (draft: MapEditorSceneObjectDraftSnapshot) => MapEditorSceneObjectDraftSnapshot
  ) => void;
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
}

export function MapEditorSceneAnchorsPanel({
  onUpdatePlayerSpawn,
  onUpdateSceneObject,
  playerSpawnDrafts,
  sceneObjectDrafts
}: MapEditorSceneAnchorsPanelProps) {
  if (playerSpawnDrafts.length === 0 && sceneObjectDrafts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
        No scene anchors are authored for this map yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
      {playerSpawnDrafts.map((spawnDraft) => (
        <div className="flex flex-col gap-3" key={spawnDraft.spawnId}>
          <div>
            <p className="text-sm font-medium">{spawnDraft.label}</p>
            <p className="text-xs text-muted-foreground">{spawnDraft.spawnId}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${spawnDraft.spawnId}-x`}>Spawn X</Label>
              <Input
                id={`${spawnDraft.spawnId}-x`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdatePlayerSpawn(spawnDraft.spawnId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        x: nextValue
                      }
                    }));
                  }
                }}
                value={spawnDraft.position.x.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${spawnDraft.spawnId}-y`}>Spawn Y</Label>
              <Input
                id={`${spawnDraft.spawnId}-y`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdatePlayerSpawn(spawnDraft.spawnId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        y: nextValue
                      }
                    }));
                  }
                }}
                value={spawnDraft.position.y.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${spawnDraft.spawnId}-z`}>Spawn Z</Label>
              <Input
                id={`${spawnDraft.spawnId}-z`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdatePlayerSpawn(spawnDraft.spawnId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        z: nextValue
                      }
                    }));
                  }
                }}
                value={spawnDraft.position.z.toFixed(2)}
              />
            </div>
          </div>
        </div>
      ))}

      {playerSpawnDrafts.length > 0 && sceneObjectDrafts.length > 0 ? <Separator /> : null}

      {sceneObjectDrafts.map((sceneObjectDraft) => (
        <div className="flex flex-col gap-3" key={sceneObjectDraft.objectId}>
          <div>
            <p className="text-sm font-medium">{sceneObjectDraft.label}</p>
            <p className="text-xs text-muted-foreground">
              {sceneObjectDraft.launchTarget === null
                ? sceneObjectDraft.objectId
                : `Launch object to ${sceneObjectDraft.launchTarget.experienceId}`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${sceneObjectDraft.objectId}-x`}>Object X</Label>
              <Input
                id={`${sceneObjectDraft.objectId}-x`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateSceneObject(sceneObjectDraft.objectId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        x: nextValue
                      }
                    }));
                  }
                }}
                value={sceneObjectDraft.position.x.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${sceneObjectDraft.objectId}-y`}>Object Y</Label>
              <Input
                id={`${sceneObjectDraft.objectId}-y`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateSceneObject(sceneObjectDraft.objectId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        y: nextValue
                      }
                    }));
                  }
                }}
                value={sceneObjectDraft.position.y.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${sceneObjectDraft.objectId}-z`}>Object Z</Label>
              <Input
                id={`${sceneObjectDraft.objectId}-z`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateSceneObject(sceneObjectDraft.objectId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        z: nextValue
                      }
                    }));
                  }
                }}
                value={sceneObjectDraft.position.z.toFixed(2)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
