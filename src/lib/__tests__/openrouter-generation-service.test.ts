import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWechatFinalizationResult,
  buildXiaohongshuLongformOutlinePrompt,
  buildWechatFinalizationUserPrompt,
  generateWechatArticleWithOpenRouter,
  shouldRunAggressiveWechatCompressPass,
  shouldAcceptWechatFinalizationResult,
  buildTwitterUserPrompt,
  buildVideoScriptUserPrompt,
  buildWechatUserPrompt,
  buildXiaohongshuUserPrompt,
  MEDIUM_SHORT_REWRITE_PROMPT_SOURCE_CHARS,
  resolvePlatformGenerationModel,
  resolveWechatFinalizationPassMode,
  resolveRewriteGenerationModel,
  resolveLongformFinalModel,
  MAX_REWRITE_PROMPT_SOURCE_CHARS,
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_REQUEST_TIMEOUT_MS,
  OpenRouterGenerationError,
  runOpenRouterRequest,
} from "../generation/openrouter-generation-service.ts";
import { buildGenerationContext } from "../generation/generation-context.ts";
import type { RewriteBrief } from "../rewrite/rewrite-brief-types.ts";
import { normalizeWechatArticleOutput } from "../generation/wechat-output.ts";
import { countWechatMarkdownWords } from "../workspace/wechat-markdown.ts";

test("runOpenRouterRequest retries once after a timeout-classified failure", async () => {
  let attempts = 0;

  const result = await runOpenRouterRequest(async () => {
    attempts += 1;

    if (attempts === 1) {
      throw new Error("Request timed out");
    }

    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("runOpenRouterRequest throws generation_timeout after exhausting retries on timeout failures", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      runOpenRouterRequest(async () => {
        attempts += 1;
        throw new Error("Request timed out");
      }),
    (error: unknown) => {
      assert.ok(error instanceof OpenRouterGenerationError);
      assert.equal(error.code, "generation_timeout");
      return true;
    },
  );

  assert.equal(attempts, OPENROUTER_MAX_ATTEMPTS);
});

test("runOpenRouterRequest does not retry authentication failures", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      runOpenRouterRequest(async () => {
        attempts += 1;
        throw new Error("401 Missing Authentication header");
      }),
    (error: unknown) => {
      assert.ok(error instanceof OpenRouterGenerationError);
      assert.equal(error.code, "generation_failed");
      assert.match((error as Error).message, /401/);
      return true;
    },
  );

  assert.equal(attempts, 1);
});

test("runOpenRouterRequest retries once after a transient fetch failure", async () => {
  let attempts = 0;

  const result = await runOpenRouterRequest(async () => {
    attempts += 1;

    if (attempts === 1) {
      throw new Error("fetch failed");
    }

    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("OpenRouter request timeout stays comfortably below client timeout budget", () => {
  assert.equal(OPENROUTER_REQUEST_TIMEOUT_MS, 35_000);
  assert.equal(OPENROUTER_MAX_ATTEMPTS, 2);
});

test("resolveLongformFinalModel only overrides the model for long_source generation", () => {
  assert.equal(
    resolveLongformFinalModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "none",
    }),
    "openai/gpt-5-nano",
  );

  assert.equal(
    resolveLongformFinalModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "short_source",
    }),
    "openai/gpt-5-nano",
  );

  assert.equal(
    resolveLongformFinalModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "long_source",
    }),
    "google/gemini-2.5-flash",
  );
});

test("resolveRewriteGenerationModel keeps default model for plain generation", () => {
  assert.equal(
    resolveRewriteGenerationModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "none",
    }),
    "openai/gpt-5-nano",
  );
});

test("resolveRewriteGenerationModel keeps default model for short rewrite under the threshold", () => {
  assert.equal(
    resolveRewriteGenerationModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "short_source",
      rewriteSourceCharCount: 800,
    }),
    "openai/gpt-5-nano",
  );
});

test("resolveRewriteGenerationModel upgrades medium short rewrites to the steadier final model", () => {
  assert.equal(
    resolveRewriteGenerationModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "short_source",
      rewriteSourceCharCount: 2391,
    }),
    "google/gemini-2.5-flash",
  );
});

test("resolveRewriteGenerationModel keeps long_source on the longform final model", () => {
  assert.equal(
    resolveRewriteGenerationModel({
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "long_source",
      rewriteSourceCharCount: 5504,
    }),
    "google/gemini-2.5-flash",
  );
});

test("resolvePlatformGenerationModel upgrades all wechat rewrites to the steadier final model", () => {
  assert.equal(
    resolvePlatformGenerationModel({
      platform: "wechat_article",
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "short_source",
      hasRewriteSource: true,
      rewriteSourceCharCount: 1478,
    }),
    "google/gemini-2.5-flash",
  );
});

test("resolvePlatformGenerationModel keeps non-wechat short rewrites on their existing model path", () => {
  assert.equal(
    resolvePlatformGenerationModel({
      platform: "xiaohongshu",
      defaultModel: "openai/gpt-5-nano",
      longformFinalModel: "google/gemini-2.5-flash",
      rewriteMode: "short_source",
      hasRewriteSource: true,
      rewriteSourceCharCount: 1478,
    }),
    "openai/gpt-5-nano",
  );
});

test("wechat prompt switches to rewrite branch when rewriteSource exists", () => {
  const prompt = buildWechatUserPrompt({
    userPrompt: "改得更口语化、更适合公众号",
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "source.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
  });

  assert.match(prompt, /原文/);
  assert.match(prompt, /不要直接复制原文句子/);
  assert.match(prompt, /改得更口语化、更适合公众号/);
});

test("wechat prompt keeps original branch when rewriteSource is absent", () => {
  const prompt = buildWechatUserPrompt({
    userPrompt: "写一篇关于效率的公众号文章",
  });

  assert.match(prompt, /生成一篇中文公众号文章/);
  assert.doesNotMatch(prompt, /不要直接复制原文句子/);
});

test("wechat prompt adds section budget guidance to keep the draft tighter", () => {
  const prompt = buildWechatUserPrompt({
    userPrompt: "仿写一篇关于写作延缓衰老的公众号文章",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 1200,
    },
  });

  assert.match(prompt, /章节长度感知/);
  assert.match(prompt, /开头：150-220 字/);
  assert.match(prompt, /每个正文模块：220-320 字/);
  assert.match(prompt, /结尾：100-180 字/);
});

test("wechat prompt adds a small blacklist against templated public-account phrasing", () => {
  const prompt = buildWechatUserPrompt({
    userPrompt: "仿写一篇关于写作延缓衰老的公众号文章",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 1200,
    },
  });

  assert.match(prompt, /避免高频模板腔词句/);
  assert.match(prompt, /首先/);
  assert.match(prompt, /其次/);
  assert.match(prompt, /总而言之/);
  assert.match(prompt, /值得一提的是/);
});

test("wechat prompt switches to longform rewrite brief when rewriteMode is long_source", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 5600,
      totalChunks: 5,
      estimatedParagraphGroups: 15,
    },
    theme: "写作如何帮助中年人维持思考活力",
    coreClaims: ["稳定写作能迫使大脑持续组织信息"],
    mustKeepPoints: ["稳定输出比偶尔输出更重要", "写作应被理解为长期认知训练"],
    reusableFacts: ["每天记录三百字也能形成持续感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "层层推进、逐步展开",
      rhetoricalMoves: ["开场提出主题", "分层论证", "结尾收束强调"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先提出写作与延缓衰老之间的关系",
        keyPoints: ["写作让人持续整理信息"],
        transitionToNext: "转入第一层论证",
        emphasis: "high",
      },
    ],
    argumentCadence: {
      openingMove: "先提出主题与问题意识",
      progressionPattern: "intro -> body -> conclusion",
      evidenceStyle: "以解释结合例子推进",
      endingMove: "回收观点并给出收束",
    },
  };

  const prompt = buildWechatUserPrompt({
    userPrompt: "仿写一篇关于写作延缓衰老的公众号文章",
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      extractedText: "这里是原文全文，不应该直接进入最终公众号 prompt",
      charCount: 12000,
    },
  });

  assert.match(prompt, /完整公众号成稿/);
  assert.match(prompt, /不是摘要/);
  assert.match(prompt, /不是提纲/);
  assert.match(prompt, /不是要点概述/);
  assert.match(prompt, /必须保留以下论点/);
  assert.match(prompt, /稳定输出比偶尔输出更重要/);
  assert.match(prompt, /写作应被理解为长期认知训练/);
  assert.match(prompt, /结构推进感和论证节奏/);
  assert.doesNotMatch(prompt, /原文正文：/);
  assert.doesNotMatch(prompt, /原文节选：/);
});

test("twitter prompt switches to rewrite branch when rewriteSource exists", () => {
  const prompt = buildTwitterUserPrompt({
    userPrompt: "改成更适合 thread 的表达",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文内容第一段\n\n原文内容第二段",
      charCount: 15,
    },
  });

  assert.match(prompt, /Twitter\/X/);
  assert.match(prompt, /不要直接复制原文句子/);
  assert.match(prompt, /原文内容第一段/);
});

test("xiaohongshu prompt switches to rewrite branch when rewriteSource exists", () => {
  const prompt = buildXiaohongshuUserPrompt({
    userPrompt: "改得更像生活方式图文笔记",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文内容第一段\n\n原文内容第二段",
      charCount: 15,
    },
  });

  assert.match(prompt, /小红书发布的中文图文草稿/);
  assert.match(prompt, /不要直接复制原文句子/);
  assert.match(prompt, /图文笔记/);
});

test("xiaohongshu prompt switches to longform rewrite brief without degrading into summary", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 5400,
      totalChunks: 5,
      estimatedParagraphGroups: 14,
    },
    theme: "写作如何帮助人重建日常节奏",
    coreClaims: ["稳定写作能帮助人重新组织生活感受"],
    mustKeepPoints: ["稳定输出比偶尔输出更重要"],
    reusableFacts: ["每天记录三百字也能形成持续感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "层层推进、逐步展开",
      rhetoricalMoves: ["开场提出主题", "分层论证"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先解释写作与节奏感重建之间的关系",
        keyPoints: ["写作让人持续整理信息"],
        transitionToNext: "转入第一层论证",
        emphasis: "high",
      },
    ],
    argumentCadence: {
      openingMove: "先提出主题与问题意识",
      progressionPattern: "intro -> body -> conclusion",
      evidenceStyle: "以解释结合例子推进",
      endingMove: "回收观点并给出收束",
    },
  };

  const prompt = buildXiaohongshuUserPrompt({
    userPrompt: "仿写成更适合小红书的图文版本",
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      extractedText: "这里是原文全文，不应该直接进入最终小红书 prompt",
      charCount: 12000,
    },
  });

  assert.match(prompt, /完整、可直接编辑的小红书中文图文草稿/);
  assert.match(prompt, /不是摘要/);
  assert.match(prompt, /不是结论罗列/);
  assert.match(prompt, /不是短版压缩稿/);
  assert.match(prompt, /完整的小红书正文/);
  assert.match(prompt, /开头引子\/钩子 \+ 中段 2-3 层展开 \+ 收束结尾/);
  assert.match(prompt, /中段不能只是存在/);
  assert.match(prompt, /至少完成 3 段以上功能不同的正文展开/);
  assert.match(prompt, /不能只出现在标题或首段/);
  assert.match(prompt, /中段必须有实际展开/);
  assert.match(prompt, /保留原文推进感和层次推进/);
  assert.match(prompt, /必须在正文中真正展开/);
  assert.match(prompt, /必须保留以下论点/);
  assert.doesNotMatch(prompt, /原文正文：/);
});

test("wechat finalization prompt uses draft title and draft body as the core input", () => {
  const prompt = buildWechatFinalizationUserPrompt({
    userPrompt: "保持克制理性的风格",
    draftTitle: "写作如何帮助中年人维持思考活力",
    draftBody:
      "第一段解释写作与认知训练的关系。\n\n第二段展开稳定输出为什么更重要。\n\n第三段回收到日常实践。",
    currentBodyWords: 1180,
    targetMinWords: 1100,
    targetMaxWords: 1300,
    oneSentencePerParagraph: true,
    keepSectionStructure: true,
    mode: "light",
  });

  assert.match(prompt, /以下是本次公众号成稿整理的运行上下文/);
  assert.match(prompt, /system skill 规则优先/);
  assert.match(prompt, /初稿标题：写作如何帮助中年人维持思考活力/);
  assert.match(prompt, /初稿正文：/);
  assert.match(prompt, /1100-1300 字|1100–1300 字/);
  assert.match(prompt, /标题锁定：最终标题必须原样返回，不允许修改标题。/);
  assert.match(prompt, /第一段写作意图已体现在初稿中，不要借 userPrompt 重新起稿、扩写或改变文章方向。/);
  assert.match(prompt, /第一段写作意图（只作背景提醒）：保持克制理性的风格/);
  assert.doesNotMatch(prompt, /必须遵守：/);
  assert.doesNotMatch(prompt, /原文来源：/);
  assert.doesNotMatch(prompt, /原文正文：/);
});

test("wechat finalization prompt switches to compress-first mode when draft body exceeds the target range", () => {
  const prompt = buildWechatFinalizationUserPrompt({
    userPrompt: "保持克制理性的风格",
    draftTitle: "慢下来，用文字滋养我们的大脑",
    draftBody: "这是一段偏长的初稿正文。".repeat(180),
    currentBodyWords: 1800,
    targetMinWords: 1100,
    targetMaxWords: 1300,
    oneSentencePerParagraph: true,
    keepSectionStructure: true,
    mode: "compress",
    aggressiveCompression: false,
  });

  assert.match(prompt, /当前任务：压缩整理模式/);
  assert.match(prompt, /当前初稿正文约 1800 字/);
  assert.match(prompt, /需要至少删减约 500 字/);
  assert.match(prompt, /主要动作只能是做减法和轻微修顺，不要通过重新表达一遍来实现压缩/);
  assert.match(prompt, /如果一个观点已经成立，后面那句只是再解释一遍、换个说法重复或让文章显得更完整，请优先删除那句/);
  assert.match(prompt, /第一优先级删除：重复表达、空泛抒情、无信息增量的态度句、重复举例、反复解释同一观点的句子/);
  assert.match(prompt, /第二优先级删除：过长过渡段、重复的小标题导语、同义改写式重复句/);
  assert.match(prompt, /第三优先级删除：不影响主线的补充细节/);
  assert.match(prompt, /优先在现有段落内部删句、删冗余、收短段落，而不是重写整段/);
  assert.match(prompt, /禁止为了顺滑补新的过渡句，禁止为了完整补新的态度句，禁止为了更像成稿补新的总结句/);
  assert.match(prompt, /禁止新增小标题、禁止新增开号段落、禁止新增总结性拔高段落/);
  assert.match(prompt, /不要把结构重组得更像教程稿，不要把自然叙述改成结论轰炸/);
  assert.match(prompt, /标题锁定：最终标题必须原样返回，不允许修改标题。/);
});

test("wechat finalization prompt keeps light mode constrained to lightweight paragraph cleanup", () => {
  const prompt = buildWechatFinalizationUserPrompt({
    userPrompt: "保持克制理性的风格",
    draftTitle: "慢下来，用文字滋养我们的大脑",
    draftBody: "第一段。\n\n第二段。\n\n第三段。",
    currentBodyWords: 1200,
    targetMinWords: 1100,
    targetMaxWords: 1300,
    oneSentencePerParagraph: true,
    keepSectionStructure: true,
    mode: "light",
  });

  assert.match(prompt, /当前任务：轻排版整理模式/);
  assert.match(prompt, /只允许切短段落、小标题轻整理和个别句子修顺/);
  assert.match(prompt, /不允许新增章节、不允许新增开号式段落、不允许明显重组文章结构/);
  assert.match(prompt, /不允许扩写正文/);
});

test("resolveWechatFinalizationPassMode chooses compress, light, and expand from visible body word count", () => {
  assert.equal(
    resolveWechatFinalizationPassMode({
      draftBody: "写作让大脑保持清醒".repeat(160),
      targetMinWords: 1100,
      targetMaxWords: 1300,
    }),
    "compress",
  );

  assert.equal(
    resolveWechatFinalizationPassMode({
      draftBody: "写作让大脑保持清醒".repeat(130),
      targetMinWords: 1100,
      targetMaxWords: 1300,
    }),
    "light",
  );

  assert.equal(
    resolveWechatFinalizationPassMode({
      draftBody: "写作让大脑保持清醒".repeat(80),
      targetMinWords: 1100,
      targetMaxWords: 1300,
    }),
    "expand",
  );
});

test("wechat finalization no longer schedules an extra aggressive model follow-up pass", () => {
  assert.equal(
    shouldRunAggressiveWechatCompressPass({
      mode: "compress",
      finalizedBodyWords: 1380,
      targetMaxWords: 1300,
    }),
    false,
  );
});

test("wechat generation keeps finalization to one model pass and uses local trimming inside the second step", async () => {
  const previousEnv = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  };
  const previousFetch = globalThis.fetch;

  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_BASE_URL = "https://openrouter.example.com";
  process.env.OPENROUTER_MODEL = "openai/gpt-4.1-mini";

  const requestBodies: string[] = [];
  const finalizedMarkdownBody = [
    "## 第一节",
    "",
    "跑步这件事，说到底，不只是速度的问题。也就是说，我们真正练的是和自己相处的能力。",
    "",
    "很多时候，我们以为自己在追成绩，其实是在追一种可控感。换句话说，那种训练完成后的踏实感，才是很多人真正舍不得放下的部分。",
    "",
    "## 第二节",
    "",
    "写作也是一样。先把一个感受写出来，很多事情才慢慢有了轮廓。也就是说，文字帮我们把模糊的疲惫整理成能被看见的东西。",
    "",
    "进一步来说，当你愿意把这些感受写下来，你其实就在替自己留住一点清醒。说白了，这不是为了输出观点，而是为了不让日子从身边糊过去。",
    "",
    "## 第三节",
    "",
    "所以我越来越觉得，中年之后的训练，不该只看配速，也该看自己有没有留下痕迹。值得一提的是，那些看上去不起眼的记录，最后都会变成很实在的支撑。",
    "",
    "当然，这并不是说每个人都要每天写很多。很多时候，你只要写下一点点当天真实发生的事，就已经足够让脑子慢下来一点。",
  ].join("\n");

  let callCount = 0;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(typeof init?.body === "string" ? init.body : "");
    callCount += 1;

    const responsePayload =
      callCount === 1
        ? {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "跑步和写作，都是中年之后的慢训练",
                    markdownBody: `${finalizedMarkdownBody}\n\n${"这是初稿补充说明。".repeat(80)}`,
                  }),
                },
              },
            ],
          }
        : {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "这个标题在第二步里不应该生效",
                    markdownBody: `${finalizedMarkdownBody}\n\n${"也就是说，这里还是偏长的解释型补充。".repeat(60)}`,
                  }),
                },
              },
            ],
          };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const context = buildGenerationContext({
      userPrompt: "仿写一篇关于跑步和写作的公众号文章",
      selectedPlatforms: ["wechat_article"],
      promptSettings: [],
      now: "2026-04-11T10:00:00.000Z",
      generatorVersion: "markdown-wechat-two-step-v1",
      wechatFinalization: {
        enabled: true,
        targetMinWords: 1100,
        targetMaxWords: 1200,
        oneSentencePerParagraph: true,
        keepSectionStructure: true,
      },
    });

    const result = await generateWechatArticleWithOpenRouter(context);

    assert.ok("article" in result);
    assert.equal(callCount, 2);
    assert.equal(result.finalizationApplied, true);
    assert.equal(result.article.title, "跑步和写作，都是中年之后的慢训练");
    assert.equal(
      countWechatMarkdownWords("", result.article.markdownBody ?? "").bodyCount <= 1400,
      true,
    );
    assert.ok(
      countWechatMarkdownWords("", result.article.markdownBody ?? "").bodyCount <
        countWechatMarkdownWords("", `${finalizedMarkdownBody}\n\n${"也就是说，这里还是偏长的解释型补充。".repeat(60)}`).bodyCount,
    );
    assert.equal(requestBodies.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnv.OPENROUTER_API_KEY === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previousEnv.OPENROUTER_API_KEY;
    }
    if (previousEnv.OPENROUTER_BASE_URL === undefined) {
      delete process.env.OPENROUTER_BASE_URL;
    } else {
      process.env.OPENROUTER_BASE_URL = previousEnv.OPENROUTER_BASE_URL;
    }
    if (previousEnv.OPENROUTER_MODEL === undefined) {
      delete process.env.OPENROUTER_MODEL;
    } else {
      process.env.OPENROUTER_MODEL = previousEnv.OPENROUTER_MODEL;
    }
  }
});

test("applyWechatFinalizationResult keeps the draft title while accepting finalized body blocks", () => {
  const draftArticle = {
    platform: "wechat_article" as const,
    title: "慢下来，用文字滋养我们的大脑",
    blocks: [{ id: "draft-1", type: "paragraph" as const, text: "初稿正文。" }],
  };
  const finalizedArticle = {
    platform: "wechat_article" as const,
    title: "慢下来，去写吧，这是大脑的长生不老药",
    blocks: [{ id: "final-1", type: "paragraph" as const, text: "成稿正文。" }],
  };

  const result = applyWechatFinalizationResult(draftArticle, finalizedArticle);

  assert.equal(result.title, draftArticle.title);
  assert.deepEqual(result.blocks, finalizedArticle.blocks);
});

test("applyWechatFinalizationResult keeps the draft title while accepting finalized markdown body", () => {
  const draftArticle = normalizeWechatArticleOutput({
    title: "慢下来，用文字滋养我们的大脑",
    markdownBody: "## 第一节\n\n初稿正文。",
  });
  const finalizedArticle = normalizeWechatArticleOutput({
    title: "另一个标题",
    markdownBody: "## 第一节\n\n成稿正文。\n\n- 第一项",
  });

  const result = applyWechatFinalizationResult(draftArticle, finalizedArticle);

  assert.equal(result.title, draftArticle.title);
  assert.equal(result.markdownBody, "## 第一节\n\n成稿正文。\n\n- 第一项");
  assert.deepEqual(
    result.blocks.map((block) => block.type),
    ["heading", "paragraph", "list"],
  );
});

test("shouldAcceptWechatFinalizationResult rejects compress-mode outputs that get longer than the draft", () => {
  const draftArticle = {
    platform: "wechat_article" as const,
    title: "慢下来，用文字滋养我们的大脑",
    blocks: [
      {
        id: "draft-1",
        type: "paragraph" as const,
        text: "写作让大脑保持清醒".repeat(150),
      },
    ],
  };
  const finalizedArticle = {
    platform: "wechat_article" as const,
    title: draftArticle.title,
    blocks: [
      {
        id: "final-1",
        type: "paragraph" as const,
        text: "写作让大脑保持清醒".repeat(170),
      },
    ],
  };

  assert.equal(
    shouldAcceptWechatFinalizationResult({
      draftArticle,
      finalizedArticle,
      mode: "compress",
    }),
    false,
  );

  assert.equal(
    shouldAcceptWechatFinalizationResult({
      draftArticle,
      finalizedArticle: {
        ...finalizedArticle,
        blocks: [
          {
            id: "final-2",
            type: "paragraph" as const,
            text: "写作让大脑保持清醒".repeat(120),
          },
        ],
      },
      mode: "compress",
    }),
    true,
  );
});

test("shouldAcceptWechatFinalizationResult rejects light-mode outputs that expand too much or add too many headings", () => {
  const draftArticle = {
    platform: "wechat_article" as const,
    title: "慢下来，用文字滋养我们的大脑",
    blocks: [
      { id: "h-1", type: "heading" as const, level: 2 as const, text: "小标题一" },
      {
        id: "p-1",
        type: "paragraph" as const,
        text: "写作让大脑保持清醒".repeat(120),
      },
    ],
  };

  const expandedArticle = {
    platform: "wechat_article" as const,
    title: draftArticle.title,
    blocks: [
      { id: "h-1", type: "heading" as const, level: 2 as const, text: "小标题一" },
      {
        id: "p-1",
        type: "paragraph" as const,
        text: "写作让大脑保持清醒".repeat(135),
      },
    ],
  };

  const restructuredArticle = {
    platform: "wechat_article" as const,
    title: draftArticle.title,
    blocks: [
      { id: "h-1", type: "heading" as const, level: 2 as const, text: "小标题一" },
      { id: "h-2", type: "heading" as const, level: 2 as const, text: "小标题二" },
      { id: "h-3", type: "heading" as const, level: 2 as const, text: "小标题三" },
      {
        id: "p-1",
        type: "paragraph" as const,
        text: "写作让大脑保持清醒".repeat(120),
      },
    ],
  };

  assert.equal(
    shouldAcceptWechatFinalizationResult({
      draftArticle,
      finalizedArticle: expandedArticle,
      mode: "light",
    }),
    false,
  );

  assert.equal(
    shouldAcceptWechatFinalizationResult({
      draftArticle,
      finalizedArticle: restructuredArticle,
      mode: "light",
    }),
    false,
  );
});

test("wechat prompt switches to a structured brief path for medium short rewrites", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 2391,
      totalChunks: 3,
      estimatedParagraphGroups: 6,
    },
    theme: "写作如何帮助中年人保持思考活力",
    coreClaims: ["稳定写作会迫使大脑持续整理信息"],
    mustKeepPoints: ["稳定输出比偶尔输出更重要", "写作是长期认知训练"],
    reusableFacts: ["每天写一点也能形成节奏感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "先解释再展开",
      rhetoricalMoves: ["开场提出问题", "中段解释机制", "结尾回收观点"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先提出写作和认知状态的关系",
        keyPoints: ["写作会迫使人持续整理信息"],
        transitionToNext: "转入为什么稳定输出更重要",
        emphasis: "high",
      },
    ],
    argumentCadence: {
      openingMove: "先提出主题",
      progressionPattern: "intro -> body -> conclusion",
      evidenceStyle: "解释结合经验例子",
      endingMove: "回收观点并给出行动建议",
    },
  };

  const prompt = buildWechatUserPrompt({
    userPrompt: "仿写一篇关于写作延缓衰老的公众号文章",
    rewriteMode: "short_source",
    rewriteBrief,
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "这里是原文，不应该继续整段进入最终公众号 prompt",
      charCount: 2391,
    },
  });

  assert.match(prompt, /仿写底稿/);
  assert.match(prompt, /完整公众号成稿/);
  assert.match(prompt, /不是摘要/);
  assert.match(prompt, /必须保留以下论点/);
  assert.doesNotMatch(prompt, /原文正文：/);
});

test("xiaohongshu longform outline prompt asks for a body skeleton instead of a finished draft", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 5400,
      totalChunks: 5,
      estimatedParagraphGroups: 14,
    },
    theme: "写作如何帮助人重建日常节奏",
    coreClaims: ["稳定写作能帮助人重新组织生活感受"],
    mustKeepPoints: ["稳定输出比偶尔输出更重要"],
    reusableFacts: ["每天记录三百字也能形成持续感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "层层推进、逐步展开",
      rhetoricalMoves: ["开场提出主题", "分层论证"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先解释写作与节奏感重建之间的关系",
        keyPoints: ["写作让人持续整理信息"],
        transitionToNext: "转入第一层论证",
        emphasis: "high",
      },
    ],
    argumentCadence: {
      openingMove: "先提出主题与问题意识",
      progressionPattern: "intro -> body -> conclusion",
      evidenceStyle: "以解释结合例子推进",
      endingMove: "回收观点并给出收束",
    },
  };

  const prompt = buildXiaohongshuLongformOutlinePrompt({
    userPrompt: "仿写成更适合小红书的图文版本",
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      extractedText: "这里是原文全文，不应该直接进入正文展开骨架 prompt",
      charCount: 12000,
    },
  });

  assert.match(prompt, /正文展开骨架/);
  assert.match(prompt, /这一步不是生成成稿/);
  assert.match(prompt, /开头引子\/钩子、中段 2-3 层展开、收束结尾/);
  assert.match(prompt, /mustKeepPoints 不能只停留在开头/);
});

test("video script prompt switches to rewrite branch when rewriteSource exists", () => {
  const prompt = buildVideoScriptUserPrompt({
    userPrompt: "改成更适合短视频口播",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文内容第一段\n\n原文内容第二段",
      charCount: 15,
    },
  });

  assert.match(prompt, /短视频创作的中文结构化脚本/);
  assert.match(prompt, /不要直接复制原文句子/);
  assert.match(prompt, /原文内容第一段/);
});

test("twitter prompt switches to longform rewrite brief when rewriteMode is long_source", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 5100,
      totalChunks: 4,
      estimatedParagraphGroups: 13,
    },
    theme: "稳定写作如何改变认知状态",
    coreClaims: ["稳定写作能让思考更有结构"],
    mustKeepPoints: ["稳定输出比偶尔输出更重要"],
    reusableFacts: ["每天记录三百字也能形成持续感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "层层推进、逐步展开",
      rhetoricalMoves: ["开场提出主题", "中段转折推进"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先提出写作训练的核心价值",
        keyPoints: ["写作让思考更有结构"],
        transitionToNext: "转入主体论证",
        emphasis: "high",
      },
    ],
    argumentCadence: {
      openingMove: "先提出主题与问题意识",
      progressionPattern: "intro -> body -> conclusion",
      evidenceStyle: "以解释结合例子推进",
      endingMove: "回收观点并给出收束",
    },
  };

  const prompt = buildTwitterUserPrompt({
    userPrompt: "仿写成一组更适合 X 的 thread",
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      extractedText: "原文全文不应直接进入最终 twitter prompt",
      charCount: 11000,
    },
  });

  assert.match(prompt, /完整平台内容/);
  assert.match(prompt, /不是摘要/);
  assert.match(prompt, /必须保留以下论点/);
  assert.doesNotMatch(prompt, /原文正文：/);
});

test("video script prompt switches to longform rewrite brief when rewriteMode is long_source", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 5300,
      totalChunks: 4,
      estimatedParagraphGroups: 12,
    },
    theme: "稳定写作如何改变大脑状态",
    coreClaims: ["稳定写作是长期认知训练"],
    mustKeepPoints: ["写作应被理解为长期认知训练"],
    reusableFacts: ["每天记录三百字也能形成持续感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "层层推进、逐步展开",
      rhetoricalMoves: ["开场提出主题", "结尾收束强调"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先解释写作与认知训练之间的关系",
        keyPoints: ["写作让人持续整理信息"],
        transitionToNext: "转入分镜展开",
        emphasis: "high",
      },
    ],
    argumentCadence: {
      openingMove: "先提出主题与问题意识",
      progressionPattern: "intro -> body -> conclusion",
      evidenceStyle: "以解释结合例子推进",
      endingMove: "回收观点并给出收束",
    },
  };

  const prompt = buildVideoScriptUserPrompt({
    userPrompt: "仿写成更适合短视频口播的版本",
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      extractedText: "原文全文不应直接进入最终视频脚本 prompt",
      charCount: 11000,
    },
  });

  assert.match(prompt, /完整、可直接编辑的中文短视频结构化脚本/);
  assert.match(prompt, /不是摘要/);
  assert.match(prompt, /必须保留以下论点/);
  assert.doesNotMatch(prompt, /原文正文：/);
});

test("rewrite prompts compact very long source text before sending to the model", () => {
  const longText = `开头段落${"A".repeat(3200)}\n\n中间段落${"B".repeat(3200)}\n\n结尾段落${"C".repeat(3200)}`;
  const prompt = buildWechatUserPrompt({
    userPrompt: "请仿写成更适合公众号发布的版本",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: longText,
      charCount: longText.length,
    },
  });

  assert.match(prompt, /原文节选/);
  assert.match(prompt, /说明：原文较长/);
  assert.match(prompt, /开头段落/);
  assert.match(prompt, /\[中间内容已省略\]/);
  assert.match(prompt, /\[后段内容\]/);
  assert.ok(prompt.length < longText.length);
  assert.ok(prompt.length < MAX_REWRITE_PROMPT_SOURCE_CHARS + 2500);
});

test("wechat short rewrite compacts medium-length source text before sending to the model", () => {
  const mediumText = `开头段落${"A".repeat(900)}\n\n中间段落${"B".repeat(900)}\n\n结尾段落${"C".repeat(900)}`;
  const prompt = buildWechatUserPrompt({
    userPrompt: "仿写一篇关于写作延缓衰老的公众号文章",
    rewriteMode: "short_source",
    rewriteSource: {
      kind: "pasted_text",
      extractedText: mediumText,
      charCount: mediumText.length,
    },
  });

  assert.match(prompt, /原文节选/);
  assert.match(prompt, /说明：原文较长/);
  assert.match(prompt, /开头段落/);
  assert.match(prompt, /\[后段内容\]/);
  assert.ok(prompt.length < mediumText.length);
  assert.ok(prompt.length < MEDIUM_SHORT_REWRITE_PROMPT_SOURCE_CHARS + 2500);
});
