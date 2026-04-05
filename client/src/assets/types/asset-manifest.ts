import type {
  RegistryById,
  ReticleColor,
  ReticleId,
  ReticleStyle
} from "@thumbshooter/shared";

export interface ReticleDescriptor<TId extends ReticleId = ReticleId> {
  readonly id: TId;
  readonly label: string;
  readonly style: ReticleStyle;
  readonly color: ReticleColor;
}

export interface ReticleManifest<
  TEntries extends readonly ReticleDescriptor[] = readonly ReticleDescriptor[]
> {
  readonly reticles: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export function defineReticleManifest<
  const TEntries extends readonly ReticleDescriptor[]
>(reticles: TEntries): ReticleManifest<TEntries> {
  const byId = Object.fromEntries(
    reticles.map((reticle) => [reticle.id, reticle] as const)
  ) as RegistryById<TEntries>;

  return {
    reticles,
    byId
  };
}
