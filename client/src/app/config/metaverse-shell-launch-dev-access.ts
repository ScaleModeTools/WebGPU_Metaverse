function resolveBooleanEnvFlag(rawValue: string | undefined): boolean | null {
  if (rawValue === undefined) {
    return null;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (
    normalizedValue === "1" ||
    normalizedValue === "true" ||
    normalizedValue === "on"
  ) {
    return true;
  }

  if (
    normalizedValue === "0" ||
    normalizedValue === "false" ||
    normalizedValue === "off"
  ) {
    return false;
  }

  return null;
}

export const metaverseShellLaunchDevAccessConfig = Object.freeze({
  hideEntryScreenButtons:
    resolveBooleanEnvFlag(
      import.meta.env?.VITE_METAVERSE_HIDE_LAUNCH_DEV_BUTTONS
    ) ?? false
});
