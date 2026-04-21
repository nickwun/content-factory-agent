"use client";

import type { ContentTraceSummary } from "@/lib/observability/types";
import type { PublishDestination } from "@/lib/publish/types";

type GenerationStatus = NonNullable<
  ContentTraceSummary["generation"]["draftStatus"] |
    ContentTraceSummary["generation"]["finalizationStatus"] |
    ContentTraceSummary["generation"]["coverStatus"]
>;

type LatestPublish = NonNullable<ContentTraceSummary["latestPublish"]>;
type PublishStatus = LatestPublish["status"];

type ContentTracePanelProps = {
  summary: ContentTraceSummary | null;
};

export function ContentTracePanel({ summary }: ContentTracePanelProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-black/8 bg-stone-50/82 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            Trace Summary
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            内容来源与执行记录
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-500">
          首版只展示来源、生成摘要、最近一次发布结果和最近一次异常，帮助我们快速判断这篇内容从哪里来、走到了哪一步。
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-black/8 bg-white px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            来源
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span>来源类型</span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {summary.source.sourceKind === "rewrite_task"
                  ? "来自选题中心"
                  : summary.source.sourceKind === "external_rewrite_task"
                    ? "来自外部爆款素材"
                    : "直接创作"}
              </span>
            </div>
            {summary.source.topicClusterTitle ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">主题标题</p>
                <p className="font-medium text-slate-900">
                  {summary.source.topicClusterTitle}
                </p>
              </div>
            ) : null}
            {summary.source.externalKeyword ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">外部关键词</p>
                <p className="font-medium text-slate-900">
                  {summary.source.externalKeyword}
                </p>
              </div>
            ) : null}
            {summary.source.rewriteTaskId ? (
              <div className="flex items-center justify-between gap-3">
                <span>仿写任务</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {summary.source.rewriteTaskId}
                </span>
              </div>
            ) : null}
            {summary.source.externalRewriteTaskId ? (
              <div className="flex items-center justify-between gap-3">
                <span>外部任务</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {summary.source.externalRewriteTaskId}
                </span>
              </div>
            ) : null}
            {typeof summary.source.representativeArticleCount === "number" ? (
              <div className="flex items-center justify-between gap-3">
                <span>代表文章数</span>
                <span className="text-sm font-medium text-slate-900">
                  {summary.source.representativeArticleCount}
                </span>
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-black/8 bg-white px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            生成摘要
          </p>
          <div className="mt-3 space-y-2.5">
            <GenerationRow
              label="初稿"
              status={summary.generation.draftStatus ?? "unknown"}
            />
            <GenerationRow
              label="成稿收束"
              status={summary.generation.finalizationStatus ?? "unknown"}
            />
            <GenerationRow
              label="头图"
              status={summary.generation.coverStatus ?? "unknown"}
            />
          </div>
        </article>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-black/8 bg-white px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            最近一次发布
          </p>
          {summary.latestPublish ? (
            <div className="mt-3 space-y-2.5 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span>去向</span>
                <span className="font-medium text-slate-900">
                  {getPublishDestinationLabel(summary.latestPublish.destination)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>结果</span>
                <StatusPill
                  label={getPublishStatusLabel(summary.latestPublish.status)}
                  tone={getPublishStatusTone(summary.latestPublish.status)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>时间</span>
                <span className="text-slate-500">
                  {formatTraceTimestamp(summary.latestPublish.createdAt)}
                </span>
              </div>
              {summary.latestPublish.resultUrl ? (
                <a
                  href={summary.latestPublish.resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full border border-black/8 bg-stone-50 px-3 py-1.5 text-[12px] font-medium text-slate-700"
                >
                  打开结果
                </a>
              ) : null}
              {summary.latestPublish.warningMessage ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-6 text-amber-800">
                  {summary.latestPublish.warningMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              还没有发布结果。这篇内容完成后，最近一次发布去向和结果会显示在这里。
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-black/8 bg-white px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            最近异常
          </p>
          {summary.latestIssue ? (
            <div className="mt-3 space-y-2">
              <StatusPill
                label={
                  summary.latestIssue.type === "error" ? "最近一次错误" : "最近一次警告"
                }
                tone={summary.latestIssue.type === "error" ? "error" : "warning"}
              />
              <p className="text-sm leading-7 text-slate-700">
                {summary.latestIssue.message}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              当前没有新的 warning 或 error，这篇内容最近一次执行链路看起来是稳定的。
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function GenerationRow({
  label,
  status,
}: {
  label: string;
  status: GenerationStatus;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50/80 px-3 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <StatusPill
        label={getGenerationStatusLabel(status)}
        tone={getGenerationStatusTone(status)}
      />
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "error";
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
        tone === "success"
          ? "bg-emerald-100 text-emerald-700"
          : tone === "warning"
            ? "bg-amber-100 text-amber-700"
            : tone === "error"
              ? "bg-rose-100 text-rose-700"
              : "bg-stone-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function getGenerationStatusLabel(
  status: GenerationStatus,
) {
  if (status === "success") {
    return "已完成";
  }

  if (status === "failed") {
    return "失败";
  }

  if (status === "not_executed") {
    return "未执行";
  }

  if (status === "skipped") {
    return "跳过";
  }

  return "未知";
}

function getGenerationStatusTone(
  status: GenerationStatus,
) {
  if (status === "success") {
    return "success";
  }

  if (status === "failed") {
    return "error";
  }

  if (status === "unknown") {
    return "warning";
  }

  return "neutral";
}

function getPublishStatusLabel(status: PublishStatus) {
  if (status === "success") {
    return "成功";
  }

  if (status === "partial_success") {
    return "部分成功";
  }

  return "失败";
}

function getPublishStatusTone(status: PublishStatus) {
  if (status === "success") {
    return "success";
  }

  if (status === "partial_success") {
    return "warning";
  }

  return "error";
}

function getPublishDestinationLabel(destination: PublishDestination) {
  if (destination === "wechat_article") {
    return "公众号草稿箱";
  }

  if (destination === "wechat_xiaolvshu") {
    return "公众号小绿书";
  }

  if (destination === "xiaohongshu_note") {
    return "小红书";
  }

  return "飞书文档";
}

function formatTraceTimestamp(value: string) {
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
