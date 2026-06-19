import assert from "node:assert/strict";
import test from "node:test";

import { buildXiaohongshuImagePrompt } from "../generation/xiaohongshu-image-prompt.ts";

test("buildXiaohongshuImagePrompt emphasizes 4:5 vertical composition and stronger no-text constraints", () => {
  const prompt = buildXiaohongshuImagePrompt({
    noteTitle: "效率笔记",
    noteCaption:
      "最近把时间盒和每日清单一起用，明显比以前更容易进入专注状态，也更容易做复盘。",
    noteTags: ["效率提升", "时间管理"],
    suggestionTitle: "晨间清单＋时间盒",
    suggestionDescription:
      "清晨自然光下的工作桌，桌上放着待办清单、笔记本和小时钟。",
  });

  assert.match(prompt, /4:5/);
  assert.match(prompt, /竖图|竖向/);
  assert.match(prompt, /896×1152|896x1152/);
  assert.match(prompt, /no text/i);
  assert.match(prompt, /no letters/i);
  assert.match(prompt, /no numbers/i);
  assert.match(prompt, /no watermarks/i);
  assert.match(prompt, /no ui elements/i);
});

test("buildXiaohongshuImagePrompt adds narrower blank-paper constraints for handwriting and desk-planner scenes", () => {
  const prompt = buildXiaohongshuImagePrompt({
    noteTitle: "效率笔记",
    noteCaption:
      "最近把时间盒和每日清单一起用，明显比以前更容易进入专注状态，也更容易做复盘。",
    noteTags: ["效率提升", "时间管理"],
    suggestionTitle: "晨间清单＋时间盒",
    suggestionDescription:
      "清晨自然光下的工作桌，手正在空白笔记本上写下当天计划，桌上有清单本、planner、手机和时钟。",
  });

  assert.match(prompt, /blank notebook pages only/i);
  assert.match(prompt, /no handwritten notes/i);
  assert.match(prompt, /no printed planners/i);
  assert.match(prompt, /no visible checklist text/i);
  assert.match(prompt, /no phone screen content/i);
  assert.match(prompt, /no calendar numbers/i);
  assert.match(prompt, /no readable writing on paper/i);
  assert.match(prompt, /hands may hold paper, but paper must remain blank/i);
  assert.match(prompt, /no visible writing surface facing the camera/i);
  assert.match(prompt, /avoid top-down planner layouts with readable content/i);
  assert.match(prompt, /avoid close-up notebooks with visible lines of text/i);
  assert.match(prompt, /phone must be face down or screen off/i);
  assert.match(prompt, /no screens facing camera/i);
  assert.match(prompt, /no stationery with printed labels visible/i);
});

test("buildXiaohongshuImagePrompt keeps narrow paper constraints out of low-risk lifestyle scenes", () => {
  const prompt = buildXiaohongshuImagePrompt({
    noteTitle: "效率笔记",
    noteCaption: "午后做一点整理，让节奏慢下来。",
    noteTags: ["效率提升", "生活方式"],
    suggestionTitle: "午后整理时刻",
    suggestionDescription:
      "午后窗边的小桌，咖啡杯、空白笔记本、一本书和绿植摆在一起，整体轻松干净。",
  });

  assert.doesNotMatch(prompt, /no handwritten notes/i);
  assert.doesNotMatch(prompt, /no phone screen content/i);
});
