import assert from "node:assert/strict";
import test from "node:test";

import { summarizeRewriteCorpus } from "../settings/rewrite-corpus-summary.ts";

test("rewrite corpus summary keeps fields lightweight and limits reusable phrases", () => {
  const summary = summarizeRewriteCorpus(
    [
      "先说结论，这篇文章不是在讲训练计划本身，而是在讲普通跑者赛前那种说不出口的慌。",
      "我更想先把问题说透，再给方法。",
      "很多人不是不会练，而是总想在最后一周补回来。",
      "先说结论，最后一周不要再硬顶训练量。",
      "别急着焦虑，我们先把该做的事情一件件排开。",
      "最后收回来，记住别临时上强度。",
    ].join("\n\n"),
  );

  assert.ok(summary.tone && summary.tone.length > 0);
  assert.ok(summary.structure && summary.structure.length > 0);
  assert.ok(summary.lengthHint);
  assert.ok(summary.reusablePhrases && summary.reusablePhrases.length > 0);
  assert.ok(summary.reusablePhrases && summary.reusablePhrases.length <= 3);
});

test("rewrite corpus summary produces narrative length hint instead of raw counts", () => {
  const summary = summarizeRewriteCorpus("短一点的语料。".repeat(120));

  assert.ok(summary.lengthHint);
  assert.equal(/\d{4,}/.test(summary.lengthHint ?? ""), false);
});
