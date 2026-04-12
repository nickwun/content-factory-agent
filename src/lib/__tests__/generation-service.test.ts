import assert from "node:assert/strict";
import test from "node:test";

import { buildGenerationContext } from "../generation/generation-context.ts";
import { generateDraft } from "../generation/generation-service.ts";

test("generateDraft returns real wechat twitter xiaohongshu and video_script content", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: [
      "wechat_article",
      "twitter",
      "xiaohongshu",
      "video_script",
    ],
    promptSettings: [
      {
        platform: "wechat_article",
        promptTemplate: "更强调深度分析和结构化表达",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "twitter",
        promptTemplate: "更强调观点钩子",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "xiaohongshu",
        promptTemplate: "更强调经验感和标题钩子",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "video_script",
        promptTemplate: "更强调分镜节奏和口播感",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    now: "2026-04-01T08:00:00.000Z",
    generatorVersion: "phase2-openrouter-v1",
  });

  const result = await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    generateWechatArticle: async () => ({
      platform: "wechat_article",
      title: "高效工作的 5 个底层逻辑",
      blocks: [
        {
          id: "block-1",
          type: "paragraph",
          text: "真实公众号内容",
        },
      ],
    }),
    generateTwitterDraft: async () => ({
      platform: "twitter",
      mode: "thread",
      autoDetectedMode: "thread",
      userLockedMode: false,
      singleDraft: "真实 Twitter 单条",
      threadDraft: ["真实 Twitter 第一条", "真实 Twitter 第二条"],
    }),
    generateXiaohongshuDraft: async () => ({
      platform: "xiaohongshu",
      title: "真实小红书标题",
      caption: "真实小红书正文",
      imageSuggestions: [
        {
          id: "image-1",
          index: 1,
          title: "真实配图 1",
          description: "真实描述 1",
          status: "suggested",
        },
        {
          id: "image-2",
          index: 2,
          title: "真实配图 2",
          description: "真实描述 2",
          status: "suggested",
        },
        {
          id: "image-3",
          index: 3,
          title: "真实配图 3",
          description: "真实描述 3",
          status: "suggested",
        },
      ],
      tags: ["效率", "职场"],
    }),
    generateVideoScript: async () => ({
      platform: "video_script",
      title: "真实视频脚本标题",
      duration: "60-90 秒",
      scenes: [
        {
          id: "scene-1",
          index: 1,
          shot: "镜头一",
          voiceover: "旁白一",
        },
        {
          id: "scene-2",
          index: 2,
          shot: "镜头二",
          voiceover: "旁白二",
        },
        {
          id: "scene-3",
          index: 3,
          shot: "镜头三",
          voiceover: "旁白三",
        },
      ],
    }),
  });

  assert.deepEqual(result.generatedPlatforms, [
    "wechat_article",
    "twitter",
    "xiaohongshu",
    "video_script",
  ]);
  assert.deepEqual(result.mockPlatforms, []);
  assert.equal(result.generationInfo.modelProvider, "openrouter");
  assert.equal(result.generationInfo.modelName, "openai/gpt-4.1-mini");
  assert.equal(result.generationInfo.rewriteMode, "none");
  assert.equal(result.generationInfo.usedLongformRewrite, false);
  assert.equal(result.content.wechat_article?.title, "高效工作的 5 个底层逻辑");
  assert.equal(result.content.wechat_article?.markdownBody, "真实公众号内容");
  assert.equal(result.content.twitter?.platform, "twitter");
  assert.equal(result.content.xiaohongshu?.platform, "xiaohongshu");
  assert.equal(result.content.video_script?.platform, "video_script");
  assert.equal(result.content.video_script?.scenes[0]?.index, 1);
});

test("generateDraft normalizes markdownBody-first wechat results and derives compatible blocks", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于长期训练的公众号文章",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    now: "2026-04-11T08:00:00.000Z",
    generatorVersion: "phase-markdown-v1",
  });

  const result = await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    generateWechatArticle: async () => ({
      platform: "wechat_article",
      title: "长期训练的价值",
      markdownBody:
        "## 为什么要长期训练\n\n训练不是一时兴起，而是长期节奏。\n\n> 稳定比偶尔用力更重要。\n\n- 先把频率稳住\n- 再谈强度升级",
      blocks: [],
    }),
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.content.wechat_article?.markdownBody?.includes("## 为什么要长期训练"), true);
  assert.deepEqual(
    result.content.wechat_article?.blocks.map((block) => block.type),
    ["heading", "paragraph", "quote", "list"],
  );
});

test("generateDraft carries wechat finalization tracking into generationInfo", async () => {
  const context = buildGenerationContext({
    userPrompt: "请生成适合直接发布的公众号文章",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    now: "2026-04-09T09:30:00.000Z",
    generatorVersion: "phase8-wechat-finalization-v1",
    wechatFinalization: {
      enabled: true,
      targetMinWords: 1100,
      targetMaxWords: 1300,
      oneSentencePerParagraph: true,
      keepSectionStructure: true,
    },
  });

  const result = await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    generateWechatArticle: async () => ({
      platform: "wechat_article",
      title: "成稿模式测试标题",
      blocks: [{ id: "block-1", type: "paragraph", text: "测试正文" }],
    }),
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.generationInfo.wechatFinalizationEnabled, true);
  assert.equal(result.generationInfo.wechatFinalizationApplied, false);
  assert.equal(result.generationInfo.wechatFinalizationTargetMinWords, 1100);
  assert.equal(result.generationInfo.wechatFinalizationTargetMaxWords, 1300);
});

test("generateDraft marks wechat finalization as applied when wechat generator reports success", async () => {
  const context = buildGenerationContext({
    userPrompt: "请生成适合直接发布的公众号文章",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    now: "2026-04-09T10:00:00.000Z",
    generatorVersion: "phase8-wechat-finalization-v1",
    wechatFinalization: {
      enabled: true,
      targetMinWords: 1100,
      targetMaxWords: 1300,
      oneSentencePerParagraph: true,
      keepSectionStructure: true,
    },
  });

  const result = await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    generateWechatArticle: async () => ({
      article: {
        platform: "wechat_article",
        title: "成稿模式测试标题",
        blocks: [{ id: "block-1", type: "paragraph", text: "测试正文" }],
      },
      finalizationApplied: true,
    }),
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.generationInfo.wechatFinalizationEnabled, true);
  assert.equal(result.generationInfo.wechatFinalizationApplied, true);
});

test("generateDraft supports video_script real generation when selected alone", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一个视频脚本",
    selectedPlatforms: ["video_script"],
    promptSettings: [],
    now: "2026-04-01T08:00:00.000Z",
    generatorVersion: "phase2-openrouter-v1",
  });

  const result = await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    generateWechatArticle: async () => {
      throw new Error("should not be called");
    },
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => ({
      platform: "video_script",
      title: "真实视频脚本标题",
      duration: "60-90 秒",
      scenes: [
        {
          id: "scene-1",
          index: 1,
          shot: "镜头一",
          voiceover: "旁白一",
        },
        {
          id: "scene-2",
          index: 2,
          shot: "镜头二",
          voiceover: "旁白二",
        },
        {
          id: "scene-3",
          index: 3,
          shot: "镜头三",
          voiceover: "旁白三",
        },
      ],
    }),
  });

  assert.deepEqual(result.generatedPlatforms, ["video_script"]);
  assert.deepEqual(result.mockPlatforms, []);
  assert.equal(result.generationInfo.modelProvider, "openrouter");
  assert.equal(result.generationInfo.modelName, "openai/gpt-4.1-mini");
  assert.equal(result.content.video_script?.platform, "video_script");
});

test("generateDraft fails the whole request when any real platform generation fails", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: ["wechat_article", "twitter", "xiaohongshu", "video_script"],
    promptSettings: [
      {
        platform: "wechat_article",
        promptTemplate: "更强调深度分析和结构化表达",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "twitter",
        promptTemplate: "更强调观点钩子",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "xiaohongshu",
        promptTemplate: "更强调经验感",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "video_script",
        promptTemplate: "更强调分镜节奏和口播感",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    now: "2026-04-01T08:00:00.000Z",
    generatorVersion: "phase2-openrouter-v1",
  });

  await assert.rejects(
    () =>
      generateDraft(context, {
        modelProvider: "openrouter",
        modelName: "openai/gpt-4.1-mini",
        generateWechatArticle: async () => ({
          platform: "wechat_article",
          title: "高效工作的 5 个底层逻辑",
          blocks: [
            {
              id: "block-1",
              type: "paragraph",
              text: "真实公众号内容",
            },
          ],
        }),
        generateTwitterDraft: async () => ({
          platform: "twitter",
          mode: "thread",
          autoDetectedMode: "thread",
          userLockedMode: false,
          singleDraft: "真实 Twitter 单条",
          threadDraft: ["真实 Twitter 第一条", "真实 Twitter 第二条"],
        }),
        generateXiaohongshuDraft: async () => {
          throw new Error("xiaohongshu failed");
        },
        generateVideoScript: async () => ({
          platform: "video_script",
          title: "真实视频脚本标题",
          duration: "60-90 秒",
          scenes: [
            {
              id: "scene-1",
              index: 1,
              shot: "镜头一",
              voiceover: "旁白一",
            },
            {
              id: "scene-2",
              index: 2,
              shot: "镜头二",
              voiceover: "旁白二",
            },
            {
              id: "scene-3",
              index: 3,
              shot: "镜头三",
              voiceover: "旁白三",
            },
          ],
        }),
      }),
    /xiaohongshu failed/,
  );
});

test("generateDraft runs wechat twitter xiaohongshu and video_script real generation in parallel", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: ["wechat_article", "twitter", "xiaohongshu", "video_script"],
    promptSettings: [
      {
        platform: "wechat_article",
        promptTemplate: "更强调深度分析和结构化表达",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "twitter",
        promptTemplate: "更强调观点钩子",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "xiaohongshu",
        promptTemplate: "更强调经验感",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        platform: "video_script",
        promptTemplate: "更强调分镜节奏和口播感",
        defaultTemplate: "default",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    now: "2026-04-01T08:00:00.000Z",
    generatorVersion: "phase2-openrouter-v1",
  });

  const start = Date.now();

  await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    generateWechatArticle: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));

      return {
        platform: "wechat_article",
        title: "高效工作的 5 个底层逻辑",
        blocks: [{ id: "block-1", type: "paragraph", text: "真实公众号内容" }],
      };
    },
    generateTwitterDraft: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));

      return {
        platform: "twitter",
        mode: "thread",
        autoDetectedMode: "thread",
        userLockedMode: false,
        singleDraft: "真实 Twitter 单条",
        threadDraft: ["真实 Twitter 第一条", "真实 Twitter 第二条"],
      };
    },
    generateXiaohongshuDraft: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));

      return {
        platform: "xiaohongshu",
        title: "真实小红书标题",
        caption: "真实小红书正文",
        imageSuggestions: [
          {
            id: "image-1",
            index: 1,
            title: "真实配图 1",
            description: "真实描述 1",
            status: "suggested",
          },
          {
            id: "image-2",
            index: 2,
            title: "真实配图 2",
            description: "真实描述 2",
            status: "suggested",
          },
          {
            id: "image-3",
            index: 3,
            title: "真实配图 3",
            description: "真实描述 3",
            status: "suggested",
          },
        ],
        tags: ["效率", "职场"],
      };
    },
    generateVideoScript: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));

      return {
        platform: "video_script",
        title: "真实视频脚本标题",
        duration: "60-90 秒",
        scenes: [
          {
            id: "scene-1",
            index: 1,
            shot: "镜头一",
            voiceover: "旁白一",
          },
          {
            id: "scene-2",
            index: 2,
            shot: "镜头二",
            voiceover: "旁白二",
          },
          {
            id: "scene-3",
            index: 3,
            shot: "镜头三",
            voiceover: "旁白三",
          },
        ],
      };
    },
  });

  const durationMs = Date.now() - start;

  assert.ok(
    durationMs < 90,
    `expected parallel generation to finish in under 90ms, got ${durationMs}ms`,
  );
});

test("generateDraft passes rewriteSource through to all real platform generators", async () => {
  const context = buildGenerationContext({
    userPrompt: "请把原文改写得更适合多平台发布",
    selectedPlatforms: [
      "wechat_article",
      "twitter",
      "xiaohongshu",
      "video_script",
    ],
    promptSettings: [],
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "sample.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
    now: "2026-04-07T12:00:00.000Z",
    generatorVersion: "phase3-rewrite-v1",
  });

  const seenPlatforms: string[] = [];

  await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generateWechatArticle: async (receivedContext) => {
      assert.deepEqual(receivedContext.rewriteSource, context.rewriteSource);
      seenPlatforms.push("wechat_article");
      return {
        platform: "wechat_article",
        title: "仿写公众号标题",
        blocks: [{ id: "block-1", type: "paragraph", text: "仿写正文" }],
      };
    },
    generateTwitterDraft: async (receivedContext) => {
      assert.deepEqual(receivedContext.rewriteSource, context.rewriteSource);
      seenPlatforms.push("twitter");
      return {
        platform: "twitter",
        mode: "single",
        autoDetectedMode: "single",
        userLockedMode: false,
        singleDraft: "仿写推文",
        threadDraft: ["仿写推文"],
      };
    },
    generateXiaohongshuDraft: async (receivedContext) => {
      assert.deepEqual(receivedContext.rewriteSource, context.rewriteSource);
      seenPlatforms.push("xiaohongshu");
      return {
        platform: "xiaohongshu",
        title: "仿写小红书标题",
        caption: "仿写小红书正文",
        imageSuggestions: [
          {
            id: "image-1",
            index: 1,
            title: "配图 1",
            description: "描述 1",
            status: "suggested",
          },
          {
            id: "image-2",
            index: 2,
            title: "配图 2",
            description: "描述 2",
            status: "suggested",
          },
          {
            id: "image-3",
            index: 3,
            title: "配图 3",
            description: "描述 3",
            status: "suggested",
          },
        ],
        tags: ["仿写"],
      };
    },
    generateVideoScript: async (receivedContext) => {
      assert.deepEqual(receivedContext.rewriteSource, context.rewriteSource);
      seenPlatforms.push("video_script");
      return {
        platform: "video_script",
        title: "仿写脚本标题",
        duration: "60-90 秒",
        scenes: [
          { id: "scene-1", index: 1, shot: "镜头一", voiceover: "旁白一" },
          { id: "scene-2", index: 2, shot: "镜头二", voiceover: "旁白二" },
          { id: "scene-3", index: 3, shot: "镜头三", voiceover: "旁白三" },
        ],
      };
    },
  });

  assert.deepEqual(seenPlatforms.sort(), [
    "twitter",
    "video_script",
    "wechat_article",
    "xiaohongshu",
  ]);
});

test("generateDraft keeps rewriteSource undefined when not provided", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一个不带原文的普通生成请求",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    now: "2026-04-07T12:30:00.000Z",
    generatorVersion: "phase3-rewrite-v1",
  });

  await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generateWechatArticle: async (receivedContext) => {
      assert.equal(receivedContext.rewriteSource, undefined);
      return {
        platform: "wechat_article",
        title: "普通生成标题",
        blocks: [{ id: "block-1", type: "paragraph", text: "普通正文" }],
      };
    },
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });
});

test("generateDraft includes longform rewrite tracking in generationInfo", async () => {
  const context = buildGenerationContext({
    userPrompt: "请仿写成更适合小红书的版本",
    selectedPlatforms: ["xiaohongshu"],
    promptSettings: [],
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
    rewriteMode: "long_source",
    rewriteBrief: {
      version: "v1",
      sourceStats: {
        totalChars: 5000,
        totalChunks: 4,
        estimatedParagraphGroups: 13,
      },
      theme: "写作如何重建日常节奏",
      coreClaims: ["稳定写作能帮助人整理信息"],
      mustKeepPoints: ["稳定输出比偶尔输出更重要"],
      reusableFacts: ["每天记录三百字也能形成持续感"],
      toneProfile: {
        overallTone: "分析型、解释型",
        pacing: "层层推进、逐步展开",
        rhetoricalMoves: ["开场提出主题"],
        emotionalTemperature: "温和鼓励",
      },
      structureFlow: [
        {
          index: 0,
          role: "intro",
          summary: "先提出写作与节奏感重建之间的关系",
          keyPoints: ["写作让人持续组织信息"],
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
    },
    rewriteChunkCount: 4,
    now: "2026-04-07T13:40:00.000Z",
    generatorVersion: "phase4-longform-rewrite-v1",
  });

  const result = await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generateWechatArticle: async () => {
      throw new Error("should not be called");
    },
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => ({
      platform: "xiaohongshu",
      title: "长文仿写小红书标题",
      caption: "长文仿写小红书正文",
      imageSuggestions: [
        { id: "image-1", index: 1, title: "配图 1", description: "描述 1", status: "suggested" },
        { id: "image-2", index: 2, title: "配图 2", description: "描述 2", status: "suggested" },
        { id: "image-3", index: 3, title: "配图 3", description: "描述 3", status: "suggested" },
      ],
      tags: ["仿写"],
    }),
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.generationInfo.rewriteMode, "long_source");
  assert.equal(result.generationInfo.usedLongformRewrite, true);
  assert.equal(result.generationInfo.rewriteChunkCount, 4);
  assert.equal(result.generationInfo.rewriteBriefVersion, "v1");
});

test("generateDraft keeps plain generation on rewriteMode none", async () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于长期主义的公众号文章",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    now: "2026-04-07T13:00:00.000Z",
    generatorVersion: "phase4-longform-rewrite-v1",
  });

  await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generateWechatArticle: async (receivedContext) => {
      assert.equal(receivedContext.rewriteMode, "none");
      assert.equal(receivedContext.rewriteSource, undefined);
      assert.equal(receivedContext.rewriteBrief, undefined);
      return {
        platform: "wechat_article",
        title: "普通生成标题",
        blocks: [{ id: "block-1", type: "paragraph", text: "普通正文" }],
      };
    },
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });
});

test("generateDraft keeps short rewrite on the legacy prompt path", async () => {
  const context = buildGenerationContext({
    userPrompt: "请仿写成更适合公众号的长文",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
    now: "2026-04-07T13:10:00.000Z",
    generatorVersion: "phase4-longform-rewrite-v1",
  });

  await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generateWechatArticle: async (receivedContext) => {
      assert.equal(receivedContext.rewriteMode, "short_source");
      assert.deepEqual(receivedContext.rewriteSource, context.rewriteSource);
      assert.equal(receivedContext.rewriteBrief, undefined);
      return {
        platform: "wechat_article",
        title: "短文仿写标题",
        blocks: [{ id: "block-1", type: "paragraph", text: "短文仿写正文" }],
      };
    },
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });
});

test("generateDraft passes longform rewrite brief only when rewriteMode is long_source", async () => {
  const context = buildGenerationContext({
    userPrompt: "请仿写成更适合公众号发布的长文版本",
    selectedPlatforms: ["wechat_article"],
    promptSettings: [],
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
    rewriteMode: "long_source",
    rewriteBrief: {
      version: "v1",
      sourceStats: {
        totalChars: 4200,
        totalChunks: 4,
        estimatedParagraphGroups: 13,
      },
      theme: "写作与认知训练",
      coreClaims: ["稳定写作能维持信息组织能力"],
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
          summary: "先解释写作为何是认知训练",
          keyPoints: ["写作让人持续组织信息"],
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
    },
    rewriteChunkCount: 4,
    now: "2026-04-07T13:20:00.000Z",
    generatorVersion: "phase4-longform-rewrite-v1",
  });

  await generateDraft(context, {
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generateWechatArticle: async (receivedContext) => {
      assert.equal(receivedContext.rewriteMode, "long_source");
      assert.ok(receivedContext.rewriteBrief);
      assert.equal(receivedContext.rewriteChunkCount, 4);
      return {
        platform: "wechat_article",
        title: "长文仿写标题",
        blocks: [{ id: "block-1", type: "paragraph", text: "长文仿写正文" }],
      };
    },
    generateTwitterDraft: async () => {
      throw new Error("should not be called");
    },
    generateXiaohongshuDraft: async () => {
      throw new Error("should not be called");
    },
    generateVideoScript: async () => {
      throw new Error("should not be called");
    },
  });
});
