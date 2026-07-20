type CloudErrorInput = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function combinedMessage(error: CloudErrorInput | unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as CloudErrorInput;
    return [maybeError.code, maybeError.message, maybeError.details, maybeError.hint].filter(Boolean).join(" ");
  }
  return String(error || "");
}

export function friendlyCloudWriteMessage(error: CloudErrorInput | unknown) {
  const raw = combinedMessage(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("pgrst204") ||
    lower.includes("pgrst205") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  ) {
    return "Supabase tables are missing or outdated. Your phone data is safe; run the latest supabase/schema.sql in Supabase SQL Editor, then retry.";
  }

  if (
    lower.includes("42501") ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("violates row level security")
  ) {
    return "Supabase security blocked this save. Check your role/company access and run the latest Supabase policies.";
  }

  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("timeout")) {
    return "Cloud connection failed. Your changes can still be saved on this phone; retry when internet is stable.";
  }

  return "Could not save to Supabase right now. Please retry from Settings or continue using phone save.";
}
