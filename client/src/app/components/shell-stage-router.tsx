import { Suspense, lazy, useMemo } from "react";
import type { FormEvent } from "react";

import {
  type GameplayInputModeId,
  type ExperienceId,
  type GameplaySessionMode,
  type PlayerProfile
} from "@webgpu-metaverse/shared";

import {
  type GameplayDebugPanelMode,
  type GameplaySignal
} from "../../experiences/duck-hunt";
import type { MetaverseControlModeId } from "../../metaverse";
import type { MetaverseWorldPreviewLaunchSelectionSnapshot } from "../../metaverse/world/map-bundles";
import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse";
import type {
  MetaverseEntryStepId,
  NavigationStepId,
  WebcamPermissionState
} from "../../navigation";
import {
  mouseGameplayAimCalibrationSnapshot,
  type GameplayInputSource
} from "../../tracking";
import type { HandTrackingRuntime } from "../../tracking";
import {
  duckHuntFirstPlayableWeaponDefinition
} from "../../experiences/duck-hunt/config";
import { resolveDuckHuntGameplayCoopRoomId } from "../../experiences/duck-hunt/network";

import { ImmersiveStageFrame } from "../../ui/components/immersive-stage-frame";
import { PermissionStageScreen } from "./permission-stage-screen";
import { ShellEntryStageScreen } from "./shell-entry-stage-screen";
import { TrackedHandCalibrationStageScreen } from "./tracked-hand-calibration-stage-screen";
import { UnsupportedStageScreen } from "./unsupported-stage-screen";
import {
  metaverseAttachmentProofConfig,
  metaverseCharacterProofConfig,
  loadMetaverseEnvironmentProofConfig
} from "../../metaverse/world/proof";
import { resolveMetaverseWorldBundleSourceBundleId } from "../../metaverse/world/bundle-registry";

const MetaverseStageScreen = lazy(async () =>
  import("../../metaverse").then((module) => ({
    default: module.MetaverseStageScreen
  }))
);
const MapEditorStageScreen = lazy(async () =>
  import("../../engine-tool/routes/map-editor-stage-screen").then((module) => ({
    default: module.MapEditorStageScreen
  }))
);
const DuckHuntGameplayStageScreen = lazy(async () =>
  import(
    "../../experiences/duck-hunt/components/duck-hunt-gameplay-stage-screen"
  ).then((module) => ({
    default: module.DuckHuntGameplayStageScreen
  }))
);

interface ShellStageRouterProps {
  readonly activeExperienceId: ExperienceId | null;
  readonly activeMetaverseBundleId: string;
  readonly activeStep: NavigationStepId;
  readonly audioStatusLabel: string;
  readonly bestScore: number;
  readonly capabilityReasonLabel: string;
  readonly capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"];
  readonly calibrationQualityLabel: string;
  readonly coopRoomIdDraft: string;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly gameplayInputSource: GameplayInputSource;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly hasStoredProfile: boolean;
  readonly inputMode: GameplayInputModeId;
  readonly loginError: string | null;
  readonly metaverseControlMode: MetaverseControlModeId;
  readonly nextMetaverseStep: MetaverseEntryStepId | null;
  readonly onCloseToolRequest: () => void;
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
  readonly onOpenToolRequest: () => void;
  readonly onRunToolPreviewRequest: (
    launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot
  ) => void;
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
      <section className="flex flex-1 flex-col justify-end bg-[radial-gradient(circle_at_top,rgb(56_189_248/0.08),transparent_28%),linear-gradient(180deg,rgb(15_23_42/0.06),transparent_32%)] p-6 sm:p-8">
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
  activeMetaverseBundleId,
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
  metaverseControlMode,
  nextMetaverseStep,
  onCloseToolRequest,
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
  onOpenToolRequest,
  onRunToolPreviewRequest,
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
  const metaverseEnvironmentProofConfig = useMemo(
    () =>
      loadMetaverseEnvironmentProofConfig(
        activeMetaverseBundleId,
        metaverseCharacterProofConfig
      ),
    [activeMetaverseBundleId]
  );

  return (
    <section>
      {activeStep === "main-menu" ? (
        <ShellEntryStageScreen
          capabilityStatus={capabilityStatus}
          hasConfirmedProfile={profile !== null}
          hasStoredProfile={hasStoredProfile}
          inputMode={inputMode}
          loginError={loginError}
          onClearProfile={onClearProfile}
          onEditProfile={onEditProfile}
          onEnterMetaverse={onEnterMetaverseRequest}
          onOpenToolRequest={onOpenToolRequest}
          onRequestPermission={onRequestPermission}
          onRecalibrationRequest={onRecalibrationRequest}
          nextMetaverseStep={nextMetaverseStep}
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
        <TrackedHandCalibrationStageScreen
          handTrackingRuntime={handTrackingRuntime}
          onCalibrationProgress={onCalibrationProgress}
          profile={profile}
        />
      ) : null}

      {activeStep === "metaverse" && profile !== null ? (
        <Suspense fallback={<GameplayStageFallback />}>
          <MetaverseStageScreen
            attachmentProofConfig={metaverseAttachmentProofConfig}
            audioStatusLabel={audioStatusLabel}
            bundleId={activeMetaverseBundleId}
            calibrationQualityLabel={calibrationQualityLabel}
            characterProofConfig={metaverseCharacterProofConfig}
            coopRoomIdDraft={coopRoomIdDraft}
            environmentProofConfig={metaverseEnvironmentProofConfig}
            gameplayInputMode={inputMode}
            metaverseControlMode={metaverseControlMode}
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

      {activeStep === "tool" ? (
        <Suspense fallback={<GameplayStageFallback />}>
          <MapEditorStageScreen
            initialBundleId={resolveMetaverseWorldBundleSourceBundleId(
              activeMetaverseBundleId
            )}
            onCloseRequest={onCloseToolRequest}
            onRunPreviewRequest={onRunToolPreviewRequest}
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
