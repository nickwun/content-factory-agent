import type { VideoScriptContent } from "../types/history.ts";
import { createRandomId } from "../utils/create-random-id.ts";

export type RawVideoScriptOutput = {
  title?: unknown;
  duration?: unknown;
  scenes?: unknown;
};

type RawVideoScene = {
  shot?: unknown;
  voiceover?: unknown;
};

const DEFAULT_TITLE = "未命名视频脚本";
const DEFAULT_DURATION = "60-90 秒";
const DEFAULT_OPENING_SHOT = "开场镜头待补充，请补上人物或场景引入。";
const DEFAULT_MIDDLE_VOICEOVER = "中段旁白待补充，请补上核心观点或步骤说明。";
const DEFAULT_CLOSING_SHOT = "收尾镜头待补充，请补上总结或行动引导画面。";
const DEFAULT_CLOSING_VOICEOVER = "结尾旁白待补充，请补上总结和收口表达。";
const DEFAULT_SHOT_PLACEHOLDER = "镜头待补充，请补上更具体的画面调度。";
const DEFAULT_VOICEOVER_PLACEHOLDER = "旁白待补充，请补上更自然的口播内容。";
const MAX_SCENES = 8;
const MIN_SCENES = 3;
const MAX_SHOT_LENGTH = 120;
const MAX_VOICEOVER_LENGTH = 180;

export function normalizeVideoScriptOutput(raw: unknown): VideoScriptContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid video script output");
  }

  const source = raw as RawVideoScriptOutput;
  const scenes = normalizeScenes(source.scenes);

  return {
    platform: "video_script",
    title:
      typeof source.title === "string" && source.title.trim()
        ? source.title.trim()
        : DEFAULT_TITLE,
    duration: normalizeDuration(source.duration),
    scenes:
      scenes.length > 0
        ? ensureMinimumScenes(scenes)
        : createFallbackScenes(),
  };
}

export function assertMeaningfulVideoScript(content: VideoScriptContent) {
  const meaningfulTitle =
    content.title.trim() && content.title.trim() !== DEFAULT_TITLE;
  const meaningfulScenes = content.scenes.some(
    (scene) =>
      (scene.shot.trim() &&
        !isPlaceholderShot(scene.shot.trim())) ||
      (scene.voiceover.trim() &&
        !isPlaceholderVoiceover(scene.voiceover.trim())),
  );

  if (!meaningfulTitle && !meaningfulScenes) {
    throw new Error("Generated video script did not contain meaningful content");
  }
}

export function extractVideoScriptJsonPayload(rawText: string) {
  const text = rawText.trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const jsonText = findFirstJsonObject(candidate);

  if (!jsonText) {
    throw new Error("Invalid video script output");
  }

  return JSON.parse(jsonText);
}

function normalizeDuration(rawDuration: unknown) {
  const value =
    typeof rawDuration === "string" ? rawDuration.replace(/\s+/g, " ").trim() : "";

  return value || DEFAULT_DURATION;
}

function normalizeScenes(rawScenes: unknown) {
  if (!Array.isArray(rawScenes)) {
    return [];
  }

  return rawScenes
    .map((scene) => normalizeScene(scene))
    .filter(
      (
        scene,
      ): scene is {
        shot: string;
        voiceover: string;
      } => scene !== null,
    )
    .slice(0, MAX_SCENES)
    .map((scene, index) => ({
      id: createRandomId("video-script"),
      index: index + 1,
      shot: scene.shot,
      voiceover: scene.voiceover,
    }));
}

function normalizeScene(rawScene: unknown) {
  if (!rawScene || typeof rawScene !== "object" || Array.isArray(rawScene)) {
    return null;
  }

  const source = rawScene as RawVideoScene;
  const shot = normalizeSceneText(source.shot, MAX_SHOT_LENGTH);
  const voiceover = normalizeSceneText(source.voiceover, MAX_VOICEOVER_LENGTH);

  if (!shot && !voiceover) {
    return null;
  }

  return {
    shot: shot || DEFAULT_SHOT_PLACEHOLDER,
    voiceover: voiceover || DEFAULT_VOICEOVER_PLACEHOLDER,
  };
}

function normalizeSceneText(rawValue: unknown, maxLength: number) {
  if (typeof rawValue !== "string") {
    return "";
  }

  const normalized = rawValue
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function ensureMinimumScenes(
  scenes: Array<{
    id: string;
    index: number;
    shot: string;
    voiceover: string;
  }>,
) {
  if (scenes.length >= MIN_SCENES) {
    return scenes;
  }

  const fallbackScenes = createFallbackScenes();

  return scenes
    .concat(fallbackScenes.slice(scenes.length, MIN_SCENES))
    .map((scene, index) => ({
      ...scene,
      index: index + 1,
    }));
}

function createFallbackScenes() {
  return [
    {
      id: createRandomId("video-script"),
      index: 1,
      shot: DEFAULT_OPENING_SHOT,
      voiceover: DEFAULT_VOICEOVER_PLACEHOLDER,
    },
    {
      id: createRandomId("video-script"),
      index: 2,
      shot: DEFAULT_SHOT_PLACEHOLDER,
      voiceover: DEFAULT_MIDDLE_VOICEOVER,
    },
    {
      id: createRandomId("video-script"),
      index: 3,
      shot: DEFAULT_CLOSING_SHOT,
      voiceover: DEFAULT_CLOSING_VOICEOVER,
    },
  ];
}

function isPlaceholderShot(value: string) {
  return [
    DEFAULT_SHOT_PLACEHOLDER,
    DEFAULT_OPENING_SHOT,
    DEFAULT_CLOSING_SHOT,
  ].includes(value);
}

function isPlaceholderVoiceover(value: string) {
  return [
    DEFAULT_VOICEOVER_PLACEHOLDER,
    DEFAULT_MIDDLE_VOICEOVER,
    DEFAULT_CLOSING_VOICEOVER,
  ].includes(value);
}

function findFirstJsonObject(text: string) {
  const startIndex = text.indexOf("{");

  if (startIndex === -1) {
    return null;
  }

  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
