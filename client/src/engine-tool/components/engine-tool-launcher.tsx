import { Layers3Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EngineToolLauncherProps {
  readonly className?: string;
  readonly onOpenToolRequest: () => void;
}

export function EngineToolLauncher({
  className,
  onOpenToolRequest
}: EngineToolLauncherProps) {
  return (
    <Button
      className={className}
      onClick={onOpenToolRequest}
      size="lg"
      type="button"
      variant="outline"
    >
      <Layers3Icon data-icon="inline-start" />
      Open Tool
    </Button>
  );
}
