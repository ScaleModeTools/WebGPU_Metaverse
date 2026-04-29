import type {
  MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared";

import type {
  MetaverseLocalHeldWeaponGripDebugHandSocketId,
  MetaverseLocalHeldWeaponAimSourceId,
  MetaverseLocalHeldWeaponAimSourceQualityId,
  MetaverseLocalHeldObjectOffHandTargetKind,
  MetaverseLocalHeldWeaponGripDebugPhase,
  MetaverseLocalHeldWeaponGripDebugSolveFailureReason,
  MetaverseLocalHeldWeaponGripTelemetrySnapshot,
  MetaverseVector3Snapshot
} from "../../types/metaverse-runtime";
import type { HeldObjectPoseProfileId } from "@/assets/types/held-object-authoring-manifest";

const heldWeaponGripWarningErrorMeters = 0.03;
const heldWeaponGripBadErrorMeters = 0.08;
const heldWeaponMainHandWarningErrorMeters = 0.02;
const heldWeaponMainHandBadErrorMeters = 0.05;
const heldWeaponMainHandReachClampReasonToleranceMeters = 0.01;

interface MetaverseHeldWeaponGripBaseRecord {
  readonly adsBlend: number | null;
  readonly adsAnchorPoseActive?: boolean;
  readonly aimSource?: MetaverseLocalHeldWeaponAimSourceId | null;
  readonly aimSourceQuality?: MetaverseLocalHeldWeaponAimSourceQualityId | null;
  readonly attachmentMountKind: "held" | "mounted-holster" | null;
  readonly deprecatedAimPoseActive?: boolean;
  readonly secondaryGripContactAvailable: boolean;
  readonly heldMountSocketName: string | null;
  readonly legacyFullBodyAimFallbackActive?: boolean;
  readonly legacyPistolShootOverlayActive?: boolean;
  readonly legacyUpperBodyAimOverlayActive?: boolean;
  readonly offHandGripAnchorAvailable: boolean;
  readonly offHandTargetKind?: MetaverseLocalHeldObjectOffHandTargetKind;
  readonly poseProfileId?: HeldObjectPoseProfileId | null;
  readonly supportPalmHintActive?: boolean;
  readonly weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
}

interface MetaverseHeldWeaponGripSkippedRecord
  extends MetaverseHeldWeaponGripBaseRecord {
  readonly phase: Exclude<
    MetaverseLocalHeldWeaponGripDebugPhase,
    "grip-target-solve-failed" | "no-offhand-grip-mount" | "solved"
  >;
}

interface MetaverseHeldWeaponGripSolveFailureRecord
  extends MetaverseHeldWeaponGripBaseRecord {
  readonly failureReason: MetaverseLocalHeldWeaponGripDebugSolveFailureReason;
}

interface MetaverseHeldWeaponGripSolvedRecord
  extends MetaverseHeldWeaponGripBaseRecord {
  readonly actualWeaponForwardWorld: MetaverseVector3Snapshot | null;
  readonly adsAnchorPositionErrorMeters: number | null;
  readonly adsAppliedGripDeltaMeters: number | null;
  readonly adsGripDeltaClamped: boolean;
  readonly adsPositionalWeight: number | null;
  readonly desiredWeaponForwardWorld: MetaverseVector3Snapshot | null;
  readonly mainHandAngularErrorRadians: number | null;
  readonly mainHandContactFrameId: MetaverseLocalHeldWeaponGripTelemetrySnapshot["mainHandContactFrameId"];
  readonly mainHandGripErrorMeters: number;
  readonly mainHandGripSocketComparisonErrorMeters: number;
  readonly mainHandMaxReachMeters: number | null;
  readonly mainHandPalmSocketComparisonErrorMeters: number;
  readonly mainHandPoleAngleRadians: number | null;
  readonly mainHandPostPoleBiasErrorMeters: number | null;
  readonly mainHandReachClampDeltaMeters: number | null;
  readonly mainHandReachSlackMeters: number;
  readonly mainHandSolveErrorMeters: number | null;
  readonly mainHandSocket: Exclude<
    MetaverseLocalHeldWeaponGripDebugHandSocketId,
    "none" | "support"
  >;
  readonly mainHandTargetDistanceMeters: number | null;
  readonly mainHandWeaponSocketRole: MetaverseLocalHeldWeaponGripTelemetrySnapshot["mainHandWeaponSocketRole"];
  readonly mainHandWristCorrectionRadians: number | null;
  readonly muzzleAimAngularErrorRadians: number | null;
  readonly offHandAngularErrorRadians: number | null;
  readonly offHandContactFrameId: MetaverseLocalHeldWeaponGripTelemetrySnapshot["offHandContactFrameId"];
  readonly offHandFinalErrorMeters: number | null;
  readonly offHandGripMounted: boolean;
  readonly offHandInitialSolveErrorMeters: number | null;
  readonly offHandPoleAngleRadians: number | null;
  readonly offHandPreSolveErrorMeters: number | null;
  readonly offHandRefinementPassCount: number;
  readonly offHandSocket: Exclude<
    MetaverseLocalHeldWeaponGripDebugHandSocketId,
    "none"
  >;
  readonly adsAnchorPoseActive: boolean;
  readonly offHandTargetKind: MetaverseLocalHeldObjectOffHandTargetKind;
  readonly offHandWeaponSocketRole: MetaverseLocalHeldWeaponGripTelemetrySnapshot["offHandWeaponSocketRole"];
  readonly offHandWristCorrectionRadians: number | null;
  readonly poseProfileId: HeldObjectPoseProfileId | null;
  readonly supportPalmFade: number | null;
  readonly supportPalmHintActive: boolean;
}

function resolveAttachmentMountKind(
  attachmentMountKind: MetaverseHeldWeaponGripBaseRecord["attachmentMountKind"]
): MetaverseLocalHeldWeaponGripTelemetrySnapshot["attachmentMountKind"] {
  return attachmentMountKind ?? "none";
}

function copyVector3Snapshot(
  snapshot: MetaverseVector3Snapshot | null
): MetaverseVector3Snapshot | null {
  if (snapshot === null) {
    return null;
  }

  return Object.freeze({
    x: snapshot.x,
    y: snapshot.y,
    z: snapshot.z
  });
}

export class MetaverseSceneHeldWeaponGripDebugState {
  #adsBlend: number | null = null;
  #adsAnchorPoseActive = false;
  #adsAnchorPositionErrorMeters: number | null = null;
  #adsAppliedGripDeltaMeters: number | null = null;
  #adsGripDeltaClamped = false;
  #adsPositionalWeight: number | null = null;
  #aimMode: MetaverseLocalHeldWeaponGripTelemetrySnapshot["aimMode"] = null;
  #aimSource: MetaverseLocalHeldWeaponAimSourceId | null = null;
  #aimSourceQuality: MetaverseLocalHeldWeaponAimSourceQualityId | null = null;
  #attachmentMountKind:
    MetaverseHeldWeaponGripBaseRecord["attachmentMountKind"] = null;
  #actualWeaponForwardWorld: MetaverseVector3Snapshot | null = null;
  #degradedFrameCount = 0;
  #deprecatedAimPoseActive = false;
  #desiredWeaponForwardWorld: MetaverseVector3Snapshot | null = null;
  #gripTargetSolveFailureReason:
    MetaverseLocalHeldWeaponGripTelemetrySnapshot["gripTargetSolveFailureReason"] =
      null;
  #secondaryGripContactAvailable = false;
  #heldMountSocketName: string | null = null;
  #lastDegradedAtMs: number | null = null;
  #lastDegradedReason: string | null = null;
  #mainHandGripErrorMeters: number | null = null;
  #mainHandGripSocketComparisonErrorMeters: number | null = null;
  #mainHandAngularErrorRadians: number | null = null;
  #mainHandContactFrameId: MetaverseLocalHeldWeaponGripTelemetrySnapshot["mainHandContactFrameId"] =
    null;
  #mainHandMaxReachMeters: number | null = null;
  #mainHandPalmSocketComparisonErrorMeters: number | null = null;
  #mainHandPoleAngleRadians: number | null = null;
  #mainHandPostPoleBiasErrorMeters: number | null = null;
  #mainHandReachClampDeltaMeters: number | null = null;
  #mainHandReachSlackMeters: number | null = null;
  #mainHandSolveErrorMeters: number | null = null;
  #mainHandSocket: MetaverseLocalHeldWeaponGripTelemetrySnapshot["mainHandSocket"] =
    "none";
  #mainHandTargetDistanceMeters: number | null = null;
  #mainHandWeaponSocketRole: MetaverseLocalHeldWeaponGripTelemetrySnapshot["mainHandWeaponSocketRole"] =
    null;
  #mainHandWristCorrectionRadians: number | null = null;
  #legacyFullBodyAimFallbackActive = false;
  #legacyPistolShootOverlayActive = false;
  #legacyUpperBodyAimOverlayActive = false;
  #muzzleAimAngularErrorRadians: number | null = null;
  #offHandAngularErrorRadians: number | null = null;
  #offHandContactFrameId: MetaverseLocalHeldWeaponGripTelemetrySnapshot["offHandContactFrameId"] =
    null;
  #offHandFinalErrorMeters: number | null = null;
  #offHandGripMounted = false;
  #offHandInitialSolveErrorMeters: number | null = null;
  #offHandPoleAngleRadians: number | null = null;
  #offHandPreSolveErrorMeters: number | null = null;
  #offHandRefinementPassCount = 0;
  #offHandSocket: MetaverseLocalHeldWeaponGripTelemetrySnapshot["offHandSocket"] =
    "none";
  #offHandGripAnchorAvailable = false;
  #offHandTargetKind: MetaverseLocalHeldWeaponGripTelemetrySnapshot["offHandTargetKind"] =
    "none";
  #offHandWeaponSocketRole: MetaverseLocalHeldWeaponGripTelemetrySnapshot["offHandWeaponSocketRole"] =
    null;
  #offHandWristCorrectionRadians: number | null = null;
  #phase: MetaverseLocalHeldWeaponGripTelemetrySnapshot["phase"] =
    "no-character-runtime";
  #poseProfileId: MetaverseLocalHeldWeaponGripTelemetrySnapshot["poseProfileId"] =
    null;
  #stability: MetaverseLocalHeldWeaponGripTelemetrySnapshot["stability"] =
    "inactive";
  #supportPalmFade: number | null = null;
  #supportPalmHintActive = false;
  #weaponId: string | null = null;
  #weaponStatePresent = false;
  #worstMainHandGripErrorMeters = 0;
  #worstOffHandFinalErrorMeters = 0;

  reset(): void {
    this.#adsBlend = null;
    this.#adsAnchorPoseActive = false;
    this.#adsAnchorPositionErrorMeters = null;
    this.#adsAppliedGripDeltaMeters = null;
    this.#adsGripDeltaClamped = false;
    this.#adsPositionalWeight = null;
    this.#aimMode = null;
    this.#aimSource = null;
    this.#aimSourceQuality = null;
    this.#attachmentMountKind = null;
    this.#actualWeaponForwardWorld = null;
    this.#degradedFrameCount = 0;
    this.#deprecatedAimPoseActive = false;
    this.#desiredWeaponForwardWorld = null;
    this.#gripTargetSolveFailureReason = null;
    this.#secondaryGripContactAvailable = false;
    this.#heldMountSocketName = null;
    this.#lastDegradedAtMs = null;
    this.#lastDegradedReason = null;
    this.#mainHandGripErrorMeters = null;
    this.#mainHandGripSocketComparisonErrorMeters = null;
    this.#mainHandAngularErrorRadians = null;
    this.#mainHandContactFrameId = null;
    this.#mainHandMaxReachMeters = null;
    this.#mainHandPalmSocketComparisonErrorMeters = null;
    this.#mainHandPoleAngleRadians = null;
    this.#mainHandPostPoleBiasErrorMeters = null;
    this.#mainHandReachClampDeltaMeters = null;
    this.#mainHandReachSlackMeters = null;
    this.#mainHandSolveErrorMeters = null;
    this.#mainHandSocket = "none";
    this.#mainHandTargetDistanceMeters = null;
    this.#mainHandWeaponSocketRole = null;
    this.#mainHandWristCorrectionRadians = null;
    this.#legacyFullBodyAimFallbackActive = false;
    this.#legacyPistolShootOverlayActive = false;
    this.#legacyUpperBodyAimOverlayActive = false;
    this.#muzzleAimAngularErrorRadians = null;
    this.#offHandAngularErrorRadians = null;
    this.#offHandContactFrameId = null;
    this.#offHandFinalErrorMeters = null;
    this.#offHandGripMounted = false;
    this.#offHandInitialSolveErrorMeters = null;
    this.#offHandPoleAngleRadians = null;
    this.#offHandPreSolveErrorMeters = null;
    this.#offHandRefinementPassCount = 0;
    this.#offHandSocket = "none";
    this.#offHandGripAnchorAvailable = false;
    this.#offHandTargetKind = "none";
    this.#offHandWeaponSocketRole = null;
    this.#offHandWristCorrectionRadians = null;
    this.#phase = "no-character-runtime";
    this.#poseProfileId = null;
    this.#stability = "inactive";
    this.#supportPalmFade = null;
    this.#supportPalmHintActive = false;
    this.#weaponId = null;
    this.#weaponStatePresent = false;
    this.#worstMainHandGripErrorMeters = 0;
    this.#worstOffHandFinalErrorMeters = 0;
  }

  recordSkippedFrame(
    input: MetaverseHeldWeaponGripSkippedRecord,
    nowMs: number = this.#readNowMs()
  ): void {
    this.#syncBaseFrame(input);
    this.#gripTargetSolveFailureReason = null;
    this.#adsAnchorPositionErrorMeters = null;
    this.#adsAppliedGripDeltaMeters = null;
    this.#adsGripDeltaClamped = false;
    this.#adsPositionalWeight = null;
    this.#mainHandGripErrorMeters = null;
    this.#mainHandGripSocketComparisonErrorMeters = null;
    this.#mainHandAngularErrorRadians = null;
    this.#mainHandContactFrameId = null;
    this.#mainHandMaxReachMeters = null;
    this.#mainHandPalmSocketComparisonErrorMeters = null;
    this.#mainHandPoleAngleRadians = null;
    this.#mainHandPostPoleBiasErrorMeters = null;
    this.#mainHandReachClampDeltaMeters = null;
    this.#mainHandReachSlackMeters = null;
    this.#mainHandSolveErrorMeters = null;
    this.#mainHandSocket = "none";
    this.#mainHandTargetDistanceMeters = null;
    this.#mainHandWeaponSocketRole = null;
    this.#mainHandWristCorrectionRadians = null;
    this.#actualWeaponForwardWorld = null;
    this.#desiredWeaponForwardWorld = null;
    this.#muzzleAimAngularErrorRadians = null;
    this.#offHandAngularErrorRadians = null;
    this.#offHandContactFrameId = null;
    this.#offHandFinalErrorMeters = null;
    this.#offHandGripMounted = false;
    this.#offHandInitialSolveErrorMeters = null;
    this.#offHandPoleAngleRadians = null;
    this.#offHandPreSolveErrorMeters = null;
    this.#offHandRefinementPassCount = 0;
    this.#offHandSocket = "none";
    this.#offHandWeaponSocketRole = null;
    this.#offHandWristCorrectionRadians = null;
    this.#phase = input.phase;
    this.#adsAnchorPoseActive = false;
    this.#supportPalmFade = null;
    this.#supportPalmHintActive = false;

    if (input.phase === "attachment-not-held" && input.weaponState !== null) {
      this.#stability = "warning";
      this.#recordDegradedFrame(nowMs, "attachment-not-held");
      return;
    }

    this.#stability = "inactive";
  }

  recordGripTargetSolveFailure(
    input: MetaverseHeldWeaponGripSolveFailureRecord,
    nowMs: number = this.#readNowMs()
  ): void {
    this.#syncBaseFrame(input);
    this.#gripTargetSolveFailureReason = input.failureReason;
    this.#adsAnchorPositionErrorMeters = null;
    this.#adsAppliedGripDeltaMeters = null;
    this.#adsGripDeltaClamped = false;
    this.#adsPositionalWeight = null;
    this.#mainHandGripErrorMeters = null;
    this.#mainHandGripSocketComparisonErrorMeters = null;
    this.#mainHandAngularErrorRadians = null;
    this.#mainHandContactFrameId = null;
    this.#mainHandMaxReachMeters = null;
    this.#mainHandPalmSocketComparisonErrorMeters = null;
    this.#mainHandPoleAngleRadians = null;
    this.#mainHandPostPoleBiasErrorMeters = null;
    this.#mainHandReachClampDeltaMeters = null;
    this.#mainHandReachSlackMeters = null;
    this.#mainHandSolveErrorMeters = null;
    this.#mainHandSocket = "none";
    this.#mainHandTargetDistanceMeters = null;
    this.#mainHandWeaponSocketRole = null;
    this.#mainHandWristCorrectionRadians = null;
    this.#actualWeaponForwardWorld = null;
    this.#desiredWeaponForwardWorld = null;
    this.#muzzleAimAngularErrorRadians = null;
    this.#offHandAngularErrorRadians = null;
    this.#offHandContactFrameId = null;
    this.#offHandFinalErrorMeters = null;
    this.#offHandGripMounted = false;
    this.#offHandInitialSolveErrorMeters = null;
    this.#offHandPoleAngleRadians = null;
    this.#offHandPreSolveErrorMeters = null;
    this.#offHandRefinementPassCount = 0;
    this.#offHandSocket = "none";
    this.#offHandWeaponSocketRole = null;
    this.#offHandWristCorrectionRadians = null;
    this.#phase = "grip-target-solve-failed";
    this.#adsAnchorPoseActive = false;
    this.#supportPalmFade = null;
    this.#supportPalmHintActive = false;
    this.#stability = "bad";
    this.#recordDegradedFrame(nowMs, input.failureReason);
  }

  recordSolvedFrame(
    input: MetaverseHeldWeaponGripSolvedRecord,
    nowMs: number = this.#readNowMs()
  ): void {
    this.#syncBaseFrame(input);
    this.#gripTargetSolveFailureReason = null;
    this.#actualWeaponForwardWorld = copyVector3Snapshot(
      input.actualWeaponForwardWorld
    );
    this.#adsAnchorPositionErrorMeters = input.adsAnchorPositionErrorMeters;
    this.#adsAppliedGripDeltaMeters = input.adsAppliedGripDeltaMeters;
    this.#adsGripDeltaClamped = input.adsGripDeltaClamped;
    this.#adsPositionalWeight = input.adsPositionalWeight;
    this.#desiredWeaponForwardWorld = copyVector3Snapshot(
      input.desiredWeaponForwardWorld
    );
    this.#mainHandAngularErrorRadians = input.mainHandAngularErrorRadians;
    this.#mainHandContactFrameId = input.mainHandContactFrameId;
    this.#mainHandGripErrorMeters = input.mainHandGripErrorMeters;
    this.#mainHandGripSocketComparisonErrorMeters =
      input.mainHandGripSocketComparisonErrorMeters;
    this.#mainHandMaxReachMeters = input.mainHandMaxReachMeters;
    this.#mainHandPalmSocketComparisonErrorMeters =
      input.mainHandPalmSocketComparisonErrorMeters;
    this.#mainHandPoleAngleRadians = input.mainHandPoleAngleRadians;
    this.#mainHandPostPoleBiasErrorMeters =
      input.mainHandPostPoleBiasErrorMeters;
    this.#mainHandReachClampDeltaMeters = input.mainHandReachClampDeltaMeters;
    this.#mainHandReachSlackMeters = input.mainHandReachSlackMeters;
    this.#mainHandSolveErrorMeters = input.mainHandSolveErrorMeters;
    this.#mainHandSocket = input.mainHandSocket;
    this.#mainHandTargetDistanceMeters = input.mainHandTargetDistanceMeters;
    this.#mainHandWeaponSocketRole = input.mainHandWeaponSocketRole;
    this.#mainHandWristCorrectionRadians = input.mainHandWristCorrectionRadians;
    this.#muzzleAimAngularErrorRadians = input.muzzleAimAngularErrorRadians;
    this.#offHandAngularErrorRadians = input.offHandAngularErrorRadians;
    this.#offHandContactFrameId = input.offHandContactFrameId;
    this.#offHandFinalErrorMeters = input.offHandFinalErrorMeters;
    this.#offHandGripMounted = input.offHandGripMounted;
    this.#offHandInitialSolveErrorMeters = input.offHandInitialSolveErrorMeters;
    this.#offHandPoleAngleRadians = input.offHandPoleAngleRadians;
    this.#offHandPreSolveErrorMeters = input.offHandPreSolveErrorMeters;
    this.#offHandRefinementPassCount = input.offHandRefinementPassCount;
    this.#offHandSocket = input.offHandSocket;
    this.#phase = input.offHandGripMounted ? "solved" : "no-offhand-grip-mount";
    this.#adsAnchorPoseActive = input.adsAnchorPoseActive;
    this.#offHandTargetKind = input.offHandTargetKind;
    this.#offHandWeaponSocketRole = input.offHandWeaponSocketRole;
    this.#offHandWristCorrectionRadians = input.offHandWristCorrectionRadians;
    this.#poseProfileId = input.poseProfileId;
    this.#supportPalmFade = input.supportPalmFade;
    this.#supportPalmHintActive = input.supportPalmHintActive;
    this.#worstMainHandGripErrorMeters = Math.max(
      this.#worstMainHandGripErrorMeters,
      input.mainHandGripErrorMeters
    );
    this.#worstOffHandFinalErrorMeters = Math.max(
      this.#worstOffHandFinalErrorMeters,
      input.offHandFinalErrorMeters ?? 0
    );

    const degradationReason = this.#resolveDegradationReason(input);

    if (degradationReason === null) {
      this.#stability = "stable";
      return;
    }

    this.#stability =
      input.mainHandGripErrorMeters >= heldWeaponMainHandBadErrorMeters ||
      (input.offHandFinalErrorMeters ?? 0) >= heldWeaponGripBadErrorMeters ||
      degradationReason === "weapon-state-null"
        ? "bad"
        : "warning";
    this.#recordDegradedFrame(nowMs, degradationReason);
  }

  readSnapshot(nowMs: number): MetaverseLocalHeldWeaponGripTelemetrySnapshot {
    return Object.freeze({
      adsBlend: this.#adsBlend,
      adsAnchorPoseActive: this.#adsAnchorPoseActive,
      adsAnchorPositionErrorMeters: this.#adsAnchorPositionErrorMeters,
      adsAppliedGripDeltaMeters: this.#adsAppliedGripDeltaMeters,
      adsGripDeltaClamped: this.#adsGripDeltaClamped,
      adsPositionalWeight: this.#adsPositionalWeight,
      aimMode: this.#aimMode,
      aimSource: this.#aimSource,
      aimSourceQuality: this.#aimSourceQuality,
      attachmentMountKind: resolveAttachmentMountKind(this.#attachmentMountKind),
      actualWeaponForwardWorld: this.#actualWeaponForwardWorld,
      degradedFrameCount: this.#degradedFrameCount,
      deprecatedAimPoseActive: this.#deprecatedAimPoseActive,
      desiredWeaponForwardWorld: this.#desiredWeaponForwardWorld,
      gripTargetSolveFailureReason: this.#gripTargetSolveFailureReason,
      secondaryGripContactAvailable: this.#secondaryGripContactAvailable,
      heldMountSocketName: this.#heldMountSocketName,
      lastDegradedAgeMs:
        this.#lastDegradedAtMs === null ? null : Math.max(0, nowMs - this.#lastDegradedAtMs),
      lastDegradedReason: this.#lastDegradedReason,
      mainHandGripErrorMeters: this.#mainHandGripErrorMeters,
      mainHandGripSocketComparisonErrorMeters:
        this.#mainHandGripSocketComparisonErrorMeters,
      mainHandAngularErrorRadians: this.#mainHandAngularErrorRadians,
      mainHandContactFrameId: this.#mainHandContactFrameId,
      mainHandMaxReachMeters: this.#mainHandMaxReachMeters,
      mainHandPalmSocketComparisonErrorMeters:
        this.#mainHandPalmSocketComparisonErrorMeters,
      mainHandPoleAngleRadians: this.#mainHandPoleAngleRadians,
      mainHandPostPoleBiasErrorMeters: this.#mainHandPostPoleBiasErrorMeters,
      mainHandReachClampDeltaMeters: this.#mainHandReachClampDeltaMeters,
      mainHandReachSlackMeters: this.#mainHandReachSlackMeters,
      mainHandSolveErrorMeters: this.#mainHandSolveErrorMeters,
      mainHandSocket: this.#mainHandSocket,
      mainHandTargetDistanceMeters: this.#mainHandTargetDistanceMeters,
      mainHandWeaponSocketRole: this.#mainHandWeaponSocketRole,
      mainHandWristCorrectionRadians: this.#mainHandWristCorrectionRadians,
      legacyFullBodyAimFallbackActive: this.#legacyFullBodyAimFallbackActive,
      legacyPistolShootOverlayActive: this.#legacyPistolShootOverlayActive,
      legacyUpperBodyAimOverlayActive: this.#legacyUpperBodyAimOverlayActive,
      muzzleAimAngularErrorRadians: this.#muzzleAimAngularErrorRadians,
      offHandAngularErrorRadians: this.#offHandAngularErrorRadians,
      offHandContactFrameId: this.#offHandContactFrameId,
      offHandFinalErrorMeters: this.#offHandFinalErrorMeters,
      offHandGripMounted: this.#offHandGripMounted,
      offHandInitialSolveErrorMeters: this.#offHandInitialSolveErrorMeters,
      offHandPoleAngleRadians: this.#offHandPoleAngleRadians,
      offHandPreSolveErrorMeters: this.#offHandPreSolveErrorMeters,
      offHandRefinementPassCount: this.#offHandRefinementPassCount,
      offHandSocket: this.#offHandSocket,
      offHandGripAnchorAvailable: this.#offHandGripAnchorAvailable,
      offHandTargetKind: this.#offHandTargetKind,
      offHandWeaponSocketRole: this.#offHandWeaponSocketRole,
      offHandWristCorrectionRadians: this.#offHandWristCorrectionRadians,
      phase: this.#phase,
      poseProfileId: this.#poseProfileId,
      stability: this.#stability,
      supportPalmFade: this.#supportPalmFade,
      supportPalmHintActive: this.#supportPalmHintActive,
      weaponId: this.#weaponId,
      weaponStatePresent: this.#weaponStatePresent,
      worstMainHandGripErrorMeters: this.#worstMainHandGripErrorMeters,
      worstOffHandFinalErrorMeters: this.#worstOffHandFinalErrorMeters
    });
  }

  #syncBaseFrame(input: MetaverseHeldWeaponGripBaseRecord): void {
    this.#adsBlend = input.adsBlend;
    this.#adsAnchorPoseActive = input.adsAnchorPoseActive ?? false;
    this.#aimMode = input.weaponState?.aimMode ?? null;
    this.#aimSource = input.aimSource ?? null;
    this.#aimSourceQuality = input.aimSourceQuality ?? null;
    this.#attachmentMountKind = input.attachmentMountKind;
    this.#deprecatedAimPoseActive = input.deprecatedAimPoseActive ?? false;
    this.#secondaryGripContactAvailable = input.secondaryGripContactAvailable;
    this.#heldMountSocketName = input.heldMountSocketName;
    this.#legacyFullBodyAimFallbackActive =
      input.legacyFullBodyAimFallbackActive ?? false;
    this.#legacyPistolShootOverlayActive =
      input.legacyPistolShootOverlayActive ?? false;
    this.#legacyUpperBodyAimOverlayActive =
      input.legacyUpperBodyAimOverlayActive ?? false;
    this.#offHandGripAnchorAvailable = input.offHandGripAnchorAvailable;
    this.#offHandTargetKind = input.offHandTargetKind ?? "none";
    this.#poseProfileId = input.poseProfileId ?? null;
    this.#supportPalmHintActive = input.supportPalmHintActive ?? false;
    this.#weaponId = input.weaponState?.weaponId ?? null;
    this.#weaponStatePresent = input.weaponState !== null;
  }

  #recordDegradedFrame(nowMs: number, reason: string): void {
    this.#degradedFrameCount += 1;
    this.#lastDegradedAtMs = nowMs;
    this.#lastDegradedReason = reason;
  }

  #resolveDegradationReason(
    input: MetaverseHeldWeaponGripSolvedRecord
  ): string | null {
    if (input.weaponState === null && input.secondaryGripContactAvailable) {
      return "weapon-state-null";
    }

    if (
      input.mainHandGripErrorMeters >= heldWeaponMainHandWarningErrorMeters &&
      input.mainHandReachClampDeltaMeters !== null &&
      input.mainHandReachClampDeltaMeters >=
        heldWeaponMainHandWarningErrorMeters &&
      Math.abs(
        input.mainHandGripErrorMeters - input.mainHandReachClampDeltaMeters
      ) <= heldWeaponMainHandReachClampReasonToleranceMeters
    ) {
      return "main-hand-reach-clamped";
    }

    if (input.mainHandGripErrorMeters >= heldWeaponMainHandBadErrorMeters) {
      return "main-hand-error-bad";
    }

    if (input.mainHandGripErrorMeters >= heldWeaponMainHandWarningErrorMeters) {
      return "main-hand-error-warning";
    }

    if (
      input.offHandFinalErrorMeters !== null &&
      input.offHandFinalErrorMeters >= heldWeaponGripBadErrorMeters
    ) {
      return "off-hand-error-bad";
    }

    if (
      input.offHandFinalErrorMeters !== null &&
      input.offHandFinalErrorMeters >= heldWeaponGripWarningErrorMeters
    ) {
      return "off-hand-error-warning";
    }

    if (!input.offHandGripMounted && input.secondaryGripContactAvailable) {
      return "off-hand-grip-mount-missing";
    }

    return null;
  }

  #readNowMs(): number {
    return globalThis.performance?.now() ?? Date.now();
  }
}
