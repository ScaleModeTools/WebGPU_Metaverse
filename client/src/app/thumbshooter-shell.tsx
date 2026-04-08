import { GameMenuDialog } from "../ui";

import { ShellProgressHeader } from "./components/shell-progress-header";
import { ShellStageRouter } from "./components/shell-stage-router";
import { ShellStatusRail } from "./components/shell-status-rail";
import { useThumbShooterShellController } from "./states/thumbshooter-shell-controller";

export function ThumbShooterShell() {
  const controller = useThumbShooterShellController();
  const activeStep = controller.navigationSnapshot.activeStep;
  const isImmersiveStage =
    activeStep === "calibration" || activeStep === "gameplay";
  const showDeveloperUi = import.meta.env.DEV;
  const stageRouter = (
    <ShellStageRouter
      activeStep={activeStep}
      audioStatusLabel={controller.shellView.audioStatusLabel}
      bestScore={controller.profile?.snapshot.bestScore ?? 0}
      capabilityReasonLabel={controller.shellView.capabilityReasonLabel}
      capabilityStatus={controller.capabilityStatus}
      calibrationQualityLabel={controller.shellView.calibrationQualityLabel}
      debugPanelMode={controller.debugPanelMode}
      gameplayInputSource={controller.gameplayInputSource}
      handTrackingRuntime={controller.handTrackingRuntime}
      hasStoredProfile={controller.hydrationSource !== "empty"}
      inputMode={controller.inputMode}
      loginError={controller.loginError}
      onBestScoreChange={controller.onBestScoreChange}
      permissionError={controller.permissionError}
      permissionState={controller.permissionState}
      profile={controller.profile}
      selectedReticleLabel={controller.shellView.selectedReticleLabel}
      usernameDraft={controller.usernameDraft}
      nextGameplayStep={controller.navigationSnapshot.nextGameplayStep}
      onCalibrationProgress={controller.onCalibrationProgress}
      onClearProfile={controller.onClearProfile}
      onEditProfile={controller.onEditProfile}
      onGameplaySignal={controller.onGameplaySignal}
      onGameplayStartRequest={controller.onGameplayStartRequest}
      onInputModeChange={controller.onInputModeChange}
      onLoginSubmit={controller.onLoginSubmit}
      onOpenGameplayMenu={() => controller.onGameplayMenuOpen(true)}
      onRequestPermission={controller.onRequestPermission}
      onRecalibrationRequest={controller.onRecalibrationRequest}
      onRetryCapabilityProbe={controller.onRetryCapabilityProbe}
      setUsernameDraft={controller.setUsernameDraft}
    />
  );

  return (
    <div className="min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(14_165_233_/_0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgb(251_146_60_/_0.14),_transparent_32%)]" />

      {isImmersiveStage ? (
        <main className="relative min-h-dvh">{stageRouter}</main>
      ) : (
        <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <ShellProgressHeader
            audioStatusLabel={controller.shellView.audioStatusLabel}
            capabilityReasonLabel={controller.shellView.capabilityReasonLabel}
            musicVolumeLabel={controller.shellView.musicVolumeLabel}
            runtimeLocks={controller.shellView.runtimeLocks}
            sfxVolumeLabel={controller.shellView.sfxVolumeLabel}
          />

          <main className="grid flex-1 gap-6 xl:grid-cols-[0.82fr_1.18fr]">
            <ShellStatusRail
              calibrationSampleCount={
                controller.profile?.calibrationSampleCount ?? 0
              }
              calibrationQualityLabel={controller.shellView.calibrationQualityLabel}
              calibrationStatusLabel={controller.shellView.calibrationStatusLabel}
              hydrationSource={controller.hydrationSource}
              inputModeLabel={controller.shellView.inputModeLabel}
              reticleCatalogLabel={controller.shellView.reticleCatalogLabel}
              username={controller.profile?.snapshot.username ?? "not confirmed"}
            />

            {stageRouter}
          </main>
        </div>
      )}

      {controller.profile !== null ? (
        <GameMenuDialog
          audioStatusLabel={controller.shellView.audioStatusLabel}
          calibrationQualityLabel={controller.shellView.calibrationQualityLabel}
          debugPanelMode={controller.debugPanelMode}
          gameplayStatusLabel="Local combat progression live"
          inputMode={controller.inputMode}
          musicVolume={controller.shellView.musicVolumeSliderValue}
          onDebugPanelModeChange={controller.onGameplayDebugPanelModeChange}
          onInputModeChange={controller.onInputModeChange}
          onMainMenuRequest={controller.onMainMenuRequest}
          onMusicVolumeChange={controller.onMusicVolumeChange}
          onOpenChange={controller.onGameplayMenuOpen}
          onRecalibrationRequest={controller.onRecalibrationRequest}
          onSfxVolumeChange={controller.onSfxVolumeChange}
          open={
            activeStep === "gameplay" && controller.isMenuOpen
          }
          showDebugControls={showDeveloperUi}
          sfxVolume={controller.shellView.sfxVolumeSliderValue}
        />
      ) : null}
    </div>
  );
}
