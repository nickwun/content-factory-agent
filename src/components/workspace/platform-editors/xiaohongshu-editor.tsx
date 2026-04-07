import Image from "next/image";

import type { XiaohongshuContent } from "@/lib/types/history";
import {
  formatXiaohongshuTagsInput,
  getXiaohongshuImageStatusLabel,
  getXiaohongshuImageSummary,
} from "@/lib/workspace/xiaohongshu-editor";

type XiaohongshuEditorProps = {
  content: XiaohongshuContent;
  onChange: (content: XiaohongshuContent) => void;
  onGenerateImage: (suggestionId: string) => Promise<void>;
};

export function XiaohongshuEditor({
  content,
  onChange,
  onGenerateImage,
}: XiaohongshuEditorProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <div className="rounded-[32px] border border-black/10 bg-white/92 p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-rose-300">
              Note Draft
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              正文文案区
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              按标题、正文、标签的顺序整理内容，让这篇笔记先站住主叙事。
            </p>
          </div>
          <div className="rounded-full border border-black/6 bg-stone-50/90 px-2.5 py-1 text-[11px] font-medium text-slate-400 whitespace-nowrap">
            可继续编辑
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              标题
            </label>
            <input
              value={content.title}
              onChange={(event) =>
                onChange({
                  ...content,
                  title: event.target.value,
                })
              }
              className="w-full rounded-3xl border border-black/10 bg-stone-50 px-4 py-3 text-xl font-semibold outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                正文
              </label>
              <span className="text-xs text-slate-400">更像图文笔记，不必写成长文</span>
            </div>
            <textarea
              value={content.caption}
              onChange={(event) =>
                onChange({
                  ...content,
                  caption: event.target.value,
                })
              }
              className="min-h-72 w-full resize-y rounded-3xl border border-black/10 bg-stone-50 px-4 py-4 text-base leading-7 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                标签
              </label>
              <span className="text-xs text-slate-400">数据层已去掉 #，这里只做展示输入</span>
            </div>
            <input
              value={formatXiaohongshuTagsInput(content.tags)}
              onChange={(event) =>
                onChange({
                  ...content,
                  tags: event.target.value
                    .split("#")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100"
              placeholder="#工作效率 #时间管理 #自我提升"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        <div className="rounded-[28px] border border-black/10 bg-white/88 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-400">
                Image Suggestions
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                图片建议列表
              </h2>
            </div>
            <span className="rounded-full border border-black/6 bg-stone-50/90 px-2.5 py-1 text-[11px] font-medium text-slate-400 whitespace-nowrap">
              {getXiaohongshuImageSummary(content.imageSuggestions.length)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            逐条生成更贴近小红书图文氛围的真实配图。
          </p>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-1">
          {content.imageSuggestions.map((image) => (
            <article
              key={image.id}
              className={`group rounded-[22px] border p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 focus-within:ring-2 ${
                image.status === "generated"
                  ? "border-emerald-200 bg-white hover:border-emerald-300 focus-within:border-emerald-300 focus-within:ring-emerald-100"
                  : image.status === "failed"
                    ? "border-rose-200 bg-rose-50/35 hover:border-rose-300 focus-within:border-rose-300 focus-within:ring-rose-100"
                    : image.status === "generating"
                      ? "border-amber-200 bg-amber-50/35 hover:border-amber-300 focus-within:border-amber-300 focus-within:ring-amber-100"
                      : "border-black/8 bg-white/90 hover:border-amber-200 focus-within:border-amber-300 focus-within:ring-amber-100"
              }`}
            >
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {String(image.index).padStart(2, "0")}
                  </span>
                  {image.generatedAt ? (
                    <p className="text-[11px] text-slate-400">
                      {new Date(image.generatedAt).toLocaleString("zh-CN", {
                        hour12: false,
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
                    image.status === "generated"
                      ? "bg-emerald-50 text-emerald-600"
                      : image.status === "failed"
                        ? "bg-rose-50 text-rose-500"
                        : image.status === "generating"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-stone-100 text-slate-400"
                  }`}
                >
                  {getXiaohongshuImageStatusLabel(image.status)}
                </span>
              </div>

              <div className="mb-3 overflow-hidden rounded-[18px] border border-black/6 bg-stone-50/70">
                {image.imageUrl && image.status === "generated" ? (
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={image.imageUrl}
                      alt={image.title}
                      fill
                      unoptimized
                      loading="eager"
                      className="rounded-[18px] object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-between bg-[linear-gradient(145deg,_rgba(253,224,71,0.16),_rgba(251,191,36,0.10),_rgba(255,255,255,0.9))] px-4 transition group-hover:bg-[linear-gradient(145deg,_rgba(253,224,71,0.22),_rgba(251,191,36,0.14),_rgba(255,255,255,0.96))] group-focus-within:bg-[linear-gradient(145deg,_rgba(253,224,71,0.22),_rgba(251,191,36,0.14),_rgba(255,255,255,0.96))]">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                        4:5 · 无文字
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {image.status === "generating"
                          ? "正在生成真实摄影感配图"
                          : "点击生成当前建议配图"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/78 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 transition group-hover:text-slate-500 group-focus-within:text-slate-500">
                      {getXiaohongshuImageStatusLabel(image.status)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <input
                  value={image.title}
                  onChange={(event) =>
                    onChange({
                      ...content,
                      imageSuggestions: content.imageSuggestions.map((item) =>
                        item.id === image.id
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    })
                  }
                  className="w-full rounded-2xl border border-black/8 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
                <textarea
                  value={image.description}
                  onChange={(event) =>
                    onChange({
                      ...content,
                      imageSuggestions: content.imageSuggestions.map((item) =>
                        item.id === image.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    })
                  }
                  className="min-h-16 w-full resize-y rounded-2xl border border-black/8 bg-stone-50 px-3 py-2.5 text-sm leading-6 text-slate-600 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              {image.imageError ? (
                <p className="mt-2.5 text-sm leading-6 text-rose-500">
                  {image.imageError}
                </p>
              ) : null}

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {image.imageModel ? (
                    <p className="truncate text-xs text-slate-400">
                      {image.imageModel}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">4:5 · 无文字</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={image.status === "generating"}
                  onClick={() => void onGenerateImage(image.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    image.status === "generating"
                      ? "cursor-wait bg-stone-200 text-slate-500"
                      : image.status === "generated"
                        ? "bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-600"
                        : image.status === "failed"
                          ? "bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.22)] hover:bg-rose-600"
                          : "bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                  }`}
                >
                  {image.status === "generating"
                    ? "生成中..."
                    : image.status === "failed"
                      ? "重试"
                      : image.status === "generated"
                        ? "重新生成"
                        : "生成图片"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
