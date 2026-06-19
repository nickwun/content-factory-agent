import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyFileImportDraft,
  createEmptyManualImportDraft,
  normalizeFileImportDraft,
  normalizeManualImportDraft,
} from "../topics/topic-import-draft.ts";

test("createEmptyManualImportDraft returns controlled string fields", () => {
  const draft = createEmptyManualImportDraft("source-1");

  assert.deepEqual(draft, {
    sourceAccountId: "source-1",
    title: "",
    contentMarkdown: "",
  });
});

test("normalizeManualImportDraft keeps all manual import fields controlled", () => {
  const draft = normalizeManualImportDraft({
    sourceAccountId: undefined,
    title: undefined,
    contentMarkdown: undefined,
  });

  assert.deepEqual(draft, {
    sourceAccountId: "",
    title: "",
    contentMarkdown: "",
  });
});

test("normalizeFileImportDraft keeps file import sourceAccountId controlled", () => {
  const draft = normalizeFileImportDraft({
    sourceAccountId: undefined,
    files: undefined,
  });

  assert.deepEqual(draft, {
    sourceAccountId: "",
    files: [],
  });
});

test("createEmptyFileImportDraft returns controlled default fields", () => {
  const draft = createEmptyFileImportDraft("source-2");

  assert.deepEqual(draft, {
    sourceAccountId: "source-2",
    files: [],
  });
});
