type ParsedImageDataUrl = {
  mimeType: string;
  buffer: Buffer;
};

export type ImageMetadata = {
  width: number;
  height: number;
};

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid image data URL");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export function getImageMetadataFromDataUrl(dataUrl: string): ImageMetadata {
  const parsed = parseImageDataUrl(dataUrl);
  return getImageMetadataFromBuffer(parsed.buffer, parsed.mimeType);
}

export function getImageMetadataFromBuffer(
  buffer: Buffer,
  mimeType: string,
): ImageMetadata {
  if (mimeType === "image/png") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (mimeType === "image/webp") {
    return getWebpMetadata(buffer);
  }

  if (mimeType === "image/jpeg") {
    return getJpegMetadata(buffer);
  }

  throw new Error(`Unsupported image mime type: ${mimeType}`);
}

function getJpegMetadata(buffer: Buffer): ImageMetadata {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  throw new Error("Unable to determine JPEG dimensions");
}

function getWebpMetadata(buffer: Buffer): ImageMetadata {
  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  throw new Error("Unsupported WEBP image subtype");
}
