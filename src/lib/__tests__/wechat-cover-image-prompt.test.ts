import test from "node:test";
import assert from "node:assert/strict";

import { buildWechatCoverImagePrompt } from "../generation/wechat-cover-image-prompt.ts";

test("buildWechatCoverImagePrompt emphasizes WeChat cover constraints and 4:3 ratio", () => {
  const prompt = buildWechatCoverImagePrompt({
    articleTitle: "写作为什么能延缓衰老",
    articleBlocks: [
      {
        id: "h-1",
        type: "heading",
        level: 2,
        text: "写作是给大脑做长期训练",
      },
      {
        id: "p-1",
        type: "paragraph",
        text: "持续写作可以帮助人梳理经验、组织记忆，并延缓认知能力的衰退。",
      },
    ],
  });

  assert.match(prompt, /公众号头图|公众号文章头图/);
  assert.match(prompt, /4:3/);
  assert.match(prompt, /纯图案|不要任何文字/);
  assert.match(prompt, /如果出现人物.*东亚/i);
  assert.match(prompt, /不要大字标题感|不要海报/);
  assert.match(prompt, /不要 UI 截图|no ui/i);
  assert.match(prompt, /不要水印|no watermarks/i);
});

test("buildWechatCoverImagePrompt uses a lightweight semantic summary instead of dumping the full article", () => {
  const longParagraph = "写作让人能不断回看自己、澄清经验、训练表达。".repeat(80);
  const prompt = buildWechatCoverImagePrompt({
    articleTitle: "写作为什么能延缓衰老",
    articleBlocks: [
      {
        id: "p-1",
        type: "paragraph",
        text: longParagraph,
      },
    ],
  });

  assert.match(prompt, /主题摘要：/);
  assert.ok(prompt.length < longParagraph.length);
});
