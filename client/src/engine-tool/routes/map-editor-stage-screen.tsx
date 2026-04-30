import {
  startTransition,
  type FormEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from "react";

import type { LucideIcon } from "lucide-react";
import {
  BoxIcon,
  BrickWallIcon,
  CarFrontIcon,
  CrosshairIcon,
  DoorOpenIcon,
  ExpandIcon,
  FlagIcon,
  FlagTriangleRightIcon,
  FolderTreeIcon,
  InfoIcon,
  LightbulbIcon,
  MountainIcon,
  MousePointer2Icon,
  Move3dIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PaintbrushIcon,
  PlayIcon,
  RotateCwIcon,
  RouteIcon,
  ShieldIcon,
  SquareIcon,
  Trash2Icon,
  WavesIcon
} from "lucide-react";

import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import type {
  MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";
import {
  clearMetaverseWorldBundlePreviewEntry,
  listMetaverseWorldBundleRegistryEntries,
  readMetaverseWorldBundleRegistryEntry,
  registerMetaverseWorldBundlePreviewEntry,
  resolveDefaultMetaverseWorldBundleId,
  resolveMetaverseWorldBundleSourceBundleId,
  type MetaverseWorldBundleRegistryEntry
} from "@/metaverse/world/bundle-registry";
import {
  createLoadedMetaverseMapBundleSnapshot,
  loadMetaverseMapBundle
} from "@/metaverse/world/map-bundles";

import { Button } from "@/components/ui/button";
import { StableInlineText } from "@/components/text-stability";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/components/ui/resizable";
import { MapEditorEditableNumberInput } from "@/engine-tool/components/map-editor-editable-number-input";
import { MapEditorMenubar } from "@/engine-tool/layout/map-editor-menubar";
import { MapEditorGameplayPane } from "@/engine-tool/layout/map-editor-gameplay-pane";
import { MapEditorSceneRail } from "@/engine-tool/layout/map-editor-scene-rail";
import {
  MapEditorSelectionPane,
  MapEditorSelectionMaterialControlsPane
} from "@/engine-tool/layout/map-editor-selection-pane";
import { MapEditorToolbar } from "@/engine-tool/layout/map-editor-toolbar";
import { MapEditorViewportPane } from "@/engine-tool/layout/map-editor-viewport-pane";
import {
  mapEditorBuildGridUnitMeters,
  resolveMapEditorBuildAssetPlacementPosition,
  resolveMapEditorBuildFootprintCenterPosition,
  resolveMapEditorBuildSizedCenterPosition,
  snapMapEditorBuildCoordinateToCellCenter,
  snapMapEditorBuildCoordinateToGrid
} from "@/engine-tool/build/map-editor-build-placement";
import {
  createLoadedMapEditorBlankTemplateBundle
} from "@/engine-tool/config/map-editor-blank-template-bundle";
import {
  addMapEditorFloorPolygonRegionDraft,
  addMapEditorPathSegment,
  addMapEditorCombatLaneDraft,
  addMapEditorConnectorDraft,
  addMapEditorCoverDraft,
  addMapEditorEdgeDraft,
  addMapEditorFloorRegionDraft,
  addMapEditorLightDraft,
  addMapEditorMaterialDefinitionDraft,
  addMapEditorPlayerSpawnDraft,
  addMapEditorLaunchVariationDraft,
  addMapEditorPlacementFromAsset,
  addMapEditorPlacementAtPositionFromAsset,
  addMapEditorRegionDraft,
  addMapEditorResourceSpawnDraft,
  addMapEditorSceneObjectDraft,
  addMapEditorSurfaceDraft,
  addMapEditorTeamZoneDraft,
  addMapEditorTerrainPatchDraft,
  addMapEditorVehicleRouteDraft,
  addMapEditorWallSegment,
  addMapEditorWaterRegionDraft,
  applyMapEditorPathRampToSelection,
  applyMapEditorTerrainBrush,
  createMapEditorStructuralGrid,
  createMapEditorProject,
  mergeMapEditorTerrainPatches,
  readSelectedMapEditorLaunchVariation,
  readSelectedMapEditorPlacement,
  removeMapEditorEntity,
  paintMapEditorEntityMaterial,
  selectMapEditorEntity,
  selectMapEditorLaunchVariation,
  type MapEditorConnectorDraftSnapshot,
  type MapEditorEdgeDraftSnapshot,
  type MapEditorGameplayVolumeDraftSnapshot,
  type MapEditorLightDraftSnapshot,
  type MapEditorMaterialDefinitionDraftSnapshot,
  updateMapEditorLaunchVariationDraft,
  updateMapEditorConnectorDraft,
  updateMapEditorEdgeDraft,
  updateMapEditorEnvironmentPresentation,
  updateMapEditorEnvironmentPresentationProfileId,
  updateMapEditorGameplayVolumeDraft,
  updateMapEditorGameplayProfileId,
  updateMapEditorProjectIdentity,
  updateMapEditorProjectSettings,
  updateMapEditorLightDraft,
  updateMapEditorMaterialDefinitionDraft,
  updateMapEditorPlayerSpawnDraft,
  updateMapEditorPlayerSpawnSelectionDraft,
  updateMapEditorRegionDraft,
  updateMapEditorResourceSpawnDraft,
  updateMapEditorSceneObjectDraft,
  updateMapEditorPlacement,
  updateMapEditorStructuralDraft,
  updateMapEditorSurfaceDraft,
  updateMapEditorTerrainPatchDraft,
  updateMapEditorWaterRegionDraft,
  type MapEditorProjectSnapshot,
  type MapEditorRegionDraftSnapshot,
  type MapEditorSelectedEntityRef,
  type MapEditorStructuralDraftSnapshot,
  type MapEditorSurfaceDraftSnapshot,
  type MapEditorTerrainPatchDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import {
  applyMapEditorProjectSessionChange,
  createMapEditorProjectSession,
  replaceMapEditorProjectSessionProject,
  undoMapEditorProjectSessionChange,
  updateMapEditorProjectSessionProject
} from "@/engine-tool/project/map-editor-project-session";
import {
  registerPublicMapEditorProjectRegistryEntries
} from "@/engine-tool/project/map-editor-public-project-storage";
import {
  loadMapEditorUiPrefs,
  saveMapEditorUiPrefs
} from "@/engine-tool/project/map-editor-ui-storage";
import type { MapEditorLaunchVariationDraftSnapshot } from "@/engine-tool/project/map-editor-project-launch-variations";
import type {
  MapEditorPlayerSpawnSelectionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-player-spawn-selection";
import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorResourceSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  persistMapEditorPublicProjectBundleOnServer
} from "@/engine-tool/run/persist-map-editor-public-project-bundle-on-server";
import { validateAndRegisterMapEditorPreviewBundle } from "@/engine-tool/run/map-editor-run-preview";
import { exportMapEditorProjectToMetaverseMapBundle } from "@/engine-tool/run/export-map-editor-project-to-metaverse-map-bundle";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  defaultMapEditorProjectSettings,
  defaultMapEditorBuilderToolState,
  defaultMapEditorViewportHelperVisibility
} from "@/engine-tool/types/map-editor";
import type {
  MapEditorBuilderToolStateSnapshot,
  MapEditorEntityTransformUpdate,
  MapEditorPlayerSpawnTransformUpdate,
  MapEditorSceneVisibilityLayerId,
  MapEditorViewportHelperId,
  MapEditorPlacementUpdate,
  MapEditorViewportTransformTargetRef,
  MapEditorViewportToolMode
} from "@/engine-tool/types/map-editor";
import type { MetaverseWorldPreviewLaunchSelectionSnapshot } from "@/metaverse/world/map-bundles";
import {
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";
import {
  ButtonGroup,
  ButtonGroupText
} from "@/components/ui/button-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function readBrowserStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readMapEditorProjectRegistryEntry(
  bundleId: string,
  publicRegistryEntries: readonly MetaverseWorldBundleRegistryEntry[] =
    Object.freeze([])
): MetaverseWorldBundleRegistryEntry | null {
  return (
    readMetaverseWorldBundleRegistryEntry(bundleId) ??
    publicRegistryEntries.find((entry) => entry.bundleId === bundleId) ??
    listMetaverseWorldBundleRegistryEntries().find(
      (entry) => entry.bundleId === bundleId
    ) ??
    null
  );
}

function createProjectForBundle(
  bundleId: string,
  publicRegistryEntries: readonly MetaverseWorldBundleRegistryEntry[] =
    Object.freeze([])
): MapEditorProjectSnapshot {
  const registryEntry = readMapEditorProjectRegistryEntry(
    bundleId,
    publicRegistryEntries
  );

  return createMapEditorProject(
    registryEntry === null
      ? loadMetaverseMapBundle(bundleId)
      : createLoadedMetaverseMapBundleSnapshot(registryEntry.bundle),
    registryEntry?.mapEditorProjectSettings === null ||
      registryEntry?.mapEditorProjectSettings === undefined
      ? undefined
      : {
          projectSettings: registryEntry.mapEditorProjectSettings
        }
  );
}

function selectDefaultBundleId(
  initialBundleId: string | undefined
): string {
  return resolveMetaverseWorldBundleSourceBundleId(
    initialBundleId ?? resolveDefaultMetaverseWorldBundleId()
  );
}

function readAvailableMapEditorProjectRegistryEntries(
  publicRegistryEntries: readonly MetaverseWorldBundleRegistryEntry[] =
    Object.freeze([])
): readonly MetaverseWorldBundleRegistryEntry[] {
  const entries = [...listMetaverseWorldBundleRegistryEntries()];

  for (const publicRegistryEntry of publicRegistryEntries) {
    if (
      !entries.some((entry) => entry.bundleId === publicRegistryEntry.bundleId)
    ) {
      entries.push(
        readMapEditorProjectRegistryEntry(
          publicRegistryEntry.bundleId,
          publicRegistryEntries
        ) ?? publicRegistryEntry
      );
    }
  }

  return Object.freeze(entries);
}

function createMapEditorProjectIdFromLabel(label: string): string {
  const projectId = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return projectId.length === 0 ? "untitled-project" : projectId;
}

function createUniqueMapEditorProjectId(
  label: string,
  registryEntries: readonly MetaverseWorldBundleRegistryEntry[]
): string {
  const baseProjectId = createMapEditorProjectIdFromLabel(label);
  const existingIds = new Set(registryEntries.map((entry) => entry.bundleId));

  if (!existingIds.has(baseProjectId)) {
    return baseProjectId;
  }

  for (let copyIndex = 2; copyIndex < 1000; copyIndex += 1) {
    const candidateProjectId = `${baseProjectId}-${copyIndex}`;

    if (!existingIds.has(candidateProjectId)) {
      return candidateProjectId;
    }
  }

  return `${baseProjectId}-${Date.now().toString(36)}`;
}

function registerMapEditorProjectPreviewBundle(
  bundle: MetaverseMapBundleSnapshot,
  sourceBundleId = bundle.mapId,
  mapEditorProjectSettings:
    MetaverseWorldBundleRegistryEntry["mapEditorProjectSettings"] = null
): void {
  registerMetaverseWorldBundlePreviewEntry(
    Object.freeze({
      bundle,
      bundleId: bundle.mapId,
      label: bundle.label,
      mapEditorProjectSettings,
      sourceBundleId
    })
  );
}

function applySelectedPlacementUpdate(
  project: MapEditorProjectSnapshot,
  update: MapEditorPlacementUpdate
): MapEditorProjectSnapshot {
  if (project.selectedPlacementId === null) {
    return project;
  }

  return applyPlacementUpdate(project, project.selectedPlacementId, update);
}

function applyPlacementUpdate(
  project: MapEditorProjectSnapshot,
  placementId: string,
  update: MapEditorPlacementUpdate
): MapEditorProjectSnapshot {
  return updateMapEditorPlacement(
    project,
    placementId,
    (placement) => {
      const asset =
        environmentPropManifest.environmentAssets.find(
          (environmentAsset) => environmentAsset.id === placement.assetId
        ) ?? null;

      return {
        ...placement,
        ...update,
        position:
          update.position === undefined
            ? placement.position
            : asset === null
              ? update.position
              : resolveMapEditorBuildAssetPlacementPosition(
                  update.position,
                  asset,
                  update.position.y
                )
      };
    }
  );
}

function normalizeEditorCardinalYawRadians(rotationYRadians: number): number {
  const quarterTurns = Math.round(rotationYRadians / (Math.PI * 0.5));
  const normalized = quarterTurns * Math.PI * 0.5;

  return ((normalized % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function scaleMeters(value: number, scale: number, minimum: number): number {
  return Math.max(minimum, Math.round(value * Math.max(0.1, scale) * 100) / 100);
}

function createTransformPosition(
  position: MapEditorEntityTransformUpdate["position"],
  snapMode: "cell" | "grid" | "none"
) {
  return Object.freeze({
    x:
      snapMode === "cell"
        ? snapMapEditorBuildCoordinateToCellCenter(position.x)
        : snapMode === "grid"
          ? snapMapEditorBuildCoordinateToGrid(position.x)
          : position.x,
    y: position.y,
    z:
      snapMode === "cell"
        ? snapMapEditorBuildCoordinateToCellCenter(position.z)
        : snapMode === "grid"
          ? snapMapEditorBuildCoordinateToGrid(position.z)
          : position.z
  });
}

function createFootprintTransformPosition(
  position: MapEditorEntityTransformUpdate["position"],
  size: {
    readonly x: number;
    readonly z: number;
  }
) {
  return resolveMapEditorBuildSizedCenterPosition(
    position,
    position.y,
    size.x,
    size.z
  );
}

function createTerrainPatchGridFromTransform(
  origin: MapEditorEntityTransformUpdate["position"],
  sampleCountX: number,
  sampleCountZ: number,
  sampleSpacingMeters: number
): MapEditorTerrainPatchDraftSnapshot["grid"] {
  const sizeX = Math.max(
    mapEditorBuildGridUnitMeters,
    (sampleCountX - 1) * sampleSpacingMeters
  );
  const sizeZ = Math.max(
    mapEditorBuildGridUnitMeters,
    (sampleCountZ - 1) * sampleSpacingMeters
  );

  return Object.freeze({
    cellX: Math.round((origin.x - sizeX * 0.5) / mapEditorBuildGridUnitMeters),
    cellZ: Math.round((origin.z - sizeZ * 0.5) / mapEditorBuildGridUnitMeters),
    cellsX: Math.max(1, Math.round(sizeX / mapEditorBuildGridUnitMeters)),
    cellsZ: Math.max(1, Math.round(sizeZ / mapEditorBuildGridUnitMeters)),
    layer: Math.round(origin.y / mapEditorBuildGridUnitMeters)
  });
}

function readTerrainVertexTransformTargetId(
  targetId: string
): {
  readonly cellX: number;
  readonly cellZ: number;
  readonly terrainPatchId: string;
} | null {
  const [encodedTerrainPatchId, cellXValue, cellZValue] = targetId.split(":");

  if (
    encodedTerrainPatchId === undefined ||
    cellXValue === undefined ||
    cellZValue === undefined
  ) {
    return null;
  }

  const cellX = Number(cellXValue);
  const cellZ = Number(cellZValue);

  return Number.isFinite(cellX) && Number.isFinite(cellZ)
    ? Object.freeze({
        cellX: Math.round(cellX),
        cellZ: Math.round(cellZ),
        terrainPatchId: decodeURIComponent(encodedTerrainPatchId)
      })
    : null;
}

function resampleTerrainGridSamples(
  samples: readonly number[],
  sampleCountX: number,
  sampleCountZ: number,
  nextSampleCountX: number,
  nextSampleCountZ: number,
  fillValue: number
): readonly number[] {
  return Object.freeze(
    Array.from(
      { length: nextSampleCountX * nextSampleCountZ },
      (_entry, sampleIndex) => {
        const sampleX = sampleIndex % nextSampleCountX;
        const sampleZ = Math.floor(sampleIndex / nextSampleCountX);
        const sourceX =
          nextSampleCountX <= 1
            ? 0
            : Math.round((sampleX / (nextSampleCountX - 1)) * (sampleCountX - 1));
        const sourceZ =
          nextSampleCountZ <= 1
            ? 0
            : Math.round((sampleZ / (nextSampleCountZ - 1)) * (sampleCountZ - 1));

        return samples[sourceZ * sampleCountX + sourceX] ?? fillValue;
      }
    )
  );
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

type MapEditorLeftSidebarTabId = "authoring" | "gameplay" | "scene";

interface MapEditorPanelApi {
  collapse: () => void;
  expand: () => void;
}

function formatEditorTabLabel(tabId: MapEditorLeftSidebarTabId): string {
  switch (tabId) {
    case "gameplay":
      return "Gameplay";
    case "scene":
      return "Scene";
    case "authoring":
    default:
      return "Project";
  }
}

type HeaderViewportToolItem = {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly value: MapEditorViewportToolMode;
};

type HeaderViewportToolGroup = {
  readonly label: string;
  readonly tools: readonly HeaderViewportToolItem[];
};

function createHeaderViewportToolGroup(
  group: HeaderViewportToolGroup
): HeaderViewportToolGroup {
  return Object.freeze({
    label: group.label,
    tools: Object.freeze(group.tools.map((tool) => Object.freeze(tool)))
  });
}

const headerViewportToolGroups: readonly HeaderViewportToolGroup[] = Object.freeze([
  createHeaderViewportToolGroup({
    label: "Edit",
    tools: [
      { Icon: MousePointer2Icon, label: "Select", value: "select" },
      { Icon: PaintbrushIcon, label: "Paint", value: "paint" },
      { Icon: Trash2Icon, label: "Delete", value: "delete" },
      { Icon: Move3dIcon, label: "Move", value: "move" },
      { Icon: RotateCwIcon, label: "Rotate", value: "rotate" },
      { Icon: ExpandIcon, label: "Scale", value: "scale" },
      { Icon: Move3dIcon, label: "Vertex", value: "vertex" }
    ]
  }),
  createHeaderViewportToolGroup({
    label: "Build",
    tools: [
      { Icon: SquareIcon, label: "Floor", value: "floor" },
      { Icon: ShieldIcon, label: "Cover", value: "cover" },
      { Icon: MountainIcon, label: "Terrain", value: "terrain" },
      { Icon: BrickWallIcon, label: "Wall", value: "wall" },
      { Icon: RouteIcon, label: "Path", value: "path" },
      { Icon: WavesIcon, label: "Water", value: "water" }
    ]
  }),
  createHeaderViewportToolGroup({
    label: "Gameplay Tools",
    tools: [
      { Icon: CrosshairIcon, label: "Zone", value: "zone" },
      { Icon: FlagTriangleRightIcon, label: "Lane", value: "lane" },
      { Icon: CarFrontIcon, label: "Route", value: "vehicle-route" }
    ]
  }),
  createHeaderViewportToolGroup({
    label: "Scene",
    tools: [
      { Icon: FlagIcon, label: "Spawn", value: "player-spawn" },
      { Icon: CrosshairIcon, label: "Weapon", value: "resource-spawn" },
      { Icon: DoorOpenIcon, label: "Portal", value: "portal" },
      { Icon: BoxIcon, label: "Module", value: "module" },
      { Icon: LightbulbIcon, label: "Light", value: "light" }
    ]
  })
]);

function readHeaderViewportToolMode(
  nextValue: string
): MapEditorViewportToolMode | null {
  for (const group of headerViewportToolGroups) {
    if (group.tools.some((item) => item.value === nextValue)) {
      return nextValue as MapEditorViewportToolMode;
    }
  }

  return null;
}

function MapEditorHeaderToolRow({
  onViewportToolModeChange,
  viewportToolMode
}: {
  readonly onViewportToolModeChange: (
    viewportToolMode: MapEditorViewportToolMode
  ) => void;
  readonly viewportToolMode: MapEditorViewportToolMode;
}) {
  return (
    <div className="flex min-w-0 items-center border-t border-border/70 px-3 py-1.5">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <ButtonGroup aria-label="Viewport tool groups" className="w-max">
          {headerViewportToolGroups.map((group) => (
            <ButtonGroup aria-label={`${group.label} tools`} key={group.label}>
              <ButtonGroupText className="text-xs uppercase text-muted-foreground">
                {group.label}
              </ButtonGroupText>
              <ToggleGroup
                aria-label={`${group.label} viewport tools`}
                className="[&>[data-slot=toggle-group-item]:first-child]:rounded-l-none"
                onValueChange={(nextValue) => {
                  const nextViewportToolMode =
                    readHeaderViewportToolMode(nextValue);

                  if (nextViewportToolMode !== null) {
                    onViewportToolModeChange(nextViewportToolMode);
                  }
                }}
                size="sm"
                spacing={0}
                type="single"
                value={viewportToolMode}
                variant="outline"
              >
                {group.tools.map((item) => {
                  const ToolIcon = item.Icon;

                  return (
                    <ToggleGroupItem
                      aria-label={item.label}
                      key={item.value}
                      title={item.label}
                      value={item.value}
                    >
                      <ToolIcon data-icon="inline-start" />
                      <span>{item.label}</span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </ButtonGroup>
          ))}
        </ButtonGroup>
      </div>
    </div>
  );
}

type MapEditorProjectIdentityDialogMode = "new" | "save-as";

interface MapEditorProjectIdentityDialogState {
  readonly bundleId: string;
  readonly errorMessage: string | null;
  readonly helperGridSizeMeters: number;
  readonly label: string;
  readonly mode: MapEditorProjectIdentityDialogMode;
}

function MapEditorProjectIdentityDialog({
  dialogState,
  onBundleIdChange,
  onHelperGridSizeMetersChange,
  onLabelChange,
  onOpenChange,
  onSubmit,
  saving
}: {
  readonly dialogState: MapEditorProjectIdentityDialogState | null;
  readonly onBundleIdChange: (bundleId: string) => void;
  readonly onHelperGridSizeMetersChange: (helperGridSizeMeters: number) => void;
  readonly onLabelChange: (label: string) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly saving: boolean;
}) {
  const open = dialogState !== null;
  const isNewProject = dialogState?.mode === "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="contents" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isNewProject ? "New Project" : "Save As"}
            </DialogTitle>
            <DialogDescription>
              {isNewProject
                ? "Create a saved project file from the blank template."
                : "Save a copy of the current draft to the public project folder."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="map-editor-project-label">Project Name</Label>
              <Input
                disabled={saving}
                id="map-editor-project-label"
                onChange={(event) => onLabelChange(event.target.value)}
                value={dialogState?.label ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="map-editor-project-id">Project Id</Label>
              <Input
                disabled={saving}
                id="map-editor-project-id"
                onChange={(event) => onBundleIdChange(event.target.value)}
                value={dialogState?.bundleId ?? ""}
              />
            </div>
            {isNewProject ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="map-editor-project-helper-grid-size">
                  Helper Grid Size
                </Label>
                <MapEditorEditableNumberInput
                  decimals={0}
                  id="map-editor-project-helper-grid-size"
                  onValueChange={onHelperGridSizeMetersChange}
                  value={dialogState?.helperGridSizeMeters ?? 0}
                />
                <p className="text-xs text-muted-foreground">
                  Snaps to the {mapEditorBuildGridUnitMeters}m authoring grid.
                </p>
              </div>
            ) : null}
            {dialogState?.errorMessage === null ||
            dialogState?.errorMessage === undefined ? null : (
              <p className="text-sm text-destructive">
                {dialogState.errorMessage}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button disabled={saving} type="submit">
              {saving
                ? "Saving..."
                : isNewProject
                  ? "Create Project"
                  : "Save Copy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function isDeletableMapEditorSelection(
  selectedEntityRef: MapEditorSelectedEntityRef | null
): boolean {
  return (
    selectedEntityRef !== null &&
    selectedEntityRef.kind !== "world-atmosphere" &&
    selectedEntityRef.kind !== "world-sky" &&
    selectedEntityRef.kind !== "world-sun"
  );
}

function formatSelectedEntityLabel(
  selectedEntityRef: MapEditorSelectedEntityRef | null,
  fallbackToolMode: MapEditorViewportToolMode
): string {
  if (selectedEntityRef === null) {
    if (fallbackToolMode === "player-spawn") {
      return "Player Spawn";
    }

    if (fallbackToolMode === "resource-spawn") {
      return "Weapon Pickup";
    }

    if (fallbackToolMode === "vehicle-route") {
      return "Vehicle Route";
    }

    return `${fallbackToolMode[0]?.toUpperCase() ?? ""}${fallbackToolMode.slice(1)}`;
  }

  return `${selectedEntityRef.kind}: ${selectedEntityRef.id}`;
}

function freezeSectionOpenState(
  nextSectionOpenState: Readonly<Record<string, boolean>>
): Readonly<Record<string, boolean>> {
  return Object.freeze({ ...nextSectionOpenState });
}

interface MapEditorStageScreenProps {
  readonly initialBundleId?: string;
  readonly onCloseRequest: () => void;
  readonly onRunPreviewRequest: (
    launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot
  ) => void;
}

export function MapEditorStageScreen({
  initialBundleId,
  onCloseRequest,
  onRunPreviewRequest
}: MapEditorStageScreenProps) {
  const [browserStorage] = useState<Storage | null>(() =>
    readBrowserStorage()
  );
  const [publicRegistryEntries, setPublicRegistryEntries] = useState<
    readonly MetaverseWorldBundleRegistryEntry[]
  >(() => Object.freeze([]));
  const [registryEntries, setRegistryEntries] = useState(() =>
    readAvailableMapEditorProjectRegistryEntries()
  );
  const defaultBundleId = selectDefaultBundleId(initialBundleId);
  const bundleLabelReserveTexts = useMemo(
    () => registryEntries.map((entry) => entry.label),
    [registryEntries]
  );
  const [initialUiPrefs] = useState(() => loadMapEditorUiPrefs(browserStorage));
  const [selectedBundleId, setSelectedBundleId] = useState(defaultBundleId);
  const [projectSession, setProjectSession] = useState(() =>
    createMapEditorProjectSession(
      createProjectForBundle(defaultBundleId)
    )
  );
  const sceneRailPanelApiRef = useRef<MapEditorPanelApi | null>(null);
  const inspectorPanelApiRef = useRef<MapEditorPanelApi | null>(null);
  const [activeLeftSidebarTab, setActiveLeftSidebarTab] =
    useState<MapEditorLeftSidebarTabId>("authoring");
  const [activeModuleAssetId, setActiveModuleAssetId] = useState<string | null>(
    null
  );
  const [builderToolState, setBuilderToolState] =
    useState<MapEditorBuilderToolStateSnapshot>(
      initialUiPrefs.builderToolState ?? defaultMapEditorBuilderToolState
    );
  const [sceneRailCollapsed, setSceneRailCollapsed] = useState(
    initialUiPrefs.sceneRailCollapsed
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(
    initialUiPrefs.inspectorCollapsed
  );
  const [sectionOpenState, setSectionOpenState] = useState(
    initialUiPrefs.sectionOpenState
  );
  const [viewportHelperVisibility, setViewportHelperVisibility] = useState(
    defaultMapEditorViewportHelperVisibility
  );
  const [sceneVisibility, setSceneVisibility] = useState(
    initialUiPrefs.sceneVisibility
  );
  const [viewportToolMode, setViewportToolMode] =
    useState<MapEditorViewportToolMode>("select");
  const [runInProgress, setRunInProgress] = useState(false);
  const [runStatusMessage, setRunStatusMessage] = useState<string | null>(null);
  const [projectIdentityDialogState, setProjectIdentityDialogState] =
    useState<MapEditorProjectIdentityDialogState | null>(null);
  const [projectIdentityDialogSaving, setProjectIdentityDialogSaving] =
    useState(false);
  const [returnToShellDialogOpen, setReturnToShellDialogOpen] = useState(false);
  const [hasUnsavedProjectChanges, setHasUnsavedProjectChanges] =
    useState(false);
  const project = projectSession.project;
  const selectedLaunchVariation = readSelectedMapEditorLaunchVariation(project);
  const selectedPlacement = readSelectedMapEditorPlacement(project);
  const canUndoProjectChange = projectSession.undoHistory.length > 0;

  useEffect(() => {
    let cancelled = false;

    registerPublicMapEditorProjectRegistryEntries()
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setPublicRegistryEntries(entries);
        setRegistryEntries(
          readAvailableMapEditorProjectRegistryEntries(entries)
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setRunStatusMessage(
          error instanceof Error
            ? `Public project catalog could not be loaded: ${error.message}`
            : "Public project catalog could not be loaded."
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleProjectSelectionUpdate = useEffectEvent(
    (
      update: (
        project: MapEditorProjectSnapshot
      ) => MapEditorProjectSnapshot
    ) => {
      setProjectSession((currentSession) =>
        updateMapEditorProjectSessionProject(currentSession, update)
      );
    }
  );
  const handleProjectAuthoringChange = useEffectEvent(
    (
      update: (
        project: MapEditorProjectSnapshot
      ) => MapEditorProjectSnapshot
    ) => {
      setProjectSession((currentSession) =>
        applyMapEditorProjectSessionChange(currentSession, update)
      );
      setHasUnsavedProjectChanges(true);
      setRunStatusMessage(null);
    }
  );
  const handleUndoProjectChangeRequest = useEffectEvent(() => {
    setProjectSession((currentSession) =>
      undoMapEditorProjectSessionChange(currentSession)
    );
    setHasUnsavedProjectChanges(true);
    setRunStatusMessage(null);
  });
  const handleDeleteSelectedEntityRequest = useEffectEvent(() => {
    handleProjectAuthoringChange((currentProject) =>
      removeMapEditorEntity(currentProject)
    );
  });
  const handleBuilderToolStateChange = (
    update: (
      currentBuilderToolState: MapEditorBuilderToolStateSnapshot
    ) => MapEditorBuilderToolStateSnapshot
  ) => {
    setBuilderToolState((currentBuilderToolState) =>
      Object.freeze(update(currentBuilderToolState))
    );
  };
  const handleSectionOpenChange = (sectionId: string, open: boolean) => {
    setSectionOpenState((currentSectionOpenState) =>
      freezeSectionOpenState({
        ...currentSectionOpenState,
        [sectionId]: open
      })
    );
  };
  const readSectionOpen = (sectionId: string, defaultOpen = true): boolean =>
    sectionOpenState[sectionId] ?? defaultOpen;

  const handleLeftSidebarCollapsedChange = (collapsed: boolean) => {
    if (collapsed) {
      sceneRailPanelApiRef.current?.collapse();
    } else {
      sceneRailPanelApiRef.current?.expand();
    }
    setSceneRailCollapsed(collapsed);
  };

  const handleInspectorCollapsedChange = (collapsed: boolean) => {
    if (collapsed) {
      inspectorPanelApiRef.current?.collapse();
    } else {
      inspectorPanelApiRef.current?.expand();
    }
    setInspectorCollapsed(collapsed);
  };

  const handleBundleChange = (nextBundleId: string) => {
    startTransition(() => {
      setSelectedBundleId(nextBundleId);
      setActiveModuleAssetId(null);
      setViewportToolMode("select");
      setProjectSession((currentSession) =>
        replaceMapEditorProjectSessionProject(
          currentSession,
          createProjectForBundle(nextBundleId, publicRegistryEntries)
        )
      );
      setHasUnsavedProjectChanges(false);
      setRunStatusMessage(null);
    });
  };

  const handleResetDraftRequest = () => {
    startTransition(() => {
      clearMetaverseWorldBundlePreviewEntry(selectedBundleId);
      setActiveModuleAssetId(null);
      setViewportToolMode("select");
      setProjectSession((currentSession) =>
        replaceMapEditorProjectSessionProject(
          currentSession,
          createProjectForBundle(selectedBundleId, publicRegistryEntries)
        )
      );
      setHasUnsavedProjectChanges(false);
      setRunStatusMessage(null);
    });
  };

  const persistProjectToPublicFolder = async (
    projectToSave: MapEditorProjectSnapshot,
    sourceBundleId: string
  ): Promise<{
    readonly publicPath: string;
    readonly publicRegistryEntries:
      readonly MetaverseWorldBundleRegistryEntry[];
  }> => {
    const bundle = exportMapEditorProjectToMetaverseMapBundle(projectToSave);
    const publicSaveResult = await persistMapEditorPublicProjectBundleOnServer(
      bundle,
      {
        mapEditorProjectSettings: projectToSave.projectSettings,
        sourceBundleId
      }
    );
    const publicRegistryEntry = Object.freeze({
      bundle,
      bundleId: bundle.mapId,
      label: bundle.label,
      mapEditorProjectSettings: projectToSave.projectSettings,
      sourceBundleId: publicSaveResult.sourceBundleId
    } satisfies MetaverseWorldBundleRegistryEntry);
    const nextPublicRegistryEntries = Object.freeze([
      ...publicRegistryEntries.filter(
        (entry) => entry.bundleId !== publicRegistryEntry.bundleId
      ),
      publicRegistryEntry
    ]);

    registerMapEditorProjectPreviewBundle(
      bundle,
      publicSaveResult.sourceBundleId,
      projectToSave.projectSettings
    );
    setPublicRegistryEntries(nextPublicRegistryEntries);
    setRegistryEntries(
      readAvailableMapEditorProjectRegistryEntries(nextPublicRegistryEntries)
    );

    return Object.freeze({
      publicPath: publicSaveResult.path,
      publicRegistryEntries: nextPublicRegistryEntries
    });
  };

  const handleSaveDraftRequest = async (): Promise<boolean> => {
    try {
      const { publicPath } = await persistProjectToPublicFolder(
        project,
        resolveMetaverseWorldBundleSourceBundleId(project.bundleId)
      );

      setHasUnsavedProjectChanges(false);
      setRunStatusMessage(`Saved ${project.bundleLabel} to ${publicPath}.`);
      return true;
    } catch (error) {
      setRunStatusMessage(
        error instanceof Error
          ? `Public project save failed: ${error.message}`
          : "Public project save failed."
      );
      return false;
    }
  };

  const openProjectIdentityDialog = (
    mode: MapEditorProjectIdentityDialogMode
  ) => {
    const label =
      mode === "new" ? "Untitled Project" : `${project.bundleLabel} Copy`;
    const bundleId = createUniqueMapEditorProjectId(label, registryEntries);

    setProjectIdentityDialogState(
      Object.freeze({
        bundleId,
        errorMessage: null,
        helperGridSizeMeters:
          mode === "new"
            ? defaultMapEditorProjectSettings.helperGridSizeMeters
            : project.projectSettings.helperGridSizeMeters,
        label,
        mode
      })
    );
  };

  const closeProjectIdentityDialog = () => {
    setProjectIdentityDialogState(null);
  };

  const updateProjectIdentityDialogLabel = (label: string) => {
    setProjectIdentityDialogState((currentState) =>
      currentState === null
        ? null
        : Object.freeze({
            ...currentState,
            errorMessage: null,
            label
          })
    );
  };

  const updateProjectIdentityDialogBundleId = (bundleId: string) => {
    setProjectIdentityDialogState((currentState) =>
      currentState === null
        ? null
        : Object.freeze({
            ...currentState,
            bundleId,
            errorMessage: null
          })
    );
  };

  const updateProjectIdentityDialogHelperGridSizeMeters = (
    helperGridSizeMeters: number
  ) => {
    setProjectIdentityDialogState((currentState) =>
      currentState === null
        ? null
        : Object.freeze({
            ...currentState,
            errorMessage: null,
            helperGridSizeMeters
          })
    );
  };

  const rejectProjectIdentityDialogSubmit = (message: string) => {
    setProjectIdentityDialogState((currentState) =>
      currentState === null
        ? null
        : Object.freeze({
            ...currentState,
            errorMessage: message
          })
    );
  };

  const saveProjectUnderIdentity = async (
    projectToSave: MapEditorProjectSnapshot,
    identity: {
      readonly bundleId: string;
      readonly bundleLabel: string;
      readonly description?: string;
    },
    sourceBundleId: string
  ): Promise<{
    readonly nextProject: MapEditorProjectSnapshot;
    readonly publicPath: string;
  }> => {
    const nextProject = updateMapEditorProjectIdentity(projectToSave, identity);
    const { publicPath } = await persistProjectToPublicFolder(
      nextProject,
      sourceBundleId
    );
    setHasUnsavedProjectChanges(false);

    return Object.freeze({
      nextProject,
      publicPath
    });
  };

  const handleProjectIdentityDialogSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (projectIdentityDialogState === null || projectIdentityDialogSaving) {
      return;
    }

    const bundleLabel = projectIdentityDialogState.label.trim();
    const bundleId = createMapEditorProjectIdFromLabel(
      projectIdentityDialogState.bundleId
    );

    if (bundleLabel.length === 0) {
      rejectProjectIdentityDialogSubmit("Project name is required.");
      return;
    }

    if (registryEntries.some((entry) => entry.bundleId === bundleId)) {
      rejectProjectIdentityDialogSubmit(
        "Project id already exists. Choose a different id."
      );
      return;
    }

    const identity = Object.freeze({
      bundleId,
      bundleLabel
    });

    setProjectIdentityDialogSaving(true);

    try {
      if (projectIdentityDialogState.mode === "save-as") {
        const { nextProject, publicPath } = await saveProjectUnderIdentity(
          project,
          identity,
          selectedBundleId
        );

        startTransition(() => {
          setSelectedBundleId(nextProject.bundleId);
          setProjectSession((currentSession) =>
            replaceMapEditorProjectSessionProject(currentSession, nextProject)
          );
          setRunStatusMessage(
            `Saved ${nextProject.bundleLabel} to ${publicPath}.`
          );
        });
        closeProjectIdentityDialog();
        return;
      }

      const sourceLoadedBundle = createLoadedMapEditorBlankTemplateBundle();
      const sourceProject = createMapEditorProject(sourceLoadedBundle, {
        projectSettings: {
          helperGridSizeMeters: projectIdentityDialogState.helperGridSizeMeters
        }
      });
      const sourceBundle = sourceLoadedBundle.bundle;
      const { nextProject, publicPath } = await saveProjectUnderIdentity(
        sourceProject,
        identity,
        sourceBundle.mapId
      );

      startTransition(() => {
        setSelectedBundleId(nextProject.bundleId);
        setActiveModuleAssetId(null);
        setViewportToolMode("select");
        setProjectSession((currentSession) =>
          replaceMapEditorProjectSessionProject(currentSession, nextProject)
        );
        setRunStatusMessage(
          `Created ${nextProject.bundleLabel} at ${publicPath}.`
        );
      });
      closeProjectIdentityDialog();
    } catch (error) {
      rejectProjectIdentityDialogSubmit(
        error instanceof Error
          ? `Public project save failed: ${error.message}`
          : "Public project save failed."
      );
    } finally {
      setProjectIdentityDialogSaving(false);
    }
  };

  const handleReturnToShellRequest = () => {
    if (hasUnsavedProjectChanges) {
      setReturnToShellDialogOpen(true);
      return;
    }

    onCloseRequest();
  };

  const handleSaveAndReturnToShellRequest = () => {
    void handleSaveDraftRequest().then((saved) => {
      if (saved) {
        onCloseRequest();
      }
    });
  };

  useEffect(() => {
    saveMapEditorUiPrefs(browserStorage, {
      builderToolState,
      inspectorCollapsed,
      sceneVisibility,
      sceneRailCollapsed,
      sectionOpenState
    });
  }, [
    browserStorage,
    builderToolState,
    inspectorCollapsed,
    sceneVisibility,
    sceneRailCollapsed,
    sectionOpenState
  ]);

  const handleSelectEntity = (entityRef: MapEditorSelectedEntityRef | null) => {
    if (entityRef?.kind === "module") {
      const selectedModuleAssetId =
        project.placementDrafts.find(
          (placement) => placement.placementId === entityRef.id
        )?.assetId ?? null;

      if (selectedModuleAssetId !== null) {
        setActiveModuleAssetId(selectedModuleAssetId);
      }
    }

    handleProjectSelectionUpdate((currentProject) =>
      selectMapEditorEntity(currentProject, entityRef)
    );
  };

  const handleMergeTerrainPatches = (terrainPatchIds: readonly string[]) => {
    handleProjectAuthoringChange((currentProject) =>
      mergeMapEditorTerrainPatches(currentProject, terrainPatchIds)
    );
  };

  const handleUpdateSelectedPlacement = (update: MapEditorPlacementUpdate) => {
    handleProjectAuthoringChange((currentProject) =>
      applySelectedPlacementUpdate(currentProject, update)
    );
  };

  const handleUpdateEnvironmentPresentationProfileId = (
    environmentPresentationProfileId: string | null
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorEnvironmentPresentationProfileId(
        currentProject,
        environmentPresentationProfileId
      )
    );
  };

  const handleUpdateEnvironmentPresentation = (
    update: (
      environmentPresentation: MapEditorProjectSnapshot["environmentPresentation"]
    ) => MapEditorProjectSnapshot["environmentPresentation"]
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorEnvironmentPresentation(currentProject, update)
    );
  };

  const handleUpdateGameplayProfileId = (gameplayProfileId: string) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorGameplayProfileId(currentProject, gameplayProfileId)
    );
  };

  const handleUpdateProjectHelperGridSizeMeters = (
    helperGridSizeMeters: number
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorProjectSettings(currentProject, () => ({
        helperGridSizeMeters
      }))
    );
  };

  const handleAddLaunchVariation = () => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorLaunchVariationDraft(currentProject)
    );
  };

  const handleCreatePlayerSpawnAtPosition = (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => {
    const snappedPosition = resolveMapEditorBuildFootprintCenterPosition(
      position,
      position.y,
      1,
      1
    );

    handleProjectAuthoringChange((currentProject) =>
      addMapEditorPlayerSpawnDraft(currentProject, snappedPosition)
    );
  };

  const handleCreateResourceSpawnAtPosition = (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => {
    const snappedPosition = resolveMapEditorBuildFootprintCenterPosition(
      position,
      position.y,
      1,
      1
    );

    handleProjectAuthoringChange((currentProject) =>
      addMapEditorResourceSpawnDraft(currentProject, snappedPosition)
    );
  };

  const handleAddSurface = () => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorSurfaceDraft(currentProject)
    );
  };

  const handleAddRegion = () => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorRegionDraft(currentProject)
    );
  };

  const handleAddEdge = () => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorEdgeDraft(currentProject)
    );
  };

  const handleAddConnector = () => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorConnectorDraft(currentProject)
    );
  };

  const handleCreatePortalAtPosition = (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => {
    const snappedPosition = resolveMapEditorBuildFootprintCenterPosition(
      position,
      position.y,
      1,
      1
    );

    handleProjectAuthoringChange((currentProject) =>
      addMapEditorSceneObjectDraft(
        currentProject,
        Object.freeze({
          x: snappedPosition.x,
          y: snappedPosition.y + 6,
          z: snappedPosition.z
        })
      )
    );
  };

  const handleSelectLaunchVariation = (variationId: string) => {
    handleProjectSelectionUpdate((currentProject) =>
      selectMapEditorLaunchVariation(currentProject, variationId)
    );
  };

  const handleUpdateLaunchVariation = (
    variationId: string,
    update: (
      draft: MapEditorLaunchVariationDraftSnapshot
    ) => MapEditorLaunchVariationDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorLaunchVariationDraft(currentProject, variationId, update)
    );
  };

  const handleCommitViewportPlacementTransform = (
    placementId: string,
    update: MapEditorPlacementUpdate
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      applyPlacementUpdate(currentProject, placementId, update)
    );
  };

  const handleCommitViewportPlayerSpawnTransform = (
    spawnId: string,
    update: MapEditorPlayerSpawnTransformUpdate
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorPlayerSpawnDraft(currentProject, spawnId, (spawnDraft) => ({
        ...spawnDraft,
        position: update.position,
        yawRadians: update.yawRadians
      }))
    );
  };

  const handleCommitViewportEntityTransform = (
    target: MapEditorViewportTransformTargetRef,
    update: MapEditorEntityTransformUpdate
  ) => {
    handleProjectAuthoringChange((currentProject) => {
      switch (target.kind) {
        case "scene-object":
          return updateMapEditorSceneObjectDraft(
            currentProject,
            target.id,
            (sceneObject) => ({
              ...sceneObject,
              position: createTransformPosition(update.position, "cell"),
              rotationYRadians: normalizeEditorCardinalYawRadians(
                update.rotationYRadians
              ),
              scale: scaleMeters(1, update.scale.x, 0.1)
            })
          );
        case "water-region":
          return updateMapEditorWaterRegionDraft(
            currentProject,
            target.id,
            (waterRegion) => {
              const nextDepthMeters = scaleMeters(
                waterRegion.depthMeters,
                update.scale.y,
                0.5
              );
              const nextSizeCellsX = Math.max(
                1,
                Math.round(waterRegion.footprint.sizeCellsX * update.scale.x)
              );
              const nextSizeCellsZ = Math.max(
                1,
                Math.round(waterRegion.footprint.sizeCellsZ * update.scale.z)
              );
              const size = Object.freeze({
                x: nextSizeCellsX * mapEditorBuildGridUnitMeters,
                z: nextSizeCellsZ * mapEditorBuildGridUnitMeters
              });
              const center = createFootprintTransformPosition(
                update.position,
                size
              );

              return {
                ...waterRegion,
                depthMeters: nextDepthMeters,
                footprint: Object.freeze({
                  centerX: center.x,
                  centerZ: center.z,
                  sizeCellsX: nextSizeCellsX,
                  sizeCellsZ: nextSizeCellsZ
                }),
                topElevationMeters: update.position.y + nextDepthMeters * 0.5
              };
            }
          );
        case "terrain-patch":
          return updateMapEditorTerrainPatchDraft(
            currentProject,
            target.id,
            (terrainPatch) => {
              const nextSampleCountX = Math.max(
                2,
                Math.round(
                  (terrainPatch.sampleCountX - 1) * Math.max(0.25, Math.abs(update.scale.x))
                ) + 1
              );
              const nextSampleCountZ = Math.max(
                2,
                Math.round(
                  (terrainPatch.sampleCountZ - 1) * Math.max(0.25, Math.abs(update.scale.z))
                ) + 1
              );
              const verticalScale = Math.max(0.1, Math.abs(update.scale.y));
              const origin = resolveMapEditorBuildFootprintCenterPosition(
                update.position,
                update.position.y,
                nextSampleCountX - 1,
                nextSampleCountZ - 1
              );

              return {
                ...terrainPatch,
                grid: createTerrainPatchGridFromTransform(
                  origin,
                  nextSampleCountX,
                  nextSampleCountZ,
                  terrainPatch.sampleSpacingMeters
                ),
                heightSamples: Object.freeze(
                  resampleTerrainGridSamples(
                    terrainPatch.heightSamples,
                    terrainPatch.sampleCountX,
                    terrainPatch.sampleCountZ,
                    nextSampleCountX,
                    nextSampleCountZ,
                    0
                  ).map(
                    (heightSample) => Math.round(heightSample * verticalScale * 100) / 100
                  )
                ),
                materialLayers: Object.freeze(
                  terrainPatch.materialLayers.map((layer) =>
                    Object.freeze({
                      ...layer,
                      weightSamples: resampleTerrainGridSamples(
                        layer.weightSamples,
                        terrainPatch.sampleCountX,
                        terrainPatch.sampleCountZ,
                        nextSampleCountX,
                        nextSampleCountZ,
                        0
                      )
                    })
                  )
                ),
                origin,
                rotationYRadians: normalizeEditorCardinalYawRadians(
                  update.rotationYRadians
                ),
                sampleCountX: nextSampleCountX,
                sampleCountZ: nextSampleCountZ
              };
            }
          );
        case "terrain-vertex": {
          const terrainVertexTarget = readTerrainVertexTransformTargetId(target.id);

          if (terrainVertexTarget === null) {
            return currentProject;
          }

          return updateMapEditorTerrainPatchDraft(
            currentProject,
            terrainVertexTarget.terrainPatchId,
            (terrainPatch) => {
              if (
                terrainVertexTarget.cellX < 0 ||
                terrainVertexTarget.cellX >= terrainPatch.sampleCountX ||
                terrainVertexTarget.cellZ < 0 ||
                terrainVertexTarget.cellZ >= terrainPatch.sampleCountZ
              ) {
                return terrainPatch;
              }

              const heightIndex =
                terrainVertexTarget.cellZ * terrainPatch.sampleCountX +
                terrainVertexTarget.cellX;
              const nextHeights = [...terrainPatch.heightSamples];

              nextHeights[heightIndex] =
                Math.round((update.position.y - terrainPatch.origin.y) * 100) / 100;

              return {
                ...terrainPatch,
                heightSamples: Object.freeze(nextHeights)
              };
            }
          );
        }
        case "surface":
          return updateMapEditorSurfaceDraft(currentProject, target.id, (surface) => {
            const size = Object.freeze({
              x: scaleMeters(surface.size.x, update.scale.x, 0.25),
              y: scaleMeters(surface.size.y, update.scale.y, 0.05),
              z: scaleMeters(surface.size.z, update.scale.z, 0.25)
            });
            const center = createFootprintTransformPosition(
              update.position,
              size
            );

            return {
              ...surface,
              center,
              elevation: center.y,
              rotationYRadians: normalizeEditorCardinalYawRadians(
                update.rotationYRadians
              ),
              size
            };
          });
        case "region":
          return updateMapEditorRegionDraft(currentProject, target.id, (region) => {
            const size = Object.freeze({
              x: scaleMeters(region.size.x, update.scale.x, 0.25),
              y: scaleMeters(region.size.y, update.scale.y, 0.05),
              z: scaleMeters(region.size.z, update.scale.z, 0.25)
            });

            return {
              ...region,
              center: createFootprintTransformPosition(update.position, size),
              rotationYRadians: normalizeEditorCardinalYawRadians(
                update.rotationYRadians
              ),
              size
            };
          });
        case "edge":
          return updateMapEditorEdgeDraft(currentProject, target.id, (edge) => ({
            ...edge,
            center: createTransformPosition(update.position, "grid"),
            heightMeters: scaleMeters(edge.heightMeters, update.scale.y, 0.25),
            lengthMeters: scaleMeters(edge.lengthMeters, update.scale.x, 0.25),
            rotationYRadians: normalizeEditorCardinalYawRadians(
              update.rotationYRadians
            ),
            thicknessMeters: scaleMeters(edge.thicknessMeters, update.scale.z, 0.1)
          }));
        case "connector":
          return updateMapEditorConnectorDraft(
            currentProject,
            target.id,
            (connector) => {
              const size = Object.freeze({
                x: scaleMeters(connector.size.x, update.scale.x, 0.25),
                y: scaleMeters(connector.size.y, update.scale.y, 0.25),
                z: scaleMeters(connector.size.z, update.scale.z, 0.25)
              });

              return {
                ...connector,
                center: createFootprintTransformPosition(update.position, size),
                rotationYRadians: normalizeEditorCardinalYawRadians(
                  update.rotationYRadians
                ),
                size
              };
            }
          );
        case "structure":
          return updateMapEditorStructuralDraft(
            currentProject,
            target.id,
            (structure) => {
              const size = Object.freeze({
                x: scaleMeters(structure.size.x, update.scale.x, 0.25),
                y: scaleMeters(structure.size.y, update.scale.y, 0.1),
                z: scaleMeters(structure.size.z, update.scale.z, 0.25)
              });
              const center =
                structure.structureKind === "wall"
                  ? createTransformPosition(update.position, "grid")
                  : createFootprintTransformPosition(update.position, size);

              return {
                ...structure,
                center,
                grid: createMapEditorStructuralGrid(center, size),
                rotationYRadians: normalizeEditorCardinalYawRadians(
                  update.rotationYRadians
                ),
                size
              };
            }
          );
        case "gameplay-volume":
          return updateMapEditorGameplayVolumeDraft(
            currentProject,
            target.id,
            (volume) => {
              const size = Object.freeze({
                x: scaleMeters(volume.size.x, update.scale.x, 0.25),
                y: scaleMeters(volume.size.y, update.scale.y, 0.25),
                z: scaleMeters(volume.size.z, update.scale.z, 0.25)
              });

              return {
                ...volume,
                center: createFootprintTransformPosition(update.position, size),
                rotationYRadians: normalizeEditorCardinalYawRadians(
                  update.rotationYRadians
                ),
                routePoints:
                  volume.routePoints.length === 0
                    ? volume.routePoints
                    : Object.freeze(
                        volume.routePoints.map((routePoint) =>
                          createTransformPosition(routePoint, "cell")
                        )
                      ),
                size
              };
            }
          );
        case "light":
          return updateMapEditorLightDraft(currentProject, target.id, (light) => {
            const rangeScale = Math.max(
              0.1,
              (Math.abs(update.scale.x) +
                Math.abs(update.scale.y) +
                Math.abs(update.scale.z)) /
                3
            );

            return {
              ...light,
              position: createTransformPosition(update.position, "none"),
              rangeMeters:
                light.rangeMeters === null
                  ? null
                  : scaleMeters(light.rangeMeters, rangeScale, 0.5),
              rotationYRadians: normalizeEditorCardinalYawRadians(
                update.rotationYRadians
              )
            };
          });
        case "resource-spawn":
          return updateMapEditorResourceSpawnDraft(
            currentProject,
            target.id,
            (resourceSpawn) => ({
              ...resourceSpawn,
              position: createTransformPosition(update.position, "cell"),
              yawRadians: normalizeEditorCardinalYawRadians(
                update.rotationYRadians
              )
            })
          );
        case "placement":
        case "player-spawn":
          return currentProject;
      }
    });
  };

  const handleResetSelectedTransformRequest = () => {
    handleProjectAuthoringChange((currentProject) =>
      currentProject.selectedPlacementId === null
        ? currentProject
        : updateMapEditorPlacement(
            currentProject,
            currentProject.selectedPlacementId,
            (placement) => ({
              ...placement,
              rotationYRadians: 0,
              scale: Object.freeze({
                x: 1,
                y: 1,
                z: 1
              })
            })
          )
    );
  };

  const handleActivateModuleAssetId = (assetId: string) => {
    setActiveModuleAssetId(assetId);
    setViewportToolMode("module");
  };

  const handleActivateViewportToolMode = (
    nextViewportToolMode: MapEditorViewportToolMode
  ) => {
    setViewportToolMode(nextViewportToolMode);
  };

  const handleAddModuleFromAsset = (
    asset: EnvironmentAssetDescriptor
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorPlacementFromAsset(currentProject, asset)
    );
  };

  const handleCreateModuleAtPosition = (
    assetId: string,
    position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    const asset =
      environmentPropManifest.environmentAssets.find(
        (environmentAsset) => environmentAsset.id === assetId
      ) ?? null;

    if (asset === null) {
      return;
    }

    handleProjectAuthoringChange((currentProject) =>
      addMapEditorPlacementAtPositionFromAsset(currentProject, asset, position)
    );
  };

  const handleCreateFloorRegion = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorFloorRegionDraft(currentProject, startPosition, endPosition, {
        elevationMeters: startPosition.y + builderToolState.floorElevationMeters,
        footprintCellsX: builderToolState.floorFootprintCellsX,
        footprintCellsZ: builderToolState.floorFootprintCellsZ,
        materialId: builderToolState.activeMaterialId,
        materialReferenceId: builderToolState.activeMaterialReferenceId,
        regionKind: builderToolState.floorRole,
        slopeRiseMeters:
          builderToolState.surfaceMode === "slope"
            ? builderToolState.riseLayers
            : 0,
        surfaceKind:
          builderToolState.surfaceMode === "slope"
            ? "sloped-plane"
            : "flat-slab"
      })
    );
  };

  const handleCreateFloorPolygonRegion = (
    points: readonly {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }[]
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorFloorPolygonRegionDraft(currentProject, points, {
        elevationMeters: points[0]?.y ?? builderToolState.floorElevationMeters,
        materialId: builderToolState.activeMaterialId,
        materialReferenceId: builderToolState.activeMaterialReferenceId,
        regionKind: builderToolState.floorRole,
        slopeRiseMeters:
          builderToolState.surfaceMode === "slope"
            ? builderToolState.riseLayers
            : 0,
        surfaceKind:
          builderToolState.surfaceMode === "slope"
            ? "sloped-plane"
            : "flat-slab"
      })
    );
  };

  const handleApplyTerrainBrushAtPosition = (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => {
    handleProjectAuthoringChange((currentProject) =>
      applyMapEditorTerrainBrush(
        currentProject,
        position,
        builderToolState.terrainBrushMode,
        builderToolState.terrainBrushSizeCells,
        builderToolState.terrainSmoothEdges,
        builderToolState.terrainBrushStrengthMeters,
        builderToolState.terrainBrushTargetHeightMeters,
        builderToolState.terrainMaterialId,
        builderToolState.terrainNoiseSeed,
        builderToolState.terrainCliffSpanCells
      )
    );
  };

  const handleCreateTerrainPatchAtPositions = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorTerrainPatchDraft(
        currentProject,
        startPosition,
        builderToolState.terrainMaterialId,
        {
          endPosition
        }
      )
    );
  };

  const handleCommitWallSegment = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorWallSegment(
        currentProject,
        startPosition,
        endPosition,
        builderToolState.wallPresetId,
        {
          heightMeters: builderToolState.wallHeightMeters,
          materialReferenceId: builderToolState.activeMaterialReferenceId,
          thicknessMeters: builderToolState.wallThicknessMeters
        }
      )
    );
  };

  const handleCommitPathSegment = (
    targetPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    targetElevationMeters: number,
    fromAnchor: {
      readonly center: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
      readonly elevation: number;
    } | null
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorPathSegment(
        currentProject,
        targetPosition,
        targetElevationMeters,
        fromAnchor === null
          ? null
          : Object.freeze({
              center: Object.freeze({
                x: fromAnchor.center.x,
                y: fromAnchor.center.y,
                z: fromAnchor.center.z
            }),
            elevation: fromAnchor.elevation
        }),
        builderToolState.pathWidthCells,
        builderToolState.activeMaterialId,
        builderToolState.activeMaterialReferenceId
      )
    );
  };

  const handleApplyPathRampToSelection = (riseMeters: number) => {
    handleProjectAuthoringChange((currentProject) =>
      applyMapEditorPathRampToSelection(currentProject, riseMeters)
    );
  };

  const handleCreateWaterRegionAtPosition = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorWaterRegionDraft(currentProject, startPosition, {
        depthMeters: builderToolState.waterDepthMeters,
        endPosition,
        topElevationMeters: builderToolState.waterTopElevationMeters,
        widthCells: builderToolState.waterFootprintCellsX,
        zCells: builderToolState.waterFootprintCellsZ
      })
    );
  };

  const handleCreateCoverAtPosition = (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorCoverDraft(currentProject, position, {
        footprintCellsX: builderToolState.coverFootprintCellsX,
        footprintCellsZ: builderToolState.coverFootprintCellsZ,
        heightCells: builderToolState.coverHeightCells,
        materialId: builderToolState.activeMaterialId,
        materialReferenceId: builderToolState.activeMaterialReferenceId
      })
    );
  };

  const handleCreateTeamZone = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorTeamZoneDraft(
        currentProject,
        startPosition,
        endPosition,
        builderToolState.gameplayVolumeTeamId
      )
    );
  };

  const handleCreateCombatLane = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorCombatLaneDraft(
        currentProject,
        startPosition,
        endPosition,
        builderToolState.gameplayVolumeWidthCells
      )
    );
  };

  const handleCreateVehicleRoute = (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorVehicleRouteDraft(
        currentProject,
        startPosition,
        endPosition,
        builderToolState.gameplayVolumeWidthCells
      )
    );
  };

  const handleCreateLightAtPosition = (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorLightDraft(
        currentProject,
        Object.freeze({
          x: position.x,
          y: position.y + Math.max(2, builderToolState.lightRangeMeters * 0.18),
          z: position.z
        }),
        {
          color: builderToolState.lightColor,
          intensity: builderToolState.lightIntensity,
          lightKind: builderToolState.lightKind,
          rangeMeters: builderToolState.lightRangeMeters
        }
      )
    );
  };

  const handlePaintEntity = (entityRef: MapEditorSelectedEntityRef) => {
    handleProjectAuthoringChange((currentProject) =>
      paintMapEditorEntityMaterial(
        currentProject,
        entityRef,
        builderToolState.activeMaterialId,
        builderToolState.activeMaterialReferenceId
      )
    );
  };

  const handleDeleteEntity = (entityRef: MapEditorSelectedEntityRef) => {
    handleProjectAuthoringChange((currentProject) =>
      removeMapEditorEntity(currentProject, entityRef)
    );
  };

  const handleViewportHelperVisibilityChange = (
    helperId: MapEditorViewportHelperId,
    visible: boolean
  ) => {
    setViewportHelperVisibility((currentVisibility) => {
      if (currentVisibility[helperId] === visible) {
        return currentVisibility;
      }

      return Object.freeze({
        ...currentVisibility,
        [helperId]: visible
      });
    });
  };

  const handleSceneVisibilityChange = (
    layerId: MapEditorSceneVisibilityLayerId,
    visible: boolean
  ) => {
    setSceneVisibility((currentVisibility) => {
      if (currentVisibility[layerId] === visible) {
        return currentVisibility;
      }

      return Object.freeze({
        ...currentVisibility,
        [layerId]: visible
      });
    });
  };

  const handleUpdatePlacementVisibility = (
    placementId: string,
    visible: boolean
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorPlacement(currentProject, placementId, (placement) => ({
        ...placement,
        isVisible: visible
      }))
    );
  };

  const handleUpdatePlayerSpawn = (
    spawnId: string,
    update: (
      draft: MapEditorPlayerSpawnDraftSnapshot
    ) => MapEditorPlayerSpawnDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorPlayerSpawnDraft(currentProject, spawnId, update)
    );
  };

  const handleUpdateResourceSpawn = (
    spawnId: string,
    update: (
      draft: MapEditorResourceSpawnDraftSnapshot
    ) => MapEditorResourceSpawnDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorResourceSpawnDraft(currentProject, spawnId, update)
    );
  };

  const handleUpdatePlayerSpawnSelection = (
    update: (
      draft: MapEditorPlayerSpawnSelectionDraftSnapshot
    ) => MapEditorPlayerSpawnSelectionDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorPlayerSpawnSelectionDraft(currentProject, update)
    );
  };

  const handleUpdateSceneObject = (
    objectId: string,
    update: (
      draft: MapEditorSceneObjectDraftSnapshot
    ) => MapEditorSceneObjectDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorSceneObjectDraft(currentProject, objectId, update)
    );
  };

  const handleUpdateWaterRegion = (
    waterRegionId: string,
    update: (
      draft: MapEditorWaterRegionDraftSnapshot
    ) => MapEditorWaterRegionDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorWaterRegionDraft(currentProject, waterRegionId, update)
    );
  };

  const handleUpdateRegion = (
    regionId: string,
    update: (
      draft: MapEditorRegionDraftSnapshot
    ) => MapEditorRegionDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorRegionDraft(currentProject, regionId, update)
    );
  };

  const handleUpdateEdge = (
    edgeId: string,
    update: (draft: MapEditorEdgeDraftSnapshot) => MapEditorEdgeDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorEdgeDraft(currentProject, edgeId, update)
    );
  };

  const handleUpdateConnector = (
    connectorId: string,
    update: (
      draft: MapEditorConnectorDraftSnapshot
    ) => MapEditorConnectorDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorConnectorDraft(currentProject, connectorId, update)
    );
  };

  const handleUpdateStructure = (
    structureId: string,
    update: (
      draft: MapEditorStructuralDraftSnapshot
    ) => MapEditorStructuralDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorStructuralDraft(currentProject, structureId, update)
    );
  };

  const handleUpdateGameplayVolume = (
    volumeId: string,
    update: (
      draft: MapEditorGameplayVolumeDraftSnapshot
    ) => MapEditorGameplayVolumeDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorGameplayVolumeDraft(currentProject, volumeId, update)
    );
  };

  const handleUpdateLight = (
    lightId: string,
    update: (draft: MapEditorLightDraftSnapshot) => MapEditorLightDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorLightDraft(currentProject, lightId, update)
    );
  };

  const handleCreateMaterialDefinition = (input: {
    readonly accentColorHex?: string | null;
    readonly baseColorHex: string;
    readonly baseMaterialId: MapEditorStructuralDraftSnapshot["materialId"];
    readonly label?: string;
    readonly materialId?: string;
    readonly metalness?: number;
    readonly opacity?: number;
    readonly roughness?: number;
    readonly textureBrightness?: number;
    readonly textureContrast?: number;
    readonly textureImageDataUrl?: string | null;
    readonly texturePatternStrength?: number;
    readonly textureRepeat?: number;
  }) => {
    handleProjectAuthoringChange((currentProject) =>
      addMapEditorMaterialDefinitionDraft(currentProject, input)
    );
  };

  const handleUpdateMaterialDefinition = (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorMaterialDefinitionDraft(currentProject, materialId, update)
    );
  };

  const handleUpdateSurface = (
    surfaceId: string,
    update: (
      draft: MapEditorSurfaceDraftSnapshot
    ) => MapEditorSurfaceDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorSurfaceDraft(currentProject, surfaceId, update)
    );
  };

  const handleUpdateTerrainPatch = (
    terrainPatchId: string,
    update: (
      draft: MapEditorTerrainPatchDraftSnapshot
    ) => MapEditorTerrainPatchDraftSnapshot
  ) => {
    handleProjectAuthoringChange((currentProject) =>
      updateMapEditorTerrainPatchDraft(currentProject, terrainPatchId, update)
    );
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (
        event.repeat !== true &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        handleUndoProjectChangeRequest();
        return;
      }

      if (
        event.repeat !== true &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key === "Delete"
      ) {
        event.preventDefault();
        handleDeleteSelectedEntityRequest();
      }
    };

    globalThis.window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      globalThis.window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, []);

  const handleValidateAndRunRequest = async () => {
    setRunInProgress(true);
    setRunStatusMessage("Registering preview bundle with local authority...");
    const runPreviewResult = await validateAndRegisterMapEditorPreviewBundle(
      project
    );

    setRunInProgress(false);

    if (!runPreviewResult.validation.valid || runPreviewResult.launchSelection === null) {
      setRunStatusMessage(
        runPreviewResult.registrationError ??
          runPreviewResult.validation.errors[0] ??
          "The map draft failed validation."
      );
      return;
    }

    setRunStatusMessage(
      selectedLaunchVariation === null
        ? `Preview bundle ${runPreviewResult.launchSelection.bundleLabel} exported to the runtime registry.`
        : `Running ${selectedLaunchVariation.label} on ${runPreviewResult.launchSelection.bundleLabel}.`
    );
    registerMapEditorProjectPreviewBundle(
      exportMapEditorProjectToMetaverseMapBundle(project),
      resolveMetaverseWorldBundleSourceBundleId(project.bundleId),
      project.projectSettings
    );
    setRegistryEntries(
      readAvailableMapEditorProjectRegistryEntries(publicRegistryEntries)
    );
    setHasUnsavedProjectChanges(false);
    onRunPreviewRequest(runPreviewResult.launchSelection);
  };

  return (
    <section className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgb(14_165_233/0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgb(251_146_60/0.12),transparent_24%),linear-gradient(180deg,rgb(2_6_23),rgb(15_23_42))] text-foreground">
      <header className="shrink-0 border-b border-border/70 bg-background/92 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-3 py-2">
          <MapEditorMenubar
            canDeleteSelectedEntity={isDeletableMapEditorSelection(
              project.selectedEntityRef
            )}
            canResetSelectedTransform={selectedPlacement !== null}
            canUndoProjectChange={canUndoProjectChange}
            onCloseRequest={handleReturnToShellRequest}
            onDeleteSelectedEntityRequest={handleDeleteSelectedEntityRequest}
            onNewProjectRequest={() => openProjectIdentityDialog("new")}
            onResetDraftRequest={handleResetDraftRequest}
            onResetSelectedTransformRequest={handleResetSelectedTransformRequest}
            onSaveAsProjectRequest={() => openProjectIdentityDialog("save-as")}
            onSaveDraftRequest={handleSaveDraftRequest}
            onUndoProjectChangeRequest={handleUndoProjectChangeRequest}
            onValidateAndRunRequest={handleValidateAndRunRequest}
            onViewportHelperVisibilityChange={
              handleViewportHelperVisibilityChange
            }
            viewportHelperVisibility={viewportHelperVisibility}
          />

          <div className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              disabled={runInProgress}
              onClick={handleValidateAndRunRequest}
              size="sm"
              type="button"
            >
              <PlayIcon data-icon="inline-start" />
              <StableInlineText
                stabilizeNumbers={false}
                text={runInProgress ? "Running..." : "Validate + Run"}
              />
            </Button>
          </div>
        </div>

        <MapEditorHeaderToolRow
          onViewportToolModeChange={setViewportToolMode}
          viewportToolMode={viewportToolMode}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup className="h-full min-h-0" orientation="horizontal">
          <ResizablePanel
            collapsedSize={7}
            collapsible
            defaultSize={sceneRailCollapsed ? 7 : 22}
            minSize={18}
            panelRef={(panelApi) => {
              sceneRailPanelApiRef.current = panelApi;
            }}
          >
            {sceneRailCollapsed ? (
              <div className="flex h-full min-h-0 min-w-16 flex-col items-center gap-3 bg-background/84 px-2 py-3 backdrop-blur-sm">
                <Button
                  onClick={() => handleLeftSidebarCollapsedChange(false)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <PanelLeftOpenIcon />
                </Button>
                <div className="pt-6 text-[11px] uppercase tracking-[0.24em] text-muted-foreground [writing-mode:vertical-rl]">
                  Authoring
                </div>
              </div>
            ) : (
              <Tabs
                className="flex h-full min-h-0 flex-col gap-0 overflow-hidden bg-background/84 backdrop-blur-sm"
                onValueChange={(nextTab) => {
                  if (
                    nextTab === "authoring" ||
                    nextTab === "gameplay" ||
                    nextTab === "scene"
                  ) {
                    setActiveLeftSidebarTab(nextTab);
                  }
                }}
                value={activeLeftSidebarTab}
              >
                <div className="flex shrink-0 flex-col gap-2 border-b border-border/70 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-muted/70">
                      <FolderTreeIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Authoring
                      </p>
                      <h2 className="truncate text-sm font-semibold">
                        {formatEditorTabLabel(activeLeftSidebarTab)}
                      </h2>
                    </div>
                    <Button
                      onClick={() => handleLeftSidebarCollapsedChange(true)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <PanelLeftCloseIcon />
                    </Button>
                  </div>

                  <TabsList className="grid h-8 w-full grid-cols-3">
                    <TabsTrigger value="authoring">Project</TabsTrigger>
                    <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
                    <TabsTrigger value="scene">Scene</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  className="mt-0 min-h-0 flex-1 overflow-hidden"
                  value="authoring"
                >
                  <MapEditorToolbar
                    onBundleChange={handleBundleChange}
                    onHelperGridSizeMetersChange={
                      handleUpdateProjectHelperGridSizeMeters
                    }
                    onResetDraftRequest={handleResetDraftRequest}
                    helperGridSizeMeters={
                      project.projectSettings.helperGridSizeMeters
                    }
                    registryEntries={registryEntries}
                    selectedBundleId={selectedBundleId}
                  />
                </TabsContent>

                <TabsContent
                  className="mt-0 min-h-0 flex-1 overflow-hidden"
                  value="gameplay"
                >
                  <MapEditorGameplayPane
                    onAddLaunchVariation={handleAddLaunchVariation}
                    onSectionOpenChange={handleSectionOpenChange}
                    onSelectLaunchVariation={handleSelectLaunchVariation}
                    onUpdateGameplayProfileId={handleUpdateGameplayProfileId}
                    onUpdateLaunchVariation={handleUpdateLaunchVariation}
                    project={project}
                    readSectionOpen={readSectionOpen}
                    selectedLaunchVariation={selectedLaunchVariation}
                  />
                </TabsContent>

                <TabsContent
                  className="mt-0 min-h-0 flex-1 overflow-hidden"
                  value="scene"
                >
                  <MapEditorSceneRail
                    activeModuleAssetId={activeModuleAssetId}
                    activeViewportToolMode={viewportToolMode}
                    assetCatalogEntries={environmentPropManifest.environmentAssets}
                    builderToolsVisible={false}
                    collapsed={false}
                    headerVisible={false}
                    onActivateModuleAssetId={handleActivateModuleAssetId}
                    onActivateViewportToolMode={handleActivateViewportToolMode}
                    onAddConnector={handleAddConnector}
                    onAddEdge={handleAddEdge}
                    onAddModuleFromAsset={handleAddModuleFromAsset}
                    onAddRegion={handleAddRegion}
                    onAddSurface={handleAddSurface}
                    onCollapsedChange={handleLeftSidebarCollapsedChange}
                    onSceneVisibilityChange={handleSceneVisibilityChange}
                    onSectionOpenChange={handleSectionOpenChange}
                    onSelectEntityRef={handleSelectEntity}
                    onMergeTerrainPatches={handleMergeTerrainPatches}
                    onUpdatePlacementVisibility={handleUpdatePlacementVisibility}
                    project={project}
                    readSectionOpen={readSectionOpen}
                    sceneVisibility={sceneVisibility}
                    selectedEntityRef={project.selectedEntityRef}
                  />
                </TabsContent>
              </Tabs>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={inspectorCollapsed ? 68 : 48} minSize={34}>
            <MapEditorViewportPane
              activeModuleAssetId={activeModuleAssetId}
              activeWorkspaceLabel={formatEditorTabLabel(activeLeftSidebarTab)}
              builderToolState={builderToolState}
              bundleLabel={project.bundleLabel}
              bundleLabelReserveTexts={bundleLabelReserveTexts}
              bundleId={project.bundleId}
              connectorDrafts={project.connectorDrafts}
              edgeDrafts={project.edgeDrafts}
              environmentPresentation={project.environmentPresentation}
              gameplayVolumeDrafts={project.gameplayVolumeDrafts}
              helperGridSizeMeters={project.projectSettings.helperGridSizeMeters}
              lightDrafts={project.lightDrafts}
              materialDefinitionDrafts={project.materialDefinitionDrafts}
              onApplyTerrainBrushAtPosition={handleApplyTerrainBrushAtPosition}
              onCreateTerrainPatchAtPositions={handleCreateTerrainPatchAtPositions}
              onCreateCombatLane={handleCreateCombatLane}
              onCreateCoverAtPosition={handleCreateCoverAtPosition}
              onCommitPathSegment={handleCommitPathSegment}
              onCommitEntityTransform={handleCommitViewportEntityTransform}
              onCommitPlacementTransform={handleCommitViewportPlacementTransform}
              onCommitPlayerSpawnTransform={
                handleCommitViewportPlayerSpawnTransform
              }
              onCommitWallSegment={handleCommitWallSegment}
              onCreateFloorPolygonRegion={handleCreateFloorPolygonRegion}
              onCreateFloorRegion={handleCreateFloorRegion}
              onCreateLightAtPosition={handleCreateLightAtPosition}
              onCreateModuleAtPosition={handleCreateModuleAtPosition}
              onCreatePlayerSpawnAtPosition={handleCreatePlayerSpawnAtPosition}
              onCreatePortalAtPosition={handleCreatePortalAtPosition}
              onCreateResourceSpawnAtPosition={
                handleCreateResourceSpawnAtPosition
              }
              onCreateTeamZone={handleCreateTeamZone}
              onCreateVehicleRoute={handleCreateVehicleRoute}
              onCreateWaterRegionAtPosition={handleCreateWaterRegionAtPosition}
              onDeleteEntity={handleDeleteEntity}
              onPaintEntity={handlePaintEntity}
              onSelectEntity={handleSelectEntity}
              placementDrafts={project.placementDrafts}
              playerSpawnDrafts={project.playerSpawnDrafts}
              regionDrafts={project.regionDrafts}
              resourceSpawnDrafts={project.resourceSpawnDrafts}
              sceneObjectDrafts={project.sceneObjectDrafts}
              sceneVisibility={sceneVisibility}
              selectedEntityRef={project.selectedEntityRef}
              selectedEntityLabel={formatSelectedEntityLabel(
                project.selectedEntityRef,
                viewportToolMode
              )}
              structuralDrafts={project.structuralDrafts}
              surfaceDrafts={project.surfaceDrafts}
              terrainPatchDrafts={project.terrainPatchDrafts}
              waterRegionDrafts={project.waterRegionDrafts}
              viewportHelperVisibility={viewportHelperVisibility}
              viewportToolMode={viewportToolMode}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            collapsedSize={7}
            collapsible
            defaultSize={inspectorCollapsed ? 7 : 24}
            minSize={22}
            panelRef={(panelApi) => {
              inspectorPanelApiRef.current = panelApi;
            }}
          >
            {inspectorCollapsed ? (
              <div className="flex h-full min-h-0 min-w-16 flex-col items-center gap-3 bg-background/70 px-2 py-3 backdrop-blur-sm">
                <Button
                  onClick={() => handleInspectorCollapsedChange(false)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <PanelRightOpenIcon />
                </Button>
                <div className="pt-6 text-[11px] uppercase tracking-[0.24em] text-muted-foreground [writing-mode:vertical-rl]">
                  Inspector
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background/70">
                <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Inspector
                    </p>
                    <h2 className="truncate font-heading text-lg font-semibold">
                      Selection & Tools
                    </h2>
                  </div>
                  <Button
                    onClick={() => handleInspectorCollapsedChange(true)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <PanelRightCloseIcon />
                  </Button>
                </div>

                <ResizablePanelGroup
                  className="min-h-0 flex-1"
                  orientation="vertical"
                >
                  <ResizablePanel defaultSize={50} minSize={24}>
                    <MapEditorSelectionPane
                      builderToolState={builderToolState}
                      onBuilderToolStateChange={handleBuilderToolStateChange}
                      onDeleteSelectedEntityRequest={handleDeleteSelectedEntityRequest}
                      onApplyPathRampToSelection={handleApplyPathRampToSelection}
                      onSectionOpenChange={handleSectionOpenChange}
                      onUpdateConnector={handleUpdateConnector}
                      onUpdateEdge={handleUpdateEdge}
                      onUpdateEnvironmentPresentation={
                        handleUpdateEnvironmentPresentation
                      }
                      onUpdateEnvironmentPresentationProfileId={
                        handleUpdateEnvironmentPresentationProfileId
                      }
                      onUpdateGameplayVolume={handleUpdateGameplayVolume}
                      onUpdateLight={handleUpdateLight}
                      onUpdatePlayerSpawn={handleUpdatePlayerSpawn}
                      onUpdatePlayerSpawnSelection={handleUpdatePlayerSpawnSelection}
                      onUpdateRegion={handleUpdateRegion}
                      onUpdateResourceSpawn={handleUpdateResourceSpawn}
                      onUpdateSceneObject={handleUpdateSceneObject}
                      onUpdateSelectedPlacement={handleUpdateSelectedPlacement}
                      onUpdateStructure={handleUpdateStructure}
                      onUpdateSurface={handleUpdateSurface}
                      onUpdateTerrainPatch={handleUpdateTerrainPatch}
                      onUpdateWaterRegion={handleUpdateWaterRegion}
                      project={project}
                      readSectionOpen={readSectionOpen}
                      selectedEntityRef={project.selectedEntityRef}
                      viewportToolMode={viewportToolMode}
                    />
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize={50} minSize={24}>
                    <MapEditorSelectionMaterialControlsPane
                      builderToolState={builderToolState}
                      onBuilderToolStateChange={handleBuilderToolStateChange}
                      onCreateMaterialDefinition={handleCreateMaterialDefinition}
                      onUpdateMaterialDefinition={handleUpdateMaterialDefinition}
                      onUpdateEdge={handleUpdateEdge}
                      onUpdateRegion={handleUpdateRegion}
                      onUpdateSelectedPlacement={handleUpdateSelectedPlacement}
                      onUpdateStructure={handleUpdateStructure}
                      onUpdateTerrainPatch={handleUpdateTerrainPatch}
                      project={project}
                      selectedEntityRef={project.selectedEntityRef}
                      viewportToolMode={viewportToolMode}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <MapEditorProjectIdentityDialog
        dialogState={projectIdentityDialogState}
        onBundleIdChange={updateProjectIdentityDialogBundleId}
        onHelperGridSizeMetersChange={
          updateProjectIdentityDialogHelperGridSizeMeters
        }
        onLabelChange={updateProjectIdentityDialogLabel}
        onOpenChange={(open) => {
          if (!open && !projectIdentityDialogSaving) {
            closeProjectIdentityDialog();
          }
        }}
        onSubmit={handleProjectIdentityDialogSubmit}
        saving={projectIdentityDialogSaving}
      />

      <AlertDialog
        open={returnToShellDialogOpen}
        onOpenChange={setReturnToShellDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save the current map project before returning to the shell?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onCloseRequest}
              variant="outline"
            >
              Don't Save
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndReturnToShellRequest}>
              Save and Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {runStatusMessage !== null ? (
        <div className="pointer-events-none absolute right-4 top-24 w-[calc(100%-2rem)] max-w-lg">
          <Alert className="pointer-events-auto shadow-xl">
            <InfoIcon />
            <AlertTitle>
              {runInProgress ? "Preview" : "Engine Tool"}
            </AlertTitle>
            <AlertDescription>{runStatusMessage}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </section>
  );
}
