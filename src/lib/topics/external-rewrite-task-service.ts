import {
  buildRewriteSource,
  MAX_REWRITE_SOURCE_CHARS,
} from "../rewrite/rewrite-source.ts";
import { buildPromptPresetPromptBlocks, type PromptPresetInput } from "../rewrite/prompt-preset-input.ts";
import { buildWechatFinalizationOptions } from "../generation/wechat-finalization.ts";
import type {
  ExternalRewriteTask,
  ExternalRewriteTaskAnalysisHighlights,
  ExternalTopicInsight,
  ExternalWechatArticle,
  ExternalWechatTimeWindow,
} from "./external-wechat-types.ts";

type CreateExternalRewriteTaskInput = {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  articles: ExternalWechatArticle[];
  selectedArticleIds: string[];
  insight?: ExternalTopicInsight;
  promptPresetInput?: PromptPresetInput;
};

type ExternalRewriteTaskServiceOptions = {
  now?: () => string;
  randomId?: () => string;
};

export class ExternalRewriteTaskError extends Error {
  readonly code:
    | "invalid_keyword"
    | "invalid_time_window"
    | "invalid_selection_count"
    | "invalid_selected_articles";

  constructor(
    code:
      | "invalid_keyword"
      | "invalid_time_window"
      | "invalid_selection_count"
      | "invalid_selected_articles",
    message: string,
  ) {
    super(message);
    this.name = "ExternalRewriteTaskError";
    this.code = code;
  }
}

export function createExternalRewriteTaskService(
  options: ExternalRewriteTaskServiceOptions = {},
) {
  const now = options.now ?? (() => new Date().toISOString());
  const randomId = options.randomId ?? createRandomId;

  return {
    createExternalRewriteTask(input: CreateExternalRewriteTaskInput) {
      const keyword = input.keyword.trim();

      if (!keyword) {
        throw new ExternalRewriteTaskError("invalid_keyword", "关键词不能为空。");
      }

      if (!["all", "1d", "7d", "6m"].includes(input.timeWindow)) {
        throw new ExternalRewriteTaskError(
          "invalid_time_window",
          "不支持的时间范围。",
        );
      }

      const selectedArticleIds = Array.from(
        new Set(input.selectedArticleIds.map((id) => id.trim()).filter(Boolean)),
      );

      if (selectedArticleIds.length < 1 || selectedArticleIds.length > 5) {
        throw new ExternalRewriteTaskError(
          "invalid_selection_count",
          "仿写素材至少选择 1 篇，最多选择 5 篇。",
        );
      }

      const selectedArticles = selectedArticleIds
        .map((selectedId) =>
          input.articles.find((article) => article.id === selectedId),
        )
        .filter(
          (
            article,
          ): article is ExternalWechatArticle & {
            content: string;
          } =>
            Boolean(
              article &&
                article.contentFetchStatus === "success" &&
                typeof article.content === "string" &&
                article.content.trim().length > 0,
            ),
        );

      if (selectedArticles.length !== selectedArticleIds.length) {
        throw new ExternalRewriteTaskError(
          "invalid_selected_articles",
          "当前勾选里包含未成功补正文的文章，暂时无法进入仿写。",
        );
      }

      const createdAt = now();
      const analysisHighlights = input.insight
        ? buildAnalysisHighlights(input.insight)
        : undefined;
      const externalRewriteTask: ExternalRewriteTask = {
        id: randomId(),
        keyword,
        timeWindow: input.timeWindow,
        selectedArticleIds,
        brief: {
          keyword,
          ...(input.insight?.summary
            ? { insightSummary: input.insight.summary }
            : {}),
          ...(resolveWhyViral(input.insight)?.length
            ? { whyViral: resolveWhyViral(input.insight) }
            : {}),
          ...(resolveCharacteristics(input.insight)?.length
            ? { characteristics: resolveCharacteristics(input.insight) }
            : {}),
          ...(input.insight?.references?.length
            ? { references: input.insight.references.slice(0, 4) }
            : {}),
          ...(analysisHighlights ? { analysisHighlights } : {}),
          sourceArticles: selectedArticles.map((article) => ({
            id: article.id,
            title: article.title,
            accountName: article.accountName,
            ...(article.publishTime ? { publishTime: article.publishTime } : {}),
          })),
          rewriteGoal:
            "基于外部爆款公众号样本，重构一篇适合公众号发布的原创长文。",
          styleProfile:
            "保留公众号长文的人味、口语感和观察感，避免模板腔、教程腔和纯信息搬运感。",
        },
        status: "pending",
        createdAt,
        updatedAt: createdAt,
      };

      return {
        externalRewriteTask,
        generatePayload: {
          userPrompt: buildExternalRewriteUserPrompt(
            externalRewriteTask,
            input.promptPresetInput,
          ),
          selectedPlatforms: ["wechat_article"] as const,
          rewriteSource: buildRewriteSource({
            kind: "pasted_text",
            sourceName: `${keyword} 外部爆款样本`,
            extractedText: buildSelectedSourceText(selectedArticles),
            maxChars: MAX_REWRITE_SOURCE_CHARS,
          }),
          wechatFinalization: buildWechatFinalizationOptions(true),
        },
      };
    },
  };
}

function buildExternalRewriteUserPrompt(
  task: ExternalRewriteTask,
  promptPresetInput?: PromptPresetInput,
) {
  const lines = [
    `请围绕「${task.keyword}」重构一篇公众号长文。`,
    task.brief.rewriteGoal,
    `风格要求：${task.brief.styleProfile}`,
  ];

  const presetBlocks = buildPromptPresetPromptBlocks(promptPresetInput);
  if (presetBlocks.length > 0) {
    lines.push(...presetBlocks);
  }

  if (task.brief.insightSummary) {
    lines.push(`分析摘要：${task.brief.insightSummary}`);
  }

  if (task.brief.whyViral?.length) {
    lines.push(
      ["这些样本为什么容易爆：", ...task.brief.whyViral.map((item) => `- ${item}`)].join(
        "\n",
      ),
    );
  }

  if (task.brief.characteristics?.length) {
    lines.push(
      [
        "这些样本的共同特点：",
        ...task.brief.characteristics.map((item) => `- ${item}`),
      ].join("\n"),
    );
  }

  if (task.brief.references?.length) {
    lines.push(
      ["仿写时值得参考：", ...task.brief.references.map((item) => `- ${item}`)].join(
        "\n",
      ),
    );
  }

  const highlightBlocks = buildAnalysisHighlightPromptBlocks(
    task.brief.analysisHighlights,
  );

  if (highlightBlocks.length > 0) {
    lines.push(...highlightBlocks);
  }

  return lines.join("\n\n");
}

function buildSelectedSourceText(
  articles: Array<ExternalWechatArticle & { content: string }>,
) {
  return articles
    .map((article, index) =>
      [
        `## 外部爆款文章 ${index + 1}：${article.title}`,
        `公众号：${article.accountName}`,
        article.publishTime ? `发布时间：${article.publishTime}` : undefined,
        "",
        article.content.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}

function createRandomId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `external-rewrite-task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveWhyViral(insight: ExternalTopicInsight | undefined) {
  if (insight?.whyViral?.length) {
    return insight.whyViral.slice(0, 4);
  }

  if (insight?.demandDrivers?.length) {
    return insight.demandDrivers.slice(0, 4);
  }

  return undefined;
}

function resolveCharacteristics(insight: ExternalTopicInsight | undefined) {
  if (insight?.characteristics?.length) {
    return insight.characteristics.slice(0, 4);
  }

  const derived = [
    ...(insight?.structurePatterns?.slice(0, 2) ?? []),
    ...(insight?.stylePatterns?.slice(0, 2) ?? []),
  ].filter(Boolean);

  return derived.length > 0 ? derived.slice(0, 4) : undefined;
}

function buildAnalysisHighlights(
  insight: ExternalTopicInsight,
): ExternalRewriteTaskAnalysisHighlights | undefined {
  const titlePatterns = insight.titlePatterns.slice(0, 4);
  const structurePatterns = insight.structurePatterns.slice(0, 4);
  const emotionalDrivers = insight.emotionalDrivers.slice(0, 3);
  const rewritePotential = prioritizeRewritePotential(insight.rewritePotential);
  const demandSummary = normalizeSingleLine(insight.demandDrivers[0]);
  const styleHint = normalizeSingleLine(insight.stylePatterns[0]);

  const next: ExternalRewriteTaskAnalysisHighlights = {
    ...(titlePatterns.length ? { titlePatterns } : {}),
    ...(structurePatterns.length ? { structurePatterns } : {}),
    ...(emotionalDrivers.length ? { emotionalDrivers } : {}),
    ...(rewritePotential.length ? { rewritePotential } : {}),
    ...(demandSummary ? { demandSummary } : {}),
    ...(styleHint ? { styleHint } : {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

function prioritizeRewritePotential(items: string[]) {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  const mustChange = normalized.filter((item) =>
    /(必须改|不能照搬|不能直接照搬|不要照搬|需要改写)/.test(item),
  );
  const learnings = normalized.filter(
    (item) => !mustChange.includes(item) && /(值得学|更值得学|适合学|可参考|参考)/.test(item),
  );
  const remainder = normalized.filter(
    (item) => !mustChange.includes(item) && !learnings.includes(item),
  );

  return [...mustChange, ...learnings, ...remainder].slice(0, 4);
}

function normalizeSingleLine(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 0 ? normalized : undefined;
}

function buildAnalysisHighlightPromptBlocks(
  highlights: ExternalRewriteTaskAnalysisHighlights | undefined,
) {
  if (!highlights) {
    return [];
  }

  const blocks: string[] = [];

  if (highlights.rewritePotential?.length) {
    blocks.push(
      [
        "仿写约束：",
        ...highlights.rewritePotential.map((item) => `- ${toRewritePotentialPrompt(item)}`),
      ].join("\n"),
    );
  }

  if (highlights.structurePatterns?.length) {
    blocks.push(
      [
        "结构参考：",
        ...highlights.structurePatterns.map((item) => `- ${toStructurePrompt(item)}`),
      ].join("\n"),
    );
  }

  if (highlights.titlePatterns?.length) {
    blocks.push(
      [
        "标题与开头：",
        ...highlights.titlePatterns.map((item) => `- ${toTitlePrompt(item)}`),
      ].join("\n"),
    );
  }

  if (highlights.emotionalDrivers?.length) {
    blocks.push(
      [
        "情绪推进：",
        ...highlights.emotionalDrivers.map((item) => `- ${toEmotionPrompt(item)}`),
      ].join("\n"),
    );
  }

  const lightReminderLines = [
    ...(highlights.demandSummary
      ? [`这批内容主要击中的是：${highlights.demandSummary}`]
      : []),
    ...(highlights.styleHint
      ? [`表达上只做轻提醒：${highlights.styleHint}`]
      : []),
  ];

  if (lightReminderLines.length > 0) {
    blocks.push(["轻量提醒：", ...lightReminderLines].join("\n"));
  }

  return blocks;
}

function toRewritePotentialPrompt(item: string) {
  const normalized = item.trim();
  const cannotCopyMatch = normalized.match(/^(原作者的.+?)不能照搬[，,]必须(.+)$/);

  if (cannotCopyMatch) {
    return `不要照搬${cannotCopyMatch[1]}，要${cannotCopyMatch[2].trim()}`;
  }

  if (/不能照搬|不要照搬/.test(normalized)) {
    return normalized.replace(/^原作者的/, "不要照搬原作者的");
  }

  if (/必须改|需要改写/.test(normalized)) {
    return normalized.replace(/^/, "");
  }

  if (/值得学|更值得学|适合学|可参考|参考/.test(normalized)) {
    return normalized
      .replace(/^更?值得学/, "优先学习")
      .replace(/^适合学/, "优先学习")
      .replace(/^可参考/, "优先参考")
      .replace(/^参考/, "优先参考");
  }

  return normalized;
}

function toStructurePrompt(item: string) {
  const normalized = item.trim();

  if (
    /结论前置/.test(normalized) &&
    (/准备阶段/.test(normalized) || /分阶段/.test(normalized))
  ) {
    return "优先用“结论前置 → 分阶段展开”的骨架组织正文。";
  }

  if (/骨架|结构/.test(normalized)) {
    return normalized
      .replace(/^常见骨架是/, "优先用")
      .replace(/^常用骨架是/, "优先用")
      .replace(/^结构上/, "")
      .replace(/^主体/, "主体")
      .replace(/。$/, "");
  }

  return `优先按这个结构组织：${normalized}`;
}

function toTitlePrompt(item: string) {
  const normalized = item.trim();

  if (normalized.startsWith("标题会把")) {
    return normalized.replace(/^标题会把/, "标题优先把");
  }

  if (normalized.startsWith("标题优先")) {
    return normalized;
  }

  if (/标题/.test(normalized)) {
    return normalized
      .replace(/^标题会/, "标题优先")
      .replace(/^标题常用/, "标题优先")
      .replace(/^标题/, "标题优先");
  }

  return `标题优先借这个抓手：${normalized}`;
}

function toEmotionPrompt(item: string) {
  const normalized = item.trim();

  if (/先用.+再用.+稳/.test(normalized)) {
    return "情绪上先给压力感，再给往前走的方法感。";
  }

  if (/先用|先给/.test(normalized)) {
    return normalized.replace(/^/, "情绪上");
  }

  return `情绪上优先这样推进：${normalized}`;
}
