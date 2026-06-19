export type RewriteSource = {
  kind: "pasted_text" | "uploaded_file";
  sourceName?: string;
  mimeType?: string;
  extractedText: string;
  charCount: number;
  truncated?: boolean;
};

export type RewriteSourceErrorCode =
  | "empty_extracted_text"
  | "unsupported_file_type"
  | "parse_failed"
  | "invalid_rewrite_source"
  | "rewrite_source_too_long";

export const MAX_REWRITE_SOURCE_CHARS = 30_000;

export class RewriteSourceParseError extends Error {
  code: RewriteSourceErrorCode;

  constructor(code: RewriteSourceErrorCode, message: string) {
    super(message);
    this.name = "RewriteSourceParseError";
    this.code = code;
  }
}

type BuildRewriteSourceInput = {
  kind: RewriteSource["kind"];
  extractedText: string;
  sourceName?: string;
  mimeType?: string;
  maxChars?: number;
};

type ParseRewriteSourcePayloadOptions = {
  maxChars?: number;
};

export function normalizeRewriteText(input: string) {
  const normalizedNewlines = input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");

  const lines = normalizedNewlines.split("\n");
  const cleanedLines: string[] = [];
  let previousWasBlank = false;

  for (const line of lines) {
    const cleanedLine = line.replace(/[ \t]+/g, " ").trim();

    if (!cleanedLine) {
      if (!previousWasBlank && cleanedLines.length > 0) {
        cleanedLines.push("");
      }
      previousWasBlank = true;
      continue;
    }

    cleanedLines.push(cleanedLine);
    previousWasBlank = false;
  }

  return cleanedLines.join("\n").trim();
}

export function buildRewriteSource(
  input: BuildRewriteSourceInput,
): RewriteSource {
  const normalizedText = normalizeRewriteText(input.extractedText);

  if (!normalizedText) {
    throw new RewriteSourceParseError(
      "empty_extracted_text",
      "提取后的正文为空，请更换原文或直接粘贴可用文本。",
    );
  }

  const charCount = normalizedText.length;
  const maxChars = input.maxChars && input.maxChars > 0 ? input.maxChars : null;
  const truncated = Boolean(maxChars && charCount > maxChars);
  const extractedText = truncated
    ? normalizedText.slice(0, maxChars!).trimEnd()
    : normalizedText;

  return {
    kind: input.kind,
    ...(input.sourceName ? { sourceName: input.sourceName } : {}),
    ...(input.mimeType ? { mimeType: input.mimeType } : {}),
    extractedText,
    charCount,
    ...(truncated ? { truncated: true } : {}),
  };
}

export function parseRewriteSourcePayload(
  payload: unknown,
  options: ParseRewriteSourcePayloadOptions = {},
): RewriteSource {
  if (!payload || typeof payload !== "object") {
    throw new RewriteSourceParseError(
      "invalid_rewrite_source",
      "rewriteSource 格式无效。",
    );
  }

  const candidate = payload as Partial<RewriteSource>;
  const kind = candidate.kind;

  if (kind !== "pasted_text" && kind !== "uploaded_file") {
    throw new RewriteSourceParseError(
      "invalid_rewrite_source",
      "rewriteSource.kind 无效。",
    );
  }

  if (typeof candidate.extractedText !== "string") {
    throw new RewriteSourceParseError(
      "invalid_rewrite_source",
      "rewriteSource.extractedText 缺失或格式无效。",
    );
  }

  const normalizedText = normalizeRewriteText(candidate.extractedText);

  if (!normalizedText) {
    throw new RewriteSourceParseError(
      "empty_extracted_text",
      "提取后的正文为空，请更换原文或直接粘贴可用文本。",
    );
  }

  const maxChars = options.maxChars ?? MAX_REWRITE_SOURCE_CHARS;

  if (normalizedText.length > maxChars) {
    throw new RewriteSourceParseError(
      "rewrite_source_too_long",
      `原文长度超过当前上限（${maxChars} 字符）。`,
    );
  }

  const providedCharCount =
    typeof candidate.charCount === "number" && Number.isFinite(candidate.charCount)
      ? candidate.charCount
      : normalizedText.length;

  if (providedCharCount < normalizedText.length) {
    throw new RewriteSourceParseError(
      "invalid_rewrite_source",
      "rewriteSource.charCount 无效。",
    );
  }

  return {
    kind,
    ...(typeof candidate.sourceName === "string" && candidate.sourceName.trim()
      ? { sourceName: candidate.sourceName.trim() }
      : {}),
    ...(typeof candidate.mimeType === "string" && candidate.mimeType.trim()
      ? { mimeType: candidate.mimeType.trim() }
      : {}),
    extractedText: normalizedText,
    charCount: providedCharCount,
    ...(candidate.truncated === true ? { truncated: true } : {}),
  };
}
