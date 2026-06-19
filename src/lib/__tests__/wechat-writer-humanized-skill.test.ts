import assert from "node:assert/strict";
import test from "node:test";

import {
  getWechatWriterSystemPrompt,
} from "../generation/openrouter-generation-service.ts";
import {
  getWechatWriterHumanizedSkillPath,
  readWechatWriterHumanizedSkill,
} from "../generation/wechat-writer-humanized-skill.ts";

test("wechat writer humanized skill can be read from the dedicated skill file", async () => {
  const skill = await readWechatWriterHumanizedSkill();

  assert.match(
    getWechatWriterHumanizedSkillPath(),
    /src\/skills\/wechat-writer-humanized\/SKILL\.md$/,
  );
  assert.match(skill, /公众号长文写作/);
  assert.match(skill, /核心价值观/);
  assert.match(skill, /第一步：理解素材与选题判断/);
  assert.match(skill, /第二步：明确AI的角色边界/);
  assert.match(skill, /第三步：写作/);
  assert.match(skill, /第四步：四层自检体系/);
  assert.match(skill, /讲人话，像个活人/);
  assert.match(skill, /跑步/);
  assert.match(skill, /长期训练|长期主义|长期写作/);
  assert.match(skill, /首先、其次、最后、总而言之/);
  assert.doesNotMatch(skill, /数字生命卡兹克/);
  assert.doesNotMatch(skill, /AI行业深耕三年的内容创作者和创业者/);
});

test("wechat draft system prompt is sourced from the dedicated writer skill content", async () => {
  const prompt = await getWechatWriterSystemPrompt();

  assert.match(prompt, /公众号长文写作/);
  assert.match(prompt, /讲人话，像个活人/);
  assert.match(prompt, /绝对禁区/);
  assert.match(prompt, /四层自检体系/);
});

test("wechat draft system prompt appends the current platform preset after the writer skill", async () => {
  const preset = "你偏好克制、自然、少模板腔的公众号表达。";
  const prompt = await getWechatWriterSystemPrompt(preset);

  assert.match(prompt, /公众号长文写作/);
  assert.match(prompt, /当前平台风格预设/);
  assert.match(prompt, /你偏好克制、自然、少模板腔的公众号表达。/);
  assert.ok(
    prompt.indexOf("公众号长文写作") < prompt.indexOf("当前平台风格预设"),
  );
});
