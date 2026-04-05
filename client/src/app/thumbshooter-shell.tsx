import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { FormEvent } from "react";

import { AudioSettings, PlayerProfile, createUsername } from "@thumbshooter/shared";

import { reticleManifest } from "../assets";
import { BrowserAudioSession, audioFoundationConfig } from "../audio";
import type { AudioSessionSnapshot } from "../audio";
import {
  WebGpuGameplayCapabilityProbe,
  gameFoundationConfig
} from "../game";
import type { WebGpuGameplayCapabilitySnapshot } from "../game";
import { LocalProfileStorage } from "../network";
import {
  WebcamPermissionGateway,
  resolveShellNavigation
} from "../navigation";
import type { CalibrationShellState, WebcamPermissionState } from "../navigation";
import { GameMenuDialog } from "../ui";

import { CalibrationStageScreen } from "./components/calibration-stage-screen";
import { GameplayStageScreen } from "./components/gameplay-stage-screen";
import { LoginStageScreen } from "./components/login-stage-screen";
import { MilestoneBoundariesCard } from "./components/milestone-boundaries-card";
import { PermissionStageScreen } from "./components/permission-stage-screen";
import { ProfileSummaryCard } from "./components/profile-summary-card";
import { ShellProgressHeader } from "./components/shell-progress-header";
import { UnsupportedStageScreen } from "./components/unsupported-stage-screen";

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

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function toSliderValue(value: number): [number] {
  return [Math.round(value * 100)];
}

function describeCapabilityReason(
  snapshot: WebGpuGameplayCapabilitySnapshot
): string {
  switch (snapshot.reason) {
    case "adapter-ready":
      return "Gameplay WebGPU adapter ready.";
    case "navigator-gpu-missing":
      return "The browser does not expose navigator.gpu.";
    case "adapter-unavailable":
      return "A WebGPU adapter was not returned for gameplay.";
    case "probe-failed":
      return "The WebGPU probe failed before gameplay could start.";
    case "pending":
      return "Checking gameplay WebGPU support.";
  }
}

function describeAudioStatus(snapshot: AudioSessionSnapshot): string {
  if (snapshot.unlockState === "unlocked") {
    return snapshot.backgroundMusicState === "primed"
      ? "Audio unlocked, Strudel primed"
      : "Audio unlocked";
  }

  if (snapshot.unlockState === "unsupported") {
    return "Audio unavailable";
  }

  if (snapshot.unlockState === "failed") {
    return "Audio unlock failed";
  }

  if (snapshot.unlockState === "unlocking") {
    return "Unlocking audio";
  }

  return "Awaiting user gesture";
}

function updateProfileMix(
  profile: PlayerProfile,
  updater: (audioSettings: AudioSettings) => AudioSettings
): PlayerProfile {
  return profile.withAudioSettings(
    updater(AudioSettings.fromSnapshot(profile.snapshot.audioSettings)).snapshot
  );
}

export function ThumbShooterShell() {
  const [profileStorage] = useState(() => new LocalProfileStorage());
  const [capabilityProbe] = useState(() => new WebGpuGameplayCapabilityProbe());
  const [permissionGateway] = useState(() => new WebcamPermissionGateway());
  const [audioSession] = useState(() => new BrowserAudioSession());
  const [hydratedProfile] = useState(() =>
    profileStorage.loadProfile(readBrowserStorage())
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
  const [calibrationStatus, setCalibrationStatus] =
    useState<CalibrationShellState>(
      hydratedProfile.profile?.calibrationSampleCount ? "reviewed" : "pending"
    );
  const [audioSnapshot, setAudioSnapshot] = useState<AudioSessionSnapshot>(
    audioSession.snapshot
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasAutoOpenedMenu, setHasAutoOpenedMenu] = useState(false);

  const navigationSnapshot = resolveShellNavigation({
    hasConfirmedProfile,
    webcamPermission: permissionState,
    gameplayCapability: capabilitySnapshot.status,
    calibrationShell: calibrationStatus
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
    let didCancel = false;

    async function probeGameplayCapability() {
      const nextSnapshot = await capabilityProbe.probe(window.navigator);

      if (!didCancel) {
        setCapabilitySnapshot(nextSnapshot);
      }
    }

    void probeGameplayCapability();

    return () => {
      didCancel = true;
    };
  }, [capabilityProbe]);

  useEffect(() => {
    if (profile === null) {
      return;
    }

    profileStorage.saveProfile(readBrowserStorage(), profile.snapshot);
  }, [profile, profileStorage]);

  useEffect(() => {
    if (profile === null) {
      return;
    }

    setAudioSnapshot(audioSession.syncMix(profile.snapshot.audioSettings.mix));
  }, [audioSession, profile]);

  useEffect(() => {
    if (profile?.calibrationSampleCount) {
      setCalibrationStatus("reviewed");
    }
  }, [profile]);

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
      setCalibrationStatus(
        nextProfile.calibrationSampleCount > 0 ? "reviewed" : "pending"
      );
      setLoginError(null);
    });

    setAudioSnapshot(audioSession.playCue("ui-confirm"));
  }

  function handleClearProfile(): void {
    profileStorage.clearProfile(readBrowserStorage());
    setAudioSnapshot(audioSession.syncMix(audioFoundationConfig.defaultMix));

    startTransition(() => {
      setProfile(null);
      setUsernameDraft("");
      setHasConfirmedProfile(false);
      setHydrationSource("empty");
      setCalibrationStatus("pending");
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

  function handleCalibrationContinue(): void {
    startTransition(() => {
      setCalibrationStatus("reviewed");
    });
    setAudioSnapshot(audioSession.playCue("calibration-shot"));
  }

  function handleRecalibrationRequest(): void {
    startTransition(() => {
      setCalibrationStatus("pending");
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
    startTransition(() => {
      setHasConfirmedProfile(false);
      setIsMenuOpen(false);
    });
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

  const runtimeLocks = [
    `Renderer: ${gameFoundationConfig.renderer.target}`,
    `Imports: ${gameFoundationConfig.renderer.threeImportSurface}`,
    `Shaders: ${gameFoundationConfig.renderer.shaderAuthoringModel}`,
    `Tracking: ${gameFoundationConfig.runtime.handTrackingExecutionModel}`,
    `Transport: ${gameFoundationConfig.runtime.handTrackingTransport}`,
    `BGM: ${audioFoundationConfig.music.engine}`,
    `SFX: ${audioFoundationConfig.soundEffects.engine}`
  ] as const;
  const audioMix =
    profile?.snapshot.audioSettings.mix ?? audioFoundationConfig.defaultMix;
  const capabilityReasonLabel = describeCapabilityReason(capabilitySnapshot);
  const selectedReticleLabel =
    reticleManifest.reticles.find(
      (reticle) => reticle.id === profile?.snapshot.selectedReticleId
    )?.label ?? "Default ring";

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(14_165_233_/_0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgb(251_146_60_/_0.14),_transparent_32%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <ShellProgressHeader
          audioStatusLabel={describeAudioStatus(audioSnapshot)}
          capabilityReasonLabel={capabilityReasonLabel}
          currentStepId={navigationSnapshot.activeStep}
          musicVolumeLabel={toPercent(Number(audioMix.musicVolume))}
          runtimeLocks={runtimeLocks}
          sfxVolumeLabel={toPercent(Number(audioMix.sfxVolume))}
        />

        <main className="grid flex-1 gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="grid gap-6">
            <ProfileSummaryCard
              calibrationSampleCount={profile?.calibrationSampleCount ?? 0}
              hydrationSource={hydrationSource}
              reticleCatalogLabel={reticleManifest.reticles
                .map((reticle) => reticle.label)
                .join(" / ")}
              username={profile?.snapshot.username ?? "not confirmed"}
            />

            <MilestoneBoundariesCard />
          </aside>

          <section>
            {navigationSnapshot.activeStep === "login" ? (
              <LoginStageScreen
                hasStoredProfile={hydrationSource !== "empty"}
                loginError={loginError}
                onClearProfile={handleClearProfile}
                onSubmit={(event) => {
                  void handleLoginSubmit(event);
                }}
                setUsernameDraft={setUsernameDraft}
                usernameDraft={usernameDraft}
              />
            ) : null}

            {navigationSnapshot.activeStep === "permissions" ? (
              <PermissionStageScreen
                capabilityReasonLabel={capabilityReasonLabel}
                capabilityStatus={capabilitySnapshot.status}
                permissionError={permissionError}
                permissionState={permissionState}
                onRequestPermission={() => {
                  void handleRequestPermission();
                }}
              />
            ) : null}

            {navigationSnapshot.activeStep === "calibration" ? (
              <CalibrationStageScreen
                calibrationStatus={calibrationStatus}
                onContinue={handleCalibrationContinue}
                storedCalibrationCount={profile?.calibrationSampleCount ?? 0}
              />
            ) : null}

            {navigationSnapshot.activeStep === "unsupported" ? (
              <UnsupportedStageScreen
                capabilityReasonLabel={capabilityReasonLabel}
                onEditProfile={handleEditProfile}
                onRetry={handleRetryCapabilityProbe}
              />
            ) : null}

            {navigationSnapshot.activeStep === "gameplay" && profile !== null ? (
              <GameplayStageScreen
                audioStatusLabel={describeAudioStatus(audioSnapshot)}
                onOpenMenu={() => handleGameplayMenuOpen(true)}
                selectedReticleLabel={selectedReticleLabel}
                username={profile.snapshot.username}
                weaponLabel={gameFoundationConfig.weapon.firstPlayableWeapon}
              />
            ) : null}
          </section>
        </main>
      </div>

      {profile !== null ? (
        <GameMenuDialog
          audioStatusLabel={describeAudioStatus(audioSnapshot)}
          gameplayStatusLabel="Gameplay shell ready"
          musicVolume={toSliderValue(Number(audioMix.musicVolume))}
          onMusicVolumeChange={handleMusicVolumeChange}
          onOpenChange={handleGameplayMenuOpen}
          onRecalibrationRequest={handleRecalibrationRequest}
          onSfxVolumeChange={handleSfxVolumeChange}
          open={navigationSnapshot.activeStep === "gameplay" && isMenuOpen}
          sfxVolume={toSliderValue(Number(audioMix.sfxVolume))}
        />
      ) : null}
    </div>
  );
}
