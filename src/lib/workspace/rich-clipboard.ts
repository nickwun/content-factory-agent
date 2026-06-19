export type RichClipboardStrategy =
  | "async-html"
  | "selection-html"
  | "async-text"
  | "unavailable";

type RichClipboardCapabilities = {
  hasClipboardItem: boolean;
  hasClipboardWrite: boolean;
  hasClipboardWriteText: boolean;
  hasSelectionCopy: boolean;
};

type CopyRichHtmlInput = {
  html: string;
  text: string;
};

export function resolveRichClipboardStrategy(
  capabilities: RichClipboardCapabilities,
): RichClipboardStrategy {
  if (capabilities.hasClipboardItem && capabilities.hasClipboardWrite) {
    return "async-html";
  }

  if (capabilities.hasSelectionCopy) {
    return "selection-html";
  }

  if (capabilities.hasClipboardWriteText) {
    return "async-text";
  }

  return "unavailable";
}

export async function copyRichHtmlToClipboard({
  html,
  text,
}: CopyRichHtmlInput): Promise<RichClipboardStrategy> {
  const strategy = resolveRichClipboardStrategy({
    hasClipboardItem: typeof window !== "undefined" && "ClipboardItem" in window,
    hasClipboardWrite: Boolean(navigator.clipboard?.write),
    hasClipboardWriteText: Boolean(navigator.clipboard?.writeText),
    hasSelectionCopy: canUseSelectionCopy(),
  });

  if (strategy === "async-html") {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return strategy;
  }

  if (strategy === "selection-html") {
    copyHtmlBySelection(html);
    return strategy;
  }

  if (strategy === "async-text") {
    await navigator.clipboard.writeText(html);
    return strategy;
  }

  throw new Error("当前浏览器不支持一键复制，请手动选中内容复制。");
}

function canUseSelectionCopy() {
  if (typeof document === "undefined") return false;
  if (!document.body || typeof document.createRange !== "function") return false;
  if (typeof window === "undefined" || typeof window.getSelection !== "function") {
    return false;
  }

  return typeof document.execCommand === "function";
}

function copyHtmlBySelection(html: string) {
  const container = document.createElement("div");
  container.setAttribute("contenteditable", "true");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "1px";
  container.style.height = "1px";
  container.style.overflow = "hidden";
  container.innerHTML = html;

  document.body.appendChild(container);

  const selection = window.getSelection();
  const previousRanges: Range[] = [];

  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      previousRanges.push(selection.getRangeAt(index).cloneRange());
    }
  }

  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("浏览器拒绝执行复制命令。");
    }
  } finally {
    selection?.removeAllRanges();
    for (const range of previousRanges) {
      selection?.addRange(range);
    }
    container.remove();
  }
}
