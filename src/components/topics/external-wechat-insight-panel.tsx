"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  buildGenerateErrorMessage,
  GenerateRequestError,
  requestGeneratedDraft,
} from "@/lib/generation/generate-client";
import { createLocalHistoryStorage } from "@/lib/history/local-history-storage";
import { createHistoryRecord } from "@/lib/history/history-record-factory";
import {
  createDraftGeneratedEvent,
  createExecutionEventStore,
  createFinalizationCompletedEvent,
  createRecordCreatedEvent,
  createRunId,
} from "@/lib/observability/execution-event-store";
import { createExternalRewriteTaskStore } from "@/lib/topics/external-rewrite-task-store";
import { getInsightSectionItems } from "@/lib/topics/external-wechat-insight-ui";
import { createExternalWechatStore } from "@/lib/topics/external-wechat-store";
import type { PlatformPromptSetting } from "@/lib/settings/prompt-settings-types";
import type {
  ExternalRewriteTask,
  ExternalTopicInsight,
  ExternalWechatArticle,
  ExternalWechatTimeWindow,
} from "@/lib/topics/external-wechat-types";

type SearchResponse =
  | {
      articles: ExternalWechatArticle[];
    }
  | {
      insight: ExternalTopicInsight;
    }
  | {
      externalRewriteTask: ExternalRewriteTask;
      generatePayload: Parameters<typeof requestGeneratedDraft>[1];
    }
  | {
      error?: string | { code?: string; message?: string };
    };

const TIME_WINDOW_OPTIONS: Array<{
  value: ExternalWechatTimeWindow;
  label: string;
}> = [
  { value: "all", label: "不限" },
  { value: "1d", label: "最近 1 天" },
  { value: "7d", label: "最近 7 天" },
  { value: "6m", label: "最近半年" },
];

const INSIGHT_SECTIONS: Array<{
  key:
    | "titlePatterns"
    | "demandDrivers"
    | "structurePatterns"
    | "stylePatterns"
    | "emotionalDrivers"
    | "rewritePotential"
    | "references";
  title: string;
  emptyLabel: string;
}> = [
  {
    key: "titlePatterns",
    title: "标题特点",
    emptyLabel: "当前样本不足，暂未输出值得借鉴的标题特点。",
  },
  {
    key: "demandDrivers",
    title: "痛点与需求方向",
    emptyLabel: "当前样本不足，暂未输出清晰的需求方向。",
  },
  {
    key: "structurePatterns",
    title: "内容结构",
    emptyLabel: "当前样本不足，暂未输出稳定的内容骨架。",
  },
  {
    key: "stylePatterns",
    title: "表达风格",
    emptyLabel: "当前样本不足，暂未输出稳定的表达风格特征。",
  },
  {
    key: "emotionalDrivers",
    title: "情绪驱动",
    emptyLabel: "当前样本不足，暂未输出清晰的情绪驱动判断。",
  },
  {
    key: "rewritePotential",
    title: "可仿写性",
    emptyLabel: "当前样本不足，暂未输出可仿写性的明确建议。",
  },
  {
    key: "references",
    title: "值得参考的地方",
    emptyLabel: "当前样本不足，暂未输出总结性参考结论。",
  },
];

export function ExternalWechatInsightPanel() {
  const router = useRouter();
  const externalWechatStore = useMemo(() => createExternalWechatStore(), []);
  const externalRewriteTaskStore = useMemo(
    () => createExternalRewriteTaskStore(),
    [],
  );
  const historyStorage = useMemo(() => createLocalHistoryStorage(), []);
  const executionEventStore = useMemo(() => createExecutionEventStore(), []);
  const [keyword, setKeyword] = useState("");
  const [timeWindow, setTimeWindow] = useState<ExternalWechatTimeWindow>("7d");
  const [articles, setArticles] = useState<ExternalWechatArticle[]>([]);
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [contentFetchState, setContentFetchState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contentFetchError, setContentFetchError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [latestInsight, setLatestInsight] = useState<ExternalTopicInsight | null>(
    null,
  );
  const [promptPresets, setPromptPresets] = useState<PlatformPromptSetting[]>([]);
  const [selectedPromptPresetId, setSelectedPromptPresetId] = useState("");
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [rewriteTaskState, setRewriteTaskState] = useState<
    "idle" | "running" | "error"
  >("idle");
  const [rewriteTaskError, setRewriteTaskError] = useState<string | null>(null);
  const [rewriteTaskNotice, setRewriteTaskNotice] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestState() {
      const latestState = await externalWechatStore.getLatestQueryState();

      if (!latestState || cancelled) {
        return;
      }

      setKeyword(latestState.keyword);
      setTimeWindow(latestState.timeWindow);
      setArticles(latestState.articles);
      setLatestInsight(latestState.latestInsight ?? null);
      setLastUpdatedAt(latestState.updatedAt);
      setSelectedArticleIds([]);
    }

    void loadLatestState();

    return () => {
      cancelled = true;
    };
  }, [externalWechatStore]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/prompt-presets?platforms=wechat_article");
        if (!response.ok) {
          throw new Error("load prompt presets failed");
        }

        const data = (await response.json()) as {
          presetGroups: Array<{ platform: string; presets: PlatformPromptSetting[] }>;
        };
        if (!cancelled) {
          setPromptPresets(data.presetGroups[0]?.presets ?? []);
        }
      } catch {
        if (!cancelled) {
          setPromptPresets([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch() {
    if (!keyword.trim()) {
      setLoadingState("error");
      setErrorMessage("先输入关键词，再开始抓取爆款文章。");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/topics/external-wechat/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword,
          timeWindow,
        }),
      });

      const payload = (await response.json()) as SearchResponse;

      if (!response.ok || !("articles" in payload)) {
        throw new Error(resolveSearchErrorMessage(payload));
      }

      const updatedAt = new Date().toISOString();
      setArticles(payload.articles);
      setLatestInsight(null);
      setSelectedArticleIds([]);
      setLastUpdatedAt(updatedAt);
      setLoadingState("idle");
      setContentFetchState("idle");
      setContentFetchError(null);
      setAnalysisState("idle");
      setAnalysisError(null);
      setRewriteTaskState("idle");
      setRewriteTaskError(null);
      setRewriteTaskNotice(null);
      await externalWechatStore.saveLatestQueryState({
        keyword,
        timeWindow,
        articles: payload.articles,
        updatedAt,
      });
    } catch (error) {
      setLoadingState("error");
      setErrorMessage(error instanceof Error ? error.message : "抓取爆款文章失败。");
    }
  }

  async function handleFetchContents() {
    if (articles.length === 0) {
      return;
    }

    const loadingArticles: ExternalWechatArticle[] = articles.map((article) => ({
      ...article,
      contentFetchStatus:
        article.contentFetchStatus === "success" ? "success" : "loading",
      contentFetchError:
        article.contentFetchStatus === "success"
          ? article.contentFetchError
          : undefined,
    }));

    setArticles(loadingArticles);
    setContentFetchState("loading");
    setContentFetchError(null);

    try {
      const response = await fetch("/api/topics/external-wechat/fetch-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articles: loadingArticles,
        }),
      });

      const payload = (await response.json()) as SearchResponse;

      if (!response.ok || !("articles" in payload)) {
        throw new Error(resolveSearchErrorMessage(payload));
      }

      const updatedAt = new Date().toISOString();
      setArticles(payload.articles);
      setLatestInsight(null);
      setSelectedArticleIds((current) =>
        current.filter((id) =>
          payload.articles.some(
            (article) =>
              article.id === id && article.contentFetchStatus === "success",
          ),
        ),
      );
      setLastUpdatedAt(updatedAt);
      setContentFetchState("idle");
      setAnalysisState("idle");
      setAnalysisError(null);
      setRewriteTaskState("idle");
      setRewriteTaskError(null);
      setRewriteTaskNotice(null);
      await externalWechatStore.saveLatestQueryState({
        keyword,
        timeWindow,
        articles: payload.articles,
        updatedAt,
      });
    } catch (error) {
      setContentFetchState("error");
      setContentFetchError(
        error instanceof Error ? error.message : "正文补拉失败，请稍后重试。",
      );
    }
  }

  async function handleAnalyze() {
    if (articles.length === 0) {
      return;
    }

    setAnalysisState("loading");
    setAnalysisError(null);

    try {
      const response = await fetch("/api/topics/external-wechat/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword,
          timeWindow,
          articles,
        }),
      });

      const payload = (await response.json()) as SearchResponse;

      if (!response.ok || !("insight" in payload)) {
        throw new Error(resolveSearchErrorMessage(payload));
      }

      const updatedAt = new Date().toISOString();
      setLatestInsight(payload.insight);
      setLastUpdatedAt(updatedAt);
      setAnalysisState("idle");
      await externalWechatStore.saveLatestQueryState({
        keyword,
        timeWindow,
        articles,
        latestInsight: payload.insight,
        updatedAt,
      });
    } catch (error) {
      setAnalysisState("error");
      setAnalysisError(error instanceof Error ? error.message : "爆款分析失败，请稍后重试。");
    }
  }

  async function recordGenerationLifecycle(
    nextRecord: ReturnType<typeof createHistoryRecord>,
    runId: string,
  ) {
    try {
      const platform =
        nextRecord.traceContext?.createdFromPlatform ??
        nextRecord.selectedPlatforms[0];
      const events = [
        createRecordCreatedEvent({
          runId,
          recordId: nextRecord.id,
          createdAt: nextRecord.createdAt,
          platform,
          modelName: nextRecord.generation.modelName,
        }),
        createDraftGeneratedEvent({
          runId,
          recordId: nextRecord.id,
          createdAt: nextRecord.createdAt,
          platform,
          modelName: nextRecord.generation.modelName,
        }),
      ];

      if (nextRecord.generation.wechatFinalizationApplied === true) {
        events.push(
          createFinalizationCompletedEvent({
            runId,
            recordId: nextRecord.id,
            createdAt: nextRecord.createdAt,
            platform,
            modelName: nextRecord.generation.modelName,
          }),
        );
      }

      for (const event of events) {
        await executionEventStore.append(event);
      }
    } catch {
      // Keep the external rewrite flow usable even if observability persistence fails.
    }
  }

  async function markRecordAsActive(recordId: string) {
    const record = await historyStorage.getById(recordId);

    if (!record) {
      return;
    }

    await historyStorage.save({
      ...record,
      workspace: {
        ...record.workspace,
        lastViewedAt: new Date().toISOString(),
      },
    });
  }

  async function handleStartExternalRewrite() {
    const validationMessage = resolveSelectionValidationMessage(
      selectedArticleIds,
      articles,
    );

    if (validationMessage) {
      setRewriteTaskState("error");
      setRewriteTaskError(validationMessage);
      return;
    }

    setRewriteTaskState("running");
    setRewriteTaskError(null);
    setRewriteTaskNotice(null);

    let createdTask: ExternalRewriteTask | null = null;

    try {
      const response = await fetch("/api/topics/external-wechat/rewrite-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword,
          timeWindow,
          selectedArticleIds,
          articles,
          ...(selectedPromptPresetId
            ? { promptPresetId: selectedPromptPresetId }
            : {}),
          ...(latestInsight ? { insight: latestInsight } : {}),
        }),
      });

      const payload = (await response.json()) as SearchResponse;

      if (
        !response.ok ||
        !("externalRewriteTask" in payload) ||
        !("generatePayload" in payload)
      ) {
        throw new Error(resolveSearchErrorMessage(payload));
      }

      createdTask = {
        ...payload.externalRewriteTask,
        status: "running",
        updatedAt: new Date().toISOString(),
      };
      await externalRewriteTaskStore.upsert(createdTask);

      const result = await requestGeneratedDraft(fetch, payload.generatePayload);
      const now = new Date().toISOString();
      const runId = createRunId("generation");
      const resolvedUserPrompt =
        payload.generatePayload.userPrompt ??
        "已根据外部爆款素材和提示词预设自动组织仿写输入。";
      const nextRecord = createHistoryRecord({
        userPrompt: resolvedUserPrompt,
        selectedPlatforms: [...payload.generatePayload.selectedPlatforms],
        now,
        autoTitle: result.draft.autoTitle,
        content: result.draft.content,
        promptSettings: result.promptSettings,
        generationInfo: result.draft.generationInfo,
        rewriteSource: payload.generatePayload.rewriteSource,
        traceContext: {
          sourceKind: "external_rewrite_task",
          externalRewriteTaskId: payload.externalRewriteTask.id,
          externalKeyword: keyword.trim(),
          representativeArticleIds: selectedArticleIds,
          externalArticleCount: selectedArticleIds.length,
          createdFromPlatform: "wechat_article",
        },
      });

      await historyStorage.create(nextRecord);
      await recordGenerationLifecycle(nextRecord, runId);

      await externalRewriteTaskStore.upsert({
        ...createdTask,
        status: "succeeded",
        generatedRecordId: nextRecord.id,
        error: undefined,
        updatedAt: new Date().toISOString(),
      });

      await markRecordAsActive(nextRecord.id);
      setRewriteTaskState("idle");
      setRewriteTaskNotice(
        `已基于 ${selectedArticleIds.length} 篇外部爆款素材创建公众号草稿，正在进入创作中心。`,
      );
      router.push("/?view=workspace");
    } catch (error) {
      const message =
        error instanceof GenerateRequestError
          ? buildGenerateErrorMessage(error, ["wechat_article"], {
              hasRewriteSource: true,
            })
          : error instanceof Error
            ? error.message
            : "进入创作中心仿写失败";

      setRewriteTaskState("error");
      setRewriteTaskError(message);

      if (createdTask) {
        await externalRewriteTaskStore.upsert({
          ...createdTask,
          status: "failed",
          error: message,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return (
    <section className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          External Wechat Research
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          公众号爆款文章抓取
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
          输入关键词、选择固定时间范围后，我们会先抓相关文章，再逐篇补拉纯文本正文，并基于成功补正文的样本给出一版结构化爆款分析。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)_auto]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">关键词</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            placeholder="例如：马拉松 / AI 教育 / 父母关系"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">时间范围</span>
          <select
            value={timeWindow}
            onChange={(event) =>
              setTimeWindow(event.target.value as ExternalWechatTimeWindow)
            }
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
          >
            {TIME_WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            disabled={loadingState === "loading"}
            onClick={() => void handleSearch()}
            className="w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {loadingState === "loading" ? "抓取中..." : "抓取爆款文章"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-rose-600">
          {loadingState === "error" ? errorMessage : null}
        </div>
        {lastUpdatedAt ? (
          <p className="text-xs text-slate-400">
            最近一次抓取：{formatTimestamp(lastUpdatedAt)}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-black/8 bg-stone-50/80 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">正文补拉</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            首版只补拉当前这次抓回来的文章列表，并优先取纯文本正文作为后续分析真相。
          </p>
        </div>
        <button
          type="button"
          disabled={articles.length === 0 || contentFetchState === "loading"}
          onClick={() => void handleFetchContents()}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {contentFetchState === "loading" ? "补拉正文中..." : "补拉当前列表正文"}
        </button>
      </div>
      {contentFetchState === "error" && contentFetchError ? (
        <p className="mt-3 text-sm text-rose-600">{contentFetchError}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-black/8 bg-stone-50/80 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">爆款分析</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            只会基于正文已补全的文章样本做结构化分析；成功样本少于 2 篇时，会明确提示结果仅供参考。
          </p>
        </div>
        <button
          type="button"
          disabled={articles.length === 0 || analysisState === "loading"}
          onClick={() => void handleAnalyze()}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analysisState === "loading" ? "分析中..." : "开始分析"}
        </button>
      </div>
      {analysisState === "error" && analysisError ? (
        <p className="mt-3 text-sm text-rose-600">{analysisError}</p>
      ) : null}

      <div className="mt-5">
        {articles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-black/10 bg-stone-50 px-5 py-6 text-sm leading-7 text-slate-500">
            还没有外部爆款文章结果。先输入关键词并抓取，后续这里会展示标题、公众号名称和正文补拉状态。
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="rounded-[24px] border border-black/8 bg-stone-50/80 px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-7 text-slate-900">
                      {article.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <label className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1">
                        <input
                          type="checkbox"
                          checked={selectedArticleIds.includes(article.id)}
                          disabled={article.contentFetchStatus !== "success"}
                          onChange={() =>
                            setSelectedArticleIds((current) =>
                              toggleSelectedArticleIds(current, article),
                            )
                          }
                          className="size-3.5 rounded border-black/20"
                        />
                        <span>
                          {selectedArticleIds.includes(article.id) ? "已选为仿写素材" : "选为仿写素材"}
                        </span>
                      </label>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {article.accountName}
                      </span>
                      {article.publishTime ? (
                        <span className="rounded-full bg-white px-2.5 py-1">
                          {formatTimestamp(article.publishTime)}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {getContentFetchStatusLabel(article.contentFetchStatus)}
                      </span>
                    </div>
                  </div>

                  {article.url ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      打开原文
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="rounded-[24px] border border-black/8 bg-stone-50/85 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Rewrite Bridge
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                选择素材并进入创作中心
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                首版只支持公众号文章仿写。当前只能勾选正文已补全的文章，且至少 1 篇、最多 5 篇。
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
              已选 {selectedArticleIds.length} / 5
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedArticleIds.length > 0 ? (
              selectedArticleIds.map((selectedId) => {
                const article = articles.find((item) => item.id === selectedId);

                if (!article) {
                  return null;
                }

                return (
                  <span
                    key={selectedId}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {article.title}
                  </span>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">
                先勾选至少 1 篇正文已补全的文章，再进入创作中心仿写。
              </p>
            )}
          </div>

          <div className="mt-4">
            <label className="flex max-w-[360px] flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                提示词预设（可选）
              </span>
              <select
                value={selectedPromptPresetId}
                onChange={(event) => setSelectedPromptPresetId(event.target.value)}
                disabled={rewriteTaskState === "running"}
                className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">不使用额外提示词预设（保持原样）</option>
                {promptPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                    {preset.isDefault ? "（默认）" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-rose-600">
              {rewriteTaskState === "error" ? rewriteTaskError : null}
            </div>
            <button
              type="button"
              disabled={rewriteTaskState === "running"}
              onClick={() => void handleStartExternalRewrite()}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rewriteTaskState === "running" ? "正在进入创作中心..." : "进入创作中心仿写"}
            </button>
          </div>
          {rewriteTaskNotice ? (
            <p className="mt-3 text-sm text-emerald-700">{rewriteTaskNotice}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        {latestInsight ? (
          <div className="rounded-[24px] border border-black/8 bg-slate-50/85 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Insight
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  爆款分析结果
                </h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                样本 {latestInsight.articleIds.length} 篇
              </span>
            </div>

            {latestInsight.sampleNotice ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                {latestInsight.sampleNotice}
              </p>
            ) : null}

            <div className="mt-4 rounded-2xl bg-white px-4 py-4">
              <p className="text-sm font-medium text-slate-700">摘要</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {latestInsight.summary}
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {INSIGHT_SECTIONS.map((section) => (
                <InsightListCard
                  key={section.key}
                  title={section.title}
                  items={getInsightSectionItems(latestInsight, section.key)}
                  emptyLabel={section.emptyLabel}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-black/10 bg-stone-50 px-5 py-6 text-sm leading-7 text-slate-500">
            完成正文补拉后，就可以基于成功补正文的样本做结构化分析，看看这个选题为什么容易爆、有哪些共性，以及哪些表达值得参考。
          </div>
        )}
      </div>
    </section>
  );
}

function resolveSearchErrorMessage(payload: SearchResponse) {
  if ("error" in payload) {
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }

    if (
      payload.error &&
      typeof payload.error === "object" &&
      typeof payload.error.message === "string" &&
      payload.error.message.trim()
    ) {
      return payload.error.message.trim();
    }
  }

  return "抓取爆款文章失败。";
}

function getContentFetchStatusLabel(
  status: ExternalWechatArticle["contentFetchStatus"],
) {
  if (status === "success") {
    return "正文已补全";
  }

  if (status === "loading") {
    return "正文补拉中";
  }

  if (status === "failed") {
    return "正文补拉失败";
  }

  return "待补全文";
}

function toggleSelectedArticleIds(
  current: string[],
  article: ExternalWechatArticle,
) {
  if (article.contentFetchStatus !== "success") {
    return current;
  }

  if (current.includes(article.id)) {
    return current.filter((item) => item !== article.id);
  }

  if (current.length >= 5) {
    return current;
  }

  return [...current, article.id];
}

function resolveSelectionValidationMessage(
  selectedArticleIds: string[],
  articles: ExternalWechatArticle[],
) {
  if (selectedArticleIds.length < 1 || selectedArticleIds.length > 5) {
    return "仿写素材至少选择 1 篇，最多选择 5 篇。";
  }

  const selectedArticles = selectedArticleIds.map((selectedId) =>
    articles.find((article) => article.id === selectedId),
  );

  if (
    selectedArticles.some(
      (article) =>
        !article ||
        article.contentFetchStatus !== "success" ||
        !article.content?.trim(),
    )
  ) {
    return "当前勾选里包含未成功补正文的文章，暂时无法进入仿写。";
  }

  return null;
}

function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function InsightListCard(input: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4">
      <p className="text-sm font-medium text-slate-700">{input.title}</p>
      {input.items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
          {input.items.map((item, index) => (
            <li key={`${input.title}-${index}`} className="flex gap-2">
              <span className="mt-1 text-slate-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-7 text-slate-400">{input.emptyLabel}</p>
      )}
    </div>
  );
}
