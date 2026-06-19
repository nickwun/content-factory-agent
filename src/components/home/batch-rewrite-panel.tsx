"use client";

import type { BatchRewriteItem } from "@/lib/rewrite/batch-rewrite";
import {
  canOpenBatchRewriteResult,
  resolveBatchRewriteResultLabel,
} from "@/lib/rewrite/batch-rewrite-results";

type BatchRewritePanelProps = {
  items: BatchRewriteItem[];
  isParsingFiles: boolean;
  isRunning?: boolean;
  message?: string | null;
  onBrowseFiles: () => void;
  onRemoveItem: (itemId: string) => void;
  onOpenResult: (recordId: string) => void;
};

export function BatchRewritePanel({
  items,
  isParsingFiles,
  isRunning = false,
  message,
  onBrowseFiles,
  onRemoveItem,
  onOpenResult,
}: BatchRewritePanelProps) {
  return (
    <div className="mt-4 rounded-[24px] border border-slate-200 bg-stone-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            批量素材上传
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            第一版只支持批量公众号仿写。请一次上传 .txt、.md 或 .docx，最多 10 篇。
          </p>
        </div>

        <button
          type="button"
          onClick={onBrowseFiles}
          disabled={isParsingFiles || isRunning || items.length >= 10}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            isParsingFiles || isRunning || items.length >= 10
              ? "cursor-not-allowed border border-black/10 bg-stone-200 text-slate-400"
              : "bg-slate-900 text-white"
          }`}
        >
          {isParsingFiles
            ? "解析中..."
            : isRunning
              ? "执行中"
              : items.length >= 10
                ? "已达上限"
                : "添加素材"}
        </button>
      </div>

      <div className="mt-4 rounded-[22px] border border-dashed border-black/10 bg-white px-4 py-4 text-sm leading-7 text-slate-500">
        当前已加载 {items.length} / 10 篇素材。
        {isRunning
          ? " 当前批次执行中，已锁定新增与删除。"
          : " 批量执行前可逐篇删除问题文件。"}
      </div>

      {message ? (
        <p className="mt-3 text-sm text-amber-700">{message}</p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-4 rounded-[22px] border border-dashed border-black/10 bg-white px-4 py-5 text-sm leading-7 text-slate-500">
          这里会显示每篇素材的文件名、字数和解析状态。解析失败只影响当前篇，不会挡住其他素材。
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-[24px] border px-4 py-4 ${
                item.parseStatus === "ready"
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-rose-200 bg-rose-50/70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        item.parseStatus === "failed"
                          ? "bg-white text-rose-600"
                          : item.runStatus === "succeeded"
                            ? "bg-white text-emerald-700"
                            : item.runStatus === "generating"
                              ? "bg-white text-amber-700"
                              : item.runStatus === "failed"
                                ? "bg-white text-rose-600"
                                : "bg-white text-slate-600"
                      }`}
                    >
                      {resolveBatchRewriteItemStatusLabel(item)}
                    </span>
                    {typeof item.charCount === "number" ? (
                      <span className="text-xs text-slate-500">
                        {item.charCount} 字
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-slate-900">
                    {item.fileName}
                  </p>
                  {item.parseError ? (
                    <p className="mt-2 text-xs leading-6 text-rose-600">
                      {item.parseError}
                    </p>
                  ) : item.runError ? (
                    <p className="mt-2 text-xs leading-6 text-rose-600">
                      {item.runError}
                    </p>
                  ) : item.runStatus === "succeeded" ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs font-medium leading-6 text-slate-900">
                        {resolveBatchRewriteResultLabel(item)}
                      </p>
                      <p className="text-xs leading-6 text-emerald-700">
                        已生成独立公众号草稿，并写入现有工作台历史记录。
                      </p>
                    </div>
                  ) : item.runStatus === "generating" ? (
                    <p className="mt-2 text-xs leading-6 text-amber-700">
                      正在复用当前单篇公众号仿写链路生成这一篇素材。
                    </p>
                  ) : (
                    <p className="mt-2 text-xs leading-6 text-slate-500">
                      已准备好进入后续批量仿写队列。
                    </p>
                  )}
                </div>

                {canOpenBatchRewriteResult(item) ? (
                  <button
                    type="button"
                    onClick={() => onOpenResult(item.resultRecordId!)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    打开编辑
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    disabled={isRunning}
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    删除
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function resolveBatchRewriteItemStatusLabel(item: BatchRewriteItem) {
  if (item.parseStatus === "failed") {
    return "解析失败";
  }

  if (item.runStatus === "generating") {
    return "生成中";
  }

  if (item.runStatus === "succeeded") {
    return "已生成";
  }

  if (item.runStatus === "failed") {
    return "生成失败";
  }

  return "待生成";
}
