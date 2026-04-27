import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  MapIcon,
  RefreshCwIcon,
  ShieldIcon,
  StarIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  listMetaverseWorldBundleRegistryEntries,
  readMetaverseWorldBundleRegistryEntry,
  type MetaverseWorldBundleRegistryEntry
} from "@/metaverse/world/bundle-registry";
import {
  registerPublicMetaverseMapBundleRegistryEntries
} from "@/metaverse/world/map-bundles";
import {
  prioritizeTeamDeathmatchMap,
  readMetaverseMapLaunchPlaylistSnapshot,
  replaceMetaverseDefaultMap,
  resolveMetaverseMapLaunchSelection,
  saveMetaverseMapLaunchPlaylistSnapshot,
  toggleTeamDeathmatchMap,
  type MetaverseMapLaunchPlaylistSnapshot
} from "@/metaverse/world/playlists";

interface GamePlaylistsStageScreenProps {
  readonly onCloseRequest: () => void;
}

interface GamePlaylistMapRow {
  readonly chunkCount: number;
  readonly entry: MetaverseWorldBundleRegistryEntry;
  readonly gameplayVolumeCount: number;
  readonly modeLabels: readonly string[];
  readonly publicSource: boolean;
  readonly sceneObjectCount: number;
  readonly spawnCount: number;
  readonly supportsFreeRoam: boolean;
  readonly supportsTeamDeathmatch: boolean;
}

type GamePlaylistPanelId = "metaverse-default" | "team-deathmatch";

function readBrowserStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readAvailableRegistryEntries(
  publicRegistryEntries: readonly MetaverseWorldBundleRegistryEntry[]
): readonly MetaverseWorldBundleRegistryEntry[] {
  const entries = listMetaverseWorldBundleRegistryEntries().map(
    (entry) => readMetaverseWorldBundleRegistryEntry(entry.bundleId) ?? entry
  );

  for (const publicRegistryEntry of publicRegistryEntries) {
    if (!entries.some((entry) => entry.bundleId === publicRegistryEntry.bundleId)) {
      entries.push(
        readMetaverseWorldBundleRegistryEntry(publicRegistryEntry.bundleId) ??
          publicRegistryEntry
      );
    }
  }

  return Object.freeze(entries);
}

function createMapRow(
  entry: MetaverseWorldBundleRegistryEntry,
  publicBundleIds: ReadonlySet<string>
): GamePlaylistMapRow {
  const modeLabels = Object.freeze(
    entry.bundle.launchVariations
      .map((variation) => variation.matchMode)
      .filter((matchMode): matchMode is NonNullable<typeof matchMode> =>
        matchMode !== null
      )
      .filter((matchMode, index, matchModes) => matchModes.indexOf(matchMode) === index)
      .map((matchMode) =>
        matchMode === "team-deathmatch" ? "Team Deathmatch" : "Metaverse"
      )
  );

  return Object.freeze({
    chunkCount: entry.bundle.compiledWorld.chunks.length,
    entry,
    gameplayVolumeCount: entry.bundle.semanticWorld.gameplayVolumes.length,
    modeLabels,
    publicSource: publicBundleIds.has(entry.bundleId),
    sceneObjectCount: entry.bundle.sceneObjects.length,
    spawnCount: entry.bundle.playerSpawnNodes.length,
    supportsFreeRoam: entry.bundle.launchVariations.some(
      (variation) => variation.matchMode === "free-roam"
    ),
    supportsTeamDeathmatch: entry.bundle.launchVariations.some(
      (variation) => variation.matchMode === "team-deathmatch"
    )
  });
}

function formatModeLabel(modeId: GamePlaylistPanelId): string {
  return modeId === "team-deathmatch" ? "Team Deathmatch" : "Metaverse Default";
}

function VisibilityToggle({
  disabled = false,
  label,
  onToggle,
  visible
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onToggle: () => void;
  readonly visible: boolean;
}) {
  const Icon = visible ? EyeIcon : EyeOffIcon;

  return (
    <Button
      aria-label={`${visible ? "Remove" : "Add"} ${label}`}
      aria-pressed={visible}
      disabled={disabled}
      onClick={onToggle}
      size="icon"
      title={`${visible ? "Remove" : "Add"} ${label}`}
      type="button"
      variant={visible ? "ghost" : "outline"}
    >
      <Icon />
    </Button>
  );
}

export function GamePlaylistsStageScreen({
  onCloseRequest
}: GamePlaylistsStageScreenProps) {
  const [browserStorage] = useState<Storage | null>(() => readBrowserStorage());
  const [playlist, setPlaylist] = useState<MetaverseMapLaunchPlaylistSnapshot>(
    () => readMetaverseMapLaunchPlaylistSnapshot(browserStorage)
  );
  const [selectedPanelId, setSelectedPanelId] =
    useState<GamePlaylistPanelId>("team-deathmatch");
  const [publicRegistryEntries, setPublicRegistryEntries] = useState<
    readonly MetaverseWorldBundleRegistryEntry[]
  >(() => Object.freeze([]));
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const publicBundleIds = useMemo(
    () => new Set(publicRegistryEntries.map((entry) => entry.bundleId)),
    [publicRegistryEntries]
  );
  const registryEntries = useMemo(
    () => readAvailableRegistryEntries(publicRegistryEntries),
    [publicRegistryEntries]
  );
  const rows = useMemo(
    () =>
      Object.freeze(
        registryEntries
          .map((entry) => createMapRow(entry, publicBundleIds))
          .sort((leftRow, rightRow) => {
            if (leftRow.publicSource !== rightRow.publicSource) {
              return leftRow.publicSource ? -1 : 1;
            }

            return leftRow.entry.label.localeCompare(rightRow.entry.label);
          })
      ),
    [publicBundleIds, registryEntries]
  );
  const metaverseLaunchSelection = resolveMetaverseMapLaunchSelection(
    playlist,
    "free-roam"
  );
  const teamDeathmatchLaunchSelection = resolveMetaverseMapLaunchSelection(
    playlist,
    "team-deathmatch"
  );
  const selectedModeEnabledCount =
    selectedPanelId === "team-deathmatch"
      ? playlist.teamDeathmatchBundleIds.length
      : metaverseLaunchSelection.bundleId.length > 0
        ? 1
        : 0;

  useEffect(() => {
    let cancelled = false;

    setCatalogLoading(true);
    registerPublicMetaverseMapBundleRegistryEntries()
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setPublicRegistryEntries(entries);
        setCatalogError(null);
        setCatalogLoading(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCatalogError(
          error instanceof Error
            ? error.message
            : "Public metaverse map bundle catalog could not be loaded."
        );
        setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const applyPlaylistUpdate = (
    update: (
      currentPlaylist: MetaverseMapLaunchPlaylistSnapshot
    ) => MetaverseMapLaunchPlaylistSnapshot
  ) => {
    setPlaylist((currentPlaylist) => {
      const nextPlaylist = update(currentPlaylist);

      saveMetaverseMapLaunchPlaylistSnapshot(browserStorage, nextPlaylist);
      return nextPlaylist;
    });
  };

  const handleReloadCatalogRequest = () => {
    setCatalogLoading(true);
    registerPublicMetaverseMapBundleRegistryEntries()
      .then((entries) => {
        setPublicRegistryEntries(entries);
        setCatalogError(null);
        setCatalogLoading(false);
      })
      .catch((error) => {
        setCatalogError(
          error instanceof Error
            ? error.message
            : "Public metaverse map bundle catalog could not be loaded."
        );
        setCatalogLoading(false);
      });
  };

  return (
    <SidebarProvider
      className="min-h-dvh bg-background text-foreground"
      style={
        {
          "--sidebar-width": "19rem"
        } as CSSProperties
      }
    >
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="type-ui-title-tight truncate">Game Playlists</p>
              <p className="type-detail-muted mt-1 truncate">
                {catalogLoading ? "Loading maps" : `${rows.length} maps`}
              </p>
            </div>
            <Button
              aria-label="Close playlists"
              onClick={onCloseRequest}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowLeftIcon />
            </Button>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Launch Targets</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(["metaverse-default", "team-deathmatch"] as const).map(
                  (panelId) => {
                    const activeBundleId =
                      panelId === "team-deathmatch"
                        ? teamDeathmatchLaunchSelection.bundleId
                        : metaverseLaunchSelection.bundleId;
                    const Icon =
                      panelId === "team-deathmatch" ? ShieldIcon : StarIcon;

                    return (
                      <SidebarMenuItem key={panelId}>
                        <SidebarMenuButton
                          isActive={selectedPanelId === panelId}
                          onClick={() => setSelectedPanelId(panelId)}
                          type="button"
                        >
                          <Icon />
                          <span>{formatModeLabel(panelId)}</span>
                        </SidebarMenuButton>
                        <p className="type-detail-muted px-2 pb-2">
                          {activeBundleId}
                        </p>
                      </SidebarMenuItem>
                    );
                  }
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Selected</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-col gap-2 px-2">
                <Badge variant="secondary">{formatModeLabel(selectedPanelId)}</Badge>
                <p className="type-detail-muted">
                  {selectedModeEnabledCount} map
                  {selectedModeEnabledCount === 1 ? "" : "s"}
                </p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex min-h-14 items-center justify-between gap-3 border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold">
                Game Playlists
              </h1>
              <p className="type-detail-muted truncate">
                {catalogError ?? "Metaverse shell launch maps"}
              </p>
            </div>
          </div>
          <Button
            disabled={catalogLoading}
            onClick={handleReloadCatalogRequest}
            type="button"
            variant="outline"
          >
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
        </header>
        <main className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 text-card-foreground">
              <div className="flex items-center gap-2">
                <StarIcon data-icon="inline-start" />
                <p className="font-heading text-base font-semibold">
                  Metaverse Default
                </p>
              </div>
              <p className="type-body-muted mt-2 truncate">
                {metaverseLaunchSelection.bundleId}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-card-foreground">
              <div className="flex items-center gap-2">
                <ShieldIcon data-icon="inline-start" />
                <p className="font-heading text-base font-semibold">
                  Team Deathmatch
                </p>
              </div>
              <p className="type-body-muted mt-2 truncate">
                {teamDeathmatchLaunchSelection.bundleId}
              </p>
            </div>
          </section>

          <section className="min-h-0 rounded-lg border bg-card text-card-foreground">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Map</TableHead>
                  <TableHead>Modes</TableHead>
                  <TableHead>Spawns</TableHead>
                  <TableHead>Objects</TableHead>
                  <TableHead>Volumes</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead className="text-right">Metaverse</TableHead>
                  <TableHead className="text-right">TDM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isMetaverseDefault =
                    metaverseLaunchSelection.bundleId === row.entry.bundleId;
                  const isTeamDeathmatchEnabled =
                    playlist.teamDeathmatchBundleIds.includes(row.entry.bundleId);
                  const isTeamDeathmatchLaunchMap =
                    teamDeathmatchLaunchSelection.bundleId === row.entry.bundleId;

                  return (
                    <TableRow
                      data-state={
                        isMetaverseDefault || isTeamDeathmatchLaunchMap
                          ? "selected"
                          : undefined
                      }
                      key={row.entry.bundleId}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <MapIcon className="text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {row.entry.label}
                            </p>
                            <p className="type-detail-muted truncate">
                              {row.entry.bundleId}
                            </p>
                          </div>
                          {row.publicSource ? (
                            <Badge variant="outline">Public</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.modeLabels.length === 0 ? (
                            <Badge variant="outline">None</Badge>
                          ) : (
                            row.modeLabels.map((modeLabel) => (
                              <Badge key={modeLabel} variant="secondary">
                                {modeLabel}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{row.spawnCount}</TableCell>
                      <TableCell>{row.sceneObjectCount}</TableCell>
                      <TableCell>{row.gameplayVolumeCount}</TableCell>
                      <TableCell>{row.chunkCount}</TableCell>
                      <TableCell className="text-right">
                        <VisibilityToggle
                          disabled={!row.supportsFreeRoam}
                          label={`${row.entry.label} as metaverse default`}
                          onToggle={() => {
                            applyPlaylistUpdate((currentPlaylist) =>
                              replaceMetaverseDefaultMap(
                                currentPlaylist,
                                row.entry.bundleId
                              )
                            );
                            setSelectedPanelId("metaverse-default");
                          }}
                          visible={isMetaverseDefault}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isTeamDeathmatchEnabled &&
                          !isTeamDeathmatchLaunchMap ? (
                            <Button
                              disabled={!row.supportsTeamDeathmatch}
                              onClick={() => {
                                applyPlaylistUpdate((currentPlaylist) =>
                                  prioritizeTeamDeathmatchMap(
                                    currentPlaylist,
                                    row.entry.bundleId
                                  )
                                );
                                setSelectedPanelId("team-deathmatch");
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Use
                            </Button>
                          ) : null}
                          <VisibilityToggle
                            disabled={!row.supportsTeamDeathmatch}
                            label={`${row.entry.label} for Team Deathmatch`}
                            onToggle={() => {
                              applyPlaylistUpdate((currentPlaylist) =>
                                isTeamDeathmatchEnabled
                                  ? toggleTeamDeathmatchMap(
                                      currentPlaylist,
                                      row.entry.bundleId
                                    )
                                  : prioritizeTeamDeathmatchMap(
                                      currentPlaylist,
                                      row.entry.bundleId
                                    )
                              );
                              setSelectedPanelId("team-deathmatch");
                            }}
                            visible={isTeamDeathmatchEnabled}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
