export const controllerFamilyIds = [
  "mouse-keyboard",
  "gamepad",
  "computer-vision"
] as const;

export const controllerSchemeStatuses = ["stable", "planned"] as const;
export const controllerButtonRoleIds = [
  "primary",
  "secondary",
  "utility-1",
  "utility-2"
] as const;
export const controllerButtonBindingIds = [
  "mouse-left",
  "mouse-right",
  "mouse-auxiliary",
  "gamepad-right-trigger",
  "gamepad-left-trigger",
  "gamepad-right-bumper"
] as const;

export type ControllerFamilyId = (typeof controllerFamilyIds)[number];
export type ControllerSchemeStatus = (typeof controllerSchemeStatuses)[number];
export type ControllerButtonRoleId = (typeof controllerButtonRoleIds)[number];
export type ControllerButtonBindingId =
  (typeof controllerButtonBindingIds)[number];

export type ButtonRoleBindingMap<
  TBindingId extends string = ControllerButtonBindingId,
  TRoleId extends string = ControllerButtonRoleId
> = Readonly<Partial<Record<TBindingId, TRoleId>>>;

export type ButtonRoleActionMap<
  TRoleId extends string,
  TActionId extends string
> = Readonly<Partial<Record<TRoleId, TActionId>>>;

export type ResolvedButtonActionMap<
  TBindingId extends string,
  TActionId extends string
> = Readonly<Partial<Record<TBindingId, TActionId>>>;

export function resolveButtonActionMap<
  TBindingId extends string,
  TRoleId extends string,
  TActionId extends string
>(
  bindingMap: ButtonRoleBindingMap<TBindingId, TRoleId>,
  actionMap: ButtonRoleActionMap<TRoleId, TActionId>
): ResolvedButtonActionMap<TBindingId, TActionId> {
  const resolvedEntries = Object.entries(bindingMap).flatMap(
    ([bindingId, roleId]) => {
      const resolvedActionId = actionMap[roleId as TRoleId];

      return resolvedActionId === undefined
        ? []
        : [[bindingId, resolvedActionId] as const];
    }
  );

  return Object.freeze(
    Object.fromEntries(resolvedEntries) as Partial<Record<TBindingId, TActionId>>
  );
}
