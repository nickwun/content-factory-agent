export type ParsedImageDataUrl = {
  mimeType: string;
  extension: string;
  bytes: Buffer;
};

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid generated image payload");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = getImageExtensionFromMimeType(mimeType);

  return {
    mimeType,
    extension,
    bytes: Buffer.from(base64, "base64"),
  };
}

export function getImageExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

export function getImageMimeTypeFromAssetName(assetName: string) {
  if (assetName.endsWith(".jpg") || assetName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (assetName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}
