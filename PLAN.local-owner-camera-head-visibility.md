# Local-Owner Camera Head Visibility Follow-Up

## Summary

Track the first-person head/camera issue separately from held-object IK. The
held-object runtime should not change camera parentage or local-owner
head/hair visibility while we are cutting weapon alignment over to semantic IK.

## Problem

The local owner can sometimes see the top of the avatar head while moving and
looking up. This is likely a camera rig and local-owner mesh visibility issue,
not a pistol aim clip issue.

## Target Direction

- Camera drives view.
- Head follows camera with limits.
- Camera is not blindly parented to the head bone.
- ADS blends toward the held object's `camera.ads_anchor`.
- Local owner head/hair can fade or hide near the camera.

## Non-Goals

- Do not change gameplay weapon state or networking.
- Do not change held-object socket semantics.
- Do not solve this inside the traversal-first held-object IK refactor.
