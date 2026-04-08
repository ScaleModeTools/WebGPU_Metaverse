import { navigationFlow } from "../../client/src/navigation/config/navigation-flow";
import {
  navigationStepIds,
  type NavigationFlow,
  type NavigationStepId
} from "../../client/src/navigation/types/navigation-flow";
import type { AssertTrue, IsAssignable, IsEqual } from "./type-assertions";

type ExpectedNavigationStepId =
  | "login"
  | "main-menu"
  | "permissions"
  | "calibration"
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
type MainMenuRequiresLogin = AssertTrue<
  IsEqual<
    Extract<
      (typeof navigationFlow.steps)[number],
      { readonly id: "main-menu" }
    >["requiresPrevious"],
    readonly ["login"]
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
type GameplayRequiresMainMenu = AssertTrue<
  IsEqual<
    Extract<(typeof navigationFlow.steps)[number], { readonly id: "gameplay" }>["requiresPrevious"],
    readonly ["main-menu"]
  >
>;

export type ClientNavigationTypeTests =
  | NavigationStepIdMatches
  | NavigationStepCatalogMatches
  | NavigationFlowMatchesPublicContract
  | FlowStepIdsMatchUnion
  | MainMenuRequiresLogin
  | PermissionsRequireMainMenu
  | CalibrationRequiresPermissions
  | GameplayRequiresMainMenu;
