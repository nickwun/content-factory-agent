import { PublishServiceError, toPublishErrorResponse } from "./publish-errors.ts";
import { getPublishSetting } from "../settings/publish-settings-server.ts";
import { parseWechatPublishRequestPayload } from "./wechat-publish-service.ts";
import {
  fetchWechatPublishAccounts,
  publishWechatArticle,
} from "./wechat-publish-client.ts";
import {
  getCachedWechatAccounts,
  setCachedWechatAccounts,
} from "./wechat-publish-service.ts";
import { parseXiaohongshuPublishRequestPayload } from "./xiaohongshu-publish-service.ts";
import { mapXiaohongshuSnapshotToPayload } from "./xiaohongshu-publish-mapper.ts";
import { publishXiaohongshuNote } from "./xiaohongshu-publish-client.ts";
import { parseFeishuPublishRequestPayload } from "./feishu-publish-service.ts";
import { mapFeishuSnapshotToPayload } from "./feishu-publish-mapper.ts";
import { publishFeishuDocument } from "./feishu-publish-client.ts";

export async function handleWechatAccountsRequest() {
  try {
    const apiKey = getPublishSetting("wechat_publish_api_key").value.trim();
    const baseUrl = getPublishSetting("wechat_publish_base_url").value.trim();

    if (!apiKey || !baseUrl) {
      throw new PublishServiceError(
        "missing_credentials",
        "未配置公众号发布凭证。",
        503,
      );
    }

    const credentials = { apiKey, baseUrl };
    const cachedAccounts = getCachedWechatAccounts(credentials);

    if (cachedAccounts) {
      return {
        status: 200,
        body: {
          accounts: cachedAccounts,
        },
      };
    }

    const accounts = await fetchWechatPublishAccounts(credentials);
    setCachedWechatAccounts(credentials, accounts);

    return {
      status: 200,
      body: {
        accounts,
      },
    };
  } catch (error) {
    return toPublishErrorResponse(error);
  }
}

export async function handleWechatPublishRequest(
  payload?: unknown,
  baseOrigin?: string,
) {
  try {
    const apiKey = getPublishSetting("wechat_publish_api_key").value.trim();
    const baseUrl = getPublishSetting("wechat_publish_base_url").value.trim();

    if (!apiKey || !baseUrl) {
      throw new PublishServiceError(
        "missing_credentials",
        "未配置公众号发布凭证。",
        503,
      );
    }

    const parsedRequest = parseWechatPublishRequestPayload(payload);
    const result = await publishWechatArticle(
      { apiKey, baseUrl },
      parsedRequest,
      baseOrigin || "http://localhost:3000",
    );

    return {
      status: 200,
      body: result,
    };
  } catch (error) {
    return toPublishErrorResponse(error);
  }
}

export async function handleXiaohongshuPublishRequest(
  payload?: unknown,
  baseOrigin?: string,
) {
  try {
    const apiKey = getPublishSetting("xiaohongshu_publish_api_key").value.trim();
    const baseUrl = getPublishSetting("xiaohongshu_publish_base_url").value.trim();

    if (!apiKey || !baseUrl) {
      throw new PublishServiceError(
        "missing_credentials",
        "未配置小红书发布凭证。",
        503,
      );
    }

    const parsedRequest = parseXiaohongshuPublishRequestPayload(payload);
    const publishPayload = mapXiaohongshuSnapshotToPayload(
      parsedRequest.snapshot,
      baseOrigin || "http://localhost:3000",
    );

    if (!publishPayload.coverImageUrl) {
      throw new PublishServiceError(
        "missing_images",
        "小红书发布至少需要 1 张可用图片。",
        400,
      );
    }

    const result = await publishXiaohongshuNote(
      { apiKey, baseUrl },
      publishPayload,
    );

    return {
      status: 200,
      body: result,
    };
  } catch (error) {
    return toPublishErrorResponse(error);
  }
}

export async function handleFeishuPublishRequest(
  payload?: unknown,
  baseOrigin?: string,
) {
  try {
    const appId = getPublishSetting("feishu_app_id").value.trim();
    const appSecret = getPublishSetting("feishu_app_secret").value.trim();

    if (!appId || !appSecret) {
      throw new PublishServiceError(
        "missing_credentials",
        "未配置飞书文档发布凭证。",
        503,
      );
    }

    const parsedRequest = parseFeishuPublishRequestPayload(payload);
    const publishPayload = mapFeishuSnapshotToPayload(
      parsedRequest.snapshot,
      baseOrigin || "http://localhost:3000",
    );
    const result = await publishFeishuDocument({ appId, appSecret }, publishPayload);

    return {
      status: 200,
      body: result,
    };
  } catch (error) {
    return toPublishErrorResponse(error);
  }
}
