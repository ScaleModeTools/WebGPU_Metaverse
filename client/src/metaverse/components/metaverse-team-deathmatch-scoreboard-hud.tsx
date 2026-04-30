import { Fragment, type CSSProperties } from "react";
import { HomeIcon, RotateCcwIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";

interface MetaverseTeamDeathmatchScoreboardHudProps {
  readonly combatSnapshot: MetaverseHudSnapshot["combat"];
}

interface MetaverseTeamDeathmatchPostGameOverlayProps {
  readonly combatSnapshot: MetaverseHudSnapshot["combat"];
  readonly nextMatchError: string | null;
  readonly nextMatchPending: boolean;
  readonly onMainMenu: () => void;
  readonly onNextMatch: () => void;
}

type ScoreboardTeamSnapshot =
  MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number];
type ScoreboardPlayerSnapshot = ScoreboardTeamSnapshot["players"][number];
type ScoreboardSnapshot = MetaverseHudSnapshot["combat"]["scoreboard"];

const metaverseHardHudTextShadowStyle = Object.freeze({
  "--game-text-shadow":
    "1px 1px 0 rgb(0 0 0 / 1), 0 0 1px rgb(0 0 0 / 1)"
} as CSSProperties);

function formatTeamLabel(teamId: ScoreboardTeamSnapshot["teamId"]): string {
  return teamId === "blue" ? "Blue" : "Red";
}

function formatAccuracyLabel(accuracyRatio: number | null): string {
  return accuracyRatio === null ? "--" : `${Math.round(accuracyRatio * 100)}%`;
}

function resolveTeamSectionClassName(
  teamId: ScoreboardTeamSnapshot["teamId"]
): string {
  return teamId === "blue"
    ? "border-sky-200/20 bg-sky-400/18 text-sky-50 hover:bg-sky-400/18"
    : "border-rose-200/20 bg-rose-400/18 text-rose-50 hover:bg-rose-400/18";
}

function joinClassNames(
  ...classNames: readonly (string | false)[]
): string {
  return classNames.filter((className) => className !== false).join(" ");
}

function resolveTeamPlayerRowClassName(
  teamId: ScoreboardTeamSnapshot["teamId"],
  index: number,
  isLocalPlayer: boolean
): string {
  const blueClassName =
    index % 2 === 0
      ? "bg-sky-400/8 hover:bg-sky-400/14"
      : "bg-sky-950/18 hover:bg-sky-400/12";
  const redClassName =
    index % 2 === 0
      ? "bg-rose-400/8 hover:bg-rose-400/14"
      : "bg-rose-950/18 hover:bg-rose-400/12";

  return joinClassNames(
    "border-white/8 text-game-foreground",
    teamId === "blue" ? blueClassName : redClassName,
    isLocalPlayer && "outline outline-1 -outline-offset-1 outline-white/40"
  );
}

function resolvePlayerScore(player: ScoreboardPlayerSnapshot): number {
  return player.kills;
}

function resolveLocalPlayerTeamId(
  scoreboardSnapshot: ScoreboardSnapshot
): ScoreboardTeamSnapshot["teamId"] | null {
  for (const teamSnapshot of scoreboardSnapshot.teams) {
    if (teamSnapshot.players.some((playerSnapshot) => playerSnapshot.isLocalPlayer)) {
      return teamSnapshot.teamId;
    }
  }

  return null;
}

function resolvePostGameResultLabel(
  scoreboardSnapshot: ScoreboardSnapshot
): string {
  const localTeamId = resolveLocalPlayerTeamId(scoreboardSnapshot);

  if (scoreboardSnapshot.winnerTeamId === null) {
    return "Draw";
  }

  return localTeamId === scoreboardSnapshot.winnerTeamId ? "Victory" : "Defeat";
}

function resolvePostGameSummaryLabel(
  scoreboardSnapshot: ScoreboardSnapshot
): string {
  if (scoreboardSnapshot.winnerTeamId === null) {
    return "No winning team";
  }

  return `${formatTeamLabel(scoreboardSnapshot.winnerTeamId)} wins`;
}

function MetaverseTeamDeathmatchScoreboardTable({
  scoreboardSnapshot
}: {
  readonly scoreboardSnapshot: ScoreboardSnapshot;
}) {
  return (
    <Table className="text-game-foreground">
      <TableHeader>
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead
            aria-label="Avatar"
            className="w-12 text-game-foreground"
          />
          <TableHead
            aria-label="Player"
            className="text-game-foreground"
          />
          <TableHead className="text-right text-game-foreground">K</TableHead>
          <TableHead className="text-right text-game-foreground">D</TableHead>
          <TableHead className="text-right text-game-foreground">A</TableHead>
          <TableHead className="text-right text-game-foreground">HS</TableHead>
          <TableHead className="text-right text-game-foreground">Acc</TableHead>
          <TableHead className="text-right text-game-foreground">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scoreboardSnapshot.teams.map((team) => (
          <Fragment key={team.teamId}>
            <TableRow
              className={resolveTeamSectionClassName(team.teamId)}
            >
              <TableCell className="py-2 font-semibold" colSpan={8}>
                <div className="flex items-center justify-between gap-4">
                  <span>{formatTeamLabel(team.teamId)}</span>
                  <span className="tabular-nums">{team.score}</span>
                </div>
              </TableCell>
            </TableRow>
            {team.players.map((player, playerIndex) => (
                <TableRow
                  className={resolveTeamPlayerRowClassName(
                    team.teamId,
                    playerIndex,
                    player.isLocalPlayer
                  )}
                  key={player.playerId}
                >
                  <TableCell>
                    <div className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 font-medium text-game-foreground">
                      {player.username.slice(0, 1).toUpperCase()}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate font-medium">
                    {player.username}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {player.kills}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {player.deaths}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {player.assists}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {player.headshotKills}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAccuracyLabel(player.accuracyRatio)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {resolvePlayerScore(player)}
                  </TableCell>
                </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

export function MetaverseTeamDeathmatchScoreboardHud({
  combatSnapshot
}: MetaverseTeamDeathmatchScoreboardHudProps) {
  const scoreboardSnapshot = combatSnapshot.scoreboard;

  if (!scoreboardSnapshot.available) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-[var(--metaverse-hud-edge)]">
      <div
        className="surface-game-overlay pointer-events-none w-[min(58rem,calc(100vw-2rem))] rounded-[var(--metaverse-hud-panel-radius)] p-[var(--metaverse-hud-panel-padding)] text-game-foreground shadow-[0_24px_72px_rgb(2_6_23_/_0.38)] [text-shadow:var(--game-text-shadow)]"
        style={metaverseHardHudTextShadowStyle}
      >
        <MetaverseTeamDeathmatchScoreboardTable
          scoreboardSnapshot={scoreboardSnapshot}
        />
      </div>
    </div>
  );
}

export function MetaverseTeamDeathmatchPostGameOverlay({
  combatSnapshot,
  nextMatchError,
  nextMatchPending,
  onMainMenu,
  onNextMatch
}: MetaverseTeamDeathmatchPostGameOverlayProps) {
  const scoreboardSnapshot = combatSnapshot.scoreboard;

  if (!scoreboardSnapshot.available || scoreboardSnapshot.phase !== "completed") {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/28 p-[var(--metaverse-hud-edge)]">
      <div
        className="surface-game-overlay pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-[min(58rem,calc(100vw-2rem))] flex-col gap-5 overflow-hidden rounded-[var(--metaverse-hud-panel-radius)] p-[var(--metaverse-hud-panel-padding)] text-game-foreground shadow-[0_24px_72px_rgb(2_6_23_/_0.46)] [text-shadow:var(--game-text-shadow)]"
        style={metaverseHardHudTextShadowStyle}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="type-game-heading text-game-foreground">
              {resolvePostGameResultLabel(scoreboardSnapshot)}
            </p>
            <p className="type-game-body text-game-foreground">
              {resolvePostGameSummaryLabel(scoreboardSnapshot)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={nextMatchPending}
              onClick={onNextMatch}
              type="button"
            >
              <RotateCcwIcon data-icon="inline-start" />
              {nextMatchPending ? "Starting" : "Next Match"}
            </Button>
            <Button onClick={onMainMenu} type="button" variant="secondary">
              <HomeIcon data-icon="inline-start" />
              Main Menu
            </Button>
          </div>
        </div>

        <div className="min-h-0 overflow-auto">
          <MetaverseTeamDeathmatchScoreboardTable
            scoreboardSnapshot={scoreboardSnapshot}
          />
        </div>

        {nextMatchError !== null ? (
          <div className="surface-game-danger rounded-[var(--metaverse-hud-inset-radius)] px-3 py-2 text-sm leading-6">
            {nextMatchError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
