import type { RewriteChunk } from "./rewrite-chunking.ts";
import type { RewriteBrief, RewriteBriefStructureItem } from "./rewrite-brief-types.ts";

export const REWRITE_BRIEF_VERSION = "v1";

export function buildRewriteBrief(chunks: RewriteChunk[]): RewriteBrief {
  const safeChunks = chunks.filter((chunk) => chunk.text.trim().length > 0);

  if (safeChunks.length === 0) {
    throw new Error("Cannot build rewrite brief from empty chunks");
  }

  const structureFlow = buildStructureFlow(safeChunks);
  const theme = structureFlow[0]?.summary ?? safeChunks[0]?.text.slice(0, 80) ?? "未命名主题";
  const coreClaims = uniqueStrings(
    safeChunks.flatMap((chunk) => extractClaimCandidates(chunk.text)),
  ).slice(0, 6);
  const mustKeepCandidates = uniqueStrings(
    safeChunks.flatMap((chunk) => extractMustKeepPoints(chunk.text)),
  ).slice(0, 6);
  const mustKeepPoints =
    mustKeepCandidates.length > 0
      ? mustKeepCandidates
      : fallbackMustKeepPoints(safeChunks);
  const reusableFactCandidates = uniqueStrings(
    safeChunks.flatMap((chunk) => extractReusableFacts(chunk.text)),
  );
  const reusableFacts = uniqueStrings(
    reusableFactCandidates.filter((item) => !mustKeepPoints.includes(item)),
  ).slice(0, 6);
  const finalReusableFacts =
    reusableFacts.length > 0
      ? reusableFacts
      : uniqueStrings(
          fallbackReusableFacts(safeChunks).filter((item) => !mustKeepPoints.includes(item)),
        ).slice(0, 6);

  return {
    version: REWRITE_BRIEF_VERSION,
    sourceStats: {
      totalChars: safeChunks.reduce((sum, chunk) => sum + chunk.charCount, 0),
      totalChunks: safeChunks.length,
      estimatedParagraphGroups: safeChunks.reduce(
        (sum, chunk) => sum + chunk.paragraphGroups,
        0,
      ),
    },
    theme,
    coreClaims: coreClaims.length > 0 ? coreClaims : fallbackClaims(safeChunks),
    mustKeepPoints,
    reusableFacts: finalReusableFacts,
    toneProfile: inferToneProfile(safeChunks),
    structureFlow,
    argumentCadence: inferArgumentCadence(structureFlow),
  };
}

function buildStructureItem(
  chunk: RewriteChunk,
  paragraph: string,
  itemIndex: number,
  items: Array<{ chunk: RewriteChunk; paragraph: string }>,
): RewriteBriefStructureItem {
  const keyPoints = splitIntoSentences(paragraph).slice(0, 3);
  const role = inferParagraphRole(chunk, paragraph, itemIndex, items.length);
  const nextItem = items[itemIndex + 1];

  return {
    index: itemIndex,
    role,
    summary: summarizeParagraph(chunk, paragraph),
    keyPoints,
    ...(nextItem
      ? {
          transitionToNext: describeTransition(paragraph, nextItem.paragraph, role, nextItem.chunk),
        }
      : {}),
    emphasis:
      role === "intro" || role === "conclusion"
        ? "high"
        : role === "transition"
          ? "medium"
          : "medium",
  };
}

function summarizeParagraph(chunk: RewriteChunk, paragraph: string) {
  if (chunk.heading) {
    return `${cleanText(chunk.heading)}：${firstMeaningfulSentence(paragraph)}`;
  }

  return firstMeaningfulSentence(paragraph);
}

function firstMeaningfulSentence(text: string) {
  return splitIntoSentences(text)[0] ?? cleanText(text).slice(0, 80);
}

function splitIntoSentences(text: string) {
  return cleanText(text)
    .split(/(?<=[。！？!?；;])/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractClaimCandidates(text: string) {
  return splitIntoSentences(text).filter((sentence) =>
    /会|能够|可以|其实|关键|真正|不是|意味着|让/.test(sentence),
  );
}

function extractMustKeepPoints(text: string) {
  return splitIntoSentences(text).filter((sentence) =>
    /第一|第二|关键|真正|不要|必须|核心|意味着|会迫使|会让/.test(sentence),
  );
}

function extractReusableFacts(text: string) {
  return splitIntoSentences(text).filter((sentence) =>
    /比如|例如|每天|数字|记录|三百字|案例|事实|材料/.test(sentence),
  );
}

function fallbackClaims(chunks: RewriteChunk[]) {
  return chunks.map((chunk) => firstMeaningfulSentence(chunk.text)).slice(0, 4);
}

function fallbackMustKeepPoints(chunks: RewriteChunk[]) {
  return chunks
    .filter((chunk) => chunk.sourceRoleHint !== "transition")
    .map((chunk) => summarizeChunk(chunk))
    .slice(0, 4);
}

function fallbackReusableFacts(chunks: RewriteChunk[]) {
  return chunks.flatMap((chunk) => splitIntoSentences(chunk.text).slice(0, 1)).slice(0, 4);
}

function summarizeChunk(chunk: RewriteChunk) {
  return chunk.heading
    ? `${cleanText(chunk.heading)}：${firstMeaningfulSentence(chunk.text)}`
    : firstMeaningfulSentence(chunk.text);
}

function inferToneProfile(chunks: RewriteChunk[]) {
  const corpus = chunks.map((chunk) => chunk.text).join("\n");
  const sentenceCount = splitIntoSentences(corpus).length;
  const rhetoricalMoves = uniqueStrings(
    [
      chunks.some((chunk) => chunk.sourceRoleHint === "intro") ? "开场提出主题" : null,
      chunks.some((chunk) => chunk.sourceRoleHint === "transition") ? "中段转折推进" : null,
      chunks.some((chunk) => chunk.sourceRoleHint === "conclusion") ? "结尾收束强调" : null,
      /第一|第二|第三/.test(corpus) ? "分层论证" : null,
      /比如|例如/.test(corpus) ? "举例支撑" : null,
    ].filter(Boolean) as string[],
  );

  return {
    overallTone: /不要|关键|真正|其实/.test(corpus) ? "分析型、解释型" : "陈述型",
    pacing: sentenceCount >= chunks.length * 2 ? "层层推进、逐步展开" : "较为简洁直接",
    rhetoricalMoves,
    emotionalTemperature: /活力|更有结构|稳定开始|长期训练/.test(corpus)
      ? "温和鼓励"
      : "克制中性",
  };
}

function inferArgumentCadence(structureFlow: RewriteBriefStructureItem[]) {
  return {
    openingMove:
      structureFlow[0]?.role === "intro" ? "先提出主题与问题意识" : "直接进入主题",
    progressionPattern: structureFlow
      .map((item) => item.role)
      .join(" -> "),
    evidenceStyle: structureFlow.some((item) =>
      item.keyPoints.some((point) => /比如|例如/.test(point)),
    )
      ? "以解释结合例子推进"
      : "以解释和观点递进推进",
    endingMove:
      structureFlow.at(-1)?.role === "conclusion" ? "回收观点并给出收束" : "自然结束",
  };
}

function describeTransition(
  currentParagraph: string,
  nextParagraph: string,
  currentRole: RewriteChunk["sourceRoleHint"],
  nextChunk: RewriteChunk,
) {
  if (currentRole === "transition") {
    return "承上启下，推进到下一层论证";
  }

  if (/最后|总结|收束|结论/.test(nextParagraph)) {
    return "从主体论证收束到结尾总结";
  }

  if (nextChunk.heading) {
    return `转入下一节：${cleanText(nextChunk.heading)}`;
  }

  return "沿着同一主题继续推进";
}

function buildStructureFlow(chunks: RewriteChunk[]) {
  const items = chunks.flatMap((chunk) => {
    const paragraphs = chunk.text
      .split("\n\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => item !== chunk.heading);

    return paragraphs.map((paragraph) => ({ chunk, paragraph }));
  });

  return items.map((item, index, allItems) =>
    buildStructureItem(item.chunk, item.paragraph, index, allItems),
  );
}

function inferParagraphRole(
  chunk: RewriteChunk,
  paragraph: string,
  index: number,
  totalItems: number,
) {
  const sample = paragraph.toLowerCase();

  if (index === 0 || chunk.sourceRoleHint === "intro") {
    return index === 0 ? "intro" : /接下来|然后|再看/.test(sample) ? "transition" : "body";
  }

  if (
    index === totalItems - 1 ||
    /最后|总结|结尾|总之|回到/.test(sample)
  ) {
    return "conclusion";
  }

  if (/接下来|然后|再看|进一步|另一方面|下一步/.test(sample)) {
    return "transition";
  }

  return "body";
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = cleanText(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
