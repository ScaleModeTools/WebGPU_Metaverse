interface ConsoleMethodMap {
  info: typeof console.info;
  log: typeof console.log;
  warn: typeof console.warn;
}

const suppressedMediaPipeConsoleMessageFragments = [
  "GL version:",
  "OpenGL error checking is disabled",
  "Graph successfully started running.",
  "Created TensorFlow Lite XNNPACK delegate for CPU.",
  "Feedback manager requires a model with a single signature inference. Disabling support for feedback tensors.",
  "Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX."
] as const;

function stringifyConsoleArguments(args: readonly unknown[]): string {
  return args
    .map((argument) => {
      if (typeof argument === "string") {
        return argument;
      }

      if (
        typeof argument === "number" ||
        typeof argument === "boolean" ||
        typeof argument === "bigint"
      ) {
        return String(argument);
      }

      return "";
    })
    .join(" ");
}

export function shouldSuppressMediaPipeConsoleMessage(
  args: readonly unknown[]
): boolean {
  const message = stringifyConsoleArguments(args);

  return suppressedMediaPipeConsoleMessageFragments.some((fragment) =>
    message.includes(fragment)
  );
}

function createFilteredConsoleMethod(
  consoleLike: ConsoleMethodMap,
  originalMethod: typeof console.log
): typeof console.log {
  const boundOriginalMethod = originalMethod.bind(consoleLike);

  return (...args: Parameters<typeof console.log>) => {
    if (shouldSuppressMediaPipeConsoleMessage(args)) {
      return;
    }

    boundOriginalMethod(...args);
  };
}

export function installMediaPipeConsoleFilter(
  consoleLike: ConsoleMethodMap = console
): void {
  consoleLike.info = createFilteredConsoleMethod(consoleLike, consoleLike.info);
  consoleLike.log = createFilteredConsoleMethod(consoleLike, consoleLike.log);
  consoleLike.warn = createFilteredConsoleMethod(consoleLike, consoleLike.warn);
}
