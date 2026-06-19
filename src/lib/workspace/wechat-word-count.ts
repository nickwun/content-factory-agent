import { parseWechatHeadingContent } from "./wechat-editor-formatting.ts";

export type WechatArticleWordCount = {
  titleCount: number;
  bodyCount: number;
  totalCount: number;
};

export function extractVisibleWechatText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => extractVisibleWechatLine(line))
    .join("\n");
}

export function countWechatArticleWords(
  title: string,
  bodyText: string,
): WechatArticleWordCount {
  const titleCount = countNonWhitespaceCharacters(title);
  const bodyCount = countNonWhitespaceCharacters(extractVisibleWechatText(bodyText));

  return {
    titleCount,
    bodyCount,
    totalCount: titleCount + bodyCount,
  };
}

function extractVisibleWechatLine(line: string) {
  const trimmed = line.trim();

  if (trimmed === "---") {
    return "";
  }

  if (line.startsWith("## ")) {
    return stripInlineMarkers(
      parseWechatHeadingContent(line.slice(3)).text,
    );
  }

  if (line.startsWith("> ")) {
    return stripInlineMarkers(line.slice(2));
  }

  return stripInlineMarkers(line);
}

function stripInlineMarkers(text: string) {
  return text.replaceAll("**", "").replaceAll("__", "");
}

function countNonWhitespaceCharacters(text: string) {
  return text.replace(/\s+/g, "").length;
}
