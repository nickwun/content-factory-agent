import { PublishServiceError } from "./publish-errors.ts";
import type { FeishuPublishRequest } from "./types.ts";

export function parseFeishuPublishRequestPayload(
  payload: unknown,
): FeishuPublishRequest {
  const request = payload as {
    snapshot?: {
      schemaVersion?: string;
      platform?: string;
      recordId?: string;
      title?: string;
      markdownBody?: string;
      coverImageUrl?: string;
      blocks?: unknown;
    };
  };

  const snapshot = request.snapshot;

  if (!snapshot || snapshot.platform !== "wechat_article") {
    throw new PublishServiceError(
      "validation_error",
      "飞书文档发布仅支持公众号文章快照。",
      400,
    );
  }

  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
  const hasMarkdown =
    typeof snapshot.markdownBody === "string" &&
    snapshot.markdownBody.trim().length > 0;

  if (!snapshot.title?.trim() || (!hasMarkdown && blocks.length === 0)) {
    throw new PublishServiceError(
      "validation_error",
      "当前内容未通过飞书文档发布预检查。",
      400,
    );
  }

  return {
    snapshot: {
      schemaVersion: snapshot.schemaVersion?.trim() || "v1",
      platform: "wechat_article",
      recordId: snapshot.recordId?.trim() || "",
      title: snapshot.title.trim(),
      ...(hasMarkdown ? { markdownBody: snapshot.markdownBody?.trim() } : {}),
      ...(typeof snapshot.coverImageUrl === "string" &&
      snapshot.coverImageUrl.trim().length > 0
        ? { coverImageUrl: snapshot.coverImageUrl.trim() }
        : {}),
      blocks: blocks as FeishuPublishRequest["snapshot"]["blocks"],
    },
  };
}
