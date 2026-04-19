import {
  MenubarCheckboxItem,
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
} from "@/components/ui/menubar";
import type {
  MapEditorViewportHelperId,
  MapEditorViewportHelperVisibilitySnapshot,
  MapEditorViewportToolMode
} from "@/engine-tool/types/map-editor";

interface MapEditorMenubarProps {
  readonly canResetSelectedTransform: boolean;
  readonly onCloseRequest: () => void;
  readonly onResetDraftRequest: () => void;
  readonly onResetSelectedTransformRequest: () => void;
  readonly onSaveDraftRequest: () => void;
  readonly onValidateAndRunRequest: () => void;
  readonly onViewportHelperVisibilityChange: (
    helperId: MapEditorViewportHelperId,
    visible: boolean
  ) => void;
  readonly viewportToolMode: MapEditorViewportToolMode;
  readonly viewportHelperVisibility: MapEditorViewportHelperVisibilitySnapshot;
  readonly onViewportToolModeChange: (
    viewportToolMode: MapEditorViewportToolMode
  ) => void;
}

function readViewportToolMode(
  nextValue: string
): MapEditorViewportToolMode | null {
  if (
    nextValue === "build" ||
    nextValue === "move" ||
    nextValue === "rotate" ||
    nextValue === "scale"
  ) {
    return nextValue;
  }

  return null;
}

export function MapEditorMenubar({
  canResetSelectedTransform,
  onCloseRequest,
  onResetDraftRequest,
  onResetSelectedTransformRequest,
  onSaveDraftRequest,
  onValidateAndRunRequest,
  onViewportHelperVisibilityChange,
  viewportHelperVisibility,
  viewportToolMode,
  onViewportToolModeChange
}: MapEditorMenubarProps) {
  return (
    <Menubar className="h-auto min-h-8 border-border/70 bg-muted/35">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onSaveDraftRequest}>
            Save Draft
            <MenubarShortcut>Ctrl+S</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onResetDraftRequest}>
            Reset Draft
            <MenubarShortcut>Shift+R</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onCloseRequest}>
            Return To Shell
            <MenubarShortcut>Esc</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Selection</MenubarLabel>
          <MenubarItem
            disabled={!canResetSelectedTransform}
            onClick={onResetSelectedTransformRequest}
          >
            Reset Selected Transform
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Helpers</MenubarLabel>
          <MenubarCheckboxItem
            checked={viewportHelperVisibility.grid}
            onCheckedChange={(checked) => {
              onViewportHelperVisibilityChange("grid", checked === true);
            }}
          >
            Grid
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={viewportHelperVisibility.axes}
            onCheckedChange={(checked) => {
              onViewportHelperVisibilityChange("axes", checked === true);
            }}
          >
            Axes
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={viewportHelperVisibility.polarGrid}
            onCheckedChange={(checked) => {
              onViewportHelperVisibilityChange("polarGrid", checked === true);
            }}
          >
            Polar Grid
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={viewportHelperVisibility.selectionBounds}
            onCheckedChange={(checked) => {
              onViewportHelperVisibilityChange(
                "selectionBounds",
                checked === true
              );
            }}
          >
            Selection Bounds
          </MenubarCheckboxItem>

          <MenubarSeparator />
          <MenubarLabel>Viewport Tool</MenubarLabel>
          <MenubarRadioGroup
            onValueChange={(nextValue) => {
              const nextViewportToolMode = readViewportToolMode(nextValue);

              if (nextViewportToolMode !== null) {
                onViewportToolModeChange(nextViewportToolMode);
              }
            }}
            value={viewportToolMode}
          >
            <MenubarRadioItem value="build">Build</MenubarRadioItem>
            <MenubarRadioItem value="move">Move</MenubarRadioItem>
            <MenubarRadioItem value="rotate">Rotate</MenubarRadioItem>
            <MenubarRadioItem value="scale">Scale</MenubarRadioItem>
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Run</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onValidateAndRunRequest}>
            Validate + Run
            <MenubarShortcut>Shift+Enter</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
