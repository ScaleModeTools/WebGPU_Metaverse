import { GameMenuDialog } from "../ui";

import { ShellProgressHeader } from "./components/shell-progress-header";
import { ShellStageRouter } from "./components/shell-stage-router";
import { ShellStatusRail } from "./components/shell-status-rail";
import { useThumbShooterShellController } from "./states/thumbshooter-shell-controller";

export function ThumbShooterShell() {
  const controller = useThumbShooterShellController();

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(14_165_233_/_0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgb(251_146_60_/_0.14),_transparent_32%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <ShellProgressHeader
          audioStatusLabel={controller.shellView.audioStatusLabel}
          capabilityReasonLabel={controller.shellView.capabilityReasonLabel}
          currentStepId={controller.navigationSnapshot.activeStep}
          musicVolumeLabel={controller.shellView.musicVolumeLabel}
          runtimeLocks={controller.shellView.runtimeLocks}
          sfxVolumeLabel={controller.shellView.sfxVolumeLabel}
        />

        <main className="grid flex-1 gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <ShellStatusRail
            calibrationSampleCount={controller.profile?.calibrationSampleCount ?? 0}
            hasAimCalibration={controller.profile?.hasAimCalibration ?? false}
            hydrationSource={controller.hydrationSource}
            reticleCatalogLabel={controller.shellView.reticleCatalogLabel}
            username={controller.profile?.snapshot.username ?? "not confirmed"}
          />

          <ShellStageRouter
            activeStep={controller.navigationSnapshot.activeStep}
            audioStatusLabel={controller.shellView.audioStatusLabel}
            bestScore={controller.profile?.snapshot.bestScore ?? 0}
            capabilityReasonLabel={controller.shellView.capabilityReasonLabel}
            capabilityStatus={controller.capabilityStatus}
            handTrackingRuntime={controller.handTrackingRuntime}
            hasStoredProfile={controller.hydrationSource !== "empty"}
            loginError={controller.loginError}
            onBestScoreChange={controller.onBestScoreChange}
            permissionError={controller.permissionError}
            permissionState={controller.permissionState}
            profile={controller.profile}
            selectedReticleLabel={controller.shellView.selectedReticleLabel}
            usernameDraft={controller.usernameDraft}
            onCalibrationProgress={controller.onCalibrationProgress}
            onClearProfile={controller.onClearProfile}
            onEditProfile={controller.onEditProfile}
            onGameplaySignal={controller.onGameplaySignal}
            onLoginSubmit={controller.onLoginSubmit}
            onOpenGameplayMenu={() => controller.onGameplayMenuOpen(true)}
            onRequestPermission={controller.onRequestPermission}
            onRetryCapabilityProbe={controller.onRetryCapabilityProbe}
            setUsernameDraft={controller.setUsernameDraft}
          />
        </main>
      </div>

      {controller.profile !== null ? (
        <GameMenuDialog
          audioStatusLabel={controller.shellView.audioStatusLabel}
          gameplayStatusLabel="Local combat progression live"
          musicVolume={controller.shellView.musicVolumeSliderValue}
          onMusicVolumeChange={controller.onMusicVolumeChange}
          onOpenChange={controller.onGameplayMenuOpen}
          onRecalibrationRequest={controller.onRecalibrationRequest}
          onSfxVolumeChange={controller.onSfxVolumeChange}
          open={
            controller.navigationSnapshot.activeStep === "gameplay" &&
            controller.isMenuOpen
          }
          sfxVolume={controller.shellView.sfxVolumeSliderValue}
        />
      ) : null}
    </div>
  );
}
