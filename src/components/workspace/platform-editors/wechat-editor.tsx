"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import type {
  GenerationMetadata,
  WechatArticleContent,
} from "@/lib/types/history";
import {
  getWechatCoverImageStatusLabel,
  hasWechatCoverImageComparison,
  resolveWechatCoverImage,
} from "@/lib/workspace/wechat-cover-image";
import { resolveWechatFinalizationStatus } from "@/lib/workspace/wechat-finalization-status";
import {
  countWechatMarkdownWords,
  parseWechatMarkdownToBlocks,
  resolveWechatMarkdownBody,
} from "@/lib/workspace/wechat-markdown";
import {
  renderWechatMarkdownExportHtml,
  renderWechatMarkdownPreviewHtml,
} from "@/lib/workspace/wechat-markdown-export";

type WechatEditorProps = {
  content: WechatArticleContent;
  generation?: GenerationMetadata;
  onChange: (content: WechatArticleContent) => void;
  onGenerateCoverImage: () => Promise<void>;
};

const FORMAT_HINTS = [
  "# / ## / ### 标题",
  "> 引用",
  "- 列表 / 1. 列表",
  "--- 分割线",
  "**粗体**",
  "*斜体*",
  "[链接](url)",
] as const;

export function WechatEditor({
  content,
  generation,
  onChange,
  onGenerateCoverImage,
}: WechatEditorProps) {
  const incomingBlocksSignature = useMemo(
    () =>
      JSON.stringify({
        markdownBody: content.markdownBody ?? null,
        blocks: content.blocks,
      }),
    [content.markdownBody, content.blocks],
  );
  const incomingBodyText = useMemo(
    () => resolveWechatMarkdownBody(content),
    [content],
  );
  const [bodyText, setBodyText] = useState(() => resolveWechatMarkdownBody(content));
  const [lastEmittedBlocksSignature, setLastEmittedBlocksSignature] =
    useState(incomingBlocksSignature);
  const [copyState, setCopyState] = useState<"idle" | "markdown" | "wechat">(
    "idle",
  );
  const [showCoverComparison, setShowCoverComparison] = useState(false);
  const resolvedBodyText =
    incomingBlocksSignature === lastEmittedBlocksSignature
      ? bodyText
      : incomingBodyText;
  const previewHtml = useMemo(
    () => renderWechatMarkdownPreviewHtml(resolvedBodyText),
    [resolvedBodyText],
  );
  const wordCount = useMemo(
    () => countWechatMarkdownWords(content.title, resolvedBodyText),
    [content.title, resolvedBodyText],
  );
  const finalizationStatus = useMemo(
    () => resolveWechatFinalizationStatus(generation),
    [generation],
  );
  const coverImage = useMemo(
    () => resolveWechatCoverImage(content.coverImage),
    [content.coverImage],
  );
  const hasRenderedCoverImage = Boolean(coverImage.imageUrl);
  const canCompareCoverImages = useMemo(
    () => hasWechatCoverImageComparison(content.coverImage),
    [content.coverImage],
  );

  const handleBodyChange = (nextText: string) => {
    setBodyText(nextText);

    const nextBlocks = parseWechatMarkdownToBlocks(nextText);
    setLastEmittedBlocksSignature(JSON.stringify(nextBlocks));

    onChange({
      ...content,
      markdownBody: nextText,
      blocks: nextBlocks,
    });
  };

  const handleTitleChange = (nextTitle: string) => {
    onChange({
      ...content,
      title: nextTitle,
      markdownBody: resolvedBodyText,
    });
  };

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(resolvedBodyText);
    setCopyState("markdown");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const handleCopyWechatHtml = async () => {
    const exportHtml = renderWechatMarkdownExportHtml(resolvedBodyText);

    if ("ClipboardItem" in window) {
      const item = new ClipboardItem({
        "text/html": new Blob([exportHtml], { type: "text/html" }),
        "text/plain": new Blob([resolvedBodyText], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await navigator.clipboard.writeText(exportHtml);
    }

    setCopyState("wechat");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  return (
    <section className="space-y-5">
      <input
        value={content.title}
        onChange={(event) => handleTitleChange(event.target.value)}
        className="w-full rounded-3xl border border-black/10 bg-white px-5 py-4 text-2xl font-semibold outline-none ring-0 placeholder:text-slate-300"
        placeholder="输入文章标题"
      />

      <div className="rounded-[28px] border border-black/8 bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              公众号头图
            </p>
            <p className="mt-1 text-sm text-slate-500">
              头图区与正文连续编辑解耦，可单独生成或重新生成一张公众号头图。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                coverImage.status === "generated"
                  ? "bg-emerald-100 text-emerald-700"
                  : coverImage.status === "failed"
                    ? "bg-rose-100 text-rose-700"
                    : coverImage.status === "generating"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-stone-100 text-slate-600"
              }`}
            >
              {getWechatCoverImageStatusLabel(coverImage.status)}
            </span>
            <button
              type="button"
              onClick={() => void onGenerateCoverImage()}
              disabled={coverImage.status === "generating"}
              className="rounded-full border border-black/10 bg-stone-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {coverImage.status === "generated" || hasRenderedCoverImage
                ? coverImage.status === "generating"
                  ? "重新生成中..."
                  : "重新生成"
                : coverImage.status === "generating"
                  ? "生成中..."
                  : "生成头图"}
            </button>
          </div>
        </div>

        {hasRenderedCoverImage ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[22px] border border-black/8 bg-stone-50">
              <div className="relative aspect-[4/3]">
                <Image
                  src={coverImage.imageUrl ?? ""}
                  alt="公众号头图预览"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="border-t border-black/6 px-4 py-3 text-xs text-slate-500">
                {coverImage.status === "generating"
                  ? "正在生成新头图，旧图会保留到新图成功替换。"
                  : coverImage.status === "failed"
                    ? coverImage.error?.trim() || "头图生成失败，当前保留上一张头图。"
                    : coverImage.model
                      ? `模型：${coverImage.model}`
                      : "已生成头图"}
              </div>
            </div>

            {canCompareCoverImages ? (
              <div className="rounded-[22px] border border-black/8 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">新旧对比</p>
                    <p className="mt-1 text-xs text-slate-500">
                      当前图已替换为新图，可随时对比上一张图，判断是否继续重试。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCoverComparison((current) => !current)}
                    className="rounded-full border border-black/10 bg-stone-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    {showCoverComparison ? "收起对比" : "查看新旧对比"}
                  </button>
                </div>

                {showCoverComparison && coverImage.previousImage?.imageUrl ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="overflow-hidden rounded-[18px] border border-emerald-200 bg-emerald-50/50">
                      <div className="border-b border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700">
                        当前图
                      </div>
                      <div className="relative aspect-[4/3]">
                        <Image
                          src={coverImage.imageUrl ?? ""}
                          alt="当前公众号头图"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-[18px] border border-black/8 bg-stone-50">
                      <div className="border-b border-black/8 px-3 py-2 text-xs font-medium text-slate-600">
                        上一张图
                      </div>
                      <div className="relative aspect-[4/3]">
                        <Image
                          src={coverImage.previousImage.imageUrl}
                          alt="上一张公众号头图"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {coverImage.status === "idle" && !hasRenderedCoverImage ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded-[22px] border border-dashed border-black/10 bg-stone-50 text-sm text-slate-500">
            尚未生成头图
          </div>
        ) : null}

        {coverImage.status === "generating" && !hasRenderedCoverImage ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded-[22px] border border-black/8 bg-stone-50 text-sm text-slate-500">
            正在生成头图...
          </div>
        ) : null}

        {coverImage.status === "failed" && !hasRenderedCoverImage ? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-[22px] border border-rose-200 bg-rose-50 px-4 text-center">
            <p className="text-sm font-medium text-rose-700">头图生成失败</p>
            <p className="mt-2 text-xs leading-5 text-rose-600">
              {coverImage.error?.trim() || "请稍后重试生成头图。"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-black/8 bg-stone-50/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium uppercase tracking-[0.16em] text-slate-400">
            字数统计
          </span>
          <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-600">
            标题 {wordCount.titleCount} 字
          </span>
          <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-600">
            正文 {wordCount.bodyCount} 字
          </span>
          <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-700">
            共 {wordCount.totalCount} 字
          </span>
        </div>
      </div>

      {finalizationStatus ? (
        <div className="rounded-[24px] border border-black/8 bg-stone-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium uppercase tracking-[0.16em] text-slate-400">
              成稿模式
            </span>
            <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-600">
              wechatFinalizationEnabled{" "}
              {finalizationStatus.enabled ? "true" : "false"}
            </span>
            <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-600">
              wechatFinalizationApplied{" "}
              {finalizationStatus.applied ? "true" : "false"}
            </span>
            {finalizationStatus.targetRangeLabel ? (
              <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-700">
                目标区间 {finalizationStatus.targetRangeLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-black/8 bg-stone-50/80 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium uppercase tracking-[0.16em] text-slate-400">
              Markdown 提示
            </span>
            {FORMAT_HINTS.map((hint) => (
              <span
                key={hint}
                className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-medium text-slate-600"
              >
                {hint}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyMarkdown()}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-stone-50"
            >
              {copyState === "markdown" ? "已复制 Markdown" : "复制 Markdown"}
            </button>
            <button
              type="button"
              onClick={() => void handleCopyWechatHtml()}
              className="rounded-full border border-black/10 bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {copyState === "wechat" ? "已复制微信格式" : "复制微信格式"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-black/10 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="border-b border-black/6 px-6 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              Markdown 正文
            </p>
            <p className="mt-1 text-sm text-slate-500">
              左侧 Markdown 是正文真相。你可以继续修改、保存到知识库，或复制原稿。
            </p>
          </div>
          <textarea
            value={resolvedBodyText}
            onChange={(event) => handleBodyChange(event.target.value)}
            spellCheck={false}
            className="min-h-[720px] w-full resize-y rounded-b-[28px] bg-white px-6 py-6 font-mono text-[14px] leading-7 text-slate-800 outline-none placeholder:text-slate-300"
            placeholder="在这里编辑 Markdown 正文。右侧会实时预览公众号排版效果。"
          />
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="border-b border-black/6 px-6 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              微信样式预览
            </p>
            <p className="mt-1 text-sm text-slate-500">
              右侧是派生预览，不是正文真相。第一版先追求足够接近公众号阅读风格。
            </p>
          </div>
          <div className="max-h-[720px] overflow-auto px-8 py-8">
            <div
              className={[
                "mx-auto max-w-[680px] font-serif text-slate-700",
                "[&_h1]:mb-5 [&_h1]:text-[32px] [&_h1]:font-semibold [&_h1]:leading-[1.35] [&_h1]:text-slate-900",
                "[&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:leading-[1.45] [&_h2]:text-slate-900",
                "[&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:leading-[1.5] [&_h3]:text-slate-800",
                "[&_p]:mb-4 [&_p]:text-[16px] [&_p]:leading-[1.95]",
                "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-l-amber-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600",
                "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
                "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
                "[&_li]:text-[16px] [&_li]:leading-[1.9]",
                "[&_hr]:my-7 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-black/10",
                "[&_a]:text-emerald-700 [&_a]:underline [&_a]:decoration-emerald-300 [&_a]:underline-offset-2",
                "[&_strong]:font-semibold [&_em]:italic",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-dashed border-black/10 bg-stone-50/70 px-4 py-3 text-sm leading-6 text-slate-500">
        当前公众号正文的新真相字段是 Markdown。第一版仍会把 Markdown 同步回旧
        `blocks`，用于兼容现有发布和历史链路。
      </div>

      <div className="rounded-[22px] border border-dashed border-black/10 bg-stone-50/70 px-4 py-3 text-sm leading-6 text-slate-500">
        当前微信样式预览优先服务编辑和复制，不保证 100% 等于公众号后台最终显示；
        但已经足够代表大多数公众号排版结果。
      </div>
    </section>
  );
}
