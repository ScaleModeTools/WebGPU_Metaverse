import { Suspense, lazy } from "react";
import type { FormEvent } from "react";

import {
  type ExperienceId,
  type GameplaySessionMode,
  type PlayerProfile
} from "@thumbshooter/shared";

import {
  mouseGameplayAimCalibrationSnapshot,
  type GameplayDebugPanelMode,
  type GameplayInputModeId,
  type GameplayInputSource,
  type GameplaySignal
} from "../../game";
import type { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";
import type {
  MetaverseEntryStepId,
  NavigationStepId,
  WebcamPermissionState
} from "../../navigation";
import {
  duckHuntFirstPlayableWeaponDefinition
} from "../../experiences/duck-hunt/config";
import { resolveDuckHuntGameplayCoopRoomId } from "../../experiences/duck-hunt/network";

import { CalibrationStageScreen } from "./calibration-stage-screen";
import { ImmersiveStageFrame } from "../../ui/components/immersive-stage-frame";
import { LoginStageScreen } from "./login-stage-screen";
import { MainMenuStageScreen } from "./main-menu-stage-screen";
import { PermissionStageScreen } from "./permission-stage-screen";
import { UnsupportedStageScreen } from "./unsupported-stage-screen";

const MetaverseStageScreen = lazy(async () =>
  import("../../metaverse").then((module) => ({
    default: module.MetaverseStageScreen
  }))
);
const DuckHuntGameplayStageScreen = lazy(async () =>
  import("../../experiences/duck-hunt/components").then((module) => ({
    default: module.DuckHuntGameplayStageScreen
  }))
);

interface ShellStageRouterProps {
  readonly activeExperienceId: ExperienceId | null;
  readonly activeStep: NavigationStepId;
  readonly audioStatusLabel: string;
  readonly bestScore: number;
  readonly capabilityReasonLabel: string;
  readonly capabilityStatus: WebGpuGameplayCapabilitySnapshot["status"];
  readonly calibrationQualityLabel: string;
  readonly coopRoomIdDraft: string;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly gameplayInputSource: GameplayInputSource;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly hasStoredProfile: boolean;
  readonly inputMode: GameplayInputModeId;
  readonly loginError: string | null;
  readonly nextMetaverseStep: MetaverseEntryStepId | null;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly sessionMode: GameplaySessionMode;
  readonly selectedReticleLabel: string;
  readonly usernameDraft: string;
  readonly onCalibrationProgress: (
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ) => void;
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onClearProfile: () => void;
  readonly onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => void;
  readonly onEditProfile: () => void;
  readonly onEnterMetaverseRequest: () => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onOpenGameplayMenu: () => void;
  readonly onRequestPermission: () => void;
  readonly onRecalibrationRequest: () => void;
  readonly onRetryCapabilityProbe: () => void;
  readonly onSessionModeChange: (mode: GameplaySessionMode) => void;
  readonly onSetupRequest: () => void;
  readonly setUsernameDraft: (value: string) => void;
}

function GameplayStageFallback() {
  return (
    <ImmersiveStageFrame className="bg-game-stage">
      <section className="flex flex-1 flex-col justify-end bg-[radial-gradient(circle_at_top,_rgb(56_189_248_/_0.08),_transparent_28%),linear-gradient(180deg,rgb(15_23_42_/_0.06),transparent_32%)] p-6 sm:p-8">
        <div className="max-w-xl rounded-[1.5rem] border border-border/70 bg-card/72 p-5 backdrop-blur-md">
          <p className="text-sm font-medium text-foreground">Booting WebGPU stage</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Loading the live renderer and the current shell route.
          </p>
        </div>
      </section>
    </ImmersiveStageFrame>
  );
}

export function ShellStageRouter({
  activeExperienceId,
  activeStep,
  audioStatusLabel,
  bestScore,
  capabilityReasonLabel,
  capabilityStatus,
  calibrationQualityLabel,
  coopRoomIdDraft,
  debugPanelMode,
  gameplayInputSource,
  handTrackingRuntime,
  hasStoredProfile,
  inputMode,
  loginError,
  nextMetaverseStep,
  permissionError,
  permissionState,
  profile,
  sessionMode,
  selectedReticleLabel,
  usernameDraft,
  onCalibrationProgress,
  onBestScoreChange,
  onClearProfile,
  onCoopRoomIdDraftChange,
  onEditProfile,
  onEnterMetaverseRequest,
  onExperienceLaunchRequest,
  onGameplaySignal,
  onInputModeChange,
  onLoginSubmit,
  onOpenGameplayMenu,
  onRequestPermission,
  onRecalibrationRequest,
  onRetryCapabilityProbe,
  onSessionModeChange,
  onSetupRequest,
  setUsernameDraft
}: ShellStageRouterProps) {
  const gameplayAimCalibration =
    inputMode === "mouse"
      ? mouseGameplayAimCalibrationSnapshot
      : profile?.snapshot.aimCalibration ?? null;
  const gameplayCoopRoomId = resolveDuckHuntGameplayCoopRoomId(coopRoomIdDraft);

  return (
    <section>
      {activeStep === "login" ? (
        <LoginStageScreen
          hasStoredProfile={hasStoredProfile}
          loginError={loginError}
          onClearProfile={onClearProfile}
          onSubmit={onLoginSubmit}
          setUsernameDraft={setUsernameDraft}
          usernameDraft={usernameDraft}
        />
      ) : null}

      {activeStep === "permissions" ? (
        <PermissionStageScreen
          capabilityReasonLabel={capabilityReasonLabel}
          capabilityStatus={capabilityStatus}
          permissionError={permissionError}
          permissionState={permissionState}
          onRequestPermission={onRequestPermission}
        />
      ) : null}

      {activeStep === "calibration" && profile !== null ? (
        <CalibrationStageScreen
          handTrackingRuntime={handTrackingRuntime}
          onCalibrationProgress={onCalibrationProgress}
          profile={profile}
        />
      ) : null}

      {activeStep === "main-menu" ? (
        <MainMenuStageScreen
          audioStatusLabel={audioStatusLabel}
          calibrationQualityLabel={calibrationQualityLabel}
          capabilityReasonLabel={capabilityReasonLabel}
          capabilityStatus={capabilityStatus}
          inputMode={inputMode}
          nextMetaverseStep={nextMetaverseStep}
          onEnterMetaverse={onEnterMetaverseRequest}
          onInputModeChange={onInputModeChange}
          onRecalibrationRequest={onRecalibrationRequest}
        />
      ) : null}

      {activeStep === "metaverse" && profile !== null ? (
        <Suspense fallback={<GameplayStageFallback />}>
          <MetaverseStageScreen
            audioStatusLabel={audioStatusLabel}
            calibrationQualityLabel={calibrationQualityLabel}
            coopRoomIdDraft={coopRoomIdDraft}
            inputMode={inputMode}
            onCoopRoomIdDraftChange={onCoopRoomIdDraftChange}
            onExperienceLaunchRequest={onExperienceLaunchRequest}
            onRecalibrationRequest={onRecalibrationRequest}
            onSessionModeChange={onSessionModeChange}
            onSetupRequest={onSetupRequest}
            sessionMode={sessionMode}
            username={profile.snapshot.username}
          />
        </Suspense>
      ) : null}

      {activeStep === "unsupported" ? (
        <UnsupportedStageScreen
          capabilityReasonLabel={capabilityReasonLabel}
          onEditProfile={onEditProfile}
          onRetry={onRetryCapabilityProbe}
        />
      ) : null}

      {activeStep === "gameplay" &&
      activeExperienceId === "duck-hunt" &&
      profile !== null &&
      gameplayAimCalibration !== null ? (
        <Suspense fallback={<GameplayStageFallback />}>
          <DuckHuntGameplayStageScreen
            aimCalibration={gameplayAimCalibration}
            audioStatusLabel={audioStatusLabel}
            bestScore={bestScore}
            coopRoomId={gameplayCoopRoomId}
            debugPanelMode={debugPanelMode}
            inputMode={inputMode}
            onBestScoreChange={onBestScoreChange}
            onGameplaySignal={onGameplaySignal}
            onOpenMenu={onOpenGameplayMenu}
            selectedReticleLabel={selectedReticleLabel}
            sessionMode={sessionMode}
            trackingSource={gameplayInputSource}
            triggerCalibration={profile.snapshot.triggerCalibration}
            username={profile.snapshot.username}
            weaponLabel={duckHuntFirstPlayableWeaponDefinition.displayName}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
