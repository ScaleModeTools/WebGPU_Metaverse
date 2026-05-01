import { useState, type ChangeEvent, type ReactNode } from "react";

import { weaponArchetypeManifest } from "@/assets/config/weapon-archetype-manifest";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  FocusIcon,
  MinusIcon,
  PaintbrushIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText
} from "@/components/ui/button-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  conformMapEditorTerrainPatchDraftToSupportSurfaces,
  createNextMapEditorMaterialDefinitionId,
  createNaturalTerrainHeightSamples,
  readSelectedMapEditorPlacement,
  type MapEditorConnectorDraftSnapshot,
  type MapEditorEdgeDraftSnapshot,
  type MapEditorGameplayVolumeDraftSnapshot,
  type MapEditorLightDraftSnapshot,
  type MapEditorMaterialDefinitionDraftSnapshot,
  type MapEditorPlacementDraftSnapshot,
  type MapEditorProjectSnapshot,
  type MapEditorRegionDraftSnapshot,
  type MapEditorSelectedEntityRef,
  type MapEditorStructuralDraftSnapshot,
  type MapEditorSurfaceDraftSnapshot,
  type MapEditorTerrainPatchDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
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
  resolveMapEditorWaterRegionSize
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import { MapEditorWorldSettingsPanel } from "@/engine-tool/panels/inspector/map-editor-world-settings-panel";
import {
  bakeMapEditorProceduralTerrainPatch,
  defaultMapEditorTerrainGenerationConfig
} from "@/engine-tool/project/map-editor-terrain-generation";
import {
  formatMapEditorColorHex,
  parseMapEditorColorHex
} from "@/engine-tool/colors/map-editor-color-hex";
import { MapEditorEditableNumberInput } from "@/engine-tool/components/map-editor-editable-number-input";
import {
  defaultMapEditorMaterialPaletteIds,
  type MapEditorBuilderToolStateSnapshot,
  type MapEditorFloorRole,
  type MapEditorFloorShapeMode,
  type MapEditorGameplayTeamId,
  type MapEditorPlacementUpdate,
  type MapEditorSurfaceMode,
  type MapEditorTerrainBrushMode,
  type MapEditorTerrainBrushSizeCells,
  type MapEditorViewportToolMode,
  type MapEditorWallToolPresetId
} from "@/engine-tool/types/map-editor";
import {
  type MetaverseSceneSemanticPreviewTextureId,
  resolveMetaverseSceneSemanticMaterialProfile,
  resolveMetaverseSceneSemanticPreviewColorHex
} from "@/metaverse/render/environment/metaverse-scene-semantic-material-textures";

import { composeMapEditorLayoutClassName } from "./map-editor-layout-class-name";
import { MapEditorMetadataPanel } from "../panels/inspector/map-editor-metadata-panel";
import { MapEditorPresentationPanel } from "../panels/inspector/map-editor-presentation-panel";
import { MapEditorTransformPanel } from "../panels/inspector/map-editor-transform-panel";

function readSemanticMaterialId(
  value: string
): MapEditorStructuralDraftSnapshot["materialId"] | null {
  return value === "alien-rock" ||
    value === "concrete" ||
    value === "glass" ||
    value === "metal" ||
    value === "terrain-ash" ||
    value === "terrain-basalt" ||
    value === "terrain-cliff" ||
    value === "terrain-dirt" ||
    value === "terrain-gravel" ||
    value === "terrain-grass" ||
    value === "terrain-moss" ||
    value === "terrain-rock" ||
    value === "terrain-sand" ||
    value === "terrain-snow" ||
    value === "team-blue" ||
    value === "team-red" ||
    value === "warning"
    ? value
    : null;
}

function readSemanticPreviewTextureId(
  value: string
): MetaverseSceneSemanticPreviewTextureId | null {
  const semanticMaterialId = readSemanticMaterialId(value);

  if (semanticMaterialId !== null) {
    return semanticMaterialId;
  }

  return value === "__default__" ||
    value === "shell-floor-grid" ||
    value === "shell-metal-panel" ||
    value === "shell-painted-trim"
    ? value
    : null;
}

function readTerrainMaterialId(
  value: string
): MapEditorStructuralDraftSnapshot["materialId"] | null {
  return value === "terrain-ash" ||
    value === "terrain-basalt" ||
    value === "terrain-cliff" ||
    value === "terrain-dirt" ||
    value === "terrain-gravel" ||
    value === "terrain-grass" ||
    value === "terrain-moss" ||
    value === "terrain-rock" ||
    value === "terrain-sand" ||
    value === "terrain-snow"
    ? value
    : null;
}

function resolvePrimaryTerrainMaterialId(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot
): MapEditorStructuralDraftSnapshot["materialId"] {
  let selectedMaterialId: MapEditorStructuralDraftSnapshot["materialId"] =
    "terrain-grass";
  let selectedWeight = Number.NEGATIVE_INFINITY;

  for (const layer of terrainPatch.materialLayers) {
    const totalWeight = layer.weightSamples.reduce(
      (sum, weightSample) => sum + Math.max(0, weightSample),
      0
    );

    if (totalWeight > selectedWeight) {
      selectedMaterialId = layer.materialId;
      selectedWeight = totalWeight;
    }
  }

  return selectedMaterialId;
}

function readTerrainBrushMode(value: string): MapEditorTerrainBrushMode | null {
  return value === "cliff" ||
    value === "flatten" ||
    value === "flatten-pad" ||
    value === "lower" ||
    value === "material" ||
    value === "noise" ||
    value === "plateau" ||
    value === "raise" ||
    value === "ridge" ||
    value === "smooth" ||
    value === "valley"
    ? value
    : null;
}

function readTerrainBrushSizeCells(
  value: string
): MapEditorTerrainBrushSizeCells | null {
  const nextValue = Number(value);

  return Number.isFinite(nextValue)
    ? Math.max(1, Math.min(16, Math.round(nextValue)))
    : null;
}

function readFloorRole(value: string): MapEditorFloorRole | null {
  return value === "floor" || value === "roof" ? value : null;
}

function readFloorShapeMode(value: string): MapEditorFloorShapeMode | null {
  return value === "polygon" || value === "rectangle" ? value : null;
}

function readSurfaceMode(value: string): MapEditorSurfaceMode | null {
  return value === "flat" || value === "slope" ? value : null;
}

function readWallPresetId(value: string): MapEditorWallToolPresetId | null {
  return value === "curb" ||
    value === "fence" ||
    value === "rail" ||
    value === "retaining-wall" ||
    value === "wall"
    ? value
    : null;
}

function readLightKind(
  value: string
): MapEditorLightDraftSnapshot["lightKind"] | null {
  return value === "ambient" ||
    value === "area" ||
    value === "point" ||
    value === "spot" ||
    value === "sun"
    ? value
    : null;
}

function readGameplayTeamId(value: string): MapEditorGameplayTeamId | null {
  return value === "blue" || value === "neutral" || value === "red"
    ? value
    : null;
}

interface QuickMaterialOption {
  readonly baseMaterialId: MapEditorStructuralDraftSnapshot["materialId"];
  readonly colorHex: string;
  readonly id: string;
  readonly isCustom: boolean;
  readonly label: string;
}

const allSemanticMaterialOptions = Object.freeze([
  Object.freeze({ baseMaterialId: "alien-rock", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("alien-rock"), id: "alien-rock", isCustom: false, label: "Alien Rock" }),
  Object.freeze({ baseMaterialId: "concrete", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("concrete"), id: "concrete", isCustom: false, label: "Concrete" }),
  Object.freeze({ baseMaterialId: "metal", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("metal"), id: "metal", isCustom: false, label: "Metal" }),
  Object.freeze({ baseMaterialId: "warning", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("warning"), id: "warning", isCustom: false, label: "Warning" }),
  Object.freeze({ baseMaterialId: "glass", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("glass"), id: "glass", isCustom: false, label: "Glass" }),
  Object.freeze({ baseMaterialId: "team-blue", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("team-blue"), id: "team-blue", isCustom: false, label: "Blue" }),
  Object.freeze({ baseMaterialId: "team-red", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("team-red"), id: "team-red", isCustom: false, label: "Red" }),
  Object.freeze({ baseMaterialId: "terrain-rock", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-rock"), id: "terrain-rock", isCustom: false, label: "Rock" }),
  Object.freeze({ baseMaterialId: "terrain-cliff", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-cliff"), id: "terrain-cliff", isCustom: false, label: "Cliff" }),
  Object.freeze({ baseMaterialId: "terrain-basalt", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-basalt"), id: "terrain-basalt", isCustom: false, label: "Basalt" }),
  Object.freeze({ baseMaterialId: "terrain-gravel", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-gravel"), id: "terrain-gravel", isCustom: false, label: "Gravel" }),
  Object.freeze({ baseMaterialId: "terrain-dirt", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-dirt"), id: "terrain-dirt", isCustom: false, label: "Dirt" }),
  Object.freeze({ baseMaterialId: "terrain-sand", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-sand"), id: "terrain-sand", isCustom: false, label: "Sand" }),
  Object.freeze({ baseMaterialId: "terrain-moss", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-moss"), id: "terrain-moss", isCustom: false, label: "Moss" }),
  Object.freeze({ baseMaterialId: "terrain-snow", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-snow"), id: "terrain-snow", isCustom: false, label: "Snow" }),
  Object.freeze({ baseMaterialId: "terrain-ash", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-ash"), id: "terrain-ash", isCustom: false, label: "Ash" }),
  Object.freeze({ baseMaterialId: "terrain-grass", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-grass"), id: "terrain-grass", isCustom: false, label: "Grass" })
] satisfies readonly QuickMaterialOption[]);

const defaultMaterialQuickOption: QuickMaterialOption = Object.freeze({
  baseMaterialId: "concrete",
  colorHex: resolveMetaverseSceneSemanticPreviewColorHex("__default__"),
  id: "__default__",
  isCustom: false,
  label: "Default"
});

const shellMaterialQuickOptions = Object.freeze([
  Object.freeze({
    baseMaterialId: "concrete",
    colorHex: resolveMetaverseSceneSemanticPreviewColorHex("shell-floor-grid"),
    id: "shell-floor-grid",
    isCustom: false,
    label: "Shell Grid"
  }),
  Object.freeze({
    baseMaterialId: "metal",
    colorHex: resolveMetaverseSceneSemanticPreviewColorHex("shell-metal-panel"),
    id: "shell-metal-panel",
    isCustom: false,
    label: "Metal Panel"
  }),
  Object.freeze({
    baseMaterialId: "concrete",
    colorHex: resolveMetaverseSceneSemanticPreviewColorHex("shell-painted-trim"),
    id: "shell-painted-trim",
    isCustom: false,
    label: "Painted Trim"
  })
] satisfies readonly QuickMaterialOption[]);

const allTerrainMaterialOptions = Object.freeze([
  Object.freeze({ baseMaterialId: "terrain-grass", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-grass"), id: "terrain-grass", isCustom: false, label: "Grass" }),
  Object.freeze({ baseMaterialId: "terrain-rock", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-rock"), id: "terrain-rock", isCustom: false, label: "Rock" }),
  Object.freeze({ baseMaterialId: "terrain-cliff", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-cliff"), id: "terrain-cliff", isCustom: false, label: "Cliff" }),
  Object.freeze({ baseMaterialId: "terrain-basalt", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-basalt"), id: "terrain-basalt", isCustom: false, label: "Basalt" }),
  Object.freeze({ baseMaterialId: "terrain-gravel", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-gravel"), id: "terrain-gravel", isCustom: false, label: "Gravel" }),
  Object.freeze({ baseMaterialId: "terrain-dirt", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-dirt"), id: "terrain-dirt", isCustom: false, label: "Dirt" }),
  Object.freeze({ baseMaterialId: "terrain-sand", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-sand"), id: "terrain-sand", isCustom: false, label: "Sand" }),
  Object.freeze({ baseMaterialId: "terrain-moss", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-moss"), id: "terrain-moss", isCustom: false, label: "Moss" }),
  Object.freeze({ baseMaterialId: "terrain-snow", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-snow"), id: "terrain-snow", isCustom: false, label: "Snow" }),
  Object.freeze({ baseMaterialId: "terrain-ash", colorHex: resolveMetaverseSceneSemanticPreviewColorHex("terrain-ash"), id: "terrain-ash", isCustom: false, label: "Ash" })
] satisfies readonly QuickMaterialOption[]);

function resolveCssRgbToHex(value: string, fallback: string): string {
  const match = /^rgb\((\d{1,3}) (\d{1,3}) (\d{1,3})\)$/.exec(value);

  if (match === null) {
    return value.startsWith("#") ? value : fallback;
  }

  return `#${[match[1], match[2], match[3]]
    .map((channel) =>
      Math.max(0, Math.min(255, Number(channel)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function createCustomMaterialOptions(
  materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[]
): readonly QuickMaterialOption[] {
  return Object.freeze(
    materialDefinitions.map((materialDefinition) =>
      Object.freeze({
        baseMaterialId: materialDefinition.baseMaterialId,
        colorHex: materialDefinition.baseColorHex,
        id: materialDefinition.materialId,
        isCustom: true,
        label: materialDefinition.label
      })
    )
  );
}

function createMaterialLibraryOptions(
  materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[]
): readonly QuickMaterialOption[] {
  return Object.freeze([
    ...createCustomMaterialOptions(materialDefinitions),
    ...shellMaterialQuickOptions,
    ...allSemanticMaterialOptions
  ]);
}

const quickTerrainBrushOptions = Object.freeze([
  Object.freeze({ id: "raise", label: "Raise" }),
  Object.freeze({ id: "lower", label: "Lower" }),
  Object.freeze({ id: "flatten", label: "Flat" }),
  Object.freeze({ id: "smooth", label: "Smooth" }),
  Object.freeze({ id: "material", label: "Paint" })
] satisfies readonly {
  readonly id: MapEditorTerrainBrushMode;
  readonly label: string;
}[]);

const quickWallPresetOptions = Object.freeze([
  Object.freeze({ id: "wall", label: "Wall" }),
  Object.freeze({ id: "fence", label: "Fence" }),
  Object.freeze({ id: "rail", label: "Rail" }),
  Object.freeze({ id: "curb", label: "Curb" }),
  Object.freeze({ id: "retaining-wall", label: "Retain" })
] satisfies readonly {
  readonly id: MapEditorWallToolPresetId;
  readonly label: string;
}[]);

const quickLightKindOptions = Object.freeze([
  Object.freeze({ id: "point", label: "Point" }),
  Object.freeze({ id: "spot", label: "Spot" }),
  Object.freeze({ id: "area", label: "Area" }),
  Object.freeze({ id: "sun", label: "Sun" })
] satisfies readonly {
  readonly id: MapEditorLightDraftSnapshot["lightKind"];
  readonly label: string;
}[]);

const quickTeamOptions = Object.freeze([
  Object.freeze({ id: "neutral", label: "Neutral" }),
  Object.freeze({ id: "blue", label: "Blue" }),
  Object.freeze({ id: "red", label: "Red" })
] satisfies readonly {
  readonly id: MapEditorGameplayTeamId;
  readonly label: string;
}[]);

interface WeaponPickupOption {
  readonly ammoGrantRounds: number;
  readonly assetId: string;
  readonly label: string;
  readonly respawnCooldownMs: number;
  readonly weaponId: string;
}

const weaponPickupOptions: readonly WeaponPickupOption[] = Object.freeze(
  weaponArchetypeManifest.archetypes.map((weaponArchetype) =>
    Object.freeze({
      ammoGrantRounds: weaponArchetype.stats.magazine.maxCarriedAmmo,
      assetId: weaponArchetype.id,
      label: weaponArchetype.label,
      respawnCooldownMs:
        weaponArchetype.family === "launcher" ||
        weaponArchetype.family === "sniper"
          ? 45_000
          : 30_000,
      weaponId: weaponArchetype.id
    })
  )
);

function readWeaponPickupOption(weaponId: string) {
  return (
    weaponPickupOptions.find((option) => option.weaponId === weaponId) ??
    weaponPickupOptions[0]!
  );
}

function parseModeTagsInput(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(",")
      .map((modeTag) => modeTag.trim())
      .filter((modeTag, index, modeTags) =>
        modeTag.length > 0 && modeTags.indexOf(modeTag) === index
      )
  );
}

function formatToolSettingsTitle(
  viewportToolMode: MapEditorViewportToolMode
): string {
  switch (viewportToolMode) {
    case "cover":
      return "Cover Settings";
    case "floor":
      return "Floor Settings";
    case "lane":
      return "Lane Settings";
    case "light":
      return "Light Settings";
    case "paint":
      return "Paint Settings";
    case "path":
      return "Path Settings";
    case "resource-spawn":
      return "Weapon Pickup Settings";
    case "terrain":
      return "Terrain Settings";
    case "vehicle-route":
      return "Route Settings";
    case "wall":
      return "Wall Settings";
    case "water":
      return "Water Settings";
    case "zone":
      return "Zone Settings";
    case "delete":
    case "module":
    case "move":
    case "rotate":
    case "scale":
    case "select":
    default:
      return "Tool Settings";
  }
}

function shouldShowMapEditorActiveToolSettings(
  viewportToolMode: MapEditorViewportToolMode
): boolean {
  return (
    viewportToolMode === "cover" ||
    viewportToolMode === "floor" ||
    viewportToolMode === "lane" ||
    viewportToolMode === "paint" ||
    viewportToolMode === "vehicle-route" ||
    viewportToolMode === "terrain" ||
    viewportToolMode === "wall" ||
    viewportToolMode === "path" ||
    viewportToolMode === "light" ||
    viewportToolMode === "resource-spawn" ||
    viewportToolMode === "water" ||
    viewportToolMode === "zone"
  );
}

function isWorldSelectionKind(
  kind: MapEditorSelectedEntityRef["kind"] | undefined
): boolean {
  return (
    kind === "world-atmosphere" ||
    kind === "world-sky" ||
    kind === "world-sun"
  );
}

function formatSelectionTitle(
  selectedEntityRef: MapEditorSelectedEntityRef | null
): string {
  if (selectedEntityRef === null) {
    return "No Scene Selection";
  }

  switch (selectedEntityRef.kind) {
    case "world-atmosphere":
      return "World / Atmosphere";
    case "world-sky":
      return "World / Sky";
    case "world-sun":
      return "World / Global Sun";
    default:
      return `${selectedEntityRef.kind} / ${selectedEntityRef.id}`;
  }
}

function resolveWorldSettingsScope(
  selectedEntityRef: MapEditorSelectedEntityRef | null
): "atmosphere" | "sky" | "sun" | null {
  switch (selectedEntityRef?.kind) {
    case "world-atmosphere":
      return "atmosphere";
    case "world-sky":
      return "sky";
    case "world-sun":
      return "sun";
    default:
      return null;
  }
}

function createResizedTerrainPatchDraft(
  draft: MapEditorTerrainPatchDraftSnapshot,
  sampleCountX: number,
  sampleCountZ: number
): MapEditorTerrainPatchDraftSnapshot {
  const nextSampleCountX = Math.max(2, Math.round(sampleCountX));
  const nextSampleCountZ = Math.max(2, Math.round(sampleCountZ));
  const nextSampleCount = nextSampleCountX * nextSampleCountZ;
  const resizeSamples = (samples: readonly number[], fillValue: number) =>
    Object.freeze(
      Array.from(
        { length: nextSampleCount },
        (_entry, sampleIndex) => samples[sampleIndex] ?? fillValue
      )
    );

  return {
    ...draft,
    heightSamples: resizeSamples(draft.heightSamples, 0),
    materialLayers: Object.freeze(
      draft.materialLayers.map((layer) =>
        Object.freeze({
          ...layer,
          weightSamples: resizeSamples(layer.weightSamples, 0)
        })
      )
    ),
    sampleCountX: nextSampleCountX,
    sampleCountZ: nextSampleCountZ
  };
}

function createSmoothedTerrainHeightSamples(
  draft: MapEditorTerrainPatchDraftSnapshot,
  passes: number
): readonly number[] {
  let nextHeights = [...draft.heightSamples];
  const passCount = Math.max(1, Math.round(passes));

  for (let passIndex = 0; passIndex < passCount; passIndex += 1) {
    const previousHeights = nextHeights;

    nextHeights = previousHeights.map((currentHeight, sampleIndex) => {
      const sampleX = sampleIndex % draft.sampleCountX;
      const sampleZ = Math.floor(sampleIndex / draft.sampleCountX);
      let totalHeight = 0;
      let sampleCount = 0;

      for (
        let neighborZ = Math.max(0, sampleZ - 1);
        neighborZ <= Math.min(draft.sampleCountZ - 1, sampleZ + 1);
        neighborZ += 1
      ) {
        for (
          let neighborX = Math.max(0, sampleX - 1);
          neighborX <= Math.min(draft.sampleCountX - 1, sampleX + 1);
          neighborX += 1
        ) {
          totalHeight +=
            previousHeights[neighborZ * draft.sampleCountX + neighborX] ?? 0;
          sampleCount += 1;
        }
      }

      const averageHeight =
        sampleCount > 0 ? totalHeight / sampleCount : currentHeight;
      const nextHeight = currentHeight + (averageHeight - currentHeight) * 0.65;

      return Math.round(nextHeight * 100) / 100;
    });
  }

  return Object.freeze(nextHeights);
}

function createSingleTerrainMaterialLayer(
  draft: MapEditorTerrainPatchDraftSnapshot,
  materialId: MapEditorStructuralDraftSnapshot["materialId"]
): MapEditorTerrainPatchDraftSnapshot["materialLayers"] {
  return Object.freeze([
    Object.freeze({
      layerId: `${draft.terrainPatchId}:${materialId}`,
      materialId,
      weightSamples: Object.freeze(
        Array.from(
          { length: draft.sampleCountX * draft.sampleCountZ },
          () => 1
        )
      )
    })
  ]);
}

function Section({
  children,
  onOpenChange,
  open,
  sectionId,
  title
}: {
  readonly children: ReactNode;
  readonly onOpenChange: (sectionId: string, open: boolean) => void;
  readonly open: boolean;
  readonly sectionId: string;
  readonly title: string;
}) {
  return (
    <Collapsible
      onOpenChange={(nextOpen) => onOpenChange(sectionId, nextOpen)}
      open={open}
    >
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between px-2" type="button" variant="ghost">
          {title}
          <ChevronDownIcon
            className={composeMapEditorLayoutClassName(
              "transition-transform",
              open ? "rotate-0" : "-rotate-90"
            )}
            data-icon="inline-end"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Vector3Fields({
  labelPrefix,
  onChange,
  value
}: {
  readonly labelPrefix: string;
  readonly onChange: (
    axis: "x" | "y" | "z",
    nextValue: number
  ) => void;
  readonly value: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {(["x", "y", "z"] as const).map((axis) => (
        <div className="flex flex-col gap-2" key={axis}>
          <Label htmlFor={`${labelPrefix}-${axis}`}>{labelPrefix} {axis.toUpperCase()}</Label>
          <MapEditorEditableNumberInput
            id={`${labelPrefix}-${axis}`}
            onValueChange={(nextValue) => {
              onChange(axis, nextValue);
            }}
            value={value[axis]}
          />
        </div>
      ))}
    </div>
  );
}

function SelectedModuleEditor({
  onDeleteSelectedEntityRequest,
  onSectionOpenChange,
  onUpdateSelectedPlacement,
  readSectionOpen,
  selectedPlacement
}: {
  readonly onDeleteSelectedEntityRequest: () => void;
  readonly onSectionOpenChange: (sectionId: string, open: boolean) => void;
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly readSectionOpen: (sectionId: string, defaultOpen?: boolean) => boolean;
  readonly selectedPlacement: MapEditorPlacementDraftSnapshot;
}) {
  return (
    <>
      <Section
        onOpenChange={onSectionOpenChange}
        open={readSectionOpen("selection-pane:module:transform", true)}
        sectionId="selection-pane:module:transform"
        title="Transform"
      >
        <MapEditorTransformPanel
          onDeleteSelectedPlacementRequest={onDeleteSelectedEntityRequest}
          onUpdateSelectedPlacement={onUpdateSelectedPlacement}
          selectedPlacement={selectedPlacement}
        />
      </Section>

      <Section
        onOpenChange={onSectionOpenChange}
        open={readSectionOpen("selection-pane:module:presentation", true)}
        sectionId="selection-pane:module:presentation"
        title="Presentation"
      >
        <MapEditorPresentationPanel
          onUpdateSelectedPlacement={onUpdateSelectedPlacement}
          selectedPlacement={selectedPlacement}
        />
      </Section>

      <Section
        onOpenChange={onSectionOpenChange}
        open={readSectionOpen("selection-pane:module:metadata", true)}
        sectionId="selection-pane:module:metadata"
        title="Metadata"
      >
        <MapEditorMetadataPanel
          onUpdateSelectedPlacement={onUpdateSelectedPlacement}
          selectedPlacement={selectedPlacement}
        />
      </Section>
    </>
  );
}

function SelectionCard({
  children,
  title
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="mb-3">
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

type MapEditorBuilderToolStateChangeHandler = (
  update: (
    currentBuilderToolState: MapEditorBuilderToolStateSnapshot
  ) => MapEditorBuilderToolStateSnapshot
) => void;

interface MapEditorMaterialDefinitionInput {
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
}

function resolveQuickButtonVariant(active: boolean): "default" | "outline" {
  return active ? "default" : "outline";
}

function resolveQuickMaterialOptionsFromPalette(
  materialPaletteIds: readonly string[],
  sourceOptions: readonly QuickMaterialOption[]
): readonly QuickMaterialOption[] {
  const sourceOptionsById = new Map(
    sourceOptions.map((option) => [option.id, option] as const)
  );
  const paletteOptions = materialPaletteIds.flatMap((materialId) => {
    const option = sourceOptionsById.get(materialId) ?? null;

    return option === null ? [] : [option];
  });

  return paletteOptions.length === 0
    ? sourceOptions.filter((option) =>
        defaultMapEditorMaterialPaletteIds.includes(option.id)
      )
    : Object.freeze(paletteOptions);
}

function QuickMaterialButtonGroup({
  activeMaterialId,
  label,
  onMaterialChange,
  options
}: {
  readonly activeMaterialId: string;
  readonly label: string;
  readonly onMaterialChange: (option: QuickMaterialOption) => void;
  readonly options: readonly QuickMaterialOption[];
}) {
  return (
    <ButtonGroup aria-label={label} className="flex flex-wrap">
      <ButtonGroupText>
        <PaintbrushIcon />
        {label}
      </ButtonGroupText>
      {options.map((option) => (
        <Button
          aria-pressed={activeMaterialId === option.id}
          key={option.id}
          onClick={() => onMaterialChange(option)}
          size="sm"
          type="button"
          variant={resolveQuickButtonVariant(activeMaterialId === option.id)}
        >
          <span
            className="size-2.5 rounded-full border border-border/80"
            style={{
              backgroundColor: option.colorHex
            }}
          />
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function clampMapEditorMaterialScalar(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampMapEditorMaterialTextureScalar(value: number): number {
  return Math.min(2, Math.max(0, value));
}

function clampMapEditorMaterialTextureRepeat(value: number): number {
  return Math.min(32, Math.max(0.25, value));
}

function isMapEditorMaterialPatternFile(file: File): boolean {
  return file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp";
}

function MaterialDefinitionEditorFields({
  fieldIdPrefix,
  materialDefinition,
  onUpdateMaterialDefinition
}: {
  readonly fieldIdPrefix: string;
  readonly materialDefinition: MapEditorMaterialDefinitionDraftSnapshot;
  readonly onUpdateMaterialDefinition: (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => void;
}) {
  const updateMaterialDefinition = (
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => {
    onUpdateMaterialDefinition(materialDefinition.materialId, update);
  };
  const readPatternFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;

    event.currentTarget.value = "";

    if (file === null || !isMapEditorMaterialPatternFile(file)) {
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = reader.result;

      if (typeof result !== "string") {
        return;
      }

      updateMaterialDefinition((draft) => ({
        ...draft,
        textureImageDataUrl: result
      }));
    });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-label`}>Label</Label>
        <Input
          id={`${fieldIdPrefix}-label`}
          onChange={(event) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              label: event.target.value
            }))
          }
          value={materialDefinition.label}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-base-material`}>Base Material</Label>
        <Select
          onValueChange={(nextMaterialId) => {
            const baseMaterialId = readSemanticMaterialId(nextMaterialId);

            if (baseMaterialId === null) {
              return;
            }

            updateMaterialDefinition((draft) => ({
              ...draft,
              baseMaterialId
            }));
          }}
          value={materialDefinition.baseMaterialId}
        >
          <SelectTrigger id={`${fieldIdPrefix}-base-material`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {allSemanticMaterialOptions.map((option) => (
                <SelectItem key={option.id} value={option.baseMaterialId}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-base-color`}>Base Color</Label>
        <Input
          id={`${fieldIdPrefix}-base-color`}
          onChange={(event) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              baseColorHex: event.target.value
            }))
          }
          type="color"
          value={materialDefinition.baseColorHex}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-accent-color`}>Accent Color</Label>
        <Input
          id={`${fieldIdPrefix}-accent-color`}
          onChange={(event) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              accentColorHex: event.target.value
            }))
          }
          type="color"
          value={materialDefinition.accentColorHex ?? materialDefinition.baseColorHex}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-metalness`}>Metalness</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-metalness`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              metalness: clampMapEditorMaterialScalar(nextValue)
            }))
          }
          value={materialDefinition.metalness}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-roughness`}>Roughness</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-roughness`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              roughness: clampMapEditorMaterialScalar(nextValue)
            }))
          }
          value={materialDefinition.roughness}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-opacity`}>Opacity</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-opacity`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              opacity: clampMapEditorMaterialScalar(nextValue)
            }))
          }
          value={materialDefinition.opacity}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-texture-brightness`}>Brightness</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-texture-brightness`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              textureBrightness: clampMapEditorMaterialTextureScalar(nextValue)
            }))
          }
          value={materialDefinition.textureBrightness}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-texture-contrast`}>Contrast</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-texture-contrast`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              textureContrast: clampMapEditorMaterialTextureScalar(nextValue)
            }))
          }
          value={materialDefinition.textureContrast}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-texture-pattern`}>Pattern</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-texture-pattern`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              texturePatternStrength: clampMapEditorMaterialScalar(nextValue)
            }))
          }
          value={materialDefinition.texturePatternStrength}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-texture-repeat`}>Pattern Repeat</Label>
        <MapEditorEditableNumberInput
          decimals={2}
          id={`${fieldIdPrefix}-texture-repeat`}
          onValueChange={(nextValue) =>
            updateMaterialDefinition((draft) => ({
              ...draft,
              textureRepeat: clampMapEditorMaterialTextureRepeat(nextValue)
            }))
          }
          value={materialDefinition.textureRepeat}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${fieldIdPrefix}-texture-file`}>Pattern File</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            accept="image/png,image/jpeg,image/webp"
            className="min-w-0 flex-1"
            id={`${fieldIdPrefix}-texture-file`}
            onChange={readPatternFile}
            type="file"
          />
          <Button
            disabled={materialDefinition.textureImageDataUrl === null}
            onClick={() =>
              updateMaterialDefinition((draft) => ({
                ...draft,
                textureImageDataUrl: null
              }))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Clear Pattern
          </Button>
        </div>
      </div>
    </div>
  );
}

function createEditableMaterialDefinitionDraft(
  option: QuickMaterialOption,
  materialId: string,
  sourceDefinition: MapEditorMaterialDefinitionDraftSnapshot | null = null
): MapEditorMaterialDefinitionDraftSnapshot {
  const profileTextureId =
    readSemanticPreviewTextureId(option.id) ?? option.baseMaterialId;
  const materialProfile =
    resolveMetaverseSceneSemanticMaterialProfile(profileTextureId);

  return Object.freeze({
    accentColorHex: sourceDefinition?.accentColorHex ?? null,
    baseColorHex:
      sourceDefinition?.baseColorHex ??
      resolveCssRgbToHex(option.colorHex, "#94938c"),
    baseMaterialId: sourceDefinition?.baseMaterialId ?? option.baseMaterialId,
    label:
      sourceDefinition?.label ??
      (option.isCustom ? option.label : `${option.label} Custom`),
    materialId,
    metalness: sourceDefinition?.metalness ?? materialProfile.metalness,
    opacity: sourceDefinition?.opacity ?? materialProfile.opacity,
    roughness: sourceDefinition?.roughness ?? materialProfile.roughness,
    textureBrightness: sourceDefinition?.textureBrightness ?? 1,
    textureContrast: sourceDefinition?.textureContrast ?? 1,
    textureImageDataUrl: sourceDefinition?.textureImageDataUrl ?? null,
    texturePatternStrength: sourceDefinition?.texturePatternStrength ?? 1,
    textureRepeat: sourceDefinition?.textureRepeat ?? 1
  });
}

function EditableMaterialDefinitionControls({
  activeDefinition,
  activeOption,
  fieldIdPrefix,
  nextCustomMaterialId,
  onActivateMaterialDefinition,
  onCreateMaterialDefinition,
  onUpdateMaterialDefinition
}: {
  readonly activeDefinition: MapEditorMaterialDefinitionDraftSnapshot | null;
  readonly activeOption: QuickMaterialOption;
  readonly fieldIdPrefix: string;
  readonly nextCustomMaterialId: string | null;
  readonly onActivateMaterialDefinition: (option: QuickMaterialOption) => void;
  readonly onCreateMaterialDefinition: (
    input: MapEditorMaterialDefinitionInput
  ) => void;
  readonly onUpdateMaterialDefinition: (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => void;
}) {
  const editableMaterialId =
    activeDefinition?.materialId ?? nextCustomMaterialId;

  if (editableMaterialId === null) {
    return null;
  }

  const editableDefinition =
    activeDefinition ??
    createEditableMaterialDefinitionDraft(activeOption, editableMaterialId);
  const updateEditableDefinition = (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => {
    if (activeDefinition !== null) {
      onUpdateMaterialDefinition(materialId, update);
      return;
    }

    const nextDefinition = update(editableDefinition);

    onCreateMaterialDefinition(nextDefinition);
    onActivateMaterialDefinition(
      Object.freeze({
        baseMaterialId: nextDefinition.baseMaterialId,
        colorHex: nextDefinition.baseColorHex,
        id: nextDefinition.materialId,
        isCustom: true,
        label: nextDefinition.label
      })
    );
  };

  return (
    <div className="border-t border-border/70 pt-3">
      <MaterialDefinitionEditorFields
        fieldIdPrefix={fieldIdPrefix}
        materialDefinition={editableDefinition}
        onUpdateMaterialDefinition={updateEditableDefinition}
      />
    </div>
  );
}

function MaterialOptionSelect({
  fieldId,
  onMaterialChange,
  options,
  value
}: {
  readonly fieldId: string;
  readonly onMaterialChange: (option: QuickMaterialOption) => void;
  readonly options: readonly QuickMaterialOption[];
  readonly value: string;
}) {
  return (
    <Select
      onValueChange={(nextMaterialReferenceId) => {
        const nextOption =
          options.find((option) => option.id === nextMaterialReferenceId) ?? null;

        if (nextOption !== null) {
          onMaterialChange(nextOption);
        }
      }}
      value={value}
    >
      <SelectTrigger id={fieldId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

type MaterialPaletteTabId = "library" | "palette";

function readMaterialPaletteTabId(value: string): MaterialPaletteTabId {
  return value === "library" ? value : "palette";
}

function MaterialPaletteTabs({
  activeCustomDefinition,
  activeMaterialId,
  builderToolState,
  libraryOptions,
  nextCustomMaterialId,
  onBuilderToolStateChange,
  onCreateMaterialDefinition,
  onMaterialChange,
  onUpdateMaterialDefinition,
  paletteOptions
}: {
  readonly activeCustomDefinition: MapEditorMaterialDefinitionDraftSnapshot | null;
  readonly activeMaterialId: string;
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly libraryOptions: readonly QuickMaterialOption[];
  readonly nextCustomMaterialId: string | null;
  readonly onBuilderToolStateChange: MapEditorBuilderToolStateChangeHandler;
  readonly onCreateMaterialDefinition?: (
    input: MapEditorMaterialDefinitionInput
  ) => void;
  readonly onMaterialChange: (option: QuickMaterialOption) => void;
  readonly onUpdateMaterialDefinition?: (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => void;
  readonly paletteOptions: readonly QuickMaterialOption[];
}) {
  const activeMaterialOption =
    libraryOptions.find((option) => option.id === activeMaterialId) ??
    paletteOptions.find((option) => option.id === activeMaterialId) ??
    null;
  const activeMaterialCanJoinPalette = libraryOptions.some(
    (option) => option.id === activeMaterialId
  );
  const activeMaterialIsInPalette = builderToolState.materialPaletteIds.includes(
    activeMaterialId
  );
  const [activeMaterialTab, setActiveMaterialTab] =
    useState<MaterialPaletteTabId>("palette");
  const customTabEnabled =
    onCreateMaterialDefinition !== undefined &&
    onUpdateMaterialDefinition !== undefined;
  const addActiveMaterialToPalette = () => {
    if (!activeMaterialCanJoinPalette || activeMaterialIsInPalette) {
      return;
    }

    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        materialPaletteIds: Object.freeze([
          ...currentBuilderToolState.materialPaletteIds,
          activeMaterialId
        ])
      })
    );
  };
  const removeActiveMaterialFromPalette = () => {
    if (
      !activeMaterialIsInPalette ||
      builderToolState.materialPaletteIds.length <= 1
    ) {
      return;
    }

    onBuilderToolStateChange((currentBuilderToolState) => {
      const nextPaletteIds = currentBuilderToolState.materialPaletteIds.filter(
        (materialId) => materialId !== activeMaterialId
      );

      return Object.freeze({
        ...currentBuilderToolState,
        materialPaletteIds:
          nextPaletteIds.length === 0
            ? defaultMapEditorMaterialPaletteIds
            : Object.freeze(nextPaletteIds)
      });
    });
  };
  const resetMaterialPalette = () => {
    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        materialPaletteIds: defaultMapEditorMaterialPaletteIds
      })
    );
  };
  return (
    <>
      <Tabs
        className="min-h-0"
        onValueChange={(nextValue) =>
          setActiveMaterialTab(readMaterialPaletteTabId(nextValue))
        }
        value={activeMaterialTab}
      >
        <TabsList>
          <TabsTrigger value="palette">Palette</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>
        <TabsContent value="palette">
          <div className="flex flex-col gap-3">
            <QuickMaterialButtonGroup
              activeMaterialId={activeMaterialId}
              label="Palette"
              onMaterialChange={onMaterialChange}
              options={paletteOptions}
            />
            <ButtonGroup aria-label="Palette actions" className="flex flex-wrap">
              <Button
                disabled={!activeMaterialCanJoinPalette || activeMaterialIsInPalette}
                onClick={addActiveMaterialToPalette}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
              <Button
                disabled={
                  !activeMaterialIsInPalette ||
                  builderToolState.materialPaletteIds.length <= 1
                }
                onClick={removeActiveMaterialFromPalette}
                size="sm"
                type="button"
                variant="outline"
              >
                <MinusIcon data-icon="inline-start" />
                Remove
              </Button>
              <Button
                onClick={resetMaterialPalette}
                size="sm"
                type="button"
                variant="outline"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Reset
              </Button>
            </ButtonGroup>
          </div>
        </TabsContent>
        <TabsContent value="library">
          <div className="flex flex-col gap-3">
            <QuickMaterialButtonGroup
              activeMaterialId={activeMaterialId}
              label="Library"
              onMaterialChange={onMaterialChange}
              options={libraryOptions}
            />
            <Button
              className="w-fit"
              disabled={!activeMaterialCanJoinPalette || activeMaterialIsInPalette}
              onClick={addActiveMaterialToPalette}
              size="sm"
              type="button"
              variant="outline"
            >
              <PlusIcon data-icon="inline-start" />
              Add To Palette
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      {customTabEnabled && activeMaterialOption !== null ? (
        <EditableMaterialDefinitionControls
          activeDefinition={activeCustomDefinition}
          activeOption={activeMaterialOption}
          fieldIdPrefix="active-custom-material"
          nextCustomMaterialId={nextCustomMaterialId}
          onActivateMaterialDefinition={(option) => {
            onBuilderToolStateChange((currentBuilderToolState) =>
              Object.freeze({
                ...currentBuilderToolState,
                activeMaterialId: option.baseMaterialId,
                activeMaterialReferenceId: option.id,
                materialPaletteIds: Object.freeze([
                  ...currentBuilderToolState.materialPaletteIds.filter(
                    (materialId) => materialId !== option.id
                  ),
                  option.id
                ])
              })
            );
          }}
          onCreateMaterialDefinition={onCreateMaterialDefinition!}
          onUpdateMaterialDefinition={onUpdateMaterialDefinition!}
        />
      ) : null}
    </>
  );
}

interface SelectedMaterialControlTarget {
  readonly activeMaterialReferenceId: string;
  readonly fallbackBaseMaterialId: MapEditorStructuralDraftSnapshot["materialId"];
  readonly materialDefinitionControlsEnabled?: boolean;
  readonly onMaterialChange: (option: QuickMaterialOption) => void;
  readonly options: readonly QuickMaterialOption[];
  readonly title: string;
}

function resolveSelectedMaterialControlOption(
  activeMaterialReferenceId: string,
  fallbackBaseMaterialId: MapEditorStructuralDraftSnapshot["materialId"],
  options: readonly QuickMaterialOption[]
): QuickMaterialOption {
  const matchedOption = options.find(
    (option) => option.id === activeMaterialReferenceId
  );

  if (matchedOption !== undefined) {
    return matchedOption;
  }

  const previewTextureId = readSemanticPreviewTextureId(activeMaterialReferenceId);
  const baseMaterialId =
    readSemanticMaterialId(activeMaterialReferenceId) ?? fallbackBaseMaterialId;

  return Object.freeze({
    baseMaterialId,
    colorHex:
      previewTextureId === null
        ? resolveMetaverseSceneSemanticPreviewColorHex(baseMaterialId)
        : resolveMetaverseSceneSemanticPreviewColorHex(previewTextureId),
    id: activeMaterialReferenceId,
    isCustom: false,
    label: activeMaterialReferenceId
  });
}

function SelectedMaterialControls({
  materialDefinitions,
  nextCustomMaterialId,
  onCreateMaterialDefinition,
  onUpdateMaterialDefinition,
  target
}: {
  readonly materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[];
  readonly nextCustomMaterialId: string | null;
  readonly onCreateMaterialDefinition: (
    input: MapEditorMaterialDefinitionInput
  ) => void;
  readonly onUpdateMaterialDefinition: (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => void;
  readonly target: SelectedMaterialControlTarget;
}) {
  const activeOption = resolveSelectedMaterialControlOption(
    target.activeMaterialReferenceId,
    target.fallbackBaseMaterialId,
    target.options
  );
  const options = target.options.some((option) => option.id === activeOption.id)
    ? target.options
    : Object.freeze([activeOption, ...target.options]);
  const activeMaterialDefinition =
    materialDefinitions.find(
      (materialDefinition) => materialDefinition.materialId === activeOption.id
    ) ?? null;
  const baseColorHex =
    activeMaterialDefinition?.baseColorHex ??
    resolveCssRgbToHex(activeOption.colorHex, "#94938c");

  return (
    <SelectionCard title={target.title}>
      <div className="flex items-center gap-3">
        <span
          className="size-9 shrink-0 rounded-xl border border-border/80"
          style={{ backgroundColor: baseColorHex }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{activeOption.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {activeOption.isCustom ? "Custom material" : activeOption.id}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="selected-material-reference">Material</Label>
        <MaterialOptionSelect
          fieldId="selected-material-reference"
          onMaterialChange={target.onMaterialChange}
          options={options}
          value={activeOption.id}
        />
      </div>

      {target.materialDefinitionControlsEnabled === false ? null : (
        <EditableMaterialDefinitionControls
          activeDefinition={activeMaterialDefinition}
          activeOption={activeOption}
          fieldIdPrefix="selected-custom-material"
          nextCustomMaterialId={nextCustomMaterialId}
          onActivateMaterialDefinition={target.onMaterialChange}
          onCreateMaterialDefinition={onCreateMaterialDefinition}
          onUpdateMaterialDefinition={onUpdateMaterialDefinition}
        />
      )}
    </SelectionCard>
  );
}

function MapEditorBuildMaterialControlsPanel({
  builderToolState,
  onBuilderToolStateChange,
  onCreateMaterialDefinition,
  onUpdateMaterialDefinition,
  project,
  selectedMaterialTarget,
  showActiveToolSettings,
  viewportToolMode
}: {
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly onBuilderToolStateChange: MapEditorBuilderToolStateChangeHandler;
  readonly onCreateMaterialDefinition: (
    input: MapEditorMaterialDefinitionInput
  ) => void;
  readonly onUpdateMaterialDefinition: (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly selectedMaterialTarget: SelectedMaterialControlTarget | null;
  readonly showActiveToolSettings: boolean;
  readonly viewportToolMode: MapEditorViewportToolMode;
}) {
  const setActiveMaterial = (option: QuickMaterialOption) => {
    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        activeMaterialId: option.baseMaterialId,
        activeMaterialReferenceId: option.id
      })
    );
  };
  const setTerrainMaterial = (option: QuickMaterialOption) => {
    const terrainMaterialId = readTerrainMaterialId(option.baseMaterialId);

    if (terrainMaterialId === null) {
      return;
    }

    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        terrainMaterialId
      })
    );
  };
  const setPathElevationMode = (
    mode: "down" | "flat" | "up"
  ) => {
    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        pathElevationMode: mode,
        riseLayers:
          mode === "flat"
            ? currentBuilderToolState.riseLayers
            : Math.max(1, Math.abs(Math.round(currentBuilderToolState.riseLayers))),
        surfaceMode: mode === "flat" ? "flat" : "slope"
      })
    );
  };
  const adjustPathRise = (delta: number) => {
    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        riseLayers: Math.max(
          1,
          Math.abs(Math.round(currentBuilderToolState.riseLayers)) + delta
        ),
        surfaceMode:
          currentBuilderToolState.pathElevationMode === "flat"
            ? currentBuilderToolState.surfaceMode
            : "slope"
      })
    );
  };
  const activePathMode =
    builderToolState.surfaceMode === "slope"
      ? builderToolState.pathElevationMode === "down"
        ? "down"
        : "up"
      : "flat";
  const semanticPaletteOptions = resolveQuickMaterialOptionsFromPalette(
    builderToolState.materialPaletteIds,
    createMaterialLibraryOptions(project.materialDefinitionDrafts)
  );
  const semanticLibraryOptions = createMaterialLibraryOptions(
    project.materialDefinitionDrafts
  );
  const terrainPaletteOptions = resolveQuickMaterialOptionsFromPalette(
    builderToolState.materialPaletteIds,
    allTerrainMaterialOptions
  );
  const activeCustomDefinition =
    project.materialDefinitionDrafts.find(
      (materialDefinition) =>
        materialDefinition.materialId === builderToolState.activeMaterialReferenceId
    ) ?? null;
  const nextCustomMaterialId = createNextMapEditorMaterialDefinitionId(project);
  const materialControlsSubtitle = showActiveToolSettings
    ? formatToolSettingsTitle(viewportToolMode)
    : (selectedMaterialTarget?.title ?? "Selection");

  return (
    <div className="flex h-full min-h-0 flex-col bg-background/95">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Material Controls
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {materialControlsSubtitle}
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col gap-3 p-3">
          {viewportToolMode === "path" ? (
            <>
              <ButtonGroup aria-label="Path elevation mode" className="flex flex-wrap">
                <ButtonGroupText>Path</ButtonGroupText>
                <Button
                  aria-pressed={activePathMode === "flat"}
                  onClick={() => setPathElevationMode("flat")}
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(activePathMode === "flat")}
                >
                  <MinusIcon data-icon="inline-start" />
                  Flat
                </Button>
                <Button
                  aria-pressed={activePathMode === "up"}
                  onClick={() => setPathElevationMode("up")}
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(activePathMode === "up")}
                >
                  <ArrowUpIcon data-icon="inline-start" />
                  Up
                </Button>
                <Button
                  aria-pressed={activePathMode === "down"}
                  onClick={() => setPathElevationMode("down")}
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(activePathMode === "down")}
                >
                  <ArrowDownIcon data-icon="inline-start" />
                  Down
                </Button>
              </ButtonGroup>
              <ButtonGroup aria-label="Path rise" className="flex flex-wrap">
                <ButtonGroupText>
                  Rise {Math.max(1, Math.abs(Math.round(builderToolState.riseLayers)))}
                </ButtonGroupText>
                <Button
                  onClick={() => adjustPathRise(-1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <MinusIcon />
                </Button>
                <Button
                  onClick={() => adjustPathRise(1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowUpIcon />
                </Button>
              </ButtonGroup>
              <MaterialPaletteTabs
                activeCustomDefinition={activeCustomDefinition}
                activeMaterialId={builderToolState.activeMaterialReferenceId}
                builderToolState={builderToolState}
                libraryOptions={semanticLibraryOptions}
                nextCustomMaterialId={nextCustomMaterialId}
                onBuilderToolStateChange={onBuilderToolStateChange}
                onCreateMaterialDefinition={onCreateMaterialDefinition}
                onMaterialChange={setActiveMaterial}
                onUpdateMaterialDefinition={onUpdateMaterialDefinition}
                paletteOptions={semanticPaletteOptions}
              />
            </>
          ) : null}

          {viewportToolMode === "floor" ? (
            <>
              <ButtonGroup aria-label="Floor shape" className="flex flex-wrap">
                <ButtonGroupText>Shape</ButtonGroupText>
                <Button
                  aria-pressed={builderToolState.floorShapeMode === "rectangle"}
                  onClick={() =>
                    onBuilderToolStateChange((currentBuilderToolState) =>
                      Object.freeze({
                        ...currentBuilderToolState,
                        floorShapeMode: "rectangle"
                      })
                    )
                  }
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(
                    builderToolState.floorShapeMode === "rectangle"
                  )}
                >
                  Rectangle
                </Button>
                <Button
                  aria-pressed={builderToolState.floorShapeMode === "polygon"}
                  onClick={() =>
                    onBuilderToolStateChange((currentBuilderToolState) =>
                      Object.freeze({
                        ...currentBuilderToolState,
                        floorShapeMode: "polygon"
                      })
                    )
                  }
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(
                    builderToolState.floorShapeMode === "polygon"
                  )}
                >
                  Polygon
                </Button>
              </ButtonGroup>
              <ButtonGroup aria-label="Floor surface" className="flex flex-wrap">
                <ButtonGroupText>Surface</ButtonGroupText>
                <Button
                  aria-pressed={builderToolState.surfaceMode === "flat"}
                  onClick={() =>
                    onBuilderToolStateChange((currentBuilderToolState) =>
                      Object.freeze({
                        ...currentBuilderToolState,
                        surfaceMode: "flat"
                      })
                    )
                  }
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(
                    builderToolState.surfaceMode === "flat"
                  )}
                >
                  Flat
                </Button>
                <Button
                  aria-pressed={builderToolState.surfaceMode === "slope"}
                  onClick={() =>
                    onBuilderToolStateChange((currentBuilderToolState) =>
                      Object.freeze({
                        ...currentBuilderToolState,
                        surfaceMode: "slope"
                      })
                    )
                  }
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(
                    builderToolState.surfaceMode === "slope"
                  )}
                >
                  Slope
                </Button>
              </ButtonGroup>
              <MaterialPaletteTabs
                activeCustomDefinition={activeCustomDefinition}
                activeMaterialId={builderToolState.activeMaterialReferenceId}
                builderToolState={builderToolState}
                libraryOptions={semanticLibraryOptions}
                nextCustomMaterialId={nextCustomMaterialId}
                onBuilderToolStateChange={onBuilderToolStateChange}
                onCreateMaterialDefinition={onCreateMaterialDefinition}
                onMaterialChange={setActiveMaterial}
                onUpdateMaterialDefinition={onUpdateMaterialDefinition}
                paletteOptions={semanticPaletteOptions}
              />
            </>
          ) : null}

          {viewportToolMode === "terrain" ? (
            <>
              <ButtonGroup aria-label="Terrain brush" className="flex flex-wrap">
                <ButtonGroupText>Brush</ButtonGroupText>
                {quickTerrainBrushOptions.map((option) => (
                  <Button
                    aria-pressed={builderToolState.terrainBrushMode === option.id}
                    key={option.id}
                    onClick={() =>
                      onBuilderToolStateChange((currentBuilderToolState) =>
                        Object.freeze({
                          ...currentBuilderToolState,
                          terrainBrushMode: option.id
                        })
                      )
                    }
                    size="sm"
                    type="button"
                    variant={resolveQuickButtonVariant(
                      builderToolState.terrainBrushMode === option.id
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </ButtonGroup>
            </>
          ) : null}

          {viewportToolMode === "terrain" ? (
            <MaterialPaletteTabs
              activeCustomDefinition={null}
              activeMaterialId={builderToolState.terrainMaterialId}
              builderToolState={builderToolState}
              libraryOptions={allTerrainMaterialOptions}
              nextCustomMaterialId={null}
              onBuilderToolStateChange={onBuilderToolStateChange}
              onMaterialChange={setTerrainMaterial}
              paletteOptions={terrainPaletteOptions}
            />
          ) : null}

          {viewportToolMode === "wall" ? (
            <>
              <ButtonGroup aria-label="Wall preset" className="flex flex-wrap">
                <ButtonGroupText>Preset</ButtonGroupText>
                {quickWallPresetOptions.map((option) => (
                  <Button
                    aria-pressed={builderToolState.wallPresetId === option.id}
                    key={option.id}
                    onClick={() => {
                      const presetDimensions =
                        option.id === "curb"
                          ? { heightMeters: 0.75, thicknessMeters: 0.75 }
                          : option.id === "rail"
                            ? { heightMeters: 1.25, thicknessMeters: 0.3 }
                            : option.id === "fence"
                              ? { heightMeters: 2.5, thicknessMeters: 0.35 }
                              : option.id === "retaining-wall"
                                ? { heightMeters: 5, thicknessMeters: 0.75 }
                                : { heightMeters: 4, thicknessMeters: 0.5 };

                      onBuilderToolStateChange((currentBuilderToolState) =>
                        Object.freeze({
                          ...currentBuilderToolState,
                          wallHeightMeters: presetDimensions.heightMeters,
                          wallPresetId: option.id,
                          wallThicknessMeters: presetDimensions.thicknessMeters
                        })
                      );
                    }}
                    size="sm"
                    type="button"
                    variant={resolveQuickButtonVariant(
                      builderToolState.wallPresetId === option.id
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </ButtonGroup>
              <MaterialPaletteTabs
                activeCustomDefinition={activeCustomDefinition}
                activeMaterialId={builderToolState.activeMaterialReferenceId}
                builderToolState={builderToolState}
                libraryOptions={semanticLibraryOptions}
                nextCustomMaterialId={nextCustomMaterialId}
                onBuilderToolStateChange={onBuilderToolStateChange}
                onCreateMaterialDefinition={onCreateMaterialDefinition}
                onMaterialChange={setActiveMaterial}
                onUpdateMaterialDefinition={onUpdateMaterialDefinition}
                paletteOptions={semanticPaletteOptions}
              />
            </>
          ) : null}

          {(viewportToolMode === "cover" || viewportToolMode === "paint") ? (
            <MaterialPaletteTabs
              activeCustomDefinition={activeCustomDefinition}
              activeMaterialId={builderToolState.activeMaterialReferenceId}
              builderToolState={builderToolState}
              libraryOptions={semanticLibraryOptions}
              nextCustomMaterialId={nextCustomMaterialId}
              onBuilderToolStateChange={onBuilderToolStateChange}
              onCreateMaterialDefinition={onCreateMaterialDefinition}
              onMaterialChange={setActiveMaterial}
              onUpdateMaterialDefinition={onUpdateMaterialDefinition}
              paletteOptions={semanticPaletteOptions}
            />
          ) : null}

          {viewportToolMode === "zone" ? (
            <ButtonGroup aria-label="Zone team" className="flex flex-wrap">
              <ButtonGroupText>Team</ButtonGroupText>
              {quickTeamOptions.map((option) => (
                <Button
                  aria-pressed={builderToolState.gameplayVolumeTeamId === option.id}
                  key={option.id}
                  onClick={() =>
                    onBuilderToolStateChange((currentBuilderToolState) =>
                      Object.freeze({
                        ...currentBuilderToolState,
                        gameplayVolumeTeamId: option.id
                      })
                    )
                  }
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(
                    builderToolState.gameplayVolumeTeamId === option.id
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
          ) : null}

          {viewportToolMode === "light" ? (
            <ButtonGroup aria-label="Light kind" className="flex flex-wrap">
              <ButtonGroupText>Light</ButtonGroupText>
              {quickLightKindOptions.map((option) => (
                <Button
                  aria-pressed={builderToolState.lightKind === option.id}
                  key={option.id}
                  onClick={() =>
                    onBuilderToolStateChange((currentBuilderToolState) =>
                      Object.freeze({
                        ...currentBuilderToolState,
                        lightKind: option.id
                      })
                    )
                  }
                  size="sm"
                  type="button"
                  variant={resolveQuickButtonVariant(
                    builderToolState.lightKind === option.id
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
          ) : null}

          {viewportToolMode === "water" ? (
            <ButtonGroup aria-label="Water footprint" className="flex flex-wrap">
              <ButtonGroupText>
                Water {builderToolState.waterFootprintCellsX}x
                {builderToolState.waterFootprintCellsZ}
              </ButtonGroupText>
              <Button
                onClick={() =>
                  onBuilderToolStateChange((currentBuilderToolState) =>
                    Object.freeze({
                      ...currentBuilderToolState,
                      waterFootprintCellsX: Math.max(
                        1,
                        currentBuilderToolState.waterFootprintCellsX - 1
                      ),
                      waterFootprintCellsZ: Math.max(
                        1,
                        currentBuilderToolState.waterFootprintCellsZ - 1
                      )
                    })
                  )
                }
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <MinusIcon />
              </Button>
              <Button
                onClick={() =>
                  onBuilderToolStateChange((currentBuilderToolState) =>
                    Object.freeze({
                      ...currentBuilderToolState,
                      waterFootprintCellsX:
                        currentBuilderToolState.waterFootprintCellsX + 1,
                      waterFootprintCellsZ:
                        currentBuilderToolState.waterFootprintCellsZ + 1
                    })
                  )
                }
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <ArrowUpIcon />
              </Button>
            </ButtonGroup>
          ) : null}
          {selectedMaterialTarget !== null ? (
            <SelectedMaterialControls
              materialDefinitions={project.materialDefinitionDrafts}
              nextCustomMaterialId={nextCustomMaterialId}
              onCreateMaterialDefinition={onCreateMaterialDefinition}
              onUpdateMaterialDefinition={onUpdateMaterialDefinition}
              target={selectedMaterialTarget}
            />
          ) : null}

          {!showActiveToolSettings && selectedMaterialTarget === null ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
              No material controls for the current selection.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

interface MapEditorSelectionMaterialControlsPaneProps {
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly onBuilderToolStateChange: MapEditorBuilderToolStateChangeHandler;
  readonly onCreateMaterialDefinition: (
    input: MapEditorMaterialDefinitionInput
  ) => void;
  readonly onUpdateMaterialDefinition: (
    materialId: string,
    update: (
      draft: MapEditorMaterialDefinitionDraftSnapshot
    ) => MapEditorMaterialDefinitionDraftSnapshot
  ) => void;
  readonly onUpdateEdge: (
    edgeId: string,
    update: (draft: MapEditorEdgeDraftSnapshot) => MapEditorEdgeDraftSnapshot
  ) => void;
  readonly onUpdateRegion: (
    regionId: string,
    update: (draft: MapEditorRegionDraftSnapshot) => MapEditorRegionDraftSnapshot
  ) => void;
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly onUpdateStructure: (
    structureId: string,
    update: (
      draft: MapEditorStructuralDraftSnapshot
    ) => MapEditorStructuralDraftSnapshot
  ) => void;
  readonly onUpdateTerrainPatch: (
    terrainPatchId: string,
    update: (
      draft: MapEditorTerrainPatchDraftSnapshot
    ) => MapEditorTerrainPatchDraftSnapshot
  ) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly selectedEntityRef: MapEditorSelectedEntityRef | null;
  readonly viewportToolMode: MapEditorViewportToolMode;
}

export function MapEditorSelectionMaterialControlsPane({
  builderToolState,
  onBuilderToolStateChange,
  onCreateMaterialDefinition,
  onUpdateMaterialDefinition,
  onUpdateEdge,
  onUpdateRegion,
  onUpdateSelectedPlacement,
  onUpdateStructure,
  onUpdateTerrainPatch,
  project,
  selectedEntityRef,
  viewportToolMode
}: MapEditorSelectionMaterialControlsPaneProps) {
  const selectedPlacement = readSelectedMapEditorPlacement(project);
  const selectedRegion =
    selectedEntityRef?.kind === "region"
      ? (project.regionDrafts.find((region) => region.regionId === selectedEntityRef.id) ??
        null)
      : null;
  const selectedStructure =
    selectedEntityRef?.kind === "structure"
      ? (project.structuralDrafts.find(
          (structure) => structure.structureId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedEdge =
    selectedEntityRef?.kind === "edge"
      ? (project.edgeDrafts.find((edge) => edge.edgeId === selectedEntityRef.id) ??
        null)
      : null;
  const selectedTerrainPatch =
    selectedEntityRef?.kind === "terrain-patch"
      ? (project.terrainPatchDrafts.find(
          (terrainPatch) => terrainPatch.terrainPatchId === selectedEntityRef.id
        ) ?? null)
      : null;
  const showActiveToolSettings =
    shouldShowMapEditorActiveToolSettings(viewportToolMode);
  const materialLibraryOptions = createMaterialLibraryOptions(
    project.materialDefinitionDrafts
  );
  const nullableMaterialLibraryOptions = Object.freeze([
    defaultMaterialQuickOption,
    ...materialLibraryOptions
  ]);
  const selectedMaterialTarget: SelectedMaterialControlTarget | null =
    selectedPlacement !== null
      ? {
          activeMaterialReferenceId:
            selectedPlacement.materialReferenceId ?? defaultMaterialQuickOption.id,
          fallbackBaseMaterialId: "concrete",
          onMaterialChange: (option) => {
            onUpdateSelectedPlacement({
              materialReferenceId:
                option.id === defaultMaterialQuickOption.id ? null : option.id
            });
          },
          options: nullableMaterialLibraryOptions,
          title: "Selected Module Material"
        }
      : selectedStructure !== null
        ? {
            activeMaterialReferenceId:
              selectedStructure.materialReferenceId ?? selectedStructure.materialId,
            fallbackBaseMaterialId: selectedStructure.materialId,
            onMaterialChange: (option) => {
              onUpdateStructure(selectedStructure.structureId, (draft) => ({
                ...draft,
                materialId: option.baseMaterialId,
                materialReferenceId: option.id
              }));
            },
            options: materialLibraryOptions,
            title: "Selected Structure Material"
          }
        : selectedEdge !== null
          ? {
              activeMaterialReferenceId:
                selectedEdge.materialReferenceId ?? "concrete",
              fallbackBaseMaterialId: "concrete",
              onMaterialChange: (option) => {
                onUpdateEdge(selectedEdge.edgeId, (draft) => ({
                  ...draft,
                  materialReferenceId: option.id
                }));
              },
              options: materialLibraryOptions,
              title: "Selected Wall Material"
            }
        : selectedRegion !== null
          ? {
              activeMaterialReferenceId:
                selectedRegion.materialReferenceId ?? defaultMaterialQuickOption.id,
              fallbackBaseMaterialId: "concrete",
              onMaterialChange: (option) => {
                onUpdateRegion(selectedRegion.regionId, (draft) => ({
                  ...draft,
                  materialReferenceId:
                    option.id === defaultMaterialQuickOption.id ? null : option.id
                }));
              },
              options: nullableMaterialLibraryOptions,
              title: "Selected Region Material"
            }
          : selectedTerrainPatch !== null
            ? {
                activeMaterialReferenceId:
                  resolvePrimaryTerrainMaterialId(selectedTerrainPatch),
                fallbackBaseMaterialId:
                  resolvePrimaryTerrainMaterialId(selectedTerrainPatch),
                onMaterialChange: (option) => {
                  const terrainMaterialId = readTerrainMaterialId(option.baseMaterialId);

                  if (terrainMaterialId === null) {
                    return;
                  }

                  onUpdateTerrainPatch(
                    selectedTerrainPatch.terrainPatchId,
                    (draft) => ({
                      ...draft,
                      materialLayers: createSingleTerrainMaterialLayer(
                        draft,
                        terrainMaterialId
                      )
                    })
                  );
                },
                options: allTerrainMaterialOptions,
                materialDefinitionControlsEnabled: false,
                title: "Selected Terrain Material"
              }
            : null;

  return (
    <MapEditorBuildMaterialControlsPanel
      builderToolState={builderToolState}
      onBuilderToolStateChange={onBuilderToolStateChange}
      onCreateMaterialDefinition={onCreateMaterialDefinition}
      onUpdateMaterialDefinition={onUpdateMaterialDefinition}
      project={project}
      selectedMaterialTarget={selectedMaterialTarget}
      showActiveToolSettings={showActiveToolSettings}
      viewportToolMode={viewportToolMode}
    />
  );
}

interface MapEditorSelectionPaneProps {
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly onApplyPathRampToSelection: (riseMeters: number) => void;
  readonly onDeleteSelectedEntityRequest: () => void;
  readonly onBuilderToolStateChange: MapEditorBuilderToolStateChangeHandler;
  readonly onSectionOpenChange: (sectionId: string, open: boolean) => void;
  readonly onUpdateConnector: (
    connectorId: string,
    update: (draft: MapEditorConnectorDraftSnapshot) => MapEditorConnectorDraftSnapshot
  ) => void;
  readonly onUpdateEdge: (
    edgeId: string,
    update: (draft: MapEditorEdgeDraftSnapshot) => MapEditorEdgeDraftSnapshot
  ) => void;
  readonly onUpdatePlayerSpawn: (
    spawnId: string,
    update: (draft: MapEditorPlayerSpawnDraftSnapshot) => MapEditorPlayerSpawnDraftSnapshot
  ) => void;
  readonly onUpdatePlayerSpawnSelection: (
    update: (
      draft: MapEditorPlayerSpawnSelectionDraftSnapshot
    ) => MapEditorPlayerSpawnSelectionDraftSnapshot
  ) => void;
  readonly onUpdateResourceSpawn: (
    spawnId: string,
    update: (
      draft: MapEditorResourceSpawnDraftSnapshot
    ) => MapEditorResourceSpawnDraftSnapshot
  ) => void;
  readonly onUpdateGameplayVolume: (
    volumeId: string,
    update: (
      draft: MapEditorGameplayVolumeDraftSnapshot
    ) => MapEditorGameplayVolumeDraftSnapshot
  ) => void;
  readonly onUpdateEnvironmentPresentation: (
    update: (
      environmentPresentation: MapEditorProjectSnapshot["environmentPresentation"]
    ) => MapEditorProjectSnapshot["environmentPresentation"]
  ) => void;
  readonly onUpdateEnvironmentPresentationProfileId: (
    environmentPresentationProfileId: string | null
  ) => void;
  readonly onUpdateLight: (
    lightId: string,
    update: (draft: MapEditorLightDraftSnapshot) => MapEditorLightDraftSnapshot
  ) => void;
  readonly onUpdateRegion: (
    regionId: string,
    update: (draft: MapEditorRegionDraftSnapshot) => MapEditorRegionDraftSnapshot
  ) => void;
  readonly onUpdateSceneObject: (
    objectId: string,
    update: (draft: MapEditorSceneObjectDraftSnapshot) => MapEditorSceneObjectDraftSnapshot
  ) => void;
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly onUpdateSurface: (
    surfaceId: string,
    update: (draft: MapEditorSurfaceDraftSnapshot) => MapEditorSurfaceDraftSnapshot
  ) => void;
  readonly onUpdateStructure: (
    structureId: string,
    update: (
      draft: MapEditorStructuralDraftSnapshot
    ) => MapEditorStructuralDraftSnapshot
  ) => void;
  readonly onUpdateTerrainPatch: (
    terrainPatchId: string,
    update: (
      draft: MapEditorTerrainPatchDraftSnapshot
    ) => MapEditorTerrainPatchDraftSnapshot
  ) => void;
  readonly onUpdateWaterRegion: (
    waterRegionId: string,
    update: (draft: MapEditorWaterRegionDraftSnapshot) => MapEditorWaterRegionDraftSnapshot
  ) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly readSectionOpen: (sectionId: string, defaultOpen?: boolean) => boolean;
  readonly selectedEntityRef: MapEditorSelectedEntityRef | null;
  readonly viewportToolMode: MapEditorViewportToolMode;
}

export function MapEditorSelectionPane({
  builderToolState,
  onApplyPathRampToSelection,
  onBuilderToolStateChange,
  onDeleteSelectedEntityRequest,
  onSectionOpenChange,
  onUpdateConnector,
  onUpdateEdge,
  onUpdateEnvironmentPresentation,
  onUpdateEnvironmentPresentationProfileId,
  onUpdateGameplayVolume,
  onUpdateLight,
  onUpdatePlayerSpawn,
  onUpdatePlayerSpawnSelection,
  onUpdateRegion,
  onUpdateResourceSpawn,
  onUpdateSceneObject,
  onUpdateSelectedPlacement,
  onUpdateSurface,
  onUpdateStructure,
  onUpdateTerrainPatch,
  onUpdateWaterRegion,
  project,
  readSectionOpen,
  selectedEntityRef,
  viewportToolMode
}: MapEditorSelectionPaneProps) {
  const selectedPlacement = readSelectedMapEditorPlacement(project);
  const selectedWorldSettingsScope = resolveWorldSettingsScope(selectedEntityRef);
  const selectedPlayerSpawn =
    selectedEntityRef?.kind === "player-spawn"
      ? (project.playerSpawnDrafts.find(
          (spawnDraft) => spawnDraft.spawnId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedResourceSpawn =
    selectedEntityRef?.kind === "resource-spawn"
      ? (project.resourceSpawnDrafts.find(
          (resourceSpawnDraft) =>
            resourceSpawnDraft.spawnId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedSceneObject =
    selectedEntityRef?.kind === "scene-object"
      ? (project.sceneObjectDrafts.find(
          (sceneObjectDraft) => sceneObjectDraft.objectId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedWaterRegion =
    selectedEntityRef?.kind === "water-region"
      ? (project.waterRegionDrafts.find(
          (waterRegionDraft) => waterRegionDraft.waterRegionId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedRegion =
    selectedEntityRef?.kind === "region"
      ? (project.regionDrafts.find((region) => region.regionId === selectedEntityRef.id) ??
        null)
      : null;
  const selectedEdge =
    selectedEntityRef?.kind === "edge"
      ? (project.edgeDrafts.find((edge) => edge.edgeId === selectedEntityRef.id) ?? null)
      : null;
  const selectedConnector =
    selectedEntityRef?.kind === "connector"
      ? (project.connectorDrafts.find(
          (connector) => connector.connectorId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedStructure =
    selectedEntityRef?.kind === "structure"
      ? (project.structuralDrafts.find(
          (structure) => structure.structureId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedGameplayVolume =
    selectedEntityRef?.kind === "gameplay-volume"
      ? (project.gameplayVolumeDrafts.find(
          (volume) => volume.volumeId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedLight =
    selectedEntityRef?.kind === "light"
      ? (project.lightDrafts.find((light) => light.lightId === selectedEntityRef.id) ??
        null)
      : null;
  const selectedSurface =
    selectedEntityRef?.kind === "surface"
      ? (project.surfaceDrafts.find(
          (surface) => surface.surfaceId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedSurfacePathRegion =
    selectedSurface === null
      ? null
      : (project.regionDrafts.find(
          (region) =>
            region.regionKind === "path" &&
            region.surfaceId === selectedSurface.surfaceId
        ) ?? null);
  const selectedTerrainPatch =
    selectedEntityRef?.kind === "terrain-patch"
      ? (project.terrainPatchDrafts.find(
          (terrainPatch) => terrainPatch.terrainPatchId === selectedEntityRef.id
        ) ?? null)
      : null;
  const selectedSceneObjectTitle =
    selectedSceneObject?.launchTarget === null ? "Scene Object" : "Portal";
  const selectedPathRampVisible =
    selectedRegion?.regionKind === "path" || selectedSurfacePathRegion !== null;
  const selectedPathRampRiseMeters = Math.max(
    1,
    Math.abs(Math.round(builderToolState.riseLayers))
  );
  const showActiveToolSettings =
    shouldShowMapEditorActiveToolSettings(viewportToolMode);
  const builderMaterialOptions = createMaterialLibraryOptions(
    project.materialDefinitionDrafts
  );
  const activeBuilderMaterialOption = resolveSelectedMaterialControlOption(
    builderToolState.activeMaterialReferenceId,
    builderToolState.activeMaterialId,
    builderMaterialOptions
  );
  const activeBuilderMaterialOptions = builderMaterialOptions.some(
    (option) => option.id === activeBuilderMaterialOption.id
  )
    ? builderMaterialOptions
    : Object.freeze([activeBuilderMaterialOption, ...builderMaterialOptions]);
  const updateBuilderActiveMaterial = (option: QuickMaterialOption) => {
    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        activeMaterialId: option.baseMaterialId,
        activeMaterialReferenceId: option.id
      })
    );
  };
  const updateBuilderTerrainMaterial = (option: QuickMaterialOption) => {
    const terrainMaterialId = readTerrainMaterialId(option.baseMaterialId);

    if (terrainMaterialId === null) {
      return;
    }

    onBuilderToolStateChange((currentBuilderToolState) =>
      Object.freeze({
        ...currentBuilderToolState,
        terrainMaterialId
      })
    );
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background/84 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
          <FocusIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Selection
          </p>
          <h2 className="truncate font-heading text-lg font-semibold">
            {formatSelectionTitle(selectedEntityRef)}
          </h2>
        </div>
        {selectedEntityRef !== null && !isWorldSelectionKind(selectedEntityRef.kind) ? (
          <Button
            onClick={onDeleteSelectedEntityRequest}
            type="button"
            variant="destructive"
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 p-4">
          {showActiveToolSettings ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:active-tool", true)}
              sectionId="selection-pane:active-tool"
              title={formatToolSettingsTitle(viewportToolMode)}
            >
              <SelectionCard
                title={formatToolSettingsTitle(viewportToolMode)}
              >
                {viewportToolMode === "terrain" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-tool-new-terrain-material">
                      New Terrain Material
                    </Label>
                    <MaterialOptionSelect
                      fieldId="selection-tool-new-terrain-material"
                      onMaterialChange={updateBuilderTerrainMaterial}
                      options={allTerrainMaterialOptions}
                      value={builderToolState.terrainMaterialId}
                    />
                  </div>
                ) : null}

                {viewportToolMode === "terrain" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-terrain-brush">Brush Action</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextBrushMode = readTerrainBrushMode(nextValue);

                            if (nextBrushMode !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  terrainBrushMode: nextBrushMode
                                })
                              );
                            }
                          }}
                          value={builderToolState.terrainBrushMode}
                        >
                          <SelectTrigger id="selection-tool-terrain-brush">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="raise">Raise</SelectItem>
                            <SelectItem value="lower">Lower</SelectItem>
                            <SelectItem value="flatten">Flatten</SelectItem>
                            <SelectItem value="flatten-pad">Flatten To Pad</SelectItem>
                            <SelectItem value="smooth">Smooth</SelectItem>
                            <SelectItem value="ridge">Ridge</SelectItem>
                            <SelectItem value="valley">Valley</SelectItem>
                            <SelectItem value="plateau">Plateau</SelectItem>
                            <SelectItem value="cliff">Cliff Terrace</SelectItem>
                            <SelectItem value="noise">Noise</SelectItem>
                            <SelectItem value="material">Paint Style</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-terrain-material">Material</Label>
                        <MaterialOptionSelect
                          fieldId="selection-tool-terrain-material"
                          onMaterialChange={updateBuilderTerrainMaterial}
                          options={allTerrainMaterialOptions}
                          value={builderToolState.terrainMaterialId}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="selection-tool-terrain-size">Brush Size</Label>
                        <span className="text-xs text-muted-foreground">
                          {Math.max(1, Math.round(builderToolState.terrainBrushSizeCells))}x
                          {Math.max(1, Math.round(builderToolState.terrainBrushSizeCells))}
                        </span>
                      </div>
                      <Slider
                        id="selection-tool-terrain-size"
                        max={16}
                        min={1}
                        onValueChange={(values) => {
                          const nextBrushSizeCells = readTerrainBrushSizeCells(
                            String(values[0] ?? 1)
                          );

                          if (nextBrushSizeCells !== null) {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                terrainBrushSizeCells: nextBrushSizeCells
                              })
                            );
                          }
                        }}
                        step={1}
                        value={[
                          Math.max(
                            1,
                            Math.min(16, Math.round(builderToolState.terrainBrushSizeCells))
                          )
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="selection-tool-terrain-cliff-span">Cliff Span</Label>
                        <span className="text-xs text-muted-foreground">
                          {Math.max(0, Math.round(builderToolState.terrainCliffSpanCells))} tiles
                        </span>
                      </div>
                      <Slider
                        id="selection-tool-terrain-cliff-span"
                        max={8}
                        min={0}
                        onValueChange={(values) => {
                          const nextCliffSpanCells = Math.max(
                            0,
                            Math.min(8, Math.round(values[0] ?? 0))
                          );

                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              terrainCliffSpanCells: nextCliffSpanCells
                            })
                          );
                        }}
                        step={1}
                        value={[
                          Math.max(
                            0,
                            Math.min(8, Math.round(builderToolState.terrainCliffSpanCells))
                          )
                        ]}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-terrain-strength">Strength</Label>
                        <MapEditorEditableNumberInput
                          decimals={2}
                          id="selection-tool-terrain-strength"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                terrainBrushStrengthMeters: Math.max(
                                  0.01,
                                  nextValue
                                )
                              })
                            );
                          }}
                          value={builderToolState.terrainBrushStrengthMeters}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-terrain-target">Target</Label>
                        <MapEditorEditableNumberInput
                          decimals={1}
                          id="selection-tool-terrain-target"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                terrainBrushTargetHeightMeters: nextValue
                              })
                            );
                          }}
                          value={builderToolState.terrainBrushTargetHeightMeters}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Smooth Edges</Label>
                      <Button
                        onClick={() =>
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              terrainSmoothEdges:
                                !currentBuilderToolState.terrainSmoothEdges
                            })
                          )
                        }
                        type="button"
                        variant={
                          builderToolState.terrainSmoothEdges ? "default" : "outline"
                        }
                      >
                        {builderToolState.terrainSmoothEdges ? "Enabled" : "Disabled"}
                      </Button>
                    </div>
                  </>
                ) : null}

                {viewportToolMode === "floor" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-role">Role</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextRole = readFloorRole(nextValue);

                            if (nextRole !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  floorRole: nextRole
                                })
                              );
                            }
                          }}
                          value={builderToolState.floorRole}
                        >
                          <SelectTrigger id="selection-tool-floor-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="floor">Floor</SelectItem>
                            <SelectItem value="roof">Roof</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-shape">Shape</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextShapeMode = readFloorShapeMode(nextValue);

                            if (nextShapeMode !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  floorShapeMode: nextShapeMode
                                })
                              );
                            }
                          }}
                          value={builderToolState.floorShapeMode}
                        >
                          <SelectTrigger id="selection-tool-floor-shape">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rectangle">Rectangle</SelectItem>
                            <SelectItem value="polygon">Polygon</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-material">Material</Label>
                        <MaterialOptionSelect
                          fieldId="selection-tool-floor-material"
                          onMaterialChange={updateBuilderActiveMaterial}
                          options={activeBuilderMaterialOptions}
                          value={activeBuilderMaterialOption.id}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-elevation">Elevation Offset</Label>
                        <MapEditorEditableNumberInput
                          decimals={1}
                          id="selection-tool-floor-elevation"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                floorElevationMeters: nextValue
                              })
                            );
                          }}
                          value={builderToolState.floorElevationMeters}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-width">Width Cells</Label>
                        <MapEditorEditableNumberInput
                          decimals={0}
                          id="selection-tool-floor-width"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                floorFootprintCellsX: Math.max(1, Math.round(nextValue))
                              })
                            );
                          }}
                          value={builderToolState.floorFootprintCellsX}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-depth">Depth Cells</Label>
                        <MapEditorEditableNumberInput
                          decimals={0}
                          id="selection-tool-floor-depth"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                floorFootprintCellsZ: Math.max(1, Math.round(nextValue))
                              })
                            );
                          }}
                          value={builderToolState.floorFootprintCellsZ}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-surface-mode">Surface</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextSurfaceMode = readSurfaceMode(nextValue);

                            if (nextSurfaceMode !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  surfaceMode: nextSurfaceMode
                                })
                              );
                            }
                          }}
                          value={builderToolState.surfaceMode}
                        >
                          <SelectTrigger id="selection-tool-floor-surface-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat</SelectItem>
                            <SelectItem value="slope">Slope</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-floor-rise-layers">Rise Layers</Label>
                        <MapEditorEditableNumberInput
                          decimals={0}
                          id="selection-tool-floor-rise-layers"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                riseLayers: Math.round(nextValue)
                              })
                            );
                          }}
                          value={builderToolState.riseLayers}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {(viewportToolMode === "cover" || viewportToolMode === "paint") ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-tool-active-material">Material</Label>
                    <MaterialOptionSelect
                      fieldId="selection-tool-active-material"
                      onMaterialChange={updateBuilderActiveMaterial}
                      options={activeBuilderMaterialOptions}
                      value={activeBuilderMaterialOption.id}
                    />
                  </div>
                ) : null}

                {viewportToolMode === "cover" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-cover-width">Width Cells</Label>
                      <MapEditorEditableNumberInput
                        decimals={0}
                        id="selection-tool-cover-width"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              coverFootprintCellsX: Math.max(1, Math.round(nextValue))
                            })
                          );
                        }}
                        value={builderToolState.coverFootprintCellsX}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-cover-depth">Depth Cells</Label>
                      <MapEditorEditableNumberInput
                        decimals={0}
                        id="selection-tool-cover-depth"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              coverFootprintCellsZ: Math.max(1, Math.round(nextValue))
                            })
                          );
                        }}
                        value={builderToolState.coverFootprintCellsZ}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-cover-height">Height Cells</Label>
                      <MapEditorEditableNumberInput
                        decimals={0}
                        id="selection-tool-cover-height"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              coverHeightCells: Math.max(1, Math.round(nextValue))
                            })
                          );
                        }}
                        value={builderToolState.coverHeightCells}
                      />
                    </div>
                  </div>
                ) : null}

                {(viewportToolMode === "zone" ||
                  viewportToolMode === "lane" ||
                  viewportToolMode === "vehicle-route") ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-volume-width">
                        Volume Width
                      </Label>
                      <MapEditorEditableNumberInput
                        decimals={0}
                        id="selection-tool-volume-width"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              gameplayVolumeWidthCells: Math.max(
                                1,
                                Math.round(nextValue)
                              )
                            })
                          );
                        }}
                        value={builderToolState.gameplayVolumeWidthCells}
                      />
                    </div>
                    {viewportToolMode === "zone" ? (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-volume-team">Team</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextTeamId = readGameplayTeamId(nextValue);

                            if (nextTeamId !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  gameplayVolumeTeamId: nextTeamId
                                })
                              );
                            }
                          }}
                          value={builderToolState.gameplayVolumeTeamId}
                        >
                          <SelectTrigger id="selection-tool-volume-team">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="neutral">Neutral</SelectItem>
                              <SelectItem value="blue">Blue</SelectItem>
                              <SelectItem value="red">Red</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {viewportToolMode === "water" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-water-width">Width Cells</Label>
                      <MapEditorEditableNumberInput
                        decimals={0}
                        id="selection-tool-water-width"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              waterFootprintCellsX: Math.max(1, Math.round(nextValue))
                            })
                          );
                        }}
                        value={builderToolState.waterFootprintCellsX}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-water-depth-cells">
                        Depth Cells
                      </Label>
                      <MapEditorEditableNumberInput
                        decimals={0}
                        id="selection-tool-water-depth-cells"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              waterFootprintCellsZ: Math.max(1, Math.round(nextValue))
                            })
                          );
                        }}
                        value={builderToolState.waterFootprintCellsZ}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-water-top">Top Elevation</Label>
                      <MapEditorEditableNumberInput
                        decimals={1}
                        id="selection-tool-water-top"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              waterTopElevationMeters: nextValue
                            })
                          );
                        }}
                        value={builderToolState.waterTopElevationMeters}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-water-depth">Water Depth</Label>
                      <MapEditorEditableNumberInput
                        decimals={1}
                        id="selection-tool-water-depth"
                        onValueChange={(nextValue) => {
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              waterDepthMeters: Math.max(0.5, nextValue)
                            })
                          );
                        }}
                        value={builderToolState.waterDepthMeters}
                      />
                    </div>
                  </div>
                ) : null}

                {viewportToolMode === "wall" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-tool-wall-preset">Preset</Label>
                    <Select
                      onValueChange={(nextValue) => {
                        const nextPresetId = readWallPresetId(nextValue);

                        if (nextPresetId !== null) {
                          const presetDimensions =
                            nextPresetId === "curb"
                              ? { heightMeters: 0.75, thicknessMeters: 0.75 }
                              : nextPresetId === "rail"
                                ? { heightMeters: 1.25, thicknessMeters: 0.3 }
                                : nextPresetId === "fence"
                                  ? { heightMeters: 2.5, thicknessMeters: 0.35 }
                                  : nextPresetId === "retaining-wall"
                                    ? { heightMeters: 5, thicknessMeters: 0.75 }
                                    : { heightMeters: 4, thicknessMeters: 0.5 };
                          onBuilderToolStateChange((currentBuilderToolState) =>
                            Object.freeze({
                              ...currentBuilderToolState,
                              wallHeightMeters: presetDimensions.heightMeters,
                              wallPresetId: nextPresetId,
                              wallThicknessMeters: presetDimensions.thicknessMeters
                            })
                          );
                        }
                      }}
                      value={builderToolState.wallPresetId}
                    >
                      <SelectTrigger id="selection-tool-wall-preset">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wall">Wall</SelectItem>
                        <SelectItem value="fence">Fence</SelectItem>
                        <SelectItem value="rail">Rail</SelectItem>
                        <SelectItem value="curb">Curb</SelectItem>
                        <SelectItem value="retaining-wall">Retaining Wall</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-wall-material">Material</Label>
                      <MaterialOptionSelect
                        fieldId="selection-tool-wall-material"
                        onMaterialChange={updateBuilderActiveMaterial}
                        options={activeBuilderMaterialOptions}
                        value={activeBuilderMaterialOption.id}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-wall-height">Height</Label>
                        <MapEditorEditableNumberInput
                          decimals={2}
                          id="selection-tool-wall-height"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                wallHeightMeters: Math.max(0.25, nextValue)
                              })
                            );
                          }}
                          value={builderToolState.wallHeightMeters}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-wall-thickness">Thickness</Label>
                        <MapEditorEditableNumberInput
                          decimals={2}
                          id="selection-tool-wall-thickness"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                wallThicknessMeters: Math.max(0.1, nextValue)
                              })
                            );
                          }}
                          value={builderToolState.wallThicknessMeters}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {viewportToolMode === "path" ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-tool-path-material">Material</Label>
                      <MaterialOptionSelect
                        fieldId="selection-tool-path-material"
                        onMaterialChange={updateBuilderActiveMaterial}
                        options={activeBuilderMaterialOptions}
                        value={activeBuilderMaterialOption.id}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-path-width">Width Cells</Label>
                        <MapEditorEditableNumberInput
                          decimals={0}
                          id="selection-tool-path-width"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                pathWidthCells: Math.max(1, Math.round(nextValue))
                              })
                            );
                          }}
                          value={builderToolState.pathWidthCells}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-path-mode">Surface</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextSurfaceMode = readSurfaceMode(nextValue);

                            if (nextSurfaceMode !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  surfaceMode: nextSurfaceMode
                                })
                              );
                            }
                          }}
                          value={builderToolState.surfaceMode}
                        >
                          <SelectTrigger id="selection-tool-path-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat</SelectItem>
                            <SelectItem value="slope">Slope</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-path-elevation">Rise Layers</Label>
                        <MapEditorEditableNumberInput
                          decimals={0}
                          id="selection-tool-path-elevation"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                riseLayers: Math.round(nextValue)
                              })
                            );
                          }}
                          value={builderToolState.riseLayers}
                        />
                      </div>
                      {builderToolState.surfaceMode === "slope" ? (
                        <>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="selection-tool-path-length">Length Cells</Label>
                            <MapEditorEditableNumberInput
                              decimals={0}
                              id="selection-tool-path-length"
                              onValueChange={(nextValue) => {
                                onBuilderToolStateChange((currentBuilderToolState) =>
                                  Object.freeze({
                                    ...currentBuilderToolState,
                                    pathSlopeLengthCells: Math.max(
                                      1,
                                      Math.round(nextValue)
                                    )
                                  })
                                );
                              }}
                              value={builderToolState.pathSlopeLengthCells}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="selection-tool-path-rotation">Rotation</Label>
                            <MapEditorEditableNumberInput
                              decimals={1}
                              id="selection-tool-path-rotation"
                              onValueChange={(nextValue) => {
                                onBuilderToolStateChange((currentBuilderToolState) =>
                                  Object.freeze({
                                    ...currentBuilderToolState,
                                    pathSlopeRotationDegrees: nextValue
                                  })
                                );
                              }}
                              value={builderToolState.pathSlopeRotationDegrees}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {viewportToolMode === "light" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-light-kind">Kind</Label>
                        <Select
                          onValueChange={(nextValue) => {
                            const nextLightKind = readLightKind(nextValue);

                            if (nextLightKind !== null) {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  lightKind: nextLightKind
                                })
                              );
                            }
                          }}
                          value={builderToolState.lightKind}
                        >
                          <SelectTrigger id="selection-tool-light-kind">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="point">Point</SelectItem>
                            <SelectItem value="spot">Spot</SelectItem>
                            <SelectItem value="ambient">Ambient</SelectItem>
                            <SelectItem value="sun">Sun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-light-color">Color</Label>
                        <Input
                          className="h-10 cursor-pointer p-1"
                          id="selection-tool-light-color"
                          onChange={(event) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                lightColor: parseMapEditorColorHex(
                                  event.target.value,
                                  currentBuilderToolState.lightColor
                                )
                              })
                            );
                          }}
                          type="color"
                          value={formatMapEditorColorHex(builderToolState.lightColor)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="selection-tool-light-intensity">Intensity</Label>
                        <MapEditorEditableNumberInput
                          decimals={1}
                          id="selection-tool-light-intensity"
                          onValueChange={(nextValue) => {
                            onBuilderToolStateChange((currentBuilderToolState) =>
                              Object.freeze({
                                ...currentBuilderToolState,
                                lightIntensity: Math.max(0, nextValue)
                              })
                            );
                          }}
                          value={builderToolState.lightIntensity}
                        />
                      </div>
                      {builderToolState.lightKind === "ambient" ||
                      builderToolState.lightKind === "sun" ? null : (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="selection-tool-light-range">Range</Label>
                          <MapEditorEditableNumberInput
                            decimals={1}
                            id="selection-tool-light-range"
                            onValueChange={(nextValue) => {
                              onBuilderToolStateChange((currentBuilderToolState) =>
                                Object.freeze({
                                  ...currentBuilderToolState,
                                  lightRangeMeters: Math.max(1, nextValue)
                                })
                              );
                            }}
                            value={builderToolState.lightRangeMeters}
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </SelectionCard>
            </Section>
          ) : null}

          {selectedWorldSettingsScope !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:world", true)}
              sectionId="selection-pane:world"
              title="World"
            >
              <MapEditorWorldSettingsPanel
                onUpdateEnvironmentPresentation={onUpdateEnvironmentPresentation}
                onUpdateEnvironmentPresentationProfileId={
                  onUpdateEnvironmentPresentationProfileId
                }
                project={project}
                scope={selectedWorldSettingsScope}
              />
            </Section>
          ) : null}

          {selectedPlacement !== null ? (
            <SelectedModuleEditor
              onDeleteSelectedEntityRequest={onDeleteSelectedEntityRequest}
              onSectionOpenChange={onSectionOpenChange}
              onUpdateSelectedPlacement={onUpdateSelectedPlacement}
              readSectionOpen={readSectionOpen}
              selectedPlacement={selectedPlacement}
            />
          ) : null}

          {selectedPlayerSpawn !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:player-spawn", true)}
              sectionId="selection-pane:player-spawn"
              title="Player Spawn"
            >
              <SelectionCard title="Player Spawn">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-player-spawn-label">Label</Label>
                  <Input
                    id="selection-player-spawn-label"
                    onChange={(event) =>
                      onUpdatePlayerSpawn(selectedPlayerSpawn.spawnId, (draft) => ({
                        ...draft,
                        label: event.target.value
                      }))
                    }
                    value={selectedPlayerSpawn.label}
                  />
                </div>
                <Vector3Fields
                  labelPrefix="Spawn"
                  onChange={(axis, nextValue) =>
                    onUpdatePlayerSpawn(selectedPlayerSpawn.spawnId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedPlayerSpawn.position}
                />
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-player-spawn-yaw">Yaw</Label>
                    <MapEditorEditableNumberInput
                      id="selection-player-spawn-yaw"
                      onValueChange={(nextValue) => {
                        onUpdatePlayerSpawn(selectedPlayerSpawn.spawnId, (draft) => ({
                          ...draft,
                          yawRadians: nextValue
                        }));
                      }}
                      value={selectedPlayerSpawn.yawRadians}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-player-spawn-team">Team</Label>
                    <Select
                      onValueChange={(nextValue) => {
                        const nextTeamId = readGameplayTeamId(nextValue);

                        if (nextTeamId !== null) {
                          onUpdatePlayerSpawn(selectedPlayerSpawn.spawnId, (draft) => ({
                            ...draft,
                            teamId: nextTeamId
                          }));
                        }
                      }}
                      value={selectedPlayerSpawn.teamId}
                    >
                      <SelectTrigger id="selection-player-spawn-team">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {quickTeamOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-player-spawn-bias">Home Bias</Label>
                    <MapEditorEditableNumberInput
                      id="selection-player-spawn-bias"
                      onValueChange={(nextValue) => {
                        onUpdatePlayerSpawnSelection((draft) => ({
                          ...draft,
                          homeTeamBiasMeters: Math.max(0, nextValue)
                        }));
                      }}
                      value={project.playerSpawnSelectionDraft.homeTeamBiasMeters}
                    />
                  </div>
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedResourceSpawn !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:resource-spawn", true)}
              sectionId="selection-pane:resource-spawn"
              title="Weapon Pickup"
            >
              <SelectionCard title="Weapon Pickup">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-resource-spawn-label">Label</Label>
                  <Input
                    id="selection-resource-spawn-label"
                    onChange={(event) =>
                      onUpdateResourceSpawn(
                        selectedResourceSpawn.spawnId,
                        (draft) => ({
                          ...draft,
                          label: event.target.value
                        })
                      )
                    }
                    value={selectedResourceSpawn.label}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-resource-spawn-weapon">Weapon</Label>
                  <Select
                    onValueChange={(nextWeaponId) => {
                      const option = readWeaponPickupOption(nextWeaponId);

                      onUpdateResourceSpawn(
                        selectedResourceSpawn.spawnId,
                        (draft) => ({
                          ...draft,
                          ammoGrantRounds: option.ammoGrantRounds,
                          assetId: option.assetId,
                          respawnCooldownMs: option.respawnCooldownMs,
                          weaponId: option.weaponId
                        })
                      );
                    }}
                    value={selectedResourceSpawn.weaponId}
                  >
                    <SelectTrigger id="selection-resource-spawn-weapon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {weaponPickupOptions.map((option) => (
                          <SelectItem key={option.weaponId} value={option.weaponId}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Vector3Fields
                  labelPrefix="Pickup"
                  onChange={(axis, nextValue) =>
                    onUpdateResourceSpawn(
                      selectedResourceSpawn.spawnId,
                      (draft) => ({
                        ...draft,
                        position: {
                          ...draft.position,
                          [axis]: nextValue
                        }
                      })
                    )
                  }
                  value={selectedResourceSpawn.position}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-resource-spawn-ammo">Ammo</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-resource-spawn-ammo"
                      onValueChange={(nextValue) =>
                        onUpdateResourceSpawn(
                          selectedResourceSpawn.spawnId,
                          (draft) => ({
                            ...draft,
                            ammoGrantRounds: Math.max(1, Math.round(nextValue))
                          })
                        )
                      }
                      value={selectedResourceSpawn.ammoGrantRounds}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-resource-spawn-respawn">
                      Respawn Seconds
                    </Label>
                    <MapEditorEditableNumberInput
                      decimals={1}
                      id="selection-resource-spawn-respawn"
                      onValueChange={(nextValue) =>
                        onUpdateResourceSpawn(
                          selectedResourceSpawn.spawnId,
                          (draft) => ({
                            ...draft,
                            respawnCooldownMs: Math.max(
                              0,
                              Math.round(nextValue * 1000)
                            )
                          })
                        )
                      }
                      value={selectedResourceSpawn.respawnCooldownMs / 1000}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-resource-spawn-radius">
                      Pickup Radius
                    </Label>
                    <MapEditorEditableNumberInput
                      decimals={2}
                      id="selection-resource-spawn-radius"
                      onValueChange={(nextValue) =>
                        onUpdateResourceSpawn(
                          selectedResourceSpawn.spawnId,
                          (draft) => ({
                            ...draft,
                            pickupRadiusMeters: Math.max(0.1, nextValue)
                          })
                        )
                      }
                      value={selectedResourceSpawn.pickupRadiusMeters}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-resource-spawn-yaw">Yaw</Label>
                    <MapEditorEditableNumberInput
                      id="selection-resource-spawn-yaw"
                      onValueChange={(nextValue) =>
                        onUpdateResourceSpawn(
                          selectedResourceSpawn.spawnId,
                          (draft) => ({
                            ...draft,
                            yawRadians: nextValue
                          })
                        )
                      }
                      value={selectedResourceSpawn.yawRadians}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-resource-spawn-mode-tags">
                    Mode Tags
                  </Label>
                  <Input
                    id="selection-resource-spawn-mode-tags"
                    onChange={(event) =>
                      onUpdateResourceSpawn(
                        selectedResourceSpawn.spawnId,
                        (draft) => ({
                          ...draft,
                          modeTags: parseModeTagsInput(event.target.value)
                        })
                      )
                    }
                    value={selectedResourceSpawn.modeTags.join(", ")}
                  />
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedSceneObject !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:scene-object", true)}
              sectionId="selection-pane:scene-object"
              title={selectedSceneObjectTitle}
            >
              <SelectionCard title={selectedSceneObjectTitle}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-scene-object-label">Label</Label>
                  <Input
                    id="selection-scene-object-label"
                    onChange={(event) =>
                      onUpdateSceneObject(selectedSceneObject.objectId, (draft) => ({
                        ...draft,
                        label: event.target.value
                      }))
                    }
                    value={selectedSceneObject.label}
                  />
                </div>
                <Vector3Fields
                  labelPrefix="Object"
                  onChange={(axis, nextValue) =>
                    onUpdateSceneObject(selectedSceneObject.objectId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedSceneObject.position}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-scene-object-yaw">Yaw</Label>
                    <MapEditorEditableNumberInput
                      id="selection-scene-object-yaw"
                      onValueChange={(nextValue) => {
                        onUpdateSceneObject(selectedSceneObject.objectId, (draft) => ({
                          ...draft,
                          rotationYRadians: nextValue
                        }));
                      }}
                      value={selectedSceneObject.rotationYRadians}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-scene-object-scale">Scale</Label>
                    <MapEditorEditableNumberInput
                      id="selection-scene-object-scale"
                      onValueChange={(nextValue) => {
                        onUpdateSceneObject(selectedSceneObject.objectId, (draft) => ({
                          ...draft,
                          scale: Math.max(0.1, nextValue)
                        }));
                      }}
                      value={selectedSceneObject.scale}
                    />
                  </div>
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedWaterRegion !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:water-region", true)}
              sectionId="selection-pane:water-region"
              title="Water Region"
            >
              <SelectionCard title="Water Region">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-water-center-x">Center X</Label>
                    <MapEditorEditableNumberInput
                      id="selection-water-center-x"
                      onValueChange={(nextValue) => {
                        onUpdateWaterRegion(selectedWaterRegion.waterRegionId, (draft) => ({
                          ...draft,
                          footprint: {
                            ...draft.footprint,
                            centerX: nextValue
                          }
                        }));
                      }}
                      value={selectedWaterRegion.footprint.centerX}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-water-center-z">Center Z</Label>
                    <MapEditorEditableNumberInput
                      id="selection-water-center-z"
                      onValueChange={(nextValue) => {
                        onUpdateWaterRegion(selectedWaterRegion.waterRegionId, (draft) => ({
                          ...draft,
                          footprint: {
                            ...draft.footprint,
                            centerZ: nextValue
                          }
                        }));
                      }}
                      value={selectedWaterRegion.footprint.centerZ}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-water-width">Width Cells</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-water-width"
                      onValueChange={(nextValue) => {
                        onUpdateWaterRegion(selectedWaterRegion.waterRegionId, (draft) => ({
                          ...draft,
                          footprint: {
                            ...draft.footprint,
                            sizeCellsX: Math.max(1, Math.round(nextValue))
                          }
                        }));
                      }}
                      value={selectedWaterRegion.footprint.sizeCellsX}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-water-depth-cells">Length Cells</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-water-depth-cells"
                      onValueChange={(nextValue) => {
                        onUpdateWaterRegion(selectedWaterRegion.waterRegionId, (draft) => ({
                          ...draft,
                          footprint: {
                            ...draft.footprint,
                            sizeCellsZ: Math.max(1, Math.round(nextValue))
                          }
                        }));
                      }}
                      value={selectedWaterRegion.footprint.sizeCellsZ}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-water-top">Top Elevation</Label>
                    <MapEditorEditableNumberInput
                      id="selection-water-top"
                      onValueChange={(nextValue) => {
                        onUpdateWaterRegion(selectedWaterRegion.waterRegionId, (draft) => ({
                          ...draft,
                          topElevationMeters: nextValue
                        }));
                      }}
                      value={selectedWaterRegion.topElevationMeters}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-water-depth">Depth</Label>
                    <MapEditorEditableNumberInput
                      id="selection-water-depth"
                      onValueChange={(nextValue) => {
                        onUpdateWaterRegion(selectedWaterRegion.waterRegionId, (draft) => ({
                          ...draft,
                          depthMeters: Math.max(0.5, nextValue)
                        }));
                      }}
                      value={selectedWaterRegion.depthMeters}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Runtime size {resolveMapEditorWaterRegionSize(selectedWaterRegion).x.toFixed(1)} x{" "}
                  {resolveMapEditorWaterRegionSize(selectedWaterRegion).z.toFixed(1)}
                </p>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedPathRampVisible ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:path-ramp", true)}
              sectionId="selection-pane:path-ramp"
              title="Path Ramp"
            >
              <SelectionCard title="Path Ramp">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-path-ramp-height">Height</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-path-ramp-height"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            riseLayers: Math.max(1, Math.round(Math.abs(nextValue)))
                          })
                        );
                      }}
                      value={selectedPathRampRiseMeters}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-path-ramp-actions">Shape</Label>
                    <ButtonGroup
                      aria-label="Path ramp shape"
                      className="flex flex-wrap"
                      id="selection-path-ramp-actions"
                    >
                      <ButtonGroupText>Ramp</ButtonGroupText>
                      <Button
                        onClick={() =>
                          onApplyPathRampToSelection(selectedPathRampRiseMeters)
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <ArrowUpIcon data-icon="inline-start" />
                        Apply
                      </Button>
                      <Button
                        onClick={() => onApplyPathRampToSelection(0)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        Flat
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedRegion !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:region", true)}
              sectionId="selection-pane:region"
              title="Region"
            >
              <SelectionCard title="Region">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-region-label">Label</Label>
                  <Input
                    id="selection-region-label"
                    onChange={(event) =>
                      onUpdateRegion(selectedRegion.regionId, (draft) => ({
                        ...draft,
                        label: event.target.value
                      }))
                    }
                    value={selectedRegion.label}
                  />
                </div>
                <Vector3Fields
                  labelPrefix="Center"
                  onChange={(axis, nextValue) =>
                    onUpdateRegion(selectedRegion.regionId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedRegion.center}
                />
                <Vector3Fields
                  labelPrefix="Size"
                  onChange={(axis, nextValue) =>
                    onUpdateRegion(selectedRegion.regionId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        [axis]: Math.max(0.5, nextValue)
                      }
                    }))
                  }
                  value={selectedRegion.size}
                />
              </SelectionCard>
            </Section>
          ) : null}

          {selectedEdge !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:edge", true)}
              sectionId="selection-pane:edge"
              title="Edge"
            >
              <SelectionCard title="Edge">
                <Vector3Fields
                  labelPrefix="Base"
                  onChange={(axis, nextValue) =>
                    onUpdateEdge(selectedEdge.edgeId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        [axis]:
                          axis === "y"
                            ? nextValue + draft.heightMeters * 0.5
                            : nextValue
                      }
                    }))
                  }
                  value={{
                    x: selectedEdge.center.x,
                    y: selectedEdge.center.y - selectedEdge.heightMeters * 0.5,
                    z: selectedEdge.center.z
                  }}
                />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      id: "lengthMeters" as const,
                      label: "Length",
                      value: selectedEdge.lengthMeters
                    },
                    {
                      id: "heightMeters" as const,
                      label: "Height",
                      value: selectedEdge.heightMeters
                    },
                    {
                      id: "thicknessMeters" as const,
                      label: "Thickness",
                      value: selectedEdge.thicknessMeters
                    }
                  ].map((field) => (
                    <div className="flex flex-col gap-2" key={field.id}>
                      <Label htmlFor={`selection-edge-${field.id}`}>{field.label}</Label>
                      <MapEditorEditableNumberInput
                        id={`selection-edge-${field.id}`}
                        onValueChange={(nextValue) => {
                          onUpdateEdge(selectedEdge.edgeId, (draft) => ({
                            ...draft,
                            [field.id]: Math.max(0.25, nextValue)
                          }));
                        }}
                        value={field.value}
                      />
                    </div>
                  ))}
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedConnector !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:connector", true)}
              sectionId="selection-pane:connector"
              title="Connector"
            >
              <SelectionCard title="Connector">
                <Vector3Fields
                  labelPrefix="Center"
                  onChange={(axis, nextValue) =>
                    onUpdateConnector(selectedConnector.connectorId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedConnector.center}
                />
                <Vector3Fields
                  labelPrefix="Size"
                  onChange={(axis, nextValue) =>
                    onUpdateConnector(selectedConnector.connectorId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        [axis]: Math.max(0.25, nextValue)
                      }
                    }))
                  }
                  value={selectedConnector.size}
                />
              </SelectionCard>
            </Section>
          ) : null}

          {selectedStructure !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:structure", true)}
              sectionId="selection-pane:structure"
              title="Procedural Structure"
            >
              <SelectionCard title="Procedural Structure">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-structure-label">Label</Label>
                  <Input
                    id="selection-structure-label"
                    onChange={(event) =>
                      onUpdateStructure(selectedStructure.structureId, (draft) => ({
                        ...draft,
                        label: event.target.value
                      }))
                    }
                    value={selectedStructure.label}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-structure-kind">Kind</Label>
                    <Input
                      id="selection-structure-kind"
                      readOnly
                      value={selectedStructure.structureKind}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-structure-material">Material</Label>
                    <Input
                      id="selection-structure-material"
                      onChange={(event) => {
                        const nextMaterialId = readSemanticMaterialId(
                          event.target.value
                        );

                        if (nextMaterialId !== null) {
                          onUpdateStructure(selectedStructure.structureId, (draft) => ({
                            ...draft,
                            materialId: nextMaterialId,
                            materialReferenceId: nextMaterialId
                          }));
                        }
                      }}
                      value={selectedStructure.materialId}
                    />
                  </div>
                </div>
                <Vector3Fields
                  labelPrefix="Center"
                  onChange={(axis, nextValue) =>
                    onUpdateStructure(selectedStructure.structureId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedStructure.center}
                />
                <Vector3Fields
                  labelPrefix="Size"
                  onChange={(axis, nextValue) =>
                    onUpdateStructure(selectedStructure.structureId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        [axis]: Math.max(0.08, nextValue)
                      }
                    }))
                  }
                  value={selectedStructure.size}
                />
              </SelectionCard>
            </Section>
          ) : null}

          {selectedGameplayVolume !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:gameplay-volume", true)}
              sectionId="selection-pane:gameplay-volume"
              title="Gameplay Volume"
            >
              <SelectionCard title="Gameplay Volume">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-volume-label">Label</Label>
                    <Input
                      id="selection-volume-label"
                      onChange={(event) =>
                        onUpdateGameplayVolume(
                          selectedGameplayVolume.volumeId,
                          (draft) => ({
                            ...draft,
                            label: event.target.value
                          })
                        )
                      }
                      value={selectedGameplayVolume.label}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-volume-kind">Kind</Label>
                    <Input
                      id="selection-volume-kind"
                      readOnly
                      value={selectedGameplayVolume.volumeKind}
                    />
                  </div>
                </div>
                <Vector3Fields
                  labelPrefix="Center"
                  onChange={(axis, nextValue) =>
                    onUpdateGameplayVolume(
                      selectedGameplayVolume.volumeId,
                      (draft) => ({
                        ...draft,
                        center: {
                          ...draft.center,
                          [axis]: nextValue
                        }
                      })
                    )
                  }
                  value={selectedGameplayVolume.center}
                />
                <Vector3Fields
                  labelPrefix="Size"
                  onChange={(axis, nextValue) =>
                    onUpdateGameplayVolume(
                      selectedGameplayVolume.volumeId,
                      (draft) => ({
                        ...draft,
                        size: {
                          ...draft.size,
                          [axis]: Math.max(0.25, nextValue)
                        }
                      })
                    )
                  }
                  value={selectedGameplayVolume.size}
                />
              </SelectionCard>
            </Section>
          ) : null}

          {selectedLight !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:light", true)}
              sectionId="selection-pane:light"
              title="Light"
            >
              <SelectionCard title="Light">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-light-kind">Kind</Label>
                    <Select
                      onValueChange={(nextValue) => {
                        const nextLightKind = readLightKind(nextValue);

                        if (nextLightKind !== null) {
                          onUpdateLight(selectedLight.lightId, (draft) => ({
                            ...draft,
                            lightKind: nextLightKind
                          }));
                        }
                      }}
                      value={selectedLight.lightKind}
                    >
                      <SelectTrigger id="selection-light-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="point">Point</SelectItem>
                        <SelectItem value="spot">Spot</SelectItem>
                        <SelectItem value="ambient">Ambient</SelectItem>
                        <SelectItem value="sun">Sun</SelectItem>
                        <SelectItem value="area">Area</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-light-color">Color</Label>
                    <Input
                      className="h-10 cursor-pointer p-1"
                      id="selection-light-color"
                      onChange={(event) => {
                        onUpdateLight(selectedLight.lightId, (draft) => ({
                          ...draft,
                          color: parseMapEditorColorHex(event.target.value, draft.color)
                        }));
                      }}
                      type="color"
                      value={formatMapEditorColorHex(selectedLight.color)}
                    />
                  </div>
                </div>
                <Vector3Fields
                  labelPrefix="Position"
                  onChange={(axis, nextValue) =>
                    onUpdateLight(selectedLight.lightId, (draft) => ({
                      ...draft,
                      position: {
                        ...draft.position,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedLight.position}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-light-intensity">Intensity</Label>
                    <MapEditorEditableNumberInput
                      id="selection-light-intensity"
                      onValueChange={(nextValue) => {
                        onUpdateLight(selectedLight.lightId, (draft) => ({
                          ...draft,
                          intensity: Math.max(0, nextValue)
                        }));
                      }}
                      value={selectedLight.intensity}
                    />
                  </div>
                  {selectedLight.lightKind === "ambient" ||
                  selectedLight.lightKind === "sun" ? null : (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="selection-light-range">Range</Label>
                      <MapEditorEditableNumberInput
                        id="selection-light-range"
                        onValueChange={(nextValue) => {
                          onUpdateLight(selectedLight.lightId, (draft) => ({
                            ...draft,
                            rangeMeters: Math.max(1, nextValue)
                          }));
                        }}
                        value={selectedLight.rangeMeters ?? 0}
                      />
                    </div>
                  )}
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedSurface !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:surface", true)}
              sectionId="selection-pane:surface"
              title="Surface"
            >
              <SelectionCard title="Surface">
                <Vector3Fields
                  labelPrefix="Center"
                  onChange={(axis, nextValue) =>
                    onUpdateSurface(selectedSurface.surfaceId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        [axis]: nextValue
                      },
                      elevation: axis === "y" ? nextValue : draft.elevation
                    }))
                  }
                  value={selectedSurface.center}
                />
                <Vector3Fields
                  labelPrefix="Size"
                  onChange={(axis, nextValue) =>
                    onUpdateSurface(selectedSurface.surfaceId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        [axis]: Math.max(0.25, nextValue)
                      }
                    }))
                  }
                  value={selectedSurface.size}
                />
              </SelectionCard>
            </Section>
          ) : null}

          {selectedTerrainPatch !== null ? (
            <Section
              onOpenChange={onSectionOpenChange}
              open={readSectionOpen("selection-pane:terrain-patch", true)}
              sectionId="selection-pane:terrain-patch"
              title="Terrain"
            >
              <SelectionCard title="Terrain">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="selection-terrain-label">Label</Label>
                  <Input
                    id="selection-terrain-label"
                    onChange={(event) =>
                      onUpdateTerrainPatch(selectedTerrainPatch.terrainPatchId, (draft) => ({
                        ...draft,
                        label: event.target.value
                      }))
                    }
                    value={selectedTerrainPatch.label}
                  />
                </div>
                <Vector3Fields
                  labelPrefix="Origin"
                  onChange={(axis, nextValue) =>
                    onUpdateTerrainPatch(selectedTerrainPatch.terrainPatchId, (draft) => ({
                      ...draft,
                      origin: {
                        ...draft.origin,
                        [axis]: nextValue
                      }
                    }))
                  }
                  value={selectedTerrainPatch.origin}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-samples-x">Samples X</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-terrain-samples-x"
                      onValueChange={(nextValue) => {
                        onUpdateTerrainPatch(selectedTerrainPatch.terrainPatchId, (draft) => ({
                          ...createResizedTerrainPatchDraft(
                            draft,
                            nextValue,
                            draft.sampleCountZ
                          )
                        }));
                      }}
                      value={selectedTerrainPatch.sampleCountX}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-samples-z">Samples Z</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-terrain-samples-z"
                      onValueChange={(nextValue) => {
                        onUpdateTerrainPatch(selectedTerrainPatch.terrainPatchId, (draft) => ({
                          ...createResizedTerrainPatchDraft(
                            draft,
                            draft.sampleCountX,
                            nextValue
                          )
                        }));
                      }}
                      value={selectedTerrainPatch.sampleCountZ}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-spacing">Spacing</Label>
                    <MapEditorEditableNumberInput
                      id="selection-terrain-spacing"
                      onValueChange={(nextValue) => {
                        onUpdateTerrainPatch(selectedTerrainPatch.terrainPatchId, (draft) => ({
                          ...draft,
                          sampleSpacingMeters: Math.max(0.5, nextValue)
                        }));
                      }}
                      value={selectedTerrainPatch.sampleSpacingMeters}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-seed">Seed</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-terrain-generate-seed"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainNoiseSeed: Math.round(nextValue)
                          })
                        );
                      }}
                      value={builderToolState.terrainNoiseSeed}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-octaves">Octaves</Label>
                    <MapEditorEditableNumberInput
                      decimals={0}
                      id="selection-terrain-generate-octaves"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationOctaves: Math.max(
                              1,
                              Math.round(nextValue)
                            )
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationOctaves}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-frequency">Frequency</Label>
                    <MapEditorEditableNumberInput
                      decimals={3}
                      id="selection-terrain-generate-frequency"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationFrequency: Math.max(0.001, nextValue)
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationFrequency}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-ground-elevation">
                      Ground Elevation
                    </Label>
                    <MapEditorEditableNumberInput
                      decimals={1}
                      id="selection-terrain-ground-elevation"
                      onValueChange={(nextValue) => {
                        onUpdateTerrainPatch(
                          selectedTerrainPatch.terrainPatchId,
                          (draft) => ({
                            ...draft,
                            origin: {
                              ...draft.origin,
                              y: nextValue
                            }
                          })
                        );
                      }}
                      value={selectedTerrainPatch.origin.y}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-min-elevation">
                      Min Elevation
                    </Label>
                    <MapEditorEditableNumberInput
                      decimals={1}
                      id="selection-terrain-generate-min-elevation"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationMinElevationMeters: Math.min(
                              nextValue,
                              currentBuilderToolState.terrainGenerationMaxElevationMeters
                            )
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationMinElevationMeters}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-max-elevation">
                      Max Elevation
                    </Label>
                    <MapEditorEditableNumberInput
                      decimals={1}
                      id="selection-terrain-generate-max-elevation"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationMaxElevationMeters: Math.max(
                              nextValue,
                              currentBuilderToolState.terrainGenerationMinElevationMeters
                            )
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationMaxElevationMeters}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-max-slope">
                      Max Slope
                    </Label>
                    <MapEditorEditableNumberInput
                      decimals={1}
                      id="selection-terrain-generate-max-slope"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationMaxSlopeDegrees: Math.max(
                              1,
                              Math.min(89, nextValue)
                            )
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationMaxSlopeDegrees}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-warp-frequency">Warp Freq</Label>
                    <MapEditorEditableNumberInput
                      decimals={3}
                      id="selection-terrain-generate-warp-frequency"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationWarpFrequency: Math.max(
                              0.001,
                              nextValue
                            )
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationWarpFrequency}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selection-terrain-generate-warp-strength">Warp</Label>
                    <MapEditorEditableNumberInput
                      decimals={1}
                      id="selection-terrain-generate-warp-strength"
                      onValueChange={(nextValue) => {
                        onBuilderToolStateChange((currentBuilderToolState) =>
                          Object.freeze({
                            ...currentBuilderToolState,
                            terrainGenerationWarpStrengthMeters: Math.max(
                              0,
                              nextValue
                            )
                          })
                        );
                      }}
                      value={builderToolState.terrainGenerationWarpStrengthMeters}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={() => {
                        const generatedTerrainPatch =
                          conformMapEditorTerrainPatchDraftToSupportSurfaces(
                            project,
                            bakeMapEditorProceduralTerrainPatch(selectedTerrainPatch, {
                              ...defaultMapEditorTerrainGenerationConfig,
                              frequency:
                                builderToolState.terrainGenerationFrequency,
                              groundElevationMeters: selectedTerrainPatch.origin.y,
                              maxElevationMeters:
                                builderToolState.terrainGenerationMaxElevationMeters,
                              maxSlopeDegrees:
                                builderToolState.terrainGenerationMaxSlopeDegrees,
                              minElevationMeters:
                                builderToolState.terrainGenerationMinElevationMeters,
                              octaves: builderToolState.terrainGenerationOctaves,
                              seed: builderToolState.terrainNoiseSeed,
                              warpFrequency:
                                builderToolState.terrainGenerationWarpFrequency,
                              warpStrengthMeters:
                                builderToolState.terrainGenerationWarpStrengthMeters
                            })
                          );

                        onUpdateTerrainPatch(
                          selectedTerrainPatch.terrainPatchId,
                          () => ({
                            ...generatedTerrainPatch,
                            waterLevelMeters: null
                          })
                        );
                      }}
                      type="button"
                      variant="outline"
                    >
                      Generate
                    </Button>
                    <Button
                      onClick={() => {
                        const naturalizedTerrainPatch =
                          conformMapEditorTerrainPatchDraftToSupportSurfaces(
                            project,
                            {
                              ...selectedTerrainPatch,
                              heightSamples:
                                createNaturalTerrainHeightSamples(selectedTerrainPatch)
                            }
                          );

                        onUpdateTerrainPatch(
                          selectedTerrainPatch.terrainPatchId,
                          () => ({
                            ...naturalizedTerrainPatch,
                            waterLevelMeters: null
                          })
                        );
                      }}
                      type="button"
                      variant="outline"
                    >
                      Naturalize
                    </Button>
                    <Button
                      onClick={() => {
                        const smoothedTerrainPatch =
                          conformMapEditorTerrainPatchDraftToSupportSurfaces(
                            project,
                            {
                              ...selectedTerrainPatch,
                              heightSamples: createSmoothedTerrainHeightSamples(
                                selectedTerrainPatch,
                                3
                              )
                            }
                          );

                        onUpdateTerrainPatch(
                          selectedTerrainPatch.terrainPatchId,
                          () => ({
                            ...smoothedTerrainPatch,
                            waterLevelMeters: null
                          })
                        );
                      }}
                      type="button"
                      variant="outline"
                    >
                      Smooth
                    </Button>
                    <Button
                      onClick={() =>
                        onUpdateTerrainPatch(
                          selectedTerrainPatch.terrainPatchId,
                          (draft) => ({
                            ...draft,
                            heightSamples: Object.freeze(
                              draft.heightSamples.map(() => 0)
                            )
                          })
                        )
                      }
                      type="button"
                      variant="outline"
                    >
                      Flatten
                    </Button>
                  </div>
                </div>
              </SelectionCard>
            </Section>
          ) : null}

          {selectedEntityRef === null ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
              Pick something in the scene rail or the viewport to edit it here.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
