import { useEffect, useEffectEvent } from "react";
import type { Dispatch } from "react";

import type { ShellNavigationSnapshot } from "../../navigation";
import type { MetaverseAudioSession } from "../audio";

import type {
  MetaverseShellControllerAction,
  MetaverseShellControllerState
} from "../types/metaverse-shell-controller";

interface MetaverseShellGameplayMenuPolicyDependencies {
  readonly audioSession: MetaverseAudioSession;
  readonly dispatch: Dispatch<MetaverseShellControllerAction>;
  readonly navigationSnapshot: ShellNavigationSnapshot;
  readonly state: MetaverseShellControllerState;
}

interface MetaverseShellGameplayMenuPolicy {
  readonly onGameplayMenuOpen: (open: boolean) => void;
}

export function useMetaverseShellGameplayMenuPolicy({
  audioSession,
  dispatch,
  navigationSnapshot,
  state
}: MetaverseShellGameplayMenuPolicyDependencies): MetaverseShellGameplayMenuPolicy {
  const handleEscapeToggle = useEffectEvent(() => {
    if (navigationSnapshot.activeStep !== "gameplay") {
      return;
    }

    const nextOpen = !state.isMenuOpen;

    dispatch({
      type: "gameplayMenuSetOpen",
      open: nextOpen
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue(
        nextOpen ? "ui-menu-open" : "ui-menu-close"
      )
    });
  });

  useEffect(() => {
    if (navigationSnapshot.activeStep === "gameplay" || !state.isMenuOpen) {
      return;
    }

    dispatch({
      type: "gameplayExited"
    });
  }, [dispatch, navigationSnapshot.activeStep, state.isMenuOpen]);

  useEffect(() => {
    if (navigationSnapshot.activeStep !== "gameplay") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      handleEscapeToggle();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleEscapeToggle, navigationSnapshot.activeStep]);

  const onGameplayMenuOpen = useEffectEvent((open: boolean) => {
    if (open === state.isMenuOpen) {
      return;
    }

    dispatch({
      type: "gameplayMenuSetOpen",
      open
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue(
        open ? "ui-menu-open" : "ui-menu-close"
      )
    });
  });

  return {
    onGameplayMenuOpen
  };
}
