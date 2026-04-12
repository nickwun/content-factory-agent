import assert from "node:assert/strict";
import test from "node:test";

import { buildRewriteBrief, REWRITE_BRIEF_VERSION } from "../rewrite/rewrite-brief.ts";
import { chunkRewriteSourceText } from "../rewrite/rewrite-chunking.ts";

function buildSampleChunks() {
  const text = [
    "写作不是为了立刻写出多么厉害的作品，而是为了让大脑保持持续组织信息的状态。",
    "",
    "很多人在中年以后感觉思考变慢，其实不是能力突然消失，而是长期缺少主动表达和结构化整理。",
    "",
    "一、写作为什么会延缓衰老",
    "",
    "第一，写作会迫使你不断回忆、筛选和重组信息。",
    "",
    "第二，写作会让语言、判断和记忆同步运转，不容易彼此脱节。",
    "",
    "接下来要讨论的是，为什么稳定写作比偶尔输出更重要。",
    "",
    "二、稳定输出如何改变日常节奏",
    "",
    "当一个人每天都写一点，他会更容易发现自己在想什么、忽略了什么、真正关心什么。",
    "",
    "比如每天记录三百字，也足够形成持续感。",
    "",
    "最后，不要把写作理解成创作压力，更像是给大脑做长期训练。",
  ].join("\n");

  return chunkRewriteSourceText(text, {
    targetChars: 120,
    softMaxChars: 180,
    hardMaxChars: 220,
  });
}

test("buildRewriteBrief returns a structured rewrite brief instead of a flat summary", () => {
  const chunks = buildSampleChunks();
  const brief = buildRewriteBrief(chunks);

  assert.equal(brief.version, REWRITE_BRIEF_VERSION);
  assert.ok(brief.theme.length > 0);
  assert.ok(brief.coreClaims.length > 0);
  assert.ok(brief.mustKeepPoints.length > 0);
  assert.ok(brief.reusableFacts.length > 0);
  assert.ok(brief.structureFlow.length >= 3);
  assert.ok(brief.structureFlow.every((item) => item.summary.length > 0));
  assert.ok(brief.structureFlow.every((item) => item.role.length > 0));
  assert.ok(brief.toneProfile.overallTone.length > 0);
  assert.ok(brief.argumentCadence.progressionPattern.length > 0);
});

test("buildRewriteBrief keeps structure progression and transition relationships", () => {
  const chunks = buildSampleChunks();
  const brief = buildRewriteBrief(chunks);

  assert.equal(brief.structureFlow[0]?.role, "intro");
  assert.ok(
    brief.structureFlow.some(
      (item) => item.role === "transition" && typeof item.transitionToNext === "string",
    ),
  );
  assert.equal(brief.structureFlow.at(-1)?.role, "conclusion");
});

test("buildRewriteBrief separates mustKeepPoints from reusableFacts", () => {
  const chunks = buildSampleChunks();
  const brief = buildRewriteBrief(chunks);

  assert.ok(
    brief.mustKeepPoints.some((item) => item.includes("回忆") || item.includes("筛选")),
  );
  assert.ok(
    brief.reusableFacts.some((item) => item.includes("三百字") || item.includes("每天记录")),
  );
  assert.ok(
    brief.mustKeepPoints.every((item) => !brief.reusableFacts.includes(item)),
  );
});

test("buildRewriteBrief does not collapse into a tiny generic summary blob", () => {
  const chunks = buildSampleChunks();
  const brief = buildRewriteBrief(chunks);
  const flattened = JSON.stringify(brief);

  assert.ok(flattened.length > 600);
  assert.ok(brief.structureFlow.length >= 3);
  assert.ok(brief.coreClaims.length >= 2);
});
