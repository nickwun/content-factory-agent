import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRewriteCorpusFile,
  RewriteCorpusParseError,
} from "../settings/rewrite-corpus-parser.ts";

test("rewrite corpus parser extracts plain text from txt files", async () => {
  const parsed = await parseRewriteCorpusFile(
    createFile("runner-tone.txt", "text/plain", "第一段\n\n第二段"),
  );

  assert.equal(parsed.fileName, "runner-tone.txt");
  assert.equal(parsed.mimeType, "text/plain");
  assert.equal(parsed.extractedText, "第一段\n\n第二段");
});

test("rewrite corpus parser returns readable docx parse errors", async () => {
  await assert.rejects(
    async () => {
      await parseRewriteCorpusFile(
        createFile(
          "runner-tone.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "ignored",
        ),
        {
          docxExtractor: async () => {
            throw new Error("zip broken");
          },
        },
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof RewriteCorpusParseError);
      assert.equal(error.code, "parse_failed");
      assert.equal(error.message, "DOCX 语料解析失败，请确认文件未损坏后重试。");
      return true;
    },
  );
});

test("rewrite corpus parser rejects unsupported file types", async () => {
  await assert.rejects(
    async () => {
      await parseRewriteCorpusFile(
        createFile("runner-tone.md", "text/markdown", "# not allowed"),
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof RewriteCorpusParseError);
      assert.equal(error.code, "unsupported_file_type");
      return true;
    },
  );
});

function createFile(name: string, type: string, content: string) {
  const bytes = new TextEncoder().encode(content);

  return {
    name,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}
