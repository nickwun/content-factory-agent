import { readFile } from "node:fs/promises";
import path from "node:path";

const WECHAT_FINALIZER_HUMANIZED_SKILL_PATH = path.join(
  process.cwd(),
  "src/skills/wechat-finalizer-humanized/SKILL.md",
);

let cachedWechatFinalizerHumanizedSkill: Promise<string> | null = null;

export function getWechatFinalizerHumanizedSkillPath() {
  return WECHAT_FINALIZER_HUMANIZED_SKILL_PATH;
}

export async function readWechatFinalizerHumanizedSkill() {
  if (!cachedWechatFinalizerHumanizedSkill) {
    cachedWechatFinalizerHumanizedSkill = readFile(
      WECHAT_FINALIZER_HUMANIZED_SKILL_PATH,
      "utf8",
    ).then((raw) => stripFrontmatter(raw).trim());
  }

  return cachedWechatFinalizerHumanizedSkill;
}

function stripFrontmatter(value: string) {
  return value.replace(/^---\n[\s\S]*?\n---\n/, "");
}
