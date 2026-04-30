import { weaponArchetypeManifest } from "@/assets/config/weapon-archetype-manifest";

import type {
  MetaverseHudCombatFeedEntrySnapshot,
  MetaverseHudSnapshot
} from "../types/metaverse-runtime";

interface MetaverseInteractionFeedHudProps {
  readonly hudSnapshot: MetaverseHudSnapshot;
}

interface InteractionPrompt {
  readonly emphasis: "primary" | "secondary";
  readonly keyLabel: string;
  readonly text: string;
}

const recentCombatMessageMaxAgeMs = 12000;
const maxRecentCombatMessages = 5;
const weaponLabelById = new Map<string, string>(
  weaponArchetypeManifest.archetypes.map((weapon): readonly [string, string] => [
    weapon.id,
    weapon.label
  ])
);

function toTitleCaseLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function resolveWeaponLabel(weaponId: string): string {
  return (
    weaponLabelById.get(weaponId) ??
    toTitleCaseLabel(
      weaponId.replace(/^metaverse[-_]/i, "").replace(/[-_]v\d+$/i, "")
    )
  );
}

function resolveMountableLabel(label: string, environmentAssetId: string): string {
  if (/skiff/i.test(label) || /skiff/i.test(environmentAssetId)) {
    return "Skiff";
  }

  const cleanedLabel = label
    .replace(/^metaverse\s+/i, "")
    .replace(/^hub\s+/i, "")
    .replace(/\s+v\d+$/i, "")
    .trim();

  return cleanedLabel.length > 0 ? toTitleCaseLabel(cleanedLabel) : "Vehicle";
}

function resolveSeatActionLabel(
  seatTarget: MetaverseHudSnapshot["mountedInteraction"]["selectableSeatTargets"][number]
): string {
  return seatTarget.seatRole === "driver" ? "Drive" : "Ride";
}

function createInteractionPrompts(
  hudSnapshot: MetaverseHudSnapshot
): readonly InteractionPrompt[] {
  const weaponResource = hudSnapshot.interaction.weaponResource;
  const mountedInteraction = hudSnapshot.mountedInteraction;

  if (weaponResource !== null) {
    return Object.freeze([
      {
        emphasis: "primary",
        keyLabel: "E",
        text: `Pick Up ${resolveWeaponLabel(weaponResource.weaponId)}`
      }
    ]);
  }

  if (mountedInteraction.mountedEnvironment !== null) {
    const label = resolveMountableLabel(
      mountedInteraction.mountedEnvironment.label,
      mountedInteraction.mountedEnvironment.environmentAssetId
    );
    const seatPrompts = mountedInteraction.selectableSeatTargets
      .slice(0, 2)
      .map((seatTarget, seatIndex) =>
        Object.freeze({
          emphasis: "secondary" as const,
          keyLabel: `${seatIndex + 1}`,
          text: resolveSeatActionLabel(seatTarget)
        })
      );

    return Object.freeze([
      {
        emphasis: "primary",
        keyLabel: "E",
        text: `Exit ${label}`
      },
      ...seatPrompts
    ]);
  }

  if (mountedInteraction.focusedMountable !== null) {
    const label = resolveMountableLabel(
      mountedInteraction.focusedMountable.label,
      mountedInteraction.focusedMountable.environmentAssetId
    );
    const hasDriverSeat = mountedInteraction.focusedMountable.directSeatTargets.some(
      (seatTarget) => seatTarget.seatRole === "driver"
    );

    return Object.freeze([
      {
        emphasis: "primary",
        keyLabel: "E",
        text: `${hasDriverSeat ? "Drive" : "Enter"} ${label}`
      }
    ]);
  }

  return Object.freeze([]);
}

function createRecentCombatMessages(
  hudSnapshot: MetaverseHudSnapshot
): readonly MetaverseHudCombatFeedEntrySnapshot[] {
  return Object.freeze(
    hudSnapshot.combat.killFeed
      .filter(
        (entry) =>
          entry.type === "kill" && entry.ageMs <= recentCombatMessageMaxAgeMs
      )
      .slice(-maxRecentCombatMessages)
      .reverse()
  );
}

function joinClassNames(
  ...classNames: readonly (string | false)[]
): string {
  return classNames.filter((className) => className !== false).join(" ");
}

export function MetaverseInteractionFeedHud({
  hudSnapshot
}: MetaverseInteractionFeedHudProps) {
  const prompts = createInteractionPrompts(hudSnapshot);
  const recentCombatMessages = createRecentCombatMessages(hudSnapshot);

  if (prompts.length === 0 && recentCombatMessages.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none w-[min(28rem,100%)] shrink min-w-0 text-game-foreground [text-shadow:var(--metaverse-hud-text-shadow)]">
      {prompts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {prompts.map((prompt) => (
            <div
              className={joinClassNames(
                "min-w-0",
                prompt.emphasis === "primary"
                  ? "type-game-heading text-game-foreground"
                  : "type-game-body text-game-foreground"
              )}
              key={`${prompt.keyLabel}-${prompt.text}`}
            >
              <span className="block truncate">
                Press {prompt.keyLabel} to {prompt.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {recentCombatMessages.length > 0 ? (
        <div
          className={
            prompts.length > 0 ? "mt-4 flex flex-col gap-2" : "flex flex-col gap-2"
          }
        >
          {recentCombatMessages.map((message) => (
            <div
              className={joinClassNames(
                "min-w-0",
                message.local ? "type-game-heading" : "type-game-body"
              )}
              key={message.sequence}
            >
              <span className="block min-w-0 truncate text-game-foreground">
                {message.summary}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
