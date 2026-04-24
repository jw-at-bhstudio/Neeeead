const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readBooleanFlag(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") {
    return defaultValue;
  }
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

export const featureFlags = {
  enableSquare: readBooleanFlag("NEXT_PUBLIC_ENABLE_SQUARE", true),
  enableEdit: readBooleanFlag("NEXT_PUBLIC_ENABLE_EDIT", false),
};

