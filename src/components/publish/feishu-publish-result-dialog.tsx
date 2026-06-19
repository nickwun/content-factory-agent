"use client";

import type { FeishuPublishResponse } from "@/lib/publish/types";

type FeishuPublishResultDialogProps = {
  open: boolean;
  result: FeishuPublishResponse | null;
  onClose: () => void;
};

export function FeishuPublishResultDialog({
  open,
  result,
  onClose,
}: FeishuPublishResultDialogProps) {
  if (!open || !result) {
    return null;
  }

  const coverStatusLabel =
    result.coverSyncStatus === "synced"
      ? "头图已同步"
      : result.coverSyncStatus === "failed"
        ? "头图未同步"
        : "无头图";
  const title =
    result.coverSyncStatus === "failed" ? "飞书文档部分成功" : "飞书文档已创建";
  const helperText =
    result.coverSyncStatus === "failed"
      ? "文档已创建，正文已发布，但头图未能同步到飞书文档。"
      : result.message;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/38 p-4">
      <div className="w-full max-w-md rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Feishu Publish
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {helperText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-w-[88px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600"
          >
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-3 rounded-[28px] border border-black/8 bg-stone-50/80 p-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
            <span className="text-sm text-slate-700">文档 ID</span>
            <span className="text-xs font-medium text-slate-500">
              {result.documentId}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
            <span className="text-sm text-slate-700">正文发布</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              已完成
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
            <span className="text-sm text-slate-700">头图同步</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                result.coverSyncStatus === "synced"
                  ? "bg-emerald-100 text-emerald-700"
                  : result.coverSyncStatus === "failed"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {coverStatusLabel}
            </span>
          </div>
        </div>

        {result.warningMessage ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {result.warningMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(result.documentUrl)}
            className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            复制链接
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(result.documentUrl, "_blank", "noopener,noreferrer")
            }
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            打开文档
          </button>
        </div>
      </div>
    </div>
  );
}
