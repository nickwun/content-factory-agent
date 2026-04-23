import type { RewriteSource } from "./rewrite-source.ts";
import type {
  ContentProcessingMode,
  PlatformPromptSetting,
  PromptPresetCorpusFile,
  PromptPresetCorpusSummary,
} from "../settings/prompt-settings-types.ts";

export type PromptPresetInput = {
  presetId: string;
  name: string;
  platform: "wechat_article";
  promptTemplate: string;
  corpusCount: number;
  hasCorpus: boolean;
  corpusSummary: PromptPresetCorpusSummary;
};

export function buildPromptPresetPromptBlocks(
  promptPresetInput: PromptPresetInput | undefined,
) {
  if (!promptPresetInput) {
    return [];
  }

  const blocks: string[] = [];
  blocks.push(
    [
      "提示词预设：",
      `- 当前使用提示词预设「${promptPresetInput.name}」。`,
      ...(promptPresetInput.hasCorpus
        ? [`- 当前预设已绑定 ${promptPresetInput.corpusCount} 份参考语料摘要。`]
        : ["- 当前预设未绑定语料，继续按 prompt 原样生成。"]),
    ].join("\n"),
  );

  const promptTemplate = promptPresetInput.promptTemplate.trim();
  if (promptTemplate) {
    blocks.push(["预设提示词：", promptTemplate].join("\n"));
  }

  const corpusLines = buildCorpusReferenceLines(promptPresetInput);
  if (corpusLines.length > 0) {
    blocks.push(["语料参考：", ...corpusLines].join("\n"));
  }

  return blocks;
}

const PLATFORM_LABELS: Record<string, string> = {
  wechat_article: "公众号",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  video_script: "视频脚本",
};

export function buildComposerRewriteUserPrompt(input: {
  selectedPromptSettings: PlatformPromptSetting[];
  rewriteSource: RewriteSource;
}) {
  return buildComposerProcessingUserPrompt({
    processingMode: "rewrite",
    ...input,
  });
}

export function buildComposerProcessingUserPrompt(input: {
  processingMode: ContentProcessingMode;
  selectedPromptSettings: PlatformPromptSetting[];
  rewriteSource: RewriteSource;
}) {
  const lines = [
    ...buildComposerModeInstructionLines(input.processingMode, input.rewriteSource),
  ];

  for (const setting of input.selectedPromptSettings) {
    const platformLabel = PLATFORM_LABELS[setting.platform] ?? setting.platform;
    const corpusFiles = setting.corpusFiles ?? [];
    const corpusSummary = mergeCorpusSummaries(corpusFiles);
    const summaryLines = buildPromptPresetSummaryLines({
      name: setting.name ?? "默认",
      corpusCount: corpusFiles.length,
      hasCorpus: corpusFiles.length > 0,
      corpusSummary,
    });

    lines.push("");
    lines.push(`${platformLabel}提示词预设：`);
    lines.push(`- 当前使用提示词预设「${setting.name ?? "默认"}」。`);

    const promptTemplate = setting.promptTemplate.trim();
    if (promptTemplate) {
      lines.push(`- 优先遵循这套预设提示词：${promptTemplate}`);
    }

    lines.push(...summaryLines.map((line) => `- ${line}`));
  }

  return lines.join("\n");
}

function buildComposerModeInstructionLines(
  processingMode: ContentProcessingMode,
  rewriteSource: RewriteSource,
) {
  if (processingMode === "translate_to_zh_article") {
    return [
      "请基于当前英文素材翻译并整理成自然中文文章。",
      `当前素材约 ${rewriteSource.charCount} 字，优先保留原文的核心信息和重要细节。`,
      "不要逐句直译成字幕稿；请合并口语重复、整理结构和段落，让成稿适合中文阅读和发布。",
      "保留原文核心观点、例子、论证关系和关键事实，不要脱离素材虚构。",
      "按所选提示词预设和语料摘要控制中文文章的风格、结构和篇幅。",
    ];
  }

  return [
    "请基于当前素材直接开始仿写。",
    `当前素材约 ${rewriteSource.charCount} 字，优先围绕它的核心信息重写。`,
    "优先保留原文的核心观点、结构推进和阅读节奏，再按所选提示词预设重写表达。",
    "不要脱离素材另起一篇，也不要把内容写成空泛总结。",
  ];
}

function buildCorpusReferenceLines(promptPresetInput: PromptPresetInput) {
  return buildPromptPresetSummaryLines({
    name: promptPresetInput.name,
    corpusCount: promptPresetInput.corpusCount,
    hasCorpus: promptPresetInput.hasCorpus,
    corpusSummary: promptPresetInput.corpusSummary,
  });
}

function buildPromptPresetSummaryLines(input: {
  name: string;
  corpusCount: number;
  hasCorpus: boolean;
  corpusSummary: PromptPresetCorpusSummary;
}) {
  const lines: string[] = [];
  const tone = joinReadableItems(input.corpusSummary.tone);
  const structure = joinReadableItems(input.corpusSummary.structure);
  const reusablePhrases = joinReadableItems(
    input.corpusSummary.reusablePhrases,
    "；",
  );

  if (tone) {
    lines.push(`参考 ${input.corpusCount} 份绑定语料的整体语气：${tone}。`);
  } else if (input.hasCorpus) {
    lines.push(`当前绑定了 ${input.corpusCount} 份参考语料，优先吸收它们的整体节奏和篇幅感。`);
  }

  if (structure) {
    lines.push(`结构上优先贴近：${structure}。`);
  }

  if (input.corpusSummary.lengthHint) {
    lines.push(`篇幅感参考：${ensureSentence(input.corpusSummary.lengthHint)}。`);
  }

  if (reusablePhrases) {
    lines.push(`可以少量借这些表达偏好：${reusablePhrases}。`);
  }

  return lines;
}

function mergeCorpusSummaries(corpusFiles: PromptPresetCorpusFile[]): PromptPresetCorpusSummary {
  const tone = mergeStringArrays(corpusFiles.map((file) => file.summary?.tone));
  const structure = mergeStringArrays(
    corpusFiles.map((file) => file.summary?.structure),
  );
  const reusablePhrases = mergeStringArrays(
    corpusFiles.map((file) => file.summary?.reusablePhrases),
  );
  const lengthHint =
    corpusFiles.find((file) => file.summary?.lengthHint)?.summary?.lengthHint ??
    undefined;

  return {
    ...(tone.length ? { tone } : {}),
    ...(structure.length ? { structure } : {}),
    ...(lengthHint ? { lengthHint } : {}),
    ...(reusablePhrases.length ? { reusablePhrases } : {}),
  };
}

function mergeStringArrays(values: Array<string[] | undefined>) {
  const merged: string[] = [];

  for (const items of values) {
    if (!items) {
      continue;
    }

    for (const item of items) {
      const normalized = item.trim();
      if (normalized && !merged.includes(normalized)) {
        merged.push(normalized);
      }
    }
  }

  return merged;
}

function joinReadableItems(values: string[] | undefined, separator = "，") {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim().replace(/[。；，]+$/u, ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized.join(separator) : undefined;
}

function ensureSentence(value: string) {
  return value.trim().replace(/[。]+$/u, "");
}
