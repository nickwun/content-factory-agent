import {
  MissingOpenRouterConfigError,
  getOpenRouterConfig,
  getOpenRouterLongformConfig,
} from "../env/openrouter.ts";
import type {
  TwitterContent,
  VideoScriptContent,
  WechatArticleContent,
  XiaohongshuContent,
} from "../types/history.ts";
import type { WechatArticleGenerationResult } from "./generation-service.ts";
import type { GenerationContext } from "./generation-context.ts";
import {
  countWechatMarkdownWords,
  resolveWechatMarkdownBody,
} from "../workspace/wechat-markdown.ts";
import { readWechatFinalizerHumanizedSkill } from "./wechat-finalizer-humanized-skill.ts";
import { readWechatWriterHumanizedSkill } from "./wechat-writer-humanized-skill.ts";
import { trimWechatArticlePostFinalization } from "./wechat-post-trimmer.ts";
import { buildRewriteBrief, REWRITE_BRIEF_VERSION } from "../rewrite/rewrite-brief.ts";
import type { RewriteBrief } from "../rewrite/rewrite-brief-types.ts";
import {
  chunkRewriteSourceText,
  type RewriteChunk,
} from "../rewrite/rewrite-chunking.ts";
import {
  assertMeaningfulXiaohongshuContent,
  extractXiaohongshuJsonPayload,
  normalizeXiaohongshuOutput,
} from "./xiaohongshu-output.ts";
import {
  assertMeaningfulTwitterContent,
  extractTwitterJsonPayload,
  normalizeTwitterOutput,
} from "./twitter-output.ts";
import {
  assertMeaningfulWechatArticle,
  extractWechatArticleJsonPayload,
  normalizeWechatArticleOutput,
} from "./wechat-output.ts";
import {
  assertMeaningfulVideoScript,
  extractVideoScriptJsonPayload,
  normalizeVideoScriptOutput,
} from "./video-script-output.ts";

const DEFAULT_TWITTER_SYSTEM_PROMPT =
  "你是一名擅长中文 Twitter/X 内容创作的资深作者，请输出观点清晰、节奏紧凑、适合社交传播的内容草稿。";
const DEFAULT_XIAOHONGSHU_SYSTEM_PROMPT =
  "你是一名擅长中文小红书图文创作的资深作者，请输出更适合种草、经验分享和生活方式表达的内容草稿。";
const DEFAULT_VIDEO_SCRIPT_SYSTEM_PROMPT =
  "你是一名擅长中文短视频脚本创作的资深编导，请输出分镜清楚、口播自然、适合短视频拍摄的结构化脚本。";

export const OPENROUTER_REQUEST_TIMEOUT_MS = 35_000;
export const OPENROUTER_MAX_ATTEMPTS = 2;
export const MAX_REWRITE_PROMPT_SOURCE_CHARS = 6_000;
export const MEDIUM_REWRITE_MODEL_OVERRIDE_CHAR_THRESHOLD = 2_000;
export const MEDIUM_SHORT_REWRITE_PROMPT_SOURCE_CHARS = 1_800;
const OPENROUTER_RETRY_DELAY_MS = 250;

export class OpenRouterGenerationError extends Error {
  code: "missing_openrouter_config" | "generation_failed" | "generation_timeout";

  constructor(
    code: "missing_openrouter_config" | "generation_failed" | "generation_timeout",
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterGenerationError";
    this.code = code;
  }
}

export async function generateWechatArticleWithOpenRouter(
  context: GenerationContext,
): Promise<WechatArticleContent | WechatArticleGenerationResult> {
  const config = getValidatedOpenRouterConfig();
  const model = getTextGenerationModelForContext(context, "wechat_article");
  const promptContext = getWechatPromptContext(context);

  try {
    const draftArticle = await generateWechatArticleDraftWithOpenRouter(
      config,
      context,
      promptContext,
      model,
    );

    if (!context.wechatFinalization?.enabled) {
      return draftArticle;
    }

    try {
      const finalizedArticle = await finalizeWechatArticleDraftWithOpenRouter(
        config,
        context,
        draftArticle,
        model,
      );

      return {
        article: finalizedArticle,
        finalizationApplied: true,
      };
    } catch {
      return {
        article: draftArticle,
        finalizationApplied: false,
      };
    }
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export async function generateTwitterDraftWithOpenRouter(
  context: GenerationContext,
): Promise<TwitterContent> {
  const config = getValidatedOpenRouterConfig();
  const model = getTextGenerationModelForContext(context, "twitter");

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.twitter?.promptTemplate.trim() ||
            DEFAULT_TWITTER_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildTwitterUserPrompt(context),
        },
      ], { model }),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractTwitterJsonPayload(payload);
    const twitterDraft = normalizeTwitterOutput(parsed);
    assertMeaningfulTwitterContent(twitterDraft);
    return twitterDraft;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

async function generateWechatArticleDraftWithOpenRouter(
  config: OpenRouterConfig,
  context: GenerationContext,
  promptContext: WechatRewritePromptInput,
  model?: string,
) {
  const systemPrompt = await getWechatWriterSystemPrompt(
    context.promptSettings.wechat_article?.promptTemplate.trim(),
  );
  const completion = await runOpenRouterRequest(() =>
    requestOpenRouterChatCompletion(
      config,
      [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: buildWechatUserPrompt(promptContext),
        },
      ],
      { model },
    ),
  );

  const content = completion.choices?.[0]?.message?.content;
  const payload = extractTextContent(content);

  if (!payload) {
    throw new Error("Empty response payload");
  }

  const parsed = extractWechatArticleJsonPayload(payload);
  const article = normalizeWechatArticleOutput(parsed);
  assertMeaningfulWechatArticle(article);
  return article;
}

async function finalizeWechatArticleDraftWithOpenRouter(
  config: OpenRouterConfig,
  context: GenerationContext,
  draftArticle: WechatArticleContent,
  model?: string,
) {
  const finalization = context.wechatFinalization;

  if (!finalization?.enabled) {
    return draftArticle;
  }

  const draftBody = resolveWechatMarkdownBody(draftArticle);
  const currentBodyWords = countWechatMarkdownWords("", draftBody).bodyCount;
  const mode = resolveWechatFinalizationPassMode({
    draftBody,
    targetMinWords: finalization.targetMinWords,
    targetMaxWords: finalization.targetMaxWords,
  });
  const article = await runWechatFinalizationPass({
    config,
    model,
    context,
    draftArticle,
    currentBodyWords,
    targetMinWords: finalization.targetMinWords,
    targetMaxWords: finalization.targetMaxWords,
    oneSentencePerParagraph: finalization.oneSentencePerParagraph,
    keepSectionStructure: finalization.keepSectionStructure,
    mode,
    aggressiveCompression: false,
  });

  if (
    !shouldAcceptWechatFinalizationResult({
      draftArticle,
      finalizedArticle: article,
      mode,
    })
  ) {
    return draftArticle;
  }

  const acceptedArticle = article;

  const postTrimmedArticle = trimWechatArticlePostFinalization(acceptedArticle).article;
  assertMeaningfulWechatArticle(postTrimmedArticle);
  return postTrimmedArticle;
}

export async function getWechatWriterSystemPrompt(presetPrompt?: string) {
  const writerSkillPrompt = await readWechatWriterHumanizedSkill();

  if (!presetPrompt) {
    return writerSkillPrompt;
  }

  return [
    writerSkillPrompt,
    "",
    "## 当前平台风格预设",
    "下面这部分只负责补充本次平台风格、语气和偏好，不得覆盖或削弱上面的写作 skill。",
    presetPrompt,
  ].join("\n");
}

export async function getWechatFinalizationSystemPrompt() {
  return readWechatFinalizerHumanizedSkill();
}

async function runWechatFinalizationPass(input: {
  config: OpenRouterConfig;
  context: GenerationContext;
  draftArticle: WechatArticleContent;
  model?: string;
  currentBodyWords: number;
  targetMinWords: number;
  targetMaxWords: number;
  oneSentencePerParagraph: boolean;
  keepSectionStructure: boolean;
  mode: WechatFinalizationPassMode;
  aggressiveCompression: boolean;
}) {
  const finalizationSystemPrompt = await getWechatFinalizationSystemPrompt();
  const draftBody = resolveWechatMarkdownBody(input.draftArticle);
  const completion = await runOpenRouterRequest(() =>
    requestOpenRouterChatCompletion(
      input.config,
      [
        {
          role: "system",
          content: finalizationSystemPrompt,
        },
        {
          role: "user",
          content: buildWechatFinalizationUserPrompt({
            userPrompt: input.context.userPrompt,
            draftTitle: input.draftArticle.title,
            draftBody,
            currentBodyWords: input.currentBodyWords,
            targetMinWords: input.targetMinWords,
            targetMaxWords: input.targetMaxWords,
            oneSentencePerParagraph: input.oneSentencePerParagraph,
            keepSectionStructure: input.keepSectionStructure,
            mode: input.mode,
            aggressiveCompression: input.aggressiveCompression,
          }),
        },
      ],
      { model: input.model },
    ),
  );

  const content = completion.choices?.[0]?.message?.content;
  const payload = extractTextContent(content);

  if (!payload) {
    throw new Error("Empty finalization payload");
  }

  const parsed = extractWechatArticleJsonPayload(payload);
  return applyWechatFinalizationResult(
    input.draftArticle,
    normalizeWechatArticleOutput(parsed),
  );
}

export async function generateXiaohongshuDraftWithOpenRouter(
  context: GenerationContext,
): Promise<XiaohongshuContent> {
  const config = getValidatedOpenRouterConfig();
  const model = getTextGenerationModelForContext(context, "xiaohongshu");

  try {
    if (context.rewriteMode === "long_source" && context.rewriteBrief) {
      const outline = await generateXiaohongshuLongformOutline(
        config,
        model,
        context,
      );

      const completion = await runOpenRouterRequest(() =>
        requestOpenRouterChatCompletion(
          config,
          [
            {
              role: "system",
              content:
                context.promptSettings.xiaohongshu?.promptTemplate.trim() ||
                DEFAULT_XIAOHONGSHU_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: buildLongformXiaohongshuUserPrompt(context, outline),
            },
          ],
          { model },
        ),
      );

      const content = completion.choices?.[0]?.message?.content;
      const payload = extractTextContent(content);

      if (!payload) {
        throw new Error("Empty response payload");
      }

      const parsed = extractXiaohongshuJsonPayload(payload);
      const xiaohongshuDraft = normalizeXiaohongshuOutput(parsed, {
        preserveLongformCaption: true,
      });
      assertMeaningfulXiaohongshuContent(xiaohongshuDraft);
      return xiaohongshuDraft;
    }

    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.xiaohongshu?.promptTemplate.trim() ||
            DEFAULT_XIAOHONGSHU_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildXiaohongshuUserPrompt(context),
        },
      ], { model }),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractXiaohongshuJsonPayload(payload);
    const xiaohongshuDraft = normalizeXiaohongshuOutput(parsed);
    assertMeaningfulXiaohongshuContent(xiaohongshuDraft);
    return xiaohongshuDraft;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export async function generateVideoScriptWithOpenRouter(
  context: GenerationContext,
): Promise<VideoScriptContent> {
  const config = getValidatedOpenRouterConfig();
  const model = getTextGenerationModelForContext(context, "video_script");

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.video_script?.promptTemplate.trim() ||
            DEFAULT_VIDEO_SCRIPT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildVideoScriptUserPrompt(context),
        },
      ], { model }),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractVideoScriptJsonPayload(payload);
    const videoScript = normalizeVideoScriptOutput(parsed);
    assertMeaningfulVideoScript(videoScript);
    return videoScript;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export function getValidatedOpenRouterConfig() {
  try {
    return getOpenRouterConfig();
  } catch (error) {
    if (error instanceof MissingOpenRouterConfigError) {
      throw new OpenRouterGenerationError("missing_openrouter_config", error.message);
    }

    throw error;
  }
}

export async function extractRewriteBriefWithOpenRouter(input: {
  chunks: RewriteChunk[];
}): Promise<RewriteBrief> {
  const config = getValidatedOpenRouterLongformConfig();

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(
        {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.briefModel,
        },
        [
          {
            role: "system",
            content:
              "你是一名中文长文结构分析助手。你的任务是提取仿写底稿，用于后续重写成完整平台内容。请保持中性理解，不要生成成品，不要加入平台写作风格。",
          },
          {
            role: "user",
            content: buildRewriteBriefExtractionPrompt(input.chunks),
          },
        ],
      ),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty rewrite brief payload");
    }

    return normalizeRewriteBriefOutput(extractRewriteBriefJsonPayload(payload), input.chunks);
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "Rewrite brief generation failed",
    );
  }
}

export async function runOpenRouterRequest<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OpenRouterGenerationError) {
        throw error;
      }

      lastError = error;

      if (!shouldRetryOpenRouterError(error) || attempt === OPENROUTER_MAX_ATTEMPTS) {
        throw normalizeOpenRouterError(error);
      }

      await delay(OPENROUTER_RETRY_DELAY_MS);
    }
  }

  throw normalizeOpenRouterError(lastError);
}

type RewritePromptInput = Pick<GenerationContext, "userPrompt" | "rewriteSource"> &
  Partial<Pick<GenerationContext, "rewriteMode" | "rewriteBrief">>;
type WechatRewritePromptInput = RewritePromptInput;
type LongformRewritePromptInput = RewritePromptInput;
type XiaohongshuLongformOutline = {
  openingHook: string;
  bodySections: Array<{
    index: number;
    focus: string;
    purpose: string;
    mustKeepPoints: string[];
    supportingDetails: string[];
    transitionToNext?: string;
  }>;
  closingWrapUp: string;
};

export function buildWechatUserPrompt(input: WechatRewritePromptInput) {
  if (!input.rewriteSource) {
    return buildStandardWechatUserPrompt(input.userPrompt);
  }

  if (input.rewriteMode === "long_source" && input.rewriteBrief) {
    return buildLongformWechatUserPrompt(input);
  }

  if (input.rewriteBrief) {
    return buildStructuredWechatUserPrompt(input);
  }

  return [
    "请根据下面提供的原文和仿写要求，生成一篇中文公众号文章。",
    "仿写原则：",
    "1. 基于原文的主题、结构和论点推进方式进行仿写。",
    "2. 不要直接复制原文句子或大段表述。",
    "3. 可以借鉴原文的信息组织方式，但必须重新组织语言。",
    "4. 输出必须服从目标平台 schema 和当前平台提示词。",
    "要求：",
    "1. 保持中文表达自然、结构清楚、适合公众号长文阅读。",
    "2. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown 代码块。",
    "3. JSON 格式必须优先为：{\"title\":\"...\",\"markdownBody\":\"...\"}。",
    "4. markdownBody 只使用常见 Markdown：# / ## / ###、普通段落、引用 >、列表、分割线 ---、**粗体**、*斜体*、链接。",
    "5. 不要输出表格、数学公式、Mermaid、图片正文流或代码高亮块。",
    "6. 标题写在 title 字段，正文全部写在 markdownBody。",
    "8. 文章要有明确标题和完整正文结构，避免空字段。",
    "9. 输出完整公众号成稿，不是摘要、不是提纲、不是要点概述。",
    buildWechatDraftLengthBudgetSection(),
    buildWechatTemplateBlacklistSection(),
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteSourceSection(input),
  ].join("\n");
}

export function buildWechatFinalizationUserPrompt(input: {
  userPrompt: string;
  draftTitle: string;
  draftBody: string;
  currentBodyWords: number;
  targetMinWords: number;
  targetMaxWords: number;
  oneSentencePerParagraph: boolean;
  keepSectionStructure: boolean;
  mode: WechatFinalizationPassMode;
  aggressiveCompression?: boolean;
}) {
  const modeSection = buildWechatFinalizationModeSection(input.mode, {
    currentBodyWords: input.currentBodyWords,
    targetMinWords: input.targetMinWords,
    targetMaxWords: input.targetMaxWords,
    aggressiveCompression: input.aggressiveCompression === true,
  });

  return [
    "以下是本次公众号成稿整理的运行上下文。",
    "system skill 规则优先，下面这些信息只用于收紧本次整理边界，不得覆盖或削弱 skill 的要求。",
    "这一步只能基于当前初稿做整理，不得把它当成一次新的写作任务。",
    "标题锁定：最终标题必须原样返回，不允许修改标题。",
    "整理目标：",
    `- 正文字数尽量收束到 ${input.targetMinWords}-${input.targetMaxWords} 字。`,
    input.oneSentencePerParagraph
      ? "- 尽量一句话一段，减少阅读压力。"
      : null,
    input.keepSectionStructure
      ? "- 保持章节结构清楚，小标题单独一行，结尾自然收束。"
      : null,
    ...modeSection,
    "输出要求：",
    "1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown 代码块。",
    '2. JSON 格式必须优先为：{"title":"...","markdownBody":"..."}。',
    "3. markdownBody 只使用常见 Markdown：# / ## / ###、普通段落、引用 >、列表、分割线 ---、**粗体**、*斜体*、链接。",
    "4. 不要输出表格、数学公式、Mermaid、图片正文流或代码高亮块。",
    "5. 标题写在 title 字段，正文全部写在 markdownBody。",
    "",
    "第一段写作意图已体现在初稿中，不要借 userPrompt 重新起稿、扩写或改变文章方向。",
    input.userPrompt ? `第一段写作意图（只作背景提醒）：${input.userPrompt}` : null,
    `初稿标题：${input.draftTitle}`,
    "初稿正文：",
    input.draftBody,
  ]
    .filter(Boolean)
    .join("\n");
}

export type WechatFinalizationPassMode = "compress" | "light" | "expand";

export function applyWechatFinalizationResult(
  draftArticle: WechatArticleContent,
  finalizedArticle: WechatArticleContent,
): WechatArticleContent {
  return {
    ...finalizedArticle,
    title: draftArticle.title,
  };
}

export function shouldAcceptWechatFinalizationResult(input: {
  draftArticle: WechatArticleContent;
  finalizedArticle: WechatArticleContent;
  mode: WechatFinalizationPassMode;
}) {
  const draftBody = resolveWechatMarkdownBody(input.draftArticle);
  const finalizedBody = resolveWechatMarkdownBody(input.finalizedArticle);
  const draftBodyWords = countWechatMarkdownWords("", draftBody).bodyCount;
  const finalizedBodyWords = countWechatMarkdownWords("", finalizedBody).bodyCount;

  if (input.mode === "compress") {
    return finalizedBodyWords <= draftBodyWords;
  }

  if (input.mode === "light") {
    const draftHeadingCount = input.draftArticle.blocks.filter(
      (block) => block.type === "heading",
    ).length;
    const finalizedHeadingCount = input.finalizedArticle.blocks.filter(
      (block) => block.type === "heading",
    ).length;

    if (finalizedBodyWords > draftBodyWords + 40) {
      return false;
    }

    if (finalizedHeadingCount > draftHeadingCount + 1) {
      return false;
    }
  }

  return true;
}

export function resolveWechatFinalizationPassMode(input: {
  draftBody: string;
  targetMinWords: number;
  targetMaxWords: number;
}): WechatFinalizationPassMode {
  const bodyCount = countWechatMarkdownWords("", input.draftBody).bodyCount;

  if (bodyCount > input.targetMaxWords) {
    return "compress";
  }

  if (bodyCount < input.targetMinWords) {
    return "expand";
  }

  return "light";
}

export function shouldRunAggressiveWechatCompressPass(input: {
  mode: WechatFinalizationPassMode;
  finalizedBodyWords: number;
  targetMaxWords: number;
}) {
  void input;
  return false;
}

function buildWechatFinalizationModeSection(
  mode: WechatFinalizationPassMode,
  input: {
    currentBodyWords: number;
    targetMinWords: number;
    targetMaxWords: number;
    aggressiveCompression: boolean;
  },
) {
  switch (mode) {
    case "compress":
      return input.aggressiveCompression
        ? [
            "当前任务：强压缩补刀模式。",
            `- 当前整理结果正文约 ${input.currentBodyWords} 字，仍高于目标上限 ${input.targetMaxWords} 字。`,
            "- 这是 compress 模式下的额外强压缩补刀，只允许继续做减法，不允许边删边补。",
            "- 这一步请更敢删解释型句子：如果一个观点已经成立，后面只是再解释一遍、换个说法重复、或让文章显得更完整的句子，优先删除。",
            "- 第一优先级删除：重复表达、空泛抒情、无信息增量的态度句、重复举例、反复解释同一观点的句子。",
            "- 第二优先级删除：过长过渡段、重复的小标题导语、同义改写式重复句。",
            "- 第三优先级删除：不影响主线的补充细节。",
            `- 本次补刀压缩请尽量把正文收进 ${Math.max(input.targetMinWords, 1100)}-${Math.min(input.targetMaxWords, 1300)} 字，宁可略短，也不要继续明显高于上限。`,
            "- 禁止为了顺滑补新的过渡句，禁止为了完整补新的态度句，禁止为了更像成稿补新的总结句。",
            "- 禁止新增小标题、禁止新增开号段落、禁止重组成教程稿，标题继续完全锁定。",
          ]
        : [
            "当前任务：压缩整理模式。",
            `- 当前初稿正文约 ${input.currentBodyWords} 字，需要至少删减约 ${Math.max(input.currentBodyWords - input.targetMaxWords, 0)} 字。`,
            "- 当前正文超出目标区间，主要动作只能是做减法和轻微修顺，不要通过重新表达一遍来实现压缩。",
            "- 如果一个观点已经成立，后面那句只是再解释一遍、换个说法重复或让文章显得更完整，请优先删除那句。",
            "- 第一优先级删除：重复表达、空泛抒情、无信息增量的态度句、重复举例、反复解释同一观点的句子。",
            "- 第二优先级删除：过长过渡段、重复的小标题导语、同义改写式重复句。",
            "- 第三优先级删除：不影响主线的补充细节。",
            "- 优先在现有段落内部删句、删冗余、收短段落，而不是重写整段。",
            "- 禁止为了顺滑补新的过渡句，禁止为了完整补新的态度句，禁止为了更像成稿补新的总结句。",
            "- 禁止新增小标题、禁止新增开号段落、禁止新增总结性拔高段落。",
            "- 不要把结构重组得更像教程稿，不要把自然叙述改成结论轰炸。",
          ];
    case "expand":
      return [
        "当前任务：少量补足模式。",
        `- 当前初稿正文约 ${input.currentBodyWords} 字，仍低于目标区间，最多补足约 ${Math.max(input.targetMinWords - input.currentBodyWords, 0)} 字。`,
        "- 当前正文低于目标区间，只补必要解释和贴近原意的展开。",
        "- 不要注水，不要靠增强修辞、强化开号感或拉高情绪来凑字数。",
      ];
    case "light":
    default:
      return [
        "当前任务：轻排版整理模式。",
        `- 当前初稿正文约 ${input.currentBodyWords} 字，已在目标区间内。`,
        "- 当前正文已在目标区间内，不主动扩写，也不主动压缩。",
        "- 只允许切短段落、小标题轻整理和个别句子修顺。",
        "- 不允许新增章节、不允许新增开号式段落、不允许明显重组文章结构。",
        "- 不允许扩写正文，不允许新增观点，不允许把内容整理得更像模板化教程稿。",
      ];
  }
}

function buildStructuredWechatUserPrompt(input: WechatRewritePromptInput) {
  const brief = input.rewriteBrief;

  if (!brief) {
    return buildStandardWechatUserPrompt(input.userPrompt);
  }

  return [
    "请根据下面提供的仿写底稿和仿写要求，生成一篇完整的中文公众号文章。",
    "重要原则：",
    "1. 输出的是完整公众号成稿，不是摘要，不是提纲，不是要点概述。",
    "2. 必须基于仿写底稿重新组织语言，不要直接复制原文句子。",
    "3. 要保留原文的结构推进感、论证节奏和核心观点，但表达必须重写。",
    "4. 必须保留以下论点，并在正文中真正展开，而不是一句带过。",
    "5. 输出必须严格服从公众号 JSON schema。",
    "要求：",
    "1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown 代码块。",
    "2. JSON 格式必须优先为：{\"title\":\"...\",\"markdownBody\":\"...\"}。",
    "3. markdownBody 只使用常见 Markdown：# / ## / ###、普通段落、引用 >、列表、分割线 ---、**粗体**、*斜体*、链接。",
    "4. 不要输出表格、数学公式、Mermaid、图片正文流或代码高亮块。",
    "5. 标题写在 title 字段，正文全部写在 markdownBody。",
    buildWechatDraftLengthBudgetSection(),
    buildWechatTemplateBlacklistSection(),
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteBriefSection(brief),
  ].join("\n");
}

function buildLongformWechatUserPrompt(input: WechatRewritePromptInput) {
  const brief = input.rewriteBrief;

  if (!brief) {
    return buildStandardWechatUserPrompt(input.userPrompt);
  }

  return [
    "请根据下面提供的长文仿写底稿和仿写要求，生成一篇完整的中文公众号文章。",
    "重要原则：",
    "1. 输出的是完整公众号成稿，不是摘要，不是提纲，不是要点概述。",
    "2. 要保留原文的结构推进感和论证节奏，但必须重写语言，不直接复制原文句子。",
    "3. 最终成文必须服从目标平台 schema 和当前平台提示词。",
    "4. 对于“必须保留的论点”，不得遗漏、弱化或改写成无关表达。",
    "要求：",
    "1. 保持中文表达自然、结构清楚、适合公众号长文阅读。",
    "2. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown 代码块。",
    "3. JSON 格式必须优先为：{\"title\":\"...\",\"markdownBody\":\"...\"}。",
    "4. markdownBody 只使用常见 Markdown：# / ## / ###、普通段落、引用 >、列表、分割线 ---、**粗体**、*斜体*、链接。",
    "5. 不要输出表格、数学公式、Mermaid、图片正文流或代码高亮块。",
    "6. 文章要有明确标题和完整正文结构，避免空字段。",
    buildWechatDraftLengthBudgetSection(),
    buildWechatTemplateBlacklistSection(),
    "",
    `仿写要求：${input.userPrompt}`,
    "",
    `仿写底稿主题：${brief.theme}`,
    `原文规模：约 ${brief.sourceStats.totalChars} 字，${brief.sourceStats.totalChunks} 个内容块，${brief.sourceStats.estimatedParagraphGroups} 个段落组。`,
    "",
    "核心观点：",
    ...brief.coreClaims.map((claim, index) => `${index + 1}. ${claim}`),
    "",
    "必须保留以下论点（硬约束）：",
    ...brief.mustKeepPoints.map((point, index) => `${index + 1}. ${point}`),
    "",
    "可复用的信息与事实材料：",
    ...brief.reusableFacts.map((fact, index) => `${index + 1}. ${fact}`),
    "",
    "语气与论证节奏：",
    `- 整体语气：${brief.toneProfile.overallTone}`,
    `- 推进节奏：${brief.toneProfile.pacing}`,
    `- 情绪温度：${brief.toneProfile.emotionalTemperature}`,
    `- 修辞动作：${brief.toneProfile.rhetoricalMoves.join("、") || "无"}`,
    "",
    "结构推进底稿：",
    ...brief.structureFlow.map((item) =>
      [
        `${item.index + 1}. [${item.role}] ${item.summary}`,
        `关键点：${item.keyPoints.join("；") || "无"}`,
        item.transitionToNext ? `衔接：${item.transitionToNext}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
    "整体论证节奏：",
    `- 开场方式：${brief.argumentCadence.openingMove}`,
    `- 推进模式：${brief.argumentCadence.progressionPattern}`,
    `- 证据风格：${brief.argumentCadence.evidenceStyle}`,
    `- 收束方式：${brief.argumentCadence.endingMove}`,
  ].join("\n");
}

function buildStandardWechatUserPrompt(userPrompt: string) {
  return [
    "请根据下面的仿写输入，生成一篇中文公众号文章。",
    "要求：",
    "1. 保持中文表达自然、结构清楚、适合公众号长文阅读。",
    "2. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown 代码块。",
    "3. JSON 格式必须优先为：{\"title\":\"...\",\"markdownBody\":\"...\"}。",
    "4. markdownBody 只使用常见 Markdown：# / ## / ###、普通段落、引用 >、列表、分割线 ---、**粗体**、*斜体*、链接。",
    "5. 不要输出表格、数学公式、Mermaid、图片正文流或代码高亮块。",
    "6. 文章要有明确标题和完整正文结构，避免空字段。",
    buildWechatDraftLengthBudgetSection(),
    buildWechatTemplateBlacklistSection(),
    "",
    `仿写输入：${userPrompt}`,
  ].join("\n");
}

function buildWechatDraftLengthBudgetSection() {
  return [
    "章节长度感知：",
    "- 开头：150-220 字，负责自然起题，不要过肥。",
    "- 每个正文模块：220-320 字，优先把观点讲清，不要反复解释。",
    "- 结尾：100-180 字，负责收束，不要再铺开一层新解释。",
    "- 这只是长度预算提示，不是硬模板，不要为了凑结构把文章写得机械。",
  ].join("\n");
}

function buildWechatTemplateBlacklistSection() {
  return [
    "避免高频模板腔词句：",
    "- 尽量不要使用：首先、其次、最后、总而言之、不难发现、毋庸置疑、可以说、不仅仅是、某种意义上、值得一提的是。",
    "- 不要为了显得完整而堆模板式承接句、正确废话句或教程腔总结句。",
  ].join("\n");
}

export function buildTwitterUserPrompt(input: RewritePromptInput) {
  if (!input.rewriteSource) {
    return buildStandardTwitterUserPrompt(input.userPrompt);
  }

  if ("rewriteMode" in input && input.rewriteMode === "long_source" && input.rewriteBrief) {
    return buildLongformTwitterUserPrompt(input);
  }

  return [
    "请根据下面提供的原文和仿写要求，生成一组适合 Twitter/X 的中文内容草稿。",
    "仿写原则：",
    "1. 基于原文的主题、结构和论点推进方式仿写。",
    "2. 不要直接复制原文句子或明显改写原句。",
    "3. 可以借鉴原文的观点推进顺序，但要重写成适合社交平台的表达。",
    "4. 输出必须服从目标平台 schema 和当前平台提示词。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"recommendedMode":"single|thread","singleDraft":"...","threadDraft":["..."]}。',
    "3. 你可以判断这次内容更适合 single 还是 thread，但如果给出 thread，threadDraft 至少要包含 2 条。",
    "4. singleDraft 应该像一条真实可发的推文，不要写成公众号摘要或长篇小作文。",
    "5. threadDraft 中每条都应该像独立 tweet，可连贯阅读，但不要重复。",
    "6. 用中文输出，表达简洁、观点明确、适合社交平台传播。",
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteSourceSection(input),
  ].join("\n");
}

function buildLongformTwitterUserPrompt(input: LongformRewritePromptInput) {
  const brief = input.rewriteBrief;

  if (!brief) {
    return buildStandardTwitterUserPrompt(input.userPrompt);
  }

  return [
    "请根据下面提供的长文仿写底稿，生成一组完整、可直接编辑的 Twitter/X 中文内容草稿。",
    "重要原则：",
    "1. 输出的是完整平台内容，不是摘要、不是提纲、不是要点概述。",
    "2. 基于原文主题、结构推进和核心观点进行重写，不要直接复制原文句子。",
    "3. 必须服从目标平台 schema 和当前平台提示词。",
    "4. 对于“必须保留的论点”，不得遗漏或替换成无关表达。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"recommendedMode":"single|thread","singleDraft":"...","threadDraft":["..."]}。',
    "3. 如果给出 thread，threadDraft 至少包含 2 条，并保持推进感。",
    "4. 表达要适合社交平台，不要写成公众号摘要。",
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteBriefSection(brief),
  ].join("\n");
}

function buildStandardTwitterUserPrompt(userPrompt: string) {
  return [
    "请根据下面的仿写输入，生成一组适合 Twitter/X 的中文内容草稿。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"recommendedMode":"single|thread","singleDraft":"...","threadDraft":["..."]}。',
    "3. 你可以判断这次内容更适合 single 还是 thread，但如果给出 thread，threadDraft 至少要包含 2 条。",
    "4. singleDraft 应该像一条真实可发的推文，不要写成公众号摘要或长篇小作文。",
    "5. threadDraft 中每条都应该像独立 tweet，可连贯阅读，但不要重复。",
    "6. 用中文输出，表达简洁、观点明确、适合社交平台传播。",
    "",
    `仿写输入：${userPrompt}`,
  ].join("\n");
}

export function buildXiaohongshuUserPrompt(input: RewritePromptInput) {
  if (!input.rewriteSource) {
    return buildStandardXiaohongshuUserPrompt(input.userPrompt);
  }

  if ("rewriteMode" in input && input.rewriteMode === "long_source" && input.rewriteBrief) {
    return buildLongformXiaohongshuUserPrompt(input);
  }

  return [
    "请根据下面提供的原文和仿写要求，生成一篇适合小红书发布的中文图文草稿。",
    "仿写原则：",
    "1. 基于原文的主题、结构和论点推进方式仿写，但输出要更适合图文笔记。",
    "2. 不要直接复制原文句子或大段表述。",
    "3. 可以借鉴原文的信息脉络，但要重写成更适合小红书阅读的表达。",
    "4. 输出必须服从目标平台 schema 和当前平台提示词。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","caption":"...","imageSuggestions":[{"title":"...","description":"..."}],"tags":["..."]}。',
    "3. 标题要有小红书感，但不要夸张失真。",
    "4. caption 要像可直接编辑的正文，不要写成公众号摘要，也不要过长。",
    "5. imageSuggestions 至少提供 3 条，最多 9 条，每条都要给出清晰的画面建议。",
    "6. tags 使用不带 # 的简短中文标签。",
    "7. 用中文输出，强调图文感、经验感和可读性。",
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteSourceSection(input),
  ].join("\n");
}

export function buildXiaohongshuLongformOutlinePrompt(
  input: LongformRewritePromptInput,
) {
  const brief = input.rewriteBrief;

  if (!brief) {
    return "";
  }

  return [
    "请根据下面提供的长文仿写底稿，先生成一份“小红书正文展开骨架”。",
    "重要原则：",
    "1. 这一步不是生成成稿，不是摘要，不是提纲压缩版，而是生成正文展开骨架。",
    "2. 骨架必须明确：开头引子/钩子、中段 2-3 层展开、收束结尾。",
    "3. 中段必须有实际职责：展开核心观点、补充经验或例子、承接前文并推进下一层、对 mustKeepPoints 做实际展开。",
    "4. mustKeepPoints 不能只停留在开头，必须分配到正文主体段落里。",
    "5. 只返回一个 JSON 对象，不要输出 markdown 或额外解释。",
    "6. JSON 格式必须为：{\"openingHook\":\"...\",\"bodySections\":[{\"focus\":\"...\",\"purpose\":\"...\",\"mustKeepPoints\":[\"...\"],\"supportingDetails\":[\"...\"],\"transitionToNext\":\"...\"}],\"closingWrapUp\":\"...\"}。",
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteBriefSection(brief),
  ].join("\n");
}

function buildLongformXiaohongshuUserPrompt(
  input: LongformRewritePromptInput,
  outline?: XiaohongshuLongformOutline,
) {
  const brief = input.rewriteBrief;

  if (!brief) {
    return buildStandardXiaohongshuUserPrompt(input.userPrompt);
  }

  return [
    "请根据下面提供的长文仿写底稿，生成一篇完整、可直接编辑的小红书中文图文草稿。",
    "重要原则：",
    "1. 输出的是完整可发的小红书内容，不是摘要，不是结论罗列，也不是要点概述。",
    "2. 不是短版压缩稿，不要只保留最抓人的几个结论后匆匆收尾。",
    "3. 要基于原文主题、结构推进和核心观点重新组织成适合小红书阅读的图文表达。",
    "4. 不要直接复制原文句子。",
    "5. 必须服从目标平台 schema 和当前平台提示词。",
    "6. 对于“必须保留的论点”，不得遗漏、弱化或改写成无关表达，且必须在正文中真正展开，而不是只在开头一带而过。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","caption":"...","imageSuggestions":[{"title":"...","description":"..."}],"tags":["..."]}。',
    "3. caption 要是完整的小红书正文，不要退化成摘要、提纲或短版压缩稿。",
    "4. 正文结构至少包含：开头引子/钩子 + 中段 2-3 层展开 + 收束结尾。",
    "5. 中段不能只是存在，必须承担实际功能：展开核心观点、补充经验或例子、承接前文并推进下一层、对 mustKeepPoints 做实际展开。",
    "6. 正文至少完成 3 段以上功能不同的正文展开，不要只写钩子 + 两段结论。",
    "7. 开头可以有钩子，但中段必须有实际展开，保留原文推进感和层次推进，不能只有开头和结论。",
    "8. mustKeepPoints 不能只出现在标题或首段，必须在正文主体中再次承接并展开，不能一句带过。",
    "9. imageSuggestions 至少提供 3 条，最多 9 条。",
    "",
    `仿写要求：${input.userPrompt}`,
    ...(outline
      ? [
          "",
          "正文展开骨架（必须落实到最终正文）：",
          `- 开头引子：${outline.openingHook}`,
          ...outline.bodySections.map((section) =>
            [
              `- 中段 ${section.index + 1}：${section.focus}`,
              `  作用：${section.purpose}`,
              `  必须展开的论点：${section.mustKeepPoints.join("；") || "无"}`,
              `  可用细节：${section.supportingDetails.join("；") || "无"}`,
              section.transitionToNext
                ? `  衔接：${section.transitionToNext}`
                : null,
            ]
              .filter(Boolean)
              .join("\n"),
          ),
          `- 收束结尾：${outline.closingWrapUp}`,
        ]
      : []),
    buildRewriteBriefSection(brief),
  ].join("\n");
}

function buildStandardXiaohongshuUserPrompt(userPrompt: string) {
  return [
    "请根据下面的仿写输入，生成一篇适合小红书发布的中文图文草稿。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","caption":"...","imageSuggestions":[{"title":"...","description":"..."}],"tags":["..."]}。',
    "3. 标题要有小红书感，但不要夸张失真。",
    "4. caption 要像可直接编辑的正文，不要写成公众号摘要，也不要过长。",
    "5. imageSuggestions 至少提供 3 条，最多 9 条，每条都要给出清晰的画面建议。",
    "6. tags 使用不带 # 的简短中文标签。",
    "7. 用中文输出，强调图文感、经验感和可读性。",
    "",
    `仿写输入：${userPrompt}`,
  ].join("\n");
}

export function buildVideoScriptUserPrompt(input: RewritePromptInput) {
  if (!input.rewriteSource) {
    return buildStandardVideoScriptUserPrompt(input.userPrompt);
  }

  if ("rewriteMode" in input && input.rewriteMode === "long_source" && input.rewriteBrief) {
    return buildLongformVideoScriptUserPrompt(input);
  }

  return [
    "请根据下面提供的原文和仿写要求，生成一份适合短视频创作的中文结构化脚本。",
    "仿写原则：",
    "1. 基于原文的主题、结构和论点推进方式仿写。",
    "2. 不要直接复制原文句子或大段原文表述。",
    "3. 可以借鉴原文的内容推进节奏，但要重写成镜头和口播都更明确的脚本。",
    "4. 输出必须服从目标平台 schema 和当前平台提示词。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","duration":"...","scenes":[{"shot":"...","voiceover":"..."}]}。',
    "3. duration 请用适合短视频的表达，例如“60-90 秒”或“1 分钟左右”。",
    "4. scenes 数量控制在 3 到 8 条之间，每条 scene 都必须包含 shot 和 voiceover。",
    "5. shot 要写清楚画面、镜头或动作，voiceover 要像可直接继续编辑的口播文案。",
    "6. 用中文输出，节奏明确，适合短视频内容创作，不要写成长文提纲。",
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteSourceSection(input),
  ].join("\n");
}

function buildLongformVideoScriptUserPrompt(input: LongformRewritePromptInput) {
  const brief = input.rewriteBrief;

  if (!brief) {
    return buildStandardVideoScriptUserPrompt(input.userPrompt);
  }

  return [
    "请根据下面提供的长文仿写底稿，生成一份完整、可直接编辑的中文短视频结构化脚本。",
    "重要原则：",
    "1. 输出的是完整平台内容，不是摘要、不是提纲、不是要点概述。",
    "2. 基于原文主题、结构推进和核心观点重写成镜头和口播都更明确的脚本。",
    "3. 不要直接复制原文句子。",
    "4. 必须服从目标平台 schema 和当前平台提示词。",
    "5. 对于“必须保留的论点”，不得遗漏或弱化。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","duration":"...","scenes":[{"shot":"...","voiceover":"..."}]}。',
    "3. scenes 保持在 3 到 8 条之间，每条都包含 shot 和 voiceover。",
    "",
    `仿写要求：${input.userPrompt}`,
    buildRewriteBriefSection(brief),
  ].join("\n");
}

function buildRewriteBriefSection(brief: NonNullable<LongformRewritePromptInput["rewriteBrief"]>) {
  return [
    "",
    `仿写底稿主题：${brief.theme}`,
    `原文规模：约 ${brief.sourceStats.totalChars} 字，${brief.sourceStats.totalChunks} 个内容块，${brief.sourceStats.estimatedParagraphGroups} 个段落组。`,
    "",
    "核心观点：",
    ...brief.coreClaims.map((claim, index) => `${index + 1}. ${claim}`),
    "",
    "必须保留以下论点（硬约束）：",
    ...brief.mustKeepPoints.map((point, index) => `${index + 1}. ${point}`),
    "",
    "可复用的信息与事实材料：",
    ...brief.reusableFacts.map((fact, index) => `${index + 1}. ${fact}`),
    "",
    "语气与论证节奏：",
    `- 整体语气：${brief.toneProfile.overallTone}`,
    `- 推进节奏：${brief.toneProfile.pacing}`,
    `- 情绪温度：${brief.toneProfile.emotionalTemperature}`,
    `- 修辞动作：${brief.toneProfile.rhetoricalMoves.join("、") || "无"}`,
    "",
    "结构推进底稿：",
    ...brief.structureFlow.map((item) =>
      [
        `${item.index + 1}. [${item.role}] ${item.summary}`,
        `关键点：${item.keyPoints.join("；") || "无"}`,
        item.transitionToNext ? `衔接：${item.transitionToNext}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
    "整体论证节奏：",
    `- 开场方式：${brief.argumentCadence.openingMove}`,
    `- 推进模式：${brief.argumentCadence.progressionPattern}`,
    `- 证据风格：${brief.argumentCadence.evidenceStyle}`,
    `- 收束方式：${brief.argumentCadence.endingMove}`,
  ].join("\n");
}

async function generateXiaohongshuLongformOutline(
  config: OpenRouterConfig,
  model: string | undefined,
  context: GenerationContext,
) {
  const completion = await runOpenRouterRequest(() =>
    requestOpenRouterChatCompletion(
      config,
      [
        {
          role: "system",
          content:
            context.promptSettings.xiaohongshu?.promptTemplate.trim() ||
            DEFAULT_XIAOHONGSHU_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildXiaohongshuLongformOutlinePrompt(context),
        },
      ],
      { model },
    ),
  );

  const content = completion.choices?.[0]?.message?.content;
  const payload = extractTextContent(content);

  if (!payload) {
    throw new Error("Empty xiaohongshu longform outline payload");
  }

  return normalizeXiaohongshuLongformOutline(
    extractXiaohongshuLongformOutlineJsonPayload(payload),
    context.rewriteBrief!,
  );
}

function extractXiaohongshuLongformOutlineJsonPayload(rawText: string) {
  const normalized = rawText.trim();
  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || normalized;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Invalid xiaohongshu longform outline output");
  }

  return JSON.parse(candidate.slice(startIndex, endIndex + 1));
}

function normalizeXiaohongshuLongformOutline(
  raw: unknown,
  brief: NonNullable<GenerationContext["rewriteBrief"]>,
): XiaohongshuLongformOutline {
  const payload = isRecord(raw) ? raw : {};
  const fallbackSections = buildFallbackXiaohongshuBodySections(brief);
  const bodySections = Array.isArray(payload.bodySections)
    ? payload.bodySections
        .map((section, index) => {
          const source = isRecord(section) ? section : null;
          if (!source) {
            return null;
          }

          const focus = normalizeString(source.focus);
          const purpose = normalizeString(source.purpose);
          const mustKeepPoints = normalizeStringArray(source.mustKeepPoints, []);
          const supportingDetails = normalizeStringArray(
            source.supportingDetails,
            [],
          );

          if (!focus || !purpose) {
            return null;
          }

          return {
            index,
            focus,
            purpose,
            mustKeepPoints:
              mustKeepPoints.length > 0 ? mustKeepPoints : fallbackSections[index]?.mustKeepPoints ?? [],
            supportingDetails:
              supportingDetails.length > 0
                ? supportingDetails
                : fallbackSections[index]?.supportingDetails ?? [],
            ...(normalizeString(source.transitionToNext)
              ? { transitionToNext: normalizeString(source.transitionToNext)! }
              : {}),
          };
        })
        .filter(
          (section): section is XiaohongshuLongformOutline["bodySections"][number] =>
            section !== null,
        )
    : [];

  return {
    openingHook:
      normalizeString(payload.openingHook) || `从“${brief.theme}”切入，先抓住读者注意力。`,
    bodySections: bodySections.length >= 2 ? bodySections.slice(0, 3) : fallbackSections,
    closingWrapUp:
      normalizeString(payload.closingWrapUp) ||
      "回到长期训练和稳定输出，让读者带着明确行动感收尾。",
  };
}

function buildFallbackXiaohongshuBodySections(
  brief: NonNullable<GenerationContext["rewriteBrief"]>,
): XiaohongshuLongformOutline["bodySections"] {
  const flow = brief.structureFlow.slice(0, 3);
  return flow.map((item, index) => ({
    index,
    focus: item.summary,
    purpose:
      index === 0
        ? "先把核心问题讲明白，并接住开头钩子"
        : index === flow.length - 1
          ? "把前面的论点收束起来，并推进到结尾"
          : "承接前文并推进下一层展开",
    mustKeepPoints: brief.mustKeepPoints.slice(index, index + 2),
    supportingDetails: [...item.keyPoints, ...brief.reusableFacts.slice(index, index + 1)].slice(
      0,
      3,
    ),
    ...(item.transitionToNext ? { transitionToNext: item.transitionToNext } : {}),
  }));
}

function buildStandardVideoScriptUserPrompt(userPrompt: string) {
  return [
    "请根据下面的仿写输入，生成一份适合短视频创作的中文结构化脚本。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","duration":"...","scenes":[{"shot":"...","voiceover":"..."}]}。',
    "3. duration 请用适合短视频的表达，例如“60-90 秒”或“1 分钟左右”。",
    "4. scenes 数量控制在 3 到 8 条之间，每条 scene 都必须包含 shot 和 voiceover。",
    "5. shot 要写清楚画面、镜头或动作，voiceover 要像可直接继续编辑的口播文案。",
    "6. 用中文输出，节奏明确，适合短视频内容创作，不要写成长文提纲。",
    "",
    `仿写输入：${userPrompt}`,
  ].join("\n");
}

function buildRewriteSourceSection(input: RewritePromptInput) {
  const source = input.rewriteSource;

  if (!source) {
    return "";
  }

  const excerpt = buildRewriteSourceExcerpt(source.extractedText, {
    rewriteMode: input.rewriteMode,
  });
  const isCompacted = excerpt.length < source.extractedText.length;

  return [
    `原文来源：${source.sourceName || source.kind}`,
    `原文字数：${source.charCount}`,
    ...(source.truncated ? ["说明：原文已按当前上限截断。"] : []),
    ...(isCompacted
      ? [`说明：原文较长，本次仅提供约 ${MAX_REWRITE_PROMPT_SOURCE_CHARS} 字关键节选用于仿写。`]
      : []),
    isCompacted ? "原文节选：" : "原文正文：",
    excerpt,
  ].join("\n");
}

function buildRewriteSourceExcerpt(
  text: string,
  options: {
    rewriteMode?: GenerationContext["rewriteMode"];
  } = {},
) {
  const maxChars =
    options.rewriteMode === "short_source"
      ? MEDIUM_SHORT_REWRITE_PROMPT_SOURCE_CHARS
      : MAX_REWRITE_PROMPT_SOURCE_CHARS;

  if (text.length <= maxChars) {
    return text;
  }

  const headLength = Math.floor(maxChars * 0.38);
  const middleLength = Math.floor(maxChars * 0.24);
  const tailLength = Math.floor(maxChars * 0.38);
  const middleStart = Math.max(
    headLength,
    Math.floor(text.length / 2) - Math.floor(middleLength / 2),
  );
  const middleEnd = Math.min(text.length - tailLength, middleStart + middleLength);

  return [
    text.slice(0, headLength).trim(),
    "[中间内容已省略]",
    text.slice(middleStart, middleEnd).trim(),
    "[后段内容]",
    text.slice(-tailLength).trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractTextContent(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("");
  }

  return "";
}

type OpenRouterConfig = ReturnType<typeof getOpenRouterConfig>;

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

async function requestOpenRouterChatCompletion(
  config: OpenRouterConfig,
  messages: OpenRouterMessage[],
  options: {
    model?: string;
  } = {},
): Promise<OpenRouterChatCompletionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? config.model,
        messages,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `${response.status} ${extractOpenRouterErrorMessage(responseText)}`,
      );
    }

    return JSON.parse(responseText) as OpenRouterChatCompletionResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolveLongformFinalModel(input: {
  defaultModel: string;
  longformFinalModel: string;
  rewriteMode: GenerationContext["rewriteMode"];
}) {
  return input.rewriteMode === "long_source"
    ? input.longformFinalModel
    : input.defaultModel;
}

export function resolveRewriteGenerationModel(input: {
  defaultModel: string;
  longformFinalModel: string;
  rewriteMode: GenerationContext["rewriteMode"];
  rewriteSourceCharCount?: number;
}) {
  if (input.rewriteMode === "long_source") {
    return input.longformFinalModel;
  }

  if (
    input.rewriteMode === "short_source" &&
    (input.rewriteSourceCharCount ?? 0) >=
      MEDIUM_REWRITE_MODEL_OVERRIDE_CHAR_THRESHOLD
  ) {
    return input.longformFinalModel;
  }

  return input.defaultModel;
}

export function resolvePlatformGenerationModel(input: {
  platform: "wechat_article" | "twitter" | "xiaohongshu" | "video_script";
  defaultModel: string;
  longformFinalModel: string;
  rewriteMode: GenerationContext["rewriteMode"];
  hasRewriteSource?: boolean;
  rewriteSourceCharCount?: number;
}) {
  if (input.platform === "wechat_article" && input.hasRewriteSource) {
    return input.longformFinalModel;
  }

  return resolveRewriteGenerationModel({
    defaultModel: input.defaultModel,
    longformFinalModel: input.longformFinalModel,
    rewriteMode: input.rewriteMode,
    rewriteSourceCharCount: input.rewriteSourceCharCount,
  });
}

function getTextGenerationModelForContext(
  context: GenerationContext,
  platform: "wechat_article" | "twitter" | "xiaohongshu" | "video_script",
) {
  if (context.rewriteMode === "none") {
    return undefined;
  }

  const longformConfig = getValidatedOpenRouterLongformConfig();
  const defaultModel = getValidatedOpenRouterConfig().model;
  const selectedModel = resolvePlatformGenerationModel({
    platform,
    defaultModel,
    longformFinalModel: longformConfig.finalModel,
    rewriteMode: context.rewriteMode,
    hasRewriteSource: Boolean(context.rewriteSource),
    rewriteSourceCharCount: context.rewriteSource?.charCount,
  });

  return selectedModel === defaultModel
    ? undefined
    : selectedModel;
}

function getWechatPromptContext(context: GenerationContext): WechatRewritePromptInput {
  if (
    context.rewriteMode === "short_source" &&
    context.rewriteSource &&
    context.rewriteSource.charCount >= MEDIUM_REWRITE_MODEL_OVERRIDE_CHAR_THRESHOLD
  ) {
    return {
      ...context,
      rewriteBrief: buildRewriteBrief(
        chunkRewriteSourceText(context.rewriteSource.extractedText),
      ),
    };
  }

  return context;
}

function getValidatedOpenRouterLongformConfig() {
  try {
    return getOpenRouterLongformConfig();
  } catch (error) {
    if (error instanceof MissingOpenRouterConfigError) {
      throw new OpenRouterGenerationError("missing_openrouter_config", error.message);
    }

    throw error;
  }
}

function buildRewriteBriefExtractionPrompt(chunks: RewriteChunk[]) {
  return [
    "请根据下面的中文长文内容块，提取一份“仿写底稿”。",
    "重要要求：",
    "1. 这不是摘要，不是提纲，不是零散要点列表。",
    "2. 请保留主题、核心观点、结构推进顺序、论证节奏、语气特征、可复用信息点、必须保留的论点。",
    "3. 保持中性理解，不要加入任何平台风格。",
    "4. 只返回一个 JSON 对象，不要输出 markdown 或额外说明。",
    "5. JSON 字段必须包含：theme、coreClaims、mustKeepPoints、reusableFacts、toneProfile、structureFlow、argumentCadence。",
    "6. structureFlow 必须体现段落角色、推进顺序和段间衔接。",
    "",
    "长文内容块：",
    ...chunks.map((chunk) =>
      [
        `# 内容块 ${chunk.index + 1}`,
        chunk.heading ? `标题：${chunk.heading}` : null,
        `角色提示：${chunk.sourceRoleHint}`,
        `段落组数：${chunk.paragraphGroups}`,
        chunk.text,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}

function extractRewriteBriefJsonPayload(rawText: string) {
  const normalized = rawText.trim();
  const fencedMatch = normalized.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : normalized;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Rewrite brief response did not contain valid JSON");
    }

    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  }
}

function normalizeRewriteBriefOutput(
  input: unknown,
  chunks: RewriteChunk[],
): RewriteBrief {
  const fallback = buildRewriteBrief(chunks);
  const payload = (input ?? {}) as Record<string, unknown>;

  return {
    version:
      typeof payload.version === "string" && payload.version.trim().length > 0
        ? payload.version.trim()
        : REWRITE_BRIEF_VERSION,
    sourceStats: fallback.sourceStats,
    theme: normalizeString(payload.theme) || fallback.theme,
    coreClaims: normalizeStringArray(payload.coreClaims, fallback.coreClaims),
    mustKeepPoints: normalizeStringArray(
      payload.mustKeepPoints,
      fallback.mustKeepPoints,
    ),
    reusableFacts: normalizeStringArray(
      payload.reusableFacts,
      fallback.reusableFacts.filter(
        (fact) => !fallback.mustKeepPoints.includes(fact),
      ),
    ),
    toneProfile: {
      overallTone:
        normalizeString(recordValue(payload.toneProfile, "overallTone")) ||
        fallback.toneProfile.overallTone,
      pacing:
        normalizeString(recordValue(payload.toneProfile, "pacing")) ||
        fallback.toneProfile.pacing,
      rhetoricalMoves: normalizeStringArray(
        recordValue(payload.toneProfile, "rhetoricalMoves"),
        fallback.toneProfile.rhetoricalMoves,
      ),
      emotionalTemperature:
        normalizeString(recordValue(payload.toneProfile, "emotionalTemperature")) ||
        fallback.toneProfile.emotionalTemperature,
    },
    structureFlow: normalizeStructureFlow(payload.structureFlow, fallback.structureFlow),
    argumentCadence: {
      openingMove:
        normalizeString(recordValue(payload.argumentCadence, "openingMove")) ||
        fallback.argumentCadence.openingMove,
      progressionPattern:
        normalizeString(recordValue(payload.argumentCadence, "progressionPattern")) ||
        fallback.argumentCadence.progressionPattern,
      evidenceStyle:
        normalizeString(recordValue(payload.argumentCadence, "evidenceStyle")) ||
        fallback.argumentCadence.evidenceStyle,
      endingMove:
        normalizeString(recordValue(payload.argumentCadence, "endingMove")) ||
        fallback.argumentCadence.endingMove,
    },
  };
}

function normalizeStructureFlow(
  value: unknown,
  fallback: RewriteBrief["structureFlow"],
): RewriteBrief["structureFlow"] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item, index) => {
      const record = isRecord(item) ? item : null;
      if (!record) {
        return null;
      }

      const summary = normalizeString(record.summary);
      const role = normalizeString(record.role);
      const keyPoints = normalizeStringArray(record.keyPoints, []);

      if (!summary || !role || keyPoints.length === 0) {
        return null;
      }

      return {
        index,
        role: role as RewriteBrief["structureFlow"][number]["role"],
        summary,
        keyPoints,
        ...(normalizeString(record.transitionToNext)
          ? { transitionToNext: normalizeString(record.transitionToNext)! }
          : {}),
        emphasis: normalizeEmphasis(record.emphasis),
      };
    })
    .filter((item): item is RewriteBrief["structureFlow"][number] => item !== null);

  return items.length > 0 ? items : fallback;
}

function normalizeEmphasis(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "high" ? value : "medium";
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => normalizeString(item))
    .filter(Boolean) as string[];

  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

function recordValue(input: unknown, key: string) {
  if (!isRecord(input)) {
    return undefined;
  }

  return input[key];
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function shouldRetryOpenRouterError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("401") ||
    message.includes("authentication") ||
    message.includes("missing_openrouter_config")
  ) {
    return false;
  }

  return isTimeoutLikeError(message) || message.includes("fetch failed");
}

function normalizeOpenRouterError(error: unknown) {
  const message = getErrorMessage(error);

  if (isTimeoutLikeError(message.toLowerCase())) {
    return new OpenRouterGenerationError(
      "generation_timeout",
      "OpenRouter request timed out",
    );
  }

  return new OpenRouterGenerationError("generation_failed", message);
}

function isTimeoutLikeError(message: string) {
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("abort")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "OpenRouter generation failed";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOpenRouterErrorMessage(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string };
    };

    return parsed.error?.message?.trim() || responseText;
  } catch {
    return responseText;
  }
}
