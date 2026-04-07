export type PublishCredentialKey =
  | "wechat_publish_api_key"
  | "wechat_publish_base_url"
  | "xiaohongshu_publish_api_key"
  | "xiaohongshu_publish_base_url";

export type PublishCredentialSetting = {
  key: PublishCredentialKey;
  label: string;
  description: string;
  value: string;
  updatedAt: string;
};
