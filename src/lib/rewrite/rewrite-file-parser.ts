import {
  buildRewriteSource,
  RewriteSourceParseError,
  type RewriteSource,
} from "./rewrite-source.ts";

export type RewriteFileLike = {
  name: string;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type ParseRewriteFileOptions = {
  maxChars?: number;
  docxExtractor?: (
    arrayBuffer: ArrayBuffer,
    file: RewriteFileLike,
  ) => Promise<string>;
};

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function parseRewriteFile(
  file: RewriteFileLike,
  options: ParseRewriteFileOptions = {},
): Promise<RewriteSource> {
  const extension = getFileExtension(file.name);
  const mimeType = file.type?.trim() || inferMimeType(extension);

  if (!isSupportedRewriteFile(extension, mimeType)) {
    throw new RewriteSourceParseError(
      "unsupported_file_type",
      "当前仅支持 .txt、.md、.docx 或直接粘贴文本。",
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (extension === ".docx" || mimeType === DOCX_MIME_TYPE) {
      const extractedText = await extractDocxText(
        arrayBuffer,
        file,
        options.docxExtractor,
      );

      return buildRewriteSource({
        kind: "uploaded_file",
        sourceName: file.name,
        mimeType: mimeType || DOCX_MIME_TYPE,
        extractedText,
        maxChars: options.maxChars,
      });
    }

    const extractedText = new TextDecoder("utf-8").decode(arrayBuffer);

    return buildRewriteSource({
      kind: "uploaded_file",
      sourceName: file.name,
      mimeType,
      extractedText,
      maxChars: options.maxChars,
    });
  } catch (error) {
    if (error instanceof RewriteSourceParseError) {
      throw error;
    }

    throw new RewriteSourceParseError(
      "parse_failed",
      error instanceof Error
        ? error.message
        : "原文解析失败，请换一个文件或直接粘贴文本。",
    );
  }
}

function getFileExtension(filename: string) {
  const match = filename.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] || "";
}

function inferMimeType(extension: string) {
  if (extension === ".txt") {
    return "text/plain";
  }

  if (extension === ".md") {
    return "text/markdown";
  }

  if (extension === ".docx") {
    return DOCX_MIME_TYPE;
  }

  return "";
}

function isSupportedRewriteFile(extension: string, mimeType: string) {
  return (
    extension === ".txt" ||
    extension === ".md" ||
    extension === ".docx" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === DOCX_MIME_TYPE
  );
}

async function extractDocxText(
  arrayBuffer: ArrayBuffer,
  file: RewriteFileLike,
  docxExtractor?: (
    arrayBuffer: ArrayBuffer,
    file: RewriteFileLike,
  ) => Promise<string>,
) {
  if (docxExtractor) {
    return docxExtractor(arrayBuffer, file);
  }

  let mammothModule: {
    extractRawText: (
      input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer },
    ) => Promise<{ value: string }>;
  };

  try {
    mammothModule = await import("mammoth");
  } catch {
    throw new RewriteSourceParseError(
      "parse_failed",
      "当前环境缺少 DOCX 解析依赖，请安装 mammoth 后重试。",
    );
  }

  const result = await mammothModule.extractRawText(
    buildMammothDocxInput(arrayBuffer, getMammothRuntime()),
  );
  return result.value;
}

type MammothRuntime = "node" | "browser";

function getMammothRuntime(): MammothRuntime {
  return typeof window === "undefined" ? "node" : "browser";
}

export function buildMammothDocxInput(
  arrayBuffer: ArrayBuffer,
  runtime: MammothRuntime = "node",
) {
  if (runtime === "browser") {
    return {
      arrayBuffer,
    };
  }

  return {
    buffer: Buffer.from(arrayBuffer),
  };
}
