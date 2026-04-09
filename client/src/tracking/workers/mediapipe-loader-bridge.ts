const mediaPipeLoaderPrelude = [
  "var custom_dbg = globalThis.custom_dbg || function custom_dbg() {",
  "  console.warn.apply(console, arguments);",
  "};",
  "globalThis.custom_dbg = custom_dbg;"
].join("\n");

function readModuleFactoryAssignmentScript(sourceUrl: string): string {
  return [
    "(function(){",
    "if (typeof ModuleFactory !== 'undefined') {",
    "self.ModuleFactory = ModuleFactory;",
    "}",
    "})();",
    `//# sourceURL=${sourceUrl}`
  ].join("\n");
}

export function buildMediaPipeLoaderScript(
  loaderSource: string,
  sourceUrl: string
): string {
  return [
    mediaPipeLoaderPrelude,
    loaderSource,
    readModuleFactoryAssignmentScript(sourceUrl)
  ].join("\n");
}
