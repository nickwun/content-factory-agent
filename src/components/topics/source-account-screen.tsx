"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { requestGeneratedDraft, buildGenerateErrorMessage, GenerateRequestError } from "@/lib/generation/generate-client";
import { createLocalHistoryStorage } from "@/lib/history/local-history-storage";
import { createHistoryRecord } from "@/lib/history/history-record-factory";
import {
  buildTopicOverviewStats,
  buildTopicClusterHeaderMeta,
  getTopicClusterStatusSortOrder,
  getRewriteTaskStatusMeta,
  truncateRewriteTaskError,
  toReadableTopicReasons,
} from "@/lib/topics/topic-overview-ui";
import {
  createEmptyFileImportDraft,
  createEmptyManualImportDraft,
  normalizeFileImportDraft,
  normalizeManualImportDraft,
  type FileImportDraft,
  type ManualImportDraft,
} from "@/lib/topics/topic-import-draft";
import type {
  CandidateArticle,
  RewriteTask,
  SourceAccount,
  TopicCluster,
  TopicScore,
} from "@/lib/topics/types";

type SourceAccountScreenProps = {
  initialSourceAccounts: SourceAccount[];
  initialCandidateArticles: CandidateArticle[];
  initialTopicClusters: TopicCluster[];
  initialTopicScores: TopicScore[];
  initialRewriteTasks: RewriteTask[];
  view?: "overview" | "sources" | "articles";
};

type ApiErrorResponse = {
  error?: string | { message?: string };
};

type CandidateArticleFileImportResponse = {
  candidateArticles: CandidateArticle[];
  summary: {
    succeeded: number;
    skippedDuplicates: number;
    failed: number;
  };
  failures?: Array<{
    filename: string;
    code: string;
    message: string;
  }>;
};

type SourceAccountDraft = {
  name: string;
  handle: string;
  category: string;
  priority: string;
  notes: string;
};

const EMPTY_DRAFT: SourceAccountDraft = {
  name: "",
  handle: "",
  category: "",
  priority: "50",
  notes: "",
};

export function SourceAccountScreen({
  initialSourceAccounts,
  initialCandidateArticles,
  initialTopicClusters,
  initialTopicScores,
  initialRewriteTasks,
  view = "overview",
}: SourceAccountScreenProps) {
  const router = useRouter();
  const [sourceAccounts, setSourceAccounts] = useState(initialSourceAccounts);
  const [candidateArticles, setCandidateArticles] = useState(initialCandidateArticles);
  const [topicClusters, setTopicClusters] = useState(initialTopicClusters);
  const [topicScores, setTopicScores] = useState(initialTopicScores);
  const [rewriteTasks, setRewriteTasks] = useState(initialRewriteTasks);
  const [importMode, setImportMode] = useState<"manual" | "file">("manual");
  const [createDraft, setCreateDraft] = useState<SourceAccountDraft>(EMPTY_DRAFT);
  const [manualImportDraft, setManualImportDraft] = useState<ManualImportDraft>(() =>
    createEmptyManualImportDraft(initialSourceAccounts[0]?.id ?? ""),
  );
  const [fileImportDraft, setFileImportDraft] = useState<FileImportDraft>(() =>
    createEmptyFileImportDraft(initialSourceAccounts[0]?.id ?? ""),
  );
  const [editingDrafts, setEditingDrafts] = useState<Record<string, SourceAccountDraft>>(
    () =>
      Object.fromEntries(
        initialSourceAccounts.map((account) => [
          account.id,
          buildDraftFromAccount(account),
        ]),
      ),
  );
  const [createState, setCreateState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [importState, setImportState] = useState<"idle" | "saving" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [clusterState, setClusterState] = useState<"idle" | "saving" | "error">("idle");
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [clusterActionError, setClusterActionError] = useState<string | null>(null);
  const [clusterActionNotice, setClusterActionNotice] = useState<string | null>(null);
  const [rewriteTaskError, setRewriteTaskError] = useState<string | null>(null);
  const [runningClusterId, setRunningClusterId] = useState<string | null>(null);
  const [rejectingClusterId, setRejectingClusterId] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});
  const historyStorage = useMemo(() => createLocalHistoryStorage(), []);

  const groupedAccounts = useMemo(
    () => ({
      active: sourceAccounts.filter((account) => account.status === "active"),
      paused: sourceAccounts.filter((account) => account.status === "paused"),
    }),
    [sourceAccounts],
  );
  const rankedTopicClusters = useMemo(() => {
    const scoreMap = new Map(topicScores.map((score) => [score.clusterId, score]));

    return topicClusters
      .map((cluster) => ({
        cluster,
        score: scoreMap.get(cluster.id),
      }))
      .sort((left, right) => {
        const statusOrderDifference =
          getTopicClusterStatusSortOrder(left.cluster.status) -
          getTopicClusterStatusSortOrder(right.cluster.status);

        if (statusOrderDifference !== 0) {
          return statusOrderDifference;
        }

        return (right.score?.totalScore ?? -1) - (left.score?.totalScore ?? -1);
      });
  }, [topicClusters, topicScores]);
  const overviewStats = useMemo(
    () =>
      buildTopicOverviewStats({
        sourceAccounts,
        candidateArticleCount: candidateArticles.length,
        topicClusters,
        rewriteTasks,
      }),
    [candidateArticles.length, rewriteTasks, sourceAccounts, topicClusters],
  );
  const showOverview = view === "overview";
  const showSources = view === "sources";
  const showArticles = view === "articles";

  async function handleCreateAccount() {
    setCreateState("saving");
    setCreateError(null);

    try {
      const response = await fetch("/api/topics/source-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createDraft.name,
          handle: createDraft.handle,
          category: createDraft.category,
          priority: Number(createDraft.priority),
          notes: createDraft.notes,
          status: "active",
        }),
      });

      const data = (await response.json()) as
        | { sourceAccount: SourceAccount }
        | ApiErrorResponse;

      if (!response.ok || !("sourceAccount" in data)) {
        throw new Error(resolveApiErrorMessage(data, "创建样本源失败"));
      }

      setSourceAccounts((current) => sortAccounts([data.sourceAccount, ...current]));
      setEditingDrafts((current) => ({
        ...current,
        [data.sourceAccount.id]: buildDraftFromAccount(data.sourceAccount),
      }));
      setCreateDraft(EMPTY_DRAFT);
      setManualImportDraft((current) =>
        normalizeManualImportDraft({
          ...current,
          sourceAccountId: current.sourceAccountId || data.sourceAccount.id,
        }),
      );
      setFileImportDraft((current) =>
        normalizeFileImportDraft({
          ...current,
          sourceAccountId: current.sourceAccountId || data.sourceAccount.id,
        }),
      );
      setCreateState("idle");
    } catch (error) {
      setCreateState("error");
      setCreateError(error instanceof Error ? error.message : "创建样本源失败");
    }
  }

  async function handleSaveAccount(accountId: string) {
    const draft = editingDrafts[accountId];
    if (!draft) {
      return;
    }

    setRowStatus((current) => ({ ...current, [accountId]: "保存中..." }));

    try {
      const response = await fetch(`/api/topics/source-accounts/${accountId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draft.name,
          handle: draft.handle,
          category: draft.category,
          priority: Number(draft.priority),
          notes: draft.notes,
        }),
      });

      const data = (await response.json()) as
        | { sourceAccount: SourceAccount }
        | ApiErrorResponse;

      if (!response.ok || !("sourceAccount" in data)) {
        throw new Error(resolveApiErrorMessage(data, "保存失败"));
      }

      setSourceAccounts((current) =>
        sortAccounts(current.map((account) =>
          account.id === accountId ? data.sourceAccount : account,
        )),
      );
      setEditingDrafts((current) => ({
        ...current,
        [accountId]: buildDraftFromAccount(data.sourceAccount),
      }));
      setRowStatus((current) => ({ ...current, [accountId]: "已保存" }));
    } catch (error) {
      setRowStatus((current) => ({
        ...current,
        [accountId]: error instanceof Error ? error.message : "保存失败",
      }));
    }
  }

  async function handleToggleStatus(account: SourceAccount) {
    setRowStatus((current) => ({ ...current, [account.id]: "更新中..." }));

    try {
      const response = await fetch(`/api/topics/source-accounts/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: account.status === "active" ? "paused" : "active",
        }),
      });

      const data = (await response.json()) as
        | { sourceAccount: SourceAccount }
        | ApiErrorResponse;

      if (!response.ok || !("sourceAccount" in data)) {
        throw new Error(resolveApiErrorMessage(data, "状态更新失败"));
      }

      setSourceAccounts((current) =>
        sortAccounts(current.map((item) => (item.id === account.id ? data.sourceAccount : item))),
      );
      setEditingDrafts((current) => ({
        ...current,
        [account.id]: buildDraftFromAccount(data.sourceAccount),
      }));
      setRowStatus((current) => ({ ...current, [account.id]: "已更新" }));
    } catch (error) {
      setRowStatus((current) => ({
        ...current,
        [account.id]: error instanceof Error ? error.message : "状态更新失败",
      }));
    }
  }

  async function handleDeleteAccount(accountId: string) {
    setRowStatus((current) => ({ ...current, [accountId]: "删除中..." }));

    try {
      const response = await fetch(`/api/topics/source-accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as ApiErrorResponse;
        throw new Error(resolveApiErrorMessage(data, "删除失败"));
      }

      setSourceAccounts((current) => current.filter((account) => account.id !== accountId));
      setEditingDrafts((current) => {
        const next = { ...current };
        delete next[accountId];
        return next;
      });
    } catch (error) {
      setRowStatus((current) => ({
        ...current,
        [accountId]: error instanceof Error ? error.message : "删除失败",
      }));
    }
  }

  async function handleCreateCandidateArticle() {
    setImportState("saving");
    setImportError(null);
    setImportNotice(null);

    try {
      if (importMode === "manual") {
        const response = await fetch("/api/topics/candidate-articles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceAccountId: manualImportDraft.sourceAccountId,
            title: manualImportDraft.title,
            contentMarkdown: manualImportDraft.contentMarkdown,
          }),
        });

        const data = (await response.json()) as
          | { candidateArticle: CandidateArticle }
          | ApiErrorResponse;

        if (!response.ok || !("candidateArticle" in data)) {
          throw new Error(resolveApiErrorMessage(data, "候选文章入库失败"));
        }

        setCandidateArticles((current) => [data.candidateArticle, ...current]);
        setManualImportDraft((current) =>
          normalizeManualImportDraft({
            ...current,
            title: "",
            contentMarkdown: "",
          }),
        );
        setImportNotice("已保存 1 篇候选文章。");
      } else {
        const response = await uploadCandidateArticleFile(fileImportDraft);
        const data = (await response.json()) as
          | CandidateArticleFileImportResponse
          | ApiErrorResponse;

        if (!response.ok || !("candidateArticles" in data) || !("summary" in data)) {
          throw new Error(resolveApiErrorMessage(data, "候选文章入库失败"));
        }

        if (data.candidateArticles.length > 0) {
          setCandidateArticles((current) => [...data.candidateArticles, ...current]);
        }

        setFileImportDraft((current) =>
          normalizeFileImportDraft({
            ...current,
            files: [],
          }),
        );
        setImportNotice(buildFileImportSummaryText(data));
      }
      setImportState("idle");
    } catch (error) {
      setImportState("error");
      setImportError(error instanceof Error ? error.message : "候选文章入库失败");
    }
  }

  async function handleRebuildTopicClusters() {
    setClusterState("saving");
    setClusterError(null);
    setClusterActionNotice(null);

    try {
      const response = await fetch("/api/topics/clusters", {
        method: "POST",
      });
      const data = (await response.json()) as
        | {
            topicClusters: TopicCluster[];
            topicScores?: TopicScore[];
            candidateArticles?: CandidateArticle[];
          }
        | ApiErrorResponse;

      if (!response.ok || !("topicClusters" in data)) {
        throw new Error(resolveApiErrorMessage(data, "主题聚类失败"));
      }

      setTopicClusters(data.topicClusters);
      if ("topicScores" in data && Array.isArray(data.topicScores)) {
        setTopicScores(data.topicScores);
      }
      if ("candidateArticles" in data && Array.isArray(data.candidateArticles)) {
        setCandidateArticles(data.candidateArticles);
      }
      setClusterState("idle");
    } catch (error) {
      setClusterState("error");
      setClusterError(error instanceof Error ? error.message : "主题聚类失败");
    }
  }

  async function handleStartRewriteTask(clusterId: string) {
    setClusterActionError(null);
    setClusterActionNotice(null);
    setRewriteTaskError(null);
    setRunningClusterId(clusterId);
    let createdRewriteTaskId: string | null = null;

    try {
      const createResponse = await fetch("/api/topics/rewrite-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clusterId }),
      });
      const createData = (await createResponse.json()) as
        | {
            rewriteTask: RewriteTask;
            generatePayload: Parameters<typeof requestGeneratedDraft>[1];
          }
        | ApiErrorResponse;

      if (!createResponse.ok || !("rewriteTask" in createData) || !("generatePayload" in createData)) {
        throw new Error(resolveApiErrorMessage(createData, "发起多篇仿写失败"));
      }

      setRewriteTasks((current) => [createData.rewriteTask, ...current.filter((item) => item.id !== createData.rewriteTask.id)]);
      setTopicClusters((current) =>
        current.map((cluster) =>
          cluster.id === clusterId
            ? {
                ...cluster,
                status: "approved",
              }
            : cluster,
        ),
      );
      createdRewriteTaskId = createData.rewriteTask.id;

      const result = await requestGeneratedDraft(fetch, createData.generatePayload);
      const now = new Date().toISOString();
      const nextRecord = createHistoryRecord({
        userPrompt: createData.generatePayload.userPrompt,
        selectedPlatforms: [...createData.generatePayload.selectedPlatforms],
        now,
        autoTitle: result.draft.autoTitle,
        content: result.draft.content,
        promptSettings: result.promptSettings,
        generationInfo: result.draft.generationInfo,
        rewriteSource: createData.generatePayload.rewriteSource,
      });

      await historyStorage.create(nextRecord);

      const completeResponse = await fetch(
        `/api/topics/rewrite-tasks/${createData.rewriteTask.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "succeeded",
            generatedRecordId: nextRecord.id,
          }),
        },
      );
      const completeData = (await completeResponse.json()) as
        | { rewriteTask: RewriteTask }
        | ApiErrorResponse;

      if (!completeResponse.ok || !("rewriteTask" in completeData)) {
        throw new Error(resolveApiErrorMessage(completeData, "仿写任务状态更新失败"));
      }

      setRewriteTasks((current) =>
        [completeData.rewriteTask, ...current.filter((item) => item.id !== completeData.rewriteTask.id)],
      );
      setTopicClusters((current) =>
        current.map((cluster) =>
          cluster.id === clusterId
            ? {
                ...cluster,
                status: "rewritten",
              }
            : cluster,
        ),
      );

      await markRecordAsActive(nextRecord.id);
      setClusterActionNotice("已发起多篇仿写，最新任务已进入下方任务区块。");
      router.push("/?view=workspace");
    } catch (error) {
      const message =
        error instanceof GenerateRequestError
          ? buildGenerateErrorMessage(error, ["wechat_article"], {
              hasRewriteSource: true,
            })
          : error instanceof Error
            ? error.message
            : "发起多篇仿写失败";

      setRewriteTaskError(message);

      if (createdRewriteTaskId) {
        try {
          const failedResponse = await fetch(`/api/topics/rewrite-tasks/${createdRewriteTaskId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "failed",
              error: message,
            }),
          });
          const failedData = (await failedResponse.json()) as
            | { rewriteTask: RewriteTask }
            | ApiErrorResponse;

          if (failedResponse.ok && "rewriteTask" in failedData) {
            setRewriteTasks((current) =>
              [failedData.rewriteTask, ...current.filter((item) => item.id !== failedData.rewriteTask.id)],
            );
          }
        } catch {
          // Keep the local error message if task status sync fails.
        }
      }
    } finally {
      setRunningClusterId(null);
    }
  }

  async function handleRejectCluster(clusterId: string) {
    setClusterActionError(null);
    setClusterActionNotice(null);
    setRejectingClusterId(clusterId);

    try {
      const response = await fetch(`/api/topics/clusters/${clusterId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "rejected",
        }),
      });

      const data = (await response.json()) as
        | { topicCluster: TopicCluster }
        | ApiErrorResponse;

      if (!response.ok || !("topicCluster" in data)) {
        throw new Error(resolveApiErrorMessage(data, "忽略主题失败"));
      }

      setTopicClusters((current) =>
        current.map((cluster) =>
          cluster.id === clusterId ? data.topicCluster : cluster,
        ),
      );
      setClusterActionNotice("已忽略当前主题，它会继续保留在系统里，但不会进入本轮仿写。");
    } catch (error) {
      setClusterActionError(error instanceof Error ? error.message : "忽略主题失败");
    } finally {
      setRejectingClusterId(null);
    }
  }

  async function handleOpenGeneratedRecord(recordId: string) {
    await markRecordAsActive(recordId);
    router.push("/?view=workspace");
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

  return (
    <div className="space-y-8">
      {showOverview ? (
        <section className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Topic Overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              选题中心快速入口
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              首页继续负责看全局：快速进入样本池和候选文章，并集中查看主题簇、评分、最小确认流和 RewriteTask 概览。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/topics/sources"
              className="rounded-[24px] border border-black/10 bg-stone-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
            >
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Sources
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">进入样本池</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                管理核心样本源、暂停观察来源，以及新增、编辑、启用、删除等样本池操作。
              </p>
            </Link>
            <Link
              href="/topics/articles"
              className="rounded-[24px] border border-black/10 bg-stone-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
            >
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Candidate Articles
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">进入候选文章</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                手动导入、文件导入、多文件汇总，以及查看最近入库的候选文章与绑定样本源。
              </p>
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewStats.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-black/8 bg-stone-50/90 px-5 py-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showSources ? (
        <>
          <section
            className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
          >
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                Sample Pool
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                固定样本池管理
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                这一步先只管理公众号固定样本源。priority 用于区分核心样本源和普通观察源，后续候选文章采集会直接复用这里的池子。
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">样本源名称</span>
                <input
                  value={createDraft.name}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="例如：跑步长期主义观察"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">账号标识</span>
                <input
                  value={createDraft.handle}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, handle: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="例如：runner-notes"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">分类</span>
                <input
                  value={createDraft.category}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, category: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="跑步 / 长期训练 / 生活观察"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">priority</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={createDraft.priority}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, priority: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-slate-700">备注</span>
              <textarea
                value={createDraft.notes}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, notes: event.target.value }))
                }
                className="min-h-28 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                placeholder="记录这个来源为什么值得长期观察。"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-rose-600">
                {createState === "error" ? createError : null}
              </div>
              <button
                type="button"
                disabled={createState === "saving"}
                onClick={() => void handleCreateAccount()}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createState === "saving" ? "新增中..." : "新增样本源"}
              </button>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <SourceAccountGroup
              title="核心 / 启用中"
              description="当前真正参与选题流程的样本源，会进入当前重点样本池。"
              accounts={groupedAccounts.active}
              editingDrafts={editingDrafts}
              rowStatus={rowStatus}
              onDraftChange={setEditingDrafts}
              onSave={handleSaveAccount}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteAccount}
            />
            <SourceAccountGroup
              title="暂停观察"
              description="先保留，但暂时不参与当前重点样本池。"
              accounts={groupedAccounts.paused}
              editingDrafts={editingDrafts}
              rowStatus={rowStatus}
              onDraftChange={setEditingDrafts}
              onSave={handleSaveAccount}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteAccount}
            />
          </section>
        </>
      ) : null}

      {showArticles ? (
        <section
          className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
        >
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Candidate Articles
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              候选文章入库
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              首版先支持手动导入和文件导入。候选文章会在入库时完成基础清洗、生成摘要，并绑定到固定样本源。
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setImportMode("manual")}
              className={
                importMode === "manual"
                  ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-600"
              }
            >
              手动导入
            </button>
            <button
              type="button"
              onClick={() => setImportMode("file")}
              className={
                importMode === "file"
                  ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-600"
              }
            >
              文件导入
            </button>
          </div>

          {sourceAccounts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500">
              请先创建至少一个样本源，再开始导入候选文章。
            </div>
          ) : importMode === "manual" ? (
            <div key="manual-import-form" className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">关联样本源</span>
                <select
                  value={normalizeManualImportDraft(manualImportDraft).sourceAccountId}
                  onChange={(event) =>
                    setManualImportDraft((current) =>
                      normalizeManualImportDraft({
                        ...current,
                        sourceAccountId: event.target.value,
                      }),
                    )
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                >
                  {sourceAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · P{account.priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">文章标题</span>
                <input
                  value={normalizeManualImportDraft(manualImportDraft).title}
                  onChange={(event) =>
                    setManualImportDraft((current) =>
                      normalizeManualImportDraft({
                        ...current,
                        title: event.target.value,
                      }),
                    )
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="例如：跑步不是为了赢别人"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">正文 Markdown / 纯文本</span>
                <textarea
                  value={normalizeManualImportDraft(manualImportDraft).contentMarkdown}
                  onChange={(event) =>
                    setManualImportDraft((current) =>
                      normalizeManualImportDraft({
                        ...current,
                        contentMarkdown: event.target.value,
                      }),
                    )
                  }
                  className="min-h-[220px] w-full rounded-[28px] border border-black/10 bg-white px-5 py-4 text-sm leading-7 outline-none"
                  placeholder="把候选文章粘进来，系统会做基础清洗和去重。"
                />
              </label>
            </div>
          ) : (
            <div key="file-import-form" className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">关联样本源</span>
                <select
                  value={normalizeFileImportDraft(fileImportDraft).sourceAccountId}
                  onChange={(event) =>
                    setFileImportDraft((current) =>
                      normalizeFileImportDraft({
                        ...current,
                        sourceAccountId: event.target.value,
                      }),
                    )
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                >
                  {sourceAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · P{account.priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">导入文件</span>
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) =>
                    setFileImportDraft((current) =>
                      normalizeFileImportDraft({
                        ...current,
                        files: Array.from(event.target.files ?? []),
                      }),
                    )
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
              <p className="text-sm leading-6 text-slate-500">
                {normalizeFileImportDraft(fileImportDraft).files.length > 0
                  ? `已选择 ${normalizeFileImportDraft(fileImportDraft).files.length} 个文件，系统会逐个入库并汇总结果。`
                  : "支持一次选择多个 .txt / .md / .docx 文件。"}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div
              className={`text-sm ${
                importState === "error" ? "text-rose-600" : "text-slate-600"
              }`}
            >
              {importState === "error" ? importError : importNotice}
            </div>
            <button
              type="button"
              disabled={sourceAccounts.length === 0 || importState === "saving"}
              onClick={() => void handleCreateCandidateArticle()}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importState === "saving" ? "入库中..." : "保存候选文章"}
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              最近入库
            </h3>
            {candidateArticles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-black/10 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500">
                还没有候选文章。后续的主题聚类、评分和人工确认都会基于这里的文章池继续往前长。
              </div>
            ) : (
              <div className="space-y-3">
                {candidateArticles.map((article) => {
                  const account = sourceAccounts.find(
                    (item) => item.id === article.sourceAccountId,
                  );

                  return (
                    <article
                      key={article.id}
                      className="rounded-[24px] border border-black/10 bg-slate-50/80 px-5 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                        <span>{article.sourceType === "manual_import" ? "手动导入" : "文件导入"}</span>
                        <span>·</span>
                        <span>{account?.name ?? "未绑定样本源"}</span>
                      </div>
                      <h4 className="mt-2 text-lg font-semibold text-slate-900">
                        {article.title}
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        {article.excerpt ?? "暂无摘要"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{article.charCount ?? 0} 字</span>
                        <span>状态：{article.status}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {showOverview ? (
      <section className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            Topic Clusters
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            主题聚类
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
            这一步先用规则型聚类，把候选文章从“单篇素材池”收成“主题簇”，再按证据强度、贴合度和重构潜力做首版评分。当前确认流先只保留两个动作：通过进入仿写，或驳回 / 忽略。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {clusterState === "error" ? (
              <span className="text-rose-600">{clusterError}</span>
            ) : clusterActionError ? (
              <span className="text-rose-600">{clusterActionError}</span>
            ) : clusterActionNotice ? (
              <span className="text-emerald-700">{clusterActionNotice}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleRebuildTopicClusters()}
            disabled={candidateArticles.length === 0 || clusterState === "saving"}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clusterState === "saving" ? "聚类中..." : "生成主题簇"}
          </button>
        </div>

        <div className="mt-8 space-y-4">
          {rankedTopicClusters.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500">
              还没有主题簇。先把候选文章入库，再生成第一批规则聚类结果。
            </div>
          ) : (
            rankedTopicClusters.map(({ cluster, score }) => (
              <article
                key={cluster.id}
                className={`rounded-[24px] border px-5 py-4 ${
                  cluster.status === "open"
                    ? "border-black/10 bg-slate-50/80"
                    : cluster.status === "rewritten"
                      ? "border-emerald-200 bg-emerald-50/60"
                      : cluster.status === "approved"
                        ? "border-sky-200 bg-sky-50/60"
                        : "border-stone-200 bg-stone-50/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {buildTopicClusterHeaderMeta({
                      status: cluster.status,
                      articleCount: cluster.articleIds.length,
                      totalScore: score?.totalScore,
                      topicTitleSource: cluster.topicTitleSource,
                    }).map((item, index) => (
                      <span
                        key={`${cluster.id}-${item.id}`}
                        className={
                          item.emphasis === "strong"
                            ? "rounded-full bg-white px-3 py-1 text-sm font-semibold tracking-normal text-slate-700"
                            : item.emphasis === "subtle"
                              ? "text-[11px] text-slate-300"
                              : undefined
                        }
                      >
                        {index > 0 && item.emphasis !== "strong" ? (
                          <span className="mr-2 text-slate-300">·</span>
                        ) : null}
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
                <h4 className="mt-4 text-xl font-semibold text-slate-900">
                  {cluster.topicTitle}
                </h4>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                  {cluster.topicSummary}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cluster.keywords.slice(0, 4).map((keyword) => (
                    <span
                      key={`${cluster.id}-${keyword}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                {score ? (
                  <div className="mt-5 rounded-2xl border border-black/8 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span>贴合度 {score.fitScore}</span>
                      <span>证据强度 {score.evidenceScore}</span>
                      <span>新鲜度 {score.noveltyScore}</span>
                      <span>重构潜力 {score.rewritePotentialScore}</span>
                    </div>
                    {(() => {
                      const readableReasons = toReadableTopicReasons(score.reasons);

                      return (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl bg-stone-50/80 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          值得做
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {readableReasons.worthDoing.length > 0 ? (
                            readableReasons.worthDoing.map((reason) => (
                              <p
                                key={`${score.clusterId}-worth-${reason}`}
                                className="text-sm leading-6 text-slate-600"
                              >
                                {reason}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm leading-6 text-slate-500">当前没有额外补充说明。</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-stone-50/80 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          需要注意
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {readableReasons.caution.length > 0 ? (
                            readableReasons.caution.map((reason) => (
                              <p
                                key={`${score.clusterId}-caution-${reason}`}
                                className="text-sm leading-6 text-slate-600"
                              >
                                {reason}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm leading-6 text-slate-500">当前没有明显风险提示。</p>
                          )}
                        </div>
                      </div>
                    </div>
                      );
                    })()}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/6 pt-4">
                  <div className="text-sm text-rose-600">
                    {runningClusterId === cluster.id
                      ? "正在发起多篇仿写..."
                      : rejectingClusterId === cluster.id
                        ? "正在忽略当前主题..."
                        : null}
                  </div>
                  {cluster.status === "open" ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleRejectCluster(cluster.id)}
                        disabled={runningClusterId !== null || rejectingClusterId !== null}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {rejectingClusterId === cluster.id ? "忽略中..." : "驳回 / 忽略"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStartRewriteTask(cluster.id)}
                        disabled={runningClusterId !== null || rejectingClusterId !== null}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {runningClusterId === cluster.id ? "仿写中..." : "通过进入仿写"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                      {getTopicClusterStatusDescription(cluster.status)}
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      ) : null}

      {showOverview ? (
      <section className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            Rewrite Tasks
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            多篇仿写任务
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
            这里先只保留桥梁层：主题簇发起仿写后，会生成 RewriteTask，再送进现有创作中心的公众号生成主链路。
          </p>
        </div>

        {rewriteTaskError ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {rewriteTaskError}
          </div>
        ) : null}

        <div className="space-y-3.5">
          {rewriteTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500">
              还没有 RewriteTask。后续人工确认通过的主题簇，也都会继续通过这条桥梁送进创作中心。
            </div>
          ) : (
            rewriteTasks.map((task, index) => (
              <article
                key={task.id}
                className={`rounded-[24px] border px-5 py-4 ${
                  index === 0
                    ? "border-slate-900/12 bg-slate-50/90"
                    : "border-black/10 bg-slate-50/70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    <span>{index === 0 ? "最近任务" : "历史任务"}</span>
                    <span>·</span>
                    <span>{task.selectedArticleIds.length} 篇代表文章</span>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {getRewriteTaskStatusMeta(task.status).label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {getRewriteTaskStatusMeta(task.status).description}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900">
                  {task.brief.topicTitle}
                </h4>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  {task.brief.topicSummary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {task.brief.keyAngles.slice(0, 3).map((angle, index) => (
                    <span
                      key={`${task.id}-${index}-${angle}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {angle}
                    </span>
                  ))}
                </div>
                {task.error ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-sm leading-6 text-rose-700">
                    {truncateRewriteTaskError(task.error)}
                  </p>
                ) : null}
                {task.status === "succeeded" && task.generatedRecordId ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleOpenGeneratedRecord(task.generatedRecordId!)}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      打开编辑
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}

type SourceAccountGroupProps = {
  title: string;
  description: string;
  accounts: SourceAccount[];
  editingDrafts: Record<string, SourceAccountDraft>;
  rowStatus: Record<string, string>;
  onDraftChange: Dispatch<SetStateAction<Record<string, SourceAccountDraft>>>;
  onSave: (accountId: string) => Promise<void>;
  onToggleStatus: (account: SourceAccount) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
};

function SourceAccountGroup({
  title,
  description,
  accounts,
  editingDrafts,
  rowStatus,
  onDraftChange,
  onSave,
  onToggleStatus,
  onDelete,
}: SourceAccountGroupProps) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Source Accounts
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
      </div>

      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-black/10 bg-stone-50 px-4 py-6 text-sm text-slate-500">
            当前分组还没有样本源。
          </div>
        ) : null}

        {accounts.map((account) => {
          const draft = editingDrafts[account.id] ?? buildDraftFromAccount(account);

          return (
            <div
              key={account.id}
              className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    priority {account.priority}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {account.status === "active" ? "启用中" : "已暂停"}
                  </span>
                  {account.category ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {account.category}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-slate-500">
                  {rowStatus[account.id] ?? "未保存"}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      [account.id]: { ...draft, name: event.target.value },
                    }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="样本源名称"
                />
                <input
                  value={draft.handle}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      [account.id]: { ...draft, handle: event.target.value },
                    }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="账号标识"
                />
                <input
                  value={draft.category}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      [account.id]: { ...draft, category: event.target.value },
                    }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="分类"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.priority}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      [account.id]: { ...draft, priority: event.target.value },
                    }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="priority"
                />
              </div>

              <textarea
                value={draft.notes}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    [account.id]: { ...draft, notes: event.target.value },
                  }))
                }
                className="mt-3 min-h-24 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                placeholder="备注"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onSave(account.id)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleStatus(account)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {account.status === "active" ? "暂停观察" : "重新启用"}
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(account.id)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700"
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildDraftFromAccount(account: SourceAccount): SourceAccountDraft {
  return {
    name: account.name,
    handle: account.handle ?? "",
    category: account.category ?? "",
    priority: String(account.priority),
    notes: account.notes ?? "",
  };
}

function getTopicClusterStatusDescription(status: TopicCluster["status"]) {
  switch (status) {
    case "approved":
      return "已通过进入仿写";
    case "rejected":
      return "已驳回 / 忽略";
    case "rewritten":
      return "已生成创作稿";
    default:
      return "待确认";
  }
}

function sortAccounts(accounts: SourceAccount[]) {
  return [...accounts].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

async function uploadCandidateArticleFile(input: {
  sourceAccountId: string;
  files: File[];
}) {
  const formData = new FormData();
  formData.set("sourceAccountId", input.sourceAccountId);

  for (const file of input.files) {
    formData.append("file", file);
  }

  return fetch("/api/topics/candidate-articles/import-file", {
    method: "POST",
    body: formData,
  });
}

function buildFileImportSummaryText(payload: CandidateArticleFileImportResponse) {
  const parts = [`成功 ${payload.summary.succeeded} 篇`];

  if (payload.summary.skippedDuplicates > 0) {
    parts.push(`重复跳过 ${payload.summary.skippedDuplicates} 篇`);
  }

  if (payload.summary.failed > 0) {
    parts.push(`失败 ${payload.summary.failed} 篇`);
  }

  return parts.join("，");
}

function resolveApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as ApiErrorResponse).error;

  if (typeof error === "string") {
    return error;
  }

  return error?.message || fallback;
}
