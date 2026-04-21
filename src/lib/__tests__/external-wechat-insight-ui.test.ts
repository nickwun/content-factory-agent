import assert from "node:assert/strict";
import test from "node:test";

import { getInsightSectionItems } from "../topics/external-wechat-insight-ui.ts";
import type { ExternalTopicInsight } from "../topics/external-wechat-types.ts";

test("external wechat insight ui reads upgraded analysis dimensions directly", () => {
  const insight = createInsight({
    titlePatterns: ["标题把人群和结果词放在一起。"],
    demandDrivers: ["核心是缓解决策焦虑并给方法。"],
    structurePatterns: ["常见骨架是结论前置 + 三点展开。"],
    stylePatterns: ["表达像朋友提醒，短句较多。"],
    emotionalDrivers: ["先触发焦虑，再给安全感。"],
    rewritePotential: ["更值得学切口和结构，个人经历要重写。"],
    references: ["可以参考它们如何拆行动建议。"],
  });

  assert.deepEqual(getInsightSectionItems(insight, "titlePatterns"), [
    "标题把人群和结果词放在一起。",
  ]);
  assert.deepEqual(getInsightSectionItems(insight, "demandDrivers"), [
    "核心是缓解决策焦虑并给方法。",
  ]);
  assert.deepEqual(getInsightSectionItems(insight, "rewritePotential"), [
    "更值得学切口和结构，个人经历要重写。",
  ]);
});

test("external wechat insight ui falls back safely for legacy insight data", () => {
  const legacyInsight = createInsight({
    whyViral: ["问题足够具体，用户会主动点开。"],
    characteristics: ["常用经验 + 清单式展开。"],
    references: ["参考它们如何把建议拆成动作。"],
  });

  assert.deepEqual(getInsightSectionItems(legacyInsight, "titlePatterns"), []);
  assert.deepEqual(getInsightSectionItems(legacyInsight, "demandDrivers"), [
    "问题足够具体，用户会主动点开。",
  ]);
  assert.deepEqual(getInsightSectionItems(legacyInsight, "stylePatterns"), [
    "常用经验 + 清单式展开。",
  ]);
  assert.deepEqual(getInsightSectionItems(legacyInsight, "references"), [
    "参考它们如何把建议拆成动作。",
  ]);
});

function createInsight(
  overrides: Partial<ExternalTopicInsight> = {},
): ExternalTopicInsight {
  return {
    id: overrides.id ?? "insight-1",
    keyword: overrides.keyword ?? "马拉松",
    timeWindow: overrides.timeWindow ?? "7d",
    articleIds: overrides.articleIds ?? ["a1", "a2"],
    summary: overrides.summary ?? "这批爆文围绕高压决策场景，适合继续拆选题。",
    sampleNotice: overrides.sampleNotice,
    titlePatterns: overrides.titlePatterns ?? [],
    demandDrivers: overrides.demandDrivers ?? [],
    structurePatterns: overrides.structurePatterns ?? [],
    stylePatterns: overrides.stylePatterns ?? [],
    emotionalDrivers: overrides.emotionalDrivers ?? [],
    rewritePotential: overrides.rewritePotential ?? [],
    references: overrides.references ?? [],
    createdAt: overrides.createdAt ?? "2026-04-17T10:00:00.000Z",
    ...(overrides.whyViral ? { whyViral: overrides.whyViral } : {}),
    ...(overrides.characteristics
      ? { characteristics: overrides.characteristics }
      : {}),
  };
}
