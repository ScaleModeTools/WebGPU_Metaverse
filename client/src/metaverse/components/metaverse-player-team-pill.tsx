import type { MetaversePlayerTeamId } from "@webgpu-metaverse/shared";

import { Badge } from "@/components/ui/badge";

interface MetaversePlayerTeamPillProps {
  readonly className?: string;
  readonly teamId: MetaversePlayerTeamId;
}

export function formatMetaversePlayerTeamLabel(
  teamId: MetaversePlayerTeamId | null
): string {
  switch (teamId) {
    case "red":
      return "Red Team";
    case "blue":
      return "Blue Team";
    default:
      return "Unassigned";
  }
}

function resolveMetaversePlayerTeamPillClassName(
  teamId: MetaversePlayerTeamId
): string {
  switch (teamId) {
    case "red":
      return "border-rose-400/35 bg-rose-500/16 text-rose-50";
    case "blue":
      return "border-sky-400/35 bg-sky-500/16 text-sky-50";
    default: {
      const exhaustiveCheck: never = teamId;
      throw new Error(`Unsupported metaverse team pill: ${exhaustiveCheck}`);
    }
  }
}

export function MetaversePlayerTeamPill({
  className,
  teamId
}: MetaversePlayerTeamPillProps) {
  return (
    <Badge
      className={[
        "h-8 rounded-full border px-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] shadow-[0_14px_32px_rgb(15_23_42_/_0.18)]",
        resolveMetaversePlayerTeamPillClassName(teamId),
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {formatMetaversePlayerTeamLabel(teamId)}
    </Badge>
  );
}
