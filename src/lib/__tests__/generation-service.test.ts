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
  assert.equal(result.content.wechat_article?.title, "高效工作的 5 个底层逻辑");
  assert.equal(result.content.twitter?.platform, "twitter");
  assert.equal(result.content.xiaohongshu?.platform, "xiaohongshu");
  assert.equal(result.content.video_script?.platform, "video_script");
  assert.equal(result.content.video_script?.scenes[0]?.index, 1);
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
