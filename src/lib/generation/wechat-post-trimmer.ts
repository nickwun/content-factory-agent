import type { WechatArticleContent, WechatBlock } from "../types/history.ts";
import {
  extractVisibleWechatMarkdownText,
  parseWechatMarkdownToBlocks,
  resolveWechatMarkdownBody,
  serializeWechatBlocksToMarkdown,
} from "../workspace/wechat-markdown.ts";

export const DEFAULT_WECHAT_POST_TRIM_MAX_WORDS = 1400;

type WechatPostTrimOptions = {
  maxBodyWords?: number;
};

export type WechatPostTrimResult = {
  article: WechatArticleContent;
  trimmed: boolean;
  originalBodyWords: number;
  trimmedBodyWords: number;
};

type SentencePriority = "low" | "medium" | "high";

type TrimCandidate = {
  blockIndex: number;
  sentenceIndex: number;
  sentence: string;
  priority: SentencePriority;
  visibleLength: number;
};

const EXPLANATION_STYLE_MARKERS = [
  "也就是说",
  "换句话说",
  "说白了",
  "说到底",
  "更重要的是",
  "某种程度上",
  "某种意义上",
  "这也意味着",
  "这其实",
  "你会发现",
  "换个说法",
];

const LOW_INFORMATION_MARKERS = [
  "这并不是说",
  "并不是说",
  "当然",
  "其实",
  "很多时候",
  "某种程度上",
  "从这个意义上说",
  "进一步来说",
  "归根结底",
];

const TEMPLATE_STYLE_MARKERS = [
  "首先",
  "其次",
  "最后",
  "总而言之",
  "不难发现",
  "毋庸置疑",
  "可以说",
  "不仅仅是",
  "某种意义上",
  "值得一提的是",
];

const HUMAN_STYLE_MARKERS = [
  "说实话",
  "老实说",
  "对我来说",
  "我越来越觉得",
  "我越来越发现",
  "我也有过这种感觉",
  "有时候",
  "坦白讲",
];

export function trimWechatArticlePostFinalization(
  article: WechatArticleContent,
  options: WechatPostTrimOptions = {},
): WechatPostTrimResult {
  const maxBodyWords = options.maxBodyWords ?? DEFAULT_WECHAT_POST_TRIM_MAX_WORDS;
  const originalMarkdownBody = resolveWechatMarkdownBody(article);
  const originalBlocks = parseWechatMarkdownToBlocks(originalMarkdownBody);
  const originalBodyWords = extractVisibleWechatMarkdownText(originalMarkdownBody).length;

  if (originalBodyWords <= maxBodyWords) {
    return {
      article: {
        ...article,
        markdownBody: originalMarkdownBody,
        blocks: originalBlocks,
      },
      trimmed: false,
      originalBodyWords,
      trimmedBodyWords: originalBodyWords,
    };
  }

  let nextBlocks = originalBlocks.map(cloneWechatBlock);
  nextBlocks = trimBlocksBySentencePriority(nextBlocks, maxBodyWords);

  const trimmedMarkdownBody = serializeWechatBlocksToMarkdown(nextBlocks);
  const trimmedBodyWords = extractVisibleWechatMarkdownText(trimmedMarkdownBody).length;

  return {
    article: {
      ...article,
      markdownBody: trimmedMarkdownBody,
      blocks: nextBlocks,
    },
    trimmed: trimmedBodyWords < originalBodyWords,
    originalBodyWords,
    trimmedBodyWords,
  };
}

function trimBlocksBySentencePriority(
  blocks: WechatArticleContent["blocks"],
  maxBodyWords: number,
) {
  const nextBlocks = blocks.map(cloneWechatBlock);
  let currentBodyWords = extractVisibleWechatMarkdownText(
    serializeWechatBlocksToMarkdown(nextBlocks),
  ).length;

  if (currentBodyWords <= maxBodyWords) {
    return nextBlocks;
  }

  while (currentBodyWords > maxBodyWords) {
    const candidate = collectTrimCandidates(nextBlocks)[0];

    if (!candidate) {
      break;
    }

    const block = nextBlocks[candidate.blockIndex];

    if (!block || (block.type !== "paragraph" && block.type !== "quote")) {
      break;
    }

    const keptSentences = splitTextIntoSentences(block.text).filter(
      (_, index) => index !== candidate.sentenceIndex,
    );

    if (keptSentences.length === 0) {
      break;
    }

    block.text = keptSentences.join("");
    currentBodyWords = extractVisibleWechatMarkdownText(
      serializeWechatBlocksToMarkdown(nextBlocks),
    ).length;
  }

  return nextBlocks;
}

function collectTrimCandidates(blocks: WechatArticleContent["blocks"]) {
  return blocks
    .flatMap((block, blockIndex) => {
      if (block.type !== "paragraph" && block.type !== "quote") {
        return [];
      }

      const sentences = splitTextIntoSentences(block.text);

      if (sentences.length <= 1) {
        return [];
      }

      return sentences
        .map<TrimCandidate>((sentence, sentenceIndex) => {
          const priority = classifySentencePriority(
            sentence,
            sentenceIndex,
            sentences.length,
          );

          return {
            blockIndex,
            sentenceIndex,
            sentence,
            priority,
            visibleLength: extractVisibleWechatMarkdownText(sentence).length,
          };
        })
        .filter((candidate) => candidate.priority !== "high");
    })
    .sort((left, right) => {
      const priorityDelta =
        priorityRank(left.priority) - priorityRank(right.priority);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const indexDelta = right.sentenceIndex - left.sentenceIndex;

      if (indexDelta !== 0) {
        return indexDelta;
      }

      return right.visibleLength - left.visibleLength;
    });
}

function classifySentencePriority(
  sentence: string,
  sentenceIndex: number,
  totalSentences: number,
): SentencePriority {
  const normalized = sentence.trim();
  const looksHuman = HUMAN_STYLE_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
  const looksLikeExplanation = EXPLANATION_STYLE_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
  const looksLowInformation = LOW_INFORMATION_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
  const looksTemplated = TEMPLATE_STYLE_MARKERS.some((marker) =>
    normalized.includes(marker),
  );

  if (looksHuman) {
    return "high";
  }

  if (sentenceIndex > 0 && looksLikeExplanation) {
    return "low";
  }

  if (looksTemplated) {
    return "low";
  }

  if (sentenceIndex > 0 && looksLowInformation) {
    return "low";
  }

  if (sentenceIndex > 0 && totalSentences >= 2) {
    return "medium";
  }

  return "high";
}

function priorityRank(priority: SentencePriority) {
  switch (priority) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
  }
}

function splitTextIntoSentences(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const matches = normalized.match(/[^。！？!?；;\n]+[。！？!?；;”"]*/g);

  return (matches ?? [normalized]).map((part) => part.trim()).filter(Boolean);
}

function cloneWechatBlock(block: WechatBlock): WechatBlock {
  if (block.type === "list") {
    return {
      ...block,
      items: [...block.items],
    };
  }

  return { ...block };
}
