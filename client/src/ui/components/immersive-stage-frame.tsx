import type { ReactNode } from "react";

import { cn } from "@/lib/class-name";

interface ImmersiveStageFrameProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

export function ImmersiveStageFrame({
  children,
  className
}: ImmersiveStageFrameProps) {
  return (
    <div
      className={cn(
        "relative flex h-dvh min-h-dvh w-full min-w-0 flex-col overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
