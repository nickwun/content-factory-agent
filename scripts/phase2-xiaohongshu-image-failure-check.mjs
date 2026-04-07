import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const SEEDED_FAILED_RECORD = {
  id: "seeded-xiaohongshu-record",
  schemaVersion: 1,
  autoTitle: "【效率日常】25-35岁职场人的可落地高效习惯笔记",
  title: "【效率日常】25-35岁职场人的可落地高效习惯笔记",
  isCustomTitle: false,
  userPrompt:
    "写一篇关于提高工作效率的小红书笔记，面向 25-35 岁职场人，语气专业但不生硬，要有生活化经验感。",
  selectedPlatforms: ["xiaohongshu"],
  createdAt: "2026-04-03T12:00:00.000Z",
  updatedAt: "2026-04-03T12:00:00.000Z",
  generation: {
    generatorVersion: "phase2-openrouter-v1",
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generatedAt: "2026-04-03T12:00:00.000Z",
    selectedPlatformsSnapshot: ["xiaohongshu"],
    promptSnapshotByPlatform: {
      xiaohongshu: "生成一篇适合小红书发布的笔记，包含吸睛标题、图片建议、正文文案与标签。",
    },
  },
  content: {
    xiaohongshu: {
      platform: "xiaohongshu",
      title: "【效率日常】25-35岁职场人的可落地高效习惯笔记",
      caption:
        "最近把日程和思维习惯做了几处小调整，发现效率明显提升。不是靠加班，而是用清单、时间盒和高效信息整理把复杂任务拆解成可执行的步骤。",
      imageSuggestions: [
        {
          id: "53912fda-b53e-4081-ba9b-9aedf8cf5215",
          index: 1,
          title: "晨间清单＋时间盒",
          description:
            "清晨自然光下的工作桌，桌上放着待办清单、笔记本、一个小时钟，正在把今天的三件事分配到时间段，桌面整洁，背景简约。",
          status: "suggested",
        },
        {
          id: "f0290f08-3878-480d-b39e-0e71d0f3619e",
          index: 2,
          title: "信息整理区",
          description:
            "电脑屏幕分屏显示邮件和笔记软件，桌面有标签纸与便签，手边放着笔和便签，光线柔和，桌面有条理感。",
          status: "suggested",
        },
      ],
      tags: ["效率提升", "时间管理", "职场成长"],
    },
  },
  workspace: {
    activePlatform: "xiaohongshu",
    platformOrder: ["xiaohongshu"],
    lastViewedAt: "2026-04-03T12:00:00.000Z",
  },
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  const report = {
    pageLoaded: false,
    failedVisible: false,
    retryVisible: false,
    onlyCurrentSuggestionFailed: false,
    errorMessage: null,
    pageLevelErrorVisible: false,
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    report.pageLoaded = true;

    await page.evaluate(
      ({ storageKey, record }) => {
        window.localStorage.setItem(storageKey, JSON.stringify([record]));
      },
      { storageKey: HISTORY_STORAGE_KEY, record: SEEDED_FAILED_RECORD },
    );
    await page.reload({ waitUntil: "networkidle" });

    const generateButton = page.getByRole("button", { name: "生成图片" }).first();
    await generateButton.waitFor({ timeout: 10000 });
    await generateButton.click();

    const retryButton = page.getByRole("button", { name: "重试" }).first();
    await retryButton.waitFor({ timeout: 30000 });

    report.failedVisible = await page.getByText("生成失败").first().isVisible();
    report.retryVisible = await retryButton.isVisible();

    await page.waitForFunction(
      (storageKey) => {
        const raw = window.localStorage.getItem(storageKey);

        if (!raw) {
          return false;
        }

        const records = JSON.parse(raw);
        const suggestion =
          records[0]?.content?.xiaohongshu?.imageSuggestions?.[0] ?? null;

        return Boolean(
          suggestion?.status === "failed" && typeof suggestion?.imageError === "string",
        );
      },
      HISTORY_STORAGE_KEY,
      { timeout: 15000 },
    );

    const historyPayload = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    }, HISTORY_STORAGE_KEY);

    const firstRecord = historyPayload[0] ?? null;
    const suggestions = firstRecord?.content?.xiaohongshu?.imageSuggestions ?? [];
    const currentSuggestion = suggestions[0] ?? null;
    const untouchedSuggestions = suggestions.slice(1);

    report.errorMessage = currentSuggestion?.imageError ?? null;
    report.onlyCurrentSuggestionFailed =
      currentSuggestion?.status === "failed" &&
      untouchedSuggestions.every((suggestion) => suggestion?.status === "suggested");

    report.pageLevelErrorVisible = await page
      .getByText("本次生成失败，请稍后重试。")
      .count()
      .then((count) => count > 0);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
