import {
  MissingPublicImageStorageConfigError,
  getPublicImageStorageConfig,
} from "../env/public-image-storage.ts";
import { parseImageDataUrl } from "./image-data-url.ts";

export class PublicImageStorageError extends Error {
  code: "missing_public_image_storage_config" | "public_image_upload_failed";

  constructor(
    code: "missing_public_image_storage_config" | "public_image_upload_failed",
    message: string,
  ) {
    super(message);
    this.name = "PublicImageStorageError";
    this.code = code;
  }
}

type UploadPublicImageInput = {
  dataUrl: string;
  folder: string;
  fileNamePrefix?: string;
};

type UploadPublicImageResult = {
  publicUrl: string;
  mimeType: string;
  storageKey: string;
};

export async function uploadPublicImage(
  input: UploadPublicImageInput,
  fetcher: typeof fetch = fetch,
): Promise<UploadPublicImageResult> {
  let config;

  try {
    config = getPublicImageStorageConfig();
  } catch (error) {
    if (error instanceof MissingPublicImageStorageConfigError) {
      throw new PublicImageStorageError(
        "missing_public_image_storage_config",
        error.message,
      );
    }

    throw error;
  }

  const parsed = parseImageDataUrl(input.dataUrl);
  const fileStem = [
    input.fileNamePrefix?.trim() || "generated-image",
    crypto.randomUUID(),
  ]
    .filter(Boolean)
    .join("-");
  const folder = sanitizeFolder(input.folder);
  const storageKey = `${folder}/${fileStem}.${parsed.extension}`;
  const uploadUrl = new URL(
    `/storage/v1/object/${config.bucket}/${storageKey}`,
    config.supabaseUrl,
  );

  const response = await fetcher(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": parsed.mimeType,
      "x-upsert": "true",
    },
    body: new Uint8Array(parsed.bytes),
  });

  if (!response.ok) {
    const responseText = (await response.text()).trim();
    throw new PublicImageStorageError(
      "public_image_upload_failed",
      responseText || `Public image upload failed with ${response.status}`,
    );
  }

  return {
    publicUrl: new URL(
      `/storage/v1/object/public/${config.bucket}/${storageKey}`,
      config.supabaseUrl,
    ).toString(),
    mimeType: parsed.mimeType,
    storageKey,
  };
}

function sanitizeFolder(folder: string) {
  return folder
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}
