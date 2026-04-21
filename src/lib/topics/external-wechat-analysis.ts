import { createHash } from "node:crypto";

import { MissingOpenRouterConfigError, getOpenRouterConfig } from "../env/openrouter.ts";
import type {
  ExternalTopicInsight,
  ExternalWechatArticle,
  ExternalWechatTimeWindow,
} from "./external-wechat-types.ts";

type AnalyzeExternalWechatArticlesInput = {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  articles: ExternalWechatArticle[];
};

type StructuredInsightOutput = Pick<
  ExternalTopicInsight,
  | "summary"
  | "titlePatterns"
  | "demandDrivers"
  | "structurePatterns"
  | "stylePatterns"
  | "emotionalDrivers"
  | "rewritePotential"
  | "references"
>;

type ExternalWechatAnalyzer = (
  input: AnalyzeExternalWechatArticlesInput & {
    articles: Array<ExternalWechatArticle & { content: string }>;
  },
) => Promise<StructuredInsightOutput>;

type ExternalWechatAnalysisServiceOptions = {
  analyzer?: ExternalWechatAnalyzer;
  now?: () => string;
};

export class ExternalWechatAnalysisError extends Error {
  readonly code:
    | "missing_analysis_config"
    | "invalid_keyword"
    | "invalid_time_window"
    | "analysis_failed";

  constructor(
    code:
      | "missing_analysis_config"
      | "invalid_keyword"
      | "invalid_time_window"
      | "analysis_failed",
    message: string,
  ) {
    super(message);
    this.name = "ExternalWechatAnalysisError";
    this.code = code;
  }
}

export function createExternalWechatAnalysisService(
  options: ExternalWechatAnalysisServiceOptions = {},
) {
  const analyzer = options.analyzer ?? analyzeWithOpenRouter;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async analyzeExternalWechatArticles(
      input: AnalyzeExternalWechatArticlesInput,
    ): Promise<ExternalTopicInsight> {
      const keyword = input.keyword.trim();

      if (!keyword) {
        throw new ExternalWechatAnalysisError(
          "invalid_keyword",
          "关键词不能为空。",
        );
      }

      if (!["all", "1d", "7d", "6m"].includes(input.timeWindow)) {
        throw new ExternalWechatAnalysisError(
          "invalid_time_window",
          "不支持的时间范围。",
        );
      }

      const successfulArticles = input.articles.filter(
        (
          article,
        ): article is ExternalWechatArticle & {
          content: string;
        } =>
          article.contentFetchStatus === "success" &&
          typeof article.content === "string" &&
          article.content.trim().length > 0,
      );

      const createdAt = now();
      const insightId = createExternalTopicInsightId({
        keyword,
        timeWindow: input.timeWindow,
        createdAt,
      });

      if (successfulArticles.length < 2) {
        return {
          id: insightId,
          keyword,
          timeWindow: input.timeWindow,
          articleIds: successfulArticles.map((article) => article.id),
          summary: "成功补正文样本少于 2 篇，暂不输出完整爆款分析。",
          titlePatterns: [],
          demandDrivers: [],
          structurePatterns: [],
          stylePatterns: [],
          emotionalDrivers: [],
          rewritePotential: [],
          references: [],
          sampleNotice: "成功补正文样本少于 2 篇，分析结果仅供参考。",
          createdAt,
        };
      }

      try {
        const result = await analyzer({
          keyword,
          timeWindow: input.timeWindow,
          articles: successfulArticles,
        });

        return {
          id: insightId,
          keyword,
          timeWindow: input.timeWindow,
          articleIds: successfulArticles.map((article) => article.id),
          summary: normalizeSummary(result.summary),
          titlePatterns: normalizeInsightList(result.titlePatterns),
          demandDrivers: normalizeInsightList(result.demandDrivers),
          structurePatterns: normalizeInsightList(result.structurePatterns),
          stylePatterns: normalizeInsightList(result.stylePatterns),
          emotionalDrivers: normalizeInsightList(result.emotionalDrivers),
          rewritePotential: normalizeInsightList(result.rewritePotential),
          references: normalizeInsightList(result.references),
          whyViral: normalizeInsightList(result.demandDrivers),
          characteristics: normalizeInsightList([
            ...result.structurePatterns,
            ...result.stylePatterns,
          ]),
          createdAt,
        };
      } catch (error) {
        if (error instanceof ExternalWechatAnalysisError) {
          throw error;
        }

        throw new ExternalWechatAnalysisError(
          "analysis_failed",
          "爆款分析失败，请稍后重试。",
        );
      }
    },
  };
}

function createExternalTopicInsightId(input: {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  createdAt: string;
}) {
  const digest = createHash("sha1")
    .update(`${input.keyword}|${input.timeWindow}|${input.createdAt}`)
    .digest("hex")
    .slice(0, 12);

  return `extinsight-${digest}`;
}

function normalizeInsightList(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function analyzeWithOpenRouter(
  input: AnalyzeExternalWechatArticlesInput & {
    articles: Array<ExternalWechatArticle & { content: string }>;
  },
): Promise<StructuredInsightOutput> {
  let config: ReturnType<typeof getOpenRouterConfig>;

  try {
    config = getOpenRouterConfig();
  } catch (error) {
    if (error instanceof MissingOpenRouterConfigError) {
      throw new ExternalWechatAnalysisError(
        "missing_analysis_config",
        "未配置爆款分析模型，暂时无法分析。",
      );
    }

    throw error;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是一名擅长拆解公众号爆款文章的内容分析师。你只能基于提供的正文样本给出判断，不要凭空补充。请输出 JSON，字段固定为 summary、titlePatterns、demandDrivers、structurePatterns、stylePatterns、emotionalDrivers、rewritePotential、references。每个数组最多 4 条，句子简洁，不要重复 summary。",
        },
        {
          role: "user",
          content: buildAnalysisPrompt(input),
        },
      ],
      response_format: {
        type: "json_object",
      },
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new ExternalWechatAnalysisError(
      "analysis_failed",
      `analysis request failed: ${response.status}`,
    );
  }

  const payload = JSON.parse(responseText) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };
  const content = extractTextContent(payload.choices?.[0]?.message?.content);

  if (!content) {
    throw new ExternalWechatAnalysisError(
      "analysis_failed",
      "analysis response was empty",
    );
  }

  const parsed = parseInsightJson(content);

  return {
    summary: normalizeSummary(parsed.summary),
    titlePatterns: normalizeArrayField(parsed.titlePatterns),
    demandDrivers: normalizeArrayField(parsed.demandDrivers),
    structurePatterns: normalizeArrayField(parsed.structurePatterns),
    stylePatterns: normalizeArrayField(parsed.stylePatterns),
    emotionalDrivers: normalizeArrayField(parsed.emotionalDrivers),
    rewritePotential: normalizeArrayField(parsed.rewritePotential),
    references: normalizeArrayField(parsed.references),
  };
}

function buildAnalysisPrompt(
  input: AnalyzeExternalWechatArticlesInput & {
    articles: Array<ExternalWechatArticle & { content: string }>;
  },
) {
  const articleSections = input.articles
    .map((article, index) => {
      const trimmedContent = (article.content ?? "").trim().slice(0, 2_500);

      return [
        `样本 ${index + 1}`,
        `标题：${article.title}`,
        `公众号：${article.accountName}`,
        article.publishTime ? `发布时间：${article.publishTime}` : undefined,
        "正文：",
        trimmedContent,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  return [
    `关键词：${input.keyword}`,
    `时间范围：${input.timeWindow}`,
    `成功补正文样本数：${input.articles.length}`,
    "",
    "请基于下面这些公众号正文样本，分析这个选题为什么容易成为爆款、它们的共同特点，以及哪些点更适合后续找题与仿写参考。",
    "要求：",
    "1. 只能基于正文样本，不要只看标题。",
    "2. 输出 JSON 对象。",
    "3. summary 是一句简洁总括，不要重复后面的维度。",
    "4. titlePatterns 输出标题特点，聚焦标题为什么容易被点开、哪些表达值得借鉴。",
    "5. demandDrivers 输出痛点与需求方向，聚焦用户为什么会主动点开。",
    "6. structurePatterns 输出内容结构，聚焦开头、主体展开和结尾收束的常见骨架。",
    "7. stylePatterns 输出表达风格，聚焦语气、句式节奏、表达颗粒度。",
    "8. emotionalDrivers 输出情绪驱动，聚焦什么情绪推动传播，以及是标题触发还是正文累积。",
    "9. rewritePotential 输出可仿写性，必须明确写出值得学什么、哪些必须改。",
    "10. references 输出最终结论层，概括最值得带走的参考点，不要简单重复前面 6 个维度。",
    "11. 每个数组都输出 2-4 条简洁中文句子。",
    "",
    articleSections,
  ].join("\n");
}

function parseInsightJson(content: string) {
  const normalized = content.trim();
  const fencedMatch = normalized.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? normalized;

  return JSON.parse(candidate) as {
    summary?: unknown;
    titlePatterns?: unknown;
    demandDrivers?: unknown;
    structurePatterns?: unknown;
    stylePatterns?: unknown;
    emotionalDrivers?: unknown;
    rewritePotential?: unknown;
    references?: unknown;
  };
}

function normalizeSummary(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "这批样本围绕同一高热选题展开，但当前总结仍较保守。";
}

function normalizeArrayField(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function extractTextContent(
  content: string | Array<{ type?: string; text?: string }> | undefined,
) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => (item?.type === "text" && typeof item.text === "string" ? item.text : ""))
    .join("")
    .trim();
}
