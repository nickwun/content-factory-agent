import {
  createFailureScreenshot,
  createFlowReport,
  expectWorkspaceReady,
  launchAcceptancePage,
  openWorkspaceWithHistory,
  readPublishResults,
} from "./helpers/browser-flow-fixtures.mjs";

const SEEDED_RECORD = {
  id: "phase5-publish-record-1",
  schemaVersion: 1,
  autoTitle: "跑步之后，脑子会慢慢亮起来",
  title: "跑步之后，脑子会慢慢亮起来",
  isCustomTitle: false,
  userPrompt: "基于现有素材整理成适合公众号发布的文章。",
  selectedPlatforms: ["wechat_article"],
  createdAt: "2026-04-22T08:00:00.000Z",
  updatedAt: "2026-04-22T08:00:00.000Z",
  generation: {
    generatorVersion: "phase5-browser-acceptance",
    modelProvider: "mock",
    modelName: "browser-flow-mock",
    generatedAt: "2026-04-22T08:00:00.000Z",
    processingMode: "rewrite",
    selectedPlatformsSnapshot: ["wechat_article"],
    promptSnapshotByPlatform: {
      wechat_article: "把素材整理成适合公众号发布的中文文章。",
    },
  },
  content: {
    wechat_article: {
      platform: "wechat_article",
      title: "跑步之后，脑子会慢慢亮起来",
      markdownBody: [
        "## 跑步不是消耗，而是让脑子重新亮起来",
        "",
        "很多时候，我们以为自己只是累了，其实是被信息和判断塞满了。",
        "",
        "跑步最有价值的地方，不只是流汗，而是让身体先动起来，再把脑子慢慢带回清晰。",
      ].join("\n"),
      coverImage: {
        status: "generated",
        imageUrl: "/api/generated-images/phase5-cover.jpg",
        generatedAt: "2026-04-22T08:00:00.000Z",
      },
      blocks: [
        {
          id: "heading-1",
          type: "heading",
          level: 2,
          text: "跑步不是消耗，而是让脑子重新亮起来",
        },
        {
          id: "paragraph-1",
          type: "paragraph",
          text: "很多时候，我们以为自己只是累了，其实是被信息和判断塞满了。",
        },
        {
          id: "paragraph-2",
          type: "paragraph",
          text: "跑步最有价值的地方，不只是流汗，而是让身体先动起来，再把脑子慢慢带回清晰。",
        },
      ],
    },
  },
  traceContext: {
    sourceKind: "direct_create",
    createdFromPlatform: "wechat_article",
  },
  workspace: {
    activePlatform: "wechat_article",
    platformOrder: ["wechat_article"],
    lastViewedAt: "2026-04-22T08:00:00.000Z",
  },
};

const WECHAT_ACCOUNTS = [
  {
    accountId: "wechat-account-1",
    nickname: "测试公众号",
    principalName: "内容工厂实验室",
    verified: true,
    status: "active",
    supportedPublishTypes: ["article"],
  },
];

const FEISHU_RESPONSE = {
  success: true,
  documentId: "doc-browser-1",
  documentUrl: "https://feishu.example.com/doc/browser-1",
  bodyPublished: true,
  coverSyncStatus: "failed",
  coverSyncFailureReason: "upload_failed",
  warningMessage: "头图同步失败，已保留正文内容。",
  message: "飞书文档已创建，正文已发布，头图未同步。",
};

const WECHAT_RESPONSE = {
  success: true,
  publicationId: "wechat-publication-1",
  materialId: "wechat-material-1",
  status: "draft",
  message: "公众号草稿已创建。",
};

async function main() {
  const { browser, page } = await launchAcceptancePage();
  const feishuPublishFlow = createFlowReport("feishu_publish_flow");
  const wechatPublishFlow = createFlowReport("wechat_publish_flow");
  const requestLog = {
    wechatAccounts: [],
    feishuPublish: [],
    wechatPublish: [],
  };

  await installPublishRouteMocks(page, requestLog);

  try {
    await openWorkspaceWithHistory(page, [SEEDED_RECORD]);
    await runFeishuPublishFlow(page, feishuPublishFlow, requestLog);

    if (feishuPublishFlow.success) {
      await runWechatPublishFlow(page, wechatPublishFlow, requestLog);
    } else {
      wechatPublishFlow.success = false;
      wechatPublishFlow.failureStep = "feishu_flow_failed";
      wechatPublishFlow.errorMessage =
        "Skipped wechat publish flow because feishu publish flow did not complete.";
    }
  } finally {
    await browser.close();
  }

  const report = {
    flowName: "publish_flow_acceptance",
    success: feishuPublishFlow.success && wechatPublishFlow.success,
    failureStep:
      feishuPublishFlow.failureStep || wechatPublishFlow.failureStep || null,
    feishu_publish_flow: feishuPublishFlow,
    wechat_publish_flow: wechatPublishFlow,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.success) {
    process.exitCode = 1;
  }
}

async function installPublishRouteMocks(page, requestLog) {
  await page.route("**/api/publish/wechat/accounts", async (route) => {
    requestLog.wechatAccounts.push({
      method: route.request().method(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: WECHAT_ACCOUNTS,
      }),
    });
  });

  await page.route("**/api/publish/feishu", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    requestLog.feishuPublish.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FEISHU_RESPONSE),
    });
  });

  await page.route("**/api/publish/wechat", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    requestLog.wechatPublish.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WECHAT_RESPONSE),
    });
  });
}

async function runFeishuPublishFlow(page, report, requestLog) {
  try {
    await expectWorkspaceReady(page);
    report.workspaceReady = true;

    await page.getByRole("button", { name: "发布", exact: true }).click();
    await page
      .getByRole("heading", { name: "发布到公众号草稿箱" })
      .waitFor({ timeout: 10000 });
    report.publishDialogOpened = true;

    const dialog = page.locator("div.fixed.inset-0.z-50").last();
    await dialog.locator("button").filter({ hasText: "飞书文档" }).first().click();
    report.feishuTargetSelected = true;

    const feishuSubmitButton = dialog.getByRole("button", {
      name: "发布到飞书文档",
      exact: true,
    });
    await feishuSubmitButton.waitFor({ timeout: 10000 });
    await feishuSubmitButton.click();

    const resultDialog = page.locator("div.fixed.inset-0.z-\\[60\\]").last();
    await resultDialog
      .getByRole("heading", { name: "飞书文档部分成功" })
      .waitFor({ timeout: 10000 });
    report.resultDialogVisible = true;
    report.partialSuccessTitleVisible = true;

    const warningVisible = await resultDialog
      .getByText("头图同步失败，已保留正文内容。")
      .isVisible();
    const coverWarningVisible = await resultDialog.getByText("头图未同步").isVisible();
    report.warningVisible = warningVisible;
    report.coverWarningVisible = coverWarningVisible;

    await resultDialog.getByRole("button", { name: "关闭", exact: true }).click();

    report.latestPublishDestinationVisible = await page
      .getByText("飞书文档", { exact: true })
      .first()
      .isVisible();
    report.latestPublishPartialSuccessVisible = await page
      .getByText("部分成功", { exact: true })
      .first()
      .isVisible();
    report.latestPublishWarningVisible = await page
      .getByText("头图同步失败，已保留正文内容。")
      .first()
      .isVisible();

    const publishResults = await readPublishResults(page);
    const latestPublishResult = publishResults[0];
    report.publishResultStored = Boolean(latestPublishResult);
    report.publishResultStatus = latestPublishResult?.status ?? null;
    report.publishResultDestination = latestPublishResult?.destination ?? null;
    report.wechatAccountsRequested = requestLog.wechatAccounts.length > 0;
    report.feishuPublishRequested = requestLog.feishuPublish.length === 1;

    report.success =
      report.workspaceReady &&
      report.publishDialogOpened &&
      report.feishuTargetSelected &&
      report.resultDialogVisible &&
      report.warningVisible &&
      report.coverWarningVisible &&
      report.latestPublishDestinationVisible &&
      report.latestPublishPartialSuccessVisible &&
      report.latestPublishWarningVisible &&
      report.publishResultStored &&
      report.publishResultStatus === "partial_success" &&
      report.publishResultDestination === "feishu_doc" &&
      report.wechatAccountsRequested &&
      report.feishuPublishRequested;
    if (!report.success) {
      report.failureStep = "feishu_publish_assertions_failed";
    }
  } catch (error) {
    report.success = false;
    report.failureStep = report.failureStep ?? "feishu_publish_flow_unexpected_error";
    report.errorMessage = error instanceof Error ? error.message : String(error);
    report.screenshotPath = await createFailureScreenshot(page, report.flowName);
  }
}

async function runWechatPublishFlow(page, report, requestLog) {
  try {
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await page
      .getByRole("heading", { name: "发布到公众号草稿箱" })
      .waitFor({ timeout: 10000 });
    report.publishDialogOpened = true;

    const dialog = page.locator("div.fixed.inset-0.z-50").last();
    await dialog
      .locator("label")
      .filter({ hasText: "测试公众号" })
      .first()
      .waitFor({ timeout: 10000 });
    report.accountLoaded = true;

    const submitButton = dialog.getByRole("button", {
      name: "发布到草稿箱",
      exact: true,
    });
    report.submitEnabled = await submitButton.isEnabled();
    await submitButton.click();

    await page
      .getByRole("heading", { name: "发布到公众号草稿箱" })
      .waitFor({ state: "hidden", timeout: 10000 });
    report.dialogClosedAfterSuccess = true;

    report.latestPublishDestinationVisible = await page
      .getByText("公众号草稿箱", { exact: true })
      .first()
      .isVisible();
    report.latestPublishSuccessVisible = await page
      .getByText("成功", { exact: true })
      .first()
      .isVisible();

    const publishResults = await readPublishResults(page);
    const latestPublishResult = publishResults[0];
    report.publishResultCount = publishResults.length;
    report.latestPublishStatus = latestPublishResult?.status ?? null;
    report.latestPublishDestination = latestPublishResult?.destination ?? null;
    report.wechatPublishRequested = requestLog.wechatPublish.length === 1;
    report.wechatAccountIdSent =
      requestLog.wechatPublish[0]?.accountId ?? null;
    report.wechatPublishTypeSent =
      requestLog.wechatPublish[0]?.publishType ?? null;

    report.success =
      report.publishDialogOpened &&
      report.accountLoaded &&
      report.submitEnabled &&
      report.dialogClosedAfterSuccess &&
      report.latestPublishDestinationVisible &&
      report.latestPublishSuccessVisible &&
      report.publishResultCount === 2 &&
      report.latestPublishStatus === "success" &&
      report.latestPublishDestination === "wechat_article" &&
      report.wechatPublishRequested &&
      report.wechatAccountIdSent === "wechat-account-1" &&
      report.wechatPublishTypeSent === "article";
    if (!report.success) {
      report.failureStep = "wechat_publish_assertions_failed";
    }
  } catch (error) {
    report.success = false;
    report.failureStep = report.failureStep ?? "wechat_publish_flow_unexpected_error";
    report.errorMessage = error instanceof Error ? error.message : String(error);
    report.screenshotPath = await createFailureScreenshot(page, report.flowName);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
