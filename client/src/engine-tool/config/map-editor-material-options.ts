import type { MapEditorMaterialOption } from "../types/map-editor";

export const mapEditorMaterialOptions = Object.freeze(
  [
    Object.freeze({
      label: "Default authored material",
      value: "__default__"
    }),
    Object.freeze({
      label: "Shell floor grid",
      value: "shell-floor-grid"
    }),
    Object.freeze({
      label: "Metal panel",
      value: "shell-metal-panel"
    }),
    Object.freeze({
      label: "Painted trim",
      value: "shell-painted-trim"
    })
  ] satisfies readonly MapEditorMaterialOption[]
);
