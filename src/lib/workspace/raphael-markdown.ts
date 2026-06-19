import MarkdownIt from "markdown-it";

export const raphaelMarkdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

export function preprocessRaphaelMarkdown(content: string) {
  return content
    .replace(/^[ ]{0,3}(\*[ ]*\*[ ]*\*[\* ]*)[ \t]*$/gm, "***")
    .replace(/^[ ]{0,3}(-[ ]*-[ ]*-[- ]*)[ \t]*$/gm, "---")
    .replace(/^[ ]{0,3}(_[ ]*_[ ]*_[_ ]*)[ \t]*$/gm, "___")
    .replace(/\*\*[ \t]+\*\*/g, " ")
    .replace(/\*{4,}/g, "")
    .replace(
      /([^\s])\*\*([+\-＋－%％~～!！?？,，.。:：;；、\\/|@#￥$^&*_=（）()【】\[\]《》〈」『』“”"'`…·][^\n*]*?)\*\*/g,
      "$1**\u200B$2**",
    );
}

export function renderRaphaelMarkdownHtml(markdown: string) {
  return raphaelMarkdown.render(preprocessRaphaelMarkdown(markdown)).trim();
}
