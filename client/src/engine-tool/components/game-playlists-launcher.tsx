import { ListChecksIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GamePlaylistsLauncherProps {
  readonly className?: string;
  readonly onOpenGamePlaylistsRequest: () => void;
}

export function GamePlaylistsLauncher({
  className,
  onOpenGamePlaylistsRequest
}: GamePlaylistsLauncherProps) {
  return (
    <Button
      className={className}
      onClick={onOpenGamePlaylistsRequest}
      size="lg"
      type="button"
      variant="outline"
    >
      <ListChecksIcon data-icon="inline-start" />
      Game Playlists
    </Button>
  );
}
