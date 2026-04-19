import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Plane,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGPURenderer
} from "three/webgpu";

import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import type {
  EnvironmentAssetDescriptor,
  EnvironmentRenderLodDescriptor
} from "@/assets/types/environment-asset-manifest";
import { resolveMapEditorBuildGroundPlacementPosition } from "@/engine-tool/build/map-editor-build-placement";
import { readMapEditorBuildPrimitiveCatalogEntry } from "@/engine-tool/build/map-editor-build-primitives";
import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import type { MapEditorPlacementDraftSnapshot } from "@/engine-tool/project/map-editor-project-state";
import type {
  MapEditorPlacementUpdate,
  MapEditorViewportHelperVisibilitySnapshot,
  MapEditorViewportToolMode
} from "@/engine-tool/types/map-editor";

import type { MapEditorViewportHelperHandles } from "./map-editor-viewport-helpers";
import {
  createMapEditorViewportHelperHandles,
  disposeMapEditorViewportHelperHandles,
  replaceMapEditorViewportSelectionBoundsHelper,
  syncMapEditorViewportHelperVisibility
} from "./map-editor-viewport-helpers";
import { MapEditorViewportKeyboardFlightController } from "./map-editor-viewport-keyboard-flight";
import {
  createMapEditorViewportOrbitControls,
  frameMapEditorViewportCamera
} from "./map-editor-viewport-orbit-controls";
import {
  applyMapEditorViewportPreviewOpacity,
  disposeMapEditorViewportPreviewGroup,
  MapEditorViewportPreviewAssetLibrary,
  syncMapEditorViewportPlacementPreviewAnchor
} from "./map-editor-viewport-preview-assets";
import type { MapEditorViewportSceneDraftHandles } from "./map-editor-viewport-scene-drafts";
import {
  createMapEditorViewportSceneDraftHandles,
  disposeMapEditorViewportSceneDraftHandles,
  syncMapEditorViewportSceneDrafts
} from "./map-editor-viewport-scene-drafts";
import { MapEditorViewportTransformController } from "./map-editor-viewport-transform-controls";

interface MapEditorViewportProps {
  readonly activeBuildPrimitiveAssetId: string | null;
  readonly bundleId: string;
  readonly helperVisibility: MapEditorViewportHelperVisibilitySnapshot;
  readonly onBuildPlacementAtPosition: (
    assetId: string,
    position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCommitPlacementTransform: (
    placementId: string,
    update: MapEditorPlacementUpdate
  ) => void;
  readonly onSelectPlacementId: (placementId: string) => void;
  readonly placementDrafts: readonly MapEditorPlacementDraftSnapshot[];
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
  readonly selectedPlacementId: string | null;
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  readonly viewportToolMode: MapEditorViewportToolMode;
}

interface PlacementExtents {
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
}

function createEmptyPlacementExtents(): PlacementExtents {
  return Object.freeze({
    maxX: 0,
    maxZ: 0,
    minX: 0,
    minZ: 0
  });
}

interface PlacementFootprintHalfExtents {
  readonly x: number;
  readonly z: number;
}

function resolveDefaultEnvironmentRenderLod(
  asset: EnvironmentAssetDescriptor
): EnvironmentRenderLodDescriptor | null {
  return (
    asset.renderModel.lods.find(
      (lodDescriptor) => lodDescriptor.tier === asset.renderModel.defaultTier
    ) ??
    asset.renderModel.lods[0] ??
    null
  );
}

function resolveEnvironmentAssetFootprintHalfExtents(
  assetId: string
): PlacementFootprintHalfExtents | null {
  const asset =
    environmentPropManifest.environmentAssets.find(
      (environmentAsset) => environmentAsset.id === assetId
    ) ?? null;

  if (asset === null) {
    return null;
  }

  const defaultRenderLod = resolveDefaultEnvironmentRenderLod(asset);

  if (
    defaultRenderLod !== null &&
    "kind" in defaultRenderLod &&
    defaultRenderLod.kind === "procedural-box"
  ) {
    return Object.freeze({
      x: defaultRenderLod.size.x * 0.5,
      z: defaultRenderLod.size.z * 0.5
    });
  }

  let maxHalfExtentX = 0;
  let maxHalfExtentZ = 0;
  const colliderDescriptors = [
    ...(asset.collider === null ? [] : [asset.collider]),
    ...(asset.physicsColliders ?? [])
  ];

  for (const colliderDescriptor of colliderDescriptors) {
    maxHalfExtentX = Math.max(
      maxHalfExtentX,
      Math.abs(colliderDescriptor.center.x) + colliderDescriptor.size.x * 0.5
    );
    maxHalfExtentZ = Math.max(
      maxHalfExtentZ,
      Math.abs(colliderDescriptor.center.z) + colliderDescriptor.size.z * 0.5
    );
  }

  if (maxHalfExtentX > 0 || maxHalfExtentZ > 0) {
    return Object.freeze({
      x: maxHalfExtentX,
      z: maxHalfExtentZ
    });
  }

  return null;
}

function resolvePlacementFootprintHalfExtents(
  placement: MapEditorPlacementDraftSnapshot
): PlacementFootprintHalfExtents {
  const buildPrimitiveCatalogEntry = readMapEditorBuildPrimitiveCatalogEntry(
    placement.assetId
  );
  const baseHalfExtents =
    buildPrimitiveCatalogEntry === null
      ? (resolveEnvironmentAssetFootprintHalfExtents(placement.assetId) ??
        Object.freeze({
          x: 1,
          z: 1
        }))
      : Object.freeze({
          x: buildPrimitiveCatalogEntry.footprint.x * 0.5,
          z: buildPrimitiveCatalogEntry.footprint.z * 0.5
        });
  const scaledHalfExtentX = Math.max(0.5, baseHalfExtents.x * placement.scale.x);
  const scaledHalfExtentZ = Math.max(0.5, baseHalfExtents.z * placement.scale.z);
  const sinRotation = Math.abs(Math.sin(placement.rotationYRadians));
  const cosRotation = Math.abs(Math.cos(placement.rotationYRadians));

  return Object.freeze({
    x: scaledHalfExtentX * cosRotation + scaledHalfExtentZ * sinRotation,
    z: scaledHalfExtentX * sinRotation + scaledHalfExtentZ * cosRotation
  });
}

function resolvePlacementExtents(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[],
  sceneDrafts: {
    readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
    readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
    readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  }
): PlacementExtents {
  if (
    placementDrafts.length === 0 &&
    sceneDrafts.playerSpawnDrafts.length === 0 &&
    sceneDrafts.sceneObjectDrafts.length === 0 &&
    sceneDrafts.waterRegionDrafts.length === 0
  ) {
    return createEmptyPlacementExtents();
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const placement of placementDrafts) {
    const placementHalfExtents = resolvePlacementFootprintHalfExtents(placement);

    minX = Math.min(minX, placement.position.x - placementHalfExtents.x);
    maxX = Math.max(maxX, placement.position.x + placementHalfExtents.x);
    minZ = Math.min(minZ, placement.position.z - placementHalfExtents.z);
    maxZ = Math.max(maxZ, placement.position.z + placementHalfExtents.z);
  }

  for (const spawnDraft of sceneDrafts.playerSpawnDrafts) {
    minX = Math.min(minX, spawnDraft.position.x);
    maxX = Math.max(maxX, spawnDraft.position.x);
    minZ = Math.min(minZ, spawnDraft.position.z);
    maxZ = Math.max(maxZ, spawnDraft.position.z);
  }

  for (const sceneObjectDraft of sceneDrafts.sceneObjectDrafts) {
    const highlightRadius = sceneObjectDraft.launchTarget?.highlightRadius ?? 2;

    minX = Math.min(minX, sceneObjectDraft.position.x - highlightRadius);
    maxX = Math.max(maxX, sceneObjectDraft.position.x + highlightRadius);
    minZ = Math.min(minZ, sceneObjectDraft.position.z - highlightRadius);
    maxZ = Math.max(maxZ, sceneObjectDraft.position.z + highlightRadius);
  }

  for (const waterRegionDraft of sceneDrafts.waterRegionDrafts) {
    minX = Math.min(minX, waterRegionDraft.center.x - waterRegionDraft.size.x * 0.5);
    maxX = Math.max(maxX, waterRegionDraft.center.x + waterRegionDraft.size.x * 0.5);
    minZ = Math.min(minZ, waterRegionDraft.center.z - waterRegionDraft.size.z * 0.5);
    maxZ = Math.max(maxZ, waterRegionDraft.center.z + waterRegionDraft.size.z * 0.5);
  }

  return Object.freeze({
    maxX,
    maxZ,
    minX,
    minZ
  });
}

function createPlacementPreviewSignature(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[]
): string {
  return placementDrafts
    .map((placement) =>
      [
        placement.assetId,
        placement.collisionEnabled ? "1" : "0",
        placement.isVisible ? "1" : "0",
        placement.placementId,
        placement.position.x,
        placement.position.y,
        placement.position.z,
        placement.rotationYRadians,
        placement.scale.x,
        placement.scale.y,
        placement.scale.z
      ].join(":")
    )
    .join("|");
}

function createPlacementStructureSignature(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[]
): string {
  return placementDrafts
    .map((placement) => `${placement.placementId}:${placement.assetId}`)
    .join("|");
}

function createSceneDraftSignature(
  sceneDrafts: {
    readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
    readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
    readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  }
): string {
  return [
    ...sceneDrafts.playerSpawnDrafts.map((spawnDraft) =>
      [
        "spawn",
        spawnDraft.spawnId,
        spawnDraft.position.x,
        spawnDraft.position.y,
        spawnDraft.position.z,
        spawnDraft.yawRadians
      ].join(":")
    ),
    ...sceneDrafts.sceneObjectDrafts.map((sceneObjectDraft) =>
      [
        "scene-object",
        sceneObjectDraft.objectId,
        sceneObjectDraft.position.x,
        sceneObjectDraft.position.y,
        sceneObjectDraft.position.z,
        sceneObjectDraft.launchTarget?.experienceId ?? "none",
        sceneObjectDraft.launchTarget?.ringColorHex ?? "none",
        sceneObjectDraft.launchTarget?.beamColorHex ?? "none"
      ].join(":")
    ),
    ...sceneDrafts.waterRegionDrafts.map((waterRegionDraft) =>
      [
        "water",
        waterRegionDraft.waterRegionId,
        waterRegionDraft.center.x,
        waterRegionDraft.center.y,
        waterRegionDraft.center.z,
        waterRegionDraft.size.x,
        waterRegionDraft.size.y,
        waterRegionDraft.size.z,
        waterRegionDraft.rotationYRadians,
        waterRegionDraft.previewColorHex,
        waterRegionDraft.previewOpacity
      ].join(":")
    )
  ].join("|");
}

function readPlacementIdFromObject(
  object: {
    parent: unknown;
    userData?: {
      placementId?: unknown;
    };
  } | null
): string | null {
  let currentObject = object;

  while (currentObject !== null) {
    const candidatePlacementId = currentObject.userData?.placementId;

    if (typeof candidatePlacementId === "string") {
      return candidatePlacementId;
    }

    currentObject =
      currentObject.parent !== null &&
      typeof currentObject.parent === "object" &&
      "parent" in currentObject.parent
        ? (currentObject.parent as typeof object)
        : null;
  }

  return null;
}

function resolveViewportErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The map editor viewport could not initialize.";
}

function readCanvasPointer(
  canvasElement: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  pointer: Vector2
): Vector2 {
  const rect = canvasElement.getBoundingClientRect();

  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  return pointer;
}

export function MapEditorViewport({
  activeBuildPrimitiveAssetId,
  bundleId,
  helperVisibility,
  onBuildPlacementAtPosition,
  onCommitPlacementTransform,
  onSelectPlacementId,
  placementDrafts,
  playerSpawnDrafts,
  sceneObjectDrafts,
  selectedPlacementId,
  waterRegionDrafts,
  viewportToolMode
}: MapEditorViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const keyboardFlightControllerRef =
    useRef<MapEditorViewportKeyboardFlightController | null>(null);
  const placementGroupRef = useRef<Group | null>(null);
  const previewAssetLibraryRef =
    useRef<MapEditorViewportPreviewAssetLibrary | null>(null);
  const sceneDraftHandlesRef = useRef<MapEditorViewportSceneDraftHandles | null>(null);
  const placementAnchorByIdRef = useRef(new Map<string, Group>());
  const buildCursorAnchorRef = useRef<Group | null>(null);
  const buildCursorAssetIdRef = useRef<string | null>(null);
  const activeBuildPrimitiveAssetIdRef = useRef(activeBuildPrimitiveAssetId);
  const placementDraftsRef = useRef(placementDrafts);
  const viewportToolModeRef = useRef(viewportToolMode);
  const transformControllerRef =
    useRef<MapEditorViewportTransformController | null>(null);
  const helperHandlesRef = useRef<MapEditorViewportHelperHandles | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());
  const buildPlacementPlaneRef = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const buildPlacementPointRef = useRef(new Vector3());
  const buildCursorPositionRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const previewBuildVersionRef = useRef(0);
  const pointerDownPositionRef = useRef<{
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const framedBundleIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [viewportError, setViewportError] = useState<string | null>(null);
  const previewPlacementSignature = useMemo(
    () => createPlacementPreviewSignature(placementDrafts),
    [placementDrafts]
  );
  const previewStructureSignature = useMemo(
    () => createPlacementStructureSignature(placementDrafts),
    [placementDrafts]
  );
  const sceneDraftSignature = useMemo(
    () =>
      createSceneDraftSignature({
        playerSpawnDrafts,
        sceneObjectDrafts,
        waterRegionDrafts
      }),
    [playerSpawnDrafts, sceneObjectDrafts, waterRegionDrafts]
  );

  const handlePlacementSelection = useEffectEvent((placementId: string) => {
    onSelectPlacementId(placementId);
  });
  const handlePlacementTransformCommit = useEffectEvent(
    (placementId: string, update: MapEditorPlacementUpdate) => {
      onCommitPlacementTransform(placementId, update);
    }
  );
  const handleBuildPlacement = useEffectEvent(
    (
      assetId: string,
      position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      }
    ) => {
      onBuildPlacementAtPosition(assetId, position);
    }
  );
  const syncPlacementPreviewAnchors = useEffectEvent(
    (drafts: readonly MapEditorPlacementDraftSnapshot[]) => {
      for (const placement of drafts) {
        const placementAnchor =
          placementAnchorByIdRef.current.get(placement.placementId) ?? null;

        if (placementAnchor === null) {
          continue;
        }

        syncMapEditorViewportPlacementPreviewAnchor(placementAnchor, placement);
      }
    }
  );
  const syncSelectionPresentation = useEffectEvent(() => {
    const scene = sceneRef.current;
    const helperHandles = helperHandlesRef.current;
    const transformController = transformControllerRef.current;

    if (scene === null || helperHandles === null || transformController === null) {
      return;
    }

    transformController.syncToolMode(viewportToolMode);

    const selectedPlacementAnchor =
      viewportToolMode === "build" || selectedPlacementId === null
        ? null
        : placementAnchorByIdRef.current.get(selectedPlacementId) ?? null;

    transformController.syncAttachedGroup(selectedPlacementAnchor);
    replaceMapEditorViewportSelectionBoundsHelper(
      scene,
      helperHandles,
      selectedPlacementAnchor,
      helperVisibility
    );
  });

  useEffect(() => {
    placementDraftsRef.current = placementDrafts;
  }, [placementDrafts]);

  useEffect(() => {
    activeBuildPrimitiveAssetIdRef.current = activeBuildPrimitiveAssetId;
  }, [activeBuildPrimitiveAssetId]);

  useEffect(() => {
    viewportToolModeRef.current = viewportToolMode;
  }, [viewportToolMode]);

  useEffect(() => {
    const hostElement = hostRef.current;
    const canvasElement = canvasRef.current;

    if (hostElement === null || canvasElement === null) {
      return;
    }

    let disposed = false;

    const scene = new Scene();
    scene.background = new Color("#09111f");
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(48, 1, 0.1, 500);
    cameraRef.current = camera;

    const renderer = new WebGPURenderer({
      alpha: true,
      antialias: true,
      canvas: canvasElement
    });
    rendererRef.current = renderer;
    setViewportError(null);
    const orbitControls = createMapEditorViewportOrbitControls(
      camera,
      canvasElement
    );
    orbitControlsRef.current = orbitControls;
    const keyboardFlightController =
      new MapEditorViewportKeyboardFlightController({
        camera,
        hostElement,
        orbitControls
      });
    keyboardFlightControllerRef.current = keyboardFlightController;

    const placementGroup = new Group();
    placementGroupRef.current = placementGroup;
    scene.add(placementGroup);
    const sceneDraftHandles = createMapEditorViewportSceneDraftHandles();
    sceneDraftHandlesRef.current = sceneDraftHandles;
    scene.add(sceneDraftHandles.rootGroup);
    const previewAssetLibrary = new MapEditorViewportPreviewAssetLibrary();
    previewAssetLibraryRef.current = previewAssetLibrary;
    const helperHandles = createMapEditorViewportHelperHandles(scene);
    helperHandlesRef.current = helperHandles;
    scene.add(new AmbientLight("#ffffff", 0.85));

    const keyLight = new DirectionalLight("#ffffff", 2.2);
    keyLight.position.set(18, 32, 16);
    scene.add(keyLight);

    const fillLight = new DirectionalLight("#67e8f9", 0.9);
    fillLight.position.set(-14, 20, -12);
    scene.add(fillLight);

    const transformController = new MapEditorViewportTransformController({
      camera,
      canvasElement,
      orbitControls,
      scene,
      onCommitPlacementTransform: handlePlacementTransformCommit
    });
    transformControllerRef.current = transformController;

    const syncSize = () => {
      const width = Math.max(1, hostElement.clientWidth);
      const height = Math.max(1, hostElement.clientHeight);

      renderer.setPixelRatio(globalThis.window?.devicePixelRatio ?? 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const renderFrame = (frameTimeMs: number) => {
      if (disposed) {
        return;
      }

      animationFrameRef.current = globalThis.window.requestAnimationFrame(
        renderFrame
      );

      try {
        const lastFrameTimeMs = lastFrameTimeRef.current ?? frameTimeMs;
        const deltaSeconds = Math.min(
          0.05,
          Math.max(0, (frameTimeMs - lastFrameTimeMs) / 1000)
        );

        lastFrameTimeRef.current = frameTimeMs;
        keyboardFlightController.update(deltaSeconds);
        orbitControls.update();
        helperHandles.selectionBoundsHelper?.update();
        renderer.render(scene, camera);
      } catch (error) {
        globalThis.window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;

        if (!disposed) {
          setViewportError(resolveViewportErrorMessage(error));
        }
      }
    };

    const readSelectedPlacementId = (
      clientX: number,
      clientY: number
    ): string | null => {
      const pointer = readCanvasPointer(
        canvasElement,
        clientX,
        clientY,
        pointerRef.current
      );

      raycasterRef.current.setFromCamera(pointer, camera);

      const intersections = raycasterRef.current.intersectObjects(
        placementGroup.children,
        true
      );

      return readPlacementIdFromObject(intersections[0]?.object ?? null);
    };
    const readBuildPlacementPosition = (
      clientX: number,
      clientY: number
    ): {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null => {
      const activeBuildPrimitive =
        activeBuildPrimitiveAssetIdRef.current === null
          ? null
          : readMapEditorBuildPrimitiveCatalogEntry(
              activeBuildPrimitiveAssetIdRef.current
            );

      if (activeBuildPrimitive === null) {
        return null;
      }

      const pointer = readCanvasPointer(
        canvasElement,
        clientX,
        clientY,
        pointerRef.current
      );

      raycasterRef.current.setFromCamera(pointer, camera);

      const placementPoint = raycasterRef.current.ray.intersectPlane(
        buildPlacementPlaneRef.current,
        buildPlacementPointRef.current
      );

      if (placementPoint === null) {
        return null;
      }

      return resolveMapEditorBuildGroundPlacementPosition(
        Object.freeze({
          x: placementPoint.x,
          y: placementPoint.y,
          z: placementPoint.z
        }),
        activeBuildPrimitive
      );
    };
    const syncBuildCursor = (clientX: number, clientY: number) => {
      const buildCursorAnchor = buildCursorAnchorRef.current;

      if (viewportToolModeRef.current !== "build") {
        buildCursorPositionRef.current = null;

        if (buildCursorAnchor !== null) {
          buildCursorAnchor.visible = false;
        }

        return;
      }

      const nextBuildCursorPosition = readBuildPlacementPosition(clientX, clientY);

      if (nextBuildCursorPosition === null) {
        buildCursorPositionRef.current = null;
        if (buildCursorAnchor !== null) {
          buildCursorAnchor.visible = false;
        }
        return;
      }

      buildCursorPositionRef.current = nextBuildCursorPosition;

      if (buildCursorAnchor === null) {
        return;
      }

      buildCursorAnchor.visible = true;
      buildCursorAnchor.position.set(
        nextBuildCursorPosition.x,
        nextBuildCursorPosition.y,
        nextBuildCursorPosition.z
      );
      buildCursorAnchor.updateMatrixWorld(true);
    };

    const handlePointerDown = (event: PointerEvent) => {
      hostElement.focus({ preventScroll: true });

      if (event.button !== 0) {
        return;
      }

      pointerDownPositionRef.current = Object.freeze({
        x: event.clientX,
        y: event.clientY
      });
      syncBuildCursor(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) {
        pointerDownPositionRef.current = null;
        return;
      }

      const pointerDownPosition = pointerDownPositionRef.current;
      pointerDownPositionRef.current = null;

      if (pointerDownPosition === null) {
        return;
      }

      const pointerTravelDistance = Math.hypot(
        event.clientX - pointerDownPosition.x,
        event.clientY - pointerDownPosition.y
      );

      if (pointerTravelDistance > 4) {
        return;
      }

      if (
        viewportToolModeRef.current === "build" &&
        activeBuildPrimitiveAssetIdRef.current !== null
      ) {
        const nextBuildPlacementPosition = readBuildPlacementPosition(
          event.clientX,
          event.clientY
        );

        if (nextBuildPlacementPosition !== null) {
          handleBuildPlacement(
            activeBuildPrimitiveAssetIdRef.current,
            nextBuildPlacementPosition
          );
        }

        return;
      }

      const nextSelectedPlacementId = readSelectedPlacementId(
        event.clientX,
        event.clientY
      );

      if (nextSelectedPlacementId !== null) {
        handlePlacementSelection(nextSelectedPlacementId);
      }
    };

    const handlePointerCancel = () => {
      pointerDownPositionRef.current = null;
    };
    const handlePointerMove = (event: PointerEvent) => {
      syncBuildCursor(event.clientX, event.clientY);
    };
    const handlePointerLeave = () => {
      buildCursorPositionRef.current = null;

      if (buildCursorAnchorRef.current !== null) {
        buildCursorAnchorRef.current.visible = false;
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const initializeViewport = async () => {
      try {
        await renderer.init();

        if (disposed) {
          return;
        }

        syncSize();
        resizeObserverRef.current = new ResizeObserver(syncSize);
        resizeObserverRef.current.observe(hostElement);
        canvasElement.addEventListener("pointerdown", handlePointerDown);
        canvasElement.addEventListener("pointermove", handlePointerMove);
        canvasElement.addEventListener("pointerup", handlePointerUp);
        canvasElement.addEventListener("pointercancel", handlePointerCancel);
        canvasElement.addEventListener("pointerleave", handlePointerLeave);
        canvasElement.addEventListener("contextmenu", handleContextMenu);
        syncSelectionPresentation();
        animationFrameRef.current =
          globalThis.window.requestAnimationFrame(renderFrame);
      } catch (error) {
        if (disposed) {
          return;
        }

        setViewportError(resolveViewportErrorMessage(error));
      }
    };

    void initializeViewport();

    return () => {
      disposed = true;
      lastFrameTimeRef.current = null;
      globalThis.window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      canvasElement.removeEventListener("pointerdown", handlePointerDown);
      canvasElement.removeEventListener("pointermove", handlePointerMove);
      canvasElement.removeEventListener("pointerup", handlePointerUp);
      canvasElement.removeEventListener("pointercancel", handlePointerCancel);
      canvasElement.removeEventListener("pointerleave", handlePointerLeave);
      canvasElement.removeEventListener("contextmenu", handleContextMenu);
      disposeMapEditorViewportPreviewGroup(placementGroup);
      if (sceneDraftHandlesRef.current !== null) {
        scene.remove(sceneDraftHandlesRef.current.rootGroup);
        disposeMapEditorViewportSceneDraftHandles(sceneDraftHandlesRef.current);
        sceneDraftHandlesRef.current = null;
      }
      if (buildCursorAnchorRef.current !== null) {
        const buildCursorDisposalGroup = new Group();

        buildCursorDisposalGroup.add(buildCursorAnchorRef.current);
        disposeMapEditorViewportPreviewGroup(buildCursorDisposalGroup);
        buildCursorAnchorRef.current = null;
      }
      placementAnchorByIdRef.current = new Map();
      previewAssetLibraryRef.current = null;
      transformController.dispose(scene);
      transformControllerRef.current = null;
      keyboardFlightController.dispose();
      keyboardFlightControllerRef.current = null;
      orbitControls.dispose();
      orbitControlsRef.current = null;
      disposeMapEditorViewportHelperHandles(scene, helperHandles);
      helperHandlesRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      placementGroupRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const placementGroup = placementGroupRef.current;
    const previewAssetLibrary = previewAssetLibraryRef.current;

    if (placementGroup === null || previewAssetLibrary === null) {
      return;
    }

    let cancelled = false;
    const previewBuildVersion = previewBuildVersionRef.current + 1;
    previewBuildVersionRef.current = previewBuildVersion;

    const rebuildPlacementPreviews = async () => {
      try {
        const placementAnchors = await Promise.all(
          placementDraftsRef.current.map((placement) =>
            previewAssetLibrary.createPlacementPreviewAnchor(placement)
          )
        );

        if (cancelled || previewBuildVersionRef.current !== previewBuildVersion) {
          const disposalGroup = new Group();

          for (const placementAnchor of placementAnchors) {
            disposalGroup.add(placementAnchor);
          }

          disposeMapEditorViewportPreviewGroup(disposalGroup);
          return;
        }

        disposeMapEditorViewportPreviewGroup(placementGroup);
        placementAnchorByIdRef.current = new Map(
          placementAnchors.map((placementAnchor) => [
            placementAnchor.userData.placementId as string,
            placementAnchor
          ])
        );

        for (const placementAnchor of placementAnchors) {
          placementGroup.add(placementAnchor);
        }

        syncPlacementPreviewAnchors(placementDraftsRef.current);
        syncSelectionPresentation();
      } catch (error) {
        if (!cancelled) {
          setViewportError(resolveViewportErrorMessage(error));
        }
      }
    };

    void rebuildPlacementPreviews();

    return () => {
      cancelled = true;
    };
  }, [previewStructureSignature, syncPlacementPreviewAnchors, syncSelectionPresentation]);

  useEffect(() => {
    syncPlacementPreviewAnchors(placementDrafts);
  }, [placementDrafts, previewPlacementSignature, syncPlacementPreviewAnchors]);

  useEffect(() => {
    const sceneDraftHandles = sceneDraftHandlesRef.current;

    if (sceneDraftHandles === null) {
      return;
    }

    syncMapEditorViewportSceneDrafts(sceneDraftHandles, {
      playerSpawnDrafts,
      sceneObjectDrafts,
      waterRegionDrafts
    });
  }, [playerSpawnDrafts, sceneDraftSignature, sceneObjectDrafts, waterRegionDrafts]);

  useEffect(() => {
    const scene = sceneRef.current;
    const previewAssetLibrary = previewAssetLibraryRef.current;

    if (scene === null || previewAssetLibrary === null) {
      return;
    }

    let cancelled = false;

    const removeBuildCursorAnchor = () => {
      if (buildCursorAnchorRef.current === null) {
        buildCursorAssetIdRef.current = null;
        return;
      }

      const buildCursorDisposalGroup = new Group();

      scene.remove(buildCursorAnchorRef.current);
      buildCursorDisposalGroup.add(buildCursorAnchorRef.current);
      disposeMapEditorViewportPreviewGroup(buildCursorDisposalGroup);
      buildCursorAnchorRef.current = null;
      buildCursorAssetIdRef.current = null;
      buildCursorPositionRef.current = null;
    };

    if (viewportToolMode !== "build" || activeBuildPrimitiveAssetId === null) {
      removeBuildCursorAnchor();
      return;
    }

    if (
      buildCursorAnchorRef.current !== null &&
      buildCursorAssetIdRef.current === activeBuildPrimitiveAssetId
    ) {
      buildCursorAnchorRef.current.visible = buildCursorPositionRef.current !== null;
      return;
    }

    removeBuildCursorAnchor();

    const createBuildCursorAnchor = async () => {
      const placement = {
        assetId: activeBuildPrimitiveAssetId,
        colliderCount: 0,
        collisionEnabled: true,
        isVisible: true,
        materialReferenceId: null,
        notes: "",
        placementId: "__map-editor-build-cursor__",
        placementMode: "instanced",
        position: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        rotationYRadians: 0,
        scale: Object.freeze({
          x: 1,
          y: 1,
          z: 1
        })
      } satisfies MapEditorPlacementDraftSnapshot;
      const buildCursorAnchor =
        await previewAssetLibrary.createPlacementPreviewAnchor(placement);

      if (cancelled) {
        const disposalGroup = new Group();

        disposalGroup.add(buildCursorAnchor);
        disposeMapEditorViewportPreviewGroup(disposalGroup);
        return;
      }

      applyMapEditorViewportPreviewOpacity(buildCursorAnchor, 0.42);
      if (buildCursorPositionRef.current !== null) {
        buildCursorAnchor.position.set(
          buildCursorPositionRef.current.x,
          buildCursorPositionRef.current.y,
          buildCursorPositionRef.current.z
        );
        buildCursorAnchor.visible = true;
      } else {
        buildCursorAnchor.visible = false;
      }
      buildCursorAnchorRef.current = buildCursorAnchor;
      buildCursorAssetIdRef.current = activeBuildPrimitiveAssetId;
      scene.add(buildCursorAnchor);
    };

    void createBuildCursorAnchor();

    return () => {
      cancelled = true;
    };
  }, [activeBuildPrimitiveAssetId, viewportToolMode]);

  useEffect(() => {
    const helperHandles = helperHandlesRef.current;

    if (helperHandles === null) {
      return;
    }

    syncMapEditorViewportHelperVisibility(helperHandles, helperVisibility);
  }, [helperVisibility]);

  useEffect(() => {
    syncSelectionPresentation();
  }, [selectedPlacementId, syncSelectionPresentation, viewportToolMode]);

  useEffect(() => {
    const camera = cameraRef.current;
    const orbitControls = orbitControlsRef.current;
    const hostElement = hostRef.current;

    if (camera === null || orbitControls === null) {
      return;
    }

    if (framedBundleIdRef.current === bundleId) {
      return;
    }

    if (hostElement !== null) {
      camera.aspect = Math.max(1, hostElement.clientWidth) / Math.max(1, hostElement.clientHeight);
      camera.updateProjectionMatrix();
    }

    const extents = resolvePlacementExtents(placementDrafts, {
      playerSpawnDrafts,
      sceneObjectDrafts,
      waterRegionDrafts
    });
    const centerX = (extents.minX + extents.maxX) * 0.5;
    const centerZ = (extents.minZ + extents.maxZ) * 0.5;
    const span = Math.max(
      14,
      extents.maxX - extents.minX,
      extents.maxZ - extents.minZ
    );

    frameMapEditorViewportCamera(camera, orbitControls, centerX, centerZ, span);
    framedBundleIdRef.current = bundleId;
  }, [bundleId, placementDrafts, playerSpawnDrafts, sceneObjectDrafts, waterRegionDrafts]);

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(circle_at_top,rgb(56_189_248/0.08),transparent_32%),linear-gradient(180deg,rgb(15_23_42/0.18),rgb(2_6_23/0.6))]">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-border/70 bg-background/78 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {viewportToolMode === "build" && activeBuildPrimitiveAssetId !== null
          ? `Build mode: click to stamp ${activeBuildPrimitiveAssetId} on the snapped plane. Drag to orbit, right-drag to pan, and use WASD plus Q/E to fly.`
          : "Click to focus. Drag to orbit. Right-drag to pan. Scroll to zoom. Use WASD to fly, Q/E for height, and Shift to move faster."}
      </div>
      {viewportError !== null ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/92 p-6 text-center text-sm text-muted-foreground">
          {viewportError}
        </div>
      ) : null}
      <div
        className="h-full w-full outline-none"
        ref={hostRef}
        tabIndex={0}
      >
        <canvas className="h-full w-full" ref={canvasRef} />
      </div>
    </div>
  );
}
