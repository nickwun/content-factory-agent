import type {
  FeishuPublishResponse,
  PublishDestination,
  PublishErrorCode,
  PublishResult,
  WechatPublishRequest,
  WechatPublishResponse,
  XiaohongshuPublishResponse,
} from "../publish/types.ts";

export function createFailedPublishResult(input: {
  publishResultId: string;
  runId: string;
  recordId: string;
  destination: PublishDestination;
  createdAt: string;
  errorCode?: PublishErrorCode;
  errorMessage: string;
}): PublishResult {
  return {
    id: input.publishResultId,
    runId: input.runId,
    recordId: input.recordId,
    destination: input.destination,
    status: "failed",
    message: input.errorMessage,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    createdAt: input.createdAt,
  };
}

export function resolveWechatPublishDestination(
  publishType: WechatPublishRequest["publishType"],
): PublishDestination {
  return publishType === "xiaolvshu" ? "wechat_xiaolvshu" : "wechat_article";
}

export function normalizeWechatPublishResult(input: {
  publishResultId: string;
  runId: string;
  recordId: string;
  publishType: WechatPublishRequest["publishType"];
  response: WechatPublishResponse;
  createdAt: string;
}): PublishResult {
  return {
    id: input.publishResultId,
    runId: input.runId,
    recordId: input.recordId,
    destination: resolveWechatPublishDestination(input.publishType),
    status: "success",
    ...(input.response.publicationId ? { resultId: input.response.publicationId } : {}),
    message: input.response.message?.trim() || "已创建公众号草稿。",
    createdAt: input.createdAt,
    metadata: {
      publishType: input.publishType,
      ...(input.response.publicationId
        ? { publicationId: input.response.publicationId }
        : {}),
      ...(input.response.materialId ? { materialId: input.response.materialId } : {}),
    },
  };
}

export function normalizeXiaohongshuPublishResult(input: {
  publishResultId: string;
  runId: string;
  recordId: string;
  response: XiaohongshuPublishResponse;
  createdAt: string;
}): PublishResult {
  return {
    id: input.publishResultId,
    runId: input.runId,
    recordId: input.recordId,
    destination: "xiaohongshu_note",
    status: "success",
    resultUrl: input.response.publishUrl,
    message: "已生成小红书发布结果。",
    createdAt: input.createdAt,
    metadata: {
      qrcodeUrl: input.response.qrcodeUrl,
    },
  };
}

export function normalizeFeishuPublishResult(input: {
  publishResultId: string;
  runId: string;
  recordId: string;
  response: FeishuPublishResponse;
  createdAt: string;
}): PublishResult {
  return {
    id: input.publishResultId,
    runId: input.runId,
    recordId: input.recordId,
    destination: "feishu_doc",
    status:
      input.response.coverSyncStatus === "failed"
        ? "partial_success"
        : "success",
    resultId: input.response.documentId,
    resultUrl: input.response.documentUrl,
    message: input.response.message?.trim() || "飞书文档已创建。",
    ...(input.response.warningMessage
      ? { warningMessage: input.response.warningMessage }
      : {}),
    createdAt: input.createdAt,
    metadata: {
      documentId: input.response.documentId,
      coverSyncStatus: input.response.coverSyncStatus,
    },
  };
}
