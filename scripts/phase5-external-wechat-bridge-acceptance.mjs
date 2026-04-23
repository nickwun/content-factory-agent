import {
  BASE_URL,
  buildGenerateSuccessPayload,
  clearLocalStorageKeys,
  createFailureScreenshot,
  createFlowReport,
  ensurePromptPreset,
  expectWorkspaceReady,
  launchAcceptancePage,
  readHistoryRecords,
} from "./helpers/browser-flow-fixtures.mjs";

const EXTERNAL_WECHAT_STORAGE_KEY = "content-agent-external-wechat";
const EXTERNAL_REWRITE_TASK_STORAGE_KEY = "content-agent-external-rewrite-tasks";

const MOCK_KEYWORD = "跑步";
const MOCK_TIME_WINDOW = "7d";

const SEARCH_ARTICLES = [
  {
    id: "external-article-1",
    keyword: MOCK_KEYWORD,
    timeWindow: MOCK_TIME_WINDOW,
    title: "第一次半马前，最该准备的不是配速，而是节奏",
    accountName: "跑步研究所",
    publishTime: "2026-04-20T10:00:00.000Z",
    url: "https://example.com/article-1",
    fetchedAt: "2026-04-22T06:00:00.000Z",
    contentFetchStatus: "pending",
  },
  {
    id: "external-article-2",
    keyword: MOCK_KEYWORD,
    timeWindow: MOCK_TIME_WINDOW,
    title: "很多人越练越累，不是因为不努力，而是恢复节奏错了",
    accountName: "耐力训练笔记",
    publishTime: "2026-04-19T08:30:00.000Z",
    url: "https://example.com/article-2",
    fetchedAt: "2026-04-22T06:00:00.000Z",
    contentFetchStatus: "pending",
  },
];

const CONTENT_READY_ARTICLES = SEARCH_ARTICLES.map((article, index) => ({
  ...article,
  content:
    index === 0
      ? "第一次半马前，真正重要的不是盯着配速焦虑，而是先把自己的节奏建立起来。"
      : "恢复不是训练的边角料，而是让训练真正被身体吸收的那一段时间。",
  contentFetchStatus: "success",
}));

const INSIGHT = {
  id: "insight-1",
  keyword: MOCK_KEYWORD,
  timeWindow: MOCK_TIME_WINDOW,
  articleIds: CONTENT_READY_ARTICLES.map((article) => article.id),
  summary: "这批爆文更容易起量，是因为标题和正文都围绕训练焦虑给了更具体的节奏判断。",
  titlePatterns: ["用常见误区反转做标题抓手"],
  demandDrivers: ["击中跑者对训练节奏和恢复安排的判断焦虑"],
  structurePatterns: ["先拆误区，再给更稳的训练节奏"],
  stylePatterns: ["像过来人提醒，少空话，多具体场景"],
  emotionalDrivers: ["焦虑感起手，再给可执行的稳定感"],
  rewritePotential: ["更值得学选题切口和结构，不要照搬原作者经验细节"],
  references: ["适合作为公众号训练建议类长文的素材来源"],
  createdAt: "2026-04-22T06:10:00.000Z",
};

async function main() {
  const rewritePreset = await ensurePromptPreset({
    baseUrl: BASE_URL,
    platform: "wechat_article",
    processingMode: "rewrite",
    name: "Phase5 外部桥接预设",
    promptTemplate: "基于外部爆款素材重写成适合公众号发布的中文长文。",
  });

  const { browser, page } = await launchAcceptancePage();
  const externalWechatSelectionFlow = createFlowReport(
    "external_wechat_selection_flow",
  );
  const workspaceBridgeFlow = createFlowReport("workspace_bridge_flow");

  const requestLog = {
    search: [],
    fetchContent: [],
    analyze: [],
    rewriteTask: [],
    generate: [],
  };

  await installRouteMocks(page, requestLog, rewritePreset);

  try {
    await runSelectionFlow(page, externalWechatSelectionFlow, rewritePreset);
    if (externalWechatSelectionFlow.success) {
      await runWorkspaceBridgeFlow(
        page,
        workspaceBridgeFlow,
        requestLog,
        rewritePreset,
      );
    } else {
      workspaceBridgeFlow.success = false;
      workspaceBridgeFlow.failureStep = "selection_flow_failed";
      workspaceBridgeFlow.errorMessage =
        "Skipped workspace bridge flow because selection flow did not complete.";
    }
  } finally {
    await browser.close();
  }

  const report = {
    flowName: "external_wechat_bridge_acceptance",
    success:
      externalWechatSelectionFlow.success && workspaceBridgeFlow.success,
    failureStep:
      externalWechatSelectionFlow.failureStep ||
      workspaceBridgeFlow.failureStep ||
      null,
    external_wechat_selection_flow: externalWechatSelectionFlow,
    workspace_bridge_flow: workspaceBridgeFlow,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.success) {
    process.exitCode = 1;
  }
}

async function installRouteMocks(page, requestLog, rewritePreset) {
  await page.route("**/api/topics/external-wechat/search", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    requestLog.search.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        articles: SEARCH_ARTICLES,
      }),
    });
  });

  await page.route(
    "**/api/topics/external-wechat/fetch-content",
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      requestLog.fetchContent.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          articles: CONTENT_READY_ARTICLES,
        }),
      });
    },
  );

  await page.route("**/api/topics/external-wechat/analyze", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    requestLog.analyze.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        insight: INSIGHT,
      }),
    });
  });

  await page.route(
    "**/api/topics/external-wechat/rewrite-tasks",
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      requestLog.rewriteTask.push(body);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          externalRewriteTask: {
            id: "external-task-browser-1",
            keyword: body.keyword,
            timeWindow: body.timeWindow,
            selectedArticleIds: body.selectedArticleIds,
            brief: {
              keyword: body.keyword,
              insightSummary: INSIGHT.summary,
              references: INSIGHT.references,
              sourceArticles: CONTENT_READY_ARTICLES.filter((article) =>
                body.selectedArticleIds.includes(article.id),
              ).map((article) => ({
                id: article.id,
                title: article.title,
                accountName: article.accountName,
                publishTime: article.publishTime,
              })),
              rewriteGoal: "把外部爆款素材整理成一篇公众号长文",
              styleProfile: "更像稳定的公众号训练建议文章",
            },
            status: "pending",
            createdAt: "2026-04-22T06:20:00.000Z",
            updatedAt: "2026-04-22T06:20:00.000Z",
          },
          generatePayload: {
            userPrompt: "已根据外部爆款素材和提示词预设自动组织仿写输入。",
            selectedPlatforms: ["wechat_article"],
            selectedPromptPresetByPlatform: {
              wechat_article: rewritePreset.id,
            },
            rewriteSource: {
              kind: "pasted_text",
              sourceName: "外部爆款素材合集",
              extractedText: CONTENT_READY_ARTICLES.map((article) => article.content).join(
                "\n\n",
              ),
              charCount: CONTENT_READY_ARTICLES.reduce(
                (sum, article) => sum + (article.content?.length ?? 0),
                0,
              ),
              truncated: false,
            },
          },
        }),
      });
    },
  );

  await page.route("**/api/generate", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    requestLog.generate.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildGenerateSuccessPayload({
          title: "跑步训练里最容易被忽略的，其实是节奏感",
          markdownBody: [
            "很多跑者一开始总盯着配速，却忽略了自己有没有进入稳定节奏。",
            "",
            "真正决定训练能不能持续推进的，往往不是某一次跑得多快，而是你能不能把训练、恢复和日常状态放进同一个节奏里。",
            "",
            "如果只知道一味加量，身体很快会用疲劳提醒你：恢复不是附属动作，而是训练的一部分。",
          ].join("\n"),
          blocks: [
            {
              id: "p-1",
              type: "paragraph",
              text: "很多跑者一开始总盯着配速，却忽略了自己有没有进入稳定节奏。",
            },
            {
              id: "p-2",
              type: "paragraph",
              text: "真正决定训练能不能持续推进的，往往不是某一次跑得多快，而是你能不能把训练、恢复和日常状态放进同一个节奏里。",
            },
            {
              id: "p-3",
              type: "paragraph",
              text: "如果只知道一味加量，身体很快会用疲劳提醒你：恢复不是附属动作，而是训练的一部分。",
            },
          ],
          promptSetting: rewritePreset,
        }),
      ),
    });
  });
}

async function runSelectionFlow(page, report, rewritePreset) {
  try {
    await page.goto(`${BASE_URL}/topics/wechat-hot`, { waitUntil: "networkidle" });
    await clearLocalStorageKeys(page, [
      "content-agent-history",
      EXTERNAL_WECHAT_STORAGE_KEY,
      EXTERNAL_REWRITE_TASK_STORAGE_KEY,
    ]);
    await page.reload({ waitUntil: "networkidle" });

    await page
      .getByRole("heading", { name: "选题中心 / 公众号爆款抓取与分析" })
      .waitFor({ timeout: 10000 });
    report.pageOpened = true;

    const startButton = page.getByRole("button", {
      name: "进入创作中心仿写",
      exact: true,
    });
    report.startDisabledWithoutSelection = await startButton.isDisabled();
    if (!report.startDisabledWithoutSelection) {
      report.failureStep = "start_should_be_disabled_without_selected_articles";
      throw new Error("Bridge button should stay disabled before any article is selected.");
    }

    await page.getByPlaceholder("例如：马拉松 / AI 教育 / 父母关系").fill(MOCK_KEYWORD);
    await page.getByRole("button", { name: "抓取爆款文章", exact: true }).click();
    await page.getByText(SEARCH_ARTICLES[0].title).waitFor({ timeout: 10000 });
    await page.getByText(SEARCH_ARTICLES[1].title).waitFor({ timeout: 10000 });
    report.mockArticlesRendered = true;

    await page
      .getByRole("button", { name: "补拉当前列表正文", exact: true })
      .click();
    await page.getByText("正文已补全").first().waitFor({ timeout: 10000 });
    report.contentFetchCompleted = true;

    const firstCheckbox = page.getByRole("checkbox").first();
    await firstCheckbox.check();
    report.articleSelected = await firstCheckbox.isChecked();

    report.startDisabledWithoutPreset = await startButton.isDisabled();
    if (!report.startDisabledWithoutPreset) {
      report.failureStep = "start_should_be_disabled_without_prompt_preset";
      throw new Error("Bridge button should stay disabled before prompt preset selection.");
    }

    const bridgePresetSelect = page.locator(
      'label:has-text("提示词预设（必选）") select',
    );
    await bridgePresetSelect.selectOption({ label: rewritePreset.name });
    report.promptPresetSelected = true;

    report.startEnabledWithPreset = !(await startButton.isDisabled());
    if (!report.startEnabledWithPreset) {
      report.failureStep = "start_should_be_enabled_after_selection_and_preset";
      throw new Error("Bridge button did not become enabled after article and preset were ready.");
    }

    report.success =
      report.pageOpened &&
      report.mockArticlesRendered &&
      report.contentFetchCompleted &&
      report.articleSelected &&
      report.startDisabledWithoutSelection &&
      report.startDisabledWithoutPreset &&
      report.promptPresetSelected &&
      report.startEnabledWithPreset;
  } catch (error) {
    report.success = false;
    report.failureStep =
      report.failureStep ?? "external_wechat_selection_flow_unexpected_error";
    report.errorMessage = error instanceof Error ? error.message : String(error);
    report.screenshotPath = await createFailureScreenshot(page, report.flowName);
  }
}

async function runWorkspaceBridgeFlow(page, report, requestLog, rewritePreset) {
  try {
    const startButton = page.getByRole("button", {
      name: "进入创作中心仿写",
      exact: true,
    });
    await startButton.click();

    await expectWorkspaceReady(page);
    report.workspaceOpened = true;

    const historyRecords = await readHistoryRecords(page);
    const firstRecord = historyRecords[0];
    report.historyRecordCreated = Boolean(firstRecord?.content?.wechat_article);
    report.recordProcessingMode = firstRecord?.generation?.processingMode ?? null;
    report.recordSourceKind = firstRecord?.traceContext?.sourceKind ?? null;
    report.workspaceRewriteLabelVisible = await page
      .getByText("仿写", { exact: true })
      .first()
      .isVisible();

    const rewriteTaskRequest = requestLog.rewriteTask.at(-1);
    const generateRequest = requestLog.generate.at(-1);
    report.rewriteTaskRequested = Boolean(rewriteTaskRequest);
    report.generateRequested = Boolean(generateRequest);
    report.selectedArticleCount = rewriteTaskRequest?.selectedArticleIds?.length ?? 0;
    report.promptPresetIdSent = rewriteTaskRequest?.promptPresetId ?? null;
    report.generatedPresetId =
      generateRequest?.selectedPromptPresetByPlatform?.wechat_article ?? null;

    const storedTasks = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    }, EXTERNAL_REWRITE_TASK_STORAGE_KEY);
    report.externalTaskStored = Boolean(storedTasks[0]?.generatedRecordId);

    report.success =
      report.workspaceOpened &&
      report.historyRecordCreated &&
      report.recordProcessingMode === "rewrite" &&
      report.recordSourceKind === "external_rewrite_task" &&
      report.workspaceRewriteLabelVisible &&
      report.rewriteTaskRequested &&
      report.generateRequested &&
      report.selectedArticleCount === 1 &&
      report.promptPresetIdSent === rewritePreset.id &&
      report.generatedPresetId === rewritePreset.id &&
      report.externalTaskStored;
  } catch (error) {
    report.success = false;
    report.failureStep = report.failureStep ?? "workspace_bridge_flow_unexpected_error";
    report.errorMessage = error instanceof Error ? error.message : String(error);
    report.screenshotPath = await createFailureScreenshot(page, report.flowName);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
