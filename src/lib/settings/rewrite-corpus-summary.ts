import type { PromptPresetCorpusSummary } from "./prompt-settings-types.ts";

export function summarizeRewriteCorpus(
  extractedText: string,
): PromptPresetCorpusSummary {
  const normalized = extractedText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const text = normalized.join("\n");
  const charCount = text.length;

  return {
    tone: buildToneSummary(text),
    structure: buildStructureSummary(normalized),
    lengthHint: buildLengthHint(charCount),
    reusablePhrases: buildReusablePhrases(text),
  };
}

function buildToneSummary(text: string) {
  const hints: string[] = [];

  if (/[我我们]/.test(text)) {
    hints.push("第一人称更明显");
  }

  if (/[吗呢吧啊？?]/.test(text)) {
    hints.push("会先抛问题再往下说");
  }

  if (/[别先再记住]/.test(text)) {
    hints.push("提醒感比较强");
  }

  if (hints.length === 0) {
    hints.push("整体表达偏克制");
  }

  return hints.slice(0, 3);
}

function buildStructureSummary(lines: string[]) {
  const hints: string[] = [];
  const joined = lines.join("\n");

  if (/^#+\s/m.test(joined) || /^(?:\d+\.|[一二三四五六七八九十]+、)/m.test(joined)) {
    hints.push("会用小标题或分段往下推进");
  }

  if (/先说结论|结论先放在前面|先讲结论/.test(joined)) {
    hints.push("常先给判断，再展开解释");
  }

  if (/最后|记住|收回来|总结/.test(joined)) {
    hints.push("结尾会收成提醒或明确观点");
  }

  if (hints.length === 0) {
    hints.push("整体更像自然分段推进，而不是堆清单");
  }

  return hints.slice(0, 3);
}

function buildLengthHint(charCount: number) {
  if (charCount < 900) {
    return "整体篇幅偏短，更像短节奏提醒式表达。";
  }

  if (charCount <= 1500) {
    return "整体篇幅偏中等，适合一口气读完并完整展开一个问题。";
  }

  return "整体篇幅偏长，更适合分段展开和层层递进。";
}

function buildReusablePhrases(text: string) {
  const segments = text
    .split(/[。！？!?;\n]/)
    .map((segment) => segment.trim().replace(/[“”"'：:，,]/g, ""))
    .filter((segment) => segment.length >= 6 && segment.length <= 18);

  const preferred = segments.filter((segment) =>
    /先|别|记住|最后|不是|更像|不要/.test(segment),
  );

  const ordered = [...preferred, ...segments];
  const unique: string[] = [];

  for (const segment of ordered) {
    if (!unique.includes(segment)) {
      unique.push(segment);
    }

    if (unique.length >= 3) {
      break;
    }
  }

  return unique.length > 0 ? unique : undefined;
}
