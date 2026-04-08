import type { FormEvent } from "react";

import { profileStoragePlan } from "../../network";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { StageScreenLayout } from "./stage-screen-layout";

interface LoginStageScreenProps {
  readonly hasStoredProfile: boolean;
  readonly loginError: string | null;
  readonly onClearProfile: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly setUsernameDraft: (value: string) => void;
  readonly usernameDraft: string;
}

export function LoginStageScreen({
  hasStoredProfile,
  loginError,
  onClearProfile,
  onSubmit,
  setUsernameDraft,
  usernameDraft
}: LoginStageScreenProps) {
  return (
    <StageScreenLayout
      description="Create or resume your local profile. Username, input mode, calibration data, and audio mix stay on this device."
      eyebrow="Login"
      title="Create or resume local profile"
    >
      <form className="flex flex-col gap-6" onSubmit={onSubmit}>
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                aria-invalid={loginError !== null}
                autoComplete="nickname"
                id="login-username"
                onChange={(event) => setUsernameDraft(event.target.value)}
                placeholder="Enter username"
                value={usernameDraft}
              />
              <p className="text-sm text-muted-foreground">
                Non-empty names are normalized and persisted locally.
              </p>
              {loginError !== null ? (
                <p className="text-sm text-destructive">{loginError}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {hasStoredProfile ? "Resume local profile" : "Create local profile"}
              </Button>
              {hasStoredProfile ? (
                <Button onClick={onClearProfile} type="button" variant="outline">
                  Clear local profile
                </Button>
              ) : null}
            </div>
          </div>

          <Card className="rounded-[1.5rem] border-border/70 bg-muted/35">
            <CardHeader>
              <CardTitle>What persists now</CardTitle>
              <CardDescription>
                The local profile stays on this device, including input mode and
                calibration data when you capture it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                Username key: {profileStoragePlan.usernameStorageKey}
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                Profile key: {profileStoragePlan.profileStorageKey}
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                Calibration key: {profileStoragePlan.calibrationStorageKey}
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                Input mode key: {profileStoragePlan.inputModeStorageKey}
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </StageScreenLayout>
  );
}
