# 内容工厂核心节点 I/O 合约

这份文档只写工程上真正需要对齐的输入 / 输出。

重点：
- 写清楚主真相
- 写清楚兼容层
- 写清楚每个节点到底该吃什么、产什么

---

## 总则

### 公众号正文主真相
- 主真相：`markdownBody`
- 兼容层 / 过渡层：`blocks`

### 公众号标题
- 主真相：`title`

### 头图
- 独立资产：`coverImage`
- 不进正文 Markdown
- 公众号 / 飞书发布用封面图必须由 Codex 内部生成并落成本地或可控公共资产；不得用外部搜图、平台外生成图或未经确认的第三方图片直接充当发布封面

---

## 1. 公众号主写作节点

用途：
- 生成 `wechat_article` 第一段初稿

主要输入：
- 素材
  - `rewriteSource`
  - 或无素材时的普通生成输入
- `userPrompt`
- 当前公众号 preset
- `wechat-writer-humanized` skill

主要输出：
- `title`
- `markdownBody`

兼容输出：
- `blocks`
  - 由 `markdownBody` 派生
  - 不作为第一段主真相

不该做的事：
- 不把 second-stage 逻辑混进来
- 不直接承担发布格式导出

---

## 2. 成稿收束节点

用途：
- 对第一段初稿做第二步收束

主要输入：
- `title`
- `markdownBody`
- `wechatFinalization`

主要输出：
- `title`
- `markdownBody`
- `finalizationApplied`

内部说明：
- 这是第二步对外唯一成稿阶段
- 内部允许：
  - 一次模型收束
  - 一次 `post-trimmer` 本地补刀

规则：
- 标题默认锁死
- 不把原始素材重新当成一次写作任务
- 不新增重要论点
- 不把文章改成模板稿

---

## 3. post-trimmer

用途：
- 对 second-stage 后的正文做规则化减法裁剪

主要输入：
- `markdownBody`

主要输出：
- 裁剪后的 `markdownBody`

兼容输出：
- `blocks`
  - 由裁剪后的 `markdownBody` 派生

规则：
- 只删，不补
- 不改标题
- 不新增小标题
- 不重排段落顺序

---

## 4. Markdown 导出节点

用途：
- 从 `markdownBody` 生成微信预览 HTML 和发布 HTML

主要输入：
- `markdownBody`

主要输出：
- 预览 HTML
- 发布 HTML

当前方向：
- `wechat-markdown-export.ts` 是导出主链路
- 复制微信格式与发布 HTML 应尽量来自同一条转换链

不该做的事：
- 不再单独发明一套与 Markdown 分叉的 HTML 生成逻辑

---

## 5. 发布节点

用途：
- 生成公众号发布 snapshot 和微信草稿箱请求载荷
- 生成飞书文档发布 snapshot

主要输入：
- `title`
- `markdownBody`
- `coverImage`

优先级：
1. 若有 `markdownBody`，优先从 `markdownBody` 生成发布 HTML
2. 若没有 `markdownBody`，回退 `blocks`

主要输出：
- `publish snapshot`
- 微信草稿箱请求载荷
- 飞书文档请求载荷

兼容层：
- `blocks`
  - 用于旧记录兜底
  - 不再是新记录主发布真相

封面图规则：
- 若发布目标需要封面图，发布前必须先生成 `coverImage`
- `coverImage` 的主来源是 Codex 内部图片生成能力，生成结果应保存为本地文件或上传后的可控 URL
- 飞书文档发布时，如存在 `coverImageUrl`，应按头图、标题、正文顺序写入；若缺失，只能视为临时降级，不应作为完整发布链路的默认状态

---

## 6. 批量仿写执行节点

用途：
- 一批素材顺序复用现有单篇公众号仿写链路

主要输入：
- 批量素材列表
- 统一 `preset`
- 统一 `userPrompt`
- 平台固定 `wechat_article`

主要输出：
- 独立历史记录
- 每篇执行状态：
  - `pending`
  - `generating`
  - `succeeded`
  - `failed`

规则：
- 一篇失败不影响其他篇继续跑
- 成功项落历史，但不自动切 active record

---

## 7. 历史与编辑器节点

用途：
- 让公众号记录进入工作区后可继续编辑

主要输入：
- `HistoryRecord.content.wechat_article`

主要输出：
- Markdown 编辑器左栏正文
- 微信样式预览右栏

规则：
- 编辑器优先使用 `markdownBody`
- 旧记录若只有 `blocks`，读取时兼容转换出 `markdownBody`
- 自动保存仍以当前记录为中心，不额外新起存储系统

---

## 8. 使用这份合约时，优先回答的 3 个问题

每次改核心链路前，先回答：

1. 当前改动碰的是哪个节点？
2. 这个节点的主真相字段是什么？
3. 这轮是改主真相，还是只改兼容层？

如果这 3 个问题回答不清，先不要动代码。
