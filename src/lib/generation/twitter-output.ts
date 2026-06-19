import type { TwitterContent } from "../types/history.ts";

export type RawTwitterOutput = {
  recommendedMode?: unknown;
  singleDraft?: unknown;
  threadDraft?: unknown;
};

const DEFAULT_TWITTER_PLACEHOLDER = "这是一条新生成的 Twitter 草稿，请继续完善。";
const MAX_SINGLE_DRAFT_LENGTH = 280;

export function normalizeTwitterOutput(raw: unknown): TwitterContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid twitter output");
  }

  const source = raw as RawTwitterOutput;
  const threadDraft = normalizeThreadDraft(source.threadDraft);
  const hasValidThread = threadDraft.length >= 2;
  const singleDraft = normalizeSingleDraft(source.singleDraft, threadDraft);

  const recommendedMode = normalizeRecommendedMode(
    source.recommendedMode,
    hasValidThread,
  );

  return {
    platform: "twitter",
    mode: recommendedMode,
    autoDetectedMode: recommendedMode,
    userLockedMode: false,
    singleDraft,
    threadDraft: hasValidThread ? threadDraft : [singleDraft],
  };
}

export function assertMeaningfulTwitterContent(content: TwitterContent) {
  const normalizedSingle = content.singleDraft.trim();
  const normalizedThread = content.threadDraft.map((tweet) => tweet.trim());

  const singleMeaningful =
    normalizedSingle && normalizedSingle !== DEFAULT_TWITTER_PLACEHOLDER;
  const threadMeaningful = normalizedThread.some(
    (tweet) => tweet && tweet !== DEFAULT_TWITTER_PLACEHOLDER,
  );

  if (!singleMeaningful && !threadMeaningful) {
    throw new Error("Generated twitter content did not contain meaningful content");
  }
}

export function extractTwitterJsonPayload(rawText: string) {
  const text = rawText.trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const jsonText = findFirstJsonObject(candidate);

  if (!jsonText) {
    throw new Error("Invalid twitter output");
  }

  return JSON.parse(jsonText);
}

function normalizeThreadDraft(rawThreadDraft: unknown) {
  if (!Array.isArray(rawThreadDraft)) {
    return [];
  }

  return rawThreadDraft
    .filter((item): item is string => typeof item === "string")
    .map((item) => cleanTweetText(item))
    .filter(Boolean);
}

function normalizeSingleDraft(rawSingleDraft: unknown, threadDraft: string[]) {
  const rawSingle =
    typeof rawSingleDraft === "string" ? rawSingleDraft.replace(/\s+/g, " ").trim() : "";
  const cleaned =
    rawSingle && rawSingle.length <= MAX_SINGLE_DRAFT_LENGTH
      ? rawSingle
      : "";

  if (cleaned) {
    return cleaned;
  }

  if (threadDraft[0]) {
    return cleanTweetText(threadDraft[0]);
  }

  if (rawSingle) {
    return cleanTweetText(rawSingle);
  }

  return DEFAULT_TWITTER_PLACEHOLDER;
}

function normalizeRecommendedMode(
  rawRecommendedMode: unknown,
  hasValidThread: boolean,
): "single" | "thread" {
  if (rawRecommendedMode === "thread" && hasValidThread) {
    return "thread";
  }

  if (rawRecommendedMode === "single") {
    return "single";
  }

  return hasValidThread ? "thread" : "single";
}

function cleanTweetText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= MAX_SINGLE_DRAFT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SINGLE_DRAFT_LENGTH - 1).trim()}…`;
}

function findFirstJsonObject(text: string) {
  const startIndex = text.indexOf("{");

  if (startIndex === -1) {
    return null;
  }

  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
