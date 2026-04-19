import { navigationFlow } from "../../client/src/navigation/config/navigation-flow";
import {
  navigationStepIds,
  type NavigationFlow,
  type NavigationStepId
} from "../../client/src/navigation/types/navigation-flow";
import type { AssertTrue, IsAssignable, IsEqual } from "./type-assertions";

type ExpectedNavigationStepId =
  | "main-menu"
  | "tool"
  | "permissions"
  | "calibration"
  | "metaverse"
  | "gameplay"
  | "unsupported";

type NavigationStepIdMatches = AssertTrue<
  IsEqual<NavigationStepId, ExpectedNavigationStepId>
>;
type NavigationStepCatalogMatches = AssertTrue<
  IsEqual<(typeof navigationStepIds)[number], NavigationStepId>
>;
type NavigationFlowMatchesPublicContract = AssertTrue<
  IsAssignable<typeof navigationFlow, NavigationFlow>
>;
type FlowStepIdsMatchUnion = AssertTrue<
  IsEqual<(typeof navigationFlow.steps)[number]["id"], NavigationStepId>
>;
type MainMenuIsEntryStep = AssertTrue<
  IsEqual<
    Extract<
      (typeof navigationFlow.steps)[number],
      { readonly id: "main-menu" }
    > extends { readonly requiresPrevious: readonly NavigationStepId[] }
      ? true
      : false,
    false
  >
>;
type PermissionsRequireMainMenu = AssertTrue<
  IsEqual<
    Extract<
      (typeof navigationFlow.steps)[number],
      { readonly id: "permissions" }
    >["requiresPrevious"],
    readonly ["main-menu"]
  >
>;
type CalibrationRequiresPermissions = AssertTrue<
  IsEqual<
    Extract<
      (typeof navigationFlow.steps)[number],
      { readonly id: "calibration" }
    >["requiresPrevious"],
    readonly ["permissions"]
  >
>;
type MetaverseRequiresMainMenu = AssertTrue<
  IsEqual<
    Extract<
      (typeof navigationFlow.steps)[number],
      { readonly id: "metaverse" }
    >["requiresPrevious"],
    readonly ["main-menu"]
  >
>;
type GameplayRequiresMetaverse = AssertTrue<
  IsEqual<
    Extract<(typeof navigationFlow.steps)[number], { readonly id: "gameplay" }>["requiresPrevious"],
    readonly ["metaverse"]
  >
>;

export type ClientNavigationTypeTests =
  | NavigationStepIdMatches
  | NavigationStepCatalogMatches
  | NavigationFlowMatchesPublicContract
  | FlowStepIdsMatchUnion
  | MainMenuIsEntryStep
  | PermissionsRequireMainMenu
  | CalibrationRequiresPermissions
  | MetaverseRequiresMainMenu
  | GameplayRequiresMetaverse;
