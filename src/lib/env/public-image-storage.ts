export class MissingPublicImageStorageConfigError extends Error {
  missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(`Missing public image storage config: ${missingKeys.join(", ")}`);
    this.name = "MissingPublicImageStorageConfigError";
    this.missingKeys = missingKeys;
  }
}

export type PublicImageStorageConfig = {
  provider: "supabase";
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  bucket: string;
};

export function getPublicImageStorageConfig(): PublicImageStorageConfig {
  const provider = resolvePublicImageStorageProvider();

  if (provider !== "supabase") {
    throw new MissingPublicImageStorageConfigError([
      "PUBLIC_IMAGE_STORAGE_PROVIDER",
    ]);
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();

  const missingKeys = [
    !supabaseUrl ? "SUPABASE_URL" : null,
    !supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    !bucket ? "SUPABASE_STORAGE_BUCKET" : null,
  ].filter(Boolean) as string[];

  if (missingKeys.length > 0) {
    throw new MissingPublicImageStorageConfigError(missingKeys);
  }

  return {
    provider,
    supabaseUrl: supabaseUrl!,
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
    bucket: bucket!,
  };
}

function resolvePublicImageStorageProvider() {
  const explicitProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER?.trim();

  if (explicitProvider === "supabase") {
    return "supabase";
  }

  if (
    process.env.SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    process.env.SUPABASE_STORAGE_BUCKET?.trim()
  ) {
    return "supabase";
  }

  return explicitProvider;
}
