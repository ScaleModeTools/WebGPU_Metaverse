import type {
  HeldObjectHoldProfileDescriptor,
  HeldObjectOffhandPolicyId,
  HeldObjectPoseProfileId,
  HeldObjectSocketRoleId
} from "@/assets/types/held-object-authoring-manifest";
import type { MetaverseLocalHeldObjectContactFrameId } from "../../types/metaverse-runtime";

export const metaverseHeldObjectSolverHandIds = ["left", "right"] as const;

export type MetaverseHeldObjectSolverHandId =
  (typeof metaverseHeldObjectSolverHandIds)[number];

export const metaverseHeldObjectFingerPoseIds = [
  "relaxed_open",
  "pistol_grip_trigger_index",
  "support_palm_optional",
  "long_gun_trigger_grip",
  "foregrip_support",
  "heavy_trigger_grip",
  "support_handle_grip"
] as const;

export type MetaverseHeldObjectFingerPoseId =
  (typeof metaverseHeldObjectFingerPoseIds)[number];

export interface MetaverseHeldObjectSolverAimWeights {
  readonly headPitch: number;
  readonly neckPitch: number;
  readonly pelvisYaw: number;
  readonly primaryArm: number;
  readonly primaryClavicle: number;
  readonly secondaryArm: number;
  readonly secondaryClavicle: number;
  readonly spine01Pitch: number;
  readonly spine02Pitch: number;
  readonly spine03Pitch: number;
  readonly wristCorrection: number;
}

export interface MetaverseHeldObjectSolverLimits {
  readonly maxHeadPitchDeg: number;
  readonly maxPitchDeg: number;
  readonly maxSpineYawDeg: number;
  readonly maxWristCorrectionDeg: number;
  readonly minPitchDeg: number;
}

export interface MetaverseHeldObjectSolverFingerPoseProfile {
  readonly primary: MetaverseHeldObjectFingerPoseId;
  readonly secondary: MetaverseHeldObjectFingerPoseId | null;
}

export type MetaverseHeldObjectSolverContactStrength = "hard" | "soft";

export interface MetaverseHeldObjectSolverContactBinding {
  readonly contactFrameId: MetaverseLocalHeldObjectContactFrameId;
  readonly strength: MetaverseHeldObjectSolverContactStrength;
  readonly weaponSocketRole: Extract<
    HeldObjectSocketRoleId,
    "grip.primary" | "grip.secondary"
  >;
}

export interface MetaverseHeldObjectSolverContactBindings {
  readonly primary: MetaverseHeldObjectSolverContactBinding;
  readonly secondary: MetaverseHeldObjectSolverContactBinding | null;
}

export interface MetaverseHeldObjectSolverAdsCalibration {
  readonly adsAnchorPositionalWeight: number;
  readonly maxAdsGripTargetDeltaMeters: number;
  readonly supportPalmFadeEndPitchRadians: number | null;
  readonly supportPalmFadeStartPitchRadians: number | null;
}

export type MetaverseHeldObjectUpperLimbOwnership =
  | "action_dominant"
  | "hard_ik"
  | "sampled_plus_ik";

export interface MetaverseHeldObjectSolverSampledInfluence {
  readonly claviclePrimary: number;
  readonly clavicleSecondary: number;
  readonly fingers: number;
  readonly handPrimary: number;
  readonly handSecondary: number;
  readonly lowerArmPrimary: number;
  readonly lowerArmSecondary: number;
  readonly upperArmPrimary: number;
  readonly upperArmSecondary: number;
}

export interface MetaverseHeldObjectSolverProfile {
  readonly adsCalibration: MetaverseHeldObjectSolverAdsCalibration;
  readonly aimWeights: MetaverseHeldObjectSolverAimWeights;
  readonly contactBindings: MetaverseHeldObjectSolverContactBindings;
  readonly fingerPose: MetaverseHeldObjectSolverFingerPoseProfile;
  readonly limits: MetaverseHeldObjectSolverLimits;
  readonly offhandPolicy: HeldObjectOffhandPolicyId;
  readonly poseProfileId: HeldObjectPoseProfileId;
  readonly primaryHand: MetaverseHeldObjectSolverHandId;
  readonly sampledInfluence: MetaverseHeldObjectSolverSampledInfluence;
  readonly upperLimbOwnership: MetaverseHeldObjectUpperLimbOwnership;
}

const hardIkSampledInfluence = Object.freeze({
  claviclePrimary: 0,
  clavicleSecondary: 0,
  fingers: 0,
  handPrimary: 0,
  handSecondary: 0,
  lowerArmPrimary: 0,
  lowerArmSecondary: 0,
  upperArmPrimary: 0,
  upperArmSecondary: 0
} as const satisfies MetaverseHeldObjectSolverSampledInfluence);

const metaverseHeldObjectSolverProfiles = Object.freeze([
  Object.freeze({
    adsCalibration: Object.freeze({
      adsAnchorPositionalWeight: 0.45,
      maxAdsGripTargetDeltaMeters: 0.16,
      supportPalmFadeEndPitchRadians: null,
      supportPalmFadeStartPitchRadians: null
    }),
    aimWeights: Object.freeze({
      headPitch: 0,
      neckPitch: 0,
      pelvisYaw: 0,
      primaryArm: 1,
      primaryClavicle: 0.55,
      secondaryArm: 0.68,
      secondaryClavicle: 0.35,
      spine01Pitch: 0,
      spine02Pitch: 0.08,
      spine03Pitch: 0.18,
      wristCorrection: 1
    }),
    contactBindings: Object.freeze({
      primary: Object.freeze({
        contactFrameId: "primary_trigger_grip",
        strength: "hard",
        weaponSocketRole: "grip.primary"
      }),
      secondary: Object.freeze({
        contactFrameId: "support_palm",
        strength: "soft",
        weaponSocketRole: "grip.secondary"
      })
    }),
    fingerPose: Object.freeze({
      primary: "pistol_grip_trigger_index",
      secondary: "support_palm_optional"
    }),
    limits: Object.freeze({
      maxHeadPitchDeg: 0,
      maxPitchDeg: 70,
      maxSpineYawDeg: 10,
      maxWristCorrectionDeg: 55,
      minPitchDeg: -65
    }),
    offhandPolicy: "optional_support_palm",
    poseProfileId: "sidearm.one_hand_optional_support",
    primaryHand: "right",
    sampledInfluence: hardIkSampledInfluence,
    upperLimbOwnership: "hard_ik"
  }),
  Object.freeze({
    adsCalibration: Object.freeze({
      adsAnchorPositionalWeight: 0.4,
      maxAdsGripTargetDeltaMeters: 0.14,
      supportPalmFadeEndPitchRadians: null,
      supportPalmFadeStartPitchRadians: null
    }),
    aimWeights: Object.freeze({
      headPitch: 0,
      neckPitch: 0,
      pelvisYaw: 0,
      primaryArm: 1,
      primaryClavicle: 0.66,
      secondaryArm: 0.92,
      secondaryClavicle: 0.62,
      spine01Pitch: 0,
      spine02Pitch: 0.12,
      spine03Pitch: 0.26,
      wristCorrection: 0.9
    }),
    contactBindings: Object.freeze({
      primary: Object.freeze({
        contactFrameId: "primary_trigger_grip",
        strength: "hard",
        weaponSocketRole: "grip.primary"
      }),
      secondary: Object.freeze({
        contactFrameId: "barrel_cradle",
        strength: "hard",
        weaponSocketRole: "grip.secondary"
      })
    }),
    fingerPose: Object.freeze({
      primary: "long_gun_trigger_grip",
      secondary: "relaxed_open"
    }),
    limits: Object.freeze({
      maxHeadPitchDeg: 0,
      maxPitchDeg: 62,
      maxSpineYawDeg: 9,
      maxWristCorrectionDeg: 48,
      minPitchDeg: -52
    }),
    offhandPolicy: "required_support_grip",
    poseProfileId: "long_gun.two_hand_shoulder",
    primaryHand: "right",
    sampledInfluence: hardIkSampledInfluence,
    upperLimbOwnership: "hard_ik"
  }),
  Object.freeze({
    adsCalibration: Object.freeze({
      adsAnchorPositionalWeight: 0.35,
      maxAdsGripTargetDeltaMeters: 0.16,
      supportPalmFadeEndPitchRadians: null,
      supportPalmFadeStartPitchRadians: null
    }),
    aimWeights: Object.freeze({
      headPitch: 0,
      neckPitch: 0,
      pelvisYaw: 0,
      primaryArm: 1,
      primaryClavicle: 0.72,
      secondaryArm: 1,
      secondaryClavicle: 0.72,
      spine01Pitch: 0,
      spine02Pitch: 0.16,
      spine03Pitch: 0.3,
      wristCorrection: 0.85
    }),
    contactBindings: Object.freeze({
      primary: Object.freeze({
        contactFrameId: "heavy_trigger_grip",
        strength: "hard",
        weaponSocketRole: "grip.primary"
      }),
      secondary: Object.freeze({
        contactFrameId: "support_handle_grip",
        strength: "hard",
        weaponSocketRole: "grip.secondary"
      })
    }),
    fingerPose: Object.freeze({
      primary: "heavy_trigger_grip",
      secondary: "support_handle_grip"
    }),
    limits: Object.freeze({
      maxHeadPitchDeg: 0,
      maxPitchDeg: 55,
      maxSpineYawDeg: 8,
      maxWristCorrectionDeg: 42,
      minPitchDeg: -45
    }),
    offhandPolicy: "required_support_grip",
    poseProfileId: "shoulder_heavy.two_hand_shouldered",
    primaryHand: "right",
    sampledInfluence: hardIkSampledInfluence,
    upperLimbOwnership: "hard_ik"
  })
] as const satisfies readonly MetaverseHeldObjectSolverProfile[]);

export const metaverseHeldObjectSolverProfilesByPoseProfileId = Object.freeze(
  new Map<HeldObjectPoseProfileId, MetaverseHeldObjectSolverProfile>(
    metaverseHeldObjectSolverProfiles.map((profile) => [
      profile.poseProfileId,
      profile
    ])
  )
);

export function resolveMetaverseHeldObjectSolverProfile(
  holdProfile: Pick<
    HeldObjectHoldProfileDescriptor,
    "offhandPolicy" | "poseProfileId"
  >
): MetaverseHeldObjectSolverProfile {
  const solverProfile = metaverseHeldObjectSolverProfilesByPoseProfileId.get(
    holdProfile.poseProfileId
  );

  if (solverProfile === undefined) {
    throw new Error(
      `Metaverse held-object solver profile ${holdProfile.poseProfileId} is not configured.`
    );
  }

  if (solverProfile.offhandPolicy !== holdProfile.offhandPolicy) {
    throw new Error(
      `Metaverse held-object solver profile ${holdProfile.poseProfileId} expects offhand policy ${solverProfile.offhandPolicy}, not ${holdProfile.offhandPolicy}.`
    );
  }

  return solverProfile;
}
