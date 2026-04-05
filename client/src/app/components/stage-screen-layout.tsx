import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

interface StageScreenLayoutProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
}

export function StageScreenLayout({
  children,
  description,
  eyebrow,
  title
}: StageScreenLayoutProps) {
  return (
    <Card className="min-h-[32rem] rounded-[2rem] border-border/70 bg-card/85 shadow-[0_28px_90px_rgb(15_23_42_/_0.18)] backdrop-blur-xl">
      <CardHeader className="gap-3 border-b border-border/70 pb-5">
        <Badge variant="outline">{eyebrow}</Badge>
        <div className="flex flex-col gap-2">
          <CardTitle className="text-3xl font-semibold tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-6">{children}</CardContent>
    </Card>
  );
}
