import { DuckHuntGameMenuDialog } from "../experiences/duck-hunt/components";

import { ShellProgressHeader } from "./components/shell-progress-header";
import { ShellStageRouter } from "./components/shell-stage-router";
import { ShellStatusRail } from "./components/shell-status-rail";
import { useMetaverseShellController } from "./states/metaverse-shell-controller";

export function MetaverseShell() {
  const controller = useMetaverseShellController();
  const activeStep = controller.navigationSnapshot.activeStep;
  const isImmersiveStage =
    activeStep === "calibration" ||
    activeStep === "tool" ||
    activeStep === "metaverse" ||
    activeStep === "gameplay";
  const isMinimalEntryStage = activeStep === "main-menu";
  const showDeveloperUi = import.meta.env.DEV;
  const stageRouter = (
    <ShellStageRouter
      activeExperienceId={controller.activeExperienceId}
      activeMetaverseBundleId={controller.activeMetaverseBundleId}
      activeStep={activeStep}
      audioStatusLabel={controller.shellView.audioStatusLabel}
      bestScore={controller.profile?.snapshot.bestScore ?? 0}
      capabilityReasonLabel={controller.shellView.capabilityReasonLabel}
      capabilityStatus={controller.capabilityStatus}
      calibrationQualityLabel={controller.shellView.calibrationQualityLabel}
      coopRoomIdDraft={controller.coopRoomIdDraft}
      debugPanelMode={controller.debugPanelMode}
      gameplayInputSource={controller.gameplayInputSource}
      handTrackingRuntime={controller.handTrackingRuntime}
      hasStoredProfile={controller.hydrationSource !== "empty"}
      inputMode={controller.inputMode}
      loginError={controller.loginError}
      onBestScoreChange={controller.onBestScoreChange}
      onEnterMetaverseRequest={controller.onEnterMetaverseRequest}
      permissionError={controller.permissionError}
      permissionState={controller.permissionState}
      profile={controller.profile}
      sessionMode={controller.sessionMode}
      selectedReticleLabel={controller.shellView.selectedReticleLabel}
      usernameDraft={controller.usernameDraft}
      nextMetaverseStep={controller.navigationSnapshot.nextMetaverseStep}
      onCalibrationProgress={controller.onCalibrationProgress}
      onCoopRoomIdDraftChange={controller.onCoopRoomIdDraftChange}
      onClearProfile={controller.onClearProfile}
      onEditProfile={controller.onEditProfile}
      onExperienceLaunchRequest={controller.onExperienceLaunchRequest}
      onGameplaySignal={controller.onGameplaySignal}
      onInputModeChange={controller.onInputModeChange}
      onLoginSubmit={controller.onLoginSubmit}
      metaverseControlMode={controller.metaverseControlMode}
      onCloseToolRequest={controller.onCloseToolRequest}
      onOpenGameplayMenu={() => controller.onGameplayMenuOpen(true)}
      onOpenToolRequest={controller.onOpenToolRequest}
      onRunToolPreviewRequest={controller.onRunToolPreviewRequest}
      onRequestPermission={controller.onRequestPermission}
      onRecalibrationRequest={controller.onRecalibrationRequest}
      onRetryCapabilityProbe={controller.onRetryCapabilityProbe}
      onSessionModeChange={controller.onSessionModeChange}
      onSetupRequest={controller.onSetupRequest}
      setUsernameDraft={controller.setUsernameDraft}
    />
  );

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgb(14_165_233/0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgb(251_146_60/0.14),transparent_32%)]" />

      {isImmersiveStage ? (
        <main className="relative h-dvh overflow-hidden">{stageRouter}</main>
      ) : isMinimalEntryStage ? (
        <main className="relative min-h-dvh overflow-y-auto">{stageRouter}</main>
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
              gameplayInputModeLabel={
                controller.shellView.gameplayInputModeLabel
              }
              metaverseControlModeLabel={
                controller.shellView.metaverseControlModeLabel
              }
              reticleCatalogLabel={controller.shellView.reticleCatalogLabel}
              username={controller.profile?.snapshot.username ?? "not confirmed"}
            />

            {stageRouter}
          </main>
        </div>
      )}

      {controller.profile !== null ? (
        <DuckHuntGameMenuDialog
          audioStatusLabel={controller.shellView.audioStatusLabel}
          calibrationQualityLabel={controller.shellView.calibrationQualityLabel}
          debugPanelMode={controller.debugPanelMode}
          gameplayStatusLabel={
            controller.sessionMode === "co-op"
              ? "Co-op room sync live"
              : "Local combat progression live"
          }
          inputMode={controller.inputMode}
          musicVolume={controller.shellView.musicVolumeSliderValue}
          onDebugPanelModeChange={controller.onGameplayDebugPanelModeChange}
          onInputModeChange={controller.onInputModeChange}
          onMusicVolumeChange={controller.onMusicVolumeChange}
          onOpenChange={controller.onGameplayMenuOpen}
          onRecalibrationRequest={controller.onRecalibrationRequest}
          onReturnToMetaverseRequest={controller.onReturnToMetaverseRequest}
          onSessionModeChange={controller.onSessionModeChange}
          onSfxVolumeChange={controller.onSfxVolumeChange}
          open={
            activeStep === "gameplay" && controller.isMenuOpen
          }
          sessionMode={controller.sessionMode}
          showDebugControls={showDeveloperUi}
          sfxVolume={controller.shellView.sfxVolumeSliderValue}
        />
      ) : null}
    </div>
  );
}
