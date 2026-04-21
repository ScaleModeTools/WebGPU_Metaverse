import { startTransition, useMemo, useState } from "react";

import { ArrowLeftIcon, Layers3Icon, PlayIcon } from "lucide-react";

import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import {
  listMapEditorBuildPrimitiveCatalogEntries,
  readMapEditorBuildPrimitiveCatalogEntry
} from "@/engine-tool/build/map-editor-build-primitives";
import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import {
  listMetaverseWorldBundleRegistryEntries,
  resolveDefaultMetaverseWorldBundleId,
  resolveMetaverseWorldBundleSourceBundleId
} from "@/metaverse/world/bundle-registry";
import { loadMetaverseMapBundle } from "@/metaverse/world/map-bundles";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createStableCountReserveTexts,
  StableInlineText
} from "@/components/text-stability";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/components/ui/resizable";
import { MapEditorInspectorPane } from "@/engine-tool/layout/map-editor-inspector-pane";
import { MapEditorLibraryPane } from "@/engine-tool/layout/map-editor-library-pane";
import { MapEditorMenubar } from "@/engine-tool/layout/map-editor-menubar";
import { MapEditorToolbar } from "@/engine-tool/layout/map-editor-toolbar";
import { MapEditorViewportPane } from "@/engine-tool/layout/map-editor-viewport-pane";
import {
  addMapEditorPlayerSpawnDraft,
  addMapEditorSceneObjectDraft,
  addMapEditorWaterRegionDraft,
  addMapEditorLaunchVariationDraft,
  addMapEditorPlacementAtPositionFromAsset,
  addMapEditorPlacementFromAsset,
  createMapEditorProject,
  readSelectedMapEditorLaunchVariation,
  readSelectedMapEditorPlacement,
  selectMapEditorLaunchVariation,
  selectMapEditorPlacement,
  updateMapEditorLaunchVariationDraft,
  updateMapEditorEnvironmentPresentationProfileId,
  updateMapEditorGameplayProfileId,
  updateMapEditorPlayerSpawnDraft,
  updateMapEditorPlayerSpawnSelectionDraft,
  updateMapEditorSceneObjectDraft,
  updateMapEditorPlacement,
  updateMapEditorWaterRegionDraft,
  type MapEditorProjectSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import {
  clearStoredMapEditorProject,
  loadStoredMapEditorProject,
  saveMapEditorProject,
  type MapEditorProjectStorageLike
} from "@/engine-tool/project/map-editor-project-storage";
import type { MapEditorLaunchVariationDraftSnapshot } from "@/engine-tool/project/map-editor-project-launch-variations";
import type {
  MapEditorPlayerSpawnSelectionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-player-spawn-selection";
import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import { validateAndRegisterMapEditorPreviewBundle } from "@/engine-tool/run/map-editor-run-preview";
import { defaultMapEditorViewportHelperVisibility } from "@/engine-tool/types/map-editor";
import type {
  MapEditorPlayerSpawnTransformUpdate,
  MapEditorViewportHelperId,
  MapEditorPlacementUpdate,
  MapEditorViewportToolMode
} from "@/engine-tool/types/map-editor";
import type { MetaverseWorldPreviewLaunchSelectionSnapshot } from "@/metaverse/world/map-bundles";

function readBrowserStorage(): MapEditorProjectStorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function createProjectForBundle(
  bundleId: string,
  storage: MapEditorProjectStorageLike | null
): MapEditorProjectSnapshot {
  return (
    loadStoredMapEditorProject(storage, bundleId) ??
    createMapEditorProject(loadMetaverseMapBundle(bundleId))
  );
}

function selectDefaultBundleId(
  initialBundleId: string | undefined
): string {
  return resolveMetaverseWorldBundleSourceBundleId(
    initialBundleId ?? resolveDefaultMetaverseWorldBundleId()
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
    (placement) => ({
      ...placement,
      ...update,
      position: update.position ?? placement.position
    })
  );
}

const placementCountReserveTexts = createStableCountReserveTexts(
  "placement",
  "placements"
);
const playerSpawnCountReserveTexts = createStableCountReserveTexts(
  "player spawn",
  "player spawns"
);
const waterRegionCountReserveTexts = createStableCountReserveTexts(
  "water region",
  "water regions"
);

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
  const registryEntries = useMemo(
    () => listMetaverseWorldBundleRegistryEntries(),
    []
  );
  const defaultBundleId = selectDefaultBundleId(initialBundleId);
  const bundleLabelReserveTexts = useMemo(
    () => registryEntries.map((entry) => entry.label),
    [registryEntries]
  );
  const defaultBuildPrimitiveAssetId =
    listMapEditorBuildPrimitiveCatalogEntries()[0]?.asset.id ?? null;
  const [browserStorage] = useState<MapEditorProjectStorageLike | null>(() =>
    readBrowserStorage()
  );
  const [selectedBundleId, setSelectedBundleId] = useState(defaultBundleId);
  const [project, setProject] = useState(() =>
    createProjectForBundle(defaultBundleId, browserStorage)
  );
  const [activeBuildPrimitiveAssetId, setActiveBuildPrimitiveAssetId] = useState<
    string | null
  >(defaultBuildPrimitiveAssetId);
  const [viewportHelperVisibility, setViewportHelperVisibility] = useState(
    defaultMapEditorViewportHelperVisibility
  );
  const [viewportToolMode, setViewportToolMode] =
    useState<MapEditorViewportToolMode>("move");
  const [runInProgress, setRunInProgress] = useState(false);
  const [runStatusMessage, setRunStatusMessage] = useState<string | null>(null);
  const selectedLaunchVariation = readSelectedMapEditorLaunchVariation(project);
  const selectedPlacement = readSelectedMapEditorPlacement(project);
  const activeBuildPrimitive =
    activeBuildPrimitiveAssetId === null
      ? null
      : readMapEditorBuildPrimitiveCatalogEntry(activeBuildPrimitiveAssetId);

  const handleBundleChange = (nextBundleId: string) => {
    startTransition(() => {
      setSelectedBundleId(nextBundleId);
      setProject(createProjectForBundle(nextBundleId, browserStorage));
      setRunStatusMessage(null);
    });
  };

  const handleResetDraftRequest = () => {
    startTransition(() => {
      clearStoredMapEditorProject(browserStorage, selectedBundleId);
      setProject(createMapEditorProject(loadMetaverseMapBundle(selectedBundleId)));
      setRunStatusMessage(null);
    });
  };

  const handleSaveDraftRequest = () => {
    saveMapEditorProject(browserStorage, project);
    setRunStatusMessage(
      `Saved ${project.bundleLabel} with ${
        project.launchVariationDrafts.length
      } launch variation${project.launchVariationDrafts.length === 1 ? "" : "s"}.`
    );
  };

  const handleSelectPlacementId = (placementId: string) => {
    setProject((currentProject) =>
      selectMapEditorPlacement(currentProject, placementId)
    );
  };

  const handleUpdateSelectedPlacement = (update: MapEditorPlacementUpdate) => {
    setProject((currentProject) =>
      applySelectedPlacementUpdate(currentProject, update)
    );
  };

  const handleUpdateEnvironmentPresentationProfileId = (
    environmentPresentationProfileId: string | null
  ) => {
    setProject((currentProject) =>
      updateMapEditorEnvironmentPresentationProfileId(
        currentProject,
        environmentPresentationProfileId
      )
    );
  };

  const handleUpdateGameplayProfileId = (gameplayProfileId: string) => {
    setProject((currentProject) =>
      updateMapEditorGameplayProfileId(currentProject, gameplayProfileId)
    );
  };

  const handleAddLaunchVariation = () => {
    setProject((currentProject) => addMapEditorLaunchVariationDraft(currentProject));
  };

  const handleAddPlayerSpawn = () => {
    setProject((currentProject) => addMapEditorPlayerSpawnDraft(currentProject));
  };

  const handleAddSceneObject = () => {
    setProject((currentProject) => addMapEditorSceneObjectDraft(currentProject));
  };

  const handleAddWaterRegion = () => {
    setProject((currentProject) => addMapEditorWaterRegionDraft(currentProject));
  };

  const handleSelectLaunchVariation = (variationId: string) => {
    setProject((currentProject) =>
      selectMapEditorLaunchVariation(currentProject, variationId)
    );
  };

  const handleUpdateLaunchVariation = (
    variationId: string,
    update: (
      draft: MapEditorLaunchVariationDraftSnapshot
    ) => MapEditorLaunchVariationDraftSnapshot
  ) => {
    setProject((currentProject) =>
      updateMapEditorLaunchVariationDraft(currentProject, variationId, update)
    );
  };

  const handleCommitViewportPlacementTransform = (
    placementId: string,
    update: MapEditorPlacementUpdate
  ) => {
    setProject((currentProject) =>
      applyPlacementUpdate(currentProject, placementId, update)
    );
  };

  const handleCommitViewportPlayerSpawnTransform = (
    spawnId: string,
    update: MapEditorPlayerSpawnTransformUpdate
  ) => {
    setProject((currentProject) =>
      updateMapEditorPlayerSpawnDraft(currentProject, spawnId, (spawnDraft) => ({
        ...spawnDraft,
        position: update.position,
        yawRadians: update.yawRadians
      }))
    );
  };

  const handleResetSelectedTransformRequest = () => {
    setProject((currentProject) =>
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

  const handleActivateBuildPrimitiveAssetId = (assetId: string) => {
    setActiveBuildPrimitiveAssetId(assetId);
    setViewportToolMode("build");
  };

  const handleAddPlacementFromAsset = (
    asset: EnvironmentAssetDescriptor
  ) => {
    setProject((currentProject) =>
      addMapEditorPlacementFromAsset(currentProject, asset)
    );
  };

  const handleBuildPlacementAtPosition = (
    assetId: string,
    position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => {
    const buildPrimitiveAsset =
      readMapEditorBuildPrimitiveCatalogEntry(assetId)?.asset ?? null;

    if (buildPrimitiveAsset === null) {
      return;
    }

    setProject((currentProject) =>
      addMapEditorPlacementAtPositionFromAsset(
        currentProject,
        buildPrimitiveAsset,
        position
      )
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

  const handleUpdatePlayerSpawn = (
    spawnId: string,
    update: (
      draft: MapEditorPlayerSpawnDraftSnapshot
    ) => MapEditorPlayerSpawnDraftSnapshot
  ) => {
    setProject((currentProject) =>
      updateMapEditorPlayerSpawnDraft(currentProject, spawnId, update)
    );
  };

  const handleUpdatePlayerSpawnSelection = (
    update: (
      draft: MapEditorPlayerSpawnSelectionDraftSnapshot
    ) => MapEditorPlayerSpawnSelectionDraftSnapshot
  ) => {
    setProject((currentProject) =>
      updateMapEditorPlayerSpawnSelectionDraft(currentProject, update)
    );
  };

  const handleUpdateSceneObject = (
    objectId: string,
    update: (
      draft: MapEditorSceneObjectDraftSnapshot
    ) => MapEditorSceneObjectDraftSnapshot
  ) => {
    setProject((currentProject) =>
      updateMapEditorSceneObjectDraft(currentProject, objectId, update)
    );
  };

  const handleUpdateWaterRegion = (
    waterRegionId: string,
    update: (
      draft: MapEditorWaterRegionDraftSnapshot
    ) => MapEditorWaterRegionDraftSnapshot
  ) => {
    setProject((currentProject) =>
      updateMapEditorWaterRegionDraft(currentProject, waterRegionId, update)
    );
  };

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
    saveMapEditorProject(browserStorage, project);
    onRunPreviewRequest(runPreviewResult.launchSelection);
  };

  return (
    <section className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgb(14_165_233/0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgb(251_146_60/0.12),transparent_24%),linear-gradient(180deg,rgb(2_6_23),rgb(15_23_42))] text-foreground">
      <header className="shrink-0 border-b border-border/70 bg-background/92 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/80">
              <Layers3Icon />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Engine Tool
              </p>
              <h1 className="truncate font-heading text-xl font-semibold tracking-tight">
                Map Editor Suite
              </h1>
            </div>
          </div>

          <Badge variant="secondary">
            <StableInlineText
              reserveTexts={bundleLabelReserveTexts}
              stabilizeNumbers={false}
              text={project.bundleLabel}
            />
          </Badge>
          <Badge variant="outline">
            <StableInlineText
              reserveTexts={placementCountReserveTexts}
              text={`${project.placementDrafts.length} placement${
                project.placementDrafts.length === 1 ? "" : "s"
              }`}
            />
          </Badge>
          <Badge variant="outline">
            <StableInlineText
              reserveTexts={playerSpawnCountReserveTexts}
              text={`${project.playerSpawnDrafts.length} player spawn${
                project.playerSpawnDrafts.length === 1 ? "" : "s"
              }`}
            />
          </Badge>
          <Badge variant="outline">
            <StableInlineText
              reserveTexts={waterRegionCountReserveTexts}
              text={`${project.waterRegionDrafts.length} water region${
                project.waterRegionDrafts.length === 1 ? "" : "s"
              }`}
            />
          </Badge>
          {selectedLaunchVariation !== null ? (
            <Badge variant="outline">
              <StableInlineText
                stabilizeNumbers={false}
                text={`Variation: ${selectedLaunchVariation.label}`}
              />
            </Badge>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <Button onClick={onCloseRequest} type="button" variant="outline">
              <ArrowLeftIcon data-icon="inline-start" />
              <StableInlineText stabilizeNumbers={false} text="Return To Shell" />
            </Button>
            <Button
              disabled={runInProgress}
              onClick={handleSaveDraftRequest}
              type="button"
              variant="outline"
            >
              <StableInlineText stabilizeNumbers={false} text="Save Draft" />
            </Button>
            <Button
              disabled={runInProgress}
              onClick={handleValidateAndRunRequest}
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

        {runStatusMessage !== null ? (
          <div className="border-t border-border/70 px-4 py-2 text-sm text-muted-foreground">
            {runStatusMessage}
          </div>
        ) : null}

        <div className="border-t border-border/70 px-4 py-2">
          <MapEditorMenubar
            canResetSelectedTransform={selectedPlacement !== null}
            onCloseRequest={onCloseRequest}
            onResetDraftRequest={handleResetDraftRequest}
            onResetSelectedTransformRequest={handleResetSelectedTransformRequest}
            onSaveDraftRequest={handleSaveDraftRequest}
            onValidateAndRunRequest={handleValidateAndRunRequest}
            onViewportHelperVisibilityChange={
              handleViewportHelperVisibilityChange
            }
            viewportHelperVisibility={viewportHelperVisibility}
            onViewportToolModeChange={setViewportToolMode}
            viewportToolMode={viewportToolMode}
          />
        </div>

        <MapEditorToolbar
          activeBuildPrimitiveLabel={activeBuildPrimitive?.asset.label ?? null}
          onBundleChange={handleBundleChange}
          onResetDraftRequest={handleResetDraftRequest}
          onSaveDraftRequest={handleSaveDraftRequest}
          onViewportToolModeChange={setViewportToolMode}
          registryEntries={registryEntries}
          selectedBundleId={selectedBundleId}
          viewportToolMode={viewportToolMode}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup className="h-full min-h-0" orientation="horizontal">
          <ResizablePanel defaultSize={72} minSize={52}>
            <MapEditorViewportPane
              activeBuildPrimitiveAssetId={activeBuildPrimitiveAssetId}
              bundleId={project.bundleId}
              onBuildPlacementAtPosition={handleBuildPlacementAtPosition}
              onCommitPlacementTransform={handleCommitViewportPlacementTransform}
              onCommitPlayerSpawnTransform={
                handleCommitViewportPlayerSpawnTransform
              }
              onSelectPlacementId={handleSelectPlacementId}
              placementDrafts={project.placementDrafts}
              playerSpawnDrafts={project.playerSpawnDrafts}
              sceneObjectDrafts={project.sceneObjectDrafts}
              selectedPlacementAssetId={selectedPlacement?.assetId ?? null}
              selectedPlacementId={project.selectedPlacementId}
              waterRegionDrafts={project.waterRegionDrafts}
              viewportHelperVisibility={viewportHelperVisibility}
              viewportToolMode={viewportToolMode}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={28} minSize={20}>
            <ResizablePanelGroup className="h-full min-h-0" orientation="vertical">
              <ResizablePanel defaultSize={56} minSize={28}>
                <MapEditorLibraryPane
                  activeBuildPrimitiveAssetId={activeBuildPrimitiveAssetId}
                  assetCatalogEntries={environmentPropManifest.environmentAssets}
                  onAddPlayerSpawn={handleAddPlayerSpawn}
                  onActivateBuildPrimitiveAssetId={
                    handleActivateBuildPrimitiveAssetId
                  }
                  onAddPlacementFromAsset={handleAddPlacementFromAsset}
                  onAddSceneObject={handleAddSceneObject}
                  onAddWaterRegion={handleAddWaterRegion}
                  onSelectPlacementId={handleSelectPlacementId}
                  project={project}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={54} minSize={24}>
                <MapEditorInspectorPane
                onAddLaunchVariation={handleAddLaunchVariation}
                onUpdateGameplayProfileId={handleUpdateGameplayProfileId}
                onSelectLaunchVariation={handleSelectLaunchVariation}
                onUpdateEnvironmentPresentationProfileId={
                  handleUpdateEnvironmentPresentationProfileId
                  }
                  onUpdateSelectedPlacement={handleUpdateSelectedPlacement}
                  onUpdateLaunchVariation={handleUpdateLaunchVariation}
                  onUpdatePlayerSpawnSelection={handleUpdatePlayerSpawnSelection}
                  onUpdatePlayerSpawn={handleUpdatePlayerSpawn}
                  onUpdateSceneObject={handleUpdateSceneObject}
                  onUpdateWaterRegion={handleUpdateWaterRegion}
                  project={project}
                  selectedLaunchVariation={selectedLaunchVariation}
                  selectedPlacement={selectedPlacement}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </section>
  );
}
