import { useEffectEvent } from "react";
import type { Dispatch } from "react";
import type {
  ExperienceId,
  GameplayInputModeId,
  MetaverseMatchModeId,
  MetaverseRoomAssignmentSnapshot
} from "@webgpu-metaverse/shared";
import {
  createMetaverseJoinRoomRequest as createJoinRoomRequest,
  createMetaverseQuickJoinRoomRequest as createQuickJoinRoomRequest
} from "@webgpu-metaverse/shared";

import type { MetaverseAudioSession } from "../audio";
import type {
  DuckHuntControllerSchemeId,
  GlobalControllerBindingPresetId,
  MetaverseControllerSchemeId
} from "../../input";
import type { MetaverseControlModeId } from "../../metaverse";
import {
  createMetaverseRoomDirectoryClient,
  resolveMetaverseTeamDeathmatchRoomIdDraft
} from "../../metaverse/config/metaverse-room-network";
import { resolveMetaverseLocalPlayerIdForUsername } from "../../metaverse/config/metaverse-presence-network";
import {
  registerMetaverseWorldBundleOnServer,
  registerPublicMetaverseMapBundleRegistryEntries
} from "../../metaverse/world/map-bundles";
import type { MetaverseWorldPreviewLaunchSelectionSnapshot } from "../../metaverse/world/map-bundles";
import {
  readMetaverseMapLaunchPlaylistSnapshot,
  resolveMetaverseMapLaunchSelection
} from "../../metaverse/world/playlists";
import type {
  MetaverseShellControllerAction,
  MetaverseShellControllerState
} from "../types/metaverse-shell-controller";

interface MetaverseShellFlowPolicyDependencies {
  readonly audioSession: MetaverseAudioSession;
  readonly browserStorage: Storage | null;
  readonly dispatch: Dispatch<MetaverseShellControllerAction>;
  readonly metaverseLaunchPending: boolean;
  readonly metaverseRoomIdDraft: string;
  readonly setActiveMetaverseRoomAssignment: (
    assignment: MetaverseRoomAssignmentSnapshot | null
  ) => void;
  readonly setMetaverseLaunchError: (errorMessage: string | null) => void;
  readonly setMetaverseLaunchPending: (pending: boolean) => void;
  readonly state: MetaverseShellControllerState;
}

interface MetaverseShellFlowPolicy {
  readonly onDuckHuntControllerSchemeChange: (
    duckHuntControllerSchemeId: DuckHuntControllerSchemeId
  ) => void;
  readonly onCloseToolRequest: () => void;
  readonly onEnterMetaverseRequest: (
    matchMode?: MetaverseMatchModeId,
    metaverseRoomIdOverride?: string
  ) => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onGlobalControllerBindingPresetChange: (
    globalBindingPresetId: GlobalControllerBindingPresetId
  ) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onOpenGamePlaylistsRequest: () => void;
  readonly onOpenToolRequest: () => void;
  readonly onRunToolPreviewRequest: (
    launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot
  ) => void;
  readonly onMetaverseControlModeChange: (
    controlMode: MetaverseControlModeId
  ) => void;
  readonly onMetaverseControllerSchemeChange: (
    metaverseControllerSchemeId: MetaverseControllerSchemeId
  ) => void;
  readonly onReturnToMetaverseRequest: () => void;
  readonly onSetupRequest: () => void;
}

function resolveLaunchUsername(state: MetaverseShellControllerState): string {
  const activeUsername = state.profile?.snapshot.username ?? state.usernameDraft;
  const normalizedUsername = activeUsername.trim();

  return normalizedUsername.length === 0 ? "Unknown" : normalizedUsername;
}

function resolveStandardMetaverseLaunchSelection(
  matchMode: MetaverseMatchModeId
): {
  readonly bundleId: string;
  readonly launchVariationId: string;
} {
  if (matchMode === "team-deathmatch") {
    return Object.freeze({
      bundleId: "private-build",
      launchVariationId: "shell-team-deathmatch"
    });
  }

  return Object.freeze({
    bundleId: "private-build",
    launchVariationId: "shell-free-roam"
  });
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export function useMetaverseShellFlowPolicy({
  audioSession,
  browserStorage,
  dispatch,
  metaverseLaunchPending,
  metaverseRoomIdDraft,
  setActiveMetaverseRoomAssignment,
  setMetaverseLaunchError,
  setMetaverseLaunchPending,
  state
}: MetaverseShellFlowPolicyDependencies): MetaverseShellFlowPolicy {
  const requestMetaverseRoomAssignment = useEffectEvent(
    async (input: {
      readonly bundleId: string;
      readonly launchVariationId: string;
      readonly matchMode: MetaverseMatchModeId;
      readonly metaverseRoomIdOverride?: string;
    }): Promise<MetaverseRoomAssignmentSnapshot> => {
      const roomDirectoryClient = createMetaverseRoomDirectoryClient();
      const playerId = resolveMetaverseLocalPlayerIdForUsername(
        resolveLaunchUsername(state)
      );

      await registerMetaverseWorldBundleOnServer(input.bundleId);

      if (input.matchMode === "team-deathmatch") {
        const roomId = resolveMetaverseTeamDeathmatchRoomIdDraft(
          input.metaverseRoomIdOverride ?? metaverseRoomIdDraft
        );

        if (roomId === null) {
          throw new Error("Enter a valid Team Deathmatch room code.");
        }

        return roomDirectoryClient.joinRoom(
          roomId,
          createJoinRoomRequest({
            bundleId: input.bundleId,
            launchVariationId: input.launchVariationId,
            playerId
          })
        );
      }

      return roomDirectoryClient.quickJoinRoom(
        createQuickJoinRoomRequest({
          bundleId: input.bundleId,
          launchVariationId: input.launchVariationId,
          matchMode: input.matchMode,
          playerId
        })
      );
    }
  );

  const onEnterMetaverseRequest = useEffectEvent(
    async (
      matchMode?: MetaverseMatchModeId,
      metaverseRoomIdOverride?: string
    ) => {
      if (metaverseLaunchPending) {
        return;
      }

      const resolvedMatchMode = matchMode ?? state.matchMode;

      setMetaverseLaunchPending(true);
      setMetaverseLaunchError(null);
      setActiveMetaverseRoomAssignment(null);
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });

      try {
        await registerPublicMetaverseMapBundleRegistryEntries();

        const launchSelection = resolveMetaverseMapLaunchSelection(
          readMetaverseMapLaunchPlaylistSnapshot(browserStorage),
          resolvedMatchMode
        );
        const roomAssignment = await requestMetaverseRoomAssignment({
          bundleId: launchSelection.bundleId,
          launchVariationId: launchSelection.launchVariationId,
          matchMode: resolvedMatchMode,
          ...(metaverseRoomIdOverride === undefined
            ? {}
            : { metaverseRoomIdOverride })
        });

        setActiveMetaverseRoomAssignment(roomAssignment);
        dispatch({
          bundleId: roomAssignment.bundleId,
          launchVariationId: roomAssignment.launchVariationId,
          matchMode: roomAssignment.matchMode,
          type: "metaverseEntryRequested"
        });
      } catch (error) {
        setMetaverseLaunchError(
          resolveErrorMessage(error, "Metaverse room launch failed.")
        );
      } finally {
        setMetaverseLaunchPending(false);
      }
    }
  );

  const onExperienceLaunchRequest = useEffectEvent((experienceId: ExperienceId) => {
    dispatch({
      experienceId,
      type: "experienceLaunchRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onReturnToMetaverseRequest = useEffectEvent(() => {
    dispatch({
      type: "metaverseReturnRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-menu-close")
    });
  });

  const onSetupRequest = useEffectEvent(() => {
    setActiveMetaverseRoomAssignment(null);
    setMetaverseLaunchError(null);
    setMetaverseLaunchPending(false);
    dispatch({
      type: "setupRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-menu-close")
    });
  });

  const onInputModeChange = useEffectEvent((inputMode: GameplayInputModeId) => {
    if (inputMode === state.inputMode) {
      return;
    }

    dispatch({
      type: "inputModeChanged",
      inputMode
    });

    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onGlobalControllerBindingPresetChange = useEffectEvent(
    (globalBindingPresetId: GlobalControllerBindingPresetId) => {
      if (
        globalBindingPresetId ===
        state.controllerConfiguration.globalBindingPresetId
      ) {
        return;
      }

      dispatch({
        type: "globalBindingPresetChanged",
        globalBindingPresetId
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onMetaverseControlModeChange = useEffectEvent(
    (controlMode: MetaverseControlModeId) => {
      if (controlMode === state.metaverseControlMode) {
        return;
      }

      dispatch({
        controlMode,
        type: "metaverseControlModeChanged"
      });

      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onMetaverseControllerSchemeChange = useEffectEvent(
    (metaverseControllerSchemeId: MetaverseControllerSchemeId) => {
      if (
        metaverseControllerSchemeId ===
        state.controllerConfiguration.metaverseControllerSchemeId
      ) {
        return;
      }

      dispatch({
        type: "metaverseControllerSchemeChanged",
        metaverseControllerSchemeId
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onDuckHuntControllerSchemeChange = useEffectEvent(
    (duckHuntControllerSchemeId: DuckHuntControllerSchemeId) => {
      if (
        duckHuntControllerSchemeId ===
        state.controllerConfiguration.duckHuntControllerSchemeId
      ) {
        return;
      }

      dispatch({
        type: "duckHuntControllerSchemeChanged",
        duckHuntControllerSchemeId
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onOpenToolRequest = useEffectEvent(() => {
    setActiveMetaverseRoomAssignment(null);
    setMetaverseLaunchError(null);
    setMetaverseLaunchPending(false);
    dispatch({
      type: "toolEditorRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onOpenGamePlaylistsRequest = useEffectEvent(() => {
    setActiveMetaverseRoomAssignment(null);
    setMetaverseLaunchError(null);
    setMetaverseLaunchPending(false);
    dispatch({
      type: "gamePlaylistsRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onCloseToolRequest = useEffectEvent(() => {
    setActiveMetaverseRoomAssignment(null);
    setMetaverseLaunchError(null);
    setMetaverseLaunchPending(false);
    dispatch({
      type: "toolEditorExited"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-menu-close")
    });
  });

  const onRunToolPreviewRequest = useEffectEvent(
    async (launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot) => {
      if (metaverseLaunchPending) {
        return;
      }

      const previewMatchMode = launchSelection.matchMode ?? "free-roam";
      const previewLaunchVariationId =
        launchSelection.variationId ??
        resolveStandardMetaverseLaunchSelection(previewMatchMode)
          .launchVariationId;

      setMetaverseLaunchPending(true);
      setMetaverseLaunchError(null);
      setActiveMetaverseRoomAssignment(null);
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });

      try {
        const roomAssignment = await requestMetaverseRoomAssignment({
          bundleId: launchSelection.bundleId,
          launchVariationId: previewLaunchVariationId,
          matchMode: previewMatchMode
        });

        setActiveMetaverseRoomAssignment(roomAssignment);
        dispatch({
          launchSelection,
          type: "toolPreviewRequested"
        });
      } catch (error) {
        setMetaverseLaunchError(
          resolveErrorMessage(error, "Metaverse preview launch failed.")
        );
      } finally {
        setMetaverseLaunchPending(false);
      }
    }
  );

  return {
    onDuckHuntControllerSchemeChange,
    onCloseToolRequest,
    onEnterMetaverseRequest,
    onExperienceLaunchRequest,
    onGlobalControllerBindingPresetChange,
    onInputModeChange,
    onOpenGamePlaylistsRequest,
    onOpenToolRequest,
    onRunToolPreviewRequest,
    onMetaverseControlModeChange,
    onMetaverseControllerSchemeChange,
    onReturnToMetaverseRequest,
    onSetupRequest
  };
}
