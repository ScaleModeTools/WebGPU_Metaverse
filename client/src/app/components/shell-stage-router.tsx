import { Suspense, lazy } from "react";
import type { FormEvent } from "react";

import type { PlayerProfile } from "@thumbshooter/shared";

import {
  type GameplayDebugPanelMode,
  firstPlayableWeaponDefinition,
  type GameplaySignal
} from "../../game";
import type { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";
import type {
  NavigationStepId,
  WebcamPermissionState
} from "../../navigation";

import { CalibrationStageScreen } from "./calibration-stage-screen";
import { ImmersiveStageFrame } from "./immersive-stage-frame";
import { LoginStageScreen } from "./login-stage-screen";
import { PermissionStageScreen } from "./permission-stage-screen";
import { UnsupportedStageScreen } from "./unsupported-stage-screen";

const GameplayStageScreen = lazy(async () =>
  import("./gameplay-stage-screen").then((module) => ({
    default: module.GameplayStageScreen
  }))
);

interface ShellStageRouterProps {
  readonly activeStep: NavigationStepId;
  readonly audioStatusLabel: string;
  readonly bestScore: number;
  readonly capabilityReasonLabel: string;
  readonly capabilityStatus: WebGpuGameplayCapabilitySnapshot["status"];
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly hasStoredProfile: boolean;
  readonly loginError: string | null;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly selectedReticleLabel: string;
  readonly usernameDraft: string;
  readonly onCalibrationProgress: (
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ) => void;
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onClearProfile: () => void;
  readonly onEditProfile: () => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onOpenGameplayMenu: () => void;
  readonly onRequestPermission: () => void;
  readonly onRetryCapabilityProbe: () => void;
  readonly setUsernameDraft: (value: string) => void;
}

function GameplayStageFallback() {
  return (
    <ImmersiveStageFrame>
      <section className="flex flex-1 flex-col justify-end bg-[radial-gradient(circle_at_top,_rgb(56_189_248_/_0.08),_transparent_28%),linear-gradient(180deg,rgb(15_23_42_/_0.06),transparent_32%)] p-6 sm:p-8">
        <div className="max-w-xl rounded-[1.5rem] border border-border/70 bg-card/72 p-5 backdrop-blur-md">
          <p className="text-sm font-medium text-foreground">
            Booting WebGPU gameplay runtime
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Loading the live renderer and calibrated reticle path for the current
            session.
          </p>
        </div>
      </section>
    </ImmersiveStageFrame>
  );
}

export function ShellStageRouter({
  activeStep,
  audioStatusLabel,
  bestScore,
  capabilityReasonLabel,
  capabilityStatus,
  debugPanelMode,
  handTrackingRuntime,
  hasStoredProfile,
  loginError,
  permissionError,
  permissionState,
  profile,
  selectedReticleLabel,
  usernameDraft,
  onCalibrationProgress,
  onBestScoreChange,
  onClearProfile,
  onEditProfile,
  onGameplaySignal,
  onLoginSubmit,
  onOpenGameplayMenu,
  onRequestPermission,
  onRetryCapabilityProbe,
  setUsernameDraft
}: ShellStageRouterProps) {
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

      {activeStep === "unsupported" ? (
        <UnsupportedStageScreen
          capabilityReasonLabel={capabilityReasonLabel}
          onEditProfile={onEditProfile}
          onRetry={onRetryCapabilityProbe}
        />
      ) : null}

      {activeStep === "gameplay" &&
      profile !== null &&
      profile.snapshot.aimCalibration !== null ? (
        <Suspense fallback={<GameplayStageFallback />}>
          <GameplayStageScreen
            aimCalibration={profile.snapshot.aimCalibration}
            audioStatusLabel={audioStatusLabel}
            bestScore={bestScore}
            debugPanelMode={debugPanelMode}
            handTrackingRuntime={handTrackingRuntime}
            onBestScoreChange={onBestScoreChange}
            onGameplaySignal={onGameplaySignal}
            onOpenMenu={onOpenGameplayMenu}
            selectedReticleLabel={selectedReticleLabel}
            triggerCalibration={profile.snapshot.triggerCalibration}
            username={profile.snapshot.username}
            weaponLabel={firstPlayableWeaponDefinition.displayName}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
