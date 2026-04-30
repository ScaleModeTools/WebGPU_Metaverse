import { Fragment, type CSSProperties } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";

interface MetaverseTeamDeathmatchScoreboardHudProps {
  readonly combatSnapshot: MetaverseHudSnapshot["combat"];
}

type ScoreboardTeamSnapshot =
  MetaverseHudSnapshot["combat"]["scoreboard"]["teams"][number];
type ScoreboardPlayerSnapshot = ScoreboardTeamSnapshot["players"][number];

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

function resolveScoreLine(
  teams: readonly ScoreboardTeamSnapshot[]
): string {
  const blueTeam = teams.find((team) => team.teamId === "blue") ?? null;
  const redTeam = teams.find((team) => team.teamId === "red") ?? null;

  return `${formatTeamLabel("blue")} ${blueTeam?.score ?? 0} - ${redTeam?.score ?? 0} ${formatTeamLabel("red")}`;
}

function renderPlayerStatus(player: ScoreboardPlayerSnapshot): string {
  if (player.alive) {
    return "Up";
  }

  return "Down";
}

export function MetaverseTeamDeathmatchScoreboardHud({
  combatSnapshot
}: MetaverseTeamDeathmatchScoreboardHudProps) {
  const scoreboardSnapshot = combatSnapshot.scoreboard;

  if (!scoreboardSnapshot.available) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center p-[var(--metaverse-hud-edge)]">
      <div
        className="surface-game-overlay pointer-events-none w-[min(58rem,calc(100vw-2rem))] rounded-[var(--metaverse-hud-panel-radius)] p-[var(--metaverse-hud-panel-padding)] text-game-foreground shadow-[0_24px_72px_rgb(2_6_23_/_0.38)] [text-shadow:var(--game-text-shadow)]"
        style={metaverseHardHudTextShadowStyle}
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-game-caption text-game-foreground">
              Team Deathmatch
            </p>
            <p className="type-game-heading mt-1">{resolveScoreLine(scoreboardSnapshot.teams)}</p>
          </div>
          <p className="type-game-body text-game-foreground">
            {scoreboardSnapshot.scoreLimit === null
              ? "No limit"
              : `First to ${scoreboardSnapshot.scoreLimit}`}
          </p>
        </div>

        <Table className="text-game-foreground">
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-12 text-game-foreground">Avatar</TableHead>
              <TableHead className="text-game-foreground">Player</TableHead>
              <TableHead className="text-right text-game-foreground">K</TableHead>
              <TableHead className="text-right text-game-foreground">D</TableHead>
              <TableHead className="text-right text-game-foreground">A</TableHead>
              <TableHead className="text-right text-game-foreground">HS</TableHead>
              <TableHead className="text-right text-game-foreground">Acc</TableHead>
              <TableHead className="text-right text-game-foreground">State</TableHead>
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
                      <span className="tabular-nums">
                        {team.score}
                        {scoreboardSnapshot.scoreLimit === null
                          ? ""
                          : ` / ${scoreboardSnapshot.scoreLimit}`}
                      </span>
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
                    <TableCell className="text-right">
                      {renderPlayerStatus(player)}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
