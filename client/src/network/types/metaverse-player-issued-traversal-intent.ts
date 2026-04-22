import type {
  MetaversePlayerTraversalActionIntentSnapshot,
  MetaversePlayerTraversalBodyControlSnapshot,
  MetaversePlayerTraversalIntentSnapshot
} from "@webgpu-metaverse/shared";

export interface MetaversePlayerIssuedTraversalIntentSnapshot {
  readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
  readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
  readonly locomotionMode: "grounded" | "swim";
  readonly sequence: number;
}

export function createMetaversePlayerIssuedTraversalIntentSnapshot(
  snapshot:
    | Pick<
        MetaversePlayerTraversalIntentSnapshot,
        | "actionIntent"
        | "bodyControl"
        | "locomotionMode"
        | "sequence"
      >
    | null
    | undefined
): MetaversePlayerIssuedTraversalIntentSnapshot | null {
  if (snapshot === null || snapshot === undefined) {
    return null;
  }

  return Object.freeze({
    actionIntent: snapshot.actionIntent,
    bodyControl: snapshot.bodyControl,
    locomotionMode: snapshot.locomotionMode,
    sequence: snapshot.sequence
  });
}
