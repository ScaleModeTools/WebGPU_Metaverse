import {
  syncPortalPresentation,
  type PortalMeshRuntime
} from "./metaverse-scene-portals";

import type {
  FocusedExperiencePortalSnapshot
} from "../../types/metaverse-runtime";

interface MetaverseScenePortalPresentationStateDependencies {
  readonly portalMeshes: readonly PortalMeshRuntime[];
}

export class MetaverseScenePortalPresentationState {
  readonly #portalMeshes: readonly PortalMeshRuntime[];

  constructor({
    portalMeshes
  }: MetaverseScenePortalPresentationStateDependencies) {
    this.#portalMeshes = portalMeshes;
  }

  resetPresentation(): void {
    for (const portalMesh of this.#portalMeshes) {
      portalMesh.anchorGroup.scale.setScalar(1);
    }
  }

  syncPresentation(
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number
  ): void {
    for (const portalMesh of this.#portalMeshes) {
      syncPortalPresentation(portalMesh, focusedPortal, nowMs);
    }
  }
}
