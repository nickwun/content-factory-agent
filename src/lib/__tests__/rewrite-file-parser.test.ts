import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRewriteSource,
  normalizeRewriteText,
  RewriteSourceParseError,
} from "../rewrite/rewrite-source.ts";
import {
  buildMammothDocxInput,
  parseRewriteFile,
} from "../rewrite/rewrite-file-parser.ts";

test("normalizeRewriteText trims text and collapses excessive blank lines", () => {
  const normalized = normalizeRewriteText(
    "  第一段  \r\n\r\n\r\n\r\n 第二段   \n\n\n第三段  ",
  );

  assert.equal(normalized, "第一段\n\n第二段\n\n第三段");
});

test("buildRewriteSource creates pasted text source with char count", () => {
  const source = buildRewriteSource({
    kind: "pasted_text",
    extractedText: "  这是原文  \n\n\n第二段 ",
  });

  assert.deepEqual(source, {
    kind: "pasted_text",
    extractedText: "这是原文\n\n第二段",
    charCount: "这是原文\n\n第二段".length,
  });
});

test("buildRewriteSource marks source as truncated when maxChars is exceeded", () => {
  const source = buildRewriteSource({
    kind: "uploaded_file",
    sourceName: "sample.txt",
    mimeType: "text/plain",
    extractedText: "1234567890ABCDE",
    maxChars: 10,
  });

  assert.equal(source.extractedText, "1234567890");
  assert.equal(source.charCount, 15);
  assert.equal(source.truncated, true);
});

test("parseRewriteFile extracts plain text from txt files", async () => {
  const source = await parseRewriteFile(
    createFileLike("sample.txt", "text/plain", "  第一段\n\n\n第二段 "),
  );

  assert.deepEqual(source, {
    kind: "uploaded_file",
    sourceName: "sample.txt",
    mimeType: "text/plain",
    extractedText: "第一段\n\n第二段",
    charCount: "第一段\n\n第二段".length,
  });
});

test("parseRewriteFile extracts plain text from markdown files", async () => {
  const source = await parseRewriteFile(
    createFileLike("sample.md", "text/markdown", "# 标题\n\n正文内容"),
  );

  assert.equal(source.sourceName, "sample.md");
  assert.equal(source.mimeType, "text/markdown");
  assert.equal(source.extractedText, "# 标题\n\n正文内容");
});

test("parseRewriteFile uses docx extractor for docx files", async () => {
  let receivedArrayBuffer: ArrayBuffer | null = null;
  const source = await parseRewriteFile(
    createFileLike(
      "sample.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "ignored",
    ),
    {
      docxExtractor: async (arrayBuffer) => {
        receivedArrayBuffer = arrayBuffer;
        return " 第一段 \n\n\n 第二段 ";
      },
    },
  );

  assert.ok(receivedArrayBuffer instanceof ArrayBuffer);
  assert.deepEqual(source, {
    kind: "uploaded_file",
    sourceName: "sample.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extractedText: "第一段\n\n第二段",
    charCount: "第一段\n\n第二段".length,
  });
});

test("buildMammothDocxInput uses Buffer for the node mammoth runtime", () => {
  const bytes = new TextEncoder().encode("docx-binary");
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );

  const input = buildMammothDocxInput(arrayBuffer);

  assert.ok("buffer" in input);
  assert.ok(Buffer.isBuffer(input.buffer));
  assert.equal(input.buffer.toString("utf8"), "docx-binary");
});

test("parseRewriteFile rejects unsupported file types", async () => {
  await assert.rejects(
    async () => {
      await parseRewriteFile(
        createFileLike("sample.pdf", "application/pdf", "not-supported"),
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof RewriteSourceParseError);
      assert.equal(error.code, "unsupported_file_type");
      return true;
    },
  );
});

test("parseRewriteFile rejects files that have no usable text after cleaning", async () => {
  await assert.rejects(
    async () => {
      await parseRewriteFile(createFileLike("empty.txt", "text/plain", " \n\n\t "));
    },
    (error: unknown) => {
      assert.ok(error instanceof RewriteSourceParseError);
      assert.equal(error.code, "empty_extracted_text");
      return true;
    },
  );
});

function createFileLike(name: string, type: string, content: string) {
  const bytes = new TextEncoder().encode(content);

  return {
    name,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    },
  };
}
