import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getImageMimeTypeFromAssetName,
  parseImageDataUrl,
} from "./image-data-url.ts";

const GENERATED_IMAGE_DIRECTORY = path.join(
  "/tmp",
  "distributing-web-generated-images",
);

export async function saveGeneratedImageDataUrl(dataUrl: string) {
  const { mimeType, bytes, extension } = parseImageDataUrl(dataUrl);
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
    mimeType: getImageMimeTypeFromAssetName(assetId),
  };
}
