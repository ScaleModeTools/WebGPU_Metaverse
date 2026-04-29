# Held-Object Runtime Refactor With Rocket Launcher Readiness

## Summary

Refactor the render path from a pistol-specific runtime into a profile-driven held-object runtime. The service pistol and rocket launcher become the first two reference assets: pistol proves `sidearm.one_hand_optional_support`, rocket launcher proves `shoulder_heavy.two_hand_shouldered`.

This slice keeps the socket/network contract intact: realtime weapon state remains `{ weaponId, aimMode }`. It adds dev equip support for pistol or rocket launcher, but does not turn rocket launcher combat/projectile/backblast gameplay into a full shipped weapon yet.

## Key Changes

- Add plural attachment runtime loading:
  - Introduce `attachmentProofConfigs?: readonly MetaverseAttachmentProofConfig[]`.
  - Keep the existing singular `attachmentProofConfig` as a compatibility wrapper.
  - Load attachment runtimes into a map by `attachmentId`.
  - Local and remote presentation select the active attachment by `weaponState.weaponId`.
  - Hide all non-active attachment runtimes.

- Generate proof configs for both reference weapons:
  - Export `metaverseAttachmentProofConfigs` from the proof config module.
  - Include the existing service pistol and `metaverse-rocket-launcher-v1`.
  - Keep pistol as the default equipped weapon.
  - Add a narrow dev equip path, using `?metaverseWeaponId=<weapon-id>` in the metaverse shell, validated against loaded proof configs.

- Make attachment runtime semantic:
  - Carry `holdProfile` into `MetaverseAttachmentProofRuntime`.
  - Build a socket-role lookup from `holdProfile.sockets`.
  - Stop gating ADS/support behavior on the service-pistol id.
  - Resolve ADS from `holdProfile.adsPolicy` and `camera.ads_anchor`.
  - Resolve projectile/muzzle data from `projectileOriginRole` for future use.
  - Represent offhand target as semantic kind:
    - `none`
    - `support-palm-hint`
    - `secondary-grip`
  - Pistol uses `support-palm-hint`; rocket launcher uses `secondary-grip`.

- Refactor pose solving from gun-specific to held-object-specific:
  - Rename conceptual runtime from `HumanoidV2HeldWeaponPoseRuntime` / pistol pose wording toward `HumanoidV2HeldObjectPoseRuntime`.
  - Keep the same humanoid arm IK machinery, but drive branches from `holdProfile.family`, `offhandPolicy`, and `adsPolicy`.
  - `optional_support_palm` uses the palm socket with soft support behavior.
  - `required_support_grip` and `required_two_hand` use the support socket with authored support-grip orientation.
  - `iron_sights`, `optic_anchor`, and `shouldered_heavy` all use generic ADS-anchor alignment when ADS is active/blending.
  - `none` / `third_person_hint_only` do not force ADS anchor alignment.

- Refactor neutral hold overlay:
  - Replace `humanoidV2PistolPoseProofConfig` with `humanoidV2HeldObjectPoseProofConfig`.
  - The new config maps `HeldObjectPoseProfileId` to optional neutral overlay clips.
  - Use `Pistol_Aim_Neutral` only for `sidearm.one_hand_optional_support`.
  - Do not use pitch-weighted pistol down/up runtime clips; pitch and ADS response belong to IK.
  - Rocket launcher is valid without a neutral overlay and uses procedural held-object solving over locomotion.

- Update telemetry/debug naming:
  - Replace service-pistol telemetry flags with generic fields such as `adsAnchorPoseActive`, `supportPalmHintActive`, `offHandTargetKind`, and `poseProfileId`.
  - Update developer overlay formatting and runtime HUD fixtures.
  - Preserve grip error, reach, pole, and socket diagnostics.

- Prevent dev-equip combat crashes:
  - Rocket launcher dev equip can render, ADS, mount, stow, and sync to remote presentation.
  - Fire commands for weapons without a shared combat profile are suppressed client-side until a real shared combat profile is added.
  - No projectile/backblast gameplay is added in this slice.

- Document the runtime contract:
  - Update the attachment model README with the held-object runtime contract, current reference profiles, and what remains gameplay-only future work.

## Test Plan

- Asset/proof pipeline tests:
  - Pistol and rocket launcher proof configs are exported.
  - Each proof config carries `holdProfile`.
  - Required socket roles resolve to real GLTF nodes.
  - Rocket launcher resolves `grip.primary`, `grip.secondary`, `trigger.index`, `projectile.muzzle`, and `camera.ads_anchor`.

- Attachment runtime tests:
  - Runtime stores `holdProfile` and socket-role lookup.
  - Pistol creates a `support-palm-hint` target.
  - Rocket launcher creates a `secondary-grip` target.
  - Missing required support grip for `required_support_grip` fails validation.

- Held-object pose tests:
  - Pistol ADS uses generic `iron_sights` policy.
  - Rocket launcher ADS uses generic `shouldered_heavy` policy.
  - Pistol support palm does not behave as a hard secondary grip.
  - Rocket launcher support grip stays near the authored support marker.

- Scene integration tests:
  - Default team-deathmatch still equips pistol.
  - `?metaverseWeaponId=metaverse-rocket-launcher-v1` equips rocket launcher in dev.
  - Local and remote characters show only the attachment matching weapon state.
  - Remote pistol and remote rocket users can coexist.
  - Unknown or non-loaded weapon ids do not crash and render no attachment.

- Animation tests:
  - Held-object overlay uses neutral-only weighting.
  - Missing neutral overlay for rocket launcher does not disable held-object IK.
  - Existing locomotion and jump vocabularies still win over old full-body aim fallback.

- Final verification:
  - Run focused runtime tests for asset pipeline, attachment runtime, character animation, local/remote presentation.
  - Run `./tools/verify`.

## Assumptions

- No network/socket protocol change in this slice.
- No full rocket launcher combat profile, projectile simulation, reload behavior, backblast hazard, or damage tuning in this slice.
- No sword/melee asset is added now, but the runtime must not contain pistol/gun-specific branches that would block melee/tool profiles later.
- Primary-hand inversion, left-hand primary use, and dual wielding remain future work.
- If a pose profile has no authored neutral overlay, the runtime proceeds with procedural IK and records/debugs that the overlay is unavailable.
