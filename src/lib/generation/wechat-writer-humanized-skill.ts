import { readFile } from "node:fs/promises";
import path from "node:path";

const WECHAT_WRITER_HUMANIZED_SKILL_PATH = path.join(
  process.cwd(),
  "src/skills/wechat-writer-humanized/SKILL.md",
);

let cachedWechatWriterHumanizedSkill: Promise<string> | null = null;

export function getWechatWriterHumanizedSkillPath() {
  return WECHAT_WRITER_HUMANIZED_SKILL_PATH;
}

export async function readWechatWriterHumanizedSkill() {
  if (!cachedWechatWriterHumanizedSkill) {
    cachedWechatWriterHumanizedSkill = readFile(
      WECHAT_WRITER_HUMANIZED_SKILL_PATH,
      "utf8",
    ).then((raw) => stripFrontmatter(raw).trim());
  }

  return cachedWechatWriterHumanizedSkill;
}

function stripFrontmatter(value: string) {
  return value.replace(/^---\n[\s\S]*?\n---\n/, "");
}
