import type {
  MetaversePlayerTraversalActionIntentSnapshot,
  MetaversePlayerTraversalBodyControlSnapshot,
  MetaversePlayerTraversalIntentSnapshot
} from "@webgpu-metaverse/shared";

export interface MetaversePlayerIssuedTraversalIntentSnapshot {
  readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
  readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
  readonly inputSequence: number;
  readonly locomotionMode: "grounded" | "swim";
  readonly orientationSequence: number;
  readonly sampleId: number;
}

export function createMetaversePlayerIssuedTraversalIntentSnapshot(
  snapshot:
    | Pick<
        MetaversePlayerTraversalIntentSnapshot,
        | "actionIntent"
        | "bodyControl"
        | "inputSequence"
        | "locomotionMode"
        | "orientationSequence"
        | "sampleId"
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
    inputSequence: snapshot.inputSequence,
    locomotionMode: snapshot.locomotionMode,
    orientationSequence: snapshot.orientationSequence,
    sampleId: snapshot.sampleId
  });
}
