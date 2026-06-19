import { parseRewriteFile, type RewriteFileLike } from "../rewrite/rewrite-file-parser.ts";
import { RewriteSourceParseError } from "../rewrite/rewrite-source.ts";
import type { PromptPresetCorpusFile } from "./prompt-settings-types.ts";

type ParseRewriteCorpusFileOptions = {
  docxExtractor?: (
    arrayBuffer: ArrayBuffer,
    file: RewriteFileLike,
  ) => Promise<string>;
};

export class RewriteCorpusParseError extends Error {
  readonly code: "unsupported_file_type" | "parse_failed" | "empty_extracted_text";

  constructor(
    code: "unsupported_file_type" | "parse_failed" | "empty_extracted_text",
    message: string,
  ) {
    super(message);
    this.name = "RewriteCorpusParseError";
    this.code = code;
  }
}

export async function parseRewriteCorpusFile(
  file: RewriteFileLike,
  options: ParseRewriteCorpusFileOptions = {},
): Promise<{
  fileName: string;
  mimeType: PromptPresetCorpusFile["mimeType"];
  extractedText: string;
}> {
  if (!isSupportedCorpusFile(file.name, file.type)) {
    throw new RewriteCorpusParseError(
      "unsupported_file_type",
      "当前语料库仅支持 .txt 和 .docx 文件。",
    );
  }

  try {
    const source = await parseRewriteFile(file, {
      docxExtractor: options.docxExtractor,
    });

    const mimeType =
      source.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? source.mimeType
        : "text/plain";

    return {
      fileName: source.sourceName ?? file.name,
      mimeType,
      extractedText: source.extractedText,
    };
  } catch (error) {
    if (error instanceof RewriteSourceParseError) {
      if (error.code === "unsupported_file_type") {
        throw new RewriteCorpusParseError(
          "unsupported_file_type",
          "当前语料库仅支持 .txt 和 .docx 文件。",
        );
      }

      if (error.code === "empty_extracted_text") {
        throw new RewriteCorpusParseError(
          "empty_extracted_text",
          "语料解析后没有可用正文，请换一个文件再试。",
        );
      }

      if (
        (file.name.toLowerCase().endsWith(".docx") ||
          file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
        error.code === "parse_failed"
      ) {
        throw new RewriteCorpusParseError(
          "parse_failed",
          "DOCX 语料解析失败，请确认文件未损坏后重试。",
        );
      }

      throw new RewriteCorpusParseError(
        "parse_failed",
        "语料解析失败，请稍后重试。",
      );
    }

    throw new RewriteCorpusParseError("parse_failed", "语料解析失败，请稍后重试。");
  }
}

function isSupportedCorpusFile(fileName: string, mimeType?: string) {
  const normalizedName = fileName.toLowerCase();
  return (
    normalizedName.endsWith(".txt") ||
    normalizedName.endsWith(".docx") ||
    mimeType === "text/plain" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}
