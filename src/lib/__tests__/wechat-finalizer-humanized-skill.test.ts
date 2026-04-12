import assert from "node:assert/strict";
import test from "node:test";

import {
  getWechatFinalizationSystemPrompt,
} from "../generation/openrouter-generation-service.ts";
import {
  getWechatFinalizerHumanizedSkillPath,
  readWechatFinalizerHumanizedSkill,
} from "../generation/wechat-finalizer-humanized-skill.ts";

test("wechat finalizer humanized skill can be read from the dedicated skill file", async () => {
  const skill = await readWechatFinalizerHumanizedSkill();

  assert.match(
    getWechatFinalizerHumanizedSkillPath(),
    /src\/skills\/wechat-finalizer-humanized\/SKILL\.md$/,
  );
  assert.match(skill, /公众号成稿整理（活人感 \/ 去 AI 味版）/);
  assert.match(skill, /你现在不是在重写文章，也不是在写一篇“更像公众号爆文”的版本/);
  assert.match(skill, /你的角色/);
  assert.match(skill, /你的唯一任务/);
  assert.match(skill, /触发条件/);
  assert.match(skill, /当前平台是 `wechat_article`/);
  assert.match(skill, /保留活人感/);
  assert.match(skill, /口语感/);
  assert.match(skill, /模板式开号/);
  assert.match(skill, /十三、失败回退原则/);
});

test("wechat finalization system prompt is sourced from the dedicated skill content", async () => {
  const prompt = await getWechatFinalizationSystemPrompt();

  assert.match(prompt, /你现在不是在重写文章/);
  assert.match(prompt, /非常克制的编辑/);
  assert.match(prompt, /你的唯一任务/);
  assert.match(prompt, /模板式开号/);
  assert.match(prompt, /过度传播腔/);
});
