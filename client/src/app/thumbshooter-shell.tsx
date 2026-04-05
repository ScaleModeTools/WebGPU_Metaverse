import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { FormEvent } from "react";

import { PlayerProfile, createUsername } from "@thumbshooter/shared";

import { BrowserAudioSession, audioFoundationConfig } from "../audio";
import { WebGpuGameplayCapabilityProbe } from "../game/classes/webgpu-gameplay-capability-probe";
import { HandTrackingRuntime } from "../game/classes/hand-tracking-runtime";
import type { WebGpuGameplayCapabilitySnapshot } from "../game/types/webgpu-capability";
import { LocalProfileStorage } from "../network";
import { WebcamPermissionGateway, resolveShellNavigation } from "../navigation";
import type { WebcamPermissionState } from "../navigation";
import { GameMenuDialog } from "../ui";

import { ShellProgressHeader } from "./components/shell-progress-header";
import { ShellStageRouter } from "./components/shell-stage-router";
import { ShellStatusRail } from "./components/shell-status-rail";
import {
  buildThumbShooterShellView,
  resolveCalibrationShellState,
  updateProfileMix
} from "./states/thumbshooter-shell-view";

const initialCapabilitySnapshot: WebGpuGameplayCapabilitySnapshot = {
  status: "checking",
  reason: "pending"
};

function readBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ThumbShooterShell() {
  const [browserStorage] = useState(() => readBrowserStorage());
  const [profileStorage] = useState(() => new LocalProfileStorage());
  const [capabilityProbe] = useState(() => new WebGpuGameplayCapabilityProbe());
  const [handTrackingRuntime] = useState(() => new HandTrackingRuntime());
  const [permissionGateway] = useState(() => new WebcamPermissionGateway());
  const [audioSession] = useState(() => new BrowserAudioSession());
  const [hydratedProfile] = useState(() =>
    profileStorage.loadProfile(browserStorage)
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(
    hydratedProfile.profile
  );
  const [hydrationSource, setHydrationSource] = useState(hydratedProfile.source);
  const [hasConfirmedProfile, setHasConfirmedProfile] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(
    hydratedProfile.profile?.snapshot.username ?? ""
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [permissionState, setPermissionState] =
    useState<WebcamPermissionState>("prompt");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [capabilitySnapshot, setCapabilitySnapshot] =
    useState<WebGpuGameplayCapabilitySnapshot>(initialCapabilitySnapshot);
  const [audioSnapshot, setAudioSnapshot] = useState(audioSession.snapshot);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasAutoOpenedMenu, setHasAutoOpenedMenu] = useState(false);

  const calibrationStatus = resolveCalibrationShellState(profile);
  const navigationSnapshot = resolveShellNavigation({
    hasConfirmedProfile,
    webcamPermission: permissionState,
    gameplayCapability: capabilitySnapshot.status,
    calibrationShell: calibrationStatus
  });
  const shellView = buildThumbShooterShellView({
    audioSnapshot,
    capabilitySnapshot,
    profile
  });

  const handleEscapeToggle = useEffectEvent(() => {
    if (navigationSnapshot.activeStep !== "gameplay") {
      return;
    }

    const nextOpen = !isMenuOpen;

    setIsMenuOpen(nextOpen);
    setAudioSnapshot(
      audioSession.playCue(nextOpen ? "ui-menu-open" : "ui-menu-close")
    );
  });

  useEffect(() => {
    return () => {
      handTrackingRuntime.dispose();
    };
  }, [handTrackingRuntime]);

  useEffect(() => {
    let didCancel = false;

    void capabilityProbe.probe(window.navigator).then((nextSnapshot) => {
      if (!didCancel) {
        setCapabilitySnapshot(nextSnapshot);
      }
    });

    return () => {
      didCancel = true;
    };
  }, [capabilityProbe]);

  useEffect(() => {
    if (profile === null) {
      return;
    }

    profileStorage.saveProfile(browserStorage, profile.snapshot);
  }, [browserStorage, profile, profileStorage]);

  useEffect(() => {
    if (profile === null) {
      return;
    }

    setAudioSnapshot(audioSession.syncMix(profile.snapshot.audioSettings.mix));
  }, [audioSession, profile]);

  useEffect(() => {
    if (navigationSnapshot.activeStep === "gameplay" || !isMenuOpen) {
      return;
    }

    setIsMenuOpen(false);
  }, [isMenuOpen, navigationSnapshot.activeStep]);

  useEffect(() => {
    if (navigationSnapshot.activeStep !== "gameplay" || hasAutoOpenedMenu) {
      return;
    }

    setIsMenuOpen(true);
    setHasAutoOpenedMenu(true);
    setAudioSnapshot(audioSession.playCue("ui-menu-open"));
  }, [audioSession, hasAutoOpenedMenu, navigationSnapshot.activeStep]);

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

  async function handleLoginSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const username = createUsername(usernameDraft);

    if (username === null) {
      setLoginError("Enter a non-empty username to create the local profile.");
      return;
    }

    const nextProfile =
      profile !== null && profile.snapshot.username === username
        ? profile
        : PlayerProfile.create({
            username
          });

    setAudioSnapshot(await audioSession.unlock());

    startTransition(() => {
      setProfile(nextProfile);
      setHasConfirmedProfile(true);
      setHydrationSource("profile-record");
      setLoginError(null);
    });

    setAudioSnapshot(audioSession.playCue("ui-confirm"));
  }

  function handleClearProfile(): void {
    handTrackingRuntime.dispose();
    profileStorage.clearProfile(browserStorage);
    setAudioSnapshot(audioSession.syncMix(audioFoundationConfig.defaultMix));

    startTransition(() => {
      setProfile(null);
      setUsernameDraft("");
      setHasConfirmedProfile(false);
      setHydrationSource("empty");
      setPermissionState("prompt");
      setPermissionError(null);
      setLoginError(null);
      setIsMenuOpen(false);
      setHasAutoOpenedMenu(false);
    });
  }

  async function handleRequestPermission(): Promise<void> {
    setPermissionState("requesting");
    setPermissionError(null);
    setAudioSnapshot(await audioSession.unlock());

    const permissionSnapshot = await permissionGateway.request(
      window.navigator.mediaDevices
    );

    if (permissionSnapshot.state === "granted") {
      startTransition(() => {
        setPermissionState("granted");
        setPermissionError(null);
      });
      setAudioSnapshot(audioSession.playCue("ui-confirm"));
      return;
    }

    setPermissionState(permissionSnapshot.state);
    setPermissionError(permissionSnapshot.failureReason);
  }

  function handleRecalibrationRequest(): void {
    startTransition(() => {
      setIsMenuOpen(false);
      setProfile((currentProfile) =>
        currentProfile?.resetCalibration() ?? currentProfile
      );
    });
    setAudioSnapshot(audioSession.playCue("calibration-shot"));
  }

  function handleRetryCapabilityProbe(): void {
    setCapabilitySnapshot(initialCapabilitySnapshot);

    void capabilityProbe.probe(window.navigator).then((nextSnapshot) => {
      setCapabilitySnapshot(nextSnapshot);
    });
  }

  function handleEditProfile(): void {
    handTrackingRuntime.dispose();
    startTransition(() => {
      setHasConfirmedProfile(false);
      setIsMenuOpen(false);
    });
  }

  function handleCalibrationProgress(
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ): void {
    setProfile(nextProfile);
    setAudioSnapshot(
      audioSession.playCue(
        progress === "completed" ? "ui-confirm" : "calibration-shot"
      )
    );
  }

  function handleGameplayMenuOpen(open: boolean): void {
    if (open === isMenuOpen) {
      return;
    }

    setIsMenuOpen(open);
    setAudioSnapshot(
      audioSession.playCue(open ? "ui-menu-open" : "ui-menu-close")
    );
  }

  function handleMusicVolumeChange(nextValue: number): void {
    setProfile((currentProfile) => {
      if (currentProfile === null) {
        return currentProfile;
      }

      return updateProfileMix(currentProfile, (audioSettings) =>
        audioSettings.withMusicVolume(nextValue / 100)
      );
    });
  }

  function handleSfxVolumeChange(nextValue: number): void {
    setProfile((currentProfile) => {
      if (currentProfile === null) {
        return currentProfile;
      }

      return updateProfileMix(currentProfile, (audioSettings) =>
        audioSettings.withSfxVolume(nextValue / 100)
      );
    });
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(14_165_233_/_0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgb(251_146_60_/_0.14),_transparent_32%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <ShellProgressHeader
          audioStatusLabel={shellView.audioStatusLabel}
          capabilityReasonLabel={shellView.capabilityReasonLabel}
          currentStepId={navigationSnapshot.activeStep}
          musicVolumeLabel={shellView.musicVolumeLabel}
          runtimeLocks={shellView.runtimeLocks}
          sfxVolumeLabel={shellView.sfxVolumeLabel}
        />

        <main className="grid flex-1 gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <ShellStatusRail
            calibrationSampleCount={profile?.calibrationSampleCount ?? 0}
            hasAimCalibration={profile?.hasAimCalibration ?? false}
            hydrationSource={hydrationSource}
            reticleCatalogLabel={shellView.reticleCatalogLabel}
            username={profile?.snapshot.username ?? "not confirmed"}
          />

          <ShellStageRouter
            activeStep={navigationSnapshot.activeStep}
            audioStatusLabel={shellView.audioStatusLabel}
            capabilityReasonLabel={shellView.capabilityReasonLabel}
            capabilityStatus={capabilitySnapshot.status}
            handTrackingRuntime={handTrackingRuntime}
            hasStoredProfile={hydrationSource !== "empty"}
            loginError={loginError}
            permissionError={permissionError}
            permissionState={permissionState}
            profile={profile}
            selectedReticleLabel={shellView.selectedReticleLabel}
            usernameDraft={usernameDraft}
            onCalibrationProgress={handleCalibrationProgress}
            onClearProfile={handleClearProfile}
            onEditProfile={handleEditProfile}
            onLoginSubmit={(event) => {
              void handleLoginSubmit(event);
            }}
            onOpenGameplayMenu={() => handleGameplayMenuOpen(true)}
            onRequestPermission={() => {
              void handleRequestPermission();
            }}
            onRetryCapabilityProbe={handleRetryCapabilityProbe}
            setUsernameDraft={setUsernameDraft}
          />
        </main>
      </div>

      {profile !== null ? (
        <GameMenuDialog
          audioStatusLabel={shellView.audioStatusLabel}
          gameplayStatusLabel="Local arena loop live"
          musicVolume={shellView.musicVolumeSliderValue}
          onMusicVolumeChange={handleMusicVolumeChange}
          onOpenChange={handleGameplayMenuOpen}
          onRecalibrationRequest={handleRecalibrationRequest}
          onSfxVolumeChange={handleSfxVolumeChange}
          open={navigationSnapshot.activeStep === "gameplay" && isMenuOpen}
          sfxVolume={shellView.sfxVolumeSliderValue}
        />
      ) : null}
    </div>
  );
}
