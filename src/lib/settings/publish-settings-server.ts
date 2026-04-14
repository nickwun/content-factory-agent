import { getAppDatabase } from "../db/sqlite.ts";
import {
  createPublishSettingsRepository,
  ensurePublishSettingsTable,
} from "./publish-settings-repository.ts";
import type {
  PublishCredentialKey,
  PublishCredentialSetting,
} from "./publish-settings-types.ts";

type PublishSettingsRepository = ReturnType<typeof createPublishSettingsRepository>;

export function createPublishSettingsService(
  repository: Pick<PublishSettingsRepository, "list" | "update" | "getByKey">,
) {
  return {
    listPublishSettings() {
      return repository.list();
    },

    updatePublishSetting(key: PublishCredentialKey, value: string) {
      return repository.update(key, value.trim());
    },

    getPublishSetting(key: PublishCredentialKey) {
      return repository.getByKey(key);
    },
  };
}

function getPublishSettingsService() {
  const db = getAppDatabase();
  ensurePublishSettingsTable(db, getDefaultPublishCredentialSettings());
  const repository = createPublishSettingsRepository(db);
  return createPublishSettingsService(repository);
}

export function listPublishSettings() {
  return getPublishSettingsService().listPublishSettings();
}

export function updatePublishSetting(
  key: PublishCredentialKey,
  value: string,
) {
  return getPublishSettingsService().updatePublishSetting(key, value);
}

export function getPublishSetting(key: PublishCredentialKey) {
  return getPublishSettingsService().getPublishSetting(key);
}

export function getDefaultPublishCredentialSettings(): PublishCredentialSetting[] {
  const now = new Date().toISOString();

  return [
    {
      key: "wechat_publish_api_key",
      label: "公众号发布 API Key",
      description: "用于拉取已绑定公众号列表，并提交普通文章或小绿书草稿。",
      value: "",
      updatedAt: now,
    },
    {
      key: "wechat_publish_base_url",
      label: "公众号发布 Base URL",
      description:
        "公众号发布服务的接口根地址，例如 https://wx.limyai.com/api/openapi 。",
      value: "",
      updatedAt: now,
    },
    {
      key: "xiaohongshu_publish_api_key",
      label: "小红书发布 API Key",
      description: "用于提交图文内容，并返回发布 URL 与二维码。",
      value: "",
      updatedAt: now,
    },
    {
      key: "xiaohongshu_publish_base_url",
      label: "小红书发布 Base URL",
      description: "小红书发布服务的服务端基础地址。",
      value: "",
      updatedAt: now,
    },
    {
      key: "feishu_app_id",
      label: "飞书 App ID",
      description: "飞书自建应用的 App ID，用于服务端换取 tenant_access_token。",
      value: "",
      updatedAt: now,
    },
    {
      key: "feishu_app_secret",
      label: "飞书 App Secret",
      description: "飞书自建应用的 App Secret，仅在服务端用于创建文档与上传头图。",
      value: "",
      updatedAt: now,
    },
  ];
}
