import assert from "node:assert/strict";
import test from "node:test";

import {
  createFailedPublishResult,
  normalizeFeishuPublishResult,
  normalizeWechatPublishResult,
  normalizeXiaohongshuPublishResult,
} from "../observability/publish-observability.ts";

test("normalizeWechatPublishResult keeps destination scoped to publish type", () => {
  const result = normalizeWechatPublishResult({
    publishResultId: "publish-result-1",
    runId: "publish-2026-04-15T12:00:00.000Z-seq-1",
    recordId: "record-1",
    publishType: "xiaolvshu",
    response: {
      success: true,
      publicationId: "pub-1",
      materialId: "mat-1",
      status: "draft",
      message: "已创建草稿",
    },
    createdAt: "2026-04-15T12:00:00.000Z",
  });

  assert.deepEqual(result, {
    id: "publish-result-1",
    runId: "publish-2026-04-15T12:00:00.000Z-seq-1",
    recordId: "record-1",
    destination: "wechat_xiaolvshu",
    status: "success",
    resultId: "pub-1",
    message: "已创建草稿",
    createdAt: "2026-04-15T12:00:00.000Z",
    metadata: {
      publishType: "xiaolvshu",
      publicationId: "pub-1",
      materialId: "mat-1",
    },
  });
});

test("normalizeXiaohongshuPublishResult keeps stable result url and qrcode metadata", () => {
  const result = normalizeXiaohongshuPublishResult({
    publishResultId: "publish-result-2",
    runId: "publish-2026-04-15T12:10:00.000Z-seq-2",
    recordId: "record-2",
    response: {
      publishUrl: "https://www.xiaohongshu.com/published/123",
      qrcodeUrl: "https://cdn.example.com/qrcode.png",
    },
    createdAt: "2026-04-15T12:10:00.000Z",
  });

  assert.deepEqual(result, {
    id: "publish-result-2",
    runId: "publish-2026-04-15T12:10:00.000Z-seq-2",
    recordId: "record-2",
    destination: "xiaohongshu_note",
    status: "success",
    resultUrl: "https://www.xiaohongshu.com/published/123",
    message: "已生成小红书发布结果。",
    createdAt: "2026-04-15T12:10:00.000Z",
    metadata: {
      qrcodeUrl: "https://cdn.example.com/qrcode.png",
    },
  });
});

test("normalizeFeishuPublishResult keeps partial success semantics when cover sync fails", () => {
  const result = normalizeFeishuPublishResult({
    publishResultId: "publish-result-3",
    runId: "publish-2026-04-15T12:20:00.000Z-seq-3",
    recordId: "record-3",
    response: {
      success: true,
      documentId: "doc-1",
      documentUrl: "https://feishu.cn/docx/doc-1",
      bodyPublished: true,
      coverSyncStatus: "failed",
      warningMessage: "文档已创建，正文已发布，头图未同步。",
      message: "飞书文档已创建，正文已发布，头图未同步。",
    },
    createdAt: "2026-04-15T12:20:00.000Z",
  });

  assert.deepEqual(result, {
    id: "publish-result-3",
    runId: "publish-2026-04-15T12:20:00.000Z-seq-3",
    recordId: "record-3",
    destination: "feishu_doc",
    status: "partial_success",
    resultId: "doc-1",
    resultUrl: "https://feishu.cn/docx/doc-1",
    message: "飞书文档已创建，正文已发布，头图未同步。",
    warningMessage: "文档已创建，正文已发布，头图未同步。",
    createdAt: "2026-04-15T12:20:00.000Z",
    metadata: {
      documentId: "doc-1",
      coverSyncStatus: "failed",
    },
  });
});

test("createFailedPublishResult keeps destination and error summary without inventing result url", () => {
  const result = createFailedPublishResult({
    publishResultId: "publish-result-4",
    runId: "publish-2026-04-15T12:30:00.000Z-seq-4",
    recordId: "record-4",
    destination: "wechat_article",
    createdAt: "2026-04-15T12:30:00.000Z",
    errorCode: "validation_error",
    errorMessage: "当前内容未通过公众号发布预检查。",
  });

  assert.deepEqual(result, {
    id: "publish-result-4",
    runId: "publish-2026-04-15T12:30:00.000Z-seq-4",
    recordId: "record-4",
    destination: "wechat_article",
    status: "failed",
    message: "当前内容未通过公众号发布预检查。",
    errorCode: "validation_error",
    errorMessage: "当前内容未通过公众号发布预检查。",
    createdAt: "2026-04-15T12:30:00.000Z",
  });
});
