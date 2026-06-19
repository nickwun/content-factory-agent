import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const APPEND_TEXT = " 图片联调修改。";
const SEEDED_RECORD = {
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
        "最近把日程和思维习惯做了几处小调整，发现效率明显提升。不是靠加班，而是用清单、时间盒和高效信息整理把复杂任务拆解成可执行的步骤。下面把我的实操经验分享给同样在职场打拼的你：先从三件事做起——清晰的优先级、快速整理信息、以及高强度日程中的缓冲时间。愿这些方法能在你的工作日落地，提高产出，也让生活更从容。",
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
        {
          id: "9968ac80-35f0-407c-ab8e-cf8b193dab36",
          index: 3,
          title: "深度工作段",
          description:
            "安静的办公室角落，关闭通知，屏幕只显示文档与计时器，桌上有温热的茶，氛围专注。",
          status: "suggested",
        },
      ],
      tags: ["效率提升", "时间管理", "职场成长", "高效工作", "工作方法", "日常习惯"],
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
    viewport: {
      width: 1440,
      height: 1100,
    },
  });
  const page = await context.newPage();

  const report = {
    pageLoaded: false,
    generatedIntoWorkspace: false,
    imageStatusFlow: [],
    imageGenerated: false,
    imagePreviewVisible: false,
    imageFieldsPersisted: false,
    historyCreated: false,
    autosaveWorked: false,
    reloadRestoreWorked: false,
    otherSuggestionsUntouched: false,
    imageAssetId: null,
    imageModel: null,
    imagePrompt: null,
    generatedAt: null,
    naturalWidth: null,
    naturalHeight: null,
    recordTitle: null,
    captionEndsWithAppend: false,
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    report.pageLoaded = await page
      .getByRole("heading", { name: "一次输入，生成四种平台内容草稿" })
      .isVisible();

    await page.evaluate((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, HISTORY_STORAGE_KEY);
    await page.evaluate(
      ({ storageKey, record }) => {
        window.localStorage.setItem(storageKey, JSON.stringify([record]));
      },
      { storageKey: HISTORY_STORAGE_KEY, record: SEEDED_RECORD },
    );
    await page.reload({ waitUntil: "networkidle" });

    await page
      .getByRole("button", { name: "编辑" })
      .first()
      .waitFor({ timeout: 30000 });

    report.generatedIntoWorkspace = true;

    const firstGenerateButton = page.getByRole("button", { name: "生成图片" }).first();
    await firstGenerateButton.waitFor({ timeout: 10000 });
    await firstGenerateButton.click();

    report.imageStatusFlow.push("suggested");

    const generatingButton = page.getByRole("button", { name: "生成中..." }).first();
    await generatingButton.waitFor({ timeout: 10000 });
    report.imageStatusFlow.push("generating");

    const regenerateButton = page.getByRole("button", { name: "重新生成" }).first();
    await regenerateButton.waitFor({ timeout: 240000 });
    report.imageStatusFlow.push("generated");
    report.imageGenerated = true;

    const firstImage = page.locator("article img").first();
    await firstImage.waitFor({ timeout: 15000 });
    report.imagePreviewVisible = await firstImage.isVisible();
    await page.waitForFunction(
      () => {
        const image = document.querySelector("article img");
        return Boolean(image && image.complete && image.naturalWidth > 0);
      },
      { timeout: 15000 },
    );

    const naturalSize = await firstImage.evaluate((img) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
    report.naturalWidth = naturalSize.width;
    report.naturalHeight = naturalSize.height;

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
          suggestion?.status === "generated" &&
            suggestion?.imageUrl &&
            suggestion?.imagePrompt &&
            suggestion?.imageModel &&
            suggestion?.generatedAt,
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
    const firstSuggestion =
      firstRecord?.content?.xiaohongshu?.imageSuggestions?.[0] ?? null;
    const otherSuggestions =
      firstRecord?.content?.xiaohongshu?.imageSuggestions?.slice(1) ?? [];

    report.historyCreated = historyPayload.length > 0;
    report.recordTitle = firstRecord?.content?.xiaohongshu?.title ?? null;
    report.imageModel = firstSuggestion?.imageModel ?? null;
    report.imagePrompt = firstSuggestion?.imagePrompt ?? null;
    report.generatedAt = firstSuggestion?.generatedAt ?? null;
    report.imageAssetId =
      typeof firstSuggestion?.imageUrl === "string"
        ? firstSuggestion.imageUrl.split("/").pop()
        : null;
    report.imageFieldsPersisted = Boolean(
      firstSuggestion?.imageUrl &&
        firstSuggestion?.imagePrompt &&
        firstSuggestion?.imageModel &&
        firstSuggestion?.generatedAt &&
        firstSuggestion?.status === "generated",
    );
    report.otherSuggestionsUntouched = otherSuggestions.every(
      (suggestion) => suggestion?.status === "suggested",
    );

    const captionTextarea = page.locator("textarea").first();
    const currentCaption = await captionTextarea.inputValue();
    await captionTextarea.fill(`${currentCaption}${APPEND_TEXT}`);
    await page.waitForTimeout(1600);

    const persistedAfterEdit = await page.evaluate(
      ({ storageKey, appendedText }) => {
        const raw = window.localStorage.getItem(storageKey);

        if (!raw) {
          return false;
        }

        const records = JSON.parse(raw);
        const caption = records[0]?.content?.xiaohongshu?.caption ?? "";
        return typeof caption === "string" && caption.endsWith(appendedText);
      },
      { storageKey: HISTORY_STORAGE_KEY, appendedText: APPEND_TEXT },
    );

    report.autosaveWorked = persistedAfterEdit;

    await page.reload({ waitUntil: "networkidle" });
    const reloadedCaption = await page.locator("textarea").first().inputValue();
    const reloadedFirstImage = page.locator("article img").first();
    report.captionEndsWithAppend = reloadedCaption.endsWith(APPEND_TEXT);
    report.reloadRestoreWorked =
      report.captionEndsWithAppend && (await reloadedFirstImage.isVisible());
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
