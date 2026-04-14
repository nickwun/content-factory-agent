import type { WechatBlock } from "../types/history.ts";

export type PublishErrorCode =
  | "missing_credentials"
  | "invalid_api_key"
  | "no_bound_accounts"
  | "upstream_unavailable"
  | "account_not_found"
  | "unsupported_publish_type"
  | "validation_error"
  | "missing_required_asset"
  | "rate_limited"
  | "upstream_publish_failed"
  | "missing_images"
  | "invalid_image_url"
  | "not_implemented";

export type FeishuCoverSyncStatus = "synced" | "failed" | "skipped";
export type FeishuCoverSyncFailureReason = "upload_failed" | "insert_failed";

export type WechatPublishAccount = {
  accountId: string;
  nickname: string;
  principalName?: string;
  avatarUrl?: string;
  verified?: boolean;
  status: "active" | "invalid" | "disabled";
  supportedPublishTypes: Array<"article" | "xiaolvshu">;
};

export type WechatPublishSnapshot = {
  schemaVersion: string;
  platform: "wechat_article";
  recordId: string;
  title: string;
  markdownBody?: string;
  coverImageUrl?: string;
  blocks: WechatBlock[];
  relatedXiaohongshu?: {
    title: string;
    caption: string;
    tags: string[];
    imageUrls: string[];
  };
};

export type WechatPublishRequest = {
  accountId: string;
  publishType: "article" | "xiaolvshu";
  snapshot: WechatPublishSnapshot;
};

export type WechatPublishResponse = {
  success: boolean;
  publicationId?: string;
  materialId?: string;
  status?: string;
  message?: string;
  errorCode?: PublishErrorCode;
};

export type XiaohongshuPublishSnapshot = {
  schemaVersion: string;
  platform: "xiaohongshu";
  recordId: string;
  title: string;
  caption: string;
  tags: string[];
  images: Array<{
    url: string;
    index: number;
    isCover: boolean;
    source?: "generated_image" | "external_url";
  }>;
};

export type XiaohongshuPublishPayload = {
  title: string;
  plainText: string;
  coverImageUrl: string;
  bodyImageUrls: string[];
  tags: string[];
};

export type XiaohongshuPublishRequest = {
  snapshot: XiaohongshuPublishSnapshot;
};

export type XiaohongshuPublishResponse = {
  publishUrl: string;
  qrcodeUrl: string;
};

export type FeishuPublishSnapshot = {
  schemaVersion: string;
  platform: "wechat_article";
  recordId: string;
  title: string;
  markdownBody?: string;
  coverImageUrl?: string;
  blocks: WechatBlock[];
};

export type FeishuPublishPayload = {
  title: string;
  blocks: FeishuDocxBlock[];
  coverImageUrl?: string;
};

export type FeishuDocxTextRun = {
  text_run: {
    content: string;
  };
};

export type FeishuDocxBlock =
  | {
      block_type: 2;
      text: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 3;
      heading1: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 4;
      heading2: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 5;
      heading3: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 12;
      bullet: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 13;
      ordered: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 15;
      quote: {
        elements: FeishuDocxTextRun[];
      };
    }
  | {
      block_type: 22;
      divider: Record<string, never>;
    }
  | {
      block_type: 27;
      image: Record<string, never>;
    };

export type FeishuPublishRequest = {
  snapshot: FeishuPublishSnapshot;
};

export type FeishuPublishResponse = {
  success: boolean;
  documentId: string;
  documentUrl: string;
  bodyPublished: boolean;
  coverSyncStatus: FeishuCoverSyncStatus;
  coverSyncFailureReason?: FeishuCoverSyncFailureReason;
  warningMessage?: string;
  message?: string;
};
