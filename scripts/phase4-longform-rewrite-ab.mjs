const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RUN_LABEL = process.env.RUN_LABEL ?? "baseline";

const LONG_SOURCE_TEXT = [
  "很多人把写作理解成创作天赋的外显，但真正稳定发生作用的，往往不是作品本身，而是写作过程中持续组织信息、回看经验、筛选表达的动作。",
  "",
  "当一个人进入中年以后，他常常会感觉自己知道很多道理，却越来越难把它们真正说清楚、想明白、执行下去。这并不一定是能力突然退化，而更像是大脑长期缺少主动整理材料的训练。",
  "",
  "一、写作为什么会延缓衰老",
  "",
  "第一，写作会迫使人不断回忆、筛选和重组信息。日常生活里，很多经验只是匆匆经过，但一旦开始写，你就必须决定什么重要、什么不重要、什么应该先说、什么应该后说。",
  "",
  "第二，写作会让语言、判断、记忆和情绪调节同步运转。一个人要把一件事说明白，就不能只靠直觉，他必须把模糊感受翻译成清楚表达，这本身就是一种高强度但温和的认知训练。",
  "",
  "第三，写作能够帮助人建立持续的观察力。很多人在工作和生活里不断接收信息，却很少停下来把信息真正变成自己的理解，所以越忙越空，越看越乱。",
  "",
  "接下来要讨论的是，为什么稳定写作比偶尔写一篇更重要。",
  "",
  "二、稳定输出如何改变日常节奏",
  "",
  "当一个人每天都写一点，他会更容易发现自己在想什么、忽略了什么、真正关心什么。写作会像一个缓慢但准确的镜子，把那些原本在脑子里一闪而过的念头留下来，让人重新看到自己的思路走向。",
  "",
  "很多人总以为写作必须一次写得很好，所以迟迟不开始。其实稳定输出比偶尔输出更重要，因为频率决定了整理能力会不会留在日常生活里，而不是只在某个特殊时刻短暂出现。",
  "",
  "比如每天记录三百字，也足够形成持续感。它未必要变成公开文章，更重要的是让大脑反复经历提取、排列、判断、收束的过程。日积月累之后，人会发现自己说话更清楚、判断更稳、记忆也更有抓手。",
  "",
  "三、为什么写作不是额外负担，而是认知训练",
  "",
  "很多人把写作当成任务，所以一想到写作就联想到压力、表达焦虑和输出考核。但如果换个角度，它更像是一种给大脑做长期训练的方法：不追求一次完成多大成果，而是通过重复的小输出，让大脑维持活跃、敏感和有秩序的状态。",
  "",
  "写作真正珍贵的地方，不是它让人显得会表达，而是它会让人持续思考、持续筛选、持续更新自己。一个持续写作的人，往往不是记住了更多材料，而是更擅长从复杂经验里找出重点，再重新组织成可以行动的理解。",
  "",
  "最后，不要把写作理解成创作压力，更像是给大脑做长期训练。你不需要一下子写出伟大的作品，只需要让自己保持稳定输出，让大脑始终处在可整理、可反思、可表达的工作状态里。",
  "",
  "补充说明：这种训练并不要求统一格式，也不要求必须写成长文。日记、卡片、随笔、工作复盘都可以成为材料。关键不是形式，而是那个持续回看、辨认、重组的过程。".repeat(
    60,
  ),
].join("\n");

const CASES = [
  {
    key: "wechat",
    platform: "wechat_article",
    prompt: "仿写一篇关于写作延缓衰老的公众号文章，保持完整论证和清晰结构。",
  },
  {
    key: "xiaohongshu",
    platform: "xiaohongshu",
    prompt:
      "请把这篇长文仿写成一篇完整的小红书图文笔记，语气自然，适合普通读者阅读。",
  },
];

async function main() {
  const results = {};

  for (const testCase of CASES) {
    results[testCase.key] = await runCase(testCase);
  }

  console.log(
    JSON.stringify(
      {
        label: RUN_LABEL,
        baseUrl: BASE_URL,
        sample: {
          charCount: LONG_SOURCE_TEXT.length,
        },
        results,
      },
      null,
      2,
    ),
  );
}

async function runCase(testCase) {
  const startedAt = performance.now();

  try {
    const response = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userPrompt: testCase.prompt,
        selectedPlatforms: [testCase.platform],
        rewriteSource: {
          kind: "pasted_text",
          extractedText: LONG_SOURCE_TEXT,
          charCount: LONG_SOURCE_TEXT.length,
          truncated: false,
        },
      }),
    });

    const durationMs = Math.round(performance.now() - startedAt);
    const data = await response.json();

    const generationInfo = data?.draft?.generationInfo ?? null;
    const summary = summarizeResult(testCase.platform, data);
    const error = data?.error ?? null;

    return {
      success: response.ok,
      status: response.status,
      timedOut:
        response.status === 504 || error?.code === "generation_timeout",
      fetchFailed: /fetch failed/i.test(error?.message ?? ""),
      durationMs,
      rewriteMode: generationInfo?.rewriteMode ?? null,
      usedLongformRewrite: generationInfo?.usedLongformRewrite ?? null,
      rewriteChunkCount: generationInfo?.rewriteChunkCount ?? null,
      rewriteBriefVersion: generationInfo?.rewriteBriefVersion ?? null,
      error,
      ...summary,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    return {
      success: false,
      status: null,
      timedOut: false,
      fetchFailed: /fetch failed/i.test(error instanceof Error ? error.message : String(error)),
      durationMs,
      rewriteMode: null,
      usedLongformRewrite: null,
      rewriteChunkCount: null,
      rewriteBriefVersion: null,
      error: {
        code: "request_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function summarizeResult(platform, data) {
  if (platform === "wechat_article") {
    const article = data?.draft?.content?.wechat_article;
    const combinedText = [
      article?.title ?? "",
      ...(article?.blocks ?? []).flatMap((block) =>
        block.type === "list" ? block.items : "text" in block ? [block.text] : [],
      ),
    ].join("\n");

    return {
      title: article?.title ?? null,
      looksLikeFullContent:
        (article?.blocks?.length ?? 0) >= 5 && combinedText.length > 700,
      preservesStructureFeel:
        (article?.blocks?.filter((block) => block.type === "heading").length ?? 0) >= 2,
      preservesMustKeepPoints:
        combinedText.includes("稳定输出比偶尔输出更重要") &&
        (combinedText.includes("长期训练") || combinedText.includes("认知训练")),
    };
  }

  const note = data?.draft?.content?.xiaohongshu;
  const combinedText = `${note?.title ?? ""}\n${note?.caption ?? ""}`;

  return {
    title: note?.title ?? null,
    looksLikeFullContent:
      (note?.caption?.length ?? 0) > 180 && (note?.imageSuggestions?.length ?? 0) >= 3,
    preservesStructureFeel:
      /第一|第二|最后|其实|很多人/.test(note?.caption ?? ""),
    preservesMustKeepPoints:
      combinedText.includes("稳定输出") &&
      (combinedText.includes("长期训练") || combinedText.includes("认知训练")),
  };
}

await main();
