import { useRef, useState } from "react";

import type { WechatArticleContent, WechatBlock } from "@/lib/types/history";
import {
  buildWechatStructureItems,
  getWechatBlockLabel,
  removeWechatBlock,
} from "@/lib/workspace/wechat-blocks";

type WechatEditorProps = {
  content: WechatArticleContent;
  onChange: (content: WechatArticleContent) => void;
};

export function WechatEditor({ content, onChange }: WechatEditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const structureItems = buildWechatStructureItems(content);

  const updateBlock = (
    blockId: string,
    updater: (block: WechatBlock) => WechatBlock,
  ) => {
    onChange({
      ...content,
      blocks: content.blocks.map((block) =>
        block.id === blockId ? updater(block) : block,
      ),
    });
  };

  const addBlock = (type: WechatBlock["type"]) => {
    const nextBlock: WechatBlock =
      type === "divider"
        ? { id: crypto.randomUUID(), type: "divider" }
        : type === "list"
          ? { id: crypto.randomUUID(), type: "list", items: ["新条目"] }
          : type === "heading"
            ? {
                id: crypto.randomUUID(),
                type: "heading",
                level: 2,
                text: "新的小标题",
              }
            : {
                id: crypto.randomUUID(),
                type,
                text: "新的内容",
              };

    onChange({
      ...content,
      blocks: [...content.blocks, nextBlock],
    });
  };

  const removeBlock = (blockId: string) => {
    onChange(removeWechatBlock(content, blockId));
  };

  const jumpToStructureItem = (item: (typeof structureItems)[number]) => {
    if (!item.blockId) {
      titleInputRef.current?.focus();
      titleInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setFocusedBlockId(item.blockId);
    const blockNode = blockRefs.current[item.blockId];

    blockNode?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const editableNode = blockNode?.querySelector("textarea");

    if (editableNode instanceof HTMLTextAreaElement) {
      editableNode.focus();
    }
  };

  return (
    <section className="space-y-5">
      <input
        ref={titleInputRef}
        value={content.title}
        onChange={(event) =>
          onChange({
            ...content,
            title: event.target.value,
          })
        }
        className="w-full rounded-3xl border border-black/10 bg-white px-5 py-4 text-2xl font-semibold outline-none ring-0 placeholder:text-slate-300"
        placeholder="输入文章标题"
      />

      <div className="flex flex-wrap gap-2">
        {[
          { label: "段落", type: "paragraph" as const },
          { label: "小标题", type: "heading" as const },
          { label: "引用", type: "quote" as const },
          { label: "列表", type: "list" as const },
          { label: "分隔线", type: "divider" as const },
        ].map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => addBlock(item.type)}
            className="rounded-full border border-black/10 bg-stone-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
          >
            + {item.label}
          </button>
        ))}
      </div>

      {structureItems.length > 1 ? (
        <div className="rounded-[24px] border border-black/8 bg-stone-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              快速定位
            </span>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {structureItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => jumpToStructureItem(item)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    item.type === "title"
                      ? "border-black/10 bg-white text-slate-700"
                      : "border-black/8 bg-white/80 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {item.label}
                  {item.type === "title" ? "" : ` · ${item.preview}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {content.blocks.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-stone-50/80 px-5 py-6 text-sm leading-7 text-slate-500">
          当前还没有正文内容块。你可以先添加段落、小标题、引用、列表或分隔线，再继续编辑文章结构。
        </div>
      ) : (
        <div className="space-y-4">
          {content.blocks.map((block) => (
            <div
              key={block.id}
              ref={(node) => {
                blockRefs.current[block.id] = node;
              }}
              className={`group transition ${
                block.type === "paragraph"
                  ? `rounded-[22px] border px-4 py-3 ${
                      focusedBlockId === block.id
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-black/8 bg-white"
                    }`
                  : `rounded-[24px] border px-4 py-4 ${
                      focusedBlockId === block.id
                        ? "border-slate-300 bg-stone-50/90 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                        : "border-black/10 bg-white/92 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
                    }`
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] ${
                    block.type === "paragraph"
                      ? "bg-transparent text-slate-300"
                      : "bg-stone-100 text-slate-500"
                  }`}
                >
                  {getWechatBlockLabel(block)}
                </span>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    focusedBlockId === block.id
                      ? "border-black/10 bg-white text-slate-500 opacity-100"
                      : "border-black/8 bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                  } hover:border-rose-200 hover:text-rose-600`}
                >
                  删除
                </button>
              </div>

              {block.type === "divider" ? (
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-black/10 bg-stone-50/90 px-4 py-5">
                  <div className="h-px flex-1 bg-black/10" />
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    分隔线
                  </span>
                  <div className="h-px flex-1 bg-black/10" />
                </div>
              ) : block.type === "list" ? (
                <textarea
                  value={block.items.join("\n")}
                  onChange={(event) =>
                    updateBlock(block.id, () => ({
                      ...block,
                      items: event.target.value.split("\n"),
                    }))
                  }
                  onFocus={() => setFocusedBlockId(block.id)}
                  onBlur={() =>
                    setFocusedBlockId((current) =>
                      current === block.id ? null : current,
                    )
                  }
                  className="min-h-32 w-full resize-y rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm leading-7 outline-none focus:border-slate-300 focus:bg-white"
                />
              ) : (
                <textarea
                  value={block.text}
                  onChange={(event) =>
                    updateBlock(block.id, () => ({
                      ...block,
                      text: event.target.value,
                    }))
                  }
                  onFocus={() => setFocusedBlockId(block.id)}
                  onBlur={() =>
                    setFocusedBlockId((current) =>
                      current === block.id ? null : current,
                    )
                  }
                  className={`w-full resize-y rounded-2xl border border-black/10 px-4 py-3 outline-none ${
                    block.type === "heading"
                      ? "min-h-24 bg-stone-50 text-xl font-semibold focus:border-slate-300 focus:bg-white"
                      : block.type === "quote"
                        ? "min-h-28 border-l-4 border-l-amber-400 bg-stone-50 text-base italic focus:border-slate-300 focus:bg-white"
                        : "min-h-28 border-transparent bg-transparent text-base leading-8 focus:border-amber-200 focus:bg-white"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
