import assert from "node:assert/strict";
import test from "node:test";

import { resolveRichClipboardStrategy } from "../workspace/rich-clipboard.ts";

test("resolveRichClipboardStrategy prefers async html clipboard when available", () => {
  assert.equal(
    resolveRichClipboardStrategy({
      hasClipboardItem: true,
      hasClipboardWrite: true,
      hasClipboardWriteText: true,
      hasSelectionCopy: true,
    }),
    "async-html",
  );
});

test("resolveRichClipboardStrategy falls back to selection copy on non-secure HTTP pages", () => {
  assert.equal(
    resolveRichClipboardStrategy({
      hasClipboardItem: false,
      hasClipboardWrite: false,
      hasClipboardWriteText: false,
      hasSelectionCopy: true,
    }),
    "selection-html",
  );
});

test("resolveRichClipboardStrategy can use text clipboard as a final browser fallback", () => {
  assert.equal(
    resolveRichClipboardStrategy({
      hasClipboardItem: false,
      hasClipboardWrite: false,
      hasClipboardWriteText: true,
      hasSelectionCopy: false,
    }),
    "async-text",
  );
});

test("resolveRichClipboardStrategy returns unavailable when no browser copy route exists", () => {
  assert.equal(
    resolveRichClipboardStrategy({
      hasClipboardItem: false,
      hasClipboardWrite: false,
      hasClipboardWriteText: false,
      hasSelectionCopy: false,
    }),
    "unavailable",
  );
});
