import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GENERATED_IMAGE_DIRECTORY = path.join(
  "/tmp",
  "distributing-web-generated-images",
);

export async function saveGeneratedImageDataUrl(dataUrl: string) {
  const { mimeType, bytes, extension } = parseDataUrl(dataUrl);
  const assetId = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(GENERATED_IMAGE_DIRECTORY, assetId);

  await mkdir(GENERATED_IMAGE_DIRECTORY, { recursive: true });
  await writeFile(filePath, bytes);

  return {
    assetId,
    mimeType,
  };
}

export async function readGeneratedImageAsset(assetId: string) {
  const filePath = path.join(GENERATED_IMAGE_DIRECTORY, assetId);
  const bytes = await readFile(filePath);

  return {
    bytes,
    mimeType: getMimeTypeFromAssetId(assetId),
  };
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid generated image payload");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = getExtensionFromMimeType(mimeType);

  return {
    mimeType,
    extension,
    bytes: Buffer.from(base64, "base64"),
  };
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

function getMimeTypeFromAssetId(assetId: string) {
  if (assetId.endsWith(".jpg") || assetId.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (assetId.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}
