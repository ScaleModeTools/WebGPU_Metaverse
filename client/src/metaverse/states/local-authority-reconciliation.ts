import type {
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared";

export function hasReplayRelevantTraversalIntent(
  traversalIntent: MetaversePlayerTraversalIntentSnapshot | null
): boolean {
  if (traversalIntent === null) {
    return false;
  }

  return (
    (traversalIntent.actionIntent.kind ?? "none") !== "none" ||
    Math.abs(traversalIntent.bodyControl.moveAxis) > 0 ||
    Math.abs(traversalIntent.bodyControl.strafeAxis) > 0
  );
}

export function shouldPreferAckedTraversalReplay(
  traversalIntent: MetaversePlayerTraversalIntentSnapshot | null,
  ackedAuthoritativePlayerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "lastProcessedInputSequence" | "traversalAuthority"
  > | null
): boolean {
  return (
    hasReplayRelevantTraversalIntent(traversalIntent) &&
    ackedAuthoritativePlayerSnapshot !== null
  );
}
