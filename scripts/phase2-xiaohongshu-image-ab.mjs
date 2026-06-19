import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { buildXiaohongshuImagePrompt } from "../src/lib/generation/xiaohongshu-image-prompt.ts";
import { resolveOpenRouterImageModalities } from "../src/lib/generation/openrouter-image-generation-service.ts";

const OUTPUT_DIR = "/tmp/xiaohongshu-image-ab";
const RUNS_PER_MODEL = 3;
const MODELS = [
  "bytedance-seed/seedream-4.5",
  "google/gemini-3.1-flash-image-preview",
  "openai/gpt-5-image-mini",
];
const ASPECT_RATIO = "4:5";

const prompt = buildXiaohongshuImagePrompt({
  noteTitle: "【效率日常】25-35岁职场人的可落地高效习惯笔记",
  noteCaption:
    "最近把日程和思维习惯做了几处小调整，发现效率明显提升。不是靠加班，而是用清单、时间盒和高效信息整理把复杂任务拆解成可执行的步骤。下面把我的实操经验分享给同样在职场打拼的你：先从三件事做起——清晰的优先级、快速整理信息、以及高强度日程中的缓冲时间。愿这些方法能在你的工作日落地，提高产出，也让生活更从容。",
  noteTags: ["效率提升", "时间管理", "职场成长", "高效工作", "工作方法", "日常习惯"],
  suggestionTitle: "晨间清单＋时间盒",
  suggestionDescription:
    "清晨自然光下的工作桌，桌上放着待办清单、笔记本、一个小时钟，正在把今天的三件事分配到时间段，桌面整洁，背景简约。",
});

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl =
    process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const report = {
    baseUrl,
    aspectRatio: ASPECT_RATIO,
    prompt,
    runsPerModel: RUNS_PER_MODEL,
    models: [],
  };

  for (const model of MODELS) {
    const runs = [];

    for (let index = 1; index <= RUNS_PER_MODEL; index += 1) {
      const startedAt = Date.now();

      try {
        const result = await generateImage({
          apiKey,
          baseUrl,
          model,
          prompt,
        });
        const saved = await saveImage(model, index, result.dataUrl);
        const durationMs = Date.now() - startedAt;

        runs.push({
          run: index,
          ok: true,
          durationMs,
          outputPath: saved.outputPath,
          width: saved.width,
          height: saved.height,
          mimeType: saved.mimeType,
          modalities: result.modalities,
        });
      } catch (error) {
        runs.push({
          run: index,
          ok: false,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    report.models.push({
      model,
      runs,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

async function generateImage({ apiKey, baseUrl, model, prompt }) {
  const modalities = resolveOpenRouterImageModalities(model);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities,
      image_config: {
        aspect_ratio: ASPECT_RATIO,
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${extractErrorMessage(text)}`);
  }

  const json = JSON.parse(text);
  const dataUrl = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("No image data returned");
  }

  return {
    modalities,
    dataUrl,
  };
}

async function saveImage(model, runIndex, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  const modelSlug = model.replace(/[/:]/g, "_");
  const modelDir = path.join(OUTPUT_DIR, modelSlug);
  await mkdir(modelDir, { recursive: true });
  const outputPath = path.join(modelDir, `run-${runIndex}.${parsed.extension}`);
  await writeFile(outputPath, parsed.buffer);

  const size = inspectImageSize(outputPath);
  return {
    outputPath,
    width: size.width,
    height: size.height,
    mimeType: parsed.mimeType,
  };
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/webp"
        ? "webp"
        : "png";

  return {
    mimeType,
    extension,
    buffer: Buffer.from(base64, "base64"),
  };
}

function inspectImageSize(filePath) {
  const result = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], {
    encoding: "utf8",
  });

  const widthMatch = result.stdout.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = result.stdout.match(/pixelHeight:\s+(\d+)/);

  return {
    width: widthMatch ? Number(widthMatch[1]) : null,
    height: heightMatch ? Number(heightMatch[1]) : null,
  };
}

function extractErrorMessage(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || text;
  } catch {
    return text;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
