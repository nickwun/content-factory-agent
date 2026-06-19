type BuildXiaohongshuImagePromptInput = {
  noteTitle: string;
  noteCaption: string;
  noteTags: string[];
  suggestionTitle: string;
  suggestionDescription: string;
};

export function buildXiaohongshuImagePrompt(
  input: BuildXiaohongshuImagePromptInput,
) {
  const captionSummary = summarizeCaption(input.noteCaption);
  const tags = input.noteTags.filter(Boolean).join("、");
  const highRiskPaperScene = isHighRiskPaperScene(input);

  return [
    "请生成一张适合作为小红书图文笔记配图的真实摄影风格图片。",
    "画面目标：小红书图文笔记配图，真实摄影感，干净简洁，现代生活 / 办公氛围，自然光。",
    "构图要求：明确使用竖向 4:5 构图，按 896x1152 的竖图比例组织主体，避免正方形画面和横图构图，主体尽量在 4:5 画幅内自然铺满。",
    `笔记标题：${input.noteTitle.trim()}`,
    `配图主题：${input.suggestionTitle.trim()}`,
    `画面说明：${input.suggestionDescription.trim()}`,
    captionSummary ? `正文摘要：${captionSummary}` : "",
    tags ? `风格关键词：${tags}` : "",
    "细节要求：更像真实拍摄的日常场景，不要做成海报、宣传图、UI 截图或插画。",
    "负向约束：no text, no letters, no numbers, no captions, no signage, no labels, no logos, no watermarks, no UI elements.",
    "如果场景里天然会出现本子、钟表、屏幕、门牌或包装，请用空白、模糊或不可读元素替代，绝对不要出现任何可辨认文字、数字、图标或品牌信息。",
    highRiskPaperScene
      ? "高风险物体约束：blank notebook pages only, no handwritten notes, no printed planners, no visible checklist text, no phone screen content, no app UI, no labels or packaging text, no calendar numbers, no readable writing on paper, hands may hold paper, but paper must remain blank, no visible writing surface facing the camera, avoid top-down planner layouts with readable content, avoid close-up notebooks with visible lines of text, phone must be face down or screen off, no screens facing camera, no stationery with printed labels visible."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRetriedXiaohongshuImagePrompt(basePrompt: string) {
  return [
    basePrompt,
    "重试要求：strictly no readable text，strictly no letters or numbers，no signage / logo / UI，portrait / 4:5 framing only。",
    "请进一步压缩所有可能出现文字、数字、屏幕界面、标签、品牌标识、门牌、便签字样的元素，必要时用纯空白、模糊或不可读形状替代。",
  ].join("\n");
}

function summarizeCaption(caption: string) {
  const normalized = caption.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119).trim()}…`;
}

function isHighRiskPaperScene(input: BuildXiaohongshuImagePromptInput) {
  const haystack = [
    input.suggestionTitle,
    input.suggestionDescription,
    input.noteCaption,
  ]
    .join(" ")
    .toLowerCase();

  const highRiskKeywords = [
    "hand",
    "handwriting",
    "planner",
    "checklist",
    "calendar",
    "screen",
    "phone",
    "清单",
    "手",
    "手部",
    "写下",
    "写字",
    "计划本",
    "日历",
    "日程",
    "手机",
    "屏幕",
    "晨间",
  ];

  return highRiskKeywords.some((keyword) => haystack.includes(keyword));
}
